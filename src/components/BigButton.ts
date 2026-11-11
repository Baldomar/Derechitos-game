import Phaser from 'phaser';
import { COLORS, CSS, FONTS, MIN_TOUCH, TEXT_RESOLUTION } from '@/config/theme';
import { motion, prefersReducedMotion } from '@/core/Device';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';

export interface BigButtonOptions {
  label: string;
  onClick: () => void;
  color?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  /** Late suavemente para llamar la atención (p. ej. "¡Jugar!"). */
  pulse?: boolean;
  /** Ícono circular a la izquierda del texto (p. ej. "play" en "¡Jugar!"). */
  icon?: 'play';
}

/**
 * Botón grande tipo "juguete": sombra sólida, squash al presionar y stretch elástico al soltar.
 * Área táctil mínima de 88 px. El texto siempre es tinta sobre color claro (contraste AA).
 */
export class BigButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Container;
  /** Texto del botón (para cambiar la etiqueta, p. ej. "Silenciar" / "Activar"). */
  readonly labelText: Phaser.GameObjects.Text;
  private readonly onClick: () => void;
  private pressed = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: BigButtonOptions) {
    super(scene, x, y);
    this.onClick = opts.onClick;

    const w = Math.max(opts.width ?? 300, MIN_TOUCH);
    const h = Math.max(opts.height ?? 104, MIN_TOUCH);
    const r = Math.min(h / 2, 36);
    const color = opts.color ?? COLORS.sun;

    // Sombra y cara se hornean en texturas (cacheadas por tamaño y color).
    const pad = 4;
    const shadowKey = bakedTexture(scene, `btn-shadow-${w}x${h}`, w + pad * 2, h + pad * 2, (g) => {
      g.fillStyle(COLORS.ink, 0.28).fillRoundedRect(pad, pad, w, h, r);
    });
    const faceKey = bakedTexture(
      scene,
      `btn-${w}x${h}-${color.toString(16)}`,
      w + pad * 2,
      h + pad * 2,
      (g) => {
        g.fillStyle(color).fillRoundedRect(pad, pad, w, h, r);
        g.lineStyle(5, COLORS.ink, 0.9).strokeRoundedRect(pad, pad, w, h, r);
        g.fillStyle(COLORS.white, 0.28).fillRoundedRect(pad + 14, pad + 8, w - 28, h * 0.32, r / 2);
      },
    );
    const shadow = scene.add.image(0, 10, shadowKey);
    const bg = scene.add.image(0, 0, faceKey);

    this.labelText = scene.add
      .text(0, 2, opts.label, {
        fontFamily: FONTS.title,
        fontSize: `${opts.fontSize ?? 44}px`,
        fontStyle: '800',
        color: CSS.ink,
        resolution: TEXT_RESOLUTION,
        padding: { top: 8 },
      })
      .setOrigin(0.5);

    const parts: Phaser.GameObjects.GameObject[] = [bg, this.labelText];
    if (opts.icon === 'play') {
      const d = Math.round(h * 0.56);
      const iconKey = bakedTexture(scene, `btn-icon-play-${d}`, d + 4, d + 4, (g) => {
        const c = d / 2 + 2;
        g.fillStyle(COLORS.ink).fillCircle(c, c, d / 2);
        const t = d * 0.2;
        g.fillStyle(COLORS.white).fillTriangle(c - t * 0.7, c - t, c - t * 0.7, c + t, c + t * 1.1, c);
      });
      const gap = 18;
      const total = d + gap + this.labelText.width;
      const icon = scene.add.image(-total / 2 + d / 2, 0, iconKey);
      this.labelText.setX(-total / 2 + d + gap + this.labelText.width / 2);
      parts.push(icon);
    }
    this.face = scene.add.container(0, 0, parts);
    this.add([shadow, this.face]);
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });

    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.handleDown, this);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.handleUp, this);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.handleOut, this);

    if (opts.pulse) this.startPulse();
    scene.add.existing(this);
  }

  private startPulse(): void {
    if (prefersReducedMotion()) return;
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scale: 1.06,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private handleDown(): void {
    this.pressed = true;
    AudioManager.sfx('pop');
    this.pulseTween?.pause();
    this.scene.tweens.killTweensOf(this.face);
    // Squash: se aplasta y baja hacia la sombra.
    this.scene.tweens.add({
      targets: this.face,
      scaleX: 1.08,
      scaleY: 0.88,
      y: 8,
      duration: motion(80),
      ease: 'Quad.easeOut',
    });
  }

  private handleUp(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.release();
    this.onClick();
  }

  private handleOut(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.release();
  }

  private release(): void {
    this.scene.tweens.killTweensOf(this.face);
    // Stretch elástico de regreso.
    this.scene.tweens.add({
      targets: this.face,
      scaleX: 1,
      scaleY: 1,
      y: 0,
      duration: motion(420),
      ease: prefersReducedMotion() ? 'Linear' : 'Elastic.easeOut',
      easeParams: [1.2, 0.4],
    });
    this.pulseTween?.resume();
  }
}
