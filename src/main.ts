import Phaser from 'phaser';
import { CSS, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import BootScene from '@/scenes/Boot';
import PreloadScene from '@/scenes/Preload';
import { AudioManager } from '@/core/AudioManager';
import { initViewport } from '@/core/Viewport';

/**
 * Solo Boot y Preload van en el bundle inicial; el resto de escenas se descargan
 * bajo demanda desde SceneRegistry (división de código por escena).
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL con respaldo Canvas
  parent: 'game',
  backgroundColor: CSS.sky,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    // EXPAND: el lienzo llena toda la pantalla; el área 1280x720 queda centrada (core/Viewport).
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  // El audio lo maneja AudioManager (Web Audio propio con buses y ducking).
  audio: { noAudio: true },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  scene: [BootScene, PreloadScene],
};

AudioManager.init();
const game = new Phaser.Game(config);
initViewport(game);

// Solo en desarrollo: atajo para pruebas automáticas (no se incluye en el build de producción).
if (import.meta.env.DEV) {
  void import('@/core/SceneTransition').then(({ goTo }) => {
    (window as unknown as Record<string, unknown>).__game = game;
    (window as unknown as Record<string, unknown>).__goto = (key: string, data?: object) => {
      const active = game.scene.getScenes(true)[0];
      if (active) void goTo(active, key as never, data);
    };
  });
}
