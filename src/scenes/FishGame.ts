import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { pickPraise } from '@/config/phrases';
import { COLORS } from '@/config/theme';
import type { FishActivity, GameThing } from '@/config/rights';
import { GoalMeter } from '@/components/GoalMeter';
import type { HintTarget } from '@/components/HelperHand';
import { fit, RoundDots } from '@/components/Kit';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { viewportMargin } from '@/core/Viewport';
import { BaseActivity } from './BaseActivity';

const SURFACE = 250;
const BOAT_X = 640;
const BOAT_Y = SURFACE - 4;
const LANES = [350, 440, 530];
/** Muy ancho: el mar llena la pantalla completa (también la panorámica). */
const WIDE = 4400;
const ROD_LEN = 170;
/** Mano del niño (donde se agarra la caña), relativa al bote. */
const HAND = { x: 10, y: -26 };
/** Cubeta dentro del bote, relativa al bote. */
const BUCKET = { x: -56, y: -26 };
const REST_ANGLE = -62;

interface Swimmer {
  obj: Phaser.GameObjects.Container;
  def: GameThing;
  good: boolean;
  lane: number;
  speed: number;
  phase: number;
  hooked: boolean;
}

type Pt = { x: number; y: number };
type State = 'idle' | 'cast' | 'sink' | 'wait' | 'bite' | 'reel' | 'swing';

/**
 * Motor "pesca": el bote se queda quieto en medio del mar y el niño lanza la caña.
 * Se toca el agua donde está lo que queremos: la caña se echa hacia atrás, el corcho y el
 * anzuelo vuelan en curva hasta ese punto (¡splash!), el anzuelo se hunde y, si algo pica,
 * el corcho se hunde, la caña tiembla y se recoge la línea: la comida sale del agua y vuela
 * a la cubeta del bote. Lo que no va, el niño lo devuelve al agua con una pista.
 */
export default class FishGameScene extends BaseActivity<FishActivity> {
  protected readonly kind = 'fish' as const;
  private round = 0;
  private meter!: GoalMeter;
  private dots!: RoundDots;
  private swimmers: Swimmer[] = [];
  private boat!: Phaser.GameObjects.Container;
  private bucket!: Phaser.GameObjects.Graphics;
  private rod!: Phaser.GameObjects.Container;
  private line!: Phaser.GameObjects.Graphics;
  private bobber!: Phaser.GameObjects.Container;
  private hook!: Phaser.GameObjects.Container;
  private waves!: Phaser.GameObjects.TileSprite;
  private state: State = 'idle';
  private rodAngle = REST_ANGLE;
  private bend = 0;
  private bob: Pt = { x: 0, y: 0 };
  private hookPos: Pt = { x: 0, y: 0 };
  private dip = 0;
  private sag = 10;
  private target: Pt = { x: 0, y: 0 };
  private waitUntil = 0;
  private caught: Swimmer | null = null;
  private playing = false;

  constructor() {
    super('FishGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.round = 0;
    this.swimmers = [];
    this.state = 'idle';
    this.rodAngle = REST_ANGLE;
    this.bend = 0;
    this.dip = 0;
    this.sag = 10;
    this.caught = null;
    this.playing = false;
  }

  /** Bordes visibles (con el margen de pantallas anchas). */
  private edges(): { left: number; right: number } {
    const m = viewportMargin(this.game).x;
    return { left: -m, right: 1280 + m };
  }

  protected override buildLevel(): void {
    const first = this.activity.rounds[0];
    this.meter = new GoalMeter(this, first?.goal ?? 3);
    this.dots = new RoundDots(this, this.activity.rounds.length);
    this.buildSea();
    this.buildBoat();

    this.line = this.add.graphics().setDepth(6);
    // Corcho rojo y blanco.
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.white).fillCircle(0, 0, 11);
    bg.fillStyle(0xe23b3b).slice(0, 0, 11, Math.PI, 0, false).fillPath();
    bg.lineStyle(3, COLORS.ink).strokeCircle(0, 0, 11);
    bg.lineStyle(3, COLORS.ink).lineBetween(0, -11, 0, -18);
    this.bobber = this.add.container(0, 0, [bg]).setDepth(7);
    // Anzuelo plateado.
    const hg = this.add.graphics();
    hg.lineStyle(5, COLORS.ink);
    hg.beginPath();
    hg.arc(0, 8, 9, 0, Math.PI, false);
    hg.strokePath();
    hg.lineBetween(9, 8, 9, -8);
    hg.lineStyle(2.5, 0xc9d2dc);
    hg.beginPath();
    hg.arc(0, 8, 9, 0.1, Math.PI - 0.1, false);
    hg.strokePath();
    hg.fillStyle(0x9aa5b5).fillCircle(9, -9, 3.5);
    this.hook = this.add.container(0, 0, [hg]).setDepth(7);

    addBody(this, 220, 170, '¡Toca el agua\npara pescar!', 22, {
      stroke: '#FFFFFF',
      strokeThickness: 6,
    }).setDepth(3);

    void this.startRound(false);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.y < 110 && p.x < 220) return; // botón "Volver"
      if (!this.playing || this.state !== 'idle' || p.y < SURFACE - 10) return;
      const { left, right } = this.edges();
      this.cast(
        Phaser.Math.Clamp(p.x, left + 60, right - 60),
        Phaser.Math.Clamp(p.y, SURFACE + 60, 600),
      );
    });
  }

  /** Mar de borde a borde: franjas de azul, arena, algas, piedras y olitas. */
  private buildSea(): void {
    const g = this.add.graphics();
    const x0 = BOAT_X - WIDE / 2;
    const blues = [0x7fd3f7, 0x5cc3f0, 0x46acdf, 0x3a96c9];
    blues.forEach((c, i) => g.fillStyle(c).fillRect(x0, SURFACE + i * 90, WIDE, 92));
    g.fillStyle(0x3a96c9).fillRect(x0, SURFACE + 360, WIDE, 2000);
    g.fillStyle(0xe8c983).fillRect(x0, 625, WIDE, 2000);
    for (let x = -1400; x < 2700; x += 260) g.fillEllipse(x, 628, 300, 50);
    for (let x = -1300; x < 2600; x += 230) {
      if (Math.abs(x - 640) < 90) continue;
      g.fillStyle(0x3e9a4c);
      for (let k = 0; k < 3; k++) g.fillEllipse(x + k * 14, 570 - k * 6, 14, 90 - k * 10);
    }
    g.fillStyle(0xa9b4c2).fillEllipse(520, 612, 70, 34).fillEllipse(560, 618, 50, 26);
    g.fillStyle(0xa9b4c2).fillEllipse(-260, 614, 60, 30).fillEllipse(1520, 612, 64, 30);
    if (!this.textures.exists('fish-waves')) {
      const w = this.make.graphics({ x: 0, y: 0 }, false);
      w.fillStyle(COLORS.white, 0.75);
      for (let x = 0; x < 128; x += 32) w.fillEllipse(x + 16, 8, 30, 10);
      w.generateTexture('fish-waves', 128, 16);
      w.destroy();
    }
    this.waves = this.add.tileSprite(BOAT_X, SURFACE, WIDE, 16, 'fish-waves').setDepth(5);
  }

  /** Bote de madera con el niño sentado adentro y una cubeta para lo que pesca. */
  private buildBoat(): void {
    const kid = fit(this.add.image(-5, -40, tex('nino-a')), 80, 90, 1);
    this.bucket = this.add.graphics({ x: BUCKET.x, y: BUCKET.y });
    this.bucket.fillStyle(0x6fb7e8).fillPoints(
      [
        { x: -14, y: -12 },
        { x: 14, y: -12 },
        { x: 10, y: 14 },
        { x: -10, y: 14 },
      ],
      true,
    );
    this.bucket.fillStyle(COLORS.white, 0.35).fillRect(-10, -8, 4, 18);
    this.bucket.lineStyle(3, COLORS.ink).strokePoints(
      [
        { x: -14, y: -12 },
        { x: 14, y: -12 },
        { x: 10, y: 14 },
        { x: -10, y: 14 },
      ],
      true,
    );
    this.bucket.lineStyle(2.5, COLORS.ink);
    this.bucket.beginPath();
    this.bucket.arc(0, -12, 13, Math.PI, 0, false);
    this.bucket.strokePath();

    const hull = this.add.graphics();
    const pts = [
      { x: -104, y: -28 },
      { x: -88, y: -12 },
      { x: 88, y: -12 },
      { x: 108, y: -30 },
      { x: 78, y: 24 },
      { x: -74, y: 24 },
    ];
    hull.fillStyle(0xc9773f).fillPoints(pts, true);
    hull.fillStyle(0xa95f2e).fillRect(-80, 8, 160, 14);
    hull.lineStyle(2.5, 0x8a4f26).lineBetween(-90, -1, 92, -1).lineBetween(-80, 10, 84, 10);
    hull.fillStyle(COLORS.white, 0.25).fillRect(-80, -8, 150, 4);
    hull.lineStyle(5, COLORS.ink).strokePoints(pts, true);
    hull.lineStyle(7, 0x8a4f26).lineBetween(-88, -12, 88, -12);
    hull.lineStyle(3, COLORS.ink).lineBetween(-88, -16, 88, -16);
    this.boat = this.add.container(BOAT_X, BOAT_Y, [kid, this.bucket, hull]).setDepth(4);

    // Caña: mango oscuro con carrete y vara que se afina hacia la punta.
    const r = this.add.graphics();
    r.lineStyle(10, COLORS.ink).lineBetween(-4, 0, 36, 0);
    r.lineStyle(7, 0x3b2f2f).lineBetween(-3, 0, 35, 0);
    r.fillStyle(0x9aa5b5).fillCircle(16, 9, 7);
    r.lineStyle(2.5, COLORS.ink).strokeCircle(16, 9, 7);
    r.lineStyle(8, COLORS.ink).lineBetween(34, 0, 110, 0);
    r.lineStyle(5, 0xa8733f).lineBetween(35, 0, 109, 0);
    r.lineStyle(6, COLORS.ink).lineBetween(108, 0, ROD_LEN, 0);
    r.lineStyle(3, 0xc68d55).lineBetween(109, 0, ROD_LEN - 1, 0);
    r.fillStyle(COLORS.ink).fillCircle(ROD_LEN, 0, 3);
    this.rod = this.add.container(0, 0, [r]).setDepth(6);
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.playing = true;
    const r = this.activity.rounds[0];
    if (r) void this.instruct(r.question);
  }

  private async startRound(speak = true): Promise<void> {
    const r = this.activity.rounds[this.round];
    if (!r) return;
    this.swimmers.forEach((s) => s.obj.destroy());
    this.swimmers = [];
    if (this.round > 0) this.meter.reset(r.goal);
    const list: { def: GameThing; good: boolean }[] = [
      ...r.good.map((def) => ({ def, good: true })),
      ...r.bad.map((def) => ({ def, good: false })),
    ];
    Phaser.Utils.Array.Shuffle(list);
    const { left, right } = this.edges();
    const step = (right - left) / list.length;
    list.forEach((it, i) =>
      this.addSwimmer(it.def, it.good, i % LANES.length, left + step * (i + 0.5)),
    );
    if (!speak) return;
    this.playing = true;
    await this.instruct(r.question);
  }

  private addSwimmer(def: GameThing, good: boolean, lane: number, x: number): void {
    const bubble = this.add
      .circle(0, 0, 46, COLORS.white, 0.55)
      .setStrokeStyle(4, COLORS.white, 0.95);
    const shine = this.add.circle(-18, -18, 8, COLORS.white, 0.9);
    const img = fit(this.add.image(0, 0, tex(def.art)), 66, 66, 1.5);
    const obj = this.add.container(x, LANES[lane] ?? 440, [bubble, img, shine]).setDepth(2);
    const dir = lane % 2 === 0 ? 1 : -1;
    this.swimmers.push({
      obj,
      def,
      good,
      lane,
      speed: dir * (55 + Math.random() * 25),
      phase: Math.random() * 6,
      hooked: false,
    });
  }

  // ------------------------------------------------------------------ caña

  private pivot(): Pt {
    const p = this.boat.getWorldTransformMatrix().transformPoint(HAND.x, HAND.y);
    return { x: p.x, y: p.y };
  }

  private tip(): Pt {
    const p = this.pivot();
    const a = Phaser.Math.DegToRad(this.rod.angle);
    return { x: p.x + Math.cos(a) * ROD_LEN, y: p.y + Math.sin(a) * ROD_LEN };
  }

  /** Lanzar: la caña se echa atrás, sale disparada y el corcho vuela en curva hasta (x, y). */
  private cast(x: number, y: number): void {
    this.state = 'cast';
    this.target = { x, y };
    const side = x >= this.pivot().x ? 1 : -1;
    const aim = side > 0 ? -32 : -148;
    const windup = side > 0 ? -128 : -52;
    AudioManager.sfx('pop', { pitch: 0.8 });
    this.tweens.chain({
      tweens: [
        { targets: this, rodAngle: windup, duration: motion(220), ease: 'Sine.easeOut' },
        {
          targets: this,
          rodAngle: aim,
          duration: motion(170),
          ease: 'Back.easeOut',
          onStart: () => this.fly(x),
        },
      ],
    });
  }

  /** Vuelo del corcho y el anzuelo en parábola hasta la superficie. */
  private fly(x: number): void {
    const from = this.tip();
    const to = { x, y: SURFACE };
    const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, SURFACE) - 150 };
    const p = { t: 0 };
    this.sag = 0;
    AudioManager.sfx('pop', { pitch: 1.5 });
    this.tweens.add({
      targets: p,
      t: 1,
      duration: motion(420 + Math.abs(to.x - from.x) * 0.35),
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const t = p.t;
        const u = 1 - t;
        this.bob = {
          x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
          y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
        };
        this.hookPos = { x: this.bob.x, y: this.bob.y + 16 };
      },
      onComplete: () => {
        this.splash(x, SURFACE, 1);
        this.hookPos = { x, y: SURFACE + 16 };
        this.sag = 34;
        this.state = 'sink';
      },
    });
  }

  /** ¡Pica! El corcho se hunde, la caña tiembla y luego se recoge. */
  private bite(s: Swimmer): void {
    this.state = 'bite';
    s.hooked = true;
    this.caught = s;
    s.obj.setDepth(8);
    AudioManager.sfx('pop', { pitch: 1.3 });
    this.tweens.add({ targets: this, dip: 14, duration: motion(110), yoyo: true, repeat: 2 });
    this.tweens.add({ targets: this, bend: 1, duration: motion(110), yoyo: true, repeat: 2 });
    this.time.delayedCall(motion(520), () => {
      if (!this.alive) return;
      this.sag = 8;
      this.state = 'reel';
    });
  }

  /** Sale del agua y vuela al bote (a la cubeta, o de vuelta a la punta si no pescó nada). */
  private swing(): void {
    this.state = 'swing';
    const s = this.caught;
    this.splash(this.hookPos.x, SURFACE, s ? 1 : 0.6);
    const from = { ...this.hookPos };
    const bucket = this.boat
      .getWorldTransformMatrix()
      .transformPoint(BUCKET.x, BUCKET.y - (s ? 60 : 0));
    const to = s
      ? { x: bucket.x, y: bucket.y }
      : (() => {
          const t = this.tip();
          return { x: t.x, y: t.y + 50 };
        })();
    const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 170 };
    const p = { t: 0 };
    this.tweens.add({ targets: this, rodAngle: REST_ANGLE - 10, duration: motion(500) });
    this.tweens.add({
      targets: p,
      t: 1,
      duration: motion(620),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = p.t;
        const u = 1 - t;
        this.hookPos = {
          x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
          y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
        };
        this.bob = { x: this.hookPos.x, y: this.hookPos.y - 16 };
      },
      onComplete: () => {
        this.caught = null;
        if (s) this.landed(s);
        this.state = 'idle';
      },
    });
  }

  /** Salpicadura: anillos que se abren y gotitas que saltan. */
  private splash(x: number, y: number, size: number): void {
    if (!this.alive) return;
    AudioManager.sfx('pop', { pitch: 0.6 });
    for (let k = 0; k < 2; k++) {
      const ring = this.add.ellipse(x, y + 2, 30, 8).setStrokeStyle(3, COLORS.white, 0.9);
      ring.setDepth(5).setFillStyle();
      this.tweens.add({
        targets: ring,
        scaleX: 3.2 * size,
        scaleY: 2.2 * size,
        alpha: 0,
        delay: k * 140,
        duration: motion(600),
        onComplete: () => ring.destroy(),
      });
    }
    if (prefersReducedMotion()) return;
    for (let k = 0; k < 7; k++) {
      const d = this.add.circle(x, y, 3 + Math.random() * 3, COLORS.white, 0.95).setDepth(7);
      const dx = (k - 3) * 14 * size + (Math.random() - 0.5) * 8;
      const up = 30 + Math.random() * 40 * size;
      this.tweens.chain({
        targets: d,
        tweens: [
          { x: x + dx * 0.6, y: y - up, duration: motion(220), ease: 'Quad.easeOut' },
          { x: x + dx, y: y + 6, alpha: 0, duration: motion(260), ease: 'Quad.easeIn' },
        ],
        onComplete: () => d.destroy(),
      });
    }
  }

  override update(time: number, delta: number): void {
    if (!this.hook) return;
    const dt = Math.min(delta, 50) / 1000;
    this.waves.tilePositionX += dt * 30;
    const { left, right } = this.edges();

    for (const s of this.swimmers) {
      if (s.hooked) continue;
      s.phase += dt * 2;
      s.obj.x += s.speed * dt;
      if (s.obj.x > right + 80) s.obj.x = left - 80;
      if (s.obj.x < left - 80) s.obj.x = right + 80;
      s.obj.y = (LANES[s.lane] ?? 440) + Math.sin(s.phase) * 8;
      if (!prefersReducedMotion()) s.obj.angle = Math.sin(s.phase * 0.7) * 6;
    }

    // El bote se queda en su lugar: solo se mece con las olas.
    this.boat.y = BOAT_Y + Math.sin(time / 520) * 4;
    this.boat.angle = Math.sin(time / 760) * 2.5;

    const pv = this.pivot();
    const shake = this.bend * Math.sin(time / 30) * 6;
    this.rod.setPosition(pv.x, pv.y).setAngle(this.rodAngle + shake + this.bend * 8);
    const tip = this.tip();
    const bobY = SURFACE + Math.sin(time / 300) * 2.5 + this.dip;

    switch (this.state) {
      case 'idle': {
        this.rodAngle += (REST_ANGLE - this.rodAngle) * Math.min(1, dt * 4);
        this.bob = { x: tip.x, y: tip.y + 24 };
        this.hookPos = { x: tip.x + Math.sin(time / 420) * 4, y: tip.y + 50 };
        this.sag = 0;
        break;
      }
      case 'sink': {
        this.bob = { x: this.target.x, y: bobY };
        this.hookPos.y = Math.min(this.target.y, this.hookPos.y + 460 * dt);
        this.hookPos.x = this.target.x;
        if (!this.checkBite() && this.hookPos.y >= this.target.y) {
          this.state = 'wait';
          this.waitUntil = time + 900;
        }
        break;
      }
      case 'wait': {
        this.bob = { x: this.target.x, y: bobY };
        this.hookPos.x = this.target.x + Math.sin(time / 260) * 3;
        if (!this.checkBite() && time > this.waitUntil) {
          this.sag = 8;
          this.state = 'reel';
        }
        break;
      }
      case 'bite':
        this.bob = { x: this.target.x, y: bobY };
        break;
      case 'reel': {
        this.bob = { x: this.target.x, y: bobY };
        this.hookPos.y -= 520 * dt;
        this.hookPos.x += (this.target.x - this.hookPos.x) * Math.min(1, dt * 6);
        if (this.hookPos.y <= SURFACE + 16) {
          this.hookPos.y = SURFACE + 16;
          this.swing();
        }
        break;
      }
      case 'cast':
      case 'swing':
        break;
    }

    // Lo que pescó cuelga del anzuelo y se sacude.
    if (this.caught) {
      this.caught.obj.setPosition(this.hookPos.x, this.hookPos.y + 46);
      this.caught.obj.angle = Math.sin(time / 70) * 12;
    }

    this.hook.setPosition(this.hookPos.x, this.hookPos.y);
    this.bobber.setPosition(this.bob.x, this.bob.y);
    this.drawLine(tip);
  }

  /** Hilo: de la punta de la caña al corcho (con curva si está flojo) y del corcho al anzuelo. */
  private drawLine(tip: Pt): void {
    const g = this.line.clear().lineStyle(2.5, COLORS.ink, 0.85);
    const mid = { x: (tip.x + this.bob.x) / 2, y: (tip.y + this.bob.y) / 2 + this.sag };
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(tip.x, tip.y),
      new Phaser.Math.Vector2(mid.x, mid.y),
      new Phaser.Math.Vector2(this.bob.x, this.bob.y - 10),
    );
    g.strokePoints(curve.getPoints(16));
    g.lineBetween(this.bob.x, this.bob.y + 10, this.hookPos.x + 9, this.hookPos.y - 9);
  }

  /** ¿El anzuelo tocó algo que nada? */
  private checkBite(): boolean {
    const hit = this.swimmers.find(
      (s) =>
        !s.hooked &&
        Phaser.Math.Distance.Between(s.obj.x, s.obj.y, this.hookPos.x, this.hookPos.y + 20) < 52,
    );
    if (!hit) return false;
    this.bite(hit);
    return true;
  }

  private landed(s: Swimmer): void {
    const r = this.activity.rounds[this.round];
    if (!r) return;
    if (!s.good) {
      // El niño lo devuelve al agua: vuela en curva y cae con un chapuzón.
      const from = { x: s.obj.x, y: s.obj.y };
      const toX = BOAT_X + (from.x < BOAT_X ? -300 : 300);
      const p = { t: 0 };
      this.tweens.add({
        targets: p,
        t: 1,
        duration: motion(700),
        ease: 'Sine.easeIn',
        onUpdate: () => {
          const t = p.t;
          s.obj.setPosition(
            from.x + (toX - from.x) * t,
            from.y + ((LANES[s.lane] ?? 440) - from.y) * t - Math.sin(Math.PI * t) * 140,
          );
          s.obj.angle = 360 * t;
        },
        onComplete: () => {
          this.splash(toX, SURFACE, 1);
          s.obj.setDepth(2).setAngle(0);
          s.hooked = false;
        },
      });
      this.mistakeOnce(
        `${this.round}/${s.def.label}`,
        (s.def.hint ?? r.bad[0]?.hint) as NonNullable<GameThing['hint']>,
      );
      return;
    }
    // ¡A la cubeta!
    this.swimmers = this.swimmers.filter((k) => k !== s);
    const b = this.boat.getWorldTransformMatrix().transformPoint(BUCKET.x, BUCKET.y);
    this.tweens.add({
      targets: s.obj,
      x: b.x,
      y: b.y - 4,
      scale: 0.25,
      angle: 0,
      duration: motion(260),
      ease: 'Quad.easeIn',
      onComplete: () => s.obj.destroy(),
    });
    this.tweens.add({
      targets: this.bucket,
      scaleY: 0.8,
      scaleX: 1.15,
      delay: motion(240),
      duration: motion(90),
      yoyo: true,
    });
    this.meter.fill(s.def.art, b.x, b.y - 20);
    const roundDone = this.meter.done;
    const last = this.round === this.activity.rounds.length - 1;
    this.correct(
      b.x,
      b.y - 70,
      roundDone ? (last ? null : undefined) : this.meter.count % 2 === 0 ? pickPraise() : null,
    );
    if (!roundDone) {
      // Siempre queda algo bueno nadando.
      const good = r.good[Math.floor(Math.random() * r.good.length)];
      const { left, right } = this.edges();
      if (good) this.addSwimmer(good, true, s.lane, s.speed > 0 ? left - 80 : right + 80);
      return;
    }
    this.playing = false;
    this.dots.mark(this.round);
    this.time.delayedCall(1300, () => {
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
    if (!this.playing || this.state !== 'idle') return null;
    const s = this.swimmers.find((k) => k.good && !k.hooked && k.obj.x > 200 && k.obj.x < 1080);
    if (!s) return null;
    // Apunta un poquito adelante, hacia donde va nadando.
    return { kind: 'tap', x: s.obj.x + s.speed * 0.8, y: LANES[s.lane] ?? s.obj.y };
  }
}
