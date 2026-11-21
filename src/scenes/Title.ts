import Phaser from 'phaser';
import { COLORS, CSS, FONTS, GAME_HEIGHT, GAME_WIDTH, TEXT_RESOLUTION } from '@/config/theme';
import type { VoiceLine } from '@/config/levels';
import { TITLE_HELLO } from '@/config/phrases';
import { ensureArt, tex } from '@/art/Art';
import { BigButton } from '@/components/BigButton';
import { IdleHint } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AUDIO_EVENTS, AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { enterImmersive, motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { setPageBackground } from '@/core/PageBackground';
import { goTo } from '@/core/SceneTransition';

const TEACHER_HOLD_MS = 3000;
/** Cielo y pasto se dibujan más anchos que el área de diseño (pantallas panorámicas). */
const PAD = 320;
const SKY_TOP = 0x7ec8f4;
const SKY_BOTTOM = 0xd2f0ff;
const GRASS = 0x7cc85e;
const LOGO_X = 950;
const BUBBLE = { x: 482, y: 150, w: 256 };

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
const pt = (x: number, y: number): Phaser.Geom.Point => new Phaser.Geom.Point(x, y);

/**
 * Portada: un árbol grande a la izquierda con Tori parado en su rama y su globo de saludo;
 * a la derecha el logo "Derechitos", la cinta "la aventura de Tori" y el botón "¡Jugar!".
 * Colinas en capas, flores, arbustos y un naranjo. Animados: nubes, sol, letras, hojas,
 * flores, mariposas y destellos. Mantener presionado el logo 3 s abre el modo maestro.
 */
export default class TitleScene extends Phaser.Scene {
  private tori!: Tori;
  private bubble!: Phaser.GameObjects.Container;
  private bubbleBg!: Phaser.GameObjects.Graphics;
  private bubbleText!: Phaser.GameObjects.Text;
  private sayToken = 0;

  constructor() {
    super('Title');
  }

  create(): void {
    ensureArt(this, ['nube', 'arbol']);
    AudioManager.preloadVoices([TITLE_HELLO]);

    this.addBackground();
    this.addSun();
    this.addClouds();
    this.addTree();
    this.addGround();
    this.addBubble();

    const logo = this.buildLogo();
    this.setupTeacherGesture(logo);
    this.addSubtitle();

    const play = new BigButton(this, LOGO_X, 424, {
      label: '¡Jugar!',
      icon: 'play',
      width: 320,
      height: 104,
      fontSize: 52,
      color: COLORS.sun,
      pulse: true,
      onClick: () => {
        // En celulares: pantalla completa y horizontal (debe ocurrir dentro del toque).
        enterImmersive(this.scale);
        void goTo(this, GameState.introSeen ? 'WorldMap' : 'Intro');
      },
    });
    this.addCritters();
    new IdleHint(this, () => ({ kind: 'tap', x: play.x, y: play.y }));

    AudioManager.playMusic();
    this.time.delayedCall(1300, () => void this.say(TITLE_HELLO));
    if (!AudioManager.unlocked) this.waitForSound();
    this.time.addEvent({ delay: 7000, loop: true, callback: () => this.tori.wave() });

    addBody(this, GAME_WIDTH - 14, 708, 'v1.1', 16)
      .setOrigin(1, 1)
      .setAlpha(0.6);
  }

  // ------------------------------------------------------------------ paisaje

  /** Cielo degradado y colinas en tres capas, con arbolitos lejanos. */
  private addBackground(): void {
    const W = GAME_WIDTH + PAD * 2;
    const o = PAD;
    const key = bakedTexture(this, 'title-bg-v2', W, GAME_HEIGHT, (g) => {
      g.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_BOTTOM, SKY_BOTTOM, 1).fillRect(0, 0, W, 600);
      // Colinas lejanas
      g.fillStyle(0xb7e3a0);
      for (const [x, y, w, h] of [
        [-200, 590, 900, 230],
        [620, 560, 820, 200],
        [1250, 585, 900, 240],
      ] as const)
        g.fillEllipse(x + o, y, w, h);
      // Arbolitos lejanos
      for (const [x, y, r] of [
        [752, 520, 17],
        [1011, 478, 15],
        [1052, 484, 13],
        [1470, 500, 16],
      ] as const) {
        g.fillStyle(0x7a5a3a).fillRect(x + o - 2.5, y, 5, r + 6);
        g.fillStyle(0x6cc04a).fillCircle(x + o, y - 2, r);
        g.lineStyle(3, COLORS.ink, 0.8).strokeCircle(x + o, y - 2, r);
      }
      // Colinas del medio
      g.fillStyle(0x9ad97c);
      for (const [x, y, w, h] of [
        [100, 660, 1100, 230],
        [1000, 640, 1100, 210],
        [1700, 660, 900, 230],
      ] as const)
        g.fillEllipse(x + o, y, w, h);
      // Pasto del frente
      g.fillStyle(GRASS);
      g.fillEllipse(640 + o, 700, 2300, 180);
      g.fillRect(0, 690, W, 30);
      // Matitas
      g.lineStyle(3, 0x4f9e3c);
      for (const [x, y] of [
        [390, 690],
        [560, 680],
        [760, 700],
        [930, 690],
        [1140, 705],
        [1300, 688],
        [-60, 700],
        [700, 668],
        [1500, 690],
      ] as const) {
        g.lineBetween(x + o - 7, y - 8, x + o - 3, y + 4);
        g.lineBetween(x + o - 3, y + 4, x + o + 2, y - 11);
        g.lineBetween(x + o + 2, y - 11, x + o + 7, y + 4);
      }
    });
    this.add.image(-PAD, 0, key).setOrigin(0);
    setPageBackground(this, { top: SKY_TOP, bottom: GRASS, split: 640 });
  }

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
      g.lineStyle(5, COLORS.sun);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        g.lineBetween(
          100 + Math.cos(a) * 73,
          100 + Math.sin(a) * 73,
          100 + Math.cos(a) * 93,
          100 + Math.sin(a) * 93,
        );
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
    const rays = this.add.image(1178, 82, raysKey).setScale(0.82);
    const face = this.add.image(1178, 82, faceKey).setScale(0.82);
    if (prefersReducedMotion()) return;
    this.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
    this.tweens.add({
      targets: face,
      scale: 0.87,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Nubes que cruzan el cielo sin parar (pasan detrás del árbol). */
  private addClouds(): void {
    const list: [number, number, number, number][] = [
      [834, 82, 0.75, 90000],
      [560, 40, 0.5, 120000],
      [1240, 210, 0.45, 100000],
      [-120, 250, 0.55, 110000],
    ];
    for (const [x, y, s, d] of list) {
      const c = this.add.image(x, y, tex('nube')).setScale(s);
      if (prefersReducedMotion()) continue;
      const left = -260;
      const right = GAME_WIDTH + 260;
      this.tweens.add({
        targets: c,
        x: right,
        duration: (d * (right - x)) / (right - left),
        onComplete: () => {
          c.setX(left);
          this.tweens.add({ targets: c, x: right, duration: d, repeat: -1 });
        },
      });
    }
  }

  /** Árbol grande: copa de lóbulos, tronco con hueco y una rama larga donde se para Tori. */
  private addTree(): void {
    // Coordenadas de diseño → textura (la textura empieza en x = -320, y = -200).
    const ox = 320;
    const oy = 200;
    const key = bakedTexture(this, 'title-tree-v4', 980, 940, (g) => {
      const P = (x: number, y: number): Phaser.Geom.Point => pt(x + ox, y + oy);
      const bark = 0x8b5a34;
      const barkDark = 0x6b4224;
      const curve = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) =>
        new Phaser.Curves.QuadraticBezier(
          new Phaser.Math.Vector2(x1 + ox, y1 + oy),
          new Phaser.Math.Vector2(cx + ox, cy + oy),
          new Phaser.Math.Vector2(x2 + ox, y2 + oy),
        ).getPoints(16);

      // Tronco (a su izquierda se ve el cielo, como en el dibujo)
      const trunk = [
        P(26, 200),
        P(122, 200),
        P(118, 420),
        P(126, 560),
        P(146, 660),
        P(196, 730),
        P(14, 730),
        P(30, 600),
        P(22, 420),
      ];
      g.fillStyle(bark).fillPoints(trunk, true);
      g.lineStyle(6, COLORS.ink).strokePoints(trunk, true);
      g.lineStyle(4, barkDark);
      for (const [x1, y1, cx, cy, x2, y2] of [
        [52, 270, 46, 320, 56, 370],
        [98, 300, 104, 340, 96, 390],
        [44, 470, 52, 520, 44, 560],
        [102, 600, 108, 640, 122, 680],
        [60, 640, 58, 680, 66, 715],
      ] as const)
        g.strokePoints(curve(x1, y1, cx, cy, x2, y2));
      // Hueco
      g.fillStyle(0x4a2f1c).fillEllipse(82 + ox, 574 + oy, 28, 38);
      g.lineStyle(4, COLORS.ink).strokeEllipse(82 + ox, 574 + oy, 28, 38);

      // Rama: gruesa junto al tronco y redondeada en la punta
      const branch = [P(110, 454), P(588, 428), P(588, 458), P(110, 506)];
      g.fillStyle(COLORS.ink, 0.2).fillPoints(
        branch.map((p) => pt(p.x, p.y + 8)),
        true,
      );
      g.fillStyle(bark).fillPoints(branch, true);
      g.fillCircle(588 + ox, 443 + oy, 15);
      g.lineStyle(6, COLORS.ink);
      g.strokePoints([P(110, 454), P(588, 428)]);
      g.strokePoints([P(110, 506), P(588, 458)]);
      g.beginPath();
      g.arc(588 + ox, 443 + oy, 15, -Math.PI / 2, Math.PI / 2);
      g.strokePath();
      g.lineStyle(3.5, barkDark);
      g.strokePoints(curve(150, 478, 300, 462, 420, 458));
      g.strokePoints(curve(250, 490, 380, 478, 520, 452));

      // Ramitas curvas
      for (const [x1, y1, cx, cy, x2, y2] of [
        [222, 456, 210, 416, 240, 384],
        [500, 438, 518, 392, 560, 360],
        [440, 466, 448, 500, 470, 518],
      ] as const) {
        g.lineStyle(11, COLORS.ink).strokePoints(curve(x1, y1, cx, cy, x2, y2));
        g.lineStyle(6, bark).strokePoints(curve(x1, y1, cx, cy, x2, y2));
      }
      // Palito en el suelo
      g.lineStyle(10, COLORS.ink).lineBetween(150 + ox, 686 + oy, 222 + ox, 712 + oy);
      g.lineStyle(5, bark).lineBetween(150 + ox, 686 + oy, 222 + ox, 712 + oy);

      // Copa: lóbulos oscuros con borde de tinta…
      const outer: [number, number, number][] = [
        [-110, 40, 170],
        [50, -50, 150],
        [230, -40, 120],
        [310, 30, 78],
        [250, 150, 66],
        [140, 152, 96],
        [20, 168, 92],
        [-110, 170, 100],
      ];
      g.lineStyle(11, COLORS.ink);
      outer.forEach(([x, y, r]) => g.strokeCircle(x + ox, y + oy, r));
      g.fillStyle(0x3f9f45);
      outer.forEach(([x, y, r]) => g.fillCircle(x + ox, y + oy, r));
      // …y lóbulos claros encima, con su contorno verde oscuro.
      const inner: [number, number, number][] = [
        [-60, 120, 70],
        [95, 140, 66],
        [212, 132, 52],
        [300, 30, 56],
        [180, 40, 64],
        [40, 40, 72],
        [250, -50, 60],
        [-100, 10, 80],
      ];
      inner.forEach(([x, y, r]) => {
        g.fillStyle(0x58bf55).fillCircle(x + ox, y + oy, r);
        g.lineStyle(3.5, 0x2f8a3a);
        g.beginPath();
        g.arc(x + ox, y + oy, r, Math.PI * 0.05, Math.PI * 0.95);
        g.strokePath();
      });
      // Rayitas de hojas
      g.lineStyle(3, 0x2f8a3a);
      for (const [x, y] of [
        [10, 90],
        [130, 100],
        [230, 100],
        [290, 0],
        [150, 0],
        [40, -10],
        [-80, 60],
        [70, 190],
      ] as const) {
        g.beginPath();
        g.arc(x + ox, y + oy, 14, Math.PI * 0.2, Math.PI * 0.8);
        g.strokePath();
      }
      // Florecitas rosadas
      for (const [x, y] of [
        [40, 120],
        [150, 120],
        [255, 125],
        [300, 50],
        [-40, 60],
      ] as const) {
        g.fillStyle(COLORS.pink).fillCircle(x + ox, y + oy, 6.5);
        g.lineStyle(2.5, COLORS.ink).strokeCircle(x + ox, y + oy, 6.5);
      }
    });
    this.add.image(-ox, -oy, key).setOrigin(0);

    // Hojas en punta (base en la ramita), meciéndose con la brisa.
    const leafKey = bakedTexture(this, 'title-leaf-v3', 60, 30, (g) => {
      const pts: Phaser.Geom.Point[] = [];
      const L = 54;
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push(pt(3 + t * L, 15 - Math.sin(Math.PI * t) ** 0.8 * 11));
      }
      for (let i = 20; i >= 0; i--) {
        const t = i / 20;
        pts.push(pt(3 + t * L, 15 + Math.sin(Math.PI * t) ** 0.8 * 11));
      }
      g.fillStyle(0x5cc45a).fillPoints(pts, true);
      g.lineStyle(3.5, COLORS.ink).strokePoints(pts, true);
      g.lineStyle(2.5, 0x2f8a3a).lineBetween(6, 15, 46, 15);
    });
    const leafSpots: [number, number, number, number][] = [
      [240, 384, -80, 1.05],
      [244, 398, -8, 0.95],
      [560, 360, -45, 1.05],
      [548, 378, 18, 1.0],
      [522, 392, -125, 0.95],
      [600, 440, -14, 1.1],
      [598, 448, 28, 1.0],
      [470, 518, 12, 1.05],
      [464, 516, 112, 0.92],
    ];
    const leaves = leafSpots.map(([x, y, a, s]) =>
      this.add.image(x, y, leafKey).setOrigin(0.04, 0.5).setAngle(a).setScale(s),
    );

    this.tori = new Tori(this, 355, 345, 0.74);
    this.tori.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => void this.say(TITLE_HELLO));
    this.time.delayedCall(900, () => this.tori.wave());

    if (prefersReducedMotion()) return;
    leaves.forEach((l, i) => {
      const base = l.angle;
      const swing = 7 + (i % 3) * 3;
      l.setAngle(base - swing);
      this.tweens.add({
        targets: l,
        angle: base + swing,
        duration: 1100 + (i % 4) * 260,
        delay: i * 160,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /** Naranjo, arbustos y flores del frente (las flores se mecen). */
  private addGround(): void {
    // Naranjo redondo (copa de tres lóbulos sobre un tronco recto).
    const orange = bakedTexture(this, 'title-orange-tree', 150, 220, (g) => {
      g.fillStyle(0x8a5a32).fillRect(66, 110, 18, 104);
      g.lineStyle(5, COLORS.ink).strokeRect(66, 110, 18, 104);
      g.lineStyle(4, COLORS.ink).lineBetween(75, 160, 98, 136);
      const lobes: [number, number, number][] = [
        [75, 66, 56],
        [38, 100, 34],
        [112, 100, 34],
      ];
      g.lineStyle(10, COLORS.ink);
      lobes.forEach(([x, y, r]) => g.strokeCircle(x, y, r));
      g.fillStyle(0x4fae45);
      lobes.forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(0x68c35a).fillCircle(66, 54, 32);
      for (const [x, y] of [
        [52, 52],
        [96, 44],
        [80, 84],
        [34, 100],
        [116, 98],
        [104, 74],
        [60, 110],
      ] as const) {
        g.fillStyle(COLORS.orange).fillCircle(x, y, 7);
        g.lineStyle(2.5, COLORS.ink).strokeCircle(x, y, 7);
      }
    });
    this.add.image(1214, 644, orange).setOrigin(0.5, 0.97);

    // Arbustos redondos apoyados en el pasto.
    const bush = bakedTexture(this, 'title-bush-v3', 160, 92, (g) => {
      const parts: [number, number, number][] = [
        [44, 58, 30],
        [82, 44, 40],
        [120, 60, 28],
      ];
      g.lineStyle(9, COLORS.ink);
      parts.forEach(([x, y, r]) => g.strokeCircle(x, y, r));
      g.fillStyle(0x4fae45);
      parts.forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(0x68c35a).fillCircle(74, 34, 20).fillCircle(38, 52, 12);
      // Base plana sobre el pasto
      g.fillStyle(GRASS).fillRect(0, 82, 160, 10);
      g.lineStyle(4.5, COLORS.ink).lineBetween(16, 82, 146, 82);
    });
    this.add.image(250, 652, bush).setOrigin(0.5, 0.9);
    this.add.image(1116, 660, bush).setOrigin(0.5, 0.9).setScale(0.62);

    const flowerKey = (petal: number): string =>
      bakedTexture(this, `title-flower-${petal.toString(16)}`, 40, 56, (g) => {
        g.lineStyle(4, 0x3e9a4c).lineBetween(20, 54, 20, 26);
        g.fillStyle(0x3e9a4c).fillEllipse(28, 42, 14, 8);
        g.fillStyle(petal);
        g.lineStyle(2, COLORS.ink, 0.8);
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI) / 5;
          g.fillCircle(20 + Math.cos(a) * 9, 18 + Math.sin(a) * 9, 7);
          g.strokeCircle(20 + Math.cos(a) * 9, 18 + Math.sin(a) * 9, 7);
        }
        g.fillStyle(COLORS.sun).fillCircle(20, 18, 6);
      });
    const white = flowerKey(COLORS.white);
    const pink = flowerKey(COLORS.pink);
    const purple = flowerKey(0xb9a4ff);
    const flowers = (
      [
        [468, 650, white, 1],
        [508, 668, pink, 0.9],
        [645, 668, white, 0.95],
        [862, 652, purple, 0.9],
        [905, 664, white, 0.85],
        [1020, 680, pink, 0.9],
        [1265, 682, white, 0.85],
        [-80, 690, pink, 0.9],
        [1400, 684, purple, 0.9],
      ] as const
    ).map(([x, y, k, s]) => this.add.image(x, y, k).setOrigin(0.5, 1).setScale(s));
    if (prefersReducedMotion()) return;
    flowers.forEach((f, i) =>
      this.tweens.add({
        targets: f,
        angle: { from: -7, to: 7 },
        duration: 1400 + (i % 4) * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
  }

  // ------------------------------------------------------------------ globo de Tori

  /** Globo de diálogo con la colita hacia Tori. Al tocarlo, Tori lo dice en voz alta. */
  private addBubble(): void {
    this.bubble = this.add.container(BUBBLE.x, BUBBLE.y).setVisible(false);
    this.bubbleBg = this.add.graphics();
    this.bubbleText = this.add
      .text(0, 0, '', {
        fontFamily: FONTS.body,
        fontSize: '21px',
        fontStyle: '800',
        color: CSS.ink,
        lineSpacing: 2,
        resolution: TEXT_RESOLUTION,
        padding: { top: 4, bottom: 2 },
        wordWrap: { width: BUBBLE.w - 40, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.bubble.add([this.bubbleBg, this.bubbleText]);
    this.bubble.setSize(BUBBLE.w, 130).setInteractive({ useHandCursor: true });
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
    const w = BUBBLE.w;
    const h = Math.max(92, this.bubbleText.height + 36);
    const g = this.bubbleBg.clear();
    g.fillStyle(COLORS.ink, 0.22).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 24);
    g.fillTriangle(-92, h / 2 + 3, -50, h / 2 + 3, -82, h / 2 + 33);
    g.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    g.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    g.fillStyle(COLORS.ink);
    g.fillTriangle(-97, h / 2 - 2, -45, h / 2 - 2, -82, h / 2 + 32);
    g.fillStyle(COLORS.white);
    g.fillTriangle(-89, h / 2 - 6, -53, h / 2 - 6, -82, h / 2 + 22);
    this.bubble.setSize(w, h + 30);
  }

  /**
   * Los navegadores no dejan sonar nada hasta el primer toque. Mientras tanto se muestra
   * "Toca para escuchar"; con el primer toque arranca la canción y Tori saluda con su voz.
   */
  private waitForSound(): void {
    const icon = this.add.graphics();
    icon.fillStyle(COLORS.white).fillRect(-10, -6, 8, 12).fillTriangle(-2, -6, 8, -14, 8, 14);
    icon.fillTriangle(-2, 6, 8, -14, 8, 14);
    icon.lineStyle(3, COLORS.white);
    icon.beginPath();
    icon.arc(10, 0, 9, -0.9, 0.9);
    icon.strokePath();
    icon.beginPath();
    icon.arc(10, 0, 16, -0.9, 0.9);
    icon.strokePath();
    const label = this.add
      .text(16, 2, 'Toca para escuchar', {
        fontFamily: FONTS.title,
        fontSize: '26px',
        fontStyle: '800',
        color: CSS.white,
        resolution: TEXT_RESOLUTION,
        padding: { top: 4 },
      })
      .setOrigin(0, 0.5);
    const w = label.width + 92;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-w / 2, -24, w, 56, 28);
    bg.fillStyle(COLORS.turquoise).fillRoundedRect(-w / 2, -28, w, 56, 28);
    bg.lineStyle(4, COLORS.ink).strokeRoundedRect(-w / 2, -28, w, 56, 28);
    icon.setPosition(-w / 2 + 34, 0);
    label.setX(-w / 2 + 72);
    const prompt = this.add.container(LOGO_X, 540, [bg, icon, label]).setDepth(20);
    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: prompt,
        scale: 1.06,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    const onUnlock = (): void => {
      if (!this.scene.isActive()) return;
      this.tweens.killTweensOf(prompt);
      this.tweens.add({
        targets: prompt,
        scale: 0,
        alpha: 0,
        duration: motion(250),
        onComplete: () => prompt.destroy(),
      });
      // Ahora sí se escucha: Tori repite su saludo con voz.
      this.time.delayedCall(300, () => void this.say(TITLE_HELLO));
    };
    AudioManager.once(AUDIO_EVENTS.UNLOCKED, onUnlock);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      AudioManager.off(AUDIO_EVENTS.UNLOCKED, onUnlock),
    );
  }

  /** Tori dice una frase: el globo aparece con un "pop" y su pico se mueve al hablar. */
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
    const logo = this.add.container(LOGO_X, 220);
    const letters = [...'Derechitos'].map((ch, i) =>
      this.add
        .text(0, 0, ch, {
          fontFamily: FONTS.title,
          fontSize: '120px',
          fontStyle: '800',
          color: css(LETTER_COLORS[i % LETTER_COLORS.length] ?? COLORS.sun),
          stroke: CSS.ink,
          strokeThickness: 13,
          resolution: TEXT_RESOLUTION,
          padding: { top: 20, bottom: 14 },
        })
        .setShadow(0, 7, CSS.ink, 0, true, true)
        .setOrigin(0.5),
    );
    const overlap = 19;
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
        y: -9,
        delay: 1300 + i * 90,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    // Que quepa entre el árbol y el borde derecho en cualquier tipografía.
    const maxW = 470;
    if (total > maxW) logo.setScale(maxW / total);
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
        ].map(([px, py]) => pt(px ?? 0, py ?? 0)),
        true,
      );
    });
    if (prefersReducedMotion()) return;
    (
      [
        [680, 140],
        [1230, 290],
        [700, 300],
        [1090, 120],
      ] as const
    ).forEach(([x, y], i) => {
      const s = this.add
        .image(x, y, key)
        .setScale(0)
        .setTint(i % 2 ? 0xfff3b0 : COLORS.white);
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
        fontSize: '32px',
        fontStyle: '800',
        color: CSS.white,
        resolution: TEXT_RESOLUTION,
        padding: { top: 6 },
      })
      .setOrigin(0.5);
    const w = Math.ceil(text.width + 56);
    const key = bakedTexture(this, `title-ribbon-${w}`, w + 8, 66, (g) => {
      g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(4, 10, w, 52, 26);
      g.fillStyle(COLORS.ink).fillRoundedRect(4, 4, w, 52, 26);
    });
    const ribbon = this.add.container(LOGO_X, 310, [this.add.image(0, 3, key), text]);
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

  /** Mantener presionado el logo 3 s abre el modo maestro (oculto para los niños). */
  private setupTeacherGesture(logo: Phaser.GameObjects.Container): void {
    logo.setSize(600, 200).setInteractive();
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
        [598, 556, COLORS.pink, 220, 5200],
        [990, 586, COLORS.sun, -180, 6400],
      ] as const
    ).forEach(([x, y, color, dx, d], i) => {
      const b = this.add.image(x, y, make(color)).setScale(0.9);
      this.tweens.add({ targets: b, scaleX: 0.25, duration: 140, yoyo: true, repeat: -1 });
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
