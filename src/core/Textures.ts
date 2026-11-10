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
  crown: 0x22a8a3,
  brow: 0x9df1ea,
  body: 0x4fb35a,
  wing: 0x3e9a4c,
  belly: COLORS.orange,
  bellyLight: 0xffb070,
  beak: COLORS.ink,
  beakLow: 0x45406b,
  mouth: 0xd94a5a,
  shaft: 0x2f6f5e,
  tailBlue: 0x2a8fc7,
  feet: 0x8a6d5a,
};

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
    g.fillStyle(TORI.crown).fillEllipse(76, 42, 96, 46);
    g.fillStyle(TORI.brow).fillEllipse(76, 56, 118, 12);
    g.fillStyle(COLORS.coral, 0.55).fillCircle(36, 112, 11).fillCircle(116, 112, 11);
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
  make(scene, TEX.toriWing, 64, 116, (g) => {
    g.fillStyle(TORI.wing).fillEllipse(32, 58, 56, 106);
    g.fillStyle(TORI.turquoise).fillEllipse(32, 92, 40, 34);
    g.lineStyle(4, ink).strokeEllipse(32, 58, 56, 106);
  });
  // Cola larga con dos "raquetas" en las puntas (rasgo del torogoz).
  make(scene, TEX.toriTail, 92, 232, (g) => {
    // Base de plumas azules que se afina, tallos desnudos y dos raquetas.
    const base = [
      { x: 28, y: 0 },
      { x: 64, y: 0 },
      { x: 52, y: 104 },
      { x: 40, y: 104 },
    ];
    g.fillStyle(TORI.tailBlue).fillPoints(base, true);
    g.lineStyle(4, ink).strokePoints(base, true);
    g.lineStyle(5, TORI.shaft).lineBetween(43, 102, 30, 160).lineBetween(49, 102, 62, 160);
    for (const x of [28, 64]) {
      g.fillStyle(TORI.turquoise).fillEllipse(x, 186, 36, 58);
      g.fillStyle(ink).fillEllipse(x, 206, 22, 16);
      g.lineStyle(4, ink).strokeEllipse(x, 186, 36, 58);
    }
  });
  make(scene, TEX.toriFeet, 90, 24, (g) => {
    g.fillStyle(TORI.feet).fillRoundedRect(8, 5, 30, 14, 7).fillRoundedRect(52, 5, 30, 14, 7);
    g.lineStyle(3, ink).strokeRoundedRect(8, 5, 30, 14, 7).strokeRoundedRect(52, 5, 30, 14, 7);
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
