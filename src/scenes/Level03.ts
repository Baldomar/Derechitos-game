import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { ChoiceDef, ClinicContent } from '@/config/levels';
import { artImage, tex, type ArtKey } from '@/art/Art';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseLevel } from './BaseLevel';

const BEAR = { x: 960, y: 330 };
const CARD_W = 200;
const CARD_H = 270;
const CARD_X = [230, 455, 680];
const CARD_Y = 320;

/**
 * Nivel 3 — Clínica de Tori (salud).
 * Elegir en orden: quién ayuda (doctora), qué usa (termómetro y curita) y qué protege (vacuna).
 */
export default class Level03Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'osito-enfermo',
    'osito-sano',
    'cama',
    'doctora',
    'cocinero',
    'pintor',
    'termometro',
    'pelota',
    'cuchara',
    'curita',
    'crayon',
    'galleta',
    'vacuna',
    'carrito',
    'dulces',
  ];
  protected override backdrop = { sky: 0xd8f3ee, grass: false, clouds: false };
  private c!: ClinicContent;
  private step = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private bear!: Phaser.GameObjects.Image;
  private dots: Phaser.GameObjects.Arc[] = [];
  private busy = false;
  private counted = new Set<string>();

  constructor() {
    super('Level03');
  }

  override init(): void {
    super.init();
    this.step = 0;
    this.cards = [];
    this.dots = [];
    this.busy = false;
    this.counted = new Set();
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('clinic');
    const g = this.add.graphics();
    g.fillStyle(0xbfe3dc).fillRect(0, 470, 1280, 250);
    g.fillStyle(COLORS.white).fillCircle(1150, 120, 44);
    g.lineStyle(5, COLORS.ink).strokeCircle(1150, 120, 44);
    g.fillStyle(COLORS.coral).fillRect(1140, 94, 20, 52).fillRect(1124, 110, 52, 20);

    artImage(this, BEAR.x, BEAR.y + 110, 'cama');
    this.bear = artImage(this, BEAR.x - 20, BEAR.y + 10, 'osito-enfermo').setScale(0.85);
    this.tweens.add({
      targets: this.bear,
      angle: { from: -2, to: 2 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    // Progreso del botiquín: un punto por paso (forma: se rellena y aparece palomita).
    this.c.steps.forEach((_, i) => {
      this.dots.push(
        this.add.circle(860 + i * 50, 120, 16, COLORS.white).setStrokeStyle(4, COLORS.ink),
      );
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    void this.showStep();
  }

  private async showStep(): Promise<void> {
    const step = this.c.steps[this.step];
    if (!step) return;
    this.cards.forEach((c) => c.destroy());
    this.cards = step.options.map((opt, i) => this.makeCard(CARD_X[i] ?? 230, CARD_Y, opt, i));
    this.busy = false;
    await this.instruct(step.question);
  }

  private makeCard(x: number, y: number, opt: ChoiceDef, i: number): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 8, CARD_W, CARD_H, 24);
    bg.fillStyle(COLORS.white).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
    bg.lineStyle(5, COLORS.ink).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
    const img = this.add.image(0, -18, tex(opt.art));
    img.setScale(Math.min(1.35, 190 / img.height, 170 / img.width));
    const label = addBody(this, 0, CARD_H / 2 - 26, opt.label, 24);
    const card = this.add.container(x, y, [bg, img, label]).setSize(CARD_W, CARD_H).setDepth(2);
    card.setInteractive({ useHandCursor: true });
    card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.choose(card, opt));
    card.setScale(0);
    this.tweens.add({
      targets: card,
      scale: 1,
      duration: motion(350),
      delay: i * 120,
      ease: 'Back.easeOut',
    });
    return card;
  }

  private choose(card: Phaser.GameObjects.Container, opt: ChoiceDef): void {
    if (this.busy) return;
    AudioManager.sfx('pop');
    if (!opt.correct) {
      // Cada distractor cuenta una sola vez (no se castiga insistir).
      if (!this.counted.has(opt.id)) {
        this.counted.add(opt.id);
        if (opt.hint) this.mistake(opt.hint);
      } else if (opt.hint) {
        void this.say(opt.hint);
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
    this.busy = true;
    const step = this.c.steps[this.step];
    this.correct(card.x, card.y - 90, null);
    this.dots[this.step]?.setFillStyle(COLORS.grass);
    this.tweens.add({
      targets: card,
      x: BEAR.x,
      y: BEAR.y,
      scale: 0.3,
      alpha: 0,
      duration: motion(650),
      ease: 'Cubic.easeIn',
      onComplete: () => this.effects.sparkleAt(BEAR.x, BEAR.y, 18),
    });
    void (async () => {
      if (step) await this.say(step.success);
      if (!this.alive) return;
      this.step += 1;
      if (this.step < this.c.steps.length) void this.showStep();
      else void this.heal();
    })();
  }

  private async heal(): Promise<void> {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    this.tweens.killTweensOf(this.bear);
    this.bear.setAngle(0).setTexture(tex('osito-sano'));
    this.tweens.add({
      targets: this.bear,
      scale: { from: 0.6, to: 0.85 },
      duration: motion(600),
      ease: 'Elastic.easeOut',
    });
    this.effects.sparkleAt(BEAR.x, BEAR.y, 30);
    await this.complete(this.c.done);
  }

  protected override getHint(): HintTarget | null {
    const step = this.c.steps[this.step];
    const idx = step?.options.findIndex((o) => o.correct) ?? -1;
    const card = this.cards[idx];
    return card && !this.busy ? { kind: 'tap', x: card.x, y: card.y } : null;
  }
}
