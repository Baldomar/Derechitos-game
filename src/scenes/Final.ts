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
import { RIGHT_AREAS, type RightArea } from '@/config/rights';
import type { VoiceLine } from '@/config/levels';
import { ensureArt, tex } from '@/art/Art';
import { BigButton } from '@/components/BigButton';
import { Effects } from '@/components/Effects';
import { addStarIcon } from '@/components/Icons';
import { PillButton } from '@/components/PillButton';
import { addToriGuide } from '@/components/ToriGuide';
import type { SpeechBubble } from '@/components/SpeechBubble';
import type { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { bakedTexture } from '@/core/Bake';
import { motion, prefersReducedMotion, vibrate } from '@/core/Device';
import { GameState } from '@/core/GameState';
import { setPageBackground } from '@/core/PageBackground';
import { goTo } from '@/core/SceneTransition';
import { viewportMargin } from '@/core/Viewport';
import { finalDoneLine, finalProgressLine } from '@/config/voiceCatalog';

const PAD = 320;
/** Hoja del diploma (coordenadas de diseño). */
const DOC = { x: 192, y: 56, w: 896, h: 552 };
const GRAPE_TITLE = 0x7b5cf0;
const TEAL_TEXT = '#13827D';
const SIGN_INK = 0x2f3d9a;
/** Recuadro donde se dibuja la firma en el diploma. */
const SIGN = { x: 900, y: 490, w: 220, h: 58 };

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Diploma "Guardián de los Derechos".
 * - El nombre se toca para escribirlo (lo ayuda un adulto).
 * - La fecha se pone sola el día en que se completan las 8 medallas.
 * - La firma se habilita al completar las 8 medallas: se dibuja con el dedo.
 * - "Imprimir" abre la impresión solo de la hoja del diploma.
 */
export default class FinalScene extends Phaser.Scene {
  private tori!: Tori;
  private bubble!: SpeechBubble;
  private nameText!: Phaser.GameObjects.Text;
  private signLayer!: Phaser.GameObjects.Container;
  private effects!: Effects;
  private domOpen = false;
  /** Resolución de los textos (se sube al preparar la hoja para imprimir). */
  private textRes = TEXT_RESOLUTION;

  constructor() {
    super('Final');
  }

  /** Solo se puede imprimir al llegar desde el cofre abierto de la isla (todo completado). */
  private canPrint = false;

  init(data?: { fromChest?: boolean }): void {
    this.canPrint = data?.fromChest === true;
  }

  create(): void {
    GameState.markFinalSeen();
    GameState.ensureDiplomaDate();
    ensureArt(
      this,
      RIGHT_AREAS.map((r) => r.icon),
    );
    this.domOpen = false;

    this.drawBackground();
    this.effects = new Effects(this);
    const doc = this.drawDocument();

    ({ tori: this.tori, bubble: this.bubble } = addToriGuide(this));

    const back = new PillButton(this, 96, 42, {
      label: 'Medallas',
      icon: 'back',
      width: 176,
      onClick: () => void goTo(this, 'Medals'),
    }).setDepth(DEPTH.ui);
    back.setX(back.x - viewportMargin(this.game).x);

    if (this.canPrint)
      new BigButton(this, 1130, 660, {
        label: 'Imprimir',
        icon: 'print',
        width: 236,
        height: 88,
        fontSize: 32,
        color: COLORS.grape,
        textColor: CSS.white,
        onClick: () => this.print(),
      }).setDepth(DEPTH.ui);

    // Entrada del diploma con rebote y festejo.
    doc.setScale(0.3).setAlpha(0);
    this.tweens.add({
      targets: doc,
      scale: 1,
      alpha: 1,
      duration: motion(800),
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!GameState.allMedals) return;
        AudioManager.sfx('fanfare');
        vibrate([40, 60, 40]);
        this.effects.celebrate();
      },
    });
    if (GameState.allMedals && !prefersReducedMotion())
      this.time.addEvent({ delay: 5000, loop: true, callback: () => this.effects.celebrate() });

    this.time.delayedCall(1100, () => {
      if (GameState.allMedals) this.tori.setMood('celebrate');
      void this.bubble.say(this.statusLines());
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.closeDom());
  }

  /** Lo que dice Tori según cómo va el diploma. */
  private statusLines(): VoiceLine[] {
    const lines: VoiceLine[] = [];
    if (GameState.allMedals) {
      lines.push(finalDoneLine(this.canPrint));
      if (GameState.signature.length === 0)
        lines.push({ id: 'final_sign', text: 'Toca la línea de la firma para firmar tu diploma.' });
    } else {
      lines.push(finalProgressLine(GameState.rightMedalCount));
    }
    if (!GameState.playerName)
      lines.push({ id: 'final_name', text: 'Pide ayuda a un adulto para escribir tu nombre.' });
    return lines;
  }

  // ------------------------------------------------------------------ fondo

  /** Rayos de sol naranjas y amarillos, con confeti. */
  private drawBackground(): void {
    const W = GAME_WIDTH + PAD * 2;
    const H = GAME_HEIGHT + 200;
    const key = bakedTexture(this, 'final-bg', W, H, (g) => {
      const cx = W / 2;
      const cy = H / 2;
      g.fillStyle(0xffc23a).fillRect(0, 0, W, H);
      g.fillStyle(0xf7a224);
      const n = 28;
      const R = Math.hypot(W, H);
      for (let i = 0; i < n; i += 2) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        g.fillTriangle(
          cx,
          cy,
          cx + Math.cos(a0) * R,
          cy + Math.sin(a0) * R,
          cx + Math.cos(a1) * R,
          cy + Math.sin(a1) * R,
        );
      }
      // Confeti fijo
      const colors = [
        COLORS.coral,
        COLORS.turquoise,
        COLORS.grape,
        0x4d8dff,
        COLORS.white,
        COLORS.pink,
      ];
      let seed = 11;
      const rnd = (): number => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 0; i < 140; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const c = colors[i % colors.length] ?? COLORS.white;
        g.fillStyle(c);
        if (i % 3 === 0) g.fillCircle(x, y, 4);
        else {
          const w = 12;
          const h = 6;
          const a = rnd() * Math.PI;
          const pts = [
            [-w / 2, -h / 2],
            [w / 2, -h / 2],
            [w / 2, h / 2],
            [-w / 2, h / 2],
          ].map(([px, py]) => ({
            x: x + (px ?? 0) * Math.cos(a) - (py ?? 0) * Math.sin(a),
            y: y + (px ?? 0) * Math.sin(a) + (py ?? 0) * Math.cos(a),
          }));
          g.fillPoints(pts, true);
        }
      }
    });
    this.add.image(-PAD, -100, key).setOrigin(0);
    setPageBackground(this, { top: 0xffc23a });
  }

  // ------------------------------------------------------------------ hoja

  /**
   * Dibuja la hoja del diploma dentro del rectángulo D.
   * - En pantalla: D = DOC (con nombre y firma tocables).
   * - Para imprimir: D tiene la proporción de una hoja carta horizontal y no lleva sombra,
   *   esquinas exteriores redondeadas ni zonas táctiles.
   * Las medidas originales (pensadas para DOC) se reparten proporcionalmente con X() e Y().
   */
  private drawDocument(
    D: { x: number; y: number; w: number; h: number } = DOC,
    print = false,
  ): Phaser.GameObjects.Container {
    const kx = D.w / DOC.w;
    const ky = D.h / DOC.h;
    const X = (v: number): number => D.x + (v - DOC.x) * kx;
    const Y = (v: number): number => D.y + (v - DOC.y) * ky;
    const midX = D.x + D.w / 2;
    const midY = D.y + D.h / 2;
    const doc = print
      ? this.make.container({ x: midX, y: midY }, false)
      : this.add.container(midX, midY);
    const ox = -midX;
    const oy = -midY;
    const at = <T extends Phaser.GameObjects.Components.Transform>(
      o: T,
      x: number,
      y: number,
    ): T => {
      o.setPosition(x + ox, y + oy);
      return o;
    };

    // Papel y bordes
    const paper = this.add.graphics();
    const { x, y, w, h } = D;
    const outer = print ? 0 : 20;
    if (!print) paper.fillStyle(COLORS.ink, 0.3).fillRoundedRect(x + ox, y + oy + 10, w, h, outer);
    if (print) paper.fillStyle(0xfff3d6).fillRect(x + ox, y + oy, w, h);
    if (!print) {
      paper.fillStyle(0xfff3d6).fillRoundedRect(x + ox, y + oy, w, h, outer);
      paper.lineStyle(5, COLORS.ink).strokeRoundedRect(x + ox, y + oy, w, h, outer);
    }
    paper
      .lineStyle(7, COLORS.turquoise)
      .strokeRoundedRect(x + ox + 16, y + oy + 16, w - 32, h - 32, 12);
    paper.lineStyle(3, COLORS.grape).strokeRoundedRect(x + ox + 27, y + oy + 27, w - 54, h - 54, 8);
    paper.fillStyle(0xfffaf0, 0.7).fillRoundedRect(x + ox + 29, y + oy + 29, w - 58, h - 58, 8);
    doc.add(paper);

    // Adornos dorados en las esquinas
    const corners: [number, number, number][] = [
      [x + 48, y + 48, 0],
      [x + w - 48, y + 48, 90],
      [x + w - 48, y + h - 48, 180],
      [x + 48, y + h - 48, 270],
    ];
    corners.forEach(([cx, cy, ang]) => {
      const g = this.add.graphics();
      g.lineStyle(4, 0xd9a21b);
      g.beginPath();
      g.arc(28, 28, 44, Math.PI * 1.02, Math.PI * 1.48);
      g.strokePath();
      g.beginPath();
      g.arc(4, 4, 22, Math.PI * 0.05, Math.PI * 0.45);
      g.strokePath();
      const c = this.add.container(0, 0, [g, addStarIcon(this, 0, 0, 12, true)]).setAngle(ang);
      doc.add(at(c, cx, cy));
    });

    // Encabezado
    doc.add(at(this.text('La Isla Derechitos otorga el', 19, TEAL_TEXT), midX, Y(90)));
    doc.add(at(this.add.image(0, 0, this.ribbonTexture()), midX, Y(136)));
    doc.add(
      at(
        this.text('DIPLOMA DE', 22, CSS.white)
          .setLetterSpacing(9)
          .setShadow(0, 2, '#9b2c2c', 0, false, true),
        midX + 4,
        Y(134),
      ),
    );
    const title = this.add
      .text(0, 0, 'Guardián de los Derechos', {
        fontFamily: FONTS.title,
        fontSize: '60px',
        fontStyle: '800',
        color: `#${GRAPE_TITLE.toString(16)}`,
        stroke: CSS.ink,
        strokeThickness: 10,
        resolution: this.textRes,
        padding: { top: 12, bottom: 6 },
      })
      .setShadow(0, 4, CSS.ink, 0, true, true)
      .setOrigin(0.5);
    if (title.width > 760) title.setScale(760 / title.width);
    doc.add(at(title, midX, Y(196)));

    // Nombre
    doc.add(at(this.text('Se entrega con mucho orgullo a', 20, CSS.ink, '700'), midX, Y(252)));
    const nameText = this.text(print ? GameState.playerName : '', 40, CSS.ink);
    if (nameText.width > 500) nameText.setScale(500 / nameText.width);
    doc.add(at(nameText, midX, Y(290)));
    const dash = this.add.graphics();
    dash.fillStyle(0xd9a21b);
    for (let dx = -250; dx < 250; dx += 14) dash.fillRect(dx, 0, 8, 3);
    doc.add(at(dash, midX, Y(316)));
    if (!print) {
      this.nameText = nameText;
      this.refreshName();
      const nameZone = this.add.zone(0, 0, 520, 72).setInteractive({ useHandCursor: true });
      nameZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.askName());
      doc.add(at(nameZone, midX, Y(292)));
    }

    doc.add(
      at(
        this.text(
          'por conocer y defender sus 8 derechos en la Isla Derechitos.',
          19,
          CSS.ink,
          '700',
        ),
        midX,
        Y(340),
      ),
    );

    // Medallas
    RIGHT_AREAS.forEach((r, i) => {
      const mx = X(296 + i * 98);
      doc.add(at(this.smallMedal(r), mx, Y(402)));
      const label = this.text(r.short, 15, CSS.ink);
      if (label.width > 90) label.setScale(90 / label.width);
      doc.add(at(label, mx, Y(448)));
    });

    // Fecha (se pone sola al completar las 8 medallas)
    const date = GameState.diplomaDate;
    const dateText = date
      ? this.text(formatDate(date), 21, CSS.ink)
      : this.text(print ? '' : 'Al ganar las 8 medallas', 17, '#8A8070', '700');
    if (dateText.width > 220) dateText.setScale(220 / dateText.width);
    doc.add(at(dateText, X(380), Y(518)));
    const lines = this.add.graphics();
    lines.lineStyle(3, COLORS.ink).lineBetween(X(270) + ox, Y(544) + oy, X(490) + ox, Y(544) + oy);
    lines.lineStyle(3, COLORS.ink).lineBetween(X(790) + ox, Y(522) + oy, X(1010) + ox, Y(522) + oy);
    doc.add(lines);
    doc.add(at(this.text('Fecha', 15, CSS.ink), X(380), Y(562)));

    // Sello con las estrellas ganadas
    // En la hoja carta el sello va un poco más arriba y más chico, para que sus cintas no se salgan.
    doc.add(at(this.seal(!print).setScale(print ? 0.85 : 1), midX, print ? Y(502) : Y(520)));

    // Firma
    doc.add(at(this.text('Firma del Guardián', 15, CSS.ink), X(900), Y(540)));
    if (print) {
      const g = this.add.graphics();
      if (GameState.allMedals)
        this.drawStrokes(
          g,
          GameState.signature,
          X(900) - SIGN.w / 2,
          Y(490) - SIGN.h / 2 + 4,
          SIGN.w,
          SIGN.h,
          3,
        );
      doc.add(at(g, 0, 0));
    } else {
      this.signLayer = this.add.container(0, 0);
      doc.add(at(this.signLayer, 0, 0));
      this.refreshSignature();
      const signZone = this.add.zone(0, 0, 240, 90).setInteractive({ useHandCursor: true });
      signZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.onSignTap());
      doc.add(at(signZone, X(900), Y(498)));
    }

    return doc;
  }

  private text(s: string, size: number, color: string, weight = '800'): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, s, {
        fontFamily: weight === '800' ? FONTS.title : FONTS.body,
        fontSize: `${size}px`,
        fontStyle: weight,
        color,
        resolution: this.textRes,
        padding: { top: 5 },
      })
      .setOrigin(0.5);
  }

  /** Cinta roja de "DIPLOMA DE" con puntas dobladas. */
  private ribbonTexture(): string {
    return bakedTexture(this, 'final-ribbon', 440, 70, (g) => {
      const tail = (dir: 1 | -1): { x: number; y: number }[] => {
        const c = 220;
        const p = (dx: number, dy: number): { x: number; y: number } => ({
          x: c + dir * dx,
          y: dy,
        });
        return [p(150, 20), p(214, 22), p(196, 40), p(214, 60), p(150, 58)];
      };
      for (const dir of [-1, 1] as const) {
        g.fillStyle(0xb33a3a).fillPoints(tail(dir), true);
        g.lineStyle(3.5, COLORS.ink).strokePoints(tail(dir), true);
      }
      g.fillStyle(COLORS.ink, 0.3).fillRoundedRect(42, 13, 356, 44, 8);
      g.fillStyle(0xe5484d).fillRoundedRect(42, 8, 356, 44, 8);
      g.fillStyle(0xff7a7e, 0.6).fillRoundedRect(48, 12, 344, 10, 5);
      g.lineStyle(4, COLORS.ink).strokeRoundedRect(42, 8, 356, 44, 8);
    });
  }

  /** Medalla pequeña del diploma: de color si se ganó, gris si falta. */
  private smallMedal(r: RightArea): Phaser.GameObjects.Container {
    const won = GameState.hasRightMedal(r);
    const g = this.add.graphics();
    const ra = won ? COLORS.coral : 0x9aa1ad;
    const rb = won ? r.color : 0xb6bcc6;
    g.fillStyle(ra).fillTriangle(-13, -34, -3, -34, -6, -14);
    g.fillStyle(rb).fillTriangle(3, -34, 13, -34, 6, -14);
    g.lineStyle(2.5, COLORS.ink).strokeTriangle(-13, -34, -3, -34, -6, -14);
    g.strokeTriangle(3, -34, 13, -34, 6, -14);
    g.fillStyle(COLORS.ink, 0.25).fillCircle(0, 4, 21);
    g.fillStyle(won ? 0xf7c33c : 0xc3c8d2).fillCircle(0, 0, 21);
    g.fillStyle(won ? r.color : 0x8e949f).fillCircle(0, 0, 14);
    g.lineStyle(3.5, COLORS.ink).strokeCircle(0, 0, 21);
    const icon = this.add.image(0, 0, tex(r.icon)).setScale(0.17);
    if (!won) icon.setTintFill(0x5f6570).setAlpha(0.7);
    return this.add.container(0, 0, [g, icon]);
  }

  /** Roseta dorada con estrella y las estrellas ganadas. */
  private seal(animate = true): Phaser.GameObjects.Container {
    const key = bakedTexture(this, 'final-seal', 160, 190, (g) => {
      const cx = 80;
      const cy = 72;
      // Cintas
      g.fillStyle(0xe5484d).fillPoints(
        [
          { x: cx - 8, y: cy + 30 },
          { x: cx - 34, y: cy + 112 },
          { x: cx - 22, y: cy + 104 },
          { x: cx - 12, y: cy + 116 },
          { x: cx + 10, y: cy + 40 },
        ],
        true,
      );
      g.fillStyle(COLORS.turquoise).fillPoints(
        [
          { x: cx + 8, y: cy + 30 },
          { x: cx + 34, y: cy + 112 },
          { x: cx + 22, y: cy + 104 },
          { x: cx + 12, y: cy + 116 },
          { x: cx - 10, y: cy + 40 },
        ],
        true,
      );
      g.lineStyle(3.5, COLORS.ink);
      g.strokePoints(
        [
          { x: cx - 8, y: cy + 30 },
          { x: cx - 34, y: cy + 112 },
          { x: cx - 22, y: cy + 104 },
          { x: cx - 12, y: cy + 116 },
          { x: cx + 10, y: cy + 40 },
        ],
        true,
      );
      g.strokePoints(
        [
          { x: cx + 8, y: cy + 30 },
          { x: cx + 34, y: cy + 112 },
          { x: cx + 22, y: cy + 104 },
          { x: cx + 12, y: cy + 116 },
          { x: cx - 10, y: cy + 40 },
        ],
        true,
      );
      // Borde festoneado
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const rr = i % 2 ? 58 : 66;
        pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
      }
      g.fillStyle(0xe8a91c).fillPoints(pts, true);
      g.lineStyle(4, COLORS.ink).strokePoints(pts, true);
      g.fillStyle(0xf7c33c).fillCircle(cx, cy, 50);
      g.lineStyle(3, 0xc98a12).strokeCircle(cx, cy, 50);
      g.lineStyle(2, COLORS.white, 0.6);
      for (let i = 0; i < 30; i += 2) {
        const a = (i / 30) * Math.PI * 2;
        g.lineBetween(
          cx + Math.cos(a) * 42,
          cy + Math.sin(a) * 42,
          cx + Math.cos(a) * 46,
          cy + Math.sin(a) * 46,
        );
      }
    });
    const max = RIGHT_AREAS.reduce((s, r) => s + GameState.rightStars(r).max, 0);
    const c = this.add.container(0, 0, [
      this.add.image(0, 22, key),
      addStarIcon(this, 0, -14, 24, true).setScale(1),
      this.text(`${GameState.totalRightStars}/${max}`, 16, CSS.ink).setPosition(0, 26),
    ]);
    if (animate && !prefersReducedMotion())
      this.tweens.add({
        targets: c,
        angle: { from: -3, to: 3 },
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    return c;
  }

  // ------------------------------------------------------------------ nombre

  private refreshName(): void {
    const n = GameState.playerName;
    this.nameText
      .setText(n || 'Toca para escribir tu nombre')
      .setFontSize(n ? 40 : 26)
      .setColor(n ? CSS.ink : '#A09580')
      .setScale(1);
    if (this.nameText.width > 500) this.nameText.setScale(500 / this.nameText.width);
  }

  /** Cuadro para escribir el nombre (encima del juego, funciona también en pantalla completa). */
  private askName(): void {
    if (this.domOpen) return;
    AudioManager.sfx('pop');
    const host = document.getElementById('game') ?? document.body;
    const wrap = document.createElement('div');
    wrap.id = 'diploma-name';
    wrap.setAttribute(
      'style',
      'position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(43,40,72,.55);font-family:"Baloo 2","Nunito",system-ui,sans-serif',
    );
    wrap.innerHTML = `
      <form style="background:#fff8e7;border:4px solid #2b2848;border-radius:22px;padding:22px 24px;display:flex;flex-direction:column;gap:14px;width:min(420px,86vw);box-shadow:0 8px 0 rgba(43,40,72,.3)">
        <label for="diploma-name-input" style="font-size:24px;font-weight:800;color:#2b2848;text-align:center">¿Cómo te llamas?</label>
        <input id="diploma-name-input" maxlength="24" autocomplete="off" style="font:800 26px 'Baloo 2','Nunito',sans-serif;padding:8px 14px;border:3px solid #2b2848;border-radius:14px;text-align:center;color:#2b2848" />
        <div style="display:flex;gap:12px;justify-content:center">
          <button type="button" data-act="cancel" style="font:800 20px 'Baloo 2',sans-serif;min-height:48px;padding:6px 18px;border:3px solid #2b2848;border-radius:999px;background:#fff;color:#2b2848">Cancelar</button>
          <button type="submit" style="font:800 20px 'Baloo 2',sans-serif;min-height:48px;padding:6px 24px;border:3px solid #2b2848;border-radius:999px;background:#ffc93c;color:#2b2848">Listo</button>
        </div>
      </form>`;
    host.appendChild(wrap);
    this.domOpen = true;
    const input = wrap.querySelector('input');
    if (input) {
      input.value = GameState.playerName;
      window.setTimeout(() => input.focus(), 50);
    }
    wrap.querySelector('[data-act="cancel"]')?.addEventListener('click', () => this.closeDom());
    wrap.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      GameState.setPlayerName(input?.value ?? '');
      this.closeDom();
      this.refreshName();
      AudioManager.sfx('success');
    });
  }

  private closeDom(): void {
    document.getElementById('diploma-name')?.remove();
    this.domOpen = false;
  }

  // ------------------------------------------------------------------ firma

  private refreshSignature(): void {
    this.signLayer.removeAll(true);
    const strokes = GameState.signature;
    if (!GameState.allMedals) {
      const lock = this.add.graphics();
      lock.lineStyle(3, 0x8a8070);
      lock.beginPath();
      lock.arc(SIGN.x - 112, SIGN.y + 6, 6, Math.PI, 0);
      lock.strokePath();
      lock.fillStyle(0x8a8070).fillRoundedRect(SIGN.x - 120, SIGN.y + 6, 16, 12, 3);
      this.signLayer.add(lock);
      this.signLayer.add(
        this.text('Se firma con las 8 medallas', 15, '#8A8070', '700').setPosition(
          SIGN.x + 6,
          SIGN.y + 12,
        ),
      );
      return;
    }
    if (strokes.length === 0) {
      const hint = this.text('✍ Toca aquí para firmar', 18, '#5B4BC4').setPosition(
        SIGN.x,
        SIGN.y + 10,
      );
      this.signLayer.add(hint);
      if (!prefersReducedMotion())
        this.tweens.add({
          targets: hint,
          scale: 1.08,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      return;
    }
    const g = this.add.graphics();
    this.drawStrokes(g, strokes, SIGN.x - SIGN.w / 2, SIGN.y - SIGN.h / 2 + 4, SIGN.w, SIGN.h, 3);
    this.signLayer.add(g);
  }

  private drawStrokes(
    g: Phaser.GameObjects.Graphics,
    strokes: number[][],
    x: number,
    y: number,
    w: number,
    h: number,
    width: number,
  ): void {
    g.lineStyle(width, SIGN_INK);
    for (const s of strokes) {
      if (s.length < 4) {
        g.fillStyle(SIGN_INK).fillCircle(x + (s[0] ?? 0) * w, y + (s[1] ?? 0) * h, width / 2);
        continue;
      }
      g.beginPath();
      g.moveTo(x + (s[0] ?? 0) * w, y + (s[1] ?? 0) * h);
      for (let i = 2; i < s.length; i += 2) g.lineTo(x + (s[i] ?? 0) * w, y + (s[i + 1] ?? 0) * h);
      g.strokePath();
    }
  }

  private onSignTap(): void {
    if (this.domOpen) return;
    if (!GameState.allMedals) {
      AudioManager.sfx('hint');
      void this.bubble.say({
        id: 'final_sign_locked',
        text: 'La firma se agrega cuando ganes las 8 medallas.',
      });
      return;
    }
    this.openSignPad();
  }

  /** Panel para firmar con el dedo (o el ratón). Guarda la firma al tocar "Listo". */
  private openSignPad(): void {
    AudioManager.sfx('pop');
    // Por encima del confeti de festejo.
    const layer = this.add.container(0, 0).setDepth(DEPTH.transition - 1);
    const m = viewportMargin(this.game);
    const shade = this.add
      .rectangle(-m.x, -m.y, GAME_WIDTH + m.x * 2, GAME_HEIGHT + m.y * 2, COLORS.ink, 0.6)
      .setOrigin(0)
      .setInteractive();
    layer.add(shade);

    const card = this.add.graphics();
    card.fillStyle(COLORS.ink, 0.3).fillRoundedRect(240, 128, 800, 440, 26);
    card.fillStyle(0xfff8e7).fillRoundedRect(240, 120, 800, 440, 26);
    card.lineStyle(5, COLORS.ink).strokeRoundedRect(240, 120, 800, 440, 26);
    layer.add(card);
    layer.add(this.text('Firma aquí con tu dedo', 32, CSS.ink).setPosition(640, 164));

    // Área de dibujo (proporción del recuadro de la firma del diploma)
    const area = { x: 290, y: 200, w: 700, h: 700 * (SIGN.h / SIGN.w) };
    const box = this.add.graphics();
    box.fillStyle(COLORS.white).fillRoundedRect(area.x, area.y, area.w, area.h, 16);
    box.lineStyle(3, COLORS.ink).strokeRoundedRect(area.x, area.y, area.w, area.h, 16);
    box
      .lineStyle(3, 0xd9a21b)
      .lineBetween(area.x + 30, area.y + area.h - 34, area.x + area.w - 30, area.y + area.h - 34);
    layer.add(box);
    const ink = this.add.graphics();
    layer.add(ink);

    const strokes: number[][] = [];
    let current: number[] | null = null;
    const pad = this.add
      .zone(area.x, area.y, area.w, area.h)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    layer.add(pad);
    const toNorm = (p: Phaser.Input.Pointer): [number, number] => {
      const wx = p.worldX;
      const wy = p.worldY;
      return [
        Phaser.Math.Clamp((wx - area.x) / area.w, 0, 1),
        Phaser.Math.Clamp((wy - area.y) / area.h, 0, 1),
      ];
    };
    const redraw = (): void => {
      ink.clear();
      this.drawStrokes(ink, strokes, area.x, area.y, area.w, area.h, 7);
    };
    pad.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      current = [...toNorm(p)];
      strokes.push(current);
      redraw();
    });
    pad.on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!current || !p.isDown) return;
      const [nx, ny] = toNorm(p);
      const lx = current[current.length - 2] ?? nx;
      const ly = current[current.length - 1] ?? ny;
      if (Math.hypot((nx - lx) * area.w, (ny - ly) * area.h) < 3) return;
      current.push(nx, ny);
      redraw();
    });
    const end = (): void => {
      current = null;
    };
    pad.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, end);
    pad.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, end);

    const close = (): void => {
      layer.destroy(true);
    };
    layer.add(
      new PillButton(this, 420, 508, {
        label: 'Borrar',
        width: 150,
        onClick: () => {
          strokes.length = 0;
          redraw();
        },
      }),
    );
    layer.add(new PillButton(this, 600, 508, { label: 'Cancelar', width: 160, onClick: close }));
    layer.add(
      new BigButton(this, 840, 506, {
        label: 'Listo',
        width: 200,
        height: 88,
        fontSize: 34,
        color: COLORS.sun,
        onClick: () => {
          if (strokes.length === 0) return;
          GameState.setSignature(strokes);
          close();
          this.refreshSignature();
          AudioManager.sfx('success');
          this.effects.sparkleAt(SIGN.x, SIGN.y, 14);
          this.tori.setMood('happy');
          void this.bubble.say({
            id: 'final_signed',
            text: '¡Qué linda firma! Tu diploma ya está completo.',
          });
        },
      }),
    );
  }

  // ------------------------------------------------------------------ imprimir

  /**
   * Imprime el diploma en una hoja CARTA HORIZONTAL (11 × 8.5 in) a página completa:
   * arma una versión de la hoja con esa proporción, la dibuja en alta resolución
   * (unos 200 ppp) y abre la impresión sin márgenes.
   */
  private print(): void {
    AudioManager.sfx('pop');
    const PW = 896;
    const PH = Math.round((PW * 8.5) / 11); // proporción de hoja carta horizontal
    const SCALE = 2.5; // 2240 × 1733 px ≈ 200 ppp en carta
    this.textRes = 3;
    const sheet = this.drawDocument({ x: 0, y: 0, w: PW, h: PH }, true);
    this.textRes = TEXT_RESOLUTION;
    sheet.setScale(SCALE).setPosition((PW * SCALE) / 2, (PH * SCALE) / 2);
    const rt = this.make.renderTexture({ width: PW * SCALE, height: PH * SCALE }, false);
    rt.fill(0xfff3d6);
    rt.draw(sheet);
    rt.snapshot((img) => {
      sheet.destroy(true);
      rt.destroy();
      if (img instanceof HTMLImageElement) this.openPrint(img.src);
    });
  }

  private openPrint(src: string): void {
    const frame = document.createElement('iframe');
    frame.setAttribute('style', 'position:fixed;width:0;height:0;border:0;opacity:0');
    document.body.appendChild(frame);
    const docu = frame.contentDocument;
    if (!docu) return;
    docu.open();
    docu.write(
      `<!doctype html><html><head><title>Diploma</title><style>@page{size:letter landscape;margin:0}html,body{margin:0;width:100%;height:100%}img{display:block;width:100vw;height:100vh;object-fit:fill}@media print{img{width:11in;height:8.5in}}</style></head><body><img src="${src}"></body></html>`,
    );
    docu.close();
    const go = (): void => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 60000);
    };
    const pic = docu.querySelector('img');
    if (pic && !pic.complete) pic.addEventListener('load', go);
    else go();
  }
}
