import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, FONTS, TEXT_RESOLUTION } from '@/config/theme';
import {
  activityScene,
  getRightArea,
  isPlayable,
  type Activity,
  type RightArea,
} from '@/config/rights';
import { HUB_FINAL_LOCKED, HUB_GAMES, HUB_LOCKED, HUB_SOON } from '@/config/phrases';
import { ensureArt, tex } from '@/art/Art';
import { addBackdrop } from '@/components/Backdrop';
import { addRightMedal } from '@/components/Badges';
import { BigButton } from '@/components/BigButton';
import { Effects } from '@/components/Effects';
import { IdleHint } from '@/components/HelperHand';
import { addLockIcon, addStarIcon } from '@/components/Icons';
import { SpeechBubble } from '@/components/SpeechBubble';
import { StarCounter } from '@/components/StarReward';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo, prefetchScene } from '@/core/SceneTransition';
import { fitImage } from './BaseActivity';

const CARD_W = 200;
const GAMES_Y = 272;
const CHALLENGES_Y = 468;
/** Posición y ancho de las tarjetas de una fila (3 normales o 4 más angostas). */
function rowLayout(n: number, i: number): { x: number; w: number } {
  const wide = n <= 3;
  return { x: 655 + (i - (n - 1) / 2) * (wide ? 220 : 172), w: wide ? CARD_W : 160 };
}

/** Derechos ya explicados en esta sesión (para no repetir la explicación en cada regreso). */
const explained = new Set<string>();

type CardState = 'open' | 'locked' | 'final-locked' | 'soon';

/**
 * Pantalla de un derecho: explicación animada, JUEGOS, DESAFÍOS (se abren al completar los juegos),
 * barra de progreso, estrellas, medalla y botón grande para regresar al mapa.
 */
export default class RightHubScene extends Phaser.Scene {
  private right!: RightArea;
  private bubble!: SpeechBubble;
  private tori!: Tori;
  private cards: { x: number; y: number; a: Activity; state: CardState }[] = [];

  constructor() {
    super('RightHub');
  }

  init(data: { rightId: string }): void {
    this.right = getRightArea(data.rightId);
    this.cards = [];
  }

  create(): void {
    const r = this.right;
    ensureArt(this, [r.icon, ...[...r.games, ...r.challenges].map((a) => a.icon)]);
    addBackdrop(this);
    new Effects(this);

    // Encabezado con el color del derecho.
    const head = this.add.graphics().setDepth(DEPTH.ui - 1);
    head.fillStyle(COLORS.ink, 0.2).fillRoundedRect(300, 24, 680, 76, 30);
    head.fillStyle(r.color).fillRoundedRect(300, 16, 680, 76, 30);
    head.lineStyle(5, COLORS.ink).strokeRoundedRect(300, 16, 680, 76, 30);
    this.add.image(350, 54, tex(r.icon)).setScale(0.55).setDepth(DEPTH.ui);
    addTitle(this, 660, 56, r.name, r.name.length > 26 ? 28 : 34, {
      stroke: CSS.white,
      strokeThickness: 7,
    }).setDepth(DEPTH.ui);

    new BigButton(this, 90, 56, {
      label: 'Mapa',
      width: 150,
      height: 88,
      fontSize: 34,
      color: COLORS.white,
      onClick: () => void goTo(this, 'WorldMap'),
    }).setDepth(DEPTH.ui);
    const { stars, max } = GameState.rightStars(r);
    new StarCounter(this, 1150, 56, stars, max);

    this.addProgressBar();
    this.addBigIcon();
    this.addMedal();

    this.sectionTitle('Juegos', GAMES_Y - 95);
    r.games.forEach((a, i) => {
      const l = rowLayout(r.games.length, i);
      this.addCard(a, l.x, GAMES_Y, this.stateOf(a, false), l.w);
    });
    this.sectionTitle('Desafíos', CHALLENGES_Y - 88);
    r.challenges.forEach((a, i) => {
      const l = rowLayout(r.challenges.length, i);
      this.addCard(a, l.x, CHALLENGES_Y, this.stateOf(a, true), l.w);
    });

    this.tori = new Tori(this, 115, 600, 0.5);
    this.bubble = new SpeechBubble(this, 560, 640, {
      width: 620,
      tail: 'left',
      tori: this.tori,
      fontSize: 26,
    });
    if (!explained.has(r.id)) {
      explained.add(r.id);
      this.time.delayedCall(450, () => void this.bubble.say([...r.explanation, HUB_GAMES]));
    }
    new IdleHint(this, () => {
      const next = this.cards.find(
        (c) => c.state === 'open' && GameState.getActivityStars(r.id, c.a.id) === 0,
      );
      return next ? { kind: 'tap', x: next.x, y: next.y } : null;
    });

    // Precarga el motor del primer juego pendiente.
    const pending = [...r.games, ...r.challenges].find(
      (a) => isPlayable(a) && GameState.getActivityStars(r.id, a.id) === 0,
    );
    if (pending && isPlayable(pending)) prefetchScene(activityScene(pending));
  }

  private stateOf(a: Activity, challenge: boolean): CardState {
    if (!isPlayable(a)) return 'soon';
    if (!challenge) return 'open';
    if (GameState.challengeUnlocked(this.right, a.id)) return 'open';
    return a.medal && GameState.gamesDone(this.right) ? 'final-locked' : 'locked';
  }

  private sectionTitle(text: string, y: number): void {
    this.add
      .text(325, y, text, {
        fontFamily: FONTS.title,
        fontSize: '30px',
        fontStyle: '800',
        color: CSS.ink,
        stroke: CSS.white,
        strokeThickness: 7,
        resolution: TEXT_RESOLUTION,
        padding: { top: 6 },
      })
      .setOrigin(0, 0.5);
  }

  private addProgressBar(): void {
    const { done, total } = GameState.rightProgress(this.right);
    const x = 330;
    const w = 650;
    const y = 128;
    const g = this.add.graphics();
    g.fillStyle(COLORS.white).fillRoundedRect(x, y - 15, w, 30, 15);
    const fill = this.add.graphics();
    const ratio = total ? done / total : 0;
    if (ratio > 0)
      fill.fillStyle(this.right.color).fillRoundedRect(x, y - 15, Math.max(30, w * ratio), 30, 15);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(x, y - 15, w, 30, 15);
    addBody(this, x + w / 2, y + 1, `${done} de ${total} completados`, 18, {
      stroke: CSS.white,
      strokeThickness: 5,
    });
    if (!prefersReducedMotion() && ratio > 0) {
      fill.setScale(0, 1);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: motion(700),
        ease: 'Cubic.easeOut',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 1;
          fill.setScale(t, 1).setX(x * (1 - t));
        },
      });
    }
  }

  /** Ícono grande animado del derecho (acompaña la explicación). */
  private addBigIcon(): void {
    const c = this.add.container(150, 300);
    c.add(this.add.circle(0, 6, 82, COLORS.ink, 0.2));
    c.add(this.add.circle(0, 0, 82, this.right.color).setStrokeStyle(6, COLORS.ink));
    c.add(this.add.circle(0, 0, 66, COLORS.white, 0.85));
    c.add(this.add.image(0, 0, tex(this.right.icon)).setScale(1.1));
    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: c,
        y: 288,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: c,
        angle: { from: -4, to: 4 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private addMedal(): void {
    const earned = GameState.hasRightMedal(this.right);
    const m = addRightMedal(this, 1135, 330, this.right, earned, 0.95);
    addBody(this, 1135, 425, earned ? this.right.medal.name : 'Medalla', 20, {
      wrap: 220,
      stroke: CSS.white,
      strokeThickness: 5,
    });
    if (earned && !prefersReducedMotion()) {
      this.tweens.add({
        targets: m,
        angle: { from: -5, to: 5 },
        duration: 1300,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private addCard(a: Activity, x: number, y: number, state: CardState, w = CARD_W): void {
    const h = 150;
    const open = state === 'open';
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 22);
    g.fillStyle(open ? COLORS.white : 0xe4e8ee).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.lineStyle(6, open ? this.right.color : COLORS.locked).strokeRoundedRect(
      -w / 2,
      -h / 2,
      w,
      h,
      22,
    );
    const icon = fitImage(this.add.image(0, -28, tex(a.icon)), 90, 70);
    if (!open) icon.setAlpha(0.45);
    const title = addBody(this, 0, 22, a.title, 18, { wrap: w - 20 });
    const parts: Phaser.GameObjects.GameObject[] = [g, icon, title];
    if (state === 'soon') {
      parts.push(addBody(this, 0, 54, 'Próximamente', 16, { color: '#5B6475' }));
    } else if (!open) {
      parts.push(addLockIcon(this, 0, -28, 1.1));
    } else {
      const s = GameState.getActivityStars(this.right.id, a.id);
      for (let i = 0; i < 3; i++) parts.push(addStarIcon(this, (i - 1) * 30, 55, 12, i < s));
    }
    const card = this.add.container(x, y, parts).setSize(w, h);
    card.setInteractive({ useHandCursor: true });
    card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tapCard(card, a, state));
    this.cards.push({ x, y, a, state });
    card.setScale(0);
    this.tweens.add({
      targets: card,
      scale: 1,
      delay: this.cards.length * 60,
      duration: motion(320),
      ease: 'Back.easeOut',
    });
  }

  private tapCard(card: Phaser.GameObjects.Container, a: Activity, state: CardState): void {
    AudioManager.sfx('pop');
    if (state !== 'open' || !isPlayable(a)) {
      this.tweens.add({
        targets: card,
        angle: { from: -5, to: 5 },
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
    this.tweens.add({ targets: card, scaleX: 1.1, scaleY: 0.92, duration: motion(90), yoyo: true });
    void goTo(this, activityScene(a), { rightId: this.right.id, activityId: a.id });
  }
}
