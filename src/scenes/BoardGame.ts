import Phaser from 'phaser';
import { TRY_AGAIN } from '@/config/phrases';
import { COLORS, DEPTH, GAME_WIDTH } from '@/config/theme';
import type { BoardActivity, ChoiceOption } from '@/config/rights';
import type { VoiceLine } from '@/config/levels';
import type { HintTarget } from '@/components/HelperHand';
import { hop, shake, thingCard } from '@/components/Kit';
import { addBody, addTitle } from '@/components/Text';
import { Puppet } from '@/components/Puppet';
import { AudioManager } from '@/core/AudioManager';
import { TEX } from '@/core/Textures';
import { motion, prefersReducedMotion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const TILES = 12;
/** Tablero (parque) y sus dos filas de casillas: arriba de izquierda a derecha, abajo al revés. */
const BOARD = { x: 35, y: 124, w: 955, h: 470 };
const ROW1 = 232;
const ROW2 = 462;
const COLS = [124, 274, 424, 574, 724, 874];
const TILE_R = 50;
/** Panel derecho: dado (paso 1) y contador de estrellas (paso 2). */
const PANEL_X = 1132;
const DICE = { x: PANEL_X, y: 282 };
/** Color de cada casilla con número (en orden por la casilla). */
const TILE_COLORS: Record<number, number> = {
  1: 0xff8fc0,
  2: 0x4fc46e,
  4: 0x2ec4bf,
  5: 0xff8a3d,
  6: 0x8b6cf6,
  7: 0xff8a3d,
  8: 0x3f8be8,
  9: 0x3f8be8,
  10: 0xff8fc0,
};

const ROLL: VoiceLine = { id: 'board_roll', text: 'Toca el dado para avanzar.' };

interface Option {
  c: Phaser.GameObjects.Container;
  def: ChoiceOption;
  chosen: boolean;
}

/**
 * Motor "juego de mesa" (desafío final): un caminito de casillas con estrellas. Se toca el
 * dado, la ficha avanza saltando y en cada estrella aparece una pregunta. Al responder bien,
 * la estrella se enciende. ¡Al llegar a la meta se gana la medalla!
 */
export default class BoardGameScene extends BaseActivity<BoardActivity> {
  protected readonly kind = 'board' as const;
  private pos = 0;
  private stops: number[] = [];
  private q = 0;
  private token!: Phaser.GameObjects.Container;
  private dice!: Phaser.GameObjects.Container;
  private diceFace!: Phaser.GameObjects.Graphics;
  private state: 'roll' | 'moving' | 'question' | 'done' = 'moving';
  private tileStars = new Map<number, Phaser.GameObjects.Image>();
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private options: Option[] = [];
  private found = 0;
  private puppet: Puppet | null = null;
  private starsText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('BoardGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.pos = 0;
    this.q = 0;
    this.state = 'moving';
    this.tileStars = new Map();
    this.overlay = [];
    this.options = [];
    this.found = 0;
    this.puppet = null;
    this.starsText = null;
    const n = this.activity.rounds.length;
    // Con 4 preguntas, las estrellas van donde las muestra el diseño (3, 5, 8 y 10).
    this.stops =
      n === 4
        ? [3, 5, 8, 10]
        : Array.from({ length: n }, (_, k) => Math.round(((k + 1) * (TILES - 1)) / (n + 1)));
  }

  /** El título va en su placa azul con trofeo (la dibuja la escena). */
  protected override headerTitle(): string {
    return '';
  }

  private tileXY(i: number): { x: number; y: number } {
    const col = i % 6;
    return i < 6 ? { x: COLS[col] ?? 124, y: ROW1 } : { x: COLS[5 - col] ?? 124, y: ROW2 };
  }

  protected override buildLevel(): void {
    this.buildHeader();
    this.buildBoard();
    this.buildTiles();
    this.buildToken();
    this.buildPanel();
  }

  /** Placa azul con el trofeo y el título. */
  private buildHeader(): void {
    const title = addTitle(this, 0, 0, this.activity.title, 32, { color: '#FFFFFF' });
    const w = title.width + 120;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.22).fillRoundedRect(-w / 2, -28, w, 66, 22);
    g.fillStyle(0x2c6fd1).fillRoundedRect(-w / 2, -32, w, 66, 22);
    g.fillStyle(0x3f8be8).fillRoundedRect(-w / 2, -32, w, 56, 22);
    g.fillStyle(COLORS.white, 0.25).fillRoundedRect(-w / 2 + 16, -26, w - 32, 12, 6);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(-w / 2, -32, w, 66, 22);
    const ix = -w / 2 + 44;
    g.fillStyle(COLORS.white).fillCircle(ix, 0, 22);
    g.lineStyle(3, COLORS.ink).strokeCircle(ix, 0, 22);
    this.trophy(g, ix, 1, 0.55);
    title.setPosition(20, -2);
    this.add.container(GAME_WIDTH / 2, 46, [g, title]).setDepth(DEPTH.ui);
  }

  /** Copa dorada (para la placa y la meta): asas, copa, pie y base. */
  private trophy(g: Phaser.GameObjects.Graphics, x: number, y: number, k: number): void {
    const lw = 3 + k;
    // Asas (detrás de la copa).
    for (const s of [-1, 1]) {
      g.lineStyle(lw + 4, COLORS.ink);
      g.beginPath();
      g.arc(
        x + s * 15 * k,
        y - 10 * k,
        8 * k,
        s < 0 ? 0.5 * Math.PI : -0.5 * Math.PI,
        s < 0 ? 1.5 * Math.PI : 0.5 * Math.PI,
      );
      g.strokePath();
      g.lineStyle(lw, COLORS.sun);
      g.beginPath();
      g.arc(
        x + s * 15 * k,
        y - 10 * k,
        8 * k,
        s < 0 ? 0.5 * Math.PI : -0.5 * Math.PI,
        s < 0 ? 1.5 * Math.PI : 0.5 * Math.PI,
      );
      g.strokePath();
    }
    // Copa (más ancha arriba).
    const cup = [
      { x: x - 17 * k, y: y - 20 * k },
      { x: x + 17 * k, y: y - 20 * k },
      { x: x + 12 * k, y: y + 2 * k },
      { x: x + 4 * k, y: y + 7 * k },
      { x: x - 4 * k, y: y + 7 * k },
      { x: x - 12 * k, y: y + 2 * k },
    ];
    g.fillStyle(COLORS.sun).fillPoints(cup, true);
    g.lineStyle(lw, COLORS.ink).strokePoints(cup, true, true);
    g.fillStyle(COLORS.white, 0.55).fillRoundedRect(x - 11 * k, y - 16 * k, 5 * k, 14 * k, 2.5 * k);
    // Pie y base.
    g.fillStyle(COLORS.sun).fillRect(x - 3.5 * k, y + 7 * k, 7 * k, 7 * k);
    g.lineStyle(lw, COLORS.ink).strokeRect(x - 3.5 * k, y + 7 * k, 7 * k, 7 * k);
    g.fillStyle(0xe0a23a).fillRoundedRect(x - 13 * k, y + 14 * k, 26 * k, 8 * k, 3 * k);
    g.lineStyle(lw, COLORS.ink).strokeRoundedRect(x - 13 * k, y + 14 * k, 26 * k, 8 * k, 3 * k);
  }

  /** Tablero de parque: pasto, borde punteado, caminito con flechas y adornos (imagen fija). */
  private buildBoard(): void {
    const { x, y, w, h } = BOARD;
    const key = 'board-park';
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const ox = -x;
      const oy = -y;
      g.fillStyle(0x7fd06b).fillRoundedRect(0, 0, w, h, 26);
      g.fillStyle(0x72c55e);
      for (let k = 0; k < 140; k++) {
        const gx = 14 + ((k * 97) % (w - 28));
        const gy = 14 + ((k * 61) % (h - 28));
        g.fillTriangle(gx, gy + 7, gx + 3, gy, gx + 6, gy + 7);
      }
      // Borde blanco punteado por dentro.
      g.lineStyle(3, COLORS.white, 0.85);
      const inset = 12;
      const dash = (x1: number, y1: number, x2: number, y2: number): void => {
        const len = Math.hypot(x2 - x1, y2 - y1);
        for (let d = 0; d < len; d += 18) {
          const t1 = d / len;
          const t2 = Math.min(1, (d + 10) / len);
          g.lineBetween(
            x1 + (x2 - x1) * t1,
            y1 + (y2 - y1) * t1,
            x1 + (x2 - x1) * t2,
            y1 + (y2 - y1) * t2,
          );
        }
      };
      dash(inset + 16, inset, w - inset - 16, inset);
      dash(inset + 16, h - inset, w - inset - 16, h - inset);
      dash(inset, inset + 16, inset, h - inset - 16);
      dash(w - inset, inset + 16, w - inset, h - inset - 16);
      // Caminito entre casillas (arena con línea punteada).
      const path = (ax: number, ay: number, bx: number, by: number): void => {
        g.lineStyle(34, COLORS.ink).lineBetween(ax + ox, ay + oy, bx + ox, by + oy);
      };
      const pathFill = (ax: number, ay: number, bx: number, by: number): void => {
        g.lineStyle(26, 0xf3dca0).lineBetween(ax + ox, ay + oy, bx + ox, by + oy);
      };
      const segs: [number, number, number, number][] = [];
      for (let i = 0; i < TILES - 1; i++) {
        const p = this.tileXY(i);
        const q = this.tileXY(i + 1);
        segs.push([p.x, p.y, q.x, q.y]);
      }
      segs.forEach(([a1, b1, a2, b2]) => path(a1, b1, a2, b2));
      segs.forEach(([a1, b1, a2, b2]) => pathFill(a1, b1, a2, b2));
      g.lineStyle(3, COLORS.white, 0.9);
      segs.forEach(([a1, b1, a2, b2]) => {
        const len = Math.hypot(a2 - a1, b2 - b1);
        for (let d = TILE_R; d < len - TILE_R; d += 16) {
          const t1 = d / len;
          const t2 = (d + 8) / len;
          g.lineBetween(
            a1 + (a2 - a1) * t1 + ox,
            b1 + (b2 - b1) * t1 + oy,
            a1 + (a2 - a1) * t2 + ox,
            b1 + (b2 - b1) * t2 + oy,
          );
        }
      });
      // Flechitas que muestran hacia dónde se avanza.
      const arrow = (ax: number, ay: number, dirX: number, dirY: number): void => {
        const px = -dirY;
        const py = dirX;
        const pts = [
          { x: ax + dirX * 10 + ox, y: ay + dirY * 10 + oy },
          { x: ax - dirX * 8 + px * 10 + ox, y: ay - dirY * 8 + py * 10 + oy },
          { x: ax - dirX * 8 - px * 10 + ox, y: ay - dirY * 8 - py * 10 + oy },
        ];
        g.fillStyle(0xf8c66a).fillPoints(pts, true);
        g.lineStyle(3, COLORS.ink).strokePoints(pts, true, true);
      };
      for (const i of [0, 2, 4]) {
        const p = this.tileXY(i);
        const q = this.tileXY(i + 1);
        arrow((p.x + q.x) / 2, p.y, 1, 0);
      }
      for (const i of [7, 9]) {
        const p = this.tileXY(i);
        const q = this.tileXY(i + 1);
        arrow((p.x + q.x) / 2, p.y, -1, 0);
      }
      const v1 = this.tileXY(5);
      arrow(v1.x, (ROW1 + ROW2) / 2, 0, 1);
      // Adornos: arbusto, flores, banca y pelota.
      const bx = 70 + ox;
      const by = 350 + oy;
      for (const [dx, dy, rr] of [
        [-12, 4, 15],
        [12, 4, 15],
        [0, -8, 17],
      ] as const) {
        g.fillStyle(COLORS.ink).fillCircle(bx + dx, by + dy, rr + 3);
      }
      for (const [dx, dy, rr] of [
        [-12, 4, 15],
        [12, 4, 15],
        [0, -8, 17],
      ] as const) {
        g.fillStyle(0x4fb35a).fillCircle(bx + dx, by + dy, rr);
      }
      g.fillStyle(COLORS.pink)
        .fillCircle(bx - 6, by, 3)
        .fillCircle(bx + 8, by - 8, 3);
      for (const [fx, col] of [
        [270, COLORS.white],
        [300, COLORS.pink],
        [330, 0xb39ddb],
        [360, COLORS.white],
      ] as const) {
        const fy = 352 + oy + ((fx / 30) % 2) * 6;
        g.lineStyle(2, 0x3e9a4c).lineBetween(fx + ox, fy, fx + ox, fy + 14);
        g.fillStyle(col).fillCircle(fx + ox, fy, 6);
        g.lineStyle(1.5, COLORS.ink).strokeCircle(fx + ox, fy, 6);
        g.fillStyle(COLORS.sun).fillCircle(fx + ox, fy, 2);
      }
      const benchX = 560 + ox;
      const benchY = 348 + oy;
      g.fillStyle(0x9a6b3f).fillRoundedRect(benchX - 34, benchY - 10, 68, 9, 3);
      g.fillRoundedRect(benchX - 34, benchY + 3, 68, 9, 3);
      g.lineStyle(3, COLORS.ink).strokeRoundedRect(benchX - 34, benchY - 10, 68, 9, 3);
      g.strokeRoundedRect(benchX - 34, benchY + 3, 68, 9, 3);
      g.lineStyle(4, COLORS.ink).lineBetween(benchX - 26, benchY + 12, benchX - 26, benchY + 26);
      g.lineBetween(benchX + 26, benchY + 12, benchX + 26, benchY + 26);
      const ballX = 700 + ox;
      const ballY = 344 + oy;
      g.fillStyle(COLORS.white).fillCircle(ballX, ballY, 15);
      g.fillStyle(COLORS.coral).fillRect(ballX - 15, ballY - 4, 30, 8);
      g.lineStyle(3, COLORS.ink).strokeCircle(ballX, ballY, 15);
      g.generateTexture(key, w, h);
      g.destroy();
    }
    const shadow = this.add.graphics();
    shadow.fillStyle(COLORS.ink, 0.22).fillRoundedRect(x + 4, y + 10, w, h, 26);
    this.add.image(x, y, key).setOrigin(0);
    const frame = this.add.graphics();
    frame.lineStyle(5, COLORS.ink).strokeRoundedRect(x, y, w, h, 26);
  }

  /** Casillas: Salida, números de colores, estrellas con "?" y la meta con el trofeo. */
  private buildTiles(): void {
    for (let i = 0; i < TILES; i++) {
      const { x, y } = this.tileXY(i);
      const g = this.add.graphics().setDepth(1);
      const isStar = this.stops.includes(i);
      const isGoal = i === TILES - 1;
      const color =
        i === 0 ? COLORS.white : isStar || isGoal ? COLORS.sun : (TILE_COLORS[i] ?? COLORS.sky);
      g.fillStyle(COLORS.ink, 0.22).fillCircle(x + 2, y + 6, TILE_R);
      g.fillStyle(color).fillCircle(x, y, TILE_R);
      g.fillStyle(COLORS.white, i === 0 ? 0 : 0.28).fillEllipse(x - 12, y - 22, 46, 20);
      g.lineStyle(5, COLORS.ink).strokeCircle(x, y, TILE_R);
      if (i === 0) {
        addTitle(this, x, y + TILE_R + 18, 'Salida', 18, { color: '#2B2848' }).setDepth(1);
      } else if (isGoal) {
        const t = this.add.graphics().setDepth(1);
        this.trophy(t, x, y - 2, 1.15);
        const lbl = addTitle(this, 0, 0, '¡Meta!', 16, { color: '#2B2848' });
        const lw = lbl.width + 24;
        const lg = this.add.graphics();
        lg.fillStyle(COLORS.sun).fillRoundedRect(-lw / 2, -14, lw, 28, 9);
        lg.lineStyle(3, COLORS.ink).strokeRoundedRect(-lw / 2, -14, lw, 28, 9);
        this.add.container(x, y + TILE_R + 22, [lg, lbl]).setDepth(1);
        if (!prefersReducedMotion()) {
          this.tweens.add({ targets: t, alpha: 0.75, duration: 650, yoyo: true, repeat: -1 });
        }
      } else if (isStar) {
        const star = this.add
          .image(x, y + 2, this.starTexture())
          .setDepth(1)
          .setScale(0.95);
        const q = addTitle(this, x, y + 6, '?', 26, { color: '#2B2848' }).setDepth(1);
        this.tileStars.set(i, star);
        star.setData('q', q);
      } else {
        addTitle(this, x, y + 3, String(i), 34, {
          color: '#FFFFFF',
          stroke: '#2B2848',
          strokeThickness: 6,
        }).setDepth(1);
      }
    }
  }

  /** Ficha: el niño (muñeco articulado) parado en la Salida. */
  private buildToken(): void {
    const start = this.tileXY(0);
    const shadow = this.add.ellipse(0, 0, 50, 12, COLORS.ink, 0.25);
    this.puppet = new Puppet(this, 0, 0, 'nino-a').setScale(0.55);
    this.token = this.add.container(start.x, start.y + 4, [shadow, this.puppet]).setDepth(5);
  }

  /** Panel derecho: 1) tira el dado, 2) en la estrella, responde (contador). */
  private buildPanel(): void {
    const card = (top: number, h: number): void => {
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(COLORS.ink, 0.2).fillRoundedRect(PANEL_X - 118 + 4, top + 8, 236, h, 22);
      g.fillStyle(COLORS.white).fillRoundedRect(PANEL_X - 118, top, 236, h, 22);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(PANEL_X - 118, top, 236, h, 22);
    };
    const badge = (bx: number, by: number, n: number): void => {
      const g = this.add.graphics();
      g.fillStyle(COLORS.ink, 0.2).fillCircle(2, 4, 18);
      g.fillStyle(COLORS.sun).fillCircle(0, 0, 18);
      g.lineStyle(3.5, COLORS.ink).strokeCircle(0, 0, 18);
      this.add.container(bx, by, [g, addTitle(this, 0, 2, String(n), 20)]).setDepth(4);
    };
    // Paso 1: el dado.
    card(132, 290);
    badge(PANEL_X - 82, 170, 1);
    addTitle(this, PANEL_X - 56, 170, 'Tira el dado', 19, { color: '#2B2848' })
      .setOrigin(0, 0.5)
      .setDepth(4);
    const dg = this.add.graphics();
    dg.fillStyle(COLORS.ink, 0.22).fillRoundedRect(-62, -54, 124, 124, 26);
    dg.fillStyle(COLORS.white).fillRoundedRect(-62, -62, 124, 124, 26);
    dg.fillStyle(0xeef1f6).fillRoundedRect(-52, 30, 104, 22, 10);
    dg.lineStyle(6, COLORS.ink).strokeRoundedRect(-62, -62, 124, 124, 26);
    this.diceFace = this.add.graphics();
    const label = addBody(this, 0, 92, '¡Tócame!', 18, { color: '#2F7FE0' });
    this.dice = this.add
      .container(DICE.x, DICE.y, [dg, this.diceFace, label])
      .setSize(130, 130)
      .setDepth(4);
    this.dice.setInteractive({ useHandCursor: true });
    this.dice.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => void this.roll());
    this.pips(1);
    // Paso 2: estrellas contestadas.
    card(444, 128);
    badge(PANEL_X - 82, 482, 2);
    addTitle(this, PANEL_X - 56, 482, 'En la estrella,\nresponde', 16, { color: '#2B2848' })
      .setOrigin(0, 0.5)
      .setDepth(4);
    const st = this.add
      .image(PANEL_X - 34, 534, this.starTexture())
      .setScale(0.42)
      .setDepth(4);
    st.setTint(COLORS.sun);
    this.starsText = addTitle(this, PANEL_X + 22, 536, `0 / ${this.stops.length}`, 28, {
      color: '#2B2848',
    }).setDepth(4);
  }

  private starTexture(): string {
    const key = 'board-star';
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 38 : 17;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push({ x: 42 + Math.cos(a) * r, y: 42 + Math.sin(a) * r });
    }
    g.fillStyle(COLORS.white).fillPoints(pts, true);
    g.lineStyle(4, COLORS.ink).strokePoints(pts, true);
    g.generateTexture(key, 84, 84);
    g.destroy();
    return key;
  }

  private pips(n: number): void {
    const g = this.diceFace.clear().fillStyle(COLORS.ink);
    const d = 30;
    const at: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [
        [-d, -d],
        [d, d],
      ],
      3: [
        [-d, -d],
        [0, 0],
        [d, d],
      ],
      4: [
        [-d, -d],
        [d, -d],
        [-d, d],
        [d, d],
      ],
      5: [
        [-d, -d],
        [d, -d],
        [0, 0],
        [-d, d],
        [d, d],
      ],
      6: [
        [-d, -d],
        [d, -d],
        [-d, 0],
        [d, 0],
        [-d, d],
        [d, d],
      ],
    };
    for (const [x, y] of at[n] ?? []) g.fillCircle(x, y, 11);
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    void this.waitRoll();
  }

  private async waitRoll(): Promise<void> {
    this.state = 'roll';
    this.tweens.add({ targets: this.dice, scale: 1.1, duration: 400, yoyo: true, repeat: -1 });
    await this.instruct(ROLL);
  }

  private async roll(): Promise<void> {
    if (this.state !== 'roll') return;
    this.state = 'moving';
    this.tweens.killTweensOf(this.dice);
    this.dice.setScale(1);
    const next = this.stops[this.q] ?? TILES - 1;
    const steps = Math.max(1, next - this.pos);
    // El dado gira mostrando caras y cae en el número que lleva a la siguiente estrella.
    this.tweens.add({
      targets: this.dice,
      angle: 360,
      duration: motion(700),
      ease: 'Cubic.easeOut',
      onComplete: () => this.dice.setAngle(0),
    });
    for (let i = 0; i < 7; i++) {
      this.pips(Phaser.Math.Between(1, 6));
      AudioManager.sfx('pop', { pitch: 1.6 + Math.random() * 0.4 });
      await this.wait(90);
    }
    this.pips(steps);
    this.tweens.add({ targets: this.dice, scale: 1.2, duration: motion(140), yoyo: true });
    await this.wait(450);
    for (let s = 0; s < steps; s++) {
      if (!this.alive) return;
      this.pos += 1;
      const { x, y } = this.tileXY(this.pos);
      AudioManager.sfx('pop', { pitch: 1 + s * 0.15 });
      const kid = this.puppet;
      if (kid && x !== this.token.x) kid.scaleX = (x < this.token.x ? -1 : 1) * 0.55;
      kid?.setMode('jump');
      await new Promise<void>((resolve) => {
        // La ficha se desliza y el muñequito salta (arco), con piernas recogidas.
        if (kid) {
          this.tweens.add({
            targets: kid,
            y: -40,
            duration: motion(140),
            yoyo: true,
            ease: 'Quad.easeOut',
          });
        }
        this.tweens.add({
          targets: this.token,
          x,
          y: y + 4,
          duration: motion(280),
          onComplete: () => resolve(),
        });
      });
      kid?.setMode('idle');
    }
    if (this.pos >= TILES - 1) {
      void this.finish();
    } else {
      void this.ask();
    }
  }

  private async ask(): Promise<void> {
    const round = this.activity.rounds[this.q];
    if (!round) return;
    this.state = 'question';
    this.found = 0;
    const dim = this.add
      .rectangle(640, 360, 8000, 8000, COLORS.ink, 0)
      .setDepth(DEPTH.ui + 1)
      .setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.35, duration: motion(250) });
    const panel = this.add.graphics().setDepth(DEPTH.ui + 2);
    panel.fillStyle(COLORS.cream).fillRoundedRect(150, 110, 980, 470, 30);
    panel.lineStyle(6, COLORS.ink).strokeRoundedRect(150, 110, 980, 470, 30);
    const star = this.add
      .image(640, 112, this.starTexture())
      .setTint(COLORS.sun)
      .setDepth(DEPTH.ui + 3);
    const title = addTitle(this, 640, 170, round.question.text, 28, { wrap: 900 }).setDepth(
      DEPTH.ui + 3,
    );
    this.overlay = [dim, panel, star, title];
    const opts = round.options;
    const cw = opts.length > 3 ? 180 : 210;
    const gap = cw + 26;
    this.options = opts.map((def, i) => {
      const c = thingCard(this, cw, 230, def.art, def.label, { labelSize: 19 });
      c.setPosition(640 + (i - (opts.length - 1) / 2) * gap, 380).setDepth(DEPTH.ui + 3);
      c.setInteractive({ useHandCursor: true });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.choose(i));
      c.setScale(0);
      this.tweens.add({
        targets: c,
        scale: 1,
        delay: 150 + i * 90,
        duration: motion(300),
        ease: 'Back.easeOut',
      });
      this.overlay.push(c);
      return { c, def, chosen: false };
    });
    await this.instruct(round.question);
  }

  private choose(i: number): void {
    const o = this.options[i];
    if (this.state !== 'question' || !o || o.chosen) return;
    AudioManager.sfx('pop');
    if (!o.def.correct) {
      shake(this, o.c);
      this.mistakeOnce(`${this.q}/${o.def.id}`, o.def.hint ?? TRY_AGAIN);
      return;
    }
    o.chosen = true;
    const ring = this.add.graphics();
    ring
      .lineStyle(8, COLORS.grass)
      .strokeRoundedRect(-o.c.width / 2, -o.c.height / 2, o.c.width, o.c.height, 20);
    o.c.add([
      ring,
      this.add.image(o.c.width / 2 - 18, -o.c.height / 2 + 18, TEX.check).setScale(0.55),
    ]);
    hop(this, o.c, 14);
    this.found += 1;
    const needed = this.options.filter((k) => k.def.correct).length;
    this.correct(o.c.x, o.c.y - 130, null);
    if (this.found < needed) return;
    this.state = 'moving';
    this.time.delayedCall(900, () => {
      if (!this.alive) return;
      this.overlay.forEach((obj) => obj.destroy());
      this.overlay = [];
      // ¡La estrella de la casilla se enciende!
      const star = this.tileStars.get(this.pos);
      this.starsText?.setText(`${this.q + 1} / ${this.stops.length}`);
      if (this.starsText) hop(this, this.starsText, 10);
      if (star) {
        (star.getData('q') as Phaser.GameObjects.Text | undefined)?.setVisible(false);
        star.clearTint().setTint(0xffd23a);
        this.tweens.add({
          targets: star,
          scale: 1.4,
          angle: 72,
          duration: motion(300),
          yoyo: true,
        });
        this.effects.sparkleAt(star.x, star.y, 14);
      }
      hop(this, this.token, 30);
      this.q += 1;
      void this.waitRoll();
    });
  }

  private async finish(): Promise<void> {
    this.state = 'done';
    const goal = this.tileXY(TILES - 1);
    this.effects.confettiAt(goal.x, goal.y - 40, 60);
    this.tweens.add({
      targets: this.token,
      y: this.token.y - 40,
      duration: motion(200),
      yoyo: true,
      repeat: 2,
    });
    await this.wait(600);
    await this.complete(this.activity.done);
  }

  protected override getHint(): HintTarget | null {
    if (this.state === 'roll') return { kind: 'tap', x: DICE.x, y: DICE.y };
    if (this.state === 'question') {
      const o = this.options.find((k) => k.def.correct && !k.chosen);
      return o ? { kind: 'tap', x: o.c.x, y: o.c.y } : null;
    }
    return null;
  }
}
