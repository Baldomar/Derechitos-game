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
