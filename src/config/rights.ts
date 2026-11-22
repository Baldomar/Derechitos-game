import type { ArtKey } from '@/art/Art';
import type { LevelSceneKey, VoiceLine } from './levels';
import { COLORS } from './theme';
import type { LazySceneKey } from '@/core/SceneRegistry';

/**
 * "Villa de los Derechos": cada derecho tiene explicación, JUEGOS y DESAFÍOS (data-driven).
 * Los minijuegos usan motores reutilizables (escenas genéricas). Regla de variedad: cada
 * motor aparece como mucho en 2 derechos, y nunca dos veces en el mismo derecho.
 *   sort      → arrastrar cada cosa a su grupo (p. ej. carita feliz / triste)
 *   sequence  → ordenar pasos en su número (1, 2, 3…)
 *   memory    → memorama de parejas iguales
 *   choice    → elegir la(s) respuesta(s) correcta(s) en una o varias preguntas
 *   catch     → atrapar lo que cae del cielo con la mochila/lonchera (y esquivar lo que no va)
 *   pop       → reventar las burbujas que responden a la pregunta
 *   place     → arrastrar cada cosa a su sombra para armar un lugar (cuarto, salón, parque…)
 *   give      → llevarle a cada amigo lo que necesita (aparece en su globito)
 *   vote      → votar, ver votar a los amigos y contar las boletas (gana la mayoría)
 *   scrub     → frotar con la esponja hasta quitar los microbios o el lodo
 *   runner    → carrera: tocar para saltar, juntar lo bueno y saltar lo malo
 *   dots      → une los puntos en orden para descubrir un dibujo
 *   hidden    → busca y encuentra cosas escondidas en un lugar
 *   maze      → laberinto de casillas evitando los peligros
 *   thumbs    → ¿está bien o no está bien? (carita feliz / triste)
 *   fish      → pescar desde un bote lo que responde a la pregunta
 *   match     → unir con una cuerda cada cosa con su pareja
 *   stack     → construir soltando piezas desde una grúa
 *   simon     → repetir la secuencia de luces y sonidos
 *   share     → repartir igual entre los amigos
 *   board     → juego de mesa con dado y preguntas en las estrellas
 * Para dejar un apartado como "próximamente", usa { kind: 'soon', id, title, icon }.
 */

const v = (id: string, text: string): VoiceLine => ({ id, text });

export type RightAreaId =
  'salud' | 'educacion' | 'vida' | 'alimentacion' | 'vivienda' | 'igualdad' | 'jugar' | 'opinion';

interface ActivityBase {
  id: string;
  title: string;
  icon: ArtKey;
  intro: VoiceLine[];
  done: VoiceLine;
  /** Al completarla se gana la medalla del derecho (desafío final). */
  medal?: boolean;
}

export interface SortActivity extends ActivityBase {
  kind: 'sort';
  /**
   * Cómo se dibujan los destinos: recuadros (por defecto), platos de comida o tarjetas con
   * sombras (cada cosa tiene su silueta en la tarjeta; se toca un dibujo y luego su tarjeta).
   */
  look?: 'box' | 'plate' | 'cards';
  /** `note`: frase corta bajo el nombre (solo en el modo tarjetas). */
  bins: { id: string; art: ArtKey; label: string; note?: string }[];
  items: { id: string; art: ArtKey; label: string; bin: string; hint: VoiceLine }[];
}

export interface SequenceActivity extends ActivityBase {
  kind: 'sequence';
  /** Cada tarjeta muestra su número (ayuda para los más pequeños). */
  numbered?: boolean;
  /** En el orden correcto. */
  steps: { id: string; art: ArtKey; label: string; hint: VoiceLine }[];
}

export interface MemoryActivity extends ActivityBase {
  kind: 'memory';
  items: { id: string; art: ArtKey; label: string }[];
  freeMismatches: number;
  mismatchesPerError: number;
  tryAgain: VoiceLine;
}

export interface ChoiceOption {
  id: string;
  art: ArtKey;
  label: string;
  correct: boolean;
  hint?: VoiceLine;
}

export interface ChoiceActivity extends ActivityBase {
  kind: 'choice';
  /** Personaje que acompaña la pregunta (p. ej. Mateo enfermo). */
  character?: ArtKey;
  rounds: { question: VoiceLine; options: ChoiceOption[] }[];
}

/** Algo que aparece en un juego: dibujo + nombre (+ pista si no es lo que buscamos). */
export interface GameThing {
  art: ArtKey;
  label: string;
  hint?: VoiceLine;
}

/** Atrapa: las cosas caen del cielo y se atrapan moviendo la canasta/mochila. */
export interface CatchActivity extends ActivityBase {
  kind: 'catch';
  /** Lo que el niño mueve para atrapar (mochila, lonchera…). */
  catcher: ArtKey;
  /** Cuántas cosas buenas hay que atrapar. */
  goal: number;
  good: GameThing[];
  /** Lo que NO va: si lo atrapa, rebota y Tori explica por qué (la pista es obligatoria). */
  bad: (GameThing & { hint: VoiceLine })[];
}

/** Burbujas: suben burbujas con dibujos; se revientan las que responden a la pregunta. */
export interface PopActivity extends ActivityBase {
  kind: 'pop';
  rounds: {
    question: VoiceLine;
    /** Consejo que Tori da (y se muestra) al reventar la primera burbuja correcta de la ronda. */
    tip?: VoiceLine;
    goal: number;
    good: GameThing[];
    bad: (GameThing & { hint: VoiceLine })[];
  }[];
}

/** Arma la escena: cada cosa se arrastra a su sombra dentro de un lugar dibujado. */
export interface PlaceActivity extends ActivityBase {
  kind: 'place';
  /** Lugar que se dibuja de fondo. */
  theme: 'room' | 'classroom' | 'storm' | 'park' | 'shelf';
  /** Si es true, cualquier cosa va en cualquier sombra libre (p. ej. poner a salvo a los amigos). */
  anySpot?: boolean;
  /** Posición (coordenadas de juego) y tamaño de cada cosa ya acomodada. */
  items: (GameThing & { id: string; x: number; y: number; size: number })[];
}

/** ¿Qué necesita? Cada amigo piensa en algo (su sombra) y se lo llevamos. */
export interface GiveActivity extends ActivityBase {
  kind: 'give';
  friends: {
    id: string;
    art: ArtKey;
    label: string;
    /** Lo que necesita (aparece como sombra en su globito). */
    wants: GameThing;
    /** Pista si le llevan algo que no necesita. */
    hint: VoiceLine;
  }[];
  /** Cosas de más que nadie necesita (con su pista). */
  extras: (GameThing & { hint: VoiceLine })[];
}

/** Votación: el niño elige, los amigos votan, se cuentan las boletas y gana la mayoría. */
export interface VoteActivity extends ActivityBase {
  kind: 'vote';
  rounds: {
    question: VoiceLine;
    options: [GameThing & { id: string }, GameThing & { id: string }];
    /** Voto de cada amigo (0 = primera opción, 1 = segunda). 4 amigos + el niño = sin empates. */
    friendVotes: [0 | 1, 0 | 1, 0 | 1, 0 | 1];
  }[];
}

/** Cosa "mala" de un juego: siempre trae su pista amable. */
export type BadThing = GameThing & { hint: VoiceLine };

/** Ronda con pregunta: lo que sí responde (good) y lo que no (bad). */
export interface QuestionRound {
  question: VoiceLine;
  goal: number;
  good: GameThing[];
  bad: BadThing[];
}

/** Limpia: se frota (arrastrando la esponja) sobre la mugre o los microbios hasta que brilla. */
export interface ScrubActivity extends ActivityBase {
  kind: 'scrub';
  tool: ArtKey;
  dirt: 'germs' | 'mud';
  /** Cada ronda es una cosa que limpiar; `line` se dice cuando queda limpia. */
  rounds: { art: ArtKey; label: string; line: VoiceLine }[];
}

/** Carrera: el niño corre solo; se toca para saltar, se juntan las cosas buenas y se saltan las malas. */
export interface RunnerActivity extends ActivityBase {
  kind: 'runner';
  runner: ArtKey;
  goal: number;
  /** Cosas buenas (unas en el piso y otras en el aire, para saltar a tomarlas). */
  good: GameThing[];
  /** Cosas en el piso que hay que saltar. */
  bad: BadThing[];
}

/** Une los puntos: tocar los números en orden para descubrir un dibujo. */
export interface DotsActivity extends ActivityBase {
  kind: 'dots';
  rounds: {
    art: ArtKey;
    label: string;
    /**
     * Puntos del contorno EN PÍXELES DEL DIBUJO (`art`), en orden. Siguen la silueta real:
     * al unirlos, el dibujo aparece justo encima de las líneas.
     */
    points: [number, number][];
    line: VoiceLine;
  }[];
}

/** Busca y encuentra: cosas escondidas en un lugar dibujado. */
export interface HiddenActivity extends ActivityBase {
  kind: 'hidden';
  theme: 'classroom' | 'house';
  find: (GameThing & { x: number; y: number; size: number; angle?: number })[];
  /** Cosas que no buscamos (al tocarlas Tori explica). */
  decoys: (BadThing & { x: number; y: number; size: number; angle?: number })[];
}

/** Laberinto de casillas: se toca la casilla de al lado para avanzar hasta la meta. */
export interface MazeActivity extends ActivityBase {
  kind: 'maze';
  walker: ArtKey;
  goal: GameThing;
  /**
   * Mapa por filas: '#' arbusto, '.' camino, 'S' inicio, 'G' meta,
   * minúscula = peligro (ver `dangers`), MAYÚSCULA = camino decorado (ver `props`).
   */
  grid: string[];
  dangers: Record<string, BadThing>;
  props?: Record<string, GameThing>;
  /**
   * 'board' = tablero ilustrado con panel de flechas y contador de pasos. En ese modo, además:
   * ':' camino alto (crema, con muro de ladrillos debajo) y dígitos = pasto con adorno
   * (1 arbusto, 2 flores, 3 piedra, 4 árbol, 5 banca, 6 letrero de la meta con amigos).
   */
  look?: 'board';
  /** Tarjeta del paso 1 (qué sí y qué no se puede). */
  legend?: { title: string; items: { art: ArtKey; label: string; note: string; ok: boolean }[] };
  /** Meta: 'gate' = arco del parque con estrella; si no, el dibujo de `goal` (p. ej. la casa). */
  goalLook?: 'gate';
  /** Etiqueta de la casilla de salida y del paso 2. */
  startLabel?: string;
  moveLabel?: string;
}

/** ¿Está bien o no está bien? Una tarjeta a la vez; se toca la carita feliz o la triste. */
export interface ThumbsActivity extends ActivityBase {
  kind: 'thumbs';
  cards: { art: ArtKey; label: string; good: boolean; say: VoiceLine; hint: VoiceLine }[];
}

/** Pesca: las cosas nadan en el agua; se baja el anzuelo para pescar las que responden. */
export interface FishActivity extends ActivityBase {
  kind: 'fish';
  rounds: QuestionRound[];
}

/** Une con una línea cada cosa de la izquierda con su pareja de la derecha. */
export interface MatchActivity extends ActivityBase {
  kind: 'match';
  pairs: { id: string; left: GameThing; right: GameThing; hint: VoiceLine }[];
}

/** Construye: una grúa mueve cada pieza; se toca para soltarla justo encima de la torre. */
export interface StackActivity extends ActivityBase {
  kind: 'stack';
  /** De abajo hacia arriba. `say` se escucha cuando la pieza queda puesta. */
  pieces: { art: ArtKey; label: string; width: number; say: VoiceLine }[];
}

/** Repite la secuencia: los botones se iluminan y suenan; el niño los repite en orden. */
export interface SimonActivity extends ActivityBase {
  kind: 'simon';
  /** 3 o 4 botones. `talk` = los botones son amigos que "hablan". */
  pads: GameThing[];
  talk?: boolean;
  /** Largo de cada ronda (p. ej. [2, 3, 4]). */
  lengths: number[];
  watch: VoiceLine;
  yourTurn: VoiceLine;
  retry: VoiceLine;
}

/** Reparte igual: cada cosa se arrastra a un amigo; nadie puede tener más que los demás. */
export interface ShareActivity extends ActivityBase {
  kind: 'share';
  /** 'plate' (por defecto): mantel y platos, para comida. 'table': mesa de madera con individuales. */
  look?: 'plate' | 'table';
  friends: { art: ArtKey; label: string }[];
  rounds: { item: GameThing; count: number; question: VoiceLine }[];
  unfair: VoiceLine;
}

/** Juego de mesa: se tira el dado, se avanza y en cada estrella hay una pregunta. */
export interface BoardActivity extends ActivityBase {
  kind: 'board';
  rounds: { question: VoiceLine; options: ChoiceOption[] }[];
}

/**
 * "¡Cruzo seguro!": tres niveles distintos en la misma calle.
 * 1) El semáforo: dar la mano a un adulto y cruzar en verde.
 * 2) Mira a los dos lados: sin semáforo, mirar a la izquierda y a la derecha antes de cruzar.
 * 3) La pelota: si la pelota se va a la calle, pedir ayuda a un adulto (nunca correr).
 */
export interface CrossActivity extends ActivityBase {
  kind: 'cross';
  /** Adulto y niño (muñecos articulados). */
  adult: ArtKey;
  kid: ArtKey;
  light: {
    title: string;
    explain: VoiceLine;
    holdDone: VoiceLine;
    wait: VoiceLine;
    green: VoiceLine;
    tooSoon: VoiceLine;
    done: VoiceLine;
  };
  look: {
    title: string;
    explain: VoiceLine;
    car: VoiceLine;
    clear: VoiceLine;
    notYet: VoiceLine;
    ready: VoiceLine;
    done: VoiceLine;
  };
  ball: {
    title: string;
    explain: VoiceLine;
    rolled: VoiceLine;
    runLabel: string;
    askLabel: string;
    wrong: VoiceLine;
    right: VoiceLine;
    done: VoiceLine;
  };
}

/**
 * "La ronda de ideas": tres niveles distintos en el salón de clases.
 * 1) Levanta la mano: dar la palabra (el micrófono) al amigo que levanta la mano.
 * 2) Escucho sin interrumpir: tocar a quien grita para que espere su turno.
 * 3) Mi turno de hablar: escoger cómo decir lo que pienso, con confianza y respeto.
 */
export interface TalkActivity extends ActivityBase {
  kind: 'talk';
  /** Cuatro amigos (muñecos articulados); el primero eres tú en el nivel 3. */
  kids: ArtKey[];
  hands: {
    title: string;
    board: string;
    explain: VoiceLine;
    notRaised: VoiceLine;
    /** Una idea por amigo, en el mismo orden que `kids`. */
    ideas: { art: ArtKey; line: VoiceLine }[];
    done: VoiceLine;
  };
  listen: {
    title: string;
    board: string;
    explain: VoiceLine;
    /** Lo que grita quien interrumpe. */
    shout: string;
    calm: VoiceLine;
    missed: VoiceLine;
    notThat: VoiceLine;
    speech: VoiceLine;
    done: VoiceLine;
  };
  speak: {
    title: string;
    board: string;
    explain: VoiceLine;
    rounds: {
      question: VoiceLine;
      right: VoiceLine;
      options: { art: ArtKey; label: string; good: boolean; hint?: VoiceLine }[];
    }[];
    done: VoiceLine;
  };
}

/** Juego completo con escena propia (los antiguos niveles de la isla: casa, lonchera, clínica…). */
export interface LevelActivity {
  kind: 'level';
  id: string;
  title: string;
  icon: ArtKey;
  sceneKey: LevelSceneKey;
  /** Al completarla se gana la medalla del derecho. */
  medal?: boolean;
}

export interface SoonActivity {
  kind: 'soon';
  id: string;
  title: string;
  icon: ArtKey;
}

export type EngineActivity =
  | SortActivity
  | SequenceActivity
  | MemoryActivity
  | ChoiceActivity
  | CatchActivity
  | PopActivity
  | PlaceActivity
  | GiveActivity
  | VoteActivity
  | ScrubActivity
  | RunnerActivity
  | DotsActivity
  | HiddenActivity
  | MazeActivity
  | ThumbsActivity
  | FishActivity
  | MatchActivity
  | StackActivity
  | SimonActivity
  | ShareActivity
  | BoardActivity
  | CrossActivity
  | TalkActivity;
export type PlayableActivity = EngineActivity | LevelActivity;
export type Activity = PlayableActivity | SoonActivity;

export interface RightArea {
  id: RightAreaId;
  name: string;
  /** Nombre corto para la casita del mapa. */
  short: string;
  color: number;
  icon: ArtKey;
  /** Derecho principal (destacado en el mapa). */
  featured?: boolean;
  /** Frase que se escucha al tocar la casita. */
  phrase: VoiceLine;
  /** Explicación corta animada al entrar (2–3 frases). */
  explanation: VoiceLine[];
  medal: { name: string; won: VoiceLine };
  games: Activity[];
  challenges: Activity[];
}

/** Escena que juega una actividad (motor genérico o nivel con escena propia). */
export function activityScene(a: PlayableActivity): LazySceneKey {
  return a.kind === 'level' ? a.sceneKey : ACTIVITY_SCENE[a.kind];
}

/** Derecho y actividad a los que pertenece un nivel de la isla. */
export function findLevelActivity(
  sceneKey: LevelSceneKey,
): { right: RightArea; activity: LevelActivity } | null {
  for (const right of RIGHT_AREAS) {
    for (const a of [...right.games, ...right.challenges]) {
      if (a.kind === 'level' && a.sceneKey === sceneKey) return { right, activity: a };
    }
  }
  return null;
}

/** Escena que juega cada tipo de actividad. */
export const ACTIVITY_SCENE = {
  sort: 'SortGame',
  sequence: 'SequenceGame',
  memory: 'MemoryGame',
  choice: 'ChoiceGame',
  catch: 'CatchGame',
  pop: 'PopGame',
  place: 'PlaceGame',
  give: 'GiveGame',
  vote: 'VoteGame',
  scrub: 'ScrubGame',
  runner: 'RunnerGame',
  dots: 'DotsGame',
  hidden: 'HiddenGame',
  maze: 'MazeGame',
  thumbs: 'ThumbsGame',
  fish: 'FishGame',
  match: 'MatchGame',
  stack: 'StackGame',
  simon: 'SimonGame',
  share: 'ShareGame',
  board: 'BoardGame',
  cross: 'CrossGame',
  talk: 'TalkGame',
} as const;

const level = (
  id: string,
  title: string,
  icon: ArtKey,
  sceneKey: LevelSceneKey,
): LevelActivity => ({
  kind: 'level',
  id,
  title,
  icon,
  sceneKey,
});

const SANO = { id: 'sano', art: 'cara-feliz' as ArtKey, label: 'Sano' };
const NO_SANO = { id: 'nosano', art: 'cara-triste' as ArtKey, label: 'No sano' };

export const RIGHT_AREAS: readonly RightArea[] = [
  // ============================================================ SALUD (completo)
  {
    id: 'salud',
    name: 'Derecho a la salud',
    short: 'Salud',
    color: COLORS.turquoise,
    icon: 'icon-salud',
    featured: true,
    phrase: v('der_salud_frase', 'Tengo derecho a recibir atención médica y cuidados.'),
    explanation: [
      v(
        'der_salud_exp1',
        'Todas las niñas y niños tienen derecho a recibir atención médica y cuidados.',
      ),
      v('der_salud_exp2', 'Cuando nos enfermamos, merecemos que un doctor nos cuide.'),
      v('der_salud_exp3', '¡Vamos a aprender hábitos para crecer fuertes y sanos!'),
    ],
    medal: {
      name: 'Guardián de la Salud',
      won: v('der_salud_medalla', '¡Ganaste la medalla del Derecho a la salud!'),
    },
    games: [
      {
        kind: 'sort',
        id: 'sano-no-sano',
        title: '¿Sano o no sano?',
        icon: 'cara-feliz',
        look: 'cards',
        intro: [
          v('salud_sort_intro', 'Hay cosas que cuidan tu cuerpo y otras que no.'),
          v(
            'salud_sort_pasos',
            'Paso 1: toca un dibujo. Paso 2: llévalo a la caja donde está su sombra.',
          ),
        ],
        done: v('salud_sort_done', '¡Muy bien! Ya sabes qué nos ayuda a estar sanos.'),
        bins: [
          { ...SANO, art: 'corazon-sano', note: 'Cuida tu cuerpo' },
          { ...NO_SANO, art: 'corazon-enfermo', note: 'No cuida tu cuerpo' },
        ],
        items: [
          {
            id: 'fruta',
            art: 'mango',
            label: 'Fruta',
            bin: 'sano',
            hint: v('salud_sort_fruta', 'La fruta nos da vitaminas. Llévala a la caja Sano.'),
          },
          {
            id: 'dulces',
            art: 'dulces',
            label: 'Muchos dulces',
            bin: 'nosano',
            hint: v(
              'salud_sort_dulces',
              'Muchos dulces dañan los dientes. Llévalos a la caja No sano.',
            ),
          },
          {
            id: 'manos',
            art: 'paso-frotar',
            label: 'Lavarse las manos',
            bin: 'sano',
            hint: v('salud_sort_manos', 'Lavarnos las manos quita los microbios. ¡Eso es sano!'),
          },
          {
            id: 'tarde',
            art: 'dormir-tarde',
            label: 'Dormir tarde',
            bin: 'nosano',
            hint: v('salud_sort_tarde', 'Dormir tarde nos deja cansados. Va en la caja No sano.'),
          },
          {
            id: 'agua',
            art: 'agua',
            label: 'Tomar agua',
            bin: 'sano',
            hint: v('salud_sort_agua', 'El agua nos mantiene sanos. Llévala a la caja Sano.'),
          },
          {
            id: 'soda',
            art: 'soda',
            label: 'Mucha soda',
            bin: 'nosano',
            hint: v('salud_sort_soda', 'La soda tiene mucha azúcar. Va en la caja No sano.'),
          },
          {
            id: 'cepillo',
            art: 'cepillo',
            label: 'Cepillarse',
            bin: 'sano',
            hint: v(
              'salud_sort_cepillo',
              'Cepillarnos los dientes es muy sano. ¡Va en la caja Sano!',
            ),
          },
          {
            id: 'papitas',
            art: 'papitas',
            label: 'Muchas papitas',
            bin: 'nosano',
            hint: v('salud_sort_papitas', 'Las papitas tienen mucha sal. Van en la caja No sano.'),
          },
        ],
      },
      {
        kind: 'sequence',
        id: 'lava-manos',
        numbered: true,
        title: 'Lava tus manos',
        icon: 'paso-frotar',
        intro: [
          v(
            'salud_seq_intro',
            'Ordena los pasos para lavarte las manos. Arrastra cada paso a su número.',
          ),
        ],
        done: v(
          'salud_seq_done',
          '¡Manos limpias! Lávatelas antes de comer y después de ir al baño.',
        ),
        steps: [
          {
            id: 'mojar',
            art: 'paso-mojar',
            label: 'Mojar',
            hint: v('salud_seq_mojar', 'Primero mojamos las manos con agua.'),
          },
          {
            id: 'jabon',
            art: 'paso-jabon',
            label: 'Jabón',
            hint: v('salud_seq_jabon', 'Después ponemos jabón.'),
          },
          {
            id: 'frotar',
            art: 'paso-frotar',
            label: 'Frotar',
            hint: v('salud_seq_frotar', 'Luego frotamos muy bien las manos.'),
          },
          {
            id: 'enjuagar',
            art: 'paso-enjuagar',
            label: 'Enjuagar',
            hint: v('salud_seq_enjuagar', 'Ahora enjuagamos con agua.'),
          },
          {
            id: 'secar',
            art: 'paso-secar',
            label: 'Secar',
            hint: v('salud_seq_secar', 'Por último, secamos las manos.'),
          },
        ],
      },
      {
        kind: 'memory',
        id: 'visita-doctor',
        title: 'Visita al doctor',
        icon: 'termometro',
        intro: [
          v(
            'salud_mem_intro',
            'Vamos a la visita al doctor. Toca dos cartas y encuentra las parejas iguales.',
          ),
        ],
        done: v('salud_mem_done', '¡Encontraste todas las parejas de la salud!'),
        items: [
          { id: 'doctora', art: 'doctora', label: 'Doctora' },
          { id: 'vacuna', art: 'vacuna', label: 'Vacuna' },
          { id: 'termometro', art: 'termometro', label: 'Termómetro' },
          { id: 'curita', art: 'curita', label: 'Curita' },
          { id: 'cepillo', art: 'cepillo', label: 'Cepillo' },
          { id: 'agua', art: 'agua', label: 'Agua' },
        ],
        freeMismatches: 6,
        mismatchesPerError: 3,
        tryAgain: v('salud_mem_try', '¡Inténtalo otra vez! Recuerda dónde estaba cada carta.'),
      },
      level('clinica', 'Clínica de Tori', 'nino-enfermo', 'Level03'),
    ],
    challenges: [
      {
        kind: 'scrub',
        id: 'fuera-microbios',
        title: '¡Fuera microbios!',
        icon: 'esponja',
        tool: 'esponja',
        dirt: 'germs',
        intro: [
          v('salud_scrub_intro1', '¡Oh, no! Hay microbios por todos lados.'),
          v('salud_scrub_intro2', 'Arrastra la esponja y frota para limpiar.'),
        ],
        done: v('salud_scrub_done', '¡Todo limpio! Lavarnos nos protege de los microbios.'),
        rounds: [
          {
            art: 'manos',
            label: 'Manos',
            line: v('salud_scrub_manos', '¡Manos limpias! Lávalas antes de comer.'),
          },
          {
            art: 'mango',
            label: 'Fruta',
            line: v('salud_scrub_fruta', '¡Fruta limpia! Lavamos la fruta antes de comerla.'),
          },
          {
            art: 'cuchara',
            label: 'Cuchara',
            line: v('salud_scrub_cuchara', '¡Cuchara limpia! Lista para comer.'),
          },
        ],
      },
      {
        kind: 'runner',
        id: 'carrera-sana',
        title: 'Carrera sana',
        icon: 'nino',
        runner: 'nino',
        goal: 6,
        intro: [
          v('salud_run_intro1', '¡A correr! Moverse nos hace fuertes.'),
          v(
            'salud_run_intro2',
            'Toca para saltar. Toma la comida sana y salta la comida chatarra.',
          ),
        ],
        done: v(
          'salud_run_done',
          '¡Llegaste a la meta! Comer sano y movernos nos da energía para jugar.',
        ),
        good: [
          { art: 'mango', label: 'Mango' },
          { art: 'frijoles', label: 'Frijoles' },
          { art: 'guineo', label: 'Guineo' },
          { art: 'verduras', label: 'Verduras' },
        ],
        bad: [
          {
            art: 'dulces',
            label: 'Dulces',
            hint: v('salud_run_dulces', '¡Salta los dulces! Toca para saltar.'),
          },
          {
            art: 'soda',
            label: 'Soda',
            hint: v('salud_run_soda', '¡Salta la soda! Toca para saltar.'),
          },
          {
            art: 'papitas',
            label: 'Papitas',
            hint: v('salud_run_papitas', '¡Salta las papitas! Toca para saltar.'),
          },
        ],
      },
      {
        kind: 'choice',
        id: 'repaso-salud',
        title: 'Desafío final',
        icon: 'icon-salud',
        medal: true,
        intro: [
          v('salud_final_intro', '¡Desafío final! Escucha cada pregunta y toca la respuesta.'),
        ],
        done: v('salud_final_done', '¡Lo lograste! Eres Guardián de la Salud.'),
        rounds: [
          {
            question: v('salud_final_q1', '¿Qué nos ayuda a estar sanos?'),
            options: [
              {
                id: 'dulces',
                art: 'dulces',
                label: 'Dulces',
                correct: false,
                hint: v(
                  'salud_final_h1',
                  'Los dulces son solo de vez en cuando. ¡Inténtalo otra vez!',
                ),
              },
              { id: 'fruta', art: 'mango', label: 'Fruta', correct: true },
              {
                id: 'soda',
                art: 'soda',
                label: 'Soda',
                correct: false,
                hint: v('salud_final_h1b', 'La soda tiene mucha azúcar. ¡Inténtalo otra vez!'),
              },
            ],
          },
          {
            question: v('salud_final_q2', '¿Qué usamos para lavarnos las manos?'),
            options: [
              { id: 'jabon', art: 'paso-jabon', label: 'Jabón', correct: true },
              {
                id: 'crayon',
                art: 'crayon',
                label: 'Crayón',
                correct: false,
                hint: v('salud_final_h2', 'El crayón es para dibujar. ¡Inténtalo otra vez!'),
              },
              {
                id: 'pelota',
                art: 'pelota',
                label: 'Pelota',
                correct: false,
                hint: v('salud_final_h2b', 'La pelota es para jugar. ¡Inténtalo otra vez!'),
              },
            ],
          },
          {
            question: v('salud_final_q3', '¿Quién nos cuida cuando estamos enfermos?'),
            options: [
              {
                id: 'pintor',
                art: 'pintor',
                label: 'Pintor',
                correct: false,
                hint: v('salud_final_h3', 'El pintor pinta cuadros. ¡Inténtalo otra vez!'),
              },
              {
                id: 'cocinero',
                art: 'cocinero',
                label: 'Cocinero',
                correct: false,
                hint: v('salud_final_h3b', 'El cocinero prepara comida. ¡Inténtalo otra vez!'),
              },
              { id: 'doctora', art: 'doctora', label: 'Doctora', correct: true },
            ],
          },
          {
            question: v('salud_final_q4', '¿Qué nos protege de las enfermedades?'),
            options: [
              { id: 'vacuna', art: 'vacuna', label: 'Vacuna', correct: true },
              {
                id: 'carrito',
                art: 'carrito',
                label: 'Carrito',
                correct: false,
                hint: v('salud_final_h4', 'El carrito es un juguete. ¡Inténtalo otra vez!'),
              },
              {
                id: 'galleta',
                art: 'galleta',
                label: 'Galleta',
                correct: false,
                hint: v('salud_final_h4b', 'La galleta es para comer. ¡Inténtalo otra vez!'),
              },
            ],
          },
          {
            question: v('salud_final_q5', '¿Qué hacemos para tener dientes sanos?'),
            options: [
              {
                id: 'papitas',
                art: 'papitas',
                label: 'Comer papitas',
                correct: false,
                hint: v(
                  'salud_final_h5',
                  'Las papitas no cuidan los dientes. ¡Inténtalo otra vez!',
                ),
              },
              { id: 'cepillo', art: 'cepillo', label: 'Cepillarnos', correct: true },
              {
                id: 'tarde',
                art: 'dormir-tarde',
                label: 'Dormir tarde',
                correct: false,
                hint: v(
                  'salud_final_h5b',
                  'Dormir tarde no cuida los dientes. ¡Inténtalo otra vez!',
                ),
              },
            ],
          },
        ],
      },
    ],
  },

  // ============================================================ EDUCACIÓN
  {
    id: 'educacion',
    name: 'Derecho a la educación',
    short: 'Educación',
    color: COLORS.grape,
    icon: 'icon-educacion',
    phrase: v(
      'der_educacion_frase',
      'Todos los niños tienen derecho a aprender y asistir a la escuela.',
    ),
    explanation: [
      v(
        'der_educacion_exp1',
        'Todas las niñas y niños tienen derecho a aprender y asistir a la escuela.',
      ),
      v('der_educacion_exp2', 'En la escuela aprendemos a leer, contar y hacer amigos.'),
    ],
    medal: {
      name: 'Guardián del Saber',
      won: v('der_educacion_medalla', '¡Ganaste la medalla del Derecho a la educación!'),
    },
    games: [
      level('rompecabezas', 'Rompecabezas escolar', 'mochila', 'Level04'),
      {
        kind: 'dots',
        id: 'une-puntos',
        title: 'Une los puntos',
        icon: 'lapiz',
        intro: [
          v('edu_dots_intro1', 'Hay un dibujo escondido en la hoja.'),
          v('edu_dots_intro2', 'Toca los números en orden: uno, dos, tres…'),
        ],
        done: v('edu_dots_done', '¡Descubriste los útiles de la escuela!'),
        rounds: [
          {
            art: 'lapiz',
            label: 'Lápiz',
            points: [
              [12, 50],
              [40, 50],
              [102, 50],
              [124, 65],
              [102, 80],
              [40, 80],
              [12, 80],
            ],
            line: v('edu_dots_lapiz', '¡Un lápiz! Con el lápiz aprendemos a escribir.'),
          },
          {
            art: 'cuaderno',
            label: 'Cuaderno',
            points: [
              [22, 14],
              [112, 14],
              [112, 66],
              [112, 118],
              [22, 118],
              [22, 66],
            ],
            line: v('edu_dots_cuaderno', '¡Un cuaderno! Ahí escribimos y dibujamos.'),
          },
          {
            art: 'mochila',
            label: 'Mochila',
            points: [
              [18, 50],
              [28, 30],
              [48, 13],
              [65, 4],
              [82, 13],
              [102, 30],
              [112, 50],
              [112, 112],
              [100, 124],
              [30, 124],
              [18, 112],
            ],
            line: v('edu_dots_mochila', '¡Una mochila! Lleva tus útiles a la escuela.'),
          },
        ],
      },
      level('memorama-derechos', 'Memorama de derechos', 'icon-isla', 'Level08'),
    ],
    challenges: [
      {
        kind: 'hidden',
        id: 'busca-utiles',
        title: 'Busca los útiles',
        icon: 'tijeras',
        theme: 'classroom',
        intro: [
          v('edu_hidden_intro1', '¡Se escondieron los útiles en el salón!'),
          v('edu_hidden_intro2', 'Búscalos y tócalos. Mira la lista de abajo.'),
        ],
        done: v('edu_hidden_done', '¡Encontraste todos los útiles! Ya estás listo para aprender.'),
        find: [
          { art: 'lapiz', label: 'Lápiz', x: 1015, y: 180, size: 64, angle: -35 },
          { art: 'cuaderno', label: 'Cuaderno', x: 585, y: 370, size: 84, angle: -8 },
          { art: 'tijeras', label: 'Tijeras', x: 300, y: 244, size: 58, angle: 20 },
          { art: 'mochila', label: 'Mochila', x: 312, y: 404, size: 92, angle: 8 },
        ],
        decoys: [
          {
            art: 'pelota',
            label: 'Pelota',
            x: 735,
            y: 452,
            size: 58,
            hint: v('edu_hidden_pelota', 'La pelota es para el recreo. ¡Busca los útiles!'),
          },
          {
            art: 'perrito',
            label: 'Perrito',
            x: 430,
            y: 440,
            size: 74,
            hint: v(
              'edu_hidden_perrito',
              '¡Un perrito! Los perritos no van a clase. Busca los útiles.',
            ),
          },
        ],
      },
      {
        kind: 'place',
        id: 'arma-salon',
        title: 'Arma tu salón',
        icon: 'salon',
        theme: 'classroom',
        intro: [
          v('edu_place_intro1', '¡Mañana hay clases! Ayúdame a preparar el salón.'),
          v('edu_place_intro2', 'Lleva cada cosa a su sombra.'),
        ],
        done: v('edu_place_done', '¡Qué bonito salón! Aquí todos aprendemos.'),
        items: [
          { id: 'cuaderno', art: 'cuaderno', label: 'Cuaderno', x: 560, y: 356, size: 80 },
          { id: 'lapiz', art: 'lapiz', label: 'Lápiz', x: 660, y: 362, size: 66 },
          { id: 'tijeras', art: 'tijeras', label: 'Tijeras', x: 752, y: 362, size: 66 },
          { id: 'mochila', art: 'mochila', label: 'Mochila', x: 290, y: 404, size: 116 },
          { id: 'reloj', art: 'despertador', label: 'Reloj', x: 1000, y: 176, size: 90 },
          { id: 'libro', art: 'cuento', label: 'Libro', x: 990, y: 420, size: 84 },
        ],
      },
      {
        kind: 'board',
        id: 'desafio-educacion',
        title: 'Desafío final',
        icon: 'icon-educacion',
        medal: true,
        intro: [v('edu_board_intro', '¡Desafío final! Toca el dado y responde en cada estrella.')],
        done: v('edu_final_done', '¡Lo lograste! Eres Guardián del Saber.'),
        rounds: [
          {
            question: v('edu_final_q1', '¿Dónde aprendemos con la maestra?'),
            options: [
              {
                id: 'cama',
                art: 'camita',
                label: 'Cama',
                correct: false,
                hint: v('edu_final_h1', 'En la cama dormimos. ¡Inténtalo otra vez!'),
              },
              { id: 'salon', art: 'salon', label: 'Escuela', correct: true },
              {
                id: 'mar',
                art: 'velero',
                label: 'Mar',
                correct: false,
                hint: v('edu_final_h1b', 'En el mar se navega. ¡Inténtalo otra vez!'),
              },
            ],
          },
          {
            question: v('edu_final_q2', '¿Qué usamos para escribir?'),
            options: [
              {
                id: 'galleta',
                art: 'galleta',
                label: 'Galleta',
                correct: false,
                hint: v('edu_final_h2', 'La galleta es para comer. ¡Inténtalo otra vez!'),
              },
              {
                id: 'trompo',
                art: 'trompo',
                label: 'Trompo',
                correct: false,
                hint: v('edu_final_h2b', 'El trompo es para jugar. ¡Inténtalo otra vez!'),
              },
              { id: 'lapiz', art: 'lapiz', label: 'Lápiz', correct: true },
            ],
          },
          {
            question: v('edu_final_q3', '¿Quiénes tienen derecho a ir a la escuela? Toca a todos.'),
            options: [
              { id: 'nino-a', art: 'nino-a', label: 'Él', correct: true },
              { id: 'nina-silla', art: 'nina-silla', label: 'Ella', correct: true },
              { id: 'nina-b', art: 'nina-b', label: 'Ella', correct: true },
            ],
          },
        ],
      },
    ],
  },

  // ============================================================ VIDA
  {
    id: 'vida',
    name: 'Derecho a la vida',
    short: 'Vida',
    color: COLORS.pink,
    icon: 'icon-vida',
    phrase: v('der_vida_frase', 'Mi vida debe ser protegida y respetada.'),
    explanation: [
      v(
        'der_vida_exp1',
        'Todas las niñas y niños tienen derecho a la vida. Su vida debe ser protegida y respetada.',
      ),
      v('der_vida_exp2', 'Nuestra familia y los adultos nos cuidan para que estemos seguros.'),
    ],
    medal: {
      name: 'Guardián de la Vida',
      won: v('der_vida_medalla', '¡Ganaste la medalla del Derecho a la vida!'),
    },
    games: [
      {
        kind: 'cross',
        id: 'cruzo-seguro',
        title: '¡Cruzo seguro!',
        icon: 'carrito',
        adult: 'mama',
        kid: 'nino',
        intro: [
          v(
            'vida_cross_intro',
            '¡Vamos a aprender a cuidarnos en la calle! Son tres niveles, cada uno diferente.',
          ),
        ],
        light: {
          title: 'El semáforo',
          explain: v(
            'vida_cross_l1',
            'En este nivel cruzamos con el semáforo. Primero toma la mano de mamá: tócala.',
          ),
          holdDone: v('vida_cross_mano_ok', '¡Muy bien! Siempre cruzamos de la mano de un adulto.'),
          wait: v(
            'vida_cross_espera',
            'Ahora mira el semáforo. En rojo esperamos. Cuando esté en verde, toca ¡Cruzar!',
          ),
          green: v('vida_cross_verde', '¡Verde! Los carros se detienen. Toca ¡Cruzar!'),
          tooSoon: v('vida_cross_rojo', '¡Alto! Está en rojo y pasan carros. Espera el verde.'),
          done: v('vida_cross_l1_ok', '¡Cruzaste con el semáforo en verde! Muy bien.'),
        },
        look: {
          title: 'Mira a los dos lados',
          explain: v(
            'vida_cross_l2',
            'Aquí no hay semáforo. Antes de cruzar, mira a la izquierda y a la derecha: toca los ojitos.',
          ),
          car: v(
            'vida_cross_carro',
            '¡Viene un carro por ese lado! Esperemos a que pase y vuelve a mirar.',
          ),
          clear: v('vida_cross_libre', '¡No viene ningún carro por ese lado!'),
          notYet: v(
            'vida_cross_mira',
            'Primero mira a los dos lados y revisa que no venga ningún carro.',
          ),
          ready: v('vida_cross_listo', '¡Los dos lados están libres! Ahora toca ¡Cruzar!'),
          done: v('vida_cross_l2_ok', '¡Miraste a los dos lados antes de cruzar! Excelente.'),
        },
        ball: {
          title: 'La pelota',
          explain: v('vida_cross_l3', 'Ahora juegas con tu pelota en la banqueta. ¡Mira qué pasa!'),
          rolled: v('vida_cross_pelota', '¡Oh, no! La pelota se fue a la calle. ¿Qué haces?'),
          runLabel: 'Correr por la pelota',
          askLabel: 'Pedir ayuda a mamá',
          wrong: v(
            'vida_cross_corre',
            '¡No! Nunca corremos a la calle. Le pedimos ayuda a un adulto.',
          ),
          right: v(
            'vida_cross_ayuda',
            '¡Muy bien! Mamá te ayuda. Esperamos el verde y cruzamos juntos.',
          ),
          done: v('vida_cross_l3_ok', '¡Recuperamos la pelota de forma segura!'),
        },
        done: v(
          'vida_cross_done',
          '¡Lo lograste! En la calle nos cuidamos, y así protegemos nuestra vida.',
        ),
      },
      {
        kind: 'choice',
        id: 'me-cuidan',
        title: 'Me cuidan y me protegen',
        icon: 'icon-vida',
        intro: [v('vida_choice_intro', 'Vamos a ver quién y qué nos protege.')],
        done: v('vida_choice_done', '¡Muy bien! Tu vida es importante y merece ser cuidada.'),
        rounds: [
          {
            question: v('vida_q1', '¿Quiénes te cuidan y te protegen? Toca a todos.'),
            options: [
              { id: 'mama', art: 'mama', label: 'Mamá', correct: true },
              { id: 'papa', art: 'papa', label: 'Papá', correct: true },
              { id: 'abuela', art: 'abuela', label: 'Abuela', correct: true },
            ],
          },
          {
            question: v('vida_q2', '¿Qué protege tu vida y tu salud?'),
            options: [
              {
                id: 'soda',
                art: 'soda',
                label: 'Soda',
                correct: false,
                hint: v('vida_h2', 'La soda no nos protege. ¡Inténtalo otra vez!'),
              },
              { id: 'vacuna', art: 'vacuna', label: 'Vacuna', correct: true },
              {
                id: 'dulces',
                art: 'dulces',
                label: 'Dulces',
                correct: false,
                hint: v('vida_h2b', 'Los dulces no nos protegen. ¡Inténtalo otra vez!'),
              },
            ],
          },
          {
            question: v('vida_q3', 'Cuando llueve muy fuerte, ¿dónde estamos seguros?'),
            options: [
              {
                id: 'papalote',
                art: 'papalote',
                label: 'Volando piscucha',
                correct: false,
                hint: v(
                  'vida_h3',
                  'Con lluvia fuerte es mejor no estar afuera. ¡Inténtalo otra vez!',
                ),
              },
              {
                id: 'pelota',
                art: 'pelota',
                label: 'Jugando afuera',
                correct: false,
                hint: v('vida_h3b', 'Afuera nos podemos mojar y lastimar. Busca un lugar seguro.'),
              },
              { id: 'casa', art: 'icon-vivienda', label: 'En casa', correct: true },
            ],
          },
        ],
      },
      {
        kind: 'place',
        id: 'lugares-seguros',
        title: 'Lugares seguros',
        icon: 'icon-vivienda',
        theme: 'storm',
        anySpot: true,
        intro: [
          v('vida_place_intro1', '¡Oh, no! Viene una tormenta.'),
          v(
            'vida_place_intro2',
            'Lleva a cada amigo a una ventana de la casa. ¡Adentro estarán seguros!',
          ),
        ],
        done: v(
          'vida_place_done',
          '¡Todos están a salvo! Cuando hay tormenta, nos quedamos en un lugar seguro.',
        ),
        items: [
          { id: 'nino-a', art: 'nino-a', label: 'Amigo', x: 510, y: 278, size: 84 },
          { id: 'nina-b', art: 'nina-b', label: 'Amiga', x: 770, y: 278, size: 84 },
          { id: 'nino-c', art: 'nino-c', label: 'Amigo', x: 510, y: 388, size: 80 },
          { id: 'perrito', art: 'perrito', label: 'Perrito', x: 770, y: 390, size: 78 },
          { id: 'nina-silla', art: 'nina-silla', label: 'Amiga', x: 640, y: 394, size: 96 },
        ],
      },
    ],
    challenges: [
      {
        kind: 'maze',
        id: 'camino-seguro',
        title: 'Camino seguro',
        icon: 'icon-vivienda',
        walker: 'nino',
        goal: { art: 'icon-vivienda', label: 'Casa' },
        look: 'board',
        intro: [
          v(
            'vida_maze_intro',
            'Ayuda a tu amigo a llegar a su casa. ¡Cuidado con el fuego y los carros! Usa las flechas o toca una casilla brillante.',
          ),
        ],
        done: v('vida_maze_done', '¡Llegó a casa sano y salvo! Siempre buscamos el camino seguro.'),
        grid: ['S..f...12', '1#.213.#4', '2...c...1', '#.31#.2.1', '4.....#.G'],
        dangers: {
          f: {
            art: 'fuego',
            label: 'Fuego',
            hint: v('vida_maze_fuego', '¡Cuidado! El fuego quema. Busca otro camino.'),
          },
          c: {
            art: 'carrito',
            label: 'Carros',
            hint: v('vida_maze_carro', '¡Cuidado! Por ahí pasan carros. Busca otro camino.'),
          },
        },
        legend: {
          title: 'Cuidado con el peligro',
          items: [
            { art: 'fuego', label: 'Fuego', note: 'Quema: no pases', ok: false },
            { art: 'carrito', label: 'Carros', note: 'No cruces solo', ok: false },
          ],
        },
        startLabel: 'Salida',
        moveLabel: 'Mueve a tu amigo',
      },
      {
        kind: 'give',
        id: 'que-necesita',
        title: '¡A salvo!',
        icon: 'curita',
        intro: [
          v(
            'vida_give_intro1',
            'Mis amigos necesitan ayuda para estar a salvo. Mira el globito de cada uno.',
          ),
          v('vida_give_intro2', 'Lleva a cada amigo lo que lo protege.'),
        ],
        done: v('vida_give_done', '¡Gracias! Pedir ayuda y cuidarnos protege nuestra vida.'),
        friends: [
          {
            id: 'lluvia',
            art: 'nina-b',
            label: 'Llueve fuerte',
            wants: { art: 'icon-vivienda', label: 'Casa' },
            hint: v(
              'vida_give_h_lluvia',
              'Con lluvia fuerte buscamos un lugar seguro. ¡Llévala a la casa!',
            ),
          },
          {
            id: 'calle',
            art: 'nino-c',
            label: 'Va a cruzar la calle',
            wants: { art: 'mama', label: 'Mamá' },
            hint: v(
              'vida_give_h_calle',
              'Cruzamos la calle de la mano de un adulto. Busca a mamá.',
            ),
          },
          {
            id: 'raspon',
            art: 'nino-a',
            label: 'Se raspó',
            wants: { art: 'curita', label: 'Curita' },
            hint: v('vida_give_h_raspon', 'Se raspó la rodilla. La curita protege la herida.'),
          },
          {
            id: 'miedo',
            art: 'nino',
            label: 'Tiene miedo',
            wants: { art: 'papa', label: 'Papá' },
            hint: v('vida_give_h_miedo', 'Cuando tenemos miedo, pedimos ayuda. Busca a papá.'),
          },
        ],
        extras: [
          {
            art: 'fuego',
            label: 'Fuego',
            hint: v('vida_give_fuego', 'El fuego no ayuda a nadie. ¡Es peligroso!'),
          },
        ],
      },
      {
        kind: 'thumbs',
        id: 'desafio-vida',
        title: 'Desafío final',
        icon: 'icon-vida',
        medal: true,
        intro: [
          v('vida_thumbs_intro1', '¡Desafío final! Escucha cada tarjeta.'),
          v(
            'vida_thumbs_intro2',
            'Si está bien, toca la carita feliz. Si no está bien, toca la carita triste.',
          ),
        ],
        done: v('vida_final_done', '¡Lo lograste! Eres Guardián de la Vida.'),
        cards: [
          {
            art: 'icon-vivienda',
            label: 'Quedarse en casa en una tormenta',
            good: true,
            say: v(
              'vida_thumbs_casa',
              'Si hay tormenta, nos quedamos en casa. ¿Está bien o no está bien?',
            ),
            hint: v('vida_thumbs_casa_h', 'En casa estamos seguros. ¡Eso está bien!'),
          },
          {
            art: 'fuego',
            label: 'Jugar con fuego',
            good: false,
            say: v('vida_thumbs_fuego', 'Jugar con fuego. ¿Está bien o no está bien?'),
            hint: v('vida_thumbs_fuego_h', 'El fuego quema. Jugar con fuego no está bien.'),
          },
          {
            art: 'curita',
            label: 'Ponerse una curita',
            good: true,
            say: v(
              'vida_thumbs_curita',
              'Ponernos una curita en un raspón. ¿Está bien o no está bien?',
            ),
            hint: v('vida_thumbs_curita_h', 'La curita cuida la herida. ¡Está bien!'),
          },
          {
            art: 'carrito',
            label: 'Cruzar la calle solito',
            good: false,
            say: v(
              'vida_thumbs_calle',
              'Cruzar la calle solito, sin un adulto. ¿Está bien o no está bien?',
            ),
            hint: v('vida_thumbs_calle_h', 'Cruzamos la calle con un adulto. Solito no está bien.'),
          },
          {
            art: 'mama',
            label: 'Pedir ayuda cuando tengo miedo',
            good: true,
            say: v(
              'vida_thumbs_ayuda',
              'Pedir ayuda a mamá cuando tengo miedo. ¿Está bien o no está bien?',
            ),
            hint: v('vida_thumbs_ayuda_h', 'Pedir ayuda está muy bien.'),
          },
        ],
      },
    ],
  },

  // ============================================================ ALIMENTACIÓN
  {
    id: 'alimentacion',
    name: 'Derecho a la alimentación',
    short: 'Alimentación',
    color: COLORS.sun,
    icon: 'icon-alimentacion',
    phrase: v('der_alimentacion_frase', 'Tengo derecho a recibir alimentos nutritivos.'),
    explanation: [
      v(
        'der_alimentacion_exp1',
        'Todas las niñas y niños tienen derecho a recibir alimentos nutritivos.',
      ),
      v('der_alimentacion_exp2', 'Las frutas, verduras y frijoles nos ayudan a crecer fuertes.'),
    ],
    medal: {
      name: 'Guardián de la Buena Alimentación',
      won: v('der_alimentacion_medalla', '¡Ganaste la medalla del Derecho a la alimentación!'),
    },
    games: [
      level('lonchera', 'Lonchera nutritiva', 'lonchera', 'Level02'),
      {
        kind: 'fish',
        id: 'pesca-sana',
        title: 'Pesca comida sana',
        icon: 'mango',
        intro: [
          v('ali_fish_intro1', '¡Vamos a pescar!'),
          v('ali_fish_intro2', 'Toca el agua donde está lo que quieres y baja el anzuelo.'),
        ],
        done: v('ali_fish_done', '¡Qué buena pesca! Comer sano nos da energía.'),
        rounds: [
          {
            question: v('ali_fish_q1', 'Pesca comida sana. ¡Necesitas tres!'),
            goal: 3,
            good: [
              { art: 'mango', label: 'Mango' },
              { art: 'guineo', label: 'Guineo' },
              { art: 'verduras', label: 'Verduras' },
              { art: 'frijoles', label: 'Frijoles' },
            ],
            bad: [
              {
                art: 'dulces',
                label: 'Dulces',
                hint: v('ali_fish_dulces', 'Los dulces no son comida sana. ¡Pesca otra cosa!'),
              },
              {
                art: 'soda',
                label: 'Soda',
                hint: v('ali_fish_soda', 'La soda tiene mucha azúcar. ¡Pesca otra cosa!'),
              },
              {
                art: 'papitas',
                label: 'Papitas',
                hint: v('ali_fish_papitas', 'Las papitas tienen mucha sal. ¡Pesca otra cosa!'),
              },
            ],
          },
          {
            question: v('ali_fish_q2', 'Ahora pesca lo que es sano para tomar. ¡Dos cosas!'),
            goal: 2,
            good: [
              { art: 'agua', label: 'Agua' },
              { art: 'leche', label: 'Leche' },
            ],
            bad: [
              {
                art: 'soda',
                label: 'Soda',
                hint: v('ali_fish_soda2', 'La soda tiene mucha azúcar. Mejor agua o leche.'),
              },
              {
                art: 'mango',
                label: 'Mango',
                hint: v('ali_fish_mango2', 'El mango se come. ¡Busca algo para tomar!'),
              },
              {
                art: 'frijoles',
                label: 'Frijoles',
                hint: v('ali_fish_frijoles2', 'Los frijoles se comen. ¡Busca algo para tomar!'),
              },
            ],
          },
        ],
      },
      {
        kind: 'catch',
        id: 'mercado',
        title: 'Mercado de frutas',
        icon: 'guineo',
        intro: [
          v('ali_catch_intro1', '¡Vamos al mercado! Arrastra la canasta de un lado a otro.'),
          v('ali_catch_intro2', 'Atrapa la comida sana. La que no es sana, déjala caer.'),
        ],
        done: v('ali_catch_done', '¡Qué canasta tan sana! Con esto crecemos fuertes.'),
        catcher: 'canasta',
        goal: 7,
        good: [
          { art: 'mango', label: 'Mango' },
          { art: 'guineo', label: 'Guineo' },
          { art: 'verduras', label: 'Verduras' },
          { art: 'frijoles', label: 'Frijoles' },
          { art: 'leche', label: 'Leche' },
        ],
        bad: [
          {
            art: 'soda',
            label: 'Soda',
            hint: v('ali_catch_soda', 'La soda tiene mucha azúcar. ¡Déjala caer!'),
          },
          {
            art: 'dulces',
            label: 'Dulces',
            hint: v('ali_catch_dulces', 'Los dulces tienen mucha azúcar. ¡Déjalos caer!'),
          },
          {
            art: 'papitas',
            label: 'Papitas',
            hint: v('ali_catch_papitas', 'Las papitas tienen mucha sal. ¡Déjalas caer!'),
          },
        ],
      },
    ],
    challenges: [
      {
        kind: 'sort',
        id: 'plato-sano',
        title: 'Plato sano',
        icon: 'verduras',
        look: 'plate',
        intro: [
          v(
            'ali_sort_intro',
            'La comida sana va al plato verde. La que no es sana va a la caja roja.',
          ),
        ],
        done: v('ali_sort_done', '¡Muy bien! Ya sabes qué comida nos hace crecer fuertes.'),
        bins: [SANO, NO_SANO],
        items: [
          {
            id: 'mango',
            art: 'mango',
            label: 'Mango',
            bin: 'sano',
            hint: v('ali_sort_mango', 'El mango es sano. ¡Va al plato verde!'),
          },
          {
            id: 'soda',
            art: 'soda',
            label: 'Soda',
            bin: 'nosano',
            hint: v('ali_sort_soda', 'La soda tiene mucha azúcar. Va a la caja roja.'),
          },
          {
            id: 'frijoles',
            art: 'frijoles',
            label: 'Frijoles',
            bin: 'sano',
            hint: v('ali_sort_frijoles', 'Los frijoles te hacen fuerte. ¡Van al plato verde!'),
          },
          {
            id: 'dulces',
            art: 'dulces',
            label: 'Dulces',
            bin: 'nosano',
            hint: v('ali_sort_dulces', 'Los dulces tienen mucha azúcar. Van a la caja roja.'),
          },
          {
            id: 'leche',
            art: 'leche',
            label: 'Leche',
            bin: 'sano',
            hint: v('ali_sort_leche', 'La leche cuida tus huesos. ¡Va al plato verde!'),
          },
          {
            id: 'papitas',
            art: 'papitas',
            label: 'Papitas',
            bin: 'nosano',
            hint: v('ali_sort_papitas', 'Las papitas tienen mucha sal. Van a la caja roja.'),
          },
          {
            id: 'verduras',
            art: 'verduras',
            label: 'Verduras',
            bin: 'sano',
            hint: v('ali_sort_verduras', 'Las verduras te hacen fuerte. ¡Van al plato verde!'),
          },
          {
            id: 'guineo',
            art: 'guineo',
            label: 'Guineo',
            bin: 'sano',
            hint: v('ali_sort_guineo', 'El guineo te da energía. ¡Va al plato verde!'),
          },
        ],
      },
      {
        kind: 'match',
        id: 'de-donde-viene',
        title: '¿De dónde viene?',
        icon: 'vaca',
        intro: [
          v('ali_match_intro1', '¿De dónde viene la comida?'),
          v('ali_match_intro2', 'Arrastra una línea desde cada comida hasta de dónde viene.'),
        ],
        done: v('ali_match_done', '¡Muy bien! Ahora sabes de dónde viene la comida.'),
        pairs: [
          {
            id: 'leche',
            left: { art: 'leche', label: 'Leche' },
            right: { art: 'vaca', label: 'Vaca' },
            hint: v('ali_match_leche', 'La leche nos la da la vaca.'),
          },
          {
            id: 'huevo',
            left: { art: 'huevo', label: 'Huevos' },
            right: { art: 'gallina', label: 'Gallina' },
            hint: v('ali_match_huevo', 'Los huevos los pone la gallina.'),
          },
          {
            id: 'mango',
            left: { art: 'mango', label: 'Mango' },
            right: { art: 'arbol', label: 'Árbol' },
            hint: v('ali_match_mango', 'El mango crece en un árbol.'),
          },
          {
            id: 'verduras',
            left: { art: 'verduras', label: 'Verduras' },
            right: { art: 'huerta', label: 'Huerta' },
            hint: v('ali_match_verduras', 'Las verduras crecen en la huerta.'),
          },
        ],
      },
      {
        kind: 'share',
        id: 'desafio-alimentacion',
        title: 'Desafío final',
        icon: 'icon-alimentacion',
        medal: true,
        intro: [
          v('ali_share_intro1', '¡Desafío final! Todos los niños tienen derecho a comer.'),
          v('ali_share_intro2', 'Arrastra la comida a los platos. Todos deben tener lo mismo.'),
        ],
        done: v('ali_final_done', '¡Lo lograste! Eres Guardián de la Buena Alimentación.'),
        friends: [
          { art: 'nino-a', label: 'Daniel' },
          { art: 'nina-b', label: 'Valentina' },
          { art: 'nina-silla', label: 'Sofía' },
        ],
        unfair: v('ali_share_unfair', '¡Espera! Ese amigo ya tiene más. Dale a otro amigo.'),
        rounds: [
          {
            item: { art: 'guineo', label: 'Guineo' },
            count: 3,
            question: v('ali_share_q1', 'Reparte los guineos. ¡Uno para cada amigo!'),
          },
          {
            item: { art: 'mango', label: 'Mango' },
            count: 6,
            question: v('ali_share_q2', 'Ahora reparte los mangos. Todos deben tener lo mismo.'),
          },
          {
            item: { art: 'leche', label: 'Leche' },
            count: 6,
            question: v('ali_share_q3', 'Por último, reparte la leche.'),
          },
        ],
      },
    ],
  },

  // ============================================================ VIVIENDA
  {
    id: 'vivienda',
    name: 'Derecho a la vivienda',
    short: 'Vivienda',
    color: COLORS.coral,
    icon: 'icon-vivienda',
    phrase: v('der_vivienda_frase', 'Tengo derecho a vivir en un lugar seguro.'),
    explanation: [
      v('der_vivienda_exp1', 'Todas las niñas y niños tienen derecho a vivir en un lugar seguro.'),
      v(
        'der_vivienda_exp2',
        'Un hogar nos protege de la lluvia y nos da un lugar para estar con nuestra familia.',
      ),
    ],
    medal: {
      name: 'Guardián del Hogar',
      won: v('der_vivienda_medalla', '¡Ganaste la medalla del Derecho a la vivienda!'),
    },
    games: [
      level('casa-segura', 'Casa segura', 'icon-vivienda', 'Level01'),
      {
        kind: 'dots',
        id: 'une-puntos-casa',
        title: 'Une los puntos',
        icon: 'puerta',
        intro: [
          v('viv_dots_intro1', '¿Qué hay escondido en la hoja?'),
          v('viv_dots_intro2', 'Toca los números en orden.'),
        ],
        done: v('viv_dots_done', '¡Descubriste las cosas de un hogar!'),
        rounds: [
          {
            art: 'puerta',
            label: 'Puerta',
            points: [
              [4, 4],
              [76, 4],
              [76, 60],
              [76, 116],
              [4, 116],
              [4, 60],
            ],
            line: v('viv_dots_puerta', '¡Una puerta! Nos cuida y protege la casa.'),
          },
          {
            art: 'icon-vivienda',
            label: 'Casa',
            points: [
              [12, 50],
              [50, 14],
              [88, 50],
              [78, 50],
              [78, 92],
              [22, 92],
              [22, 50],
            ],
            line: v('viv_dots_casa', '¡Una casa! Todos necesitamos un hogar.'),
          },
          {
            art: 'camita',
            label: 'Cama',
            points: [
              [6, 18],
              [24, 18],
              [40, 45],
              [126, 47],
              [144, 46],
              [144, 104],
              [126, 104],
              [126, 89],
              [24, 89],
              [24, 104],
              [6, 104],
            ],
            line: v('viv_dots_cama', '¡Una cama! En casa descansamos.'),
          },
        ],
      },
      {
        kind: 'stack',
        id: 'construye-casa',
        title: 'Construye tu casa',
        icon: 'techo',
        intro: [
          v('viv_stack_intro1', '¡Vamos a construir una casa!'),
          v('viv_stack_intro2', 'La grúa mueve cada pieza. Toca cuando esté justo arriba.'),
        ],
        done: v('viv_stack_done', '¡Qué casa tan bonita! Todos tenemos derecho a un hogar.'),
        pieces: [
          {
            art: 'piso-casa',
            label: 'Piso',
            width: 340,
            say: v('viv_stack_piso', 'Primero, el piso. ¡Bien firme!'),
          },
          {
            art: 'casa-planta',
            label: 'Paredes',
            width: 300,
            say: v('viv_stack_paredes', '¡Las paredes, la puerta y las ventanas!'),
          },
          {
            art: 'techo',
            label: 'Techo',
            width: 360,
            say: v('viv_stack_techo', '¡El techo nos protege de la lluvia!'),
          },
        ],
      },
    ],
    challenges: [
      {
        kind: 'hidden',
        id: 'busca-en-casa',
        title: '¿Qué hay en mi casa?',
        icon: 'cuento',
        theme: 'house',
        intro: [
          v('viv_hidden_intro1', 'En casa hay muchas cosas que nos cuidan.'),
          v('viv_hidden_intro2', 'Busca las cosas de la lista y tócalas.'),
        ],
        done: v(
          'viv_hidden_done',
          '¡Las encontraste todas! Nuestro hogar tiene lo que necesitamos.',
        ),
        find: [
          { art: 'cuchara', label: 'Cuchara', x: 815, y: 372, size: 62, angle: 30 },
          { art: 'agua', label: 'Agua', x: 925, y: 360, size: 58 },
          { art: 'cuento', label: 'Cuento', x: 852, y: 448, size: 62, angle: -10 },
          { art: 'pijama', label: 'Pijama', x: 330, y: 284, size: 76, angle: -8 },
          { art: 'cepillo', label: 'Cepillo', x: 610, y: 250, size: 58, angle: -20 },
        ],
        decoys: [
          {
            art: 'vaca',
            label: 'Vaca',
            x: 1010,
            y: 410,
            size: 92,
            hint: v('viv_hidden_vaca', '¡Una vaca! Las vacas viven en el campo, no en la casa.'),
          },
          {
            art: 'nube',
            label: 'Nube',
            x: 440,
            y: 190,
            size: 70,
            hint: v('viv_hidden_nube', 'Las nubes están en el cielo, no en la casa.'),
          },
        ],
      },
      {
        kind: 'scrub',
        id: 'limpiamos-casa',
        title: 'En casa nos ayudamos',
        icon: 'esponja',
        tool: 'esponja',
        dirt: 'mud',
        intro: [
          v('viv_scrub_intro1', 'En casa nos ayudamos a limpiar.'),
          v('viv_scrub_intro2', 'Arrastra la esponja y frota el lodo.'),
        ],
        done: v('viv_scrub_done', '¡La casa quedó brillante! Entre todos cuidamos nuestro hogar.'),
        rounds: [
          {
            art: 'ventana',
            label: 'Ventana',
            line: v('viv_scrub_ventana', '¡Ventana limpia! Ya entra la luz.'),
          },
          {
            art: 'puerta',
            label: 'Puerta',
            line: v('viv_scrub_puerta', '¡Puerta limpia! ¡Qué bonita!'),
          },
          {
            art: 'paredes',
            label: 'Pared',
            line: v('viv_scrub_pared', '¡Pared limpia! Ayudar en casa es muy bonito.'),
          },
        ],
      },
      {
        kind: 'fish',
        id: 'desafio-vivienda',
        title: 'Desafío final',
        icon: 'icon-vivienda',
        medal: true,
        intro: [
          v('viv_fish_intro1', '¡Desafío final! Vamos a pescar.'),
          v('viv_fish_intro2', 'Toca el agua donde está lo que quieres.'),
        ],
        done: v('viv_final_done', '¡Lo lograste! Eres Guardián del Hogar.'),
        rounds: [
          {
            question: v('viv_fish_q1', 'Pesca las partes de una casa. ¡Tres!'),
            goal: 3,
            good: [
              { art: 'techo', label: 'Techo' },
              { art: 'puerta', label: 'Puerta' },
              { art: 'ventana', label: 'Ventana' },
              { art: 'paredes', label: 'Pared' },
            ],
            bad: [
              {
                art: 'nube',
                label: 'Nube',
                hint: v('viv_fish_nube', 'La nube está en el cielo. ¡Pesca otra cosa!'),
              },
              {
                art: 'palmera',
                label: 'Palmera',
                hint: v('viv_fish_palmera', 'La palmera crece afuera. ¡Pesca otra cosa!'),
              },
              {
                art: 'velero',
                label: 'Barco',
                hint: v('viv_fish_velero', 'El barco va en el mar. ¡Pesca otra cosa!'),
              },
            ],
          },
          {
            question: v('viv_fish_q2', 'Ahora pesca lo que usamos para dormir. ¡Dos!'),
            goal: 2,
            good: [
              { art: 'camita', label: 'Cama' },
              { art: 'pijama', label: 'Pijama' },
            ],
            bad: [
              {
                art: 'pelota',
                label: 'Pelota',
                hint: v('viv_fish_pelota', 'La pelota es para jugar. ¡Busca otra!'),
              },
              {
                art: 'cuchara',
                label: 'Cuchara',
                hint: v('viv_fish_cuchara', 'La cuchara es para comer. ¡Busca otra!'),
              },
            ],
          },
        ],
      },
    ],
  },

  // ============================================================ IGUALDAD Y NO DISCRIMINACIÓN
  {
    id: 'igualdad',
    name: 'Derecho a la igualdad y no discriminación',
    short: 'Igualdad',
    color: COLORS.orange,
    icon: 'icon-igualdad',
    phrase: v(
      'der_igualdad_frase',
      'Todos los niños merecen respeto, sin importar sus diferencias.',
    ),
    explanation: [
      v(
        'der_igualdad_exp1',
        'Todas las niñas y niños merecen respeto, sin importar sus diferencias.',
      ),
      v(
        'der_igualdad_exp2',
        'Todos somos distintos y todos valemos lo mismo. ¡Nadie se queda afuera!',
      ),
    ],
    medal: {
      name: 'Guardián de la Igualdad',
      won: v(
        'der_igualdad_medalla',
        '¡Ganaste la medalla del Derecho a la igualdad y no discriminación!',
      ),
    },
    games: [
      level('parque', 'Parque para todos', 'icon-igualdad', 'Level05'),
      {
        kind: 'thumbs',
        id: 'respeto-si-no',
        title: 'Todos merecemos respeto',
        icon: 'icon-igualdad',
        intro: [
          v('igu_thumbs_intro1', 'Vamos a ver qué es respetar.'),
          v(
            'igu_thumbs_intro2',
            'Si está bien, toca la carita feliz. Si no está bien, la carita triste.',
          ),
        ],
        done: v('igu_choice_done', '¡Muy bien! Todas y todos merecemos respeto.'),
        cards: [
          {
            art: 'nina-silla',
            label: 'Invitar a Sofía a jugar',
            good: true,
            say: v('igu_thumbs_invitar', 'Invitar a Sofía a jugar con nosotros. ¿Está bien?'),
            hint: v('igu_thumbs_invitar_h', 'Todos podemos jugar juntos. ¡Está bien!'),
          },
          {
            art: 'nino-c',
            label: 'Burlarse de Lucas',
            good: false,
            say: v('igu_thumbs_burla', 'Burlarse de Lucas porque es diferente. ¿Está bien?'),
            hint: v('igu_thumbs_burla_h', 'Burlarse lastima. No está bien.'),
          },
          {
            art: 'trompo',
            label: 'Compartir los juguetes',
            good: true,
            say: v('igu_thumbs_compartir', 'Compartir los juguetes con todos. ¿Está bien?'),
            hint: v('igu_thumbs_compartir_h', 'Compartir es muy bonito. ¡Está bien!'),
          },
          {
            art: 'nino-a',
            label: 'No dejar jugar a Daniel',
            good: false,
            say: v(
              'igu_thumbs_excluir',
              'No dejar jugar a Daniel porque habla diferente. ¿Está bien?',
            ),
            hint: v('igu_thumbs_excluir_h', 'Todos merecemos jugar. Eso no está bien.'),
          },
          {
            art: 'abuela',
            label: 'Ayudar a la abuela',
            good: true,
            say: v('igu_thumbs_abuela', 'Ayudar a la abuela a cargar sus cosas. ¿Está bien?'),
            hint: v('igu_thumbs_abuela_h', 'Ayudar y respetar a los mayores está muy bien.'),
          },
        ],
      },
      {
        kind: 'give',
        id: 'juntos',
        title: 'Juntos es mejor',
        icon: 'icon-igualdad',
        intro: [
          v(
            'igu_give_intro1',
            'Todos tenemos derecho a jugar, aunque cada uno quiera algo distinto.',
          ),
          v('igu_give_intro2', 'Mira el globito de cada amigo y arrástrale su juguete.'),
        ],
        done: v('igu_give_done', '¡Nadie se quedó sin jugar! Juntos es mejor.'),
        friends: [
          {
            id: 'papalote',
            art: 'nina-silla',
            label: 'Quiere volar la piscucha',
            wants: { art: 'papalote', label: 'Piscucha' },
            hint: v(
              'igu_give_h_papalote',
              'Sofía quiere volar algo en el cielo. Busca la piscucha.',
            ),
          },
          {
            id: 'trompo',
            art: 'nino-c',
            label: 'Quiere bailar el trompo',
            wants: { art: 'trompo', label: 'Trompo' },
            hint: v('igu_give_h_trompo', 'Lucas quiere algo que gira y gira. Busca el trompo.'),
          },
          {
            id: 'balon',
            art: 'nino-a',
            label: 'Quiere jugar fútbol',
            wants: { art: 'balon', label: 'Balón' },
            hint: v('igu_give_h_balon', 'Daniel quiere patear con sus amigos. Busca el balón.'),
          },
          {
            id: 'carrito',
            art: 'nina-b',
            label: 'Quiere jugar con el carrito',
            wants: { art: 'carrito', label: 'Carrito' },
            hint: v('igu_give_h_carrito', 'Valentina quiere algo con ruedas. Busca el carrito.'),
          },
        ],
        extras: [
          {
            art: 'bloque-rojo',
            label: 'Bloques',
            hint: v('igu_give_bloques', 'Nadie pidió los bloques. Mira el globito de cada amigo.'),
          },
        ],
      },
    ],
    challenges: [
      {
        kind: 'maze',
        id: 'camino-rampas',
        title: 'Camino con rampas',
        icon: 'rampa',
        walker: 'nina-silla',
        goal: { art: 'arbol', label: 'Parque' },
        look: 'board',
        goalLook: 'gate',
        intro: [
          v(
            'igu_maze_intro',
            'Ayuda a Sofía a llegar al parque. Ella no puede subir escalones: ¡busca la rampa! Usa las flechas o toca una casilla brillante.',
          ),
        ],
        done: v(
          'igu_maze_done',
          '¡Sofía llegó al parque! Las rampas ayudan a que todos puedan llegar.',
        ),
        grid: ['S...e:::1', '#.213#4:1', '2..R:#5:1', '1.#2::::6', '1..e:3#:G'],
        dangers: {
          e: {
            art: 'escalones',
            label: 'Escalones',
            hint: v(
              'igu_maze_escalera',
              'Sofía no puede subir escalones con su silla. ¡Busca la rampa!',
            ),
          },
        },
        props: { R: { art: 'rampa-baranda', label: 'Rampa' } },
        legend: {
          title: 'Busca la rampa',
          items: [
            { art: 'rampa-baranda', label: 'Rampa', note: 'Sofía sí puede', ok: true },
            { art: 'escalones', label: 'Escalones', note: 'Sofía no puede', ok: false },
          ],
        },
        startLabel: 'Salida',
        moveLabel: 'Mueve a Sofía',
      },
      {
        kind: 'memory',
        id: 'amigos-diferentes',
        title: 'Amigos diferentes',
        icon: 'nino-a',
        intro: [
          v('igu_mem_intro1', 'Todos somos diferentes y todos valemos lo mismo.'),
          v('igu_mem_intro2', 'Encuentra las parejas de amigos iguales.'),
        ],
        done: v('igu_mem_done', '¡Encontraste a todos tus amigos! Todos somos importantes.'),
        items: [
          { id: 'nino-a', art: 'nino-a', label: 'Amigo' },
          { id: 'nina-b', art: 'nina-b', label: 'Amiga' },
          { id: 'nino-c', art: 'nino-c', label: 'Amigo' },
          { id: 'nina-silla', art: 'nina-silla', label: 'Amiga' },
          { id: 'abuela', art: 'abuela', label: 'Abuela' },
          { id: 'nino', art: 'nino', label: 'Amigo' },
        ],
        freeMismatches: 6,
        mismatchesPerError: 3,
        tryAgain: v('igu_mem_try', '¡Inténtalo otra vez! Recuerda dónde estaba cada amigo.'),
      },
      {
        kind: 'share',
        id: 'desafio-igualdad',
        title: 'Desafío final',
        icon: 'icon-igualdad',
        medal: true,
        look: 'table',
        intro: [
          v('igu_share_intro1', '¡Desafío final! Todos somos iguales y merecemos lo mismo.'),
          v('igu_share_intro2', 'Reparte las cosas. Nadie puede tener más que los demás.'),
        ],
        done: v('igu_final_done', '¡Lo lograste! Eres Guardián de la Igualdad.'),
        friends: [
          { art: 'nina-silla', label: 'Sofía' },
          { art: 'nino-a', label: 'Daniel' },
        ],
        unfair: v('igu_share_unfair', '¡Espera! Ese amigo ya tiene más. Todos merecen lo mismo.'),
        rounds: [
          {
            item: { art: 'crayon', label: 'Crayón' },
            count: 4,
            question: v('igu_share_q1', 'Reparte los crayones entre Sofía y Daniel.'),
          },
          {
            item: { art: 'cuento', label: 'Cuento' },
            count: 2,
            question: v('igu_share_q2', 'Ahora reparte los cuentos.'),
          },
          {
            item: { art: 'carrito', label: 'Carrito' },
            count: 6,
            question: v('igu_share_q3', 'Por último, reparte los carritos.'),
          },
        ],
      },
    ],
  },

  // ============================================================ JUGAR Y DESCANSAR
  {
    id: 'jugar',
    name: 'Derecho a jugar y descansar',
    short: 'Jugar',
    color: COLORS.sea,
    icon: 'icon-juego',
    phrase: v(
      'der_jugar_frase',
      'Tengo derecho a divertirme, descansar y disfrutar de mi infancia.',
    ),
    explanation: [
      v(
        'der_jugar_exp1',
        'Todas las niñas y niños tienen derecho a divertirse, descansar y disfrutar de su infancia.',
      ),
      v('der_jugar_exp2', 'Jugar nos hace felices, y descansar nos ayuda a crecer.'),
    ],
    medal: {
      name: 'Guardián del Juego',
      won: v('der_jugar_medalla', '¡Ganaste la medalla del Derecho a jugar y descansar!'),
    },
    games: [
      level('dia-noche', 'Día y noche', 'luna-grande', 'Level06'),
      {
        kind: 'catch',
        id: 'atrapa-juguetes',
        title: 'Atrapa los juguetes',
        icon: 'pelota',
        intro: [
          v('jugar_catch_intro1', 'Arrastra la caja de juguetes de un lado a otro.'),
          v('jugar_catch_intro2', 'Atrapa los juguetes. ¡Lo que no es juguete, déjalo caer!'),
        ],
        done: v('jugar_catch_done', '¡Tu caja está llena de juguetes! A jugar se ha dicho.'),
        catcher: 'caja-juguetes',
        goal: 6,
        good: [
          { art: 'pelota', label: 'Pelota' },
          { art: 'trompo', label: 'Trompo' },
          { art: 'papalote', label: 'Piscucha' },
          { art: 'carrito', label: 'Carrito' },
          { art: 'cuento', label: 'Cuento' },
        ],
        bad: [
          {
            art: 'tijeras',
            label: 'Tijeras',
            hint: v('jugar_catch_tijeras', '¡Cuidado! Las tijeras no son un juguete.'),
          },
          {
            art: 'vacuna',
            label: 'Vacuna',
            hint: v('jugar_catch_vacuna', 'La vacuna es de la doctora, no es un juguete.'),
          },
        ],
      },
      {
        kind: 'stack',
        id: 'torre-bloques',
        title: 'Torre de bloques',
        icon: 'bloque-rojo',
        intro: [
          v('jugar_stack_intro1', '¡Vamos a hacer una torre muy alta!'),
          v('jugar_stack_intro2', 'Toca cuando el bloque esté justo arriba de la torre.'),
        ],
        done: v('jugar_stack_done', '¡Torre terminada! Jugar a construir es muy divertido.'),
        pieces: [
          {
            art: 'bloque-rojo',
            label: 'Rojo',
            width: 150,
            say: v('jugar_stack_1', '¡El bloque rojo con estrella!'),
          },
          {
            art: 'bloque-azul',
            label: 'Azul',
            width: 135,
            say: v('jugar_stack_2', '¡El azul con círculo!'),
          },
          {
            art: 'bloque-verde',
            label: 'Verde',
            width: 120,
            say: v('jugar_stack_3', '¡El verde con triángulo!'),
          },
          {
            art: 'bloque-amarillo',
            label: 'Amarillo',
            width: 105,
            say: v('jugar_stack_4', '¡El amarillo con corazón!'),
          },
        ],
      },
    ],
    challenges: [
      {
        kind: 'simon',
        id: 'repite-juego',
        title: 'Repite el juego',
        icon: 'trompo',
        intro: [
          v('jugar_simon_intro1', 'Los juguetes quieren jugar contigo.'),
          v('jugar_simon_intro2', 'Mira cuáles se iluminan y repítelos.'),
        ],
        done: v('jugar_simon_done', '¡Qué buena memoria! Jugar nos ayuda a pensar.'),
        pads: [
          { art: 'pelota', label: 'Pelota' },
          { art: 'trompo', label: 'Trompo' },
          { art: 'papalote', label: 'Piscucha' },
          { art: 'carrito', label: 'Carrito' },
        ],
        lengths: [2, 3, 4],
        watch: v('jugar_simon_watch', 'Mira y escucha los juguetes.'),
        yourTurn: v('jugar_simon_turn', '¡Tu turno! Tócalos en el mismo orden.'),
        retry: v('jugar_simon_retry', '¡Casi! Mira otra vez.'),
      },
      {
        kind: 'runner',
        id: 'carrera-parque',
        title: 'Carrera en el parque',
        icon: 'nina-b',
        runner: 'nina-b',
        goal: 6,
        intro: [
          v('jugar_run_intro1', '¡A jugar en el parque!'),
          v(
            'jugar_run_intro2',
            'Toca para saltar. Junta los juguetes y salta los charcos y las piedras.',
          ),
        ],
        done: v('jugar_run_done', '¡Qué divertido! Jugar y correr es nuestro derecho.'),
        good: [
          { art: 'pelota', label: 'Pelota' },
          { art: 'papalote', label: 'Piscucha' },
          { art: 'trompo', label: 'Trompo' },
          { art: 'carrito', label: 'Carrito' },
        ],
        bad: [
          {
            art: 'charco',
            label: 'Charco',
            hint: v('jugar_run_charco', '¡Salta el charco! Toca para saltar.'),
          },
          {
            art: 'piedra',
            label: 'Piedra',
            hint: v('jugar_run_piedra', '¡Salta la piedra! Toca para saltar.'),
          },
        ],
      },
      {
        kind: 'board',
        id: 'desafio-juego',
        title: 'Desafío final',
        icon: 'icon-juego',
        medal: true,
        intro: [
          v('jugar_board_intro', '¡Desafío final! Toca el dado y responde en cada estrella.'),
        ],
        done: v('jugar_final_done', '¡Lo lograste! Eres Guardián del Juego.'),
        rounds: [
          {
            question: v('jugar_final_q1', '¿Con qué jugamos?'),
            options: [
              {
                id: 'tijeras',
                art: 'tijeras',
                label: 'Tijeras',
                correct: false,
                hint: v('jugar_final_h1', 'Las tijeras no son juguete. ¡Inténtalo otra vez!'),
              },
              { id: 'trompo', art: 'trompo', label: 'Trompo', correct: true },
              {
                id: 'termometro',
                art: 'termometro',
                label: 'Termómetro',
                correct: false,
                hint: v('jugar_final_h1b', 'El termómetro es para la fiebre. ¡Inténtalo otra vez!'),
              },
            ],
          },
          {
            question: v('jugar_final_q2', 'Ya es de noche. ¿Qué hacemos?'),
            options: [
              { id: 'dormir', art: 'camita', label: 'Dormir', correct: true },
              {
                id: 'papalote',
                art: 'papalote',
                label: 'Volar piscucha',
                correct: false,
                hint: v('jugar_final_h2', 'De noche descansamos. ¡Inténtalo otra vez!'),
              },
              {
                id: 'tarde',
                art: 'dormir-tarde',
                label: 'Desvelarnos',
                correct: false,
                hint: v('jugar_final_h2b', 'Desvelarnos nos cansa. ¡Inténtalo otra vez!'),
              },
            ],
          },
          {
            question: v('jugar_final_q3', '¿Con quién podemos jugar? Toca a todos.'),
            options: [
              { id: 'nino-a', art: 'nino-a', label: 'Amigo', correct: true },
              { id: 'nina-silla', art: 'nina-silla', label: 'Amiga', correct: true },
              { id: 'perrito', art: 'perrito', label: 'Perrito', correct: true },
            ],
          },
        ],
      },
    ],
  },

  // ============================================================ EXPRESAR OPINIONES
  {
    id: 'opinion',
    name: 'Derecho a expresar sus opiniones',
    short: 'Opinión',
    color: COLORS.grass,
    icon: 'icon-opinion',
    phrase: v('der_opinion_frase', 'Puedo expresar lo que siento y pienso, y ser escuchado.'),
    explanation: [
      v(
        'der_opinion_exp1',
        'Todas las niñas y niños pueden expresar lo que sienten y piensan, además de ser escuchados.',
      ),
      v('der_opinion_exp2', 'Tu voz es importante. ¡Dila con confianza!'),
    ],
    medal: {
      name: 'Guardián de Mi Voz',
      won: v('der_opinion_medalla', '¡Ganaste la medalla del Derecho a expresar sus opiniones!'),
    },
    games: [
      level('mi-voz', 'Mi voz cuenta', 'icon-opinion', 'Level07'),
      {
        kind: 'talk',
        id: 'ronda-ideas',
        title: 'La ronda de ideas',
        icon: 'mano-arriba',
        kids: ['nino', 'nina-b', 'nino-a', 'nino-c'],
        intro: [
          v(
            'opi_talk_intro',
            '¡Hoy hacemos una ronda de ideas en el salón! Son tres niveles, cada uno diferente.',
          ),
        ],
        hands: {
          title: 'Levanta la mano',
          board: '¿A qué jugamos en el recreo?',
          explain: v(
            'opi_talk_l1',
            'En este nivel damos la palabra. Toca al amigo que levanta la mano para darle el micrófono.',
          ),
          notRaised: v(
            'opi_talk_l1_no',
            'Ese amigo no levantó la mano. Toca al que tiene la mano arriba.',
          ),
          ideas: [
            { art: 'pelota', line: v('opi_talk_idea_pelota', '¡Yo digo que juguemos pelota!') },
            { art: 'papalote', line: v('opi_talk_idea_piscucha', '¡Yo quiero volar la piscucha!') },
            {
              art: 'bloque-rojo',
              line: v('opi_talk_idea_bloques', '¡A mí me gustaría armar torres de bloques!'),
            },
            { art: 'trompo', line: v('opi_talk_idea_trompo', '¡Yo propongo jugar trompo!') },
          ],
          done: v(
            'opi_talk_l1_ok',
            '¡Todos dieron su idea! Levantar la mano ayuda a que todos puedan hablar.',
          ),
        },
        listen: {
          title: 'Escucho sin interrumpir',
          board: 'Escuchamos a nuestra amiga',
          explain: v(
            'opi_talk_l2',
            'Ahora una amiga cuenta su idea. Si alguien la interrumpe gritando, tócalo para que espere su turno.',
          ),
          shout: '¡Yo, yo!',
          calm: v('opi_talk_turno', 'Espera tu turno con la mano arriba.'),
          missed: v('opi_talk_l2_miss', '¡Uy! La interrumpieron. Toca rápido al amigo que grita.'),
          notThat: v('opi_talk_l2_no', 'Ese amigo está escuchando. Toca al que grita.'),
          speech: v(
            'opi_talk_l2_idea',
            'Mi idea es que juguemos todos juntos, para que nadie se quede solo.',
          ),
          done: v(
            'opi_talk_l2_ok',
            '¡Muy bien! Escuchamos sin interrumpir, y así todos se sienten escuchados.',
          ),
        },
        speak: {
          title: 'Mi turno de hablar',
          board: '¿Qué piensas tú?',
          explain: v(
            'opi_talk_l3',
            '¡Ahora es tu turno de hablar! Escoge la mejor forma de decir lo que piensas.',
          ),
          rounds: [
            {
              question: v(
                'opi_talk_q1',
                'Tus amigos quieren jugar pelota, pero tú quieres jugar con bloques. ¿Qué dices?',
              ),
              right: v('opi_talk_q1_ok', '¡Muy bien! Dijiste tu idea con respeto.'),
              options: [
                {
                  art: 'bloque-rojo',
                  label: 'Yo pienso que después podemos jugar bloques',
                  good: true,
                },
                {
                  art: 'cara-enojada',
                  label: '¡La pelota es aburrida!',
                  good: false,
                  hint: v(
                    'opi_talk_q1_no',
                    'Así tus amigos se sienten mal. Di lo que piensas con respeto.',
                  ),
                },
                {
                  art: 'cara-triste',
                  label: 'Me quedo callado',
                  good: false,
                  hint: v('opi_talk_callar', '¡Tu opinión importa! Dila con confianza.'),
                },
              ],
            },
            {
              question: v(
                'opi_talk_q2',
                'Un amigo tiene una idea diferente a la tuya. ¿Qué haces?',
              ),
              right: v('opi_talk_q2_ok', '¡Eso es! Escuchar también es respetar.'),
              options: [
                {
                  art: 'cara-enojada',
                  label: 'Me burlo de su idea',
                  good: false,
                  hint: v(
                    'opi_talk_q2_no',
                    'Burlarse no está bien. Todas las ideas merecen respeto.',
                  ),
                },
                { art: 'cara-tranquila', label: 'Lo escucho y respeto su idea', good: true },
              ],
            },
            {
              question: v('opi_talk_q3', 'Algo te pone triste en la escuela. ¿Qué haces?'),
              right: v(
                'opi_talk_q3_ok',
                '¡Muy bien! Los adultos de confianza te escuchan y te ayudan.',
              ),
              options: [
                { art: 'mama', label: 'Se lo cuento a un adulto de confianza', good: true },
                {
                  art: 'cara-triste',
                  label: 'Me lo guardo y no digo nada',
                  good: false,
                  hint: v(
                    'opi_talk_q3_no',
                    'Lo que sientes es importante. Cuéntaselo a un adulto que te quiere.',
                  ),
                },
              ],
            },
          ],
          done: v('opi_talk_l3_ok', '¡Dijiste lo que piensas con confianza y con respeto!'),
        },
        done: v('opi_talk_done', '¡Lo lograste! Tu voz es importante, y la de tus amigos también.'),
      },
      {
        kind: 'vote',
        id: 'votamos-juntos',
        title: 'Votamos juntos',
        icon: 'urna',
        intro: [
          v('opi_vote_intro1', '¡Hoy votamos en el salón! Tú eliges y tus amigos también.'),
          v('opi_vote_intro2', 'Gana lo que elijan más amigos.'),
        ],
        done: v(
          'opi_vote_done',
          '¡Muy bien! Al votar, todos damos nuestra opinión y respetamos lo que elige la mayoría.',
        ),
        rounds: [
          {
            question: v('opi_vote_q1', '¿A qué jugamos en el recreo? Toca lo que tú prefieras.'),
            options: [
              { id: 'pelota', art: 'pelota', label: 'Pelota' },
              { id: 'papalote', art: 'papalote', label: 'Piscucha' },
            ],
            friendVotes: [0, 1, 0, 0],
          },
          {
            question: v('opi_vote_q2', '¿Qué fruta comemos en la merienda? Toca la que prefieras.'),
            options: [
              { id: 'mango', art: 'mango', label: 'Mango' },
              { id: 'guineo', art: 'guineo', label: 'Guineo' },
            ],
            friendVotes: [1, 1, 0, 1],
          },
          {
            question: v('opi_vote_q3', '¿Qué hacemos hoy en clase? ¡Tu voto decide!'),
            options: [
              { id: 'dibujar', art: 'crayon', label: 'Dibujar' },
              { id: 'leer', art: 'cuento', label: 'Leer un cuento' },
            ],
            friendVotes: [0, 1, 1, 0],
          },
        ],
      },
    ],
    challenges: [
      {
        kind: 'match',
        id: 'como-se-siente',
        title: '¿Cómo se siente?',
        icon: 'cara-feliz',
        intro: [
          v('op_match_intro1', 'Todos sentimos cosas, y está bien decirlo.'),
          v('op_match_intro2', 'Une cada cosa con la carita de cómo nos sentimos.'),
        ],
        done: v(
          'op_match_done',
          '¡Muy bien! Decir lo que sentimos también es dar nuestra opinión.',
        ),
        pairs: [
          {
            id: 'feliz',
            left: { art: 'pelota', label: 'Jugar con amigos' },
            right: { art: 'cara-feliz', label: 'Feliz' },
            hint: v('op_match_feliz', 'Jugar con amigos nos pone felices.'),
          },
          {
            id: 'miedo',
            left: { art: 'nube-gris', label: 'Truenos' },
            right: { art: 'cara-asustada', label: 'Con miedo' },
            hint: v('op_match_miedo', 'Los truenos nos pueden dar miedo.'),
          },
          {
            id: 'triste',
            left: { art: 'nino-enfermo', label: 'Estar enfermo' },
            right: { art: 'cara-triste', label: 'Triste' },
            hint: v('op_match_triste', 'Cuando estamos enfermos, nos sentimos tristes.'),
          },
          {
            id: 'tranquilo',
            left: { art: 'cuento', label: 'Un cuento' },
            right: { art: 'cara-tranquila', label: 'Tranquilo' },
            hint: v('op_match_tranquilo', 'Un cuento antes de dormir nos da calma.'),
          },
        ],
      },
      {
        kind: 'thumbs',
        id: 'hablo-escucho',
        title: 'Hablo y escucho',
        icon: 'mano-arriba',
        intro: [
          v(
            'op_thumbs_intro1',
            'Para dar nuestra opinión, hablamos con respeto y escuchamos a los demás.',
          ),
          v(
            'op_thumbs_intro2',
            'Si está bien, toca la carita feliz. Si no está bien, toca la carita triste.',
          ),
        ],
        done: v(
          'op_thumbs_done',
          '¡Muy bien! Cuando hablamos con respeto y escuchamos, todos podemos opinar.',
        ),
        cards: [
          {
            art: 'mano-arriba',
            label: 'Levantar la mano para hablar',
            good: true,
            say: v(
              'op_thumbs_mano',
              'Levantar la mano para pedir la palabra. ¿Está bien o no está bien?',
            ),
            hint: v(
              'op_thumbs_mano_h',
              'Levantar la mano es pedir la palabra con respeto. ¡Está bien!',
            ),
          },
          {
            art: 'cara-enojada',
            label: 'Gritar para que me escuchen',
            good: false,
            say: v('op_thumbs_gritar', 'Gritar para que me escuchen. ¿Está bien o no está bien?'),
            hint: v(
              'op_thumbs_gritar_h',
              'Gritar no ayuda. Hablamos con calma para que nos escuchen.',
            ),
          },
          {
            art: 'nina-b',
            label: 'Escuchar a mi amiga cuando habla',
            good: true,
            say: v(
              'op_thumbs_escuchar',
              'Escuchar a mi amiga cuando habla. ¿Está bien o no está bien?',
            ),
            hint: v(
              'op_thumbs_escuchar_h',
              'Escuchar a los demás es respetar su opinión. ¡Está bien!',
            ),
          },
          {
            art: 'cara-triste',
            label: 'Burlarse de la idea de un amigo',
            good: false,
            say: v(
              'op_thumbs_burla',
              'Burlarse de la idea de un amigo. ¿Está bien o no está bien?',
            ),
            hint: v('op_thumbs_burla_h', 'Burlarse lastima. Todas las ideas merecen respeto.'),
          },
          {
            art: 'nino-a',
            label: 'Decir lo que siento con palabras',
            good: true,
            say: v(
              'op_thumbs_decir',
              'Decir lo que siento con palabras. ¿Está bien o no está bien?',
            ),
            hint: v('op_thumbs_decir_h', 'Decir lo que sentimos con palabras está muy bien.'),
          },
        ],
      },
      {
        kind: 'sequence',
        id: 'desafio-opinion',
        numbered: true,
        title: 'Desafío final',
        icon: 'icon-opinion',
        medal: true,
        intro: [
          v('op_seq_intro1', '¡Desafío final! ¿Cómo damos nuestra opinión?'),
          v('op_seq_intro2', 'Ordena los pasos. ¿Qué va primero?'),
        ],
        done: v('opi_final_done', '¡Lo lograste! Eres Guardián de Mi Voz.'),
        steps: [
          {
            id: 'escuchar',
            art: 'nina-b',
            label: 'Escucho',
            hint: v('op_seq_escuchar', 'Primero escucho a los demás.'),
          },
          {
            id: 'mano',
            art: 'mano-arriba',
            label: 'Alzo la mano',
            hint: v('op_seq_mano', 'Después alzo la mano.'),
          },
          {
            id: 'hablar',
            art: 'icon-opinion',
            label: 'Digo mi idea',
            hint: v('op_seq_hablar', 'Luego digo lo que pienso.'),
          },
          {
            id: 'votar',
            art: 'urna',
            label: 'Votamos',
            hint: v('op_seq_votar', 'Al final votamos todos juntos.'),
          },
        ],
      },
    ],
  },
];

export function getRightArea(id: string): RightArea {
  const r = RIGHT_AREAS.find((x) => x.id === id);
  if (!r) throw new Error(`Derecho desconocido: ${id}`);
  return r;
}

export function isPlayable(a: Activity): a is PlayableActivity {
  return a.kind !== 'soon';
}

export function findActivity(
  right: RightArea,
  activityId: string,
): { activity: PlayableActivity; isChallenge: boolean } {
  const g = right.games.find((a) => a.id === activityId);
  if (g && isPlayable(g)) return { activity: g, isChallenge: false };
  const c = right.challenges.find((a) => a.id === activityId);
  if (c && isPlayable(c)) return { activity: c, isChallenge: true };
  throw new Error(`Actividad desconocida: ${right.id}/${activityId}`);
}
