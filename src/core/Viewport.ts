import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';

/**
 * Pantalla completa sin franjas (Scale.EXPAND):
 * el lienzo ocupa toda la pantalla y el área de diseño (1280x720) queda SIEMPRE centrada.
 * Lo que sobra a los lados (pantallas panorámicas) o arriba/abajo (vertical) muestra el
 * paisaje extendido de cada escena. Todo el contenido interactivo vive dentro de 1280x720.
 */

/** Margen visible a cada lado del área de diseño, en coordenadas del juego. */
export function viewportMargin(game: Phaser.Game): { x: number; y: number } {
  return {
    x: Math.max(0, (game.scale.width - GAME_WIDTH) / 2),
    y: Math.max(0, (game.scale.height - GAME_HEIGHT) / 2),
  };
}

function sync(game: Phaser.Game): void {
  const { x, y } = viewportMargin(game);
  const w = game.scale.width;
  const h = game.scale.height;
  for (const scene of game.scene.getScenes(true)) {
    const cam = scene.cameras?.main;
    if (!cam) continue;
    if (cam.width !== w || cam.height !== h) cam.setSize(w, h);
    if (cam.scrollX !== -x || cam.scrollY !== -y) cam.setScroll(-x, -y);
  }
}

/** Se llama una vez: mantiene centradas las cámaras de todas las escenas activas. */
export function initViewport(game: Phaser.Game): void {
  game.events.on(Phaser.Core.Events.PRE_RENDER, () => sync(game));
}
