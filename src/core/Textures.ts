import type Phaser from 'phaser';
import { COLORS } from '@/config/theme';

/**
 * Texturas placeholder vectoriales generadas en tiempo de ejecución (0 KB de descarga).
 * Se dibujan UNA vez con Graphics y se convierten en textura: después se usan como Image,
 * que es mucho más barato de renderizar que un Graphics por frame.
 * El equipo puede reemplazarlas por un atlas: basta con cargar imágenes con las mismas claves.
 */
export const TEX = {
  toriHead: 'tori-head',
  toriMask: 'tori-mask',
  toriEye: 'tori-eye',
  toriPupil: 'tori-pupil',
  toriMouth: 'tori-mouth',
  toriBeakTop: 'tori-beak-top',
  toriBeakBottom: 'tori-beak-bottom',
  toriBody: 'tori-body',
  toriBelly: 'tori-belly',
  toriWing: 'tori-wing',
  toriTail: 'tori-tail',
  toriFeet: 'tori-feet',
  hand: 'ui-hand',
  ring: 'fx-ring',
  confetti: 'fx-confetti',
  sparkle: 'fx-sparkle',
  check: 'fx-check',
} as const;

const TORI = {
  turquoise: COLORS.turquoise,
  shine: 0x9ff0e6,
  body: 0x47b560,
  wing: 0x1f9e93,
  wingLight: 0x3cc4b4,
  belly: COLORS.orange,
  bellyLight: 0xffb070,
  beak: COLORS.ink,
  beakLow: 0x45406b,
  mouth: 0xd94a5a,
  shaft: 0x2f6fc7,
  feet: COLORS.orange,
  cheek: 0xff8fa8,
};

const PT = (x: number, y: number): { x: number; y: number } => ({ x, y });

type Draw = (g: Phaser.GameObjects.Graphics) => void;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Genera (si faltan) todas las texturas compartidas. Se llama en Preload. */
export function ensureTextures(scene: Phaser.Scene): void {
  const ink = COLORS.ink;

  // ---------- Tori, el torogoz ----------
  make(scene, TEX.toriHead, 152, 152, (g) => {
    g.fillStyle(TORI.turquoise).fillCircle(76, 76, 72);
    // Brillo claro en forma de casquito, arriba de la cabeza
    g.lineStyle(9, TORI.shine);
    g.beginPath();
    g.arc(76, 82, 56, Math.PI * 1.17, Math.PI * 1.83);
    g.strokePath();
    g.fillStyle(TORI.shine).fillCircle(76 + Math.cos(Math.PI * 1.17) * 56, 82 + Math.sin(Math.PI * 1.17) * 56, 4.5);
    g.fillCircle(76 + Math.cos(Math.PI * 1.83) * 56, 82 + Math.sin(Math.PI * 1.83) * 56, 4.5);
    g.fillStyle(TORI.cheek, 0.85).fillEllipse(34, 108, 22, 16).fillEllipse(118, 108, 22, 16);
    g.lineStyle(5, ink).strokeCircle(76, 76, 72);
  });
  make(scene, TEX.toriMask, 160, 52, (g) => {
    g.fillStyle(ink).fillRoundedRect(4, 4, 152, 44, 22);
  });
  make(scene, TEX.toriEye, 48, 48, (g) => {
    g.fillStyle(COLORS.white).fillCircle(24, 24, 20);
  });
  make(scene, TEX.toriPupil, 24, 24, (g) => {
    g.fillStyle(ink).fillCircle(12, 12, 10);
    g.fillStyle(COLORS.white).fillCircle(8, 8, 3.5);
  });
  make(scene, TEX.toriMouth, 30, 20, (g) => {
    g.fillStyle(TORI.mouth).fillEllipse(15, 10, 26, 16);
  });
  make(scene, TEX.toriBeakTop, 50, 40, (g) => {
    g.fillStyle(TORI.beak).fillTriangle(3, 3, 47, 3, 25, 37);
    g.lineStyle(3, 0x5a5480).lineBetween(15, 8, 24, 26);
  });
  make(scene, TEX.toriBeakBottom, 34, 18, (g) => {
    g.fillStyle(TORI.beakLow).fillTriangle(2, 1, 32, 1, 17, 16);
  });
  make(scene, TEX.toriBody, 160, 180, (g) => {
    g.fillStyle(TORI.body).fillEllipse(80, 90, 150, 170);
    g.lineStyle(5, ink).strokeEllipse(80, 90, 150, 170);
  });
  make(scene, TEX.toriBelly, 100, 124, (g) => {
    g.fillStyle(TORI.belly).fillEllipse(50, 62, 96, 118);
    g.fillStyle(TORI.bellyLight, 0.8).fillEllipse(50, 46, 58, 56);
  });
  make(scene, TEX.toriWing, 64, 124, (g) => {
    // Ala en forma de gota hacia abajo, con plumas marcadas.
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const y = 60 - Math.cos(t) * 56;
      const k = (y - 4) / 112;
      const halfW = 27 * Math.sin(Math.PI * Math.min(1, k * 1.15)) ** 0.7 + (k < 0.2 ? 6 : 0);
      pts.push(PT(32 + Math.sin(t) * halfW, y));
    }
    g.fillStyle(TORI.wing).fillPoints(pts, true);
    g.fillStyle(TORI.wingLight).fillEllipse(30, 46, 26, 60);
    g.lineStyle(3, 0x14716a);
    g.lineBetween(24, 70, 26, 104).lineBetween(34, 72, 34, 110).lineBetween(44, 70, 41, 102);
    g.lineStyle(4, ink).strokePoints(pts, true);
  });
  // Cola del torogoz: dos tallos largos que cuelgan rectos, con "raquetas" en las puntas.
  make(scene, TEX.toriTail, 80, 270, (g) => {
    for (const [x0, x1] of [
      [34, 24],
      [46, 56],
    ] as const) {
      g.lineStyle(9, ink).lineBetween(x0, 0, x1, 206);
      g.lineStyle(4.5, TORI.shaft).lineBetween(x0, 0, x1, 206);
    }
    for (const x of [24, 56]) {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 30; i++) {
        const t = (i / 30) * Math.PI * 2;
        const y = 232 - Math.cos(t) * 30;
        const k = (y - 202) / 60;
        pts.push(PT(x + Math.sin(t) * 13 * Math.sin(Math.PI * Math.min(1, k * 0.9 + 0.1)) ** 0.6, y));
      }
      g.fillStyle(TORI.turquoise).fillPoints(pts, true);
      g.lineStyle(2.5, 0x14716a).lineBetween(x, 210, x, 254);
      g.lineStyle(4, ink).strokePoints(pts, true);
    }
  });
  make(scene, TEX.toriFeet, 100, 30, (g) => {
    // Patitas naranjas con tres deditos que se agarran de la rama.
    for (const cx of [27, 73]) {
      for (const dx of [-11, 0, 11]) {
        g.fillStyle(TORI.feet).fillRoundedRect(cx + dx - 5.5, 6, 11, 20, 5.5);
        g.lineStyle(3, ink).strokeRoundedRect(cx + dx - 5.5, 6, 11, 20, 5.5);
      }
      g.fillStyle(TORI.feet).fillRoundedRect(cx - 16, 4, 32, 12, 6);
      g.lineStyle(3, ink).strokeRoundedRect(cx - 16, 4, 32, 12, 6);
      g.fillStyle(TORI.feet).fillRect(cx - 14, 8, 28, 6);
    }
  });

  // ---------- Mano de ayuda (guante blanco, sin tono de piel específico) ----------
  make(scene, TEX.hand, 80, 104, (g) => {
    g.lineStyle(5, ink);
    g.fillStyle(COLORS.white).fillEllipse(16, 62, 22, 30).strokeEllipse(16, 62, 22, 30);
    g.fillStyle(COLORS.white)
      .fillRoundedRect(14, 38, 52, 50, 16)
      .strokeRoundedRect(14, 38, 52, 50, 16);
    g.fillStyle(COLORS.white).fillRoundedRect(26, 3, 18, 52, 9).strokeRoundedRect(26, 3, 18, 52, 9);
    g.lineStyle(3, ink).lineBetween(46, 46, 46, 58).lineBetween(56, 46, 56, 58);
    g.fillStyle(COLORS.turquoise).fillRoundedRect(18, 86, 44, 14, 5);
    g.lineStyle(4, ink).strokeRoundedRect(18, 86, 44, 14, 5);
  });

  // ---------- Efectos ----------
  make(scene, TEX.ring, 64, 64, (g) => {
    g.lineStyle(6, COLORS.white).strokeCircle(32, 32, 28);
  });
  make(scene, TEX.confetti, 14, 8, (g) => {
    g.fillStyle(COLORS.white).fillRect(0, 0, 14, 8);
  });
  make(scene, TEX.sparkle, 28, 28, (g) => {
    g.fillStyle(COLORS.white).fillPoints(
      [
        { x: 14, y: 0 },
        { x: 17, y: 11 },
        { x: 28, y: 14 },
        { x: 17, y: 17 },
        { x: 14, y: 28 },
        { x: 11, y: 17 },
        { x: 0, y: 14 },
        { x: 11, y: 11 },
      ],
      true,
    );
  });
  // Acierto: forma + ícono (no solo color).
  make(scene, TEX.check, 84, 84, (g) => {
    g.fillStyle(COLORS.grass).fillCircle(42, 42, 38);
    g.lineStyle(5, ink).strokeCircle(42, 42, 38);
    g.lineStyle(9, ink).beginPath();
    g.moveTo(24, 44);
    g.lineTo(37, 57);
    g.lineTo(61, 29);
    g.strokePath();
  });
}
