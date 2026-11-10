import Phaser from 'phaser';
import { COLORS, CSS, DEPTH, GAME_WIDTH } from '@/config/theme';
import {
  getLevelByScene,
  type LevelContent,
  type LevelDef,
  type LevelSceneKey,
  type VoiceLine,
} from '@/config/levels';
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
import { GameState } from '@/core/GameState';
import { goTo, prefetchScene } from '@/core/SceneTransition';

/**
 * Base común de los 8 niveles. Aplica las reglas pedagógicas en un solo lugar:
 * - Acierto: sonido alegre + destellos + palomita + vibración + Tori feliz + elogio variado.
 * - Error amable: sin castigo; sonido suave, Tori inclina la cabeza y da una pista concreta.
 * - Ayuda automática: tras 8 s sin interacción, la manita señala qué hacer y Tori repite la instrucción.
 * - Nunca hay vidas, cronómetro ni "perdiste". Los errores solo ajustan las estrellas (3/2/1).
 */
export abstract class BaseLevel extends Phaser.Scene {
  protected readonly level: LevelDef;
  protected errors = 0;
  protected tori!: Tori;
  protected bubble!: SpeechBubble;
  protected effects!: Effects;
  /** Instrucción vigente: Tori la repite cuando aparece la manita de ayuda. */
  protected instruction: VoiceLine | null = null;
  private idle: IdleHint | null = null;
  private finished = false;

  /** Dibujos que usa el nivel (se generan al entrar: "atlas por escena"). */
  protected abstract readonly art: readonly ArtKey[];
  protected backdrop: BackdropOptions = {};
  protected toriPos = { x: 115, y: 600, scale: 0.5 };

  constructor(key: LevelSceneKey) {
    super(key);
    this.level = getLevelByScene(key);
  }

  init(): void {
    this.errors = 0;
    this.finished = false;
    this.instruction = null;
    this.idle = null;
  }

  create(): void {
    ensureArt(this, this.art);
    addBackdrop(this, this.backdrop);
    addTitle(this, GAME_WIDTH / 2, 46, this.level.title, 44, {
      color: CSS.ink,
      stroke: CSS.white,
      strokeThickness: 8,
    }).setDepth(DEPTH.ui);

    new BigButton(this, 90, 56, {
      label: 'Mapa',
      width: 150,
      height: 88,
      fontSize: 34,
      color: COLORS.white,
      onClick: () => void goTo(this, 'WorldMap'),
    }).setDepth(DEPTH.ui);

    // Precarga solo el código y las voces del nivel siguiente.
    const next = GameState.nextLevel(this.level.id);
    if (next) {
      prefetchScene(next.sceneKey);
      AudioManager.preloadVoices(next.dialog.intro);
    }

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
    this.instruction = this.level.dialog.intro[this.level.dialog.intro.length - 1] ?? null;
    this.time.delayedCall(450, () => void this.start());
  }

  /** Dice la intro y luego llama a onStart() (algunas mecánicas esperan a Tori). */
  private async start(): Promise<void> {
    await this.say(this.level.dialog.intro);
    if (this.alive) this.onIntroDone();
  }

  /** Construye la escena del nivel (objetos, zonas). */
  protected abstract buildLevel(): void;

  /** Se llama cuando Tori termina la intro. */
  protected onIntroDone(): void {
    // opcional en cada nivel
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

  /** Cierre del nivel: celebración, mensaje final y paso a la recompensa. */
  protected async complete(line?: VoiceLine): Promise<void> {
    if (this.finished) return;
    this.idle?.pause();
    this.tori.setMood('celebrate');
    this.effects.celebrate();
    AudioManager.sfx('medal');
    vibrate([30, 60, 30]);
    if (line) await this.say(line);
    await this.wait(700);
    this.finishLevel();
  }

  private finishLevel(): void {
    if (this.finished || !this.sys.isActive()) return;
    this.finished = true;
    const result = GameState.completeLevel(this.level.id, this.errors);
    void goTo(this, 'Reward', result);
  }

  /** Contenido tipado del nivel. */
  protected contentOf<K extends LevelContent['kind']>(kind: K): Extract<LevelContent, { kind: K }> {
    const c = this.level.content;
    if (c.kind !== kind) throw new Error(`El nivel ${this.level.id} no es de tipo ${kind}`);
    return c as Extract<LevelContent, { kind: K }>;
  }
}
