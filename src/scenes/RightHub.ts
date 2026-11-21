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
import { ensureArt, tex, type ArtKey } from '@/art/Art';
import { gameIcon } from '@/art/GameIcons';
import { addBackdrop } from '@/components/Backdrop';
import { addRightMedal } from '@/components/Badges';
import { Effects } from '@/components/Effects';
import { IdleHint } from '@/components/HelperHand';
import { addLockIcon, addStarIcon } from '@/components/Icons';
import { PillButton } from '@/components/PillButton';
import { SpeechBubble } from '@/components/SpeechBubble';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { addToriGuide } from '@/components/ToriGuide';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo, prefetchScene } from '@/core/SceneTransition';
import { fitImage } from './BaseActivity';
import { hubMedalLine, hubStatus } from '@/config/voiceCatalog';

/**
 * Camino del derecho: arriba los JUEGOS (1 → 2 → 3) y, tras una curva a la derecha, los
 * RETOS (4 → 5 → 6) de regreso hacia la MEDALLA. Así el niño ve un recorrido con meta.
 */
const ROW1_Y = 240;
const ROW2_Y = 492;
const PATH_LEFT = 40;
const PATH_RIGHT = 1196;
const TURN_R = (ROW2_Y - ROW1_Y) / 2;
const GAME_H = 200;
const CHALL_W = 250;
const CHALL_H = 132;
const MEDAL = { x: 196, y: 468 };
const ROAD = 0xf6dfa4;

/** Adorno temático de cada derecho (esquina inferior derecha). */
const DECOR: Partial<Record<string, ArtKey>> = {
  salud: 'curita',
  educacion: 'mochila',
  vida: 'arbol',
  alimentacion: 'canasta',
  vivienda: 'camita',
  igualdad: 'rampa',
  jugar: 'papalote',
  opinion: 'urna',
};

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
 * Pantalla de un derecho como un CAMINO: juegos numerados arriba, retos abajo (se abren al
 * terminar los juegos) y la medalla al final, con su anillo de progreso. Tori dice qué sigue
 * y el siguiente paso se resalta con "¡Te toca!".
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

    // Lo que "toca" ahora: primer juego pendiente; si no hay, primer reto abierto pendiente.
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
    this.addPath();
    this.addMedal();
    this.addGames();
    this.addChallenges();
    this.addDecor();

    ({ tori: this.tori, bubble: this.bubble } = addToriGuide(this));
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

  // ------------------------------------------------------------------ camino

  /** Sendero de arena con puntitos: fila de juegos → curva → fila de retos → medalla. */
  private addPath(): void {
    const V = Phaser.Math.Vector2;
    const rx = 52;
    const pts: Phaser.Math.Vector2[] = [new V(PATH_LEFT, ROW1_Y), new V(PATH_RIGHT, ROW1_Y)];
    for (let k = 1; k < 28; k++) {
      const a = -Math.PI / 2 + (Math.PI * k) / 28;
      pts.push(new V(PATH_RIGHT + Math.cos(a) * rx, ROW1_Y + TURN_R + Math.sin(a) * TURN_R));
    }
    pts.push(new V(PATH_RIGHT, ROW2_Y), new V(MEDAL.x, ROW2_Y));

    const g = this.add.graphics();
    const stroke = (w: number, color: number, alpha = 1): void => {
      g.lineStyle(w, color, alpha).strokePoints(pts, false);
      g.fillStyle(color, alpha);
      for (const p of pts) g.fillCircle(p.x, p.y, w / 2);
    };
    stroke(50, COLORS.ink);
    stroke(40, ROAD);

    // Puntitos blancos cada ~30 px a lo largo del sendero.
    g.fillStyle(COLORS.white, 0.95);
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (!a || !b) continue;
      const len = Phaser.Math.Distance.BetweenPoints(a, b);
      let d = carry;
      for (; d < len; d += 30)
        g.fillCircle(a.x + ((b.x - a.x) * d) / len, a.y + ((b.y - a.y) * d) / len, 4);
      carry = d - len;
    }

    // Bandera de salida.
    const f = this.add.graphics();
    f.lineStyle(5, COLORS.ink).lineBetween(PATH_LEFT, ROW1_Y + 22, PATH_LEFT, ROW1_Y - 54);
    f.fillStyle(COLORS.coral).lineStyle(3, COLORS.ink);
    const flag = [
      { x: PATH_LEFT + 2, y: ROW1_Y - 54 },
      { x: PATH_LEFT + 42, y: ROW1_Y - 44 },
      { x: PATH_LEFT + 2, y: ROW1_Y - 32 },
    ];
    f.fillPoints(flag, true).strokePoints(flag, true);

    // Flecha en la curva (hacia abajo).
    this.arrow(PATH_RIGHT + rx, ROW1_Y + TURN_R, 'down');
  }

  /** Flechita del sendero que indica hacia dónde se avanza. */
  private arrow(x: number, y: number, dir: 'right' | 'left' | 'down'): void {
    const s = 11;
    const pts =
      dir === 'right'
        ? [
            { x: x - s, y: y - s },
            { x: x + s, y },
            { x: x - s, y: y + s },
          ]
        : dir === 'left'
          ? [
              { x: x + s, y: y - s },
              { x: x - s, y },
              { x: x + s, y: y + s },
            ]
          : [
              { x: x - s, y: y - s },
              { x: x + s, y: y - s },
              { x, y: y + s },
            ];
    const g = this.add.graphics();
    g.lineStyle(4, COLORS.ink).strokePoints(pts, true);
  }

  /** Pastilla blanca de sección ("Juegos" / "Retos"). */
  private sectionPill(x: number, y: number, text: string): void {
    const t = addBody(this, 0, 0, text, 18);
    const w = t.width + 34;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -16, w, 36, 18);
    g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -18, w, 36, 18);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(-w / 2, -18, w, 36, 18);
    this.add.container(x, y, [g, t]).setDepth(2);
  }

  /** Circulito con el número del paso (verde si ya está listo). */
  private stepNumber(
    x: number,
    y: number,
    n: number,
    done: boolean,
  ): Phaser.GameObjects.GameObject[] {
    const c = this.add
      .circle(x, y, 20, done ? 0x3aa655 : COLORS.white)
      .setStrokeStyle(4, done ? COLORS.white : 0x9aa5b8);
    const t = addTitle(this, x, y + 1, String(n), 22, { color: done ? '#FFFFFF' : '#4A4F66' });
    return [c, t];
  }

  // ------------------------------------------------------------------ medalla

  private addMedal(): void {
    const r = this.right;
    const { x, y } = MEDAL;
    const earned = GameState.hasRightMedal(r);
    const { done, total } = GameState.rightProgress(r);
    const frac = total > 0 ? done / total : 0;

    // Rayos que giran despacito detrás de la medalla.
    const rays = this.add.graphics({ x, y });
    rays.fillStyle(COLORS.sun, earned ? 0.7 : 0.4);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const w = 0.13;
      rays.fillPoints(
        [
          { x: Math.cos(a - w) * 72, y: Math.sin(a - w) * 72 },
          { x: Math.cos(a - w * 1.4) * 138, y: Math.sin(a - w * 1.4) * 138 },
          { x: Math.cos(a + w * 1.4) * 138, y: Math.sin(a + w * 1.4) * 138 },
          { x: Math.cos(a + w) * 72, y: Math.sin(a + w) * 72 },
        ],
        true,
      );
    }
    if (!prefersReducedMotion()) {
      this.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
    }

    // Anillo de progreso: se llena de verde con cada juego o reto terminado.
    const ring = this.add.graphics({ x, y });
    ring.fillStyle(COLORS.white).fillCircle(0, 0, 90);
    ring.lineStyle(4, COLORS.ink).strokeCircle(0, 0, 90);
    ring.fillStyle(0xdfe6ef).fillCircle(0, 0, 74);
    ring.lineStyle(4, COLORS.ink).strokeCircle(0, 0, 74);
    if (frac > 0) {
      ring.lineStyle(12, COLORS.grass).beginPath();
      ring.arc(0, 0, 82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ring.strokePath();
    }

    const medal = addRightMedal(this, x, y + 20, r, earned, 0.6);
    if (earned && !prefersReducedMotion()) {
      this.tweens.add({
        targets: medal,
        angle: { from: -5, to: 5 },
        duration: 1300,
        yoyo: true,
        repeat: -1,
      });
    }

    // Pastilla "¡Tu medalla!" con el avance.
    const label = addTitle(this, 0, 0, earned ? '¡Ganada!' : `¡Tu medalla! ${done}/${total}`, 19);
    const w = label.width + 30;
    const pg = this.add.graphics();
    pg.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-w / 2, -14, w, 34, 12);
    pg.fillStyle(COLORS.sun).fillRoundedRect(-w / 2, -17, w, 34, 12);
    pg.lineStyle(3, COLORS.ink).strokeRoundedRect(-w / 2, -17, w, 34, 12);
    this.add.container(x, y + 108, [pg, label]).setDepth(2);

    // Tocar la medalla: Tori explica cómo ganarla.
    const hit = this.add.circle(x, y, 92, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      AudioManager.sfx('pop');
      this.tweens.add({
        targets: medal,
        scale: medal.scale * 1.1,
        duration: motion(120),
        yoyo: true,
      });
      void this.bubble.say(hubMedalLine(r, earned));
    });
  }

  /** Adorno temático del derecho (hamaca, canasta, mochila…) que se mece suavecito. */
  private addDecor(): void {
    const key = DECOR[this.right.id];
    if (!key) return;
    ensureArt(this, [key]);
    const img = fitImage(this.add.image(1176, 642, tex(key)), 130, 110, 1.2);
    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: img,
        angle: { from: -4, to: 4 },
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ------------------------------------------------------------------ juegos

  private addGames(): void {
    const games = this.right.games;
    const n = games.length;
    const span = PATH_RIGHT - 80 + 4;
    const w = Math.min(300, (span - (n - 1) * 34) / n);
    const gap = n > 1 ? (span - n * w) / (n - 1) : 0;
    const xs = games.map((_, i) => 80 + w / 2 + i * (w + gap));
    if (gap >= 50) {
      for (let i = 0; i < n - 1; i++) {
        const a = xs[i];
        const b = xs[i + 1];
        if (a !== undefined && b !== undefined) this.arrow((a + b) / 2, ROW1_Y, 'right');
      }
    }
    games.forEach((a, i) => this.gameCard(a, xs[i] ?? 640, ROW1_Y, w, i));
    this.sectionPill((xs[0] ?? 230) - w / 2 + 70, ROW1_Y - GAME_H / 2 - 18, 'Juegos');
  }

  private gameCard(a: Activity, x: number, y: number, w: number, i: number): void {
    const r = this.right;
    const h = GAME_H;
    const playable = isPlayable(a);
    const isNext = this.next === a;
    const stars = playable ? GameState.getActivityStars(r.id, a.id) : 0;
    const done = stars > 0;

    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.22).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 22);
    if (playable) {
      g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
      g.lineStyle(isNext ? 7 : 5, isNext ? COLORS.sun : COLORS.ink).strokeRoundedRect(
        -w / 2,
        -h / 2,
        w,
        h,
        22,
      );
    } else {
      // "Sorpresa": rayitas rosadas y borde punteado.
      g.fillStyle(0xffe6ee).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
      g.lineStyle(10, 0xffd3e1, 1);
      for (let k = -h; k < w; k += 28) {
        g.lineBetween(-w / 2 + k + 12, h / 2 - 8, -w / 2 + k + h - 8, -h / 2 + 12);
      }
      g.lineStyle(4, 0x9aa5b8);
      dashedRoundRect(g, -w / 2, -h / 2, w, h, 22);
    }
    const parts: Phaser.GameObjects.GameObject[] = [g];

    // Miniatura ilustrada del juego (escenita con fondo y dibujos relacionados).
    const thumb = this.add
      .image(0, -h / 2 + 62, gameIcon(this, a.id, a.icon))
      .setDisplaySize(96, 92);
    const tile = this.add.graphics();
    tile.lineStyle(3, COLORS.ink, 0.85).strokeRoundedRect(-48, -h / 2 + 16, 96, 92, 18);
    parts.push(thumb, tile);
    parts.push(addTitle(this, 0, 28, a.title, w < 270 ? 19 : 22, { wrap: w - 30 }));

    if (!playable) {
      parts.push(...this.tagPill(0, 68, '¡Sorpresa pronto!', COLORS.pink, '#2B2848'));
    } else if (isNext) {
      parts.push(...this.playPill(0, 68));
    } else {
      for (let s = 0; s < 3; s++) parts.push(addStarIcon(this, (s - 1) * 30, 68, 13, s < stars));
    }

    parts.push(...this.stepNumber(-w / 2 + 10, -h / 2 + 10, i + 1, done));
    if (done) parts.push(...this.tagPill(w / 2 - 54, -h / 2 + 4, '✓ ¡Listo!', 0x3aa655, '#FFFFFF'));

    const card = this.add.container(x, y, parts).setSize(w, h).setDepth(1);
    if (isNext) {
      card.add(this.nextTab(w / 2 - 54, -h / 2 + 2));
      this.hintTarget = { x, y };
    }
    this.makeTappable(card, a, playable ? 'open' : 'soon', i);
  }

  /** Etiqueta redondeada de color (¡Listo!, ¡Sorpresa pronto!, motivo del candado…). */
  private tagPill(
    x: number,
    y: number,
    text: string,
    fill: number,
    color: string,
  ): Phaser.GameObjects.GameObject[] {
    const t = addBody(this, x, y, text, 15, { color });
    const w = t.width + 22;
    const g = this.add.graphics();
    g.fillStyle(fill).fillRoundedRect(x - w / 2, y - 15, w, 30, 15);
    g.lineStyle(3, COLORS.ink, fill === COLORS.white ? 0.35 : 1).strokeRoundedRect(
      x - w / 2,
      y - 15,
      w,
      30,
      15,
    );
    return [g, t];
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

  // ------------------------------------------------------------------ retos

  private addChallenges(): void {
    const list = this.right.challenges;
    const n = list.length;
    const left = MEDAL.x + 120;
    const span = PATH_RIGHT - left;
    const w = Math.min(CHALL_W, (span - (n - 1) * 30) / n);
    const gap = n > 1 ? (span - n * w) / (n - 1) : 0;
    // Van de derecha a izquierda (el sendero regresa hacia la medalla).
    const xs = list.map((_, i) => PATH_RIGHT - w / 2 - i * (w + gap));
    if (gap >= 44) {
      for (let i = 0; i < n - 1; i++) {
        const a = xs[i];
        const b = xs[i + 1];
        if (a !== undefined && b !== undefined) this.arrow((a + b) / 2, ROW2_Y, 'left');
      }
    }
    const offset = this.right.games.length;
    list.forEach((a, i) => this.challengeCard(a, xs[i] ?? 640, ROW2_Y, w, i, offset + i + 1));
    this.sectionPill((xs[0] ?? 1000) - w / 2 + 84, ROW2_Y - CHALL_H / 2 - 18, 'Retos');
  }

  private stateOf(a: Activity): CardState {
    if (!isPlayable(a)) return 'soon';
    if (GameState.challengeUnlocked(this.right, a.id)) return 'open';
    return a.medal && GameState.gamesDone(this.right) ? 'final-locked' : 'locked';
  }

  /** Motivo del candado: "Falta 1 juego" / "Gana los 2 retos". */
  private lockReason(a: Activity, state: CardState): string {
    const r = this.right;
    if (state === 'soon') return '¡Muy pronto!';
    const missingGames = r.games.filter(
      (g) => isPlayable(g) && GameState.getActivityStars(r.id, g.id) === 0,
    ).length;
    if (state === 'locked' && missingGames > 0) {
      return missingGames === 1 ? 'Falta 1 juego' : `Faltan ${missingGames} juegos`;
    }
    const others = r.challenges.filter((c) => isPlayable(c) && c !== a).length;
    return `Gana ${others === 1 ? 'el otro reto' : `los ${others} retos`}`;
  }

  private challengeCard(
    a: Activity,
    x: number,
    y: number,
    w: number,
    i: number,
    num: number,
  ): void {
    const r = this.right;
    const h = CHALL_H;
    const state = this.stateOf(a);
    const open = state === 'open';
    const isNext = this.next === a;
    const stars = isPlayable(a) ? GameState.getActivityStars(r.id, a.id) : 0;
    const g = this.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [g];

    g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 22);
    if (open) {
      g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
      g.lineStyle(isNext ? 7 : 5, isNext ? COLORS.sun : COLORS.ink).strokeRoundedRect(
        -w / 2,
        -h / 2,
        w,
        h,
        22,
      );
    } else {
      g.fillStyle(0xeef1f6).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
      g.lineStyle(4, 0x9aa5b8);
      dashedRoundRect(g, -w / 2, -h / 2, w, h, 22);
    }

    const tileX = -w / 2 + 50;
    const icon = this.add.image(tileX, 0, gameIcon(this, a.id, a.icon)).setDisplaySize(78, 72);
    const tile = this.add.graphics();
    tile.lineStyle(3, COLORS.ink, 0.85).strokeRoundedRect(tileX - 39, -36, 78, 72, 14);
    if (!open) icon.setAlpha(0.55);
    parts.push(icon, tile);
    if (!open) {
      parts.push(this.add.circle(tileX + 30, 28, 17, COLORS.white).setStrokeStyle(3, COLORS.ink));
      parts.push(addLockIcon(this, tileX + 30, 30, 0.42));
    }

    const textX = -w / 2 + 98;
    parts.push(
      this.add
        .text(textX, -20, a.title, {
          fontFamily: FONTS.title,
          fontSize: '20px',
          fontStyle: '800',
          color: CSS.ink,
          resolution: TEXT_RESOLUTION,
          padding: { top: 4 },
          wordWrap: { width: w - 106 },
        })
        .setOrigin(0, 0.5),
    );
    const midX = textX + (w / 2 - textX) / 2 - 4;
    if (open) {
      if (isNext && isPlayable(a)) parts.push(...this.playPill(midX, 24));
      else
        for (let k = 0; k < 3; k++)
          parts.push(addStarIcon(this, midX + (k - 1) * 26, 24, 11, k < stars));
    } else {
      parts.push(...this.tagPill(midX, 24, this.lockReason(a, state), COLORS.white, '#4A4F66'));
    }

    parts.push(...this.stepNumber(-w / 2 + 8, -h / 2 + 8, num, stars > 0));
    if (stars > 0)
      parts.push(...this.tagPill(w / 2 - 50, -h / 2 + 2, '✓ ¡Listo!', 0x3aa655, '#FFFFFF'));

    const card = this.add.container(x, y, parts).setSize(w, h).setDepth(1);
    if (isNext) {
      card.add(this.nextTab(w / 2 - 54, -h / 2 + 2));
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
    if (pending.length > 0 && next) {
      if (!doneAny) return hubStatus.start(r, next.title);
      if (pending.length === 1) return hubStatus.oneLeft(r, next.title, hasChallenges);
      return hubStatus.many(r, pending.length, next.title);
    }
    if (next) return hubStatus.challenges(r, next.title);
    if (GameState.hasRightMedal(r)) return hubStatus.medal(r);
    return hubStatus.allDone(r);
  }
}
