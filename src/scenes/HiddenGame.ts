import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { COLORS } from '@/config/theme';
import type { HiddenActivity } from '@/config/rights';
import type { HintTarget } from '@/components/HelperHand';
import { fit, shake } from '@/components/Kit';
import { addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const BX = 150;
const BY = 92;
const BW = 980;
const BH = 384;
const FLOOR_Y = BY + BH - 92;
const TRAY_Y = 540;
const INK = COLORS.ink;

interface Hidden {
  img: Phaser.GameObjects.Image;
  slot: Phaser.GameObjects.Container;
  found: boolean;
  x: number;
  y: number;
}

/**
 * Motor "busca y encuentra": un lugar dibujado (salón, casa) con cosas escondidas detrás
 * de los muebles. Abajo está la lista con las siluetas de lo que hay que buscar. Al tocar
 * algo de la lista, vuela a su lugar; si tocan algo que no buscamos, Tori explica por qué.
 */
export default class HiddenGameScene extends BaseActivity<HiddenActivity> {
  protected readonly kind = 'hidden' as const;
  private hidden: Hidden[] = [];

  constructor() {
    super('HiddenGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.hidden = [];
  }

  protected override buildLevel(): void {
    const a = this.activity;
    const board = this.add.container(0, 0);
    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(0xffffff).fillRoundedRect(BX, BY, BW, BH, 28);
    board.setMask(maskG.createGeometryMask());
    const back = this.add.graphics();
    const front = this.add.graphics().setDepth(3);
    board.add(back);
    if (a.theme === 'classroom') this.classroom(back, front, board);
    else this.house(back, front);
    front.setMask(maskG.createGeometryMask());
    const frame = this.add.graphics().setDepth(4);
    frame.lineStyle(8, COLORS.white).strokeRoundedRect(BX, BY, BW, BH, 28);
    frame.lineStyle(3, INK, 0.5).strokeRoundedRect(BX - 4, BY - 4, BW + 8, BH + 8, 30);

    // Lista de abajo: siluetas de lo que hay que encontrar.
    const n = a.find.length;
    const gap = 112;
    const tray = this.add.graphics();
    const tw = n * gap + 30;
    tray.fillStyle(COLORS.ink, 0.15).fillRoundedRect(640 - tw / 2, TRAY_Y - 44, tw, 94, 30);
    tray.fillStyle(0xfff3c4).fillRoundedRect(640 - tw / 2, TRAY_Y - 50, tw, 94, 30);
    tray.lineStyle(4, INK).strokeRoundedRect(640 - tw / 2, TRAY_Y - 50, tw, 94, 30);

    a.find.forEach((f, i) => {
      const sx = 640 + (i - (n - 1) / 2) * gap;
      const ring = this.add.circle(0, 0, 38, COLORS.white).setStrokeStyle(4, INK, 0.6);
      const sil = fit(this.add.image(0, 0, tex(f.art)), 58, 58, 2)
        .setTintFill(INK)
        .setAlpha(0.35);
      const slot = this.add.container(sx, TRAY_Y - 3, [ring, sil]).setDepth(5);
      const img = fit(this.add.image(f.x, f.y, tex(f.art)), f.size, f.size, 3)
        .setAngle(f.angle ?? 0)
        .setDepth(2)
        .setInteractive({ useHandCursor: true, pixelPerfect: false });
      const h: Hidden = { img, slot, found: false, x: f.x, y: f.y };
      img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.found(h));
      this.hidden.push(h);
    });

    a.decoys.forEach((d) => {
      const img = fit(this.add.image(d.x, d.y, tex(d.art)), d.size, d.size, 3)
        .setAngle(d.angle ?? 0)
        .setDepth(2)
        .setInteractive({ useHandCursor: true });
      img.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        AudioManager.sfx('pop', { pitch: 0.8 });
        shake(this, img);
        this.mistakeOnce(d.label, d.hint);
      });
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private found(h: Hidden): void {
    if (h.found || this.finished) return;
    h.found = true;
    h.img.disableInteractive();
    AudioManager.sfx('pop', { pitch: 1.2 });
    this.effects.sparkleAt(h.x, h.y, 10);
    const sil = h.slot.list[1] as Phaser.GameObjects.Image;
    // Crece, da una vueltita y vuela a su lugar en la lista.
    this.tweens.chain({
      targets: h.img,
      tweens: [
        { scale: h.img.scale * 1.5, angle: 0, duration: motion(220), ease: 'Back.easeOut' },
        {
          x: h.slot.x,
          y: h.slot.y,
          scale: Math.min(58 / h.img.width, 58 / h.img.height),
          duration: motion(520),
          ease: 'Cubic.easeInOut',
          onStart: () => h.img.setDepth(6),
          onComplete: () => {
            sil.setVisible(false);
            (h.slot.list[0] as Phaser.GameObjects.Arc).setFillStyle(COLORS.grass);
            this.tweens.add({ targets: h.slot, scale: 1.25, duration: motion(120), yoyo: true });
          },
        },
      ],
    });
    const left = this.hidden.filter((k) => !k.found).length;
    this.correct(h.x, h.y - 50, left === 0 ? null : undefined);
    if (left === 0) {
      this.time.delayedCall(900, () => {
        this.effects.confettiAt(640, 260, 40);
        void this.complete(this.activity.done);
      });
    }
  }

  // ------------------------------------------------------------------ lugares

  private walls(g: Phaser.GameObjects.Graphics, wall: number, floor: number, line: number): void {
    g.fillStyle(wall).fillRect(BX, BY, BW, BH);
    g.fillStyle(floor).fillRect(BX, FLOOR_Y, BW, BH - (FLOOR_Y - BY));
    g.lineStyle(3, line);
    for (let x = BX + 70; x < BX + BW; x += 120) g.lineBetween(x, FLOOR_Y, x - 30, BY + BH);
    g.fillStyle(COLORS.white).fillRect(BX, FLOOR_Y - 8, BW, 10);
  }

  private plant(g: Phaser.GameObjects.Graphics, x: number, base: number, s = 1): void {
    g.fillStyle(0x3e9a4c);
    for (const [dx, dy, r] of [
      [-34, -70, 30],
      [30, -78, 32],
      [0, -110, 34],
      [-14, -40, 26],
      [22, -44, 26],
    ] as const) {
      g.fillCircle(x + dx * s, base + dy * s, r * s);
    }
    g.fillStyle(0x5cbf5a)
      .fillCircle(x - 10 * s, base - 108 * s, 14 * s)
      .fillCircle(x + 26 * s, base - 80 * s, 12 * s);
    g.fillStyle(0xd9703a).fillPoints(
      [
        { x: x - 40 * s, y: base - 30 * s },
        { x: x + 40 * s, y: base - 30 * s },
        { x: x + 30 * s, y: base + 26 * s },
        { x: x - 30 * s, y: base + 26 * s },
      ],
      true,
    );
    g.lineStyle(4, INK).strokePoints(
      [
        { x: x - 40 * s, y: base - 30 * s },
        { x: x + 40 * s, y: base - 30 * s },
        { x: x + 30 * s, y: base + 26 * s },
        { x: x - 30 * s, y: base + 26 * s },
      ],
      true,
    );
  }

  private classroom(
    back: Phaser.GameObjects.Graphics,
    front: Phaser.GameObjects.Graphics,
    board: Phaser.GameObjects.Container,
  ): void {
    const g = back;
    this.walls(g, 0xe3f1ff, 0xc9a27a, 0xa98560);
    // Ventana con cielo
    g.fillStyle(COLORS.sky).fillRoundedRect(196, 128, 150, 132, 10);
    g.fillStyle(COLORS.white, 0.9)
      .fillCircle(240, 170, 16)
      .fillCircle(262, 162, 20)
      .fillCircle(284, 172, 14);
    g.lineStyle(6, COLORS.white).strokeRoundedRect(196, 128, 150, 132, 10);
    g.lineStyle(5, COLORS.white).lineBetween(271, 128, 271, 260).lineBetween(196, 194, 346, 194);
    g.fillStyle(0xb9834e).fillRect(184, 260, 174, 14);
    g.lineStyle(3, INK).strokeRect(184, 260, 174, 14);
    // Pizarrón
    g.fillStyle(0x8b5a2b).fillRoundedRect(430, 118, 400, 160, 12);
    g.fillStyle(0x2f6b4f).fillRoundedRect(442, 130, 376, 136, 8);
    board.add(addTitle(this, 630, 176, 'A  B  C', 38, { color: '#FFFFFF' }));
    board.add(addTitle(this, 630, 228, '1  2  3', 32, { color: '#FFF3B0' }));
    // Librero a la derecha
    g.fillStyle(0xc68642).fillRect(950, 130, 150, 300);
    g.lineStyle(4, INK).strokeRect(950, 130, 150, 300);
    for (const y of [210, 290, 370]) {
      g.fillStyle(0x9c6a35).fillRect(950, y, 150, 10);
    }
    const books = [COLORS.coral, COLORS.turquoise, COLORS.sun, COLORS.grape, COLORS.grass];
    books.forEach((c, i) => {
      g.fillStyle(c).fillRect(1040 + i * 11, 160 - (i % 2) * 6, 10, 50 + (i % 2) * 6);
      g.fillStyle(books[(i + 2) % 5] ?? c).fillRect(
        960 + i * 13,
        300 - (i % 3) * 5,
        12,
        70 + (i % 3) * 5,
      );
    });
    // Delante: escritorio de la maestra y una maceta grande (tapan algunas cosas).
    const f = front;
    f.fillStyle(0xe0a96d).fillRoundedRect(500, 380, 300, 22, 8);
    f.lineStyle(4, INK).strokeRoundedRect(500, 380, 300, 22, 8);
    f.fillStyle(0xd09257).fillRect(520, 402, 260, 70);
    f.lineStyle(4, INK).strokeRect(520, 402, 260, 70);
    f.fillStyle(0xf0c48a).fillRoundedRect(600, 420, 100, 16, 6);
    this.plant(f, 250, 440, 1.05);
  }

  private house(back: Phaser.GameObjects.Graphics, front: Phaser.GameObjects.Graphics): void {
    const g = back;
    this.walls(g, 0xffe9c9, 0xd9a066, 0xb98550);
    g.fillStyle(0xffd7a3);
    for (let y = BY + 30; y < FLOOR_Y - 20; y += 56) {
      for (let x = BX + 30 + ((y / 56) % 2) * 28; x < BX + BW; x += 56) g.fillCircle(x, y, 6);
    }
    // Ventana con cortinas
    g.fillStyle(COLORS.sky).fillRoundedRect(560, 124, 170, 140, 10);
    g.fillStyle(COLORS.sun).fillCircle(690, 160, 20);
    g.lineStyle(6, COLORS.white).strokeRoundedRect(560, 124, 170, 140, 10);
    g.lineStyle(5, COLORS.white).lineBetween(645, 124, 645, 264);
    g.fillStyle(COLORS.coral)
      .fillRoundedRect(540, 116, 40, 170, 12)
      .fillRoundedRect(710, 116, 40, 170, 12);
    g.fillStyle(0xb9834e).fillRect(548, 264, 194, 12);
    // Cuadro de la familia
    g.fillStyle(0xb9834e).fillRoundedRect(250, 140, 120, 96, 8);
    g.fillStyle(0xfff6e0).fillRoundedRect(262, 152, 96, 72, 4);
    g.fillStyle(COLORS.pink).fillCircle(290, 182, 14);
    g.fillStyle(COLORS.turquoise).fillCircle(330, 178, 16);
    g.fillStyle(COLORS.grass).fillRect(262, 204, 96, 20);
    // Lámpara de pie
    g.lineStyle(6, INK).lineBetween(890, 180, 890, FLOOR_Y + 40);
    g.fillStyle(COLORS.sun).fillPoints(
      [
        { x: 860, y: 180 },
        { x: 920, y: 180 },
        { x: 940, y: 130 },
        { x: 840, y: 130 },
      ],
      true,
    );
    // Delante: sillón, mesita y maceta.
    const f = front;
    f.fillStyle(0x6c8fd9).fillRoundedRect(190, 300, 300, 80, 24);
    f.fillStyle(0x7fa3ea).fillRoundedRect(180, 350, 320, 70, 20);
    f.fillStyle(0x6c8fd9)
      .fillRoundedRect(168, 330, 44, 100, 18)
      .fillRoundedRect(470, 330, 44, 100, 18);
    f.lineStyle(4, INK)
      .strokeRoundedRect(190, 300, 300, 80, 24)
      .strokeRoundedRect(180, 350, 320, 70, 20)
      .strokeRoundedRect(168, 330, 44, 100, 18)
      .strokeRoundedRect(470, 330, 44, 100, 18);
    f.fillStyle(0x4a6fb8).fillRect(200, 420, 14, 30).fillRect(466, 420, 14, 30);
    // Mesita
    f.fillStyle(0xe0a96d).fillRoundedRect(740, 392, 240, 20, 8);
    f.lineStyle(4, INK).strokeRoundedRect(740, 392, 240, 20, 8);
    f.fillStyle(0xb9834e).fillRect(760, 412, 16, 60).fillRect(944, 412, 16, 60);
    this.plant(f, 1060, 450, 0.95);
  }

  protected override getHint(): HintTarget | null {
    const h = this.hidden.find((k) => !k.found);
    return h ? { kind: 'tap', x: h.x, y: h.y } : null;
  }
}
