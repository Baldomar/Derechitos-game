import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { MatchActivity } from '@/config/rights';
import type { HintTarget } from '@/components/HelperHand';
import { hop, shuffled, thingCard } from '@/components/Kit';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const LEFT_X = 345;
const RIGHT_X = 935;
const CW = 250;
const CH = 90;
const PAIR_COLORS = [COLORS.coral, COLORS.turquoise, COLORS.grape, COLORS.orange, COLORS.grass];

interface Side {
  id: string;
  c: Phaser.GameObjects.Container;
  knob: { x: number; y: number };
  left: boolean;
  matched: boolean;
}

/**
 * Motor "une con una línea": a la izquierda y a la derecha hay tarjetas. Se arrastra desde
 * una tarjeta (o su bolita) hasta su pareja: aparece una cuerdita de color que la sigue.
 * Si es la pareja correcta, la cuerda se queda; si no, regresa como resorte y Tori ayuda.
 */
export default class MatchGameScene extends BaseActivity<MatchActivity> {
  protected readonly kind = 'match' as const;
  private sides: Side[] = [];
  private from: Side | null = null;
  private rope!: Phaser.GameObjects.Graphics;
  private fixed!: Phaser.GameObjects.Graphics;
  private done = 0;
  private links: { a: { x: number; y: number }; b: { x: number; y: number }; color: number }[] = [];

  constructor() {
    super('MatchGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.sides = [];
    this.from = null;
    this.done = 0;
    this.links = [];
  }

  protected override buildLevel(): void {
    const pairs = this.activity.pairs;
    const n = pairs.length;
    // Bajo el botón "Volver" y arriba del globo de Tori, sin quedar pegado a ninguno.
    const gap = Math.min(112, 400 / Math.max(1, n - 1));
    const y0 = 340 - ((n - 1) * gap) / 2;
    this.fixed = this.add.graphics().setDepth(1);
    this.rope = this.add.graphics().setDepth(6);

    const make = (
      id: string,
      left: boolean,
      i: number,
      art: Parameters<typeof thingCard>[3],
      label: string,
    ): void => {
      const x = left ? LEFT_X : RIGHT_X;
      const y = y0 + i * gap;
      const card = thingCard(this, CW, CH, art, '', { radius: 18 });
      const img = card.list[1] as Phaser.GameObjects.Image;
      img.setX(left ? -CW / 2 + 54 : CW / 2 - 54);
      img.setScale(Math.min(80 / img.width, 80 / img.height, 1.6));
      const text = addBody(this, left ? -CW / 2 + 104 : CW / 2 - 104, 0, label, 19, {
        wrap: CW - 120,
        align: left ? 'left' : 'right',
      }).setOrigin(left ? 0 : 1, 0.5);
      card.add(text);
      const kx = left ? CW / 2 + 16 : -CW / 2 - 16;
      const knob = this.add.circle(kx, 0, 15, COLORS.sun).setStrokeStyle(4, COLORS.ink);
      card.add(knob);
      card
        .setPosition(x, y)
        .setDepth(3)
        .setSize(CW + 40, CH);
      card.setInteractive({ useHandCursor: true, draggable: true });
      this.input.setDraggable(card);
      card.setScale(0);
      this.tweens.add({
        targets: card,
        scale: 1,
        delay: i * 90 + (left ? 0 : 200),
        duration: motion(320),
        ease: 'Back.easeOut',
      });
      this.tweens.add({ targets: knob, scale: 1.25, duration: 600, yoyo: true, repeat: -1 });
      const side: Side = { id, c: card, knob: { x: x + kx, y }, left, matched: false };
      this.sides.push(side);
      card.on(Phaser.Input.Events.GAMEOBJECT_DRAG_START, () => this.beginRope(side));
      card.on(Phaser.Input.Events.GAMEOBJECT_DRAG, (p: Phaser.Input.Pointer) =>
        this.drawRope(p.x, p.y),
      );
      card.on(Phaser.Input.Events.GAMEOBJECT_DRAG_END, (p: Phaser.Input.Pointer) =>
        this.release(p.x, p.y),
      );
    };

    pairs.forEach((p, i) => make(p.id, true, i, p.left.art, p.left.label));
    shuffled(pairs).forEach((p, i) => make(p.id, false, i, p.right.art, p.right.label));
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private beginRope(side: Side): void {
    if (side.matched || this.finished) return;
    this.from = side;
    AudioManager.sfx('pop', { pitch: 1.2 });
  }

  private ropeColor(): number {
    return PAIR_COLORS[this.done % PAIR_COLORS.length] ?? COLORS.coral;
  }

  private curve(
    g: Phaser.GameObjects.Graphics,
    a: { x: number; y: number },
    b: { x: number; y: number },
    color: number,
  ): void {
    const sag = Math.min(60, Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) * 0.12);
    const c = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(a.x, a.y),
      new Phaser.Math.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2 + sag),
      new Phaser.Math.Vector2(b.x, b.y),
    );
    g.lineStyle(14, COLORS.ink);
    c.draw(g, 24);
    g.lineStyle(8, color);
    c.draw(g, 24);
  }

  private drawRope(x: number, y: number): void {
    const f = this.from;
    if (!f) return;
    this.rope.clear();
    this.curve(this.rope, f.knob, { x, y }, this.ropeColor());
    this.rope
      .fillStyle(this.ropeColor())
      .fillCircle(x, y, 12)
      .lineStyle(4, COLORS.ink)
      .strokeCircle(x, y, 12);
  }

  private release(x: number, y: number): void {
    const f = this.from;
    this.from = null;
    if (!f) return;
    const target = this.sides.find(
      (s) =>
        s.left !== f.left &&
        !s.matched &&
        Math.abs(s.c.x - x) < CW / 2 + 40 &&
        Math.abs(s.c.y - y) < CH / 2 + 10,
    );
    if (!target) {
      this.snapBack(f, x, y);
      return;
    }
    if (target.id !== f.id) {
      this.snapBack(f, x, y);
      const pair = this.activity.pairs.find((p) => p.id === f.id);
      this.tweens.add({
        targets: target.c,
        angle: { from: -5, to: 5 },
        duration: motion(70),
        yoyo: true,
        repeat: 2,
        onComplete: () => target.c.setAngle(0),
      });
      if (pair) this.mistakeOnce(`${f.id}>${target.id}`, pair.hint);
      return;
    }
    // ¡Pareja!
    this.rope.clear();
    const color = this.ropeColor();
    const a = f.left ? f.knob : target.knob;
    const b = f.left ? target.knob : f.knob;
    this.links.push({ a, b, color });
    this.fixed.clear();
    this.links.forEach((l) => this.curve(this.fixed, l.a, l.b, l.color));
    f.matched = true;
    target.matched = true;
    for (const s of [f, target]) {
      s.c.disableInteractive();
      const bg = s.c.list[0] as Phaser.GameObjects.Graphics;
      bg.lineStyle(7, color).strokeRoundedRect(-CW / 2, -CH / 2, CW, CH, 18);
      hop(this, s.c, 16);
    }
    this.done += 1;
    const last = this.done === this.activity.pairs.length;
    this.correct((a.x + b.x) / 2, (a.y + b.y) / 2 - 30, last ? null : undefined);
    if (last) {
      this.time.delayedCall(900, () => void this.complete(this.activity.done));
    }
  }

  /** La cuerda regresa como resorte a su bolita. */
  private snapBack(f: Side, x: number, y: number): void {
    AudioManager.sfx('pop', { pitch: 0.8 });
    const p = { t: 1 };
    const color = this.ropeColor();
    this.tweens.add({
      targets: p,
      t: 0,
      duration: motion(260),
      ease: 'Back.easeIn',
      onUpdate: () => {
        this.rope.clear();
        this.curve(
          this.rope,
          f.knob,
          { x: f.knob.x + (x - f.knob.x) * p.t, y: f.knob.y + (y - f.knob.y) * p.t },
          color,
        );
      },
      onComplete: () => this.rope.clear(),
    });
  }

  protected override getHint(): HintTarget | null {
    const l = this.sides.find((s) => s.left && !s.matched);
    if (!l) return null;
    const r = this.sides.find((s) => !s.left && s.id === l.id);
    return r ? { kind: 'drag', from: { x: l.c.x, y: l.c.y }, to: { x: r.c.x, y: r.c.y } } : null;
  }
}
