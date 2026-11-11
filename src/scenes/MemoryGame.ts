import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { MemoryActivity } from '@/config/rights';
import { tex } from '@/art/Art';
import type { HintTarget } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseActivity, fitImage } from './BaseActivity';

const W = 130;
const H = 160;

interface Card {
  c: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Container;
  id: string;
  up: boolean;
  matched: boolean;
}

/** Motor "memorama": encontrar parejas iguales (dibujo + nombre). */
export default class MemoryGameScene extends BaseActivity<MemoryActivity> {
  protected readonly kind = 'memory' as const;
  private cards: Card[] = [];
  private first: Card | null = null;
  private lock = false;
  private matched = 0;
  private mismatches = 0;

  constructor() {
    super('MemoryGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.cards = [];
    this.first = null;
    this.lock = false;
    this.matched = 0;
    this.mismatches = 0;
  }

  protected override buildLevel(): void {
    const deck = Phaser.Utils.Array.Shuffle(this.activity.items.flatMap((it) => [it, it]));
    const cols = Math.ceil(deck.length / 2);
    deck.forEach((it, i) => {
      const x = 640 + ((i % cols) - (cols - 1) / 2) * (W + 20);
      const y = 210 + Math.floor(i / cols) * (H + 20);
      this.cards.push(this.makeCard(x, y, it, i));
    });
  }

  private makeCard(x: number, y: number, it: MemoryActivity['items'][number], i: number): Card {
    const color = this.right.color;
    const backG = this.add.graphics();
    backG.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-W / 2, -H / 2 + 7, W, H, 18);
    backG.fillStyle(color).fillRoundedRect(-W / 2, -H / 2, W, H, 18);
    backG.lineStyle(5, COLORS.ink).strokeRoundedRect(-W / 2, -H / 2, W, H, 18);
    backG
      .lineStyle(3, COLORS.white, 0.7)
      .strokeRoundedRect(-W / 2 + 9, -H / 2 + 9, W - 18, H - 18, 12);
    const back = this.add.container(0, 0, [backG, addStarIcon(this, 0, 0, 26, true)]);

    const frontG = this.add.graphics();
    frontG.fillStyle(COLORS.white).fillRoundedRect(-W / 2, -H / 2, W, H, 18);
    frontG.lineStyle(5, COLORS.ink).strokeRoundedRect(-W / 2, -H / 2, W, H, 18);
    const img = fitImage(this.add.image(0, -14, tex(it.art)), 100, 95);
    const front = this.add
      .container(0, 0, [frontG, img, addBody(this, 0, 56, it.label, 18)])
      .setVisible(false);

    const c = this.add.container(x, y, [back, front]).setSize(W, H);
    const card: Card = { c, back, front, id: it.id, up: false, matched: false };
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
    if (a.id === card.id) {
      a.matched = true;
      card.matched = true;
      this.matched += 1;
      this.time.delayedCall(260, () => {
        [a, card].forEach((k) =>
          this.tweens.add({ targets: k.c, scale: 1.12, duration: motion(150), yoyo: true }),
        );
        const last = this.matched === this.activity.items.length;
        this.correct(
          (a.c.x + card.c.x) / 2,
          Math.min(a.c.y, card.c.y) - 70,
          last ? null : undefined,
        );
        this.lock = false;
        if (last) {
          const extra = Math.max(0, this.mismatches - this.activity.freeMismatches);
          this.errors = Math.ceil(extra / this.activity.mismatchesPerError);
          this.time.delayedCall(700, () => void this.complete(this.activity.done));
        }
      });
      return;
    }
    this.mismatches += 1;
    if (this.mismatches % 3 === 0) void this.say(this.activity.tryAgain);
    this.time.delayedCall(950, () => {
      this.flip(a, false);
      this.flip(card, false);
      this.lock = false;
    });
  }

  protected override getHint(): HintTarget | null {
    if (this.lock) return null;
    if (this.first) {
      const first = this.first;
      const pair = this.cards.find((k) => k !== first && k.id === first.id && !k.matched);
      return pair ? { kind: 'tap', x: pair.c.x, y: pair.c.y } : null;
    }
    const next = this.cards.find((k) => !k.matched && !k.up);
    return next ? { kind: 'tap', x: next.c.x, y: next.c.y } : null;
  }
}
