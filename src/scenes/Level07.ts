import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { VoiceContent } from '@/config/levels';
import { tex, type ArtKey } from '@/art/Art';
import type { HintTarget } from '@/components/HelperHand';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion, vibrate } from '@/core/Device';
import { BaseLevel } from './BaseLevel';

const INK = COLORS.ink;
/** Tarjeta de ayuda (a la derecha de la carita elegida). */
const HELP = { x: 860, y: 290, w: 440, h: 300 };

type Feeling = VoiceContent['feelings'][number];
type Idea = VoiceContent['ideas'][number];

/**
 * Nivel 7 — Mi voz cuenta (expresar lo que sentimos y pensamos, y ser escuchados).
 * 1) Elegir una carita de cómo se siente: Tori responde con empatía y aparece una tarjeta de
 *    ayuda con un consejo (con enojo, un ejercicio de respiración: inhala… exhala…).
 * 2) Decir lo que piensa: elegir qué le gustaría hacer hoy. Tori responde "¡Te escuché!".
 * No hay respuestas incorrectas: ese es el aprendizaje.
 */
export default class Level07Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'cara-feliz',
    'cara-tranquila',
    'cara-triste',
    'cara-enojada',
    'cara-asustada',
    'nino-a',
    'cuento',
    'mama',
    'papa',
    'pelota',
    'crayon',
    'esponja',
  ];
  private c!: VoiceContent;
  private stage: 'feel' | 'reply' | 'idea' | 'said' = 'feel';
  private faces: Phaser.GameObjects.Container[] = [];
  private cards: Phaser.GameObjects.Container[] = [];
  private layer: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Level07');
  }

  override init(data?: unknown): void {
    super.init(data);
    this.stage = 'feel';
    this.faces = [];
    this.cards = [];
    this.layer = [];
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('voice');
    this.c.feelings.forEach((f, i) => {
      const img = this.add.image(0, 0, tex(f.art)).setScale(0.9);
      const label = addBody(this, 0, 88, f.label, 24);
      const face = this.add.container(640 + (i - 2) * 205, 280, [img, label]).setSize(170, 210);
      face.setInteractive({ useHandCursor: true });
      face.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => void this.chooseFeeling(face, f));
      face.setScale(0);
      this.tweens.add({
        targets: face,
        scale: 1,
        delay: i * 100,
        duration: motion(350),
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: img,
        y: -6,
        duration: 900 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.faces.push(face);
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  // ------------------------------------------------------------------ 1) cómo me siento

  private async chooseFeeling(face: Phaser.GameObjects.Container, f: Feeling): Promise<void> {
    if (this.stage !== 'feel') return;
    this.stage = 'reply';
    AudioManager.sfx('success');
    vibrate(25);
    this.faces.forEach((other) => {
      other.disableInteractive();
      if (other !== face)
        this.tweens.add({ targets: other, alpha: 0, scale: 0.6, duration: motion(300) });
    });
    this.tweens.add({
      targets: face,
      x: 330,
      y: 280,
      scale: 1.3,
      duration: motion(500),
      ease: 'Back.easeOut',
    });
    this.effects.sparkleAt(330, 280, 16);
    this.tori.setMood(f.id === 'feliz' || f.id === 'tranquilo' ? 'happy' : 'idle');
    const breathing = this.showHelp(f);
    await this.say(f.reply);
    if (!this.alive) return;
    await breathing;
    if (!this.alive) return;
    await this.say(this.c.thanks);
    if (!this.alive) return;
    this.clearStage([...this.faces, ...this.layer]);
    await this.wait(380);
    void this.askIdea();
  }

  /** Tarjeta de ayuda: un consejo con su dibujo, o un ejercicio para respirar profundo. */
  private showHelp(f: Feeling): Promise<void> {
    const { x, y, w, h } = HELP;
    const g = this.add.graphics();
    g.fillStyle(INK, 0.2).fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, 28);
    g.fillStyle(0xfff8e7).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
    g.lineStyle(5, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
    g.fillStyle(COLORS.sun).fillRoundedRect(-w / 2 + 16, -h / 2 + 14, 150, 36, 18);
    g.lineStyle(3, INK).strokeRoundedRect(-w / 2 + 16, -h / 2 + 14, 150, 36, 18);
    const head = addTitle(this, -w / 2 + 91, -h / 2 + 33, 'Un consejo', 18, { color: '#2B2848' });
    const tip = addTitle(this, 0, h / 2 - 44, f.tip, 22, { color: '#2B2848', wrap: w - 50 });
    const parts: Phaser.GameObjects.GameObject[] = [g, head, tip];
    let done = Promise.resolve();
    if (f.breathe) {
      done = this.breathe(parts);
    } else if (f.help) {
      const img = this.add.image(0, -14, tex(f.help));
      img.setScale(Math.min(150 / img.width, 140 / img.height));
      parts.push(img);
    }
    const card = this.add.container(x, y, parts).setScale(0.6).setAlpha(0).setDepth(4);
    this.tweens.add({
      targets: card,
      scale: 1,
      alpha: 1,
      duration: motion(380),
      ease: 'Back.easeOut',
    });
    this.layer.push(card);
    return done;
  }

  /** Respiración guiada: el círculo crece (inhala) y se encoge (exhala), dos veces. */
  private breathe(parts: Phaser.GameObjects.GameObject[]): Promise<void> {
    const ring = this.add.circle(0, -14, 42, COLORS.sky, 0.6).setStrokeStyle(5, COLORS.turquoise);
    const word = addTitle(this, 0, -14, 'Inhala', 22, { color: '#2B2848' });
    parts.push(ring, word);
    if (prefersReducedMotion()) return Promise.resolve();
    return new Promise((resolve) => {
      let n = 0;
      const cycle = (): void => {
        if (!this.alive) return resolve();
        if (n >= 2) {
          word.setText('¡Muy bien!');
          return resolve();
        }
        n += 1;
        word.setText('Inhala');
        this.tweens.add({
          targets: ring,
          scale: 1.6,
          duration: 2200,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            word.setText('Exhala');
            this.tweens.add({
              targets: ring,
              scale: 1,
              duration: 2200,
              ease: 'Sine.easeInOut',
              onComplete: cycle,
            });
          },
        });
      };
      this.time.delayedCall(600, cycle);
    });
  }

  private clearStage(objs: Phaser.GameObjects.GameObject[]): void {
    objs.forEach((o) =>
      this.tweens.add({
        targets: o,
        alpha: 0,
        scale: 0.5,
        duration: motion(300),
        onComplete: () => o.destroy(),
      }),
    );
    this.layer = [];
  }

  // ------------------------------------------------------------------ 2) lo que pienso

  private async askIdea(): Promise<void> {
    if (!this.alive) return;
    this.stage = 'idea';
    const n = this.c.ideas.length;
    this.c.ideas.forEach((idea, i) => {
      const bg = this.add.graphics();
      bg.fillStyle(INK, 0.2).fillRoundedRect(-95, -102, 190, 220, 24);
      bg.fillStyle(COLORS.white).fillRoundedRect(-95, -110, 190, 220, 24);
      bg.lineStyle(5, INK).strokeRoundedRect(-95, -110, 190, 220, 24);
      const img = this.add.image(0, -22, tex(idea.art));
      img.setScale(Math.min(120 / img.width, 110 / img.height));
      const label = addTitle(this, 0, 70, idea.label, 24, { color: '#2B2848', wrap: 170 });
      const card = this.add
        .container(640 + (i - (n - 1) / 2) * 220, 290, [bg, img, label])
        .setSize(190, 220);
      card.setInteractive({ useHandCursor: true });
      card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => void this.sayIdea(card, idea));
      card.setScale(0);
      this.tweens.add({
        targets: card,
        scale: 1,
        delay: 150 + i * 110,
        duration: motion(350),
        ease: 'Back.easeOut',
      });
      this.cards.push(card);
    });
    await this.instruct(this.c.ideaQuestion);
  }

  /** La idea elegida se dice en voz alta: crece dentro de un globo de diálogo "¡Mi idea!". */
  private async sayIdea(card: Phaser.GameObjects.Container, idea: Idea): Promise<void> {
    if (this.stage !== 'idea') return;
    this.stage = 'said';
    this.cards.forEach((c) => c.disableInteractive());
    AudioManager.sfx('success');
    vibrate(25);
    this.cards
      .filter((c) => c !== card)
      .forEach((c) => this.tweens.add({ targets: c, alpha: 0, scale: 0.6, duration: motion(300) }));
    const bub = this.add.graphics().setDepth(2).setAlpha(0);
    bub.fillStyle(INK, 0.2).fillRoundedRect(640 - 200 + 4, 140 + 10, 400, 316, 40);
    bub.fillStyle(COLORS.white).fillRoundedRect(640 - 200, 140, 400, 316, 40);
    bub.fillTriangle(560, 452, 610, 452, 530, 500);
    bub.lineStyle(5, INK).strokeRoundedRect(640 - 200, 140, 400, 316, 40);
    bub.lineBetween(560, 454, 530, 500).lineBetween(530, 500, 610, 454);
    const tag = addTitle(this, 640, 166, '¡Mi idea!', 26, { color: '#2F7FE0' })
      .setDepth(3)
      .setAlpha(0);
    this.tweens.add({ targets: [bub, tag], alpha: 1, duration: motion(300) });
    card.setDepth(3);
    this.tweens.add({
      targets: card,
      x: 640,
      y: 318,
      scale: 1.1,
      duration: motion(450),
      ease: 'Back.easeOut',
    });
    this.effects.sparkleAt(640, 300, 18);
    this.correct(640, 150, idea.chosen);
    await this.wait(2600);
    if (!this.alive) return;
    await this.complete(this.c.done);
  }

  protected override getHint(): HintTarget | null {
    if (this.stage === 'feel') {
      const f = this.faces[0];
      return f ? { kind: 'tap', x: f.x, y: f.y } : null;
    }
    if (this.stage === 'idea') {
      const c = this.cards[0];
      return c ? { kind: 'tap', x: c.x, y: c.y } : null;
    }
    return null;
  }
}
