import Phaser from 'phaser';
import {
  drawPuppetPart,
  personGeom,
  PEOPLE,
  puppetPartSize,
  type PersonKey,
  type PuppetPart,
} from '@/art/Art';
import { COLORS } from '@/config/theme';
import { prefersReducedMotion } from '@/core/Device';

/** Resolución extra de las piezas (se ven nítidas aunque el muñeco se agrande). */
const RES = 2;

export type PuppetMode = 'idle' | 'run' | 'walk' | 'cover' | 'jump';

interface Limb {
  upper: Phaser.GameObjects.Container;
  lower: Phaser.GameObjects.Container;
}

/** ¿Este dibujo tiene muñeco articulado? */
export function isPuppet(key: string): key is PersonKey {
  return key in PEOPLE;
}

function partTexture(scene: Phaser.Scene, key: PersonKey, part: PuppetPart): string {
  const name = `pp-${key}-${part}`;
  if (scene.textures.exists(name)) return name;
  const { w, h } = puppetPartSize(key, part);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.scaleCanvas(RES, RES);
  drawPuppetPart(g, key, part);
  g.generateTexture(name, Math.ceil(w * RES), Math.ceil(h * RES));
  g.destroy();
  return name;
}

/**
 * Muñeco articulado de una persona (mamá, papá, abuela, niño…): torso + brazos y piernas
 * de dos tramos que giran en hombro, codo, cadera y rodilla. El origen está en los pies.
 * - idle: respira, balancea los brazos y parpadea.
 * - run: corre con zancadas, brazos opuestos a las piernas, rebote e inclinado adelante.
 * - cover: se tapa la cabeza con las manos (¡llueve!) y tiembla un poquito.
 * - jump: en el aire, rodillas recogidas y brazos arriba de alegría.
 * - walk: camina tranquilo (pasos más cortos que al correr, sin inclinarse tanto).
 */
export class Puppet extends Phaser.GameObjects.Container {
  private readonly rig: Phaser.GameObjects.Container;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly legs: Limb[];
  private readonly arms: Limb[];
  /** Brazos levantados (p. ej. Lucas con el pincel en alto): 0 = izquierdo, 1 = derecho. */
  private readonly raised = [false, false];
  private readonly handY: number;
  private readonly lids: Phaser.GameObjects.Graphics;
  private mode: PuppetMode = 'idle';
  private stride = 0;
  private nextBlink = -1;
  private blinkEnd = 0;
  private readonly seed = Math.random() * 10;
  /** Brazos cortos (niños): no alcanzan a cubrir la cabeza, ponen las manos a los lados. */
  private readonly shortArms: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, key: PersonKey) {
    super(scene, x, y);
    const gm = personGeom(key);
    this.shortArms = gm.armLen < 40;
    const img = (part: PuppetPart, ox: number, oy: number): Phaser.GameObjects.Image => {
      const { w, h } = puppetPartSize(key, part);
      return scene.add
        .image(0, 0, partTexture(scene, key, part))
        .setOrigin(ox / w, oy / h)
        .setScale(1 / RES);
    };
    const half = gm.legLen / 2;
    const upLen = gm.armLen / 2;
    this.handY = upLen + 2;

    this.legs = [-1, 1].map((s) => {
      const lower = scene.add.container(0, half + 1, [img('shin', 16, 1)]);
      const upper = scene.add.container(s * gm.hipX, gm.hipY, [img('thigh', 10, 2), lower]);
      return { upper, lower };
    });
    this.arms = [-1, 1].map((s) => {
      const lower = scene.add.container(0, upLen + 1, [img('forearm', 10, 1)]);
      const upper = scene.add.container(s * gm.shoulderX, gm.shoulderY, [
        img('upperArm', 9, 4),
        lower,
      ]);
      return { upper, lower };
    });
    this.torso = img('torso', gm.w / 2, gm.h);

    // Párpados (para parpadear): piel con una rayita de pestañas.
    this.lids = scene.add.graphics().setVisible(false);
    for (const s of [-1, 1]) {
      const ex = s * gm.eyeX;
      this.lids.fillStyle(gm.skin).fillEllipse(ex, gm.eyeY, gm.eyeW * 1.2, gm.eyeH * 1.2);
      this.lids
        .lineStyle(2.5, COLORS.ink)
        .lineBetween(ex - gm.eyeW / 2, gm.eyeY + 2, ex + gm.eyeW / 2, gm.eyeY + 2);
    }

    this.rig = scene.add.container(0, 0, [
      ...this.legs.map((l) => l.upper),
      ...this.arms.map((a) => a.upper),
      this.torso,
      this.lids,
    ]);
    this.add(this.rig);
    scene.add.existing(this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () =>
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this),
    );
  }

  /**
   * Pone un objeto en la mano (se mueve con el brazo). `raise`: levanta ese brazo cuando
   * está quieto (p. ej. un pincel en alto).
   */
  hold(
    side: 'left' | 'right',
    obj: Phaser.GameObjects.GameObject & { setPosition: (x: number, y: number) => unknown },
    dx = 0,
    dy = 0,
    raise = false,
  ): this {
    const i = side === 'left' ? 0 : 1;
    const arm = this.arms[i];
    if (!arm) return this;
    obj.setPosition(dx, this.handY + dy);
    arm.lower.add(obj);
    this.raised[i] = raise;
    return this;
  }

  /** Levanta (o baja) un brazo estando quieto: "levantar la mano" para pedir la palabra. */
  raiseHand(on: boolean, side: 'left' | 'right' = 'right'): this {
    this.raised[side === 'left' ? 0 : 1] = on;
    return this;
  }

  setMode(mode: PuppetMode): this {
    if (mode === this.mode) return this;
    this.mode = mode;
    // Para taparse la cabeza los brazos van por delante del cuerpo; si no, por detrás.
    for (const a of this.arms) {
      if (mode === 'cover' || mode === 'jump') this.rig.bringToTop(a.upper);
      else this.rig.moveBelow<Phaser.GameObjects.GameObject>(a.upper, this.torso);
    }
    return this;
  }

  private tick(time: number, delta: number): void {
    if (!this.active) return;
    const dt = Math.min(delta, 50) / 1000;
    const calm = prefersReducedMotion();
    const t = time / 1000 + this.seed;

    // Parpadeo de vez en cuando (no mientras corre).
    if (this.nextBlink < 0) this.nextBlink = time + 800 + Math.random() * 2500;
    if (this.mode !== 'run' && time > this.nextBlink) {
      this.blinkEnd = time + 130;
      this.nextBlink = time + 2200 + Math.random() * 2200;
    }
    this.lids.setVisible(
      this.mode !== 'run' && this.mode !== 'walk' && this.mode !== 'jump' && time < this.blinkEnd,
    );

    if (this.mode === 'walk') {
      this.stride += dt * (calm ? 5 : 9);
      const p = this.stride;
      this.legs.forEach((l, i) => {
        const s = Math.sin(p + i * Math.PI);
        const c = Math.cos(p + i * Math.PI);
        l.upper.angle = -s * 20;
        l.lower.angle = 4 + Math.max(0, c) * 28;
      });
      this.arms.forEach((a, i) => {
        const s = Math.sin(p + i * Math.PI);
        a.upper.angle = s * 18;
        a.lower.angle = -12 - Math.max(0, s) * 10;
      });
      this.rig.setPosition(0, calm ? 0 : -Math.abs(Math.cos(p)) * 3);
      this.rig.angle = 3;
      this.torso.scaleY = 1 / RES;
      return;
    }

    if (this.mode === 'run') {
      this.stride += dt * (calm ? 6 : 12);
      const p = this.stride;
      this.legs.forEach((l, i) => {
        const s = Math.sin(p + i * Math.PI);
        const c = Math.cos(p + i * Math.PI);
        // Cadera adelante/atrás y rodilla que se dobla al recoger la pierna.
        l.upper.angle = -s * 30;
        l.lower.angle = 8 + Math.max(0, c) * 55;
      });
      this.arms.forEach((a, i) => {
        const s = Math.sin(p + i * Math.PI);
        a.upper.angle = s * 26;
        a.lower.angle = -40 - Math.max(0, s) * 20;
      });
      this.rig.setPosition(0, calm ? 0 : -Math.abs(Math.cos(p)) * 7);
      this.rig.angle = 7;
      this.torso.scaleY = 1 / RES;
      return;
    }

    if (this.mode === 'jump') {
      this.legs.forEach((l, i) => {
        l.upper.angle = i === 0 ? 35 : -35;
        l.lower.angle = i === 0 ? -60 : 60;
      });
      this.arms.forEach((a, i) => {
        const s = i === 0 ? -1 : 1;
        a.upper.angle = -s * 145;
        a.lower.angle = -s * 15;
      });
      this.rig.setPosition(0, 0);
      this.rig.angle = 0;
      return;
    }

    this.rig.angle = 0;
    const breathe = calm ? 0 : Math.sin(t * 2.4);
    this.torso.scaleY = (1 + breathe * 0.012) / RES;

    if (this.mode === 'cover') {
      // Manos sobre la cabeza y tiritando por la lluvia.
      const shiver = calm ? 0 : Math.sin(time / 28) * 1.2;
      this.arms.forEach((a, i) => {
        const s = i === 0 ? -1 : 1;
        a.upper.angle = s * (175 - shiver);
        a.lower.angle = -s * (this.shortArms ? 8 : 55);
      });
      this.legs.forEach((l, i) => {
        l.upper.angle = (i === 0 ? 1 : -1) * 3 + shiver;
        l.lower.angle = 0;
      });
      this.rig.setPosition(shiver, 0);
      return;
    }

    // Quieto: brazos que se balancean apenas, piernas firmes.
    this.arms.forEach((a, i) => {
      const s = i === 0 ? -1 : 1;
      if (this.raised[i]) {
        a.upper.angle = -s * (150 + breathe * 4);
        a.lower.angle = -s * 10;
        return;
      }
      a.upper.angle = -s * (5 + breathe * 2.5);
      a.lower.angle = -s * 6;
    });
    this.legs.forEach((l) => {
      l.upper.angle = 0;
      l.lower.angle = 0;
    });
    this.rig.setPosition(0, 0);
  }
}
