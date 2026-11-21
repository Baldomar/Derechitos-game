import Phaser from 'phaser';
import { artSize, ensureArtHD, tex } from '@/art/Art';
import { COLORS } from '@/config/theme';
import type { DotsActivity } from '@/config/rights';
import type { HintTarget } from '@/components/HelperHand';
import { fit, RoundDots } from '@/components/Kit';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';
import { dotsFindLine } from '@/config/voiceCatalog';

const BOX = { x: 420, y: 112, w: 440, h: 400 };
const FILLS = [COLORS.sun, COLORS.turquoise, COLORS.pink, COLORS.grass, COLORS.orange];

interface Dot {
  /** Punto exacto del contorno (pequeño, como en los cuadernos de unir puntos). */
  c: Phaser.GameObjects.Container;
  /** Globito con el número, un poco afuera de la figura. */
  badge: Phaser.GameObjects.Container;
  x: number;
  y: number;
  done: boolean;
}

/** Cómo se coloca el dibujo de la ronda dentro de la hoja. */
interface Fit {
  x: number;
  y: number;
  scale: number;
}

/**
 * Motor "une los puntos": en una hoja hay números. Al tocarlos en orden (1, 2, 3…) se
 * dibuja una línea; al cerrar la figura se pinta y aparece el dibujo. Practica contar y
 * da la sorpresa de descubrir qué era.
 */
export default class DotsGameScene extends BaseActivity<DotsActivity> {
  protected readonly kind = 'dots' as const;
  private round = 0;
  private next = 0;
  private dots: Dot[] = [];
  private lines!: Phaser.GameObjects.Graphics;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private progress!: RoundDots;
  private busy = false;
  private fitArt: Fit = { x: 0, y: 0, scale: 1 };
  private pencil: Phaser.GameObjects.Image | undefined;

  constructor() {
    super('DotsGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.round = 0;
    this.next = 0;
    this.dots = [];
    this.layer = [];
    this.busy = false;
    this.pencil = undefined;
  }

  protected override buildLevel(): void {
    this.progress = new RoundDots(this, this.activity.rounds.length, 1240, 64);
    // Hoja de cuaderno con renglones y espiral.
    const g = this.add.graphics();
    const px = BOX.x - 50;
    const py = BOX.y - 20;
    const pw = BOX.w + 100;
    const ph = BOX.h + 50;
    g.fillStyle(COLORS.ink, 0.18).fillRoundedRect(px, py + 10, pw, ph, 18);
    g.fillStyle(COLORS.white).fillRoundedRect(px, py, pw, ph, 18);
    g.lineStyle(2, 0xbfe3ff);
    for (let y = py + 40; y < py + ph - 10; y += 34) g.lineBetween(px + 20, y, px + pw - 20, y);
    g.lineStyle(2, COLORS.coral, 0.6).lineBetween(px + 54, py + 10, px + 54, py + ph - 10);
    g.lineStyle(5, COLORS.ink).strokeRoundedRect(px, py, pw, ph, 18);
    for (let y = py + 30; y < py + ph - 20; y += 44) {
      g.fillStyle(COLORS.ink).fillCircle(px, y, 8);
      g.fillStyle(0xd0d6e0).fillCircle(px, y, 5);
    }
    // Lápiz decorativo a un lado.
    const pencil = fit(this.add.image(1040, 300, tex(this.activity.icon)), 170, 170, 2);
    this.tweens.add({
      targets: pencil,
      angle: { from: -6, to: 6 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
    });
    addBody(this, 1040, 410, '¡Toca los números\nen orden!', 22, {
      stroke: '#FFFFFF',
      strokeThickness: 6,
    });
    // Los números ya se ven mientras Tori explica; se pueden tocar al terminar la intro.
    void this.showRound();
    this.busy = true;
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.busy = false;
  }

  private async showRound(): Promise<void> {
    const r = this.activity.rounds[this.round];
    if (!r) return;
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
    this.dots = [];
    this.next = 0;
    this.busy = false;
    this.lines = this.add.graphics().setDepth(2);
    this.layer.push(this.lines);

    // Los puntos están sobre la silueta REAL del dibujo: se calcula dónde quedará el
    // dibujo dentro de la hoja y se usa la misma escala para los puntos.
    const xs = r.points.map((p) => p[0]);
    const ys = r.points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 70; // espacio para los globitos de número
    const scale = Math.min((BOX.w - pad) / (maxX - minX), (BOX.h - pad) / (maxY - minY), 4.2);
    const cx = BOX.x + BOX.w / 2;
    const cy = BOX.y + BOX.h / 2 - 6;
    this.fitArt = {
      x: cx - ((minX + maxX) / 2) * scale,
      y: cy - ((minY + maxY) / 2) * scale,
      scale,
    };
    const pts = r.points.map(([px, py]) => ({
      x: this.fitArt.x + px * scale,
      y: this.fitArt.y + py * scale,
    }));
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;

    pts.forEach(({ x, y }, i) => {
      const dot = this.add.circle(0, 0, 9, COLORS.ink);
      const c = this.add.container(x, y, [dot]).setSize(64, 64).setDepth(4);
      // El número va afuera de la figura, en dirección contraria al centro.
      const ang = Math.atan2(y - my, x - mx);
      const bx = x + Math.cos(ang) * 36;
      const by = y + Math.sin(ang) * 36;
      const ring = this.add.circle(0, 0, 22, COLORS.white).setStrokeStyle(4, COLORS.ink);
      const num = addTitle(this, 0, 2, String(i + 1), 24);
      const badge = this.add.container(bx, by, [ring, num]).setSize(60, 60).setDepth(4);
      for (const o of [c, badge]) {
        o.setInteractive({ useHandCursor: true });
        o.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tapDot(i));
        o.setScale(0);
        this.tweens.add({
          targets: o,
          scale: 1,
          delay: i * 70,
          duration: motion(260),
          ease: 'Back.easeOut',
        });
        this.layer.push(o);
      }
      this.dots.push({ c, badge, x, y, done: false });
    });

    // Lápiz que va trazando las líneas (con la punta en el punto donde dibuja).
    const lk = ensureArtHD(this, 'lapiz', 2);
    this.pencil = this.add
      .image(0, 0, lk)
      .setOrigin(124 / 130, 65 / 130)
      .setAngle(135)
      .setScale(0.75)
      .setDepth(7)
      .setVisible(false);
    this.layer.push(this.pencil);
    // El brillo del siguiente número empieza cuando ya terminaron de aparecer todos
    // (si empezara antes, el número 1 se quedaba chiquito).
    const round = this.round;
    this.time.delayedCall(pts.length * 70 + motion(280), () => {
      if (this.alive && this.round === round && this.next === 0) this.glowNext();
    });
  }

  private glowNext(): void {
    const d = this.dots[this.next];
    if (!d) return;
    const ring = d.badge.list[0] as Phaser.GameObjects.Arc;
    ring.setFillStyle(0xfff3b0);
    this.tweens.killTweensOf([d.c, d.badge]);
    this.tweens.add({
      targets: [d.c, d.badge],
      scale: { from: 1, to: 1.18 },
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private tapDot(i: number): void {
    if (this.busy) return;
    const d = this.dots[i];
    if (!d || d.done) return;
    if (i !== this.next) {
      const n = this.next + 1;
      const line = dotsFindLine(n);
      this.mistakeOnce(`${this.round}/${i}`, line);
      this.tweens.add({
        targets: d.badge,
        angle: { from: -12, to: 12 },
        duration: motion(70),
        yoyo: true,
        repeat: 2,
        onComplete: () => d.badge.setAngle(0),
      });
      return;
    }
    d.done = true;
    this.tweens.killTweensOf([d.c, d.badge]);
    d.c.setScale(1);
    d.badge.setScale(1);
    (d.badge.list[0] as Phaser.GameObjects.Arc).setFillStyle(COLORS.grass);
    AudioManager.sfx('pop', { pitch: 1 + i * 0.08 });
    this.effects.sparkleAt(d.x, d.y, 5);
    const prev = this.dots[i - 1];
    if (prev) void this.drawLine(prev, d);
    else this.pencil?.setVisible(true).setPosition(d.x, d.y);
    this.next += 1;
    if (this.next >= this.dots.length) {
      // El último punto cierra la figura de vuelta al 1.
      this.busy = true;
      const first = this.dots[0];
      void (async () => {
        if (prev)
          await this.wait(
            motion(Math.min(520, 160 + Math.hypot(d.x - prev.x, d.y - prev.y) * 1.1)) + 40,
          );
        if (!this.alive) return;
        if (first) await this.drawLine(d, first);
        await this.reveal();
      })();
    } else {
      this.glowNext();
    }
  }

  /** Línea de lápiz que "se dibuja" de un punto a otro, con el lápiz moviéndose en la punta. */
  private drawLine(a: Dot, b: Dot): Promise<void> {
    const seg = this.add.graphics().setDepth(3);
    this.layer.push(seg);
    const p = { t: 0 };
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const pencil = this.pencil;
    pencil?.setVisible(true).setPosition(a.x, a.y);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: p,
        t: 1,
        duration: motion(Math.min(520, 160 + len * 1.1)),
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const x = a.x + (b.x - a.x) * p.t;
          const y = a.y + (b.y - a.y) * p.t;
          seg
            .clear()
            .lineStyle(7, COLORS.ink)
            .lineBetween(a.x, a.y, x, y)
            .fillStyle(COLORS.ink)
            .fillCircle(a.x, a.y, 3.5)
            .fillCircle(x, y, 3.5);
          // Pequeño temblor del lápiz, como una mano que dibuja.
          pencil?.setPosition(x, y).setAngle(135 + Math.sin(p.t * 18) * 3);
        },
        onComplete: () => resolve(),
      });
    });
  }

  private async reveal(): Promise<void> {
    this.busy = true;
    const r = this.activity.rounds[this.round];
    if (!r) return;
    // El lápiz se va.
    if (this.pencil) {
      this.tweens.add({
        targets: this.pencil,
        x: this.pencil.x + 160,
        y: this.pencil.y - 120,
        alpha: 0,
        duration: motion(400),
      });
    }
    // Los números se esconden: queda solo el dibujo hecho con líneas.
    this.dots.forEach((d) =>
      this.tweens.add({ targets: [d.c, d.badge], alpha: 0, scale: 0.6, duration: motion(300) }),
    );
    await this.wait(250);
    // Primero se rellena con color, como si lo pintara con crayón…
    const color = FILLS[this.round % FILLS.length] ?? COLORS.sun;
    const shape = this.add.graphics().setDepth(1).setAlpha(0);
    shape.fillStyle(color, 0.45).fillPoints(
      this.dots.map((d) => ({ x: d.x, y: d.y })),
      true,
    );
    this.layer.push(shape);
    this.tweens.add({ targets: shape, alpha: 1, duration: motion(350) });
    await this.wait(400);
    if (!this.alive) return;

    // …y luego el dibujo de verdad aparece EXACTO sobre las líneas, coloreándose desde
    // el centro hacia afuera.
    const { x, y, scale } = this.fitArt;
    const k = Math.min(4, Math.ceil(scale));
    const img = this.add
      .image(x, y, ensureArtHD(this, r.art, k))
      .setOrigin(0)
      .setScale(scale / k)
      .setDepth(5);
    this.layer.push(img);
    const { w: aw, h: ah } = artSize(r.art);
    const ccx = x + (aw * scale) / 2;
    const ccy = y + (ah * scale) / 2;
    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    img.setMask(maskG.createGeometryMask());
    const grow = { r: 0 };
    const full = Math.hypot(aw * scale, ah * scale) / 2 + 10;
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: grow,
        r: full,
        duration: motion(750),
        ease: 'Sine.easeOut',
        onUpdate: () => maskG.clear().fillStyle(0xffffff).fillCircle(ccx, ccy, grow.r),
        onComplete: () => resolve(),
      });
    });
    img.clearMask(true);
    maskG.destroy();
    // Las líneas de lápiz y el relleno ceden su lugar al dibujo terminado.
    const strokes = this.layer.filter(
      (o): o is Phaser.GameObjects.Graphics => o instanceof Phaser.GameObjects.Graphics,
    );
    this.tweens.add({ targets: strokes, alpha: 0, duration: motion(300) });
    // ¡Cobra vida! Un saltito alegre y destellos alrededor.
    const s0 = img.scale;
    img.setOrigin(0.5).setPosition(ccx, ccy);
    this.tweens.add({
      targets: img,
      scale: s0 * 1.08,
      angle: { from: -3, to: 3 },
      duration: motion(220),
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => img.setAngle(0).setScale(s0),
    });
    this.effects.sparkleAt(ccx - (aw * scale) / 3, ccy - (ah * scale) / 3, 6);
    this.effects.sparkleAt(ccx + (aw * scale) / 3, ccy + (ah * scale) / 4, 6);
    const label = addTitle(this, BOX.x + BOX.w / 2, BOX.y + BOX.h + 2, r.label, 34, {
      stroke: '#FFFFFF',
      strokeThickness: 8,
    }).setDepth(6);
    this.layer.push(label);
    this.progress.mark(this.round);
    const last = this.round === this.activity.rounds.length - 1;
    this.correct(BOX.x + BOX.w / 2, BOX.y + 40, null);
    await this.say(r.line);
    if (!this.alive) return;
    if (last) {
      await this.complete(this.activity.done);
      return;
    }
    await this.wait(400);
    this.round += 1;
    void this.showRound();
  }

  protected override getHint(): HintTarget | null {
    if (this.busy) return null;
    const d = this.dots[this.next];
    return d ? { kind: 'tap', x: d.x, y: d.y } : null;
  }
}
