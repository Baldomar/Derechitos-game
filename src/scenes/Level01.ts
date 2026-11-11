import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import type { HouseContent } from '@/config/levels';
import { artImage, tex, type ArtKey } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { BaseLevel } from './BaseLevel';
import { setPageBackground } from '@/core/PageBackground';

/** Posición final de cada pieza de la casa y su profundidad. */
const HOUSE: Record<
  string,
  { x: number; y: number; depth: number; home: { x: number; y: number; s: number } }
> = {
  paredes: { x: 830, y: 382, depth: 1, home: { x: 205, y: 215, s: 0.55 } },
  techo: { x: 830, y: 216, depth: 2, home: { x: 455, y: 205, s: 0.55 } },
  ventana: { x: 755, y: 368, depth: 3, home: { x: 205, y: 400, s: 0.85 } },
  puerta: { x: 880, y: 417, depth: 3, home: { x: 400, y: 395, s: 0.8 } },
};
const DOOR = { x: 880, y: 417 };

/**
 * Nivel 1 — Casa segura (vivienda y vida).
 * 1) Armar la casa arrastrando paredes, techo, ventana y puerta a su silueta.
 * 2) Llueve: llevar a la familia adentro por la puerta. 3) Sale el arcoíris.
 */
export default class Level01Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'paredes',
    'techo',
    'puerta',
    'ventana',
    'mama',
    'papa',
    'abuela',
    'nino',
    'nube-gris',
    'sol',
  ];
  private c!: HouseContent;
  private stage: 'build' | 'rain' | 'done' = 'build';
  private pieces: DraggableItem[] = [];
  private ghosts: Phaser.GameObjects.Image[] = [];
  private family: DraggableItem[] = [];
  private placed = 0;
  private sheltered = 0;
  private rain: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private darkness!: Phaser.GameObjects.Rectangle;
  private clouds: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Level01');
  }

  override init(data?: unknown): void {
    super.init(data);
    this.stage = 'build';
    this.pieces = [];
    this.ghosts = [];
    this.family = [];
    this.placed = 0;
    this.sheltered = 0;
    this.rain = null;
    this.clouds = [];
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('house');
    const ground = this.add.graphics();
    ground.fillStyle(COLORS.grass).fillRect(0, 476, GAME_WIDTH, GAME_HEIGHT - 476);
    setPageBackground(this, { top: COLORS.sky, bottom: COLORS.grass, split: 476 });
    ground.fillStyle(COLORS.sand).fillRect(840, 476, 80, GAME_HEIGHT - 476);

    this.darkness = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 8000, 8000, 0x1b2340, 0)
      .setDepth(0.5);

    // Siluetas (guía visual) y zonas destino.
    const zones = new Map<string, DropZone>();
    for (const p of this.c.pieces) {
      const pos = HOUSE[p.id];
      if (!pos) continue;
      const ghost = this.add
        .image(pos.x, pos.y, tex(p.art))
        .setTintFill(COLORS.white)
        .setAlpha(0.45)
        .setDepth(0.2 + pos.depth / 10);
      this.ghosts.push(ghost);
      zones.set(
        p.id,
        new DropZone(this, pos.x, pos.y, {
          id: p.id,
          width: ghost.width,
          height: ghost.height,
          showOutline: false,
          tolerance: 30,
        }),
      );
    }

    for (const p of this.c.pieces) {
      const pos = HOUSE[p.id];
      const own = zones.get(p.id);
      if (!pos || !own) continue;
      const others = [...zones.values()].filter((z) => z !== own);
      const img = artImage(this, 0, 0, p.art);
      const item = new DraggableItem(this, pos.home.x, pos.home.y, {
        id: p.id,
        content: [img],
        width: img.width,
        height: img.height,
        zones: [own, ...others],
        onDrop: (it, zone) => this.onPieceDrop(it, zone, p.hint),
        placedScale: 1,
        growOnDrag: true,
      });
      item.setScale(pos.home.s).setDepth(4);
      this.pieces.push(item);
    }
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private onPieceDrop(
    item: DraggableItem,
    zone: DropZone | null,
    hint: HouseContent['pieces'][number]['hint'],
  ): DropDecision {
    if (!zone) return 'ignore';
    if (zone.zoneId !== item.itemId) {
      this.mistake(hint);
      return 'reject';
    }
    const pos = HOUSE[item.itemId];
    this.time.delayedCall(10, () => item.setDepth(pos?.depth ?? 1));
    this.placed += 1;
    const last = this.placed === this.c.pieces.length;
    this.correct(zone.x, zone.y - 40, last ? null : undefined);
    if (last) this.time.delayedCall(700, () => void this.startRain());
    return 'accept';
  }

  // ------------------------------------------------------------------ lluvia

  private rainTexture(): string {
    const key = 'fx-rain';
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xbfe6ff).fillRoundedRect(0, 0, 4, 18, 2);
      g.generateTexture(key, 4, 18);
      g.destroy();
    }
    return key;
  }

  private async startRain(): Promise<void> {
    this.stage = 'rain';
    this.ghosts.forEach((g) => g.setVisible(false));
    this.tori.setMood('celebrate');
    await this.say(this.c.built);
    if (!this.alive) return;

    this.tweens.add({ targets: this.darkness, fillAlpha: 0.38, duration: motion(1200) });
    [220, 640, 1060].forEach((x, i) => {
      const cloud = this.add.image(x, -80, tex('nube-gris')).setDepth(0.6).setScale(1.3);
      this.clouds.push(cloud);
      this.tweens.add({
        targets: cloud,
        y: 80 + (i % 2) * 20,
        duration: motion(900),
        ease: 'Back.easeOut',
        delay: i * 120,
      });
    });
    this.rain = this.add
      .particles(0, -20, this.rainTexture(), {
        x: { min: -500, max: GAME_WIDTH + 500 },
        speedY: { min: 700, max: 900 },
        speedX: -60,
        lifespan: 900,
        frequency: prefersReducedMotion() ? 60 : 18,
        quantity: 2,
        alpha: 0.75,
      })
      .setDepth(5);

    // La familia llega corriendo por la izquierda.
    const doorZone = new DropZone(this, DOOR.x, DOOR.y, {
      id: 'door',
      width: 130,
      height: 150,
      tolerance: 45,
    }).setDepth(3.5);
    this.tweens.add({ targets: doorZone, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
    this.c.family.forEach((m, i) => {
      const img = artImage(this, 0, 0, m.art);
      const label = addBody(this, 0, img.height / 2 + 14, m.label, 22, {
        stroke: '#FFFFFF',
        strokeThickness: 5,
      });
      const homeX = 150 + i * 125;
      const item = new DraggableItem(this, -120, 395, {
        id: m.id,
        content: [img, label],
        width: 110,
        height: img.height,
        zones: [doorZone],
        onDrop: (it, zone) => this.onFamilyDrop(it, zone),
      });
      item.setScale(0.7).setDepth(4).setHome(homeX, 395);
      this.tweens.add({
        targets: item,
        x: homeX,
        duration: motion(700),
        delay: i * 150,
        ease: 'Quad.easeOut',
      });
      this.family.push(item);
    });
    AudioManager.sfx('pop');
    await this.instruct(this.c.rain);
  }

  private onFamilyDrop(item: DraggableItem, zone: DropZone | null): DropDecision {
    if (!zone) return 'ignore';
    this.sheltered += 1;
    // Entra a la casa: se encoge hacia la puerta.
    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: item,
        scale: 0.2,
        alpha: 0,
        y: DOOR.y + 20,
        duration: motion(400),
        ease: 'Quad.easeIn',
      });
    });
    const last = this.sheltered === this.family.length;
    this.correct(DOOR.x, DOOR.y - 60, last ? null : undefined);
    if (last) {
      this.time.delayedCall(0, () => zone.destroy());
      this.time.delayedCall(800, () => void this.stopRain());
    }
    return 'accept';
  }

  private async stopRain(): Promise<void> {
    this.stage = 'done';
    this.rain?.stop();
    this.tweens.add({ targets: this.darkness, fillAlpha: 0, duration: motion(1200) });
    this.clouds.forEach((c, i) =>
      this.tweens.add({ targets: c, x: i % 2 ? GAME_WIDTH + 200 : -200, duration: motion(1400) }),
    );

    // Arcoíris detrás de la casa y sol.
    const rainbow = this.add.graphics().setDepth(0.7).setAlpha(0);
    const colors = [
      COLORS.coral,
      COLORS.orange,
      COLORS.sun,
      COLORS.grass,
      COLORS.turquoise,
      COLORS.grape,
    ];
    colors.forEach((col, i) => {
      rainbow.lineStyle(16, col);
      rainbow.beginPath();
      rainbow.arc(830, 476, 400 - i * 16, Math.PI, 2 * Math.PI);
      rainbow.strokePath();
    });
    this.tweens.add({ targets: rainbow, alpha: 1, duration: motion(1200), delay: 400 });
    const sun = artImage(this, 1150, -120, 'sol').setDepth(0.8).setScale(0.8);
    this.tweens.add({ targets: sun, y: 110, duration: motion(900), ease: 'Back.easeOut' });
    this.tweens.add({ targets: sun, angle: 360, duration: 20000, repeat: -1 });
    await this.complete(this.c.safe);
  }

  protected override getHint(): HintTarget | null {
    if (this.stage === 'build') {
      const next = this.pieces.find((p) => !p.isPlaced);
      const pos = next ? HOUSE[next.itemId] : undefined;
      return next && pos
        ? { kind: 'drag', from: { x: next.x, y: next.y }, to: { x: pos.x, y: pos.y } }
        : null;
    }
    if (this.stage === 'rain') {
      const next = this.family.find((m) => !m.isPlaced);
      return next ? { kind: 'drag', from: { x: next.x, y: next.y }, to: DOOR } : null;
    }
    return null;
  }
}
