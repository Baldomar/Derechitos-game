import Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import type { GiveActivity } from '@/config/rights';
import { tex, type ArtKey } from '@/art/Art';
import { DraggableItem, type DropDecision } from '@/components/DraggableItem';
import { DropZone } from '@/components/DropZone';
import { burstHearts } from '@/components/GoalMeter';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { motion } from '@/core/Device';
import { BaseActivity, fitImage } from './BaseActivity';

const FRIEND_Y = 300;
const TRAY_Y = 532;
const INK = COLORS.ink;

type Friend = GiveActivity['friends'][number];

interface FriendView {
  def: Friend;
  zone: DropZone;
  body: Phaser.GameObjects.Image;
  thought: Phaser.GameObjects.Container;
  idle: Phaser.Tweens.Tween;
  served: boolean;
}

/**
 * Motor "¿qué necesita?": cada amigo tiene un globito de pensamiento con la SOMBRA de lo
 * que necesita (sed → agua, fiebre → termómetro…). El niño arrastra la cosa correcta hasta
 * el amigo, que salta de alegría y suelta corazoncitos. Enseña empatía: mirar al otro.
 */
export default class GiveGameScene extends BaseActivity<GiveActivity> {
  protected readonly kind = 'give' as const;
  private friends: FriendView[] = [];
  private items: DraggableItem[] = [];
  private counted = new Set<string>();

  constructor() {
    super('GiveGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.friends = [];
    this.items = [];
    this.counted = new Set();
  }

  protected override buildLevel(): void {
    const a = this.activity;
    const n = a.friends.length;
    const gap = Math.min(270, 1040 / n);

    this.friends = a.friends.map((f, i) => {
      const x = 640 + (i - (n - 1) / 2) * gap;
      const zone = new DropZone(this, x, FRIEND_Y + 20, {
        id: f.id,
        width: gap - 40,
        height: 250,
        slots: [{ x: 44, y: 70 }],
        tolerance: 16,
      });
      const body = fitImage(this.add.image(x, FRIEND_Y, tex(f.art)), 150, 160, 2).setDepth(1);
      addBody(this, x, FRIEND_Y + 118, f.label, 19, { wrap: gap - 50 }).setDepth(1);
      // Tristecito: se balancea despacio esperando ayuda.
      const idle = this.tweens.add({
        targets: body,
        angle: { from: -3, to: 3 },
        duration: 1100 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      const thought = this.makeThought(x + 52, FRIEND_Y - 130, f.wants.art);
      return { def: f, zone, body, thought, idle, served: false };
    });

    const zones = this.friends.map((f) => f.zone);
    const things = Phaser.Utils.Array.Shuffle([
      ...a.friends.map((f) => ({ key: `want:${f.id}`, thing: f.wants })),
      ...a.extras.map((t, i) => ({ key: `extra:${i}`, thing: t })),
    ]);
    const tgap = Math.min(150, 1060 / things.length);
    things.forEach(({ key, thing }, i) => {
      const x = 640 + (i - (things.length - 1) / 2) * tgap;
      const img = fitImage(this.add.image(0, -8, tex(thing.art)), 84, 76, 2);
      const label = addBody(this, 0, 46, thing.label, 16, {
        stroke: '#FFFFFF',
        strokeThickness: 5,
      });
      const item = new DraggableItem(this, x, TRAY_Y, {
        id: key,
        content: [img, label],
        width: 116,
        height: 116,
        zones,
        placedScale: 0.62,
        onDrop: (d, zone) => this.onDrop(d, zone, label),
      });
      item.setDepth(3).setScale(0);
      this.tweens.add({
        targets: item,
        scale: 1,
        delay: 300 + i * 80,
        duration: motion(320),
        ease: 'Back.easeOut',
      });
      this.items.push(item);
    });
  }

  /** Globito de pensamiento (nube + burbujitas) con la sombra de lo que necesita. */
  private makeThought(x: number, y: number, art: ArtKey): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(COLORS.white, 1).lineStyle(4, INK, 1);
    g.fillCircle(-46, 66, 9).strokeCircle(-46, 66, 9);
    g.fillCircle(-30, 50, 13).strokeCircle(-30, 50, 13);
    g.fillEllipse(0, 0, 120, 92).strokeEllipse(0, 0, 120, 92);
    const sh = fitImage(this.add.image(0, 0, tex(art)), 70, 60, 2);
    sh.setTintFill(INK).setAlpha(0.45);
    const q = addBody(this, 44, -30, '?', 30, { color: '#8B6CF6' });
    const c = this.add.container(x, y, [g, sh, q]).setDepth(2);
    this.tweens.add({
      targets: c,
      y: y - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: q,
      scale: 1.25,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return c;
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  private onDrop(
    item: DraggableItem,
    zone: DropZone | null,
    label: Phaser.GameObjects.Text,
  ): DropDecision {
    if (!zone) return 'ignore';
    const fv = this.friends.find((f) => f.zone === zone);
    if (!fv || fv.served) return 'ignore';

    if (item.itemId !== `want:${fv.def.id}`) {
      // No es lo que necesita: el amigo dice "no" con la cabeza y Tori da la pista.
      const extraIdx = item.itemId.startsWith('extra:') ? Number(item.itemId.slice(6)) : -1;
      const hint = this.activity.extras[extraIdx]?.hint ?? fv.def.hint;
      const key = `${fv.def.id}/${item.itemId}`;
      if (this.counted.has(key)) void this.say(hint);
      else {
        this.counted.add(key);
        this.mistake(hint);
      }
      this.tweens.chain({
        targets: fv.body,
        tweens: [
          { angle: -10, duration: motion(100) },
          { angle: 10, duration: motion(120) },
          { angle: 0, duration: motion(100) },
        ],
      });
      return 'reject';
    }

    fv.served = true;
    label.setVisible(false);
    this.celebrateFriend(fv);
    const last = this.friends.every((f) => f.served);
    this.correct(fv.body.x, fv.body.y - 60, last ? null : undefined);
    if (last) this.time.delayedCall(900, () => void this.complete(this.activity.done));
    return 'accept';
  }

  private celebrateFriend(fv: FriendView): void {
    fv.idle.stop();
    fv.body.setAngle(0);
    // El globito se transforma en corazones.
    this.tweens.killTweensOf(fv.thought);
    this.tweens.add({
      targets: fv.thought,
      scale: 0,
      duration: motion(220),
      ease: 'Back.easeIn',
      onComplete: () => fv.thought.destroy(),
    });
    burstHearts(this, fv.body.x, fv.body.y - 70, 6);
    // ¡Salta de alegría!
    const y = fv.body.y;
    this.tweens.chain({
      targets: fv.body,
      tweens: [
        { y: y - 36, duration: motion(180), ease: 'Quad.easeOut' },
        { y, duration: motion(180), ease: 'Quad.easeIn' },
        { y: y - 20, duration: motion(140), ease: 'Quad.easeOut' },
        { y, duration: motion(140), ease: 'Quad.easeIn' },
      ],
    });
    // Después queda contento, con un vaivén alegre.
    this.time.delayedCall(800, () => {
      if (!fv.body.active) return;
      this.tweens.add({
        targets: fv.body,
        scaleY: fv.body.scaleY * 1.04,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  protected override getHint(): HintTarget | null {
    const fv = this.friends.find((f) => !f.served);
    const item = fv ? this.items.find((i) => i.itemId === `want:${fv.def.id}`) : undefined;
    return fv && item
      ? { kind: 'drag', from: { x: item.x, y: item.y }, to: { x: fv.zone.x, y: fv.zone.y } }
      : null;
  }
}
