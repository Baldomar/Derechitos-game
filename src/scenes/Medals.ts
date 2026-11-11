import Phaser from 'phaser';
import { COLORS, CSS, GAME_WIDTH } from '@/config/theme';
import { RIGHT_AREAS } from '@/config/rights';
import { MEDALS_HELLO } from '@/config/phrases';
import { ensureArt } from '@/art/Art';
import { addBackdrop } from '@/components/Backdrop';
import { addRightMedal } from '@/components/Badges';
import { BigButton } from '@/components/BigButton';
import { SpeechBubble } from '@/components/SpeechBubble';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';

/** "Mis medallas": una medalla por derecho completado. Tocar una hace que Tori la nombre. */
export default class MedalsScene extends Phaser.Scene {
  constructor() {
    super('Medals');
  }

  create(): void {
    ensureArt(
      this,
      RIGHT_AREAS.map((r) => r.icon),
    );
    addBackdrop(this, { sky: COLORS.cream, grass: false, clouds: false });
    const page = this.add.graphics();
    page.fillStyle(0xf6e7c8).fillRoundedRect(140, 96, 1000, 430, 30);
    page.lineStyle(5, COLORS.ink).strokeRoundedRect(140, 96, 1000, 430, 30);
    addTitle(
      this,
      GAME_WIDTH / 2,
      50,
      `Mis medallas · ${GameState.rightMedalCount}/${RIGHT_AREAS.length}`,
      46,
      {
        stroke: CSS.white,
        strokeThickness: 8,
      },
    );

    const tori = new Tori(this, 115, 600, 0.5);
    const bubble = new SpeechBubble(this, 560, 612, { width: 620, tail: 'left', tori });

    RIGHT_AREAS.forEach((r, i) => {
      const x = 640 + ((i % 4) - 1.5) * 240;
      const y = 212 + Math.floor(i / 4) * 210;
      const earned = GameState.hasRightMedal(r);
      const medal = addRightMedal(this, x, y, r, earned, 0.7);
      addBody(this, x, y + 72, earned ? r.medal.name : r.short, 20, { wrap: 220 });
      medal.setSize(130, 160).setInteractive({ useHandCursor: true });
      medal.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        AudioManager.sfx('pop');
        this.tweens.add({
          targets: medal,
          scale: { from: 0.9, to: 0.7 },
          duration: motion(300),
          ease: 'Back.easeOut',
        });
        if (earned) tori.setMood('happy');
        void bubble.say(earned ? r.medal.won : r.phrase);
      });
      medal.setScale(0);
      this.tweens.add({
        targets: medal,
        scale: 0.7,
        delay: i * 80,
        duration: motion(380),
        ease: 'Back.easeOut',
      });
    });
    if (GameState.rightMedalCount > 0) {
      new BigButton(this, GAME_WIDTH - 140, 640, {
        label: 'Mi diploma',
        width: 230,
        height: 92,
        fontSize: 32,
        color: COLORS.sun,
        pulse: true,
        onClick: () => void goTo(this, 'Final'),
      });
    }

    new BigButton(this, 90, 56, {
      label: 'Isla',
      width: 150,
      height: 88,
      fontSize: 34,
      color: COLORS.white,
      onClick: () => void goTo(this, 'WorldMap'),
    });

    this.time.delayedCall(450, () => void bubble.say(MEDALS_HELLO));
  }
}
