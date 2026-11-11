import Phaser from 'phaser';
import { COLORS, CSS, FONTS, MIN_TOUCH, TEXT_RESOLUTION } from '@/config/theme';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion } from '@/core/Device';

export type PillIcon = 'home' | 'medal';

export interface PillButtonOptions {
  label: string;
  onClick: () => void;
  icon?: PillIcon;
  color?: number;
  width?: number;
  fontSize?: number;
}

const H = 60;

function drawIcon(g: Phaser.GameObjects.Graphics, icon: PillIcon): void {
  const ink = COLORS.ink;
  if (icon === 'home') {
    g.lineStyle(4, ink);
    g.strokeTriangle(-13, -1, 0, -13, 13, -1);
    g.strokeRect(-9, -1, 18, 13);
    g.fillStyle(ink).fillRect(-3, 4, 6, 8);
  } else {
    g.fillStyle(COLORS.coral).fillTriangle(-10, -16, -3, -16, -6, -4);
    g.fillStyle(COLORS.turquoise).fillTriangle(3, -16, 10, -16, 6, -4);
    g.fillStyle(COLORS.sun).fillCircle(0, 4, 10);
    g.lineStyle(3, ink).strokeCircle(0, 4, 10);
    g.fillStyle(ink).fillCircle(0, 4, 3);
  }
}

/**
 * Botón compacto tipo píldora (con ícono opcional), como "Inicio" o "Mis medallas".
 * Visualmente mide 60 px de alto, pero su área táctil es de 88 px (accesible para dedos pequeños).
 */
export class PillButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Container;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: PillButtonOptions) {
    super(scene, x, y);
    const w = opts.width ?? 160;
    const color = opts.color ?? COLORS.white;
    const key = bakedTexture(scene, `pill-${w}-${color.toString(16)}`, w + 8, H + 12, (g) => {
      g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(4, 9, w, H, H / 2);
      g.fillStyle(color).fillRoundedRect(4, 4, w, H, H / 2);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(4, 4, w, H, H / 2);
    });
    const bg = scene.add.image(0, 3, key);
    const parts: Phaser.GameObjects.GameObject[] = [bg];
    const text = scene.add
      .text(0, 0, opts.label, {
        fontFamily: FONTS.title,
        fontSize: `${opts.fontSize ?? 26}px`,
        fontStyle: '800',
        color: CSS.ink,
        resolution: TEXT_RESOLUTION,
        padding: { top: 6 },
      })
      .setOrigin(0.5);
    if (opts.icon) {
      const g = scene.add.graphics();
      drawIcon(g, opts.icon);
      const total = 30 + 10 + text.width;
      g.setPosition(-total / 2 + 15, 0);
      text.setX(-total / 2 + 40 + text.width / 2);
      parts.push(g);
    }
    parts.push(text);
    this.face = scene.add.container(0, 0, parts);
    this.add(this.face);
    this.setSize(Math.max(w, MIN_TOUCH), MIN_TOUCH);
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.pressed = true;
      AudioManager.sfx('pop');
      this.scene.tweens.killTweensOf(this.face);
      this.scene.tweens.add({
        targets: this.face,
        scaleX: 1.06,
        scaleY: 0.9,
        y: 3,
        duration: motion(80),
      });
    });
    const release = (fire: boolean): void => {
      if (!this.pressed) return;
      this.pressed = false;
      this.scene.tweens.killTweensOf(this.face);
      this.scene.tweens.add({
        targets: this.face,
        scaleX: 1,
        scaleY: 1,
        y: 0,
        duration: motion(380),
        ease: 'Elastic.easeOut',
      });
      if (fire) opts.onClick();
    };
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => release(true));
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => release(false));
    scene.add.existing(this);
  }
}
