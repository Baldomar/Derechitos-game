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
  icon?: 'play' | 'medal' | 'diploma' | 'print';
  /** Color del texto (por defecto, tinta). */
  textColor?: string;
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
        color: opts.textColor ?? CSS.ink,
        resolution: TEXT_RESOLUTION,
        padding: { top: 8 },
      })
      .setOrigin(0.5);

    const parts: Phaser.GameObjects.GameObject[] = [bg, this.labelText];
    if (opts.icon) {
      const d = Math.round(h * 0.56);
      const iconKey =
        opts.icon === 'play'
          ? bakedTexture(scene, `btn-icon-play-${d}`, d + 4, d + 4, (g) => {
              const c = d / 2 + 2;
              g.fillStyle(COLORS.ink).fillCircle(c, c, d / 2);
              const t = d * 0.2;
              g.fillStyle(COLORS.white).fillTriangle(
                c - t * 0.7,
                c - t,
                c - t * 0.7,
                c + t,
                c + t * 1.1,
                c,
              );
            })
          : opts.icon === 'medal'
          ? bakedTexture(scene, `btn-icon-medal-${d}`, d + 4, d + 4, (g) => {
              const c = d / 2 + 2;
              const r = d * 0.3;
              g.fillStyle(COLORS.coral).fillTriangle(c - r, 2, c - r * 0.1, 2, c - r * 0.3, c);
              g.fillStyle(COLORS.turquoise).fillTriangle(c + r * 0.1, 2, c + r, 2, c + r * 0.3, c);
              g.lineStyle(3, COLORS.ink);
              g.strokeTriangle(c - r, 2, c - r * 0.1, 2, c - r * 0.3, c);
              g.strokeTriangle(c + r * 0.1, 2, c + r, 2, c + r * 0.3, c);
              const cy = d + 2 - r - 3;
              g.fillStyle(COLORS.sun).fillCircle(c, cy, r);
              g.lineStyle(4, COLORS.ink).strokeCircle(c, cy, r);
              g.fillStyle(COLORS.white, 0.8).fillCircle(c, cy, r * 0.42);
            })
          : opts.icon === 'print'
          ? bakedTexture(scene, `btn-icon-print-${d}`, d + 4, d + 4, (g) => {
              // Impresora: hoja arriba, cuerpo con botón y hoja impresa saliendo abajo.
              const c = (d + 4) / 2;
              const w = d * 0.84;
              g.fillStyle(COLORS.white).fillRect(c - w * 0.3, d * 0.08, w * 0.6, d * 0.3);
              g.lineStyle(3, COLORS.ink).strokeRect(c - w * 0.3, d * 0.08, w * 0.6, d * 0.3);
              g.fillStyle(COLORS.sun).fillRoundedRect(c - w / 2, d * 0.32, w, d * 0.4, 6);
              g.lineStyle(3.5, COLORS.ink).strokeRoundedRect(c - w / 2, d * 0.32, w, d * 0.4, 6);
              g.fillStyle(COLORS.ink).fillCircle(c + w * 0.32, d * 0.44, 3);
              g.fillStyle(COLORS.white).fillRect(c - w * 0.3, d * 0.6, w * 0.6, d * 0.32);
              g.lineStyle(3, COLORS.ink).strokeRect(c - w * 0.3, d * 0.6, w * 0.6, d * 0.32);
              g.lineStyle(2, COLORS.ink, 0.6);
              g.lineBetween(c - w * 0.2, d * 0.72, c + w * 0.2, d * 0.72);
              g.lineBetween(c - w * 0.2, d * 0.82, c + w * 0.12, d * 0.82);
            })
          : bakedTexture(scene, `btn-icon-diploma-${d}`, d + 4, d + 4, (g) => {
              // Diploma enrollado: hoja con renglones, rollos a los lados y sello rojo.
              const w = d * 0.86;
              const x0 = (d + 4 - w) / 2;
              const y0 = d * 0.18;
              const hh = d * 0.64;
              g.fillStyle(COLORS.cream).fillRect(x0, y0, w, hh);
              g.lineStyle(3.5, COLORS.ink).strokeRect(x0, y0, w, hh);
              for (const rx of [x0, x0 + w]) {
                g.fillStyle(0xf2dfb0).fillRoundedRect(rx - 5, y0 - 4, 10, hh + 8, 5);
                g.lineStyle(3, COLORS.ink).strokeRoundedRect(rx - 5, y0 - 4, 10, hh + 8, 5);
              }
              g.lineStyle(2.5, COLORS.ink, 0.6);
              for (let k = 1; k <= 3; k++) {
                g.lineBetween(x0 + 9, y0 + (hh * k) / 4.6, x0 + w - 12, y0 + (hh * k) / 4.6);
              }
              g.fillStyle(COLORS.coral).fillCircle(x0 + w - 13, y0 + hh - 9, 7);
              g.lineStyle(2.5, COLORS.ink).strokeCircle(x0 + w - 13, y0 + hh - 9, 7);
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
