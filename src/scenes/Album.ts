import Phaser from 'phaser';
import { COLORS, CSS, GAME_WIDTH } from '@/config/theme';
import { LEVELS } from '@/config/levels';
import { ALBUM_HELLO, ALBUM_LOCKED } from '@/config/phrases';
import { ensureArt } from '@/art/Art';
import { addBackdrop } from '@/components/Backdrop';
import { addSticker } from '@/components/Badges';
import { BigButton } from '@/components/BigButton';
import { SpeechBubble } from '@/components/SpeechBubble';
import { addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';

const SIZE = 172;

/** Álbum de estampas: las 8 estampas. Tocar una ganada hace que Tori repita el derecho aprendido. */
export default class AlbumScene extends Phaser.Scene {
  constructor() {
    super('Album');
  }

  create(): void {
    ensureArt(
      this,
      LEVELS.map((l) => l.icon),
    );
    addBackdrop(this, { sky: COLORS.cream, grass: false, clouds: false });
    const page = this.add.graphics();
    page.fillStyle(0xf6e7c8).fillRoundedRect(60, 100, GAME_WIDTH - 120, 430, 30);
    page.lineStyle(5, COLORS.ink).strokeRoundedRect(60, 100, GAME_WIDTH - 120, 430, 30);
    addTitle(
      this,
      GAME_WIDTH / 2,
      52,
      `Mi álbum de estampas · ${GameState.completedCount}/${LEVELS.length}`,
      46,
      {
        stroke: CSS.white,
        strokeThickness: 8,
      },
    );

    const tori = new Tori(this, 115, 600, 0.5);
    const bubble = new SpeechBubble(this, 560, 612, { width: 620, tail: 'left', tori });

    LEVELS.forEach((level, i) => {
      const x = GAME_WIDTH / 2 + ((i % 4) - 1.5) * 260;
      const y = 210 + Math.floor(i / 4) * 215;
      const earned = GameState.isCompleted(level.id);
      const st = addSticker(this, x, y, level, earned, SIZE).setAngle(((i % 3) - 1) * 3);
      st.setSize(SIZE, SIZE).setInteractive({ useHandCursor: true });
      st.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        AudioManager.sfx('pop');
        this.tweens.add({
          targets: st,
          scale: { from: 1.12, to: 1 },
          duration: motion(300),
          ease: 'Back.easeOut',
        });
        if (earned) tori.setMood('happy');
        void bubble.say(earned ? level.dialog.lesson : ALBUM_LOCKED);
      });
      st.setScale(0);
      this.tweens.add({
        targets: st,
        scale: 1,
        delay: i * 70,
        duration: motion(350),
        ease: 'Back.easeOut',
      });
    });

    new BigButton(this, GAME_WIDTH - 140, 630, {
      label: 'Mapa',
      width: 220,
      height: 92,
      fontSize: 40,
      color: COLORS.sun,
      onClick: () => void goTo(this, 'WorldMap'),
    });

    this.time.delayedCall(450, () => void bubble.say(ALBUM_HELLO));
  }
}
