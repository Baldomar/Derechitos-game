import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '@/config/theme';
import { getLevel, type LevelDef } from '@/config/levels';
import { addBackdrop } from '@/components/Backdrop';
import { addMedal, addSticker } from '@/components/Badges';
import { BigButton } from '@/components/BigButton';
import { Effects } from '@/components/Effects';
import { IdleHint } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { SpeechBubble } from '@/components/SpeechBubble';
import { StarCounter, flyStars } from '@/components/StarReward';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion, vibrate } from '@/core/Device';
import { GameState, type LevelResult } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';

const PRAISE: Record<number, string> = {
  3: '¡Increíble!',
  2: '¡Muy bien!',
  1: '¡Lo lograste!',
};
const SLOTS = [
  { x: 520, y: 200 },
  { x: 640, y: 175 },
  { x: 760, y: 200 },
];

/**
 * Recompensa: de 1 a 3 estrellas (vuelan al contador), medalla, estampa del álbum
 * y el mensaje del derecho aprendido en voz de Tori. Siempre positiva.
 */
export default class RewardScene extends Phaser.Scene {
  private result!: LevelResult;
  private level!: LevelDef;

  constructor() {
    super('Reward');
  }

  init(data: LevelResult): void {
    this.result = data;
    this.level = getLevel(data.levelId);
  }

  create(): void {
    addBackdrop(this, { sky: COLORS.cream });
    this.addRays();
    const effects = new Effects(this);
    const r = this.result;
    const gained = Math.max(0, r.stars - r.previousBest);
    const counter = new StarCounter(
      this,
      GAME_WIDTH - 130,
      56,
      GameState.totalStars - gained,
      GameState.maxStars,
    );

    const title = addTitle(this, GAME_WIDTH / 2, 78, PRAISE[r.stars] ?? '¡Muy bien!', 72, {
      stroke: '#FFFFFF',
      strokeThickness: 10,
    });
    title.setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: motion(500), ease: 'Back.easeOut' });

    // Estrellas: huecos (contorno) y las ganadas aparecen una a una con sonido ascendente.
    SLOTS.forEach((s, i) => {
      addStarIcon(this, s.x, s.y, 50, false);
      if (i >= r.stars) return;
      const star = addStarIcon(this, s.x, s.y, 50, true).setScale(0);
      this.tweens.add({
        targets: star,
        scale: 1,
        angle: 360,
        delay: 400 + i * 380,
        duration: motion(500),
        ease: 'Back.easeOut',
        onStart: () => {
          AudioManager.sfx('star', { index: i });
          vibrate(20);
          effects.sparkleAt(s.x, s.y, 10);
        },
      });
    });
    const starsDone = 400 + r.stars * 380 + 300;
    this.time.delayedCall(
      starsDone,
      () => void flyStars(this, SLOTS[1] ?? { x: 640, y: 175 }, counter, gained, effects),
    );

    // Medalla que cae y estampa del álbum.
    const medal = addMedal(this, 330, -200, this.level, 1);
    const medalName = addBody(this, 330, 500, this.level.medal.name, 24, { wrap: 300 }).setAlpha(0);
    this.tweens.add({
      targets: medal,
      y: 380,
      delay: starsDone,
      duration: motion(800),
      ease: 'Bounce.easeOut',
      onStart: () => AudioManager.sfx('medal'),
      onComplete: () => {
        this.tweens.add({ targets: medalName, alpha: 1, duration: 300 });
        this.tweens.add({
          targets: medal,
          angle: { from: -5, to: 5 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
    const sticker = addSticker(this, 950, 380, this.level, true, 180).setScale(0).setAngle(-8);
    const stickerLabel = addBody(
      this,
      950,
      500,
      r.firstTime ? '¡Nueva estampa!' : 'Tu estampa',
      24,
    ).setAlpha(0);
    this.tweens.add({
      targets: sticker,
      scale: 1,
      delay: starsDone + 700,
      duration: motion(450),
      ease: 'Back.easeOut',
      onStart: () => AudioManager.sfx('pop'),
      onComplete: () => this.tweens.add({ targets: stickerLabel, alpha: 1, duration: 300 }),
    });

    // Tori dice el derecho aprendido.
    const tori = new Tori(this, 115, 600, 0.5);
    const bubble = new SpeechBubble(this, 560, 612, { width: 620, tail: 'left', tori });
    this.time.delayedCall(starsDone + 900, () => {
      tori.setMood('celebrate');
      void bubble.say(this.level.dialog.lesson);
    });

    const goFinal = GameState.allCompleted && !GameState.finalSeen;
    const next = new BigButton(this, GAME_WIDTH - 170, 630, {
      label: goFinal ? '¡Mi diploma!' : 'Continuar',
      width: 290,
      color: COLORS.sun,
      pulse: true,
      onClick: () => void goTo(this, goFinal ? 'Final' : 'WorldMap'),
    });
    next.setAlpha(0).disableInteractive();
    this.time.delayedCall(starsDone + 1300, () => {
      next.setInteractive();
      this.tweens.add({ targets: next, alpha: 1, duration: 300 });
    });
    new IdleHint(this, () => (next.alpha === 1 ? { kind: 'tap', x: next.x, y: next.y } : null));
  }

  /** Rayos de sol girando detrás del título. */
  private addRays(): void {
    const g = this.add.graphics({ x: GAME_WIDTH / 2, y: 260 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.fillStyle(COLORS.sun, i % 2 ? 0.18 : 0.08);
      const b = a + Math.PI / 16;
      g.fillTriangle(
        0,
        0,
        Math.cos(a) * 900,
        Math.sin(a) * 900,
        Math.cos(b) * 900,
        Math.sin(b) * 900,
      );
    }
    if (!prefersReducedMotion())
      this.tweens.add({ targets: g, angle: 360, duration: 40000, repeat: -1 });
  }
}
