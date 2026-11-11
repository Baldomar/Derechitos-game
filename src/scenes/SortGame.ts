import type Phaser from 'phaser';
import type { SortActivity } from '@/config/rights';
import { tex } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addBody, addTitle } from '@/components/Text';
import { BaseActivity, fitImage } from './BaseActivity';

const BIN_W = 380;
const BIN_H = 240;
const BIN_Y = 228;
const SLOTS = [
  { x: -135, y: 35 },
  { x: -45, y: 35 },
  { x: 45, y: 35 },
  { x: 135, y: 35 },
  { x: -90, y: 88 },
  { x: 0, y: 88 },
  { x: 90, y: 88 },
];

/**
 * Motor "clasificar": arrastrar cada cosa a su grupo (p. ej. carita feliz = sano / triste = no sano).
 * Lo incorrecto rebota con una pista amable.
 */
export default class SortGameScene extends BaseActivity<SortActivity> {
  protected readonly kind = 'sort' as const;
  private items: DraggableItem[] = [];
  private bins = new Map<string, DropZone>();
  private labels = new Map<string, Phaser.GameObjects.Text>();

  constructor() {
    super('SortGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.items = [];
    this.bins = new Map();
    this.labels = new Map();
  }

  protected override buildLevel(): void {
    const a = this.activity;
    const n = a.bins.length;
    a.bins.forEach((b, i) => {
      const x = 640 + (i - (n - 1) / 2) * 440;
      const zone = new DropZone(this, x, BIN_Y, {
        id: b.id,
        width: BIN_W,
        height: BIN_H,
        slots: SLOTS,
        tolerance: 20,
      });
      fitImage(this.add.image(x - 110, BIN_Y - 62, tex(b.art)), 110, 100);
      addTitle(this, x + 50, BIN_Y - 62, b.label, 40);
      this.bins.set(b.id, zone);
    });

    const zones = [...this.bins.values()];
    const count = a.items.length;
    a.items.forEach((def, i) => {
      const x = 640 + (i - (count - 1) / 2) * Math.min(125, 1000 / count);
      const img = fitImage(this.add.image(0, -10, tex(def.art)), 90, 80);
      const label = addBody(this, 0, 52, def.label, 17, { wrap: 118 });
      this.labels.set(def.id, label);
      const item = new DraggableItem(this, x, 432, {
        id: def.id,
        content: [img, label],
        width: 112,
        height: 130,
        zones,
        placedScale: 0.55,
        onDrop: (it, zone) => this.onDrop(it, zone, def),
      });
      item.setDepth(3);
      this.items.push(item);
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private onDrop(
    _item: DraggableItem,
    zone: DropZone | null,
    def: SortActivity['items'][number],
  ): DropDecision {
    if (!zone) return 'ignore';
    if (zone.zoneId !== def.bin) {
      this.mistake(def.hint);
      return 'reject';
    }
    this.labels.get(def.id)?.setVisible(false);
    const last = this.items.filter((i) => i.isPlaced).length + 1 === this.items.length;
    this.correct(zone.x, zone.y - 100, last ? null : undefined);
    if (last) this.time.delayedCall(600, () => void this.complete(this.activity.done));
    return 'accept';
  }

  protected override getHint(): HintTarget | null {
    const next = this.items.find((i) => !i.isPlaced);
    const def = next ? this.activity.items.find((d) => d.id === next.itemId) : undefined;
    const bin = def ? this.bins.get(def.bin) : undefined;
    return next && bin
      ? { kind: 'drag', from: { x: next.x, y: next.y }, to: { x: bin.x, y: bin.y } }
      : null;
  }
}
