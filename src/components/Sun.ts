import Phaser from 'phaser';
import { artImage } from '@/art/Art';
import { prefersReducedMotion } from '@/core/Device';

/**
 * Sol animado igual al de la portada: los rayos giran despacio y la carita se queda
 * derecha, "respirando". Se usa en todos los juegos donde aparece el sol.
 */
export function addSun(scene: Phaser.Scene, x: number, y: number, scale = 1): Phaser.GameObjects.Container {
  const rays = artImage(scene, 0, 0, 'sol-rayos');
  const face = artImage(scene, 0, 0, 'sol-cara');
  const sun = scene.add.container(x, y, [rays, face]).setScale(scale);
  if (!prefersReducedMotion()) {
    scene.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
    scene.tweens.add({
      targets: face,
      scale: 1.05,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  return sun;
}
