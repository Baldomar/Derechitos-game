import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { COLORS } from '@/config/theme';
import type { SimonActivity } from '@/config/rights';
import type { HintTarget } from '@/components/HelperHand';
import { fit, RoundDots } from '@/components/Kit';
import { addBody } from '@/components/Text';
import { AudioManager, type ToySound } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const PAD_COLORS = [COLORS.coral, COLORS.turquoise, COLORS.sun, COLORS.grape];
const PITCH = [0.8, 1, 1.25, 1.5];
/** Cada juguete suena como él mismo (la pelota rebota, el trompo zumba…). */
const TOY_SOUND: Record<string, ToySound> = {
  pelota: 'pelota',
  trompo: 'trompo',
  papalote: 'papalote',
  carrito: 'carrito',
  balon: 'balon',
  'bloque-rojo': 'bloques',
  'bloque-azul': 'bloques',
  'bloque-verde': 'bloques',
  'bloque-amarillo': 'bloques',
};
const PAD_Y = 320;
const R = 92;

interface Pad {
  c: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc;
  talk: Phaser.GameObjects.Container;
  x: number;
}

/**
 * Motor "repite": los botones (juguetes o amigos) se iluminan y suenan en un orden.
 * Luego el niño los toca en el mismo orden. Cada ronda es un poquito más larga.
 * Si se equivoca, Tori lo anima y se vuelve a mostrar la misma secuencia.
 * Con amigos ("talk"), cada uno muestra un globito como si hablara: practica escuchar.
 */
export default class SimonGameScene extends BaseActivity<SimonActivity> {
  protected readonly kind = 'simon' as const;
  private pads: Pad[] = [];
  private round = 0;
  private seq: number[] = [];
  private step = 0;
  private listening = false;
  private dots!: RoundDots;
  private banner!: Phaser.GameObjects.Text;

  constructor() {
    super('SimonGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.pads = [];
    this.round = 0;
    this.seq = [];
    this.step = 0;
    this.listening = false;
  }

  protected override buildLevel(): void {
    const a = this.activity;
    this.dots = new RoundDots(this, a.lengths.length, 1240, 64);
    const n = a.pads.length;
    const gap = n > 3 ? 240 : 290;
    a.pads.forEach((def, i) => {
      const x = 640 + (i - (n - 1) / 2) * gap;
      const color = PAD_COLORS[i % PAD_COLORS.length] ?? COLORS.sun;
      const g = this.add.graphics();
      g.fillStyle(COLORS.ink, 0.2).fillCircle(0, 10, R);
      g.fillStyle(color).fillCircle(0, 0, R);
      g.fillStyle(COLORS.white).fillCircle(0, 0, R - 16);
      g.lineStyle(6, COLORS.ink).strokeCircle(0, 0, R);
      const glow = this.add.circle(0, 0, R + 16, color, 0).setStrokeStyle(10, COLORS.white, 0);
      const img = fit(this.add.image(0, 0, tex(def.art)), R * 1.35, R * 1.35, 2);
      const label = addBody(this, 0, R + 26, def.label, 20, {
        stroke: '#FFFFFF',
        strokeThickness: 6,
      });
      // Globito de "hablar" (solo con amigos).
      const bub = this.add.graphics();
      bub.fillStyle(COLORS.white).fillRoundedRect(-34, -26, 68, 44, 16);
      bub.fillTriangle(-6, 16, 10, 16, -14, 32);
      bub.lineStyle(4, COLORS.ink).strokeRoundedRect(-34, -26, 68, 44, 16);
      bub.fillStyle(COLORS.ink).fillCircle(-14, -4, 5).fillCircle(0, -4, 5).fillCircle(14, -4, 5);
      const talk = this.add.container(R * 0.6, -R - 20, [bub]).setAlpha(0);
      const c = this.add
        .container(x, PAD_Y, [glow, g, img, label, talk])
        .setSize(R * 2, R * 2)
        .setDepth(3);
      c.setInteractive({ useHandCursor: true });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.press(i));
      c.setScale(0);
      this.tweens.add({
        targets: c,
        scale: 1,
        delay: i * 100,
        duration: motion(320),
        ease: 'Back.easeOut',
      });
      this.pads.push({ c, glow, talk, x });
    });
    this.banner = addBody(this, 640, 140, '', 30, {
      stroke: '#FFFFFF',
      strokeThickness: 8,
    }).setDepth(4);
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.newRound();
  }

  private newRound(): void {
    const len = this.activity.lengths[this.round] ?? 3;
    // La secuencia crece: se conserva la anterior y se agregan pasos (como el juego clásico).
    while (this.seq.length < len) {
      let k = Phaser.Math.Between(0, this.pads.length - 1);
      if (k === this.seq[this.seq.length - 1]) k = (k + 1) % this.pads.length;
      this.seq.push(k);
    }
    void this.playSeq();
  }

  private flash(i: number, ms = 520): void {
    const pad = this.pads[i];
    if (!pad) return;
    const toy = TOY_SOUND[this.activity.pads[i]?.art ?? ''];
    if (toy && !this.activity.talk) AudioManager.toy(toy);
    else AudioManager.sfx('pop', { pitch: PITCH[i] ?? 1 });
    pad.glow.setFillStyle(PAD_COLORS[i] ?? COLORS.sun, 0.55).setStrokeStyle(10, COLORS.white, 1);
    this.tweens.add({
      targets: pad.c,
      scale: 1.14,
      duration: motion(140),
      yoyo: true,
      hold: ms - 300,
    });
    if (this.activity.talk) {
      pad.talk.setAlpha(1).setScale(0.4);
      this.tweens.add({ targets: pad.talk, scale: 1, duration: motion(160), ease: 'Back.easeOut' });
    }
    this.time.delayedCall(ms, () => {
      pad.glow.setFillStyle(PAD_COLORS[i] ?? COLORS.sun, 0).setStrokeStyle(10, COLORS.white, 0);
      this.tweens.add({ targets: pad.talk, alpha: 0, duration: motion(150) });
    });
  }

  private async playSeq(): Promise<void> {
    this.listening = false;
    this.step = 0;
    this.banner.setText('¡Mira y escucha!');
    await this.say(this.activity.watch);
    if (!this.alive) return;
    await this.wait(300);
    for (const k of this.seq) {
      if (!this.alive) return;
      this.flash(k, 640);
      await this.wait(900);
    }
    this.banner.setText('¡Tu turno!');
    this.tweens.add({ targets: this.banner, scale: 1.15, duration: motion(160), yoyo: true });
    this.listening = true;
    void this.instruct(this.activity.yourTurn);
  }

  private press(i: number): void {
    if (!this.listening) return;
    this.flash(i, 360);
    if (this.seq[this.step] !== i) {
      this.listening = false;
      const pad = this.pads[i];
      if (pad)
        this.tweens.add({
          targets: pad.c,
          angle: { from: -8, to: 8 },
          duration: motion(70),
          yoyo: true,
          repeat: 2,
          onComplete: () => pad.c.setAngle(0),
        });
      this.mistakeOnce(`r${this.round}`, this.activity.retry);
      this.time.delayedCall(2200, () => {
        if (this.alive) void this.playSeq();
      });
      return;
    }
    this.step += 1;
    if (this.step < this.seq.length) return;
    // ¡Ronda completa!
    this.listening = false;
    this.dots.mark(this.round);
    const last = this.round === this.activity.lengths.length - 1;
    this.correct(640, PAD_Y - R - 40, last ? null : undefined);
    this.banner.setText('');
    this.time.delayedCall(1500, () => {
      if (!this.alive) return;
      if (last) {
        void this.complete(this.activity.done);
      } else {
        this.round += 1;
        this.newRound();
      }
    });
  }

  protected override getHint(): HintTarget | null {
    if (!this.listening) return null;
    const k = this.seq[this.step];
    const pad = k === undefined ? undefined : this.pads[k];
    return pad ? { kind: 'tap', x: pad.x, y: PAD_Y } : null;
  }
}
