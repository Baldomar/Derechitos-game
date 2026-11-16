import Phaser from 'phaser';
import type { MemoryActivity } from '@/config/rights';
import type { HintTarget } from '@/components/HelperHand';
import { MemoryCard } from '@/components/MemoryCard';
import { AudioManager } from '@/core/AudioManager';
import { BaseActivity } from './BaseActivity';

const W = 130;
const H = 160;

/** Motor "memorama": encontrar parejas iguales (mismo dibujo y mismo nombre). */
export default class MemoryGameScene extends BaseActivity<MemoryActivity> {
  protected readonly kind = 'memory' as const;
  private cards: MemoryCard[] = [];
  private first: MemoryCard | null = null;
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
      const card = new MemoryCard(this, x, y, it.id, {
        w: W,
        h: H,
        art: it.art,
        label: it.label,
        backColor: this.right.color,
        delay: i * 40,
      });
      card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => void this.tap(card));
      this.cards.push(card);
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private async tap(card: MemoryCard): Promise<void> {
    if (this.lock || card.up || card.matched) return;
    AudioManager.sfx('pop', { pitch: 1.2 });
    if (!this.first) {
      this.first = card;
      void card.flip(true);
      return;
    }
    const a = this.first;
    this.first = null;
    this.lock = true;
    await card.flip(true);
    if (!this.scene.isActive()) return;

    if (a.id === card.id) {
      a.matched = true;
      card.matched = true;
      this.matched += 1;
      a.celebrate();
      card.celebrate();
      const last = this.matched === this.activity.items.length;
      this.correct((a.x + card.x) / 2, Math.min(a.y, card.y) - 70, last ? null : undefined);
      this.lock = false;
      if (last) {
        const extra = Math.max(0, this.mismatches - this.activity.freeMismatches);
        this.errors = Math.ceil(extra / this.activity.mismatchesPerError);
        this.time.delayedCall(700, () => void this.complete(this.activity.done));
      }
      return;
    }
    this.mismatches += 1;
    if (this.mismatches % 3 === 0) void this.say(this.activity.tryAgain);
    this.time.delayedCall(800, () => {
      // Se desbloquea hasta que las dos cartas terminan de voltearse.
      void Promise.all([a.flip(false), card.flip(false)]).then(() => {
        this.lock = false;
      });
    });
  }

  protected override getHint(): HintTarget | null {
    if (this.lock) return null;
    if (this.first) {
      const first = this.first;
      const pair = this.cards.find((k) => k !== first && k.id === first.id && !k.matched);
      return pair ? { kind: 'tap', x: pair.x, y: pair.y } : null;
    }
    const next = this.cards.find((k) => !k.matched && !k.up);
    return next ? { kind: 'tap', x: next.x, y: next.y } : null;
  }
}
