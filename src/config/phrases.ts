import type { VoiceLine } from './levels';

/** Frases generales de Tori. Cada id corresponde a src/assets/audio/voice/<id>.mp3 (opcional). */

export const TITLE_GREETING: VoiceLine = {
  id: 'title_hello',
  text: '¡Hola! Toca el botón amarillo para jugar.',
};

export const INTRO_LINES: VoiceLine[] = [
  { id: 'intro_01', text: '¡Hola! Soy Tori, un torogoz de El Salvador.' },
  {
    id: 'intro_02',
    text: 'Vivo en la Isla Derechitos. ¡Aquí aprendemos nuestros derechos jugando!',
  },
  { id: 'intro_03', text: 'En cada zona ganarás estrellas y una medalla. ¿Me acompañas?' },
];

/** Elogios variados para cada acierto. */
export const PRAISE: VoiceLine[] = [
  { id: 'praise_01', text: '¡Muy bien!' },
  { id: 'praise_02', text: '¡Excelente!' },
  { id: 'praise_03', text: '¡Eso es!' },
  { id: 'praise_04', text: '¡Lo hiciste genial!' },
  { id: 'praise_05', text: '¡Qué bien lo haces!' },
  { id: 'praise_06', text: '¡Bravo!' },
  { id: 'praise_07', text: '¡Súper!' },
  { id: 'praise_08', text: '¡Así se hace!' },
];

/** Ayuda genérica cuando aparece la manita (los niveles tienen pistas concretas). */
export const GENERIC_HINT: VoiceLine = { id: 'hint_generic', text: 'Mira la manita. ¡Tú puedes!' };

let lastPraise = -1;

/** Elogio al azar sin repetir el anterior. */
export function pickPraise(): VoiceLine {
  let i = Math.floor(Math.random() * PRAISE.length);
  if (i === lastPraise) i = (i + 1) % PRAISE.length;
  lastPraise = i;
  return PRAISE[i] as VoiceLine;
}

// ---------------------------------------------------------------- Mapa, álbum y final

export const MAP_FIRST: VoiceLine = {
  id: 'map_first',
  text: '¡Bienvenido a la Isla Derechitos! Toca la zona que brilla para empezar.',
};
export const MAP_NEXT: VoiceLine = {
  id: 'map_next',
  text: '¡Muy bien! Toca la zona que brilla para seguir la aventura.',
};
export const MAP_ALL: VoiceLine = {
  id: 'map_all',
  text: '¡Completaste toda la isla! Puedes jugar otra vez o ver tu diploma.',
};
export const ALBUM_HELLO: VoiceLine = {
  id: 'album_hello',
  text: 'Este es tu álbum. Toca una estampa para recordar tu derecho.',
};
export const ALBUM_LOCKED: VoiceLine = {
  id: 'album_locked',
  text: 'Esta estampa te espera en la isla. ¡Juega para ganarla!',
};
export const FINAL_LINES: VoiceLine[] = [
  { id: 'final_01', text: '¡Felicidades! Eres Guardián de los Derechos.' },
  {
    id: 'final_02',
    text: 'Recuerda: todas las niñas y niños tienen derechos. ¡Cuídalos y compártelos!',
  },
];
