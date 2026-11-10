import type { ArtKey } from '@/art/Art';
import { COLORS } from './theme';

/**
 * Datos de todos los niveles (data-driven).
 * Cada nivel define: mecánica, objetos, respuestas, diálogos de Tori, pistas amables y mensaje final.
 * Las escenas solo leen estos datos: cambiar textos, objetos o respuestas no requiere tocar el motor.
 *
 * Cada VoiceLine tiene un `id`: si existe src/assets/audio/voice/<id>.mp3 se reproduce la grabación;
 * si no, Tori usa la voz sintética del navegador con el mismo texto.
 */

export interface VoiceLine {
  id: string;
  text: string;
}

const v = (id: string, text: string): VoiceLine => ({ id, text });

export type RightId =
  'vivienda' | 'vida' | 'alimentacion' | 'salud' | 'educacion' | 'igualdad' | 'juego' | 'opinion';

export interface RightDef {
  id: RightId;
  name: string;
  summary: string;
  icon: ArtKey;
}

export const RIGHTS: Record<RightId, RightDef> = {
  vivienda: {
    id: 'vivienda',
    name: 'Derecho a la vivienda',
    summary: 'Tener un hogar seguro.',
    icon: 'icon-vivienda',
  },
  vida: {
    id: 'vida',
    name: 'Derecho a la vida',
    summary: 'Vivir protegidos y cuidados.',
    icon: 'icon-vida',
  },
  alimentacion: {
    id: 'alimentacion',
    name: 'Derecho a la alimentación',
    summary: 'Comer rico y nutritivo.',
    icon: 'icon-alimentacion',
  },
  salud: {
    id: 'salud',
    name: 'Derecho a la salud',
    summary: 'Recibir cuidados cuando enfermamos.',
    icon: 'icon-salud',
  },
  educacion: {
    id: 'educacion',
    name: 'Derecho a la educación',
    summary: 'Ir a la escuela y aprender.',
    icon: 'icon-educacion',
  },
  igualdad: {
    id: 'igualdad',
    name: 'Derecho a la igualdad y no discriminación',
    summary: 'Todas y todos valemos lo mismo.',
    icon: 'icon-igualdad',
  },
  juego: {
    id: 'juego',
    name: 'Derecho a jugar y descansar',
    summary: 'Jugar, divertirnos y dormir bien.',
    icon: 'icon-juego',
  },
  opinion: {
    id: 'opinion',
    name: 'Derecho a expresar sus opiniones',
    summary: 'Decir lo que pensamos y sentimos.',
    icon: 'icon-opinion',
  },
};

export type LevelSceneKey =
  'Level01' | 'Level02' | 'Level03' | 'Level04' | 'Level05' | 'Level06' | 'Level07' | 'Level08';

// ------------------------------------------------------------------ contenido por mecánica

/** Objeto de juego genérico. */
export interface ItemDef {
  id: string;
  art: ArtKey;
  label: string;
}

/** Objeto con respuesta: correcto o distractor con pista amable. */
export interface ChoiceDef extends ItemDef {
  correct: boolean;
  /** Pista concreta si se elige/suelta donde no va. */
  hint?: VoiceLine;
}

export interface HouseContent {
  kind: 'house';
  pieces: (ItemDef & { hint: VoiceLine })[];
  family: ItemDef[];
  built: VoiceLine;
  rain: VoiceLine;
  safe: VoiceLine;
}

export interface LunchboxContent {
  kind: 'lunchbox';
  items: ChoiceDef[];
  done: VoiceLine;
}

export interface ClinicContent {
  kind: 'clinic';
  steps: { question: VoiceLine; success: VoiceLine; options: ChoiceDef[] }[];
  done: VoiceLine;
}

export interface SchoolContent {
  kind: 'school';
  cols: number;
  rows: number;
  pieceHint: VoiceLine;
  alive: VoiceLine;
  tools: ItemDef[];
  shadowHint: VoiceLine;
  done: VoiceLine;
}

export interface ParkContent {
  kind: 'park';
  rampQuestion: VoiceLine;
  options: ChoiceDef[];
  rampDone: VoiceLine;
  invite: VoiceLine;
  kids: (ItemDef & { wheelchair?: boolean })[];
  done: VoiceLine;
}

export interface DayNightContent {
  kind: 'daynight';
  sky: VoiceLine;
  task: VoiceLine;
  items: (ItemDef & { time: 'day' | 'night'; hint: VoiceLine })[];
  done: VoiceLine;
}

export interface VoiceContent {
  kind: 'voice';
  feelings: (ItemDef & { reply: VoiceLine })[];
  thanks: VoiceLine;
  voteQuestion: VoiceLine;
  names: (ItemDef & { chosen: VoiceLine })[];
  done: VoiceLine;
}

export interface MemoryContent {
  kind: 'memory';
  pairs: { right: RightId; matched: VoiceLine }[];
  /** Desaciertos "gratis" antes de que cuenten para las estrellas (es un juego de memoria). */
  freeMismatches: number;
  /** Cada cuántos desaciertos extra se cuenta 1 error. */
  mismatchesPerError: number;
  tryAgain: VoiceLine;
  done: VoiceLine;
}

export type LevelContent =
  | HouseContent
  | LunchboxContent
  | ClinicContent
  | SchoolContent
  | ParkContent
  | DayNightContent
  | VoiceContent
  | MemoryContent;

export interface LevelDef {
  id: string;
  number: number;
  sceneKey: LevelSceneKey;
  title: string;
  rights: RightId[];
  /** Descripción de la mecánica (tabla del README / presentación). */
  mechanicLabel: string;
  /** Ícono de la zona, medalla y estampa. */
  icon: ArtKey;
  zone: { x: number; y: number; color: number };
  medal: { name: string; color: number };
  sticker: { id: string; label: string };
  dialog: {
    intro: VoiceLine[];
    lesson: VoiceLine;
  };
  content: LevelContent;
}

// ------------------------------------------------------------------ niveles

export const LEVELS: readonly LevelDef[] = [
  {
    id: 'level01',
    number: 1,
    sceneKey: 'Level01',
    title: 'Casa segura',
    rights: ['vivienda', 'vida'],
    mechanicLabel:
      'Arrastrar paredes, techo, puerta y ventana para armar la casa; luego llevar a la familia adentro cuando llueve',
    icon: 'icon-vivienda',
    zone: { x: 190, y: 560, color: COLORS.coral },
    medal: { name: 'Medalla del Hogar', color: COLORS.coral },
    sticker: { id: 'casa', label: 'Mi casa segura' },
    dialog: {
      intro: [v('level01_intro', '¡Vamos a armar una casa! Arrastra cada pieza a su lugar.')],
      lesson: v(
        'level01_lesson',
        'Todas las niñas y niños tienen derecho a un hogar seguro y a vivir protegidos.',
      ),
    },
    content: {
      kind: 'house',
      pieces: [
        {
          id: 'paredes',
          art: 'paredes',
          label: 'Paredes',
          hint: v('level01_hint_paredes', 'Las paredes van en el centro, sobre el suelo.'),
        },
        {
          id: 'techo',
          art: 'techo',
          label: 'Techo',
          hint: v('level01_hint_techo', 'El techo va arriba, sobre las paredes.'),
        },
        {
          id: 'puerta',
          art: 'puerta',
          label: 'Puerta',
          hint: v('level01_hint_puerta', 'La puerta va abajo, para poder entrar.'),
        },
        {
          id: 'ventana',
          art: 'ventana',
          label: 'Ventana',
          hint: v('level01_hint_ventana', 'La ventana va en la pared, para que entre la luz.'),
        },
      ],
      family: [
        { id: 'mama', art: 'mama', label: 'Mamá' },
        { id: 'papa', art: 'papa', label: 'Papá' },
        { id: 'abuela', art: 'abuela', label: 'Abuela' },
        { id: 'nino', art: 'nino', label: 'Niño' },
      ],
      built: v('level01_built', '¡Qué bonita casa! Pero... ¡mira, empieza a llover!'),
      rain: v(
        'level01_rain',
        'Lleva a la familia adentro de la casa, por la puerta, para que no se mojen.',
      ),
      safe: v(
        'level01_safe',
        '¡Ya paró la lluvia! La familia está segura en su casa. ¡Mira el arcoíris!',
      ),
    },
  },
  {
    id: 'level02',
    number: 2,
    sceneKey: 'Level02',
    title: 'Lonchera nutritiva',
    rights: ['alimentacion'],
    mechanicLabel:
      'Arrastrar alimentos nutritivos a la lonchera; los distractores rebotan con una pista amable',
    icon: 'icon-alimentacion',
    zone: { x: 400, y: 480, color: COLORS.sun },
    medal: { name: 'Medalla de la Buena Comida', color: COLORS.sun },
    sticker: { id: 'lonchera', label: 'Mi lonchera' },
    dialog: {
      intro: [
        v(
          'level02_intro',
          '¡Llegamos al mercado! Llena la lonchera con comida que te haga crecer fuerte.',
        ),
      ],
      lesson: v(
        'level02_lesson',
        'Todas las niñas y niños tienen derecho a comer rico y nutritivo todos los días.',
      ),
    },
    content: {
      kind: 'lunchbox',
      items: [
        { id: 'mango', art: 'mango', label: 'Mango', correct: true },
        {
          id: 'soda',
          art: 'soda',
          label: 'Soda',
          correct: false,
          hint: v(
            'level02_hint_soda',
            'La soda tiene mucha azúcar. Busca algo que te haga crecer fuerte.',
          ),
        },
        { id: 'guineo', art: 'guineo', label: 'Guineo', correct: true },
        { id: 'frijoles', art: 'frijoles', label: 'Frijoles', correct: true },
        {
          id: 'dulces',
          art: 'dulces',
          label: 'Dulces',
          correct: false,
          hint: v(
            'level02_hint_dulces',
            'Los dulces son solo de vez en cuando. Busca una fruta que te dé energía.',
          ),
        },
        { id: 'leche', art: 'leche', label: 'Leche', correct: true },
        {
          id: 'papitas',
          art: 'papitas',
          label: 'Papitas',
          correct: false,
          hint: v(
            'level02_hint_papitas',
            'Las papitas tienen mucha sal. Mejor busca una verdura o una fruta.',
          ),
        },
        { id: 'verduras', art: 'verduras', label: 'Verduras', correct: true },
      ],
      done: v('level02_done', '¡Tu lonchera está llena de comida nutritiva!'),
    },
  },
  {
    id: 'level03',
    number: 3,
    sceneKey: 'Level03',
    title: 'Clínica de Tori',
    rights: ['salud'],
    mechanicLabel:
      'Elegir en orden quién ayuda (doctora), qué usa (termómetro, curita) y qué protege (vacuna)',
    icon: 'icon-salud',
    zone: { x: 300, y: 300, color: COLORS.turquoise },
    medal: { name: 'Medalla de la Salud', color: COLORS.turquoise },
    sticker: { id: 'clinica', label: 'Osito sano' },
    dialog: {
      intro: [v('level03_intro', 'Mi amigo osito está enfermo. ¿Me ayudas a cuidarlo?')],
      lesson: v(
        'level03_lesson',
        'Todas las niñas y niños tienen derecho a la salud y a que los cuiden cuando se enferman.',
      ),
    },
    content: {
      kind: 'clinic',
      steps: [
        {
          question: v('level03_q1', '¿Quién puede curar al osito? Toca a la persona.'),
          success: v('level03_ok1', '¡Sí! La doctora cuida nuestra salud.'),
          options: [
            {
              id: 'cocinero',
              art: 'cocinero',
              label: 'Cocinero',
              correct: false,
              hint: v(
                'level03_hint_cocinero',
                'El cocinero prepara comida rica. Busca a la doctora, con su bata blanca.',
              ),
            },
            { id: 'doctora', art: 'doctora', label: 'Doctora', correct: true },
            {
              id: 'pintor',
              art: 'pintor',
              label: 'Pintor',
              correct: false,
              hint: v(
                'level03_hint_pintor',
                'El pintor pinta cuadros bonitos. ¿Quién cura a los enfermos?',
              ),
            },
          ],
        },
        {
          question: v('level03_q2', '¿Qué usa la doctora para ver si tiene fiebre?'),
          success: v('level03_ok2', '¡Muy bien! El termómetro mide la fiebre.'),
          options: [
            {
              id: 'pelota',
              art: 'pelota',
              label: 'Pelota',
              correct: false,
              hint: v(
                'level03_hint_pelota',
                'La pelota es para jugar. Busca lo que mide la fiebre.',
              ),
            },
            {
              id: 'cuchara',
              art: 'cuchara',
              label: 'Cuchara',
              correct: false,
              hint: v('level03_hint_cuchara', 'La cuchara es para comer. Busca el termómetro.'),
            },
            { id: 'termometro', art: 'termometro', label: 'Termómetro', correct: true },
          ],
        },
        {
          question: v('level03_q3', 'El osito tiene un raspón. ¿Qué le ponemos?'),
          success: v('level03_ok3', '¡Eso es! La curita protege el raspón.'),
          options: [
            { id: 'curita', art: 'curita', label: 'Curita', correct: true },
            {
              id: 'crayon',
              art: 'crayon',
              label: 'Crayón',
              correct: false,
              hint: v(
                'level03_hint_crayon',
                'El crayón es para dibujar. Busca algo que cubra el raspón.',
              ),
            },
            {
              id: 'galleta',
              art: 'galleta',
              label: 'Galleta',
              correct: false,
              hint: v('level03_hint_galleta', 'La galleta es para comer. Busca la curita.'),
            },
          ],
        },
        {
          question: v('level03_q4', '¿Qué protege al osito para que no se enferme?'),
          success: v('level03_ok4', '¡Correcto! Las vacunas nos protegen.'),
          options: [
            {
              id: 'carrito',
              art: 'carrito',
              label: 'Carrito',
              correct: false,
              hint: v(
                'level03_hint_carrito',
                'El carrito es un juguete. ¿Qué nos protege de las enfermedades?',
              ),
            },
            { id: 'vacuna', art: 'vacuna', label: 'Vacuna', correct: true },
            {
              id: 'dulces',
              art: 'dulces',
              label: 'Dulces',
              correct: false,
              hint: v('level03_hint_dulces', 'Los dulces no nos protegen. Busca la vacuna.'),
            },
          ],
        },
      ],
      done: v('level03_done', '¡El osito ya está sano y feliz! Gracias por cuidarlo.'),
    },
  },
  {
    id: 'level04',
    number: 4,
    sceneKey: 'Level04',
    title: 'Rompecabezas escolar',
    rights: ['educacion'],
    mechanicLabel:
      'Armar un rompecabezas de 6 piezas del salón y luego relacionar útiles escolares con su sombra',
    icon: 'icon-educacion',
    zone: { x: 520, y: 190, color: COLORS.grape },
    medal: { name: 'Medalla del Saber', color: COLORS.grape },
    sticker: { id: 'escuela', label: 'Mi escuela' },
    dialog: {
      intro: [v('level04_intro', '¡Esta es la escuela! Arma el rompecabezas del salón de clases.')],
      lesson: v(
        'level04_lesson',
        'Todas las niñas y niños tienen derecho a ir a la escuela y aprender.',
      ),
    },
    content: {
      kind: 'school',
      cols: 3,
      rows: 2,
      pieceHint: v('level04_hint_pieza', 'Esa pieza va en otro lugar. Fíjate en los dibujos.'),
      alive: v('level04_alive', '¡Armaste el salón! Ahora lleva cada útil escolar a su sombra.'),
      tools: [
        { id: 'lapiz', art: 'lapiz', label: 'Lápiz' },
        { id: 'cuaderno', art: 'cuaderno', label: 'Cuaderno' },
        { id: 'tijeras', art: 'tijeras', label: 'Tijeras' },
        { id: 'mochila', art: 'mochila', label: 'Mochila' },
      ],
      shadowHint: v(
        'level04_hint_sombra',
        'Mira bien la forma de la sombra. Busca la que se parece.',
      ),
      done: v('level04_done', '¡Muy bien! Ya tienes todo para aprender.'),
    },
  },
  {
    id: 'level05',
    number: 5,
    sceneKey: 'Level05',
    title: 'Parque para todos',
    rights: ['igualdad'],
    mechanicLabel:
      'Poner una rampa para la niña en silla de ruedas e invitar a todos a jugar tocándolos',
    icon: 'icon-igualdad',
    zone: { x: 740, y: 270, color: COLORS.orange },
    medal: { name: 'Medalla de la Amistad', color: COLORS.orange },
    sticker: { id: 'parque', label: 'Parque para todos' },
    dialog: {
      intro: [
        v(
          'level05_intro',
          'Mira el parque. ¡Todos quieren jugar! Ayúdame a que todos puedan entrar.',
        ),
      ],
      lesson: v(
        'level05_lesson',
        'Cuando todos caben, todos ganamos. Todas y todos valemos lo mismo.',
      ),
    },
    content: {
      kind: 'park',
      rampQuestion: v(
        'level05_ramp_q',
        'Sofía usa silla de ruedas y no puede subir el escalón. Arrastra lo que la puede ayudar.',
      ),
      options: [
        {
          id: 'escalera',
          art: 'escalera',
          label: 'Escalera',
          correct: false,
          hint: v(
            'level05_hint_escalera',
            'Con una escalera, la silla no puede subir. Busca algo sin escalones.',
          ),
        },
        { id: 'rampa', art: 'rampa', label: 'Rampa', correct: true },
        {
          id: 'pelota',
          art: 'pelota',
          label: 'Pelota',
          correct: false,
          hint: v('level05_hint_pelota', 'La pelota es para jugar. Busca la rampa para subir.'),
        },
      ],
      rampDone: v('level05_ramp_ok', '¡Sí! Con la rampa, Sofía puede entrar al parque.'),
      invite: v('level05_invite', 'Ahora invita a todos a jugar. ¡Toca a cada niño y niña!'),
      kids: [
        { id: 'camila', art: 'nina-b', label: 'Camila' },
        { id: 'jose', art: 'nino-a', label: 'José' },
        { id: 'daniel', art: 'nino-c', label: 'Daniel' },
        { id: 'sofia', art: 'nina-silla', label: 'Sofía', wheelchair: true },
      ],
      done: v('level05_done', '¡Cuando todos caben, todos ganamos!'),
    },
  },
  {
    id: 'level06',
    number: 6,
    sceneKey: 'Level06',
    title: 'Día y noche',
    rights: ['juego'],
    mechanicLabel:
      'El cielo cambia de día a noche; llevar cada objeto a su momento: jugar con el sol, descansar con la luna',
    icon: 'icon-juego',
    zone: { x: 900, y: 430, color: COLORS.sea },
    medal: { name: 'Medalla del Juego y el Descanso', color: COLORS.sea },
    sticker: { id: 'diaynoche', label: 'Día y noche' },
    dialog: {
      intro: [v('level06_intro', 'De día jugamos y de noche descansamos.')],
      lesson: v('level06_lesson', 'Todas las niñas y niños tienen derecho a jugar y a descansar.'),
    },
    content: {
      kind: 'daynight',
      sky: v('level06_sky', 'Mira cómo el día se vuelve noche.'),
      task: v(
        'level06_task',
        'Lleva lo que usamos para jugar al sol, y lo que usamos para descansar a la luna.',
      ),
      items: [
        {
          id: 'pelota',
          art: 'pelota',
          label: 'Pelota',
          time: 'day',
          hint: v('level06_hint_pelota', 'La pelota es para jugar de día. Llévala con el sol.'),
        },
        {
          id: 'pijama',
          art: 'pijama',
          label: 'Pijama',
          time: 'night',
          hint: v('level06_hint_pijama', 'La pijama es para dormir. Llévala con la luna.'),
        },
        {
          id: 'papalote',
          art: 'papalote',
          label: 'Papalote',
          time: 'day',
          hint: v(
            'level06_hint_papalote',
            'El papalote vuela con el viento del día. Llévalo con el sol.',
          ),
        },
        {
          id: 'camita',
          art: 'camita',
          label: 'Cama',
          time: 'night',
          hint: v('level06_hint_cama', 'En la cama descansamos de noche. Llévala con la luna.'),
        },
        {
          id: 'trompo',
          art: 'trompo',
          label: 'Trompo',
          time: 'day',
          hint: v('level06_hint_trompo', 'El trompo es para jugar. Llévalo con el sol.'),
        },
        {
          id: 'cuento',
          art: 'cuento',
          label: 'Cuento',
          time: 'night',
          hint: v(
            'level06_hint_cuento',
            'El cuento lo leemos antes de dormir. Llévalo con la luna.',
          ),
        },
      ],
      done: v('level06_done', '¡Muy bien! Jugar y descansar nos ayuda a crecer felices.'),
    },
  },
  {
    id: 'level07',
    number: 7,
    sceneKey: 'Level07',
    title: 'Mi voz cuenta',
    rights: ['opinion'],
    mechanicLabel:
      'Elegir una carita de cómo se siente y votar por el nombre de la mascota (sin respuestas incorrectas)',
    icon: 'icon-opinion',
    zone: { x: 1070, y: 330, color: COLORS.pink },
    medal: { name: 'Medalla de Mi Voz', color: COLORS.pink },
    sticker: { id: 'voz', label: 'Mi voz cuenta' },
    dialog: {
      intro: [
        v(
          'level07_intro',
          'Aquí todas las opiniones importan. ¿Cómo te sientes hoy? Toca una carita.',
        ),
      ],
      lesson: v(
        'level07_lesson',
        'Todas las niñas y niños tienen derecho a decir lo que piensan y sienten.',
      ),
    },
    content: {
      kind: 'voice',
      feelings: [
        {
          id: 'feliz',
          art: 'cara-feliz',
          label: 'Feliz',
          reply: v('level07_feliz', '¡Qué alegría! Me encanta verte feliz.'),
        },
        {
          id: 'tranquilo',
          art: 'cara-tranquila',
          label: 'Tranquilo',
          reply: v('level07_tranquilo', '¡Qué bien! Estar tranquilo se siente bonito.'),
        },
        {
          id: 'triste',
          art: 'cara-triste',
          label: 'Triste',
          reply: v(
            'level07_triste',
            'Está bien sentirse triste. Puedes contárselo a alguien que te quiere.',
          ),
        },
        {
          id: 'enojado',
          art: 'cara-enojada',
          label: 'Enojado',
          reply: v('level07_enojado', 'Está bien enojarse. Respiremos profundo juntos.'),
        },
        {
          id: 'asustado',
          art: 'cara-asustada',
          label: 'Asustado',
          reply: v('level07_asustado', 'Todos sentimos miedo a veces. Aquí estás seguro.'),
        },
      ],
      thanks: v(
        'level07_thanks',
        'Gracias por decirme cómo te sientes. Tus sentimientos importan.',
      ),
      voteQuestion: v(
        'level07_vote',
        'Ahora vamos a votar. ¿Cómo se llamará el perrito del parque: Mango, Luna o Copito?',
      ),
      names: [
        {
          id: 'mango',
          art: 'mango',
          label: 'Mango',
          chosen: v('level07_voto_mango', '¡Votaste por Mango!'),
        },
        {
          id: 'luna',
          art: 'luna',
          label: 'Luna',
          chosen: v('level07_voto_luna', '¡Votaste por Luna!'),
        },
        {
          id: 'copito',
          art: 'copito',
          label: 'Copito',
          chosen: v('level07_voto_copito', '¡Votaste por Copito!'),
        },
      ],
      done: v('level07_done', '¡Gracias por votar! Tu voz cuenta y tu opinión es importante.'),
    },
  },
  {
    id: 'level08',
    number: 8,
    sceneKey: 'Level08',
    title: 'Memorama de derechos',
    rights: [
      'vivienda',
      'vida',
      'alimentacion',
      'salud',
      'educacion',
      'igualdad',
      'juego',
      'opinion',
    ],
    mechanicLabel:
      'Juego de memoria con 8 parejas (derecho ↔ ilustración); al final se arma la imagen de la isla',
    icon: 'icon-isla',
    zone: { x: 930, y: 190, color: COLORS.sun },
    medal: { name: 'Gran Medalla de los Derechos', color: COLORS.sun },
    sticker: { id: 'isla', label: 'La Isla Derechitos' },
    dialog: {
      intro: [v('level08_intro', '¡Último reto! Toca dos cartas y encuentra las parejas iguales.')],
      lesson: v(
        'level08_lesson',
        '¡Lo lograste! Ahora conoces todos tus derechos. ¡Eres Guardián de los Derechos!',
      ),
    },
    content: {
      kind: 'memory',
      pairs: [
        { right: 'vivienda', matched: v('level08_vivienda', '¡Derecho a la vivienda!') },
        { right: 'vida', matched: v('level08_vida', '¡Derecho a la vida!') },
        {
          right: 'alimentacion',
          matched: v('level08_alimentacion', '¡Derecho a la alimentación!'),
        },
        { right: 'salud', matched: v('level08_salud', '¡Derecho a la salud!') },
        { right: 'educacion', matched: v('level08_educacion', '¡Derecho a la educación!') },
        { right: 'igualdad', matched: v('level08_igualdad', '¡Derecho a la igualdad!') },
        { right: 'juego', matched: v('level08_juego', '¡Derecho a jugar y descansar!') },
        { right: 'opinion', matched: v('level08_opinion', '¡Derecho a expresar tu opinión!') },
      ],
      freeMismatches: 8,
      mismatchesPerError: 3,
      tryAgain: v('level08_try', '¡Casi! Recuerda dónde estaba cada carta.'),
      done: v('level08_done', '¡Encontraste todas las parejas! Mira, la isla está completa.'),
    },
  },
];

export function getLevel(id: string): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Nivel desconocido: ${id}`);
  return level;
}

export function getLevelByScene(key: LevelSceneKey): LevelDef {
  const level = LEVELS.find((l) => l.sceneKey === key);
  if (!level) throw new Error(`Escena de nivel sin datos: ${key}`);
  return level;
}
