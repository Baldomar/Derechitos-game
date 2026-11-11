import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { VoiceContent } from '@/config/levels';
import { artImage, tex, type ArtKey } from '@/art/Art';
import type { HintTarget } from '@/components/HelperHand';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, vibrate } from '@/core/Device';
import { BaseLevel } from './BaseLevel';

const DOG = { x: 1080, y: 270 };
const BOX = { x: 860, y: 430 };

/**
 * Nivel 7 — Mi voz cuenta (expresar opiniones).
 * 1) Elegir una carita de cómo se siente: Tori responde con empatía.
 * 2) Votar por el nombre del perrito del parque. No hay respuestas incorrectas: ese es el aprendizaje.
 */
export default class Level07Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'cara-feliz',
    'cara-tranquila',
    'cara-triste',
    'cara-enojada',
    'cara-asustada',
    'perrito',
    'mango',
    'luna',
    'copito',
    'urna',
    'boleta',
  ];
  private c!: VoiceContent;
  private stage: 'feel' | 'reply' | 'vote' | 'voted' = 'feel';
  private faces: Phaser.GameObjects.Container[] = [];
  private cards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('Level07');
  }

  override init(data?: unknown): void {
    super.init(data);
    this.stage = 'feel';
    this.faces = [];
    this.cards = [];
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

  private async chooseFeeling(
    face: Phaser.GameObjects.Container,
    f: VoiceContent['feelings'][number],
  ): Promise<void> {
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
      x: 640,
      y: 270,
      scale: 1.3,
      duration: motion(500),
      ease: 'Back.easeOut',
    });
    this.effects.sparkleAt(640, 270, 16);
    this.tori.setMood(f.id === 'feliz' || f.id === 'tranquilo' ? 'happy' : 'idle');
    await this.say(f.reply);
    if (!this.alive) return;
    await this.say(this.c.thanks);
    if (!this.alive) return;
    this.faces.forEach((x) =>
      this.tweens.add({
        targets: x,
        alpha: 0,
        scale: 0.5,
        duration: motion(300),
        onComplete: () => x.destroy(),
      }),
    );
    await this.wait(350);
    void this.startVote();
  }

  private async startVote(): Promise<void> {
    if (!this.alive) return;
    this.stage = 'vote';
    const dog = artImage(this, DOG.x, DOG.y, 'perrito').setScale(0);
    this.tweens.add({ targets: dog, scale: 0.9, duration: motion(450), ease: 'Back.easeOut' });
    this.tweens.add({
      targets: dog,
      angle: { from: -3, to: 3 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    const tag = this.add.graphics();
    tag.fillStyle(COLORS.white).fillRoundedRect(DOG.x - 90, DOG.y + 96, 180, 54, 18);
    tag.lineStyle(4, COLORS.ink).strokeRoundedRect(DOG.x - 90, DOG.y + 96, 180, 54, 18);
    const tagText = addTitle(this, DOG.x, DOG.y + 124, '¿ ?', 32);
    const box = artImage(this, BOX.x, BOX.y, 'urna').setScale(0.8).setDepth(1);

    this.c.names.forEach((n, i) => {
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-90, -102, 180, 220, 24);
      bg.fillStyle(COLORS.white).fillRoundedRect(-90, -110, 180, 220, 24);
      bg.lineStyle(5, COLORS.ink).strokeRoundedRect(-90, -110, 180, 220, 24);
      const img = this.add.image(0, -20, tex(n.art)).setScale(1.1);
      const label = addTitle(this, 0, 70, n.label, 32);
      const card = this.add.container(220 + i * 200, 290, [bg, img, label]).setSize(180, 220);
      card.setInteractive({ useHandCursor: true });
      card.on(
        Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,
        () => void this.vote(card, n, box, tagText),
      );
      card.setScale(0);
      this.tweens.add({
        targets: card,
        scale: 1,
        delay: 200 + i * 120,
        duration: motion(350),
        ease: 'Back.easeOut',
      });
      this.cards.push(card);
    });
    await this.instruct(this.c.voteQuestion);
  }

  private async vote(
    card: Phaser.GameObjects.Container,
    n: VoiceContent['names'][number],
    box: Phaser.GameObjects.Image,
    tagText: Phaser.GameObjects.Text,
  ): Promise<void> {
    if (this.stage !== 'vote') return;
    this.stage = 'voted';
    this.cards.forEach((c) => c.disableInteractive());
    AudioManager.sfx('pop');
    this.tweens.add({ targets: card, scale: 1.12, duration: motion(160), yoyo: true });
    // La boleta vuela a la urna.
    const ballot = artImage(this, card.x, card.y, 'boleta').setDepth(5);
    this.tweens.chain({
      targets: ballot,
      tweens: [
        { y: card.y - 120, duration: motion(300), ease: 'Quad.easeOut' },
        { x: BOX.x, y: BOX.y - 70, duration: motion(600), ease: 'Sine.easeInOut' },
        { y: BOX.y - 20, scale: 0.4, alpha: 0, duration: motion(250) },
      ],
      onComplete: () => {
        ballot.destroy();
        AudioManager.sfx('pop', { pitch: 0.8 });
        this.tweens.add({
          targets: box,
          angle: { from: -6, to: 6 },
          duration: 80,
          yoyo: true,
          repeat: 2,
          onComplete: () => box.setAngle(0),
        });
        tagText.setText(n.label);
        this.tweens.add({
          targets: tagText,
          scale: { from: 1.6, to: 1 },
          duration: motion(400),
          ease: 'Back.easeOut',
        });
      },
    });
    await this.wait(motion(1200));
    if (!this.alive) return;
    this.correct(DOG.x, DOG.y - 120, n.chosen);
    await this.wait(2200);
    if (!this.alive) return;
    await this.complete(this.c.done);
  }

  protected override getHint(): HintTarget | null {
    if (this.stage === 'feel') {
      const f = this.faces[0];
      return f ? { kind: 'tap', x: f.x, y: f.y } : null;
    }
    if (this.stage === 'vote') {
      const c = this.cards[0];
      return c ? { kind: 'tap', x: c.x, y: c.y } : null;
    }
    return null;
  }
}
