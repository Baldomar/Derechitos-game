import Phaser from 'phaser';
import { DEPTH } from '@/config/theme';
import { TEX } from '@/core/Textures';
import { motion } from '@/core/Device';
import type { Point } from './DropZone';

export type HintTarget =
  { kind: 'tap'; x: number; y: number } | { kind: 'drag'; from: Point; to: Point };

/** Manita animada que muestra qué hacer: tocar o arrastrar. */
export class HelperHand extends Phaser.GameObjects.Container {
  private readonly hand: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private chain: Phaser.Tweens.TweenChain | null = null;
  private resolveShow: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.ring = scene.add.image(0, 0, TEX.ring).setAlpha(0);
    // Origen en la punta del dedo índice.
    this.hand = scene.add.image(0, 0, TEX.hand).setOrigin(0.44, 0.03).setAngle(-18);
    this.add([this.ring, this.hand]);
    this.setDepth(DEPTH.overlay + 10).setVisible(false);
    scene.add.existing(this);
  }

  private ripple(): void {
    this.ring.setScale(0.4).setAlpha(1);
    this.scene.tweens.add({ targets: this.ring, scale: 1.5, alpha: 0, duration: motion(450) });
  }

  /** Muestra la ayuda. Resuelve al terminar o al ocultarse. */
  show(target: HintTarget): Promise<void> {
    this.hide();
    return new Promise((resolve) => {
      this.resolveShow = resolve;
      const t = this.scene.tweens;
      this.setVisible(true).setAlpha(0);
      this.hand.setScale(1).setPosition(0, 0);

      if (target.kind === 'tap') {
        this.setPosition(target.x, target.y);
        this.hand.setPosition(50, 60);
        this.chain = t.chain({
          tweens: [
            { targets: this, alpha: 1, duration: motion(200) },
            { targets: this.hand, x: 0, y: 0, duration: motion(400), ease: 'Cubic.easeOut' },
            {
              targets: this.hand,
              scale: 0.85,
              duration: motion(150),
              yoyo: true,
              repeat: 2,
              repeatDelay: 350,
              onYoyo: () => this.ripple(),
            },
            { targets: this, alpha: 0, delay: 200, duration: motion(250) },
          ],
          onComplete: () => this.finish(),
        });
      } else {
        const { from, to } = target;
        this.setPosition(from.x, from.y);
        this.chain = t.chain({
          loop: 1,
          tweens: [
            { targets: this, x: from.x, y: from.y, alpha: 1, duration: motion(250) },
            {
              targets: this.hand,
              scale: 0.85,
              duration: motion(150),
              onComplete: () => this.ripple(),
            },
            { targets: this, x: to.x, y: to.y, duration: motion(900), ease: 'Sine.easeInOut' },
            { targets: this.hand, scale: 1, duration: motion(150) },
            { targets: this, alpha: 0, delay: 150, duration: motion(250) },
          ],
          onComplete: () => this.finish(),
        });
      }
    });
  }

  private finish(): void {
    this.chain = null;
    this.setVisible(false);
    const r = this.resolveShow;
    this.resolveShow = null;
    r?.();
  }

  hide(): void {
    if (this.chain) {
      this.chain.stop();
      this.chain = null;
    }
    if (this.visible) this.finish();
    else {
      const r = this.resolveShow;
      this.resolveShow = null;
      r?.();
    }
  }
}

/**
 * Ayuda automática: si no hay interacción en 8 s, muestra la manita sobre lo que hay que hacer.
 * Cualquier toque reinicia la cuenta. Se limpia sola al salir de la escena.
 */
export class IdleHint {
  private readonly scene: Phaser.Scene;
  private readonly hand: HelperHand;
  private readonly getTarget: () => HintTarget | null;
  private readonly onHint: (() => void) | undefined;
  private readonly delay: number;
  private timer: Phaser.Time.TimerEvent | null = null;
  private paused = false;

  constructor(
    scene: Phaser.Scene,
    getTarget: () => HintTarget | null,
    opts: { delay?: number; onHint?: () => void } = {},
  ) {
    this.scene = scene;
    this.getTarget = getTarget;
    this.onHint = opts.onHint;
    this.delay = opts.delay ?? 8000;
    this.hand = new HelperHand(scene);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.reset, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.reset, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.arm();
  }

  /** Reinicia la cuenta (cualquier interacción). */
  reset(): void {
    this.hand.hide();
    this.arm();
  }

  /** Arrastrar despacio también cuenta como interacción (con límite para no reiniciar en cada frame). */
  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    if (!this.timer || this.timer.getElapsed() > 250) this.reset();
  }

  pause(): void {
    this.paused = true;
    this.timer?.remove();
    this.timer = null;
    this.hand.hide();
  }

  resume(): void {
    this.paused = false;
    this.arm();
  }

  private arm(): void {
    this.timer?.remove();
    this.timer = null;
    if (this.paused) return;
    this.timer = this.scene.time.delayedCall(this.delay, () => void this.fire());
  }

  private async fire(): Promise<void> {
    const target = this.getTarget();
    if (!target) {
      this.arm();
      return;
    }
    this.onHint?.();
    await this.hand.show(target);
    if (!this.paused) this.arm();
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.reset, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.reset, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.timer?.remove();
    this.timer = null;
  }
}
