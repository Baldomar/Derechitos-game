import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { SchoolContent } from '@/config/levels';
import { tex, type ArtKey } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { motion } from '@/core/Device';
import { BaseLevel } from './BaseLevel';

const BOARD = { x: 860, y: 300, w: 480, h: 320 };
/** Imagen completa del salón: al recortarlo en piezas Phaser cambiaría el cuadro predeterminado. */
const FULL = '__BASE';

/**
 * Nivel 4 — Rompecabezas escolar (educación).
 * 1) Armar el salón (6 piezas). 2) El salón cobra vida. 3) Llevar cada útil escolar a su sombra.
 */
export default class Level04Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = ['salon', 'lapiz', 'cuaderno', 'tijeras', 'mochila'];
  private c!: SchoolContent;
  private stage: 'puzzle' | 'shadows' | 'done' = 'puzzle';
  private pieces: DraggableItem[] = [];
  private pieceZones = new Map<string, DropZone>();
  private tools: DraggableItem[] = [];
  private shadowZones = new Map<string, DropZone>();
  private placed = 0;
  private boardParts: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Level04');
  }

  override init(data?: unknown): void {
    super.init(data);
    this.stage = 'puzzle';
    this.pieces = [];
    this.pieceZones = new Map();
    this.tools = [];
    this.shadowZones = new Map();
    this.placed = 0;
    this.boardParts = [];
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('school');
    const { cols, rows } = this.c;
    const pw = BOARD.w / cols;
    const ph = BOARD.h / rows;

    // Marco del tablero y guía tenue de la imagen completa (ayuda a niños pequeños).
    const frame = this.add.graphics();
    frame
      .fillStyle(COLORS.ink, 0.2)
      .fillRoundedRect(
        BOARD.x - BOARD.w / 2 - 14,
        BOARD.y - BOARD.h / 2 - 6,
        BOARD.w + 28,
        BOARD.h + 28,
        18,
      );
    frame
      .fillStyle(0x9a6b3f)
      .fillRoundedRect(
        BOARD.x - BOARD.w / 2 - 14,
        BOARD.y - BOARD.h / 2 - 14,
        BOARD.w + 28,
        BOARD.h + 28,
        18,
      );
    frame
      .lineStyle(5, COLORS.ink)
      .strokeRoundedRect(
        BOARD.x - BOARD.w / 2 - 14,
        BOARD.y - BOARD.h / 2 - 14,
        BOARD.w + 28,
        BOARD.h + 28,
        18,
      );
    const guide = this.add.image(BOARD.x, BOARD.y, tex('salon'), FULL).setAlpha(0.18);
    this.boardParts.push(frame, guide);

    // Cortar la textura en piezas (frames) una sola vez.
    const texture = this.textures.get(tex('salon'));
    const homes: { x: number; y: number }[] = [];
    for (let i = 0; i < cols * rows; i++)
      homes.push({ x: 160 + (i % 2) * 175, y: 175 + Math.floor(i / 2) * 140 });
    Phaser.Utils.Array.Shuffle(homes);

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const id = `p${r}${col}`;
        if (!texture.has(id)) texture.add(id, 0, col * pw, r * ph, pw, ph);
        const zx = BOARD.x - BOARD.w / 2 + pw * (col + 0.5);
        const zy = BOARD.y - BOARD.h / 2 + ph * (r + 0.5);
        const zone = new DropZone(this, zx, zy, { id, width: pw, height: ph, tolerance: 18 });
        zone.setAlpha(0.6);
        this.pieceZones.set(id, zone);
      }
    }
    let i = 0;
    for (const [id, own] of this.pieceZones) {
      const home = homes[i++] ?? { x: 200, y: 200 };
      const piece = this.add.image(0, 0, tex('salon'), id);
      const border = this.add.graphics();
      border.lineStyle(4, COLORS.ink).strokeRect(-pw / 2, -ph / 2, pw, ph);
      const others = [...this.pieceZones.values()].filter((z) => z !== own);
      const item = new DraggableItem(this, home.x, home.y, {
        id,
        content: [piece, border],
        width: pw,
        height: ph,
        zones: [own, ...others],
        onDrop: (it, zone) => this.onPieceDrop(it, zone),
        placedScale: 1,
        growOnDrag: true,
      });
      item.setScale(0.72).setDepth(3);
      this.pieces.push(item);
    }
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private onPieceDrop(item: DraggableItem, zone: DropZone | null): DropDecision {
    if (!zone) return 'ignore';
    if (zone.zoneId !== item.itemId) {
      this.mistake(this.c.pieceHint);
      return 'reject';
    }
    this.time.delayedCall(10, () => item.setDepth(1));
    zone.setVisible(false);
    this.placed += 1;
    const last = this.placed === this.pieces.length;
    this.correct(zone.x, zone.y - 60, last ? null : undefined);
    if (last) this.time.delayedCall(600, () => void this.comeAlive());
    return 'accept';
  }

  /** El salón "cobra vida" y pasa a la actividad de sombras. */
  private async comeAlive(): Promise<void> {
    this.stage = 'shadows';
    this.pieces.forEach((p) => p.destroy());
    this.pieceZones.forEach((z) => z.destroy());
    this.boardParts.forEach((p) => p.destroy());
    const board = this.add.container(BOARD.x, BOARD.y);
    const frame = this.add.graphics();
    frame
      .fillStyle(0x9a6b3f)
      .fillRoundedRect(-BOARD.w / 2 - 14, -BOARD.h / 2 - 14, BOARD.w + 28, BOARD.h + 28, 18);
    frame
      .lineStyle(5, COLORS.ink)
      .strokeRoundedRect(-BOARD.w / 2 - 14, -BOARD.h / 2 - 14, BOARD.w + 28, BOARD.h + 28, 18);
    const pic = this.add.image(0, 0, tex('salon'), FULL);
    // Detalles animados: el sol de la ventana brilla y la pizarra destella.
    const glow = this.add.circle(BOARD.w / 2 - 70, -BOARD.h / 2 + 60, 26, COLORS.sun, 0.6);
    board.add([frame, pic, glow]);
    this.tweens.add({ targets: glow, scale: 1.6, alpha: 0, duration: 900, repeat: -1 });
    this.tweens.add({
      targets: board,
      scale: { from: 1, to: 1.06 },
      duration: motion(260),
      yoyo: true,
      repeat: 1,
    });
    for (let k = 0; k < 5; k++) {
      this.time.delayedCall(k * 180, () =>
        this.effects.sparkleAt(BOARD.x - 200 + k * 100, BOARD.y - 80 + (k % 2) * 120, 10),
      );
    }
    this.tori.setMood('celebrate');
    await this.wait(900);
    if (!this.alive) return;
    this.tweens.add({
      targets: board,
      x: 330,
      y: 250,
      scale: 0.6,
      duration: motion(700),
      ease: 'Cubic.easeInOut',
    });
    await this.wait(motion(750));
    if (!this.alive) return;
    this.buildShadows();
    await this.instruct(this.c.alive);
  }

  private buildShadows(): void {
    const tools = this.c.tools;
    tools.forEach((t, i) => {
      const x = 700 + i * 150;
      this.add.image(x, 220, tex(t.art)).setTintFill(COLORS.ink).setAlpha(0.35);
      this.shadowZones.set(
        t.id,
        new DropZone(this, x, 220, {
          id: t.id,
          width: 130,
          height: 130,
          showOutline: false,
          tolerance: 22,
        }),
      );
    });
    const order = Phaser.Utils.Array.Shuffle([...tools]);
    order.forEach((t, i) => {
      const own = this.shadowZones.get(t.id);
      if (!own) return;
      const others = [...this.shadowZones.values()].filter((z) => z !== own);
      const img = this.add.image(0, -6, tex(t.art));
      const label = addBody(this, 0, 62, t.label, 22);
      const item = new DraggableItem(this, 640 + i * 160, 430, {
        id: t.id,
        content: [img, label],
        width: 130,
        height: 140,
        zones: [own, ...others],
        onDrop: (it, zone) => this.onToolDrop(it, zone, label),
      });
      item.setDepth(3).setScale(0);
      this.tweens.add({
        targets: item,
        scale: 1,
        duration: motion(350),
        delay: 300 + i * 120,
        ease: 'Back.easeOut',
      });
      this.tools.push(item);
    });
  }

  private onToolDrop(
    item: DraggableItem,
    zone: DropZone | null,
    label: Phaser.GameObjects.Text,
  ): DropDecision {
    if (!zone) return 'ignore';
    if (zone.zoneId !== item.itemId) {
      this.mistake(this.c.shadowHint);
      return 'reject';
    }
    label.setVisible(false);
    const done = this.tools.filter((t) => t.isPlaced).length + 1 === this.tools.length;
    this.correct(zone.x, zone.y - 70, done ? null : undefined);
    if (done) {
      this.stage = 'done';
      this.time.delayedCall(600, () => void this.complete(this.c.done));
    }
    return 'accept';
  }

  protected override getHint(): HintTarget | null {
    if (this.stage === 'puzzle') {
      const next = this.pieces.find((p) => !p.isPlaced);
      const zone = next ? this.pieceZones.get(next.itemId) : undefined;
      return next && zone
        ? { kind: 'drag', from: { x: next.x, y: next.y }, to: { x: zone.x, y: zone.y } }
        : null;
    }
    if (this.stage === 'shadows') {
      const next = this.tools.find((t) => !t.isPlaced);
      const zone = next ? this.shadowZones.get(next.itemId) : undefined;
      return next && zone
        ? { kind: 'drag', from: { x: next.x, y: next.y }, to: { x: zone.x, y: zone.y } }
        : null;
    }
    return null;
  }
}
