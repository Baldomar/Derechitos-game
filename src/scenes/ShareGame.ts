import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { COLORS } from '@/config/theme';
import type { ShareActivity } from '@/config/rights';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import { burstHearts } from '@/components/GoalMeter';
import type { HintTarget } from '@/components/HelperHand';
import { fit, hop, RoundDots } from '@/components/Kit';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const FRIEND_Y = 330;
const PLATE_Y = 470;
const PILE_Y = 170;
/** Colores de los individuales en el modo mesa. */
const MATS = [0xffb3c9, 0x9fe0d8, 0xffe08a, 0xc9b8ff];

interface Friend {
  x: number;
  img: Phaser.GameObjects.Image;
  zone: DropZone;
  count: number;
  badge: Phaser.GameObjects.Text;
}

/**
 * Motor "reparte igual": arriba hay una canasta con cosas y abajo los amigos con su plato
 * (comida) o con su individual sobre una mesa de madera (útiles y juguetes).
 * Se arrastra cada cosa al plato de un amigo. La regla es justa: nadie puede tener más
 * que los demás (si ya tiene más, la cosa regresa y Tori explica). Al final todos tienen
 * lo mismo y se ponen felices.
 */
export default class ShareGameScene extends BaseActivity<ShareActivity> {
  protected readonly kind = 'share' as const;
  private round = 0;
  private friends: Friend[] = [];
  private items: DraggableItem[] = [];
  private layer: Phaser.GameObjects.GameObject[] = [];
  private dots!: RoundDots;

  constructor() {
    super('ShareGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.round = 0;
    this.friends = [];
    this.items = [];
    this.layer = [];
  }

  protected override buildLevel(): void {
    this.dots = new RoundDots(this, this.activity.rounds.length, 1240, 64);
    const g = this.add.graphics();
    if (this.activity.look === 'table') {
      // Mesa de madera (para útiles y juguetes): tablas, borde y patas.
      g.fillStyle(0x9a6b3f)
        .fillRoundedRect(170, 540, 34, 120, 8)
        .fillRoundedRect(1076, 540, 34, 120, 8);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(170, 540, 34, 120, 8);
      g.strokeRoundedRect(1076, 540, 34, 120, 8);
      g.fillStyle(0xd9a86c).fillRoundedRect(110, 420, 1060, 110, 22);
      g.lineStyle(2.5, 0xb07a45);
      for (let y = 446; y < 520; y += 26) g.lineBetween(130, y, 1150, y);
      g.fillStyle(COLORS.white, 0.18).fillRoundedRect(130, 428, 1020, 10, 5);
      g.fillStyle(0xb07a45).fillRoundedRect(110, 522, 1060, 26, 10);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(110, 420, 1060, 128, 22);
      g.lineStyle(3, COLORS.ink).lineBetween(112, 524, 1168, 524);
    } else {
      // Mantel de la mesa (para la comida, con platos).
      g.fillStyle(0xffe0e0).fillRoundedRect(110, 420, 1060, 120, 26);
      g.fillStyle(COLORS.coral, 0.35);
      for (let x = 140; x < 1140; x += 60) g.fillRect(x, 420, 30, 120);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(110, 420, 1060, 120, 26);
    }
    // Canasta de arriba.
    g.fillStyle(0xd9a066).fillRoundedRect(300, PILE_Y - 20, 680, 80, 28);
    g.lineStyle(5, COLORS.ink).strokeRoundedRect(300, PILE_Y - 20, 680, 80, 28);
    g.lineStyle(3, 0xb07a40);
    for (let x = 330; x < 960; x += 30) g.lineBetween(x, PILE_Y - 14, x, PILE_Y + 54);
    void this.startRound(false);
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    const r = this.activity.rounds[0];
    if (r) void this.instruct(r.question);
  }

  private async startRound(speak = true): Promise<void> {
    const a = this.activity;
    const r = a.rounds[this.round];
    if (!r) return;
    this.layer.forEach((o) => o.destroy());
    this.items.forEach((i) => i.destroy());
    this.friends.forEach((f) => f.zone.destroy());
    this.layer = [];
    this.items = [];
    this.friends = [];

    // Si en una ronda hay menos amigos, se usan los primeros.
    const per = Math.round(r.count / a.friends.length);
    const n = a.friends.length;
    const gap = n > 2 ? 340 : 440;
    a.friends.forEach((f, i) => {
      const x = 640 + (i - (n - 1) / 2) * gap;
      const img = fit(this.add.image(x, FRIEND_Y, tex(f.art)), 150, 190, 2).setDepth(2);
      this.tweens.add({
        targets: img,
        angle: { from: -2, to: 2 },
        duration: 900 + i * 120,
        yoyo: true,
        repeat: -1,
      });
      const plate = this.add.graphics().setDepth(1);
      if (a.look === 'table') {
        // Individual de color de cada amigo, con costura punteada.
        const mat = MATS[i % MATS.length] ?? COLORS.sky;
        plate.fillStyle(COLORS.ink, 0.15).fillRoundedRect(x - 112, PLATE_Y - 28, 230, 66, 16);
        plate.fillStyle(mat).fillRoundedRect(x - 115, PLATE_Y - 34, 230, 66, 16);
        plate.lineStyle(4, COLORS.ink).strokeRoundedRect(x - 115, PLATE_Y - 34, 230, 66, 16);
        plate.fillStyle(COLORS.white, 0.85);
        for (let k = x - 100; k < x + 100; k += 14) {
          plate.fillRect(k, PLATE_Y - 27, 7, 2.5).fillRect(k, PLATE_Y + 22, 7, 2.5);
        }
      } else {
        plate.fillStyle(COLORS.ink, 0.15).fillEllipse(x, PLATE_Y + 8, 230, 64);
        plate.fillStyle(COLORS.white).fillEllipse(x, PLATE_Y, 230, 64);
        plate.lineStyle(4, COLORS.ink).strokeEllipse(x, PLATE_Y, 230, 64);
        plate.lineStyle(2, 0xbfe3ff).strokeEllipse(x, PLATE_Y, 180, 40);
      }
      const name = addBody(this, x, PLATE_Y + 52, f.label, 20, {
        stroke: '#FFFFFF',
        strokeThickness: 6,
      }).setDepth(2);
      const badge = addTitle(this, x + 128, PLATE_Y - 6, '0', 30, {
        stroke: '#FFFFFF',
        strokeThickness: 7,
      }).setDepth(3);
      const slots = Array.from({ length: per }, (_, k) => ({
        x: (k - (per - 1) / 2) * Math.min(52, 180 / per),
        y: 32 - (k % 2) * 6,
      }));
      const zone = new DropZone(this, x, PLATE_Y - 40, {
        id: String(i),
        width: 240,
        height: 260,
        showOutline: false,
        slots,
        tolerance: 30,
      });
      this.layer.push(img, plate, name, badge);
      this.friends.push({ x, img, zone, count: 0, badge });
    });

    const zones = this.friends.map((f) => f.zone);
    const gapItem = Math.min(96, 620 / r.count);
    for (let k = 0; k < r.count; k++) {
      const x = 640 + (k - (r.count - 1) / 2) * gapItem;
      const img = fit(this.add.image(0, 0, tex(r.item.art)), 76, 76, 1.6);
      const item = new DraggableItem(this, x, PILE_Y + 18, {
        id: `i${k}`,
        content: [img],
        width: 88,
        height: 88,
        zones,
        placedScale: 0.7,
        onDrop: (it, zone) => this.onDrop(it, zone),
      });
      item.setDepth(4).setScale(0);
      this.tweens.add({
        targets: item,
        scale: 1,
        delay: k * 70,
        duration: motion(280),
        ease: 'Back.easeOut',
      });
      this.items.push(item);
    }
    if (speak) await this.instruct(r.question);
  }

  private onDrop(item: DraggableItem, zone: DropZone | null): DropDecision {
    if (!zone) return 'ignore';
    const f = this.friends[Number(zone.zoneId)];
    if (!f) return 'ignore';
    const min = Math.min(...this.friends.map((k) => k.count));
    if (f.count > min) {
      // Ya tiene más que otro amigo: no es justo.
      this.tweens.add({
        targets: f.img,
        angle: { from: -6, to: 6 },
        duration: motion(80),
        yoyo: true,
        repeat: 2,
        onComplete: () => f.img.setAngle(0),
      });
      this.mistakeOnce(`${this.round}`, this.activity.unfair);
      return 'reject';
    }
    f.count += 1;
    f.badge.setText(String(f.count));
    this.tweens.add({ targets: f.badge, scale: 1.4, duration: motion(120), yoyo: true });
    AudioManager.sfx('pop', { pitch: 1 + f.count * 0.1 });
    hop(this, f.img, 14);
    const left = this.items.filter((i) => !i.isPlaced && i !== item).length;
    if (left === 0) {
      this.time.delayedCall(300, () => void this.roundDone());
    } else {
      this.correct(f.x, FRIEND_Y - 120, null);
    }
    return 'accept';
  }

  private async roundDone(): Promise<void> {
    this.dots.mark(this.round);
    const last = this.round === this.activity.rounds.length - 1;
    for (const f of this.friends) {
      burstHearts(this, f.x, FRIEND_Y - 60, 5);
      hop(this, f.img, 30);
    }
    this.correct(640, 260, last ? null : undefined);
    await this.wait(1600);
    if (!this.alive) return;
    if (last) {
      await this.complete(this.activity.done);
      return;
    }
    this.round += 1;
    void this.startRound();
  }

  protected override getHint(): HintTarget | null {
    const it = this.items.find((i) => !i.isPlaced);
    if (!it || !this.friends.length) return null;
    const min = Math.min(...this.friends.map((k) => k.count));
    const f = this.friends.find((k) => k.count === min);
    if (!f) return null;
    return { kind: 'drag', from: { x: it.x, y: it.y }, to: { x: f.x, y: PLATE_Y - 10 } };
  }
}
