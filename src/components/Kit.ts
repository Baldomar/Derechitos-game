import Phaser from 'phaser';
import { tex, type ArtKey } from '@/art/Art';
import { COLORS } from '@/config/theme';
import { motion } from '@/core/Device';
import { addBody } from './Text';

/** Ajusta una imagen a un cuadro de w x h (sin pasar de `max`). */
export function fit<T extends Phaser.GameObjects.Image>(
  img: T,
  w: number,
  h: number,
  max = 1.4,
): T {
  return img.setScale(Math.min(max, w / img.width, h / img.height));
}

/** Tarjeta blanca redondeada con sombra, dibujo y nombre (todo centrado en 0,0). */
export function thingCard(
  scene: Phaser.Scene,
  w: number,
  h: number,
  art: ArtKey,
  label: string,
  opts: { fill?: number; labelSize?: number; radius?: number } = {},
): Phaser.GameObjects.Container {
  const r = opts.radius ?? 20;
  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.ink, 0.18).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
  bg.fillStyle(opts.fill ?? COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  bg.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  // El nombre se mide primero (puede ocupar 2 líneas) y queda abajo, dentro de la tarjeta;
  // el dibujo se ajusta al espacio que sobra arriba. Así el texto nunca se sale ni se encima.
  const pad = 12;
  let textH = 0;
  let text: Phaser.GameObjects.Text | null = null;
  if (label.length > 0) {
    text = addBody(scene, 0, 0, label, opts.labelSize ?? 18, { wrap: w - 28 }).setOrigin(0.5, 1);
    text.setY(h / 2 - pad);
    textH = text.height;
  }
  const top = -h / 2 + pad;
  const bottom = h / 2 - pad - textH - (text ? 6 : 0);
  const img = fit(
    scene.add.image(0, (top + bottom) / 2, tex(art)),
    w - 30,
    Math.max(30, bottom - top),
    2.2,
  );
  const parts: Phaser.GameObjects.GameObject[] = [bg, img];
  if (text) parts.push(text);
  return scene.add.container(0, 0, parts).setSize(w, h);
}

/** Aparece con rebote (escala 0 → 1). */
export function popIn(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
  delay = 0,
): void {
  target.setScale(0);
  scene.tweens.add({
    targets: target,
    scale: 1,
    delay,
    duration: motion(320),
    ease: 'Back.easeOut',
  });
}

/** "No" con la cabeza: sacudida corta de lado a lado. */
export function shake(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
): void {
  const x = target.x;
  scene.tweens.add({
    targets: target,
    x: { from: x - 10, to: x + 10 },
    duration: motion(70),
    yoyo: true,
    repeat: 2,
    onComplete: () => {
      target.x = x;
    },
  });
}

/** Saltito de alegría. */
export function hop(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
  h = 26,
): void {
  const y = target.y;
  scene.tweens.add({
    targets: target,
    y: y - h,
    duration: motion(160),
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => {
      target.y = y;
    },
  });
}

/** Puntitos de progreso de rondas (arriba a la derecha, debajo del medidor). */
export class RoundDots {
  private readonly dots: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, total: number, rightX = 1240, y = 112) {
    if (total < 2) return;
    for (let i = 0; i < total; i++) {
      this.dots.push(
        scene.add
          .circle(rightX - (total - 1 - i) * 40, y, 13, COLORS.white)
          .setStrokeStyle(4, COLORS.ink)
          .setDepth(100),
      );
    }
  }

  mark(i: number): void {
    this.dots[i]?.setFillStyle(COLORS.grass);
  }
}

/** Fisher–Yates sin modificar el original. */
export function shuffled<T>(list: readonly T[]): T[] {
  return Phaser.Utils.Array.Shuffle([...list]);
}
