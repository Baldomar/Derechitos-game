import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { motion } from '@/core/Device';

export interface Point {
  x: number;
  y: number;
}

export interface DropZoneOptions {
  width: number;
  height: number;
  id?: string;
  shape?: 'rect' | 'circle';
  /** Mostrar el contorno (false si el nivel dibuja su propio destino, p. ej. la lonchera). */
  showOutline?: boolean;
  /** Posiciones (relativas al centro) donde se acomodan los objetos aceptados. */
  slots?: Point[];
  /** Margen extra para que sea fácil acertar con dedos pequeños. */
  tolerance?: number;
}

/** Zona de destino para objetos arrastrables. Se resalta cuando un objeto pasa encima. */
export class DropZone extends Phaser.GameObjects.Container {
  readonly zoneId: string;
  readonly zoneWidth: number;
  readonly zoneHeight: number;
  private readonly outline: Phaser.GameObjects.Graphics;
  private readonly shape: 'rect' | 'circle';
  private readonly slots: Point[];
  private readonly tolerance: number;
  private hovered = false;
  private slotIndex = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: DropZoneOptions) {
    super(scene, x, y);
    this.zoneId = opts.id ?? 'zone';
    this.zoneWidth = opts.width;
    this.zoneHeight = opts.height;
    this.shape = opts.shape ?? 'rect';
    this.slots = opts.slots ?? [{ x: 0, y: 0 }];
    this.tolerance = opts.tolerance ?? 36;
    this.outline = scene.add.graphics();
    this.add(this.outline);
    this.draw(false);
    if (opts.showOutline === false) this.outline.setVisible(false);
    scene.add.existing(this);
  }

  private draw(hover: boolean): void {
    const g = this.outline;
    const w = this.zoneWidth;
    const h = this.zoneHeight;
    g.clear();
    g.fillStyle(COLORS.white, hover ? 0.55 : 0.25);
    g.lineStyle(hover ? 8 : 5, hover ? COLORS.sun : COLORS.white, hover ? 1 : 0.9);
    if (this.shape === 'circle') {
      g.fillCircle(0, 0, w / 2).strokeCircle(0, 0, w / 2);
    } else {
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 24).strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    }
  }

  /** ¿El punto (coordenadas de escena) cae dentro de la zona (con tolerancia)? */
  contains(x: number, y: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    if (this.shape === 'circle') {
      const r = this.zoneWidth / 2 + this.tolerance;
      return dx * dx + dy * dy <= r * r;
    }
    return (
      Math.abs(dx) <= this.zoneWidth / 2 + this.tolerance &&
      Math.abs(dy) <= this.zoneHeight / 2 + this.tolerance
    );
  }

  setHover(on: boolean): void {
    if (on === this.hovered) return;
    this.hovered = on;
    this.draw(on);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, scale: on ? 1.05 : 1, duration: motion(120) });
  }

  /** Siguiente posición libre (coordenadas de escena) para acomodar un objeto. */
  takeSlot(): Point {
    const s = this.slots[this.slotIndex % this.slots.length] ?? { x: 0, y: 0 };
    this.slotIndex += 1;
    return { x: this.x + s.x, y: this.y + s.y };
  }

  get placedCount(): number {
    return this.slotIndex;
  }

  /** Pulso de alegría al recibir un objeto correcto. */
  pulse(): void {
    if (!this.scene) return; // la zona ya fue retirada
    this.scene.tweens.add({
      targets: this,
      scale: 1.08,
      duration: motion(120),
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }
}
