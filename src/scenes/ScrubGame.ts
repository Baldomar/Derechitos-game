import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { COLORS, DEPTH } from '@/config/theme';
import type { ScrubActivity } from '@/config/rights';
import type { HintTarget } from '@/components/HelperHand';
import { fit, RoundDots } from '@/components/Kit';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const CX = 600;
const CY = 330;
const TOOL_HOME = { x: 1060, y: 380 };
/** Cuánto hay que frotar (px recorridos encima) para quitar una mancha. */
const RUB = 70;
const REACH = 62;

interface Spot {
  obj: Phaser.GameObjects.Container;
  rub: number;
  gone: boolean;
}

/**
 * Motor "limpia": la cosa aparece sucia (lodo) o llena de microbios que se mueven.
 * El niño arrastra la esponja y frota encima: salen burbujas de jabón y cada mancha
 * se va poquito a poco. Cuando no queda nada, la cosa brilla y pasa a la siguiente.
 * No hay forma de equivocarse: es un juego de coordinación, ideal para el movimiento del mouse.
 */
export default class ScrubGameScene extends BaseActivity<ScrubActivity> {
  protected readonly kind = 'scrub' as const;
  private round = 0;
  private spots: Spot[] = [];
  private tool!: Phaser.GameObjects.Image;
  private thing: Phaser.GameObjects.Container | null = null;
  private dots!: RoundDots;
  private playing = false;
  private last: { x: number; y: number } | null = null;
  private squeak = 0;

  constructor() {
    super('ScrubGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.round = 0;
    this.spots = [];
    this.thing = null;
    this.playing = false;
    this.last = null;
    this.squeak = 0;
  }

  protected override buildLevel(): void {
    this.dots = new RoundDots(this, this.activity.rounds.length, 1240, 64);
    // Mesa de trabajo: un tapete redondo con borde.
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.15).fillEllipse(CX, CY + 18, 520, 420);
    g.fillStyle(0xe8f7ff).fillEllipse(CX, CY, 520, 420);
    g.lineStyle(6, COLORS.white).strokeEllipse(CX, CY, 500, 400);
    g.lineStyle(4, COLORS.ink, 0.6).strokeEllipse(CX, CY, 520, 420);

    // Cubeta con agua y espuma donde descansa la esponja.
    const b = this.add.graphics();
    b.fillStyle(COLORS.ink, 0.15).fillEllipse(TOOL_HOME.x, TOOL_HOME.y + 118, 170, 22);
    b.fillStyle(COLORS.sea).fillPoints(
      [
        { x: TOOL_HOME.x - 80, y: TOOL_HOME.y + 40 },
        { x: TOOL_HOME.x + 80, y: TOOL_HOME.y + 40 },
        { x: TOOL_HOME.x + 64, y: TOOL_HOME.y + 116 },
        { x: TOOL_HOME.x - 64, y: TOOL_HOME.y + 116 },
      ],
      true,
    );
    b.lineStyle(5, COLORS.ink).strokePoints(
      [
        { x: TOOL_HOME.x - 80, y: TOOL_HOME.y + 40 },
        { x: TOOL_HOME.x + 80, y: TOOL_HOME.y + 40 },
        { x: TOOL_HOME.x + 64, y: TOOL_HOME.y + 116 },
        { x: TOOL_HOME.x - 64, y: TOOL_HOME.y + 116 },
      ],
      true,
    );
    b.fillStyle(COLORS.white);
    for (let i = 0; i < 7; i++) b.fillCircle(TOOL_HOME.x - 66 + i * 22, TOOL_HOME.y + 40, 12);
    addBody(this, TOOL_HOME.x, TOOL_HOME.y + 150, '¡Arrástrala!', 20, {
      stroke: '#FFFFFF',
      strokeThickness: 6,
    });

    this.tool = fit(this.add.image(TOOL_HOME.x, TOOL_HOME.y, tex(this.activity.tool)), 130, 110, 2);
    this.tool.setDepth(DEPTH.ui - 1).setInteractive({ draggable: true, useHandCursor: true });
    this.tweens.add({
      targets: this.tool,
      angle: { from: -6, to: 6 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tool.on(Phaser.Input.Events.GAMEOBJECT_DRAG_START, () => {
      AudioManager.sfx('pop', { pitch: 1.3 });
      this.tweens.killTweensOf(this.tool);
      this.tool.setAngle(0);
      this.last = null;
    });
    this.tool.on(
      Phaser.Input.Events.GAMEOBJECT_DRAG,
      (_p: Phaser.Input.Pointer, x: number, y: number) => {
        this.tool.setPosition(x, y);
        this.rubAt(x, y);
      },
    );
    this.tool.on(Phaser.Input.Events.GAMEOBJECT_DRAG_END, () => {
      this.last = null;
      this.tweens.add({
        targets: this.tool,
        x: TOOL_HOME.x,
        y: TOOL_HOME.y,
        angle: 0,
        duration: motion(400),
        ease: 'Back.easeOut',
      });
    });

    // La primera cosa sucia ya se ve mientras Tori explica (se limpia al terminar la intro).
    this.showRound();
    this.playing = false;
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.playing = true;
  }

  private showRound(): void {
    const r = this.activity.rounds[this.round];
    if (!r) return;
    this.spots = [];
    const img = fit(this.add.image(0, 0, tex(r.art)), 300, 280, 3);
    const label = addBody(this, 0, 175, r.label, 26, { stroke: '#FFFFFF', strokeThickness: 7 });
    this.thing = this.add.container(CX, CY, [img, label]).setDepth(2);
    this.thing.setScale(0);
    this.tweens.add({ targets: this.thing, scale: 1, duration: motion(420), ease: 'Back.easeOut' });

    // Manchas repartidas sobre el dibujo (sin encimarse mucho).
    const w = img.displayWidth * 0.42;
    const h = img.displayHeight * 0.42;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = i === 0 ? 0 : 0.45 + Math.random() * 0.5;
      const x = CX + Math.cos(a) * w * d;
      const y = CY + Math.sin(a) * h * d;
      const obj = this.activity.dirt === 'germs' ? this.germ(x, y, i) : this.mud(x, y);
      obj.setDepth(3).setScale(0);
      this.tweens.add({
        targets: obj,
        scale: 1,
        delay: 200 + i * 70,
        duration: motion(260),
        ease: 'Back.easeOut',
      });
      this.spots.push({ obj, rub: 0, gone: false });
    }
    this.playing = true;
  }

  /** Microbio verde con ojitos que se mueve (da ganas de quitarlo). */
  private germ(x: number, y: number, i: number): Phaser.GameObjects.Container {
    const colors = [0x8bd450, 0x6cc4a1, 0xb388eb, 0x9ad04a];
    const c = colors[i % colors.length] ?? 0x8bd450;
    const g = this.add.graphics();
    g.fillStyle(c);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.fillCircle(Math.cos(a) * 22, Math.sin(a) * 22, 8);
    }
    g.fillCircle(0, 0, 24);
    g.lineStyle(3, COLORS.ink).strokeCircle(0, 0, 24);
    g.fillStyle(COLORS.white).fillCircle(-8, -4, 7).fillCircle(8, -4, 7);
    g.fillStyle(COLORS.ink).fillCircle(-7, -3, 3.5).fillCircle(9, -3, 3.5);
    g.lineStyle(3, COLORS.ink).beginPath();
    g.arc(0, 6, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    g.strokePath();
    const obj = this.add.container(x, y, [g]);
    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: g,
        x: { from: -5, to: 5 },
        angle: { from: -12, to: 12 },
        duration: 500 + Math.random() * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return obj;
  }

  /** Mancha de lodo café con gotitas. */
  private mud(x: number, y: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x8a5a32, 0.92);
    g.fillCircle(0, 0, 24).fillCircle(16, -8, 14).fillCircle(-16, 8, 15).fillCircle(8, 14, 12);
    g.fillCircle(30, 12, 5).fillCircle(-28, -12, 6);
    g.fillStyle(0xa8743f, 0.9).fillCircle(-6, -6, 9);
    return this.add.container(x, y, [g]);
  }

  private rubAt(x: number, y: number): void {
    if (!this.playing) return;
    const prev = this.last;
    this.last = { x, y };
    if (!prev) return;
    const moved = Phaser.Math.Distance.Between(prev.x, prev.y, x, y);
    if (moved < 1) return;
    let touching = false;
    for (const s of this.spots) {
      if (s.gone) continue;
      if (Phaser.Math.Distance.Between(s.obj.x, s.obj.y, x, y) > REACH) continue;
      touching = true;
      s.rub += moved;
      const left = 1 - s.rub / RUB;
      s.obj.setAlpha(0.25 + 0.75 * Math.max(0, left));
      s.obj.setScale(0.6 + 0.4 * Math.max(0, left));
      if (s.rub >= RUB) this.clean(s);
    }
    if (touching) {
      this.foam(x, y);
      this.squeak += moved;
      if (this.squeak > 160) {
        this.squeak = 0;
        AudioManager.sfx('pop', { pitch: 1.6 + Math.random() * 0.3 });
      }
    }
  }

  /** Burbujitas de jabón que salen de la esponja. */
  private foam(x: number, y: number): void {
    if (Math.random() > 0.35) return;
    const b = this.add
      .circle(
        x + Phaser.Math.Between(-30, 30),
        y + Phaser.Math.Between(-20, 20),
        Phaser.Math.Between(5, 11),
        COLORS.white,
        0.9,
      )
      .setStrokeStyle(2, 0x9fd9ff)
      .setDepth(4);
    this.tweens.add({
      targets: b,
      y: b.y - Phaser.Math.Between(30, 70),
      alpha: 0,
      scale: 1.4,
      duration: motion(700),
      onComplete: () => b.destroy(),
    });
  }

  private clean(s: Spot): void {
    s.gone = true;
    this.tweens.killTweensOf(s.obj);
    AudioManager.sfx('pop', { pitch: 1 + Math.random() * 0.3 });
    this.effects.sparkleAt(s.obj.x, s.obj.y, 6);
    this.tweens.add({
      targets: s.obj,
      scale: 0,
      alpha: 0,
      angle: 180,
      duration: motion(260),
      onComplete: () => s.obj.destroy(),
    });
    if (this.spots.every((k) => k.gone)) void this.roundDone();
  }

  private async roundDone(): Promise<void> {
    this.playing = false;
    const r = this.activity.rounds[this.round];
    const thing = this.thing;
    if (!r || !thing) return;
    this.dots.mark(this.round);
    // ¡Brilla! Destellos en estrella y un saltito.
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 120, () =>
        this.effects.sparkleAt(
          CX + Phaser.Math.Between(-120, 120),
          CY + Phaser.Math.Between(-110, 110),
          8,
        ),
      );
    }
    this.tweens.add({
      targets: thing,
      scale: 1.12,
      duration: motion(180),
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    const last = this.round === this.activity.rounds.length - 1;
    this.correct(CX, CY - 160, null);
    await this.say(r.line);
    if (!this.alive) return;
    if (last) {
      await this.complete(this.activity.done);
      return;
    }
    this.tweens.add({
      targets: thing,
      x: -300,
      angle: -20,
      duration: motion(450),
      ease: 'Back.easeIn',
      onComplete: () => thing.destroy(),
    });
    await this.wait(450);
    this.round += 1;
    this.showRound();
  }

  protected override getHint(): HintTarget | null {
    if (!this.playing) return null;
    const s = this.spots.find((k) => !k.gone);
    if (!s) return null;
    return {
      kind: 'drag',
      from: { x: TOOL_HOME.x, y: TOOL_HOME.y },
      to: { x: s.obj.x, y: s.obj.y },
    };
  }
}
