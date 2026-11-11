import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';

/**
 * Extiende el paisaje de cada escena más allá del área de diseño (1280x720) para que
 * el fondo cubra toda la pantalla en cualquier proporción (panorámica, tablet, vertical).
 *
 * Cada lado (izquierdo/derecho) es un "corte": color de arriba, color de abajo y la altura
 * (en coordenadas del juego, 0–720) donde empieza el suelo. Se dibuja con rectángulos
 * grandes detrás de todo (muy baratos de renderizar).
 */
export interface Band {
  top: number;
  bottom?: number;
  /** Altura del suelo en coordenadas del juego (0–720). */
  split?: number;
}

const BIG = 4000; // más que cualquier margen posible
const BLEED_DEPTH = -100;
const bleeds = new WeakMap<Phaser.Scene, Phaser.GameObjects.Rectangle[]>();

function side(
  scene: Phaser.Scene,
  b: Band,
  x0: number,
  x1: number,
): Phaser.GameObjects.Rectangle[] {
  const w = x1 - x0;
  const rects: Phaser.GameObjects.Rectangle[] = [];
  if (b.bottom === undefined || b.split === undefined) {
    rects.push(scene.add.rectangle(x0, -BIG, w, BIG * 2 + GAME_HEIGHT, b.top).setOrigin(0));
  } else {
    rects.push(scene.add.rectangle(x0, -BIG, w, BIG + b.split, b.top).setOrigin(0));
    rects.push(
      scene.add.rectangle(x0, b.split, w, BIG + GAME_HEIGHT - b.split, b.bottom).setOrigin(0),
    );
  }
  return rects;
}

/**
 * Define el paisaje de borde de la escena (si `right` se omite, es igual a `left`).
 * Las mitades se encuentran en el centro, así arriba/abajo (pantalla vertical) también se cubre.
 */
export function setPageBackground(scene: Phaser.Scene, left: Band, right: Band = left): void {
  bleeds.get(scene)?.forEach((r) => r.destroy());
  const mid = GAME_WIDTH / 2;
  const rects = [...side(scene, left, -BIG, mid), ...side(scene, right, mid, GAME_WIDTH + BIG)];
  rects.forEach((r) => r.setDepth(BLEED_DEPTH));
  bleeds.set(scene, rects);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bleeds.delete(scene));
  // Color de respaldo de la página (por si el lienzo tarda en ajustarse).
  document.body.style.background = `#${left.top.toString(16).padStart(6, '0')}`;
}
