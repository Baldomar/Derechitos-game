import type Phaser from 'phaser';

/**
 * "Hornea" un dibujo estático de Graphics en una textura reutilizable.
 * Un Graphics se vuelve a teselar en CADA cuadro; una Image no. En celulares de gama baja
 * esto es la diferencia entre 30 y 60 FPS. Las texturas se cachean por clave entre escenas.
 *
 * @param draw dibuja en coordenadas 0..w, 0..h
 * @param replace true si el contenido cambia entre visitas (p. ej. el camino del mapa)
 */
export function bakedTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
  replace = false,
): string {
  if (scene.textures.exists(key)) {
    if (!replace) return key;
    scene.textures.remove(key);
  }
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, Math.ceil(w), Math.ceil(h));
  g.destroy();
  return key;
}
