import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { pickPraise } from '@/config/phrases';
import type { CatchActivity, GameThing } from '@/config/rights';
import { tex } from '@/art/Art';
import { GoalMeter } from '@/components/GoalMeter';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { BaseActivity, fitImage } from './BaseActivity';

const CATCHER_Y = 522;
const MIN_X = 120;
const MAX_X = 1160;
const SPAWN_Y = 96;
const FLOOR_Y = 610;
const MAX_FALLING = 3;

interface Faller {
  obj: Phaser.GameObjects.Container;
  def: GameThing;
  good: boolean;
  baseX: number;
  vy: number;
  phase: number;
  done: boolean;
}

/**
 * Motor "atrapa": las cosas caen despacito del cielo y el niño mueve la mochila/lonchera
 * (arrastrando o tocando donde quiere que vaya). Lo que sí va se guarda con un saltito;
 * lo que no va rebota y Tori explica por qué. Sin vidas ni cronómetro: si algo se cae al
 * suelo no pasa nada, vuelve a caer otra cosa.
 */
export default class CatchGameScene extends BaseActivity<CatchActivity> {
  protected readonly kind = 'catch' as const;
  private catcher!: Phaser.GameObjects.Container;
  private catcherImg!: Phaser.GameObjects.Image;
  private arrows!: Phaser.GameObjects.Container;
  private meter!: GoalMeter;
  private fallers: Faller[] = [];
  private targetX = 640;
  private playing = false;
  private moved = false;
  private badStreak = 0;
  private lastX = 640;
  private pauseUntil = 0;
  private counted = new Set<string>();

  constructor() {
    super('CatchGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.fallers = [];
    this.targetX = 640;
    this.playing = false;
    this.moved = false;
    this.badStreak = 0;
    this.lastX = 640;
    this.pauseUntil = 0;
    this.counted = new Set();
  }

  protected override buildLevel(): void {
    const a = this.activity;
    this.meter = new GoalMeter(this, a.goal);

    // Lo que atrapa: sombra + dibujo, con un balanceo suave "vivo".
    const shadow = this.add.ellipse(0, 62, 150, 26, COLORS.ink, 0.18);
    this.catcherImg = fitImage(this.add.image(0, 0, tex(a.catcher)), 150, 130, 2);
    this.catcher = this.add.container(640, CATCHER_Y, [shadow, this.catcherImg]).setDepth(5);
    this.tweens.add({
      targets: this.catcherImg,
      scaleY: this.catcherImg.scaleY * 1.04,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Flechitas ⟵ ⟶ que invitan a moverlo (se van con el primer movimiento).
    const arrow = (dir: 1 | -1): Phaser.GameObjects.Graphics => {
      const g = this.add.graphics({ x: dir * 110, y: 0 });
      g.fillStyle(COLORS.white, 1).lineStyle(4, COLORS.ink, 1);
      const pts = [
        { x: dir * 26, y: 0 },
        { x: 0, y: -22 },
        { x: 0, y: -10 },
        { x: -dir * 20, y: -10 },
        { x: -dir * 20, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 22 },
      ];
      g.fillPoints(pts, true).strokePoints(pts, true);
      return g;
    };
    this.arrows = this.add.container(0, 0, [arrow(-1), arrow(1)]);
    this.catcher.add(this.arrows);
    this.tweens.add({
      targets: this.arrows,
      scaleX: 1.15,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const move = (p: Phaser.Input.Pointer): void => {
      if (!p.isDown || !this.playing || this.inputLocked) return;
      this.targetX = Phaser.Math.Clamp(p.x, MIN_X, MAX_X);
      if (!this.moved) {
        this.moved = true;
        this.tweens.add({ targets: this.arrows, alpha: 0, duration: 300 });
      }
    };
    this.input.on(Phaser.Input.Events.POINTER_DOWN, move);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, move);
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.playing = true;
    this.spawn();
    this.time.addEvent({ delay: 1500, loop: true, callback: () => this.spawn() });
  }

  private spawn(): void {
    if (!this.playing || this.time.now < this.pauseUntil) return;
    const alive = this.fallers.filter((f) => !f.done);
    if (alive.length >= MAX_FALLING) return;
    const a = this.activity;
    // ~65 % cosas buenas; nunca más de 2 "malas" seguidas, ni dos seguidas en el mismo lugar.
    const good = this.badStreak >= 2 || Math.random() < 0.65 || a.bad.length === 0;
    this.badStreak = good ? 0 : this.badStreak + 1;
    const list: GameThing[] = good ? a.good : a.bad;
    const def = Phaser.Utils.Array.GetRandom(list);
    let x = Phaser.Math.Between(MIN_X + 30, MAX_X - 30);
    for (let i = 0; i < 6 && Math.abs(x - this.lastX) < 220; i++) {
      x = Phaser.Math.Between(MIN_X + 30, MAX_X - 30);
    }
    this.lastX = x;

    const bg = this.add.circle(0, 0, 50, COLORS.white, 0.92).setStrokeStyle(4, COLORS.ink);
    const img = fitImage(this.add.image(0, -2, tex(def.art)), 74, 70);
    const label = addBody(this, 0, 66, def.label, 18, {
      stroke: '#FFFFFF',
      strokeThickness: 5,
    });
    const obj = this.add.container(x, SPAWN_Y, [bg, img, label]).setDepth(4).setScale(0);
    this.tweens.add({ targets: obj, scale: 1, duration: motion(260), ease: 'Back.easeOut' });
    // Más despacio al principio; un poquito más rápido a medida que avanza.
    const vy = 105 + this.meter.count * 7;
    this.fallers.push({ obj, def, good, baseX: x, vy, phase: Math.random() * 6, done: false });
  }

  override update(_time: number, delta: number): void {
    if (!this.catcher) return;
    const dt = Math.min(delta, 50) / 1000;
    // La mochila sigue al dedo con suavidad y se inclina hacia donde va.
    const dx = this.targetX - this.catcher.x;
    this.catcher.x += dx * Math.min(1, dt * 12);
    if (!prefersReducedMotion()) {
      this.catcherImg.angle = Phaser.Math.Linear(
        this.catcherImg.angle,
        Phaser.Math.Clamp(dx * 0.08, -12, 12),
        0.2,
      );
    }
    if (!this.playing) return;

    for (const f of this.fallers) {
      if (f.done) continue;
      f.phase += dt * 2.2;
      f.obj.y += f.vy * dt;
      f.obj.x = f.baseX + Math.sin(f.phase) * 18;
      f.obj.angle = Math.sin(f.phase * 1.3) * 8;
      const hitY = Math.abs(f.obj.y - (CATCHER_Y - 30)) < 36;
      if (hitY && Math.abs(f.obj.x - this.catcher.x) < 92) {
        f.done = true;
        if (f.good) this.onGood(f);
        else this.onBad(f);
      } else if (f.obj.y > FLOOR_Y) {
        f.done = true;
        this.tweens.add({
          targets: f.obj,
          alpha: 0,
          scale: 0.6,
          duration: motion(300),
          onComplete: () => f.obj.destroy(),
        });
      }
    }
    this.fallers = this.fallers.filter((f) => !f.done || f.obj.active);
  }

  private squashCatcher(): void {
    const sx = this.catcherImg.scaleX;
    const sy = this.catcherImg.scaleY;
    this.tweens.chain({
      targets: this.catcherImg,
      tweens: [
        { scaleX: sx * 1.18, scaleY: sy * 0.82, duration: motion(90) },
        { scaleX: sx, scaleY: sy, duration: motion(380), ease: 'Elastic.easeOut' },
      ],
    });
  }

  private onGood(f: Faller): void {
    const { x, y } = f.obj;
    this.squashCatcher();
    AudioManager.sfx('pop', { pitch: 1.1 + this.meter.count * 0.05 });
    this.tweens.add({
      targets: f.obj,
      x: this.catcher.x,
      y: CATCHER_Y - 10,
      scale: 0.2,
      alpha: 0.4,
      duration: motion(220),
      ease: 'Quad.easeIn',
      onComplete: () => f.obj.destroy(),
    });
    this.meter.fill(f.def.art, x, y);
    const finished = this.meter.done;
    const speak = finished ? null : this.meter.count % 3 === 0 ? pickPraise() : null;
    this.correct(this.catcher.x, CATCHER_Y - 60, speak);
    if (finished) this.finish();
  }

  private onBad(f: Faller): void {
    AudioManager.sfx('pop', { pitch: 0.7 });
    const dir = f.obj.x < this.catcher.x ? -1 : 1;
    // Rebota fuera de la mochila dando vueltas.
    this.tweens.add({
      targets: f.obj,
      y: f.obj.y - 170,
      x: f.obj.x + dir * 200,
      angle: dir * 360,
      alpha: 0,
      duration: motion(750),
      ease: 'Quad.easeOut',
      onComplete: () => f.obj.destroy(),
    });
    // La mochila dice "no" con la cabeza.
    this.tweens.chain({
      targets: this.catcherImg,
      tweens: [
        { angle: -14, duration: motion(90) },
        { angle: 14, duration: motion(120) },
        { angle: 0, duration: motion(90) },
      ],
    });
    const hint = (f.def.hint ?? this.activity.bad[0]?.hint) as NonNullable<GameThing['hint']>;
    if (this.counted.has(f.def.label)) {
      void this.say(hint);
    } else {
      this.counted.add(f.def.label);
      this.mistake(hint);
    }
    // Un respiro para escuchar a Tori antes de que caiga lo siguiente.
    this.pauseUntil = this.time.now + 2200;
  }

  private finish(): void {
    this.playing = false;
    for (const f of this.fallers) {
      if (f.done) continue;
      f.done = true;
      this.effects.sparkleAt(f.obj.x, f.obj.y, 6);
      this.tweens.add({
        targets: f.obj,
        scale: 0,
        duration: motion(250),
        onComplete: () => f.obj.destroy(),
      });
    }
    // Saltito de victoria de la mochila.
    this.tweens.add({
      targets: this.catcher,
      y: CATCHER_Y - 40,
      duration: motion(220),
      yoyo: true,
      repeat: 1,
      ease: 'Quad.easeOut',
    });
    this.time.delayedCall(500, () => void this.complete(this.activity.done));
  }

  protected override getHint(): HintTarget | null {
    if (!this.playing) return null;
    const next = this.fallers
      .filter((f) => !f.done && f.good && f.obj.y < CATCHER_Y - 140)
      .sort((p, q) => q.obj.y - p.obj.y)[0];
    if (!next) return null;
    return {
      kind: 'drag',
      from: { x: this.catcher.x, y: CATCHER_Y },
      to: { x: next.obj.x, y: CATCHER_Y },
    };
  }
}
