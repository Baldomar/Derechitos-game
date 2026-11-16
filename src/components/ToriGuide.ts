import type Phaser from 'phaser';
import { DEPTH } from '@/config/theme';
import { SpeechBubble } from './SpeechBubble';
import { Tori } from './Tori';

/**
 * Tamaño y lugar únicos de Tori y su globo en la parte de abajo de las pantallas
 * (mapa, juegos, desafíos, derechos, medallas, premio y diploma): Tori pequeño y un
 * globo compacto a su derecha, para que se vea igual en todos lados.
 */
export const TORI_GUIDE = {
  tori: { x: 268, y: 654, scale: 0.4 },
  bubble: { x: 636, y: 664, width: 560, fontSize: 18 },
} as const;

export function addToriGuide(scene: Phaser.Scene): { tori: Tori; bubble: SpeechBubble } {
  const t = TORI_GUIDE.tori;
  const b = TORI_GUIDE.bubble;
  const tori = new Tori(scene, t.x, t.y, t.scale).setDepth(DEPTH.ui + 5);
  const bubble = new SpeechBubble(scene, b.x, b.y, {
    width: b.width,
    tail: 'left',
    tori,
    fontSize: b.fontSize,
    compact: true,
  });
  return { tori, bubble };
}
