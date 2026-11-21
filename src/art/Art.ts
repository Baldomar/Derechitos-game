import type Phaser from 'phaser';
import { COLORS } from '@/config/theme';

/**
 * Ilustraciones placeholder vectoriales ORIGINALES (estilo libro infantil plano).
 * Cada dibujo se convierte en textura solo cuando una escena lo necesita
 * (equivalente a un "atlas por escena", sin descargar nada).
 * Para reemplazarlas por arte final: cargar una imagen con la clave `art-<nombre>`
 * antes de usarla y ensureArt() respetará la existente.
 */

type G = Phaser.GameObjects.Graphics;
const INK = COLORS.ink;
const LW = 4;

// ------------------------------------------------------------------ primitivas

function circle(g: G, x: number, y: number, r: number, fill: number, lw = LW): void {
  g.fillStyle(fill).fillCircle(x, y, r);
  if (lw) g.lineStyle(lw, INK).strokeCircle(x, y, r);
}
function ellipse(g: G, x: number, y: number, w: number, h: number, fill: number, lw = LW): void {
  g.fillStyle(fill).fillEllipse(x, y, w, h);
  if (lw) g.lineStyle(lw, INK).strokeEllipse(x, y, w, h);
}
function rect(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: number,
  lw = LW,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  if (rr > 0) {
    g.fillStyle(fill).fillRoundedRect(x, y, w, h, rr);
    if (lw) g.lineStyle(lw, INK).strokeRoundedRect(x, y, w, h, rr);
  } else {
    g.fillStyle(fill).fillRect(x, y, w, h);
    if (lw) g.lineStyle(lw, INK).strokeRect(x, y, w, h);
  }
}
function poly(g: G, pts: number[], fill: number, lw = LW): void {
  const p: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length; i += 2) p.push({ x: pts[i] ?? 0, y: pts[i + 1] ?? 0 });
  g.fillStyle(fill).fillPoints(p, true);
  if (lw) g.lineStyle(lw, INK).strokePoints(p, true, true);
}
function line(
  g: G,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w = LW,
  color: number = INK,
): void {
  g.lineStyle(w, color).lineBetween(x1, y1, x2, y2);
}
function arc(
  g: G,
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
  w = LW,
  color: number = INK,
): void {
  g.lineStyle(w, color);
  g.beginPath();
  g.arc(x, y, r, a0, a1);
  g.strokePath();
}
function star(g: G, cx: number, cy: number, r: number, fill: number, lw = 3): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  poly(g, pts, fill, lw);
}
const PI = Math.PI;

type Pt = { x: number; y: number };

/** Curva suave cerrada (Catmull-Rom) que pasa por los puntos dados. */
function smooth(pts: readonly (readonly [number, number])[], steps = 6): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[(i - 1 + n) % n] ?? [0, 0];
    const [x1, y1] = pts[i] ?? [0, 0];
    const [x2, y2] = pts[(i + 1) % n] ?? [0, 0];
    const [x3, y3] = pts[(i + 2) % n] ?? [0, 0];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(x0, x1, x2, x3), y: f(y0, y1, y2, y3) });
    }
  }
  return out;
}

/** Hoja con forma de gota alargada, de la base (bx,by) a la punta (tx,ty), con nervadura. */
function leaf(
  g: G,
  bx: number,
  by: number,
  tx: number,
  ty: number,
  w: number,
  fill: number,
  lw = 3,
): void {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: Pt[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k = Math.sin(PI * t) ** 0.8 * (1 - t * 0.25) * (w / 2);
    pts.push({ x: bx + dx * t + nx * k, y: by + dy * t + ny * k });
  }
  for (let i = n - 1; i > 0; i--) {
    const t = i / n;
    const k = Math.sin(PI * t) ** 0.8 * (1 - t * 0.25) * (w / 2);
    pts.push({ x: bx + dx * t - nx * k, y: by + dy * t - ny * k });
  }
  g.fillStyle(fill).fillPoints(pts, true);
  g.lineStyle(2, darker(fill, 0.35), 0.9).lineBetween(bx, by, bx + dx * 0.85, by + dy * 0.85);
  if (lw) g.lineStyle(lw, INK).strokePoints(pts, true, true);
}

/** Contorno de corazón (curva clásica) centrado en (cx, cy) con ancho aproximado w. */
function heartPts(cx: number, cy: number, w: number): Pt[] {
  const k = w / 34;
  const pts: Pt[] = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * 2 * PI;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x: cx + x * k, y: cy - y * k });
  }
  return pts;
}

/** Corazón con brillo y contorno. */
function heart(g: G, cx: number, cy: number, w: number, fill: number): void {
  const pts = heartPts(cx, cy, w);
  g.fillStyle(darker(fill, 0.18)).fillPoints(
    pts.map((p) => ({ x: p.x + 3, y: p.y + 4 })),
    true,
  );
  g.fillStyle(fill).fillPoints(pts, true);
  g.fillStyle(COLORS.white, 0.35).fillEllipse(cx - w * 0.24, cy - w * 0.2, w * 0.2, w * 0.12);
  g.lineStyle(LW, INK).strokePoints(pts, true, true);
}

/** Destello de cuatro puntas (brillito). */
function sparkle(g: G, x: number, y: number, r: number, fill: number): void {
  poly(
    g,
    [
      x,
      y - r,
      x + r * 0.28,
      y - r * 0.28,
      x + r,
      y,
      x + r * 0.28,
      y + r * 0.28,
      x,
      y + r,
      x - r * 0.28,
      y + r * 0.28,
      x - r,
      y,
      x - r * 0.28,
      y - r * 0.28,
    ],
    fill,
    2,
  );
}

// ------------------------------------------------------------------ personas

const SKIN = [0xf5d5b8, 0xf2c9a0, 0xd9a072, 0xa86b45, 0x6e4430] as const;
const HAIR = { brown: 0x5a3825, black: 0x2b2222, gray: 0xd0d0d0, blond: 0xe8c26a } as const;

interface PersonOpts {
  skin: number;
  hair: number;
  style: 'short' | 'long' | 'curly' | 'bun' | 'braids';
  shirt: number;
  pants: number;
  adult?: boolean;
  skirt?: boolean;
  coat?: boolean;
  hat?: 'chef' | 'beret';
  wheelchair?: boolean;
  beard?: boolean;
  /** Sin piernas ni brazos: el torso de un muñeco articulado (se animan aparte). */
  noLimbs?: boolean;
  /** Dibujo en la camiseta. */
  deco?: 'star' | 'dots' | 'heart' | 'stripe' | 'stripes';
  /** Color de los zapatos (por defecto: rojos los niños, cafés los adultos). */
  shoes?: number;
  glasses?: boolean;
  /** Moño en el pelo (color). */
  bow?: number;
  freckles?: boolean;
  /** Silla de ruedas sin la rueda grande (la rueda va aparte para que pueda girar). */
  noWheel?: boolean;
  /** Color de las ligas de las colitas. */
  ties?: number;
  /** Cuellito blanco redondo (vestido). */
  collar?: boolean;
  /** Diadema (color). */
  headband?: number;
}

/** Oscurece un color (f entre 0 y 1). */
function darker(color: number, f: number): number {
  const ch = (sh: number): number => Math.round(((color >> sh) & 255) * (1 - f));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Aclara un color hacia el blanco (f entre 0 y 1). */
function lighter(color: number, f: number): number {
  const ch = (sh: number): number => {
    const c = (color >> sh) & 255;
    return Math.round(c + (255 - c) * f);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Proporciones del cuerpo (estilo "cabezón": cabeza grande, cuerpo pequeño). */
interface BodyGeom {
  adult: boolean;
  chair: boolean;
  cx: number;
  headR: number;
  headY: number;
  bodyTop: number;
  bodyH: number;
  bodyW: number;
  legTop: number;
  legH: number;
  legW: number;
  hipX: number;
  armW: number;
  armTop: number;
  armLen: number;
  sleeve: number;
  shoulderX: number;
  bottom: number;
  seatY: number;
}

function bodyGeom(w: number, h: number, o: PersonOpts): BodyGeom {
  const adult = o.adult === true;
  const chair = o.wheelchair === true;
  const cx = chair ? w / 2 - 14 : w / 2;
  const headR = adult ? 29 : chair ? 31 : 34;
  const bodyH = adult ? 62 : 40;
  const bodyW = adult ? 50 : 42;
  const legH = adult ? 58 : 34;
  const legW = adult ? 15 : 13;
  const armW = adult ? 13 : 11;
  const bottom = h - 8;
  const legTop = bottom - legH;
  const seatY = h - 62;
  const bodyTop = chair ? seatY - 6 - bodyH : legTop - bodyH;
  const armLen = adult ? bodyH * 0.8 : 36;
  return {
    adult,
    chair,
    cx,
    headR,
    headY: bodyTop - headR + 9,
    bodyTop,
    bodyH,
    bodyW,
    legTop,
    legH,
    legW,
    hipX: adult ? 10.5 : 8.5,
    armW,
    armTop: bodyTop + 5,
    armLen,
    sleeve: o.coat || adult ? armLen * 0.85 : 13,
    shoulderX: bodyW / 2 + armW / 2 - 3,
    bottom,
    seatY,
  };
}

/** Cara: ojos grandes con brillos, cejas, naricita, sonrisa abierta y cachetes. */
function face(g: G, cx: number, cy: number, r: number, o: PersonOpts): void {
  const brow = o.hair === HAIR.gray ? 0x8a8a8a : darker(o.hair, 0.1);
  const girl = o.skirt === true || o.style === 'long' || o.style === 'braids' || o.style === 'bun';
  const ex = r * 0.38;
  const ey = cy + r * 0.12;
  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    g.fillStyle(0x3a2418).fillEllipse(x, ey, r * 0.34, r * 0.42);
    g.fillStyle(0x7a4a2c).fillEllipse(x, ey + r * 0.08, r * 0.22, r * 0.18);
    g.fillStyle(0x1d120c).fillEllipse(x, ey - r * 0.01, r * 0.15, r * 0.19);
    g.lineStyle(2.2, INK).strokeEllipse(x, ey, r * 0.34, r * 0.42);
    g.fillStyle(COLORS.white).fillCircle(x + r * 0.06, ey - r * 0.09, r * 0.085);
    g.fillStyle(COLORS.white).fillCircle(x - r * 0.07, ey + r * 0.09, r * 0.04);
    if (girl) {
      g.lineStyle(2.2, INK)
        .lineBetween(x + s * r * 0.15, ey - r * 0.13, x + s * r * 0.25, ey - r * 0.2)
        .lineBetween(x + s * r * 0.17, ey - r * 0.05, x + s * r * 0.27, ey - r * 0.09);
    }
    g.lineStyle(Math.max(2.5, r * 0.075), brow);
    g.beginPath();
    g.arc(x, ey - r * 0.12, r * 0.2, 1.25 * PI, 1.75 * PI);
    g.strokePath();
  }
  // Naricita
  g.fillStyle(darker(o.skin, 0.18)).fillEllipse(cx, cy + r * 0.32, r * 0.11, r * 0.07);
  // Sonrisa abierta con lengüita
  const my = cy + r * 0.42;
  const mr = r * 0.2;
  g.fillStyle(0x8c2f39);
  g.beginPath();
  g.arc(cx, my, mr, 0, PI);
  g.closePath();
  g.fillPath();
  g.fillStyle(0xff8a9a).fillEllipse(cx, my + mr * 0.62, mr * 1.05, mr * 0.55);
  g.fillStyle(COLORS.white).fillRect(cx - mr * 0.6, my, mr * 1.2, mr * 0.22);
  g.lineStyle(2.5, INK).beginPath();
  g.arc(cx, my, mr, 0, PI);
  g.closePath();
  g.strokePath();
  // Cachetes
  g.fillStyle(COLORS.coral, 0.42)
    .fillEllipse(cx - r * 0.64, cy + r * 0.38, r * 0.32, r * 0.18)
    .fillEllipse(cx + r * 0.64, cy + r * 0.38, r * 0.32, r * 0.18);
  if (o.freckles) {
    g.fillStyle(darker(o.skin, 0.35));
    for (const s of [-1, 1]) {
      g.fillCircle(cx + s * r * 0.55, cy + r * 0.28, 1.4)
        .fillCircle(cx + s * r * 0.68, cy + r * 0.3, 1.4)
        .fillCircle(cx + s * r * 0.61, cy + r * 0.4, 1.4);
    }
  }
  if (o.glasses) {
    g.lineStyle(3, INK);
    for (const s of [-1, 1]) g.strokeCircle(cx + s * ex, ey, r * 0.27);
    g.lineBetween(cx - ex + r * 0.27, ey - r * 0.04, cx + ex - r * 0.27, ey - r * 0.04);
    g.fillStyle(COLORS.white, 0.25).fillCircle(cx - ex - r * 0.1, ey - r * 0.12, r * 0.06);
  }
}

/** Pelo (la parte de atrás de la cabeza: melena, colitas o rizos). */
function hairBack(g: G, b: BodyGeom, o: PersonOpts): void {
  const { cx, headY: hy, headR: r } = b;
  if (o.style === 'long') {
    rect(g, cx - r * 1.1, hy - r * 0.3, r * 2.2, r * 1.75, r * 0.6, o.hair, 3);
  } else if (o.style === 'braids') {
    // Colitas a los lados con ligas de color.
    for (const s of [-1, 1]) {
      const px = cx + s * r * 1.12;
      const pts = smooth([
        [px - s * r * 0.15, hy - r * 0.35],
        [px + s * r * 0.3, hy - r * 0.05],
        [px + s * r * 0.32, hy + r * 0.5],
        [px + s * r * 0.05, hy + r * 0.95],
        [px - s * r * 0.15, hy + r * 0.45],
      ]);
      g.fillStyle(o.hair).fillPoints(pts, true);
      g.lineStyle(3, INK).strokePoints(pts, true, true);
      g.lineStyle(2, darker(o.hair, 0.2), 0.8).lineBetween(
        px + s * r * 0.05,
        hy,
        px + s * r * 0.12,
        hy + r * 0.6,
      );
      circle(g, px - s * r * 0.08, hy - r * 0.22, r * 0.13, o.ties ?? o.bow ?? COLORS.sun, 2.5);
    }
  } else if (o.style === 'curly') {
    const ring: [number, number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const a = PI + (i / 8) * PI;
      ring.push([cx + Math.cos(a) * r * 0.9, hy - r * 0.05 + Math.sin(a) * r * 0.9, r * 0.3]);
    }
    for (const [x, y, rr] of ring) g.fillStyle(INK).fillCircle(x, y, rr + 2.5);
    for (const [x, y, rr] of ring) g.fillStyle(o.hair).fillCircle(x, y, rr);
  } else if (o.style === 'bun') {
    circle(g, cx, hy - r * 1.02, r * 0.42, o.hair, 3);
    g.fillStyle(COLORS.white, 0.3).fillCircle(cx - r * 0.12, hy - r * 1.12, r * 0.12);
  }
}

/** Pelo de adelante (flequillo con volumen y brillo). */
function hairFront(g: G, b: BodyGeom, o: PersonOpts): void {
  const { cx, headY: hy, headR: r } = b;
  if (o.style === 'curly') {
    const top: [number, number][] = [];
    for (let i = 0; i <= 6; i++) {
      const a = 1.08 * PI + (i / 6) * 0.84 * PI;
      top.push([cx + Math.cos(a) * r * 0.78, hy + Math.sin(a) * r * 0.78]);
    }
    for (const [x, y] of top) g.fillStyle(INK).fillCircle(x, y, r * 0.3 + 2.5);
    for (const [x, y] of top) g.fillStyle(o.hair).fillCircle(x, y, r * 0.3);
    g.fillStyle(o.hair).fillEllipse(cx, hy - r * 0.62, r * 1.5, r * 0.6);
    g.fillStyle(COLORS.white, 0.22).fillCircle(cx - r * 0.35, hy - r * 0.78, r * 0.14);
    return;
  }
  // Casquete que cubre la parte de arriba de la cabeza.
  const cap: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const a = 1.02 * PI + (i / 8) * 0.96 * PI;
    cap.push([cx + Math.cos(a) * r * 1.07, hy + Math.sin(a) * r * 1.07]);
  }
  // Flequillo: mechones (de derecha a izquierda).
  const fringe: [number, number][] =
    o.style === 'short'
      ? [
          [cx + r * 0.92, hy - r * 0.02],
          [cx + r * 0.62, hy - r * 0.4],
          [cx + r * 0.38, hy - r * 0.24],
          [cx + r * 0.12, hy - r * 0.48],
          [cx - r * 0.18, hy - r * 0.26],
          [cx - r * 0.48, hy - r * 0.46],
          [cx - r * 0.72, hy - r * 0.22],
          [cx - r * 0.95, hy - r * 0.02],
        ]
      : [
          [cx + r * 0.95, hy + r * 0.1],
          [cx + r * 0.7, hy - r * 0.3],
          [cx + r * 0.25, hy - r * 0.42],
          [cx - r * 0.2, hy - r * 0.32],
          [cx - r * 0.6, hy - r * 0.2],
          [cx - r * 0.95, hy + r * 0.1],
        ];
  const pts = [...cap, ...fringe].map(([x, y]) => ({ x, y }));
  g.fillStyle(o.hair).fillPoints(pts, true);
  g.lineStyle(3, INK).strokePoints(pts, true, true);
  // Brillo del pelo
  if (o.hair !== HAIR.gray) {
    g.lineStyle(Math.max(3, r * 0.1), COLORS.white, 0.3).beginPath();
    g.arc(cx - r * 0.05, hy - r * 0.05, r * 0.82, 1.18 * PI, 1.42 * PI);
    g.strokePath();
  }
  // Mechones que caen a los lados (pelo largo).
  if (o.style === 'long') {
    for (const s of [-1, 1]) {
      const p2 = smooth([
        [cx + s * r * 0.95, hy - r * 0.2],
        [cx + s * r * 1.12, hy + r * 0.5],
        [cx + s * r * 1.02, hy + r * 1.15],
        [cx + s * r * 0.8, hy + r * 0.6],
      ]);
      g.fillStyle(o.hair).fillPoints(p2, true);
      g.lineStyle(3, INK).strokePoints(p2, true, true);
    }
  }
  if (o.bow && o.headband === undefined) {
    const bx = cx + r * 0.62;
    const by = hy - r * 0.86;
    poly(g, [bx, by, bx - r * 0.38, by - r * 0.22, bx - r * 0.38, by + r * 0.22], o.bow, 2.5);
    poly(g, [bx, by, bx + r * 0.38, by - r * 0.22, bx + r * 0.38, by + r * 0.22], o.bow, 2.5);
    circle(g, bx, by, r * 0.11, lighter(o.bow, 0.3), 2.5);
  }
}

/** Dibujo en la camiseta. */
function shirtDeco(g: G, b: BodyGeom, o: PersonOpts): void {
  const { cx, bodyTop: t, bodyH: bh, bodyW: bw } = b;
  const cy = t + bh * 0.55;
  switch (o.deco) {
    case 'star':
      star(g, cx, cy, bh * 0.24, COLORS.sun, 2.5);
      break;
    case 'heart':
      g.fillStyle(COLORS.white)
        .fillCircle(cx - 5, cy - 2, 5.5)
        .fillCircle(cx + 5, cy - 2, 5.5);
      g.fillTriangle(cx - 10.5, cy, cx + 10.5, cy, cx, cy + 11);
      break;
    case 'dots':
      for (const [dx, dy, c] of [
        [-0.28, -0.1, COLORS.coral],
        [0.22, 0.05, COLORS.sun],
        [-0.05, 0.25, COLORS.grape],
        [0.3, -0.28, COLORS.sea],
      ] as const) {
        g.fillStyle(c).fillEllipse(cx + dx * bw, cy + dy * bh, 8, 6.5);
      }
      break;
    case 'stripes':
      g.fillStyle(COLORS.white, 0.45);
      for (let y = t + 8; y < t + bh - 4; y += 9) g.fillRect(cx - bw / 2 + 3, y, bw - 6, 3.5);
      break;
    case 'stripe':
      g.fillStyle(COLORS.white, 0.45).fillRect(cx - bw / 2 + 2, cy - 3, bw - 4, 6);
      break;
    default:
      break;
  }
}

/** Rueda grande de la silla de ruedas: llanta, rin, rayos y centro. */
function chairWheel(g: G, x: number, y: number): void {
  circle(g, x, y, 40, 0x3d4466);
  circle(g, x, y, 32, 0xeaf1f8, 3);
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 4;
    line(
      g,
      x - Math.cos(a) * 31,
      y - Math.sin(a) * 31,
      x + Math.cos(a) * 31,
      y + Math.sin(a) * 31,
      2,
    );
  }
  circle(g, x, y, 6, COLORS.turquoise, 2);
}

/** Sofía (niña en silla de ruedas). */
const SOFIA: PersonOpts = {
  skin: SKIN[1],
  hair: 0x7a4a2a,
  style: 'long',
  shirt: 0xff8a80,
  pants: 0x2f4f8f,
  wheelchair: true,
  bow: 0xe23b3b,
  headband: COLORS.sun,
  deco: 'stripes',
  shoes: COLORS.pink,
};

/** Centro de la rueda grande dentro del dibujo 'nina-silla' (160 x 175). */
export const SOFIA_WHEEL = { x: 160 / 2 - 14 + 6, y: 175 - 44, r: 40 };

function person(g: G, w: number, h: number, o: PersonOpts): void {
  const b = bodyGeom(w, h, o);
  const { cx, adult, bodyTop, bodyH, bodyW, legTop, legH, bottom } = b;
  const shirt = o.coat ? COLORS.white : o.shirt;
  const shoe = o.shoes ?? (adult ? 0x5a3a2a : COLORS.coral);

  // Sombrita en el piso.
  if (!o.noLimbs && !b.chair) {
    g.fillStyle(INK, 0.13).fillEllipse(cx, bottom + 3, w * 0.62, 10);
  }

  hairBack(g, b, o);

  if (b.chair) {
    const seatY = b.seatY;
    // Silla de ruedas: rueda grande con rayos, asiento, respaldo y rueda pequeña.
    if (!o.noWheel) chairWheel(g, cx + 6, h - 44);
    rect(g, cx - 34, seatY - 58, 12, 70, 5, 0x2f4f8f);
    rect(g, cx - 40, seatY - 62, 14, 8, 4, COLORS.turquoise, 3);
    rect(g, cx - 34, seatY, 80, 12, 5, 0x2f4f8f);
    line(g, cx + 40, seatY + 10, cx + 52, h - 16, 5, 0x2f4f8f);
    circle(g, cx + 54, h - 12, 8, 0x5a6b7d);
    // Piernas sentadas y zapatos de color.
    rect(g, cx - 10, seatY - 12, 50, 16, 8, o.pants);
    rect(g, cx + 28, seatY - 4, 15, 34, 7, o.pants);
    ellipse(g, cx + 42, seatY + 32, 26, 12, shoe, 3);
    g.fillStyle(COLORS.white).fillRect(cx + 31, seatY + 35, 22, 3);
  } else if (!o.noLimbs) {
    // Piernas y zapatos de color con suela blanca.
    for (const s of [-1, 1]) {
      const lx = cx + s * b.hipX;
      rect(g, lx - b.legW / 2, legTop - 6, b.legW, legH - 4, 6, o.pants);
      g.fillStyle(darker(o.pants, 0.25)).fillRect(lx + s * 2.5 - 1.5, legTop, 3, legH - 14);
      const sx = lx + s * 3;
      ellipse(g, sx, bottom - 5, b.legW + 15, 14, shoe, 3);
      g.fillStyle(COLORS.white).fillRect(sx - (b.legW + 10) / 2, bottom - 3, b.legW + 10, 3);
      g.fillStyle(COLORS.white, 0.35).fillEllipse(sx - 4, bottom - 9, 8, 3.5);
    }
  }
  if (o.skirt && !b.chair) {
    poly(
      g,
      [
        cx - bodyW / 2 + 2,
        bodyTop + bodyH * 0.55,
        cx + bodyW / 2 - 2,
        bodyTop + bodyH * 0.55,
        cx + bodyW / 2 + 10,
        legTop + (adult ? 18 : 12),
        cx - bodyW / 2 - 10,
        legTop + (adult ? 18 : 12),
      ],
      o.shirt,
    );
    g.lineStyle(2, darker(o.shirt, 0.25), 0.8)
      .lineBetween(cx - 7, bodyTop + bodyH * 0.62, cx - 11, legTop + (adult ? 14 : 9))
      .lineBetween(cx + 7, bodyTop + bodyH * 0.62, cx + 11, legTop + (adult ? 14 : 9));
  }

  // Brazos: manga (con vuelito en los niños) + brazo de piel + manita.
  if (!o.noLimbs) {
    for (const s of [-1, 1]) {
      const ax = cx + s * b.shoulderX;
      const top = b.armTop;
      rect(
        g,
        ax - b.armW / 2 + 1,
        top + b.sleeve - 4,
        b.armW - 2,
        b.armLen - b.sleeve + 4,
        5,
        o.skin,
        3,
      );
      rect(
        g,
        ax - b.armW / 2 - (adult ? 0 : 1.5),
        top,
        b.armW + (adult ? 0 : 3),
        b.sleeve,
        6,
        shirt,
        3,
      );
      circle(g, ax, top + b.armLen, b.armW * 0.58, o.skin, 3);
    }
  }

  // Cuello
  rect(g, cx - 6, bodyTop - 8, 12, 12, 4, darker(o.skin, 0.08), 3);

  // Tronco con sombra lateral y brillo.
  rect(g, cx - bodyW / 2, bodyTop, bodyW, bodyH, adult ? 15 : 13, shirt);
  g.fillStyle(darker(shirt, 0.16), 0.55).fillRoundedRect(
    cx + bodyW / 2 - 12,
    bodyTop + 6,
    8,
    bodyH - 12,
    4,
  );
  g.fillStyle(COLORS.white, 0.2).fillRoundedRect(cx - bodyW / 2 + 5, bodyTop + 6, 6, bodyH - 14, 3);
  if (adult && !o.coat) {
    // Cuello en V
    g.fillStyle(o.skin).fillTriangle(cx - 8, bodyTop + 1, cx + 8, bodyTop + 1, cx, bodyTop + 12);
    g.lineStyle(3, INK)
      .lineBetween(cx - 9, bodyTop + 1, cx, bodyTop + 13)
      .lineBetween(cx + 9, bodyTop + 1, cx, bodyTop + 13);
  } else if (!o.coat) {
    // Cuello redondo de camiseta
    g.fillStyle(o.skin);
    g.beginPath();
    g.arc(cx, bodyTop + 1, 8, 0, PI);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, INK).beginPath();
    g.arc(cx, bodyTop + 1, 8, 0.05 * PI, 0.95 * PI);
    g.strokePath();
  }
  if (o.coat) {
    // Bata: solapas, botones y bolsillo con cruz
    line(g, cx, bodyTop + 13, cx, bodyTop + bodyH - 4, 2.5);
    g.fillStyle(o.shirt).fillTriangle(cx - 8, bodyTop + 1, cx + 8, bodyTop + 1, cx, bodyTop + 14);
    g.lineStyle(2.5, 0xb8c2cf)
      .lineBetween(cx - 10, bodyTop + 2, cx - 4, bodyTop + 24)
      .lineBetween(cx + 10, bodyTop + 2, cx + 4, bodyTop + 24);
    for (let k = 0; k < 3; k++) circle(g, cx - 5, bodyTop + 28 + k * 11, 2.5, 0xb8c2cf, 0);
    rect(g, cx + 8, bodyTop + 18, 14, 14, 2, COLORS.white, 2);
    g.fillStyle(COLORS.coral)
      .fillRect(cx + 13, bodyTop + 20, 4, 10)
      .fillRect(cx + 10, bodyTop + 23, 10, 4);
    arc(g, cx - 8, bodyTop + 6, 14, 0.1 * PI, 0.9 * PI, 3, 0x45406b);
    circle(g, cx - 2, bodyTop + 22, 4, 0x9aa5b5, 2);
  } else if (adult && !o.deco) {
    for (let k = 0; k < 3; k++) circle(g, cx, bodyTop + 20 + k * 13, 2.4, darker(shirt, 0.35), 0);
    rect(g, cx - bodyW / 2 + 8, bodyTop + 16, 12, 10, 2, darker(shirt, 0.1), 2);
  }
  shirtDeco(g, b, o);
  if (o.collar) {
    for (const s of [-1, 1]) {
      ellipse(g, cx + s * 7, bodyTop + 4, 16, 11, COLORS.white, 2.5);
    }
  }

  // Cabeza: orejas, cara, barba y pelo de adelante.
  const { headY: hy, headR: r } = b;
  for (const s of [-1, 1]) {
    circle(g, cx + s * r * 0.96, hy + r * 0.15, r * 0.2, o.skin, 3);
    g.lineStyle(2, darker(o.skin, 0.3)).beginPath();
    g.arc(
      cx + s * r * 0.96,
      hy + r * 0.15,
      r * 0.1,
      s < 0 ? 0.4 * PI : 1.4 * PI,
      s < 0 ? 1.6 * PI : 2.6 * PI,
    );
    g.strokePath();
  }
  circle(g, cx, hy, r, o.skin, 0);
  g.fillStyle(lighter(o.skin, 0.25), 0.6).fillEllipse(
    cx - r * 0.3,
    hy - r * 0.05,
    r * 0.7,
    r * 0.5,
  );
  g.lineStyle(LW, INK).strokeCircle(cx, hy, r);
  if (o.beard) {
    g.fillStyle(o.hair).fillEllipse(cx, hy + r * 0.66, r * 1.35, r * 0.62);
    g.fillStyle(o.hair).fillEllipse(cx, hy + r * 0.36, r * 0.75, r * 0.18);
    g.lineStyle(2.5, INK, 0.7).strokeEllipse(cx, hy + r * 0.66, r * 1.35, r * 0.62);
  }
  hairFront(g, b, o);
  if (o.headband !== undefined) {
    g.lineStyle(8, INK);
    g.beginPath();
    g.arc(cx, hy + r * 0.05, r * 0.98, 1.08 * PI, 1.92 * PI);
    g.strokePath();
    g.lineStyle(4.5, o.headband);
    g.beginPath();
    g.arc(cx, hy + r * 0.05, r * 0.98, 1.09 * PI, 1.91 * PI);
    g.strokePath();
    if (o.bow) {
      const bx = cx + r * 0.62;
      const by = hy - r * 0.78;
      poly(g, [bx, by, bx - r * 0.38, by - r * 0.22, bx - r * 0.38, by + r * 0.22], o.bow, 2.5);
      poly(g, [bx, by, bx + r * 0.38, by - r * 0.22, bx + r * 0.38, by + r * 0.22], o.bow, 2.5);
      circle(g, bx, by, r * 0.11, lighter(o.bow, 0.3), 2.5);
    }
  }
  face(g, cx, hy, r, o);
  if (o.hat === 'chef') {
    rect(g, cx - 22, hy - r - 18, 44, 22, 4, COLORS.white);
    circle(g, cx - 13, hy - r - 24, 13, COLORS.white, 3);
    circle(g, cx + 13, hy - r - 24, 13, COLORS.white, 3);
    circle(g, cx, hy - r - 31, 14, COLORS.white, 3);
  }
  if (o.hat === 'beret') {
    ellipse(g, cx + 4, hy - r * 0.78, r * 2.15, r * 0.62, COLORS.coral);
    circle(g, cx + 4, hy - r * 1.12, 4, INK, 0);
  }
}

const NINO: PersonOpts = {
  skin: SKIN[2],
  hair: HAIR.black,
  style: 'curly',
  shirt: COLORS.sun,
  pants: 0x4a6fa5,
  deco: 'stripe',
};

/** Personas que también existen como muñeco articulado (ver components/Puppet). */
export const PEOPLE = {
  mama: {
    w: 120,
    h: 220,
    o: {
      skin: SKIN[2],
      hair: HAIR.black,
      style: 'long',
      shirt: COLORS.grape,
      pants: 0x4a6fa5,
      adult: true,
      skirt: true,
    },
  },
  papa: {
    w: 120,
    h: 225,
    o: {
      skin: SKIN[2],
      hair: HAIR.black,
      style: 'short',
      shirt: COLORS.turquoise,
      pants: 0x3d4f6e,
      adult: true,
      beard: true,
    },
  },
  abuela: {
    w: 120,
    h: 215,
    o: {
      skin: SKIN[2],
      hair: HAIR.gray,
      style: 'bun',
      shirt: COLORS.pink,
      pants: 0x6b5a7a,
      adult: true,
      skirt: true,
      glasses: true,
    },
  },
  nino: { w: 100, h: 170, o: NINO },
  'nino-a': {
    w: 100,
    h: 170,
    o: {
      // Daniel: piel oscura, pelo negro, camiseta verde con estrella, jeans y tenis amarillos.
      skin: SKIN[4],
      hair: HAIR.black,
      style: 'short',
      shirt: 0x4fc46e,
      pants: 0x2f3c66,
      deco: 'star',
      shoes: COLORS.sun,
    },
  },
  'nina-b': {
    w: 100,
    h: 170,
    o: {
      // Valentina: rubia de colitas, lentes, vestido lila y zapatos morados.
      skin: SKIN[0],
      hair: 0xf2c94c,
      style: 'braids',
      shirt: 0xb39ddb,
      pants: SKIN[0],
      skirt: true,
      glasses: true,
      shoes: 0x7e57c2,
      ties: COLORS.pink,
      collar: true,
    },
  },
  'nino-c': {
    w: 100,
    h: 170,
    o: {
      // Lucas: piel clara, pelo castaño, camiseta turquesa con manchitas de pintura,
      // pantalón morado oscuro y tenis rojos.
      skin: SKIN[1],
      hair: 0xb5793f,
      style: 'short',
      shirt: 0x5ccdb8,
      pants: 0x4b3a6b,
      deco: 'dots',
      shoes: COLORS.coral,
    },
  },
} satisfies Record<string, { w: number; h: number; o: PersonOpts }>;

export type PersonKey = keyof typeof PEOPLE;

/** Medidas del cuerpo (las mismas que usa person()) para colocar brazos, piernas y ojos. */
export function personGeom(key: PersonKey): {
  w: number;
  h: number;
  hipX: number;
  hipY: number;
  legW: number;
  legLen: number;
  shoulderX: number;
  shoulderY: number;
  armW: number;
  armLen: number;
  sleeve: number;
  eyeX: number;
  eyeY: number;
  eyeW: number;
  eyeH: number;
  skin: number;
} {
  const { w, h, o } = PEOPLE[key];
  const b = bodyGeom(w, h, o);
  // Coordenadas relativas a los pies (centro abajo de la imagen).
  return {
    w,
    h,
    hipX: b.hipX,
    hipY: b.legTop - 6 - h,
    legW: b.legW,
    legLen: b.legH - 4,
    shoulderX: b.shoulderX,
    shoulderY: b.armTop - h,
    armW: b.armW,
    armLen: b.armLen,
    sleeve: b.sleeve,
    eyeX: b.headR * 0.38,
    eyeY: b.headY + b.headR * 0.12 - h,
    eyeW: b.headR * 0.34,
    eyeH: b.headR * 0.42,
    skin: o.skin,
  };
}

/** Pieza del muñeco: torso (sin brazos ni piernas), muslo, pierna con zapato, brazo o antebrazo. */
export type PuppetPart = 'torso' | 'thigh' | 'shin' | 'upperArm' | 'forearm';

/** Tamaño de la textura de cada pieza (sin escalar). */
export function puppetPartSize(key: PersonKey, part: PuppetPart): { w: number; h: number } {
  const gm = personGeom(key);
  const half = gm.legLen / 2;
  switch (part) {
    case 'torso':
      return { w: gm.w, h: gm.h };
    case 'thigh':
      return { w: gm.legW + 6, h: half + 8 };
    case 'shin':
      return { w: gm.legW + 22, h: half + 16 };
    case 'upperArm':
      return { w: gm.armW + 8, h: gm.armLen / 2 + 8 };
    case 'forearm':
      return { w: gm.armW + 10, h: gm.armLen / 2 + gm.armW + 4 };
  }
}

/** Dibuja una pieza del muñeco (pivote: arriba al centro). */
export function drawPuppetPart(g: G, key: PersonKey, part: PuppetPart): void {
  const { w, h, o } = PEOPLE[key];
  const gm = personGeom(key);
  const size = puppetPartSize(key, part);
  const mid = size.w / 2;
  const shirt = 'coat' in o && o.coat ? COLORS.white : o.shirt;
  const adult = 'adult' in o && o.adult === true;
  const shoe = ('shoes' in o ? o.shoes : undefined) ?? (adult ? 0x5a3a2a : COLORS.coral);
  const half = gm.legLen / 2;
  const upLen = gm.armLen / 2;
  switch (part) {
    case 'torso':
      person(g, w, h, { ...o, noLimbs: true });
      break;
    case 'thigh':
      rect(g, mid - gm.legW / 2, 2, gm.legW, half + 4, 6, o.pants, 3);
      g.fillStyle(darker(o.pants, 0.25)).fillRect(mid + 1, 5, 3, half - 2);
      break;
    case 'shin': {
      rect(g, mid - gm.legW / 2, 1, gm.legW, half + 2, 6, o.pants, 3);
      g.fillStyle(darker(o.pants, 0.25)).fillRect(mid + 1, 3, 3, half - 4);
      ellipse(g, mid + 2, half + 6, gm.legW + 15, 14, shoe, 3);
      g.fillStyle(COLORS.white).fillRect(mid + 2 - (gm.legW + 10) / 2, half + 8, gm.legW + 10, 3);
      g.fillStyle(COLORS.white, 0.35).fillEllipse(mid - 2, half + 2, 8, 3.5);
      break;
    }
    case 'upperArm': {
      const sl = Math.min(gm.sleeve, upLen + 4);
      rect(g, mid - gm.armW / 2 + 1, 2, gm.armW - 2, upLen + 4, 5, o.skin, 3);
      rect(
        g,
        mid - gm.armW / 2 - (adult ? 0 : 1.5),
        2,
        gm.armW + (adult ? 0 : 3),
        sl + 2,
        6,
        shirt,
        3,
      );
      break;
    }
    case 'forearm': {
      const sl = Math.max(0, gm.sleeve - upLen);
      rect(g, mid - gm.armW / 2 + 1, 0, gm.armW - 2, upLen + 2, 5, o.skin, 3);
      if (sl > 2) rect(g, mid - gm.armW / 2, 0, gm.armW, sl, 6, shirt, 3);
      circle(g, mid, upLen + 2, gm.armW * 0.58, o.skin, 3);
      break;
    }
  }
}

/** Dos manos (palmas con dedos) para los pasos de lavado. */
/** Mateo, el amigo de Tori, en la cama: enfermo (ojitos cansados, fiebre) o sano y feliz. */
function kidPatient(g: G, healthy: boolean): void {
  const skin = SKIN[2];
  const hair = HAIR.black;
  // Pijama con botones
  // Pijama (cerrado abajo, para que se vea bien también fuera de la cama)
  rect(g, 26, 148, 148, 58, 28, healthy ? COLORS.sun : 0xb7a6ff);
  g.fillStyle(COLORS.white, 0.6)
    .fillCircle(54, 176, 6)
    .fillCircle(146, 174, 6)
    .fillCircle(70, 196, 5)
    .fillCircle(132, 196, 5);
  rect(g, 86, 138, 28, 20, 6, skin, 3);
  circle(g, 100, 172, 4, COLORS.white, 2);
  circle(g, 100, 190, 4, COLORS.white, 2);
  // Orejas, pelo y cara
  circle(g, 44, 98, 13, skin, 3);
  circle(g, 156, 98, 13, skin, 3);
  circle(g, 100, 80, 60, hair);
  circle(g, 100, 98, 54, skin);
  g.fillStyle(hair);
  g.fillEllipse(100, 52, 112, 40)
    .fillCircle(64, 60, 18)
    .fillCircle(136, 60, 18)
    .fillCircle(100, 44, 22);
  if (healthy) {
    circle(g, 80, 96, 7, INK, 0);
    circle(g, 120, 96, 7, INK, 0);
    g.fillStyle(COLORS.white).fillCircle(82, 93, 2.5).fillCircle(122, 93, 2.5);
    arc(g, 100, 112, 18, 0.15 * PI, 0.85 * PI, 4);
    g.fillStyle(COLORS.coral, 0.5).fillCircle(66, 118, 10).fillCircle(134, 118, 10);
    // Curita en la frente (del raspón que curamos)
    rect(g, 106, 66, 30, 13, 5, 0xf2d3a8, 3);
    g.fillStyle(0xe0b98a).fillRect(117, 69, 8, 7);
  } else {
    // Fiebre: frente roja, ojitos cansados, boca triste y una gotita de sudor.
    g.fillStyle(COLORS.coral, 0.4).fillEllipse(100, 72, 84, 26);
    arc(g, 80, 96, 9, 0.1 * PI, 0.9 * PI, 4);
    arc(g, 120, 96, 9, 0.1 * PI, 0.9 * PI, 4);
    arc(g, 100, 128, 12, 1.15 * PI, 1.85 * PI, 4);
    g.fillStyle(COLORS.coral, 0.55).fillCircle(66, 116, 10).fillCircle(134, 116, 10);
    g.fillStyle(0x7cc8f5).fillCircle(138, 84, 6).fillTriangle(133, 82, 143, 82, 138, 71);
    g.lineStyle(2.5, INK).strokeCircle(138, 84, 6);
  }
}

/** Rayos del sol (mismo diseño que la portada): 8 rayos redondeados con borde de tinta. */
function sunRays(g: G): void {
  const c = 85;
  const ray = (w: number, color: number, r0: number, r1: number): void => {
    g.lineStyle(w, color);
    for (let i = 0; i < 8; i++) {
      const a = (i * PI) / 4 + PI / 8;
      g.lineBetween(
        c + Math.cos(a) * r0,
        c + Math.sin(a) * r0,
        c + Math.cos(a) * r1,
        c + Math.sin(a) * r1,
      );
      g.fillStyle(color).fillCircle(c + Math.cos(a) * r0, c + Math.sin(a) * r0, w / 2);
      g.fillCircle(c + Math.cos(a) * r1, c + Math.sin(a) * r1, w / 2);
    }
  };
  ray(9, INK, 62, 80);
  ray(4.5, COLORS.sun, 62.5, 79.5);
}

/** Cara del sol: círculo amarillo con ojitos, cachetes rosados y sonrisa. */
function sunFace(g: G): void {
  const c = 85;
  circle(g, c, c, 48, COLORS.sun, 5);
  g.fillStyle(0xff9e8a, 0.9)
    .fillCircle(c - 25, c + 8, 8)
    .fillCircle(c + 25, c + 8, 8);
  g.fillStyle(INK)
    .fillCircle(c - 15, c - 8, 5)
    .fillCircle(c + 15, c - 8, 5);
  arc(g, c, c + 1, 17, 0.2 * PI, 0.8 * PI, 4.5);
}

function hands(g: G, cx: number, cy: number): void {
  const skin = SKIN[2];
  for (const side of [-1, 1]) {
    const x = cx + side * 17;
    rect(g, x - 14, cy - 16, 28, 34, 12, skin);
    for (let i = 0; i < 3; i++) rect(g, x - 12 + i * 8, cy - 30, 7, 18, 3, skin, 3);
    rect(g, x + side * 12 - 4, cy - 10, 9, 16, 4, skin, 3);
  }
}

// ------------------------------------------------------------------ catálogo

interface ArtDef {
  w: number;
  h: number;
  draw: (g: G) => void;
}

export const ART = {
  // ---------------- Comida (nivel 2) ----------------
  mango: {
    w: 110,
    h: 110,
    draw: (g) => {
      // Mango maduro con forma de riñón: verde arriba, amarillo al centro, rubor rojo-naranja,
      // pintitas, brillo, tallo café y hoja con nervadura.
      g.fillStyle(INK, 0.15).fillEllipse(56, 106, 60, 7);
      const body = smooth([
        [48, 22],
        [66, 22],
        [82, 32],
        [90, 50],
        [90, 70],
        [82, 88],
        [66, 100],
        [48, 102],
        [33, 94],
        [25, 78],
        [27, 60],
        [33, 42],
      ]);
      // Degradado suave: capas de la misma silueta encogidas hacia un punto (nunca se salen).
      const toward = (fx: number, fy: number, k: number): Pt[] =>
        body.map((p) => ({ x: fx + (p.x - fx) * k, y: fy + (p.y - fy) * k }));
      const mix = (a: number, b: number, t: number): number => {
        const c = (sh: number): number =>
          Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
        return (c(16) << 16) | (c(8) << 8) | c(0);
      };
      g.fillStyle(0xf2a22c).fillPoints(body, true);
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        g.fillStyle(mix(0xf2a22c, 0xffd84a, t)).fillPoints(toward(44, 76, 1 - t * 0.8), true);
      }
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        g.fillStyle(mix(0xff9a3a, 0xe8452f, t), 0.22).fillPoints(
          toward(80, 50, 0.7 - t * 0.6),
          true,
        );
      }
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        g.fillStyle(0x8cc043, 0.16).fillPoints(toward(42, 30, 0.55 - t * 0.45), true);
      }
      g.fillStyle(0xb5651d, 0.6);
      for (const [x, y] of [
        [60, 70],
        [68, 80],
        [52, 84],
        [78, 72],
        [44, 72],
      ] as const)
        g.fillCircle(x, y, 1.3);
      g.fillStyle(COLORS.white, 0.65).fillEllipse(37, 66, 8, 24);
      g.fillStyle(COLORS.white, 0.5).fillCircle(39, 50, 3);
      g.lineStyle(4, INK).strokePoints(body, true, true);
      // Tallo y hoja
      g.lineStyle(7, INK).lineBetween(54, 24, 52, 9);
      g.lineStyle(4, 0x7a5230).lineBetween(54, 24, 52, 9);
      leaf(g, 53, 13, 94, 9, 18, 0x3e9a4c);
    },
  },
  guineo: {
    w: 110,
    h: 110,
    draw: (g) => {
      // Guineo (banana) curvo como una sonrisa: más grueso al centro, con sombra, nervadura,
      // tallo verde-café arriba a la derecha y puntita café a la izquierda.
      const cx = 52;
      const cy = 20;
      const R = 50;
      const a0 = 0.07 * PI;
      const a1 = 0.82 * PI;
      const n = 28;
      const outer: { x: number; y: number }[] = [];
      const inner: { x: number; y: number }[] = [];
      const shade: { x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = a0 + (a1 - a0) * t;
        const w = 3 + 14 * Math.sin(PI * t) ** 0.8;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        outer.push({ x: cx + (R + w) * c, y: cy + (R + w) * sn });
        inner.push({ x: cx + (R - w) * c, y: cy + (R - w) * sn });
        shade.push({ x: cx + (R + w * 0.15) * c, y: cy + (R + w * 0.15) * sn });
      }
      const body = [...outer, ...inner.slice().reverse()];
      // Sombra suave en el suelo
      g.fillStyle(INK, 0.15).fillEllipse(56, 98, 70, 10);
      g.fillStyle(0xffd23f).fillPoints(body, true);
      // Lado de abajo más oscuro (volumen)
      g.fillStyle(0xe8a91c).fillPoints([...outer, ...shade.slice().reverse()], true);
      // Brillo arriba
      g.lineStyle(4, 0xfff1a8, 0.9);
      g.beginPath();
      for (let i = 4; i <= n - 6; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        const w = 3 + 14 * Math.sin((PI * i) / n) ** 0.8;
        const x = cx + (R - w * 0.55) * Math.cos(a);
        const y = cy + (R - w * 0.55) * Math.sin(a);
        if (i === 4) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
      // Nervadura
      g.lineStyle(2, 0xc98a12, 0.8);
      g.beginPath();
      shade.forEach((pt, i) => (i === 0 ? g.moveTo(pt.x, pt.y) : g.lineTo(pt.x, pt.y)));
      g.strokePath();
      // Pequitas
      g.fillStyle(0x8a5a2b, 0.7);
      for (const t of [0.3, 0.46, 0.62]) {
        const a = a0 + (a1 - a0) * t;
        g.fillCircle(cx + (R + 4) * Math.cos(a), cy + (R + 4) * Math.sin(a), 1.8);
      }
      g.lineStyle(4, INK).strokePoints(body, true);
      // Tallo (arriba a la derecha) y punta (abajo a la izquierda)
      const st = { x: cx + R * Math.cos(a0), y: cy + R * Math.sin(a0) };
      g.fillStyle(0x8c7a3a).fillPoints(
        [
          { x: st.x - 6, y: st.y - 2 },
          { x: st.x - 3, y: st.y - 17 },
          { x: st.x + 4, y: st.y - 17 },
          { x: st.x + 5, y: st.y + 2 },
        ],
        true,
      );
      g.lineStyle(3, INK).strokePoints(
        [
          { x: st.x - 6, y: st.y - 2 },
          { x: st.x - 3, y: st.y - 17 },
          { x: st.x + 4, y: st.y - 17 },
          { x: st.x + 5, y: st.y + 2 },
        ],
        true,
      );
      g.fillStyle(0x4a3418).fillRoundedRect(st.x - 4, st.y - 20, 9, 5, 2);
      const tp = { x: cx + R * Math.cos(a1), y: cy + R * Math.sin(a1) };
      g.fillStyle(0x4a3418).fillCircle(tp.x, tp.y, 4.5);
      g.lineStyle(2.5, INK).strokeCircle(tp.x, tp.y, 4.5);
    },
  },
  frijoles: {
    w: 110,
    h: 110,
    draw: (g) => {
      ellipse(g, 55, 50, 84, 40, 0x7a2e2e);
      for (const [x, y] of [
        [38, 46],
        [55, 40],
        [72, 47],
        [46, 56],
        [64, 56],
      ] as const) {
        g.fillStyle(0xa94a3c).fillEllipse(x, y, 14, 9);
      }
      poly(g, [12, 54, 98, 54, 84, 94, 26, 94], COLORS.turquoise);
      line(g, 22, 68, 88, 68, 3, COLORS.white);
    },
  },
  leche: {
    w: 110,
    h: 110,
    draw: (g) => {
      // Cartón de leche en 3D (techo a dos aguas, manchas de vaca, etiqueta azul) + vaso de leche.
      g.fillStyle(INK, 0.15).fillEllipse(56, 105, 92, 8);
      const BLUE = 0x3a8fd9;
      const BLUE_D = 0x2a6fb0;
      // Cara lateral y techo
      poly(g, [70, 40, 90, 30, 90, 94, 70, 104], 0xdce9f3);
      poly(g, [48, 18, 68, 8, 90, 30, 70, 40], BLUE_D);
      poly(g, [46, 12, 66, 2, 69, 8, 49, 18], 0xe7f1f8, 3);
      // Cara frontal
      rect(g, 28, 40, 42, 64, 0, COLORS.white);
      poly(g, [28, 40, 48, 18, 70, 40], BLUE);
      // Manchas de vaca
      g.fillStyle(0x2b2222);
      for (const [x, y, r] of [
        [33, 47, 5],
        [38, 50, 4.5],
        [34, 54, 3.5],
        [41, 46, 3],
        [60, 57, 3],
        [64, 54, 4],
        [67, 59, 2.5],
        [78, 44, 3.5],
        [82, 48, 4],
        [80, 53, 2.5],
      ] as const)
        g.fillCircle(x, y, r);
      // Etiqueta azul con onda
      const wave: { x: number; y: number }[] = [];
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        wave.push({ x: 28 + 42 * k, y: 70 + Math.sin(k * 2 * PI) * 3 });
      }
      wave.push({ x: 70, y: 102 }, { x: 28, y: 102 });
      g.fillStyle(BLUE).fillPoints(wave, true);
      poly(g, [70, 70, 90, 60, 90, 92, 70, 102], BLUE_D, 0);
      // Gota de leche en la etiqueta
      g.fillStyle(COLORS.white);
      g.fillCircle(49, 89, 7);
      g.fillTriangle(42, 87, 56, 87, 49, 74);
      g.lineStyle(4, INK).strokeRect(28, 40, 42, 64);
      g.lineStyle(4, INK).strokePoints(
        [
          { x: 70, y: 40 },
          { x: 90, y: 30 },
          { x: 90, y: 94 },
          { x: 70, y: 104 },
        ],
        true,
      );
      g.lineStyle(4, INK).strokeTriangle(28, 40, 48, 18, 70, 40);
      g.lineStyle(4, INK).strokePoints(
        [
          { x: 48, y: 18 },
          { x: 68, y: 8 },
          { x: 90, y: 30 },
        ],
        false,
      );
      g.fillStyle(COLORS.white, 0.6).fillRect(32, 58, 3, 10);
      // Vaso de leche al frente
      poly(g, [6, 64, 34, 64, 31, 106, 9, 106], 0xeaf6fb, 3);
      g.fillStyle(0xfffdf6).fillPoints(
        [
          { x: 8.5, y: 72 },
          { x: 31.5, y: 72 },
          { x: 29, y: 104 },
          { x: 11, y: 104 },
        ],
        true,
      );
      g.fillStyle(COLORS.white).fillEllipse(20, 72, 23, 5);
      g.fillStyle(COLORS.white, 0.8).fillRect(12, 76, 3, 22);
      g.lineStyle(3, INK).strokePoints(
        [
          { x: 6, y: 64 },
          { x: 34, y: 64 },
          { x: 31, y: 106 },
          { x: 9, y: 106 },
        ],
        true,
      );
    },
  },
  verduras: {
    w: 110,
    h: 110,
    draw: (g) => {
      // Zanahoria con hojas, brócoli de florecitas y un tomate rojo al frente.
      g.fillStyle(INK, 0.15).fillEllipse(56, 106, 90, 8);
      // Hojas de la zanahoria
      leaf(g, 30, 38, 14, 6, 11, 0x4caf50);
      leaf(g, 30, 38, 30, 2, 11, 0x3e9a4c);
      leaf(g, 31, 38, 46, 8, 11, 0x5cbf5a);
      // Zanahoria
      const carrot = smooth(
        [
          [16, 42],
          [30, 36],
          [44, 42],
          [42, 64],
          [36, 88],
          [31, 104],
          [26, 88],
          [20, 64],
        ],
        5,
      );
      g.fillStyle(0xf58a1f).fillPoints(carrot, true);
      g.fillStyle(0xd96c12, 0.7).fillPoints(
        [
          { x: 36, y: 42 },
          { x: 43, y: 46 },
          { x: 41, y: 66 },
          { x: 35, y: 88 },
          { x: 33, y: 84 },
          { x: 37, y: 62 },
        ],
        true,
      );
      g.fillStyle(0xffc27a, 0.75).fillRoundedRect(21, 48, 4, 22, 2);
      g.lineStyle(2.5, 0xb85a0e);
      for (const [x1, y1, x2] of [
        [20, 52, 28],
        [34, 60, 41],
        [22, 70, 29],
        [32, 80, 37],
        [26, 92, 31],
      ] as const)
        g.lineBetween(x1, y1, x2, y1 + 2);
      g.lineStyle(4, INK).strokePoints(carrot, true, true);
      // Brócoli: tallo ramificado
      poly(g, [66, 104, 82, 104, 80, 78, 92, 62, 86, 58, 76, 70, 72, 58, 64, 62, 70, 78], 0xa6d873);
      g.fillStyle(0x7fb84e, 0.8).fillRect(74, 82, 4, 20);
      // Florecitas
      for (const [x, y, r] of [
        [62, 56, 12],
        [92, 56, 12],
        [70, 42, 14],
        [86, 40, 14],
        [78, 30, 13],
        [78, 54, 12],
      ] as const)
        circle(g, x, y, r, 0x3e9a4c, 4);
      g.fillStyle(0x2f7d3b);
      for (const [x, y, r] of [
        [62, 60, 6],
        [92, 60, 6],
        [78, 58, 6],
        [72, 46, 6],
        [88, 44, 6],
      ] as const)
        g.fillCircle(x, y, r);
      g.fillStyle(0x6cc56a);
      for (const [x, y, r] of [
        [66, 38, 4],
        [80, 26, 4],
        [90, 36, 3.5],
        [58, 52, 3.5],
        [74, 50, 3],
        [94, 52, 3],
      ] as const)
        g.fillCircle(x, y, r);
      // Tomate
      circle(g, 54, 90, 15, 0xe63946);
      g.fillStyle(0xb5232f, 0.6).fillEllipse(60, 96, 14, 10);
      g.fillStyle(COLORS.white, 0.7).fillEllipse(47, 85, 6, 9);
      poly(
        g,
        [54, 76, 57, 81, 63, 79, 59, 84, 62, 88, 54, 85, 46, 88, 49, 84, 45, 79, 51, 81],
        0x3e9a4c,
        2.5,
      );
      g.lineStyle(4, INK).lineBetween(54, 77, 55, 71);
    },
  },
  dulces: {
    w: 110,
    h: 110,
    draw: (g) => {
      line(g, 38, 50, 38, 104, 7, 0xe9e2d0);
      circle(g, 38, 38, 26, COLORS.pink);
      arc(g, 38, 38, 16, 0, 1.6 * PI, 4, COLORS.white);
      poly(g, [62, 74, 50, 64, 50, 92], COLORS.sun, 3);
      poly(g, [98, 74, 108, 64, 108, 92], COLORS.sun, 3);
      ellipse(g, 80, 78, 40, 28, COLORS.grape);
    },
  },
  soda: {
    w: 110,
    h: 110,
    draw: (g) => {
      // Botella de refresco de cola (sin marca): tapa roja, cuello de vidrio, líquido oscuro
      // con burbujas, etiqueta roja con onda blanca y brillo.
      const R: [number, number][] = [
        [62, 16],
        [62, 28],
        [66, 36],
        [72, 46],
        [73, 58],
        [70, 66],
        [73, 76],
        [73, 98],
        [68, 105],
      ];
      const outline = [
        ...R.map(([x, y]) => ({ x, y })),
        ...R.slice()
          .reverse()
          .map(([x, y]) => ({ x: 110 - x, y })),
      ];
      g.fillStyle(INK, 0.15).fillEllipse(55, 106, 46, 7);
      // Vidrio (parte sin líquido) y líquido
      g.fillStyle(0xd7eef2).fillPoints(outline, true);
      g.fillStyle(0x5a2a14).fillPoints(
        [
          { x: 44, y: 36 },
          { x: 66, y: 36 },
          { x: 72, y: 46 },
          { x: 73, y: 58 },
          { x: 70, y: 66 },
          { x: 73, y: 76 },
          { x: 73, y: 98 },
          { x: 68, y: 105 },
          { x: 42, y: 105 },
          { x: 37, y: 98 },
          { x: 37, y: 76 },
          { x: 40, y: 66 },
          { x: 37, y: 58 },
          { x: 38, y: 46 },
        ],
        true,
      );
      g.fillStyle(0x7a3d1e).fillRect(42, 36, 26, 4);
      // Burbujas
      g.fillStyle(COLORS.white, 0.55);
      for (const [x, y, r] of [
        [48, 44, 2],
        [60, 48, 1.6],
        [52, 84, 1.8],
        [63, 90, 2.2],
        [57, 96, 1.4],
      ] as const)
        g.fillCircle(x, y, r);
      // Etiqueta roja con onda blanca
      g.fillStyle(0xe63946).fillRect(37, 58, 36, 20);
      g.fillStyle(0xe63946).fillRect(39, 64, 32, 8);
      g.lineStyle(3, COLORS.white);
      g.beginPath();
      g.moveTo(38, 70);
      g.lineTo(46, 64);
      g.lineTo(55, 70);
      g.lineTo(64, 64);
      g.lineTo(72, 70);
      g.strokePath();
      g.lineStyle(2.5, INK, 0.8).lineBetween(37, 58, 73, 58).lineBetween(37, 78, 73, 78);
      // Brillo del vidrio
      g.fillStyle(COLORS.white, 0.5)
        .fillRoundedRect(41, 40, 4, 16, 2)
        .fillRoundedRect(41, 82, 4, 16, 2);
      g.lineStyle(4, INK).strokePoints(outline, true);
      // Tapa con estrías
      g.fillStyle(0xd62839).fillRoundedRect(44, 5, 22, 12, 3);
      g.lineStyle(3, INK).strokeRoundedRect(44, 5, 22, 12, 3);
      g.lineStyle(1.5, 0x8c1525);
      for (let x = 48; x <= 62; x += 3.5) g.lineBetween(x, 7, x, 15);
    },
  },
  papitas: {
    w: 110,
    h: 110,
    draw: (g) => {
      // Cartón rojo de papas fritas: bastones dorados con sal, cartón con corte curvo y brillo.
      g.fillStyle(INK, 0.15).fillEllipse(55, 105, 66, 8);
      const fries: [number, number, number, number][] = [
        // x base, y punta, inclinación, color
        [34, 22, -7, 0xf4a93a],
        [46, 12, -3, 0xf9c74f],
        [58, 8, 1, 0xf4a93a],
        [70, 16, 5, 0xf9c74f],
        [40, 30, -2, 0xf9c74f],
        [52, 20, 0, 0xffd66b],
        [64, 26, 3, 0xffd66b],
        [76, 32, 8, 0xf4a93a],
      ];
      for (const [x, top, t, c] of fries) {
        poly(g, [x - 5 + t, top, x + 5 + t, top + 1, x + 5, 78, x - 5, 78], c, 3);
        g.fillStyle(0xfff1b8, 0.8).fillRect(x - 3 + t * 0.8, top + 4, 2.5, 22);
        g.fillStyle(0xc9761a, 0.6).fillRect(x - 5 + t, top, 10, 3);
      }
      // Granitos de sal
      g.fillStyle(COLORS.white);
      for (const [x, y] of [
        [44, 18],
        [57, 14],
        [69, 22],
        [38, 34],
        [62, 32],
        [50, 26],
        [75, 38],
      ] as const)
        g.fillRect(x, y, 2.5, 2.5);
      // Cartón
      const box: { x: number; y: number }[] = [{ x: 22, y: 46 }];
      for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        box.push({ x: 22 + 66 * k, y: 46 + Math.sin(k * PI) * 14 });
      }
      box.push({ x: 88, y: 46 }, { x: 78, y: 104 }, { x: 32, y: 104 });
      g.fillStyle(0xe63946).fillPoints(box, true);
      g.fillStyle(0xb5232f).fillPoints(
        [
          { x: 72, y: 56 },
          { x: 88, y: 46 },
          { x: 78, y: 104 },
          { x: 68, y: 104 },
        ],
        true,
      );
      // Emblema amarillo
      circle(g, 52, 82, 11, COLORS.sun, 3);
      g.lineStyle(3, 0xe63946);
      g.beginPath();
      g.arc(52, 80, 5, 0.1 * PI, 0.9 * PI);
      g.strokePath();
      g.fillStyle(COLORS.white, 0.45).fillRoundedRect(29, 58, 5, 36, 2.5);
      g.lineStyle(4, INK).strokePoints(box, true, true);
    },
  },
  lonchera: {
    w: 270,
    h: 190,
    draw: (g) => {
      arc(g, 135, 52, 46, PI, 2 * PI, 14, INK);
      arc(g, 135, 52, 46, PI, 2 * PI, 8, COLORS.sun);
      rect(g, 8, 46, 254, 136, 26, COLORS.turquoise);
      rect(g, 22, 58, 226, 24, 10, COLORS.white, 0);
      g.fillStyle(COLORS.white, 0.35).fillRoundedRect(22, 58, 226, 24, 10);
      rect(g, 118, 92, 34, 22, 6, COLORS.sun, 3);
    },
  },

  // ---------------- Clínica (nivel 3) ----------------
  'nino-enfermo': {
    w: 200,
    h: 210,
    draw: (g) => kidPatient(g, false),
  },
  'nino-sano': {
    w: 200,
    h: 210,
    draw: (g) => kidPatient(g, true),
  },
  cama: {
    w: 330,
    h: 160,
    draw: (g) => {
      rect(g, 8, 20, 24, 132, 8, 0x9a6b3f);
      rect(g, 298, 60, 24, 92, 8, 0x9a6b3f);
      rect(g, 20, 88, 290, 40, 10, COLORS.white);
      rect(g, 110, 76, 200, 56, 14, COLORS.grape);
      ellipse(g, 70, 82, 80, 34, COLORS.white);
    },
  },
  doctora: {
    w: 120,
    h: 220,
    draw: (g) =>
      person(g, 120, 220, {
        skin: SKIN[2],
        hair: HAIR.black,
        style: 'long',
        shirt: COLORS.sky,
        pants: 0x4a6fa5,
        adult: true,
        coat: true,
      }),
  },
  cocinero: {
    w: 120,
    h: 230,
    draw: (g) =>
      person(g, 120, 230, {
        skin: SKIN[1],
        hair: HAIR.brown,
        style: 'short',
        shirt: COLORS.white,
        pants: 0x5a5a6e,
        adult: true,
        hat: 'chef',
      }),
  },
  pintor: {
    w: 120,
    h: 220,
    draw: (g) =>
      person(g, 120, 220, {
        skin: SKIN[3],
        hair: HAIR.black,
        style: 'curly',
        shirt: COLORS.sun,
        pants: 0x4a6fa5,
        adult: true,
        hat: 'beret',
        deco: 'dots',
      }),
  },
  termometro: {
    w: 110,
    h: 110,
    draw: (g) => {
      rect(g, 46, 8, 18, 74, 9, COLORS.white);
      circle(g, 55, 88, 15, COLORS.coral);
      line(g, 55, 30, 55, 80, 6, COLORS.coral);
      for (let y = 20; y < 70; y += 12) line(g, 64, y, 72, y, 2);
    },
  },
  pelota: {
    w: 110,
    h: 110,
    draw: (g) => {
      circle(g, 55, 55, 44, COLORS.coral);
      g.fillStyle(COLORS.sun).fillEllipse(55, 55, 88, 26);
      arc(g, 55, 55, 44, 0, 2 * PI, 4);
      line(g, 11, 55, 99, 55, 3);
      g.fillStyle(COLORS.white, 0.5).fillCircle(38, 34, 9);
    },
  },
  cuchara: {
    w: 110,
    h: 110,
    draw: (g) => {
      rect(g, 50, 46, 12, 58, 6, 0xc9d2dc);
      ellipse(g, 56, 30, 40, 50, 0xdfe6ee);
    },
  },
  curita: {
    w: 110,
    h: 110,
    draw: (g) => {
      rect(g, 6, 38, 98, 36, 18, 0xf2c9a0);
      rect(g, 38, 38, 34, 36, 6, 0xffe2c4, 3);
      for (const [x, y] of [
        [48, 50],
        [62, 50],
        [48, 62],
        [62, 62],
      ] as const)
        g.fillStyle(0xd9a072).fillCircle(x, y, 2.5);
    },
  },
  crayon: {
    w: 110,
    h: 110,
    draw: (g) => {
      rect(g, 14, 42, 66, 28, 4, COLORS.grape);
      poly(g, [80, 42, 102, 56, 80, 70], 0xc3b2ff);
      line(g, 30, 42, 30, 70, 3);
      line(g, 64, 42, 64, 70, 3);
    },
  },
  galleta: {
    w: 110,
    h: 110,
    draw: (g) => {
      circle(g, 55, 55, 42, 0xe0b06e);
      for (const [x, y] of [
        [40, 40],
        [66, 46],
        [50, 66],
        [72, 70],
        [34, 62],
      ] as const)
        g.fillStyle(0x6b4a2b).fillCircle(x, y, 5);
    },
  },
  vacuna: {
    w: 110,
    h: 110,
    draw: (g) => {
      line(g, 86, 55, 106, 55, 3);
      rect(g, 26, 42, 60, 26, 6, 0xd8f3ff);
      g.fillStyle(COLORS.turquoise, 0.8).fillRect(46, 46, 38, 18);
      line(g, 4, 55, 26, 55, 6);
      rect(g, 2, 38, 8, 34, 3, COLORS.white, 3);
      for (let x = 40; x < 84; x += 10) line(g, x, 42, x, 50, 2);
    },
  },
  carrito: {
    w: 110,
    h: 110,
    draw: (g) => {
      poly(g, [28, 52, 40, 32, 72, 32, 84, 52], COLORS.sky);
      rect(g, 8, 50, 94, 30, 10, COLORS.coral);
      circle(g, 30, 82, 12, INK, 0);
      circle(g, 80, 82, 12, INK, 0);
      circle(g, 30, 82, 5, COLORS.white, 0);
      circle(g, 80, 82, 5, COLORS.white, 0);
    },
  },

  // ---------------- Escuela (nivel 4) ----------------
  salon: {
    w: 480,
    h: 320,
    draw: (g) => {
      g.fillStyle(0xfff1d6).fillRect(0, 0, 480, 320);
      g.fillStyle(0xd9a86c).fillRect(0, 250, 480, 70);
      rect(g, 30, 26, 250, 140, 6, 0x2f6b4f, 8);
      // dibujos de tiza: sol, casita, "1 + 2"
      circle(g, 80, 70, 18, 0x2f6b4f, 3);
      g.lineStyle(3, COLORS.white).strokeCircle(80, 70, 18);
      for (let i = 0; i < 8; i++) {
        const a = (i * PI) / 4;
        line(
          g,
          80 + Math.cos(a) * 24,
          70 + Math.sin(a) * 24,
          80 + Math.cos(a) * 32,
          70 + Math.sin(a) * 32,
          3,
          COLORS.white,
        );
      }
      g.lineStyle(3, COLORS.white).strokeRect(140, 80, 50, 40);
      g.lineStyle(3, COLORS.white).strokeTriangle(134, 80, 196, 80, 165, 52);
      line(g, 220, 70, 220, 110, 3, COLORS.white);
      line(g, 236, 90, 258, 90, 3, COLORS.white);
      line(g, 247, 79, 247, 101, 3, COLORS.white);
      g.fillStyle(0xf6f6f6).fillRect(40, 168, 230, 8);
      rect(g, 320, 26, 130, 110, 6, COLORS.sky, 6);
      circle(g, 410, 60, 16, COLORS.sun, 3);
      line(g, 385, 26, 385, 136, 5, 0xffffff);
      line(g, 320, 81, 450, 81, 5, 0xffffff);
      g.lineStyle(6, INK).strokeRect(320, 26, 130, 110);
      for (const x of [40, 270]) {
        circle(g, x + 70, 200, 22, x === 40 ? SKIN[3] : SKIN[1], 3);
        g.fillStyle(x === 40 ? HAIR.black : HAIR.brown).fillEllipse(x + 70, 188, 46, 24);
        g.fillStyle(INK)
          .fillCircle(x + 63, 202, 3)
          .fillCircle(x + 77, 202, 3);
        rect(g, x, 220, 150, 16, 4, 0xb07a45);
        line(g, x + 14, 236, x + 14, 290, 6);
        line(g, x + 136, 236, x + 136, 290, 6);
        rect(g, x + 50, 212, 40, 10, 2, COLORS.white, 2);
      }
      rect(g, 440, 210, 30, 40, 4, COLORS.coral, 3);
      circle(g, 455, 196, 16, COLORS.grassDark, 3);
    },
  },
  lapiz: {
    w: 130,
    h: 130,
    draw: (g) => {
      rect(g, 10, 50, 22, 30, 6, COLORS.pink);
      rect(g, 28, 50, 12, 30, 0, 0xc9d2dc, 3);
      rect(g, 40, 50, 62, 30, 0, COLORS.sun);
      poly(g, [102, 50, 124, 65, 102, 80], 0xf2c9a0);
      poly(g, [117, 61, 124, 65, 117, 69], INK, 0);
    },
  },
  cuaderno: {
    w: 130,
    h: 130,
    draw: (g) => {
      rect(g, 22, 14, 90, 104, 8, COLORS.grape);
      rect(g, 40, 30, 58, 22, 4, COLORS.white, 3);
      for (let y = 24; y < 112; y += 14) circle(g, 22, y, 5, COLORS.white, 2);
    },
  },
  tijeras: {
    w: 130,
    h: 130,
    draw: (g) => {
      poly(g, [62, 66, 120, 20, 124, 26, 70, 74], 0xc9d2dc);
      poly(g, [62, 66, 120, 112, 124, 106, 70, 58], 0xc9d2dc);
      circle(g, 34, 44, 20, COLORS.coral);
      circle(g, 34, 44, 9, 0xfff1d6, 3);
      circle(g, 34, 88, 20, COLORS.coral);
      circle(g, 34, 88, 9, 0xfff1d6, 3);
      circle(g, 64, 66, 5, INK, 0);
    },
  },
  mochila: {
    w: 130,
    h: 130,
    draw: (g) => {
      const dark = 0x1fa09b;
      // Asa (lazo grueso con contorno).
      arc(g, 65, 26, 16, PI, 2 * PI, 12);
      arc(g, 65, 26, 16, PI, 2 * PI, 6, dark);
      // Cuerpo con brillo y sombra.
      rect(g, 18, 24, 94, 100, 26, COLORS.turquoise);
      g.fillStyle(COLORS.white, 0.3).fillRoundedRect(24, 44, 7, 60, 3.5);
      g.fillStyle(0x000000, 0.12).fillRoundedRect(100, 44, 7, 66, 3.5);
      // Solapa con hebilla.
      rect(g, 24, 28, 82, 34, 16, dark, 3);
      g.fillStyle(COLORS.white, 0.2).fillRoundedRect(32, 32, 50, 6, 3);
      rect(g, 58, 52, 14, 16, 4, COLORS.sun, 3);
      rect(g, 62, 56, 6, 8, 2, 0xe6aa28, 0);
      // Bolsillo con cierre y costuras.
      rect(g, 32, 74, 66, 42, 14, COLORS.sun, 3.5);
      line(g, 38, 86, 92, 86, 2.5);
      rect(g, 78, 86, 6, 12, 3, COLORS.white, 2);
      g.fillStyle(0xe6aa28);
      for (const y of [100, 108]) for (let x = 40; x < 92; x += 8) g.fillRect(x, y, 4, 1.6);
    },
  },

  // ---------------- Casa y familia (nivel 1) ----------------
  paredes: {
    w: 300,
    h: 190,
    draw: (g) => {
      rect(g, 4, 4, 292, 182, 6, 0xfff1d6, 5);
      for (let y = 40; y < 186; y += 36) line(g, 8, y, 292, y, 2, 0xe8d3ae);
    },
  },
  techo: {
    w: 360,
    h: 150,
    draw: (g) => {
      poly(g, [6, 144, 180, 6, 354, 144], COLORS.coral, 5);
      for (let i = 1; i < 4; i++)
        line(g, 180 - i * 42, 6 + i * 34, 180 + i * 42, 6 + i * 34, 3, 0xd9534f);
      rect(g, 250, 28, 34, 60, 3, 0x9a6b3f);
    },
  },
  puerta: {
    w: 80,
    h: 120,
    draw: (g) => {
      rect(g, 4, 4, 72, 112, 10, 0x9a6b3f, 5);
      circle(g, 60, 64, 5, COLORS.sun, 2);
      rect(g, 16, 18, 48, 30, 6, 0xb07a45, 3);
    },
  },
  ventana: {
    w: 84,
    h: 76,
    draw: (g) => {
      rect(g, 4, 4, 76, 68, 6, COLORS.sky, 5);
      line(g, 42, 6, 42, 70, 4);
      line(g, 6, 38, 78, 38, 4);
    },
  },
  mama: {
    w: PEOPLE.mama.w,
    h: PEOPLE.mama.h,
    draw: (g) => person(g, PEOPLE.mama.w, PEOPLE.mama.h, PEOPLE.mama.o),
  },
  papa: {
    w: PEOPLE.papa.w,
    h: PEOPLE.papa.h,
    draw: (g) => person(g, PEOPLE.papa.w, PEOPLE.papa.h, PEOPLE.papa.o),
  },
  abuela: {
    w: PEOPLE.abuela.w,
    h: PEOPLE.abuela.h,
    draw: (g) => person(g, PEOPLE.abuela.w, PEOPLE.abuela.h, PEOPLE.abuela.o),
  },
  nino: {
    w: 100,
    h: 170,
    draw: (g) => person(g, 100, 170, NINO),
  },

  // Mascotas de "¿Sano o no sano?": corazón fuerte y corazón enfermito.
  'corazon-sano': {
    w: 170,
    h: 130,
    draw: (g) => {
      const cx = 85;
      const cy = 70;
      const green = 0x4fc46e;
      // Brazos flexionados (músculos) a los lados.
      for (const s of [-1, 1]) {
        const sx = cx + s * 46;
        line(g, sx, cy + 6, sx + s * 26, cy + 4, 14, INK);
        line(g, sx, cy + 6, sx + s * 26, cy + 4, 8, green);
        line(g, sx + s * 26, cy + 4, sx + s * 26, cy - 22, 14, INK);
        line(g, sx + s * 26, cy + 4, sx + s * 26, cy - 22, 8, green);
        ellipse(g, sx + s * 16, cy - 2, 20, 14, green, 3);
        circle(g, sx + s * 26, cy - 26, 9, green, 3);
      }
      heart(g, cx, cy, 104, green);
      // Cara feliz
      for (const s of [-1, 1]) {
        g.fillStyle(INK).fillEllipse(cx + s * 16, cy - 8, 11, 14);
        g.fillStyle(COLORS.white).fillCircle(cx + s * 16 + 2, cy - 11, 2.5);
      }
      g.fillStyle(0x8c2f39);
      g.beginPath();
      g.arc(cx, cy + 6, 12, 0, PI);
      g.closePath();
      g.fillPath();
      g.lineStyle(3, INK).beginPath();
      g.arc(cx, cy + 6, 12, 0, PI);
      g.closePath();
      g.strokePath();
      g.fillStyle(COLORS.pink, 0.7)
        .fillEllipse(cx - 28, cy + 6, 13, 8)
        .fillEllipse(cx + 28, cy + 6, 13, 8);
      sparkle(g, 18, 18, 10, COLORS.sun);
      sparkle(g, 152, 16, 9, COLORS.sun);
    },
  },
  'corazon-enfermo': {
    w: 150,
    h: 130,
    draw: (g) => {
      const cx = 72;
      const cy = 68;
      heart(g, cx, cy, 108, 0xff8f86);
      // Ojitos cansados (medio cerrados) y cejas tristes.
      for (const s of [-1, 1]) {
        arc(g, cx + s * 17, cy - 6, 7, 0.1 * PI, 0.9 * PI, 3.5);
        line(g, cx + s * 10, cy - 20, cx + s * 24, cy - 15, 3);
      }
      // Boquita ondulada con termómetro.
      g.lineStyle(3, INK).beginPath();
      g.moveTo(cx - 10, cy + 18);
      g.lineTo(cx - 4, cy + 14);
      g.lineTo(cx + 2, cy + 18);
      g.lineTo(cx + 8, cy + 14);
      g.strokePath();
      g.save();
      g.translateCanvas(cx + 8, cy + 16);
      g.rotateCanvas(-0.45);
      rect(g, 0, -5, 52, 10, 5, COLORS.white, 3);
      g.fillStyle(0xe23b3b).fillRect(4, -1.5, 28, 3);
      circle(g, 52, 0, 7, 0xe23b3b, 3);
      g.restore();
      // Curita en la frente.
      g.save();
      g.translateCanvas(cx + 28, cy - 34);
      g.rotateCanvas(0.6);
      rect(g, -22, -8, 44, 16, 7, 0xf2c9a0, 3);
      rect(g, -8, -8, 16, 16, 3, 0xe8b58a, 0);
      g.fillStyle(0xc98f62).fillCircle(-4, -3, 1.5).fillCircle(4, 3, 1.5).fillCircle(4, -3, 1.5);
      g.restore();
      // Gotita de sudor.
      g.fillStyle(0x7cc8f2).fillCircle(cx - 40, cy - 12, 6);
      g.fillTriangle(cx - 46, cy - 14, cx - 34, cy - 14, cx - 40, cy - 26);
      g.lineStyle(2, INK).strokeCircle(cx - 40, cy - 12, 6);
    },
  },

  // ---------------- Parque (nivel 5) ----------------
  balon: {
    w: 100,
    h: 100,
    draw: (g) => {
      circle(g, 50, 50, 44, COLORS.white, 5);
      const pent = (cx: number, cy: number, r: number, rot: number): void => {
        const pts: number[] = [];
        for (let i = 0; i < 5; i++) {
          const a = rot + (i * 2 * PI) / 5;
          pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        poly(g, pts, INK, 0);
      };
      pent(50, 50, 14, -PI / 2);
      for (let i = 0; i < 5; i++) {
        const a = -PI / 2 + (i * 2 * PI) / 5;
        line(
          g,
          50 + Math.cos(a) * 14,
          50 + Math.sin(a) * 14,
          50 + Math.cos(a) * 30,
          50 + Math.sin(a) * 30,
          3,
        );
        pent(50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38, 9, a + PI);
      }
      g.fillStyle(COLORS.white, 0.6).fillEllipse(34, 30, 14, 8);
      g.lineStyle(5, INK).strokeCircle(50, 50, 44);
    },
  },
  pincel: {
    w: 40,
    h: 130,
    draw: (g) => {
      rect(g, 13, 46, 14, 80, 7, 0xc68d55, 3);
      g.fillStyle(COLORS.white, 0.3).fillRect(16, 52, 3, 66);
      rect(g, 11, 30, 18, 20, 3, 0xc9d2dc, 3);
      poly(g, [12, 32, 28, 32, 24, 8, 20, 2, 16, 8], 0x3b2f2f, 3);
      poly(g, [16, 10, 20, 2, 24, 10, 22, 16, 18, 16], COLORS.coral, 0);
    },
  },
  // Escalones grises (suben hacia la derecha): la silla de ruedas no puede subirlos.
  escalones: {
    w: 120,
    h: 100,
    draw: (g) => {
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const x = 8 + i * 34;
        const top = 94 - (i + 1) * 28;
        rect(g, x, top, 120 - 8 - x, 94 - top, 3, 0xc9d2dc, 4);
        g.fillStyle(0x9aa5b5).fillRect(x + 3, top + 3, 120 - 8 - x - 6, 6);
        g.fillStyle(COLORS.white, 0.4).fillRect(x + 3, top + 12, 6, 94 - top - 16);
      }
      line(g, 4, 95, 116, 95, 4);
    },
  },
  // Rampa de madera con baranda. La rampa ocupa de (4, 126) a (196, 36): 192 x 90.
  'rampa-baranda': {
    w: 200,
    h: 132,
    draw: (g) => {
      const wood = 0xd9a86c;
      // Baranda: postes y pasamanos paralelos a la rampa.
      for (const t of [0.1, 0.5, 0.9]) {
        const x = 4 + 192 * t;
        const y = 126 - 90 * t;
        rect(g, x - 4, y - 34, 8, 34, 3, 0x9a6b3f, 3);
      }
      g.lineStyle(9, INK).lineBetween(16, 117 - 34, 186, 45 - 34);
      g.lineStyle(5, 0xb07a45).lineBetween(16, 117 - 34, 186, 45 - 34);
      poly(g, [4, 126, 196, 126, 196, 36], wood, 5);
      for (let i = 1; i < 5; i++) {
        const x = 4 + i * 38.4;
        line(g, x, 126 - i * 18, x, 126, 2.5, 0xb07a45);
      }
      g.lineStyle(3, COLORS.white, 0.35).lineBetween(14, 122, 190, 40);
    },
  },
  'nina-silla': {
    w: 160,
    h: 175,
    // Sofía: pelo café con moño rosado, blusa coral y silla de ruedas azul.
    draw: (g) => person(g, 160, 175, SOFIA),
  },
  // Sofía sin la rueda grande + la rueda sola: para que la rueda gire al avanzar.
  'nina-silla-cuerpo': {
    w: 160,
    h: 175,
    draw: (g) => person(g, 160, 175, { ...SOFIA, noWheel: true }),
  },
  'rueda-silla': {
    w: 84,
    h: 84,
    draw: (g) => chairWheel(g, 42, 42),
  },
  'nino-a': {
    w: PEOPLE['nino-a'].w,
    h: PEOPLE['nino-a'].h,
    draw: (g) => person(g, PEOPLE['nino-a'].w, PEOPLE['nino-a'].h, PEOPLE['nino-a'].o),
  },
  'nina-b': {
    w: PEOPLE['nina-b'].w,
    h: PEOPLE['nina-b'].h,
    draw: (g) => person(g, PEOPLE['nina-b'].w, PEOPLE['nina-b'].h, PEOPLE['nina-b'].o),
  },
  'nino-c': {
    w: PEOPLE['nino-c'].w,
    h: PEOPLE['nino-c'].h,
    draw: (g) => person(g, PEOPLE['nino-c'].w, PEOPLE['nino-c'].h, PEOPLE['nino-c'].o),
  },
  rampa: {
    w: 200,
    h: 100,
    draw: (g) => {
      // Llena toda su caja: así, escalada, encaja exacto entre el suelo y el escalón.
      poly(g, [2, 98, 198, 98, 198, 2], 0xd9a86c, 5);
      for (let i = 1; i < 5; i++)
        line(g, 2 + i * 39.2, 98 - i * 19.2, 2 + i * 39.2, 98, 2, 0xb07a45);
    },
  },
  escalera: {
    w: 110,
    h: 150,
    draw: (g) => {
      rect(g, 18, 6, 12, 138, 5, 0xb07a45);
      rect(g, 80, 6, 12, 138, 5, 0xb07a45);
      for (let y = 26; y < 140; y += 26) rect(g, 28, y, 54, 8, 3, 0xd9a86c, 3);
    },
  },

  // ---------------- Día y noche (nivel 6) ----------------
  papalote: {
    w: 120,
    h: 150,
    draw: (g) => {
      poly(g, [60, 6, 108, 56, 60, 112, 12, 56], COLORS.sun);
      poly(g, [60, 6, 108, 56, 60, 56], COLORS.coral, 0);
      poly(g, [60, 56, 12, 56, 60, 112], COLORS.turquoise, 0);
      g.lineStyle(LW, INK).strokePoints(
        [
          { x: 60, y: 6 },
          { x: 108, y: 56 },
          { x: 60, y: 112 },
          { x: 12, y: 56 },
        ],
        true,
        true,
      );
      line(g, 60, 6, 60, 112, 3);
      line(g, 12, 56, 108, 56, 3);
      line(g, 60, 112, 50, 146, 3);
      poly(g, [50, 124, 62, 118, 60, 130], COLORS.grape, 2);
      poly(g, [48, 138, 60, 134, 56, 146], COLORS.grape, 2);
    },
  },
  trompo: {
    w: 110,
    h: 120,
    draw: (g) => {
      line(g, 55, 8, 55, 24, 6, 0x9a6b3f);
      poly(g, [14, 34, 96, 34, 58, 112, 52, 112], 0xe8505b);
      rect(g, 14, 22, 82, 18, 8, COLORS.sun);
      line(g, 26, 58, 84, 58, 4, COLORS.white);
      line(g, 36, 78, 74, 78, 4, COLORS.white);
    },
  },
  camita: {
    w: 150,
    h: 110,
    draw: (g) => {
      rect(g, 6, 18, 18, 86, 6, 0x9a6b3f);
      rect(g, 126, 46, 18, 58, 6, 0x9a6b3f);
      rect(g, 16, 60, 120, 28, 8, COLORS.white);
      rect(g, 54, 50, 82, 40, 10, COLORS.grape);
      ellipse(g, 40, 56, 40, 22, COLORS.white);
    },
  },
  pijama: {
    w: 120,
    h: 130,
    draw: (g) => {
      poly(
        g,
        [30, 14, 90, 14, 116, 40, 100, 54, 90, 46, 90, 76, 30, 76, 30, 46, 20, 54, 4, 40],
        0x8fc7ff,
      );
      rect(g, 32, 76, 26, 50, 6, 0x8fc7ff);
      rect(g, 62, 76, 26, 50, 6, 0x8fc7ff);
      star(g, 48, 38, 8, COLORS.sun, 2);
      star(g, 74, 58, 6, COLORS.sun, 2);
      circle(g, 60, 22, 4, COLORS.white, 2);
    },
  },
  cuento: {
    w: 130,
    h: 110,
    draw: (g) => {
      rect(g, 10, 12, 110, 88, 8, COLORS.grape);
      rect(g, 10, 12, 16, 88, 4, 0x6b4fd0);
      circle(g, 74, 52, 20, COLORS.sun, 3);
      circle(g, 84, 46, 18, COLORS.grape, 0);
      star(g, 100, 30, 6, COLORS.white, 2);
    },
  },

  // ---------------- Mi voz cuenta (nivel 7) ----------------
  'cara-feliz': {
    w: 150,
    h: 150,
    draw: (g) => {
      circle(g, 75, 75, 64, COLORS.sun, 5);
      circle(g, 52, 62, 7, INK, 0);
      circle(g, 98, 62, 7, INK, 0);
      arc(g, 75, 80, 30, 0.15 * PI, 0.85 * PI, 6);
    },
  },
  'cara-triste': {
    w: 150,
    h: 150,
    draw: (g) => {
      circle(g, 75, 75, 64, 0x8fc7ff, 5);
      circle(g, 52, 64, 7, INK, 0);
      circle(g, 98, 64, 7, INK, 0);
      line(g, 40, 48, 60, 42, 4);
      line(g, 110, 48, 90, 42, 4);
      arc(g, 75, 118, 24, 1.2 * PI, 1.8 * PI, 6);
      ellipse(g, 104, 84, 10, 16, 0x5cc3f0, 2);
    },
  },
  'cara-enojada': {
    w: 150,
    h: 150,
    draw: (g) => {
      circle(g, 75, 75, 64, 0xff9a7a, 5);
      circle(g, 52, 66, 7, INK, 0);
      circle(g, 98, 66, 7, INK, 0);
      line(g, 38, 44, 64, 56, 6);
      line(g, 112, 44, 86, 56, 6);
      line(g, 54, 104, 96, 104, 6);
    },
  },
  'cara-asustada': {
    w: 150,
    h: 150,
    draw: (g) => {
      circle(g, 75, 75, 64, 0xc3b2ff, 5);
      circle(g, 52, 62, 14, COLORS.white, 3);
      circle(g, 98, 62, 14, COLORS.white, 3);
      circle(g, 52, 62, 5, INK, 0);
      circle(g, 98, 62, 5, INK, 0);
      ellipse(g, 75, 104, 22, 28, INK, 0);
    },
  },
  'cara-tranquila': {
    w: 150,
    h: 150,
    draw: (g) => {
      circle(g, 75, 75, 64, 0x9be0c8, 5);
      arc(g, 52, 62, 10, 0.1 * PI, 0.9 * PI, 5);
      arc(g, 98, 62, 10, 0.1 * PI, 0.9 * PI, 5);
      arc(g, 75, 86, 18, 0.2 * PI, 0.8 * PI, 5);
    },
  },
  perrito: {
    w: 200,
    h: 200,
    draw: (g) => {
      ellipse(g, 100, 150, 120, 80, 0xe0b06e);
      ellipse(g, 46, 70, 40, 80, 0x8a5a3a);
      ellipse(g, 154, 70, 40, 80, 0x8a5a3a);
      circle(g, 100, 84, 58, 0xe0b06e);
      ellipse(g, 100, 106, 56, 40, 0xfff1d6, 3);
      circle(g, 100, 96, 10, INK, 0);
      circle(g, 78, 74, 7, INK, 0);
      circle(g, 122, 74, 7, INK, 0);
      arc(g, 100, 108, 12, 0.15 * PI, 0.85 * PI, 4);
      ellipse(g, 100, 128, 14, 16, COLORS.coral, 3);
      rect(g, 64, 132, 72, 14, 7, COLORS.turquoise, 3);
    },
  },
  luna: {
    w: 110,
    h: 110,
    draw: (g) => {
      circle(g, 55, 55, 42, 0xfff3b0);
      g.fillStyle(0xf2e08a).fillCircle(42, 44, 8).fillCircle(66, 70, 6);
    },
  },
  copito: {
    w: 120,
    h: 100,
    draw: (g) => {
      for (const [x, y, r] of [
        [34, 60, 24],
        [60, 44, 30],
        [88, 58, 24],
      ] as const)
        circle(g, x, y, r, COLORS.white);
      g.fillStyle(COLORS.white).fillRect(34, 60, 54, 24);
      line(g, 12, 84, 108, 84, 4);
    },
  },
  urna: {
    w: 190,
    h: 170,
    draw: (g) => {
      rect(g, 10, 40, 170, 124, 12, COLORS.sky);
      rect(g, 4, 26, 182, 28, 8, 0x5c9fd6);
      rect(g, 60, 34, 70, 10, 4, INK, 0);
      star(g, 95, 106, 26, COLORS.sun);
    },
  },
  boleta: {
    w: 70,
    h: 80,
    draw: (g) => {
      rect(g, 6, 6, 58, 68, 6, COLORS.white, 3);
      g.lineStyle(6, COLORS.grass).beginPath();
      g.moveTo(18, 40);
      g.lineTo(30, 54);
      g.lineTo(52, 24);
      g.strokePath();
    },
  },

  // ---------------- Íconos de derechos (memorama, mapa, álbum) ----------------
  'icon-vivienda': {
    w: 100,
    h: 100,
    draw: (g) => {
      rect(g, 22, 48, 56, 44, 4, 0xfff1d6);
      poly(g, [12, 50, 50, 14, 88, 50], COLORS.coral);
      rect(g, 42, 64, 18, 28, 4, 0x9a6b3f, 3);
    },
  },
  'icon-vida': {
    w: 100,
    h: 100,
    draw: (g) => {
      circle(g, 34, 40, 22, COLORS.coral, 0);
      circle(g, 66, 40, 22, COLORS.coral, 0);
      poly(g, [13, 46, 87, 46, 50, 90], COLORS.coral, 0);
      g.lineStyle(LW, INK);
      g.beginPath();
      g.arc(34, 40, 22, 0.8 * PI, 1.95 * PI);
      g.arc(66, 40, 22, 1.05 * PI, 0.2 * PI);
      g.lineTo(50, 90);
      g.closePath();
      g.strokePath();
      g.fillStyle(COLORS.white, 0.5).fillCircle(30, 34, 6);
    },
  },
  'icon-alimentacion': {
    w: 100,
    h: 100,
    draw: (g) => {
      ellipse(g, 50, 56, 66, 74, 0xffb43c);
      g.fillStyle(COLORS.coral, 0.55).fillEllipse(62, 42, 24, 24);
      ellipse(g, 66, 16, 26, 12, COLORS.grassDark, 3);
    },
  },
  'icon-salud': {
    w: 100,
    h: 100,
    draw: (g) => {
      circle(g, 50, 50, 42, COLORS.white);
      poly(
        g,
        [
          40, 22, 60, 22, 60, 40, 78, 40, 78, 60, 60, 60, 60, 78, 40, 78, 40, 60, 22, 60, 22, 40,
          40, 40,
        ],
        COLORS.coral,
        3,
      );
    },
  },
  'icon-educacion': {
    w: 100,
    h: 100,
    draw: (g) => {
      poly(g, [8, 26, 50, 34, 50, 86, 8, 78], COLORS.white);
      poly(g, [92, 26, 50, 34, 50, 86, 92, 78], COLORS.white);
      for (const y of [46, 58, 70]) {
        line(g, 16, y - 6, 42, y, 2, 0x9aa5b8);
        line(g, 84, y - 6, 58, y, 2, 0x9aa5b8);
      }
      rect(g, 44, 6, 12, 26, 3, COLORS.sun, 3);
    },
  },
  'icon-igualdad': {
    w: 100,
    h: 100,
    draw: (g) => {
      rect(g, 14, 50, 30, 40, 10, COLORS.turquoise);
      rect(g, 56, 50, 30, 40, 10, COLORS.grape);
      circle(g, 29, 34, 15, SKIN[3]);
      circle(g, 71, 34, 15, SKIN[1]);
      line(g, 44, 62, 56, 62, 6);
    },
  },
  'icon-juego': {
    w: 100,
    h: 100,
    draw: (g) => {
      circle(g, 40, 58, 32, COLORS.coral);
      g.fillStyle(COLORS.sun).fillEllipse(40, 58, 64, 18);
      g.lineStyle(LW, INK).strokeCircle(40, 58, 32);
      circle(g, 76, 26, 16, 0xfff3b0, 3);
      circle(g, 82, 21, 13, COLORS.cream, 0);
    },
  },
  'icon-opinion': {
    w: 100,
    h: 100,
    draw: (g) => {
      rect(g, 8, 14, 84, 58, 20, COLORS.white);
      poly(g, [26, 66, 44, 70, 22, 92], COLORS.white, 0);
      line(g, 26, 70, 22, 92, LW);
      line(g, 22, 92, 44, 72, LW);
      for (const x of [30, 50, 70]) circle(g, x, 43, 6, COLORS.turquoise, 0);
    },
  },
  'icon-isla': {
    w: 100,
    h: 100,
    draw: (g) => {
      ellipse(g, 50, 80, 90, 28, COLORS.sand);
      line(g, 50, 78, 56, 30, 7, 0x9a6b3f);
      ellipse(g, 38, 30, 40, 16, COLORS.grassDark, 3);
      ellipse(g, 70, 28, 40, 16, COLORS.grassDark, 3);
      ellipse(g, 56, 18, 34, 14, COLORS.grass, 3);
    },
  },

  // ---------------- Decoración ----------------
  palmera: {
    w: 130,
    h: 200,
    draw: (g) => {
      poly(g, [58, 190, 74, 190, 72, 60, 62, 60], 0x9a6b3f);
      ellipse(g, 36, 56, 64, 22, COLORS.grassDark, 3);
      ellipse(g, 96, 56, 64, 22, COLORS.grassDark, 3);
      ellipse(g, 46, 36, 56, 20, 0x3e9a4c, 3);
      ellipse(g, 88, 34, 56, 20, 0x3e9a4c, 3);
      circle(g, 62, 64, 8, 0x6b4a2b, 2);
      circle(g, 74, 66, 8, 0x6b4a2b, 2);
    },
  },
  izote: {
    w: 100,
    h: 150,
    draw: (g) => {
      line(g, 50, 146, 50, 40, 6, 0x5c8a3a);
      for (const [x, y] of [
        [50, 30],
        [38, 46],
        [62, 46],
        [40, 66],
        [60, 66],
        [50, 54],
      ] as const) {
        ellipse(g, x, y, 16, 22, 0xfff8e0, 3);
      }
      ellipse(g, 30, 132, 50, 14, COLORS.grassDark, 3);
      ellipse(g, 70, 132, 50, 14, COLORS.grassDark, 3);
    },
  },
  arbol: {
    w: 160,
    h: 180,
    draw: (g) => {
      rect(g, 70, 100, 22, 76, 6, 0x9a6b3f);
      circle(g, 52, 80, 40, 0x3e9a4c);
      circle(g, 108, 80, 40, 0x3e9a4c);
      circle(g, 80, 50, 46, 0x4fb35a);
      for (const [x, y] of [
        [56, 70],
        [100, 92],
        [86, 40],
        [116, 64],
      ] as const)
        ellipse(g, x, y, 14, 18, 0xffb43c, 2);
    },
  },
  nube: {
    w: 200,
    h: 100,
    draw: (g) => {
      g.fillStyle(COLORS.white, 0.95);
      g.fillCircle(56, 60, 34)
        .fillCircle(100, 44, 40)
        .fillCircle(146, 60, 32)
        .fillRoundedRect(30, 58, 140, 34, 17);
    },
  },
  'nube-gris': {
    w: 200,
    h: 100,
    draw: (g) => {
      g.fillStyle(0x8d97a8);
      g.fillCircle(56, 60, 34)
        .fillCircle(100, 44, 40)
        .fillCircle(146, 60, 32)
        .fillRoundedRect(30, 58, 140, 34, 17);
    },
  },
  sol: {
    w: 170,
    h: 170,
    draw: (g) => {
      sunRays(g);
      sunFace(g);
    },
  },
  'sol-rayos': { w: 170, h: 170, draw: (g) => sunRays(g) },
  'sol-cara': { w: 170, h: 170, draw: (g) => sunFace(g) },
  'luna-grande': {
    w: 170,
    h: 170,
    draw: (g) => {
      circle(g, 85, 85, 62, 0xfff3b0, 5);
      g.fillStyle(0xf2e08a).fillCircle(64, 66, 12).fillCircle(106, 108, 9).fillCircle(110, 62, 7);
      arc(g, 72, 88, 9, 0.1 * PI, 0.9 * PI, 4);
      arc(g, 104, 88, 9, 0.1 * PI, 0.9 * PI, 4);
    },
  },

  // ---------------- Derecho a la salud: hábitos y pasos ----------------
  'paso-mojar': {
    w: 120,
    h: 120,
    draw: (g) => {
      rect(g, 30, 8, 60, 16, 6, 0xc9d2dc);
      rect(g, 70, 20, 14, 22, 4, 0xc9d2dc);
      for (const [x, y] of [
        [72, 52],
        [80, 62],
        [70, 70],
      ] as const)
        ellipse(g, x, y, 8, 12, COLORS.sky, 2);
      hands(g, 60, 92);
    },
  },
  'paso-jabon': {
    w: 120,
    h: 120,
    draw: (g) => {
      rect(g, 22, 50, 76, 44, 18, COLORS.pink);
      g.fillStyle(COLORS.white, 0.5).fillRoundedRect(32, 56, 40, 10, 5);
      for (const [x, y, r] of [
        [40, 34, 10],
        [62, 24, 13],
        [84, 36, 9],
        [96, 20, 6],
      ] as const) {
        circle(g, x, y, r, COLORS.white, 3);
      }
    },
  },
  'paso-frotar': {
    w: 120,
    h: 120,
    draw: (g) => {
      hands(g, 60, 66);
      for (const [x, y, r] of [
        [22, 40, 9],
        [98, 36, 11],
        [30, 96, 8],
        [94, 92, 9],
        [60, 20, 10],
      ] as const) {
        circle(g, x, y, r, COLORS.white, 3);
      }
    },
  },
  'paso-enjuagar': {
    w: 120,
    h: 120,
    draw: (g) => {
      rect(g, 30, 8, 60, 16, 6, 0xc9d2dc);
      rect(g, 70, 20, 14, 22, 4, 0xc9d2dc);
      rect(g, 70, 42, 14, 36, 6, COLORS.sky, 2);
      hands(g, 60, 94);
      circle(g, 28, 70, 7, COLORS.white, 2);
    },
  },
  'paso-secar': {
    w: 120,
    h: 120,
    draw: (g) => {
      rect(g, 14, 10, 92, 60, 10, COLORS.turquoise);
      line(g, 14, 30, 106, 30, 4, COLORS.white);
      line(g, 14, 44, 106, 44, 4, COLORS.white);
      hands(g, 60, 94);
    },
  },
  agua: {
    w: 110,
    h: 110,
    draw: (g) => {
      poly(g, [26, 14, 84, 14, 76, 100, 34, 100], COLORS.white);
      poly(g, [31, 40, 79, 40, 76, 96, 34, 96], COLORS.sky, 0);
      g.lineStyle(LW, INK).strokePoints(
        [
          { x: 26, y: 14 },
          { x: 84, y: 14 },
          { x: 76, y: 100 },
          { x: 34, y: 100 },
        ],
        true,
        true,
      );
      g.fillStyle(COLORS.white, 0.6).fillEllipse(46, 62, 8, 26);
    },
  },
  cepillo: {
    w: 120,
    h: 120,
    draw: (g) => {
      rect(g, 8, 70, 74, 18, 9, COLORS.turquoise);
      rect(g, 78, 62, 30, 26, 6, COLORS.white);
      for (let x = 82; x < 106; x += 6) line(g, x, 62, x, 46, 4, 0x9fd9ff);
      ellipse(g, 94, 40, 30, 16, COLORS.white, 3);
      g.fillStyle(COLORS.coral).fillRect(84, 38, 20, 4);
    },
  },
  despertador: {
    w: 120,
    h: 120,
    draw: (g) => {
      circle(g, 30, 26, 14, COLORS.sun);
      circle(g, 90, 26, 14, COLORS.sun);
      circle(g, 60, 66, 42, COLORS.coral);
      circle(g, 60, 66, 32, COLORS.white, 3);
      line(g, 60, 66, 60, 44, 5);
      line(g, 60, 66, 76, 72, 5);
      line(g, 36, 104, 30, 114, 5);
      line(g, 84, 104, 90, 114, 5);
    },
  },
  desayuno: {
    w: 130,
    h: 120,
    draw: (g) => {
      ellipse(g, 52, 54, 84, 30, 0xf2d3a8);
      for (const [x, y] of [
        [36, 50],
        [50, 46],
        [64, 52],
        [44, 58],
        [60, 58],
      ] as const)
        g.fillStyle(0xd9a072).fillCircle(x, y, 5);
      poly(g, [10, 56, 94, 56, 80, 96, 24, 96], COLORS.sun);
      line(g, 82, 40, 104, 18, 6, 0xc9d2dc);
      rect(g, 100, 54, 24, 46, 6, COLORS.white);
      g.fillStyle(COLORS.sky, 0.5).fillRect(103, 66, 18, 30);
    },
  },
  'dormir-tarde': {
    w: 120,
    h: 120,
    draw: (g) => {
      rect(g, 6, 6, 108, 108, 18, 0x2b3a6b);
      circle(g, 36, 34, 16, 0xfff3b0, 3);
      circle(g, 44, 28, 14, 0x2b3a6b, 0);
      star(g, 92, 24, 7, COLORS.white, 2);
      star(g, 70, 16, 5, COLORS.white, 2);
      circle(g, 74, 76, 28, COLORS.white);
      line(g, 74, 76, 74, 56, 4);
      line(g, 74, 76, 62, 70, 4);
    },
  },

  // ---------------- Íconos de los nuevos derechos ----------------
  'icon-familia': {
    w: 100,
    h: 100,
    draw: (g) => {
      rect(g, 8, 50, 28, 42, 10, COLORS.grape);
      rect(g, 64, 50, 28, 42, 10, COLORS.turquoise);
      rect(g, 38, 66, 24, 28, 9, COLORS.sun);
      circle(g, 22, 34, 14, SKIN[2]);
      circle(g, 78, 34, 14, SKIN[1]);
      circle(g, 50, 52, 11, SKIN[3]);
      g.fillStyle(COLORS.coral)
        .fillCircle(50, 16, 6)
        .fillCircle(58, 16, 6)
        .fillTriangle(44, 18, 64, 18, 54, 30);
    },
  },
  'icon-identidad': {
    w: 100,
    h: 100,
    draw: (g) => {
      rect(g, 6, 18, 88, 64, 10, COLORS.white);
      rect(g, 6, 18, 88, 16, 6, COLORS.sea, 3);
      circle(g, 30, 56, 13, SKIN[2], 3);
      g.fillStyle(HAIR.black).fillEllipse(30, 48, 26, 12);
      for (const y of [48, 60, 70]) line(g, 50, y, 84, y, 4, 0x9aa5b8);
    },
  },

  // ---------------- Mar ----------------
  velero: {
    w: 110,
    h: 110,
    draw: (g) => {
      line(g, 52, 14, 52, 78, 4);
      poly(g, [56, 18, 56, 74, 96, 74], COLORS.white);
      poly(g, [48, 26, 48, 74, 18, 74], COLORS.cream);
      poly(g, [52, 10, 70, 16, 52, 22], COLORS.coral, 3);
      poly(g, [10, 80, 100, 80, 88, 100, 22, 100], COLORS.coral);
      line(g, 22, 90, 88, 90, 3, COLORS.white);
    },
  },

  // ---------------- Para atrapar (motor "catch") ----------------
  canasta: {
    w: 210,
    h: 160,
    draw: (g) => {
      arc(g, 105, 70, 62, PI, 2 * PI, 14, INK);
      arc(g, 105, 70, 62, PI, 2 * PI, 8, 0xc68642);
      poly(g, [10, 60, 200, 60, 176, 150, 34, 150], 0xe0a96d);
      for (const y of [86, 112, 136])
        line(g, 22 + (y - 60) * 0.25, y, 188 - (y - 60) * 0.25, y, 3, 0xb9834e);
      for (const x of [60, 105, 150]) line(g, x, 64, x + (x - 105) * 0.12, 146, 3, 0xb9834e);
      rect(g, 4, 54, 202, 18, 9, 0xc68642);
    },
  },
  'caja-juguetes': {
    w: 210,
    h: 170,
    draw: (g) => {
      poly(g, [14, 52, 120, 8, 134, 30, 28, 74], COLORS.coral);
      rect(g, 16, 66, 178, 98, 14, COLORS.grape);
      rect(g, 16, 66, 178, 20, 8, 0x7357d9, 3);
      star(g, 105, 122, 24, COLORS.sun);
      g.fillStyle(COLORS.white, 0.25).fillRoundedRect(26, 92, 16, 60, 8);
    },
  },

  // ---------------- Juegos nuevos (limpiar, pescar, construir, laberinto…) ----------------
  esponja: {
    w: 130,
    h: 100,
    draw: (g) => {
      rect(g, 10, 40, 110, 54, 12, 0xffd84a);
      rect(g, 10, 26, 110, 22, 8, 0x5cbf5a);
      g.fillStyle(0xe8b830);
      for (const [x, y, r] of [
        [30, 62, 5],
        [52, 76, 4],
        [74, 60, 6],
        [96, 78, 4],
        [104, 58, 3.5],
        [40, 82, 3],
      ] as const)
        g.fillCircle(x, y, r);
      g.fillStyle(COLORS.white, 0.5).fillRoundedRect(16, 50, 6, 30, 3);
      for (const [x, y, r] of [
        [34, 16, 10],
        [56, 10, 7],
        [96, 14, 11],
        [78, 20, 6],
      ] as const) {
        g.fillStyle(COLORS.white, 0.9).fillCircle(x, y, r);
        g.lineStyle(2, 0x7fc8f8).strokeCircle(x, y, r);
        g.fillStyle(COLORS.white).fillCircle(x - r * 0.35, y - r * 0.35, r * 0.25);
      }
    },
  },
  manos: {
    w: 170,
    h: 124,
    draw: (g) => {
      const skin = SKIN[1];
      for (const [x, dir] of [
        [52, -1],
        [118, 1],
      ] as const) {
        poly(g, [x + dir * 18, 64, x + dir * 40, 34, x + dir * 50, 42, x + dir * 28, 78], skin, 3);
        for (let i = 0; i < 4; i++)
          rect(g, x - 23 + i * 12, 10 + Math.abs(i - 1.5) * 4, 11, 44, 5.5, skin, 3);
        rect(g, x - 25, 42, 50, 56, 20, skin);
        line(g, x - 10, 64, x + 8, 62, 2.5, darker(skin, 0.25));
        rect(g, x - 23, 92, 46, 26, 8, COLORS.turquoise);
      }
    },
  },
  vaca: {
    w: 160,
    h: 124,
    draw: (g) => {
      const W = 0xfdfdfd;
      for (const x of [56, 74, 108, 126]) {
        rect(g, x - 6, 78, 13, 36, 4, W, 3);
        rect(g, x - 6, 106, 13, 10, 3, 0x4a3a30, 3);
      }
      line(g, 146, 56, 154, 88, 4);
      circle(g, 154, 92, 6, 0x2b2222, 0);
      ellipse(g, 92, 64, 112, 62, W);
      g.fillStyle(0x2b2222);
      g.fillCircle(76, 54, 11).fillCircle(86, 60, 8).fillCircle(70, 64, 6);
      g.fillCircle(116, 72, 10).fillCircle(124, 64, 7).fillCircle(112, 46, 6);
      ellipse(g, 100, 94, 24, 14, 0xffb3c1, 3);
      poly(g, [24, 26, 18, 12, 28, 22], 0xf3e3c0, 3);
      poly(g, [52, 26, 58, 12, 48, 22], 0xf3e3c0, 3);
      ellipse(g, 14, 38, 20, 12, W, 3);
      ellipse(g, 62, 38, 20, 12, W, 3);
      ellipse(g, 38, 50, 48, 46, W);
      g.fillStyle(0x2b2222).fillCircle(46, 38, 8);
      g.fillStyle(INK).fillCircle(30, 46, 4).fillCircle(46, 46, 4);
      g.fillStyle(COLORS.white).fillCircle(31, 45, 1.5).fillCircle(47, 45, 1.5);
      ellipse(g, 38, 66, 38, 22, 0xffb3c1, 3);
      g.fillStyle(0xc9707f).fillCircle(31, 66, 3).fillCircle(45, 66, 3);
    },
  },
  gallina: {
    w: 124,
    h: 124,
    draw: (g) => {
      poly(g, [88, 56, 116, 26, 114, 50, 120, 66, 96, 80], COLORS.white, 3);
      for (const x of [54, 72]) {
        line(g, x, 96, x, 114, 4, COLORS.orange);
        line(g, x, 114, x - 8, 118, 3, COLORS.orange);
        line(g, x, 114, x + 8, 118, 3, COLORS.orange);
      }
      ellipse(g, 64, 72, 80, 62, COLORS.white);
      ellipse(g, 74, 72, 42, 26, 0xf0ead8, 3);
      arc(g, 74, 66, 14, 0.1 * PI, 0.9 * PI, 2.5, 0xc9bfa8);
      circle(g, 30, 22, 6, COLORS.coral, 3);
      circle(g, 39, 18, 7, COLORS.coral, 3);
      circle(g, 48, 23, 6, COLORS.coral, 3);
      circle(g, 38, 42, 19, COLORS.white);
      poly(g, [20, 40, 6, 45, 20, 50], COLORS.orange, 3);
      ellipse(g, 24, 56, 9, 13, COLORS.coral, 2.5);
      g.fillStyle(INK).fillCircle(34, 38, 3.5);
      g.fillStyle(COLORS.white).fillCircle(35, 37, 1.2);
    },
  },
  huevo: {
    w: 120,
    h: 110,
    draw: (g) => {
      ellipse(g, 60, 76, 104, 42, 0xc68642);
      ellipse(g, 42, 60, 32, 42, 0xfff6e0, 3);
      ellipse(g, 70, 56, 34, 46, 0xf3dcc0, 3);
      g.fillStyle(COLORS.white, 0.8).fillEllipse(36, 54, 6, 12).fillEllipse(64, 48, 6, 13);
      g.fillStyle(0xb07a40).fillEllipse(60, 84, 108, 36);
      g.lineStyle(4, INK).strokeEllipse(60, 84, 108, 36);
      g.lineStyle(2.5, 0x8a5a32);
      for (const [x1, y1, x2, y2] of [
        [16, 80, 40, 92],
        [36, 76, 66, 96],
        [58, 78, 90, 92],
        [80, 76, 104, 86],
        [26, 92, 52, 84],
        [70, 96, 98, 80],
      ] as const)
        g.lineBetween(x1, y1, x2, y2);
    },
  },
  fuego: {
    w: 120,
    h: 124,
    draw: (g) => {
      g.fillStyle(INK, 0.15).fillEllipse(60, 116, 100, 10);
      poly(g, [12, 98, 100, 84, 106, 98, 18, 114], 0x8a5a32, 3);
      poly(g, [14, 84, 104, 100, 98, 114, 10, 98], 0xa0693a, 3);
      const flame = smooth([
        [60, 6],
        [72, 30],
        [86, 26],
        [92, 56],
        [82, 90],
        [38, 90],
        [28, 58],
        [34, 36],
        [46, 46],
      ]);
      const shrink = (k: number, fx: number, fy: number): Pt[] =>
        flame.map((p) => ({ x: fx + (p.x - fx) * k, y: fy + (p.y - fy) * k }));
      g.fillStyle(0xff5a36).fillPoints(flame, true);
      g.fillStyle(0xffa62b).fillPoints(shrink(0.68, 60, 90), true);
      g.fillStyle(0xffe066).fillPoints(shrink(0.38, 60, 92), true);
      g.lineStyle(4, INK).strokePoints(flame, true, true);
      g.fillStyle(COLORS.sun).fillCircle(94, 20, 3).fillCircle(26, 26, 2.5).fillCircle(84, 6, 2);
    },
  },
  charco: {
    w: 150,
    h: 70,
    draw: (g) => {
      const blob = smooth([
        [14, 36],
        [36, 16],
        [76, 12],
        [118, 16],
        [140, 34],
        [124, 54],
        [80, 60],
        [34, 56],
      ]);
      g.fillStyle(0x6fb8ef).fillPoints(blob, true);
      g.fillStyle(0x9fd4fa).fillEllipse(70, 32, 80, 22);
      g.lineStyle(4, INK).strokePoints(blob, true, true);
      g.lineStyle(3, COLORS.white, 0.9);
      g.strokeEllipse(96, 36, 30, 10);
      g.strokeEllipse(96, 36, 14, 5);
      g.fillStyle(COLORS.white, 0.9).fillEllipse(44, 28, 18, 5);
    },
  },
  piedra: {
    w: 130,
    h: 90,
    draw: (g) => {
      g.fillStyle(INK, 0.15).fillEllipse(65, 84, 110, 10);
      const rock = smooth([
        [12, 78],
        [20, 44],
        [46, 18],
        [80, 14],
        [110, 34],
        [120, 76],
      ]);
      g.fillStyle(0x9aa5b1).fillPoints(rock, true);
      g.fillStyle(0xb8c1cc).fillEllipse(56, 38, 50, 22);
      g.fillStyle(0x7d8894).fillEllipse(96, 66, 36, 18);
      g.lineStyle(4, INK).strokePoints(rock, true, true);
      g.lineStyle(2.5, 0x6b7580).lineBetween(70, 30, 78, 48).lineBetween(78, 48, 70, 60);
    },
  },
  'piso-casa': {
    w: 320,
    h: 60,
    draw: (g) => {
      rect(g, 4, 6, 312, 50, 8, 0x9aa5b1);
      g.fillStyle(0xb8c1cc);
      for (let row = 0; row < 2; row++) {
        for (let x = 12 + row * 24; x + 40 <= 308; x += 48)
          g.fillRoundedRect(x, 12 + row * 22, 40, 16, 5);
      }
      line(g, 6, 31, 314, 31, 2.5, 0x7d8894);
    },
  },
  'casa-planta': {
    w: 300,
    h: 170,
    draw: (g) => {
      rect(g, 4, 4, 292, 162, 6, 0xfff1d6, 5);
      for (let y = 30; y < 160; y += 26) line(g, 8, y, 292, y, 2, 0xeedcb8);
      rect(g, 122, 60, 56, 106, 8, 0x9a6b3f, 4);
      rect(g, 132, 72, 36, 26, 6, 0xb07a45, 3);
      circle(g, 166, 118, 5, COLORS.sun, 2);
      for (const x of [30, 200]) {
        rect(g, x, 36, 70, 60, 8, 0xbfe6ff, 4);
        line(g, x + 35, 38, x + 35, 94, 4);
        line(g, x + 2, 66, x + 68, 66, 4);
        rect(g, x - 4, 98, 78, 14, 5, 0x8a5a32, 3);
        for (let k = 0; k < 4; k++)
          circle(
            g,
            x + 8 + k * 18,
            96,
            6,
            [COLORS.coral, COLORS.sun, COLORS.pink, COLORS.coral][k] ?? COLORS.coral,
            2,
          );
      }
    },
  },
  'bloque-rojo': { w: 100, h: 100, draw: (g) => toyBlock(g, COLORS.coral, 'star') },
  'bloque-azul': { w: 100, h: 100, draw: (g) => toyBlock(g, COLORS.sea, 'circle') },
  'bloque-verde': { w: 100, h: 100, draw: (g) => toyBlock(g, COLORS.grass, 'triangle') },
  'bloque-amarillo': { w: 100, h: 100, draw: (g) => toyBlock(g, COLORS.sun, 'heart') },
  'mano-arriba': {
    w: 120,
    h: 150,
    draw: (g) => {
      const skin = SKIN[1];
      arc(g, 60, 50, 50, 1.05 * PI, 1.3 * PI, 4, COLORS.sun);
      arc(g, 60, 50, 50, 1.7 * PI, 1.95 * PI, 4, COLORS.sun);
      rect(g, 40, 96, 40, 52, 10, COLORS.turquoise);
      poly(g, [40, 76, 18, 50, 26, 44, 46, 64], skin, 3);
      for (let i = 0; i < 4; i++)
        rect(g, 38 + i * 12, 12 + Math.abs(i - 1.5) * 5, 11, 50, 5.5, skin, 3);
      rect(g, 36, 46, 50, 58, 20, skin);
      line(g, 50, 74, 70, 72, 2.5, darker(skin, 0.25));
    },
  },
} satisfies Record<string, ArtDef>;

/** Cubo de juguete con un símbolo blanco (estrella, círculo, triángulo o corazón). */
function toyBlock(g: G, color: number, symbol: 'star' | 'circle' | 'triangle' | 'heart'): void {
  rect(g, 6, 6, 88, 88, 14, color, 5);
  g.fillStyle(COLORS.white, 0.3).fillRoundedRect(14, 14, 72, 16, 8);
  g.fillStyle(darker(color, 0.15)).fillRoundedRect(14, 74, 72, 12, 6);
  if (symbol === 'star') star(g, 50, 52, 26, COLORS.white);
  else if (symbol === 'circle') circle(g, 50, 52, 22, COLORS.white, 3);
  else if (symbol === 'triangle') poly(g, [50, 26, 76, 72, 24, 72], COLORS.white, 3);
  else {
    g.fillStyle(COLORS.white).fillCircle(39, 44, 13).fillCircle(61, 44, 13);
    g.fillTriangle(27, 50, 73, 50, 50, 76);
  }
}

export type ArtKey = keyof typeof ART;

/** Clave de textura de un dibujo. */
export const tex = (key: ArtKey): string => `art-${key}`;

/** Genera (si faltan) las texturas de los dibujos indicados. */
export function ensureArt(scene: Phaser.Scene, keys: readonly ArtKey[]): void {
  for (const key of keys) {
    const k = tex(key);
    if (scene.textures.exists(k)) continue;
    const def: ArtDef = ART[key];
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    def.draw(g);
    g.generateTexture(k, def.w, def.h);
    g.destroy();
  }
}

/** Tamaño original (en px) de un dibujo. */
export function artSize(key: ArtKey): { w: number; h: number } {
  const def: ArtDef = ART[key];
  return { w: def.w, h: def.h };
}

/**
 * Genera el dibujo en alta resolución (k veces más grande) para mostrarlo ampliado sin
 * que se vea borroso. Devuelve la clave de la textura.
 */
export function ensureArtHD(scene: Phaser.Scene, key: ArtKey, k: number): string {
  const name = `${tex(key)}@${k}`;
  if (scene.textures.exists(name)) return name;
  const def: ArtDef = ART[key];
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.scaleCanvas(k, k);
  def.draw(g);
  g.generateTexture(name, Math.ceil(def.w * k), Math.ceil(def.h * k));
  g.destroy();
  return name;
}

/** Crea una imagen de un dibujo (generándolo si hace falta). */
export function artImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: ArtKey,
): Phaser.GameObjects.Image {
  ensureArt(scene, [key]);
  return scene.add.image(x, y, tex(key));
}
