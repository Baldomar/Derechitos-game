import type Phaser from 'phaser';
import { COLORS } from '@/config/theme';
import { artSize, ensureArtHD, tex, type ArtKey } from './Art';

/**
 * Miniaturas ilustradas de cada juego: una escenita (fondo temático + 2-3 dibujos
 * relacionados) que muestra de qué se trata, en lugar de un solo ícono suelto.
 * Se componen una vez en una textura de alta resolución con esquinas redondeadas.
 */

/** Caja lógica de la miniatura (misma proporción que el recuadro de la tarjeta). */
const W = 100;
const H = 92;
/** Resolución de la textura (px por unidad lógica). */
const RES = 2.4;
const R = 14;
const INK = COLORS.ink;

type Bg =
  | 'park'
  | 'room'
  | 'clinic'
  | 'bath'
  | 'classroom'
  | 'paper'
  | 'kitchen'
  | 'market'
  | 'sea'
  | 'night'
  | 'trophy'
  | 'play'
  | 'talk'
  | 'split'
  | 'farm';

type Deco =
  | 'sparkles'
  | 'bubbles'
  | 'dots'
  | 'lupa'
  | 'hearts'
  | 'speech'
  | 'notes'
  | 'path'
  | 'plate'
  | 'line'
  | 'stars';

interface Part {
  a: ArtKey;
  x: number;
  y: number;
  /** Tamaño (lado mayor) en unidades lógicas. */
  s: number;
  r?: number;
  /** Sombrita en el piso. */
  sh?: boolean;
}

interface Scene {
  bg: Bg;
  parts: Part[];
  below?: Deco[];
  above?: Deco[];
}

const P = (a: ArtKey, x: number, y: number, s: number, r = 0, sh = false): Part => ({
  a,
  x,
  y,
  s,
  r,
  sh,
});

/** Escenita de cada juego (por id de actividad). */
const SCENES: Record<string, Scene> = {
  // ------------------------------------------------ Salud
  'sano-no-sano': {
    bg: 'split',
    parts: [
      P('corazon-sano', 27, 40, 42),
      P('corazon-enfermo', 74, 40, 38),
      P('mango', 25, 72, 22),
      P('soda', 75, 72, 24),
    ],
  },
  'lava-manos': { bg: 'bath', parts: [P('paso-frotar', 50, 50, 62)], above: ['bubbles'] },
  'visita-doctor': {
    bg: 'clinic',
    parts: [
      P('doctora', 34, 52, 72, 0, true),
      P('termometro', 74, 36, 32, 25),
      P('curita', 74, 68, 28, -15),
    ],
  },
  'fuera-microbios': {
    bg: 'bath',
    parts: [P('manos', 42, 54, 52), P('esponja', 74, 36, 32, -20)],
    above: ['bubbles'],
  },
  'carrera-sana': {
    bg: 'park',
    parts: [
      P('nino', 38, 54, 62, 6, true),
      P('mango', 74, 30, 22, 10),
      P('guineo', 78, 62, 26, -10),
    ],
    below: ['path'],
  },
  'repaso-salud': { bg: 'trophy', parts: [P('icon-salud', 50, 47, 58)], above: ['sparkles'] },
  clinica: {
    bg: 'clinic',
    parts: [P('nino-enfermo', 40, 52, 70, 0, true), P('termometro', 76, 40, 30, 25)],
  },

  // ------------------------------------------------ Educación
  'une-puntos': { bg: 'paper', parts: [P('lapiz', 60, 58, 56, -35)], below: ['dots'] },
  'busca-utiles': {
    bg: 'classroom',
    parts: [
      P('mochila', 30, 58, 40, 0, true),
      P('tijeras', 62, 70, 26, -20),
      P('lapiz', 78, 62, 28, 60),
    ],
    above: ['lupa'],
  },
  'arma-salon': { bg: 'classroom', parts: [P('salon', 50, 54, 78)] },
  'desafio-educacion': {
    bg: 'trophy',
    parts: [P('icon-educacion', 50, 47, 58)],
    above: ['sparkles'],
  },
  rompecabezas: {
    bg: 'classroom',
    parts: [
      P('mochila', 36, 56, 46, -6, true),
      P('cuaderno', 72, 58, 36, 10),
      P('crayon', 70, 28, 24, 40),
    ],
  },
  'memorama-derechos': {
    bg: 'classroom',
    parts: [P('icon-isla', 50, 48, 58)],
    above: ['sparkles'],
  },

  // ------------------------------------------------ Vida
  'me-cuidan': {
    bg: 'room',
    parts: [P('mama', 36, 50, 74, 0, true), P('nino-a', 68, 60, 50, 0, true)],
    above: ['hearts'],
  },
  'cruzo-seguro': {
    bg: 'park',
    parts: [
      P('mama', 34, 50, 72, 0, true),
      P('nino', 60, 60, 48, 0, true),
      P('carrito', 84, 76, 26),
    ],
    below: ['path'],
  },
  'lugares-seguros': {
    bg: 'farm',
    parts: [P('icon-vivienda', 42, 46, 58), P('nino-c', 78, 60, 44, 0, true)],
  },
  'camino-seguro': {
    bg: 'park',
    parts: [P('nino-a', 28, 58, 50, 0, true), P('icon-vivienda', 76, 42, 38)],
    below: ['path'],
  },
  'que-necesita': {
    bg: 'park',
    parts: [
      P('icon-vivienda', 28, 42, 40),
      P('nino-c', 66, 56, 60, 0, true),
      P('curita', 30, 74, 22, -15),
    ],
  },
  'desafio-vida': { bg: 'trophy', parts: [P('icon-vida', 50, 47, 58)], above: ['sparkles'] },

  // ------------------------------------------------ Alimentación
  'plato-sano': {
    bg: 'kitchen',
    parts: [P('verduras', 38, 52, 30), P('mango', 62, 46, 26), P('frijoles', 54, 66, 28)],
    below: ['plate'],
  },
  mercado: {
    bg: 'market',
    parts: [P('canasta', 50, 64, 50), P('guineo', 34, 40, 28, -15), P('mango', 64, 38, 26, 10)],
  },
  'pesca-sana': {
    bg: 'sea',
    parts: [P('mango', 36, 66, 22, 10), P('guineo', 70, 74, 24, -10)],
    above: ['line'],
  },
  'de-donde-viene': {
    bg: 'farm',
    parts: [
      P('vaca', 38, 54, 56, 0, true),
      P('leche', 78, 58, 32, 0, true),
      P('huevo', 78, 26, 18),
    ],
  },
  'desafio-alimentacion': {
    bg: 'trophy',
    parts: [P('icon-alimentacion', 50, 47, 58)],
    above: ['sparkles'],
  },
  lonchera: {
    bg: 'kitchen',
    parts: [P('lonchera', 46, 56, 56, 0, true), P('mango', 78, 34, 24, 15), P('agua', 80, 64, 26)],
  },

  // ------------------------------------------------ Vivienda
  'une-puntos-casa': {
    bg: 'paper',
    parts: [P('icon-vivienda', 46, 48, 52), P('lapiz', 76, 66, 30, -35)],
    below: ['dots'],
  },
  'construye-casa': {
    bg: 'farm',
    parts: [P('casa-planta', 50, 62, 54, 0, true), P('techo', 50, 26, 44, -6)],
    above: ['sparkles'],
  },
  'busca-en-casa': {
    bg: 'room',
    parts: [
      P('perrito', 34, 62, 40, 0, true),
      P('cuento', 72, 66, 28, 10),
      P('despertador', 70, 32, 24),
    ],
    above: ['lupa'],
  },
  'limpiamos-casa': {
    bg: 'room',
    parts: [P('papa', 40, 50, 74, 0, true), P('esponja', 76, 60, 30, -20)],
    above: ['bubbles'],
  },
  'desafio-vivienda': {
    bg: 'trophy',
    parts: [P('icon-vivienda', 50, 47, 58)],
    above: ['sparkles'],
  },
  'casa-segura': {
    bg: 'farm',
    parts: [P('icon-vivienda', 40, 46, 58), P('icon-familia', 78, 64, 32)],
  },

  // ------------------------------------------------ Igualdad
  'respeto-si-no': {
    bg: 'play',
    parts: [P('nina-b', 32, 52, 66, 0, true), P('nino-c', 68, 52, 66, 0, true)],
    above: ['hearts'],
  },
  juntos: {
    bg: 'park',
    parts: [
      P('nino-a', 22, 56, 54, 0, true),
      P('nina-silla', 52, 58, 50, 0, true),
      P('nina-b', 82, 56, 54, 0, true),
    ],
  },
  'camino-rampas': {
    bg: 'park',
    parts: [P('nina-silla', 36, 56, 56, 0, true), P('rampa', 76, 70, 38)],
  },
  'amigos-diferentes': {
    bg: 'play',
    parts: [
      P('nino-a', 24, 54, 56, 0, true),
      P('nina-b', 50, 52, 60, 0, true),
      P('nino-c', 76, 54, 56, 0, true),
    ],
  },
  'desafio-igualdad': {
    bg: 'trophy',
    parts: [P('icon-igualdad', 50, 47, 58)],
    above: ['sparkles'],
  },
  parque: {
    bg: 'park',
    parts: [P('arbol', 74, 40, 50), P('nina-silla', 36, 58, 52, 0, true)],
  },

  // ------------------------------------------------ Jugar y descansar
  'repite-juego': {
    bg: 'play',
    parts: [P('trompo', 34, 58, 38, -10, true), P('pelota', 70, 62, 30, 0, true)],
    above: ['notes'],
  },
  'torre-bloques': {
    bg: 'play',
    parts: [
      P('bloque-rojo', 46, 70, 26, 0, true),
      P('bloque-azul', 50, 46, 26, 4),
      P('bloque-amarillo', 46, 22, 26, -6),
    ],
  },
  'atrapa-juguetes': {
    bg: 'park',
    parts: [
      P('caja-juguetes', 50, 66, 44, 0, true),
      P('pelota', 28, 26, 22),
      P('trompo', 72, 22, 22, 20),
    ],
  },
  'carrera-parque': {
    bg: 'park',
    parts: [P('nina-b', 38, 54, 64, 6, true), P('papalote', 78, 26, 32, 15)],
    below: ['path'],
  },
  'desafio-juego': { bg: 'trophy', parts: [P('icon-juego', 50, 47, 58)], above: ['sparkles'] },
  'dia-noche': {
    bg: 'night',
    parts: [P('luna-grande', 28, 28, 32), P('camita', 58, 64, 56, 0, true)],
    above: ['stars'],
  },

  // ------------------------------------------------ Opinión
  'ronda-ideas': {
    bg: 'classroom',
    parts: [
      P('nina-b', 30, 58, 56, 0, true),
      P('nino-c', 66, 58, 56, 0, true),
      P('mano-arriba', 84, 30, 28, 10),
    ],
    above: ['speech'],
  },
  'votamos-juntos': {
    bg: 'classroom',
    parts: [P('urna', 48, 62, 48, 0, true), P('boleta', 72, 30, 28, 15)],
  },
  'como-se-siente': {
    bg: 'talk',
    parts: [
      P('cara-feliz', 28, 30, 30),
      P('cara-triste', 72, 30, 30),
      P('cara-asustada', 28, 66, 30),
      P('cara-enojada', 72, 66, 30),
    ],
  },
  'hablo-escucho': {
    bg: 'classroom',
    parts: [P('nino-a', 30, 56, 60, 0, true), P('mano-arriba', 70, 50, 40, 10)],
    above: ['speech'],
  },
  'desafio-opinion': { bg: 'trophy', parts: [P('icon-opinion', 50, 47, 58)], above: ['sparkles'] },
  'mi-voz': {
    bg: 'talk',
    parts: [P('nina-b', 32, 54, 64, 0, true), P('cara-feliz', 72, 52, 30)],
    above: ['speech', 'hearts'],
  },
};

// ------------------------------------------------------------------ fondos

function star(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  fill: number,
): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
  }
  g.fillStyle(fill).fillPoints(pts, true);
}

function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(COLORS.white, 0.95)
    .fillCircle(x, y, 6 * s)
    .fillCircle(x + 7 * s, y - 3 * s, 7 * s)
    .fillCircle(x + 14 * s, y, 6 * s)
    .fillRect(x, y, 14 * s, 6 * s);
}

function floor(g: Phaser.GameObjects.Graphics, y: number, color: number, line: number): void {
  g.fillStyle(color).fillRect(0, y, W, H - y);
  g.fillStyle(line, 0.6);
  for (let x = -6; x < W; x += 18) g.fillRect(x, y, 1.5, H - y);
  g.fillStyle(0x000000, 0.08).fillRect(0, y, W, 3);
}

function drawBg(g: Phaser.GameObjects.Graphics, bg: Bg): void {
  switch (bg) {
    case 'park':
    case 'farm': {
      g.fillStyle(0xbfe8ff).fillRect(0, 0, W, H);
      g.fillStyle(0xa6dcfb).fillRect(0, 0, W, 26);
      g.fillStyle(COLORS.sun).fillCircle(88, 12, 9);
      g.fillStyle(0xffe58a, 0.5).fillCircle(88, 12, 13);
      cloud(g, 10, 14, 0.9);
      cloud(g, 52, 20, 0.7);
      g.fillStyle(0x9ed98a).fillEllipse(20, 70, 90, 40).fillEllipse(85, 72, 90, 36);
      g.fillStyle(COLORS.grass).fillRect(0, 70, W, H - 70);
      g.fillStyle(COLORS.grassDark, 0.5);
      for (let x = 4; x < W; x += 12) g.fillTriangle(x, 86, x + 3, 79, x + 6, 86);
      if (bg === 'farm') {
        // Cerca de madera.
        g.fillStyle(0xd9a86c);
        g.fillRect(0, 62, W, 3).fillRect(0, 68, W, 3);
        for (let x = 4; x < W; x += 14) g.fillRect(x, 58, 4, 14);
      }
      break;
    }
    case 'room': {
      g.fillStyle(0xffe9c9).fillRect(0, 0, W, H);
      g.fillStyle(0xffdcae);
      for (let x = 0; x < W; x += 12) g.fillRect(x, 0, 5, 68);
      // Ventanita.
      g.fillStyle(0xbfe8ff).fillRoundedRect(70, 10, 22, 20, 3);
      g.lineStyle(2, 0x9a6b3f).strokeRoundedRect(70, 10, 22, 20, 3).lineBetween(81, 10, 81, 30);
      floor(g, 68, 0xd9a86c, 0xb07a45);
      break;
    }
    case 'clinic': {
      g.fillStyle(0xdff6f4).fillRect(0, 0, W, H);
      g.fillStyle(0xc6eeea).fillRect(0, 44, W, 26);
      g.fillStyle(COLORS.white).fillRoundedRect(76, 6, 18, 18, 4);
      g.fillStyle(0xe23b3b).fillRect(83, 9, 4, 12).fillRect(79, 13, 12, 4);
      floor(g, 72, 0xf4f7fa, 0xd8e0ea);
      break;
    }
    case 'bath': {
      g.fillStyle(0xd7f0ff).fillRect(0, 0, W, H);
      g.lineStyle(1.5, 0xb8dcf2);
      for (let x = 0; x <= W; x += 12) g.lineBetween(x, 0, x, H);
      for (let y = 0; y <= H; y += 12) g.lineBetween(0, y, W, y);
      g.fillStyle(0xffffff, 0.35).fillRect(0, 0, W, 20);
      break;
    }
    case 'classroom': {
      g.fillStyle(0xfff3c4).fillRect(0, 0, W, H);
      g.fillStyle(0x9a6b3f).fillRoundedRect(10, 6, 80, 32, 4);
      g.fillStyle(0x3f7d5a).fillRoundedRect(13, 9, 74, 26, 3);
      g.lineStyle(1.5, COLORS.white, 0.7).lineBetween(20, 18, 44, 18).lineBetween(20, 26, 36, 26);
      g.fillStyle(COLORS.white, 0.8).fillCircle(66, 20, 2).fillCircle(72, 24, 2);
      floor(g, 72, 0xe8c98f, 0xcda56a);
      break;
    }
    case 'paper': {
      g.fillStyle(COLORS.white).fillRect(0, 0, W, H);
      g.lineStyle(1.2, 0xbfe3ff);
      for (let y = 14; y < H; y += 10) g.lineBetween(0, y, W, y);
      g.lineStyle(1.2, COLORS.coral, 0.6).lineBetween(14, 0, 14, H);
      break;
    }
    case 'kitchen': {
      g.fillStyle(0xfff8e7).fillRect(0, 0, W, H);
      for (let y = 0; y < 60; y += 10) {
        for (let x = (y / 10) % 2 === 0 ? 0 : 10; x < W; x += 20) {
          g.fillStyle(0xd6f1ef).fillRect(x, y, 10, 10);
        }
      }
      g.fillStyle(0xb07a45).fillRect(0, 60, W, 6);
      g.fillStyle(0xe2b88a).fillRect(0, 66, W, H - 66);
      break;
    }
    case 'market': {
      g.fillStyle(0xfff3d6).fillRect(0, 0, W, H);
      // Toldo de rayas.
      for (let x = 0; x < W; x += 12.5) {
        g.fillStyle(Math.round(x / 12.5) % 2 === 0 ? COLORS.coral : COLORS.white).fillRect(
          x,
          0,
          12.5,
          18,
        );
        g.fillCircle(x + 6.25, 18, 6.25);
      }
      g.fillStyle(0xb07a45).fillRect(0, 74, W, H - 74);
      g.fillStyle(0x9a6b3f).fillRect(0, 74, W, 4);
      break;
    }
    case 'sea': {
      g.fillStyle(0xbfe8ff).fillRect(0, 0, W, 30);
      cloud(g, 12, 14, 0.8);
      g.fillStyle(COLORS.sea).fillRect(0, 30, W, H - 30);
      g.fillStyle(0x3fa9db).fillRect(0, 60, W, H - 60);
      g.lineStyle(2, COLORS.white, 0.7);
      for (const y of [36, 48, 58]) {
        for (let x = 4; x < W; x += 24) {
          g.beginPath();
          g.arc(x + 6, y, 6, Math.PI, 2 * Math.PI);
          g.strokePath();
        }
      }
      break;
    }
    case 'night': {
      g.fillStyle(0x2f3a78).fillRect(0, 0, W, H);
      g.fillStyle(0x3b4a92).fillRect(0, 0, W, 40);
      floor(g, 76, 0x5a4a8a, 0x4a3c75);
      break;
    }
    case 'trophy': {
      g.fillStyle(0xffe58a).fillRect(0, 0, W, H);
      g.fillStyle(0xffd24d);
      for (let i = 0; i < 12; i += 2) {
        const a0 = (i / 12) * Math.PI * 2;
        const a1 = ((i + 1) / 12) * Math.PI * 2;
        g.fillTriangle(
          W / 2,
          H / 2,
          W / 2 + Math.cos(a0) * 90,
          H / 2 + Math.sin(a0) * 90,
          W / 2 + Math.cos(a1) * 90,
          H / 2 + Math.sin(a1) * 90,
        );
      }
      g.fillStyle(COLORS.white, 0.45).fillCircle(W / 2, H / 2 - 2, 34);
      // Confeti.
      const conf = [COLORS.coral, COLORS.turquoise, COLORS.grape, COLORS.pink];
      [
        [10, 12],
        [86, 16],
        [14, 78],
        [88, 74],
        [30, 6],
        [70, 84],
      ].forEach(([x, y], i) => {
        g.fillStyle(conf[i % conf.length] ?? COLORS.coral).fillRect(x ?? 0, y ?? 0, 5, 3);
      });
      break;
    }
    case 'play': {
      g.fillStyle(0xece4ff).fillRect(0, 0, W, H);
      g.fillStyle(0xdcd0ff);
      for (let y = 6; y < 70; y += 14) {
        for (let x = (y / 14) % 2 < 1 ? 6 : 13; x < W; x += 14) g.fillCircle(x, y, 2.5);
      }
      g.fillStyle(0xffb3c9).fillEllipse(W / 2, 82, 110, 30);
      g.fillStyle(0xff9ec0).fillEllipse(W / 2, 84, 80, 18);
      break;
    }
    case 'talk': {
      g.fillStyle(0xffe3ef).fillRect(0, 0, W, H);
      g.fillStyle(0xffd0e3);
      for (let x = -20; x < W + 20; x += 16) g.fillTriangle(x, H, x + 8, H, x + 40, 0);
      g.fillStyle(0xf6c1d8).fillRect(0, 76, W, H - 76);
      break;
    }
    case 'split': {
      g.fillStyle(0xd9f5dd).fillRect(0, 0, W / 2, H);
      g.fillStyle(0xffe1da).fillRect(W / 2, 0, W / 2, H);
      g.fillStyle(0xbfe9c6).fillRect(0, 58, W / 2, H - 58);
      g.fillStyle(0xffcfc4).fillRect(W / 2, 58, W / 2, H - 58);
      g.lineStyle(2, COLORS.white).lineBetween(W / 2, 0, W / 2, H);
      break;
    }
  }
}

function drawDeco(g: Phaser.GameObjects.Graphics, d: Deco): void {
  switch (d) {
    case 'sparkles':
      for (const [x, y, r] of [
        [16, 22, 6],
        [84, 24, 5],
        [80, 72, 6],
        [20, 70, 4],
      ] as const) {
        star(g, x, y, r + 1.5, INK);
        star(g, x, y, r, COLORS.white);
      }
      break;
    case 'stars':
      for (const [x, y, r] of [
        [56, 12, 3],
        [78, 22, 4],
        [90, 8, 2.5],
        [12, 54, 2.5],
        [86, 44, 3],
      ] as const) {
        star(g, x, y, r, 0xfff3b0);
      }
      break;
    case 'bubbles':
      for (const [x, y, r] of [
        [18, 20, 6],
        [28, 10, 4],
        [80, 18, 5],
        [88, 34, 3.5],
        [16, 76, 4],
        [86, 80, 5],
      ] as const) {
        g.fillStyle(COLORS.white, 0.75).fillCircle(x, y, r);
        g.lineStyle(1.5, 0x7cc8f2).strokeCircle(x, y, r);
        g.fillStyle(COLORS.white).fillCircle(x - r * 0.35, y - r * 0.35, r * 0.3);
      }
      break;
    case 'dots': {
      const pts = [
        [24, 70],
        [24, 30],
        [50, 12],
        [78, 30],
        [78, 70],
      ];
      g.lineStyle(2, INK, 0.35);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i] ?? [0, 0];
        const b = pts[i + 1] ?? [0, 0];
        for (let t = 0; t < 1; t += 0.16) {
          const x1 = (a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t;
          const y1 = (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t;
          const x2 = (a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * (t + 0.08);
          const y2 = (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * (t + 0.08);
          g.lineBetween(x1, y1, x2, y2);
        }
      }
      pts.forEach(([x, y]) => {
        g.fillStyle(COLORS.white).fillCircle(x ?? 0, y ?? 0, 4.5);
        g.lineStyle(1.8, INK).strokeCircle(x ?? 0, y ?? 0, 4.5);
        g.fillStyle(INK).fillCircle(x ?? 0, y ?? 0, 1.6);
      });
      break;
    }
    case 'lupa': {
      const x = 78;
      const y = 26;
      g.lineStyle(5, INK).lineBetween(x + 8, y + 8, x + 16, y + 16);
      g.lineStyle(3.5, 0x9a6b3f).lineBetween(x + 8, y + 8, x + 15, y + 15);
      g.fillStyle(0xd7f0ff, 0.7).fillCircle(x, y, 11);
      g.lineStyle(3, INK).strokeCircle(x, y, 11);
      g.fillStyle(COLORS.white, 0.9).fillCircle(x - 4, y - 4, 3);
      break;
    }
    case 'hearts':
      for (const [x, y, s] of [
        [14, 16, 1],
        [86, 14, 0.8],
        [88, 46, 0.6],
      ] as const) {
        g.fillStyle(COLORS.coral)
          .fillCircle(x - 3 * s, y, 3.6 * s)
          .fillCircle(x + 3 * s, y, 3.6 * s);
        g.fillTriangle(x - 6.6 * s, y + 1, x + 6.6 * s, y + 1, x, y + 8 * s);
      }
      break;
    case 'speech': {
      g.fillStyle(COLORS.white).fillRoundedRect(58, 6, 34, 18, 8);
      g.fillTriangle(64, 22, 72, 22, 62, 30);
      g.lineStyle(2, INK).strokeRoundedRect(58, 6, 34, 18, 8);
      g.fillStyle(INK).fillCircle(67, 15, 2).fillCircle(75, 15, 2).fillCircle(83, 15, 2);
      break;
    }
    case 'notes': {
      for (const [x, y] of [
        [16, 22],
        [82, 16],
        [56, 12],
      ] as const) {
        g.fillStyle(COLORS.grape).fillEllipse(x, y + 8, 7, 5);
        g.lineStyle(2, COLORS.grape).lineBetween(x + 3, y + 8, x + 3, y - 4);
        g.lineBetween(x + 3, y - 4, x + 8, y);
      }
      break;
    }
    case 'path':
      g.fillStyle(0xf6dfa4).fillRect(0, 72, W, 10);
      g.fillStyle(0xe8c983).fillCircle(14, 77, 1.5).fillCircle(48, 76, 1.5).fillCircle(80, 78, 1.5);
      break;
    case 'plate':
      g.fillStyle(0x000000, 0.12).fillEllipse(51, 62, 74, 34);
      g.fillStyle(COLORS.white).fillEllipse(50, 58, 74, 36);
      g.lineStyle(2, INK).strokeEllipse(50, 58, 74, 36);
      g.lineStyle(1.5, 0xcfd8e3).strokeEllipse(50, 58, 56, 24);
      break;
    case 'line':
      g.lineStyle(1.5, INK).lineBetween(54, 0, 54, 40);
      g.lineStyle(2.5, INK);
      g.beginPath();
      g.arc(50, 42, 4, 0, Math.PI);
      g.strokePath();
      g.fillStyle(COLORS.coral).fillCircle(54, 30, 3.5);
      break;
  }
}

/** ¿Este juego tiene escenita propia? */
export function hasGameIcon(id: string): boolean {
  return id in SCENES;
}

/**
 * Devuelve la textura de la miniatura ilustrada del juego (la crea la primera vez) o, si no
 * hay escenita para ese id, la textura del ícono suelto.
 */
export function gameIcon(scene: Phaser.Scene, id: string, fallback: ArtKey): string {
  const sc = SCENES[id];
  if (!sc) return tex(fallback);
  const key = `gicon-${id}`;
  if (scene.textures.exists(key)) return key;
  const dt = scene.textures.addDynamicTexture(key, Math.round(W * RES), Math.round(H * RES));
  if (!dt) return tex(fallback);

  const layer = (draw: (g: Phaser.GameObjects.Graphics) => void, erase = false): void => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false).setScale(RES);
    draw(g);
    if (erase) dt.erase(g);
    else dt.draw(g);
    g.destroy();
  };

  layer((g) => {
    drawBg(g, sc.bg);
    sc.below?.forEach((d) => drawDeco(g, d));
    // Sombritas en el piso de los personajes.
    for (const p of sc.parts) {
      if (!p.sh) continue;
      const { w, h } = artSize(p.a);
      const k = p.s / Math.max(w, h);
      g.fillStyle(0x000000, 0.14).fillEllipse(p.x, p.y + (h * k) / 2 - 1, w * k * 0.8, 6);
    }
  });

  const HD = 2;
  for (const p of sc.parts) {
    const { w, h } = artSize(p.a);
    const key2 = ensureArtHD(scene, p.a, HD);
    const scale = (p.s * RES) / (Math.max(w, h) * HD);
    dt.stamp(key2, undefined, p.x * RES, p.y * RES, {
      scale,
      angle: p.r ?? 0,
      originX: 0.5,
      originY: 0.5,
    });
  }

  if (sc.above?.length) layer((g) => sc.above?.forEach((d) => drawDeco(g, d)));

  // Esquinas redondeadas: se borra lo que queda fuera del recuadro.
  layer((g) => {
    g.fillStyle(0xffffff);
    const corner = (cx: number, cy: number, px: number, py: number, a0: number): void => {
      const pts = [{ x: px, y: py }];
      for (let i = 0; i <= 8; i++) {
        const a = a0 + (i / 8) * (Math.PI / 2);
        pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
      }
      g.fillPoints(pts, true);
    };
    corner(R, R, -1, -1, Math.PI);
    corner(W - R, R, W + 1, -1, -Math.PI / 2);
    corner(W - R, H - R, W + 1, H + 1, 0);
    corner(R, H - R, -1, H + 1, Math.PI / 2);
  }, true);
  return key;
}
