import type { ArtKey } from '@/art/Art';
import type { LevelSceneKey, VoiceLine } from './levels';
import { COLORS } from './theme';
import type { LazySceneKey } from '@/core/SceneRegistry';

/**
 * "Villa de los Derechos": cada derecho tiene explicación, JUEGOS y DESAFÍOS (data-driven).
 * Los minijuegos usan 4 motores reutilizables (escenas genéricas):
 *   sort      → arrastrar cada cosa a su grupo (p. ej. carita feliz / triste)
 *   sequence  → ordenar pasos en su número (1, 2, 3…)
 *   memory    → memorama de parejas iguales
 *   choice    → elegir la(s) respuesta(s) correcta(s) en una o varias preguntas
 * Para completar un derecho "próximamente", reemplaza { kind: 'soon' } por una actividad.
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
  bins: { id: string; art: ArtKey; label: string }[];
  items: { id: string; art: ArtKey; label: string; bin: string; hint: VoiceLine }[];
}

export interface SequenceActivity extends ActivityBase {
  kind: 'sequence';
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
  /** Personaje que acompaña la pregunta (p. ej. el osito enfermo). */
  character?: ArtKey;
  rounds: { question: VoiceLine; options: ChoiceOption[] }[];
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

export type EngineActivity = SortActivity | SequenceActivity | MemoryActivity | ChoiceActivity;
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
} as const;

const soon = (id: string, title: string, icon: ArtKey): SoonActivity => ({
  kind: 'soon',
  id,
  title,
  icon,
});
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
      won: v('der_salud_medalla', '¡Ganaste la medalla Guardián de la Salud!'),
    },
    games: [
      {
        kind: 'sort',
        id: 'sano-no-sano',
        title: '¿Sano o no sano?',
        icon: 'cara-feliz',
        intro: [
          v(
            'salud_sort_intro',
            'Lleva lo que es sano a la carita feliz, y lo que no es sano a la carita triste.',
          ),
        ],
        done: v('salud_sort_done', '¡Muy bien! Ya sabes qué nos ayuda a estar sanos.'),
        bins: [SANO, NO_SANO],
        items: [
          {
            id: 'fruta',
            art: 'mango',
            label: 'Fruta',
            bin: 'sano',
            hint: v('salud_sort_fruta', 'La fruta nos da vitaminas. Llévala a la carita feliz.'),
          },
          {
            id: 'dulces',
            art: 'dulces',
            label: 'Muchos dulces',
            bin: 'nosano',
            hint: v(
              'salud_sort_dulces',
              'Muchos dulces dañan los dientes. Llévalos a la carita triste.',
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
            hint: v('salud_sort_tarde', 'Dormir tarde nos deja cansados. Va con la carita triste.'),
          },
          {
            id: 'agua',
            art: 'agua',
            label: 'Tomar agua',
            bin: 'sano',
            hint: v('salud_sort_agua', 'El agua nos mantiene sanos. Llévala a la carita feliz.'),
          },
          {
            id: 'soda',
            art: 'soda',
            label: 'Mucha soda',
            bin: 'nosano',
            hint: v('salud_sort_soda', 'La soda tiene mucha azúcar. Va con la carita triste.'),
          },
          {
            id: 'cepillo',
            art: 'cepillo',
            label: 'Cepillarse',
            bin: 'sano',
            hint: v('salud_sort_cepillo', 'Cepillarnos los dientes es muy sano. ¡Carita feliz!'),
          },
          {
            id: 'papitas',
            art: 'papitas',
            label: 'Muchas papitas',
            bin: 'nosano',
            hint: v(
              'salud_sort_papitas',
              'Las papitas tienen mucha sal. Van con la carita triste.',
            ),
          },
        ],
      },
      {
        kind: 'sequence',
        id: 'lava-manos',
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
      level('clinica', 'Clínica de Tori', 'osito-enfermo', 'Level03'),
    ],
    challenges: [
      {
        kind: 'sequence',
        id: 'dia-saludable',
        title: 'Mi día saludable',
        icon: 'despertador',
        intro: [v('salud_dia_intro', 'Ordena tu día saludable. ¿Qué hacemos primero?')],
        done: v('salud_dia_done', '¡Qué día tan saludable!'),
        steps: [
          {
            id: 'despertar',
            art: 'despertador',
            label: 'Despertar',
            hint: v('salud_dia_despertar', 'Primero nos despertamos.'),
          },
          {
            id: 'desayunar',
            art: 'desayuno',
            label: 'Desayunar',
            hint: v('salud_dia_desayunar', 'Después desayunamos rico.'),
          },
          {
            id: 'cepillarse',
            art: 'cepillo',
            label: 'Cepillarse',
            hint: v('salud_dia_cepillarse', 'Luego nos cepillamos los dientes.'),
          },
          {
            id: 'jugar',
            art: 'pelota',
            label: 'Jugar',
            hint: v('salud_dia_jugar', 'Después jugamos un rato.'),
          },
          {
            id: 'dormir',
            art: 'camita',
            label: 'Dormir',
            hint: v('salud_dia_dormir', 'Al final del día, dormimos.'),
          },
        ],
      },
      {
        kind: 'choice',
        id: 'ayuda-amigo',
        title: 'Ayuda a tu amigo',
        icon: 'osito-enfermo',
        character: 'osito-enfermo',
        intro: [v('salud_amigo_intro', 'Mi amigo Osito está enfermo. ¿Qué debe hacer?')],
        done: v(
          'salud_amigo_done',
          '¡Gracias por ayudar a Osito! Cuando alguien está enfermo, avisamos a un adulto.',
        ),
        rounds: [
          {
            question: v('salud_amigo_q', 'Toca las tres cosas que ayudan a Osito.'),
            options: [
              { id: 'adulto', art: 'mama', label: 'Decirle a un adulto', correct: true },
              {
                id: 'dulces',
                art: 'dulces',
                label: 'Comer dulces',
                correct: false,
                hint: v('salud_amigo_dulces', 'Los dulces no curan. ¡Inténtalo otra vez!'),
              },
              { id: 'doctor', art: 'doctora', label: 'Ir al doctor', correct: true },
              {
                id: 'lluvia',
                art: 'pelota',
                label: 'Jugar en la lluvia',
                correct: false,
                hint: v(
                  'salud_amigo_lluvia',
                  'Si está enfermo, mejor que no salga a la lluvia. ¡Inténtalo otra vez!',
                ),
              },
              { id: 'descansar', art: 'camita', label: 'Descansar', correct: true },
              {
                id: 'soda',
                art: 'soda',
                label: 'Tomar soda',
                correct: false,
                hint: v('salud_amigo_soda', 'La soda no lo ayuda. Busca algo que lo cuide.'),
              },
            ],
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
      won: v('der_educacion_medalla', '¡Ganaste la medalla Guardián del Saber!'),
    },
    games: [
      level('rompecabezas', 'Rompecabezas escolar', 'mochila', 'Level04'),
      {
        kind: 'memory',
        id: 'utiles',
        title: 'Útiles escolares',
        icon: 'lapiz',
        intro: [v('edu_mem_intro', 'Encuentra las parejas de útiles escolares.')],
        done: v('edu_mem_done', '¡Ya tienes todo para ir a la escuela!'),
        items: [
          { id: 'lapiz', art: 'lapiz', label: 'Lápiz' },
          { id: 'cuaderno', art: 'cuaderno', label: 'Cuaderno' },
          { id: 'tijeras', art: 'tijeras', label: 'Tijeras' },
          { id: 'mochila', art: 'mochila', label: 'Mochila' },
          { id: 'crayon', art: 'crayon', label: 'Crayón' },
          { id: 'libro', art: 'icon-educacion', label: 'Libro' },
        ],
        freeMismatches: 6,
        mismatchesPerError: 3,
        tryAgain: v('edu_mem_try', '¡Inténtalo otra vez!'),
      },
      level('memorama-derechos', 'Memorama de derechos', 'icon-isla', 'Level08'),
    ],
    challenges: [
      soon('edu-d1', 'Desafío 1', 'mochila'),
      soon('edu-d2', 'Desafío 2', 'lapiz'),
      soon('edu-final', 'Desafío final', 'icon-educacion'),
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
      won: v('der_vida_medalla', '¡Ganaste la medalla Guardián de la Vida!'),
    },
    games: [
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
                label: 'Volando papalote',
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
      soon('vida-2', 'Mi cuerpo es importante', 'icon-vida'),
      soon('vida-3', 'Lugares seguros', 'icon-vivienda'),
    ],
    challenges: [
      soon('vida-d1', 'Desafío 1', 'mama'),
      soon('vida-d2', 'Desafío 2', 'vacuna'),
      soon('vida-final', 'Desafío final', 'icon-vida'),
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
      name: 'Guardián de la Buena Comida',
      won: v('der_alimentacion_medalla', '¡Ganaste la medalla Guardián de la Buena Comida!'),
    },
    games: [
      {
        kind: 'sort',
        id: 'plato-sano',
        title: 'Plato sano',
        icon: 'verduras',
        intro: [
          v(
            'ali_sort_intro',
            'Lleva la comida sana a la carita feliz, y la que no es tan sana a la carita triste.',
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
            hint: v('ali_sort_mango', 'El mango es una fruta rica y sana. ¡Carita feliz!'),
          },
          {
            id: 'soda',
            art: 'soda',
            label: 'Soda',
            bin: 'nosano',
            hint: v('ali_sort_soda', 'La soda tiene mucha azúcar. Va con la carita triste.'),
          },
          {
            id: 'frijoles',
            art: 'frijoles',
            label: 'Frijoles',
            bin: 'sano',
            hint: v('ali_sort_frijoles', 'Los frijoles nos dan fuerza. ¡Carita feliz!'),
          },
          {
            id: 'dulces',
            art: 'dulces',
            label: 'Dulces',
            bin: 'nosano',
            hint: v(
              'ali_sort_dulces',
              'Los dulces son solo de vez en cuando. Van con la carita triste.',
            ),
          },
          {
            id: 'leche',
            art: 'leche',
            label: 'Leche',
            bin: 'sano',
            hint: v('ali_sort_leche', 'La leche cuida nuestros huesos. ¡Carita feliz!'),
          },
          {
            id: 'papitas',
            art: 'papitas',
            label: 'Papitas',
            bin: 'nosano',
            hint: v('ali_sort_papitas', 'Las papitas tienen mucha sal. Van con la carita triste.'),
          },
          {
            id: 'verduras',
            art: 'verduras',
            label: 'Verduras',
            bin: 'sano',
            hint: v('ali_sort_verduras', 'Las verduras nos dan vitaminas. ¡Carita feliz!'),
          },
          {
            id: 'guineo',
            art: 'guineo',
            label: 'Guineo',
            bin: 'sano',
            hint: v('ali_sort_guineo', 'El guineo nos da energía. ¡Carita feliz!'),
          },
        ],
      },
      level('lonchera', 'Lonchera nutritiva', 'lonchera', 'Level02'),
      soon('ali-3', 'Mercado de frutas', 'guineo'),
    ],
    challenges: [
      soon('ali-d1', 'Desafío 1', 'leche'),
      soon('ali-d2', 'Desafío 2', 'mango'),
      soon('ali-final', 'Desafío final', 'icon-alimentacion'),
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
      won: v('der_vivienda_medalla', '¡Ganaste la medalla Guardián del Hogar!'),
    },
    games: [
      level('casa-segura', 'Casa segura', 'icon-vivienda', 'Level01'),
      {
        kind: 'memory',
        id: 'mi-familia',
        title: 'Mi hogar y mi familia',
        icon: 'mama',
        intro: [v('fam_mem_intro', 'Encuentra las parejas de la familia y el hogar.')],
        done: v('fam_mem_done', '¡Qué bonito hogar!'),
        items: [
          { id: 'mama', art: 'mama', label: 'Mamá' },
          { id: 'papa', art: 'papa', label: 'Papá' },
          { id: 'abuela', art: 'abuela', label: 'Abuela' },
          { id: 'hermano', art: 'nino', label: 'Hermano' },
          { id: 'hogar', art: 'icon-vivienda', label: 'Hogar' },
          { id: 'carino', art: 'icon-vida', label: 'Cariño' },
        ],
        freeMismatches: 6,
        mismatchesPerError: 3,
        tryAgain: v('fam_mem_try', '¡Inténtalo otra vez!'),
      },
      soon('viv-3', 'Arma tu cuarto', 'camita'),
    ],
    challenges: [
      soon('viv-d1', 'Desafío 1', 'paredes'),
      soon('viv-d2', 'Desafío 2', 'techo'),
      soon('viv-final', 'Desafío final', 'icon-vivienda'),
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
      won: v('der_igualdad_medalla', '¡Ganaste la medalla Guardián de la Igualdad!'),
    },
    games: [
      level('parque', 'Parque para todos', 'icon-igualdad', 'Level05'),
      {
        kind: 'choice',
        id: 'todos-respeto',
        title: 'Todos merecemos respeto',
        icon: 'nina-silla',
        intro: [v('igu_choice_intro', 'Vamos a ver quiénes merecen respeto.')],
        done: v('igu_choice_done', '¡Muy bien! Todas y todos merecemos respeto.'),
        rounds: [
          {
            question: v('igu_q1', '¿Quiénes pueden jugar en el parque? Toca a todos.'),
            options: [
              { id: 'camila', art: 'nina-b', label: 'Camila', correct: true },
              { id: 'jose', art: 'nino-a', label: 'José', correct: true },
              { id: 'sofia', art: 'nina-silla', label: 'Sofía', correct: true },
              { id: 'daniel', art: 'nino-c', label: 'Daniel', correct: true },
            ],
          },
          {
            question: v('igu_q2', '¿Quiénes merecen respeto? Toca a todos.'),
            options: [
              { id: 'abuela', art: 'abuela', label: 'Abuela', correct: true },
              { id: 'nino', art: 'nino', label: 'Niño', correct: true },
              { id: 'doctora', art: 'doctora', label: 'Doctora', correct: true },
            ],
          },
        ],
      },
      soon('igu-3', 'Juntos es mejor', 'icon-igualdad'),
    ],
    challenges: [
      soon('igu-d1', 'Desafío 1', 'nina-b'),
      soon('igu-d2', 'Desafío 2', 'nino-a'),
      soon('igu-final', 'Desafío final', 'icon-igualdad'),
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
      won: v('der_jugar_medalla', '¡Ganaste la medalla Guardián del Juego!'),
    },
    games: [
      {
        kind: 'sort',
        id: 'jugar-descansar',
        title: '¿Jugar o descansar?',
        icon: 'pelota',
        intro: [
          v(
            'jugar_sort_intro',
            'Lleva lo que usamos para jugar al sol, y lo que usamos para descansar a la luna.',
          ),
        ],
        done: v('jugar_sort_done', '¡Muy bien! Jugar y descansar nos hace felices.'),
        bins: [
          { id: 'dia', art: 'sol', label: 'Jugar' },
          { id: 'noche', art: 'luna-grande', label: 'Descansar' },
        ],
        items: [
          {
            id: 'pelota',
            art: 'pelota',
            label: 'Pelota',
            bin: 'dia',
            hint: v('jugar_sort_pelota', 'La pelota es para jugar. Llévala con el sol.'),
          },
          {
            id: 'pijama',
            art: 'pijama',
            label: 'Pijama',
            bin: 'noche',
            hint: v('jugar_sort_pijama', 'La pijama es para dormir. Llévala con la luna.'),
          },
          {
            id: 'papalote',
            art: 'papalote',
            label: 'Papalote',
            bin: 'dia',
            hint: v('jugar_sort_papalote', 'El papalote es para jugar. Llévalo con el sol.'),
          },
          {
            id: 'cama',
            art: 'camita',
            label: 'Cama',
            bin: 'noche',
            hint: v('jugar_sort_cama', 'En la cama descansamos. Llévala con la luna.'),
          },
          {
            id: 'trompo',
            art: 'trompo',
            label: 'Trompo',
            bin: 'dia',
            hint: v('jugar_sort_trompo', 'El trompo es para jugar. Llévalo con el sol.'),
          },
          {
            id: 'cuento',
            art: 'cuento',
            label: 'Cuento',
            bin: 'noche',
            hint: v(
              'jugar_sort_cuento',
              'El cuento lo leemos antes de dormir. Llévalo con la luna.',
            ),
          },
        ],
      },
      level('dia-noche', 'Día y noche', 'luna-grande', 'Level06'),
      soon('jugar-3', 'Mis juguetes', 'trompo'),
    ],
    challenges: [
      soon('jugar-d1', 'Desafío 1', 'pelota'),
      soon('jugar-d2', 'Desafío 2', 'papalote'),
      soon('jugar-final', 'Desafío final', 'icon-juego'),
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
      won: v('der_opinion_medalla', '¡Ganaste la medalla Guardián de Mi Voz!'),
    },
    games: [
      level('mi-voz', 'Mi voz cuenta', 'icon-opinion', 'Level07'),
      soon('opi-2', 'Te escucho', 'icon-opinion'),
      soon('opi-3', 'Votamos juntos', 'urna'),
    ],
    challenges: [
      soon('opi-d1', 'Desafío 1', 'cara-feliz'),
      soon('opi-d2', 'Desafío 2', 'perrito'),
      soon('opi-final', 'Desafío final', 'icon-opinion'),
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
