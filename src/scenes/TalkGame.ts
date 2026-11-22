import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { COLORS, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import type { TalkActivity } from '@/config/rights';
import type { VoiceLine } from '@/config/levels';
import type { HintTarget } from '@/components/HelperHand';
import { fit, RoundDots } from '@/components/Kit';
import { isPuppet, Puppet } from '@/components/Puppet';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const INK = COLORS.ink;
const INK_TEXT = '#2B2848';
const FAR = 2000;
/** Unión pared / piso del salón y línea de los pies de los niños. */
const FLOOR_Y = 420;
const FEET = 552;
const KID_X = [210, 400, 590, 780];
const KID_SCALE = 1.15;
/** Altura aproximada del muñeco ya escalado (para globos y micrófono). */
const KID_H = 172;
const BOARD = { x: 495, y: 172, w: 620, h: 150 };
const PANEL_X = 1090;
/** Cuántas interrupciones hay que calmar en el nivel 2. */
const CALM_GOAL = 4;
const SPEAKER = 1;
const PLAYER = 0;

type Stage = 'banner' | 'pick' | 'listen' | 'choose' | 'busy' | 'done';

interface Card {
  c: Phaser.GameObjects.Container;
  good: boolean;
}

/**
 * "La ronda de ideas" (Derecho a expresar sus opiniones): tres niveles en el salón.
 * 1) Levanta la mano: se da el micrófono al amigo que pide la palabra.
 * 2) Escucho sin interrumpir: quien grita "¡Yo, yo!" se calma y espera su turno.
 * 3) Mi turno de hablar: escoger cómo decir lo que pienso, con confianza y respeto.
 */
export default class TalkGameScene extends BaseActivity<TalkActivity> {
  protected readonly kind = 'talk' as const;
  private kids: Phaser.GameObjects.Container[] = [];
  private level = 0;
  private stage: Stage = 'banner';
  private dots!: RoundDots;
  private boardText!: Phaser.GameObjects.Text;
  private boardBits: Phaser.GameObjects.GameObject[] = [];
  private mic!: Phaser.GameObjects.Image;
  private bubbles = new Map<number, Phaser.GameObjects.Container>();
  private wiggle: Phaser.Tweens.Tween | null = null;
  // Nivel 1
  private order: number[] = [];
  private turn = 0;
  private raised = -1;
  // Nivel 2
  private interrupter = -1;
  private lastInterrupter = -1;
  private calmed = 0;
  private shoutTween: Phaser.Tweens.Tween | null = null;
  private missTimer: Phaser.Time.TimerEvent | null = null;
  private pips: Phaser.GameObjects.Arc[] = [];
  // Nivel 3
  private round = 0;
  private cards: Card[] = [];
  private youTag: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('TalkGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.kids = [];
    this.level = 0;
    this.stage = 'banner';
    this.boardBits = [];
    this.bubbles = new Map();
    this.wiggle = null;
    this.order = [];
    this.turn = 0;
    this.raised = -1;
    this.interrupter = -1;
    this.lastInterrupter = -1;
    this.calmed = 0;
    this.shoutTween = null;
    this.missTimer = null;
    this.pips = [];
    this.round = 0;
    this.cards = [];
    this.youTag = null;
  }

  protected override buildLevel(): void {
    this.dots = new RoundDots(this, 3, 1240, 64);
    this.buildRoom();
    this.buildBoard();
    this.makeMicTexture();
    this.mic = this.add.image(BOARD.x, -80, 'talk-mic').setDepth(16).setVisible(false);
    this.activity.kids.forEach((key, i) => {
      const x = KID_X[i] ?? 400;
      const kid = isPuppet(key)
        ? new Puppet(this, x, FEET, key).setScale(KID_SCALE).setDepth(8)
        : this.add.container(x, FEET, [
            fit(this.add.image(0, 0, tex(key)), 110, 170, 2).setOrigin(0.5, 1),
          ]);
      kid.setDepth(8);
      kid.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-60, -190, 120, 196),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
      kid.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tapKid(i));
      // Sombra a los pies.
      this.add.ellipse(x, FEET + 2, 110, 18, INK, 0.15).setDepth(7);
      this.kids.push(kid);
    });
  }

  private pup(i: number): Puppet | null {
    const k = this.kids[i];
    return k instanceof Puppet ? k : null;
  }

  // ------------------------------------------------------------------ escenario

  private buildRoom(): void {
    const g = this.add.graphics().setDepth(0.2);
    const L = -FAR;
    const W = GAME_WIDTH + FAR * 2;
    // Pared y zócalo.
    g.fillStyle(0xfdf0d5).fillRect(L, -FAR, W, FAR + FLOOR_Y);
    g.fillStyle(0xf3c98b).fillRect(L, FLOOR_Y - 56, W, 56);
    g.fillStyle(0xe2b06f).fillRect(L, FLOOR_Y - 60, W, 6);
    // Piso de madera.
    g.fillStyle(0xd9a066).fillRect(L, FLOOR_Y, W, GAME_HEIGHT - FLOOR_Y + FAR);
    g.lineStyle(2, 0xc28a52);
    for (let y = FLOOR_Y + 40; y < GAME_HEIGHT + 200; y += 44) g.lineBetween(L, y, L + W, y);
    for (let x = -FAR; x < GAME_WIDTH + FAR; x += 160) {
      for (let y = FLOOR_Y; y < GAME_HEIGHT + 200; y += 88) {
        g.lineBetween(x, y, x, y + 44);
        g.lineBetween(x + 80, y + 44, x + 80, y + 88);
      }
    }
    g.lineStyle(4, INK).lineBetween(L, FLOOR_Y, L + W, FLOOR_Y);
    // Ventanas.
    for (const wx of [1090, -110, 1390]) {
      g.fillStyle(0xbfe6ff).fillRoundedRect(wx - 80, 150, 160, 150, 12);
      g.fillStyle(COLORS.white, 0.7).fillRoundedRect(wx - 66, 162, 34, 60, 8);
      g.lineStyle(8, 0x9a6a3a).strokeRoundedRect(wx - 80, 150, 160, 150, 12);
      g.lineStyle(6, 0x9a6a3a)
        .lineBetween(wx, 150, wx, 300)
        .lineBetween(wx - 80, 225, wx + 80, 225);
      g.lineStyle(3, INK).strokeRoundedRect(wx - 84, 146, 168, 158, 14);
    }
    // Banderines de colores sobre la pizarra.
    const flags = [COLORS.pink, COLORS.sun, COLORS.turquoise, COLORS.grass, COLORS.grape];
    const x0 = BOARD.x - 340;
    g.lineStyle(3, INK).lineBetween(x0, 92, x0 + 680, 92);
    for (let k = 0; k < 14; k++) {
      const fx = x0 + 18 + k * 47;
      g.fillStyle(flags[k % flags.length] ?? COLORS.sun);
      g.fillTriangle(fx - 16, 92, fx + 16, 92, fx, 120);
      g.lineStyle(2.5, INK).strokeTriangle(fx - 16, 92, fx + 16, 92, fx, 120);
    }
  }

  private buildBoard(): void {
    const { x, y, w, h } = BOARD;
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(INK, 0.2).fillRoundedRect(x - w / 2 + 6, y - h / 2 + 8, w, h, 16);
    g.fillStyle(0x9a6a3a).fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
    g.fillStyle(0x2f6b4f).fillRoundedRect(x - w / 2 + 12, y - h / 2 + 12, w - 24, h - 24, 8);
    g.fillStyle(COLORS.white, 0.06).fillRoundedRect(x - w / 2 + 24, y - h / 2 + 20, w / 2, 30, 8);
    g.lineStyle(4, INK).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
    // Repisa con gises.
    g.fillStyle(0x8a5a2e).fillRect(x - w / 2 + 30, y + h / 2 - 4, w - 60, 12);
    g.lineStyle(3, INK).strokeRect(x - w / 2 + 30, y + h / 2 - 4, w - 60, 12);
    g.fillStyle(COLORS.white).fillRect(x + 150, y + h / 2 - 10, 26, 7);
    g.fillStyle(COLORS.pink).fillRect(x + 190, y + h / 2 - 10, 22, 7);
    this.boardText = addTitle(this, x, y - 28, '', 34, { color: '#FFFFFF' }).setDepth(2);
  }

  private setBoard(text: string): void {
    this.boardText.setText(text);
    this.boardBits.forEach((b) => b.destroy());
    this.boardBits = [];
    this.pips = [];
  }

  /** Micrófono dibujado una sola vez como textura. */
  private makeMicTexture(): void {
    if (this.textures.exists('talk-mic')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x3b4250).fillRoundedRect(11, 24, 12, 34, 5);
    g.lineStyle(3, INK).strokeRoundedRect(11, 24, 12, 34, 5);
    g.fillStyle(COLORS.pink).fillRect(9, 22, 16, 7);
    g.lineStyle(3, INK).strokeRect(9, 22, 16, 7);
    g.fillStyle(0xc9ced8).fillCircle(17, 14, 13);
    g.lineStyle(2, 0x8d94a3);
    for (const d of [-6, 0, 6]) g.lineBetween(17 + d, 4, 17 + d, 24);
    g.lineBetween(5, 14, 29, 14);
    g.lineStyle(3, INK).strokeCircle(17, 14, 13);
    g.generateTexture('talk-mic', 34, 62);
    g.destroy();
  }

  /** Lleva el micrófono (con un arco) a la mano de un niño. */
  private flyMic(i: number): Promise<void> {
    const kid = this.kids[i];
    if (!kid) return Promise.resolve();
    const tx = kid.x + 34;
    const ty = FEET - KID_H * 0.55;
    this.mic.setVisible(true);
    if (this.mic.y < 0) this.mic.setPosition(BOARD.x, BOARD.y + 90);
    const sx = this.mic.x;
    const sy = this.mic.y;
    AudioManager.sfx('pop', { pitch: 1.3 });
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: motion(520),
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          this.mic.setPosition(sx + (tx - sx) * t, sy + (ty - sy) * t - Math.sin(t * Math.PI) * 90);
          this.mic.setAngle(t * 360);
        },
        onComplete: () => {
          this.mic.setAngle(-12);
          this.effects.sparkleAt(tx, ty, 6);
          resolve();
        },
      });
    });
  }

  /** Globo de diálogo sobre un niño, con un dibujo o un texto. */
  private kidBubble(
    i: number,
    content: { art?: Parameters<typeof tex>[0]; text?: string; dots?: boolean },
    tone: 'white' | 'red' = 'white',
  ): Phaser.GameObjects.Container {
    this.bubbles.get(i)?.destroy();
    const kid = this.kids[i];
    const x = kid?.x ?? 400;
    const y = FEET - KID_H - 58;
    const w = content.text ? 128 : 104;
    const h = 78;
    const fill = tone === 'red' ? 0xffd9d9 : COLORS.white;
    const g = this.add.graphics();
    g.fillStyle(INK, 0.18).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 22);
    g.fillStyle(fill).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.fillTriangle(-12, h / 2 - 2, 12, h / 2 - 2, -2, h / 2 + 18);
    g.lineStyle(4, tone === 'red' ? 0xd94848 : INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    g.lineBetween(-12, h / 2, -2, h / 2 + 18).lineBetween(-2, h / 2 + 18, 12, h / 2);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    if (content.art) parts.push(fit(this.add.image(0, 0, tex(content.art)), 62, 58, 2));
    if (content.text) {
      parts.push(
        addTitle(this, 0, 0, content.text, 26, {
          color: tone === 'red' ? '#C23434' : INK_TEXT,
        }),
      );
    }
    if (content.dots) {
      [-20, 0, 20].forEach((dx, k) => {
        const d = this.add.circle(dx, 0, 7, INK);
        parts.push(d);
        if (!prefersReducedMotion()) {
          this.tweens.add({
            targets: d,
            y: -8,
            duration: 260,
            yoyo: true,
            repeat: -1,
            delay: k * 120,
          });
        }
      });
    }
    const c = this.add.container(x, y, parts).setDepth(15).setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: motion(260), ease: 'Back.easeOut' });
    this.bubbles.set(i, c);
    return c;
  }

  private clearBubble(i: number): void {
    const b = this.bubbles.get(i);
    if (!b) return;
    this.bubbles.delete(i);
    this.tweens.add({
      targets: b,
      scale: 0,
      duration: motion(180),
      onComplete: () => b.destroy(),
    });
  }

  private clearAllBubbles(): void {
    [...this.bubbles.keys()].forEach((i) => this.clearBubble(i));
  }

  /** Todos saltan de gusto (aplauso). */
  private cheer(except = -1): void {
    this.kids.forEach((k, i) => {
      if (i === except) return;
      const p = this.pup(i);
      this.time.delayedCall(i * 70, () => {
        p?.setMode('jump');
        this.tweens.add({
          targets: k,
          y: FEET - 22,
          duration: 200,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            k.y = FEET;
            p?.setMode('idle');
          },
        });
      });
    });
  }

  private stopWiggle(): void {
    this.wiggle?.stop();
    this.wiggle = null;
    this.kids.forEach((k) => k.setAngle(0));
  }

  // ------------------------------------------------------------------ flujo de niveles

  protected override onIntroDone(): void {
    this.enableIdleHint();
    void this.startLevel(0);
  }

  private async banner(n: number, title: string): Promise<void> {
    const w = 560;
    const g = this.add.graphics();
    g.fillStyle(INK, 0.25).fillRoundedRect(-w / 2 + 6, -70, w, 150, 34);
    g.fillStyle(COLORS.sun).fillRoundedRect(-w / 2, -78, w, 150, 34);
    g.lineStyle(6, INK).strokeRoundedRect(-w / 2, -78, w, 150, 34);
    const t1 = addTitle(this, 0, -38, `Nivel ${n}`, 30, { color: INK_TEXT });
    const t2 = addTitle(this, 0, 18, title, 44, { color: INK_TEXT });
    const b = this.add
      .container(640, 330, [g, t1, t2])
      .setDepth(DEPTH.ui + 2)
      .setScale(0);
    AudioManager.sfx('star', { index: n - 1 });
    this.tweens.add({ targets: b, scale: 1, duration: motion(420), ease: 'Back.easeOut' });
    await this.wait(1700);
    this.tweens.add({
      targets: b,
      scale: 0,
      alpha: 0,
      duration: motion(280),
      onComplete: () => b.destroy(),
    });
    await this.wait(300);
  }

  private async startLevel(n: number): Promise<void> {
    if (!this.alive) return;
    this.level = n;
    this.stage = 'banner';
    this.clearAllBubbles();
    this.stopWiggle();
    this.kids.forEach((k, i) => {
      k.setPosition(KID_X[i] ?? 400, FEET).setAlpha(1);
      this.pup(i)?.raiseHand(false).setMode('idle');
    });
    this.youTag?.destroy();
    this.youTag = null;
    this.cards.forEach((c) => c.c.destroy());
    this.cards = [];
    this.mic.setVisible(false).setPosition(BOARD.x, -80);

    const a = this.activity;
    const titles = [a.hands, a.listen, a.speak];
    const cfg = titles[n];
    if (!cfg) return;
    this.setBoard(cfg.board);
    await this.banner(n + 1, cfg.title);
    if (!this.alive) return;
    if (n === 0) {
      this.order = Phaser.Utils.Array.Shuffle([0, 1, 2, 3]);
      this.turn = 0;
      await this.instruct(a.hands.explain);
      if (!this.alive) return;
      void this.nextTurn();
    } else if (n === 1) {
      await this.startListen();
    } else {
      await this.startSpeak();
    }
  }

  private async levelDone(line: VoiceLine): Promise<void> {
    this.stage = 'busy';
    this.cheer();
    this.dots.mark(this.level);
    this.correct(640, 150, null);
    await this.say(line);
    if (!this.alive) return;
    if (this.level >= 2) {
      this.stage = 'done';
      await this.complete(this.activity.done);
      return;
    }
    await this.wait(400);
    void this.startLevel(this.level + 1);
  }

  private tapKid(i: number): void {
    if (this.stage === 'pick') {
      if (i === this.raised) void this.giveWord(i);
      else this.mistakeOnce('mano', this.activity.hands.notRaised);
      return;
    }
    if (this.stage === 'listen') {
      if (i === this.interrupter) this.calmKid(i);
      else if (i !== SPEAKER) this.mistakeOnce('escucha', this.activity.listen.notThat);
    }
  }

  // ------------------------------------------------------------------ nivel 1: levanta la mano

  private async nextTurn(): Promise<void> {
    if (!this.alive) return;
    if (this.turn >= this.order.length) {
      void this.levelDone(this.activity.hands.done);
      return;
    }
    await this.wait(500);
    if (!this.alive) return;
    const k = this.order[this.turn] ?? 0;
    this.raised = k;
    this.pup(k)?.raiseHand(true);
    this.kidBubble(k, { art: 'mano-arriba' });
    AudioManager.sfx('pop', { pitch: 1.5 });
    const kid = this.kids[k];
    if (kid && !prefersReducedMotion()) {
      this.wiggle = this.tweens.add({
        targets: kid,
        angle: { from: -3, to: 3 },
        duration: 260,
        yoyo: true,
        repeat: -1,
      });
    }
    this.stage = 'pick';
  }

  private async giveWord(i: number): Promise<void> {
    this.stage = 'busy';
    this.raised = -1;
    this.stopWiggle();
    AudioManager.sfx('success');
    await this.flyMic(i);
    if (!this.alive) return;
    this.pup(i)?.raiseHand(false);
    const idea = this.activity.hands.ideas[i];
    if (!idea) return;
    const b = this.kidBubble(i, { art: idea.art });
    await this.say(idea.line);
    if (!this.alive) return;
    // La idea se anota en la pizarra.
    const slot = this.turn;
    const sx = BOARD.x - 180 + slot * 120;
    const sy = BOARD.y + 30;
    const icon = fit(this.add.image(b.x, b.y, tex(idea.art)), 56, 50, 2).setDepth(17);
    this.bubbles.delete(i);
    b.destroy();
    this.boardBits.push(icon);
    this.tweens.add({
      targets: icon,
      x: sx,
      y: sy,
      duration: motion(500),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        icon.setDepth(3);
        AudioManager.sfx('pop');
      },
    });
    this.turn += 1;
    void this.nextTurn();
  }

  // ------------------------------------------------------------------ nivel 2: escucho

  private async startListen(): Promise<void> {
    this.calmed = 0;
    this.interrupter = -1;
    this.lastInterrupter = -1;
    // Puntos de avance en la pizarra.
    for (let k = 0; k < CALM_GOAL; k++) {
      const p = this.add
        .circle(BOARD.x - 60 + k * 40, BOARD.y + 32, 12, 0x2f6b4f)
        .setStrokeStyle(3, COLORS.white)
        .setDepth(3);
      this.pips.push(p);
      this.boardBits.push(p);
    }
    await this.flyMic(SPEAKER);
    if (!this.alive) return;
    this.kidBubble(SPEAKER, { dots: true });
    await this.instruct(this.activity.listen.explain);
    if (!this.alive) return;
    this.stage = 'listen';
    this.scheduleInterrupt(600);
  }

  private scheduleInterrupt(delay: number): void {
    this.time.delayedCall(delay, () => {
      if (!this.alive || this.stage !== 'listen' || this.interrupter >= 0) return;
      const pool = [0, 2, 3].filter((k) => k !== this.lastInterrupter);
      const k = Phaser.Utils.Array.GetRandom(pool);
      this.interrupt(k);
    });
  }

  private interrupt(k: number): void {
    const kid = this.kids[k];
    if (!kid) return;
    this.interrupter = k;
    this.pup(k)?.raiseHand(false).setMode('jump');
    this.kidBubble(k, { text: this.activity.listen.shout }, 'red');
    AudioManager.sfx('pop', { pitch: 1.8 });
    this.time.delayedCall(160, () => AudioManager.sfx('pop', { pitch: 1.6 }));
    this.shoutTween = this.tweens.add({
      targets: kid,
      y: FEET - 18,
      duration: 170,
      yoyo: true,
      repeat: -1,
    });
    this.missTimer = this.time.delayedCall(4500, () => this.missed());
  }

  /** Termina el grito de quien interrumpe (calmado o no). */
  private stopShout(k: number): void {
    this.shoutTween?.stop();
    this.shoutTween = null;
    this.missTimer?.remove();
    this.missTimer = null;
    const kid = this.kids[k];
    if (kid) kid.y = FEET;
    this.pup(k)?.setMode('idle');
    this.lastInterrupter = k;
    this.interrupter = -1;
  }

  private calmKid(k: number): void {
    this.stopShout(k);
    AudioManager.sfx('success');
    // El amigo levanta la mano para esperar su turno (globo con la manita arriba).
    this.kidBubble(k, { art: 'mano-arriba' });
    this.time.delayedCall(1400, () => this.clearBubble(k));
    // Espera su turno con la mano arriba.
    this.pup(k)?.raiseHand(true);
    const kid = this.kids[k];
    if (kid) this.effects.sparkleAt(kid.x, FEET - KID_H, 8);
    const pip = this.pips[this.calmed];
    pip?.setFillStyle(COLORS.grass);
    if (pip) this.tweens.add({ targets: pip, scale: 1.4, duration: 140, yoyo: true });
    this.calmed += 1;
    void this.say(this.activity.listen.calm);
    if (this.calmed >= CALM_GOAL) {
      void this.finishListen();
      return;
    }
    this.scheduleInterrupt(Phaser.Math.Between(2800, 3600));
  }

  private missed(): void {
    if (this.interrupter < 0 || this.stage !== 'listen') return;
    const k = this.interrupter;
    this.stopShout(k);
    this.clearBubble(k);
    // La amiga se pone triste porque no la dejaron terminar.
    this.kidBubble(SPEAKER, { art: 'cara-triste' });
    this.mistakeOnce('interrumpio', this.activity.listen.missed);
    this.time.delayedCall(1800, () => {
      if (this.alive && this.stage === 'listen') this.kidBubble(SPEAKER, { dots: true });
    });
    this.scheduleInterrupt(3000);
  }

  private async finishListen(): Promise<void> {
    this.stage = 'busy';
    await this.wait(700);
    if (!this.alive) return;
    this.kids.forEach((_, i) => this.pup(i)?.raiseHand(false));
    this.kidBubble(SPEAKER, { art: 'mano-arriba' });
    await this.say(this.activity.listen.speech);
    if (!this.alive) return;
    this.clearBubble(SPEAKER);
    void this.levelDone(this.activity.listen.done);
  }

  // ------------------------------------------------------------------ nivel 3: mi turno

  private async startSpeak(): Promise<void> {
    const kid = this.kids[PLAYER];
    if (kid) {
      const g = this.add.graphics();
      g.fillStyle(COLORS.sun).fillRoundedRect(-30, -18, 60, 36, 18);
      g.lineStyle(3, INK).strokeRoundedRect(-30, -18, 60, 36, 18);
      const t = addTitle(this, 0, 0, 'Tú', 24, { color: INK_TEXT });
      this.youTag = this.add
        .container(kid.x, FEET - KID_H - 28, [g, t])
        .setDepth(14)
        .setScale(0);
      this.tweens.add({
        targets: this.youTag,
        scale: 1,
        duration: motion(300),
        ease: 'Back.easeOut',
      });
      if (!prefersReducedMotion()) {
        this.tweens.add({
          targets: this.youTag,
          y: '-=8',
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
    await this.flyMic(PLAYER);
    if (!this.alive) return;
    await this.say(this.activity.speak.explain);
    if (!this.alive) return;
    this.round = 0;
    await this.askRound();
  }

  private async askRound(): Promise<void> {
    const r = this.activity.speak.rounds[this.round];
    if (!r) {
      void this.levelDone(this.activity.speak.done);
      return;
    }
    this.showCards(r.options);
    this.stage = 'choose';
    await this.instruct(r.question);
  }

  private showCards(options: TalkActivity['speak']['rounds'][number]['options']): void {
    const w = 330;
    const h = 108;
    const gap = 18;
    const top = 330 - ((options.length - 1) * (h + gap)) / 2;
    options.forEach((o, i) => {
      const g = this.add.graphics();
      g.fillStyle(INK, 0.22).fillRoundedRect(-w / 2 + 3, -h / 2 + 7, w, h, 20);
      g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
      g.lineStyle(4, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
      const img = fit(this.add.image(-w / 2 + 52, 0, tex(o.art)), 72, 84, 2);
      const t = addBody(this, 42, 0, o.label, 20, { color: INK_TEXT, wrap: 210 });
      const c = this.add
        .container(PANEL_X, top + i * (h + gap), [g, img, t])
        .setDepth(20)
        .setScale(0);
      c.setSize(w, h).setInteractive({ useHandCursor: true });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.choose(i, c));
      this.tweens.add({
        targets: c,
        scale: 1,
        delay: i * 120,
        duration: motion(300),
        ease: 'Back.easeOut',
      });
      this.cards.push({ c, good: o.good });
    });
  }

  private choose(i: number, card: Phaser.GameObjects.Container): void {
    if (this.stage !== 'choose') return;
    const r = this.activity.speak.rounds[this.round];
    const o = r?.options[i];
    if (!r || !o) return;
    if (!o.good) {
      this.tweens.add({
        targets: card,
        angle: { from: -5, to: 5 },
        duration: 70,
        yoyo: true,
        repeat: 3,
        onComplete: () => card.setAngle(0),
      });
      // Los amigos se ponen tristes un momento.
      [1, 2, 3].forEach((k) => this.kidBubble(k, { art: 'cara-triste' }));
      this.time.delayedCall(1600, () => [1, 2, 3].forEach((k) => this.clearBubble(k)));
      if (o.hint) this.mistakeOnce(`r${this.round}-${i}`, o.hint);
      return;
    }
    void this.goodAnswer(o.art, card, r.right);
  }

  private async goodAnswer(
    art: Parameters<typeof tex>[0],
    card: Phaser.GameObjects.Container,
    line: VoiceLine,
  ): Promise<void> {
    this.stage = 'busy';
    AudioManager.sfx('success');
    [1, 2, 3].forEach((k) => this.clearBubble(k));
    this.tweens.add({ targets: card, scale: 1.08, duration: 140, yoyo: true });
    await this.wait(300);
    this.cards.forEach((c) =>
      this.tweens.add({
        targets: c.c,
        scale: 0,
        duration: motion(200),
        onComplete: () => c.c.destroy(),
      }),
    );
    this.cards = [];
    this.kidBubble(PLAYER, { art });
    this.cheer(PLAYER);
    await this.say(line);
    if (!this.alive) return;
    this.clearBubble(PLAYER);
    this.round += 1;
    await this.wait(300);
    if (!this.alive) return;
    await this.askRound();
  }

  // ------------------------------------------------------------------ ayuda

  protected override getHint(): HintTarget | null {
    if (this.stage === 'pick' && this.raised >= 0) {
      const k = this.kids[this.raised];
      return k ? { kind: 'tap', x: k.x, y: FEET - KID_H / 2 } : null;
    }
    if (this.stage === 'listen' && this.interrupter >= 0) {
      const k = this.kids[this.interrupter];
      return k ? { kind: 'tap', x: k.x, y: FEET - KID_H / 2 } : null;
    }
    if (this.stage === 'choose') {
      const c = this.cards.find((k) => k.good);
      return c ? { kind: 'tap', x: c.c.x, y: c.c.y } : null;
    }
    return null;
  }
}
