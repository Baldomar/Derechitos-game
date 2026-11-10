import Phaser from 'phaser';
import { TEX } from '@/core/Textures';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';

export type ToriMood = 'idle' | 'talk' | 'happy' | 'think' | 'celebrate';

const HEAD_Y = -62;
const BEAK_LOW_Y = 50;
const TAIL_ANGLE = -48;
const WING_ANGLE = 14;
const EYES: [number, number][] = [
  [-30, 4],
  [30, 4],
];

type AnyTween = Phaser.Tweens.Tween | Phaser.Tweens.TweenChain;

/**
 * Tori, el torogoz guía. Armado por piezas para animarlo:
 * - idle: respira, mueve la cola y parpadea (siempre activo).
 * - talk: mueve el pico mientras habla (se combina con los demás estados).
 * - happy / think / celebrate: animaciones breves que regresan a idle solas.
 * Nunca regaña: "think" es una inclinación de cabeza curiosa.
 */
export class Tori extends Phaser.GameObjects.Container {
  private readonly rig: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Container;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly belly: Phaser.GameObjects.Image;
  private readonly tail: Phaser.GameObjects.Image;
  private readonly wingL: Phaser.GameObjects.Image;
  private readonly wingR: Phaser.GameObjects.Image;
  private readonly eyes: Phaser.GameObjects.Image[];
  private readonly pupils: Phaser.GameObjects.Image[];
  private readonly beakLow: Phaser.GameObjects.Image;
  private readonly mouth: Phaser.GameObjects.Image;

  private moodTweens: AnyTween[] = [];
  private talkTweens: Phaser.Tweens.Tween[] = [];
  private blinkTimer: Phaser.Time.TimerEvent | null = null;
  private currentMood: ToriMood = 'idle';
  private talking = false;

  constructor(scene: Phaser.Scene, x: number, y: number, scale = 1, tappable = true) {
    super(scene, x, y);
    const img = (
      px: number,
      py: number,
      key: string,
      ox = 0.5,
      oy = 0.5,
    ): Phaser.GameObjects.Image => scene.add.image(px, py, key).setOrigin(ox, oy);

    this.tail = img(30, 92, TEX.toriTail, 0.5, 0).setAngle(TAIL_ANGLE);
    this.wingL = img(-66, -8, TEX.toriWing, 0.5, 0.08).setFlipX(true).setAngle(WING_ANGLE);
    this.wingR = img(66, -8, TEX.toriWing, 0.5, 0.08).setAngle(-WING_ANGLE);
    const feet = img(0, 128, TEX.toriFeet);
    this.torso = img(0, 40, TEX.toriBody);
    this.belly = img(0, 58, TEX.toriBelly);

    const headShape = img(0, 0, TEX.toriHead);
    const mask = img(0, 6, TEX.toriMask);
    this.eyes = EYES.map(([ex, ey]) => img(ex, ey, TEX.toriEye));
    this.pupils = EYES.map(([ex, ey]) => img(ex, ey, TEX.toriPupil));
    this.mouth = img(0, 54, TEX.toriMouth).setScale(1, 0.2);
    this.beakLow = img(0, BEAK_LOW_Y, TEX.toriBeakBottom, 0.5, 0);
    const beakTop = img(0, 22, TEX.toriBeakTop, 0.5, 0);
    this.head = scene.add.container(0, HEAD_Y, [
      headShape,
      mask,
      ...this.eyes,
      ...this.pupils,
      this.mouth,
      this.beakLow,
      beakTop,
    ]);

    this.rig = scene.add.container(0, 0, [
      this.tail,
      this.wingL,
      this.wingR,
      feet,
      this.torso,
      this.belly,
      this.head,
    ]);
    this.add(this.rig);
    this.setScale(scale);

    if (tappable) {
      // Tocar a Tori le da alegría (los niños lo intentarán siempre).
      this.setSize(230, 300).setInteractive({ useHandCursor: true });
      this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        if (this.currentMood !== 'idle') return;
        AudioManager.sfx('pop', { pitch: 1.4 });
        this.setMood('happy');
      });
    }

    scene.add.existing(this);
    this.startIdle();
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.cleanup());
  }

  get mood(): ToriMood {
    return this.talking && this.currentMood === 'idle' ? 'talk' : this.currentMood;
  }

  // ------------------------------------------------------------------ idle

  private startIdle(): void {
    this.scheduleBlink();
    if (prefersReducedMotion()) return;
    const t = this.scene.tweens;
    t.add({
      targets: [this.torso, this.belly],
      scaleY: 1.035,
      scaleX: 0.99,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    t.add({
      targets: this.head,
      y: HEAD_Y - 4,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    t.add({
      targets: this.tail,
      angle: TAIL_ANGLE + 6,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private scheduleBlink(): void {
    this.blinkTimer = this.scene.time.delayedCall(Phaser.Math.Between(1800, 4500), () => {
      this.blink();
      this.scheduleBlink();
    });
  }

  blink(): void {
    this.scene.tweens.add({
      targets: [...this.eyes, ...this.pupils],
      scaleY: 0.1,
      duration: 70,
      yoyo: true,
    });
  }

  // ------------------------------------------------------------------ talk

  startTalking(): void {
    if (this.talking) return;
    this.talking = true;
    const opts = { duration: 110, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' };
    this.talkTweens = [
      this.scene.tweens.add({ targets: this.beakLow, y: BEAK_LOW_Y + 9, ...opts }),
      this.scene.tweens.add({ targets: this.mouth, scaleY: 1, ...opts }),
    ];
  }

  stopTalking(): void {
    if (!this.talking) return;
    this.talking = false;
    this.talkTweens.forEach((tw) => tw.stop());
    this.talkTweens = [];
    this.beakLow.y = BEAK_LOW_Y;
    this.mouth.setScale(1, 0.2);
  }

  // ------------------------------------------------------------------ moods

  setMood(mood: ToriMood): this {
    this.clearMood();
    this.currentMood = mood;
    switch (mood) {
      case 'idle':
        break;
      case 'talk':
        this.startTalking();
        this.currentMood = 'idle';
        break;
      case 'happy':
        this.jump(1);
        this.flap(2);
        break;
      case 'think':
        this.think();
        break;
      case 'celebrate':
        this.jump(3);
        this.flap(8);
        break;
    }
    return this;
  }

  private backToIdle = (): void => {
    this.clearMood();
    this.currentMood = 'idle';
  };

  private clearMood(): void {
    this.moodTweens.forEach((tw) => tw.stop());
    this.moodTweens = [];
    this.rig.setPosition(0, 0).setScale(1).setAngle(0);
    this.head.setAngle(0);
    this.wingL.setAngle(WING_ANGLE);
    this.wingR.setAngle(-WING_ANGLE);
    this.pupils.forEach((p, i) => p.setPosition(EYES[i]?.[0] ?? 0, EYES[i]?.[1] ?? 0));
  }

  /** Salto con squash & stretch. */
  private jump(times: number): void {
    const height = prefersReducedMotion() ? -8 : -46;
    const single = [
      { scaleX: 1.12, scaleY: 0.86, duration: motion(90), ease: 'Quad.easeOut' },
      { y: height, scaleX: 0.92, scaleY: 1.1, duration: motion(220), ease: 'Quad.easeOut' },
      { y: 0, scaleX: 1, scaleY: 1, duration: motion(200), ease: 'Quad.easeIn' },
      { scaleX: 1.1, scaleY: 0.9, duration: motion(80), yoyo: true, ease: 'Quad.easeOut' },
    ];
    const tweens = Array.from({ length: times }, () => single).flat();
    this.moodTweens.push(
      this.scene.tweens.chain({ targets: this.rig, tweens, onComplete: this.backToIdle }),
    );
  }

  /** Aleteo. */
  private flap(times: number): void {
    if (prefersReducedMotion()) return;
    this.moodTweens.push(
      this.scene.tweens.add({
        targets: this.wingL,
        angle: 70,
        duration: 90,
        yoyo: true,
        repeat: times - 1,
      }),
      this.scene.tweens.add({
        targets: this.wingR,
        angle: -70,
        duration: 90,
        yoyo: true,
        repeat: times - 1,
      }),
    );
  }

  /** Inclina la cabeza con curiosidad y se toca la "barbilla" con el ala. */
  private think(): void {
    const hold = 1500;
    this.moodTweens.push(
      this.scene.tweens.add({
        targets: this.head,
        angle: -14,
        duration: motion(280),
        ease: 'Back.easeOut',
        yoyo: true,
        hold,
        onComplete: this.backToIdle,
      }),
      this.scene.tweens.add({
        targets: this.wingR,
        angle: -95,
        duration: motion(260),
        yoyo: true,
        hold,
      }),
      this.scene.tweens.add({
        targets: this.pupils,
        x: '-=4',
        y: '-=5',
        duration: motion(200),
        yoyo: true,
        hold: hold + 80,
      }),
    );
  }

  /** Saluda agitando el ala (pantalla de título). */
  wave(): void {
    if (this.currentMood !== 'idle') return;
    this.clearMood();
    this.moodTweens.push(
      this.scene.tweens.chain({
        targets: this.wingR,
        tweens: [
          { angle: -120, duration: motion(220), ease: 'Back.easeOut' },
          { angle: -85, duration: motion(160), yoyo: true, repeat: 2, ease: 'Sine.easeInOut' },
          { angle: -WING_ANGLE, duration: motion(250), ease: 'Quad.easeIn' },
        ],
        onComplete: this.backToIdle,
      }),
    );
  }

  /** Mira hacia un punto (las pupilas se desplazan hasta 6 px). */
  lookAt(x: number, y: number): void {
    const hx = this.x;
    const hy = this.y + HEAD_Y * this.scaleY;
    const angle = Math.atan2(y - hy, x - hx);
    this.pupils.forEach((p, i) => {
      const [ex, ey] = EYES[i] ?? [0, 0];
      this.scene.tweens.add({
        targets: p,
        x: ex + Math.cos(angle) * 6,
        y: ey + Math.sin(angle) * 6,
        duration: 180,
      });
    });
  }

  private cleanup(): void {
    this.blinkTimer?.remove();
    this.moodTweens.forEach((tw) => tw.stop());
    this.talkTweens.forEach((tw) => tw.stop());
    if (this.scene) {
      this.scene.tweens.killTweensOf([
        this.rig,
        this.head,
        this.torso,
        this.belly,
        this.tail,
        this.wingL,
        this.wingR,
        ...this.eyes,
        ...this.pupils,
      ]);
    }
  }
}
