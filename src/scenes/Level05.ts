import Phaser from 'phaser';
import { artImage, PEOPLE, SOFIA_WHEEL, type ArtKey } from '@/art/Art';
import { COLORS, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import type { ChoiceDef, ParkContent } from '@/config/levels';
import type { HintTarget } from '@/components/HelperHand';
import { isPuppet, Puppet } from '@/components/Puppet';
import { addSun } from '@/components/Sun';
import { addBody, addTitle } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion, prefersReducedMotion } from '@/core/Device';
import { setPageBackground } from '@/core/PageBackground';
import { viewportMargin } from '@/core/Viewport';
import { BaseLevel } from './BaseLevel';

/** Piso de la plaza (abajo, izquierda) y del parque (arriba, derecha): el escalón mide 90 px. */
const LOW = 560;
const HIGH = 470;
const STEP_X = 700;
/** Muy ancho: el paisaje llena la pantalla completa (también la panorámica). */
const FAR = 1600;
/** Cuadro del paso 2 (frente al escalón): ahí aparece la rampa. */
const BOX = { w: 176, h: 136 };
const BOX_X = STEP_X - BOX.w / 2;
const BOX_Y = LOW - BOX.h / 2;
/** La rampa puesta va de (RAMP_X0, LOW) a (STEP_X, HIGH). */
const RAMP_X0 = STEP_X - BOX.w;
const RAMP_ANGLE = (Math.atan2(LOW - HIGH, STEP_X - RAMP_X0) * 180) / Math.PI;
/** Repisa del paso 1 y sus tarjetas. */
const SHELF = { x: 290, y: 205, w: 520, h: 190 };
const CARD = { w: 140, h: 150 };
const KID_SCALE = 0.8;
/** Cada niño tarda esto en llegar a su lugar del parque. */
const MOVE_MS = 1400;
const INK_TEXT = '#2B2848';

interface Card {
  def: ChoiceDef;
  box: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  homeY: number;
}

/**
 * Nivel 5 — Parque para todos (igualdad y no discriminación).
 * Paso 1: tocar un objeto de la repisa. Paso 2: tocar el escalón. Con la rampa, Sofía sube
 * rodando (la rueda gira) y los demás la siguen corriendo; aparece la ventana de victoria.
 * Todo el contenido (objetos, mensajes, niños y lugares) sale de config/levels.ts.
 */
export default class Level05Scene extends BaseLevel {
  protected readonly art: readonly ArtKey[] = [
    'nina-silla-cuerpo',
    'rueda-silla',
    'nino-a',
    'nina-b',
    'nino-c',
    'escalera',
    'rampa-baranda',
    'pelota',
    'balon',
    'pincel',
    'cuaderno',
    'lapiz',
  ];
  private c!: ParkContent;
  private stage: 'choose' | 'moving' | 'done' = 'choose';
  private cards: Card[] = [];
  private selected: Card | null = null;
  private kids = new Map<string, Phaser.GameObjects.Container>();
  private stepBox!: Phaser.GameObjects.Container;
  private badges: Phaser.GameObjects.Container[] = [];
  private wheel: Phaser.GameObjects.Image | null = null;
  private wheelLast: { x: number; y: number } | null = null;
  private sofia: Phaser.GameObjects.Container | null = null;
  private live: HTMLElement | null = null;

  constructor() {
    super('Level05');
  }

  override init(data?: unknown): void {
    super.init(data);
    this.stage = 'choose';
    this.cards = [];
    this.selected = null;
    this.kids = new Map();
    this.badges = [];
    this.wheel = null;
    this.wheelLast = null;
    this.sofia = null;
    this.live = null;
  }

  /** El título va en su placa naranja (la dibuja la escena). */
  protected override headerTitle(): string {
    return '';
  }

  protected override buildLevel(): void {
    this.c = this.contentOf('park');
    setPageBackground(
      this,
      { top: 0x9fd9ff, bottom: 0xf3dca0, split: LOW },
      { top: 0x9fd9ff, bottom: 0xb5553f, split: HIGH },
    );
    this.buildScenery();
    this.buildHeader();
    this.buildKids();
    this.buildShelf();
    this.buildStepBox();
    this.setupScreenReader();
    this.updateSteps();
  }

  // ------------------------------------------------------------------ escenario

  private buildScenery(): void {
    // Cielo en degradado.
    const sky = this.add.graphics().setDepth(0.1);
    sky.fillGradientStyle(0x7cc8f5, 0x7cc8f5, 0xc9ecff, 0xc9ecff, 1);
    sky.fillRect(-FAR, -FAR, GAME_WIDTH + FAR * 2, FAR + LOW);
    // Nubes.
    for (const [x, y, s] of [
      [470, 120, 1],
      [880, 90, 0.8],
      [200, 330, 0.7],
    ] as const) {
      this.cloud(x, y, s);
    }
    // Sol sonriente, igual al de la portada.
    addSun(this, 1180, 78, 0.62).setDepth(0.15);

    const g = this.add.graphics().setDepth(0.2);
    // Colinas verdes suaves detrás de la plaza.
    g.fillStyle(0xa6dd8f)
      .fillEllipse(80, LOW + 10, 520, 170)
      .fillEllipse(470, LOW + 20, 520, 140);
    g.fillStyle(0x92d27a).fillEllipse(-260, LOW + 20, 600, 190);
    // Plaza (baldosas) y muro de ladrillos: se dibujan UNA vez como imagen fija (rápido en
    // cualquier tableta), con margen para pantallas anchas.
    const m = viewportMargin(this.game);
    const extra = Math.max(600, m.x + 8);
    const left = -extra;
    const right = GAME_WIDTH + extra;
    const bottom = GAME_HEIGHT + Math.max(200, m.y + 8);
    const plazaKey = this.bakeOnce('park-plaza', STEP_X - left, bottom - LOW, (t, w, h) => {
      t.fillStyle(0xf3dca0).fillRect(0, 0, w, h);
      t.lineStyle(2, 0xdcc07e);
      for (let y = 26; y < h; y += 26) t.lineBetween(0, y, w, y);
      for (let row = 0, y = 0; y < h; y += 26, row++) {
        for (let x = row % 2 ? 26 : 0; x < w; x += 52) t.lineBetween(x, y, x, y + 26);
      }
    });
    this.add.image(left, LOW, plazaKey).setOrigin(0).setDepth(0.2);
    const wallKey = this.bakeOnce('park-wall', right - STEP_X, bottom - HIGH, (t, w, h) => {
      t.fillStyle(0xc4654a).fillRect(0, 0, w, h);
      for (let row = 0, y = 14; y < h; y += 24, row++) {
        for (let x = row % 2 ? -22 : 0; x < w; x += 44) {
          t.fillStyle(row % 3 === 0 ? 0xd1735a : 0xb85a41).fillRoundedRect(x + 2, y + 2, 40, 20, 4);
        }
      }
    });
    this.add.image(STEP_X, HIGH, wallKey).setOrigin(0).setDepth(0.2);
    const e = this.add.graphics().setDepth(0.25);
    e.fillStyle(COLORS.white, 0.35).fillRect(left, LOW + 3, STEP_X - left, 4);
    e.lineStyle(5, COLORS.ink).lineBetween(left, LOW, STEP_X, LOW);
    e.lineStyle(5, COLORS.ink).lineBetween(STEP_X, HIGH, STEP_X, bottom);
    // Pasto con borde y matitas.
    const g2 = e;
    // Pasto con borde y matitas.
    g2.fillStyle(0x7fd06b).fillRect(STEP_X, HIGH - 12, right - STEP_X, 18);
    g2.fillStyle(0x5fb04f).fillRect(STEP_X, HIGH + 2, right - STEP_X, 5);
    g2.lineStyle(4, COLORS.ink).strokeRect(STEP_X, HIGH - 12, right - STEP_X, 18);
    g2.fillStyle(0x5fb04f);
    for (let x = STEP_X + 14; x < right; x += 46) {
      g2.fillTriangle(x, HIGH - 12, x + 5, HIGH - 24, x + 10, HIGH - 12);
      g2.fillTriangle(x + 8, HIGH - 12, x + 14, HIGH - 21, x + 18, HIGH - 12);
    }
    this.buildPlayground();
  }

  /** Dibuja una imagen fija una sola vez (si cambia el tamaño, se vuelve a dibujar). */
  private bakeOnce(
    key: string,
    w: number,
    h: number,
    draw: (g: Phaser.GameObjects.Graphics, w: number, h: number) => void,
  ): string {
    const name = `${key}-${Math.ceil(w)}x${Math.ceil(h)}`;
    if (!this.textures.exists(name)) {
      const t = this.make.graphics({ x: 0, y: 0 }, false);
      draw(t, Math.ceil(w), Math.ceil(h));
      t.generateTexture(name, Math.ceil(w), Math.ceil(h));
      t.destroy();
    }
    return name;
  }

  private cloud(x: number, y: number, s: number): void {
    const g = this.add.graphics({ x, y }).setDepth(0.15).setScale(s);
    g.fillStyle(COLORS.white, 0.95)
      .fillCircle(-40, 6, 30)
      .fillCircle(0, -12, 40)
      .fillCircle(42, 4, 30)
      .fillRoundedRect(-70, 4, 140, 32, 16);
  }

  /** Columpio azul, tobogán amarillo con escalera y banderita, árbol de naranjas y flores. */
  private buildPlayground(): void {
    const g = this.add.graphics().setDepth(0.3);
    const top = HIGH - 12;
    // Columpio
    const sw = { l: 800, r: 990, y: top - 168 };
    g.lineStyle(13, COLORS.ink)
      .lineBetween(sw.l, top, sw.l + 22, sw.y)
      .lineBetween(sw.l + 50, top, sw.l + 22, sw.y)
      .lineBetween(sw.r, top, sw.r - 22, sw.y)
      .lineBetween(sw.r - 50, top, sw.r - 22, sw.y)
      .lineBetween(sw.l + 10, sw.y, sw.r - 10, sw.y);
    g.lineStyle(7, 0x3f7fd0)
      .lineBetween(sw.l, top, sw.l + 22, sw.y)
      .lineBetween(sw.l + 50, top, sw.l + 22, sw.y)
      .lineBetween(sw.r, top, sw.r - 22, sw.y)
      .lineBetween(sw.r - 50, top, sw.r - 22, sw.y)
      .lineBetween(sw.l + 10, sw.y, sw.r - 10, sw.y);
    g.lineStyle(3, COLORS.ink)
      .lineBetween(870, sw.y, 870, top - 52)
      .lineBetween(920, sw.y, 920, top - 52);
    g.fillStyle(COLORS.pink).fillRoundedRect(858, top - 56, 74, 14, 6);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(858, top - 56, 74, 14, 6);
    // Tobogán: escalera, plataforma, rampa amarilla y banderita verde.
    const tx = 1140;
    const ty = top - 150;
    g.lineStyle(9, COLORS.ink)
      .lineBetween(tx, top, tx, ty)
      .lineBetween(tx + 40, top, tx + 40, ty);
    g.lineStyle(5, 0xd9534f)
      .lineBetween(tx, top, tx, ty)
      .lineBetween(tx + 40, top, tx + 40, ty);
    g.lineStyle(4, COLORS.ink);
    for (let y = top - 22; y > ty + 6; y -= 24) g.lineBetween(tx, y, tx + 40, y);
    g.fillStyle(0xd9534f).fillRoundedRect(tx - 8, ty - 10, 58, 14, 5);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(tx - 8, ty - 10, 58, 14, 5);
    g.lineStyle(20, COLORS.ink).lineBetween(tx - 4, ty, tx - 110, top - 6);
    g.lineStyle(13, COLORS.sun).lineBetween(tx - 4, ty, tx - 110, top - 6);
    g.lineStyle(4, COLORS.ink).lineBetween(tx + 46, ty - 10, tx + 46, ty - 48);
    g.fillStyle(0x3aa655).fillTriangle(tx + 46, ty - 48, tx + 74, ty - 40, tx + 46, ty - 32);
    g.lineStyle(3, COLORS.ink).strokeTriangle(tx + 46, ty - 48, tx + 74, ty - 40, tx + 46, ty - 32);
    // Árbol redondo con naranjas.
    const ax = 1240;
    g.fillStyle(0x8a5a32).fillRoundedRect(ax - 11, top - 90, 22, 92, 6);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(ax - 11, top - 90, 22, 92, 6);
    for (const [dx, dy, r] of [
      [-30, -110, 40],
      [28, -112, 40],
      [0, -150, 46],
    ] as const) {
      g.fillStyle(COLORS.ink).fillCircle(ax + dx, top + dy, r + 3);
    }
    for (const [dx, dy, r] of [
      [-30, -110, 40],
      [28, -112, 40],
      [0, -150, 46],
    ] as const) {
      g.fillStyle(0x4fb35a).fillCircle(ax + dx, top + dy, r);
    }
    g.fillStyle(0x6cc35a).fillCircle(ax - 14, top - 160, 18);
    for (const [dx, dy] of [
      [-34, -116],
      [20, -140],
      [32, -100],
      [-6, -170],
      [-20, -140],
    ] as const) {
      g.fillStyle(COLORS.orange).fillCircle(ax + dx, top + dy, 7);
      g.lineStyle(2, COLORS.ink).strokeCircle(ax + dx, top + dy, 7);
    }
    // Florecitas.
    for (const [fx, c] of [
      [742, COLORS.white],
      [790, COLORS.pink],
      [1030, COLORS.sun],
      [1186, COLORS.pink],
    ] as const) {
      g.lineStyle(3, 0x3e9a4c).lineBetween(fx, top, fx, top - 22);
      for (let k = 0; k < 5; k++) {
        const a = (k * 2 * Math.PI) / 5;
        g.fillStyle(c).fillCircle(fx + Math.cos(a) * 5, top - 26 + Math.sin(a) * 5, 4.5);
      }
      g.fillStyle(COLORS.sun).fillCircle(fx, top - 26, 3);
    }
    // Letrero verde "Parque".
    const sign = this.add.container(860, 228).setDepth(0.35);
    const sg = this.add.graphics();
    sg.fillStyle(COLORS.ink, 0.2).fillRoundedRect(-62, -20, 124, 46, 14);
    sg.fillStyle(0x3aa655).fillRoundedRect(-62, -24, 124, 46, 14);
    sg.lineStyle(4, COLORS.ink).strokeRoundedRect(-62, -24, 124, 46, 14);
    sign.add([sg, addTitle(this, 0, -2, 'Parque', 26, { color: '#FFFFFF' })]);
  }

  /** Placa naranja con el ícono de dos personitas y el título. */
  private buildHeader(): void {
    const title = addTitle(this, 0, 0, this.level.title, 32, { color: '#FFFFFF' });
    const w = title.width + 120;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.22).fillRoundedRect(-w / 2, -28, w, 66, 22);
    g.fillStyle(0xe8701f).fillRoundedRect(-w / 2, -32, w, 66, 22);
    g.fillStyle(COLORS.orange).fillRoundedRect(-w / 2, -32, w, 56, 22);
    g.fillStyle(COLORS.white, 0.25).fillRoundedRect(-w / 2 + 16, -26, w - 32, 12, 6);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(-w / 2, -32, w, 66, 22);
    // Ícono: dos personitas.
    const ix = -w / 2 + 44;
    g.fillStyle(COLORS.white).fillCircle(ix, 0, 22);
    g.lineStyle(3, COLORS.ink).strokeCircle(ix, 0, 22);
    for (const [dx, col] of [
      [-7, COLORS.grape],
      [8, COLORS.turquoise],
    ] as const) {
      g.fillStyle(col)
        .fillCircle(ix + dx, -6, 6)
        .fillRoundedRect(ix + dx - 7, 1, 14, 12, 6);
    }
    title.setPosition(20, -2);
    this.add.container(GAME_WIDTH / 2, 46, [g, title]).setDepth(DEPTH.ui);
  }

  // ------------------------------------------------------------------ niños

  private buildKids(): void {
    this.c.kids.forEach((k) => {
      let body: Phaser.GameObjects.GameObject[];
      let h: number;
      let w: number;
      if (k.wheelchair) {
        // Silla con la rueda grande aparte: así la rueda gira al avanzar.
        const chair = artImage(this, 0, 0, 'nina-silla-cuerpo').setScale(KID_SCALE);
        const wheel = artImage(
          this,
          (SOFIA_WHEEL.x - chair.width / 2) * KID_SCALE,
          (SOFIA_WHEEL.y - chair.height / 2) * KID_SCALE,
          'rueda-silla',
        ).setScale(KID_SCALE);
        this.wheel = wheel;
        body = [wheel, chair];
        h = chair.displayHeight;
        w = chair.displayWidth;
      } else if (isPuppet(k.art)) {
        h = PEOPLE[k.art].h * KID_SCALE;
        w = PEOPLE[k.art].w * KID_SCALE;
        const pup = new Puppet(this, 0, h / 2, k.art).setScale(KID_SCALE);
        for (const t of k.holds ?? []) {
          const img = artImage(this, 0, 0, t.art);
          img.setScale(t.size / Math.max(img.width, img.height)).setAngle(t.angle ?? 0);
          pup.hold(t.side, img, t.dx ?? 0, t.dy ?? 0, t.raise ?? false);
        }
        body = [pup];
      } else {
        const img = artImage(this, 0, 0, k.art).setScale(KID_SCALE);
        h = img.displayHeight;
        w = img.displayWidth;
        body = [img];
      }
      // Sombra en el piso y etiqueta blanca con el nombre.
      const shadow = this.add.ellipse(0, h / 2 - 2, w * 0.7, 12, COLORS.ink, 0.15);
      const name = addBody(this, 0, h / 2 + 22, k.label, 16, { color: INK_TEXT });
      const tw = name.width + 24;
      const tag = this.add.graphics();
      tag.fillStyle(COLORS.white).fillRoundedRect(-tw / 2, h / 2 + 9, tw, 27, 13);
      tag.lineStyle(3, COLORS.ink).strokeRoundedRect(-tw / 2, h / 2 + 9, tw, 27, 13);
      const kid = this.add
        .container(k.x, LOW - h / 2, [shadow, ...body, tag, name])
        .setDepth(2)
        .setSize(Math.max(90, w), h);
      kid.setData('label', [tag, name]);
      this.kids.set(k.id, kid);
      if (k.wheelchair) this.sofia = kid;
    });
  }

  private puppetOf(kid: Phaser.GameObjects.Container): Puppet | null {
    return (kid.list.find((o) => o instanceof Puppet) as Puppet | undefined) ?? null;
  }

  // ------------------------------------------------------------------ paso 1: la repisa

  /** Círculo amarillo con el número del paso. */
  private badge(x: number, y: number, n: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.2).fillCircle(2, 4, 21);
    g.fillStyle(COLORS.sun).fillCircle(0, 0, 21);
    g.lineStyle(4, COLORS.ink).strokeCircle(0, 0, 21);
    const b = this.add.container(x, y, [g, addTitle(this, 0, 2, String(n), 24)]).setDepth(6);
    this.badges.push(b);
    return b;
  }

  private buildShelf(): void {
    const { x, y, w, h } = SHELF;
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(COLORS.ink, 0.22).fillRoundedRect(x - w / 2 + 4, y - h / 2 + 10, w, h, 24);
    g.fillStyle(0x9a6b3f).fillRoundedRect(x - w / 2, y - h / 2, w, h, 24);
    g.fillStyle(0xc68d55).fillRoundedRect(x - w / 2 + 12, y - h / 2 + 12, w - 24, h - 24, 16);
    g.lineStyle(2, 0xa9733f, 0.6);
    for (let k = 0; k < 7; k++) {
      const yy = y - h / 2 + 26 + k * 22;
      g.beginPath();
      g.moveTo(x - w / 2 + 20, yy);
      for (let xx = x - w / 2 + 20; xx <= x + w / 2 - 20; xx += 30) {
        g.lineTo(xx, yy + Math.sin(xx / 50 + k) * 3);
      }
      g.strokePath();
    }
    g.fillStyle(0x7d5430).fillRect(x - w / 2 + 12, y + h / 2 - 26, w - 24, 14);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 24);
    // Paso 1 con su etiqueta.
    this.badge(x - w / 2 + 14, y - h / 2 + 2, 1);
    const tag = addBody(this, 0, 0, 'Toca un objeto', 16, { color: INK_TEXT });
    const tw = tag.width + 26;
    const tg = this.add.graphics();
    tg.fillStyle(COLORS.white).fillRoundedRect(-tw / 2, -16, tw, 32, 16);
    tg.lineStyle(3, COLORS.ink).strokeRoundedRect(-tw / 2, -16, tw, 32, 16);
    this.add.container(x - w / 2 + 50 + tw / 2, y - h / 2 + 2, [tg, tag]).setDepth(6);

    const n = this.c.options.length;
    const gap = CARD.w + 22;
    this.c.options.forEach((def, i) => {
      const cx = x + (i - (n - 1) / 2) * gap;
      const cy = y + 6;
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.ink, 0.2).fillRoundedRect(
        -CARD.w / 2 + 3,
        -CARD.h / 2 + 6,
        CARD.w,
        CARD.h,
        18,
      );
      bg.fillStyle(COLORS.white).fillRoundedRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 18);
      bg.lineStyle(4, COLORS.ink).strokeRoundedRect(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 18);
      const ring = this.add.graphics().setVisible(false);
      ring
        .lineStyle(7, 0x2f9bff)
        .strokeRoundedRect(-CARD.w / 2 - 6, -CARD.h / 2 - 6, CARD.w + 12, CARD.h + 12, 22);
      const img = artImage(this, 0, -16, def.art);
      img.setScale(Math.min(96 / img.width, 84 / img.height));
      const label = addBody(this, 0, CARD.h / 2 - 24, def.label, 18, { color: INK_TEXT });
      const box = this.add.container(cx, cy, [ring, bg, img, label]).setDepth(4);
      box.setSize(CARD.w, CARD.h).setInteractive({ useHandCursor: true });
      const card: Card = { def, box, ring, homeY: cy };
      box.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tapCard(card));
      this.cards.push(card);
    });
  }

  private tapCard(card: Card): void {
    if (this.stage !== 'choose') return;
    AudioManager.sfx('pop', { pitch: 1.3 });
    this.select(this.selected === card ? null : card);
  }

  /** Escoge (se levanta, crece y se marca en azul) o deselecciona. */
  private select(card: Card | null): void {
    for (const c of this.cards) {
      const on = c === card;
      c.ring.setVisible(on);
      this.tweens.killTweensOf(c.box);
      this.tweens.add({
        targets: c.box,
        y: on ? c.homeY - 12 : c.homeY,
        scale: on ? 1.08 : 1,
        angle: 0,
        duration: motion(160),
        ease: 'Back.easeOut',
      });
    }
    this.selected = card;
    this.updateSteps();
  }

  /** La tarjeta se sacude (no era ese objeto). */
  private shake(card: Card): void {
    this.tweens.add({
      targets: card.box,
      angle: { from: -7, to: 7 },
      duration: motion(70),
      yoyo: true,
      repeat: 3,
      onComplete: () => card.box.setAngle(0),
    });
  }

  // ------------------------------------------------------------------ paso 2: el escalón

  private buildStepBox(): void {
    const g = this.add.graphics();
    g.fillStyle(0xd7ecff, 0.75).fillRoundedRect(-BOX.w / 2, -BOX.h / 2, BOX.w, BOX.h, 18);
    dashedRect(g, -BOX.w / 2, -BOX.h / 2, BOX.w, BOX.h, 0x2f7fe0);
    const q = addTitle(this, 0, -16, '?', 56, { color: '#2F7FE0' });
    const t = addBody(this, 0, 36, 'Toca aquí', 18, { color: INK_TEXT });
    this.stepBox = this.add.container(BOX_X, BOX_Y, [g, q, t]).setDepth(3);
    this.stepBox.setSize(BOX.w, BOX.h).setInteractive({ useHandCursor: true });
    this.stepBox.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tapStep());
    this.badge(BOX_X - BOX.w / 2 + 6, BOX_Y - BOX.h / 2 + 4, 2);
  }

  /** Marca el paso que toca: sin objeto late el 1; con objeto, el 2 y el cuadro del escalón. */
  private updateSteps(): void {
    const [b1, b2] = this.badges;
    const active = this.stage !== 'choose' ? null : this.selected ? b2 : b1;
    for (const b of this.badges) {
      this.tweens.killTweensOf(b);
      b.setScale(1);
    }
    this.tweens.killTweensOf(this.stepBox);
    this.stepBox.setScale(1);
    if (!active || prefersReducedMotion()) return;
    this.tweens.add({
      targets: active,
      scale: 1.18,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    if (active === b2) {
      this.tweens.add({
        targets: this.stepBox,
        scale: 1.05,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private tapStep(): void {
    if (this.stage !== 'choose') return;
    const card = this.selected;
    if (!card) {
      this.bubble.setTone('normal');
      void this.say(this.c.needObject);
      return;
    }
    if (!card.def.correct) {
      this.shake(card);
      this.select(null);
      if (card.def.hint) {
        this.mistake(card.def.hint);
        this.bubble.setTone('oops');
      }
      return;
    }
    void this.placeRamp(card);
  }

  // ------------------------------------------------------------------ ¡la rampa!

  private async placeRamp(card: Card): Promise<void> {
    this.stage = 'moving';
    this.updateSteps();
    this.stepBox.disableInteractive();
    this.tweens.add({ targets: this.stepBox, alpha: 0, scale: 0.8, duration: motion(250) });
    this.badges[1]?.setVisible(false);
    this.tweens.add({ targets: card.box, alpha: 0.4, scale: 1, y: card.homeY, duration: 200 });
    card.ring.setVisible(false);

    // La rampa de madera con baranda aparece pegada al escalón.
    const ramp = artImage(this, STEP_X, LOW, 'rampa-baranda').setOrigin(196 / 200, 126 / 132);
    ramp.setScale(BOX.w / 192, (LOW - HIGH) / 90).setDepth(1);
    const sx = ramp.scaleX;
    const sy = ramp.scaleY;
    ramp.setScale(sx, 0);
    this.tweens.add({ targets: ramp, scaleY: sy, duration: motion(420), ease: 'Back.easeOut' });
    this.effects.sparkleAt(STEP_X - BOX.w / 2, HIGH + 30, 12);
    this.correct(STEP_X - BOX.w / 2, HIGH - 70, null);
    this.bubble.setTone('good');
    const talk = this.say(this.c.rampDone);
    await this.wait(motion(450));
    if (!this.alive) return;

    if (prefersReducedMotion()) {
      // Sin animaciones: todos aparecen directamente en el parque.
      this.c.kids.forEach((k) => {
        const kid = this.kids.get(k.id);
        if (kid) kid.setPosition(k.spot, HIGH - 12 - kid.height / 2);
      });
    } else {
      // Sofía sube rodando primero y los demás la siguen corriendo.
      const order = [...this.c.kids].sort(
        (a, b) => Number(!!b.wheelchair) - Number(!!a.wheelchair),
      );
      order.forEach((k, i) => {
        const kid = this.kids.get(k.id);
        if (!kid) return;
        this.time.delayedCall(i * 380, () => {
          if (k.wheelchair) this.rollUp(kid, k.spot);
          else this.runUp(kid, k.spot);
        });
      });
      await this.wait(MOVE_MS + 3 * 380 + 200);
    }
    await talk;
    if (!this.alive) return;
    this.celebrate();
    await this.wait(2000);
    if (this.alive) void this.complete();
  }

  /** Recorrido: hasta el pie de la rampa, la sube y llega a su lugar (en 1.4 s en total). */
  private path(
    kid: Phaser.GameObjects.Container,
    spot: number,
  ): { x: number; y: number; t: number }[] {
    const half = kid.height / 2;
    const low = LOW - half;
    const high = HIGH - 12 - half;
    const a = Math.max(0, RAMP_X0 - kid.x);
    const b = STEP_X - RAMP_X0;
    const c = Math.abs(spot - STEP_X);
    const total = a + b * 1.2 + c || 1;
    return [
      { x: RAMP_X0 - 4, y: low, t: (a / total) * MOVE_MS },
      { x: STEP_X + 8, y: high, t: ((b * 1.2) / total) * MOVE_MS },
      { x: spot, y: high, t: (c / total) * MOVE_MS },
    ];
  }

  /** Sofía rueda: la rueda gira (ver update) y la silla se inclina en la rampa. */
  private rollUp(kid: Phaser.GameObjects.Container, spot: number): void {
    const [p1, p2, p3] = this.path(kid, spot);
    if (!p1 || !p2 || !p3) return;
    this.wheelLast = { x: kid.x, y: kid.y };
    this.tweens.chain({
      targets: kid,
      tweens: [
        { x: p1.x, duration: Math.max(1, p1.t), ease: 'Sine.easeIn' },
        { x: p2.x, y: p2.y - 8, angle: -RAMP_ANGLE, duration: p2.t * 0.85 },
        { x: p2.x + 18, y: p2.y, angle: 0, duration: p2.t * 0.15 + 80 },
        { x: p3.x, duration: p3.t, ease: 'Sine.easeOut' },
      ],
      onComplete: () => this.effects.sparkleAt(spot, p3.y - 30, 10),
    });
  }

  /** Los niños corren como en la carrera (piernas y brazos), suben la rampa y llegan. */
  private runUp(kid: Phaser.GameObjects.Container, spot: number): void {
    const [p1, p2, p3] = this.path(kid, spot);
    if (!p1 || !p2 || !p3) return;
    const pup = this.puppetOf(kid);
    pup?.setMode('run');
    AudioManager.sfx('pop', { pitch: 1.2 + Math.random() * 0.3 });
    this.tweens.chain({
      targets: kid,
      tweens: [
        { x: p1.x, duration: Math.max(1, p1.t) },
        { x: p2.x, y: p2.y, duration: p2.t },
        { x: p3.x, duration: p3.t, ease: 'Sine.easeOut' },
      ],
      onComplete: () => pup?.setMode('idle'),
    });
  }

  /** ¡Todos adentro! Saltan de alegría. */
  private celebrate(): void {
    this.stage = 'done';
    AudioManager.sfx('success');
    this.effects.confettiAt(980, 260, 40);
    if (prefersReducedMotion()) return;
    [...this.kids.values()].forEach((k, i) => {
      const pup = this.puppetOf(k);
      const y0 = k.y;
      this.tweens.add({
        targets: k,
        y: y0 - 30,
        duration: 260,
        yoyo: true,
        repeat: 3,
        delay: i * 90,
        ease: 'Quad.easeOut',
        onStart: () => pup?.setMode('jump'),
        onYoyo: () => pup?.setMode('idle'),
        onRepeat: () => pup?.setMode('jump'),
        onComplete: () => {
          k.y = y0;
          pup?.setMode('idle');
        },
      });
    });
  }

  // ------------------------------------------------------------------ ayuda y accesibilidad

  protected override onIntroDone(): void {
    this.enableIdleHint();
  }

  protected override say(lines: Parameters<BaseLevel['say']>[0]): Promise<void> {
    const list = Array.isArray(lines) ? lines : [lines];
    this.announce(list.map((l) => l.text).join(' '));
    return super.say(lines);
  }

  /** Lista oculta para lectores de pantalla (objetos, escalón y niños) y región aria-live. */
  private setupScreenReader(): void {
    const box = document.createElement('div');
    box.setAttribute(
      'style',
      'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap',
    );
    const objs = document.createElement('div');
    objs.setAttribute('role', 'group');
    objs.setAttribute('aria-label', 'Paso 1: objetos');
    this.cards.forEach((c) => {
      const b = document.createElement('button');
      b.textContent = `Objeto: ${c.def.label}`;
      b.addEventListener('click', () => this.tapCard(c));
      objs.appendChild(b);
    });
    const step = document.createElement('button');
    step.textContent = 'Paso 2: el escalón del parque. Toca aquí.';
    step.addEventListener('click', () => this.tapStep());
    const kids = document.createElement('ul');
    kids.setAttribute('aria-label', 'Niños en la plaza');
    this.c.kids.forEach((k) => {
      const li = document.createElement('li');
      li.textContent = k.wheelchair ? `${k.label}, usa silla de ruedas` : k.label;
      kids.appendChild(li);
    });
    const live = document.createElement('p');
    live.setAttribute('aria-live', 'polite');
    box.append(objs, step, kids, live);
    document.body.appendChild(box);
    this.live = live;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      box.remove();
      this.live = null;
    });
  }

  private announce(text: string): void {
    if (this.live) this.live.textContent = text;
  }

  protected override getHint(): HintTarget | null {
    if (this.stage !== 'choose') return null;
    if (!this.selected) {
      const good = this.cards.find((c) => c.def.correct);
      return good ? { kind: 'tap', x: good.box.x, y: good.box.y } : null;
    }
    return { kind: 'tap', x: BOX_X, y: BOX_Y };
  }

  /** La rueda de la silla gira según lo que avanza; su nombre se queda derecho. */
  override update(): void {
    const sofia = this.sofia;
    if (!sofia || !this.wheel || !this.wheelLast) return;
    const dx = sofia.x - this.wheelLast.x;
    const dy = sofia.y - this.wheelLast.y;
    this.wheel.rotation += (Math.hypot(dx, dy) * (dx >= 0 ? 1 : -1)) / (SOFIA_WHEEL.r * KID_SCALE);
    this.wheelLast = { x: sofia.x, y: sofia.y };
    const label = sofia.getData('label') as
      (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] | undefined;
    label?.forEach((o) => o.setAngle(-sofia.angle));
  }
}

/** Rectángulo redondeado punteado. */
function dashedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void {
  g.lineStyle(5, color);
  const dash = 12;
  const gap = 8;
  const seg = (x1: number, y1: number, x2: number, y2: number): void => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < len; d += dash + gap) {
      const t1 = d / len;
      const t2 = Math.min(1, (d + dash) / len);
      g.lineBetween(
        x1 + (x2 - x1) * t1,
        y1 + (y2 - y1) * t1,
        x1 + (x2 - x1) * t2,
        y1 + (y2 - y1) * t2,
      );
    }
  };
  const r = 16;
  seg(x + r, y, x + w - r, y);
  seg(x + w, y + r, x + w, y + h - r);
  seg(x + w - r, y + h, x + r, y + h);
  seg(x, y + h - r, x, y + r);
  g.beginPath();
  g.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
  g.strokePath();
  g.beginPath();
  g.arc(x + w - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI);
  g.strokePath();
  g.beginPath();
  g.arc(x + w - r, y + h - r, r, 0, 0.5 * Math.PI);
  g.strokePath();
  g.beginPath();
  g.arc(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI);
  g.strokePath();
}
