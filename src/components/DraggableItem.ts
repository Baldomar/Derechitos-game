import Phaser from 'phaser';
import { DEPTH, MIN_TOUCH } from '@/config/theme';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import type { DropZone, Point } from './DropZone';

/** Qué hacer al soltar: aceptar (se acomoda), rechazar (rebota con pista) o ignorar (regresa). */
export type DropDecision = 'accept' | 'reject' | 'ignore' | { placeIn: DropZone };

export type ScaleSpec = number | { x: number; y: number };

export interface DraggableItemOptions {
  id: string;
  /** Objetos visuales centrados en (0, 0). */
  content: Phaser.GameObjects.GameObject[];
  width?: number;
  height?: number;
  zones: DropZone[];
  onDrop: (item: DraggableItem, zone: DropZone | null) => DropDecision;
  onPick?: (item: DraggableItem) => void;
  /** Escala final al quedar acomodado (p. ej. 1 = mismo tamaño que la silueta). */
  placedScale?: ScaleSpec;
  /**
   * Piezas de "armar": al tomarlas crecen a su tamaño final (placedScale) para que el niño
   * vea cómo encajan con la silueta; si regresan a su sitio vuelven a su tamaño pequeño.
   */
  growOnDrag?: boolean;
}

const toXY = (s: ScaleSpec): { x: number; y: number } =>
  typeof s === 'number' ? { x: s, y: s } : s;

/**
 * Objeto arrastrable con "juice": se agranda al tomarlo, se inclina según el movimiento,
 * se aplasta al caer en su lugar y regresa con rebote elástico si no era ahí.
 */
export class DraggableItem extends Phaser.GameObjects.Container {
  readonly itemId: string;
  private home: Point;
  private homeScale: { x: number; y: number } | null = null;
  private readonly visual: Phaser.GameObjects.Container;
  private zones: DropZone[];
  private readonly onDropCb: DraggableItemOptions['onDrop'];
  private readonly onPickCb: DraggableItemOptions['onPick'];
  private readonly placedScale: { x: number; y: number } | null;
  private readonly growOnDrag: boolean;
  private baseDepth = 0;
  private placed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: DraggableItemOptions) {
    super(scene, x, y);
    this.itemId = opts.id;
    this.home = { x, y };
    this.zones = opts.zones;
    this.onDropCb = opts.onDrop;
    this.onPickCb = opts.onPick;
    this.placedScale = opts.placedScale === undefined ? null : toXY(opts.placedScale);
    this.growOnDrag = opts.growOnDrag ?? false;

    this.visual = scene.add.container(0, 0, opts.content);
    this.add(this.visual);
    this.setSize(Math.max(opts.width ?? 110, MIN_TOUCH), Math.max(opts.height ?? 110, MIN_TOUCH));
    this.setInteractive({ draggable: true, useHandCursor: true });

    this.on(Phaser.Input.Events.GAMEOBJECT_DRAG_START, this.handleDragStart, this);
    this.on(Phaser.Input.Events.GAMEOBJECT_DRAG, this.handleDrag, this);
    this.on(Phaser.Input.Events.GAMEOBJECT_DRAG_END, this.handleDragEnd, this);
    scene.add.existing(this);
  }

  get isPlaced(): boolean {
    return this.placed;
  }

  get homePosition(): Point {
    return { ...this.home };
  }

  setHome(x: number, y: number): this {
    this.home = { x, y };
    return this;
  }

  /** Tamaño "en reposo" (el que tiene en su sitio de origen). */
  private restScale(): { x: number; y: number } {
    return this.homeScale ?? { x: this.scaleX, y: this.scaleY };
  }

  private handleDragStart(): void {
    if (this.placed) return;
    if (!this.homeScale) this.homeScale = { x: this.scaleX, y: this.scaleY };
    this.baseDepth = this.depth;
    this.setDepth(DEPTH.overlay - 1);
    this.scene.tweens.killTweensOf([this, this.visual]);
    AudioManager.sfx('pop', { pitch: 1.3 });
    const grow = this.growOnDrag && this.placedScale;
    if (grow) {
      // Pieza de armar: toma su tamaño real (igual a la silueta) mientras se arrastra.
      this.scene.tweens.add({
        targets: this,
        scaleX: grow.x,
        scaleY: grow.y,
        duration: motion(180),
        ease: 'Back.easeOut',
      });
    }
    this.scene.tweens.add({
      targets: this.visual,
      scale: grow ? 1.04 : 1.15,
      duration: motion(150),
      ease: 'Back.easeOut',
    });
    this.onPickCb?.(this);
  }

  private handleDrag(_pointer: Phaser.Input.Pointer, dragX: number, dragY: number): void {
    if (this.placed) return;
    const dx = dragX - this.x;
    this.setPosition(dragX, dragY);
    if (!prefersReducedMotion()) {
      const max = this.growOnDrag ? 5 : 14;
      const tilt = Phaser.Math.Clamp(dx * 1.2, -max, max);
      this.visual.angle = Phaser.Math.Linear(this.visual.angle, tilt, 0.3);
    }
    for (const z of this.zones) z.setHover(z.contains(this.x, this.y));
  }

  private handleDragEnd(): void {
    if (this.placed) return;
    for (const z of this.zones) z.setHover(false);
    this.setDepth(this.baseDepth);
    const zone = this.zones.find((z) => z.contains(this.x, this.y)) ?? null;
    const decision = this.onDropCb(this, zone);
    if (typeof decision === 'object') this.placeIn(decision.placeIn);
    else if (decision === 'accept' && zone) this.placeIn(zone);
    else if (decision === 'reject') this.bounceHome();
    else this.returnHome();
  }

  /** Se acomoda en la zona con squash & stretch, con su tamaño final, y queda fijo. */
  placeIn(zone: DropZone): void {
    this.placed = true;
    this.disableInteractive();
    const slot = zone.takeSlot();
    zone.pulse();
    this.scene.tweens.killTweensOf([this, this.visual]);
    const final = this.placedScale ?? { x: this.scaleX, y: this.scaleY };
    this.scene.tweens.add({
      targets: this,
      x: slot.x,
      y: slot.y,
      scaleX: final.x,
      scaleY: final.y,
      duration: motion(260),
      ease: 'Back.easeOut',
    });
    // Las piezas de armar encajan con un aplastón suave (sin deformarse de más).
    const squash = this.growOnDrag ? { x: 1.06, y: 0.95 } : { x: 1.25, y: 0.8 };
    this.scene.tweens.chain({
      targets: this.visual,
      tweens: [
        {
          angle: 0,
          scaleX: squash.x,
          scaleY: squash.y,
          duration: motion(120),
          ease: 'Quad.easeOut',
        },
        { scaleX: 1, scaleY: 1, duration: motion(420), ease: 'Elastic.easeOut' },
      ],
    });
  }

  /** Regreso suave (soltó fuera de cualquier zona). */
  returnHome(): void {
    const s = this.restScale();
    this.scene.tweens.add({
      targets: this,
      x: this.home.x,
      y: this.home.y,
      scaleX: s.x,
      scaleY: s.y,
      duration: motion(320),
      ease: 'Cubic.easeOut',
    });
    this.scene.tweens.add({ targets: this.visual, scale: 1, angle: 0, duration: motion(200) });
  }

  /** Rebote elástico de vuelta (no era ahí): nunca castiga, solo invita a intentar otra vez. */
  bounceHome(): void {
    const s = this.restScale();
    this.scene.tweens.add({
      targets: this,
      x: this.home.x,
      y: this.home.y,
      scaleX: s.x,
      scaleY: s.y,
      duration: motion(560),
      ease: 'Back.easeOut',
    });
    this.scene.tweens.chain({
      targets: this.visual,
      tweens: [
        { scale: 1, angle: -12, duration: motion(110) },
        { angle: 10, duration: motion(110) },
        { angle: -6, duration: motion(100) },
        { angle: 0, duration: motion(100) },
      ],
    });
  }

  /** Cambia las zonas destino (p. ej. cuando aparecen después). */
  setZones(zones: DropZone[]): this {
    this.zones = zones;
    return this;
  }

  /** Bloquea/desbloquea el arrastre (p. ej. mientras Tori explica). */
  setLocked(locked: boolean): this {
    if (this.placed) return this;
    if (locked) this.disableInteractive();
    else this.setInteractive();
    return this;
  }
}
