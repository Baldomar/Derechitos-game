import Phaser from 'phaser';
import { COLORS, DEPTH } from '@/config/theme';
import type { SortActivity } from '@/config/rights';
import { tex } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
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
 * Modo "plato" (pensado para niños de ~7 años): a la izquierda un plato con un niño feliz y
 * una gran ✓ (comida sana); a la derecha una caja roja con una gran ✗ y un niño con dolor de
 * panza (comida no sana). La relación comida → cómo me siento se entiende sin leer.
 */
const FOOD_Y = 232;
const PLATE_R = 104;
const PLATE_SLOTS = [
  { x: 0, y: -10 },
  { x: -52, y: -38 },
  { x: 52, y: -38 },
  { x: -56, y: 22 },
  { x: 56, y: 22 },
  { x: 0, y: -62 },
  { x: 0, y: 46 },
];
const BOX_W = 200;
const BOX_H = 150;
const BOX_SLOTS = [
  { x: -50, y: -50 },
  { x: 50, y: -50 },
  { x: 0, y: -58 },
  { x: -52, y: -10 },
  { x: 52, y: -10 },
  { x: 0, y: -16 },
];
const INK = COLORS.ink;

/** Modo "tarjetas con sombras": dos tarjetas arriba y la repisa de madera abajo. */
const CARD_W = 540;
const CARD_H = 300;
const CARD_Y = 250;
const CARD_X = [356, 924];
const SLOT = 102;
const SHELF_Y = 508;
const SHELF_H = 172;
const ITEM_W = 128;
const ITEM_H = 140;
const CARD_LOOK = [
  { fill: 0xe3f7e5, top: 0xd2f1d6, edge: 0x3aa655, ok: true },
  { fill: 0xffe6df, top: 0xffd6cc, edge: 0xf06a5a, ok: false },
] as const;

/** Rectángulo redondeado punteado (la "cajita" donde va cada sombra). */
function dashedRoundRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: number,
): void {
  const pts: { x: number; y: number }[] = [];
  const corner = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  pts.push(pts[0] ?? { x, y });
  const dash = 9;
  const gap = 7;
  g.lineStyle(3, color, 1);
  let on = true;
  let left = dash;
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i] ?? { x, y };
    const b = pts[i + 1] ?? a;
    let seg = Math.hypot(b.x - a.x, b.y - a.y);
    while (seg > 0) {
      const step = Math.min(seg, left);
      const t = step / seg;
      const nx = a.x + (b.x - a.x) * t;
      const ny = a.y + (b.y - a.y) * t;
      if (on) g.lineBetween(a.x, a.y, nx, ny);
      a = { x: nx, y: ny };
      seg -= step;
      left -= step;
      if (left <= 0) {
        on = !on;
        left = on ? dash : gap;
      }
    }
  }
}

/** Círculo amarillo con el número del paso (1 = toca un dibujo, 2 = llévalo a su caja). */
function stepBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  n: number,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.15).fillCircle(2, 4, 22);
  g.fillStyle(COLORS.sun).fillCircle(0, 0, 22);
  g.lineStyle(4, INK).strokeCircle(0, 0, 22);
  const t = addTitle(scene, 0, 2, String(n), 26);
  return scene.add.container(x, y, [g, t]).setDepth(6);
}

interface CardSlot {
  zone: DropZone;
  shadow: Phaser.GameObjects.Image;
  frame: Phaser.GameObjects.Graphics;
  bin: number;
}

type Bin = SortActivity['bins'][number];

/**
 * Motor "clasificar": arrastrar cada cosa a su grupo (p. ej. carita feliz = sano / triste = no sano).
 * Lo incorrecto rebota con una pista amable.
 */
export default class SortGameScene extends BaseActivity<SortActivity> {
  protected readonly kind = 'sort' as const;
  private items: DraggableItem[] = [];
  private bins = new Map<string, DropZone>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private kids = new Map<string, Phaser.GameObjects.Image>();
  // Modo tarjetas
  private cardSlots = new Map<string, CardSlot>();
  private cardBgs = new Map<string, Phaser.GameObjects.Graphics>();
  private selected: DraggableItem | null = null;
  private stepBadges: Phaser.GameObjects.Container[] = [];
  private score!: Phaser.GameObjects.Text;

  constructor() {
    super('SortGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.items = [];
    this.bins = new Map();
    this.labels = new Map();
    this.kids = new Map();
    this.cardSlots = new Map();
    this.cardBgs = new Map();
    this.selected = null;
    this.stepBadges = [];
  }

  /** En el modo tarjetas el título va en su propio botón turquesa (lo dibuja la escena). */
  protected override headerTitle(): string {
    return this.activity.look === 'cards' ? '' : super.headerTitle();
  }

  protected override buildLevel(): void {
    const [good, bad] = this.activity.bins;
    if (this.activity.look === 'cards') {
      this.buildCardsLook();
      return;
    }
    if (this.activity.look === 'plate' && good && bad) {
      this.buildPlate(good, 400);
      this.buildJunkBox(bad, 880);
    } else {
      this.buildBoxes();
    }
    this.buildItems();
  }

  private buildBoxes(): void {
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
  }

  /** Plato verde con ✓ y, al lado, un niño feliz y fuerte. */
  private buildPlate(b: Bin, x: number): void {
    const px = x + 40;
    const kid = fitImage(this.add.image(x - 150, FOOD_Y + 6, tex('nino-sano')), 130, 136);
    this.kids.set(b.id, kid);

    const zone = new DropZone(this, px, FOOD_Y, {
      id: b.id,
      width: PLATE_R * 2 + 20,
      height: PLATE_R * 2 + 20,
      shape: 'circle',
      slots: PLATE_SLOTS,
      tolerance: 44,
    });
    // El plato va dentro de la zona para crecer con ella al pasar comida encima.
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.12).fillCircle(5, 10, PLATE_R);
    g.fillStyle(COLORS.grass, 1).fillCircle(0, 0, PLATE_R);
    g.lineStyle(4, INK, 1).strokeCircle(0, 0, PLATE_R);
    g.fillStyle(COLORS.white, 1).fillCircle(0, 0, PLATE_R - 16);
    g.lineStyle(3, INK, 0.3).strokeCircle(0, 0, PLATE_R - 16);
    g.fillStyle(COLORS.cream, 1).fillCircle(0, 0, PLATE_R - 32);
    g.fillStyle(COLORS.white, 0.8).fillEllipse(-42, -54, 30, 12);
    zone.add(g);
    this.bins.set(b.id, zone);

    this.drawMark(px + PLATE_R - 12, FOOD_Y - PLATE_R + 12, true);
    this.drawRibbon(px, FOOD_Y + PLATE_R + 8, b, COLORS.grass);
  }

  /** Caja roja abierta con ✗ y, al lado, un niño con dolor de panza. */
  private buildJunkBox(b: Bin, x: number): void {
    const bx = x - 40;
    const kid = fitImage(this.add.image(x + 150, FOOD_Y + 6, tex('nino-enfermo')), 130, 136);
    this.kids.set(b.id, kid);

    const zone = new DropZone(this, bx, FOOD_Y, {
      id: b.id,
      width: BOX_W + 30,
      height: BOX_H + 70,
      slots: BOX_SLOTS,
      tolerance: 34,
    });
    const g = this.add.graphics();
    const w = BOX_W;
    const top = -BOX_H / 2 + 14;
    const flapL = [
      { x: -w / 2, y: top },
      { x: -w / 2 - 26, y: top - 34 },
      { x: -w / 2 + 50, y: top - 34 },
      { x: -w / 2 + 70, y: top },
    ];
    const flapR = flapL.map((p) => ({ x: -p.x, y: p.y }));
    g.fillStyle(0x000000, 0.12).fillRoundedRect(-w / 2 + 6, top + 10, w, BOX_H - 10, 14);
    g.lineStyle(4, INK, 1);
    for (const flap of [flapL, flapR]) {
      g.fillStyle(0xe85a5a, 1).fillPoints(flap, true);
      g.strokePoints(flap, true);
    }
    g.fillStyle(COLORS.coral, 1).fillRoundedRect(-w / 2, top, w, BOX_H - 14, 14);
    g.strokeRoundedRect(-w / 2, top, w, BOX_H - 14, 14);
    g.fillStyle(COLORS.white, 0.25).fillRoundedRect(-w / 2 + 12, top + 10, 22, BOX_H - 40, 10);
    zone.add(g);
    this.bins.set(b.id, zone);

    this.drawMark(bx, FOOD_Y + 40, false);
    this.drawRibbon(bx, FOOD_Y + PLATE_R + 8, b, COLORS.coral);
  }

  // ================================================================ modo tarjetas

  private buildCardsLook(): void {
    this.buildHeaderPill();
    this.activity.bins.forEach((b, i) => this.buildCard(b, i));
    this.buildShelf();
    this.buildShelfItems();
    this.updateSteps();
  }

  /** Título en botón turquesa con cruz de salud y, a la derecha, el contador de estrellas. */
  private buildHeaderPill(): void {
    const title = addTitle(this, 0, 0, this.activity.title, 34, { color: '#FFFFFF' });
    const w = title.width + 130;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(-w / 2, -30, w, 68, 22);
    g.fillStyle(0x1fa9a4).fillRoundedRect(-w / 2, -34, w, 68, 22);
    g.fillStyle(COLORS.turquoise).fillRoundedRect(-w / 2, -34, w, 58, 22);
    g.fillStyle(COLORS.white, 0.22).fillRoundedRect(-w / 2 + 16, -28, w - 32, 14, 7);
    g.lineStyle(4, INK).strokeRoundedRect(-w / 2, -34, w, 68, 22);
    const ix = -w / 2 + 46;
    g.fillStyle(COLORS.white).fillCircle(ix, 0, 20);
    g.lineStyle(3, INK).strokeCircle(ix, 0, 20);
    g.fillStyle(0xe23b3b)
      .fillRoundedRect(ix - 4, -12, 8, 24, 2)
      .fillRoundedRect(ix - 12, -4, 24, 8, 2);
    title.setPosition(22, -2);
    this.add.container(640, 48, [g, title]).setDepth(DEPTH.ui);

    // Contador: ★ 0/8
    const sg = this.add.graphics();
    sg.fillStyle(0x000000, 0.15).fillRoundedRect(-78, -26, 156, 60, 18);
    sg.fillStyle(COLORS.white).fillRoundedRect(-78, -30, 156, 60, 18);
    sg.lineStyle(4, INK).strokeRoundedRect(-78, -30, 156, 60, 18);
    const starPts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 17 : 7.5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      starPts.push(-40 + Math.cos(a) * r, 1 + Math.sin(a) * r);
    }
    const sp = [];
    for (let i = 0; i < starPts.length; i += 2)
      sp.push({ x: starPts[i] ?? 0, y: starPts[i + 1] ?? 0 });
    sg.fillStyle(COLORS.sun).fillPoints(sp, true);
    sg.lineStyle(3, INK).strokePoints(sp, true, true);
    this.score = addTitle(this, 14, 2, '', 28);
    this.add.container(1170, 50, [sg, this.score]).setDepth(DEPTH.ui);
    this.updateScore();
  }

  private updateScore(): void {
    const placed = this.items.filter((i) => i.isPlaced).length;
    this.score.setText(`${placed}/${this.activity.items.length}`);
  }

  /** Tarjeta grande: mascota, nombre, frase, ✓ / ✗ y una cajita punteada por cada sombra. */
  private buildCard(b: Bin, i: number): void {
    const look = CARD_LOOK[i % 2] ?? CARD_LOOK[0];
    const x = CARD_X[i] ?? 640;
    const zone = new DropZone(this, x, CARD_Y, {
      id: b.id,
      width: CARD_W,
      height: CARD_H,
      showOutline: false,
      tolerance: 16,
    });
    const g = this.add.graphics();
    const w = CARD_W;
    const h = CARD_H;
    g.fillStyle(0x000000, 0.15).fillRoundedRect(-w / 2 + 4, -h / 2 + 8, w, h, 26);
    g.fillStyle(look.fill).fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    g.fillStyle(look.top).fillRoundedRect(-w / 2 + 10, -h / 2 + 10, w - 20, 118, 20);
    g.lineStyle(4, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
    g.lineStyle(3, look.edge, 0.6).strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 21);
    zone.add(g);
    this.cardBgs.set(b.id, g);

    const mascot = fitImage(this.add.image(-w / 2 + 92, -h / 2 + 68, tex(b.art)), 132, 104, 2);
    const name = addTitle(this, -w / 2 + 172, -h / 2 + 52, b.label, 40).setOrigin(0, 0.5);
    const note = addBody(this, -w / 2 + 174, -h / 2 + 92, b.note ?? '', 18, {
      color: '#5B5878',
    }).setOrigin(0, 0.5);
    // ✓ verde o ✗ roja.
    const mk = this.add.graphics({ x: w / 2 - 56, y: -h / 2 + 62 });
    mk.fillStyle(look.ok ? 0x3aa655 : 0xf06a5a).fillCircle(0, 0, 27);
    mk.lineStyle(4, INK).strokeCircle(0, 0, 27);
    mk.lineStyle(7, COLORS.white);
    if (look.ok) mk.beginPath().moveTo(-11, 1).lineTo(-3, 10).lineTo(12, -9).strokePath();
    else mk.lineBetween(-9, -9, 9, 9).lineBetween(9, -9, -9, 9);
    zone.add([mascot, name, note, mk]);

    // Cajitas con la sombra (silueta) de lo que va en esta tarjeta.
    const mine = this.activity.items.filter((it) => it.bin === b.id);
    const gapX = Math.min(SLOT + 18, (w - 60) / Math.max(1, mine.length));
    mine.forEach((it, k) => {
      const sx = x + (k - (mine.length - 1) / 2) * gapX;
      const sy = CARD_Y + 62;
      const frame = this.add.graphics({ x: sx - x, y: sy - CARD_Y });
      frame.fillStyle(COLORS.white, 0.55).fillRoundedRect(-SLOT / 2, -SLOT / 2, SLOT, SLOT, 18);
      dashedRoundRect(frame, -SLOT / 2, -SLOT / 2, SLOT, SLOT, 18, 0xb9c3cf);
      const shadow = fitImage(
        this.add.image(sx - x, sy - CARD_Y, tex(it.art)),
        SLOT - 26,
        SLOT - 26,
        1,
      )
        .setTintFill(0xc4ccd6)
        .setAlpha(0.85);
      zone.add([frame, shadow]);
      const slotZone = new DropZone(this, sx, sy, {
        id: `${b.id}:${it.id}`,
        width: SLOT,
        height: SLOT,
        showOutline: false,
      });
      this.cardSlots.set(it.id, { zone: slotZone, shadow, frame, bin: i });
    });

    // Paso 2: tocar la tarjeta (después de elegir un dibujo).
    zone.setSize(w, h).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tapCard(zone));
    this.bins.set(b.id, zone);
    this.stepBadges.push(stepBadge(this, x - w / 2 + 8, CARD_Y - h / 2 + 4, 2));
  }

  /** Repisa de madera donde esperan los dibujos. */
  private buildShelf(): void {
    const w = 1220;
    const h = SHELF_H;
    const g = this.add.graphics({ x: 640, y: SHELF_Y });
    g.fillStyle(0x000000, 0.18).fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, 24);
    g.fillStyle(0x9a6b3f).fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    g.fillStyle(0xc68d55).fillRoundedRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 16);
    // Vetas de la madera.
    g.lineStyle(2, 0xa9733f, 0.55);
    for (let k = 0; k < 7; k++) {
      const yy = -h / 2 + 30 + k * 19;
      g.beginPath();
      g.moveTo(-w / 2 + 24, yy);
      for (let xx = -w / 2 + 24; xx <= w / 2 - 24; xx += 40) {
        g.lineTo(xx, yy + Math.sin(xx / 70 + k) * 3);
      }
      g.strokePath();
    }
    g.fillStyle(0x7d5430).fillRect(-w / 2 + 14, h / 2 - 30, w - 28, 16);
    g.lineStyle(4, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    g.lineStyle(3, INK, 0.5).strokeRoundedRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 16);

    // Paso 1 con su etiqueta.
    const tag = addBody(this, 0, 0, 'Toca un dibujo', 17);
    const tw = tag.width + 28;
    const tg = this.add.graphics();
    tg.fillStyle(COLORS.white).fillRoundedRect(-tw / 2, -17, tw, 34, 17);
    tg.lineStyle(3, INK).strokeRoundedRect(-tw / 2, -17, tw, 34, 17);
    this.add.container(-w / 2 + 640 + 46 + tw / 2 + 6, SHELF_Y - h / 2 - 2, [tg, tag]).setDepth(6);
    this.stepBadges.unshift(stepBadge(this, 640 - w / 2 + 20, SHELF_Y - h / 2 - 2, 1));
  }

  private buildShelfItems(): void {
    const a = this.activity;
    const zones = [...this.bins.values()];
    const count = a.items.length;
    const gap = Math.min(150, 1160 / count);
    a.items.forEach((def, i) => {
      const x = 640 + (i - (count - 1) / 2) * gap;
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.18).fillRoundedRect(
        -ITEM_W / 2 + 2,
        -ITEM_H / 2 + 6,
        ITEM_W,
        ITEM_H,
        18,
      );
      bg.fillStyle(COLORS.white).fillRoundedRect(-ITEM_W / 2, -ITEM_H / 2, ITEM_W, ITEM_H, 18);
      bg.lineStyle(4, INK).strokeRoundedRect(-ITEM_W / 2, -ITEM_H / 2, ITEM_W, ITEM_H, 18);
      const ring = this.add.graphics().setVisible(false);
      ring
        .lineStyle(6, COLORS.sun)
        .strokeRoundedRect(-ITEM_W / 2 - 7, -ITEM_H / 2 - 7, ITEM_W + 14, ITEM_H + 14, 22);
      const img = fitImage(this.add.image(0, -18, tex(def.art)), 86, 74);
      const label = addBody(this, 0, 42, def.label, 15, { wrap: ITEM_W - 14 });
      this.labels.set(def.id, label);
      const item = new DraggableItem(this, x, SHELF_Y - 2, {
        id: def.id,
        content: [ring, bg, img, label],
        width: ITEM_W,
        height: ITEM_H,
        zones,
        placedScale: 0.78,
        onDrop: (it, zone) => this.onCardDrop(it, zone, def),
      });
      item
        .setData('ring', ring)
        .setData('bg', bg)
        .setData('img', img)
        .setData('homeY', SHELF_Y - 2);
      item.setDepth(7);
      this.items.push(item);
    });
  }

  /** Marca qué paso toca ahora: sin dibujo elegido late el 1; con dibujo elegido, los 2. */
  private updateSteps(): void {
    const active = this.selected ? this.stepBadges.slice(1) : this.stepBadges.slice(0, 1);
    for (const b of this.stepBadges) {
      this.tweens.killTweensOf(b);
      b.setScale(1);
      if (active.includes(b)) {
        this.tweens.add({
          targets: b,
          scale: 1.18,
          duration: 450,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
    for (const [id, g] of this.cardBgs) {
      const zone = this.bins.get(id);
      if (!zone) continue;
      this.tweens.killTweensOf(zone);
      zone.setScale(1);
      g.setAlpha(1);
      if (this.selected) {
        this.tweens.add({
          targets: zone,
          scale: 1.02,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  private select(item: DraggableItem | null): void {
    const prev = this.selected;
    if (prev && prev !== item) {
      (prev.getData('ring') as Phaser.GameObjects.Graphics).setVisible(false);
      const hy = prev.getData('homeY') as number;
      prev.setHome(prev.homePosition.x, hy);
      if (!prev.isPlaced) this.tweens.add({ targets: prev, y: hy, duration: 160 });
    }
    this.selected = item;
    if (item) {
      (item.getData('ring') as Phaser.GameObjects.Graphics).setVisible(true);
      // Se levanta un poquito: "este es el que elegí".
      item.setHome(item.homePosition.x, (item.getData('homeY') as number) - 14);
    }
    this.updateSteps();
  }

  /** Arrastrar o tocar: un toque (sin moverlo) elige el dibujo. */
  private onCardDrop(
    item: DraggableItem,
    zone: DropZone | null,
    def: SortActivity['items'][number],
  ): DropDecision {
    if (!zone) {
      const home = item.homePosition;
      const tapped = Math.hypot(item.x - home.x, item.y - home.y) < 24;
      if (tapped) {
        AudioManager.sfx('pop', { pitch: 1.5 });
        this.select(this.selected === item ? null : item);
      }
      return 'ignore';
    }
    return this.judge(item, zone, def);
  }

  /** Paso 2 por toque: con un dibujo elegido, tocar una tarjeta lo manda ahí. */
  private tapCard(zone: DropZone): void {
    const item = this.selected;
    if (!item || item.isPlaced) {
      if (!item)
        void this.say({ id: 'salud_sort_paso1', text: 'Primero toca un dibujo de la repisa.' });
      return;
    }
    const def = this.activity.items.find((d) => d.id === item.itemId);
    if (!def) return;
    const decision = this.judge(item, zone, def);
    if (typeof decision === 'object') item.placeIn(decision.placeIn);
    else item.bounceHome();
  }

  private judge(
    item: DraggableItem,
    zone: DropZone,
    def: SortActivity['items'][number],
  ): DropDecision {
    if (zone.zoneId !== def.bin) {
      this.mistake(def.hint);
      this.select(null);
      return 'reject';
    }
    const slot = this.cardSlots.get(def.id);
    if (!slot) return 'reject';
    if (this.selected === item) this.select(null);
    (item.getData('ring') as Phaser.GameObjects.Graphics).setVisible(false);
    // Al llegar a su sombra: se va la tarjetita blanca y la cajita se pinta de color.
    const bg = item.getData('bg') as Phaser.GameObjects.Graphics;
    const label = this.labels.get(def.id);
    this.tweens.add({ targets: [bg, label], alpha: 0, duration: motion(200) });
    this.tweens.add({ targets: slot.shadow, alpha: 0, duration: motion(200) });
    // El dibujo queda centrado en su cajita (ya no hay nombre debajo).
    const img = item.getData('img') as Phaser.GameObjects.Image;
    this.tweens.add({ targets: img, y: 0, duration: motion(260), ease: 'Back.easeOut' });
    const look = CARD_LOOK[slot.bin % 2] ?? CARD_LOOK[0];
    slot.frame
      .clear()
      .fillStyle(COLORS.white, 1)
      .fillRoundedRect(-SLOT / 2, -SLOT / 2, SLOT, SLOT, 18)
      .lineStyle(4, look.edge, 1)
      .strokeRoundedRect(-SLOT / 2, -SLOT / 2, SLOT, SLOT, 18);
    item.setDepth(3);
    const last = this.items.filter((i) => i.isPlaced).length + 1 === this.items.length;
    this.time.delayedCall(10, () => this.updateScore());
    this.correct(slot.zone.x, slot.zone.y - 40, last ? null : undefined);
    if (last) this.time.delayedCall(700, () => void this.complete(this.activity.done));
    return { placeIn: slot.zone };
  }

  /** Gran ✓ verde o ✗ roja en un círculo blanco: se entiende sin saber leer. */
  private drawMark(x: number, y: number, ok: boolean): void {
    const g = this.add.graphics({ x, y }).setDepth(2);
    g.fillStyle(COLORS.white, 1).fillCircle(0, 0, 30);
    g.lineStyle(4, INK, 1).strokeCircle(0, 0, 30);
    g.lineStyle(9, ok ? 0x3aa655 : 0xe23b3b, 1);
    if (ok) {
      g.beginPath().moveTo(-14, 1).lineTo(-4, 12).lineTo(15, -11).strokePath();
    } else {
      g.lineBetween(-12, -12, 12, 12).lineBetween(12, -12, -12, 12);
    }
  }

  /** Listón con la carita y el nombre del grupo. */
  private drawRibbon(x: number, y: number, b: Bin, color: number): void {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(color, 1).fillRoundedRect(x - 96, y - 24, 192, 48, 24);
    g.lineStyle(4, INK, 1).strokeRoundedRect(x - 96, y - 24, 192, 48, 24);
    fitImage(this.add.image(x - 66, y, tex(b.art)), 54, 54).setDepth(2);
    addTitle(this, x + 18, y, b.label, 28, {
      color: '#FFFFFF',
      stroke: '#2B2848',
      strokeThickness: 5,
    }).setDepth(2);
  }

  /** El niño de ese grupo da un saltito cuando le llega comida. */
  private bounceKid(binId: string): void {
    const kid = this.kids.get(binId);
    if (!kid) return;
    this.tweens.add({
      targets: kid,
      y: kid.y - 22,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private buildItems(): void {
    const a = this.activity;
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
    this.bounceKid(zone.zoneId);
    const last = this.items.filter((i) => i.isPlaced).length + 1 === this.items.length;
    this.correct(zone.x, zone.y - 100, last ? null : undefined);
    if (last) this.time.delayedCall(600, () => void this.complete(this.activity.done));
    return 'accept';
  }

  protected override getHint(): HintTarget | null {
    if (this.activity.look === 'cards') {
      const next = this.selected ?? this.items.find((i) => !i.isPlaced);
      const slot = next ? this.cardSlots.get(next.itemId) : undefined;
      return next && slot
        ? { kind: 'drag', from: { x: next.x, y: next.y }, to: { x: slot.zone.x, y: slot.zone.y } }
        : null;
    }
    const next = this.items.find((i) => !i.isPlaced);
    const def = next ? this.activity.items.find((d) => d.id === next.itemId) : undefined;
    const bin = def ? this.bins.get(def.bin) : undefined;
    return next && bin
      ? { kind: 'drag', from: { x: next.x, y: next.y }, to: { x: bin.x, y: bin.y } }
      : null;
  }
}
