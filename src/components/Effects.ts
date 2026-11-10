import Phaser from 'phaser';
import { COLORS, DEPTH, GAME_WIDTH } from '@/config/theme';
import { TEX } from '@/core/Textures';
import { motion, prefersReducedMotion } from '@/core/Device';

const CONFETTI_COLORS = [
  COLORS.coral,
  COLORS.sun,
  COLORS.turquoise,
  COLORS.grape,
  COLORS.grass,
  COLORS.pink,
];

/**
 * Efectos visuales de acierto y celebración.
 * Las partículas usan los emisores de Phaser, que reciclan partículas (object pooling):
 * no se crean objetos nuevos en cada estallido. Las palomitas de acierto también se reciclan.
 */
export class Effects {
  private readonly scene: Phaser.Scene;
  private readonly confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparkles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly checkPool: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.confetti = scene.add
      .particles(0, 0, TEX.confetti, {
        emitting: false,
        lifespan: 1700,
        speed: { min: 320, max: 680 },
        angle: { min: 235, max: 305 },
        gravityY: 950,
        rotate: { start: 0, end: 540 },
        scaleX: { min: 0.8, max: 1.3 },
        alpha: { start: 1, end: 0.6 },
        tint: CONFETTI_COLORS,
        maxAliveParticles: 160,
      })
      .setDepth(DEPTH.overlay);

    this.sparkles = scene.add
      .particles(0, 0, TEX.sparkle, {
        emitting: false,
        lifespan: 650,
        speed: { min: 120, max: 320 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.1, end: 0 },
        rotate: { min: 0, max: 90 },
        tint: [COLORS.sun, COLORS.white, COLORS.sun],
        maxAliveParticles: 80,
      })
      .setDepth(DEPTH.overlay);
  }

  private count(n: number): number {
    return prefersReducedMotion() ? Math.ceil(n / 4) : n;
  }

  sparkleAt(x: number, y: number, n = 14): void {
    this.sparkles.explode(this.count(n), x, y);
  }

  confettiAt(x: number, y: number, n = 40): void {
    this.confetti.explode(this.count(n), x, y);
  }

  /** Celebración grande: cañones de confeti a lo ancho de la pantalla. */
  celebrate(): void {
    const xs = [GAME_WIDTH * 0.15, GAME_WIDTH * 0.38, GAME_WIDTH * 0.62, GAME_WIDTH * 0.85];
    xs.forEach((x, i) => {
      this.scene.time.delayedCall(i * 120, () => this.confettiAt(x, 760, 35));
    });
  }

  /** Acierto: destellos + palomita (forma e ícono, no solo color). */
  successAt(x: number, y: number): void {
    this.sparkleAt(x, y);
    const check = this.checkPool.find((c) => !c.visible) ?? this.newCheck();
    this.scene.tweens.killTweensOf(check);
    check
      .setPosition(x, y - 70)
      .setScale(0)
      .setAlpha(1)
      .setVisible(true);
    this.scene.tweens.chain({
      targets: check,
      tweens: [
        { scale: 1, duration: motion(260), ease: 'Back.easeOut' },
        { alpha: 0, y: y - 100, delay: 450, duration: motion(300) },
      ],
      onComplete: () => check.setVisible(false),
    });
  }

  private newCheck(): Phaser.GameObjects.Image {
    const img = this.scene.add
      .image(0, 0, TEX.check)
      .setDepth(DEPTH.overlay + 1)
      .setVisible(false);
    this.checkPool.push(img);
    return img;
  }
}
