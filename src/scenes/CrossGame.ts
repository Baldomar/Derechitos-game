import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { COLORS, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import type { CrossActivity } from '@/config/rights';
import type { VoiceLine } from '@/config/levels';
import { BigButton } from '@/components/BigButton';
import type { HintTarget } from '@/components/HelperHand';
import { fit, RoundDots } from '@/components/Kit';
import { isPuppet, Puppet } from '@/components/Puppet';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { viewportMargin } from '@/core/Viewport';
import { BaseActivity } from './BaseActivity';

const INK = COLORS.ink;
/** Banqueta de enfrente, calle (dos carriles) y banqueta de este lado. */
const FAR_TOP = 205;
const STREET_TOP = 285;
const STREET_BOT = 505;
const LANES = [
  { y: 352, dir: 1 }, // vienen de la izquierda
  { y: 446, dir: -1 }, // vienen de la derecha
];
const ZEBRA = { x0: 545, x1: 735 };
const NEAR_FEET = 618;
const FAR_FEET = 270;
const ADULT_X = 590;
const KID_START_X = 880;
const HAND_GAP = 62;
const NEAR_SCALE = 0.62;
const FAR_SCALE = 0.42;
const LIGHT = { x: 812, y: 360 };
const CAR_W = 150;
const FAR = 2000;
/** Panel derecho (botones de cada nivel). */
const PANEL_X = 1110;

type LightState = 'red' | 'green';
type Side = 'left' | 'right';
type Stage = 'banner' | 'hand' | 'wait' | 'look' | 'choose' | 'crossing' | 'busy' | 'done';

interface Car {
  img: Phaser.GameObjects.Image;
  lane: number;
  speed: number;
}

interface Eye {
  side: Side;
  c: Phaser.GameObjects.Container;
  check: Phaser.GameObjects.Graphics;
}

/**
 * "¡Cruzo seguro!" (Derecho a la vida): tres niveles distintos en la misma calle.
 * 1) El semáforo: dar la mano a mamá y cruzar solo en verde.
 * 2) Mira a los dos lados: sin semáforo, tocar los ojitos y cruzar cuando no venga ningún carro.
 * 3) La pelota: la pelota se va a la calle; lo seguro es pedir ayuda a un adulto.
 * Cada nivel empieza con su letrero y la explicación de Tori, sin que una frase corte a otra.
 */
export default class CrossGameScene extends BaseActivity<CrossActivity> {
  protected readonly kind = 'cross' as const;
  private adult!: Phaser.GameObjects.Container;
  private kid!: Phaser.GameObjects.Container;
  private level = 0;
  private stage: Stage = 'banner';
  private light: LightState = 'red';
  private lightParts: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Arc)[] = [];
  private lightG!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Arc;
  private cars: Car[] = [];
  private traffic = false;
  private nextCar = [0, 0];
  private dots!: RoundDots;
  private crossBtn!: BigButton;
  private eyes: Eye[] = [];
  private looked = { left: false, right: false };
  private choices: Phaser.GameObjects.Container[] = [];
  private ball: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('CrossGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.level = 0;
    this.stage = 'banner';
    this.light = 'red';
    this.lightParts = [];
    this.cars = [];
    this.traffic = false;
    this.nextCar = [0, 0];
    this.eyes = [];
    this.looked = { left: false, right: false };
    this.choices = [];
    this.ball = null;
  }

  protected override buildLevel(): void {
    this.dots = new RoundDots(this, 3, 1240, 64);
    this.buildStreet();
    this.buildLight();
    this.adult = this.person(this.activity.adult, ADULT_X, NEAR_FEET);
    this.kid = this.person(this.activity.kid, KID_START_X, NEAR_FEET);
    // Zona para tocar a mamá: todo su cuerpo (el origen del muñeco está en los pies).
    this.adult.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-70, -230, 140, 236),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.adult.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.takeHand());
    this.crossBtn = new BigButton(this, PANEL_X, 600, {
      label: '¡Cruzar!',
      icon: 'play',
      width: 250,
      height: 92,
      fontSize: 38,
      color: COLORS.grass,
      onClick: () => this.cross(),
    }).setDepth(20);
    this.buildEyes();
    this.showEyes(false);
  }

  private person(key: CrossActivity['kid'], x: number, y: number): Phaser.GameObjects.Container {
    if (isPuppet(key)) return new Puppet(this, x, y, key).setScale(NEAR_SCALE).setDepth(8);
    const img = fit(this.add.image(0, 0, tex(key)), 120, 200, 2).setOrigin(0.5, 1);
    return this.add.container(x, y, [img]).setDepth(8);
  }

  private pup(c: Phaser.GameObjects.Container): Puppet | null {
    return c instanceof Puppet ? c : null;
  }

  private face(c: Phaser.GameObjects.Container, side: Side): void {
    const p = this.pup(c);
    if (p) p.scaleX = Math.abs(p.scaleX) * (side === 'left' ? -1 : 1);
  }

  // ------------------------------------------------------------------ escenario

  private buildStreet(): void {
    const g = this.add.graphics().setDepth(0.2);
    const L = -FAR;
    const W = GAME_WIDTH + FAR * 2;
    g.fillStyle(0x7fd06b).fillRect(L, FAR_TOP - 30, W, 34);
    g.fillStyle(0xd8dde6).fillRect(L, FAR_TOP, W, STREET_TOP - FAR_TOP);
    g.lineStyle(2, 0xc2c9d4);
    for (let x = -FAR; x < GAME_WIDTH + FAR; x += 70) g.lineBetween(x, FAR_TOP, x, STREET_TOP);
    g.fillStyle(0xaab3c0).fillRect(L, STREET_TOP - 10, W, 10);
    g.fillStyle(0x5a6472).fillRect(L, STREET_TOP, W, STREET_BOT - STREET_TOP);
    g.fillStyle(COLORS.sun);
    const mid = (STREET_TOP + STREET_BOT) / 2;
    for (let x = -FAR; x < GAME_WIDTH + FAR; x += 90) {
      if (x + 50 > ZEBRA.x0 - 10 && x < ZEBRA.x1 + 10) continue;
      g.fillRect(x, mid - 4, 50, 8);
    }
    g.fillStyle(COLORS.white);
    for (let y = STREET_TOP + 12; y < STREET_BOT - 16; y += 38) {
      g.fillRect(ZEBRA.x0, y, ZEBRA.x1 - ZEBRA.x0, 22);
    }
    g.fillStyle(0xaab3c0).fillRect(L, STREET_BOT, W, 12);
    g.fillStyle(0xd8dde6).fillRect(L, STREET_BOT + 12, W, GAME_HEIGHT - STREET_BOT + 400);
    g.lineStyle(2, 0xc2c9d4);
    for (let y = STREET_BOT + 60; y < GAME_HEIGHT + 60; y += 60) g.lineBetween(L, y, L + W, y);
    for (let x = -FAR; x < GAME_WIDTH + FAR; x += 90) {
      g.lineBetween(x, STREET_BOT + 12, x, GAME_HEIGHT + 100);
    }
    g.lineStyle(4, INK)
      .lineBetween(L, STREET_TOP, L + W, STREET_TOP)
      .lineBetween(L, STREET_BOT, L + W, STREET_BOT);
  }

  /** Semáforo peatonal: arriba la mano roja (alto), abajo el muñequito verde (camina). */
  private buildLight(): void {
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0x3b4250).fillRect(LIGHT.x - 6, LIGHT.y, 12, NEAR_FEET - LIGHT.y + 30);
    g.lineStyle(3, INK).strokeRect(LIGHT.x - 6, LIGHT.y, 12, NEAR_FEET - LIGHT.y + 30);
    g.fillStyle(0x2b2f3a).fillRoundedRect(LIGHT.x - 36, LIGHT.y - 120, 72, 128, 14);
    g.lineStyle(4, INK).strokeRoundedRect(LIGHT.x - 36, LIGHT.y - 120, 72, 128, 14);
    this.glow = this.add.circle(LIGHT.x, LIGHT.y - 85, 34, 0xff4d4d, 0.35).setDepth(6);
    this.lightG = this.add.graphics().setDepth(7);
    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: this.glow,
        scale: 1.25,
        alpha: 0.15,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }
    this.lightParts = [g, this.glow, this.lightG];
    this.drawLight();
  }

  private drawLight(): void {
    const g = this.lightG.clear();
    const red = this.light === 'red';
    const ty = LIGHT.y - 85;
    const by = LIGHT.y - 30;
    g.fillStyle(red ? 0xff4d4d : 0x5a2a2a).fillCircle(LIGHT.x, ty, 24);
    g.fillStyle(red ? 0x1f4a32 : 0x3ddc84).fillCircle(LIGHT.x, by, 24);
    g.fillStyle(red ? COLORS.white : 0x8a5555);
    g.fillRoundedRect(LIGHT.x - 9, ty - 6, 18, 18, 5);
    for (let k = 0; k < 4; k++) g.fillRoundedRect(LIGHT.x - 9 + k * 5, ty - 15, 4, 12, 2);
    const wc = red ? 0x5c8f6f : COLORS.white;
    g.fillStyle(wc).fillCircle(LIGHT.x, by - 12, 4.5);
    g.lineStyle(4, wc);
    g.lineBetween(LIGHT.x, by - 7, LIGHT.x, by + 5);
    g.lineBetween(LIGHT.x, by + 5, LIGHT.x - 7, by + 15);
    g.lineBetween(LIGHT.x, by + 5, LIGHT.x + 7, by + 15);
    g.lineBetween(LIGHT.x, by - 3, LIGHT.x - 8, by + 3);
    g.lineBetween(LIGHT.x, by - 3, LIGHT.x + 8, by - 6);
    this.glow.setPosition(LIGHT.x, red ? ty : by).setFillStyle(red ? 0xff4d4d : 0x3ddc84, 0.35);
  }

  private setLight(state: LightState): void {
    this.light = state;
    this.drawLight();
    AudioManager.sfx('pop', { pitch: state === 'green' ? 1.4 : 0.8 });
  }

  private showLight(on: boolean): void {
    for (const p of this.lightParts) p.setVisible(on);
  }

  /** Botones de "ojitos" para mirar a la izquierda y a la derecha (nivel 2). */
  private buildEyes(): void {
    (['left', 'right'] as const).forEach((side, i) => {
      const w = 250;
      const g = this.add.graphics();
      g.fillStyle(INK, 0.22).fillRoundedRect(-w / 2, -32, w, 70, 26);
      g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -36, w, 70, 26);
      g.lineStyle(4, INK).strokeRoundedRect(-w / 2, -36, w, 70, 26);
      const eye = this.add.graphics();
      for (const dx of [-10, 10]) {
        eye.fillStyle(COLORS.white).fillEllipse(dx, 0, 18, 22);
        eye.lineStyle(3, INK).strokeEllipse(dx, 0, 18, 22);
        eye.fillStyle(INK).fillCircle(dx + (side === 'left' ? -4 : 4), 2, 5);
      }
      eye.setPosition(-w / 2 + 40, -1);
      const text = side === 'left' ? 'Izquierda' : 'Derecha';
      const label = addTitle(this, 22, -1, text, 24, { color: '#2B2848' });
      const arrow = this.add.graphics();
      arrow.fillStyle(COLORS.turquoise);
      const ax = w / 2 - 34;
      const d = side === 'left' ? -1 : 1;
      arrow.fillTriangle(ax + d * 12, -1, ax - d * 6, -13, ax - d * 6, 11);
      arrow.lineStyle(2.5, INK).strokeTriangle(ax + d * 12, -1, ax - d * 6, -13, ax - d * 6, 11);
      const check = this.add.graphics().setVisible(false);
      check.fillStyle(0x3aa655).fillCircle(w / 2 - 6, -32, 16);
      check.lineStyle(3, INK).strokeCircle(w / 2 - 6, -32, 16);
      check.lineStyle(4.5, COLORS.white);
      check
        .beginPath()
        .moveTo(w / 2 - 13, -32)
        .lineTo(w / 2 - 8, -26)
        .lineTo(w / 2 + 2, -38);
      check.strokePath();
      const c = this.add
        .container(PANEL_X, 360 + i * 100, [g, eye, label, arrow, check])
        .setDepth(20);
      c.setSize(w, 74).setInteractive({ useHandCursor: true });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.lookSide(side));
      this.eyes.push({ side, c, check });
    });
  }

  private showEyes(on: boolean): void {
    this.eyes.forEach((e) => {
      e.c.setVisible(on);
      e.check.setVisible(false);
    });
  }

  // ------------------------------------------------------------------ flujo de niveles

  protected override onIntroDone(): void {
    this.enableIdleHint();
    void this.startLevel(0);
  }

  /** Letrero grande "Nivel N · título" que aparece y se va. */
  private async banner(n: number, title: string): Promise<void> {
    const w = 560;
    const g = this.add.graphics();
    g.fillStyle(INK, 0.25).fillRoundedRect(-w / 2 + 6, -70, w, 150, 34);
    g.fillStyle(COLORS.sun).fillRoundedRect(-w / 2, -78, w, 150, 34);
    g.lineStyle(6, INK).strokeRoundedRect(-w / 2, -78, w, 150, 34);
    const t1 = addTitle(this, 0, -38, `Nivel ${n}`, 30, { color: '#2B2848' });
    const t2 = addTitle(this, 0, 18, title, 44, { color: '#2B2848' });
    const b = this.add
      .container(640, 330, [g, t1, t2])
      .setDepth(DEPTH.ui + 2)
      .setScale(0);
    AudioManager.sfx('star', { index: n - 1 });
    this.tweens.add({ targets: b, scale: 1, duration: motion(420), ease: 'Back.easeOut' });
    await this.wait(1700);
    this.tweens.add({
      targets: b,
      scale: 0,
      alpha: 0,
      duration: motion(280),
      onComplete: () => b.destroy(),
    });
    await this.wait(300);
  }

  private async startLevel(n: number): Promise<void> {
    if (!this.alive) return;
    this.level = n;
    this.stage = 'banner';
    this.clearCars();
    this.traffic = false;
    this.showEyes(false);
    this.choices.forEach((c) => c.destroy());
    this.choices = [];
    this.ball?.destroy();
    this.ball = null;
    this.looked = { left: false, right: false };
    // Posiciones iniciales de cada nivel.
    const people = [this.adult, this.kid];
    people.forEach((p) => {
      p.setScale(NEAR_SCALE).setAlpha(1);
      this.pup(p)?.setMode('idle');
    });
    this.adult.setPosition(ADULT_X, NEAR_FEET);
    this.kid.setPosition(n === 1 ? ADULT_X + HAND_GAP : KID_START_X, NEAR_FEET);
    this.showLight(n !== 1);
    this.light = 'red';
    this.drawLight();
    // En el nivel 1 el botón aparece recién al tomar la mano; en el 3 no se usa.
    this.crossBtn.setVisible(n === 1);

    const titles = [this.activity.light.title, this.activity.look.title, this.activity.ball.title];
    await this.banner(n + 1, titles[n] ?? '');
    if (!this.alive) return;
    if (n === 0) {
      this.traffic = true;
      this.stage = 'hand';
      await this.instruct(this.activity.light.explain);
    } else if (n === 1) {
      this.showEyes(true);
      this.scheduleLookCars();
      this.stage = 'look';
      await this.instruct(this.activity.look.explain);
    } else {
      await this.ballLevel();
    }
  }

  private async levelDone(line: VoiceLine): Promise<void> {
    this.stage = 'busy';
    const people = [this.adult, this.kid];
    people.forEach((p) => this.pup(p)?.setMode('jump'));
    this.tweens.add({ targets: people, y: '-=24', duration: 220, yoyo: true, repeat: 1 });
    this.time.delayedCall(900, () => people.forEach((p) => this.pup(p)?.setMode('idle')));
    this.dots.mark(this.level);
    this.correct(640, 150, null);
    await this.say(line);
    if (!this.alive) return;
    if (this.level >= 2) {
      this.stage = 'done';
      await this.complete(this.activity.done);
      return;
    }
    await this.wait(400);
    this.tweens.add({ targets: people, alpha: 0, duration: motion(250) });
    await this.wait(300);
    void this.startLevel(this.level + 1);
  }

  // ------------------------------------------------------------------ nivel 1: semáforo

  /** El niño camina hasta mamá y le da la mano. */
  private takeHand(): void {
    if (this.stage !== 'hand') return;
    this.stage = 'busy';
    AudioManager.sfx('success');
    const kp = this.pup(this.kid);
    kp?.setMode('walk');
    this.face(this.kid, 'left');
    this.tweens.add({
      targets: this.kid,
      x: ADULT_X + HAND_GAP,
      duration: motion(1100),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        kp?.setMode('idle');
        this.face(this.kid, 'right');
        this.effects.sparkleAt(ADULT_X + HAND_GAP / 2, NEAR_FEET - 90, 10);
        void this.afterHand();
      },
    });
  }

  private async afterHand(): Promise<void> {
    await this.say(this.activity.light.holdDone);
    if (!this.alive) return;
    this.stage = 'wait';
    this.crossBtn.setVisible(true).setScale(0);
    this.tweens.add({
      targets: this.crossBtn,
      scale: 1,
      duration: motion(300),
      ease: 'Back.easeOut',
    });
    await this.instruct(this.activity.light.wait);
    if (!this.alive) return;
    // Recién después de la explicación empieza a contar el rojo.
    await this.wait(Phaser.Math.Between(2500, 3800));
    if (!this.alive || this.stage !== 'wait') return;
    this.setLight('green');
    await this.instruct(this.activity.light.green);
  }

  private cross(): void {
    if (this.stage === 'hand') {
      void this.say(this.activity.light.explain);
      return;
    }
    if (this.level === 0 && this.stage === 'wait') {
      if (this.light === 'red') this.stepBack(this.activity.light.tooSoon, 'rojo1');
      else this.walkAcross(() => void this.levelDone(this.activity.light.done));
      return;
    }
    if (this.level === 1 && this.stage === 'look') {
      const coming = this.carsComing('left') || this.carsComing('right');
      if (!this.looked.left || !this.looked.right || coming) {
        this.looked = { left: false, right: false };
        this.eyes.forEach((e) => e.check.setVisible(false));
        this.stepBack(this.activity.look.notYet, 'mira');
        return;
      }
      this.showEyes(false);
      this.walkAcross(() => void this.levelDone(this.activity.look.done));
    }
  }

  /** Cruzar antes de tiempo: un pasito, claxon y regresan a la banqueta. */
  private stepBack(line: VoiceLine, key: string): void {
    const prev = this.stage;
    this.stage = 'busy';
    AudioManager.toy('claxon');
    this.tweens.add({
      targets: [this.adult, this.kid],
      y: NEAR_FEET - 34,
      duration: motion(220),
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.stage = prev;
      },
    });
    this.mistakeOnce(key, line);
  }

  /** Cruzan juntos caminando hasta la banqueta de enfrente. */
  private walkAcross(then: () => void): void {
    this.stage = 'crossing';
    AudioManager.sfx('pop', { pitch: 1.3 });
    const people = [this.adult, this.kid];
    people.forEach((p) => {
      this.face(p, 'right');
      this.pup(p)?.setMode('walk');
    });
    this.tweens.add({
      targets: people,
      y: FAR_FEET,
      scale: FAR_SCALE,
      duration: motion(2600),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        people.forEach((p) => this.pup(p)?.setMode('idle'));
        then();
      },
    });
    this.tweens.add({ targets: this.adult, x: ADULT_X + 18, duration: motion(2600) });
    this.tweens.add({
      targets: this.kid,
      x: ADULT_X + 18 + HAND_GAP * 0.7,
      duration: motion(2600),
    });
  }

  // ------------------------------------------------------------------ nivel 2: mira a los lados

  /** Pasan algunos carros al principio (de un lado o del otro) y luego la calle queda libre. */
  private scheduleLookCars(): void {
    [2500, 5200, 8200].forEach((at) =>
      this.time.delayedCall(at, () => {
        if (this.level === 1) this.spawnCar(Phaser.Math.Between(0, 1), 170);
      }),
    );
  }

  /** ¿Viene un carro por ese lado (todavía no pasa la cebra)? */
  private carsComing(side: Side): boolean {
    return this.cars.some((c) =>
      side === 'left' ? c.lane === 0 && c.img.x < ZEBRA.x1 : c.lane === 1 && c.img.x > ZEBRA.x0,
    );
  }

  private lookSide(side: Side): void {
    if (this.stage !== 'look') return;
    AudioManager.sfx('pop', { pitch: 1.2 });
    this.face(this.kid, side);
    this.face(this.adult, side);
    // "Mirada": una franja de luz sobre ese lado de la calle.
    const x0 = side === 'left' ? -FAR : ZEBRA.x1;
    const w = side === 'left' ? ZEBRA.x0 + FAR : FAR + GAME_WIDTH - ZEBRA.x1;
    const beam = this.add
      .rectangle(x0, STREET_TOP, w, STREET_BOT - STREET_TOP, COLORS.white, 0.22)
      .setOrigin(0)
      .setDepth(2);
    this.tweens.add({
      targets: beam,
      alpha: 0,
      delay: 700,
      duration: motion(400),
      onComplete: () => beam.destroy(),
    });
    const eye = this.eyes.find((e) => e.side === side);
    if (this.carsComing(side)) {
      this.looked[side] = false;
      eye?.check.setVisible(false);
      void this.say(this.activity.look.car);
      return;
    }
    this.looked[side] = true;
    eye?.check.setVisible(true);
    if (eye) this.tweens.add({ targets: eye.c, scale: 1.08, duration: 120, yoyo: true });
    if (this.looked.left && this.looked.right) void this.instruct(this.activity.look.ready);
    else void this.say(this.activity.look.clear);
  }

  // ------------------------------------------------------------------ nivel 3: la pelota

  private async ballLevel(): Promise<void> {
    this.stage = 'busy';
    // El niño juega con su pelota (rebota a sus pies).
    const ball = this.add.image(this.kid.x + 46, NEAR_FEET - 18, tex('pelota')).setDepth(9);
    ball.setScale(34 / ball.width);
    this.ball = ball;
    this.tweens.add({
      targets: ball,
      y: NEAR_FEET - 70,
      duration: 320,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeOut',
    });
    this.traffic = true;
    await this.say(this.activity.ball.explain);
    if (!this.alive) return;
    // ¡La pelota se escapa a la calle! Rueda hasta la banqueta de enfrente.
    this.tweens.killTweensOf(ball);
    AudioManager.toy('pelota');
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: ball,
        x: 400,
        y: FAR_FEET - 14,
        angle: -720,
        scale: 30 / ball.width,
        duration: motion(1400),
        ease: 'Sine.easeOut',
        onComplete: () => resolve(),
      });
    });
    if (!this.alive) return;
    this.showChoices();
    this.stage = 'choose';
    await this.instruct(this.activity.ball.rolled);
  }

  /** Dos tarjetas: correr por la pelota (peligro) o pedir ayuda a mamá (seguro). */
  private showChoices(): void {
    const b = this.activity.ball;
    const opts = [
      { label: b.runLabel, art: 'pelota' as const, good: false },
      { label: b.askLabel, art: 'mama' as const, good: true },
    ];
    opts.forEach((o, i) => {
      const w = 250;
      const h = 120;
      const g = this.add.graphics();
      g.fillStyle(INK, 0.22).fillRoundedRect(-w / 2 + 3, -h / 2 + 7, w, h, 20);
      g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
      g.lineStyle(4, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
      const img = this.add.image(-w / 2 + 50, 0, tex(o.art));
      img.setScale(Math.min(70 / img.width, 90 / img.height));
      const t = addBody(this, 30, 0, o.label, 20, { color: '#2B2848', wrap: 150 });
      const c = this.add
        .container(PANEL_X, 330 + i * 145, [g, img, t])
        .setDepth(20)
        .setScale(0);
      c.setSize(w, h).setInteractive({ useHandCursor: true });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.choose(o.good, c));
      this.tweens.add({
        targets: c,
        scale: 1,
        delay: i * 120,
        duration: motion(300),
        ease: 'Back.easeOut',
      });
      this.choices.push(c);
    });
  }

  private choose(good: boolean, card: Phaser.GameObjects.Container): void {
    if (this.stage !== 'choose') return;
    if (!good) {
      // El niño corre hacia la calle, ¡claxon!, y se detiene.
      this.stage = 'busy';
      AudioManager.toy('claxon');
      this.tweens.add({
        targets: card,
        angle: { from: -6, to: 6 },
        duration: 70,
        yoyo: true,
        repeat: 3,
        onComplete: () => card.setAngle(0),
      });
      const kp = this.pup(this.kid);
      kp?.setMode('run');
      this.tweens.add({
        targets: this.kid,
        y: NEAR_FEET - 40,
        duration: motion(260),
        yoyo: true,
        onComplete: () => {
          kp?.setMode('idle');
          this.stage = 'choose';
        },
      });
      this.mistakeOnce('pelota', this.activity.ball.wrong);
      return;
    }
    this.stage = 'busy';
    AudioManager.sfx('success');
    this.choices.forEach((c) =>
      this.tweens.add({
        targets: c,
        scale: 0,
        duration: motion(200),
        onComplete: () => c.destroy(),
      }),
    );
    this.choices = [];
    void this.helpWithBall();
  }

  /** Mamá ayuda: van de la mano, esperan el verde, cruzan y recuperan la pelota. */
  private async helpWithBall(): Promise<void> {
    const kp = this.pup(this.kid);
    kp?.setMode('walk');
    this.face(this.kid, 'left');
    this.tweens.add({
      targets: this.kid,
      x: ADULT_X + HAND_GAP,
      duration: motion(1100),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        kp?.setMode('idle');
        this.face(this.kid, 'right');
      },
    });
    await this.say(this.activity.ball.right);
    if (!this.alive) return;
    await this.wait(1200);
    this.setLight('green');
    await this.wait(900);
    if (!this.alive) return;
    this.walkAcross(() => {
      // La pelota vuelve a las manos del niño.
      const ball = this.ball;
      if (ball) {
        this.tweens.add({
          targets: ball,
          x: this.kid.x + 20,
          y: this.kid.y - 40,
          duration: motion(500),
          ease: 'Back.easeOut',
        });
      }
      AudioManager.toy('pelota');
      void this.levelDone(this.activity.ball.done);
    });
  }

  // ------------------------------------------------------------------ carros

  private spawnCar(lane: number, speed: number): void {
    const L = LANES[lane];
    if (!L) return;
    const m = viewportMargin(this.game).x;
    const x = L.dir > 0 ? -m - CAR_W : GAME_WIDTH + m + CAR_W;
    const img = this.add.image(x, L.y, tex('carrito')).setDepth(3);
    img.setScale(CAR_W / img.width).setFlipX(L.dir < 0);
    this.cars.push({ img, lane, speed });
  }

  private clearCars(): void {
    this.cars.forEach((c) => c.img.destroy());
    this.cars = [];
  }

  override update(time: number, delta: number): void {
    if (!this.lightG) return;
    const dt = Math.min(delta, 50) / 1000;
    const m = viewportMargin(this.game).x;
    const left = -m - CAR_W;
    const right = GAME_WIDTH + m + CAR_W;
    // Con el semáforo en rojo (para peatones) pasan carros por los dos carriles.
    if (this.traffic && this.light === 'red' && this.stage !== 'done') {
      LANES.forEach((_lane, i) => {
        if (time < (this.nextCar[i] ?? 0)) return;
        this.nextCar[i] = time + Phaser.Math.Between(1500, 2600);
        this.spawnCar(i, 210 + Math.random() * 60);
      });
    }
    const lightOn = this.level !== 1;
    for (const c of this.cars) {
      const lane = LANES[c.lane];
      if (!lane) continue;
      let nx = c.img.x + lane.dir * c.speed * dt;
      // En verde se detienen antes de la cebra, en fila.
      if (lightOn && this.light === 'green') {
        const stopX = lane.dir > 0 ? ZEBRA.x0 - CAR_W / 2 - 14 : ZEBRA.x1 + CAR_W / 2 + 14;
        const before = lane.dir > 0 ? c.img.x <= stopX + 2 : c.img.x >= stopX - 2;
        if (before) {
          const ahead = this.cars
            .filter((o) => o !== c && o.lane === c.lane)
            .filter((o) => (lane.dir > 0 ? o.img.x > c.img.x : o.img.x < c.img.x))
            .sort((a, b) => Math.abs(a.img.x - c.img.x) - Math.abs(b.img.x - c.img.x))[0];
          let limit = stopX;
          if (ahead) {
            const aheadBefore = lane.dir > 0 ? ahead.img.x <= stopX + 2 : ahead.img.x >= stopX - 2;
            if (aheadBefore) limit = ahead.img.x - lane.dir * (CAR_W + 20);
          }
          nx = lane.dir > 0 ? Math.min(nx, limit) : Math.max(nx, limit);
        }
      }
      c.img.x = nx;
      if (!prefersReducedMotion()) c.img.y = lane.y + Math.sin(time / 90 + c.img.x / 40) * 1.2;
    }
    this.cars = this.cars.filter((c) => {
      const out = c.img.x < left - 40 || c.img.x > right + 40;
      if (out) c.img.destroy();
      return !out;
    });
  }

  protected override getHint(): HintTarget | null {
    if (this.stage === 'hand') return { kind: 'tap', x: this.adult.x, y: this.adult.y - 80 };
    if (this.stage === 'wait' && this.light === 'green') {
      return { kind: 'tap', x: this.crossBtn.x, y: this.crossBtn.y };
    }
    if (this.stage === 'look') {
      if (this.looked.left && this.looked.right) {
        return { kind: 'tap', x: this.crossBtn.x, y: this.crossBtn.y };
      }
      const e = this.eyes.find((k) => !this.looked[k.side]);
      return e ? { kind: 'tap', x: e.c.x, y: e.c.y } : null;
    }
    if (this.stage === 'choose') {
      const c = this.choices[1];
      return c ? { kind: 'tap', x: c.x, y: c.y } : null;
    }
    return null;
  }
}
