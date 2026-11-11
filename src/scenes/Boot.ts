import Phaser from 'phaser';
import { GameState } from '@/core/GameState';

/** Arranque mínimo: inicializa el estado y pasa a Preload. Va en el bundle inicial. */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // Acceder al singleton fuerza la lectura del guardado una sola vez.
    void GameState.totalStars;
    this.resetFromUrl();
    this.scene.start('Preload');
  }

  /**
   * Atajo para pruebas y para la presentación: abrir el juego con "?reiniciar" al final
   * de la dirección borra el progreso (conserva el volumen) y limpia la dirección.
   */
  private resetFromUrl(): void {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('reiniciar')) return;
      GameState.resetProgress();
      url.searchParams.delete('reiniciar');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {
      // Navegador sin soporte de URL/history: se usa el modo maestro para reiniciar.
    }
  }
}
