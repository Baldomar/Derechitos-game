import Phaser from 'phaser';
import { COLORS, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import { motion, prefersReducedMotion } from './Device';
import { AudioManager } from './AudioManager';
import { SCENE_LOADERS, type LazySceneKey, type SceneKey } from './SceneRegistry';

/**
 * Transición tipo "burbuja": un círculo turquesa cubre la pantalla, se carga la
 * escena destino (chunk bajo demanda) y el círculo se encoge para revelarla.
 * Todos los objetos y tweens pertenecen a la escena, así que Phaser los destruye al salir.
 */

const RADIUS = Math.hypot(GAME_WIDTH, GAME_HEIGHT) / 2 + 24;
let busy = false;

/** Registra la escena en el juego si aún no existe (descarga su chunk). */
export async function ensureScene(game: Phaser.Game, key: SceneKey): Promise<void> {
  if (game.scene.keys[key]) return;
  const loader = SCENE_LOADERS[key as LazySceneKey] as
    (typeof SCENE_LOADERS)[LazySceneKey] | undefined;
  if (!loader) throw new Error(`Escena no registrada: ${key}`);
  const mod = await loader();
  if (!game.scene.keys[key]) game.scene.add(key, mod.default, false);
  // Si Phaser estaba procesando un frame, la escena queda en cola: se espera al siguiente.
  while (!game.scene.keys[key]) {
    await new Promise<void>((resolve) => game.events.once(Phaser.Core.Events.POST_STEP, resolve));
  }
}

/** Descarga en segundo plano el código de una escena (p. ej. el nivel siguiente). */
export function prefetchScene(key: LazySceneKey): void {
  SCENE_LOADERS[key]().catch(() => {
    // Sin conexión: se reintentará al entrar a la escena.
  });
}

/** Bloquea toques mientras dura la transición. */
function addBlocker(scene: Phaser.Scene): Phaser.GameObjects.Zone {
  return scene.add
    .zone(0, 0, GAME_WIDTH, GAME_HEIGHT)
    .setOrigin(0)
    .setDepth(DEPTH.transition)
    .setInteractive();
}

function addBubble(scene: Phaser.Scene): Phaser.GameObjects.Arc {
  return scene.add
    .circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, RADIUS, COLORS.turquoise)
    .setDepth(DEPTH.transition + 1);
}

/** Puntitos que rebotan si la carga tarda (red lenta). */
function addLoadingDots(scene: Phaser.Scene): void {
  const dots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < 3; i++) {
    dots.push(
      scene.add
        .circle(GAME_WIDTH / 2 + (i - 1) * 44, GAME_HEIGHT / 2, 12, COLORS.white)
        .setDepth(DEPTH.transition + 2)
        .setAlpha(0),
    );
  }
  scene.tweens.add({ targets: dots, alpha: 1, delay: 350, duration: 200 });
  if (!prefersReducedMotion()) {
    dots.forEach((dot, i) =>
      scene.tweens.add({
        targets: dot,
        y: GAME_HEIGHT / 2 - 18,
        duration: 300,
        delay: i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
  }
}

/**
 * Con la pantalla ya cubierta, la escena anterior deja de dibujarse y animarse:
 * así la descarga de la escena siguiente no compite con el render (clave en celulares lentos).
 */
function quiet(scene: Phaser.Scene, keep: Phaser.GameObjects.GameObject): void {
  scene.tweens.getTweens().forEach((t) => t.pause());
  scene.children.each((child) => {
    if (child !== keep && 'setVisible' in child)
      (child as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
  });
}

function cover(scene: Phaser.Scene): Promise<void> {
  return new Promise((resolve) => {
    addBlocker(scene);
    const bubble = addBubble(scene);
    const done = (): void => {
      quiet(scene, bubble);
      resolve();
    };
    if (prefersReducedMotion()) {
      bubble.setAlpha(0);
      scene.tweens.add({ targets: bubble, alpha: 1, duration: 120, onComplete: done });
      return;
    }
    bubble.setScale(0);
    scene.tweens.add({
      targets: bubble,
      scale: 1,
      duration: 380,
      ease: 'Cubic.easeIn',
      onComplete: done,
    });
  });
}

function reveal(scene: Phaser.Scene): void {
  const blocker = addBlocker(scene);
  const bubble = addBubble(scene);
  const done = (): void => {
    bubble.destroy();
    blocker.destroy();
  };
  if (prefersReducedMotion()) {
    scene.tweens.add({ targets: bubble, alpha: 0, duration: 120, onComplete: done });
    return;
  }
  scene.tweens.add({
    targets: bubble,
    scale: 0,
    duration: motion(450),
    ease: 'Back.easeIn',
    onComplete: done,
  });
}

/**
 * Cambia de escena con transición animada.
 * Ignora llamadas repetidas (doble toque) mientras una transición está en curso.
 */
export async function goTo(from: Phaser.Scene, key: SceneKey, data?: object): Promise<void> {
  if (busy) return;
  busy = true;
  AudioManager.stopVoice();
  try {
    await cover(from);
    addLoadingDots(from);
    await ensureScene(from.game, key);
    const target = from.scene.get(key);
    target.events.once(Phaser.Scenes.Events.CREATE, () => reveal(target));
    from.scene.start(key, data);
  } catch (err) {
    console.error('[SceneTransition]', err);
    // Causa típica: se publicó una versión nueva mientras se jugaba y los archivos viejos ya no
    // existen. Se recarga UNA vez para tomar la versión nueva (el progreso está guardado).
    if (!reloadedOnce()) {
      window.location.reload();
      return;
    }
    // Sin conexión y sin caché: se vuelve a la escena actual (nunca una pantalla de error).
    from.scene.restart();
  } finally {
    busy = false;
  }
}

/** Marca (por sesión) que ya se recargó una vez, para no entrar en un ciclo de recargas. */
function reloadedOnce(): boolean {
  const KEY = 'derechitos.reloaded';
  try {
    if (window.sessionStorage.getItem(KEY)) return true;
    window.sessionStorage.setItem(KEY, '1');
    return false;
  } catch {
    return true;
  }
}

/** Para la primera escena (sin escena previa): solo revela. */
export function revealOnCreate(scene: Phaser.Scene): void {
  reveal(scene);
}
