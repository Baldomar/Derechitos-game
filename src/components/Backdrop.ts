import type Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import { bakedTexture } from '@/core/Bake';
import { setPageBackground } from '@/core/PageBackground';

export interface BackdropOptions {
  sky?: number;
  grass?: boolean;
  clouds?: boolean;
}

/**
 * Fondo vectorial: cielo, nubes y colinas. Se dibuja una sola vez en una textura
 * (cacheada por combinación de opciones) y se muestra como Image: barato en cada cuadro.
 */
export function addBackdrop(
  scene: Phaser.Scene,
  opts: BackdropOptions = {},
): Phaser.GameObjects.Image {
  const sky = opts.sky ?? COLORS.sky;
  const clouds = opts.clouds ?? true;
  const grass = opts.grass ?? true;
  const key = `backdrop-${sky.toString(16)}-${clouds ? 1 : 0}-${grass ? 1 : 0}`;
  bakedTexture(scene, key, GAME_WIDTH, GAME_HEIGHT, (g) => {
    g.fillStyle(sky).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    if (clouds) {
      g.fillStyle(COLORS.white, 0.85);
      const list: [number, number, number][] = [
        [180, 110, 1],
        [620, 70, 0.8],
        [1060, 130, 1.1],
      ];
      for (const [x, y, s] of list) {
        g.fillCircle(x, y, 38 * s);
        g.fillCircle(x + 44 * s, y - 14 * s, 46 * s);
        g.fillCircle(x + 92 * s, y, 36 * s);
        g.fillRoundedRect(x - 10 * s, y, 124 * s, 34 * s, 17 * s);
      }
    }
    if (grass) {
      // Las colinas no tocan los bordes: ahí el pasto empieza siempre en GROUND_Y,
      // para que continúe sin cortes en las franjas laterales de la pantalla.
      g.fillStyle(COLORS.grassDark).fillEllipse(380, GAME_HEIGHT + 40, 760, 300);
      g.fillStyle(COLORS.grass).fillEllipse(900, GAME_HEIGHT + 40, 900, 300);
      g.fillStyle(COLORS.grass).fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    }
  });
  setPageBackground(grass ? { top: sky, bottom: COLORS.grass, split: GROUND_Y } : { top: sky });
  return scene.add.image(0, 0, key).setOrigin(0);
}

/** Altura donde empieza el pasto del fondo en los bordes de la pantalla. */
export const GROUND_Y = GAME_HEIGHT - 90;
