import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { pickPraise } from '@/config/phrases';
import type { GameThing, PopActivity } from '@/config/rights';
import { tex } from '@/art/Art';
import { GoalMeter } from '@/components/GoalMeter';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseActivity, fitImage } from './BaseActivity';

const R = 64;
const START_Y = 640;
const TOP_Y = 80;
const MAX_ALIVE = 5;

interface Bubble {
  obj: Phaser.GameObjects.Container;
  film: Phaser.GameObjects.Arc;
  def: GameThing;
  good: boolean;
  baseX: number;
  vy: number;
  phase: number;
  done: boolean;
}

/**
 * Motor "burbujas": suben burbujas con dibujos y se revientan las que responden a la
 * pregunta ("¡Revienta lo que cuida tu cuerpo!"). Puede tener varias rondas con preguntas
 * distintas. Las burbujas equivocadas solo tiemblan y Tori explica por qué.
 */
export default class PopGameScene extends BaseActivity<PopActivity> {
  protected readonly kind = 'pop' as const;
  private bubbles: Bubble[] = [];
  private meter!: GoalMeter;
  private round = 0;
  private playing = false;
  private lastX = 640;
  private counted = new Set<string>();
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('PopGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.bubbles = [];
    this.round = 0;
    this.playing = false;
    this.lastX = 640;
    this.counted = new Set();
    this.dots = [];
  }

  protected override buildLevel(): void {
    const a = this.activity;
    this.meter = new GoalMeter(this, a.rounds[0]?.goal ?? 5);
    if (a.rounds.length > 1) {
      a.rounds.forEach((_, i) => {
        this.dots.push(
          this.add
            .circle(1236 - (a.rounds.length - 1 - i) * 34, 108, 11, COLORS.white)
            .setStrokeStyle(4, COLORS.ink),
        );
      });
    }
    this.time.addEvent({ delay: 950, loop: true, callback: () => this.spawn() });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    void this.startRound();
  }

  private async startRound(): Promise<void> {
    const r = this.activity.rounds[this.round];
    if (!r) return;
    if (this.round > 0) this.meter.reset(r.goal);
    this.playing = true;
    this.spawn();
    await this.instruct(r.question);
  }

  private spawn(): void {
    if (!this.playing) return;
    const r = this.activity.rounds[this.round];
    if (!r) return;
    const alive = this.bubbles.filter((b) => !b.done);
    if (alive.length >= MAX_ALIVE) return;
    // Siempre hay al menos una burbuja correcta a la vista.
    const goodAlive = alive.some((b) => b.good);
    const good = !goodAlive || r.bad.length === 0 || Math.random() < 0.55;
    const def = Phaser.Utils.Array.GetRandom<GameThing>(good ? r.good : r.bad);
    let x = Phaser.Math.Between(170, 1110);
    for (let i = 0; i < 6 && Math.abs(x - this.lastX) < 200; i++)
      x = Phaser.Math.Between(170, 1110);
    this.lastX = x;

    // Burbuja: película transparente con borde, brillo y el dibujo adentro.
    const film = this.add.circle(0, 0, R, 0xdff4ff, 0.55).setStrokeStyle(5, COLORS.white, 0.95);
    const rim = this.add.circle(0, 0, R - 6).setStrokeStyle(2, 0x7cc8f5, 0.6);
    const shine = this.add.ellipse(-26, -30, 26, 14, COLORS.white, 0.85).setAngle(-35);
    const img = fitImage(this.add.image(0, -4, tex(def.art)), 84, 78);
    const label = addBody(this, 0, R + 12, def.label, 17, {
      stroke: '#FFFFFF',
      strokeThickness: 5,
    });
    const obj = this.add.container(x, START_Y, [film, rim, img, shine, label]).setDepth(4);
    obj.setScale(0);
    this.tweens.add({ targets: obj, scale: 1, duration: motion(320), ease: 'Back.easeOut' });

    const b: Bubble = {
      obj,
      film,
      def,
      good,
      baseX: x,
      vy: Phaser.Math.Between(58, 80),
      phase: Math.random() * 6,
      done: false,
    };
    film.setInteractive({ useHandCursor: true });
    film.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tap(b));
    this.bubbles.push(b);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    for (const b of this.bubbles) {
      if (b.done) continue;
      b.phase += dt * 1.6;
      b.obj.y -= b.vy * dt;
      b.obj.x = b.baseX + Math.sin(b.phase) * 26;
      // "Respira": se estira un poquito como una burbuja de verdad.
      b.obj.scaleX = 1 + Math.sin(b.phase * 2.3) * 0.03;
      b.obj.scaleY = 1 - Math.sin(b.phase * 2.3) * 0.03;
      if (b.obj.y < TOP_Y) this.vanish(b);
    }
    this.bubbles = this.bubbles.filter((b) => !b.done || b.obj.active);
  }

  /** Se va sin reventar (llegó arriba o terminó la ronda). */
  private vanish(b: Bubble): void {
    b.done = true;
    b.film.disableInteractive();
    this.tweens.add({
      targets: b.obj,
      alpha: 0,
      scale: 1.2,
      duration: motion(300),
      onComplete: () => b.obj.destroy(),
    });
  }

  private tap(b: Bubble): void {
    if (b.done || !this.playing) return;
    if (!b.good) {
      AudioManager.sfx('pop', { pitch: 0.65 });
      this.tweens.chain({
        targets: b.obj,
        tweens: [
          { scaleX: 1.2, scaleY: 0.85, duration: motion(90) },
          { scaleX: 0.9, scaleY: 1.12, duration: motion(90) },
          { scaleX: 1, scaleY: 1, duration: motion(300), ease: 'Elastic.easeOut' },
        ],
      });
      const hint = b.def.hint ?? this.activity.rounds[this.round]?.bad[0]?.hint;
      if (!hint) return;
      const key = `${this.round}/${b.def.label}`;
      if (this.counted.has(key)) {
        void this.say(hint);
      } else {
        this.counted.add(key);
        this.mistake(hint);
      }
      return;
    }

    // ¡Pop! La película estalla y el dibujo vuela a la meta.
    b.done = true;
    b.film.disableInteractive();
    const { x, y } = b.obj;
    AudioManager.sfx('pop', { pitch: 1.1 + this.meter.count * 0.06 });
    this.effects.sparkleAt(x, y, 10);
    const ring = this.add.circle(x, y, R).setStrokeStyle(6, COLORS.white, 1).setDepth(5);
    this.tweens.add({
      targets: ring,
      scale: 1.6,
      alpha: 0,
      duration: motion(320),
      onComplete: () => ring.destroy(),
    });
    b.obj.destroy();
    this.meter.fill(b.def.art, x, y);

    const roundDone = this.meter.done;
    const last = this.round === this.activity.rounds.length - 1;
    // Elogio hablado solo cada 3 aciertos (y al cerrar una ronda), para no saturar.
    const speak = roundDone
      ? last
        ? null
        : undefined
      : this.meter.count % 3 === 0
        ? pickPraise()
        : null;
    // Primera burbuja correcta de la ronda: si hay consejo, Tori lo dice y se muestra.
    const tip = this.activity.rounds[this.round]?.tip;
    if (tip && this.meter.count === 1) {
      this.correct(x, y, null);
      this.showTip(tip.text);
      void this.say(tip);
    } else {
      this.correct(x, y, speak);
    }
    if (roundDone) this.endRound(last);
  }

  /** Tarjetita con el consejo, arriba en el centro, que se va sola. */
  private showTip(text: string): void {
    const t = addBody(this, 0, 0, text, 20, { color: '#2B2848', wrap: 520 });
    const w = Math.min(600, t.width + 60);
    const h = t.height + 30;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, 18);
    g.fillStyle(0xfff8e7).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    g.lineStyle(4, COLORS.sun).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    const card = this.add.container(640, 150, [g, t]).setDepth(8).setScale(0.7).setAlpha(0);
    this.tweens.add({
      targets: card,
      scale: 1,
      alpha: 1,
      duration: motion(300),
      ease: 'Back.easeOut',
    });
    this.time.delayedCall(4200, () =>
      this.tweens.add({
        targets: card,
        alpha: 0,
        y: 120,
        duration: motion(400),
        onComplete: () => card.destroy(),
      }),
    );
  }

  private endRound(last: boolean): void {
    this.playing = false;
    this.dots[this.round]?.setFillStyle(COLORS.grass);
    for (const b of this.bubbles) if (!b.done) this.vanish(b);
    this.time.delayedCall(1500, () => {
      if (!this.alive) return;
      if (last) {
        void this.complete(this.activity.done);
      } else {
        this.round += 1;
        void this.startRound();
      }
    });
  }

  protected override getHint(): HintTarget | null {
    if (!this.playing) return null;
    const b = this.bubbles
      .filter((k) => !k.done && k.good && k.obj.y > 200 && k.obj.y < 520)
      .sort((p, q) => Math.abs(p.obj.y - 360) - Math.abs(q.obj.y - 360))[0];
    return b ? { kind: 'tap', x: b.obj.x, y: b.obj.y - 40 } : null;
  }
}
