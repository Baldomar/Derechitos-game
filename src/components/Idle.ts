import type Phaser from 'phaser';
import { prefersReducedMotion } from '@/core/Device';

/**
 * Animación sutil de "estar vivo" para personajes quietos: respiran (se estiran apenas
 * desde los pies) y se balancean un poquito, cada uno a su ritmo.
 * Cambia el origen de la imagen a los pies sin moverla de su lugar.
 */
export function breathe(scene: Phaser.Scene, img: Phaser.GameObjects.Image, i = 0): void {
  if (prefersReducedMotion()) return;
  const h = img.displayHeight;
  img.setOrigin(0.5, 1).setY(img.y + h / 2);
  const sx = img.scaleX;
  const sy = img.scaleY;
  scene.tweens.add({
    targets: img,
    scaleY: sy * 1.03,
    scaleX: sx * 0.99,
    duration: 1100 + (i % 4) * 140,
    delay: i * 170,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: img,
    angle: { from: -1.4, to: 1.4 },
    duration: 1900 + (i % 3) * 260,
    delay: i * 120,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
