import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import { addBackdrop } from '@/components/Backdrop';
import { ensureScene, goTo } from '@/core/SceneTransition';
import { ensureTextures } from '@/core/Textures';
import { SCENE_LOADERS } from '@/core/SceneRegistry';

const FONT_TIMEOUT_MS = 2500;

/** Espera Baloo 2 y Nunito; si no llegan a tiempo (sin internet) se usan las de respaldo. */
function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('800 48px "Baloo 2"'),
    document.fonts.load('800 24px "Nunito"'),
  ]).then(
    () => undefined,
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, FONT_TIMEOUT_MS));
  return Promise.race([loads, timeout]);
}

/**
 * Carga lo común (fuentes, y en fases siguientes el atlas y audio compartidos)
 * y en paralelo descarga la escena de título.
 */
export default class PreloadScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Preload');
  }

  preload(): void {
    addBackdrop(this);
    this.bar = this.add.graphics();
    this.drawBar(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => this.drawBar(p * 0.8));
    // Aquí se agregarán los assets comunes (Fase 2: atlas de Tori y sprites de audio).
  }

  create(): void {
    ensureTextures(this);
    void this.continue();
  }

  private async continue(): Promise<void> {
    await Promise.all([waitForFonts(), ensureScene(this.game, 'Title')]);
    this.drawBar(1);
    await goTo(this, 'Title');
    // En desarrollo (npm start) cada escena son decenas de archivos sueltos: se descargan
    // todas en segundo plano mientras se ve el título. En producción solo se precarga el
    // nivel siguiente (los chunks ya vienen empaquetados).
    if (import.meta.env.DEV) {
      for (const load of Object.values(SCENE_LOADERS)) void load().catch(() => undefined);
    }
  }

  private drawBar(progress: number): void {
    const w = 420;
    const h = 28;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2 - h / 2;
    this.bar.clear();
    this.bar.fillStyle(COLORS.white, 0.7).fillRoundedRect(x, y, w, h, h / 2);
    this.bar.fillStyle(COLORS.turquoise).fillRoundedRect(x, y, Math.max(h, w * progress), h, h / 2);
    this.bar.lineStyle(4, COLORS.ink).strokeRoundedRect(x, y, w, h, h / 2);
  }
}
