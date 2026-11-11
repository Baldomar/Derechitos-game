/** Utilidades del dispositivo: movimiento reducido y vibración. */

let reducedMotionQuery: MediaQueryList | null = null;
try {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
} catch {
  reducedMotionQuery = null;
}

/** true si el sistema pide reducir animaciones. Se consulta en vivo. */
export function prefersReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false;
}

/** Escala una duración de animación según la preferencia de movimiento. */
export function motion(ms: number): number {
  return prefersReducedMotion() ? Math.min(ms, 120) : ms;
}

/** Vibración suave, solo si el dispositivo la soporta. */
export function vibrate(pattern: number | number[] = 25): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Algunos navegadores lanzan error si no hubo interacción previa: se ignora.
  }
}

/** ¿Es un dispositivo táctil (celular o tablet)? */
export function isTouchDevice(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  } catch {
    return false;
  }
}

/**
 * En celulares: pantalla completa (oculta la barra del navegador) y orientación horizontal.
 * Debe llamarse dentro de un toque del usuario (p. ej. al presionar "¡Jugar!").
 * En iPhone no existe la API de pantalla completa: simplemente no hace nada.
 */
export function enterImmersive(scale: {
  isFullscreen: boolean;
  startFullscreen: (o?: FullscreenOptions) => void;
}): void {
  if (!isTouchDevice()) return;
  try {
    if (!scale.isFullscreen && document.fullscreenEnabled)
      scale.startFullscreen({ navigationUI: 'hide' });
  } catch {
    // Sin pantalla completa disponible: se sigue jugando normal.
  }
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (o: 'landscape') => Promise<void>;
  };
  if (orientation?.lock) {
    // Solo funciona en pantalla completa o con la app instalada; si falla, no pasa nada.
    window.setTimeout(() => void orientation.lock?.('landscape').catch(() => undefined), 300);
  }
}
