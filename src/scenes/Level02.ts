import type Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { LunchboxContent } from '@/config/levels';
import { artImage, type ArtKey } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { motion } from '@/core/Device';
import { BaseLevel } from './BaseLevel';

const BOX = { x: 1030, y: 360 };

/**
 * Nivel 2 — Lonchera nutritiva (alimentación).
 * Llenar la lonchera con alimentos nutritivos; dulces, soda y papitas rebotan con una pista amable.
 */
export default class Level02Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'mango',
    'guineo',
    'frijoles',
    'leche',
    'verduras',
    'dulces',
    'soda',
    'papitas',
    'lonchera',
  ];
  private c!: LunchboxContent;
  private items: DraggableItem[] = [];
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private filled = 0;
  private goal = 0;

  constructor() {
    super('Level02');
  }

  override init(): void {
    super.init();
    this.items = [];
    this.labels = new Map();
    this.filled = 0;
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('lunchbox');
    this.goal = this.c.items.filter((i) => i.correct).length;

    // Puesto del mercado: toldo a rayas y mesa.
    const g = this.add.graphics();
    g.fillStyle(0xd9a86c).fillRoundedRect(40, 150, 720, 360, 24);
    g.lineStyle(5, COLORS.ink).strokeRoundedRect(40, 150, 720, 360, 24);
    for (let i = 0; i < 9; i++) {
      g.fillStyle(i % 2 ? COLORS.white : COLORS.coral).fillRect(40 + i * 80, 96, 80, 44);
      g.fillCircle(80 + i * 80, 140, 20);
    }
    g.lineStyle(5, COLORS.ink).strokeRect(40, 96, 720, 44);

    artImage(this, BOX.x, BOX.y, 'lonchera').setDepth(1);
    const zone = new DropZone(this, BOX.x, BOX.y + 10, {
      id: 'lonchera',
      width: 260,
      height: 180,
      showOutline: false,
      tolerance: 40,
      slots: [
        { x: -80, y: -10 },
        { x: 0, y: -14 },
        { x: 80, y: -10 },
        { x: -40, y: 40 },
        { x: 40, y: 40 },
      ],
    });

    this.c.items.forEach((def, i) => {
      const x = 130 + (i % 4) * 180;
      const y = i < 4 ? 240 : 410;
      const img = artImage(this, 0, -8, def.art);
      const label = addBody(this, 0, 62, def.label, 22);
      this.labels.set(def.id, label);
      const item = new DraggableItem(this, x, y, {
        id: def.id,
        content: [img, label],
        width: 120,
        height: 140,
        zones: [zone],
        onDrop: (it, z) => this.onDrop(it, z, def),
      });
      item.setDepth(2);
      this.items.push(item);
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private onDrop(
    item: DraggableItem,
    zone: DropZone | null,
    def: LunchboxContent['items'][number],
  ): DropDecision {
    if (!zone) return 'ignore';
    if (!def.correct) {
      if (def.hint) this.mistake(def.hint);
      return 'reject';
    }
    this.filled += 1;
    this.tweens.add({ targets: item, scale: 0.62, duration: motion(260) });
    // Dentro de la lonchera solo se ve el dibujo.
    this.labels.get(item.itemId)?.setVisible(false);
    const last = this.filled === this.goal;
    this.correct(zone.x, zone.y - 70, last ? null : undefined);
    if (last) this.time.delayedCall(600, () => void this.complete(this.c.done));
    return 'accept';
  }

  protected override getHint(): HintTarget | null {
    const next = this.items.find(
      (it) => !it.isPlaced && this.c.items.find((d) => d.id === it.itemId)?.correct,
    );
    return next ? { kind: 'drag', from: { x: next.x, y: next.y }, to: BOX } : null;
  }
}
