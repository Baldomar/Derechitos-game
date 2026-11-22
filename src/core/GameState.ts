import Phaser from 'phaser';
import { LEVELS, type LevelDef } from '@/config/levels';
import { RIGHT_AREAS, isPlayable, type Activity, type RightArea } from '@/config/rights';

/**
 * Progreso del juego: estrellas, medallas, álbum y ajustes.
 * - Se guarda en localStorage con try/catch (modo privado o almacenamiento bloqueado
 *   no rompen el juego: el progreso vive en memoria durante la sesión).
 * - Nunca se pierde progreso: las estrellas solo suben, un nivel completado sigue completado.
 * - Medallas y estampas se derivan de los niveles completados (una por nivel).
 */

export type Stars = 1 | 2 | 3;

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  voice: number; // 0..1
  musicMuted: boolean;
  sfxMuted: boolean;
  voiceMuted: boolean;
}

interface SaveData {
  version: 1;
  /** Mejor resultado por nivel (solo niveles completados). */
  stars: Record<string, Stars>;
  /** Mejor resultado por actividad de los derechos: clave "derecho/actividad". */
  activities: Record<string, Stars>;
  introSeen: boolean;
  finalSeen: boolean;
  /** Modo maestro: todos los niveles abiertos. */
  unlockAll: boolean;
  settings: Settings;
  /** Nombre que aparece en el diploma. */
  playerName: string;
  /** Día en que se completaron las 8 medallas (AAAA-MM-DD), o null si aún no. */
  diplomaDate: string | null;
  /** Firma del diploma: trazos con puntos normalizados (x, y, x, y… entre 0 y 1). */
  signature: number[][];
  /** Lo que el mapa ya mostró: zonas completadas y estrellas (para animar solo lo nuevo). */
  mapSeen: { done: string[]; stars: number };
}

export interface LevelResult {
  levelId: string;
  stars: Stars;
  /** Mejor marca anterior (0 si es la primera vez). */
  previousBest: number;
  firstTime: boolean;
  errors: number;
}

export const STATE_EVENTS = {
  CHANGE: 'change',
  SETTINGS: 'settings',
} as const;

const STORAGE_KEY = 'derechitos.save.v1';

const DEFAULT_SETTINGS: Settings = {
  music: 0.35,
  sfx: 0.8,
  voice: 1,
  musicMuted: false,
  sfxMuted: false,
  voiceMuted: false,
};

const activityKey = (rightId: string, activityId: string): string => `${rightId}/${activityId}`;

export interface ActivityResult {
  rightId: string;
  activityId: string;
  stars: Stars;
  previousBest: number;
  firstTime: boolean;
  /** Se acaba de ganar la medalla del derecho. */
  medalEarned: boolean;
  /** Se acaban de abrir los desafíos del derecho. */
  challengesUnlocked: boolean;
}

function defaults(): SaveData {
  return {
    version: 1,
    stars: {},
    activities: {},
    introSeen: false,
    finalSeen: false,
    unlockAll: false,
    settings: { ...DEFAULT_SETTINGS },
    playerName: '',
    diplomaDate: null,
    signature: [],
    mapSeen: { done: [], stars: 0 },
  };
}

const MAX_NAME = 24;
const MAX_STROKES = 60;
const MAX_POINTS = 600;

function cleanSignature(raw: unknown): number[][] {
  if (!Array.isArray(raw)) return [];
  const out: number[][] = [];
  for (const stroke of raw.slice(0, MAX_STROKES)) {
    if (!Array.isArray(stroke)) continue;
    const nums = stroke
      .slice(0, MAX_POINTS)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      .map((n) => Math.min(1, Math.max(0, n)));
    if (nums.length >= 2) out.push(nums.slice(0, nums.length - (nums.length % 2)));
  }
  return out;
}

/** Fecha local de hoy en formato AAAA-MM-DD. */
function today(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/** Valida datos guardados (pueden venir corruptos o de otra versión). */
function sanitize(raw: unknown): SaveData {
  const data = defaults();
  if (typeof raw !== 'object' || raw === null) return data;
  const r = raw as Partial<Record<keyof SaveData, unknown>>;

  if (typeof r.stars === 'object' && r.stars !== null) {
    for (const level of LEVELS) {
      const s = (r.stars as Record<string, unknown>)[level.id];
      if (s === 1 || s === 2 || s === 3) data.stars[level.id] = s;
    }
  }
  if (typeof r.activities === 'object' && r.activities !== null) {
    for (const right of RIGHT_AREAS) {
      for (const a of [...right.games, ...right.challenges]) {
        const key = activityKey(right.id, a.id);
        const s = (r.activities as Record<string, unknown>)[key];
        if (s === 1 || s === 2 || s === 3) data.activities[key] = s;
      }
    }
  }
  data.introSeen = r.introSeen === true;
  data.finalSeen = r.finalSeen === true;
  data.unlockAll = r.unlockAll === true;
  if (typeof r.playerName === 'string') data.playerName = r.playerName.trim().slice(0, MAX_NAME);
  if (typeof r.diplomaDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.diplomaDate))
    data.diplomaDate = r.diplomaDate;
  data.signature = cleanSignature(r.signature);
  if (typeof r.mapSeen === 'object' && r.mapSeen !== null) {
    const m = r.mapSeen as { done?: unknown; stars?: unknown };
    const ids = new Set<string>(RIGHT_AREAS.map((a) => a.id));
    if (Array.isArray(m.done))
      data.mapSeen.done = m.done.filter((d): d is string => typeof d === 'string' && ids.has(d));
    if (typeof m.stars === 'number' && Number.isFinite(m.stars))
      data.mapSeen.stars = Math.max(0, Math.round(m.stars));
  }

  if (typeof r.settings === 'object' && r.settings !== null) {
    const s = r.settings as Partial<Record<keyof Settings, unknown>>;
    data.settings = {
      music: clamp01(s.music, DEFAULT_SETTINGS.music),
      sfx: clamp01(s.sfx, DEFAULT_SETTINGS.sfx),
      voice: clamp01(s.voice, DEFAULT_SETTINGS.voice),
      musicMuted: s.musicMuted === true,
      sfxMuted: s.sfxMuted === true,
      voiceMuted: s.voiceMuted === true,
    };
  }
  return data;
}

class GameStateStore extends Phaser.Events.EventEmitter {
  private data: SaveData;

  constructor() {
    super();
    this.data = this.load();
  }

  /** 3 estrellas sin errores, 2 con 1–2 errores, 1 con más. Siempre gana algo. */
  static starsFor(errors: number): Stars {
    if (errors <= 0) return 3;
    if (errors <= 2) return 2;
    return 1;
  }

  // ---------- Progreso ----------

  getStars(levelId: string): number {
    return this.data.stars[levelId] ?? 0;
  }

  get totalStars(): number {
    return LEVELS.reduce((sum, l) => sum + this.getStars(l.id), 0);
  }

  get maxStars(): number {
    return LEVELS.length * 3;
  }

  isCompleted(levelId: string): boolean {
    return this.getStars(levelId) > 0;
  }

  /** Desbloqueo secuencial: el nivel N se abre al completar el N-1. */
  isUnlocked(level: LevelDef): boolean {
    if (this.data.unlockAll || level.number === 1) return true;
    const prev = LEVELS.find((l) => l.number === level.number - 1);
    return prev ? this.isCompleted(prev.id) : true;
  }

  /** Primer nivel desbloqueado sin completar (o el último si ya terminó todo). */
  get currentLevel(): LevelDef {
    const next = LEVELS.find((l) => this.isUnlocked(l) && !this.isCompleted(l.id));
    return next ?? (LEVELS[LEVELS.length - 1] as LevelDef);
  }

  /** Nivel siguiente a uno dado (para precargar solo ese). */
  nextLevel(levelId: string): LevelDef | undefined {
    const idx = LEVELS.findIndex((l) => l.id === levelId);
    return idx >= 0 ? LEVELS[idx + 1] : undefined;
  }

  get completedCount(): number {
    return LEVELS.filter((l) => this.isCompleted(l.id)).length;
  }

  get allCompleted(): boolean {
    return this.completedCount === LEVELS.length;
  }

  /** Medallas y estampas ganadas (una por nivel completado). */
  get earnedLevels(): LevelDef[] {
    return LEVELS.filter((l) => this.isCompleted(l.id));
  }

  /** Registra el resultado. Las estrellas nunca bajan. */
  completeLevel(levelId: string, errors: number): LevelResult {
    const stars = GameStateStore.starsFor(errors);
    const previousBest = this.getStars(levelId);
    if (stars > previousBest) this.data.stars[levelId] = stars;
    this.save();
    return { levelId, stars, previousBest, firstTime: previousBest === 0, errors };
  }

  get introSeen(): boolean {
    return this.data.introSeen;
  }

  markIntroSeen(): void {
    if (this.data.introSeen) return;
    this.data.introSeen = true;
    this.save();
  }

  get finalSeen(): boolean {
    return this.data.finalSeen;
  }

  markFinalSeen(): void {
    if (this.data.finalSeen) return;
    this.data.finalSeen = true;
    this.save();
  }

  // ---------- Villa de los Derechos ----------

  getActivityStars(rightId: string, activityId: string): number {
    return this.data.activities[activityKey(rightId, activityId)] ?? 0;
  }

  /** Estrellas ganadas en un derecho y máximo posible (solo actividades disponibles). */
  rightStars(right: RightArea): { stars: number; max: number } {
    const all = [...right.games, ...right.challenges].filter(isPlayable);
    return {
      stars: all.reduce((sum, a) => sum + this.getActivityStars(right.id, a.id), 0),
      max: all.length * 3,
    };
  }

  /** Actividades completadas / disponibles de un derecho. */
  rightProgress(right: RightArea): { done: number; total: number } {
    const all = [...right.games, ...right.challenges].filter(isPlayable);
    return {
      done: all.filter((a) => this.getActivityStars(right.id, a.id) > 0).length,
      total: all.length,
    };
  }

  /** Los desafíos se abren al completar todos los juegos disponibles. */
  gamesDone(right: RightArea): boolean {
    const games = right.games.filter(isPlayable);
    return games.length > 0 && games.every((g) => this.getActivityStars(right.id, g.id) > 0);
  }

  /**
   * Se abren en orden, uno a la vez: está abierto si ya se jugó o si todos los
   * anteriores de la lista ya están terminados.
   */
  private openInOrder(right: RightArea, list: readonly Activity[], id: string): boolean {
    const playable = list.filter(isPlayable);
    const i = playable.findIndex((x) => x.id === id);
    if (i < 0) return true;
    if (this.getActivityStars(right.id, id) > 0) return true;
    return playable.slice(0, i).every((x) => this.getActivityStars(right.id, x.id) > 0);
  }

  /** ¿Se puede jugar este juego? (el primero siempre; los demás al terminar el anterior). */
  gameUnlocked(right: RightArea, gameId: string): boolean {
    if (this.data.unlockAll) return true;
    return this.openInOrder(right, right.games, gameId);
  }

  /**
   * ¿Se puede jugar este desafío? Pide todos los juegos y, después, se abren uno a uno
   * (el desafío final, al terminar los otros).
   */
  challengeUnlocked(right: RightArea, challengeId: string): boolean {
    if (this.data.unlockAll) return true;
    if (!this.gamesDone(right)) return false;
    const c = right.challenges.find((x) => x.id === challengeId);
    if (c && isPlayable(c) && c.medal) {
      return right.challenges
        .filter((x) => isPlayable(x) && x.id !== challengeId)
        .every((x) => this.getActivityStars(right.id, x.id) > 0);
    }
    return this.openInOrder(right, right.challenges, challengeId);
  }

  hasRightMedal(right: RightArea): boolean {
    const final = right.challenges.find((c) => isPlayable(c) && c.medal);
    return !!final && this.getActivityStars(right.id, final.id) > 0;
  }

  get rightMedalCount(): number {
    return RIGHT_AREAS.filter((r) => this.hasRightMedal(r)).length;
  }

  /** ¿Ya ganó las medallas de todos los derechos? */
  get allMedals(): boolean {
    return this.rightMedalCount === RIGHT_AREAS.length;
  }

  // ---------- Diploma ----------

  get playerName(): string {
    return this.data.playerName;
  }

  setPlayerName(name: string): void {
    this.data.playerName = name.trim().slice(0, MAX_NAME);
    this.save();
  }

  get diplomaDate(): string | null {
    return this.data.diplomaDate;
  }

  /** Pone la fecha del diploma el día en que se completan las 8 medallas (solo una vez). */
  ensureDiplomaDate(): string | null {
    if (this.allMedals && !this.data.diplomaDate) {
      this.data.diplomaDate = today();
      this.save();
    }
    return this.data.diplomaDate;
  }

  get signature(): number[][] {
    return this.data.signature;
  }

  /** La firma solo se puede poner con las 8 medallas. */
  setSignature(strokes: number[][]): void {
    if (!this.allMedals) return;
    this.data.signature = cleanSignature(strokes);
    this.save();
  }

  /** Zonas completadas y estrellas que el mapa ya mostró la última vez. */
  get mapSeen(): Readonly<{ done: readonly string[]; stars: number }> {
    return this.data.mapSeen;
  }

  setMapSeen(done: string[], stars: number): void {
    this.data.mapSeen = { done: [...done], stars };
    this.save();
  }

  get totalRightStars(): number {
    return RIGHT_AREAS.reduce((sum, r) => sum + this.rightStars(r).stars, 0);
  }

  /** Registra el resultado de un juego o desafío. Las estrellas nunca bajan. */
  completeActivity(rightId: string, activityId: string, errors: number): ActivityResult {
    const right = RIGHT_AREAS.find((r) => r.id === rightId);
    const hadMedal = right ? this.hasRightMedal(right) : false;
    const hadGames = right ? this.gamesDone(right) : false;
    const key = activityKey(rightId, activityId);
    const stars = GameStateStore.starsFor(errors);
    const previousBest = this.data.activities[key] ?? 0;
    if (stars > previousBest) this.data.activities[key] = stars;
    this.save();
    this.ensureDiplomaDate();
    const hasChallenges = right ? right.challenges.some(isPlayable) : false;
    return {
      rightId,
      activityId,
      stars,
      previousBest,
      firstTime: previousBest === 0,
      medalEarned: !!right && !hadMedal && this.hasRightMedal(right),
      challengesUnlocked: !!right && hasChallenges && !hadGames && this.gamesDone(right),
    };
  }

  // ---------- Modo maestro ----------

  get unlockAll(): boolean {
    return this.data.unlockAll;
  }

  setUnlockAll(value: boolean): void {
    this.data.unlockAll = value;
    this.save();
  }

  /** Reinicia el progreso (solo desde el modo maestro). Conserva los ajustes de volumen. */
  resetProgress(): void {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    this.save();
  }

  // ---------- Ajustes ----------

  get settings(): Readonly<Settings> {
    return this.data.settings;
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = sanitize({
      ...this.data,
      settings: { ...this.data.settings, ...patch },
    }).settings;
    this.save();
    this.emit(STATE_EVENTS.SETTINGS, this.data.settings);
  }

  // ---------- Persistencia ----------

  private load(): SaveData {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : defaults();
    } catch {
      return defaults();
    }
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Sin almacenamiento disponible: el progreso se mantiene en memoria esta sesión.
    }
    this.emit(STATE_EVENTS.CHANGE);
  }
}

export const GameState = new GameStateStore();
export const starsFor = GameStateStore.starsFor;
