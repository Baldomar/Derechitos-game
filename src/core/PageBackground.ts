import Phaser from 'phaser';
import { GAME_HEIGHT } from '@/config/theme';

/**
 * Pinta las franjas que quedan alrededor del juego (Scale.FIT) con el mismo paisaje
 * de la escena: así el fondo cubre toda la pantalla en cualquier proporción.
 *
 * Cada mitad (izquierda/derecha) es un "corte": color de arriba, color de abajo y la
 * altura (en coordenadas del juego, 0–720) donde empieza el suelo.
 */
export interface Band {
  top: number;
  bottom?: number;
  /** Altura del suelo en coordenadas del juego (0–720). */
  split?: number;
}

let game: Phaser.Game | null = null;
let left: Band = { top: 0x9fd9ff };
let right: Band = left;

const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

function layer(b: Band, side: 'left' | 'right', top: number, scale: number): string {
  if (b.bottom === undefined || b.split === undefined) {
    return `linear-gradient(${css(b.top)}, ${css(b.top)}) ${side} top / 50% 100% no-repeat`;
  }
  const y = Math.round(top + b.split * scale);
  return `linear-gradient(to bottom, ${css(b.top)} 0px, ${css(b.top)} ${y}px, ${css(b.bottom)} ${y}px, ${css(b.bottom)} 100%) ${side} top / 50% 100% no-repeat`;
}

function apply(): void {
  if (!game?.canvas) return;
  const r = game.canvas.getBoundingClientRect();
  const scale = r.height / GAME_HEIGHT;
  document.body.style.background = `${layer(left, 'left', r.top, scale)}, ${layer(right, 'right', r.top, scale)}`;
}

/** Se llama una vez al crear el juego. */
export function initPageBackground(g: Phaser.Game): void {
  game = g;
  const later = (): void => {
    requestAnimationFrame(apply);
  };
  g.scale.on(Phaser.Scale.Events.RESIZE, later);
  window.addEventListener('resize', later);
  window.addEventListener('orientationchange', later);
  later();
}

/** Cada escena define su paisaje de borde (si la derecha se omite, es igual a la izquierda). */
export function setPageBackground(l: Band, r: Band = l): void {
  left = l;
  right = r;
  apply();
}
