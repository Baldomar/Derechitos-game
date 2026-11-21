import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { COLORS } from '@/config/theme';
import type { ThumbsActivity } from '@/config/rights';
import type { HintTarget } from '@/components/HelperHand';
import { fit, RoundDots, thingCard } from '@/components/Kit';
import { addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { TEX } from '@/core/Textures';
import { motion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const CARD = { x: 640, y: 300, w: 360, h: 330 };
const YES = { x: 300, y: 330 };
const NO = { x: 980, y: 330 };

/**
 * Motor "¿está bien?": una tarjeta a la vez con una situación. Tori la lee y el niño toca
 * la carita feliz (está bien) o la carita triste (no está bien). La tarjeta vuela a su
 * montoncito con un sello; si se equivoca, la tarjeta tiembla y Tori explica.
 */
export default class ThumbsGameScene extends BaseActivity<ThumbsActivity> {
  protected readonly kind = 'thumbs' as const;
  private index = 0;
  private card: Phaser.GameObjects.Container | null = null;
  private busy = true;
  private dots!: RoundDots;
  private piles = { yes: 0, no: 0 };

  constructor() {
    super('ThumbsGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.index = 0;
    this.card = null;
    this.busy = true;
    this.piles = { yes: 0, no: 0 };
  }

  protected override buildLevel(): void {
    this.dots = new RoundDots(this, this.activity.cards.length, 1240, 64);
    this.button(YES.x, YES.y, true);
    this.button(NO.x, NO.y, false);
    void this.showCard(false);
  }

  /** Botón grande: carita + texto, sobre un círculo de color (forma + color + palabra). */
  private button(x: number, y: number, yes: boolean): Phaser.GameObjects.Container {
    const color = yes ? COLORS.grass : COLORS.coral;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.2).fillCircle(0, 8, 104);
    g.fillStyle(color).fillCircle(0, 0, 104);
    g.lineStyle(6, COLORS.ink).strokeCircle(0, 0, 104);
    g.fillStyle(COLORS.white, 0.25).fillCircle(-30, -40, 30);
    const face = fit(this.add.image(0, -14, tex(yes ? 'cara-feliz' : 'cara-triste')), 120, 120, 2);
    const label = addTitle(this, 0, 136, yes ? '¡Está bien!' : 'No está bien', 30, {
      stroke: '#FFFFFF',
      strokeThickness: 8,
    });
    const c = this.add.container(x, y, [g, face, label]).setSize(210, 210).setDepth(3);
    c.setInteractive({ useHandCursor: true });
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.answer(yes, c));
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      this.tweens.add({ targets: c, scale: 1.06, duration: 120 }),
    );
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      this.tweens.add({ targets: c, scale: 1, duration: 120 }),
    );
    return c;
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.busy = false;
    const def = this.activity.cards[0];
    if (def) void this.instruct(def.say);
  }

  private async showCard(speak = true): Promise<void> {
    const def = this.activity.cards[this.index];
    if (!def) return;
    const card = thingCard(this, CARD.w, CARD.h, def.art, def.label, { labelSize: 24 });
    card.setPosition(CARD.x, -200).setDepth(4).setAngle(-12);
    this.card = card;
    AudioManager.sfx('pop', { pitch: 0.9 });
    this.tweens.add({
      targets: card,
      y: CARD.y,
      angle: 0,
      duration: motion(520),
      ease: 'Back.easeOut',
    });
    if (!speak) return;
    this.busy = false;
    await this.instruct(def.say);
  }

  private answer(yes: boolean, btn: Phaser.GameObjects.Container): void {
    const def = this.activity.cards[this.index];
    const card = this.card;
    if (this.busy || !def || !card) return;
    AudioManager.sfx('pop');
    this.tweens.add({ targets: btn, scale: 0.9, duration: motion(80), yoyo: true });
    if (yes !== def.good) {
      this.tweens.add({
        targets: card,
        angle: { from: -5, to: 5 },
        duration: motion(70),
        yoyo: true,
        repeat: 3,
        onComplete: () => card.setAngle(0),
      });
      this.mistakeOnce(String(this.index), def.hint);
      return;
    }
    this.busy = true;
    this.dots.mark(this.index);
    const last = this.index === this.activity.cards.length - 1;
    // Sello de color y vuela al montón de su lado.
    const stamp = this.add.image(CARD.w / 2 - 34, -CARD.h / 2 + 34, TEX.check).setScale(0);
    card.add(stamp);
    this.tweens.add({ targets: stamp, scale: 0.7, duration: motion(220), ease: 'Back.easeOut' });
    const n = yes ? this.piles.yes++ : this.piles.no++;
    const pile = yes ? YES : NO;
    this.correct(card.x, card.y - CARD.h / 2, last ? null : undefined);
    this.time.delayedCall(550, () => {
      this.tweens.add({
        targets: card,
        x: pile.x + (n % 2 ? 10 : -10),
        y: pile.y - 175 - n * 6,
        scale: 0.32,
        angle: (yes ? -1 : 1) * (6 + n * 3),
        duration: motion(450),
        ease: 'Cubic.easeInOut',
        onComplete: () => card.setDepth(2),
      });
    });
    this.time.delayedCall(1300, () => {
      if (!this.alive) return;
      if (last) {
        void this.complete(this.activity.done);
      } else {
        this.index += 1;
        void this.showCard();
      }
    });
  }

  protected override getHint(): HintTarget | null {
    const def = this.activity.cards[this.index];
    if (this.busy || !def) return null;
    const b = def.good ? YES : NO;
    return { kind: 'tap', x: b.x, y: b.y };
  }
}
