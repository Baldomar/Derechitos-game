import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { RIGHTS, type MemoryContent, type RightId } from '@/config/levels';
import { tex, type ArtKey } from '@/art/Art';
import type { HintTarget } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseLevel } from './BaseLevel';

const CARD_W = 120;
const CARD_H = 150;
const GAP = 16;

const RIGHT_COLOR: Record<RightId, number> = {
  vivienda: COLORS.coral,
  vida: COLORS.pink,
  alimentacion: COLORS.sun,
  salud: COLORS.turquoise,
  educacion: COLORS.grape,
  igualdad: COLORS.orange,
  juego: COLORS.sea,
  opinion: COLORS.grass,
};
const SHORT: Record<RightId, string> = {
  vivienda: 'Vivienda',
  vida: 'Vida',
  alimentacion: 'Comida',
  salud: 'Salud',
  educacion: 'Escuela',
  igualdad: 'Igualdad',
  juego: 'Jugar',
  opinion: 'Opinar',
};

interface Card {
  c: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Container;
  right: RightId;
  up: boolean;
  matched: boolean;
}

/**
 * Nivel 8 — Memorama de derechos (repaso de todos).
 * 8 parejas: carta con la ilustración grande ↔ carta con el ícono y el nombre del derecho (mismo color).
 * Al terminar, los íconos vuelan y se arma la imagen completa de la isla.
 */
export default class Level08Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'icon-vivienda',
    'icon-vida',
    'icon-alimentacion',
    'icon-salud',
    'icon-educacion',
    'icon-igualdad',
    'icon-juego',
    'icon-opinion',
    'palmera',
    'izote',
    'arbol',
  ];
  private c!: MemoryContent;
  private cards: Card[] = [];
  private first: Card | null = null;
  private lock = false;
  private matched = 0;
  private mismatches = 0;

  constructor() {
    super('Level08');
  }

  override init(): void {
    super.init();
    this.cards = [];
    this.first = null;
    this.lock = false;
    this.matched = 0;
    this.mismatches = 0;
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('memory');
    const deck: { right: RightId; big: boolean }[] = [];
    for (const p of this.c.pairs)
      deck.push({ right: p.right, big: true }, { right: p.right, big: false });
    Phaser.Utils.Array.Shuffle(deck);
    const cols = 8;
    const startX = 640 - (cols * CARD_W + (cols - 1) * GAP) / 2 + CARD_W / 2;
    deck.forEach((d, i) => {
      const x = startX + (i % cols) * (CARD_W + GAP);
      const y = 205 + Math.floor(i / cols) * (CARD_H + 22);
      this.cards.push(this.makeCard(x, y, d.right, d.big, i));
    });
  }

  private makeCard(x: number, y: number, right: RightId, big: boolean, i: number): Card {
    const w = CARD_W;
    const h = CARD_H;
    const backG = this.add.graphics();
    backG.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 18);
    backG.fillStyle(COLORS.turquoise).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    backG.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    backG
      .lineStyle(3, COLORS.white, 0.7)
      .strokeRoundedRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 12);
    const back = this.add.container(0, 0, [backG, addStarIcon(this, 0, 0, 26, true)]);

    const color = RIGHT_COLOR[right];
    const frontG = this.add.graphics();
    frontG.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    frontG
      .fillStyle(color)
      .fillRoundedRect(-w / 2, -h / 2, w, 26, { tl: 18, tr: 18, bl: 0, br: 0 });
    frontG
      .fillStyle(color)
      .fillRoundedRect(-w / 2, h / 2 - 16, w, 16, { tl: 0, tr: 0, bl: 18, br: 18 });
    frontG.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    const parts: Phaser.GameObjects.GameObject[] = [frontG];
    const icon = RIGHTS[right].icon;
    if (big) {
      parts.push(this.add.image(0, 6, tex(icon)).setScale(1));
    } else {
      parts.push(this.add.image(0, -8, tex(icon)).setScale(0.6));
      parts.push(addBody(this, 0, 44, SHORT[right], 19));
    }
    const front = this.add.container(0, 0, parts).setVisible(false);

    const c = this.add.container(x, y, [back, front]).setSize(w, h);
    const card: Card = { c, back, front, right, up: false, matched: false };
    c.setInteractive({ useHandCursor: true });
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tap(card));
    c.setScale(0);
    this.tweens.add({
      targets: c,
      scale: 1,
      delay: i * 40,
      duration: motion(300),
      ease: 'Back.easeOut',
    });
    return card;
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private flip(card: Card, up: boolean): void {
    card.up = up;
    this.tweens.chain({
      targets: card.c,
      tweens: [
        {
          scaleX: 0,
          duration: motion(110),
          onComplete: () => {
            card.front.setVisible(up);
            card.back.setVisible(!up);
          },
        },
        { scaleX: 1, duration: motion(110) },
      ],
    });
  }

  private tap(card: Card): void {
    if (this.lock || card.up || card.matched) return;
    AudioManager.sfx('pop', { pitch: 1.2 });
    this.flip(card, true);
    if (!this.first) {
      this.first = card;
      return;
    }
    const a = this.first;
    this.first = null;
    this.lock = true;
    if (a.right === card.right) {
      a.matched = true;
      card.matched = true;
      this.matched += 1;
      const pair = this.c.pairs.find((p) => p.right === card.right);
      this.time.delayedCall(260, () => {
        [a, card].forEach((k) =>
          this.tweens.add({ targets: k.c, scale: 1.12, duration: motion(150), yoyo: true }),
        );
        const last = this.matched === this.c.pairs.length;
        this.correct(
          (a.c.x + card.c.x) / 2,
          Math.min(a.c.y, card.c.y) - 60,
          last ? null : (pair?.matched ?? null),
        );
        this.lock = false;
        if (last) this.time.delayedCall(700, () => void this.buildIsland());
      });
      return;
    }
    this.mismatches += 1;
    if (this.mismatches % 3 === 0) void this.say(this.c.tryAgain);
    this.time.delayedCall(950, () => {
      this.flip(a, false);
      this.flip(card, false);
      this.lock = false;
    });
  }

  /** Final: las cartas se van y los íconos arman la imagen de la isla. */
  private async buildIsland(): Promise<void> {
    const extra = Math.max(0, this.mismatches - this.c.freeMismatches);
    this.errors = Math.ceil(extra / this.c.mismatchesPerError);

    const origins = new Map<RightId, { x: number; y: number }>();
    this.cards.forEach((k, i) => {
      if (!origins.has(k.right)) origins.set(k.right, { x: k.c.x, y: k.c.y });
      this.tweens.add({
        targets: k.c,
        scale: 0,
        alpha: 0,
        delay: i * 25,
        duration: motion(250),
        onComplete: () => k.c.destroy(),
      });
    });
    await this.wait(600);
    if (!this.alive) return;

    const isle = this.add.graphics().setAlpha(0);
    isle.fillStyle(COLORS.sea).fillEllipse(700, 320, 820, 380);
    isle.fillStyle(COLORS.white, 0.3).fillEllipse(700, 320, 760, 340);
    isle.fillStyle(COLORS.sand).fillEllipse(700, 320, 700, 300);
    isle.fillStyle(COLORS.grass).fillEllipse(700, 320, 640, 250);
    isle.lineStyle(5, COLORS.ink).strokeEllipse(700, 320, 700, 300);
    this.tweens.add({ targets: isle, alpha: 1, duration: motion(500) });
    const deco = [
      this.add.image(470, 290, tex('palmera')).setScale(0.55),
      this.add.image(930, 290, tex('arbol')).setScale(0.5),
      this.add.image(700, 420, tex('izote')).setScale(0.45),
    ];
    deco.forEach((d) => d.setAlpha(0));
    this.tweens.add({ targets: deco, alpha: 1, duration: motion(500), delay: 300 });

    const rights = this.c.pairs.map((p) => p.right);
    rights.forEach((r, i) => {
      const a = -Math.PI / 2 + (i / rights.length) * Math.PI * 2;
      const tx = 700 + Math.cos(a) * 250;
      const ty = 320 + Math.sin(a) * 100;
      const from = origins.get(r) ?? { x: 640, y: 200 };
      const img = this.add.image(from.x, from.y, tex(RIGHTS[r].icon)).setScale(0.3).setDepth(3);
      this.tweens.add({
        targets: img,
        x: tx,
        y: ty,
        scale: 0.62,
        delay: 500 + i * 180,
        duration: motion(600),
        ease: 'Back.easeOut',
        onStart: () => AudioManager.sfx('star', { index: i % 4 }),
        onComplete: () => this.effects.sparkleAt(tx, ty, 8),
      });
    });
    await this.wait(500 + rights.length * 180 + 600);
    if (!this.alive) return;
    await this.complete(this.c.done);
  }

  protected override getHint(): HintTarget | null {
    if (this.lock) return null;
    if (this.first) {
      const first = this.first;
      const pair = this.cards.find((k) => k !== first && k.right === first.right && !k.matched);
      return pair ? { kind: 'tap', x: pair.c.x, y: pair.c.y } : null;
    }
    const next = this.cards.find((k) => !k.matched && !k.up);
    return next ? { kind: 'tap', x: next.c.x, y: next.c.y } : null;
  }
}
