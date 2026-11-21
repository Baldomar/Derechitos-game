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
import { RIGHT_AREAS, type RightArea, type RightAreaId } from '@/config/rights';
import type { VoiceLine } from '@/config/levels';
import { ensureArt, tex } from '@/art/Art';
import { Effects } from '@/components/Effects';
import { IdleHint } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { PillButton } from '@/components/PillButton';
import { SpeechBubble } from '@/components/SpeechBubble';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion, prefersReducedMotion, vibrate } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { setPageBackground } from '@/core/PageBackground';
import { viewportMargin } from '@/core/Viewport';
import { goTo, prefetchScene } from '@/core/SceneTransition';
import { TEX } from '@/core/Textures';
import { mapChestLine, mapHelloLine, zoneNameLine } from '@/config/voiceCatalog';

/** Mar extra a cada lado del área de diseño (pantallas panorámicas). */
const SEA_PAD = 320;
const NODE_R = 46; // 92 px de diámetro (> 44 px mínimo táctil)
const MARGIN = 24; // margen de la barra superior
const BAR_Y = MARGIN + 30; // centro de la barra superior (botones de 60 px de alto)

/** Isla: óvalo de lados rectos ("superelipse") con ondulación natural. */
const ISLE = { x: 702, y: 376, a: 560, b: 236 };
const SEA = 0x2794dc;
const SEA_LIGHT = 0x86d7f5;
const SHALLOW = 0xbaf0fb;
const SAND = 0xf5d98e;
const EARTH = 0x9b6a3c;
const GRASS = 0x5cbd38;
const GRASS_DARK = 0x2e8a2a;
const GRASS_LIGHT = 0x7ad64e;
const LEAF = 0x3fae36;
const LEAF_LIGHT = 0x6fd04a;
const LEAF_DARK = 0x2a7d28;
const DIRT = 0xc9945a;
const DIRT_DARK = 0x6b4423;
const WOOD = 0x9c6233;
const WOOD_DARK = 0x5e3517;
const GOLD = 0xf7c33c;

/**
 * Zonas en zigzag: impares abajo, pares arriba. La distancia vertical entre filas es corta
 * (140 px) para que el camino quede lejos de las estrellas que van bajo cada base.
 */
const ROW_TOP = 300;
const ROW_BOTTOM = 440;
const COL0 = 258;
const COL_STEP = 120;
const SPOTS: Record<RightAreaId, { x: number; y: number }> = Object.fromEntries(
  RIGHT_AREAS.map((r, i) => [
    r.id,
    { x: COL0 + i * COL_STEP, y: i % 2 === 0 ? ROW_BOTTOM : ROW_TOP },
  ]),
) as Record<RightAreaId, { x: number; y: number }>;
const spot = (r: RightArea): { x: number; y: number } => SPOTS[r.id];
/** Inicio del camino (banderita) y cofre del diploma al final. */
const FLAG = { x: COL0 - 112, y: ROW_BOTTOM + 40 };
const CHEST = { x: COL0 + (RIGHT_AREAS.length - 1) * COL_STEP + 98, y: ROW_TOP + 112 };

/** ¿Todas las actividades disponibles del derecho están completadas? */
const isDone = (r: RightArea): boolean => {
  const p = GameState.rightProgress(r);
  return p.total > 0 && p.done === p.total;
};

/** Estrellas (0–3) de la zona según el avance del derecho. */
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

/** Números pseudoaleatorios fijos (las texturas salen igual siempre). */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

type ZoneState = 'done' | 'current' | 'pending';

interface ZoneInfo {
  right: RightArea;
  index: number;
  state: ZoneState;
  stars: number;
}

/**
 * Mapa de la Isla Derechitos.
 * - Todo sale del progreso guardado: estado de cada zona, estrellas, zona actual (la primera
 *   sin completar), posición de Tori y contador.
 * - Tori espera parado en el camino junto a la zona actual. Al volver de completar una zona,
 *   sus estrellas vuelan al contador con confeti y Tori camina hasta la siguiente.
 * - Al tocar una zona, Tori dice su nombre y aparece una tarjetita con "▶ Jugar"
 *   (así no se entra por accidente). Al final del camino, el cofre del diploma.
 */
export default class WorldMapScene extends Phaser.Scene {
  private bubble!: SpeechBubble;
  private tori!: Tori;
  private toriShadow!: Phaser.GameObjects.Ellipse;
  private toriHop: Phaser.Tweens.Tween | null = null;
  private effects!: Effects;
  private zones: ZoneInfo[] = [];
  private current: ZoneInfo | null = null;
  private zoneObjs = new Map<RightAreaId, Phaser.GameObjects.Container>();
  private starCount!: Phaser.GameObjects.Text;
  private starOf!: Phaser.GameObjects.Text;
  private starBar!: Phaser.GameObjects.Graphics;
  private starCard!: Phaser.GameObjects.Container;
  private card: Phaser.GameObjects.Container | null = null;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private closeBtn!: Phaser.GameObjects.Container;
  private live: HTMLElement | null = null;
  /** Botones pegados a las orillas reales de la pantalla. */
  private anchored: { obj: Phaser.GameObjects.Container; baseX: number; side: -1 | 1 }[] = [];

  constructor() {
    super('WorldMap');
  }

  create(): void {
    this.card = null;
    this.anchored = [];
    this.zoneObjs = new Map();
    ensureArt(this, ['nube', 'velero', ...RIGHT_AREAS.map((r) => r.icon)]);
    setPageBackground(this, { top: SEA });

    // Estado de cada zona a partir del progreso.
    const firstPending = RIGHT_AREAS.findIndex((r) => !isDone(r));
    this.zones = RIGHT_AREAS.map((right, index) => ({
      right,
      index,
      state: isDone(right) ? 'done' : index === firstPending ? 'current' : 'pending',
      stars: progressStars(right),
    }));
    this.current = this.zones.find((z) => z.state === 'current') ?? null;

    this.drawWorld();
    this.addSeaLife();
    this.addClouds();
    this.drawRoad();
    this.addDecor();
    this.zones.forEach((z) => this.addZone(z));
    this.addChest();
    this.effects = new Effects(this);

    this.addHud();
    this.addBubble();
    this.placeTori();
    this.anchorHud();
    this.setupScreenReader();
    new IdleHint(this, () =>
      this.current && !this.card ? { kind: 'tap', ...spot(this.current.right) } : null,
    );

    this.playProgress();
    prefetchScene('RightHub');
    AudioManager.playMusic();
  }

  // ------------------------------------------------------------------ mar e isla

  /** Mar, agua clarita con espuma, borde de tierra bajo la arena, pasto con borde y matitas. */
  private drawWorld(): void {
    const W = GAME_WIDTH + SEA_PAD * 2;
    const o = SEA_PAD;
    const key = bakedTexture(this, 'map-world-v10', W, GAME_HEIGHT, (g) => {
      // Mar: azul oscuro en los bordes, turquesa junto a la isla.
      g.fillStyle(SEA).fillRect(0, 0, W, GAME_HEIGHT);
      g.fillStyle(0x3aa4e3).fillPoints(isleOutline(150, o), true);
      g.fillStyle(0x58b9ec).fillPoints(isleOutline(105, o), true);
      g.fillStyle(SEA_LIGHT).fillPoints(isleOutline(70, o), true);
      g.lineStyle(4, COLORS.white, 0.55);
      for (const [x, y] of [
        [40, 170],
        [20, 420],
        [200, 680],
        [640, 92],
        [880, 86],
        [1210, 160],
        [1250, 560],
        [-160, 300],
        [-220, 600],
        [1420, 260],
        [1500, 560],
        [1380, 90],
        [-120, 90],
      ] as const) {
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.arc(
            x + o + k * 20,
            y,
            11,
            Math.PI * (k % 2 ? 0.1 : 1.1),
            Math.PI * (k % 2 ? 0.9 : 1.9),
          );
          g.strokePath();
        }
      }
      // Agua clarita y espuma punteada
      g.fillStyle(SHALLOW).fillPoints(isleOutline(46, o), true);
      g.fillStyle(COLORS.white);
      isleOutline(30, o, 120).forEach((p, i) => {
        if (i % 2 === 0) g.fillCircle(p.x, p.y, 3.6);
      });
      isleOutline(62, o, 150).forEach((p) => g.fillCircle(p.x, p.y, 3));
      // Borde de tierra (relieve) visible bajo la arena
      const cliff = isleOutline(14, o).map((p) => new Phaser.Math.Vector2(p.x, p.y + 14));
      g.fillStyle(EARTH).fillPoints(cliff, true);
      g.lineStyle(4, COLORS.ink, 0.85).strokePoints(cliff, true);
      g.fillStyle(0x7d532c);
      isleOutline(14, o, 60).forEach((p, i) => {
        if (p.y > ISLE.y + 40) g.fillCircle(p.x + (i % 3) * 4, p.y + 9, 2.2);
      });
      // Arena con textura
      g.fillStyle(SAND).fillPoints(isleOutline(14, o), true);
      g.lineStyle(4, COLORS.ink, 0.85).strokePoints(isleOutline(14, o), true);
      const rnd = seeded(3);
      g.fillStyle(0xd9b96a, 0.85);
      isleOutline(2, o, 140).forEach((p) =>
        g.fillCircle(p.x + (rnd() - 0.5) * 12, p.y + (rnd() - 0.5) * 10, 1.4 + rnd() * 1.2),
      );
      // Pasto con borde ondulado
      g.fillStyle(GRASS_DARK);
      isleOutline(-12, o, 150).forEach((p) => g.fillCircle(p.x, p.y, 11));
      g.fillStyle(GRASS).fillPoints(isleOutline(-17, o), true);
      g.fillStyle(GRASS_LIGHT);
      isleOutline(-22, o, 150).forEach((p) => g.fillCircle(p.x, p.y, 6));
      g.fillStyle(GRASS).fillPoints(isleOutline(-26, o), true);
      // Luces en el centro
      g.fillStyle(0x6bc843, 0.8).fillEllipse(ISLE.x + o, ISLE.y + 4, 760, 230);
      g.fillStyle(GRASS_LIGHT, 0.5).fillEllipse(ISLE.x + o, ISLE.y - 10, 520, 130);
      // Matitas
      const r2 = seeded(7);
      g.lineStyle(2.5, 0x3f9a2e, 0.9);
      for (let i = 0; i < 230; i++) {
        const t = r2() * Math.PI * 2;
        const k = Math.sqrt(r2()) * 0.86;
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

  /** Muelle con barquito, gaviotas, pez que salta, estrella de mar, concha y destellos. */
  private addSeaLife(): void {
    const pier = this.add.graphics();
    pier.fillStyle(WOOD_DARK);
    [96, 126, 156].forEach((px) => pier.fillRect(px - 4, 330, 8, 26));
    pier.fillStyle(WOOD).fillRect(80, 314, 108, 20);
    pier.lineStyle(3.5, COLORS.ink).strokeRect(80, 314, 108, 20);
    pier.lineStyle(2, WOOD_DARK);
    [102, 124, 146, 168].forEach((px) => pier.lineBetween(px, 316, px, 332));
    const boat = this.add.image(58, 282, tex('velero')).setScale(0.62);

    const birds = this.add.graphics();
    birds.lineStyle(3, COLORS.ink);
    for (const [bx, by, s] of [
      [185, 130, 1],
      [216, 112, 0.8],
    ] as const) {
      birds.beginPath();
      birds.arc(bx - 8 * s, by, 8 * s, Math.PI * 1.15, Math.PI * 1.95);
      birds.strokePath();
      birds.beginPath();
      birds.arc(bx + 8 * s, by, 8 * s, Math.PI * 1.05, Math.PI * 1.85);
      birds.strokePath();
    }

    const fishKey = bakedTexture(this, 'map-fish', 70, 44, (g) => {
      g.fillStyle(COLORS.orange).fillEllipse(30, 22, 44, 28);
      g.fillTriangle(48, 22, 66, 8, 66, 36);
      g.lineStyle(4, COLORS.ink).strokeEllipse(30, 22, 44, 28);
      g.strokeTriangle(48, 22, 66, 8, 66, 36);
      g.fillStyle(COLORS.ink).fillCircle(18, 18, 3.5);
    });
    // Pez lejos de los botones de abajo: en el mar de la izquierda.
    const fish = this.add.image(60, 470, fishKey).setScale(0.7).setAlpha(0);

    const starfish = bakedTexture(this, 'map-starfish', 30, 30, (g) => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 6 : 13;
        pts.push({ x: 15 + Math.cos(a) * r, y: 15 + Math.sin(a) * r });
      }
      g.fillStyle(COLORS.coral).fillPoints(pts, true);
      g.lineStyle(2.5, COLORS.ink).strokePoints(pts, true);
    });
    this.add.image(640, 598, starfish).setAngle(12);
    const shell = this.add.graphics();
    shell.fillStyle(0xffe2cf).fillCircle(1250, 300, 9);
    shell.lineStyle(2.5, COLORS.ink).strokeCircle(1250, 300, 9);
    shell.lineBetween(1250, 292, 1250, 308).lineBetween(1244, 294, 1247, 307);

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
        ].map(([sx, sy]) => ({ x: sx ?? 0, y: sy ?? 0 })),
        true,
      );
    });
    const sparkles = (
      [
        [140, 230],
        [40, 600],
        [1250, 250],
        [1240, 600],
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
    // El pez salta de vez en cuando (aparece, hace un arco y se vuelve a meter).
    this.tweens.chain({
      targets: fish,
      loop: -1,
      loopDelay: 3200,
      tweens: [
        { alpha: 1, y: 430, x: 80, angle: -30, duration: 420, ease: 'Quad.easeOut' },
        { y: 470, x: 104, angle: 30, duration: 420, ease: 'Quad.easeIn' },
        { alpha: 0, duration: 120 },
        { x: 60, angle: 0, duration: 10 },
      ],
    });
  }

  /** Nubes que pasan despacio. */
  private addClouds(): void {
    const clouds: [number, number, number][] = [
      [315, 104, 0.55],
      [1030, 108, 0.5],
    ];
    clouds.forEach(([cx, cy, s], i) => {
      const c = this.add.image(cx, cy, tex('nube')).setScale(s).setAlpha(0.95);
      if (prefersReducedMotion()) return;
      const speed = 80 + i * 25;
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

  /** Puntos del camino: banderita, las 8 zonas y el cofre. */
  private roadPoints(): { x: number; y: number }[] {
    return [FLAG, ...RIGHT_AREAS.map((r) => spot(r)), CHEST];
  }

  /** Camino de tierra con piedritas en zigzag, banderita roja al inicio. */
  private drawRoad(): void {
    const all = this.roadPoints();
    const g = this.add.graphics();
    const stroke = (width: number, color: number): void => {
      g.lineStyle(width, color);
      g.beginPath();
      g.moveTo(all[0]?.x ?? 0, all[0]?.y ?? 0);
      all.slice(1).forEach((p) => g.lineTo(p.x, p.y));
      g.strokePath();
      all.forEach((p) => g.fillStyle(color).fillCircle(p.x, p.y, width / 2));
    };
    stroke(32, DIRT_DARK);
    stroke(25, DIRT);
    // Piedritas
    const rnd = seeded(21);
    for (let i = 0; i < all.length - 1; i++) {
      const a = all[i];
      const b = all[i + 1];
      if (!a || !b) continue;
      const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      for (let d = 10; d < len; d += 12) {
        const t = d / len;
        const side = (rnd() - 0.5) * 15;
        const px = a.x + (b.x - a.x) * t + nx * side;
        const py = a.y + (b.y - a.y) * t + ny * side;
        g.fillStyle(rnd() > 0.5 ? 0xa97a48 : 0xe0b77f).fillCircle(px, py, 1.6 + rnd() * 1.8);
      }
    }

    // Banderita de salida (a la izquierda de la zona 1, sin taparla).
    const flagKey = bakedTexture(this, 'map-flag', 60, 50, (g2) => {
      g2.fillStyle(COLORS.coral).fillTriangle(4, 4, 56, 16, 4, 30);
      g2.lineStyle(4, COLORS.ink).strokeTriangle(4, 4, 56, 16, 4, 30);
    });
    const pole = this.add.graphics();
    pole.lineStyle(6, COLORS.ink).lineBetween(FLAG.x - 10, FLAG.y + 6, FLAG.x - 10, FLAG.y - 54);
    pole.lineStyle(3, COLORS.white).lineBetween(FLAG.x - 10, FLAG.y + 4, FLAG.x - 10, FLAG.y - 52);
    const flag = this.add
      .image(FLAG.x - 10, FLAG.y - 54, flagKey)
      .setOrigin(0.02, 0.06)
      .setFlipX(true);
    flag.setOrigin(0.98, 0.06);
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

  /** Palmera, árboles con fruta, estanque, arbustos, piedras y flores (sin tapar zonas). */
  private addDecor(): void {
    const palm = this.add.image(170, 340, this.palmTexture()).setOrigin(0.5, 0.96).setScale(0.88);

    const top = (i: number): number => COL0 + i * COL_STEP; // x de la columna i
    const shadow = this.add.graphics();
    shadow.fillStyle(COLORS.ink, 0.18);
    shadow.fillEllipse(top(2), 266, 76, 16).fillEllipse(top(6), 266, 76, 16);
    this.add.image(top(2), 208, this.treeTexture(COLORS.orange)).setScale(0.92);
    this.add.image(top(6), 208, this.treeTexture(COLORS.pink)).setScale(0.92);

    // Estanque con nenúfar entre las zonas 4 y 6
    const px = top(4);
    const py = 214;
    const pond = this.add.graphics();
    pond.fillStyle(0xe8cf98).fillEllipse(px, py, 136, 58);
    pond.lineStyle(3, COLORS.ink, 0.6).strokeEllipse(px, py, 136, 58);
    pond.fillStyle(0x5cc3f0).fillEllipse(px, py, 118, 44);
    pond.lineStyle(3, 0x2f86c4).strokeEllipse(px, py, 118, 44);
    pond.lineStyle(3, COLORS.white, 0.8);
    pond.beginPath();
    pond.arc(px - 20, py, 11, Math.PI * 1.15, Math.PI * 1.85);
    pond.strokePath();
    pond.fillStyle(0x4fae45).fillEllipse(px + 24, py + 4, 24, 11);
    pond.fillStyle(COLORS.pink).fillCircle(px + 30, py + 1, 4);

    // Arbustos con flores y piedras (debajo de las zonas de arriba, lejos de estrellas y camino)
    this.add.image(top(1), 528, this.bushTexture()).setScale(0.9);
    this.add.image(top(7) + 2, 536, this.bushTexture()).setScale(0.75);
    const rocks = this.add.graphics();
    const rx = top(3);
    const ry = 520;
    rocks.fillStyle(0x9aa5b5).fillEllipse(rx, ry + 4, 52, 26);
    rocks.fillStyle(0xbcc5d2).fillEllipse(rx, ry, 52, 30);
    rocks.fillStyle(0xe1e6ee).fillEllipse(rx - 8, ry - 8, 22, 9);
    rocks.lineStyle(4, COLORS.ink).strokeEllipse(rx, ry, 52, 30);
    rocks.fillStyle(0xd0d7e1).fillEllipse(rx + 32, ry + 10, 28, 18);
    rocks.lineStyle(4, COLORS.ink).strokeEllipse(rx + 32, ry + 10, 28, 18);

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
        [top(5) - 14, 540, COLORS.white],
        [top(5) + 14, 552, COLORS.pink],
        [top(5) + 40, 536, 0xb9a4ff],
        [230, 216, COLORS.pink],
        [256, 228, COLORS.white],
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
        [62, 30, 24],
        [40, 38, 22],
        [84, 38, 22],
        [28, 60, 20],
        [96, 60, 20],
        [42, 78, 20],
        [82, 78, 20],
        [62, 82, 20],
        [62, 54, 32],
      ];
      g.lineStyle(9, COLORS.ink);
      lobes.forEach(([x, y, r]) => g.strokeCircle(x, y, r));
      g.fillStyle(LEAF);
      lobes.forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(LEAF_LIGHT);
      g.fillCircle(52, 36, 18).fillCircle(70, 28, 13).fillCircle(36, 52, 11);
      g.lineStyle(3, LEAF_DARK);
      for (const [x, y] of [
        [86, 62],
        [44, 76],
        [70, 74],
        [92, 44],
      ] as const) {
        g.beginPath();
        g.arc(x, y, 9, Math.PI * 0.15, Math.PI * 0.85);
        g.strokePath();
      }
      for (const [x, y] of [
        [46, 42],
        [78, 46],
        [62, 66],
        [34, 66],
        [90, 66],
        [60, 24],
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
        [26, 44, 20],
        [48, 30, 22],
        [72, 32, 20],
        [84, 48, 16],
        [52, 50, 22],
      ];
      g.lineStyle(8, COLORS.ink);
      lobes.forEach(([x, y, r]) => g.strokeCircle(x, y, r));
      g.fillStyle(LEAF);
      lobes.forEach(([x, y, r]) => g.fillCircle(x, y, r));
      g.fillStyle(LEAF_LIGHT).fillCircle(42, 28, 12).fillCircle(66, 26, 9);
      for (const [x, y] of [
        [30, 40],
        [52, 24],
        [70, 40],
        [46, 52],
        [82, 50],
        [60, 56],
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
        [110, 90],
        [126, 92],
        [118, 100],
      ] as const) {
        g.fillStyle(0x7a4a26).fillCircle(x, y, 8);
        g.lineStyle(2.5, COLORS.ink).strokeCircle(x, y, 8);
      }
    });
  }

  // ------------------------------------------------------------------ zonas

  /** Una zona: base de tierra, botón 3D con ícono blanco, número, letrero y 3 estrellas en arco. */
  private addZone(z: ZoneInfo): void {
    const { x, y } = spot(z.right);
    const r = z.right;

    // Base de tierra (no se mueve con la animación)
    const base = this.add.graphics();
    base.fillStyle(0x5a3a1e).fillEllipse(x, y + 44, 124, 36);
    base.fillStyle(0x8a5a32).fillEllipse(x, y + 40, 120, 32);
    base.fillStyle(0xa8743f, 0.8).fillEllipse(x - 10, y + 36, 70, 12);
    base.lineStyle(3, COLORS.ink, 0.8).strokeEllipse(x, y + 40, 120, 32);

    // Estrellas en arco ("sonrisa") pegadas a la base, a la misma distancia en todas las zonas
    [-1, 0, 1].forEach((k, si) => {
      const star = addStarIcon(this, x + k * 24, y + 64 + Math.abs(k) * -7, 11, si < z.stars);
      star.setAngle(k * 12);
    });

    const zone = this.add.container(x, y);
    if (z.state === 'current') {
      const halo = this.add
        .circle(0, 2, NODE_R + 14, COLORS.white, 0.3)
        .setStrokeStyle(6, COLORS.white, 0.9);
      zone.add(halo);
      if (!prefersReducedMotion())
        this.tweens.add({
          targets: halo,
          scale: 1.14,
          alpha: 0.55,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
    }
    const under = this.add.circle(0, 7, NODE_R, tint(r.color, -0.32)).setStrokeStyle(4, COLORS.ink);
    const disc = this.add.circle(0, 0, NODE_R, r.color).setStrokeStyle(4, COLORS.ink);
    const ring = this.add.circle(0, 0, NODE_R - 9, tint(r.color, 0.12));
    const shine = this.add.ellipse(-14, -24, 32, 12, COLORS.white, 0.55).setAngle(-20);
    zone.add([under, disc, ring, shine, this.glyph(r, 1)]);

    // Número en circulito blanco y check verde si está completa
    zone.add(
      this.add.circle(NODE_R - 10, -NODE_R + 10, 16, COLORS.white).setStrokeStyle(4, COLORS.ink),
    );
    zone.add(this.text(NODE_R - 10, -NODE_R + 11, String(z.index + 1), 20, CSS.ink));
    if (z.state === 'done')
      zone.add(this.add.image(-NODE_R + 8, -NODE_R + 10, TEX.check).setScale(0.38));

    // Letrero (dorado en la zona actual)
    zone.add(this.sign(0, -NODE_R - 34, r.short, z.state === 'current'));

    disc.setInteractive({ useHandCursor: true });
    disc.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.tapZone(z));
    this.zoneObjs.set(r.id, zone);

    zone.setScale(0);
    this.tweens.add({
      targets: zone,
      scale: 1,
      duration: motion(400),
      delay: z.index * 60,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Ícono blanco de cada derecho (cruz, libro, corazón, naranja, casa, dos personitas, pelota
   * y globo de diálogo), con una sombrita para que resalte sobre el botón de color.
   */
  private glyph(r: RightArea, k: number): Phaser.GameObjects.Container {
    const draw = (
      g: Phaser.GameObjects.Graphics,
      fill: number,
      alpha: number,
      hole: number,
    ): void => {
      g.fillStyle(fill, alpha);
      const cut = (): void => {
        g.fillStyle(hole, alpha === 1 ? 1 : 0);
      };
      switch (r.id) {
        case 'salud':
          g.fillRoundedRect(-7, -21, 14, 42, 4).fillRoundedRect(-21, -7, 42, 14, 4);
          break;
        case 'educacion':
          g.fillPoints(
            [
              { x: -22, y: -14 },
              { x: -2, y: -10 },
              { x: -2, y: 18 },
              { x: -22, y: 14 },
            ],
            true,
          );
          g.fillPoints(
            [
              { x: 22, y: -14 },
              { x: 2, y: -10 },
              { x: 2, y: 18 },
              { x: 22, y: 14 },
            ],
            true,
          );
          cut();
          g.fillRect(-18, -4, 12, 2.5)
            .fillRect(-18, 3, 12, 2.5)
            .fillRect(6, -4, 12, 2.5)
            .fillRect(6, 3, 12, 2.5);
          break;
        case 'vida':
          g.fillCircle(-10, -6, 12).fillCircle(10, -6, 12);
          g.fillTriangle(-21, -1, 21, -1, 0, 21);
          break;
        case 'alimentacion':
          g.fillCircle(0, 4, 17);
          g.fillRect(-2, -18, 4, 8);
          g.fillEllipse(9, -15, 16, 8);
          cut();
          g.fillCircle(-6, -1, 3);
          break;
        case 'vivienda':
          g.fillTriangle(-24, -2, 0, -22, 24, -2);
          g.fillRect(-16, -4, 32, 24);
          cut();
          g.fillRoundedRect(-5, 6, 10, 14, 2);
          break;
        case 'igualdad':
          g.fillCircle(-10, -11, 7).fillCircle(10, -11, 7);
          g.fillRoundedRect(-19, -2, 18, 22, 7).fillRoundedRect(1, -2, 18, 22, 7);
          break;
        case 'jugar':
          g.fillCircle(0, 0, 19);
          cut();
          g.fillRect(-19, -3, 38, 6);
          g.fillCircle(0, 0, 6);
          g.fillStyle(fill, alpha).fillCircle(0, 0, 3.2);
          break;
        default:
          g.fillRoundedRect(-22, -18, 44, 30, 10);
          g.fillTriangle(-12, 10, -2, 10, -14, 22);
          cut();
          g.fillCircle(-10, -3, 3.4).fillCircle(0, -3, 3.4).fillCircle(10, -3, 3.4);
      }
    };
    const shadow = this.add.graphics().setPosition(2, 3);
    draw(shadow, COLORS.ink, 0.25, COLORS.ink);
    const g = this.add.graphics();
    draw(g, COLORS.white, 1, tint(r.color, 0.12));
    return this.add.container(0, 0, [shadow, g]).setScale(k);
  }

  /** Letrero de madera (o dorado) con clavitos. */
  private sign(x: number, y: number, s: string, gold: boolean): Phaser.GameObjects.Container {
    const label = this.text(0, 0, s, 19, gold ? CSS.ink : CSS.white);
    if (!gold) label.setShadow(0, 2, '#4a2a12', 0, false, true);
    const w = label.width + 30;
    const h = 34;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 9);
    g.fillStyle(gold ? 0xd99a1a : WOOD_DARK).fillRoundedRect(-w / 2, -h / 2, w, h, 9);
    g.fillStyle(gold ? GOLD : WOOD).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 8, 7);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
    g.fillStyle(gold ? 0xb7790f : WOOD_DARK)
      .fillCircle(-w / 2 + 8, 0, 2.5)
      .fillCircle(w / 2 - 8, 0, 2.5);
    return this.add.container(x, y, [g, label]);
  }

  /** Cofre del diploma al final del camino: cerrado con candado "n/8", o abierto con brillo. */
  private addChest(): void {
    const total = RIGHT_AREAS.length;
    const doneCount = this.zones.filter((z) => z.state === 'done').length;
    const open = doneCount === total;
    const { x, y } = CHEST;

    if (open) {
      const raysKey = bakedTexture(this, 'map-chest-rays', 200, 200, (g) => {
        g.fillStyle(0xfff3a6, 0.6);
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6;
          g.fillTriangle(
            100,
            100,
            100 + Math.cos(a - 0.14) * 100,
            100 + Math.sin(a - 0.14) * 100,
            100 + Math.cos(a + 0.14) * 100,
            100 + Math.sin(a + 0.14) * 100,
          );
        }
      });
      const rays = this.add.image(x, y - 8, raysKey);
      if (!prefersReducedMotion())
        this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    }

    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.2).fillEllipse(x, y + 26, 84, 18);
    // Caja
    g.fillStyle(0x9c5a2a).fillRoundedRect(x - 36, y - 6, 72, 34, 6);
    g.fillStyle(GOLD).fillRect(x - 36, y + 4, 72, 7);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(x - 36, y - 6, 72, 34, 6);
    if (open) {
      // Tapa abierta hacia atrás y monedas brillando
      g.fillStyle(0xb36a32).fillRoundedRect(x - 36, y - 40, 72, 26, {
        tl: 18,
        tr: 18,
        bl: 4,
        br: 4,
      });
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(x - 36, y - 40, 72, 26, {
        tl: 18,
        tr: 18,
        bl: 4,
        br: 4,
      });
      g.fillStyle(GOLD)
        .fillCircle(x - 14, y - 8, 7)
        .fillCircle(x + 2, y - 11, 7)
        .fillCircle(x + 16, y - 7, 7);
      g.lineStyle(2.5, COLORS.ink)
        .strokeCircle(x - 14, y - 8, 7)
        .strokeCircle(x + 2, y - 11, 7)
        .strokeCircle(x + 16, y - 7, 7);
    } else {
      g.fillStyle(0xb36a32).fillRoundedRect(x - 38, y - 28, 76, 26, {
        tl: 18,
        tr: 18,
        bl: 4,
        br: 4,
      });
      g.fillStyle(GOLD).fillRect(x - 38, y - 12, 76, 6);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(x - 38, y - 28, 76, 26, {
        tl: 18,
        tr: 18,
        bl: 4,
        br: 4,
      });
      g.fillStyle(GOLD).fillRoundedRect(x - 8, y - 10, 16, 18, 4);
      g.lineStyle(3, COLORS.ink).strokeRoundedRect(x - 8, y - 10, 16, 18, 4);
      g.fillStyle(COLORS.ink).fillCircle(x, y - 2, 2.5);
    }
    const chest = this.add.container(0, 0, [g]);

    // Letrero "¡Diploma!" debajo y etiqueta con candado "n/8"
    this.sign(x, y + 58, '¡Diploma!', open);
    const tag = this.add.container(x + 36, y - 30);
    const tt = this.text(open ? 0 : 7, 0, `${doneCount}/${total}`, 14, CSS.white);
    const tw = tt.width + (open ? 18 : 30);
    const tg = this.add.graphics();
    tg.fillStyle(open ? 0x2e9e5b : COLORS.ink).fillRoundedRect(-tw / 2, -12, tw, 24, 12);
    tg.lineStyle(2.5, COLORS.white).strokeRoundedRect(-tw / 2 + 1, -11, tw - 2, 22, 11);
    tag.add([tg, tt]);
    if (!open) {
      const lk = this.add.graphics();
      const lx = -tw / 2 + 12;
      lk.lineStyle(2.2, COLORS.white);
      lk.beginPath();
      lk.arc(lx, -2, 3.5, Math.PI, 0);
      lk.strokePath();
      lk.fillStyle(COLORS.white).fillRoundedRect(lx - 5, -2, 10, 8, 2);
      tag.add(lk);
    }

    const zone = this.add.zone(x, y, 100, 100).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (open) {
        AudioManager.sfx('fanfare');
        // Desde el cofre abierto, el diploma trae la opción de imprimir.
        void goTo(this, 'Final', { fromChest: true });
        return;
      }
      AudioManager.sfx('hint');
      vibrate(25);
      this.tweens.add({
        targets: chest,
        x: 6,
        duration: 60,
        yoyo: true,
        repeat: 3,
        onComplete: () => chest.setX(0),
      });
      this.showBubble(mapChestLine());
    });
    if (open && !prefersReducedMotion())
      this.tweens.add({
        targets: chest,
        y: -4,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
  }

  // ------------------------------------------------------------------ Tori en el camino

  /** Punto del camino justo antes de la zona i (donde Tori espera). */
  private waitPoint(i: number): { x: number; y: number } {
    const pts = this.roadPoints();
    const zone = pts[i + 1] ?? CHEST;
    const prev = pts[i] ?? FLAG;
    const len = Phaser.Math.Distance.Between(prev.x, prev.y, zone.x, zone.y);
    // A la mitad del tramo (sin tapar ninguna zona); en el primero, cerca de la banderita.
    const back = i === 0 ? len * 0.72 : len * 0.5;
    return {
      x: zone.x + ((prev.x - zone.x) / len) * back,
      y: zone.y + ((prev.y - zone.y) / len) * back,
    };
  }

  /** Coloca a Tori parado en el camino junto a la zona actual (o junto al cofre si ya terminó). */
  private placeTori(atIndex?: number): void {
    const idx = atIndex ?? (this.current ? this.current.index : RIGHT_AREAS.length);
    const p = this.waitPoint(idx);
    this.toriShadow = this.add
      .ellipse(p.x, p.y + 30, 54, 14, COLORS.ink, 0.25)
      .setDepth(DEPTH.ui - 6);
    this.tori = new Tori(this, p.x, p.y - 10, 0.28).setDepth(DEPTH.ui - 5);
    this.startHop();
  }

  private startHop(): void {
    this.toriHop?.stop();
    if (prefersReducedMotion()) return;
    const baseY = this.tori.y;
    this.toriHop = this.tweens.add({
      targets: this.tori,
      y: baseY - 10,
      duration: 420,
      yoyo: true,
      repeat: -1,
      repeatDelay: 900,
      ease: 'Quad.easeOut',
    });
  }

  /** Tori camina por el camino de un punto a otro (pasando por las zonas intermedias). */
  private walkTori(fromIndex: number, toIndex: number): Promise<void> {
    return new Promise((resolve) => {
      this.toriHop?.stop();
      const pts = this.roadPoints();
      const path: { x: number; y: number }[] = [];
      for (let i = fromIndex; i < toIndex; i++) {
        const zp = pts[i + 1];
        if (zp) path.push({ x: zp.x, y: zp.y + 40 }); // pasa por delante de la base
      }
      path.push(this.waitPoint(toIndex));
      const steps = path.map((p) => ({
        x: p.x,
        y: p.y - 10,
        duration: motion(650),
        ease: 'Sine.easeInOut',
        onUpdate: () => this.toriShadow.setPosition(this.tori.x, this.tori.y + 40),
      }));
      if (prefersReducedMotion()) {
        const last = path[path.length - 1];
        if (last) this.tori.setPosition(last.x, last.y - 10);
        this.toriShadow.setPosition(this.tori.x, this.tori.y + 40);
        resolve();
        return;
      }
      this.tweens.chain({
        targets: this.tori,
        tweens: steps,
        onComplete: () => {
          this.startHop();
          resolve();
        },
      });
    });
  }

  /** Al volver de completar zonas: estrellas al contador, confeti y Tori camina a la siguiente. */
  private playProgress(): void {
    const seen = GameState.mapSeen;
    const doneIds = this.zones.filter((z) => z.state === 'done').map((z) => z.right.id);
    const fresh = this.zones.filter((z) => z.state === 'done' && !seen.done.includes(z.right.id));
    const total = GameState.totalRightStars;
    const fromStars = Math.min(seen.stars, total);
    GameState.setMapSeen(doneIds, total);

    if (fresh.length === 0) {
      this.setStarCount(total);
      this.time.delayedCall(500, () => this.showBubble(this.helloLine()));
      return;
    }
    this.setStarCount(fromStars);
    const first = fresh[0];
    // Tori empieza junto a la zona recién completada.
    if (first) {
      const p = this.waitPoint(first.index);
      this.tori.setPosition(p.x, p.y - 10);
      this.toriShadow.setPosition(p.x, p.y + 30);
      this.startHop();
    }
    this.time.delayedCall(700, () => {
      let delay = 0;
      fresh.forEach((z) => {
        this.time.delayedCall(delay, () => this.flyStars(z, fromStars, total));
        delay += 900;
      });
      this.time.delayedCall(delay + 300, () => {
        const target = this.current ? this.current.index : RIGHT_AREAS.length;
        void this.walkTori(first?.index ?? target, target).then(() =>
          this.showBubble(this.helloLine()),
        );
      });
    });
  }

  /** Las estrellas de una zona vuelan al contador, con confeti. */
  private flyStars(z: ZoneInfo, from: number, to: number): void {
    const { x, y } = spot(z.right);
    AudioManager.sfx('success');
    this.effects.celebrate();
    const target = { x: this.starCard.x - 60, y: this.starCard.y };
    const n = Math.max(1, z.stars);
    for (let k = 0; k < n; k++) {
      const s = addStarIcon(this, x + (k - 1) * 30, y + 60, 16, true).setDepth(DEPTH.overlay);
      this.tweens.add({
        targets: s,
        x: target.x,
        y: target.y,
        scale: { from: 1.4, to: 0.8 },
        delay: k * 140,
        duration: motion(800),
        ease: 'Cubic.easeIn',
        onStart: () => AudioManager.sfx('star', { index: k }),
        onComplete: () => {
          s.destroy();
          this.tweens.add({
            targets: this.starCard,
            scale: { from: 1.12, to: 1 },
            duration: motion(260),
          });
        },
      });
    }
    this.tweens.addCounter({
      from,
      to,
      duration: motion(900) + 400,
      delay: 600,
      onUpdate: (tw) => this.setStarCount(Math.round(tw.getValue() ?? to)),
    });
  }

  // ------------------------------------------------------------------ globo de Tori

  /** Botón redondo turquesa (abajo a la izquierda) + globo compacto con bocina y X. */
  private addBubble(): void {
    const bx = MARGIN + 34;
    const by = GAME_HEIGHT - MARGIN - 34;
    const btn = this.add.container(bx, by).setDepth(DEPTH.ui);
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.3).fillCircle(0, 5, 32);
    g.fillStyle(COLORS.turquoise).fillCircle(0, 0, 32);
    g.lineStyle(4, COLORS.ink).strokeCircle(0, 0, 32);
    g.fillStyle(COLORS.white).fillRoundedRect(-16, -12, 32, 20, 8);
    g.fillTriangle(-8, 6, 0, 6, -10, 16);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(-16, -12, 32, 20, 8);
    g.fillStyle(COLORS.ink).fillCircle(-7, -2, 2.4).fillCircle(0, -2, 2.4).fillCircle(7, -2, 2.4);
    btn.add(g);
    btn.setSize(88, 88).setInteractive({ useHandCursor: true });
    btn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      AudioManager.sfx('pop');
      this.tweens.add({
        targets: btn,
        scale: { from: 0.85, to: 1 },
        duration: motion(300),
        ease: 'Back.easeOut',
      });
      this.showBubble(this.helloLine());
    });
    this.anchored.push({ obj: btn, baseX: btn.x, side: -1 });

    this.bubble = new SpeechBubble(this, bx + 48 + 290, by - 4, {
      width: 580,
      tail: 'left',
      fontSize: 18,
      compact: true,
    });

    // X para cerrar el globo (área táctil de 44 px).
    this.closeBtn = this.add.container(bx + 48 + 580 - 6, by - 40).setDepth(DEPTH.ui + 12);
    const xg = this.add.graphics();
    xg.fillStyle(COLORS.white).fillCircle(0, 0, 14);
    xg.lineStyle(3, COLORS.ink).strokeCircle(0, 0, 14);
    xg.lineStyle(3.5, COLORS.ink).lineBetween(-5, -5, 5, 5).lineBetween(5, -5, -5, 5);
    this.closeBtn.add(xg).setSize(44, 44).setInteractive({ useHandCursor: true }).setVisible(false);
    this.closeBtn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.hideBubble());
  }

  /** Muestra el globo, lo lee en voz alta y lo esconde solo a los 8 segundos. */
  private showBubble(line: VoiceLine | VoiceLine[]): void {
    this.hideTimer?.remove();
    this.closeBtn.setVisible(true);
    if (this.tori) this.bubble.setTori(this.tori);
    const lines = Array.isArray(line) ? line : [line];
    if (this.live) this.live.textContent = lines.map((l) => l.text).join(' ');
    void this.bubble.say(lines);
    this.hideTimer = this.time.delayedCall(8000, () => this.hideBubble());
  }

  private hideBubble(): void {
    this.hideTimer?.remove();
    this.hideTimer = null;
    this.bubble.hide();
    this.closeBtn.setVisible(false);
  }

  private helloLine(): VoiceLine {
    const cur = this.current;
    if (!cur)
      return {
        id: 'map_all_done',
        text: '¡Completaste toda la isla! Toca el cofre para ver tu diploma.',
      };
    const fresh = this.zones.every((z) => z.state !== 'done');
    return mapHelloLine(cur.right, fresh);
  }

  // ------------------------------------------------------------------ tocar una zona

  /** Tori dice el nombre del derecho y aparece la tarjetita con "▶ Jugar". */
  private tapZone(z: ZoneInfo): void {
    if (this.card) return;
    AudioManager.sfx('pop');
    const zone = this.zoneObjs.get(z.right.id);
    if (zone)
      this.tweens.add({
        targets: zone,
        scaleX: 1.1,
        scaleY: 0.9,
        duration: motion(90),
        yoyo: true,
      });
    this.tori.lookAt(spot(z.right).x, spot(z.right).y);
    this.showBubble(zoneNameLine(z.right));
    this.openCard(z);
  }

  private openCard(z: ZoneInfo): void {
    const r = z.right;
    const m = viewportMargin(this.game);
    const layer = this.add.container(0, 0).setDepth(DEPTH.overlay);
    const shade = this.add
      .rectangle(-m.x, -m.y, GAME_WIDTH + m.x * 2, GAME_HEIGHT + m.y * 2, COLORS.ink, 0.45)
      .setOrigin(0)
      .setInteractive();
    shade.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => close());
    layer.add(shade);

    const cx = 640;
    const cy = 340;
    const w = 400;
    const h = 330;
    const card = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 0.3).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 28);
    bg.fillStyle(0xfff8e7).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
    bg.lineStyle(5, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
    bg.fillStyle(r.color).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, 60, {
      tl: 25,
      tr: 25,
      bl: 0,
      br: 0,
    });
    card.add(bg);
    card.add(this.text(0, -h / 2 + 34, `${z.index + 1}. ${r.short}`, 28, CSS.ink));
    // Ícono grande
    card.add(this.add.circle(0, -34, 56, r.color).setStrokeStyle(5, COLORS.ink));
    card.add(this.add.ellipse(-16, -60, 36, 13, COLORS.white, 0.5).setAngle(-20));
    card.add(this.glyph(r, 1.3).setPosition(0, -34));
    // Estrellas
    [-1, 0, 1].forEach((k, si) =>
      card.add(addStarIcon(this, k * 36, 46 + Math.abs(k) * -6, 16, si < z.stars).setAngle(k * 12)),
    );
    // Botón "Jugar" compacto (se ve de 60 px; su área táctil sigue siendo de 88 px).
    const play = new PillButton(this, 0, 112, {
      label: 'Jugar',
      icon: 'play',
      width: 168,
      fontSize: 28,
      color: COLORS.sun,
      onClick: () => {
        this.card = null;
        void goTo(this, 'RightHub', { rightId: r.id });
      },
    });
    card.add(play);
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: play,
        scale: 1.06,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    // X para cerrar
    const x = this.add.container(w / 2 - 22, -h / 2 + 22);
    const xg = this.add.graphics();
    xg.fillStyle(COLORS.white).fillCircle(0, 0, 16);
    xg.lineStyle(3, COLORS.ink).strokeCircle(0, 0, 16);
    xg.lineStyle(3.5, COLORS.ink).lineBetween(-6, -6, 6, 6).lineBetween(6, -6, -6, 6);
    x.add(xg).setSize(48, 48).setInteractive({ useHandCursor: true });
    x.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => close());
    card.add(x);
    layer.add(card);
    this.card = layer;

    card.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: card,
      scale: 1,
      alpha: 1,
      duration: motion(320),
      ease: 'Back.easeOut',
    });

    const close = (): void => {
      if (this.card !== layer) return;
      this.card = null;
      AudioManager.sfx('pop');
      layer.destroy(true);
    };
  }

  // ------------------------------------------------------------------ barra superior

  private addHud(): void {
    const home = new PillButton(this, MARGIN + 72, BAR_Y, {
      label: 'Inicio',
      icon: 'back',
      width: 144,
      onClick: () => void goTo(this, 'Title'),
    }).setDepth(DEPTH.ui);
    this.anchored.push({ obj: home, baseX: home.x, side: -1 });

    this.addTitleBanner();

    const cardW = 190;
    const cardX = GAME_WIDTH - MARGIN - cardW / 2;
    this.starCard = this.counterCard(cardX, cardW, 60);
    this.anchored.push({ obj: this.starCard, baseX: this.starCard.x, side: 1 });

    const medW = 180;
    const medals = new PillButton(this, cardX - cardW / 2 - 12 - medW / 2, BAR_Y, {
      label: 'Medallas',
      icon: 'medal',
      width: medW,
      fontSize: 25,
      color: COLORS.grape,
      textColor: CSS.white,
      onClick: () => void goTo(this, 'Medals'),
    }).setDepth(DEPTH.ui);
    this.anchored.push({ obj: medals, baseX: medals.x, side: 1 });
  }

  /** Placa dorada "☆ Isla Derechitos ☆" con cintas naranjas. */
  private addTitleBanner(): void {
    const key = bakedTexture(this, 'map-banner-v6', 500, 100, (g) => {
      const tail = (dir: 1 | -1): { x: number; y: number }[] => {
        const c = 250;
        const p = (dx: number, dy: number): { x: number; y: number } => ({
          x: c + dir * dx,
          y: dy,
        });
        return [p(170, 30), p(244, 36), p(222, 60), p(244, 86), p(170, 80)];
      };
      for (const dir of [-1, 1] as const) {
        g.fillStyle(COLORS.ink, 0.25).fillPoints(
          tail(dir).map((pt) => ({ x: pt.x, y: pt.y + 5 })),
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
    // La placa (72 px de alto en la textura, escalada a 0.8) queda centrada en la barra.
    const banner = this.add
      .container(GAME_WIDTH / 2, BAR_Y + 6)
      .setDepth(DEPTH.ui)
      .setScale(0.8);
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

  /** Tarjeta blanca con estrella, número grande y barra de progreso. */
  private counterCard(x: number, w: number, h: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, BAR_Y).setDepth(DEPTH.ui);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 18);
    bg.fillStyle(COLORS.white).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(4, COLORS.ink).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    c.add([bg, addStarIcon(this, -w / 2 + 30, 0, 20, true)]);
    const tx = -w / 2 + 56;
    this.starCount = this.text(tx, -9, '0', 26, CSS.ink).setOrigin(0, 0.5);
    this.starOf = this.text(tx, -9, '', 19, '#5F6478').setOrigin(0, 0.5);
    this.starBar = this.add.graphics();
    c.add([this.starCount, this.starOf, this.starBar]);
    return c;
  }

  private setStarCount(n: number): void {
    const max = RIGHT_AREAS.reduce((s, r) => s + GameState.rightStars(r).max, 0);
    this.starCount.setText(String(n));
    this.starOf.setText(` / ${max}`).setX(this.starCount.x + this.starCount.width);
    const w = 190;
    const tx = this.starCount.x;
    const barW = w / 2 - 14 - tx;
    const p = max > 0 ? Math.min(1, n / max) : 0;
    const bh = 10;
    this.starBar.clear();
    this.starBar.fillStyle(0xe4e8ef).fillRoundedRect(tx, 11, barW, bh, bh / 2);
    if (p > 0)
      this.starBar
        .fillStyle(COLORS.sun)
        .fillRoundedRect(tx, 11, Math.max(bh, barW * p), bh, bh / 2);
    this.starBar.lineStyle(2.5, COLORS.ink).strokeRoundedRect(tx, 11, barW, bh, bh / 2);
  }

  /** En pantallas más anchas que el diseño, los botones se pegan a las orillas reales. */
  private anchorHud(): void {
    const place = (): void => {
      const mx = viewportMargin(this.game).x;
      for (const a of this.anchored) if (a.obj.active) a.obj.setX(a.baseX + a.side * mx);
    };
    place();
    this.scale.on(Phaser.Scale.Events.RESIZE, place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, place),
    );
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

  // ------------------------------------------------------------------ lectores de pantalla

  /** Lista oculta con el estado de cada zona y región "aria-live" con lo que dice Tori. */
  private setupScreenReader(): void {
    const box = document.createElement('div');
    box.setAttribute(
      'style',
      'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap',
    );
    const list = document.createElement('ul');
    list.setAttribute('aria-label', 'Zonas de la Isla Derechitos');
    const word: Record<ZoneState, string> = {
      done: 'completada',
      current: 'zona actual',
      pending: 'pendiente',
    };
    this.zones.forEach((z) => {
      const li = document.createElement('li');
      li.textContent = `Zona ${z.index + 1}: ${z.right.short}, ${word[z.state]}${z.state === 'done' ? `, ${z.stars} de 3 estrellas` : ''}.`;
      list.appendChild(li);
    });
    const doneCount = this.zones.filter((z) => z.state === 'done').length;
    const chest = document.createElement('li');
    chest.textContent = `Cofre del diploma: ${doneCount} de ${RIGHT_AREAS.length} zonas${doneCount === RIGHT_AREAS.length ? ', abierto' : ', cerrado'}.`;
    list.appendChild(chest);
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
