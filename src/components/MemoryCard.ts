import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { tex, type ArtKey } from '@/art/Art';
import { addStarIcon } from '@/components/Icons';
import { addBody } from '@/components/Text';
import { motion } from '@/core/Device';

export interface MemoryCardOptions {
  w: number;
  h: number;
  art: ArtKey;
  label: string;
  /** Color del reverso. */
  backColor: number;
  /** Franja de color arriba y abajo del frente (opcional). */
  accent?: number;
  /** Retraso de la animación de entrada (ms). */
  delay?: number;
}

/**
 * Carta de memorama. Cada animación tiene su propia capa, para que nunca se peleen:
 *  - el contenedor exterior (posición y aparición),
 *  - `pop` (salto al encontrar la pareja),
 *  - `flipper` (volteo, solo escala horizontal).
 * Así la carta siempre termina a su tamaño normal y con la cara correcta, aunque se toque
 * muy rápido o el celular sea lento. Las dos cartas de una pareja son idénticas.
 */
export class MemoryCard extends Phaser.GameObjects.Container {
  readonly id: string;
  private readonly pop: Phaser.GameObjects.Container;
  private readonly flipper: Phaser.GameObjects.Container;
  private readonly back: Phaser.GameObjects.Container;
  private readonly front: Phaser.GameObjects.Container;
  private faceUp = false;
  matched = false;

  constructor(scene: Phaser.Scene, x: number, y: number, id: string, opts: MemoryCardOptions) {
    super(scene, x, y);
    this.id = id;
    const { w, h } = opts;

    const backG = scene.add.graphics();
    backG.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 18);
    backG.fillStyle(opts.backColor).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    backG.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    backG
      .lineStyle(3, COLORS.white, 0.7)
      .strokeRoundedRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 12);
    this.back = scene.add.container(0, 0, [backG, addStarIcon(scene, 0, 0, 26, true)]);

    const frontG = scene.add.graphics();
    frontG.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 18);
    frontG.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    if (opts.accent !== undefined) {
      frontG
        .fillStyle(opts.accent)
        .fillRoundedRect(-w / 2, -h / 2, w, 16, { tl: 18, tr: 18, bl: 0, br: 0 });
    }
    frontG.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    // El dibujo siempre ocupa la misma caja, sin importar el tamaño original de la textura.
    const boxW = w - 26;
    const boxH = h - 62;
    const img = scene.add.image(0, -h / 2 + 18 + boxH / 2, tex(opts.art));
    img.setScale(Math.min(boxW / img.width, boxH / img.height));
    const label = addBody(scene, 0, h / 2 - 24, opts.label, w < 125 ? 17 : 18);
    if (label.width > w - 12) label.setScale((w - 12) / label.width);
    this.front = scene.add.container(0, 0, [frontG, img, label]).setVisible(false);

    this.flipper = scene.add.container(0, 0, [this.back, this.front]);
    this.pop = scene.add.container(0, 0, [this.flipper]);
    this.add(this.pop);
    this.setSize(w, h).setInteractive({ useHandCursor: true });
    scene.add.existing(this);

    // Aparición: solo el contenedor exterior cambia de escala.
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 1,
      delay: opts.delay ?? 0,
      duration: motion(300),
      ease: 'Back.easeOut',
      onComplete: () => this.setScale(1),
    });
  }

  get up(): boolean {
    return this.faceUp;
  }

  /** Voltea la carta. Resuelve cuando termina de girar. */
  flip(up: boolean): Promise<void> {
    this.faceUp = up;
    const scene = this.scene;
    scene.tweens.killTweensOf(this.flipper);
    return new Promise<void>((resolve) => {
      scene.tweens.chain({
        targets: this.flipper,
        tweens: [
          {
            scaleX: 0,
            duration: motion(110),
            ease: 'Quad.easeIn',
            onComplete: () => this.showFace(),
          },
          {
            scaleX: 1,
            duration: motion(110),
            ease: 'Quad.easeOut',
            onComplete: () => {
              this.flipper.setScale(1);
              resolve();
            },
          },
        ],
      });
      // Red de seguridad: si la escena se cierra a mitad del giro, no queda esperando.
      scene.time.delayedCall(motion(260) + 80, () => {
        this.showFace();
        if (this.flipper.active) this.flipper.setScale(1);
        resolve();
      });
    });
  }

  /** Saltito de alegría al encontrar la pareja. */
  celebrate(): void {
    this.scene.tweens.killTweensOf(this.pop);
    this.pop.setScale(1);
    this.scene.tweens.add({
      targets: this.pop,
      scale: { from: 1, to: 1.12 },
      duration: motion(150),
      yoyo: true,
      onComplete: () => this.pop.setScale(1),
    });
  }

  /** Muestra la cara que corresponde al estado actual. */
  private showFace(): void {
    if (!this.front.active) return;
    this.front.setVisible(this.faceUp);
    this.back.setVisible(!this.faceUp);
  }
}
