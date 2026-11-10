import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, FONTS, TEXT_RESOLUTION } from '@/config/theme';
import type { VoiceLine } from '@/config/levels';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import type { Tori } from './Tori';

export interface SpeechBubbleOptions {
  width?: number;
  /** Lado de la colita del globo (hacia Tori). */
  tail?: 'left' | 'right' | 'none';
  tori?: Tori;
  fontSize?: number;
}

const PAD = 26;
const BTN = 92; // botón 🔊 de 92 px (≥ 88 px)
const GAP = 16;

/**
 * Globo de diálogo de Tori con botón para repetir el audio.
 * El texto es corto y apoya a la voz; nunca la sustituye.
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly speaker: Phaser.GameObjects.Container;
  private readonly waves: Phaser.GameObjects.Graphics;
  private readonly bubbleWidth: number;
  private readonly tailSide: 'left' | 'right' | 'none';
  private readonly tori: Tori | null;
  private lines: VoiceLine[] = [];
  private token = 0;
  private alive = true;
  private wavesTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: SpeechBubbleOptions = {}) {
    super(scene, x, y);
    this.bubbleWidth = opts.width ?? 600;
    this.tailSide = opts.tail ?? 'left';
    this.tori = opts.tori ?? null;

    this.bg = scene.add.graphics();
    const size = opts.fontSize ?? 30;
    this.label = scene.add
      .text(-this.bubbleWidth / 2 + PAD, 0, '', {
        fontFamily: FONTS.body,
        fontSize: `${size}px`,
        fontStyle: '800',
        color: CSS.ink,
        lineSpacing: 2,
        resolution: TEXT_RESOLUTION,
        padding: { top: 4, bottom: 2 },
        wordWrap: { width: this.bubbleWidth - PAD * 2 - BTN - GAP, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

    this.waves = scene.add.graphics();
    this.speaker = this.buildSpeaker(scene);
    this.add([this.bg, this.label, this.speaker]);
    this.setDepth(DEPTH.ui + 10).setVisible(false);
    scene.add.existing(this);

    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.alive = false;
      this.token += 1;
    });
  }

  private buildSpeaker(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const r = BTN / 2;
    const circle = scene.add.circle(0, 0, r, COLORS.turquoise).setStrokeStyle(5, COLORS.ink);
    const icon = scene.add.graphics();
    icon.fillStyle(COLORS.ink).fillRect(-22, -9, 11, 18);
    icon.fillPoints(
      [
        { x: -12, y: -9 },
        { x: 2, y: -21 },
        { x: 2, y: 21 },
        { x: -12, y: 9 },
      ],
      true,
    );
    this.waves.lineStyle(5, COLORS.ink);
    this.waves.beginPath().arc(4, 0, 11, -0.9, 0.9).strokePath();
    this.waves.beginPath().arc(4, 0, 21, -0.9, 0.9).strokePath();

    const c = scene.add.container(this.bubbleWidth / 2 - PAD - r + 6, 0, [
      circle,
      icon,
      this.waves,
    ]);
    circle.setInteractive({ useHandCursor: true });
    circle.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      AudioManager.sfx('pop');
      scene.tweens.add({
        targets: c,
        scale: { from: 0.82, to: 1 },
        duration: motion(380),
        ease: 'Elastic.easeOut',
      });
      void this.repeat();
    });
    return c;
  }

  private layout(): number {
    const w = this.bubbleWidth;
    const h = Math.max(this.label.height + PAD * 2, BTN + 28);
    const g = this.bg;
    g.clear();
    g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 28);
    g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
    g.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);

    if (this.tailSide !== 'none') {
      const s = this.tailSide === 'left' ? -1 : 1;
      const edge = (s * w) / 2;
      const top = { x: edge - s * 6, y: h / 2 - 56 };
      const bottom = { x: edge - s * 6, y: h / 2 - 16 };
      const tip = { x: edge + s * 46, y: h / 2 + 22 };
      g.fillStyle(COLORS.white).fillTriangle(top.x, top.y, bottom.x, bottom.y, tip.x, tip.y);
      g.lineStyle(5, COLORS.ink)
        .lineBetween(edge, top.y + 2, tip.x, tip.y)
        .lineBetween(edge, bottom.y + 1, tip.x, tip.y);
    }
    return h;
  }

  private show(): void {
    if (this.visible) return;
    this.setVisible(true).setScale(0.7).setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      alpha: 1,
      duration: motion(260),
      ease: 'Back.easeOut',
    });
  }

  hide(): void {
    this.token += 1;
    this.stopTalkingFx();
    if (!this.visible) return;
    this.scene.tweens.add({
      targets: this,
      scale: 0.85,
      alpha: 0,
      duration: motion(180),
      onComplete: () => this.setVisible(false),
    });
  }

  private startTalkingFx(): void {
    this.tori?.startTalking();
    this.wavesTween?.stop();
    this.wavesTween = this.scene.tweens.add({
      targets: this.waves,
      alpha: 0.2,
      duration: 300,
      yoyo: true,
      repeat: -1,
    });
  }

  private stopTalkingFx(): void {
    this.tori?.stopTalking();
    this.wavesTween?.stop();
    this.wavesTween = null;
    this.waves.setAlpha(1);
  }

  /** Muestra y dice una o varias líneas en orden. Resuelve al terminar o si se interrumpe. */
  async say(input: VoiceLine | VoiceLine[]): Promise<void> {
    const lines = Array.isArray(input) ? input : [input];
    this.lines = lines;
    const token = ++this.token;
    this.show();
    for (const [i, line] of lines.entries()) {
      if (!this.alive || token !== this.token) return;
      this.label.setText(line.text);
      this.layout();
      if (i > 0) {
        this.scene.tweens.add({ targets: this.label, alpha: { from: 0, to: 1 }, duration: 160 });
      }
      this.startTalkingFx();
      await AudioManager.speak(line);
      if (!this.alive || token !== this.token) return;
      this.stopTalkingFx();
      if (i < lines.length - 1) await new Promise((r) => window.setTimeout(r, 250));
    }
  }

  /** Repite lo último que dijo Tori (botón 🔊). */
  repeat(): Promise<void> {
    return this.lines.length ? this.say(this.lines) : Promise.resolve();
  }
}
