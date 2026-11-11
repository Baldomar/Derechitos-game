import Phaser from 'phaser';
import { COLORS, CSS, FONTS, GAME_WIDTH, TEXT_RESOLUTION } from '@/config/theme';
import { RIGHT_AREAS } from '@/config/rights';
import { FINAL_LINES } from '@/config/phrases';
import { ensureArt, tex } from '@/art/Art';
import { addBackdrop } from '@/components/Backdrop';
import { addRightMedal } from '@/components/Badges';
import { BigButton } from '@/components/BigButton';
import { Effects } from '@/components/Effects';
import { addStarIcon } from '@/components/Icons';
import { SpeechBubble } from '@/components/SpeechBubble';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { motion, vibrate } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';

const CX = 720;

/** Diploma animado "Guardián de los Derechos": estrellas, medallas y los derechos de la isla. */
export default class FinalScene extends Phaser.Scene {
  constructor() {
    super('Final');
  }

  create(): void {
    GameState.markFinalSeen();
    ensureArt(
      this,
      RIGHT_AREAS.map((r) => r.icon),
    );
    addBackdrop(this, { sky: COLORS.sun, grass: false });
    const effects = new Effects(this);

    const d = this.add.container(CX, 320);
    const W = 1000;
    const H = 560;
    const paper = this.add.graphics();
    paper.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-W / 2, -H / 2 + 10, W, H, 30);
    paper.fillStyle(COLORS.cream).fillRoundedRect(-W / 2, -H / 2, W, H, 30);
    paper
      .lineStyle(8, COLORS.turquoise)
      .strokeRoundedRect(-W / 2 + 16, -H / 2 + 16, W - 32, H - 32, 22);
    paper
      .lineStyle(3, COLORS.grape)
      .strokeRoundedRect(-W / 2 + 28, -H / 2 + 28, W - 56, H - 56, 16);
    d.add(paper);

    d.add(addBody(this, 0, -232, 'Diploma de', 28));
    d.add(addTitle(this, 0, -182, 'Guardián de los Derechos', 58, { color: CSS.grape }));
    d.add(addBody(this, 0, -134, 'Isla Derechitos', 22));

    // Estrellas y medallas de cada derecho.
    const max = RIGHT_AREAS.reduce((s, r) => s + GameState.rightStars(r).max, 0);
    d.add(addStarIcon(this, -110, -86, 22, true));
    d.add(addTitle(this, -10, -84, `${GameState.totalRightStars} / ${max}`, 34));
    RIGHT_AREAS.forEach((r, i) => {
      d.add(addRightMedal(this, -392 + i * 112, -4, r, GameState.hasRightMedal(r), 0.38));
    });

    // Derechos de la isla con su ícono.
    RIGHT_AREAS.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? -440 : -15;
      const y = 78 + row * 48;
      d.add(this.add.image(x + 16, y, tex(r.icon)).setScale(0.38));
      d.add(
        this.add
          .text(x + 46, y, r.name, {
            fontFamily: FONTS.body,
            fontSize: '21px',
            fontStyle: '800',
            color: CSS.ink,
            resolution: TEXT_RESOLUTION,
          })
          .setOrigin(0, 0.5),
      );
    });

    // Sello dorado.
    const seal = this.add.graphics();
    seal.fillStyle(COLORS.sun).fillCircle(0, 0, 46);
    seal.lineStyle(5, COLORS.ink).strokeCircle(0, 0, 46);
    seal.lineStyle(3, COLORS.ink, 0.5).strokeCircle(0, 0, 36);
    const sealC = this.add.container(W / 2 - 80, -H / 2 + 80, [
      seal,
      addStarIcon(this, 0, 0, 24, true),
    ]);
    d.add(sealC);

    d.setScale(0.2).setAlpha(0);
    this.tweens.add({
      targets: d,
      scale: 1,
      alpha: 1,
      duration: motion(900),
      ease: 'Elastic.easeOut',
      easeParams: [1, 0.6],
      onComplete: () => {
        AudioManager.sfx('fanfare');
        vibrate([40, 60, 40]);
        effects.celebrate();
        this.tweens.add({
          targets: sealC,
          angle: 360,
          scale: { from: 1.4, to: 1 },
          duration: motion(700),
          ease: 'Back.easeOut',
        });
      },
    });

    const tori = new Tori(this, 115, 600, 0.5);
    const bubble = new SpeechBubble(this, 560, 646, {
      width: 560,
      tail: 'left',
      tori,
      fontSize: 26,
    });
    this.time.delayedCall(1300, () => {
      tori.setMood('celebrate');
      void bubble.say(FINAL_LINES);
    });
    this.time.addEvent({ delay: 4500, loop: true, callback: () => effects.celebrate() });

    new BigButton(this, GAME_WIDTH - 280, 650, {
      label: 'Isla',
      width: 190,
      height: 88,
      fontSize: 36,
      color: COLORS.white,
      onClick: () => void goTo(this, 'WorldMap'),
    });
    new BigButton(this, GAME_WIDTH - 90, 650, {
      label: 'Medallas',
      width: 170,
      height: 88,
      fontSize: 30,
      color: COLORS.sun,
      onClick: () => void goTo(this, 'Medals'),
    });
  }
}
