import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { INTRO_LINES } from '@/config/phrases';
import { LEVELS } from '@/config/levels';
import { addBackdrop } from '@/components/Backdrop';
import { addMedal } from '@/components/Badges';
import { BigButton } from '@/components/BigButton';
import { IdleHint } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { SpeechBubble } from '@/components/SpeechBubble';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';

const BUTTON = { x: 820, y: 580 };

/** Intro: Tori se presenta con voz y muestra que ganará estrellas y medallas. */
export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create(): void {
    addBackdrop(this);
    const tori = new Tori(this, 290, 400, 0.95);
    const bubble = new SpeechBubble(this, 800, 200, { width: 660, tail: 'left', tori });

    const play = new BigButton(this, BUTTON.x, BUTTON.y, {
      label: '¡Vamos!',
      width: 320,
      color: COLORS.sun,
      pulse: true,
      onClick: () => {
        GameState.markIntroSeen();
        void goTo(this, 'WorldMap');
      },
    });
    play.setVisible(false);
    const showPlay = (): void => {
      if (play.visible) return;
      play.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: play, alpha: 1, duration: 300 });
    };
    new IdleHint(this, () => (play.visible ? { kind: 'tap', x: BUTTON.x, y: BUTTON.y } : null));

    const [l1, l2, l3] = INTRO_LINES;
    this.time.delayedCall(450, () => {
      void (async () => {
        if (l1 && l2) await bubble.say([l1, l2]);
        if (!this.sys.isActive()) return;
        this.showRewards();
        if (l3) await bubble.say(l3);
        if (!this.sys.isActive()) return;
        tori.setMood('happy');
        showPlay();
      })();
    });
    // El botón aparece aunque la voz no termine, para no hacer esperar de más.
    this.time.delayedCall(7000, showPlay);
  }

  /** Estrellas y medalla que aparecen cuando Tori las menciona. */
  private showRewards(): void {
    [0, 1, 2].forEach((i) => {
      const s = addStarIcon(this, 640 + i * 90, 400 - (i === 1 ? 20 : 0), 38, true).setScale(0);
      this.tweens.add({
        targets: s,
        scale: 1,
        delay: i * 250,
        duration: motion(400),
        ease: 'Back.easeOut',
        onStart: () => AudioManager.sfx('star', { index: i }),
      });
    });
    const level = LEVELS[0];
    if (!level) return;
    const medal = addMedal(this, 1040, 420, level, 0.8).setScale(0);
    this.tweens.add({
      targets: medal,
      scale: 0.8,
      delay: 900,
      duration: motion(500),
      ease: 'Back.easeOut',
      onStart: () => AudioManager.sfx('medal'),
    });
  }
}
