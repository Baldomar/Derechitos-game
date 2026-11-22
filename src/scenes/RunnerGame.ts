import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { pickPraise } from '@/config/phrases';
import { COLORS } from '@/config/theme';
import type { GameThing, RunnerActivity } from '@/config/rights';
import { GoalMeter } from '@/components/GoalMeter';
import type { HintTarget } from '@/components/HelperHand';
import { fit } from '@/components/Kit';
import { isPuppet, Puppet } from '@/components/Puppet';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { viewportMargin } from '@/core/Viewport';
import { motion, prefersReducedMotion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const GROUND = 530;
const RUNNER_X = 250;
const GRAVITY = 2100;
const JUMP_V = -900;
const SPEED = 250;
const HIGH_Y = GROUND - 205;

/** Ancho que cubre cualquier pantalla panorámica (el paisaje se extiende fuera de 1280). */
const WIDE = 4200;

interface Thing {
  obj: Phaser.GameObjects.Container;
  def: GameThing;
  good: boolean;
  done: boolean;
}

/**
 * Motor "carrera": el personaje corre solito por el parque. Un toque (o clic, o la barra
 * espaciadora) = salto. Las cosas buenas aparecen en el piso o flotando (hay que saltar para
 * tomarlas) y las malas están en el piso (hay que saltarlas). Si choca, se tropieza un poquito
 * y Tori le recuerda saltar; nunca se pierde.
 */
export default class RunnerGameScene extends BaseActivity<RunnerActivity> {
  protected readonly kind = 'runner' as const;
  private runner!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private puppet: Puppet | null = null;
  private stride = 0;
  private shadow!: Phaser.GameObjects.Ellipse;
  private meter!: GoalMeter;
  private things: Thing[] = [];
  private y = GROUND;
  private vy = 0;
  private playing = false;
  private speed = SPEED;
  private nextSpawn = 0;
  private spawned = 0;
  private hills: Phaser.GameObjects.TileSprite[] = [];
  private stumbleUntil = 0;
  private tip!: Phaser.GameObjects.Text;

  constructor() {
    super('RunnerGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.things = [];
    this.y = GROUND;
    this.vy = 0;
    this.playing = false;
    this.speed = SPEED;
    this.nextSpawn = 0;
    this.spawned = 0;
    this.hills = [];
    this.stumbleUntil = 0;
    this.puppet = null;
    this.stride = 0;
  }

  protected override buildLevel(): void {
    this.meter = new GoalMeter(this, this.activity.goal);
    this.makeScenery();

    this.shadow = this.add.ellipse(RUNNER_X, GROUND + 4, 100, 20, COLORS.ink, 0.2).setDepth(3);
    this.body = this.makeRunner();
    this.runner = this.add.container(RUNNER_X, GROUND, [this.body]).setDepth(5);

    this.tip = addBody(this, RUNNER_X, GROUND - 190, '¡Toca para saltar!', 22, {
      stroke: '#FFFFFF',
      strokeThickness: 6,
    }).setDepth(6);
    this.tweens.add({
      targets: this.tip,
      y: this.tip.y - 8,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      // El botón "Volver" está arriba a la izquierda: ahí no se salta.
      if (p.y < 110 && p.x < 220) return;
      if (this.inputLocked) return; // Tori está dando indicaciones
      this.jump();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.jump());
    this.input.keyboard?.on('keydown-UP', () => this.jump());
  }

  /**
   * Corredor: muñeco articulado (piernas y brazos que se mueven de verdad) o, si ese dibujo no
   * tiene muñeco, la imagen entera con trotecito. Origen en los pies.
   */
  private makeRunner(): Phaser.GameObjects.Container {
    const key = this.activity.runner;
    if (isPuppet(key)) {
      this.puppet = new Puppet(this, 0, 0, key).setScale(0.95);
      return this.puppet;
    }
    const rig = this.add.container(0, 0);
    rig.add(fit(this.add.image(0, 0, tex(key)), 130, 150, 2).setOrigin(0.5, 1));
    return rig;
  }

  /** Parque que se desplaza: colinas lejanas, árboles y el camino (efecto de profundidad). */
  private makeScenery(): void {
    const mk = (
      key: string,
      w: number,
      h: number,
      draw: (g: Phaser.GameObjects.Graphics) => void,
    ): string => {
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        draw(g);
        g.generateTexture(key, w, h);
        g.destroy();
      }
      return key;
    };
    const far = mk('run-far', 640, 200, (g) => {
      g.fillStyle(0x9ed98a);
      g.fillEllipse(120, 200, 360, 220)
        .fillEllipse(430, 210, 420, 200)
        .fillEllipse(640, 200, 300, 200)
        .fillEllipse(0, 200, 300, 200);
    });
    const trees = mk('run-trees', 800, 220, (g) => {
      for (const [x, s] of [
        [80, 1],
        [330, 0.8],
        [560, 1.15],
        [720, 0.9],
      ] as const) {
        g.fillStyle(0x8a5a32).fillRect(x - 9 * s, 220 - 90 * s, 18 * s, 90 * s);
        g.fillStyle(COLORS.grassDark).fillCircle(x, 220 - 110 * s, 52 * s);
        g.fillStyle(0x6cc35a).fillCircle(x - 18 * s, 220 - 124 * s, 30 * s);
      }
    });
    const road = mk('run-road', 256, 200, (g) => {
      g.fillStyle(COLORS.grass).fillRect(0, 0, 256, 200);
      g.fillStyle(COLORS.sand).fillRect(0, 18, 256, 70);
      g.fillStyle(0xe8c983).fillCircle(40, 40, 5).fillCircle(150, 66, 4).fillCircle(210, 34, 6);
      g.fillStyle(COLORS.grassDark).fillRect(0, 16, 256, 4).fillRect(0, 86, 256, 4);
      g.fillStyle(0x6cc35a);
      for (let x = 10; x < 256; x += 34) g.fillTriangle(x, 130, x + 8, 112, x + 16, 130);
    });
    // Todo el paisaje es muy ancho para llenar la pantalla completa (también la panorámica).
    this.hills.push(this.add.tileSprite(640, GROUND - 120, WIDE, 200, far).setDepth(1));
    this.hills.push(this.add.tileSprite(640, GROUND - 110, WIDE, 220, trees).setDepth(1));
    this.hills.push(this.add.tileSprite(640, GROUND + 82, WIDE, 200, road).setDepth(2));
    // Pasto hasta el borde de abajo, aunque la pantalla sea más alta que el área de diseño.
    this.add
      .rectangle(640, GROUND + 180, WIDE, 2000, COLORS.grass)
      .setOrigin(0.5, 0)
      .setDepth(2);
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.playing = true;
    this.nextSpawn = this.time.now + 800;
  }

  private jump(): void {
    if (!this.playing || this.y < GROUND - 1) return;
    this.vy = JUMP_V;
    AudioManager.sfx('pop', { pitch: 1.4 });
    if (this.tip.visible) {
      this.tweens.add({
        targets: this.tip,
        alpha: 0,
        duration: 300,
        onComplete: () => this.tip.setVisible(false),
      });
    }
    this.tweens.add({
      targets: this.body,
      scaleY: this.body.scaleY * 1.12,
      duration: motion(120),
      yoyo: true,
    });
  }

  private spawn(): void {
    const a = this.activity;
    // Patrón fijo y variado: bueno en el piso, malo, bueno arriba… (fácil de leer para un niño).
    const pattern = [
      'good-low',
      'bad',
      'good-high',
      'good-low',
      'bad',
      'good-high',
      'bad',
      'good-low',
    ];
    const kind = pattern[this.spawned % pattern.length] ?? 'good-low';
    this.spawned += 1;
    const good = kind !== 'bad';
    const def = Phaser.Utils.Array.GetRandom<GameThing>(good ? a.good : a.bad);
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (good) {
      parts.push(this.add.circle(0, 0, 44, COLORS.white, 0.9).setStrokeStyle(4, COLORS.sun));
    }
    const img = fit(this.add.image(0, 0, tex(def.art)), good ? 70 : 92, good ? 70 : 84, 1.6);
    parts.push(img);
    // Lo malo se apoya en el piso; lo bueno flota (en el piso o arriba, para saltar).
    const y =
      kind === 'good-high' ? HIGH_Y : good ? GROUND - 50 : GROUND - img.displayHeight / 2 + 6;
    const obj = this.add.container(this.rightEdge() + 100, y, parts).setDepth(4);
    if (good && !prefersReducedMotion()) {
      this.tweens.add({
        targets: obj,
        y: y - 10,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    this.things.push({ obj, def, good, done: false });
  }

  /** Borde derecho visible (en coordenadas del juego), incluido el margen de pantallas anchas. */
  private rightEdge(): number {
    return 1280 + viewportMargin(this.game).x;
  }

  override update(time: number, delta: number): void {
    if (!this.runner) return;
    const dt = Math.min(delta, 50) / 1000;
    const slow = time < this.stumbleUntil;
    const speed = this.playing ? (slow ? this.speed * 0.4 : this.speed) : 0;

    // Fondo en capas a distinta velocidad.
    const rates = [0.15, 0.4, 1];
    this.hills.forEach((h, i) => {
      h.tilePositionX += speed * dt * (rates[i] ?? 1);
    });

    // Salto con gravedad.
    this.vy += GRAVITY * dt;
    this.y = Math.min(GROUND, this.y + this.vy * dt);
    if (this.y >= GROUND) this.vy = 0;
    this.runner.y = this.y;
    const air = GROUND - this.y;
    this.shadow.setScale(1 - air / 400).setAlpha(0.2 - air / 2000);
    // Ciclo de carrera (lo anima el muñeco), salto con piernas recogidas o quieto.
    const reduced = prefersReducedMotion();
    const pup = this.puppet;
    const tweening = this.tweens.isTweening(this.body);
    if (air < 1 && speed > 0) {
      this.stride += dt * (speed / SPEED) * (reduced ? 6 : 11);
      if (pup) {
        pup.setMode('run');
        if (!tweening) this.body.angle = 0;
      } else {
        this.body.y = reduced ? 0 : -Math.abs(Math.cos(this.stride)) * 7;
        if (!tweening) this.body.angle = Math.sin(this.stride) * 5;
      }
    } else if (air >= 1) {
      pup?.setMode('jump');
      if (!pup) this.body.y = 0;
      if (!tweening) this.body.angle = pup ? 0 : -8;
    } else {
      pup?.setMode('idle');
      if (!pup) this.body.y = 0;
      if (!tweening) this.body.angle = 0;
    }

    if (!this.playing) return;
    if (time > this.nextSpawn) {
      this.spawn();
      this.nextSpawn = time + 1700 + Math.random() * 500;
    }

    for (const t of this.things) {
      if (t.done) continue;
      t.obj.x -= speed * dt;
      if (t.obj.x < -viewportMargin(this.game).x - 120) {
        t.done = true;
        t.obj.destroy();
        continue;
      }
      const dx = Math.abs(t.obj.x - RUNNER_X);
      const ry = this.y - 70;
      const dy = Math.abs(t.obj.y - ry);
      if (dx < 62 && dy < (t.good ? 85 : 70)) {
        t.done = true;
        if (t.good) this.collect(t);
        else this.bump(t);
      }
    }
    this.things = this.things.filter((t) => !t.done || t.obj.active);
  }

  private collect(t: Thing): void {
    AudioManager.sfx('pop', { pitch: 1.1 + this.meter.count * 0.06 });
    this.tweens.killTweensOf(t.obj);
    this.tweens.add({
      targets: t.obj,
      scale: 0,
      duration: motion(200),
      onComplete: () => t.obj.destroy(),
    });
    this.meter.fill(t.def.art, t.obj.x, t.obj.y);
    const finished = this.meter.done;
    this.correct(
      RUNNER_X,
      this.y - 170,
      finished ? null : this.meter.count % 3 === 0 ? pickPraise() : null,
    );
    if (finished) void this.finish();
  }

  private bump(t: Thing): void {
    AudioManager.sfx('hint');
    this.stumbleUntil = this.time.now + 900;
    // Tropezón suave: gira un poquito y la cosa sale rodando.
    this.tweens.add({ targets: this.body, angle: 20, duration: motion(150), yoyo: true });
    this.tweens.add({
      targets: t.obj,
      x: t.obj.x + 160,
      y: t.obj.y - 60,
      angle: 200,
      alpha: 0,
      duration: motion(600),
      onComplete: () => t.obj.destroy(),
    });
    const hint = (t.def.hint ?? this.activity.bad[0]?.hint) as NonNullable<GameThing['hint']>;
    this.mistakeOnce(t.def.label, hint);
  }

  private async finish(): Promise<void> {
    this.playing = false;
    for (const t of this.things) {
      if (t.done) continue;
      t.done = true;
      this.tweens.add({
        targets: t.obj,
        scale: 0,
        duration: motion(250),
        onComplete: () => t.obj.destroy(),
      });
    }
    // Llega a la meta: saltos de alegría.
    this.vy = JUMP_V * 0.7;
    this.time.delayedCall(700, () => {
      this.vy = JUMP_V * 0.7;
    });
    await this.wait(900);
    await this.complete(this.activity.done);
  }

  protected override getHint(): HintTarget | null {
    if (!this.playing) return null;
    const next = this.things.find(
      (t) => !t.done && t.obj.x > RUNNER_X && (!t.good || t.obj.y < GROUND - 100),
    );
    if (!next) return null;
    return { kind: 'tap', x: RUNNER_X + 120, y: GROUND - 140 };
  }
}
