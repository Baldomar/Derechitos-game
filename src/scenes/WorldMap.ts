import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import { LEVELS, type LevelDef } from '@/config/levels';
import { MAP_ALL, MAP_FIRST, MAP_NEXT } from '@/config/phrases';
import { ensureArt, tex } from '@/art/Art';
import { BigButton } from '@/components/BigButton';
import { IdleHint } from '@/components/HelperHand';
import { addLockIcon, addStarIcon } from '@/components/Icons';
import { SpeechBubble } from '@/components/SpeechBubble';
import { StarCounter } from '@/components/StarReward';
import { addBody, addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion, prefersReducedMotion } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { goTo, prefetchScene } from '@/core/SceneTransition';
import { setPageBackground } from '@/core/PageBackground';

const NODE_R = 54; // 108 px de diámetro (> 88 px mínimo)

/** Mapa ilustrado de la Isla Derechitos: zonas, camino que se ilumina, estrellas y total. */
export default class WorldMapScene extends Phaser.Scene {
  constructor() {
    super('WorldMap');
  }

  create(): void {
    ensureArt(this, ['palmera', 'izote', 'arbol', 'nube', ...LEVELS.map((l) => l.icon)]);
    this.drawIsland();
    setPageBackground({ top: COLORS.sea });
    this.drawPath();
    const current = GameState.currentLevel;
    for (const level of LEVELS)
      this.addZone(level, level.id === current.id && !GameState.allCompleted);

    // Tori espera junto a la zona actual.
    const tori = new Tori(this, current.zone.x - 92, current.zone.y + 6, 0.34, false).setDepth(
      DEPTH.ui - 1,
    );
    const bubble = new SpeechBubble(this, GAME_WIDTH / 2, 650, { width: 600, tail: 'none', tori });
    const line = GameState.allCompleted
      ? MAP_ALL
      : GameState.completedCount === 0
        ? MAP_FIRST
        : MAP_NEXT;
    this.time.delayedCall(500, () => {
      void bubble.say(line).then(() => {
        if (this.sys.isActive()) this.time.delayedCall(1500, () => bubble.hide());
      });
    });
    new IdleHint(this, () => ({ kind: 'tap', x: current.zone.x, y: current.zone.y }), {
      onHint: () => void bubble.say(line),
    });

    this.addHud();
    prefetchScene(current.sceneKey);
    AudioManager.preloadVoices(current.dialog.intro);
    AudioManager.playMusic();
  }

  private drawIsland(): void {
    // Isla estática: se hornea una vez y se reutiliza en cada visita al mapa.
    bakedTexture(this, 'map-island', GAME_WIDTH, GAME_HEIGHT, (g) => this.paintIsland(g));
    this.add.image(0, 0, 'map-island').setOrigin(0);
    this.addDecorations();
  }

  private paintIsland(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.sea).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Olitas
    g.lineStyle(4, COLORS.white, 0.35);
    for (let i = 0; i < 14; i++) {
      const x = (i * 197) % GAME_WIDTH;
      const y = 30 + ((i * 113) % 660);
      g.beginPath();
      g.arc(x, y, 14, Math.PI * 1.1, Math.PI * 1.9);
      g.strokePath();
    }
    const blobs: [number, number, number, number][] = [
      [640, 390, 1180, 600],
      [260, 470, 560, 380],
      [1000, 300, 560, 400],
    ];
    g.fillStyle(COLORS.white, 0.3);
    blobs.forEach(([x, y, w, h]) => g.fillEllipse(x, y, w + 50, h + 50));
    g.fillStyle(COLORS.sand);
    blobs.forEach(([x, y, w, h]) => g.fillEllipse(x, y, w, h));
    g.fillStyle(COLORS.grass);
    blobs.forEach(([x, y, w, h]) => g.fillEllipse(x, y, w - 60, h - 60));
    g.fillStyle(COLORS.grassDark, 0.35).fillEllipse(640, 380, 520, 250);
  }

  private addDecorations(): void {
    const deco: [string, number, number, number][] = [
      ['palmera', 80, 380, 0.6],
      ['palmera', 1210, 520, 0.55],
      ['arbol', 640, 360, 0.6],
      ['izote', 250, 400, 0.5],
      ['izote', 820, 600, 0.5],
      ['arbol', 1150, 250, 0.45],
    ];
    deco.forEach(([k, x, y, s]) => this.add.image(x, y, tex(k as 'palmera')).setScale(s));

    // Nubes que pasan despacio.
    if (!prefersReducedMotion()) {
      [120, 700].forEach((y0, i) => {
        const c = this.add
          .image(-200 + i * 700, y0 > 300 ? 60 : 40, tex('nube'))
          .setAlpha(0.85)
          .setDepth(DEPTH.ui - 2);
        this.tweens.add({
          targets: c,
          x: GAME_WIDTH + 200,
          duration: 60000 + i * 15000,
          repeat: -1,
          onRepeat: () => c.setX(-200),
        });
      });
    }
  }

  /** Camino de puntitos entre zonas: se ilumina hasta donde llegó el niño. */
  private drawPath(): void {
    // Cambia con el progreso: se vuelve a hornear en cada visita (una sola vez, no por cuadro).
    bakedTexture(this, 'map-path', GAME_WIDTH, GAME_HEIGHT, (g) => this.paintPath(g), true);
    this.add.image(0, 0, 'map-path').setOrigin(0);
  }

  private paintPath(g: Phaser.GameObjects.Graphics): void {
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const a = LEVELS[i] as LevelDef;
      const b = LEVELS[i + 1] as LevelDef;
      const lit = GameState.isCompleted(a.id);
      const dist = Phaser.Math.Distance.Between(a.zone.x, a.zone.y, b.zone.x, b.zone.y);
      const steps = Math.floor(dist / 30);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const x = a.zone.x + (b.zone.x - a.zone.x) * t;
        const y = a.zone.y + (b.zone.y - a.zone.y) * t;
        g.fillStyle(lit ? COLORS.sun : COLORS.cream, lit ? 1 : 0.8).fillCircle(x, y, lit ? 9 : 7);
        g.lineStyle(3, COLORS.ink, lit ? 0.9 : 0.3).strokeCircle(x, y, lit ? 9 : 7);
      }
    }
  }

  private addZone(level: LevelDef, isCurrent: boolean): void {
    const { x, y } = level.zone;
    const unlocked = GameState.isUnlocked(level);
    const done = GameState.isCompleted(level.id);
    const zone = this.add.container(x, y);
    const glow = this.add.circle(0, 0, NODE_R + 14, COLORS.sun, isCurrent ? 0.6 : 0);
    const shadow = this.add.circle(0, 8, NODE_R, COLORS.ink, 0.25);
    const disc = this.add
      .circle(0, 0, NODE_R, unlocked ? level.zone.color : COLORS.locked)
      .setStrokeStyle(6, COLORS.ink);
    const inner = this.add.circle(0, 0, NODE_R - 10, COLORS.white, unlocked ? 0.55 : 0.3);
    zone.add([glow, shadow, disc, inner]);

    if (unlocked) {
      zone.add(this.add.image(0, 0, tex(level.icon)).setScale(0.68));
      const badge = this.add
        .circle(NODE_R - 12, -NODE_R + 12, 18, COLORS.white)
        .setStrokeStyle(4, COLORS.ink);
      zone.add([badge, addTitle(this, NODE_R - 12, -NODE_R + 14, String(level.number), 24)]);
      zone.add(
        addBody(this, 0, -NODE_R - 30, level.title, 20, { stroke: CSS.white, strokeThickness: 6 }),
      );
    } else {
      zone.add(addLockIcon(this, 0, 0, 1.2));
    }
    const stars = GameState.getStars(level.id);
    for (let i = 0; i < 3; i++)
      zone.add(addStarIcon(this, (i - 1) * 34, NODE_R + 20, 15, i < stars));
    if (done) zone.add(this.add.image(-NODE_R + 10, -NODE_R + 14, 'fx-check').setScale(0.4));

    disc.setInteractive({ useHandCursor: unlocked });
    disc.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (unlocked) {
        AudioManager.sfx('pop');
        this.tweens.add({
          targets: zone,
          scaleX: 1.12,
          scaleY: 0.9,
          duration: motion(90),
          yoyo: true,
        });
        void goTo(this, level.sceneKey);
      } else {
        // Bloqueada: meneo suave, sin mensaje negativo.
        this.tweens.add({
          targets: zone,
          angle: { from: -6, to: 6 },
          duration: motion(70),
          yoyo: true,
          repeat: 2,
          onComplete: () => zone.setAngle(0),
        });
      }
    });

    if (isCurrent && !prefersReducedMotion()) {
      this.tweens.add({
        targets: zone,
        scale: 1.1,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({ targets: glow, alpha: 0.15, duration: 650, yoyo: true, repeat: -1 });
    }
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

    new StarCounter(this, GAME_WIDTH - 130, 56, GameState.totalStars, GameState.maxStars);

    new BigButton(this, GAME_WIDTH - 105, GAME_HEIGHT - 66, {
      label: 'Álbum',
      width: 180,
      height: 92,
      fontSize: 38,
      color: COLORS.grape,
      onClick: () => void goTo(this, 'Album'),
    }).setDepth(DEPTH.ui);

    if (GameState.allCompleted) {
      new BigButton(this, GAME_WIDTH - 300, GAME_HEIGHT - 66, {
        label: 'Diploma',
        width: 190,
        height: 92,
        fontSize: 38,
        color: COLORS.sun,
        onClick: () => void goTo(this, 'Final'),
      }).setDepth(DEPTH.ui);
    }
  }
}
