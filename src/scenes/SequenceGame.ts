import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { SequenceActivity } from '@/config/rights';
import { tex } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addBody, addTitle } from '@/components/Text';
import { motion } from '@/core/Device';
import { BaseActivity, fitImage } from './BaseActivity';

const SLOT_Y = 212;
const CARD_Y = 425;
const CARD_W = 150;
const CARD_H = 160;

/**
 * Motor "ordenar": arrastrar cada paso a su número (1, 2, 3…).
 * Se va llenando en orden; si el niño toma el paso correcto se acomoda en el número que sigue,
 * y si toma otro, Tori le dice cuál va ahora ("Primero mojamos las manos…").
 */
export default class SequenceGameScene extends BaseActivity<SequenceActivity> {
  protected readonly kind = 'sequence' as const;
  private slots: DropZone[] = [];
  private cards: DraggableItem[] = [];
  private next = 0;
  private nextGlow: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('SequenceGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.slots = [];
    this.cards = [];
    this.next = 0;
    this.nextGlow = null;
  }

  private xFor(i: number): number {
    const n = this.activity.steps.length;
    return 640 + (i - (n - 1) / 2) * 190;
  }

  protected override buildLevel(): void {
    const steps = this.activity.steps;
    steps.forEach((_, i) => {
      const x = this.xFor(i);
      addTitle(this, x, SLOT_Y, String(i + 1), 84).setAlpha(0.3);
      this.slots.push(
        new DropZone(this, x, SLOT_Y, { id: `slot${i}`, width: 165, height: 175, tolerance: 25 }),
      );
    });

    // Tarjetas desordenadas (nunca en el orden correcto).
    let order = Phaser.Utils.Array.Shuffle([...steps]);
    while (order.every((s, i) => s.id === steps[i]?.id) && steps.length > 1)
      order = Phaser.Utils.Array.Shuffle([...steps]);
    order.forEach((step, i) => {
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.ink, 0.2).fillRoundedRect(
        -CARD_W / 2,
        -CARD_H / 2 + 6,
        CARD_W,
        CARD_H,
        18,
      );
      bg.fillStyle(COLORS.white).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
      bg.lineStyle(5, this.right.color).strokeRoundedRect(
        -CARD_W / 2,
        -CARD_H / 2,
        CARD_W,
        CARD_H,
        18,
      );
      const img = fitImage(this.add.image(0, -16, tex(step.art)), 105, 95);
      const label = addBody(this, 0, 56, step.label, 20);
      const card = new DraggableItem(this, this.xFor(i), CARD_Y, {
        id: step.id,
        content: [bg, img, label],
        width: CARD_W,
        height: CARD_H,
        zones: this.slots,
        placedScale: 1,
        growOnDrag: true,
        onDrop: (it, zone) => this.onDrop(it, zone),
      });
      card.setDepth(3);
      this.cards.push(card);
    });
    this.highlightNext();
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  /** El número que sigue late suavemente para guiar. */
  private highlightNext(): void {
    this.nextGlow?.stop();
    this.slots.forEach((s) => s.setAlpha(1));
    const slot = this.slots[this.next];
    if (!slot) return;
    this.nextGlow = this.tweens.add({
      targets: slot,
      alpha: 0.45,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private onDrop(item: DraggableItem, zone: DropZone | null): DropDecision {
    if (!zone) return 'ignore';
    const expected = this.activity.steps[this.next];
    const slot = this.slots[this.next];
    if (!expected || !slot) return 'ignore';
    if (item.itemId !== expected.id) {
      this.mistake(expected.hint);
      return 'reject';
    }
    this.next += 1;
    const last = this.next === this.activity.steps.length;
    this.correct(slot.x, slot.y - 110, last ? null : undefined);
    this.highlightNext();
    if (last) void this.finishSequence();
    return { placeIn: slot };
  }

  private async finishSequence(): Promise<void> {
    await this.wait(500);
    // Recorrido de festejo por los pasos, en orden.
    for (const [i, slot] of this.slots.entries()) {
      this.time.delayedCall(i * 160, () => {
        this.effects.sparkleAt(slot.x, slot.y, 8);
        this.tweens.add({
          targets: this.cards.find((c) => c.itemId === this.activity.steps[i]?.id),
          y: '-=16',
          duration: motion(140),
          yoyo: true,
        });
      });
    }
    await this.wait(this.slots.length * 160 + 300);
    await this.complete(this.activity.done);
  }

  protected override getHint(): HintTarget | null {
    const expected = this.activity.steps[this.next];
    const card = expected ? this.cards.find((c) => c.itemId === expected.id) : undefined;
    const slot = this.slots[this.next];
    return card && slot
      ? { kind: 'drag', from: { x: card.x, y: card.y }, to: { x: slot.x, y: slot.y } }
      : null;
  }
}
