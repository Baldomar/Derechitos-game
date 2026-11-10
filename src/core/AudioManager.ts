import Phaser from 'phaser';
import type { VoiceLine } from '@/config/levels';
import { GameState, STATE_EVENTS } from './GameState';

/**
 * Audio del juego con Web Audio API:
 *   master ─┬─ música → ducking (baja cuando Tori habla)
 *           ├─ efectos
 *           └─ voz
 *
 * Archivos opcionales (se detectan solos al hacer build, sin listas que mantener):
 *   src/assets/audio/voice/<id>.mp3   → voz grabada (p. ej. level01_intro.mp3)
 *   src/assets/audio/sfx/<nombre>.mp3 → pop, success, hint, star, medal, fanfare
 *   src/assets/audio/music/theme.mp3  → música de fondo en bucle
 * Si un archivo no existe: los efectos y la música se sintetizan, y la voz usa
 * la Web Speech API en español (es-MX / es-US) con tono un poco agudo.
 *
 * El audio arranca solo tras la primera interacción (política de los navegadores).
 */

export type SfxName = 'pop' | 'success' | 'hint' | 'star' | 'medal' | 'fanfare';

export const AUDIO_EVENTS = {
  VOICE_START: 'voice-start',
  VOICE_END: 'voice-end',
  UNLOCKED: 'unlocked',
} as const;

type UrlLoader = () => Promise<string>;

const voiceGlob = import.meta.glob<string>('../assets/audio/voice/*.{mp3,ogg,m4a}', {
  query: '?url',
  import: 'default',
});
const sfxGlob = import.meta.glob<string>('../assets/audio/sfx/*.{mp3,ogg,m4a}', {
  query: '?url',
  import: 'default',
});
const musicGlob = import.meta.glob<string>('../assets/audio/music/*.{mp3,ogg,m4a}', {
  query: '?url',
  import: 'default',
});

function canPlayOgg(): boolean {
  try {
    return new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '';
  } catch {
    return false;
  }
}

/** Indexa archivos por nombre; si hay OGG y MP3 del mismo audio, elige el que el navegador soporte. */
function indexByName(glob: Record<string, UrlLoader>): Map<string, UrlLoader> {
  const preferOgg = canPlayOgg();
  const found = new Map<string, { loader: UrlLoader; ext: string }>();
  for (const [path, loader] of Object.entries(glob)) {
    const file = path.split('/').pop() ?? '';
    const dot = file.lastIndexOf('.');
    const name = file.slice(0, dot);
    const ext = file.slice(dot + 1).toLowerCase();
    if (ext === 'ogg' && !preferOgg) continue;
    const prev = found.get(name);
    if (!prev || (preferOgg && ext === 'ogg')) found.set(name, { loader, ext });
  }
  return new Map([...found].map(([name, v]) => [name, v.loader]));
}

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
/** Duración aproximada de una frase leída en voz alta. */
const estimateMs = (text: string): number => 600 + text.length * 65;

// Música sintetizada: arpegio tipo marimba, progresión C – Am – F – G a 96 bpm.
const BPM = 96;
const EIGHTH = 60 / BPM / 2;
const BARS: number[][] = [
  [60, 64, 67, 72, 67, 64, 67, 64],
  [57, 60, 64, 69, 64, 60, 64, 60],
  [53, 57, 60, 65, 60, 57, 60, 57],
  [55, 59, 62, 67, 62, 59, 62, 59],
];
const BASS = [48, 45, 41, 43];

interface ToneOptions {
  freq: number;
  to?: number;
  start: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  out: AudioNode;
}

class AudioManagerImpl extends Phaser.Events.EventEmitter {
  private ctx: AudioContext | null = null;
  private gestured = false;
  private initialized = false;
  private musicBus!: GainNode;
  private duckBus!: GainNode;
  private sfxBus!: GainNode;
  private voiceBus!: GainNode;

  private readonly voiceFiles = indexByName(voiceGlob);
  private readonly sfxFiles = indexByName(sfxGlob);
  private readonly musicFiles = indexByName(musicGlob);
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();

  private voiceSource: AudioBufferSourceNode | null = null;
  private speakToken = 0;
  private ttsVoice: SpeechSynthesisVoice | null = null;

  private musicWanted = false;
  private musicRunning = false;
  private musicTimer: number | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private nextNoteTime = 0;
  private step = 0;

  /** Se llama una vez al arrancar: escucha la primera interacción y la visibilidad. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    // En pantallas táctiles el navegador solo considera "gesto válido" al levantar el dedo
    // (pointerup / touchend); Phaser además bloquea "click". Por eso se escuchan varios eventos
    // y se reintenta en cada uno hasta que el audio quede activo.
    const events = [
      'pointerdown',
      'pointerup',
      'mousedown',
      'touchend',
      'click',
      'keydown',
    ] as const;
    for (const ev of events) {
      window.addEventListener(ev, (e) => this.unlock(e), { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => this.onVisibility());
    GameState.on(STATE_EVENTS.SETTINGS, () => this.applySettings());
    if ('speechSynthesis' in window) {
      this.loadTtsVoice();
      window.speechSynthesis.addEventListener('voiceschanged', () => this.loadTtsVoice());
    }
  }

  /** true si existe una grabación para esa línea. */
  hasRecording(id: string): boolean {
    return this.voiceFiles.has(id);
  }

  // ---------------------------------------------------------------- Desbloqueo

  private unlock(e: Event): void {
    // pointerdown con el dedo NO activa el audio en móviles; con mouse sí.
    const isActivation = !(
      e instanceof PointerEvent &&
      e.type === 'pointerdown' &&
      e.pointerType !== 'mouse'
    );
    if (isActivation) {
      this.gestured = true;
      this.primeTts();
    }
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.buildGraph(this.ctx);
      this.applySettings();
    }
    const ctx = this.ctx;
    if (ctx.state !== 'running' && document.visibilityState === 'visible') {
      // iOS: reproducir un sonido vacío dentro del gesto "despierta" el audio.
      try {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        // sin efecto
      }
      ctx
        .resume()
        .then(() => {
          this.emit(AUDIO_EVENTS.UNLOCKED);
          this.maybeStartMusic();
        })
        .catch(() => undefined);
    } else {
      this.maybeStartMusic();
    }
  }

  /** iOS/Safari solo permite la voz si la primera frase se pide dentro de un toque. */
  private ttsPrimed = false;
  private primeTts(): void {
    if (this.ttsPrimed || !('speechSynthesis' in window)) return;
    this.ttsPrimed = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      // sin voz disponible
    }
  }

  /** Diagnóstico para el modo maestro. */
  status(): {
    audio: string;
    tts: boolean;
    spanishVoice: string | null;
    voices: number;
    recordings: number;
  } {
    const tts = 'speechSynthesis' in window;
    return {
      audio: this.ctx ? this.ctx.state : 'sin activar (toca la pantalla)',
      tts,
      spanishVoice: this.ttsVoice ? `${this.ttsVoice.name} (${this.ttsVoice.lang})` : null,
      voices: tts ? window.speechSynthesis.getVoices().length : 0,
      recordings: this.voiceFiles.size,
    };
  }

  private buildGraph(ctx: AudioContext): void {
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    const master = ctx.createGain();
    master.connect(compressor);
    this.musicBus = ctx.createGain();
    this.duckBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.musicBus.connect(this.duckBus).connect(master);
    this.sfxBus.connect(master);
    this.voiceBus.connect(master);
  }

  private applySettings(): void {
    const s = GameState.settings;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.musicBus.gain.setTargetAtTime(s.musicMuted ? 0 : s.music, now, 0.05);
      this.sfxBus.gain.setTargetAtTime(s.sfxMuted ? 0 : s.sfx, now, 0.05);
      this.voiceBus.gain.setTargetAtTime(s.voiceMuted ? 0 : s.voice, now, 0.05);
    }
    if (s.musicMuted || s.music === 0) this.stopMusicInternal();
    else this.maybeStartMusic();
    if (s.voiceMuted) this.stopVoice();
  }

  private onVisibility(): void {
    if (!this.ctx) return;
    if (document.visibilityState === 'hidden') {
      this.stopVoice();
      void this.ctx.suspend().catch(() => undefined);
    } else {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  private setDuck(on: boolean): void {
    if (!this.ctx) return;
    this.duckBus.gain.setTargetAtTime(on ? 0.3 : 1, this.ctx.currentTime, on ? 0.08 : 0.4);
  }

  // ---------------------------------------------------------------- Buffers

  private getBuffer(key: string, loader: UrlLoader): Promise<AudioBuffer | null> {
    let p = this.buffers.get(key);
    if (!p) {
      p = loader()
        .then((url) => fetch(url))
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((data) => (this.ctx ? this.ctx.decodeAudioData(data) : null))
        .catch(() => null)
        .then((buf) => {
          if (!buf) this.buffers.delete(key); // se reintenta más tarde (p. ej. sin conexión)
          return buf;
        });
      this.buffers.set(key, p);
    }
    return p;
  }

  /** Descarga y decodifica por adelantado las voces grabadas de unas líneas. */
  preloadVoices(lines: VoiceLine[]): void {
    if (!this.ctx) return;
    for (const line of lines) {
      const loader = this.voiceFiles.get(line.id);
      if (loader) void this.getBuffer(`voice:${line.id}`, loader);
    }
  }

  // ---------------------------------------------------------------- Efectos

  sfx(name: SfxName, opts: { pitch?: number; index?: number } = {}): void {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const s = GameState.settings;
    if (s.sfxMuted || s.sfx === 0) return;
    const file = this.sfxFiles.get(name);
    if (file) {
      void this.getBuffer(`sfx:${name}`, file).then((buf) => {
        if (!buf || !this.ctx) return;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = opts.pitch ?? 1;
        src.connect(this.sfxBus);
        src.start();
      });
      return;
    }
    this.synthSfx(name, opts.pitch ?? 1, opts.index ?? 0);
  }

  private tone(o: ToneOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, o.start);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, o.start + o.dur * 0.6);
    g.gain.setValueAtTime(0.0001, o.start);
    g.gain.exponentialRampToValueAtTime(o.gain, o.start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
    osc.connect(g).connect(o.out);
    osc.start(o.start);
    osc.stop(o.start + o.dur + 0.03);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private synthSfx(name: SfxName, pitch: number, index: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const out = this.sfxBus;
    const note = (
      m: number,
      at: number,
      dur: number,
      gain: number,
      type: OscillatorType = 'triangle',
    ): void => this.tone({ freq: hz(m), start: t + at, dur, type, gain, out });

    switch (name) {
      case 'pop':
        this.tone({
          freq: 480 * pitch,
          to: 900 * pitch,
          start: t,
          dur: 0.09,
          type: 'sine',
          gain: 0.4,
          out,
        });
        break;
      case 'success':
        [72, 76, 79, 84].forEach((m, i) => note(m, i * 0.07, 0.28, 0.26));
        note(96, 0.28, 0.3, 0.1, 'sine');
        break;
      case 'hint':
        // Pista suave: dos notas suaves hacia arriba (curiosidad, nunca "error").
        note(64, 0, 0.26, 0.2, 'sine');
        note(67, 0.16, 0.3, 0.2, 'sine');
        break;
      case 'star': {
        const m = 76 + index * 4; // sonido ascendente por estrella
        note(m, 0, 0.4, 0.26);
        note(m + 12, 0.02, 0.3, 0.1, 'sine');
        break;
      }
      case 'medal':
        [72, 76, 79, 84].forEach((m, i) => note(m, i * 0.03, 0.9, 0.14));
        [88, 91, 96].forEach((m, i) => note(m, 0.2 + i * 0.08, 0.5, 0.09, 'sine'));
        break;
      case 'fanfare': {
        const melody: [number, number, number][] = [
          [67, 0, 0.14],
          [72, 0.15, 0.14],
          [76, 0.3, 0.14],
          [79, 0.45, 0.3],
          [76, 0.78, 0.12],
          [79, 0.92, 0.8],
        ];
        melody.forEach(([m, at, dur]) => note(m, at, dur, 0.24));
        [72, 76, 84].forEach((m) => note(m, 0.92, 1, 0.1));
        break;
      }
    }
  }

  // ---------------------------------------------------------------- Música

  playMusic(): void {
    this.musicWanted = true;
    this.maybeStartMusic();
  }

  stopMusic(): void {
    this.musicWanted = false;
    this.stopMusicInternal();
  }

  private maybeStartMusic(): void {
    const ctx = this.ctx;
    if (!this.musicWanted || this.musicRunning || !ctx || ctx.state !== 'running') return;
    const s = GameState.settings;
    if (s.musicMuted || s.music === 0) return;
    this.musicRunning = true;

    const file = this.musicFiles.get('theme') ?? this.musicFiles.values().next().value;
    if (!file) {
      this.startSynthMusic();
      return;
    }
    void this.getBuffer('music:theme', file).then((buf) => {
      if (!this.musicRunning || !this.ctx) return;
      if (!buf) {
        this.startSynthMusic();
        return;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.musicBus);
      src.start();
      this.musicSource = src;
    });
  }

  private startSynthMusic(): void {
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
  }

  /** Planificador con anticipación: agenda notas ~0.3 s por delante del reloj de audio. */
  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.nextNoteTime < ctx.currentTime - 0.2) this.nextNoteTime = ctx.currentTime + 0.05;
    while (this.nextNoteTime < ctx.currentTime + 0.3) {
      const bar = Math.floor(this.step / 8);
      const i = this.step % 8;
      const midi = BARS[bar]?.[i];
      if (midi !== undefined) this.marimba(hz(midi), this.nextNoteTime, i === 0 ? 0.18 : 0.11);
      const bass = BASS[bar];
      if ((i === 0 || i === 4) && bass !== undefined) {
        this.tone({
          freq: hz(bass),
          start: this.nextNoteTime,
          dur: 0.8,
          type: 'sine',
          gain: 0.16,
          out: this.musicBus,
        });
      }
      this.nextNoteTime += EIGHTH;
      this.step = (this.step + 1) % 32;
    }
  }

  private marimba(freq: number, start: number, gain: number): void {
    this.tone({ freq, start, dur: 0.55, type: 'sine', gain, out: this.musicBus });
    this.tone({
      freq: freq * 4,
      start,
      dur: 0.12,
      type: 'sine',
      gain: gain * 0.18,
      out: this.musicBus,
    });
  }

  private stopMusicInternal(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // ya estaba detenida
      }
      this.musicSource = null;
    }
    this.musicRunning = false;
  }

  // ---------------------------------------------------------------- Voz de Tori

  private loadTtsVoice(): void {
    const voices = window.speechSynthesis.getVoices();
    const norm = (v: SpeechSynthesisVoice): string => v.lang.toLowerCase().replace('_', '-');
    const spanish = voices.filter((v) => norm(v).startsWith('es'));
    // Voces claras/agudas que le quedan mejor a Tori (Google, o voces femeninas de Windows/Apple).
    const friendly = /google|sabina|paulina|dalia|helena|laura|monica|mónica|female|mujer/i;
    const regions = ['es-mx', 'es-us', 'es-419'];
    const byRegion = (re: RegExp | null): SpeechSynthesisVoice | undefined => {
      for (const r of regions) {
        const v = spanish.find((x) => norm(x) === r && (re ? re.test(x.name) : true));
        if (v) return v;
      }
      return undefined;
    };
    this.ttsVoice =
      byRegion(friendly) ??
      spanish.find((v) => friendly.test(v.name)) ??
      byRegion(null) ??
      spanish[0] ??
      null;
  }

  /**
   * Tori dice una línea. Usa la grabación si existe; si no, voz sintética.
   * Siempre resuelve (al terminar, al ser interrumpida o por tiempo límite).
   * Con la voz silenciada espera el tiempo de lectura para que el ritmo sea igual.
   */
  async speak(line: VoiceLine): Promise<void> {
    this.stopVoice();
    const token = this.speakToken;
    const s = GameState.settings;
    if (s.voiceMuted || s.voice === 0 || !this.gestured) {
      await wait(Math.min(estimateMs(line.text), 3500));
      return;
    }
    this.emit(AUDIO_EVENTS.VOICE_START, line);
    this.setDuck(true);
    try {
      const played = await this.playRecorded(line.id, token);
      if (!played && token === this.speakToken) await this.speakTts(line.text);
    } finally {
      if (token === this.speakToken) {
        this.setDuck(false);
        this.emit(AUDIO_EVENTS.VOICE_END, line);
      }
    }
  }

  private async playRecorded(id: string, token: number): Promise<boolean> {
    const loader = this.voiceFiles.get(id);
    if (!loader || !this.ctx) return false;
    const buffer = await this.getBuffer(`voice:${id}`, loader);
    if (!buffer) return false;
    if (token !== this.speakToken || !this.ctx) return true; // interrumpida mientras cargaba
    const ctx = this.ctx;
    return new Promise<boolean>((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.voiceBus);
      src.onended = () => {
        if (this.voiceSource === src) this.voiceSource = null;
        src.disconnect();
        resolve(true);
      };
      this.voiceSource = src;
      src.start();
    });
  }

  private speakTts(text: string): Promise<void> {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      return wait(estimateMs(text));
    }
    return new Promise<void>((resolve) => {
      let finished = false;
      let timer = 0;
      const finish = (): void => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        resolve();
      };
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.ttsVoice?.lang ?? 'es-MX';
      if (this.ttsVoice) u.voice = this.ttsVoice;
      u.pitch = 1.4; // un poco aguda: voz de pajarito
      u.rate = 0.95; // pausada para 5–7 años
      u.volume = GameState.settings.voice;
      u.onend = finish;
      u.onerror = finish;
      // Red de seguridad: algunos navegadores no disparan "end".
      timer = window.setTimeout(finish, estimateMs(text) * 1.6 + 2500);
      window.speechSynthesis.speak(u);
    });
  }

  /** Corta la voz actual (al cambiar de escena, repetir o silenciar). */
  stopVoice(): void {
    this.speakToken += 1;
    if (this.voiceSource) {
      try {
        this.voiceSource.stop();
      } catch {
        // ya terminó
      }
      this.voiceSource = null;
    }
    if ('speechSynthesis' in window) {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) synth.cancel();
    }
    this.setDuck(false);
    this.emit(AUDIO_EVENTS.VOICE_END);
  }
}

export const AudioManager = new AudioManagerImpl();
