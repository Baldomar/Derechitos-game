import Phaser from 'phaser';
import { COLORS, CSS, FONTS, GAME_WIDTH, MIN_TOUCH, TEXT_RESOLUTION } from '@/config/theme';
import type { VoiceLine } from '@/config/levels';
import { TITLE_HELLO, TITLE_HELP, TITLE_LOCK } from '@/config/phrases';
import { ensureArt, tex } from '@/art/Art';
import { addBackdrop } from '@/components/Backdrop';
import { BigButton } from '@/components/BigButton';
import { IdleHint } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { enterImmersive, motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo } from '@/core/SceneTransition';

const TEACHER_HOLD_MS = 3000;
const LOGO_X = 905;
const LETTER_COLORS = [
  COLORS.coral,
  COLORS.orange,
  COLORS.grape,
  0x3fb950,
  COLORS.turquoise,
  0x3fb950,
  COLORS.orange,
  COLORS.pink,
  0x4d8dff,
  COLORS.turquoise,
];
const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

type RoundIcon = 'sound' | 'mute' | 'help' | 'lock';

/**
 * Portada: Tori en su rama con un globo de saludo, logo "Derechitos" de colores con el sol
 * detrás, cinta "la aventura de Tori", botón "¡Jugar!" y botones redondos de sonido, ayuda
 * y candado (modo maestro: mantener presionado 3 s). Nubes, sol, hojas, flores y mariposas animadas.
 */
export default class TitleScene extends Phaser.Scene {
  private tori!: Tori;
  private bubble!: Phaser.GameObjects.Container;
  private bubbleBg!: Phaser.GameObjects.Graphics;
  private bubbleText!: Phaser.GameObjects.Text;
  private play!: BigButton;
  private sayToken = 0;

  constructor() {
    super('Title');
  }

  create(): void {
    ensureArt(this, ['nube', 'palmera', 'arbol']);
    AudioManager.preloadVoices([TITLE_HELLO, TITLE_HELP, TITLE_LOCK]);
    addBackdrop(this, { clouds: false });

    this.addSun();
    this.addClouds();
    this.addScenery();
    this.addBranchAndTori();
    this.addBubble();

    const logo = this.buildLogo();
    this.setupTeacherGesture(logo);
    this.addSubtitle();

    this.play = new BigButton(this, LOGO_X, 462, {
      label: '¡Jugar!',
      icon: 'play',
      width: 340,
      height: 112,
      fontSize: 56,
      color: COLORS.sun,
      pulse: true,
      onClick: () => {
        // En celulares: pantalla completa y horizontal (debe ocurrir dentro del toque).
        enterImmersive(this.scale);
        void goTo(this, GameState.introSeen ? 'WorldMap' : 'Intro');
      },
    });
    this.addRoundButtons();
    this.addCritters();
    new IdleHint(this, () => ({ kind: 'tap', x: this.play.x, y: this.play.y }));

    AudioManager.playMusic();
    this.time.delayedCall(1300, () => void this.say(TITLE_HELLO));
    this.time.addEvent({ delay: 7000, loop: true, callback: () => this.tori.wave() });

    addBody(this, GAME_WIDTH - 16, 706, 'v1.1', 16)
      .setOrigin(1, 1)
      .setAlpha(0.6);
  }

  // ------------------------------------------------------------------ escenario

  /** Sol con carita: los rayos giran y la cara "respira". */
  private addSun(): void {
    const raysKey = bakedTexture(this, 'title-sun-rays', 200, 200, (g) => {
      g.lineStyle(9, COLORS.ink);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        g.lineBetween(
          100 + Math.cos(a) * 72,
          100 + Math.sin(a) * 72,
          100 + Math.cos(a) * 94,
          100 + Math.sin(a) * 94,
        );
      }
      g.fillStyle(COLORS.ink);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        g.fillCircle(100 + Math.cos(a) * 72, 100 + Math.sin(a) * 72, 4.5);
        g.fillCircle(100 + Math.cos(a) * 94, 100 + Math.sin(a) * 94, 4.5);
      }
    });
    const faceKey = bakedTexture(this, 'title-sun-face', 130, 130, (g) => {
      g.fillStyle(COLORS.sun).fillCircle(65, 65, 56);
      g.lineStyle(6, COLORS.ink).strokeCircle(65, 65, 56);
      g.fillStyle(0xff9e8a, 0.9).fillCircle(36, 74, 9).fillCircle(94, 74, 9);
      g.fillStyle(COLORS.ink).fillCircle(48, 56, 6).fillCircle(82, 56, 6);
      g.lineStyle(5, COLORS.ink);
      g.beginPath();
      g.arc(65, 66, 20, 0.2 * Math.PI, 0.8 * Math.PI);
      g.strokePath();
    });
    const rays = this.add.image(1196, 112, raysKey);
    const face = this.add.image(1196, 112, faceKey);
    if (prefersReducedMotion()) return;
    this.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
    this.tweens.add({
      targets: face,
      scale: 1.05,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Nubes que cruzan el cielo sin parar. */
  private addClouds(): void {
    const list: [number, number, number, number][] = [
      [180, 100, 0.95, 70000],
      [600, 52, 0.7, 95000],
      [1010, 160, 0.6, 85000],
      [-120, 230, 0.55, 110000],
    ];
    for (const [x, y, s, d] of list) {
      const c = this.add.image(x, y, tex('nube')).setScale(s);
      if (prefersReducedMotion()) continue;
      const left = -260;
      const right = GAME_WIDTH + 260;
      const first = (d * (right - x)) / (right - left);
      this.tweens.add({
        targets: c,
        x: right,
        duration: first,
        onComplete: () => {
          c.setX(left);
          this.tweens.add({ targets: c, x: right, duration: d, repeat: -1 });
        },
      });
    }
  }

  /** Árbol de naranjas, palmera que se mece y florecitas en el pasto. */
  private addScenery(): void {
    this.add.image(1070, 612, tex('arbol')).setScale(0.78);
    const palm = this.add
      .image(1222, 690, tex('palmera'))
      .setOrigin(0.5, 0.97)
      .setScale(0.85);
    const flowerKey = bakedTexture(this, 'title-flower', 40, 56, (g) => {
      g.lineStyle(4, 0x3e9a4c).lineBetween(20, 54, 20, 26);
      g.fillStyle(0x3e9a4c).fillEllipse(28, 42, 14, 8);
      g.fillStyle(COLORS.white);
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5;
        g.fillCircle(20 + Math.cos(a) * 9, 18 + Math.sin(a) * 9, 7);
      }
      g.fillStyle(COLORS.sun).fillCircle(20, 18, 6);
    });
    const flowers = (
      [
        [560, 676, 1],
        [640, 700, 0.85],
        [760, 684, 0.95],
        [1140, 702, 0.9],
        [960, 698, 0.8],
      ] as const
    ).map(([x, y, s]) => this.add.image(x, y, flowerKey).setOrigin(0.5, 1).setScale(s));
    if (prefersReducedMotion()) return;
    this.tweens.add({
      targets: palm,
      angle: { from: -2, to: 2.5 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    flowers.forEach((f, i) =>
      this.tweens.add({
        targets: f,
        angle: { from: -7, to: 7 },
        duration: 1400 + i * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
  }

  /** Rama que entra desde la orilla izquierda, con hojas que se mecen, y Tori parado en ella. */
  private addBranchAndTori(): void {
    const key = bakedTexture(this, 'title-branch', 940, 150, (g) => {
      const pts = [
        { x: 0, y: 92 },
        { x: 900, y: 40 },
        { x: 912, y: 58 },
        { x: 900, y: 76 },
        { x: 0, y: 128 },
      ];
      g.fillStyle(COLORS.ink, 0.22).fillPoints(
        pts.map((p) => new Phaser.Geom.Point(p.x, p.y + 8)),
        true,
      );
      g.fillStyle(0x8a5a32).fillPoints(
        pts.map((p) => new Phaser.Geom.Point(p.x, p.y)),
        true,
      );
      g.fillStyle(0xa8743f).fillPoints(
        [
          new Phaser.Geom.Point(0, 96),
          new Phaser.Geom.Point(895, 45),
          new Phaser.Geom.Point(895, 53),
          new Phaser.Geom.Point(0, 106),
        ],
        true,
      );
      g.lineStyle(5, COLORS.ink).strokePoints(
        pts.map((p) => new Phaser.Geom.Point(p.x, p.y)),
        true,
      );
    });
    // La textura empieza 400 px a la izquierda: en pantallas anchas la rama sigue hasta la orilla.
    this.add.image(-400, 494, key).setOrigin(0);

    // Hoja con su tallito: el origen está en la base del tallo, que nace dentro de la rama.
    const leafKey = bakedTexture(this, 'title-leaf-v2', 100, 44, (g) => {
      g.lineStyle(5, COLORS.ink).lineBetween(2, 22, 22, 22);
      g.lineStyle(3, 0x2f7f3a).lineBetween(2, 22, 22, 22);
      g.fillStyle(0x4fb35a).fillEllipse(58, 22, 74, 32);
      g.lineStyle(4, COLORS.ink).strokeEllipse(58, 22, 74, 32);
      g.lineStyle(3, 0x2f7f3a).lineBetween(26, 22, 84, 22);
    });
    // Borde superior e inferior de la rama en pantalla (la rama baja un poco hacia la izquierda).
    const topY = (x: number): number => 494 + 92 - (52 * (x + 400)) / 900;
    const leafSpots: [x: number, side: 'top' | 'bottom', angle: number, scale: number][] = [
      [-150, 'top', -120, 0.9],
      [-40, 'bottom', 150, 0.8],
      [50, 'top', -140, 1],
      [120, 'top', -60, 0.8],
      [400, 'top', -110, 0.85],
      [445, 'top', -45, 1],
      [470, 'bottom', 40, 0.8],
      [500, 'top', 5, 0.85],
    ];
    const leaves = leafSpots.map(([x, side, angle, s]) =>
      this.add
        .image(x, topY(x) + (side === 'top' ? 4 : 32), leafKey)
        .setOrigin(0.02, 0.5)
        .setAngle(angle)
        .setScale(s),
    );

    this.tori = new Tori(this, 270, 470, 0.72);
    this.tori.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => void this.say(TITLE_HELLO));
    this.time.delayedCall(900, () => this.tori.wave());

    if (prefersReducedMotion()) return;
    // Las hojas se mecen con la brisa, cada una a su ritmo.
    leaves.forEach((l, i) => {
      const base = l.angle;
      const swing = 9 + (i % 3) * 3;
      l.setAngle(base - swing);
      this.tweens.add({
        targets: l,
        angle: base + swing,
        duration: 1100 + (i % 4) * 260,
        delay: i * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /** Globo de diálogo con la colita hacia Tori. Al tocarlo, Tori lo dice en voz alta. */
  private addBubble(): void {
    this.bubble = this.add.container(440, 232).setVisible(false);
    this.bubbleBg = this.add.graphics();
    this.bubbleText = this.add
      .text(0, 0, '', {
        fontFamily: FONTS.body,
        fontSize: '22px',
        fontStyle: '800',
        color: CSS.ink,
        lineSpacing: 2,
        resolution: TEXT_RESOLUTION,
        padding: { top: 4, bottom: 2 },
        wordWrap: { width: 236, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.bubble.add([this.bubbleBg, this.bubbleText]);
    this.bubble.setSize(280, 130).setInteractive({ useHandCursor: true });
    this.bubble.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => void this.say(TITLE_HELLO));
    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: this.bubble,
        y: '-=6',
        duration: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawBubble(): void {
    const w = 280;
    const h = Math.max(96, this.bubbleText.height + 40);
    const g = this.bubbleBg.clear();
    const tail = (dy: number): void => {
      g.fillTriangle(-92, h / 2 - 4 + dy, -50, h / 2 - 4 + dy, -82, h / 2 + 26 + dy);
    };
    g.fillStyle(COLORS.ink, 0.22).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 24);
    tail(7);
    g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    g.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    g.fillStyle(COLORS.ink);
    g.fillTriangle(-97, h / 2 - 2, -45, h / 2 - 2, -82, h / 2 + 32);
    g.fillStyle(COLORS.white);
    g.fillTriangle(-89, h / 2 - 6, -53, h / 2 - 6, -82, h / 2 + 22);
    this.bubble.setSize(w, h + 30);
  }

  /** Tori dice una frase: el globo se actualiza con un "pop" y su pico se mueve al hablar. */
  private async say(line: VoiceLine): Promise<void> {
    const token = ++this.sayToken;
    this.bubbleText.setText(line.text);
    this.drawBubble();
    this.bubble.setVisible(true).setScale(0.6);
    this.tweens.add({
      targets: this.bubble,
      scale: 1,
      duration: motion(420),
      ease: 'Back.easeOut',
    });
    this.tori.startTalking();
    await AudioManager.speak(line);
    if (token === this.sayToken && this.scene.isActive()) this.tori.stopTalking();
  }

  // ------------------------------------------------------------------ logo

  /** "Derechitos" con letras de colores que caen y ondulan, con sombra de tinta. */
  private buildLogo(): Phaser.GameObjects.Container {
    const logo = this.add.container(LOGO_X, 206);
    const word = 'Derechitos';
    const letters = [...word].map((ch, i) =>
      this.add
        .text(0, 0, ch, {
          fontFamily: FONTS.title,
          fontSize: '128px',
          fontStyle: '800',
          color: css(LETTER_COLORS[i % LETTER_COLORS.length] ?? COLORS.sun),
          stroke: CSS.ink,
          strokeThickness: 14,
          resolution: TEXT_RESOLUTION,
          padding: { top: 20, bottom: 14 },
        })
        .setShadow(0, 8, CSS.ink, 0, true, true)
        .setOrigin(0.5),
    );
    const overlap = 20;
    const total = letters.reduce((s, l) => s + l.width - overlap, 0);
    let x = -total / 2;
    letters.forEach((l, i) => {
      l.setX(x + (l.width - overlap) / 2);
      x += l.width - overlap;
      logo.add(l);
      if (prefersReducedMotion()) return;
      l.setY(-420);
      this.tweens.add({
        targets: l,
        y: 0,
        delay: 150 + i * 70,
        duration: 700,
        ease: 'Bounce.easeOut',
      });
      this.tweens.add({
        targets: l,
        y: -10,
        delay: 1300 + i * 90,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    // Que quepa a la derecha de Tori en cualquier tipografía.
    if (total > 700) logo.setScale(700 / total);
    this.addSparkles();
    return logo;
  }

  /** Destellos que titilan alrededor del logo. */
  private addSparkles(): void {
    const key = bakedTexture(this, 'title-sparkle', 32, 32, (g) => {
      g.fillStyle(COLORS.white);
      g.fillPoints(
        [
          [16, 0],
          [20, 12],
          [32, 16],
          [20, 20],
          [16, 32],
          [12, 20],
          [0, 16],
          [12, 12],
        ].map(([px, py]) => new Phaser.Geom.Point(px ?? 0, py ?? 0)),
        true,
      );
    });
    if (prefersReducedMotion()) return;
    (
      [
        [560, 120],
        [1100, 280],
        [600, 300],
        [1010, 90],
      ] as const
    ).forEach(([x, y], i) => {
      const s = this.add.image(x, y, key).setScale(0).setTint(i % 2 ? 0xfff3b0 : COLORS.white);
      this.tweens.add({
        targets: s,
        scale: { from: 0, to: 0.9 },
        angle: 90,
        duration: 700,
        yoyo: true,
        repeat: -1,
        repeatDelay: 1400 + i * 500,
        delay: 1800 + i * 650,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /** Cinta oscura con "la aventura de Tori". */
  private addSubtitle(): void {
    const text = this.add
      .text(0, 2, 'la aventura de Tori', {
        fontFamily: FONTS.title,
        fontSize: '38px',
        fontStyle: '800',
        color: CSS.white,
        resolution: TEXT_RESOLUTION,
        padding: { top: 6 },
      })
      .setOrigin(0.5);
    const w = Math.ceil(text.width + 64);
    const key = bakedTexture(this, `title-ribbon-${w}`, w + 8, 74, (g) => {
      g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(4, 10, w, 60, 30);
      g.fillStyle(COLORS.ink).fillRoundedRect(4, 4, w, 60, 30);
      g.lineStyle(3, 0x47436e).strokeRoundedRect(8, 8, w - 8, 52, 26);
    });
    const ribbon = this.add.container(LOGO_X, 334, [this.add.image(0, 3, key), text]);
    ribbon.setAngle(-2);
    if (prefersReducedMotion()) return;
    ribbon.setScale(0);
    this.tweens.add({
      targets: ribbon,
      scale: 1,
      delay: 1000,
      duration: motion(500),
      ease: 'Back.easeOut',
    });
  }

  // ------------------------------------------------------------------ botones

  private addRoundButtons(): void {
    const y = 594;
    const allMuted = (): boolean => {
      const s = GameState.settings;
      return s.musicMuted && s.sfxMuted && s.voiceMuted;
    };
    this.roundButton(LOGO_X - 112, y, allMuted() ? 'mute' : 'sound', (b) => {
      const mute = !allMuted();
      GameState.updateSettings({ musicMuted: mute, sfxMuted: mute, voiceMuted: mute });
      if (!mute) {
        AudioManager.sfx('pop');
        AudioManager.playMusic();
      }
      b.setIcon(mute ? 'mute' : 'sound');
    });
    this.roundButton(LOGO_X, y, 'help', () => {
      void this.say(TITLE_HELP);
      this.tweens.add({
        targets: this.play,
        angle: { from: -4, to: 4 },
        duration: motion(90),
        yoyo: true,
        repeat: 3,
        onComplete: () => this.play.setAngle(0),
      });
    });
    const lock = this.roundButton(LOGO_X + 112, y, 'lock', () => {
      void this.say(TITLE_LOCK);
    });
    this.setupTeacherHold(lock);
  }

  private roundButton(
    x: number,
    y: number,
    icon: RoundIcon,
    onTap: (b: RoundButton) => void,
  ): RoundButton {
    return new RoundButton(this, x, y, icon, onTap);
  }

  /** El candado abre el modo maestro solo si se mantiene presionado 3 s (anillo de progreso). */
  private setupTeacherHold(lock: RoundButton): void {
    const ring = this.add.graphics().setPosition(lock.x, lock.y);
    let timer: Phaser.Time.TimerEvent | null = null;
    let held = false;
    const cancel = (): void => {
      timer?.remove();
      timer = null;
      ring.clear();
    };
    lock.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      cancel();
      held = false;
      timer = this.time.addEvent({
        delay: 50,
        repeat: TEACHER_HOLD_MS / 50 - 1,
        callback: () => {
          if (!timer) return;
          const p = 1 - timer.repeatCount / (TEACHER_HOLD_MS / 50);
          if (p < 0.12) return;
          ring.clear().lineStyle(7, COLORS.grape);
          ring.beginPath();
          ring.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
          ring.strokePath();
          if (timer.repeatCount === 0) {
            held = true;
            cancel();
            void goTo(this, 'Teacher');
          }
        },
      });
    });
    lock.suppressTap = () => held;
    lock.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, cancel);
    lock.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, cancel);
  }

  /** Mantener presionado el logo 3 s también abre el modo maestro (oculto para los niños). */
  private setupTeacherGesture(logo: Phaser.GameObjects.Container): void {
    logo.setSize(760, 220).setInteractive();
    let timer: Phaser.Time.TimerEvent | null = null;
    const cancel = (): void => {
      timer?.remove();
      timer = null;
    };
    logo.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      cancel();
      timer = this.time.delayedCall(TEACHER_HOLD_MS, () => {
        timer = null;
        void goTo(this, 'Teacher');
      });
    });
    logo.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, cancel);
    logo.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, cancel);
  }

  // ------------------------------------------------------------------ vida

  /** Mariposas que revolotean sobre el pasto. */
  private addCritters(): void {
    if (prefersReducedMotion()) return;
    const make = (color: number): string =>
      bakedTexture(this, `title-butterfly-${color.toString(16)}`, 44, 36, (g) => {
        g.fillStyle(color);
        g.fillEllipse(12, 12, 20, 18).fillEllipse(32, 12, 20, 18);
        g.fillEllipse(14, 26, 14, 12).fillEllipse(30, 26, 14, 12);
        g.lineStyle(3, COLORS.ink);
        g.strokeEllipse(12, 12, 20, 18).strokeEllipse(32, 12, 20, 18);
        g.strokeEllipse(14, 26, 14, 12).strokeEllipse(30, 26, 14, 12);
        g.fillStyle(COLORS.ink).fillRoundedRect(20, 6, 4, 26, 2);
      });
    (
      [
        [620, 560, COLORS.pink, 260, 5200],
        [1130, 420, COLORS.sun, -200, 6400],
      ] as const
    ).forEach(([x, y, color, dx, d], i) => {
      const b = this.add.image(x, y, make(color)).setScale(0.9);
      this.tweens.add({
        targets: b,
        scaleX: 0.25,
        duration: 140,
        yoyo: true,
        repeat: -1,
      });
      this.tweens.add({
        targets: b,
        x: x + dx,
        duration: d,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onYoyo: () => b.setFlipX(!b.flipX),
        onRepeat: () => b.setFlipX(!b.flipX),
      });
      this.tweens.add({
        targets: b,
        y: y - 50,
        duration: 1300 + i * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }
}

/** Botón redondo blanco con ícono (sonido, ayuda, candado). Área táctil de 88 px. */
class RoundButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Container;
  private readonly icon: Phaser.GameObjects.Graphics;
  private pressed = false;
  /** Devuelve true si el toque ya se usó para otra cosa (p. ej. mantener presionado). */
  suppressTap: () => boolean = () => false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    icon: RoundIcon,
    onTap: (b: RoundButton) => void,
  ) {
    super(scene, x, y);
    const key = bakedTexture(scene, 'title-round-btn', 84, 92, (g) => {
      g.fillStyle(COLORS.ink).fillCircle(42, 48, 38);
      g.fillStyle(COLORS.white).fillCircle(42, 42, 36);
      g.lineStyle(5, COLORS.ink).strokeCircle(42, 42, 36);
    });
    this.icon = scene.add.graphics();
    this.face = scene.add.container(0, 0, [scene.add.image(0, 4, key), this.icon]);
    this.add(this.face);
    this.setIcon(icon);
    this.setSize(MIN_TOUCH, MIN_TOUCH).setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.pressed = true;
      AudioManager.sfx('pop');
      scene.tweens.killTweensOf(this.face);
      scene.tweens.add({ targets: this.face, scale: 0.88, y: 4, duration: motion(80) });
    });
    const release = (fire: boolean): void => {
      if (!this.pressed) return;
      this.pressed = false;
      scene.tweens.killTweensOf(this.face);
      scene.tweens.add({
        targets: this.face,
        scale: 1,
        y: 0,
        duration: motion(380),
        ease: 'Elastic.easeOut',
      });
      if (fire && !this.suppressTap()) onTap(this);
    };
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => release(true));
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => release(false));
    scene.add.existing(this);
  }

  setIcon(icon: RoundIcon): void {
    const g = this.icon.clear();
    const ink = COLORS.ink;
    if (icon === 'sound' || icon === 'mute') {
      g.fillStyle(ink);
      g.fillRect(-16, -6, 9, 12);
      g.fillTriangle(-9, -6, 3, -15, 3, 15);
      g.fillTriangle(-9, -6, -9, 6, 3, 15);
      if (icon === 'sound') {
        g.lineStyle(4, ink);
        g.beginPath();
        g.arc(4, 0, 9, -0.9, 0.9);
        g.strokePath();
        g.beginPath();
        g.arc(4, 0, 17, -0.9, 0.9);
        g.strokePath();
      } else {
        g.lineStyle(4, COLORS.coral);
        g.lineBetween(9, -8, 21, 8);
        g.lineBetween(21, -8, 9, 8);
      }
    } else if (icon === 'help') {
      g.lineStyle(5, ink);
      g.beginPath();
      g.arc(0, -6, 8, Math.PI * 1.05, Math.PI * 0.45);
      g.strokePath();
      g.lineBetween(0, 1, 0, 6);
      g.fillStyle(ink).fillCircle(0, 14, 3.5);
    } else {
      g.lineStyle(4.5, ink);
      g.beginPath();
      g.arc(0, -5, 8, Math.PI, 0);
      g.strokePath();
      g.lineBetween(-8, -5, -8, 0);
      g.lineBetween(8, -5, 8, 0);
      g.strokeRoundedRect(-12, 0, 24, 17, 4);
      g.fillStyle(ink).fillCircle(0, 8, 3);
    }
  }
}
