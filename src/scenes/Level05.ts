import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import type { ParkContent } from '@/config/levels';
import { artImage, type ArtKey } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseLevel } from './BaseLevel';
import { setPageBackground } from '@/core/PageBackground';

const LOW = 476; // suelo de afuera
const HIGH = 386; // suelo del parque (más alto: hay un escalón)
const STEP_X = 640;
const RAMP = { x: 560, y: (LOW + HIGH) / 2 };
const PARK_SPOTS = [780, 900, 1020, 1140];

/**
 * Nivel 5 — Parque para todos (igualdad y no discriminación).
 * 1) Poner una rampa para que Sofía (silla de ruedas) pueda entrar. 2) Invitar a todos tocándolos.
 */
export default class Level05Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'nina-silla',
    'nino-a',
    'nina-b',
    'nino-c',
    'rampa',
    'escalera',
    'pelota',
    'arbol',
    'izote',
  ];
  private c!: ParkContent;
  private stage: 'ramp' | 'invite' | 'done' = 'ramp';
  private options: DraggableItem[] = [];
  private kids = new Map<string, Phaser.GameObjects.Container>();
  private invited = 0;
  private spot = 0;

  constructor() {
    super('Level05');
  }

  override init(data?: unknown): void {
    super.init(data);
    this.stage = 'ramp';
    this.options = [];
    this.kids = new Map();
    this.invited = 0;
    this.spot = 0;
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('park');
    // Afuera (izquierda) el camino está más abajo que el parque (derecha).
    setPageBackground(
      this,
      { top: COLORS.sky, bottom: COLORS.sand, split: LOW },
      { top: COLORS.sky, bottom: COLORS.grass, split: HIGH },
    );
    const g = this.add.graphics();
    // Afuera (camino) y parque elevado con escalón.
    g.fillStyle(COLORS.sand).fillRect(0, LOW, STEP_X, GAME_HEIGHT - LOW);
    g.fillStyle(COLORS.grass).fillRect(STEP_X, HIGH, GAME_WIDTH - STEP_X, GAME_HEIGHT - HIGH);
    g.fillStyle(0xb07a45).fillRect(STEP_X - 6, HIGH, 12, LOW - HIGH);
    g.lineStyle(5, COLORS.ink)
      .lineBetween(STEP_X, HIGH, GAME_WIDTH, HIGH)
      .lineBetween(STEP_X, HIGH, STEP_X, LOW)
      .lineBetween(0, LOW, STEP_X, LOW);
    // Juegos del parque: resbaladero y columpio.
    g.lineStyle(8, COLORS.ink);
    g.lineBetween(1110, HIGH, 1110, 230).lineBetween(1170, HIGH, 1170, 230);
    g.fillStyle(COLORS.coral).fillRect(1104, 226, 72, 14);
    g.lineStyle(14, COLORS.sun).lineBetween(1110, 236, 1010, HIGH - 8);
    g.lineStyle(6, COLORS.ink)
      .lineBetween(830, HIGH, 870, 220)
      .lineBetween(990, HIGH, 950, 220)
      .lineBetween(860, 222, 960, 222);
    g.lineStyle(3, COLORS.ink).lineBetween(895, 222, 895, 320).lineBetween(925, 222, 925, 320);
    g.fillStyle(COLORS.grape).fillRect(885, 318, 50, 10);
    artImage(this, 1220, HIGH - 80, 'arbol').setScale(0.8);
    artImage(this, 720, HIGH - 60, 'izote').setScale(0.8);
    addBody(this, 960, 160, 'Parque', 30, { stroke: '#FFFFFF', strokeThickness: 6 });

    // Niños esperando afuera.
    const xs = [190, 300, 410, 540];
    this.c.kids.forEach((k, i) => {
      const img = artImage(this, 0, 0, k.art).setScale(0.8);
      const label = addBody(this, 0, img.displayHeight / 2 + 12, k.label, 20, {
        stroke: '#FFFFFF',
        strokeThickness: 5,
      });
      const kid = this.add
        .container(xs[i] ?? 200, LOW - img.displayHeight / 2, [img, label])
        .setDepth(2);
      kid.setSize(Math.max(100, img.displayWidth), img.displayHeight);
      this.kids.set(k.id, kid);
    });

    // Opciones para el escalón.
    const zone = new DropZone(this, RAMP.x, RAMP.y, {
      id: 'escalon',
      width: 170,
      height: 110,
      tolerance: 40,
    });
    this.tweens.add({ targets: zone, alpha: 0.45, duration: 650, yoyo: true, repeat: -1 });
    this.c.options.forEach((o, i) => {
      // La rampa va centrada (sin desplazar) para que encaje exacto en el escalón.
      const img = artImage(this, 0, o.id === 'rampa' ? 0 : -6, o.art);
      img.setScale(Math.min(0.8, 110 / img.height));
      const label = addBody(this, 0, 56, o.label, 22);
      const item = new DraggableItem(this, 200 + i * 175, 190, {
        id: o.id,
        content: [img, label],
        width: 150,
        height: 130,
        zones: [zone],
        onDrop: (it, z) => this.onOptionDrop(it, z, o, label),
        ...(o.id === 'rampa'
          ? { placedScale: { x: 1, y: (LOW - HIGH) / 80 }, growOnDrag: true }
          : {}),
      });
      item.setDepth(3);
      this.options.push(item);
    });
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    void this.instruct(this.c.rampQuestion);
  }

  private onOptionDrop(
    item: DraggableItem,
    zone: DropZone | null,
    o: ParkContent['options'][number],
    label: Phaser.GameObjects.Text,
  ): DropDecision {
    if (!zone || this.stage !== 'ramp') return 'ignore';
    if (!o.correct) {
      if (o.hint) this.mistake(o.hint);
      return 'reject';
    }
    this.stage = 'invite';
    label.setVisible(false);
    // Se quita después: el componente aún usa la zona para acomodar la rampa.
    this.time.delayedCall(0, () => zone.destroy());
    // La rampa se acomoda justo en el escalón.
    // La imagen mide 80 px de alto (escala 0.8): se estira para cubrir el escalón de 90 px.
    this.time.delayedCall(10, () => item.setDepth(1));
    this.correct(RAMP.x, RAMP.y - 80, null);
    this.options
      .filter((op) => op !== item)
      .forEach((op) =>
        this.tweens.add({
          targets: op,
          alpha: 0,
          scale: 0.5,
          duration: 300,
          onComplete: () => op.destroy(),
        }),
      );
    void this.rollSofia();
    return 'accept';
  }

  private async rollSofia(): Promise<void> {
    const sofiaDef = this.c.kids.find((k) => k.wheelchair);
    const sofia = sofiaDef ? this.kids.get(sofiaDef.id) : undefined;
    await this.say(this.c.rampDone);
    if (!this.alive || !sofia) return;
    const h = sofia.height;
    const target = PARK_SPOTS[this.spot++] ?? 800;
    this.tweens.chain({
      targets: sofia,
      tweens: [
        { x: RAMP.x - 60, duration: motion(400) },
        { x: STEP_X + 20, y: HIGH - h / 2, duration: motion(900), ease: 'Sine.easeInOut' },
        { x: target, duration: motion(700) },
      ],
      onComplete: () => {
        AudioManager.sfx('success');
        this.effects.sparkleAt(target, HIGH - h / 2, 14);
      },
    });
    this.invited += 1;
    await this.wait(1600);
    if (!this.alive) return;
    // Ahora se puede invitar a los demás tocándolos.
    for (const [id, kid] of this.kids) {
      if (id === sofiaDef?.id) continue;
      kid.setInteractive({ useHandCursor: true });
      kid.once(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.invite(kid));
      this.tweens.add({ targets: kid, y: kid.y - 10, duration: 300, yoyo: true, repeat: 1 });
    }
    await this.instruct(this.c.invite);
  }

  private invite(kid: Phaser.GameObjects.Container): void {
    kid.disableInteractive();
    const target = PARK_SPOTS[this.spot++] ?? 1000;
    const y = HIGH - kid.height / 2;
    this.tweens.chain({
      targets: kid,
      tweens: [
        { y: kid.y - 90, x: (kid.x + target) / 2, duration: motion(350), ease: 'Quad.easeOut' },
        { y, x: target, duration: motion(350), ease: 'Quad.easeIn' },
      ],
    });
    this.invited += 1;
    const last = this.invited === this.kids.size;
    this.correct(target, y - 90, last ? null : undefined);
    if (last) {
      this.stage = 'done';
      this.time.delayedCall(800, () => {
        [...this.kids.values()].forEach((k, i) =>
          this.tweens.add({
            targets: k,
            y: k.y - 30,
            duration: 250,
            yoyo: true,
            repeat: 3,
            delay: i * 90,
          }),
        );
        void this.complete(this.c.done);
      });
    }
  }

  protected override getHint(): HintTarget | null {
    if (this.stage === 'ramp') {
      const ramp = this.options.find((o) => o.itemId === 'rampa');
      return ramp ? { kind: 'drag', from: { x: ramp.x, y: ramp.y }, to: RAMP } : null;
    }
    if (this.stage === 'invite') {
      for (const kid of this.kids.values()) {
        if (kid.input?.enabled) return { kind: 'tap', x: kid.x, y: kid.y };
      }
    }
    return null;
  }
}
