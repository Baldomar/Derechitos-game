import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { VoiceLine } from '@/config/levels';
import type { PlaceActivity } from '@/config/rights';
import { tex } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addBody, addTitle } from '@/components/Text';
import { motion, prefersReducedMotion } from '@/core/Device';
import { BaseActivity, fitImage } from './BaseActivity';

/** Marco del lugar que se arma (coordenadas de juego). */
const BX = 150;
const BY = 92;
const BW = 980;
const BH = 384;
const TRAY_Y = 540;
const TRAY_BOX = 92;
const INK = COLORS.ink;

const WRONG_SPOT: VoiceLine = {
  id: 'place_wrong',
  text: 'Ese no es su lugar. Busca la sombra que tiene la misma forma.',
};

type Item = PlaceActivity['items'][number];

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

/**
 * Motor "arma la escena": un lugar dibujado (cuarto, salón, parque…) con sombras de las
 * cosas que faltan. El niño arrastra cada cosa a su sombra; al encajar, cobra vida.
 * En la tormenta, al poner a todos a salvo deja de llover y sale el sol con arcoíris.
 */
export default class PlaceGameScene extends BaseActivity<PlaceActivity> {
  protected readonly kind = 'place' as const;
  private items: DraggableItem[] = [];
  private shadows = new Map<string, Phaser.GameObjects.Image>();
  private zones: DropZone[] = [];
  /** Sombras ya ocupadas (modo anySpot). */
  private filled = new Set<string>();
  private rain: Phaser.GameObjects.Graphics | null = null;
  private drops: Drop[] = [];
  /** Capas de la tormenta: al despejarse se desvanecen y revelan el sol y el arcoíris. */
  private stormLayers: Phaser.GameObjects.GameObject[] = [];
  private stormSun: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('PlaceGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.items = [];
    this.shadows = new Map();
    this.zones = [];
    this.filled = new Set();
    this.rain = null;
    this.drops = [];
    this.stormLayers = [];
    this.stormSun = null;
  }

  protected override buildLevel(): void {
    const a = this.activity;

    // Fondo del lugar, recortado con esquinas redondas y con marco blanco.
    const board = this.add.container(0, 0);
    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(0xffffff).fillRoundedRect(BX, BY, BW, BH, 28);
    board.setMask(maskG.createGeometryMask());
    this.drawTheme(board);
    const frame = this.add.graphics().setDepth(1);
    frame.lineStyle(8, COLORS.white, 1).strokeRoundedRect(BX, BY, BW, BH, 28);
    frame.lineStyle(3, INK, 0.5).strokeRoundedRect(BX - 4, BY - 4, BW + 8, BH + 8, 30);

    // Sombras: el mismo dibujo en silueta, latiendo suavecito para llamar la atención.
    for (const it of a.items) {
      const sh = this.add.image(it.x, it.y, tex(it.art)).setDepth(1);
      fitImage(sh, it.size, it.size, 4);
      sh.setTintFill(INK).setAlpha(0.22);
      this.tweens.add({
        targets: sh,
        alpha: 0.36,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 600,
      });
      this.shadows.set(it.id, sh);
      const zone = new DropZone(this, it.x, it.y, {
        id: it.id,
        width: Math.max(sh.displayWidth, 90),
        height: Math.max(sh.displayHeight, 90),
        showOutline: false,
        tolerance: 26,
      });
      this.zones.push(zone);
    }

    // Bandeja de abajo con las cosas revueltas.
    const order = Phaser.Utils.Array.Shuffle([...a.items]);
    const gap = Math.min(150, 1000 / order.length);
    order.forEach((it, i) => {
      const x = 640 + (i - (order.length - 1) / 2) * gap;
      const img = fitImage(this.add.image(0, -8, tex(it.art)), TRAY_BOX, TRAY_BOX - 12, 3);
      const label = addBody(this, 0, 48, it.label, 16, {
        stroke: '#FFFFFF',
        strokeThickness: 5,
      });
      const item = new DraggableItem(this, x, TRAY_Y, {
        id: it.id,
        content: [img, label],
        width: 120,
        height: 120,
        zones: this.zones,
        placedScale: it.size / TRAY_BOX,
        growOnDrag: true,
        onPick: () => label.setVisible(false),
        onDrop: (d, zone) => this.onDrop(d, zone, it, label),
      });
      item.setDepth(3).setScale(0);
      this.tweens.add({
        targets: item,
        scale: 1,
        delay: 300 + i * 90,
        duration: motion(320),
        ease: 'Back.easeOut',
      });
      this.items.push(item);
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private onDrop(
    item: DraggableItem,
    zone: DropZone | null,
    it: Item,
    label: Phaser.GameObjects.Text,
  ): DropDecision {
    if (!zone) {
      label.setVisible(true);
      return 'ignore';
    }
    const any = this.activity.anySpot === true;
    if (any && this.filled.has(zone.zoneId)) {
      // Ese lugar ya está ocupado: vuelve sin contar como error.
      label.setVisible(true);
      return 'ignore';
    }
    if (!any && zone.zoneId !== it.id) {
      label.setVisible(true);
      this.mistake(it.hint ?? WRONG_SPOT);
      return 'reject';
    }
    this.filled.add(zone.zoneId);
    const sh = this.shadows.get(zone.zoneId);
    if (sh) {
      this.tweens.killTweensOf(sh);
      this.tweens.add({ targets: sh, alpha: 0, duration: motion(250) });
    }
    item.setDepth(2);
    // Cobra vida: un balanceo suave y permanente una vez en su lugar.
    if (!prefersReducedMotion()) {
      this.time.delayedCall(700, () => {
        if (!item.active) return;
        const visual = item.list[0] as Phaser.GameObjects.Container | undefined;
        if (!visual) return;
        this.tweens.add({
          targets: visual,
          angle: { from: -2.5, to: 2.5 },
          duration: 1200 + Math.random() * 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      });
    }
    const placed = this.items.filter((i) => i.isPlaced).length + 1;
    const last = placed === this.items.length;
    this.correct(zone.x, zone.y - it.size / 2, last ? null : undefined);
    if (last) this.time.delayedCall(500, () => void this.finale());
    return 'accept';
  }

  private async finale(): Promise<void> {
    if (this.activity.theme === 'storm') {
      // ¡Todos a salvo! Deja de llover, se van las nubes y aparecen el sol y el arcoíris.
      this.tweens.add({ targets: this.stormLayers, alpha: 0, duration: 1400 });
      if (this.stormSun) {
        this.tweens.add({ targets: this.stormSun, y: 190, duration: 1400, ease: 'Back.easeOut' });
      }
      await this.wait(1300);
    }
    this.effects.confettiAt(640, 300, 50);
    await this.complete(this.activity.done);
  }

  override update(_time: number, delta: number): void {
    if (!this.rain || this.rain.alpha === 0) return;
    const dt = Math.min(delta, 50) / 1000;
    const g = this.rain;
    g.clear().lineStyle(3, 0xcfe6ff, 0.75);
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x -= d.speed * 0.18 * dt;
      if (d.y > BY + BH) {
        d.y = BY - d.len;
        d.x = Phaser.Math.Between(BX, BX + BW + 60);
      }
      g.lineBetween(d.x, d.y, d.x - d.len * 0.18, d.y + d.len);
    }
  }

  // ------------------------------------------------------------------ Lugares

  private drawTheme(board: Phaser.GameObjects.Container): void {
    const g = this.add.graphics();
    board.add(g);
    const floorY = BY + BH - 92;
    const wall = (color: number): void => {
      g.fillStyle(color, 1).fillRect(BX, BY, BW, BH);
    };
    const floor = (color: number, line: number): void => {
      g.fillStyle(color, 1).fillRect(BX, floorY, BW, BH - (floorY - BY));
      g.lineStyle(3, line, 1);
      for (let x = BX + 70; x < BX + BW; x += 120) g.lineBetween(x, floorY, x - 30, BY + BH);
      g.fillStyle(COLORS.white, 1).fillRect(BX, floorY - 8, BW, 10);
    };

    switch (this.activity.theme) {
      case 'room': {
        wall(0xffe9c9);
        // Papel tapiz de lunares
        g.fillStyle(0xffd7a3, 1);
        for (let y = BY + 30; y < floorY - 20; y += 56) {
          for (let x = BX + 30 + ((y / 56) % 2) * 28; x < BX + BW; x += 56) g.fillCircle(x, y, 6);
        }
        floor(0xd9a066, 0xb98550);
        g.fillStyle(COLORS.pink, 0.9).fillEllipse(640, BY + BH - 40, 360, 56);
        g.lineStyle(4, INK, 0.5).strokeEllipse(640, BY + BH - 40, 360, 56);
        break;
      }
      case 'classroom': {
        wall(0xe3f1ff);
        floor(0xc9a27a, 0xa98560);
        // Pizarrón con letras y números
        g.fillStyle(0x8b5a2b, 1).fillRoundedRect(430, 118, 420, 168, 12);
        g.fillStyle(0x2f6b4f, 1).fillRoundedRect(442, 130, 396, 144, 8);
        board.add(addTitle(this, 640, 176, 'A  B  C', 40, { color: '#FFFFFF' }));
        board.add(addTitle(this, 640, 232, '1  2  3', 34, { color: '#FFF3B0' }));
        // Mesa
        g.fillStyle(0xe0a96d, 1).fillRoundedRect(470, 396, 340, 22, 8);
        g.lineStyle(4, INK, 1).strokeRoundedRect(470, 396, 340, 22, 8);
        g.fillStyle(0xb9834e, 1).fillRect(490, 418, 16, 56).fillRect(774, 418, 16, 56);
        break;
      }
      case 'park': {
        wall(0xaee3ff);
        g.fillStyle(COLORS.white, 0.9);
        g.fillCircle(330, 140, 26).fillCircle(362, 128, 32).fillCircle(396, 142, 24);
        g.fillStyle(COLORS.grass, 1).fillRect(BX, BY + 250, BW, BH - 250);
        g.fillStyle(COLORS.grassDark, 1).fillEllipse(400, BY + 256, 700, 70);
        g.fillStyle(COLORS.grass, 1).fillEllipse(900, BY + 262, 800, 60);
        g.fillStyle(COLORS.sand, 1).fillEllipse(640, BY + BH - 20, 520, 70);
        break;
      }
      case 'shelf': {
        wall(0xf3e3ff);
        floor(0xd9a066, 0xb98550);
        const plank = (y: number): void => {
          g.fillStyle(0xc68642, 1).fillRoundedRect(300, y, 680, 18, 6);
          g.lineStyle(4, INK, 1).strokeRoundedRect(300, y, 680, 18, 6);
          g.fillStyle(0x9c6a35, 1)
            .fillRect(320, y + 18, 14, 18)
            .fillRect(946, y + 18, 14, 18);
        };
        plank(232);
        plank(372);
        break;
      }
      case 'storm': {
        // Debajo (se ve al final): cielo claro, sol y arcoíris.
        wall(0xaee3ff);
        const bow = this.add.graphics();
        const colors = [
          COLORS.coral,
          COLORS.orange,
          COLORS.sun,
          COLORS.grass,
          COLORS.sea,
          COLORS.grape,
        ];
        colors.forEach((c, i) => {
          bow.lineStyle(14, c, 0.9);
          bow.beginPath();
          bow.arc(640, 470, 440 - i * 14, Math.PI, Math.PI * 2);
          bow.strokePath();
        });
        this.stormSun = fitImage(this.add.image(1040, 330, tex('sol')), 130, 130, 2);
        board.add([bow, this.stormSun]);
        // Encima: cielo gris, nubes, lluvia y relámpagos.
        const dark = this.add.rectangle(BX, BY, BW, BH, 0x4f5d78, 1).setOrigin(0);
        const clouds = this.add.graphics();
        clouds.fillStyle(0x6f7c96, 1);
        for (const [x, y] of [
          [260, 120],
          [560, 104],
          [900, 126],
        ] as const) {
          clouds
            .fillCircle(x, y, 34)
            .fillCircle(x + 40, y - 14, 42)
            .fillCircle(x + 84, y, 32);
          clouds.fillRoundedRect(x - 10, y, 120, 30, 15);
        }
        board.add([dark, clouds]);
        const ground = this.add.graphics();
        ground.fillStyle(COLORS.grassDark, 1).fillRect(BX, BY + BH - 46, BW, 46);
        board.add(ground);
        this.drawHouse(board);
        this.rain = this.add.graphics();
        board.add(this.rain);
        for (let i = 0; i < 70; i++) {
          this.drops.push({
            x: Phaser.Math.Between(BX, BX + BW + 60),
            y: Phaser.Math.Between(BY, BY + BH),
            len: Phaser.Math.Between(16, 28),
            speed: Phaser.Math.Between(420, 560),
          });
        }
        // Relámpago de vez en cuando (un destello suave, nada que asuste).
        const flash = this.add.rectangle(BX, BY, BW, BH, COLORS.white, 0).setOrigin(0);
        board.add(flash);
        if (!prefersReducedMotion()) {
          this.time.addEvent({
            delay: 5200,
            loop: true,
            callback: () => {
              if (!this.rain || this.rain.alpha === 0) return;
              this.tweens.add({ targets: flash, alpha: 0.35, duration: 70, yoyo: true, repeat: 1 });
            },
          });
        }
        this.stormLayers = [dark, clouds, this.rain];
        break;
      }
    }
  }

  /** Casa grande con ventanas iluminadas (adentro se está seguro y calientito). */
  private drawHouse(board: Phaser.GameObjects.Container): void {
    const h = this.add.graphics();
    const left = 420;
    const right = 860;
    const top = 214;
    const bottom = BY + BH - 40;
    h.fillStyle(0x000000, 0.15).fillRect(left + 10, top + 10, right - left, bottom - top);
    h.fillStyle(COLORS.sand, 1).fillRect(left, top, right - left, bottom - top);
    h.lineStyle(5, INK, 1).strokeRect(left, top, right - left, bottom - top);
    const roof = [
      { x: left - 40, y: top + 6 },
      { x: 640, y: 112 },
      { x: right + 40, y: top + 6 },
    ];
    h.fillStyle(COLORS.coral, 1).fillPoints(roof, true);
    h.lineStyle(5, INK, 1).strokePoints(roof, true);
    const win = (x: number, y: number, w: number, hh: number): void => {
      h.fillStyle(0xfff1a8, 1).fillRoundedRect(x - w / 2, y - hh / 2, w, hh, 10);
      h.lineStyle(5, INK, 1).strokeRoundedRect(x - w / 2, y - hh / 2, w, hh, 10);
    };
    win(510, 276, 116, 96);
    win(770, 276, 116, 96);
    win(510, 386, 116, 92);
    win(770, 386, 116, 92);
    win(640, 392, 96, 120);
    board.add(h);
  }

  protected override getHint(): HintTarget | null {
    const next = this.items.find((i) => !i.isPlaced);
    if (!next) return null;
    const to = this.activity.anySpot
      ? this.zones.find((z) => !this.filled.has(z.zoneId))
      : this.activity.items.find((d) => d.id === next.itemId);
    return to ? { kind: 'drag', from: { x: next.x, y: next.y }, to: { x: to.x, y: to.y } } : null;
  }
}
