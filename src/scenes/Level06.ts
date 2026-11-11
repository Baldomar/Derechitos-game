import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import type { DayNightContent } from '@/config/levels';
import { artImage, type ArtKey } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { addBody } from '@/components/Text';
import { motion } from '@/core/Device';
import { BaseLevel } from './BaseLevel';
import { setPageBackground } from '@/core/PageBackground';

const DAY = { x: 330, y: 250 };
const NIGHT = { x: 950, y: 250 };

/**
 * Nivel 6 — Día y noche (jugar y descansar).
 * El cielo pasa de día a noche y se divide: llevar cada objeto con el sol (jugar) o con la luna (descansar).
 */
export default class Level06Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'sol',
    'luna-grande',
    'pelota',
    'papalote',
    'trompo',
    'camita',
    'pijama',
    'cuento',
  ];
  private c!: DayNightContent;
  private night!: Phaser.GameObjects.Rectangle;
  private sun!: Phaser.GameObjects.Image;
  private moon!: Phaser.GameObjects.Image;
  private zones = new Map<'day' | 'night', DropZone>();
  private items: DraggableItem[] = [];
  private ready = false;

  constructor() {
    super('Level06');
  }

  override init(data?: unknown): void {
    super.init(data);
    this.zones = new Map();
    this.items = [];
    this.ready = false;
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('daynight');
    this.night = this.add
      .rectangle(-4000, -4000, GAME_WIDTH + 8000, GAME_HEIGHT + 8000, 0x1b1f4a, 0)
      .setOrigin(0)
      .setDepth(0.5);
    this.sun = artImage(this, 640, 200, 'sol').setDepth(1);
    this.moon = artImage(this, 640, 820, 'luna-grande').setDepth(1);
    this.tweens.add({ targets: this.sun, angle: 360, duration: 24000, repeat: -1 });

    this.c.items.forEach((def, i) => {
      const img = artImage(this, 0, -8, def.art);
      img.setScale(Math.min(0.85, 100 / img.height));
      const label = addBody(this, 0, 54, def.label, 22, { stroke: '#FFFFFF', strokeThickness: 5 });
      const item = new DraggableItem(this, 360 + i * 140, 465, {
        id: def.id,
        content: [img, label],
        width: 120,
        height: 130,
        zones: [],
        onDrop: (it, zone) => this.onDrop(it, zone, def),
        placedScale: 0.85,
      });
      item.setDepth(3).setLocked(true).setAlpha(0.5);
      this.items.push(item);
    });
  }

  protected override async onIntroDone(): Promise<void> {
    await this.say(this.c.sky);
    if (!this.alive) return;
    // Atardece: el sol baja, llega la noche y sale la luna.
    this.tweens.add({ targets: this.sun, y: 760, duration: motion(1500), ease: 'Sine.easeIn' });
    this.tweens.add({ targets: this.night, fillAlpha: 0.82, duration: motion(1500) });
    await this.wait(motion(1300));
    this.tweens.add({ targets: this.moon, y: 220, duration: motion(1200), ease: 'Sine.easeOut' });
    await this.wait(motion(1700));
    if (!this.alive) return;
    // Se divide el cielo: día a la izquierda, noche a la derecha.
    // Borde derecho de noche (mismo tono que el cielo oscurecido).
    setPageBackground(
      this,
      { top: COLORS.sky, bottom: COLORS.grass, split: 630 },
      { top: 0x33406a, bottom: 0x2c4f3a, split: 630 },
    );
    this.tweens.add({
      targets: this.night,
      x: GAME_WIDTH / 2, // el borde izquierdo de la noche llega al centro
      duration: motion(900),
      ease: 'Cubic.easeInOut',
    });
    this.sun.setPosition(DAY.x, -120);
    this.tweens.add({
      targets: this.sun,
      y: DAY.y - 30,
      duration: motion(900),
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: this.moon,
      x: NIGHT.x,
      y: NIGHT.y - 30,
      duration: motion(900),
      ease: 'Cubic.easeInOut',
    });
    for (let i = 0; i < 9; i++) {
      const s = addStarIcon(this, 700 + ((i * 137) % 540), 110 + ((i * 71) % 260), 9, true)
        .setDepth(0.8)
        .setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, delay: 600 + i * 80, duration: 300 });
      this.tweens.add({
        targets: s,
        scale: 0.6,
        duration: 700 + i * 50,
        yoyo: true,
        repeat: -1,
        delay: 900,
      });
    }
    await this.wait(motion(900));
    if (!this.alive) return;

    const slots = [
      { x: -170, y: 90 },
      { x: 0, y: 110 },
      { x: 170, y: 90 },
    ];
    this.zones.set(
      'day',
      new DropZone(this, DAY.x, DAY.y, {
        id: 'day',
        width: 540,
        height: 300,
        slots,
        tolerance: 10,
      }).setDepth(0.9),
    );
    this.zones.set(
      'night',
      new DropZone(this, NIGHT.x, NIGHT.y, {
        id: 'night',
        width: 540,
        height: 300,
        slots,
        tolerance: 10,
      }).setDepth(0.9),
    );
    const zones = [...this.zones.values()];
    this.items.forEach((it) => {
      it.setZones(zones);
      it.setLocked(false).setAlpha(1);
    });
    this.ready = true;
    this.enableIdleHint();
    await this.instruct(this.c.task);
  }

  private onDrop(
    _item: DraggableItem,
    zone: DropZone | null,
    def: DayNightContent['items'][number],
  ): DropDecision {
    if (!zone || !this.ready) return 'ignore';
    if (zone.zoneId !== def.time) {
      this.mistake(def.hint);
      return 'reject';
    }
    const last = this.items.filter((i) => i.isPlaced).length + 1 === this.items.length;
    this.correct(zone.x, zone.y - 60, last ? null : undefined);
    if (last) this.time.delayedCall(600, () => void this.complete(this.c.done));
    return 'accept';
  }

  protected override getHint(): HintTarget | null {
    if (!this.ready) return null;
    const next = this.items.find((i) => !i.isPlaced);
    const def = next ? this.c.items.find((d) => d.id === next.itemId) : undefined;
    const zone = def ? this.zones.get(def.time) : undefined;
    return next && zone
      ? { kind: 'drag', from: { x: next.x, y: next.y }, to: { x: zone.x, y: zone.y } }
      : null;
  }
}
