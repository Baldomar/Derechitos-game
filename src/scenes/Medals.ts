import Phaser from 'phaser';
import {
  COLORS,
  CSS,
  DEPTH,
  FONTS,
  GAME_HEIGHT,
  GAME_WIDTH,
  TEXT_RESOLUTION,
} from '@/config/theme';
import { RIGHT_AREAS, type RightArea } from '@/config/rights';
import type { VoiceLine } from '@/config/levels';
import { MEDALS_HELLO } from '@/config/phrases';
import { ensureArt, tex } from '@/art/Art';
import { addStarIcon } from '@/components/Icons';
import { PillButton } from '@/components/PillButton';
import { SpeechBubble } from '@/components/SpeechBubble';
import { Tori } from '@/components/Tori';
import { addToriGuide } from '@/components/ToriGuide';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion, prefersReducedMotion, vibrate } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { setPageBackground } from '@/core/PageBackground';
import { goTo } from '@/core/SceneTransition';
import { medalLockedLine, medalsStatusLine } from '@/config/voiceCatalog';

const PAD = 320;
const SEA_EDGE = 0x1a7ec2;
const SEA_CENTER = 0x73d8f6;
const GOLD = 0xf7c33c;
const GOLD_DARK = 0xc98a12;
const SILVER = 0xc3c8d2;
const SILVER_DARK = 0x8a919e;
const PLATE_DARK = 0x4a5163;

/** Vitrina: marco de madera e interior de terciopelo. */
const CASE = { x: 172, y: 114, w: 936, h: 490 };
const COLS = [303, 528, 752, 976];
const ROWS = [150, 372]; // altura del clavito de cada fila

/** Lectura simple de una zona bloqueada (también para lectores de pantalla). */
const lockedLine = (r: RightArea, i: number): VoiceLine => medalLockedLine(r, i);

/**
 * "Mis medallas": una vitrina con las 8 medallas de la isla colgadas de clavitos.
 * Las ganadas brillan en dorado con rayos girando; las que faltan son plateadas, con la silueta
 * del ícono de su zona y un candadito (sin "?", para que el niño sepa qué zona le falta).
 * Todo sale de RIGHT_AREAS y del progreso guardado: se actualiza solo.
 */
export default class MedalsScene extends Phaser.Scene {
  private bubble!: SpeechBubble;
  private tori!: Tori;
  private live: HTMLElement | null = null;

  constructor() {
    super('Medals');
  }

  create(): void {
    ensureArt(this, ['nube', ...RIGHT_AREAS.map((r) => r.icon)]);
    this.drawSea();
    this.drawCase();

    const earned = RIGHT_AREAS.filter((r) => GameState.hasRightMedal(r));
    RIGHT_AREAS.forEach((r, i) => this.addMedal(r, i));

    ({ tori: this.tori, bubble: this.bubble } = addToriGuide(this));
    this.addHud(earned.length);
    this.setupScreenReader();

    const first = earned[0];
    const hello: VoiceLine = first ? medalsStatusLine(earned.length, first) : MEDALS_HELLO;
    this.time.delayedCall(450, () => void this.say(hello));
  }

  // ------------------------------------------------------------------ fondo y vitrina

  /** Mar azul con degradado (claro al centro), olitas y destellos. */
  private drawSea(): void {
    const W = GAME_WIDTH + PAD * 2;
    const key = bakedTexture(this, 'medals-sea', W, GAME_HEIGHT, (g) => {
      g.fillStyle(SEA_EDGE).fillRect(0, 0, W, GAME_HEIGHT);
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(SEA_EDGE),
          Phaser.Display.Color.ValueToColor(SEA_CENTER),
          steps - 1,
          i,
        );
        g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
        g.fillEllipse(W / 2, GAME_HEIGHT / 2, (W + 500) * (1 - t * 0.78), 1100 * (1 - t * 0.78));
      }
      g.lineStyle(3.5, COLORS.white, 0.35);
      for (let y = 40; y < GAME_HEIGHT; y += 62) {
        for (let x = (y / 62) % 2 ? 20 : 70; x < W; x += 110) {
          g.beginPath();
          g.arc(x, y, 9, Math.PI * 1.1, Math.PI * 1.9);
          g.strokePath();
          g.beginPath();
          g.arc(x + 17, y, 9, Math.PI * 0.1, Math.PI * 0.9);
          g.strokePath();
        }
      }
    });
    this.add.image(-PAD, 0, key).setOrigin(0);
    setPageBackground(this, { top: SEA_EDGE });

    const sparkleKey = bakedTexture(this, 'map-sparkle', 20, 20, (g) => {
      g.fillStyle(COLORS.white).fillPoints(
        [
          [10, 0],
          [12.5, 7.5],
          [20, 10],
          [12.5, 12.5],
          [10, 20],
          [7.5, 12.5],
          [0, 10],
          [7.5, 7.5],
        ].map(([x, y]) => new Phaser.Geom.Point(x ?? 0, y ?? 0)),
        true,
      );
    });
    (
      [
        [90, 208],
        [70, 428],
        [1198, 228],
        [1180, 480],
        [140, 560],
      ] as const
    ).forEach(([x, y], i) => {
      const s = this.add.image(x, y, sparkleKey);
      if (prefersReducedMotion()) return;
      this.tweens.add({
        targets: s,
        scale: { from: 0.4, to: 1.1 },
        alpha: { from: 0.3, to: 1 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        delay: i * 380,
      });
    });
  }

  /** Vitrina de madera con terciopelo, dos repisas y reflejo de vidrio. */
  private drawCase(): void {
    const { x, y, w, h } = CASE;
    const key = bakedTexture(this, 'medals-case', w + 20, h + 24, (g) => {
      const o = 6;
      // Marco de madera con veta
      g.fillStyle(COLORS.ink, 0.3).fillRoundedRect(o, o + 10, w, h, 26);
      g.fillStyle(0xa86a35).fillRoundedRect(o, o, w, h, 26);
      g.fillStyle(0xc0834a).fillRoundedRect(o + 6, o + 5, w - 12, 10, 5);
      g.lineStyle(2, 0x8a5428, 0.7);
      for (let k = 0; k < 6; k++) {
        g.lineBetween(o + 30 + k * 160, o + 6, o + 110 + k * 160, o + 6);
        g.lineBetween(o + 60 + k * 150, o + h - 8, o + 130 + k * 150, o + h - 8);
      }
      g.lineStyle(5, COLORS.ink).strokeRoundedRect(o, o, w, h, 26);
      // Terciopelo verde azulado con rombos
      const ix = o + 18;
      const iy = o + 18;
      const iw = w - 36;
      const ih = h - 36;
      g.fillStyle(0x1d6b70).fillRoundedRect(ix, iy, iw, ih, 14);
      g.fillStyle(0x2a8a8c, 0.55).fillRoundedRect(ix + 40, iy + 30, iw - 80, ih - 60, 60);
      // Rombos del terciopelo: líneas diagonales en las dos direcciones, recortadas al interior.
      g.lineStyle(1.5, 0x5cc0bd, 0.18);
      for (let d = 0; d < iw + ih; d += 26) {
        const ax = Math.min(d, iw);
        const ay = Math.max(0, d - iw);
        const bx = Math.max(0, d - ih);
        const by = Math.min(d, ih);
        g.lineBetween(ix + ax, iy + ay, ix + bx, iy + by);
        g.lineBetween(ix + iw - ax, iy + ay, ix + iw - bx, iy + by);
      }
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(ix, iy, iw, ih, 14);
      // Repisas
      const midShelf = (ROWS[1] ?? 372) - 32 - y + o;
      for (const sy of [midShelf, h - 40]) {
        g.fillStyle(0x6e4223).fillRect(ix, sy + 12, iw, 8);
        g.fillStyle(0xc0834a).fillRect(ix, sy, iw, 14);
        g.lineStyle(3, COLORS.ink).strokeRect(ix, sy, iw, 20);
      }
    });
    this.add.image(x - 6, y - 6, key).setOrigin(0);
    // Reflejo diagonal del vidrio (encima de las medallas).
    const glass = this.add.graphics().setDepth(5);
    glass.fillStyle(COLORS.white, 0.07);
    glass.fillPoints(
      [
        new Phaser.Geom.Point(x + 330, y + 18),
        new Phaser.Geom.Point(x + 470, y + 18),
        new Phaser.Geom.Point(x + 230, y + h - 18),
        new Phaser.Geom.Point(x + 90, y + h - 18),
      ],
      true,
    );
    glass.fillStyle(COLORS.white, 0.05);
    glass.fillPoints(
      [
        new Phaser.Geom.Point(x + 500, y + 18),
        new Phaser.Geom.Point(x + 540, y + 18),
        new Phaser.Geom.Point(x + 300, y + h - 18),
        new Phaser.Geom.Point(x + 260, y + h - 18),
      ],
      true,
    );
  }

  // ------------------------------------------------------------------ medallas

  private addMedal(r: RightArea, i: number): void {
    const won = GameState.hasRightMedal(r);
    const nx = COLS[i % 4] ?? 640;
    const ny = ROWS[Math.floor(i / 4)] ?? 150;
    const medalY = 88; // centro de la medalla, medido desde el clavito
    const R = 46;

    // Rayos de luz girando detrás de la medalla ganada (fuera del contenedor que se balancea).
    if (won) {
      const raysKey = bakedTexture(this, 'medals-rays', 220, 220, (g) => {
        g.fillStyle(0xfff3a6, 0.55);
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6;
          g.fillTriangle(
            110,
            110,
            110 + Math.cos(a - 0.13) * 110,
            110 + Math.sin(a - 0.13) * 110,
            110 + Math.cos(a + 0.13) * 110,
            110 + Math.sin(a + 0.13) * 110,
          );
        }
      });
      const rays = this.add.image(nx, ny + medalY, raysKey);
      if (!prefersReducedMotion())
        this.tweens.add({ targets: rays, angle: 360, duration: 12000, repeat: -1 });
    }

    const c = this.add.container(nx, ny);
    const g = this.add.graphics();
    // Cinta en V desde el clavito
    const ribbonA = won ? COLORS.coral : SILVER_DARK;
    const ribbonB = won ? COLORS.turquoise : 0xa6adb9;
    g.fillStyle(ribbonA).fillPoints(
      [
        new Phaser.Geom.Point(-6, 0),
        new Phaser.Geom.Point(6, 0),
        new Phaser.Geom.Point(-8, medalY - R + 8),
        new Phaser.Geom.Point(-28, medalY - R + 2),
      ],
      true,
    );
    g.fillStyle(ribbonB).fillPoints(
      [
        new Phaser.Geom.Point(-6, 0),
        new Phaser.Geom.Point(6, 0),
        new Phaser.Geom.Point(28, medalY - R + 2),
        new Phaser.Geom.Point(8, medalY - R + 8),
      ],
      true,
    );
    g.lineStyle(3.5, COLORS.ink);
    g.strokePoints(
      [
        new Phaser.Geom.Point(-6, 0),
        new Phaser.Geom.Point(-28, medalY - R + 2),
        new Phaser.Geom.Point(-8, medalY - R + 8),
        new Phaser.Geom.Point(0, 6),
        new Phaser.Geom.Point(8, medalY - R + 8),
        new Phaser.Geom.Point(28, medalY - R + 2),
        new Phaser.Geom.Point(6, 0),
      ],
      false,
    );
    // Medalla: aro (dorado o plateado), centro y brillo
    g.fillStyle(COLORS.ink, 0.3).fillCircle(0, medalY + 6, R);
    g.fillStyle(won ? GOLD_DARK : SILVER_DARK).fillCircle(0, medalY + 3, R);
    g.fillStyle(won ? GOLD : SILVER).fillCircle(0, medalY, R);
    if (won) {
      g.fillStyle(0xffe27a);
      for (let k = 0; k < 24; k++) {
        const a = (k * Math.PI) / 12;
        g.fillCircle(Math.cos(a) * (R - 5), medalY + Math.sin(a) * (R - 5), 1.8);
      }
    }
    g.fillStyle(won ? r.color : 0x8e949f).fillCircle(0, medalY, R - 12);
    g.lineStyle(3, won ? GOLD_DARK : 0x6f7682).strokeCircle(0, medalY, R - 12);
    g.lineStyle(5, COLORS.ink).strokeCircle(0, medalY, R);
    g.fillStyle(COLORS.white, won ? 0.4 : 0.25).fillEllipse(-14, medalY - 24, 26, 10);
    c.add(g);

    const icon = this.add.image(0, medalY, tex(r.icon)).setScale(0.36);
    if (!won) icon.setTintFill(0x5f6570).setAlpha(0.75);
    c.add(icon);

    if (!won) {
      const lock = this.add.graphics();
      const lx = 34;
      const ly = medalY + 34;
      lock.fillStyle(COLORS.ink).fillCircle(lx, ly, 15);
      lock.fillStyle(COLORS.white).fillCircle(lx, ly, 12);
      lock.lineStyle(3, COLORS.ink);
      lock.beginPath();
      lock.arc(lx, ly - 2, 4.5, Math.PI, 0);
      lock.strokePath();
      lock.fillStyle(COLORS.ink).fillRoundedRect(lx - 6.5, ly - 2, 13, 10, 2);
      c.add(lock);
    }

    // Clavito dorado
    const nail = this.add.graphics();
    nail.fillStyle(GOLD).fillCircle(0, 0, 6);
    nail.lineStyle(3, COLORS.ink).strokeCircle(0, 0, 6);
    c.add(nail);

    // Placa con el nombre
    const label = this.add
      .text(0, 0, won ? r.medal.name : r.short, {
        fontFamily: FONTS.title,
        fontSize: '18px',
        fontStyle: '800',
        color: won ? CSS.ink : CSS.white,
        resolution: TEXT_RESOLUTION,
        padding: { top: 5 },
      })
      .setOrigin(0.5);
    if (label.width > 162) label.setScale(162 / label.width);
    const pw = 178;
    const ph = 34;
    const plate = this.add.graphics();
    plate.fillStyle(COLORS.ink, 0.35).fillRoundedRect(-pw / 2, -ph / 2 + 4, pw, ph, 8);
    plate.fillStyle(won ? GOLD_DARK : 0x343a49).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
    plate
      .fillStyle(won ? GOLD : PLATE_DARK)
      .fillRoundedRect(-pw / 2 + 2, -ph / 2 + 2, pw - 4, ph - 6, 7);
    plate.lineStyle(3, COLORS.ink).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
    this.add.container(nx, ny + medalY + R + 36, [plate, label]);

    // Destellos alrededor de la medalla ganada
    if (won && !prefersReducedMotion()) {
      (
        [
          [-58, medalY - 40],
          [60, medalY - 20],
          [-48, medalY + 44],
          [56, medalY + 40],
        ] as const
      ).forEach(([sx, sy], k) => {
        const s = addStarIcon(this, nx + sx, ny + sy, 7, true).setScale(0);
        this.tweens.add({
          targets: s,
          scale: 1,
          duration: 600,
          yoyo: true,
          repeat: -1,
          delay: k * 300,
          repeatDelay: 500,
        });
      });
    }

    // Toque: la medalla se balancea y Tori la nombra.
    c.setSize(120, 160);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 20, 120, 160), Phaser.Geom.Rectangle.Contains);
    if (c.input) c.input.cursor = 'pointer';
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      AudioManager.sfx(won ? 'star' : 'pop');
      if (!won) vibrate(20);
      this.tweens.killTweensOf(c);
      c.setAngle(0);
      this.tweens.add({
        targets: c,
        angle: { from: 9, to: 0 },
        duration: motion(700),
        ease: 'Elastic.easeOut',
      });
      if (won) this.tori.setMood('happy');
      void this.say(won ? r.medal.won : lockedLine(r, i));
    });

    // Aparición
    c.setScale(0);
    this.tweens.add({
      targets: c,
      scale: 1,
      delay: i * 70,
      duration: motion(380),
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!won || prefersReducedMotion()) return;
        this.tweens.add({
          targets: c,
          angle: { from: -3, to: 3 },
          duration: 1600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  // ------------------------------------------------------------------ barra y botones

  private addHud(count: number): void {
    const total = RIGHT_AREAS.length;
    new PillButton(this, 96, 58, {
      label: 'Isla',
      icon: 'back',
      width: 130,
      onClick: () => void goTo(this, 'WorldMap'),
    }).setDepth(DEPTH.ui);

    // Placa dorada con cintas
    const key = bakedTexture(this, 'medals-banner', 470, 100, (g) => {
      const tail = (dir: 1 | -1): Phaser.Geom.Point[] => {
        const p = (dx: number, dy: number): Phaser.Geom.Point =>
          new Phaser.Geom.Point(235 + dir * dx, dy);
        return [p(150, 30), p(228, 36), p(206, 60), p(228, 86), p(150, 80)];
      };
      for (const dir of [-1, 1] as const) {
        g.fillStyle(COLORS.orange).fillPoints(tail(dir), true);
        g.lineStyle(4, COLORS.ink).strokePoints(tail(dir), true);
      }
      g.fillStyle(COLORS.ink, 0.3).fillRoundedRect(55, 14, 360, 72, 20);
      g.fillStyle(COLORS.sun).fillRoundedRect(55, 6, 360, 72, 20);
      g.fillStyle(0xf2b52a).fillRoundedRect(59, 58, 352, 16, { tl: 0, tr: 0, bl: 16, br: 16 });
      g.lineStyle(5, COLORS.ink).strokeRoundedRect(55, 6, 360, 72, 20);
    });
    const banner = this.add.container(640, 54).setDepth(DEPTH.ui);
    banner.add(this.add.image(0, 0, key));
    const title = this.text(0, -8, 'Mis medallas', 38, CSS.ink);
    banner.add(title);
    [-1, 1].forEach((side) =>
      banner.add(addStarIcon(this, side * (title.width / 2 + 26), -8, 13, false)),
    );

    // Contador "1 / 8" con barrita
    const w = 226;
    const h = 76;
    const card = this.add.container(GAME_WIDTH - 146, 58).setDepth(DEPTH.ui);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 22);
    bg.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    const mini = this.add.graphics();
    mini.fillStyle(COLORS.coral).fillTriangle(-90, -22, -82, -22, -84, -6);
    mini.fillStyle(COLORS.turquoise).fillTriangle(-74, -22, -66, -22, -72, -6);
    mini.fillStyle(GOLD).fillCircle(-78, 6, 14);
    mini.lineStyle(3.5, COLORS.ink).strokeCircle(-78, 6, 14);
    mini.fillStyle(COLORS.white, 0.8).fillCircle(-78, 6, 5);
    const tx = -44;
    const num = this.text(tx, -10, String(count), 26, CSS.ink).setOrigin(0, 0.5);
    const of = this.text(tx + num.width, -10, ` / ${total}`, 24, '#7B7F96').setOrigin(0, 0.5);
    const barW = w / 2 - 16 - tx;
    const bar = this.add.graphics();
    bar.fillStyle(0xe4e8ef).fillRoundedRect(tx, 10, barW, 14, 7);
    if (count > 0)
      bar
        .fillStyle(COLORS.sun)
        .fillRoundedRect(tx, 10, Math.max(14, (barW * count) / total), 14, 7);
    bar.lineStyle(3, COLORS.ink).strokeRoundedRect(tx, 10, barW, 14, 7);
    card.add([bg, mini, num, of, bar]);
  }

  private text(
    x: number,
    y: number,
    s: string,
    size: number,
    color: string,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, s, {
        fontFamily: FONTS.title,
        fontSize: `${size}px`,
        fontStyle: '800',
        color,
        resolution: TEXT_RESOLUTION,
        padding: { top: 5 },
      })
      .setOrigin(0.5);
  }

  // ------------------------------------------------------------------ voz y accesibilidad

  /** Tori lo dice en voz alta y, a la vez, se anuncia a los lectores de pantalla. */
  private say(line: VoiceLine): Promise<void> {
    if (this.live) this.live.textContent = line.text;
    return this.bubble.say(line);
  }

  /**
   * Lista oculta (solo para lectores de pantalla) con el estado de cada medalla,
   * más una región "aria-live" que repite lo que dice Tori.
   */
  private setupScreenReader(): void {
    const box = document.createElement('div');
    box.setAttribute(
      'style',
      'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap',
    );
    const list = document.createElement('ul');
    list.setAttribute('aria-label', 'Mis medallas');
    RIGHT_AREAS.forEach((r, i) => {
      const li = document.createElement('li');
      li.textContent = GameState.hasRightMedal(r)
        ? `Medalla ${r.medal.name}: ganada.`
        : `Medalla de ${r.short}: bloqueada, juega la zona ${i + 1} para ganarla.`;
      list.appendChild(li);
    });
    const live = document.createElement('p');
    live.setAttribute('aria-live', 'polite');
    box.append(list, live);
    document.body.appendChild(box);
    this.live = live;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      box.remove();
      this.live = null;
    });
  }
}
