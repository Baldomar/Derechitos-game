import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { RIGHTS, type MemoryContent, type RightId } from '@/config/levels';
import { tex, type ArtKey } from '@/art/Art';
import type { HintTarget } from '@/components/HelperHand';
import { MemoryCard } from '@/components/MemoryCard';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseLevel } from './BaseLevel';

const CARD_W = 120;
const CARD_H = 150;
const GAP = 16;

const RIGHT_COLOR: Record<RightId, number> = {
  vivienda: COLORS.coral,
  vida: COLORS.pink,
  alimentacion: COLORS.sun,
  salud: COLORS.turquoise,
  educacion: COLORS.grape,
  igualdad: COLORS.orange,
  juego: COLORS.sea,
  opinion: COLORS.grass,
};
const SHORT: Record<RightId, string> = {
  vivienda: 'Vivienda',
  vida: 'Vida',
  alimentacion: 'Comida',
  salud: 'Salud',
  educacion: 'Escuela',
  igualdad: 'Igualdad',
  juego: 'Jugar',
  opinion: 'Opinar',
};

/**
 * Nivel 8 — Memorama de derechos (repaso de todos).
 * 8 parejas de cartas idénticas: ícono y nombre del derecho, con una franja de su color.
 * Al terminar, los íconos vuelan y se arma la imagen completa de la isla.
 */
export default class Level08Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'icon-vivienda',
    'icon-vida',
    'icon-alimentacion',
    'icon-salud',
    'icon-educacion',
    'icon-igualdad',
    'icon-juego',
    'icon-opinion',
    'palmera',
    'izote',
    'arbol',
  ];
  private c!: MemoryContent;
  private cards: MemoryCard[] = [];
  private first: MemoryCard | null = null;
  private lock = false;
  private matched = 0;
  private mismatches = 0;

  constructor() {
    super('Level08');
  }

  override init(data?: unknown): void {
    super.init(data);
    this.cards = [];
    this.first = null;
    this.lock = false;
    this.matched = 0;
    this.mismatches = 0;
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('memory');
    const deck: RightId[] = Phaser.Utils.Array.Shuffle(
      this.c.pairs.flatMap((p) => [p.right, p.right]),
    );
    const cols = 8;
    const startX = 640 - (cols * CARD_W + (cols - 1) * GAP) / 2 + CARD_W / 2;
    deck.forEach((right, i) => {
      const x = startX + (i % cols) * (CARD_W + GAP);
      const y = 205 + Math.floor(i / cols) * (CARD_H + 22);
      const card = new MemoryCard(this, x, y, right, {
        w: CARD_W,
        h: CARD_H,
        art: RIGHTS[right].icon,
        label: SHORT[right],
        backColor: COLORS.turquoise,
        accent: RIGHT_COLOR[right],
        delay: i * 40,
      });
      card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => void this.tap(card));
      this.cards.push(card);
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private async tap(card: MemoryCard): Promise<void> {
    if (this.lock || card.up || card.matched) return;
    AudioManager.sfx('pop', { pitch: 1.2 });
    if (!this.first) {
      this.first = card;
      void card.flip(true);
      return;
    }
    const a = this.first;
    this.first = null;
    this.lock = true;
    await card.flip(true);
    if (!this.alive) return;

    if (a.id === card.id) {
      a.matched = true;
      card.matched = true;
      this.matched += 1;
      const pair = this.c.pairs.find((p) => p.right === card.id);
      a.celebrate();
      card.celebrate();
      const last = this.matched === this.c.pairs.length;
      this.correct(
        (a.x + card.x) / 2,
        Math.min(a.y, card.y) - 60,
        last ? null : (pair?.matched ?? null),
      );
      this.lock = false;
      if (last) this.time.delayedCall(700, () => void this.buildIsland());
      return;
    }
    this.mismatches += 1;
    if (this.mismatches % 3 === 0) void this.say(this.c.tryAgain);
    this.time.delayedCall(800, () => {
      // Se desbloquea hasta que las dos cartas terminan de voltearse.
      void Promise.all([a.flip(false), card.flip(false)]).then(() => {
        this.lock = false;
      });
    });
  }

  /** Final: las cartas se van y los íconos arman la imagen de la isla. */
  private async buildIsland(): Promise<void> {
    const extra = Math.max(0, this.mismatches - this.c.freeMismatches);
    this.errors = Math.ceil(extra / this.c.mismatchesPerError);

    const origins = new Map<RightId, { x: number; y: number }>();
    this.cards.forEach((k, i) => {
      const r = k.id as RightId;
      if (!origins.has(r)) origins.set(r, { x: k.x, y: k.y });
      this.tweens.killTweensOf(k);
      this.tweens.add({
        targets: k,
        scale: 0,
        alpha: 0,
        delay: i * 25,
        duration: motion(250),
        onComplete: () => k.destroy(),
      });
    });
    await this.wait(600);
    if (!this.alive) return;

    const isle = this.add.graphics().setAlpha(0);
    isle.fillStyle(COLORS.sea).fillEllipse(700, 320, 820, 380);
    isle.fillStyle(COLORS.white, 0.3).fillEllipse(700, 320, 760, 340);
    isle.fillStyle(COLORS.sand).fillEllipse(700, 320, 700, 300);
    isle.fillStyle(COLORS.grass).fillEllipse(700, 320, 640, 250);
    isle.lineStyle(5, COLORS.ink).strokeEllipse(700, 320, 700, 300);
    this.tweens.add({ targets: isle, alpha: 1, duration: motion(500) });
    const deco = [
      this.add.image(470, 290, tex('palmera')).setScale(0.55),
      this.add.image(930, 290, tex('arbol')).setScale(0.5),
      this.add.image(700, 420, tex('izote')).setScale(0.45),
    ];
    deco.forEach((d) => d.setAlpha(0));
    this.tweens.add({ targets: deco, alpha: 1, duration: motion(500), delay: 300 });

    const rights = this.c.pairs.map((p) => p.right);
    rights.forEach((r, i) => {
      const a = -Math.PI / 2 + (i / rights.length) * Math.PI * 2;
      const tx = 700 + Math.cos(a) * 250;
      const ty = 320 + Math.sin(a) * 100;
      const from = origins.get(r) ?? { x: 640, y: 200 };
      const img = this.add.image(from.x, from.y, tex(RIGHTS[r].icon)).setScale(0.3).setDepth(3);
      this.tweens.add({
        targets: img,
        x: tx,
        y: ty,
        scale: 0.62,
        delay: 500 + i * 180,
        duration: motion(600),
        ease: 'Back.easeOut',
        onStart: () => AudioManager.sfx('star', { index: i % 4 }),
        onComplete: () => this.effects.sparkleAt(tx, ty, 8),
      });
    });
    await this.wait(500 + rights.length * 180 + 600);
    if (!this.alive) return;
    await this.complete(this.c.done);
  }

  protected override getHint(): HintTarget | null {
    if (this.lock) return null;
    if (this.first) {
      const first = this.first;
      const pair = this.cards.find((k) => k !== first && k.id === first.id && !k.matched);
      return pair ? { kind: 'tap', x: pair.x, y: pair.y } : null;
    }
    const next = this.cards.find((k) => !k.matched && !k.up);
    return next ? { kind: 'tap', x: next.x, y: next.y } : null;
  }
}
