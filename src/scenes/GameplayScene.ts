import Phaser from 'phaser';
import { CSS, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '@/config/theme';
import type { VoiceLine } from '@/config/levels';
import { pickPraise } from '@/config/phrases';
import { ensureArt, type ArtKey } from '@/art/Art';
import { addBackdrop, type BackdropOptions } from '@/components/Backdrop';
import { PillButton } from '@/components/PillButton';
import { viewportMargin } from '@/core/Viewport';
import { Effects } from '@/components/Effects';
import { IdleHint, type HintTarget } from '@/components/HelperHand';
import { SpeechBubble } from '@/components/SpeechBubble';
import { addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { addToriGuide } from '@/components/ToriGuide';
import { AudioManager } from '@/core/AudioManager';
import { vibrate } from '@/core/Device';

/**
 * Base de toda escena jugable (niveles de la isla y minijuegos de los derechos).
 * Aplica las reglas pedagógicas en un solo lugar:
 * - Acierto: sonido alegre + destellos + palomita + vibración + Tori feliz + elogio variado.
 * - Error amable: sin castigo; sonido suave, Tori inclina la cabeza y da una pista concreta.
 * - Ayuda automática: tras 5 s sin interacción, la manita señala qué hacer y Tori repite la instrucción.
 * - Nunca hay vidas, cronómetro ni "perdiste". Los errores solo ajustan las estrellas (3/2/1).
 */
/** Tiempo sin tocar nada antes de que Tori repita la indicación (una sola vez). */
const REPEAT_AFTER_MS = 20000;

export abstract class GameplayScene extends Phaser.Scene {
  protected errors = 0;
  protected tori!: Tori;
  protected bubble!: SpeechBubble;
  protected effects!: Effects;
  /** Instrucción vigente: Tori la repite cuando aparece la manita de ayuda. */
  protected instruction: VoiceLine | null = null;
  private idle: IdleHint | null = null;
  protected finished = false;

  /** Dibujos que usa la escena (se generan al entrar: "atlas por escena"). */
  protected abstract readonly art: readonly ArtKey[];
  protected backdrop: BackdropOptions = {};

  /** Título que se muestra arriba. */
  protected abstract headerTitle(): string;
  /** Lo que Tori dice al entrar. */
  protected abstract introLines(): VoiceLine[];
  /** Botón de regreso (etiqueta y destino). */
  protected abstract backButton(): { label: string; go: () => void };
  /** Se llama al terminar (guardar progreso y pasar a la recompensa). */
  protected abstract onFinished(): void;
  /** Construye la mecánica (objetos, zonas). */
  protected abstract buildLevel(): void;

  init(_data?: unknown): void {
    this.errors = 0;
    this.finished = false;
    this.instruction = null;
    this.idle = null;
  }

  create(): void {
    ensureArt(this, this.art);
    addBackdrop(this, this.backdrop);
    addTitle(this, GAME_WIDTH / 2, 46, this.headerTitle(), 44, {
      color: CSS.ink,
      stroke: CSS.white,
      strokeThickness: 8,
    }).setDepth(DEPTH.ui);

    const back = this.backButton();
    const backBtn = new PillButton(this, 0, 0, {
      label: back.label,
      icon: 'back',
      width: 156,
      onClick: back.go,
    }).setDepth(DEPTH.ui);
    // Pegado a la esquina superior izquierda visible (usa el margen extra de pantallas anchas),
    // para que no quede encima del contenido del juego.
    const placeBack = (): void => {
      const m = viewportMargin(this.game);
      backBtn.setPosition(90 - m.x, 42 - Math.min(m.y, 20));
    };
    placeBack();
    this.scale.on(Phaser.Scale.Events.RESIZE, placeBack);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, placeBack),
    );

    // Capa invisible que, mientras Tori da indicaciones, no deja tocar el juego
    // (debajo del botón Volver y del globo de Tori, que siguen funcionando).
    this.lockCount = 0;
    this.lastTouch = 0;
    this.instructionAt = 0;
    this.repeated = false;
    this.blocker = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 8000, 8000, 0x000000, 0.001)
      .setDepth(DEPTH.ui - 1)
      .setVisible(false);
    this.blocker.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.nudgeListen());

    this.onCreateExtra();

    this.effects = new Effects(this);
    const guide = addToriGuide(this);
    this.tori = guide.tori;
    this.bubble = guide.bubble;

    this.buildLevel();
    const intro = this.introLines();
    this.instruction = intro[intro.length - 1] ?? null;
    this.time.delayedCall(450, () => void this.start(intro));
  }

  /** Gancho opcional (p. ej. precargar lo siguiente). */
  protected onCreateExtra(): void {
    // opcional
  }

  private async start(intro: VoiceLine[]): Promise<void> {
    await this.whileListening(this.say(intro));
    this.instructionAt = this.time.now;
    if (this.alive) this.onIntroDone();
  }

  private blocker!: Phaser.GameObjects.Rectangle;
  /** Para repetir la indicación con voz solo una vez y solo si el niño lleva rato sin tocar. */
  private lastTouch = 0;
  private instructionAt = 0;
  private repeated = false;
  private lockCount = 0;

  /** true mientras Tori da indicaciones: el juego no responde a los toques. */
  protected get inputLocked(): boolean {
    return this.lockCount > 0;
  }

  /** Bloquea los toques del juego hasta que termine esa indicación (o la interrumpan). */
  private async whileListening(p: Promise<void>): Promise<void> {
    this.lockCount += 1;
    this.blocker.setVisible(true).setInteractive();
    try {
      await p;
    } finally {
      this.lockCount = Math.max(0, this.lockCount - 1);
      if (this.lockCount === 0 && this.blocker.active) {
        this.blocker.disableInteractive().setVisible(false);
      }
    }
  }

  /** Si tocan mientras Tori explica: el globo da un saltito ("¡primero escucha!"). */
  private nudgeListen(): void {
    if (this.tweens.isTweening(this.bubble)) return;
    this.tweens.add({ targets: this.bubble, scale: 1.06, duration: 110, yoyo: true });
  }

  /** Se llama cuando Tori termina la intro. */
  protected onIntroDone(): void {
    // opcional
  }

  /** Objetivo de la manita de ayuda (o null si no aplica en este momento). */
  protected getHint(): HintTarget | null {
    return null;
  }

  /** Activa la ayuda automática de 5 s. */
  protected enableIdleHint(): void {
    if (this.idle) return;
    // Si el niño no toca nada: a los 5 s sale solo la manita (sin voz). Si sigue sin tocar
    // unos 20 s, Tori repite la indicación UNA vez; después, solo la manita.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => (this.lastTouch = this.time.now));
    this.idle = new IdleHint(this, () => this.getHint(), {
      onHint: () => {
        const quiet = this.time.now - Math.max(this.lastTouch, this.instructionAt);
        if (!this.instruction || this.repeated || quiet < REPEAT_AFTER_MS) return;
        this.repeated = true;
        void this.say(this.instruction);
      },
    });
  }

  protected get alive(): boolean {
    return this.sys.isActive() && !this.finished;
  }

  protected say(lines: VoiceLine | VoiceLine[]): Promise<void> {
    return this.bubble.say(lines);
  }

  /** Cambia la instrucción vigente y la dice. */
  protected instruct(line: VoiceLine): Promise<void> {
    this.instruction = line;
    this.instructionAt = this.time.now;
    this.repeated = false;
    return this.whileListening(this.say(line));
  }

  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  /** Acierto (feedback visual + sonoro + háptico). `line: null` = sin elogio hablado. */
  protected correct(x: number, y: number, line?: VoiceLine | null): void {
    AudioManager.sfx('success');
    vibrate(30);
    this.effects.successAt(x, y);
    this.tori.setMood('happy');
    if (line !== null) void this.say(line ?? pickPraise());
  }

  /** Error amable: cuenta para las estrellas, nunca castiga. */
  protected mistake(hint: VoiceLine): void {
    this.errors += 1;
    AudioManager.sfx('hint');
    this.tori.setMood('think');
    void this.say(hint);
  }

  /** Cierre: celebración, mensaje final y paso a la recompensa. */
  protected async complete(line?: VoiceLine): Promise<void> {
    if (this.finished) return;
    this.idle?.pause();
    this.tori.setMood('celebrate');
    this.effects.celebrate();
    AudioManager.sfx('medal');
    vibrate([30, 60, 30]);
    if (line) await this.say(line);
    await this.wait(700);
    if (this.finished || !this.sys.isActive()) return;
    this.finished = true;
    this.onFinished();
  }
}
