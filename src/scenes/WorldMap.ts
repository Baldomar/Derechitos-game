import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, FONTS, GAME_HEIGHT, GAME_WIDTH, TEXT_RESOLUTION } from '@/config/theme';
import { RIGHT_AREAS, type RightArea, type RightAreaId } from '@/config/rights';
import { VILLA_HELLO, VILLA_START } from '@/config/phrases';
import { ensureArt, tex } from '@/art/Art';
import { IdleHint } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { PillButton } from '@/components/PillButton';
import { SpeechBubble } from '@/components/SpeechBubble';
import { Tori } from '@/components/Tori';
import { addToriGuide } from '@/components/ToriGuide';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { setPageBackground } from '@/core/PageBackground';
import { viewportMargin } from '@/core/Viewport';
import { goTo, prefetchScene } from '@/core/SceneTransition';
import { TEX } from '@/core/Textures';

/** Mar extra a cada lado del área de diseño (pantallas panorámicas). */
const SEA_PAD = 320;
const NODE_R = 49; // 98 px de diámetro (> 88 px mínimo táctil)

/** Isla: óvalo de lados rectos ("superelipse") con un poco de ondulación natural. */
/** Cuánto se subió la isla (y todo lo que hay sobre ella) respecto al diseño original. */
const LIFT = 20;
const ISLE = { x: 702, y: 396 - LIFT, a: 560, b: 236 };
const SEA = 0x2794dc;
const SEA_LIGHT = 0x86d7f5;
const SHALLOW = 0xbaf0fb;
const SAND = 0xf5d98e;
const GRASS = 0x5cbd38;
const GRASS_DARK = 0x2e8a2a;
const GRASS_LIGHT = 0x7ad64e;
const LEAF = 0x3fae36;
const LEAF_LIGHT = 0x6fd04a;
const LEAF_DARK = 0x2a7d28;
const ROAD = 0xf0d496;
const WOOD = 0x9c6233;
const WOOD_DARK = 0x5e3517;

/** Zonas en zigzag: abajo, arriba, abajo, arriba… unidas por un caminito de arena. */
const SPOTS: Record<RightAreaId, { x: number; y: number }> = {
  salud: { x: 288, y: 478 },
  educacion: { x: 414, y: 312 },
  vida: { x: 540, y: 478 },
  alimentacion: { x: 666, y: 312 },
  vivienda: { x: 792, y: 478 },
  igualdad: { x: 918, y: 312 },
  jugar: { x: 1044, y: 478 },
  opinion: { x: 1170, y: 312 },
};
const spot = (r: RightArea): { x: number; y: number } => ({
  x: SPOTS[r.id].x,
  y: SPOTS[r.id].y - LIFT,
});

/** ¿Todas las actividades disponibles del derecho están completadas? */
const isDone = (r: RightArea): boolean => {
  const p = GameState.rightProgress(r);
  return p.total > 0 && p.done === p.total;
};

/** Estrellas (0–3) que muestra la zona según el avance del derecho. */
const progressStars = (r: RightArea): number => {
  const { stars, max } = GameState.rightStars(r);
  if (stars === 0 || max === 0) return 0;
  return Math.max(1, Math.round((3 * stars) / max));
};

/** Mezcla un color con blanco (f > 0) o con negro (f < 0). */
const tint = (color: number, f: number): number => {
  const ch = (shift: number): number => {
    const c = (color >> shift) & 255;
    return Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f));
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Punto del borde de la isla en el ángulo t, alejado `d` px hacia afuera. */
function islePoint(t: number, d: number, ox: number): Phaser.Math.Vector2 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const n = 3.4;
  const wobble = 1 + 0.025 * Math.sin(3 * t + 0.8) + 0.015 * Math.sin(5 * t + 2.1);
  const ex = Math.sign(c) * Math.abs(c) ** (2 / n);
  const ey = Math.sign(s) * Math.abs(s) ** (2 / n);
  return new Phaser.Math.Vector2(
    ox + ISLE.x + ex * (ISLE.a * wobble + d),
    ISLE.y + ey * (ISLE.b * wobble + d),
  );
}

function isleOutline(d: number, ox: number, steps = 180): Phaser.Math.Vector2[] {
  return Array.from({ length: steps }, (_, i) => islePoint((i / steps) * Math.PI * 2, d, ox));
}

/** Números pseudoaleatorios fijos (la textura sale igual siempre). */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Mapa de la Isla Derechitos: las 8 zonas en zigzag sobre plataformas de arena, unidas por un
 * caminito, con letreros de madera. Todas se pueden jugar; Salud está resaltada con "¡Aquí!".
 * Tori (abajo a la izquierda) guía con su globo; "Medallas" abajo a la derecha.
 */
export default class WorldMapScene extends Phaser.Scene {
  private bubble!: SpeechBubble;
  private tori!: Tori;
  private entering = false;
  private current: RightArea | null = null;
  /** Botones pegados a las orillas reales de la pantalla (x de diseño de cada uno). */
  private anchored: { obj: Phaser.GameObjects.Container; baseX: number; side: -1 | 1 }[] = [];

  constructor() {
    super('WorldMap');
  }

  create(): void {
    this.entering = false;
    ensureArt(this, ['palmera', 'nube', 'velero', ...RIGHT_AREAS.map((r) => r.icon)]);
    setPageBackground(this, { top: SEA });
    this.drawWorld();
    // Muelle, adornos y nubes se dibujaron con las medidas originales: se suben junto con la isla.
    const lifted: Phaser.GameObjects.GameObject[] = [];
    const track = (draw: () => void): void => {
      const from = this.children.list.length;
      draw();
      lifted.push(...this.children.list.slice(from));
    };
    track(() => this.addSeaLife());
    track(() => this.addClouds());
    this.drawRoad();
    track(() => this.addDecor());
    for (const obj of lifted) {
      const o = obj as Phaser.GameObjects.GameObject & { y: number };
      o.y -= LIFT;
    }

    // La zona resaltada con "¡Aquí!" es siempre Salud (el derecho principal, donde empieza el camino).
    this.current = RIGHT_AREAS.find((r) => r.featured) ?? RIGHT_AREAS[0] ?? null;
    RIGHT_AREAS.forEach((r, i) => this.addZone(r, i, r === this.current));

    ({ tori: this.tori, bubble: this.bubble } = addToriGuide(this));
    const featured = RIGHT_AREAS.find((r) => r.featured);
    const fresh = featured ? GameState.rightProgress(featured).done === 0 : false;
    this.time.delayedCall(
      450,
      () => void this.bubble.say(fresh ? [VILLA_HELLO, VILLA_START] : VILLA_HELLO),
    );
    new IdleHint(this, () => (this.current ? { kind: 'tap', ...spot(this.current) } : null));

    this.anchored = [];
    this.addHud();
    this.anchorHud();
    prefetchScene('RightHub');
    AudioManager.playMusic();
  }

  // ------------------------------------------------------------------ mar e isla

  /** Mar, agua clarita con línea punteada, playa, borde de arbustos y pasto con matitas. */
  private drawWorld(): void {
    const W = GAME_WIDTH + SEA_PAD * 2;
    const o = SEA_PAD;
    const key = bakedTexture(this, 'map-world-v9', W, GAME_HEIGHT, (g) => {
      // Mar: más claro cerca de la isla.
      g.fillStyle(SEA).fillRect(0, 0, W, GAME_HEIGHT);
      g.fillStyle(0x3aa4e3).fillPoints(isleOutline(150, o), true);
      g.fillStyle(0x58b9ec).fillPoints(isleOutline(105, o), true);
      g.fillStyle(SEA_LIGHT).fillPoints(isleOutline(70, o), true);
      // Olitas "~"
      g.lineStyle(4, COLORS.white, 0.55);
      for (const [x, y] of [
        [40, 170], [30, 470], [200, 660], [640, 112], [880, 100], [1210, 180], [1240, 520],
        [-160, 300], [-220, 600], [1420, 260], [1500, 560], [1380, 90], [-120, 90],
      ] as const) {
        g.beginPath();
        g.arc(x + o, y, 11, Math.PI * 1.1, Math.PI * 1.9);
        g.strokePath();
        g.beginPath();
        g.arc(x + o + 20, y, 11, Math.PI * 0.1, Math.PI * 0.9);
        g.strokePath();
        g.beginPath();
        g.arc(x + o + 40, y, 11, Math.PI * 1.1, Math.PI * 1.9);
        g.strokePath();
      }
      // Agua clarita y espuma punteada
      g.fillStyle(SHALLOW).fillPoints(isleOutline(46, o), true);
      g.fillStyle(COLORS.white);
      isleOutline(30, o, 120).forEach((p, i) => {
        if (i % 2 === 0) g.fillCircle(p.x, p.y, 3.6);
      });
      isleOutline(62, o, 150).forEach((p) => g.fillCircle(p.x, p.y, 3));
      // Playa
      g.fillStyle(COLORS.ink, 0.2).fillPoints(
        isleOutline(14, o).map((p) => new Phaser.Math.Vector2(p.x, p.y + 7)),
        true,
      );
      g.fillStyle(SAND).fillPoints(isleOutline(14, o), true);
      g.lineStyle(4, COLORS.ink, 0.85).strokePoints(isleOutline(14, o), true);
      // Granitos de arena
      g.fillStyle(0xd9b96a, 0.8);
      isleOutline(2, o, 90).forEach((p, i) =>
        g.fillCircle(p.x + (i % 3) * 3, p.y + (i % 2) * 3, 1.8),
      );
      // Borde de arbustitos (festón) y pasto
      g.fillStyle(GRASS_DARK);
      isleOutline(-12, o, 150).forEach((p) => g.fillCircle(p.x, p.y, 11));
      g.fillStyle(GRASS).fillPoints(isleOutline(-17, o), true);
      g.fillStyle(GRASS_LIGHT);
      isleOutline(-22, o, 150).forEach((p) => g.fillCircle(p.x, p.y, 6));
      g.fillStyle(GRASS).fillPoints(isleOutline(-26, o), true);
      // Manchas más claras
      g.fillStyle(0x6bc843, 0.8);
      g.fillEllipse(700 + o, 400, 760, 230);
      g.fillStyle(GRASS_LIGHT, 0.55);
      g.fillEllipse(330 + o, 560, 240, 50).fillEllipse(840 + o, 566, 280, 50);
      // Matitas de pasto repartidas
      const rnd = seeded(7);
      g.lineStyle(2.5, 0x3f9a2e, 0.9);
      for (let i = 0; i < 230; i++) {
        const t = rnd() * Math.PI * 2;
        const k = Math.sqrt(rnd()) * 0.86;
        const p = islePoint(t, -40, o);
        const x = o + ISLE.x + (p.x - o - ISLE.x) * k;
        const y = ISLE.y + (p.y - ISLE.y) * k;
        g.lineBetween(x - 4, y - 5, x - 1, y + 3);
        g.lineBetween(x - 1, y + 3, x + 2, y - 7);
        g.lineBetween(x + 2, y - 7, x + 5, y + 3);
      }
    });
    this.add.image(-SEA_PAD, 0, key).setOrigin(0);
  }

  /** Muelle con velero, pez que salta, gaviotas, estrella de mar, concha y destellos. */
  private addSeaLife(): void {
    // Muelle
    const pier = this.add.graphics();
    pier.fillStyle(WOOD_DARK);
    [96, 126, 156].forEach((px) => pier.fillRect(px - 4, 350, 8, 26));
    pier.fillStyle(WOOD).fillRect(80, 334, 108, 20);
    pier.lineStyle(3.5, COLORS.ink).strokeRect(80, 334, 108, 20);
    pier.lineStyle(2, WOOD_DARK);
    [102, 124, 146, 168].forEach((px) => pier.lineBetween(px, 336, px, 352));
    const boat = this.add.image(58, 302, tex('velero')).setScale(0.62);

    // Gaviotas
    const birds = this.add.graphics();
    birds.lineStyle(3, COLORS.ink);
    for (const [bx, by, s] of [
      [185, 150, 1],
      [216, 132, 0.8],
    ] as const) {
      birds.beginPath();
      birds.arc(bx - 8 * s, by, 8 * s, Math.PI * 1.15, Math.PI * 1.95);
      birds.strokePath();
      birds.beginPath();
      birds.arc(bx + 8 * s, by, 8 * s, Math.PI * 1.05, Math.PI * 1.85);
      birds.strokePath();
    }

    // Estrella de mar en la playa y concha
    const starfish = bakedTexture(this, 'map-starfish', 30, 30, (g) => {
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 6 : 13;
        pts.push(new Phaser.Geom.Point(15 + Math.cos(a) * r, 15 + Math.sin(a) * r));
      }
      g.fillStyle(COLORS.coral).fillPoints(pts, true);
      g.lineStyle(2.5, COLORS.ink).strokePoints(pts, true);
    });
    this.add.image(600, 618, starfish).setAngle(12);
    const shell = this.add.graphics();
    shell.fillStyle(0xffe2cf).fillCircle(1246, 332, 9);
    shell.lineStyle(2.5, COLORS.ink).strokeCircle(1246, 332, 9);
    shell.lineBetween(1246, 324, 1246, 340).lineBetween(1240, 326, 1243, 339);

    // Destellos sobre el agua
    const sparkleKey = bakedTexture(this, 'map-sparkle', 20, 20, (g) => {
      g.fillStyle(COLORS.white).fillPoints(
        [
          [10, 0], [12.5, 7.5], [20, 10], [12.5, 12.5], [10, 20], [7.5, 12.5], [0, 10], [7.5, 7.5],
        ].map(([sx, sy]) => new Phaser.Geom.Point(sx ?? 0, sy ?? 0)),
        true,
      );
    });
    const sparkles = (
      [
        [140, 250],
        [60, 560],
        [1250, 280],
        [1222, 600],
      ] as const
    ).map(([sx, sy]) => this.add.image(sx, sy, sparkleKey));

    if (prefersReducedMotion()) return;
    this.tweens.add({
      targets: boat,
      angle: { from: -4, to: 4 },
      y: '+=5',
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: birds,
      x: '+=30',
      y: '-=12',
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    sparkles.forEach((sp, i) =>
      this.tweens.add({
        targets: sp,
        scale: { from: 0.3, to: 1 },
        alpha: { from: 0.2, to: 1 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        delay: i * 450,
      }),
    );
  }

  /** Nubes que pasan despacio. */
  private addClouds(): void {
    const clouds: [number, number, number][] = [
      [315, 116, 0.6],
      [1030, 120, 0.55],
    ];
    clouds.forEach(([cx, cy, s], i) => {
      const c = this.add.image(cx, cy, tex('nube')).setScale(s).setAlpha(0.95);
      if (prefersReducedMotion()) return;
      const speed = 80 + i * 25; // ms por píxel
      this.tweens.add({
        targets: c,
        x: GAME_WIDTH + 200,
        duration: (GAME_WIDTH + 200 - cx) * speed,
        onComplete: () => {
          c.setX(-200);
          this.tweens.add({
            targets: c,
            x: GAME_WIDTH + 200,
            duration: (GAME_WIDTH + 400) * speed,
            repeat: -1,
          });
        },
      });
    });
  }

  /** Caminito de arena en zigzag con puntitos claros al centro y banderita de salida. */
  private drawRoad(): void {
    const pts = RIGHT_AREAS.map((r) => spot(r));
    const first = pts[0] ?? { x: 288, y: 478 };
    const start = { x: first.x - 70, y: first.y + 40 };
    const all = [start, ...pts];
    const g = this.add.graphics();
    const stroke = (width: number, color: number): void => {
      g.lineStyle(width, color);
      g.beginPath();
      g.moveTo(start.x, start.y);
      all.slice(1).forEach((p) => g.lineTo(p.x, p.y));
      g.strokePath();
      all.forEach((p) => g.fillStyle(color).fillCircle(p.x, p.y, width / 2));
    };
    stroke(34, 0x6b5235);
    stroke(26, ROAD);
    g.fillStyle(0xfff6dc);
    for (let i = 0; i < all.length - 1; i++) {
      const a = all[i] ?? start;
      const b = all[i + 1] ?? start;
      const n = Math.floor(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 16);
      for (let s = 1; s < n; s++) {
        g.fillCircle(a.x + ((b.x - a.x) * s) / n, a.y + ((b.y - a.y) * s) / n, 2.6);
      }
    }

    // Banderita de salida que ondea.
    const flagKey = bakedTexture(this, 'map-flag', 60, 50, (g2) => {
      g2.fillStyle(COLORS.coral).fillTriangle(4, 4, 56, 16, 4, 30);
      g2.lineStyle(4, COLORS.ink).strokeTriangle(4, 4, 56, 16, 4, 30);
    });
    const pole = this.add.graphics();
    pole.lineStyle(6, COLORS.ink).lineBetween(start.x - 8, start.y + 4, start.x - 8, start.y - 52);
    pole.lineStyle(3, COLORS.white).lineBetween(start.x - 8, start.y + 2, start.x - 8, start.y - 50);
    const flag = this.add.image(start.x - 8, start.y - 52, flagKey).setOrigin(0.02, 0.06);
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: flag,
        scaleX: 0.82,
        angle: 4,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
  }

  /** Palmera, árboles frutales, laguito, arbusto, piedras y flores. */
  private addDecor(): void {
    const palm = this.add.image(206, 410, this.palmTexture()).setOrigin(0.5, 0.96);

    const shadow = this.add.graphics();
    shadow.fillStyle(COLORS.ink, 0.18);
    shadow.fillEllipse(540, 304, 76, 16).fillEllipse(1044, 302, 76, 16).fillEllipse(1180, 522, 80, 17);
    this.add.image(540, 246, this.treeTexture(COLORS.orange));
    this.add.image(1044, 244, this.treeTexture(COLORS.pink));
    this.add.image(1180, 462, this.treeTexture(COLORS.orange)).setScale(1.05);

    // Laguito con su hoja de lirio y juncos
    const pond = this.add.graphics();
    pond.fillStyle(0xe8cf98).fillEllipse(792, 258, 136, 58);
    pond.lineStyle(3, COLORS.ink, 0.6).strokeEllipse(792, 258, 136, 58);
    pond.fillStyle(0x5cc3f0).fillEllipse(792, 258, 118, 44);
    pond.lineStyle(3, 0x2f86c4).strokeEllipse(792, 258, 118, 44);
    pond.lineStyle(3, COLORS.white, 0.8);
    pond.beginPath();
    pond.arc(772, 258, 11, Math.PI * 1.15, Math.PI * 1.85);
    pond.strokePath();
    pond.fillStyle(0x4fae45).fillEllipse(816, 262, 22, 10);
    pond.lineStyle(3, 0x3f8f35).lineBetween(740, 262, 736, 238).lineBetween(746, 264, 748, 242);

    // Arbusto esponjoso con bayas, y piedras
    this.add.image(426, 512, this.bushTexture());
    const rocks = this.add.graphics();
    rocks.fillStyle(0x9aa5b5).fillEllipse(656, 528, 52, 26);
    rocks.fillStyle(0xbcc5d2).fillEllipse(656, 524, 52, 30);
    rocks.fillStyle(0xe1e6ee).fillEllipse(648, 516, 22, 9);
    rocks.lineStyle(4, COLORS.ink).strokeEllipse(656, 524, 52, 30);
    rocks.fillStyle(0xd0d7e1).fillEllipse(688, 534, 28, 18);
    rocks.lineStyle(4, COLORS.ink).strokeEllipse(688, 534, 28, 18);

    const flowerKey = (petal: number): string =>
      bakedTexture(this, `map-flower2-${petal.toString(16)}`, 34, 44, (g) => {
        g.lineStyle(3, 0x3e9a4c).lineBetween(17, 42, 17, 20);
        g.fillStyle(petal);
        g.lineStyle(2, COLORS.ink, 0.8);
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI) / 5;
          g.fillCircle(17 + Math.cos(a) * 7, 15 + Math.sin(a) * 7, 5.5);
          g.strokeCircle(17 + Math.cos(a) * 7, 15 + Math.sin(a) * 7, 5.5);
        }
        g.fillStyle(COLORS.sun).fillCircle(17, 15, 4.5);
      });
    const flowers = (
      [
        [298, 298, COLORS.pink],
        [324, 310, COLORS.white],
        [894, 520, COLORS.white],
        [924, 532, COLORS.pink],
        [950, 512, 0xb9a4ff],
        [1106, 378, COLORS.white],
      ] as const
    ).map(([fx, fy, c]) => this.add.image(fx, fy, flowerKey(c)).setOrigin(0.5, 1));

    if (prefersReducedMotion()) return;
    this.tweens.add({
      targets: palm,
      angle: { from: -2, to: 3 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    flowers.forEach((f, i) =>
      this.tweens.add({
        targets: f,
        angle: { from: -8, to: 8 },
        duration: 1300 + (i % 3) * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
  }

  /** Copa esponjosa (muchos lóbulos) con borde de tinta, luces y frutas. */
  private treeTexture(fruit: number): string {
    return bakedTexture(this, `map-tree-v2-${fruit.toString(16)}`, 124, 132, (g) => {
      g.fillStyle(0x8a5a32).fillRect(54, 78, 16, 48);
      g.fillStyle(0x6b4224).fillRect(54, 78, 6, 48);
      g.lineStyle(4, COLORS.ink).strokeRect(54, 78, 16, 48);
      const lobes: [number, number, number][] = [
        [62, 30, 24], [40, 38, 22], [84, 38, 22], [28, 60, 20], [96, 60, 20],
        [42, 78, 20], [82, 78, 20], [62, 82, 20], [62, 54, 32],
      ];
      g.lineStyle(9, COLORS.ink);
      lobes.forEach(([x, y, r]) => g.strokeCircle(x, y, r));
      g.fillStyle(LEAF);
      lobes.forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(LEAF_LIGHT);
      g.fillCircle(52, 36, 18).fillCircle(70, 28, 13).fillCircle(36, 52, 11);
      g.lineStyle(3, LEAF_DARK);
      for (const [x, y] of [
        [86, 62], [44, 76], [70, 74], [92, 44],
      ] as const) {
        g.beginPath();
        g.arc(x, y, 9, Math.PI * 0.15, Math.PI * 0.85);
        g.strokePath();
      }
      for (const [x, y] of [
        [46, 42], [78, 46], [62, 66], [34, 66], [90, 66], [60, 24],
      ] as const) {
        g.fillStyle(fruit).fillCircle(x, y, 6);
        g.lineStyle(2.5, COLORS.ink).strokeCircle(x, y, 6);
        g.fillStyle(COLORS.white, 0.7).fillCircle(x - 2, y - 2, 1.8);
      }
    });
  }

  /** Arbusto esponjoso con bayas rosadas. */
  private bushTexture(): string {
    return bakedTexture(this, 'map-bush-v2', 104, 70, (g) => {
      const lobes: [number, number, number][] = [
        [26, 44, 20], [48, 30, 22], [72, 32, 20], [84, 48, 16], [52, 50, 22],
      ];
      g.lineStyle(8, COLORS.ink);
      lobes.forEach(([x, y, r]) => g.strokeCircle(x, y, r));
      g.fillStyle(LEAF);
      lobes.forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(LEAF_LIGHT).fillCircle(42, 28, 12).fillCircle(66, 26, 9);
      for (const [x, y] of [
        [30, 40], [52, 24], [70, 40], [46, 52], [82, 50], [60, 56],
      ] as const) {
        g.fillStyle(COLORS.pink).fillCircle(x, y, 4.5);
        g.lineStyle(2, COLORS.ink).strokeCircle(x, y, 4.5);
      }
    });
  }

  /** Palmera de coco: tronco curvo con anillos y hojas largas en forma de pluma. */
  private palmTexture(): string {
    return bakedTexture(this, 'map-palm-v2', 220, 250, (g) => {
      const trunk = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(104, 244),
        new Phaser.Math.Vector2(80, 160),
        new Phaser.Math.Vector2(118, 82),
      );
      const tp = trunk.getPoints(24);
      g.lineStyle(24, COLORS.ink).strokePoints(tp);
      g.lineStyle(17, 0xc48b4c).strokePoints(tp);
      g.lineStyle(6, 0xa06a35).strokePoints(tp.map((p) => new Phaser.Math.Vector2(p.x + 4, p.y)));
      g.lineStyle(3, 0x7a4c22);
      for (let i = 2; i < 24; i += 2) {
        const p = tp[i];
        if (!p) continue;
        g.lineBetween(p.x - 7, p.y - 2, p.x + 7, p.y + 2);
      }
      // Hojas: curva desde la copa hasta la punta, con bordes dentados.
      const crown = new Phaser.Math.Vector2(118, 80);
      const frond = (tx: number, ty: number, cx: number, cy: number, width: number): void => {
        const c = new Phaser.Curves.QuadraticBezier(
          crown,
          new Phaser.Math.Vector2(crown.x + cx, crown.y + cy),
          new Phaser.Math.Vector2(crown.x + tx, crown.y + ty),
        );
        const n = 16;
        const pts = c.getPoints(n);
        const top: Phaser.Math.Vector2[] = [];
        const bottom: Phaser.Math.Vector2[] = [];
        pts.forEach((p, i) => {
          const tan = c.getTangent(i / n);
          const nx = -tan.y;
          const ny = tan.x;
          const t = i / n;
          const w = width * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.6 * (i % 2 ? 1 : 0.6);
          top.push(new Phaser.Math.Vector2(p.x + nx * w, p.y + ny * w));
          bottom.push(new Phaser.Math.Vector2(p.x - nx * w, p.y - ny * w));
        });
        const shape = [...top, ...bottom.reverse()];
        g.fillStyle(LEAF).fillPoints(shape, true);
        g.lineStyle(3, COLORS.ink).strokePoints(shape, true);
        g.lineStyle(2.5, LEAF_DARK).strokePoints(pts);
      };
      frond(-96, 46, -50, -30, 15);
      frond(92, 42, 50, -34, 15);
      frond(-80, -24, -40, -46, 14);
      frond(84, -26, 40, -48, 14);
      frond(-14, -70, -20, -40, 13);
      frond(28, 70, 40, 10, 12);
      // Cocos
      for (const [x, y] of [
        [110, 90], [126, 92], [118, 100],
      ] as const) {
        g.fillStyle(0x7a4a26).fillCircle(x, y, 8);
        g.lineStyle(2.5, COLORS.ink).strokeCircle(x, y, 8);
      }
    });
  }

  // ------------------------------------------------------------------ zonas

  private addZone(r: RightArea, i: number, isCurrent: boolean): void {
    const { x, y } = spot(r);

    // Plataforma de arena bajo la zona (no se mueve con la animación).
    const plat = this.add.graphics();
    plat.fillStyle(0xc9a25f).fillEllipse(x, y + 42, 132, 42);
    plat.fillStyle(0xf0d398).fillEllipse(x, y + 38, 128, 38);
    plat.lineStyle(3, COLORS.ink, 0.7).strokeEllipse(x, y + 38, 128, 38);

    const zone = this.add.container(x, y);
    if (isCurrent) {
      const halo = this.add.circle(0, 2, NODE_R + 14, COLORS.white, 0.35);
      halo.setStrokeStyle(6, COLORS.white, 0.85);
      zone.add(halo);
      if (!prefersReducedMotion())
        this.tweens.add({
          targets: halo,
          scale: 1.12,
          alpha: 0.5,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
    }
    // Disco con "grosor" (base más oscura), anillo claro, brillo y el ícono del derecho.
    const base = this.add.circle(0, 7, NODE_R, tint(r.color, -0.3)).setStrokeStyle(4, COLORS.ink);
    const disc = this.add.circle(0, 0, NODE_R, r.color).setStrokeStyle(4, COLORS.ink);
    const inner = this.add.circle(0, 0, NODE_R - 10, tint(r.color, 0.18));
    const shine = this.add.ellipse(-15, -26, 32, 13, COLORS.white, 0.5).setAngle(-20);
    zone.add([base, disc, inner, shine, this.add.image(0, 0, tex(r.icon)).setScale(0.52)]);

    // Número (arriba a la derecha) y palomita si el derecho está completo (arriba a la izquierda).
    zone.add(
      this.add.circle(NODE_R - 12, -NODE_R + 12, 17, COLORS.white).setStrokeStyle(4, COLORS.ink),
    );
    zone.add(this.text(NODE_R - 12, -NODE_R + 13, String(i + 1), 21, CSS.ink));
    if (isDone(r) || GameState.hasRightMedal(r)) {
      zone.add(this.add.image(-NODE_R + 8, -NODE_R + 12, TEX.check).setScale(0.38));
    }

    // Letrero de madera con el nombre (amarillo en la zona resaltada).
    zone.add(this.sign(0, -NODE_R - 36, r.short, isCurrent));

    if (isCurrent) {
      zone.add(this.darkTag(0, NODE_R + 40, '¡Aquí!'));
    } else {
      const stars = progressStars(r);
      for (let s = 0; s < 3; s++)
        zone.add(addStarIcon(this, (s - 1) * 28, NODE_R + 38, 13, s < stars));
    }

    disc.setInteractive({ useHandCursor: true });
    disc.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => void this.select(r, zone));

    zone.setScale(0);
    this.tweens.add({
      targets: zone,
      scale: 1,
      duration: motion(400),
      delay: i * 70,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!isCurrent || prefersReducedMotion()) return;
        this.tweens.add({
          targets: zone,
          y: y - 6,
          duration: 650,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  /** Letrero de madera (o amarillo si es la zona resaltada) con clavitos. */
  private sign(x: number, y: number, s: string, gold: boolean): Phaser.GameObjects.Container {
    const label = this.text(0, 0, s, 20, gold ? CSS.ink : CSS.white);
    if (!gold) label.setShadow(0, 2, '#4a2a12', 0, false, true);
    const w = label.width + 32;
    const h = 36;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 9);
    g.fillStyle(gold ? 0xf2a516 : WOOD_DARK).fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    g.fillStyle(gold ? COLORS.sun : WOOD).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 8, 7);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
    g.fillStyle(gold ? 0xb7790f : WOOD_DARK);
    g.fillCircle(-w / 2 + 8, 0, 2.5).fillCircle(w / 2 - 8, 0, 2.5);
    return this.add.container(x, y, [g, label]);
  }

  /** Etiqueta oscura tipo píldora ("¡Aquí!"). */
  private darkTag(x: number, y: number, s: string): Phaser.GameObjects.Container {
    const label = this.text(0, 0, s, 18, CSS.white);
    const w = label.width + 28;
    const h = 32;
    const pill = this.add.graphics();
    pill.fillStyle(COLORS.ink).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    pill.lineStyle(3, COLORS.white, 0.9).strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
    return this.add.container(x, y, [pill, label]);
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

  // ------------------------------------------------------------------ HUD

  /**
   * En pantallas más anchas que el diseño (muchos celulares), lleva Inicio a la orilla izquierda
   * y Medallas + estrellas a la orilla derecha. Se recalcula al girar o cambiar el tamaño.
   */
  private anchorHud(): void {
    const place = (): void => {
      const m = viewportMargin(this.game).x;
      for (const a of this.anchored) if (a.obj.active) a.obj.setX(a.baseX + a.side * m);
    };
    place();
    this.scale.on(Phaser.Scale.Events.RESIZE, place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, place),
    );
  }

  private addHud(): void {
    // Arriba: Inicio a la izquierda, el cartel al centro, y Medallas + estrellas juntas a la derecha.
    const home = new PillButton(this, 82, 46, {
      label: 'Inicio',
      icon: 'back',
      width: 132,
      onClick: () => void goTo(this, 'Title'),
    }).setDepth(DEPTH.ui);
    const medals = new PillButton(this, 976, 46, {
      label: 'Medallas',
      icon: 'medal',
      width: 166,
      fontSize: 24,
      color: COLORS.grape,
      textColor: CSS.white,
      onClick: () => void goTo(this, 'Medals'),
    }).setDepth(DEPTH.ui);

    this.anchored.push({ obj: home, baseX: home.x, side: -1 }, { obj: medals, baseX: medals.x, side: 1 });

    this.addTitleBanner();
    this.addStarPill();
  }

  /** Cartel "☆ Isla Derechitos ☆" con cintas naranjas de punta partida. */
  private addTitleBanner(): void {
    const key = bakedTexture(this, 'map-banner-v6', 500, 100, (g) => {
      const tail = (dir: 1 | -1): Phaser.Geom.Point[] => {
        const c = 250;
        const p = (dx: number, dy: number): Phaser.Geom.Point =>
          new Phaser.Geom.Point(c + dir * dx, dy);
        return [p(170, 30), p(244, 36), p(222, 60), p(244, 86), p(170, 80)];
      };
      for (const dir of [-1, 1] as const) {
        g.fillStyle(COLORS.ink, 0.25).fillPoints(
          tail(dir).map((pt) => new Phaser.Geom.Point(pt.x, pt.y + 5)),
          true,
        );
        g.fillStyle(COLORS.orange).fillPoints(tail(dir), true);
        g.lineStyle(4, COLORS.ink).strokePoints(tail(dir), true);
      }
      g.fillStyle(COLORS.ink, 0.3).fillRoundedRect(50, 14, 400, 72, 20);
      g.fillStyle(COLORS.sun).fillRoundedRect(50, 6, 400, 72, 20);
      g.fillStyle(0xf2b52a).fillRoundedRect(54, 58, 392, 16, { tl: 0, tr: 0, bl: 16, br: 16 });
      g.lineStyle(5, COLORS.ink).strokeRoundedRect(50, 6, 400, 72, 20);
    });
    const banner = this.add.container(GAME_WIDTH / 2, 42).setDepth(DEPTH.ui).setScale(0.8);
    banner.add(this.add.image(0, 0, key));
    const title = this.text(0, -8, 'Isla Derechitos', 38, CSS.ink);
    banner.add(title);
    [-1, 1].forEach((side) => {
      const star = addStarIcon(this, side * (title.width / 2 + 28), -8, 14, false);
      banner.add(star);
      if (!prefersReducedMotion())
        this.tweens.add({ targets: star, angle: side * 360, duration: 9000, repeat: -1 });
    });
  }

  /** Estrellas ganadas en toda la isla, con barrita de progreso. */
  /** Arriba a la derecha: estrellas ganadas en toda la isla, con barrita de progreso. */
  private addStarPill(): void {
    const max = RIGHT_AREAS.reduce((s, r) => s + GameState.rightStars(r).max, 0);
    const stars = GameState.totalRightStars;
    // Tarjeta del mismo alto que el botón Medallas, justo a su lado.
    const card = this.counterCard(
      GAME_WIDTH - 94,
      168,
      String(stars),
      String(max),
      stars / Math.max(1, max),
      (c) => c.add(addStarIcon(this, 0, 0, 18, true)),
      60,
    );
    this.anchored.push({ obj: card, baseX: card.x, side: 1 });
  }

  /** Tarjeta blanca compacta: ícono, "valor / total" y barrita dorada. */
  private counterCard(
    x: number,
    w: number,
    value: string,
    total: string,
    progress: number,
    icon: (c: Phaser.GameObjects.Container) => void,
    h = 58,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, 46).setDepth(DEPTH.ui);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 18);
    bg.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(4, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    c.add(bg);
    const iconBox = this.add.container(-w / 2 + 28 + (h - 58) / 4, 0);
    icon(iconBox);
    c.add(iconBox);
    const tx = -w / 2 + 52 + (h - 58) / 2;
    const big = h > 60;
    const num = this.text(tx, -9, value, big ? 25 : 21, CSS.ink).setOrigin(0, 0.5);
    const of = this.text(tx + num.width, -9, ` / ${total}`, big ? 22 : 19, '#6E7389').setOrigin(0, 0.5);
    const barW = w / 2 - 14 - tx;
    const bar = this.add.graphics();
    const bh = big ? 12 : 10;
    bar.fillStyle(0xe4e8ef).fillRoundedRect(tx, 10, barW, bh, bh / 2);
    const p = Math.min(1, Math.max(0, progress));
    if (p > 0) bar.fillStyle(COLORS.sun).fillRoundedRect(tx, 10, Math.max(bh, barW * p), bh, bh / 2);
    bar.lineStyle(2.5, COLORS.ink).strokeRoundedRect(tx, 10, barW, bh, bh / 2);
    c.add([num, of, bar]);
    return c;
  }

  // ------------------------------------------------------------------ toques

  /** Toca: Tori dice la frase del derecho y luego se entra. Un segundo toque entra de inmediato. */
  private async select(r: RightArea, zone: Phaser.GameObjects.Container): Promise<void> {
    if (this.entering) {
      void goTo(this, 'RightHub', { rightId: r.id });
      return;
    }
    this.entering = true;
    AudioManager.sfx('pop');
    this.tori.lookAt(zone.x, zone.y);
    this.tweens.add({ targets: zone, scaleX: 1.12, scaleY: 0.9, duration: motion(90), yoyo: true });
    await this.bubble.say(r.phrase);
    if (this.sys.isActive()) await goTo(this, 'RightHub', { rightId: r.id });
  }
}
