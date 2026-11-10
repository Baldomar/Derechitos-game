import Phaser from 'phaser';
import { COLORS, DEPTH } from '@/config/theme';
import { AudioManager } from '@/core/AudioManager';
import { motion, vibrate } from '@/core/Device';
import { addStarIcon } from './Icons';
import { addTitle } from './Text';
import type { Point } from './DropZone';
import type { Effects } from './Effects';

/** Contador de estrellas (HUD). */
export class StarCounter extends Phaser.GameObjects.Container {
  private value: number;
  private readonly max: number | null;
  private readonly icon: Phaser.GameObjects.Star;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, initial = 0, max: number | null = null) {
    super(scene, x, y);
    this.value = initial;
    this.max = max;
    const w = max === null ? 170 : 230;
    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -42, w, 84, 30);
    panel.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -42, w, 84, 30);
    this.icon = addStarIcon(scene, -w / 2 + 45, 0, 26, true);
    this.label = addTitle(scene, 22, 2, this.text(), 40);
    this.add([panel, this.icon, this.label]);
    this.setDepth(DEPTH.ui);
    scene.add.existing(this);
  }

  private text(): string {
    return this.max === null ? `${this.value}` : `${this.value} / ${this.max}`;
  }

  /** Posición del ícono en coordenadas de escena (destino de las estrellas). */
  get target(): Point {
    return { x: this.x + this.icon.x * this.scaleX, y: this.y + this.icon.y * this.scaleY };
  }

  increment(n = 1): void {
    this.value += n;
    this.label.setText(this.text());
    this.scene.tweens.killTweensOf([this.icon, this.label]);
    this.icon.setScale(1.5);
    this.scene.tweens.add({
      targets: this.icon,
      scale: 1,
      duration: motion(380),
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.label,
      scale: { from: 1.25, to: 1 },
      duration: motion(300),
    });
  }
}

function bezier(a: number, c: number, b: number, t: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * c + t * t * b;
}

/**
 * Estrellas que vuelan desde el reto hasta el contador, con sonido ascendente.
 * Resuelve cuando llega la última.
 */
export function flyStars(
  scene: Phaser.Scene,
  from: Point,
  counter: StarCounter,
  count: number,
  effects?: Effects,
): Promise<void> {
  return new Promise((resolve) => {
    if (count <= 0) {
      resolve();
      return;
    }
    let arrived = 0;
    for (let i = 0; i < count; i++) {
      const star = addStarIcon(scene, from.x, from.y, 30, true)
        .setDepth(DEPTH.overlay + 5)
        .setScale(0);
      const to = counter.target;
      const ctrl = {
        x: (from.x + to.x) / 2 + Phaser.Math.Between(-140, 140),
        y: Math.min(from.y, to.y) - 200,
      };
      const delay = i * 260;
      scene.tweens.add({
        targets: star,
        scale: 1.3,
        duration: motion(200),
        delay,
        ease: 'Back.easeOut',
      });
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        delay: delay + 200,
        duration: motion(750),
        ease: 'Sine.easeIn',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          star.setPosition(bezier(from.x, ctrl.x, to.x, t), bezier(from.y, ctrl.y, to.y, t));
          star.setAngle(t * 360).setScale(1.3 - 0.6 * t);
        },
        onComplete: () => {
          star.destroy();
          counter.increment();
          AudioManager.sfx('star', { index: i });
          vibrate(15);
          effects?.sparkleAt(to.x, to.y, 8);
          arrived += 1;
          if (arrived === count) resolve();
        },
      });
    }
  });
}
