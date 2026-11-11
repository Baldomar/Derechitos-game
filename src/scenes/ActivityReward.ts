import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '@/config/theme';
import { findActivity, getRightArea, type PlayableActivity, type RightArea } from '@/config/rights';
import { CHALLENGES_OPEN } from '@/config/phrases';
import { getLevelByScene, type VoiceLine } from '@/config/levels';
import { ensureArt, tex } from '@/art/Art';
import { addBackdrop } from '@/components/Backdrop';
import { addRightMedal } from '@/components/Badges';
import { BigButton } from '@/components/BigButton';
import { Effects } from '@/components/Effects';
import { IdleHint } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { SpeechBubble } from '@/components/SpeechBubble';
import { StarCounter, flyStars } from '@/components/StarReward';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { motion, vibrate } from '@/core/Device';
import { GameState, type ActivityResult } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';
import { TEX } from '@/core/Textures';
import { fitImage } from './BaseActivity';

const PRAISE: Record<number, string> = { 3: '¡Increíble!', 2: '¡Muy bien!', 1: '¡Lo lograste!' };
const SLOTS = [
  { x: 520, y: 180 },
  { x: 640, y: 160 },
  { x: 760, y: 180 },
];

/** Recompensa de un juego o desafío: estrellas, y medalla del derecho si se completó el desafío final. */
export default class ActivityRewardScene extends Phaser.Scene {
  private result!: ActivityResult;
  private right!: RightArea;
  private activity!: PlayableActivity;

  constructor() {
    super('ActivityReward');
  }

  init(data: ActivityResult): void {
    this.result = data;
    this.right = getRightArea(data.rightId);
    this.activity = findActivity(this.right, data.activityId).activity;
  }

  create(): void {
    const r = this.result;
    ensureArt(this, [this.activity.icon, this.right.icon]);
    addBackdrop(this, { sky: COLORS.cream });
    const effects = new Effects(this);
    const gained = Math.max(0, r.stars - r.previousBest);
    const { stars, max } = GameState.rightStars(this.right);
    const counter = new StarCounter(this, GAME_WIDTH - 130, 56, stars - gained, max);

    const title = addTitle(this, GAME_WIDTH / 2, 70, PRAISE[r.stars] ?? '¡Muy bien!', 70, {
      stroke: '#FFFFFF',
      strokeThickness: 10,
    }).setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: motion(500), ease: 'Back.easeOut' });

    SLOTS.forEach((s, i) => {
      addStarIcon(this, s.x, s.y, 48, false);
      if (i >= r.stars) return;
      const star = addStarIcon(this, s.x, s.y, 48, true).setScale(0);
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
      () => void flyStars(this, SLOTS[1] ?? { x: 640, y: 160 }, counter, gained, effects),
    );

    const tori = new Tori(this, 115, 600, 0.5);
    const bubble = new SpeechBubble(this, 560, 612, { width: 620, tail: 'left', tori });
    const lines: VoiceLine[] = [];
    if (this.activity.kind === 'level')
      lines.push(getLevelByScene(this.activity.sceneKey).dialog.lesson);

    if (r.medalEarned) {
      // ¡Medalla del derecho!
      const medal = addRightMedal(this, 640, -200, this.right, true, 1.1);
      const name = addBody(this, 640, 470, this.right.medal.name, 30).setAlpha(0);
      this.tweens.add({
        targets: medal,
        y: 350,
        delay: starsDone,
        duration: motion(900),
        ease: 'Bounce.easeOut',
        onStart: () => AudioManager.sfx('fanfare'),
        onComplete: () => {
          this.tweens.add({ targets: name, alpha: 1, duration: 300 });
          effects.celebrate();
          vibrate([40, 60, 40]);
        },
      });
      lines.push(this.right.medal.won);
    } else {
      // Tarjeta de la actividad completada (con palomita).
      const card = this.add.container(640, 350).setScale(0);
      const g = this.add.graphics();
      g.fillStyle(COLORS.white).fillRoundedRect(-110, -95, 220, 190, 26);
      g.lineStyle(7, this.right.color).strokeRoundedRect(-110, -95, 220, 190, 26);
      card.add([
        g,
        fitImage(this.add.image(0, -18, tex(this.activity.icon)), 140, 110),
        addBody(this, 0, 64, this.activity.title, 20, { wrap: 200 }),
      ]);
      card.add(this.add.image(92, -78, TEX.check).setScale(0.6));
      this.tweens.add({
        targets: card,
        scale: 1,
        delay: starsDone,
        duration: motion(450),
        ease: 'Back.easeOut',
        onStart: () => AudioManager.sfx('success'),
      });
    }
    if (r.challengesUnlocked) lines.push(CHALLENGES_OPEN);
    if (lines.length) {
      this.time.delayedCall(starsDone + 900, () => {
        tori.setMood('celebrate');
        void bubble.say(lines);
      });
    } else {
      this.time.delayedCall(starsDone + 400, () => tori.setMood('happy'));
    }

    const next = new BigButton(this, GAME_WIDTH - 170, 630, {
      label: 'Continuar',
      width: 290,
      color: COLORS.sun,
      pulse: true,
      onClick: () => void goTo(this, 'RightHub', { rightId: this.right.id }),
    });
    next.setAlpha(0).disableInteractive();
    this.time.delayedCall(starsDone + 900, () => {
      next.setInteractive();
      this.tweens.add({ targets: next, alpha: 1, duration: 300 });
    });
    new IdleHint(this, () => (next.alpha === 1 ? { kind: 'tap', x: next.x, y: next.y } : null));
  }
}
