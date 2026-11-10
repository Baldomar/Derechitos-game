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
    this.scene.start('Preload');
  }
}
