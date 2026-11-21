import Phaser from 'phaser';
import { tex } from '@/art/Art';
import { COLORS } from '@/config/theme';
import type { StackActivity } from '@/config/rights';
import type { VoiceLine } from '@/config/levels';
import type { HintTarget } from '@/components/HelperHand';
import { addBody } from '@/components/Text';
import { AudioManager } from '@/core/AudioManager';
import { motion } from '@/core/Device';
import { BaseActivity } from './BaseActivity';

const BASE_X = 640;
const BASE_Y = 572;
const RAIL_Y = 110;
const SWING = 230;
/** Alto máximo de la torre (para que quepa bajo la grúa). */
const MAX_STACK = 300;
/** Cuánto se montan los bordes de una pieza sobre la de abajo (para que encajen sin rendijas). */
const OVERLAP = 3;
/** Tope de la base de piedra (donde se apoya la primera pieza). */
const BASE_TOP = BASE_Y - 4;

/** Filas donde empieza y termina el dibujo de verdad (sin el margen transparente). */
const boundsCache = new Map<string, { top: number; bottom: number }>();

const TOO_FAR: VoiceLine = {
  id: 'stack_too_far',
  text: 'Se cayó. Espera a que esté justo arriba y toca.',
};

/**
 * Motor "construye": una grúa lleva cada pieza de un lado a otro. Al tocar la pantalla la
 * suelta: si cae encima de la torre, encaja con un "plop"; si cae muy de lado, se resbala
 * y la grúa trae otra igual (sin castigo). Pieza por pieza se arma la casa o la torre.
 */
export default class StackGameScene extends BaseActivity<StackActivity> {
  protected readonly kind = 'stack' as const;
  private index = 0;
  private scaleK = 1;
  private top = BASE_TOP;
  private trolley!: Phaser.GameObjects.Container;
  private rope!: Phaser.GameObjects.Graphics;
  private piece: Phaser.GameObjects.Image | null = null;
  private state: 'swing' | 'fall' | 'wait' = 'wait';
  private t = 0;
  private vy = 0;
  private placed: Phaser.GameObjects.Image[] = [];
  private tip!: Phaser.GameObjects.Text;
  private ready = false;

  constructor() {
    super('StackGame');
  }

  override init(data: { rightId: string; activityId: string }): void {
    super.init(data);
    this.index = 0;
    this.top = BASE_TOP;
    this.piece = null;
    this.state = 'wait';
    this.t = 0;
    this.vy = 0;
    this.placed = [];
    this.ready = false;
  }

  /** Primera y última fila con pintura de la textura (en px de la textura). */
  private bounds(key: string): { top: number; bottom: number } {
    const cached = boundsCache.get(key);
    if (cached) return cached;
    const src = this.textures.get(key).getSourceImage() as CanvasImageSource & {
      width: number;
      height: number;
    };
    const w = src.width;
    const h = src.height;
    let res = { top: 0, bottom: h };
    try {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(src, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        const solid = (y: number): boolean => {
          for (let x = 0; x < w; x++) if ((data[(y * w + x) * 4 + 3] ?? 0) > 40) return true;
          return false;
        };
        let top = 0;
        while (top < h - 1 && !solid(top)) top++;
        let bottom = h - 1;
        while (bottom > top && !solid(bottom)) bottom--;
        res = { top, bottom: bottom + 1 };
      }
    } catch {
      // Si no se puede leer la imagen, se usa la caja completa.
    }
    boundsCache.set(key, res);
    return res;
  }

  private size(i: number): { w: number; h: number } {
    const p = this.activity.pieces[i];
    if (!p) return { w: 0, h: 0 };
    const src = this.textures.get(tex(p.art)).getSourceImage();
    const w = p.width * this.scaleK;
    return { w, h: (src.height / src.width) * w };
  }

  protected override buildLevel(): void {
    // Todas las piezas juntas deben caber bajo la grúa.
    const total = this.activity.pieces.reduce((sum, _p, i) => sum + this.size(i).h, 0);
    this.scaleK = Math.min(1, MAX_STACK / total);

    // Piso de pasto con una base de piedra.
    const g = this.add.graphics();
    // Pasto de borde a borde de la pantalla (también en pantallas anchas y altas).
    g.fillStyle(COLORS.grassDark).fillRect(-2000, BASE_Y, 1280 + 4000, 1200);
    g.fillStyle(0x4f9a42);
    for (let x = -1980; x < 3260; x += 38)
      g.fillTriangle(x, BASE_Y + 40, x + 5, BASE_Y + 28, x + 10, BASE_Y + 40);
    g.fillStyle(COLORS.white, 0.15).fillRect(-2000, BASE_Y, 1280 + 4000, 4);
    g.fillStyle(0xa9b4c2).fillRoundedRect(BASE_X - 190, BASE_Y - 4, 380, 26, 10);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(BASE_X - 190, BASE_Y - 4, 380, 26, 10);
    // Grúa: torre amarilla a la derecha y riel arriba.
    g.fillStyle(COLORS.sun).fillRect(1080, RAIL_Y - 10, 34, BASE_Y - RAIL_Y + 10);
    g.lineStyle(4, COLORS.ink).strokeRect(1080, RAIL_Y - 10, 34, BASE_Y - RAIL_Y + 10);
    g.lineStyle(3, COLORS.ink, 0.6);
    for (let y = RAIL_Y; y < BASE_Y; y += 34) g.lineBetween(1080, y, 1114, y + 34);
    g.fillStyle(COLORS.sun).fillRect(300, RAIL_Y - 14, 814, 22);
    g.lineStyle(4, COLORS.ink).strokeRect(300, RAIL_Y - 14, 814, 22);
    g.fillStyle(COLORS.orange).fillRoundedRect(1060, RAIL_Y - 60, 76, 50, 10);
    g.lineStyle(4, COLORS.ink).strokeRoundedRect(1060, RAIL_Y - 60, 76, 50, 10);
    g.fillStyle(COLORS.sky).fillRoundedRect(1074, RAIL_Y - 52, 30, 26, 6);

    const cart = this.add.graphics();
    cart.fillStyle(COLORS.orange).fillRoundedRect(-30, -10, 60, 26, 8);
    cart.lineStyle(4, COLORS.ink).strokeRoundedRect(-30, -10, 60, 26, 8);
    cart.fillStyle(COLORS.ink).fillCircle(-16, 18, 6).fillCircle(16, 18, 6);
    this.trolley = this.add.container(BASE_X, RAIL_Y, [cart]).setDepth(5);
    this.rope = this.add.graphics().setDepth(4);

    this.tip = addBody(this, 220, 300, '¡Toca para\nsoltarla!', 24, {
      stroke: '#FFFFFF',
      strokeThickness: 7,
    });
    this.tweens.add({ targets: this.tip, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.y < 110 && p.x < 220) return;
      this.drop();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.drop());
    // La primera pieza ya se mueve mientras Tori explica.
    this.nextPiece();
  }

  protected override onIntroDone(): void {
    this.enableIdleHint();
    this.ready = true;
  }

  private nextPiece(): void {
    const p = this.activity.pieces[this.index];
    if (!p) return;
    const { w } = this.size(this.index);
    const img = this.add
      .image(this.trolley.x, RAIL_Y + 40, tex(p.art))
      .setOrigin(0.5, 0)
      .setDepth(3);
    img.setScale(w / img.width);
    img.setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, duration: motion(250) });
    this.piece = img;
    this.state = 'swing';
  }

  private drop(): void {
    if (!this.ready || this.state !== 'swing' || !this.piece) return;
    this.state = 'fall';
    this.vy = 0;
    AudioManager.sfx('pop', { pitch: 0.9 });
    if (this.tip.visible) this.tip.setVisible(false);
  }

  override update(_time: number, delta: number): void {
    if (!this.trolley) return;
    const dt = Math.min(delta, 50) / 1000;
    if (this.state === 'swing' || this.state === 'wait') {
      // Un poco más rápido con cada pieza, pero siempre tranquilo.
      this.t += dt * (0.9 + this.index * 0.12);
      this.trolley.x = BASE_X + Math.sin(this.t) * SWING;
    }
    const p = this.piece;
    if (p && this.state === 'swing') {
      p.x = this.trolley.x;
      p.y = RAIL_Y + 40;
    }
    this.rope.clear();
    if (p && this.state === 'swing') {
      this.rope.lineStyle(4, COLORS.ink).lineBetween(this.trolley.x, RAIL_Y + 14, p.x, p.y);
    } else {
      this.rope
        .lineStyle(4, COLORS.ink)
        .lineBetween(this.trolley.x, RAIL_Y + 14, this.trolley.x, RAIL_Y + 40);
    }
    if (p && this.state === 'fall') {
      this.vy += 1800 * dt;
      p.y += this.vy * dt;
      const b = this.bounds(p.texture.key);
      if (p.y + b.bottom * p.scaleY >= this.top + OVERLAP) {
        // Se apoya justo donde termina el dibujo (no el borde transparente de la imagen).
        p.y = this.top + OVERLAP - b.bottom * p.scaleY;
        this.land(p);
      }
    }
  }

  private land(p: Phaser.GameObjects.Image): void {
    this.state = 'wait';
    const def = this.activity.pieces[this.index];
    if (!def) return;
    const below = this.placed[this.placed.length - 1];
    const centerX = below ? below.x : BASE_X;
    const off = p.x - centerX;
    const tolerance = Math.max(40, p.displayWidth * 0.3);
    if (Math.abs(off) > tolerance) {
      // Se resbala y cae de lado; la grúa trae otra.
      AudioManager.sfx('pop', { pitch: 0.6 });
      const dir = Math.sign(off) || 1;
      this.tweens.add({
        targets: p,
        x: p.x + dir * 160,
        y: BASE_Y + 40,
        angle: dir * 70,
        alpha: 0,
        duration: motion(650),
        ease: 'Quad.easeIn',
        onComplete: () => p.destroy(),
      });
      this.piece = null;
      this.mistakeOnce(`piece${this.index}`, TOO_FAR);
      this.time.delayedCall(900, () => this.nextPiece());
      return;
    }
    // Encaja: se acomoda al centro con un aplastón.
    AudioManager.sfx('pop', { pitch: 1.2 + this.index * 0.08 });
    this.tweens.add({ targets: p, x: centerX, duration: motion(160), ease: 'Quad.easeOut' });
    const sx = p.scaleX;
    const sy = p.scaleY;
    // Aplastón con la base pegada abajo (no se despega de la pieza de abajo).
    const b = this.bounds(p.texture.key);
    const floor = p.y + b.bottom * sy;
    const keep = (): void => {
      p.y = floor - b.bottom * p.scaleY;
    };
    this.tweens.chain({
      targets: p,
      tweens: [
        { scaleY: sy * 0.85, scaleX: sx * 1.08, duration: motion(80), onUpdate: keep },
        {
          scaleY: sy,
          scaleX: sx,
          duration: motion(300),
          ease: 'Elastic.easeOut',
          onUpdate: keep,
        },
      ],
    });
    this.cameras.main.shake(120, 0.003);
    this.placed.push(p);
    this.piece = null;
    // La siguiente pieza se apoya donde empieza el dibujo de esta.
    this.top = p.y + b.top * sy;
    const last = this.index === this.activity.pieces.length - 1;
    this.effects.sparkleAt(centerX, p.y + p.displayHeight / 2, 10);
    this.correct(centerX, p.y - 30, null);
    void this.say(def.say).then(() => {
      if (!this.alive) return;
      if (last) {
        this.effects.confettiAt(BASE_X, this.top, 50);
        void this.complete(this.activity.done);
      } else {
        this.index += 1;
        this.nextPiece();
      }
    });
  }

  protected override getHint(): HintTarget | null {
    if (this.state !== 'swing') return null;
    return { kind: 'tap', x: 220, y: 380 };
  }
}
