import Phaser from 'phaser';
import { SOFIA_WHEEL, tex } from '@/art/Art';
import { COLORS, DEPTH, GAME_WIDTH } from '@/config/theme';
import type { MazeActivity } from '@/config/rights';
import type { HintTarget } from '@/components/HelperHand';
import { fit } from '@/components/Kit';
import { addBody, addTitle } from '@/components/Text';
import { isPuppet, Puppet } from '@/components/Puppet';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const T = 76;
const TOP = 100;
const INK = COLORS.ink;

type Cell = { c: number; r: number };

/**
 * Motor "laberinto": un caminito de casillas en el pasto. Se toca una casilla vecina
 * (las que tienen huellitas) para avanzar. Algunas casillas tienen peligros: si el niño
 * intenta pasar, el personaje no avanza y Tori explica por qué hay que buscar otro camino.
 * Se llega a la meta sin prisa y sin perder.
 */
export default class MazeGameScene extends BaseActivity<MazeActivity> {
  protected readonly kind = 'maze' as const;
  private rows: string[] = [];
  private x0 = 0;
  private pos: Cell = { c: 0, r: 0 };
  private goal: Cell = { c: 0, r: 0 };
  private walker!: Phaser.GameObjects.Container;
  private marks: Phaser.GameObjects.Container[] = [];
  private moving = false;
  private dangerObjs = new Map<string, Phaser.GameObjects.Image>();
  // Tamaño y posición de las casillas (el modo tablero usa otras medidas).
  private tile = T;
  private top = TOP;
  // Modo tablero
  private rig: Phaser.GameObjects.Container | null = null;
  private puppet: Puppet | null = null;
  private wheel: Phaser.GameObjects.Image | null = null;
  private wheelR = 20;
  private wheelLast: { x: number; y: number } | null = null;
  private arrows: Phaser.GameObjects.Container[] = [];
  private stepsText: Phaser.GameObjects.Text | null = null;
  private steps = 0;
  private goalLabel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('MazeGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.marks = [];
    this.moving = false;
    this.dangerObjs = new Map();
    this.tile = T;
    this.top = TOP;
    this.rig = null;
    this.puppet = null;
    this.wheel = null;
    this.wheelLast = null;
    this.arrows = [];
    this.stepsText = null;
    this.steps = 0;
    this.goalLabel = null;
  }

  private get board(): boolean {
    return this.activity.look === 'board';
  }

  private at(c: number, r: number): string {
    return this.rows[r]?.[c] ?? '#';
  }

  private center(c: number, r: number): { x: number; y: number } {
    return {
      x: this.x0 + c * this.tile + this.tile / 2,
      y: this.top + r * this.tile + this.tile / 2,
    };
  }

  private walkable(ch: string): boolean {
    return ch !== '#' && !(ch >= '0' && ch <= '9') && !(ch >= 'a' && ch <= 'z');
  }

  private isDanger(ch: string): boolean {
    return ch >= 'a' && ch <= 'z';
  }

  protected override buildLevel(): void {
    const a = this.activity;
    this.rows = a.grid;
    if (this.board) {
      this.buildBoard();
      this.bindKeys();
      return;
    }
    const cols = Math.max(...this.rows.map((r) => r.length));
    this.x0 = 640 - (cols * T) / 2;
    const w = cols * T;
    const h = this.rows.length * T;

    const g = this.add.graphics();
    g.fillStyle(INK, 0.18).fillRoundedRect(this.x0 - 16, TOP - 10, w + 32, h + 32, 26);
    g.fillStyle(COLORS.grass).fillRoundedRect(this.x0 - 16, TOP - 16, w + 32, h + 32, 26);
    g.lineStyle(5, INK).strokeRoundedRect(this.x0 - 16, TOP - 16, w + 32, h + 32, 26);
    // Pastito de adorno
    g.fillStyle(COLORS.grassDark);
    for (let i = 0; i < 60; i++) {
      const x = this.x0 + Math.random() * w;
      const y = TOP + Math.random() * h;
      g.fillTriangle(x, y, x + 4, y - 9, x + 8, y);
    }

    this.rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const { x, y } = this.center(c, r);
        if (ch === '#') {
          // Arbusto redondo
          g.fillStyle(0x3e9a4c)
            .fillCircle(x - 14, y + 6, 20)
            .fillCircle(x + 14, y + 6, 20)
            .fillCircle(x, y - 10, 22);
          g.fillStyle(0x5cbf5a)
            .fillCircle(x - 6, y - 14, 8)
            .fillCircle(x + 14, y - 2, 6);
          g.fillStyle(COLORS.coral)
            .fillCircle(x + 8, y + 10, 4)
            .fillCircle(x - 16, y - 2, 3.5);
          return;
        }
        // Casilla de camino
        g.fillStyle(0xe8c983).fillRoundedRect(x - T / 2 + 3, y - T / 2 + 5, T - 6, T - 6, 14);
        g.fillStyle(COLORS.sand).fillRoundedRect(x - T / 2 + 3, y - T / 2 + 2, T - 6, T - 6, 14);
        g.fillStyle(0xe2c487)
          .fillCircle(x - 18, y + 14, 4)
          .fillCircle(x + 16, y - 16, 3);
        if (ch === 'S') this.pos = { c, r };
        if (ch === 'G') {
          this.goal = { c, r };
          const img = fit(this.add.image(x, y - 6, tex(a.goal.art)), T + 20, T + 20, 2).setDepth(2);
          this.tweens.add({
            targets: img,
            scale: img.scale * 1.08,
            duration: 600,
            yoyo: true,
            repeat: -1,
          });
          addBody(this, x, y + T / 2 + 2, a.goal.label, 18, {
            stroke: '#FFFFFF',
            strokeThickness: 6,
          }).setDepth(3);
        }
        const prop = a.props?.[ch];
        if (prop) fit(this.add.image(x, y, tex(prop.art)), T - 8, T - 8, 2).setDepth(2);
        const danger = a.dangers[ch];
        if (danger) {
          const img = fit(this.add.image(x, y, tex(danger.art)), T - 4, T - 4, 2).setDepth(2);
          if (!prefersReducedMotion()) {
            this.tweens.add({
              targets: img,
              angle: { from: -4, to: 4 },
              duration: 600,
              yoyo: true,
              repeat: -1,
            });
          }
          this.dangerObjs.set(`${c},${r}`, img);
        }
      });
    });

    const start = this.center(this.pos.c, this.pos.r);
    const shadow = this.add.ellipse(0, 26, 54, 14, INK, 0.25);
    const body = fit(this.add.image(0, -8, tex(a.walker)), T, T + 10, 2);
    this.walker = this.add.container(start.x, start.y, [shadow, body]).setDepth(5);
    this.tweens.add({
      targets: body,
      y: -14,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const zone = this.add
      .zone(this.x0 + w / 2, TOP + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      const c = Math.floor((p.x - this.x0) / T);
      const r = Math.floor((p.y - TOP) / T);
      this.tryStep(c, r);
    });
    this.bindKeys();
  }

  private bindKeys(): void {
    const key = (dc: number, dr: number) => () => this.tryStep(this.pos.c + dc, this.pos.r + dr);
    this.input.keyboard?.on('keydown-LEFT', key(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', key(1, 0));
    this.input.keyboard?.on('keydown-UP', key(0, -1));
    this.input.keyboard?.on('keydown-DOWN', key(0, 1));
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.refreshMarks();
  }

  private refreshMarks(): void {
    if (this.board) this.showGlow();
    else this.showMarks();
  }

  /** Huellitas brillantes en las casillas a las que se puede ir. */
  private showMarks(): void {
    this.marks.forEach((m) => m.destroy());
    this.marks = [];
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const c = this.pos.c + dc;
      const r = this.pos.r + dr;
      const ch = this.at(c, r);
      if (ch === '#') continue;
      const { x, y } = this.center(c, r);
      const ring = this.add.circle(0, 0, 30, COLORS.white, 0.35).setStrokeStyle(4, COLORS.white);
      const foot = this.add.graphics();
      foot.fillStyle(COLORS.white, 0.95);
      foot.fillEllipse(-7, 3, 10, 16).fillEllipse(7, -5, 10, 16);
      const m = this.add.container(x, y, [ring, foot]).setDepth(4);
      this.tweens.add({
        targets: m,
        scale: 1.15,
        alpha: 0.6,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
      this.marks.push(m);
    }
  }

  private tryStep(c: number, r: number): void {
    if (this.moving || this.finished) return;
    const dist = Math.abs(c - this.pos.c) + Math.abs(r - this.pos.r);
    if (dist !== 1) return;
    const ch = this.at(c, r);
    if (ch === '#') return;
    const target = this.center(c, r);
    if (this.isDanger(ch)) {
      const danger = this.activity.dangers[ch];
      const from = this.center(this.pos.c, this.pos.r);
      this.moving = true;
      AudioManager.sfx('pop', { pitch: 0.7 });
      // Da un pasito, se detiene y regresa.
      this.tweens.add({
        targets: this.walker,
        x: from.x + (target.x - from.x) * 0.3,
        y: from.y + (target.y - from.y) * 0.3,
        duration: motion(160),
        yoyo: true,
        onComplete: () => {
          this.moving = false;
        },
      });
      const img = this.dangerObjs.get(`${c},${r}`);
      if (img)
        this.tweens.add({
          targets: img,
          scale: img.scale * 1.2,
          duration: motion(140),
          yoyo: true,
        });
      if (danger) this.mistakeOnce(ch, danger.hint);
      return;
    }
    if (!this.walkable(ch)) return;
    this.moving = true;
    AudioManager.sfx('pop', { pitch: 1.1 + Math.random() * 0.2 });
    if (this.rig) {
      // La silla mira hacia donde rueda.
      if (c !== this.pos.c) this.rig.scaleX = c < this.pos.c ? -1 : 1;
    } else {
      const body = this.walker.list[1] as Phaser.GameObjects.Image;
      if (c !== this.pos.c) body.setFlipX(c < this.pos.c);
    }
    this.pos = { c, r };
    this.marks.forEach((m) => m.setVisible(false));
    if (this.stepsText) {
      this.steps += 1;
      this.stepsText.setText(String(this.steps));
      this.tweens.add({ targets: this.stepsText, scale: 1.3, duration: 90, yoyo: true });
    }
    const off = this.board ? { x: 6, y: -4 } : { x: 0, y: 0 };
    this.puppet?.setMode('walk');
    this.tweens.add({
      targets: this.walker,
      x: target.x + off.x,
      y: target.y + off.y,
      duration: motion(this.board ? 340 : 230),
      ease: this.board ? 'Sine.easeInOut' : 'Quad.easeInOut',
      onComplete: () => {
        this.moving = false;
        this.puppet?.setMode('idle');
        if (c === this.goal.c && r === this.goal.r) {
          void this.arrive();
        } else {
          this.refreshMarks();
        }
      },
    });
  }

  private async arrive(): Promise<void> {
    this.marks.forEach((m) => m.destroy());
    this.marks = [];
    const { x, y } = this.center(this.goal.c, this.goal.r);
    this.effects.confettiAt(x, y - 40, 40);
    this.correct(x, y - 60, null);
    this.tweens.add({
      targets: this.walker,
      y: y - 30,
      duration: motion(180),
      yoyo: true,
      repeat: 2,
    });
    await this.wait(600);
    await this.complete(this.activity.done);
  }

  /** Camino seguro más corto (sin peligros) para la manita de ayuda. */
  private nextSafe(): Cell | null {
    const key = (p: Cell): string => `${p.c},${p.r}`;
    const prev = new Map<string, Cell | null>([[key(this.pos), null]]);
    const queue: Cell[] = [this.pos];
    while (queue.length) {
      const cur = queue.shift() as Cell;
      if (cur.c === this.goal.c && cur.r === this.goal.r) {
        let step: Cell = cur;
        let back = prev.get(key(step));
        while (back && !(back.c === this.pos.c && back.r === this.pos.r)) {
          step = back;
          back = prev.get(key(step));
        }
        return step;
      }
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const n = { c: cur.c + dc, r: cur.r + dr };
        if (prev.has(key(n)) || !this.walkable(this.at(n.c, n.r))) continue;
        prev.set(key(n), cur);
        queue.push(n);
      }
    }
    return null;
  }

  // ================================================================ modo tablero ('board')

  /** Tablero ilustrado (camino de arena, camino alto, pasto con adornos) + panel de flechas. */
  private buildBoard(): void {
    const a = this.activity;
    const cols = Math.max(...this.rows.map((r) => r.length));
    const rows = this.rows.length;
    this.tile = 90;
    this.top = 108;
    this.x0 = 50;
    const T = this.tile;
    const w = cols * T;
    const h = rows * T;
    this.buildHeaderPill();

    // Marco del tablero.
    const frame = this.add.graphics().setDepth(0.5);
    frame.fillStyle(INK, 0.22).fillRoundedRect(this.x0 - 10, this.top - 4, w + 20, h + 20, 26);
    frame.fillStyle(0x7fd06b).fillRoundedRect(this.x0 - 10, this.top - 10, w + 20, h + 20, 26);
    frame.lineStyle(5, INK).strokeRoundedRect(this.x0 - 10, this.top - 10, w + 20, h + 20, 26);

    // Fondo de casillas (una sola imagen fija: rápido en cualquier tableta).
    const key = `maze-board-${a.id}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      this.paintBoard(g, cols, rows);
      g.generateTexture(key, w, h);
      g.destroy();
    }
    this.add.image(this.x0, this.top, key).setOrigin(0).setDepth(1);

    // Rampas, escalones, meta y salida (con su animación).
    this.rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const { x, y } = this.center(c, r);
        if (ch === 'S') {
          this.pos = { c, r };
          const lbl = addBody(this, 0, 0, a.startLabel ?? 'Salida', 14, { color: '#2B2848' });
          const tw = lbl.width + 18;
          const tg = this.add.graphics();
          tg.fillStyle(COLORS.white).fillRoundedRect(-tw / 2, -12, tw, 24, 12);
          tg.lineStyle(3, INK).strokeRoundedRect(-tw / 2, -12, tw, 24, 12);
          this.add.container(x - T / 2 + tw / 2 + 4, y + T / 2 - 14, [tg, lbl]).setDepth(6);
        }
        if (ch === 'G') {
          this.goal = { c, r };
          if (a.goalLook === 'gate') this.drawGate(x, y);
          else this.drawGoalArt(x, y);
        }
        if (ch === '6') {
          addTitle(this, x, y + 34, a.goal.label, 15, { color: '#FFFFFF' }).setDepth(2);
        }
        const prop = a.props?.[ch];
        if (prop) {
          const img = this.add.image(x, y + T / 2 - 6, tex(prop.art)).setOrigin(0.5, 1);
          img.setScale((T - 14) / img.width).setDepth(2);
        }
        const danger = a.dangers[ch];
        if (danger) {
          const img = this.add.image(x + 4, y + T / 2 - 6, tex(danger.art)).setOrigin(0.5, 1);
          img.setScale((T - 22) / img.width).setDepth(2);
          this.dangerObjs.set(`${c},${r}`, img);
        }
      });
    });

    // Sofía en su silla: la rueda grande va aparte para que gire al rodar.
    const start = this.center(this.pos.c, this.pos.r);
    const s = 0.5;
    const shadow = this.add.ellipse(0, 36, 60, 12, INK, 0.2);
    let body: Phaser.GameObjects.GameObject[];
    if (a.walker === 'nina-silla') {
      const chair = this.add.image(0, 0, tex('nina-silla-cuerpo')).setScale(s);
      this.wheel = this.add
        .image((SOFIA_WHEEL.x - 80) * s, (SOFIA_WHEEL.y - 87.5) * s, tex('rueda-silla'))
        .setScale(s);
      this.wheelR = SOFIA_WHEEL.r * s;
      body = [this.wheel, chair];
    } else if (isPuppet(a.walker)) {
      // Muñeco articulado: camina de verdad cada vez que se mueve.
      this.puppet = new Puppet(this, 0, 38, a.walker).setScale(0.48);
      body = [this.puppet];
    } else {
      body = [fit(this.add.image(0, -8, tex(a.walker)), T, T, 2)];
    }
    this.rig = this.add.container(0, -4, body);
    this.walker = this.add.container(start.x + 6, start.y - 4, [shadow, this.rig]).setDepth(5);
    this.wheelLast = { x: this.walker.x, y: this.walker.y };

    // Tocar una casilla brillante también mueve.
    const zone = this.add
      .zone(this.x0 + w / 2, this.top + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      const c = Math.floor((p.worldX - this.x0) / T);
      const r = Math.floor((p.worldY - this.top) / T);
      this.tryStep(c, r);
    });
    this.buildSidePanel();
  }

  /** Placa naranja con ícono de rampa y el título. */
  private buildHeaderPill(): void {
    const title = addTitle(this, 0, 0, this.activity.title, 32, { color: '#FFFFFF' });
    const w = title.width + 120;
    const g = this.add.graphics();
    g.fillStyle(INK, 0.22).fillRoundedRect(-w / 2, -28, w, 66, 22);
    g.fillStyle(0xe8701f).fillRoundedRect(-w / 2, -32, w, 66, 22);
    g.fillStyle(COLORS.orange).fillRoundedRect(-w / 2, -32, w, 56, 22);
    g.fillStyle(COLORS.white, 0.25).fillRoundedRect(-w / 2 + 16, -26, w - 32, 12, 6);
    g.lineStyle(4, INK).strokeRoundedRect(-w / 2, -32, w, 66, 22);
    const ix = -w / 2 + 44;
    g.fillStyle(COLORS.white).fillCircle(ix, 0, 22);
    g.lineStyle(3, INK).strokeCircle(ix, 0, 22);
    if (this.activity.goalLook === 'gate') {
      // Rampa
      g.fillStyle(0xd9a86c).fillTriangle(ix - 13, 9, ix + 13, 9, ix + 13, -9);
      g.lineStyle(2.5, INK).strokeTriangle(ix - 13, 9, ix + 13, 9, ix + 13, -9);
    } else {
      // Casita
      g.fillStyle(0xfff1d6).fillRect(ix - 9, -2, 18, 13);
      g.lineStyle(2.5, INK).strokeRect(ix - 9, -2, 18, 13);
      g.fillStyle(COLORS.coral).fillTriangle(ix - 13, -1, ix, -13, ix + 13, -1);
      g.lineStyle(2.5, INK).strokeTriangle(ix - 13, -1, ix, -13, ix + 13, -1);
      g.fillStyle(0x9a6b3f).fillRect(ix - 3, 4, 6, 7);
    }
    title.setPosition(20, -2);
    this.add.container(GAME_WIDTH / 2, 46, [g, title]).setDepth(DEPTH.ui);
  }

  /** Pinta todas las casillas del tablero en una textura. */
  private paintBoard(g: Phaser.GameObjects.Graphics, cols: number, rows: number): void {
    const T = this.tile;
    const kind = (c: number, r: number): 'sand' | 'high' | 'grass' => {
      const ch = this.at(c, r);
      if (ch === ':') return 'high';
      if (ch === '#' || (ch >= '0' && ch <= '9')) return 'grass';
      if (ch === 'G') return 'grass';
      return 'sand';
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * T;
        const y = r * T;
        const k = kind(c, r);
        if (k === 'grass') {
          g.fillStyle(0x7fd06b).fillRect(x, y, T, T);
          g.fillStyle(0x5fb04f);
          g.fillTriangle(x + 20, y + 74, x + 24, y + 62, x + 28, y + 74);
          g.fillTriangle(x + 70, y + 30, x + 74, y + 18, x + 78, y + 30);
        } else if (k === 'high') {
          g.fillStyle(0xfdf0d2).fillRect(x, y, T, T);
          g.lineStyle(1.5, 0xf1dfb4).strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        } else {
          g.fillStyle(0xe2bd85).fillRect(x, y, T, T);
          g.lineStyle(1.5, 0xd2aa72).strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
          g.fillStyle(0xd2aa72)
            .fillCircle(x + 22, y + 70, 3)
            .fillCircle(x + 70, y + 26, 2.5)
            .fillCircle(x + 54, y + 60, 2);
        }
      }
    }
    // Muro de ladrillos debajo del camino alto (cuando abajo ya no es camino alto).
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        if (kind(c, r) !== 'high' || kind(c, r + 1) === 'high') continue;
        const x = c * T;
        const y = (r + 1) * T - 12;
        g.fillStyle(0xb85a41).fillRect(x, y, T, 12);
        g.fillStyle(0xd1735a);
        for (let k = 0; k < T; k += 24)
          g.fillRect(x + k + 2, y + 2, 20, 3.5).fillRect(x + k + 14, y + 7, 18, 3.5);
        g.lineStyle(2.5, INK).lineBetween(x, y, x + T, y);
      }
    }
    // Bordes oscuros entre el pasto y los caminos.
    g.lineStyle(4, INK);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = kind(c, r);
        if (k === 'grass') continue;
        const x = c * T;
        const y = r * T;
        if (kind(c, r - 1) === 'grass' && r > 0) g.lineBetween(x, y, x + T, y);
        if (kind(c, r + 1) === 'grass' && r < rows - 1) g.lineBetween(x, y + T, x + T, y + T);
        if (kind(c - 1, r) === 'grass' && c > 0) g.lineBetween(x, y, x, y + T);
        if (kind(c + 1, r) === 'grass' && c < cols - 1) g.lineBetween(x + T, y, x + T, y + T);
      }
    }
    // Adornos del pasto.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = this.at(c, r);
        const cx = c * T + T / 2;
        const cy = r * T + T / 2;
        if (ch === '1') this.paintBush(g, cx, cy + 4);
        if (ch === '2') this.paintFlowers(g, cx, cy);
        if (ch === '3') {
          g.fillStyle(0xb8c1cc).fillEllipse(cx, cy + 10, 50, 30);
          g.fillStyle(COLORS.white, 0.4).fillEllipse(cx - 8, cy + 4, 18, 8);
          g.lineStyle(3.5, INK).strokeEllipse(cx, cy + 10, 50, 30);
        }
        if (ch === '4') {
          g.fillStyle(0x8a5a32).fillRect(cx - 6, cy, 12, 36);
          g.lineStyle(3.5, INK).strokeRect(cx - 6, cy, 12, 36);
          g.fillStyle(INK).fillCircle(cx, cy - 10, 31);
          g.fillStyle(0x4fb35a).fillCircle(cx, cy - 10, 28);
          g.fillStyle(0x6cc35a).fillCircle(cx - 9, cy - 18, 10);
          for (const [dx, dy] of [
            [-12, -4],
            [10, -18],
            [12, 4],
          ] as const) {
            g.fillStyle(COLORS.orange).fillCircle(cx + dx, cy - 10 + dy, 5);
            g.lineStyle(2, INK).strokeCircle(cx + dx, cy - 10 + dy, 5);
          }
        }
        if (ch === '5') {
          // Banca de madera
          g.fillStyle(0x9a6b3f).fillRoundedRect(cx - 30, cy - 4, 60, 9, 3);
          g.fillRoundedRect(cx - 30, cy + 8, 60, 9, 3);
          g.lineStyle(3, INK).strokeRoundedRect(cx - 30, cy - 4, 60, 9, 3);
          g.strokeRoundedRect(cx - 30, cy + 8, 60, 9, 3);
          g.lineStyle(4, INK)
            .lineBetween(cx - 22, cy + 17, cx - 22, cy + 30)
            .lineBetween(cx + 22, cy + 17, cx + 22, cy + 30);
        }
        if (ch === '6') this.paintParkSign(g, cx, cy);
      }
    }
  }

  private paintBush(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    for (const [dx, dy, rr] of [
      [-16, 6, 20],
      [16, 6, 20],
      [0, -10, 23],
    ] as const) {
      g.fillStyle(INK).fillCircle(x + dx, y + dy, rr + 3);
    }
    for (const [dx, dy, rr] of [
      [-16, 6, 20],
      [16, 6, 20],
      [0, -10, 23],
    ] as const) {
      g.fillStyle(0x4fb35a).fillCircle(x + dx, y + dy, rr);
    }
    g.fillStyle(0x6cc35a).fillCircle(x - 8, y - 16, 8);
    g.fillStyle(COLORS.pink)
      .fillCircle(x - 14, y + 4, 3.5)
      .fillCircle(x + 10, y - 6, 3.5)
      .fillCircle(x + 16, y + 12, 3.5)
      .fillCircle(x - 2, y + 14, 3.5);
  }

  private paintFlowers(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    for (const [dx, dy, col] of [
      [-16, 4, COLORS.white],
      [4, -10, COLORS.pink],
      [14, 10, 0xb39ddb],
    ] as const) {
      g.lineStyle(2.5, 0x3e9a4c).lineBetween(x + dx, y + dy + 6, x + dx, y + dy + 22);
      for (let k = 0; k < 5; k++) {
        const ang = (k * 2 * Math.PI) / 5;
        g.fillStyle(col).fillCircle(x + dx + Math.cos(ang) * 6, y + dy + Math.sin(ang) * 6, 5);
        g.lineStyle(1.5, INK, 0.7).strokeCircle(
          x + dx + Math.cos(ang) * 6,
          y + dy + Math.sin(ang) * 6,
          5,
        );
      }
      g.fillStyle(COLORS.sun).fillCircle(x + dx, y + dy, 3.5);
    }
  }

  /** Letrero de la meta: caritas de los amigos con un balón y "Parque". */
  private paintParkSign(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const faces: [number, number, number][] = [
      [-26, -14, 0xf2c9a0],
      [0, -20, 0x6e4430],
      [26, -14, 0xf5d5b8],
    ];
    for (const [dx, dy, skin] of faces) {
      g.fillStyle(skin).fillCircle(x + dx, y + dy, 12);
      g.fillStyle(dx === 0 ? 0x2b2222 : 0x9a6236).fillEllipse(x + dx, y + dy - 7, 24, 11);
      g.lineStyle(2.5, INK).strokeCircle(x + dx, y + dy, 12);
      g.fillStyle(INK)
        .fillCircle(x + dx - 4, y + dy + 1, 2)
        .fillCircle(x + dx + 4, y + dy + 1, 2);
      g.lineStyle(1.8, INK).beginPath();
      g.arc(x + dx, y + dy + 4, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      g.strokePath();
    }
    g.fillStyle(COLORS.white).fillCircle(x, y + 4, 11);
    g.lineStyle(2.5, INK).strokeCircle(x, y + 4, 11);
    g.fillStyle(INK).fillCircle(x, y + 4, 4);
    g.fillStyle(0x3aa655).fillRoundedRect(x - 40, y + 22, 80, 24, 9);
    g.lineStyle(3, INK).strokeRoundedRect(x - 40, y + 22, 80, 24, 9);
  }

  /** Meta con su dibujo (p. ej. la casa) y su nombre en una etiqueta. */
  private drawGoalArt(x: number, y: number): void {
    const T = this.tile;
    const img = this.add.image(x, y + T / 2 - 18, tex(this.activity.goal.art)).setOrigin(0.5, 1);
    img.setScale((T - 8) / Math.max(img.width, img.height)).setDepth(2);
    if (!prefersReducedMotion()) {
      this.tweens.add({
        targets: img,
        scaleY: img.scaleY * 1.05,
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
    }
    const lbl = addTitle(this, 0, 0, this.activity.goal.label, 14, { color: '#FFFFFF' });
    const lw = lbl.width + 18;
    const lg = this.add.graphics();
    lg.fillStyle(0x3aa655).fillRoundedRect(-lw / 2, -12, lw, 24, 9);
    lg.lineStyle(3, INK).strokeRoundedRect(-lw / 2, -12, lw, 24, 9);
    this.add.container(x, y + T / 2 - 12, [lg, lbl]).setDepth(3);
  }

  /** Arco del parque con enredadera y una estrella (la meta). */
  private drawGate(x: number, y: number): void {
    const T = this.tile;
    const g = this.add.graphics().setDepth(2);
    const w = T - 22;
    const top = y - T / 2 + 14;
    g.lineStyle(14, INK);
    g.beginPath();
    g.arc(x, top + 26, w / 2, Math.PI, 2 * Math.PI);
    g.strokePath();
    g.lineBetween(x - w / 2, top + 26, x - w / 2, y + T / 2 - 6).lineBetween(
      x + w / 2,
      top + 26,
      x + w / 2,
      y + T / 2 - 6,
    );
    g.lineStyle(8, 0x5fb04f);
    g.beginPath();
    g.arc(x, top + 26, w / 2, Math.PI, 2 * Math.PI);
    g.strokePath();
    g.lineBetween(x - w / 2, top + 26, x - w / 2, y + T / 2 - 8).lineBetween(
      x + w / 2,
      top + 26,
      x + w / 2,
      y + T / 2 - 8,
    );
    for (let k = 0; k < 7; k++) {
      const ang = Math.PI + (k / 6) * Math.PI;
      g.fillStyle([COLORS.pink, COLORS.sun, COLORS.white][k % 3] ?? COLORS.pink).fillCircle(
        x + Math.cos(ang) * (w / 2),
        top + 26 + Math.sin(ang) * (w / 2),
        4,
      );
    }
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? 20 : 9;
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push({ x: x + Math.cos(ang) * rad, y: y + 12 + Math.sin(ang) * rad });
    }
    const star = this.add.graphics().setDepth(2);
    star.fillStyle(COLORS.sun).fillPoints(pts, true);
    star.lineStyle(3, INK).strokePoints(pts, true, true);
    if (!prefersReducedMotion()) {
      this.tweens.add({ targets: star, alpha: 0.6, duration: 600, yoyo: true, repeat: -1 });
    }
    this.goalLabel = addBody(this, x, y - T / 2 - 14, this.activity.goal.label, 15, {
      color: '#FFFFFF',
    }).setDepth(7);
    this.goalLabel.setVisible(false);
  }

  /** Panel derecho: 1) qué sí y qué no puede Sofía, 2) flechas y contador de pasos. */
  private buildSidePanel(): void {
    const a = this.activity;
    const px = 1110;
    // Tarjeta del paso 1.
    const legend = a.legend;
    if (legend) {
      const cw = 280;
      const ch = 60 + legend.items.length * 86;
      const top = 110;
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(INK, 0.2).fillRoundedRect(px - cw / 2 + 4, top + 8, cw, ch, 22);
      g.fillStyle(COLORS.white).fillRoundedRect(px - cw / 2, top, cw, ch, 22);
      g.lineStyle(4, INK).strokeRoundedRect(px - cw / 2, top, cw, ch, 22);
      this.panelBadge(px - cw / 2 + 32, top + 32, 1);
      addTitle(this, px - cw / 2 + 60, top + 32, legend.title, 21, { color: '#2B2848' })
        .setOrigin(0, 0.5)
        .setDepth(4);
      legend.items.forEach((it, i) => {
        const y = top + 70 + i * 86;
        const col = it.ok ? 0x3aa655 : COLORS.orange;
        const bg = it.ok ? 0xe3f7e5 : 0xffe9dc;
        const cg = this.add.graphics().setDepth(3);
        cg.fillStyle(bg).fillRoundedRect(px - cw / 2 + 14, y, cw - 28, 74, 16);
        cg.lineStyle(3.5, col).strokeRoundedRect(px - cw / 2 + 14, y, cw - 28, 74, 16);
        const img = this.add.image(px - cw / 2 + 62, y + 40, tex(it.art)).setDepth(4);
        img.setScale(Math.min(70 / img.width, 48 / img.height));
        addTitle(this, px - cw / 2 + 108, y + 26, it.label, 18, { color: '#2B2848' })
          .setOrigin(0, 0.5)
          .setDepth(4);
        addBody(this, px - cw / 2 + 108, y + 50, it.note, 14, {
          color: it.ok ? '#2E8B46' : '#D9551F',
        })
          .setOrigin(0, 0.5)
          .setDepth(4);
        const mx = px + cw / 2 - 42;
        const mk = this.add.graphics({ x: mx, y: y + 37 }).setDepth(4);
        mk.fillStyle(col).fillCircle(0, 0, 16);
        mk.lineStyle(3, INK).strokeCircle(0, 0, 16);
        mk.lineStyle(4.5, COLORS.white);
        if (it.ok) mk.beginPath().moveTo(-7, 0).lineTo(-2, 6).lineTo(8, -6).strokePath();
        else mk.lineBetween(-6, -6, 6, 6).lineBetween(6, -6, -6, 6);
      });
    }

    // Paso 2: flechas y contador.
    const cy = 540;
    this.panelBadge(px - 110, 372, 2);
    const tag = addBody(this, 0, 0, a.moveLabel ?? 'Muévete', 16, { color: '#2B2848' });
    const tw = tag.width + 26;
    const tg = this.add.graphics();
    tg.fillStyle(COLORS.white).fillRoundedRect(-tw / 2, -16, tw, 32, 16);
    tg.lineStyle(3, INK).strokeRoundedRect(-tw / 2, -16, tw, 32, 16);
    this.add.container(px - 84 + tw / 2, 372, [tg, tag]).setDepth(4);

    const B = 84;
    const gap = 92;
    const dirs: [number, number, number][] = [
      [0, -1, -90],
      [-1, 0, 180],
      [1, 0, 0],
      [0, 1, 90],
    ];
    for (const [dc, dr, ang] of dirs) {
      const bx = px + dc * gap;
      const by = cy + dr * gap;
      const g = this.add.graphics();
      g.fillStyle(0x1f5fb8).fillRoundedRect(-B / 2, -B / 2 + 6, B, B, 22);
      g.fillStyle(0x3f8be8).fillRoundedRect(-B / 2, -B / 2, B, B, 22);
      g.fillStyle(COLORS.white, 0.25).fillRoundedRect(-B / 2 + 10, -B / 2 + 8, B - 20, 14, 7);
      g.lineStyle(4, INK).strokeRoundedRect(-B / 2, -B / 2, B, B + 6, 22);
      const arrow = this.add.graphics().setAngle(ang);
      arrow.fillStyle(COLORS.white);
      arrow.fillRect(-16, -6, 20, 12).fillTriangle(2, -18, 22, 0, 2, 18);
      arrow.lineStyle(3, INK, 0.25).strokeTriangle(2, -18, 22, 0, 2, 18);
      const btn = this.add
        .container(bx, by, [g, arrow])
        .setDepth(4)
        .setSize(B, B + 6);
      btn.setInteractive({ useHandCursor: true });
      btn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.tweens.add({ targets: btn, scale: 0.9, duration: 70, yoyo: true });
        this.tryStep(this.pos.c + dc, this.pos.r + dr);
      });
      this.arrows.push(btn);
    }
    const cg = this.add.graphics();
    cg.fillStyle(INK, 0.2).fillCircle(2, 4, 38);
    cg.fillStyle(COLORS.white).fillCircle(0, 0, 38);
    cg.lineStyle(4, INK).strokeCircle(0, 0, 38);
    const t1 = addBody(this, 0, -14, 'Pasos', 13, { color: '#2B2848' });
    this.stepsText = addTitle(this, 0, 10, '0', 28, { color: '#2B2848' });
    this.add.container(px, cy, [cg, t1, this.stepsText]).setDepth(4);
  }

  private panelBadge(x: number, y: number, n: number): void {
    const g = this.add.graphics();
    g.fillStyle(INK, 0.2).fillCircle(2, 4, 19);
    g.fillStyle(COLORS.sun).fillCircle(0, 0, 19);
    g.lineStyle(3.5, INK).strokeCircle(0, 0, 19);
    this.add.container(x, y, [g, addTitle(this, 0, 2, String(n), 22)]).setDepth(5);
  }

  /** Casillas brillantes (punteadas) a las que se puede ir. */
  private showGlow(): void {
    this.marks.forEach((m) => m.destroy());
    this.marks = [];
    const T = this.tile;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const c = this.pos.c + dc;
      const r = this.pos.r + dr;
      const ch = this.at(c, r);
      if (!this.walkable(ch) && !this.isDanger(ch)) continue;
      const { x, y } = this.center(c, r);
      const g = this.add.graphics();
      g.fillStyle(COLORS.white, 0.38).fillRoundedRect(-T / 2 + 8, -T / 2 + 8, T - 16, T - 16, 16);
      g.lineStyle(4, COLORS.white, 0.95);
      const s = T - 16;
      for (let k = 0; k < 4; k++) {
        for (let d = 14; d < s - 14; d += 16) {
          const p = -s / 2 + d;
          if (k === 0) g.lineBetween(p, -s / 2, p + 8, -s / 2);
          if (k === 1) g.lineBetween(p, s / 2, p + 8, s / 2);
          if (k === 2) g.lineBetween(-s / 2, p, -s / 2, p + 8);
          if (k === 3) g.lineBetween(s / 2, p, s / 2, p + 8);
        }
      }
      const m = this.add.container(x, y, [g]).setDepth(3);
      if (!prefersReducedMotion()) {
        this.tweens.add({ targets: m, alpha: 0.55, duration: 650, yoyo: true, repeat: -1 });
      }
      this.marks.push(m);
    }
  }

  /** La rueda gira según lo que avanza la silla (rodando de verdad). */
  override update(): void {
    if (!this.wheel || !this.walker || !this.wheelLast) return;
    const dx = this.walker.x - this.wheelLast.x;
    const dy = this.walker.y - this.wheelLast.y;
    this.wheel.rotation += Math.hypot(dx, dy) / this.wheelR;
    this.wheelLast = { x: this.walker.x, y: this.walker.y };
  }

  protected override getHint(): HintTarget | null {
    if (this.moving || this.finished) return null;
    const n = this.nextSafe();
    if (!n) return null;
    const { x, y } = this.center(n.c, n.r);
    return { kind: 'tap', x, y };
  }
}
