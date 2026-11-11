import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, FONTS, TEXT_RESOLUTION } from '@/config/theme';
import {
  activityScene,
  getRightArea,
  isPlayable,
  type Activity,
  type RightArea,
} from '@/config/rights';
import type { VoiceLine } from '@/config/levels';
import { HUB_FINAL_LOCKED, HUB_LOCKED, HUB_SOON } from '@/config/phrases';
import { ensureArt, tex } from '@/art/Art';
import { addBackdrop } from '@/components/Backdrop';
import { addRightMedal } from '@/components/Badges';
import { Effects } from '@/components/Effects';
import { IdleHint } from '@/components/HelperHand';
import { addLockIcon, addStarIcon } from '@/components/Icons';
import { PillButton } from '@/components/PillButton';
import { SpeechBubble } from '@/components/SpeechBubble';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo, prefetchScene } from '@/core/SceneTransition';
import { fitImage } from './BaseActivity';

/** Área de tarjetas (a la derecha del panel de la medalla). */
const AREA_X = 330;
const AREA_W = 914;
const GAP = 18;
const GAMES_Y = 272;
const GAME_H = 168;
const CHALL_Y = 482;
const CHALL_H = 100;

/** Fondos suaves para los íconos de los juegos (como fichas de colores). */
const TILE_TINTS = [0xfff1c2, 0xdcefff, 0xffe0e0, 0xf1e4d4, 0xe3f6dc, 0xece4ff];

/** Derechos ya explicados en esta sesión (para no repetir la explicación en cada regreso). */
const explained = new Set<string>();

type CardState = 'open' | 'locked' | 'final-locked' | 'soon';

/** Versión oscura de un color (para la barra del título y el botón "Jugar"; contraste con texto blanco). */
function darken(color: number, f = 0.62): number {
  const r = Math.round(((color >> 16) & 0xff) * f);
  const g = Math.round(((color >> 8) & 0xff) * f);
  const b = Math.round((color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

const cssColor = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Borde punteado de rectángulo redondeado (tarjetas bloqueadas). */
function dashedRoundRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const dash = 9;
  const gap = 7;
  const seg = (x1: number, y1: number, x2: number, y2: number): void => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < len; d += dash + gap) {
      const t1 = d / len;
      const t2 = Math.min(len, d + dash) / len;
      g.lineBetween(
        x1 + (x2 - x1) * t1,
        y1 + (y2 - y1) * t1,
        x1 + (x2 - x1) * t2,
        y1 + (y2 - y1) * t2,
      );
    }
  };
  seg(x + r, y, x + w - r, y);
  seg(x + r, y + h, x + w - r, y + h);
  seg(x, y + r, x, y + h - r);
  seg(x + w, y + r, x + w, y + h - r);
  for (const [cx, cy, a0] of [
    [x + r, y + r, Math.PI],
    [x + w - r, y + r, Math.PI * 1.5],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI * 0.5],
  ] as const) {
    g.beginPath();
    g.arc(cx, cy, r, a0, a0 + Math.PI / 2);
    g.strokePath();
  }
}

/**
 * Pantalla de un derecho: panel "Tu medalla" (progreso), JUEGOS, DESAFÍOS (se abren al terminar
 * los juegos) y Tori diciendo qué sigue. El siguiente juego se resalta con "¡Te toca!".
 */
export default class RightHubScene extends Phaser.Scene {
  private right!: RightArea;
  private bubble!: SpeechBubble;
  private tori!: Tori;
  private next: Activity | null = null;
  private hintTarget: { x: number; y: number } | null = null;

  constructor() {
    super('RightHub');
  }

  init(data: { rightId: string }): void {
    this.right = getRightArea(data.rightId);
    this.next = null;
    this.hintTarget = null;
  }

  create(): void {
    const r = this.right;
    ensureArt(this, [r.icon, ...[...r.games, ...r.challenges].map((a) => a.icon)]);
    addBackdrop(this);
    new Effects(this);

    // Lo que "toca" ahora: primer juego pendiente; si no hay, primer desafío abierto pendiente.
    const pendingGame = r.games.find(
      (a) => isPlayable(a) && GameState.getActivityStars(r.id, a.id) === 0,
    );
    const pendingChallenge = r.challenges.find(
      (a) =>
        isPlayable(a) &&
        GameState.challengeUnlocked(r, a.id) &&
        GameState.getActivityStars(r.id, a.id) === 0,
    );
    this.next = pendingGame ?? pendingChallenge ?? null;

    this.addHeader();
    this.addMedalPanel();
    this.addGames();
    this.addChallenges();

    this.tori = new Tori(this, 105, 640, 0.44);
    this.bubble = new SpeechBubble(this, 640, 652, {
      width: 900,
      tail: 'left',
      tori: this.tori,
      fontSize: 24,
    });
    const status = this.statusLine();
    const lines: VoiceLine[] = explained.has(r.id) ? [status] : [...r.explanation, status];
    explained.add(r.id);
    this.time.delayedCall(450, () => void this.bubble.say(lines));
    new IdleHint(this, () => (this.hintTarget ? { kind: 'tap', ...this.hintTarget } : null));

    if (this.next && isPlayable(this.next)) prefetchScene(activityScene(this.next));
  }

  // ------------------------------------------------------------------ encabezado

  private addHeader(): void {
    const r = this.right;
    new PillButton(this, 105, 60, {
      label: 'Mapa',
      icon: 'back',
      width: 150,
      onClick: () => void goTo(this, 'WorldMap'),
    }).setDepth(DEPTH.ui);

    const dark = darken(r.color);
    const bar = bakedTexture(this, `hub-bar-${dark.toString(16)}`, 884, 78, (g) => {
      g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(4, 10, 876, 64, 22);
      g.fillStyle(dark).fillRoundedRect(4, 4, 876, 64, 22);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(4, 4, 876, 64, 22);
    });
    const barX = 640;
    this.add.image(barX, 63, bar).setDepth(DEPTH.ui);
    const title = this.add
      .text(barX + 22, 60, r.name, {
        fontFamily: FONTS.title,
        fontSize: r.name.length > 28 ? '28px' : '34px',
        fontStyle: '800',
        color: CSS.white,
        resolution: TEXT_RESOLUTION,
        padding: { top: 6 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui);
    const iconX = title.x - title.width / 2 - 34;
    this.add.circle(iconX, 60, 24, COLORS.white).setStrokeStyle(3, COLORS.ink).setDepth(DEPTH.ui);
    this.add.image(iconX, 60, tex(r.icon)).setScale(0.38).setDepth(DEPTH.ui);

    // Estrellas del derecho.
    const { stars, max } = GameState.rightStars(r);
    const pill = bakedTexture(this, 'hub-stars-pill', 168, 72, (g) => {
      g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(4, 9, 160, 60, 30);
      g.fillStyle(COLORS.white).fillRoundedRect(4, 4, 160, 60, 30);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(4, 4, 160, 60, 30);
    });
    const px = 1170;
    this.add.image(px, 63, pill).setDepth(DEPTH.ui);
    addStarIcon(this, px - 46, 60, 17, true).setDepth(DEPTH.ui);
    const count = addTitle(this, 0, 60, `${stars}`, 32).setOrigin(0, 0.5).setDepth(DEPTH.ui);
    const total = addBody(this, 0, 64, `/ ${max}`, 18, { color: '#5B6475' })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.ui);
    const startX = px - 20;
    count.setX(startX);
    total.setX(startX + count.width + 4);
  }

  // ------------------------------------------------------------------ panel de la medalla

  private addMedalPanel(): void {
    const r = this.right;
    const x = 168;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(36, 134, 264, 414, 24);
    g.fillStyle(COLORS.white).fillRoundedRect(36, 128, 264, 414, 24);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(36, 128, 264, 414, 24);
    addTitle(this, x, 162, 'Tu medalla', 24);

    const earned = GameState.hasRightMedal(r);
    const medal = addRightMedal(this, x, 262, r, earned, 0.82);
    if (earned && !prefersReducedMotion()) {
      this.tweens.add({
        targets: medal,
        angle: { from: -5, to: 5 },
        duration: 1300,
        yoyo: true,
        repeat: -1,
      });
    }

    // Puntitos de progreso: uno por actividad disponible.
    const all = [...r.games, ...r.challenges].filter(isPlayable);
    const { done, total } = GameState.rightProgress(r);
    const step = Math.min(30, 220 / Math.max(1, all.length));
    all.forEach((a, i) => {
      const dx = x + (i - (all.length - 1) / 2) * step;
      const ok = GameState.getActivityStars(r.id, a.id) > 0;
      this.add
        .circle(dx, 362, 10, ok ? darken(r.color, 0.8) : COLORS.white)
        .setStrokeStyle(3, COLORS.ink);
    });
    addTitle(this, x, 398, `${done} de ${total} listos`, 24);

    const hasFinal = r.challenges.some((c) => isPlayable(c) && c.medal);
    const hint = earned
      ? `¡Ganaste la medalla ${r.medal.name}!`
      : hasFinal
        ? `Termina juegos y desafíos para ganar la medalla ${r.medal.name}.`
        : 'Completa los juegos de este derecho. ¡Pronto habrá desafíos!';
    addBody(this, x, 470, hint, 17, { wrap: 220, color: '#4A4F66' });
  }

  // ------------------------------------------------------------------ juegos

  private addGames(): void {
    const r = this.right;
    const games = r.games;
    const playable = games.filter(isPlayable);
    const doneCount = playable.filter((a) => GameState.getActivityStars(r.id, a.id) > 0).length;
    const head = this.add
      .text(AREA_X, 152, 'Juegos', {
        fontFamily: FONTS.title,
        fontSize: '30px',
        fontStyle: '800',
        color: CSS.ink,
        stroke: CSS.white,
        strokeThickness: 6,
        resolution: TEXT_RESOLUTION,
        padding: { top: 6 },
      })
      .setOrigin(0, 0.5);
    this.badge(AREA_X + head.width + 16, 154, `${doneCount} de ${playable.length}`);

    const n = games.length;
    const w = (AREA_W - (n - 1) * GAP) / n;
    games.forEach((a, i) => {
      const x = AREA_X + w / 2 + i * (w + GAP);
      this.gameCard(a, x, GAMES_Y, w, i);
    });
  }

  /** Pastilla de conteo ("3 de 4"). */
  private badge(x: number, y: number, text: string): void {
    const t = addBody(this, 0, 0, text, 15, { color: cssColor(darken(this.right.color, 0.55)) });
    const w = t.width + 24;
    const g = this.add.graphics();
    g.fillStyle(this.right.color, 0.22).fillRoundedRect(-w / 2, -14, w, 28, 14);
    g.lineStyle(2, darken(this.right.color, 0.7)).strokeRoundedRect(-w / 2, -14, w, 28, 14);
    this.add.container(x + w / 2, y, [g, t]);
  }

  private gameCard(a: Activity, x: number, y: number, w: number, i: number): void {
    const r = this.right;
    const h = GAME_H;
    const playable = isPlayable(a);
    const isNext = this.next === a;
    const stars = playable ? GameState.getActivityStars(r.id, a.id) : 0;

    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 20);
    g.fillStyle(playable ? COLORS.white : 0xeef1f5).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
    g.lineStyle(isNext ? 6 : 4, isNext ? COLORS.sun : COLORS.ink).strokeRoundedRect(
      -w / 2,
      -h / 2,
      w,
      h,
      20,
    );
    const parts: Phaser.GameObjects.GameObject[] = [g];

    // Ficha de color con el ícono.
    const tile = this.add.graphics();
    tile
      .fillStyle(TILE_TINTS[i % TILE_TINTS.length] ?? 0xfff1c2)
      .fillRoundedRect(-36, -h / 2 + 16, 72, 72, 16);
    parts.push(tile);
    const icon = fitImage(this.add.image(0, -h / 2 + 52, tex(a.icon)), 58, 58);
    if (!playable) icon.setAlpha(0.45);
    parts.push(icon);
    parts.push(addBody(this, 0, 18, a.title, 18, { wrap: w - 20 }));

    if (!playable) {
      parts.push(addBody(this, 0, 58, 'Próximamente', 15, { color: '#5B6475' }));
    } else if (isNext) {
      parts.push(...this.playPill(0, 58));
    } else {
      for (let s = 0; s < 3; s++) parts.push(addStarIcon(this, (s - 1) * 26, 58, 11, s < stars));
    }

    const card = this.add.container(x, y, parts).setSize(w, h);
    if (isNext) {
      card.add(this.nextTab(0, -h / 2 - 2));
      this.hintTarget = { x, y };
    }
    this.makeTappable(card, a, playable ? 'open' : 'soon', i);
  }

  /** Botón "▶ Jugar" dentro de la tarjeta que toca. */
  private playPill(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const g = this.add.graphics();
    g.fillStyle(darken(this.right.color)).fillRoundedRect(x - 55, y - 16, 110, 32, 16);
    g.fillStyle(COLORS.white).fillTriangle(x - 32, y - 7, x - 32, y + 7, x - 21, y);
    const t = this.add
      .text(x + 10, y, 'Jugar', {
        fontFamily: FONTS.title,
        fontSize: '18px',
        fontStyle: '800',
        color: CSS.white,
        resolution: TEXT_RESOLUTION,
        padding: { top: 4 },
      })
      .setOrigin(0.5);
    return [g, t];
  }

  /** Pestaña "¡Te toca!" sobre la tarjeta resaltada. */
  private nextTab(x: number, y: number): Phaser.GameObjects.Container {
    const t = addBody(this, 0, 0, '¡Te toca!', 14);
    const w = t.width + 22;
    const g = this.add.graphics();
    g.fillStyle(COLORS.sun).fillRoundedRect(-w / 2, -13, w, 26, 13);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(-w / 2, -13, w, 26, 13);
    const tab = this.add.container(x, y, [g, t]);
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: tab,
        y: y - 5,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    return tab;
  }

  // ------------------------------------------------------------------ desafíos

  private addChallenges(): void {
    const r = this.right;
    const head = this.add
      .text(AREA_X, 400, 'Desafíos', {
        fontFamily: FONTS.title,
        fontSize: '30px',
        fontStyle: '800',
        color: CSS.ink,
        stroke: CSS.white,
        strokeThickness: 6,
        resolution: TEXT_RESOLUTION,
        padding: { top: 6 },
      })
      .setOrigin(0, 0.5);
    const open = r.challenges.some((c) => isPlayable(c) && GameState.challengeUnlocked(r, c.id));
    addBody(
      this,
      AREA_X + head.width + 14,
      404,
      open ? '¡Ya puedes jugarlos!' : 'Se abren al terminar los juegos',
      16,
      {
        color: '#4A4F66',
        stroke: CSS.white,
        strokeThickness: 4,
      },
    ).setOrigin(0, 0.5);

    const n = r.challenges.length;
    const w = (AREA_W - (n - 1) * GAP) / n;
    r.challenges.forEach((a, i) => {
      const x = AREA_X + w / 2 + i * (w + GAP);
      this.challengeCard(a, x, CHALL_Y, w, i);
    });
  }

  private stateOf(a: Activity): CardState {
    if (!isPlayable(a)) return 'soon';
    if (GameState.challengeUnlocked(this.right, a.id)) return 'open';
    return a.medal && GameState.gamesDone(this.right) ? 'final-locked' : 'locked';
  }

  /** Motivo del candado: "Falta 1 juego" / "Gana los 2 desafíos". */
  private lockReason(a: Activity, state: CardState): string {
    const r = this.right;
    if (state === 'soon') return 'Próximamente';
    const missingGames = r.games.filter(
      (g) => isPlayable(g) && GameState.getActivityStars(r.id, g.id) === 0,
    ).length;
    if (state === 'locked' && missingGames > 0) {
      return missingGames === 1 ? 'Falta 1 juego' : `Faltan ${missingGames} juegos`;
    }
    const others = r.challenges.filter((c) => isPlayable(c) && c !== a).length;
    return `Gana ${others === 1 ? 'el otro desafío' : `los ${others} desafíos`}`;
  }

  private challengeCard(a: Activity, x: number, y: number, w: number, i: number): void {
    const r = this.right;
    const h = CHALL_H;
    const state = this.stateOf(a);
    const open = state === 'open';
    const isNext = this.next === a;
    const g = this.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [g];

    if (open) {
      g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 20);
      g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
      g.lineStyle(isNext ? 6 : 4, isNext ? COLORS.sun : COLORS.ink).strokeRoundedRect(
        -w / 2,
        -h / 2,
        w,
        h,
        20,
      );
      const tile = this.add.graphics();
      tile
        .fillStyle(TILE_TINTS[(i + 2) % TILE_TINTS.length] ?? 0xdcefff)
        .fillRoundedRect(-w / 2 + 14, -30, 60, 60, 14);
      parts.push(tile, fitImage(this.add.image(-w / 2 + 44, 0, tex(a.icon)), 48, 48));
    } else {
      g.fillStyle(0xe9eef5, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
      g.lineStyle(3, 0x9aa5b8);
      dashedRoundRect(g, -w / 2, -h / 2, w, h, 20);
      parts.push(this.add.circle(-w / 2 + 44, 0, 26, COLORS.white).setStrokeStyle(3, 0x9aa5b8));
      parts.push(addLockIcon(this, -w / 2 + 44, 2, 0.75));
    }

    const textX = -w / 2 + 88;
    const title = this.add
      .text(textX, open ? -16 : -12, a.title, {
        fontFamily: FONTS.body,
        fontSize: '19px',
        fontStyle: '800',
        color: CSS.ink,
        resolution: TEXT_RESOLUTION,
        wordWrap: { width: w - 100 },
      })
      .setOrigin(0, 0.5);
    parts.push(title);
    if (open) {
      if (isNext && isPlayable(a)) {
        parts.push(...this.playPill(textX + 55, 20));
      } else {
        const s = GameState.getActivityStars(r.id, a.id);
        for (let k = 0; k < 3; k++)
          parts.push(addStarIcon(this, textX + 12 + k * 26, 20, 11, k < s));
      }
    } else {
      parts.push(
        addBody(this, textX, 16, this.lockReason(a, state), 15, { color: '#5B6475' }).setOrigin(
          0,
          0.5,
        ),
      );
    }

    const card = this.add.container(x, y, parts).setSize(w, h);
    if (isNext) {
      card.add(this.nextTab(0, -h / 2 - 2));
      this.hintTarget = { x, y };
    }
    this.makeTappable(card, a, state, i + 4);
  }

  // ------------------------------------------------------------------ toques

  private makeTappable(
    card: Phaser.GameObjects.Container,
    a: Activity,
    state: CardState,
    order: number,
  ): void {
    card.setInteractive({ useHandCursor: true });
    card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tapCard(card, a, state));
    card.setScale(0);
    this.tweens.add({
      targets: card,
      scale: 1,
      delay: order * 60,
      duration: motion(320),
      ease: 'Back.easeOut',
    });
  }

  private tapCard(card: Phaser.GameObjects.Container, a: Activity, state: CardState): void {
    AudioManager.sfx('pop');
    if (state !== 'open' || !isPlayable(a)) {
      this.tweens.add({
        targets: card,
        angle: { from: -4, to: 4 },
        duration: motion(80),
        yoyo: true,
        repeat: 2,
        onComplete: () => card.setAngle(0),
      });
      this.tori.setMood('think');
      void this.bubble.say(
        state === 'soon' ? HUB_SOON : state === 'final-locked' ? HUB_FINAL_LOCKED : HUB_LOCKED,
      );
      return;
    }
    this.tweens.add({
      targets: card,
      scaleX: 1.06,
      scaleY: 0.94,
      duration: motion(90),
      yoyo: true,
    });
    void goTo(this, activityScene(a), { rightId: this.right.id, activityId: a.id });
  }

  // ------------------------------------------------------------------ Tori: qué sigue

  /** Frase de Tori según el avance (se dice con voz sintética; ver guion para las fijas). */
  private statusLine(): VoiceLine {
    const r = this.right;
    const pending = r.games.filter(
      (g) => isPlayable(g) && GameState.getActivityStars(r.id, g.id) === 0,
    );
    const hasChallenges = r.challenges.some(isPlayable);
    const doneAny = r.games.some(
      (g) => isPlayable(g) && GameState.getActivityStars(r.id, g.id) > 0,
    );
    const next = this.next;
    let text: string;
    if (pending.length > 0 && next) {
      if (!doneAny) text = `¡Vamos a jugar! Toca ${next.title} para empezar.`;
      else if (pending.length === 1)
        text = `¡Muy bien! Te falta un juego: ${next.title}.${hasChallenges ? ' Cuando lo termines, se abren los desafíos.' : ''}`;
      else text = `¡Vas muy bien! Te faltan ${pending.length} juegos. Sigue con ${next.title}.`;
    } else if (next) {
      text = `¡Se abrieron los desafíos! Toca ${next.title} para jugar.`;
    } else if (GameState.hasRightMedal(r)) {
      text = `¡Completaste este derecho! Ganaste la medalla ${r.medal.name}.`;
    } else {
      text = '¡Completaste todos los juegos de este derecho! Muy pronto habrá más.';
    }
    return { id: `hub_status_${r.id}`, text };
  }
}
