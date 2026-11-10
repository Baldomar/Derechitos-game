import type Phaser from 'phaser';
import { COLORS } from '@/config/theme';

/** Estrella vectorial. Llena = ganada; vacía = contorno (forma distinta, no solo color). */
export function addStarIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  filled: boolean,
): Phaser.GameObjects.Star {
  const star = scene.add.star(
    x,
    y,
    5,
    size * 0.45,
    size,
    filled ? COLORS.sun : COLORS.white,
    filled ? 1 : 0.35,
  );
  star.setStrokeStyle(Math.max(2, size * 0.14), COLORS.ink, filled ? 1 : 0.45);
  return star;
}

/** Candado vectorial para zonas bloqueadas. */
export function addLockIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size = 1,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.lineStyle(7 * size, COLORS.ink).beginPath();
  g.arc(0, -8 * size, 13 * size, Math.PI, 0);
  g.strokePath();
  g.fillStyle(COLORS.ink).fillRoundedRect(-19 * size, -8 * size, 38 * size, 30 * size, 6 * size);
  g.fillStyle(COLORS.sun).fillCircle(0, 5 * size, 5 * size);
  return g;
}
