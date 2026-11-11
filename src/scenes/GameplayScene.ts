import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, GAME_WIDTH } from '@/config/theme';
import type { VoiceLine } from '@/config/levels';
import { pickPraise } from '@/config/phrases';
import { ensureArt, type ArtKey } from '@/art/Art';
import { addBackdrop, type BackdropOptions } from '@/components/Backdrop';
import { BigButton } from '@/components/BigButton';
import { Effects } from '@/components/Effects';
import { IdleHint, type HintTarget } from '@/components/HelperHand';
import { SpeechBubble } from '@/components/SpeechBubble';
import { addTitle } from '@/components/Text';
import { Tori } from '@/components/Tori';
import { AudioManager } from '@/core/AudioManager';
import { vibrate } from '@/core/Device';

/**
 * Base de toda escena jugable (niveles de la isla y minijuegos de los derechos).
 * Aplica las reglas pedagógicas en un solo lugar:
 * - Acierto: sonido alegre + destellos + palomita + vibración + Tori feliz + elogio variado.
 * - Error amable: sin castigo; sonido suave, Tori inclina la cabeza y da una pista concreta.
 * - Ayuda automática: tras 8 s sin interacción, la manita señala qué hacer y Tori repite la instrucción.
 * - Nunca hay vidas, cronómetro ni "perdiste". Los errores solo ajustan las estrellas (3/2/1).
 */
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
  protected toriPos = { x: 115, y: 600, scale: 0.5 };

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
    new BigButton(this, 90, 56, {
      label: back.label,
      width: 150,
      height: 88,
      fontSize: 34,
      color: COLORS.white,
      onClick: back.go,
    }).setDepth(DEPTH.ui);

    this.onCreateExtra();

    this.effects = new Effects(this);
    const p = this.toriPos;
    this.tori = new Tori(this, p.x, p.y, p.scale);
    this.tori.setDepth(DEPTH.ui + 5);
    this.bubble = new SpeechBubble(this, p.x + 445, 612, {
      width: 620,
      tail: 'left',
      tori: this.tori,
    });

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
    await this.say(intro);
    if (this.alive) this.onIntroDone();
  }

  /** Se llama cuando Tori termina la intro. */
  protected onIntroDone(): void {
    // opcional
  }

  /** Objetivo de la manita de ayuda (o null si no aplica en este momento). */
  protected getHint(): HintTarget | null {
    return null;
  }

  /** Activa la ayuda automática de 8 s. */
  protected enableIdleHint(): void {
    if (this.idle) return;
    this.idle = new IdleHint(this, () => this.getHint(), {
      onHint: () => {
        if (this.instruction) void this.say(this.instruction);
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
    return this.say(line);
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
