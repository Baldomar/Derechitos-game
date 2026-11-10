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
}

function face(g: G, cx: number, cy: number, r: number): void {
  g.fillStyle(INK)
    .fillCircle(cx - r * 0.34, cy + 2, r * 0.13)
    .fillCircle(cx + r * 0.34, cy + 2, r * 0.13);
  arc(g, cx, cy + r * 0.22, r * 0.36, 0.2 * PI, 0.8 * PI, 3);
  g.fillStyle(COLORS.coral, 0.45)
    .fillCircle(cx - r * 0.55, cy + r * 0.3, r * 0.16)
    .fillCircle(cx + r * 0.55, cy + r * 0.3, r * 0.16);
}

function person(g: G, w: number, h: number, o: PersonOpts): void {
  const adult = o.adult ?? false;
  const cx = o.wheelchair ? w / 2 - 14 : w / 2;
  const headR = adult ? 25 : 28;
  const bodyH = adult ? 72 : 50;
  const bodyW = adult ? 56 : 50;
  const bottom = h - 6;
  const legH = adult ? 62 : 44;

  let bodyTop: number;
  if (o.wheelchair) {
    const seatY = h - 70;
    // Silla de ruedas: rueda grande, asiento, respaldo y rueda pequeña.
    circle(g, cx + 6, h - 46, 40, 0xe4ebf2);
    circle(g, cx + 6, h - 46, 30, 0xe4ebf2, 3);
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 4;
      line(
        g,
        cx + 6 - Math.cos(a) * 30,
        h - 46 - Math.sin(a) * 30,
        cx + 6 + Math.cos(a) * 30,
        h - 46 + Math.sin(a) * 30,
        2,
      );
    }
    rect(g, cx - 34, seatY - 64, 12, 76, 5, 0x5a6b7d);
    rect(g, cx - 34, seatY, 80, 12, 5, 0x5a6b7d);
    line(g, cx + 40, seatY + 10, cx + 52, h - 18, 5, 0x5a6b7d);
    circle(g, cx + 54, h - 14, 9, 0x5a6b7d);
    rect(g, cx - 10, seatY - 14, 54, 18, 8, o.pants);
    rect(g, cx + 30, seatY - 6, 16, 40, 7, o.pants);
    ellipse(g, cx + 44, seatY + 36, 24, 12, INK, 0);
    bodyTop = seatY - 12 - bodyH;
  } else {
    const legTop = bottom - legH;
    rect(g, cx - 19, legTop - 6, 16, legH + 2, 6, o.pants);
    rect(g, cx + 3, legTop - 6, 16, legH + 2, 6, o.pants);
    ellipse(g, cx - 13, bottom - 3, 24, 11, INK, 0);
    ellipse(g, cx + 13, bottom - 3, 24, 11, INK, 0);
    bodyTop = legTop - bodyH;
    if (o.skirt)
      poly(
        g,
        [
          cx - bodyW / 2 + 2,
          bodyTop + bodyH * 0.55,
          cx + bodyW / 2 - 2,
          bodyTop + bodyH * 0.55,
          cx + bodyW / 2 + 10,
          legTop + 18,
          cx - bodyW / 2 - 10,
          legTop + 18,
        ],
        o.shirt,
      );
  }

  const shirt = o.coat ? COLORS.white : o.shirt;
  rect(g, cx - bodyW / 2 - 12, bodyTop + 6, 14, bodyH * 0.75, 7, shirt);
  rect(g, cx + bodyW / 2 - 2, bodyTop + 6, 14, bodyH * 0.75, 7, shirt);
  circle(g, cx - bodyW / 2 - 5, bodyTop + 6 + bodyH * 0.75, 7, o.skin, 3);
  circle(g, cx + bodyW / 2 + 5, bodyTop + 6 + bodyH * 0.75, 7, o.skin, 3);
  rect(g, cx - bodyW / 2, bodyTop, bodyW, bodyH, 14, shirt);
  if (o.coat) {
    line(g, cx, bodyTop + 4, cx, bodyTop + bodyH - 4, 3);
    rect(g, cx + 8, bodyTop + 16, 14, 14, 2, COLORS.white, 2);
    g.fillStyle(COLORS.coral)
      .fillRect(cx + 13, bodyTop + 18, 4, 10)
      .fillRect(cx + 10, bodyTop + 21, 10, 4);
    arc(g, cx - 8, bodyTop + 4, 14, 0.1 * PI, 0.9 * PI, 3, 0x45406b);
  }

  const headY = bodyTop - headR + 8;
  if (o.style === 'long' || o.style === 'braids') {
    rect(
      g,
      cx - headR - 5,
      headY - 8,
      (headR + 5) * 2,
      headR + (o.style === 'long' ? 34 : 14),
      14,
      o.hair,
      3,
    );
  }
  if (o.style === 'braids') {
    ellipse(g, cx - headR - 4, headY + headR + 14, 14, 30, o.hair, 3);
    ellipse(g, cx + headR + 4, headY + headR + 14, 14, 30, o.hair, 3);
  }
  if (o.style === 'bun') circle(g, cx, headY - headR - 6, 13, o.hair, 3);
  circle(g, cx, headY, headR, o.skin);
  if (o.style === 'curly') {
    for (let i = 0; i < 7; i++) {
      const a = PI + (i * PI) / 6;
      circle(
        g,
        cx + Math.cos(a) * headR * 0.92,
        headY + Math.sin(a) * headR * 0.92,
        headR * 0.34,
        o.hair,
        0,
      );
    }
  } else {
    g.fillStyle(o.hair).fillEllipse(cx, headY - headR * 0.52, headR * 2.08, headR * 1.12);
  }
  g.lineStyle(LW, INK).strokeCircle(cx, headY, headR);
  if (o.beard) g.fillStyle(o.hair).fillEllipse(cx, headY + headR * 0.72, headR * 1.2, headR * 0.5);
  face(g, cx, headY, headR);
  if (o.hat === 'chef') {
    rect(g, cx - 20, headY - headR - 20, 40, 22, 4, COLORS.white);
    circle(g, cx - 12, headY - headR - 24, 12, COLORS.white, 3);
    circle(g, cx + 12, headY - headR - 24, 12, COLORS.white, 3);
    circle(g, cx, headY - headR - 30, 13, COLORS.white, 3);
  }
  if (o.hat === 'beret') {
    ellipse(g, cx + 6, headY - headR + 4, headR * 2.1, 22, COLORS.coral);
    circle(g, cx + 6, headY - headR - 8, 4, INK, 0);
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
      ellipse(g, 55, 62, 76, 86, 0xffb43c);
      g.fillStyle(COLORS.coral, 0.55).fillEllipse(70, 44, 30, 30);
      line(g, 55, 22, 58, 10, 4, 0x6b4a2b);
      ellipse(g, 72, 16, 30, 14, COLORS.grassDark, 3);
    },
  },
  guineo: {
    w: 110,
    h: 110,
    draw: (g) => {
      arc(g, 40, 30, 58, 0.12 * PI, 0.72 * PI, 32, INK);
      arc(g, 40, 30, 58, 0.12 * PI, 0.72 * PI, 24, 0xffe066);
      circle(g, 94, 51, 6, 0x6b4a2b, 2);
      circle(g, 18, 83, 5, 0x6b4a2b, 2);
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
      poly(g, [30, 32, 55, 10, 80, 32], COLORS.sky);
      rect(g, 30, 32, 50, 72, 4, COLORS.white);
      rect(g, 30, 52, 50, 30, 0, COLORS.sky, 3);
      ellipse(g, 55, 67, 16, 20, COLORS.white, 2);
    },
  },
  verduras: {
    w: 110,
    h: 110,
    draw: (g) => {
      poly(g, [20, 40, 50, 40, 35, 102], COLORS.orange);
      line(g, 28, 58, 40, 56, 3);
      line(g, 30, 74, 38, 72, 3);
      ellipse(g, 28, 28, 12, 26, COLORS.grassDark, 3);
      ellipse(g, 42, 28, 12, 26, COLORS.grassDark, 3);
      rect(g, 70, 62, 14, 40, 5, 0x8fcf6a);
      circle(g, 64, 50, 16, 0x3e9a4c);
      circle(g, 88, 50, 16, 0x3e9a4c);
      circle(g, 76, 36, 18, 0x3e9a4c);
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
      rect(g, 28, 12, 54, 92, 12, 0xe8505b);
      rect(g, 28, 46, 54, 22, 0, COLORS.white, 3);
      for (const [x, y] of [
        [44, 26],
        [62, 32],
        [52, 84],
      ] as const)
        circle(g, x, y, 4, COLORS.white, 0);
    },
  },
  papitas: {
    w: 110,
    h: 110,
    draw: (g) => {
      poly(
        g,
        [24, 18, 34, 10, 44, 18, 55, 10, 66, 18, 76, 10, 86, 18, 90, 100, 20, 100],
        COLORS.sun,
      );
      ellipse(g, 55, 60, 46, 34, COLORS.orange, 3);
      ellipse(g, 50, 58, 16, 10, 0xffe0a0, 0);
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
  'osito-enfermo': {
    w: 200,
    h: 210,
    draw: (g) => {
      const fur = 0xb98a62;
      circle(g, 52, 50, 24, fur);
      circle(g, 148, 50, 24, fur);
      ellipse(g, 100, 165, 140, 90, fur);
      circle(g, 100, 92, 66, 0xc9a07c);
      ellipse(g, 100, 112, 54, 40, 0xf0dcc4, 3);
      circle(g, 100, 100, 9, INK, 0);
      arc(g, 74, 84, 10, 0.1 * PI, 0.9 * PI, 4);
      arc(g, 126, 84, 10, 0.1 * PI, 0.9 * PI, 4);
      arc(g, 100, 130, 12, 1.15 * PI, 1.85 * PI, 4);
      g.fillStyle(0x9fd9ff, 0.8).fillEllipse(68, 100, 10, 16);
      g.fillStyle(COLORS.coral, 0.35).fillCircle(100, 70, 40);
    },
  },
  'osito-sano': {
    w: 200,
    h: 210,
    draw: (g) => {
      const fur = 0xb98a62;
      circle(g, 52, 50, 24, fur);
      circle(g, 148, 50, 24, fur);
      ellipse(g, 100, 165, 140, 90, fur);
      circle(g, 100, 92, 66, 0xc9a07c);
      ellipse(g, 100, 112, 54, 40, 0xf0dcc4, 3);
      circle(g, 100, 100, 9, INK, 0);
      circle(g, 74, 80, 7, INK, 0);
      circle(g, 126, 80, 7, INK, 0);
      arc(g, 100, 112, 16, 0.15 * PI, 0.85 * PI, 4);
      g.fillStyle(COLORS.coral, 0.6).fillCircle(58, 106, 11).fillCircle(142, 106, 11);
      rect(g, 132, 150, 30, 14, 5, 0xf2d3a8, 3);
    },
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
      arc(g, 65, 30, 22, PI, 2 * PI, 8);
      rect(g, 20, 26, 90, 98, 24, COLORS.turquoise);
      rect(g, 34, 72, 62, 40, 12, COLORS.sun);
      line(g, 34, 86, 96, 86, 3);
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
    w: 120,
    h: 220,
    draw: (g) =>
      person(g, 120, 220, {
        skin: SKIN[2],
        hair: HAIR.black,
        style: 'long',
        shirt: COLORS.grape,
        pants: 0x4a6fa5,
        adult: true,
        skirt: true,
      }),
  },
  papa: {
    w: 120,
    h: 225,
    draw: (g) =>
      person(g, 120, 225, {
        skin: SKIN[2],
        hair: HAIR.black,
        style: 'short',
        shirt: COLORS.turquoise,
        pants: 0x3d4f6e,
        adult: true,
        beard: true,
      }),
  },
  abuela: {
    w: 120,
    h: 215,
    draw: (g) =>
      person(g, 120, 215, {
        skin: SKIN[2],
        hair: HAIR.gray,
        style: 'bun',
        shirt: COLORS.pink,
        pants: 0x6b5a7a,
        adult: true,
        skirt: true,
      }),
  },
  nino: {
    w: 100,
    h: 170,
    draw: (g) =>
      person(g, 100, 170, {
        skin: SKIN[2],
        hair: HAIR.black,
        style: 'curly',
        shirt: COLORS.sun,
        pants: 0x4a6fa5,
      }),
  },

  // ---------------- Parque (nivel 5) ----------------
  'nina-silla': {
    w: 160,
    h: 175,
    draw: (g) =>
      person(g, 160, 175, {
        skin: SKIN[1],
        hair: HAIR.brown,
        style: 'braids',
        shirt: COLORS.coral,
        pants: 0x4a6fa5,
        wheelchair: true,
      }),
  },
  'nino-a': {
    w: 100,
    h: 170,
    draw: (g) =>
      person(g, 100, 170, {
        skin: SKIN[4],
        hair: HAIR.black,
        style: 'short',
        shirt: COLORS.grass,
        pants: 0x3d4f6e,
      }),
  },
  'nina-b': {
    w: 100,
    h: 170,
    draw: (g) =>
      person(g, 100, 170, {
        skin: SKIN[0],
        hair: HAIR.blond,
        style: 'long',
        shirt: COLORS.grape,
        pants: 0x6b5a7a,
        skirt: true,
      }),
  },
  'nino-c': {
    w: 100,
    h: 170,
    draw: (g) =>
      person(g, 100, 170, {
        skin: SKIN[3],
        hair: HAIR.black,
        style: 'curly',
        shirt: COLORS.sky,
        pants: 0x4a6fa5,
      }),
  },
  rampa: {
    w: 200,
    h: 100,
    draw: (g) => {
      poly(g, [6, 94, 194, 94, 194, 8], 0xd9a86c, 5);
      for (let i = 1; i < 5; i++) line(g, 6 + i * 38, 94 - i * 17.2, 6 + i * 38, 94, 2, 0xb07a45);
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
      for (let i = 0; i < 12; i++) {
        const a = (i * PI) / 6;
        poly(
          g,
          [
            85 + Math.cos(a - 0.12) * 56,
            85 + Math.sin(a - 0.12) * 56,
            85 + Math.cos(a) * 82,
            85 + Math.sin(a) * 82,
            85 + Math.cos(a + 0.12) * 56,
            85 + Math.sin(a + 0.12) * 56,
          ],
          COLORS.sun,
          3,
        );
      }
      circle(g, 85, 85, 50, COLORS.sun, 5);
      circle(g, 68, 80, 6, INK, 0);
      circle(g, 102, 80, 6, INK, 0);
      arc(g, 85, 92, 18, 0.15 * PI, 0.85 * PI, 5);
    },
  },
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
} satisfies Record<string, ArtDef>;

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
