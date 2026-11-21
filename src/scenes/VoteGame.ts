import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { VoiceLine } from '@/config/levels';
import type { VoteActivity } from '@/config/rights';
import { tex, type ArtKey } from '@/art/Art';
import type { HintTarget } from '@/components/HelperHand';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { TEX } from '@/core/Textures';
import { BaseActivity, fitImage } from './BaseActivity';
import { voteWinLine } from '@/config/voiceCatalog';

const CARD_Y = 236;
const CARD_X = [300, 980] as const;
const CARD_W = 236;
const CARD_H = 210;
const URN = { x: 640, y: 300 };
const TALLY_Y = 392;
const OPTION_COLOR = [COLORS.turquoise, COLORS.orange] as const;
const FRIENDS: { art: ArtKey; x: number }[] = [
  { art: 'nino-a', x: 430 },
  { art: 'nina-b', x: 540 },
  { art: 'nino-c', x: 740 },
  { art: 'nina-silla', x: 850 },
];
const FRIEND_Y = 488;
const INK = COLORS.ink;

const VOTE_FRIENDS: VoiceLine = { id: 'vote_friends', text: '¡Ahora votan tus amigos!' };
const VOTE_COUNT: VoiceLine = { id: 'vote_count', text: '¡Vamos a contar los votos!' };

/**
 * Motor "votación": el niño toca lo que prefiere y su boleta vuela a la urna; luego votan
 * sus 4 amigos, se cuentan las boletas una por una y gana la opción con más votos.
 * No hay respuestas incorrectas: enseña que todos opinan y se respeta a la mayoría.
 */
export default class VoteGameScene extends BaseActivity<VoteActivity> {
  protected readonly kind = 'vote' as const;
  private round = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private urn!: Phaser.GameObjects.Image;
  private friends: Phaser.GameObjects.Image[] = [];
  private roundObjs: Phaser.GameObjects.GameObject[] = [];
  private choosing = false;
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('VoteGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.round = 0;
    this.cards = [];
    this.friends = [];
    this.roundObjs = [];
    this.choosing = false;
    this.dots = [];
  }

  protected override buildLevel(): void {
    this.add.ellipse(URN.x, URN.y + 84, 190, 30, INK, 0.15);
    this.urn = fitImage(this.add.image(URN.x, URN.y, tex('urna')), 190, 190, 2).setDepth(2);
    this.friends = FRIENDS.map((f, i) => {
      const img = fitImage(this.add.image(f.x, FRIEND_Y, tex(f.art)), 96, 104, 2).setDepth(1);
      this.tweens.add({
        targets: img,
        angle: { from: -2, to: 2 },
        duration: 900 + i * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      return img;
    });
    const n = this.activity.rounds.length;
    if (n > 1) {
      for (let i = 0; i < n; i++) {
        this.dots.push(
          this.add.circle(1236 - (n - 1 - i) * 40, 58, 13, COLORS.white).setStrokeStyle(4, INK),
        );
      }
    }
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    void this.showRound();
  }

  private async showRound(): Promise<void> {
    const r = this.activity.rounds[this.round];
    if (!r) return;
    this.roundObjs.forEach((o) => o.destroy());
    this.roundObjs = [];
    this.cards = r.options.map((opt, k) => this.makeCard(k as 0 | 1, opt.art, opt.label));
    this.choosing = true;
    await this.instruct(r.question);
  }

  private makeCard(k: 0 | 1, art: ArtKey, label: string): Phaser.GameObjects.Container {
    const w = CARD_W;
    const h = CARD_H;
    const bg = this.add.graphics();
    bg.fillStyle(INK, 0.2).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 24);
    bg.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    bg.lineStyle(8, OPTION_COLOR[k]).strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    const img = fitImage(this.add.image(0, -20, tex(art)), w - 70, h - 80, 2);
    const text = addBody(this, 0, h / 2 - 30, label, 22, { wrap: w - 20 });
    const card = this.add.container(CARD_X[k], CARD_Y, [bg, img, text]).setSize(w, h);
    card.setDepth(2).setScale(0);
    card.setInteractive({ useHandCursor: true });
    card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => void this.vote(k));
    this.tweens.add({
      targets: card,
      scale: 1,
      delay: k * 120,
      duration: motion(360),
      ease: 'Back.easeOut',
    });
    this.roundObjs.push(card);
    return card;
  }

  /** Boleta del color de la opción. */
  private makeBallot(x: number, y: number, k: 0 | 1): Phaser.GameObjects.Container {
    const paper = fitImage(this.add.image(0, 0, tex('boleta')), 54, 54, 2);
    const dot = this.add.circle(14, 12, 10, OPTION_COLOR[k]).setStrokeStyle(3, INK);
    const b = this.add.container(x, y, [paper, dot]).setDepth(5);
    this.roundObjs.push(b);
    return b;
  }

  /** La boleta sube en arco y cae dentro de la urna. */
  private flyToUrn(b: Phaser.GameObjects.Container): Promise<void> {
    return new Promise((resolve) => {
      const peak = Math.min(b.y, URN.y) - 130;
      this.tweens.add({ targets: b, x: URN.x, duration: motion(620), ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: b, angle: 360, duration: motion(620) });
      this.tweens.chain({
        targets: b,
        tweens: [
          { y: peak, duration: motion(330), ease: 'Quad.easeOut' },
          { y: URN.y - 60, duration: motion(290), ease: 'Quad.easeIn' },
          { y: URN.y - 10, scale: 0.3, alpha: 0, duration: motion(160) },
        ],
        onComplete: () => {
          b.setVisible(false);
          AudioManager.sfx('pop', { pitch: 0.9 });
          const sx = this.urn.scaleX;
          const sy = this.urn.scaleY;
          this.tweens.chain({
            targets: this.urn,
            tweens: [
              { scaleX: sx * 1.1, scaleY: sy * 0.9, duration: motion(80) },
              { scaleX: sx, scaleY: sy, duration: motion(300), ease: 'Elastic.easeOut' },
            ],
          });
          resolve();
        },
      });
    });
  }

  private async vote(k: 0 | 1): Promise<void> {
    if (!this.choosing) return;
    this.choosing = false;
    const r = this.activity.rounds[this.round];
    if (!r) return;
    AudioManager.sfx('pop');
    const card = this.cards[k];
    if (card) {
      card.add(this.add.image(CARD_W / 2 - 22, -CARD_H / 2 + 22, TEX.check).setScale(0.6));
      this.tweens.add({ targets: card, scale: 1.08, duration: motion(160), yoyo: true });
    }
    this.cards.forEach((c) => c.disableInteractive());

    // 1) Tu voto
    await this.flyToUrn(this.makeBallot(CARD_X[k], CARD_Y, k));
    if (!this.alive) return;

    // 2) Votan los amigos
    await this.say(VOTE_FRIENDS);
    for (let i = 0; i < FRIENDS.length; i++) {
      if (!this.alive) return;
      const f = this.friends[i];
      const choice = r.friendVotes[i] ?? 0;
      if (!f) continue;
      const y = f.y;
      this.tweens.chain({
        targets: f,
        tweens: [
          { y: y - 26, duration: motion(150), ease: 'Quad.easeOut' },
          { y, duration: motion(150), ease: 'Quad.easeIn' },
        ],
      });
      // Un pensamiento rápido: ¿cuál le gusta?
      const think = this.add.image(f.x, y - 80, tex(r.options[choice].art));
      think.setDepth(4).setScale(0);
      this.roundObjs.push(think);
      this.tweens.add({
        targets: think,
        scale: Math.min(46 / think.width, 46 / think.height),
        duration: motion(200),
        ease: 'Back.easeOut',
      });
      await this.wait(380);
      this.tweens.add({ targets: think, alpha: 0, duration: motion(200) });
      await this.flyToUrn(this.makeBallot(f.x, y - 50, choice));
    }
    if (!this.alive) return;

    // 3) Contamos las boletas, una por una
    await this.say(VOTE_COUNT);
    const votes: (0 | 1)[] = [k, ...r.friendVotes];
    const counts = [0, 0];
    const numbers = CARD_X.map((x, j) => {
      const badge = this.add.circle(
        x + CARD_W / 2 - 6,
        CARD_Y + CARD_H / 2 - 6,
        26,
        OPTION_COLOR[j],
      );
      badge.setStrokeStyle(4, INK).setDepth(3);
      const t = addTitle(this, badge.x, badge.y, '0', 30, { color: '#FFFFFF' }).setDepth(3);
      this.roundObjs.push(badge, t);
      return t;
    });
    // Se mezclan para que el conteo tenga suspenso.
    for (const choice of Phaser.Utils.Array.Shuffle([...votes])) {
      if (!this.alive) return;
      const b = this.makeBallot(URN.x, URN.y - 40, choice);
      const slot = counts[choice] ?? 0;
      counts[choice] = slot + 1;
      const tx = CARD_X[choice] - 92 + slot * 46;
      AudioManager.sfx('pop', { pitch: 1 + (counts[choice] ?? 0) * 0.08 });
      this.tweens.add({
        targets: b,
        x: tx,
        y: TALLY_Y,
        angle: { from: -20, to: 0 },
        duration: motion(420),
        ease: 'Back.easeOut',
      });
      numbers[choice]?.setText(String(counts[choice]));
      if (numbers[choice]) {
        this.tweens.add({
          targets: numbers[choice],
          scale: 1.4,
          duration: motion(120),
          yoyo: true,
        });
      }
      await this.wait(520);
    }
    if (!this.alive) return;

    // 4) ¡Ganó la mayoría!
    const win: 0 | 1 = (counts[0] ?? 0) > (counts[1] ?? 0) ? 0 : 1;
    const winCard = this.cards[win];
    const loseCard = this.cards[1 - win];
    if (winCard) {
      this.tweens.add({
        targets: winCard,
        scale: 1.12,
        duration: motion(300),
        ease: 'Back.easeOut',
      });
      this.effects.confettiAt(winCard.x, winCard.y, 40);
    }
    if (loseCard) this.tweens.add({ targets: loseCard, alpha: 0.55, duration: motion(300) });
    AudioManager.sfx('success');
    this.tori.setMood('happy');
    this.dots[this.round]?.setFillStyle(COLORS.grass);
    const label = r.options[win].label;
    const line = voteWinLine(this.activity.id, this.round, label, win === k);
    await this.say(line);
    await this.wait(600);
    if (!this.alive) return;
    if (this.round === this.activity.rounds.length - 1) {
      void this.complete(this.activity.done);
    } else {
      this.round += 1;
      void this.showRound();
    }
  }

  protected override getHint(): HintTarget | null {
    if (!this.choosing) return null;
    return { kind: 'tap', x: CARD_X[0], y: CARD_Y };
  }
}
