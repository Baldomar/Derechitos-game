/** Dimensiones lógicas del juego. Scale.FIT adapta esto a cualquier pantalla. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Área táctil mínima (px lógicos) para motricidad fina en desarrollo. */
export const MIN_TOUCH = 88;

/** Resolución de textos: nítidos en pantallas densas sin gastar memoria de más. */
export const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);

/** Paleta oficial (números para Phaser). */
export const COLORS = {
  sky: 0x9fd9ff,
  grass: 0x7fd06b,
  grassDark: 0x5fb04f,
  sun: 0xffc93c,
  coral: 0xff6f6f,
  turquoise: 0x2ec4bf,
  grape: 0x8b6cf6,
  ink: 0x2b2848,
  orange: 0xff8a3d,
  cream: 0xfff8e7,
  white: 0xffffff,
  sand: 0xf6dfa4,
  sea: 0x5cc3f0,
  pink: 0xff9ecf,
  locked: 0xb9c3cf,
} as const;

/** Misma paleta en formato CSS (para textos). */
export const CSS = {
  sky: '#9FD9FF',
  grass: '#7FD06B',
  sun: '#FFC93C',
  coral: '#FF6F6F',
  turquoise: '#2EC4BF',
  grape: '#8B6CF6',
  ink: '#2B2848',
  cream: '#FFF8E7',
  white: '#FFFFFF',
} as const;

export const FONTS = {
  title: '"Baloo 2", "Nunito", "Trebuchet MS", system-ui, sans-serif',
  body: '"Nunito", "Trebuchet MS", system-ui, sans-serif',
} as const;

/** Profundidades (z-index) compartidas. */
export const DEPTH = {
  ui: 100,
  overlay: 1000,
  transition: 10_000,
} as const;
