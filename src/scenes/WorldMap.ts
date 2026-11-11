import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import { RIGHT_AREAS, type RightArea, type RightAreaId } from '@/config/rights';
import { VILLA_HELLO, VILLA_START } from '@/config/phrases';
import { ensureArt, tex, type ArtKey } from '@/art/Art';
import { BigButton } from '@/components/BigButton';
import { IdleHint } from '@/components/HelperHand';
import { addStarIcon } from '@/components/Icons';
import { SpeechBubble } from '@/components/SpeechBubble';
import { StarCounter } from '@/components/StarReward';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { setPageBackground } from '@/core/PageBackground';
import { goTo, prefetchScene } from '@/core/SceneTransition';
import { TEX } from '@/core/Textures';

/** Ancho extra de la isla a cada lado del área de diseño (para pantallas panorámicas). */
const ISLE_PAD = 320;
const NODE_R = 54; // 108 px de diámetro (> 88 px mínimo táctil)

/** Zonas de los derechos sobre la isla, en el orden del camino. */
const SPOTS: Record<RightAreaId, { x: number; y: number }> = {
  salud: { x: 227, y: 505 },
  educacion: { x: 419, y: 432 },
  vida: { x: 327, y: 270 },
  alimentacion: { x: 530, y: 172 },
  vivienda: { x: 731, y: 246 },
  igualdad: { x: 876, y: 392 },
  jugar: { x: 1032, y: 300 },
  opinion: { x: 906, y: 164 },
};
const spot = (r: RightArea): { x: number; y: number } => SPOTS[r.id];

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

/**
 * Mapa de la Isla Derechitos: una zona redonda por derecho, unidas por un camino de puntitos
 * que se ilumina al avanzar. Al tocar una zona, Tori dice una frase del derecho y se entra.
 */
export default class WorldMapScene extends Phaser.Scene {
  private bubble!: SpeechBubble;
  private tori!: Tori;
  private entering = false;

  constructor() {
    super('WorldMap');
  }

  create(): void {
    this.entering = false;
    ensureArt(this, ['palmera', 'izote', 'arbol', 'nube', ...RIGHT_AREAS.map((r) => r.icon)]);
    this.drawIsland();
    this.drawPath();
    setPageBackground(this, { top: COLORS.sea });

    // La zona "actual": el primer derecho sin completar (empieza por Salud).
    const current = RIGHT_AREAS.find((r) => !isDone(r)) ?? RIGHT_AREAS[0];
    RIGHT_AREAS.forEach((r, i) => this.addZone(r, i, r === current));

    const at = current ? spot(current) : { x: 227, y: 505 };
    this.tori = new Tori(this, at.x - 90, at.y + 4, 0.34, false).setDepth(DEPTH.ui - 1);
    this.bubble = new SpeechBubble(this, GAME_WIDTH / 2, 650, {
      width: 600,
      tail: 'none',
      tori: this.tori,
    });
    const featured = RIGHT_AREAS.find((r) => r.featured);
    const fresh = featured ? GameState.rightProgress(featured).done === 0 : false;
    this.time.delayedCall(
      450,
      () => void this.bubble.say(fresh ? [VILLA_HELLO, VILLA_START] : VILLA_HELLO),
    );
    new IdleHint(this, () => (current ? { kind: 'tap', ...spot(current) } : null));

    this.addHud();
    prefetchScene('RightHub');
    AudioManager.playMusic();
  }

  // ------------------------------------------------------------------ isla

  private drawIsland(): void {
    bakedTexture(this, 'map-island-v4', GAME_WIDTH + ISLE_PAD * 2, GAME_HEIGHT, (g) =>
      this.paintIsland(g),
    );
    this.add.image(-ISLE_PAD, 0, 'map-island-v4').setOrigin(0);

    const deco: [ArtKey, number, number, number][] = [
      ['palmera', 127, 350, 0.6],
      ['palmera', 1160, 480, 0.55],
      ['arbol', 640, 330, 0.6],
      ['arbol', 1107, 218, 0.45],
      ['izote', 281, 370, 0.42],
    ];
    deco.forEach(([k, x, y, s]) => this.add.image(x, y, tex(k)).setScale(s));

    // Nubes que pasan despacio por arriba.
    const clouds: [number, number, number][] = [
      [360, 46, 0.85],
      [720, 52, 0.95],
    ];
    clouds.forEach(([x, y, s], i) => {
      const c = this.add
        .image(x, y, tex('nube'))
        .setScale(s)
        .setAlpha(0.92)
        .setDepth(DEPTH.ui - 2);
      if (prefersReducedMotion()) return;
      this.tweens.add({
        targets: c,
        x: GAME_WIDTH + 220,
        duration: (GAME_WIDTH + 220 - x) * (70 + i * 20),
        onComplete: () => {
          c.setX(-220);
          this.tweens.add({
            targets: c,
            x: GAME_WIDTH + 220,
            duration: (GAME_WIDTH + 440) * (70 + i * 20),
            repeat: -1,
            onRepeat: () => c.setX(-220),
          });
        },
      });
    });
  }

  private paintIsland(g: Phaser.GameObjects.Graphics): void {
    const W = GAME_WIDTH + ISLE_PAD * 2;
    const o = ISLE_PAD;
    g.fillStyle(COLORS.sea).fillRect(0, 0, W, GAME_HEIGHT);
    g.lineStyle(4, COLORS.white, 0.35);
    for (let i = 0; i < 22; i++) {
      const x = (i * 197) % W;
      const y = 30 + ((i * 113) % 660);
      g.beginPath();
      g.arc(x, y, 14, Math.PI * 1.1, Math.PI * 1.9);
      g.strokePath();
    }
    const blobs: [number, number, number, number][] = [
      [640 + o, 390, 1300, 620],
      [260 + o, 470, 600, 400],
      [1000 + o, 300, 600, 420],
    ];
    g.fillStyle(COLORS.white, 0.3);
    blobs.forEach(([x, y, w, h]) => g.fillEllipse(x, y, w + 50, h + 50));
    g.fillStyle(COLORS.sand);
    blobs.forEach(([x, y, w, h]) => g.fillEllipse(x, y, w, h));
    g.fillStyle(COLORS.grass);
    blobs.forEach(([x, y, w, h]) => g.fillEllipse(x, y, w - 60, h - 60));
    g.fillStyle(COLORS.grassDark, 0.35).fillEllipse(640 + o, 370, 560, 270);
  }

  /** Camino de puntitos entre zonas: se ilumina (amarillo) hasta donde llegó el niño. */
  private drawPath(): void {
    bakedTexture(
      this,
      'map-path-v4',
      GAME_WIDTH,
      GAME_HEIGHT,
      (g) => {
        for (let i = 0; i < RIGHT_AREAS.length - 1; i++) {
          const a = RIGHT_AREAS[i] as RightArea;
          const b = RIGHT_AREAS[i + 1] as RightArea;
          const lit = isDone(a);
          const pa = spot(a);
          const pb = spot(b);
          const steps = Math.floor(Phaser.Math.Distance.Between(pa.x, pa.y, pb.x, pb.y) / 30);
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const x = pa.x + (pb.x - pa.x) * t;
            const y = pa.y + (pb.y - pa.y) * t;
            g.fillStyle(lit ? COLORS.sun : COLORS.cream, lit ? 1 : 0.85).fillCircle(
              x,
              y,
              lit ? 9 : 7,
            );
            g.lineStyle(3, COLORS.ink, lit ? 0.9 : 0.35).strokeCircle(x, y, lit ? 9 : 7);
          }
        }
      },
      true,
    );
    this.add.image(0, 0, 'map-path-v4').setOrigin(0);
  }

  // ------------------------------------------------------------------ zonas

  private addZone(r: RightArea, i: number, isCurrent: boolean): void {
    const { x, y } = spot(r);
    const zone = this.add.container(x, y);
    const glow = this.add.circle(0, 0, NODE_R + 16, COLORS.sun, isCurrent ? 0.55 : 0);
    const shadow = this.add.circle(0, 8, NODE_R, COLORS.ink, 0.25);
    const disc = this.add.circle(0, 0, NODE_R, r.color).setStrokeStyle(6, COLORS.ink);
    const inner = this.add.circle(0, 0, NODE_R - 10, COLORS.white, 0.55);
    zone.add([glow, shadow, disc, inner, this.add.image(0, 0, tex(r.icon)).setScale(0.68)]);

    // Número (arriba a la derecha) y palomita si el derecho está completo (arriba a la izquierda).
    zone.add(
      this.add.circle(NODE_R - 12, -NODE_R + 12, 18, COLORS.white).setStrokeStyle(4, COLORS.ink),
    );
    zone.add(addTitle(this, NODE_R - 12, -NODE_R + 14, String(i + 1), 24));
    if (isDone(r) || GameState.hasRightMedal(r)) {
      zone.add(this.add.image(-NODE_R + 10, -NODE_R + 14, TEX.check).setScale(0.4));
    }
    zone.add(
      addBody(this, 0, -NODE_R - 30, r.short, 22, { stroke: CSS.white, strokeThickness: 6 }),
    );

    const stars = progressStars(r);
    for (let s = 0; s < 3; s++)
      zone.add(addStarIcon(this, (s - 1) * 34, NODE_R + 22, 15, s < stars));

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
          scale: 1.08,
          duration: 650,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.tweens.add({ targets: glow, alpha: 0.15, duration: 650, yoyo: true, repeat: -1 });
      },
    });
  }

  private addHud(): void {
    new BigButton(this, 90, 56, {
      label: 'Inicio',
      width: 150,
      height: 88,
      fontSize: 34,
      color: COLORS.white,
      onClick: () => void goTo(this, 'Title'),
    }).setDepth(DEPTH.ui);

    const max = RIGHT_AREAS.reduce((s, r) => s + GameState.rightStars(r).max, 0);
    new StarCounter(this, GAME_WIDTH - 130, 56, GameState.totalRightStars, max);

    new BigButton(this, GAME_WIDTH - 125, GAME_HEIGHT - 66, {
      label: 'Medallas',
      width: 210,
      height: 92,
      fontSize: 36,
      color: COLORS.grape,
      onClick: () => void goTo(this, 'Medals'),
    }).setDepth(DEPTH.ui);
  }

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
