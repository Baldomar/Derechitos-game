import type Phaser from 'phaser';
import { enterImmersive } from './Device';

/** ¿El navegador puede ponerse en pantalla completa y fijar la orientación? (Android sí, iPhone no). */
function canLockLandscape(): boolean {
  try {
    const o = screen.orientation as (ScreenOrientation & { lock?: unknown }) | undefined;
    return !!o && typeof o.lock === 'function' && !!document.fullscreenEnabled;
  } catch {
    return false;
  }
}

/** iPhone / iPad con Safari (también iPad que se anuncia como Mac). */
function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** ¿Se abrió desde el ícono en la pantalla de inicio (app instalada)? */
function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/**
 * Que el juego se vea igual en cualquier celular o tablet, siempre en horizontal:
 * - Android (Samsung, Xiaomi, Honor, Motorola…): al primer toque en cualquier parte se pone en
 *   pantalla completa y gira solo a horizontal. Si el niño sale, vuelve a intentarlo al tocar.
 * - En vertical se muestra "¡Gira tu celular!" (con botón "Girar pantalla" donde se puede).
 * - iPhone no permite girar ni pantalla completa desde una página: se pide girarlo y se sugiere
 *   agregarlo a la pantalla de inicio (así se ve sin las barras de Safari).
 * - Al girar, el lienzo se reajusta (algunos navegadores avisan tarde del nuevo tamaño).
 */
export function initOrientation(game: Phaser.Game): void {
  const lockable = canLockLandscape();

  const btn = document.getElementById('rotate-now');
  if (btn) {
    btn.hidden = !lockable;
    btn.addEventListener('click', () => enterImmersive(game.scale));
  }
  const iosHint = document.getElementById('rotate-ios');
  if (iosHint) iosHint.hidden = !(isIOS() && !isStandalone());

  // Primer toque (y los siguientes, si se salió): pantalla completa + horizontal.
  let last = 0;
  window.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType !== 'touch' || !lockable || game.scale.isFullscreen) return;
      const now = Date.now();
      if (now - last < 1500) return;
      last = now;
      enterImmersive(game.scale);
    },
    true,
  );

  // Reajuste tras girar o cambiar el tamaño visible (barra del navegador que aparece/desaparece).
  let timer = 0;
  const refresh = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => game.scale.refresh(), 250);
  };
  window.addEventListener('orientationchange', refresh);
  try {
    screen.orientation?.addEventListener('change', refresh);
  } catch {
    // Navegadores antiguos: basta con "orientationchange".
  }
  window.visualViewport?.addEventListener('resize', refresh);
}
