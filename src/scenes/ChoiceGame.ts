import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { TRY_AGAIN } from '@/config/phrases';
import type { ChoiceActivity, ChoiceOption } from '@/config/rights';
import { tex } from '@/art/Art';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { TEX } from '@/core/Textures';
import { motion } from '@/core/Device';
import { BaseActivity, fitImage } from './BaseActivity';

interface OptionCard {
  c: Phaser.GameObjects.Container;
  def: ChoiceOption;
  chosen: boolean;
}

/**
 * Motor "elegir": una o varias preguntas con dibujos. En cada pregunta hay que tocar
 * la(s) respuesta(s) correcta(s). Lo incorrecto se mueve y Tori da una pista ("¡Inténtalo otra vez!").
 */
export default class ChoiceGameScene extends BaseActivity<ChoiceActivity> {
  protected readonly kind = 'choice' as const;
  private round = 0;
  private cards: OptionCard[] = [];
  private found = 0;
  private busy = false;
  private counted = new Set<string>();
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('ChoiceGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.round = 0;
    this.cards = [];
    this.found = 0;
    this.busy = false;
    this.counted = new Set();
    this.dots = [];
  }

  protected override buildLevel(): void {
    const a = this.activity;
    if (a.character) {
      const ch = fitImage(this.add.image(1080, 300, tex(a.character)), 230, 230);
      this.tweens.add({
        targets: ch,
        angle: { from: -3, to: 3 },
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }
    if (a.rounds.length > 1) {
      a.rounds.forEach((_, i) => {
        this.dots.push(
          this.add
            .circle(1240 - (a.rounds.length - 1 - i) * 40, 112, 13, COLORS.white)
            .setStrokeStyle(4, COLORS.ink),
        );
      });
    }
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    void this.showRound();
  }

  private async showRound(): Promise<void> {
    const round = this.activity.rounds[this.round];
    if (!round) return;
    this.cards.forEach((k) => k.c.destroy());
    this.found = 0;
    this.busy = false;
    const opts = round.options;
    const two = opts.length > 3;
    const perRow = two ? Math.ceil(opts.length / 2) : opts.length;
    const cw = two ? 180 : 200;
    const ch = two ? 190 : 230;
    const centerX = this.activity.character ? 520 : 640;
    this.cards = opts.map((def, i) => {
      const row = two ? Math.floor(i / perRow) : 0;
      const col = i % perRow;
      const x = centerX + (col - (perRow - 1) / 2) * (cw + 30);
      const y = two ? 220 + row * 215 : 315;
      return { c: this.makeCard(x, y, cw, ch, def, i), def, chosen: false };
    });
    await this.instruct(round.question);
  }

  private makeCard(
    x: number,
    y: number,
    w: number,
    h: number,
    def: ChoiceOption,
    i: number,
  ): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 22);
    bg.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    const img = fitImage(this.add.image(0, -22, tex(def.art)), w - 40, h - 75);
    const label = addBody(this, 0, h / 2 - 30, def.label, 19, { wrap: w - 16 });
    const card = this.add.container(x, y, [bg, img, label]).setSize(w, h).setDepth(2);
    card.setInteractive({ useHandCursor: true });
    card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.choose(card, def));
    card.setScale(0);
    this.tweens.add({
      targets: card,
      scale: 1,
      delay: i * 90,
      duration: motion(340),
      ease: 'Back.easeOut',
    });
    return card;
  }

  private choose(card: Phaser.GameObjects.Container, def: ChoiceOption): void {
    const entry = this.cards.find((k) => k.c === card);
    if (this.busy || !entry || entry.chosen) return;
    AudioManager.sfx('pop');
    if (!def.correct) {
      const hint = def.hint ?? TRY_AGAIN;
      if (!this.counted.has(`${this.round}/${def.id}`)) {
        this.counted.add(`${this.round}/${def.id}`);
        this.mistake(hint);
      } else {
        void this.say(hint);
      }
      this.tweens.add({
        targets: card,
        angle: { from: -6, to: 6 },
        duration: motion(80),
        yoyo: true,
        repeat: 2,
        onComplete: () => card.setAngle(0),
      });
      return;
    }
    entry.chosen = true;
    card.disableInteractive();
    // Correcto: borde de color + palomita (forma e ícono, no solo color).
    const w = card.width;
    const h = card.height;
    const ring = this.add.graphics();
    ring.lineStyle(8, COLORS.grass).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    card.add([ring, this.add.image(w / 2 - 18, -h / 2 + 18, TEX.check).setScale(0.55)]);
    this.found += 1;
    const round = this.activity.rounds[this.round];
    const needed = round ? round.options.filter((o) => o.correct).length : 1;
    const roundDone = this.found >= needed;
    const lastRound = this.round === this.activity.rounds.length - 1;
    this.correct(card.x, card.y - h / 2 - 20, roundDone && lastRound ? null : undefined);
    if (!roundDone) return;
    this.busy = true;
    this.dots[this.round]?.setFillStyle(COLORS.grass);
    this.time.delayedCall(1300, () => {
      if (!this.alive) return;
      if (lastRound) {
        void this.complete(this.activity.done);
      } else {
        this.round += 1;
        void this.showRound();
      }
    });
  }

  protected override getHint(): HintTarget | null {
    if (this.busy) return null;
    const next = this.cards.find((k) => k.def.correct && !k.chosen);
    return next ? { kind: 'tap', x: next.c.x, y: next.c.y } : null;
  }
}
