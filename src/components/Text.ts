import type Phaser from 'phaser';
import { CSS, FONTS, TEXT_RESOLUTION } from '@/config/theme';

export interface TextOptions {
  color?: string;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  stroke?: string;
  strokeThickness?: number;
}

function style(
  family: string,
  size: number,
  weight: string,
  opts: TextOptions,
): Phaser.Types.GameObjects.Text.TextStyle {
  const s: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: family,
    fontSize: `${size}px`,
    fontStyle: weight,
    color: opts.color ?? CSS.ink,
    align: opts.align ?? 'center',
    resolution: TEXT_RESOLUTION,
    // Baloo 2 tiene acentos altos: el padding evita que se recorten.
    padding: { top: Math.round(size * 0.15), bottom: Math.round(size * 0.05) },
  };
  if (opts.wrap) s.wordWrap = { width: opts.wrap, useAdvancedWrap: true };
  if (opts.stroke) {
    s.stroke = opts.stroke;
    s.strokeThickness = opts.strokeThickness ?? Math.round(size / 8);
  }
  return s;
}

/** Título con Baloo 2 (origen centrado). */
export function addTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 64,
  opts: TextOptions = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, style(FONTS.title, size, '800', opts)).setOrigin(0.5);
}

/** Texto de apoyo con Nunito (origen centrado). */
export function addBody(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 28,
  opts: TextOptions = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, style(FONTS.body, size, '800', opts)).setOrigin(0.5);
}
