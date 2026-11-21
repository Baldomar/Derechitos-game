import Phaser from 'phaser';
import { tex, type ArtKey } from '@/art/Art';
import { COLORS, DEPTH } from '@/config/theme';
import { motion } from '@/core/Device';

const R = 19;
const GAP = 46;

/**
 * Medidor de meta para niños que aún no cuentan bien: una fila de circulitos arriba a la
 * derecha. Cada acierto "vuela" hasta el siguiente circulito y lo llena con su dibujito,
 * así el niño VE cuánto le falta sin leer números.
 */
export class GoalMeter {
  private readonly scene: Phaser.Scene;
  private readonly rightX: number;
  private readonly y: number;
  private slots: Phaser.GameObjects.Container[] = [];
  private filled = 0;

  constructor(scene: Phaser.Scene, total: number, rightX = 1236, y = 58) {
    this.scene = scene;
    this.rightX = rightX;
    this.y = y;
    this.reset(total);
  }

  get count(): number {
    return this.filled;
  }

  get total(): number {
    return this.slots.length;
  }

  get done(): boolean {
    return this.filled >= this.slots.length;
  }

  /** Vuelve a dibujar los circulitos vacíos (nueva ronda). */
  reset(total: number): void {
    this.slots.forEach((s) => s.destroy());
    this.filled = 0;
    this.slots = Array.from({ length: total }, (_, i) => {
      const x = this.rightX - (total - 1 - i) * GAP;
      const ring = this.scene.add
        .circle(0, 0, R, COLORS.white, 0.85)
        .setStrokeStyle(4, COLORS.ink, 0.9);
      const c = this.scene.add.container(x, this.y, [ring]).setDepth(DEPTH.ui);
      c.setScale(0);
      this.scene.tweens.add({
        targets: c,
        scale: 1,
        delay: i * 50,
        duration: motion(260),
        ease: 'Back.easeOut',
      });
      return c;
    });
  }

  /** Llena el siguiente circulito. Si se da (x, y), el dibujito vuela desde ahí. */
  fill(art: ArtKey | null, fromX?: number, fromY?: number): void {
    const slot = this.slots[this.filled];
    if (!slot) return;
    this.filled += 1;
    const land = (): void => {
      const ring = slot.list[0] as Phaser.GameObjects.Arc;
      ring.setFillStyle(COLORS.grass, 1);
      if (art) {
        const icon = this.scene.add.image(0, 0, tex(art));
        icon.setScale(Math.min((R * 1.6) / icon.width, (R * 1.6) / icon.height));
        slot.add(icon);
      }
      this.scene.tweens.add({
        targets: slot,
        scale: 1.35,
        duration: motion(110),
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    };
    if (art && fromX !== undefined && fromY !== undefined) {
      const fly = this.scene.add.image(fromX, fromY, tex(art)).setDepth(DEPTH.ui + 1);
      fly.setScale(Math.min(70 / fly.width, 70 / fly.height));
      this.scene.tweens.add({
        targets: fly,
        x: slot.x,
        y: slot.y,
        scale: (R * 1.6) / Math.max(fly.width, fly.height),
        duration: motion(520),
        ease: 'Cubic.easeInOut',
        onComplete: () => {
          fly.destroy();
          land();
        },
      });
    } else {
      land();
    }
  }
}

/** Corazoncito (textura generada una vez) para cuando un amigo recibe ayuda. */
export function heartTexture(scene: Phaser.Scene): string {
  const key = 'fx-heart';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(COLORS.coral, 1);
  g.fillCircle(14, 14, 12).fillCircle(34, 14, 12);
  g.fillTriangle(3, 19, 45, 19, 24, 42);
  g.fillStyle(COLORS.white, 0.7).fillCircle(11, 10, 4);
  g.generateTexture(key, 48, 46);
  g.destroy();
  return key;
}

/** Lanza corazoncitos que suben desde (x, y). */
export function burstHearts(scene: Phaser.Scene, x: number, y: number, n = 5): void {
  const key = heartTexture(scene);
  for (let i = 0; i < n; i++) {
    const h = scene.add
      .image(x + Phaser.Math.Between(-40, 40), y, key)
      .setDepth(DEPTH.overlay - 2)
      .setScale(0);
    scene.tweens.add({
      targets: h,
      y: y - Phaser.Math.Between(80, 150),
      x: h.x + Phaser.Math.Between(-30, 30),
      scale: Phaser.Math.FloatBetween(0.6, 1),
      alpha: { from: 1, to: 0 },
      delay: i * 70,
      duration: motion(1100),
      ease: 'Sine.easeOut',
      onComplete: () => h.destroy(),
    });
  }
}
