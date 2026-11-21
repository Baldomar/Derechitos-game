import type { VoiceLine } from './levels';
import { RIGHT_AREAS, type RightArea, type VoteActivity } from './rights';

/**
 * Frases de Tori que se arman mientras se juega (cambian con el avance: cuántos juegos
 * faltan, qué medalla, qué ganó la votación...). Las escenas las piden aquí, y
 * `dynamicVoiceLines()` lista TODAS sus variantes para generarles voz de antemano
 * (npm run voces). El juego encuentra cada audio por su texto (ver voiceKey.ts).
 */

export const NUMBER_WORDS = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
];

/** Cierra una frase con punto, salvo que ya termine en ? o ! (p. ej. "¿Sano o no sano?"). */
const dot = (t: string): string => (/[.!?…]$/.test(t) ? t : `${t}.`);

// ------------------------------------------------------------------ juegos

export const dotsFindLine = (n: number): VoiceLine => ({
  id: `dots_busca_${n}`,
  text: `Busca el número ${NUMBER_WORDS[n] ?? n}.`,
});

export const voteWinLine = (
  activityId: string,
  round: number,
  label: string,
  same: boolean,
): VoiceLine =>
  same
    ? {
        id: `${activityId}_r${round}_win_same`,
        text: `¡Ganó ${label}! Tú también votaste por eso.`,
      }
    : {
        id: `${activityId}_r${round}_win_other`,
        text: `¡Ganó ${label}! Esta vez ganó la otra opción, pero tu voto contó.`,
      };

// ------------------------------------------------------------------ zona de cada derecho

export const hubMedalLine = (r: RightArea, earned: boolean): VoiceLine => ({
  id: `hub_medal_${r.id}${earned ? '_won' : ''}`,
  text: earned
    ? `¡Ganaste la medalla ${r.medal.name}!`
    : `Termina los juegos y los retos para ganar la medalla ${r.medal.name}.`,
});

/** Qué sigue en la zona de un derecho, según el avance. */
export const hubStatus = {
  start: (r: RightArea, title: string): VoiceLine => ({
    id: `hub_status_${r.id}`,
    text: `¡Vamos a jugar! Toca ${title} para empezar.`,
  }),
  oneLeft: (r: RightArea, title: string, hasChallenges: boolean): VoiceLine => ({
    id: `hub_status_${r.id}`,
    text: `¡Muy bien! Te falta un juego: ${dot(title)}${hasChallenges ? ' Cuando lo termines, se abren los retos.' : ''}`,
  }),
  many: (r: RightArea, n: number, title: string): VoiceLine => ({
    id: `hub_status_${r.id}`,
    text: `¡Vas muy bien! Te faltan ${n} juegos. Sigue con ${dot(title)}`,
  }),
  challenges: (r: RightArea, title: string): VoiceLine => ({
    id: `hub_status_${r.id}`,
    text: `¡Se abrieron los retos! Toca ${title} para jugar.`,
  }),
  medal: (r: RightArea): VoiceLine => ({
    id: `hub_status_${r.id}`,
    text: `¡Completaste este derecho! Ganaste la medalla ${r.medal.name}.`,
  }),
  allDone: (r: RightArea): VoiceLine => ({
    id: `hub_status_${r.id}`,
    text: '¡Completaste todos los juegos de este derecho! Muy pronto habrá más.',
  }),
};

// ------------------------------------------------------------------ mapa, medallas y diploma

export const mapChestLine = (): VoiceLine => ({
  id: 'map_chest_locked',
  text: `El cofre guarda tu diploma. Completa las ${RIGHT_AREAS.length} zonas para abrirlo.`,
});

export const mapHelloLine = (r: RightArea, fresh: boolean): VoiceLine =>
  fresh
    ? {
        id: 'map_hello_start',
        text: `Toca la zona ${r.short} para iniciar tu aventura.`,
      }
    : {
        id: `map_hello_${r.id}`,
        text: `¡Muy bien! Sigue tu aventura en la zona ${r.short}. Tócala para jugar.`,
      };

export const zoneNameLine = (r: RightArea): VoiceLine => ({
  id: `zone_name_${r.id}`,
  text: `${r.name}.`,
});

export const medalLockedLine = (r: RightArea, i: number): VoiceLine => ({
  id: `medal_locked_${r.id}`,
  text: `Medalla de ${r.short}: todavía no la tienes. Juega la zona ${i + 1} para ganarla.`,
});

export const medalsStatusLine = (earned: number, first: RightArea): VoiceLine => ({
  id: `medals_status_${earned}`,
  text:
    earned === RIGHT_AREAS.length
      ? '¡Tienes todas las medallas! Eres Guardián de los Derechos.'
      : `¡Ganaste la medalla ${first.medal.name}! Juega las otras zonas para completar tu colección.`,
});

export const finalDoneLine = (canPrint: boolean): VoiceLine => ({
  id: 'final_done',
  text: canPrint
    ? '¡Felicidades! Ya eres Guardián de los Derechos. ¡Imprime tu diploma y compártelo!'
    : '¡Felicidades! Ya eres Guardián de los Derechos. Abre el cofre de la isla para imprimir tu diploma.',
});

export const finalProgressLine = (count: number): VoiceLine => ({
  id: `final_progress_${count}`,
  text: `Este es tu diploma. Llevas ${count} de ${RIGHT_AREAS.length} medallas: gánalas todas para completarlo y firmarlo.`,
});

// ------------------------------------------------------------------ todas las variantes

/** Todas las variantes posibles de las frases de arriba (sin repetir textos). */
export function dynamicVoiceLines(): VoiceLine[] {
  const out: VoiceLine[] = [];
  for (let n = 1; n < NUMBER_WORDS.length; n++) out.push(dotsFindLine(n));

  RIGHT_AREAS.forEach((r, i) => {
    const all = [...r.games, ...r.challenges].filter((a) => a.kind !== 'soon');
    const games = r.games.filter((a) => a.kind !== 'soon');
    const challenges = r.challenges.filter((a) => a.kind !== 'soon');
    const hasChallenges = challenges.length > 0;
    for (const a of all) {
      out.push(hubStatus.start(r, a.title));
      out.push(hubStatus.oneLeft(r, a.title, hasChallenges));
      for (let n = 2; n <= games.length; n++) out.push(hubStatus.many(r, n, a.title));
    }
    for (const a of challenges) out.push(hubStatus.challenges(r, a.title));
    out.push(hubStatus.medal(r), hubStatus.allDone(r));
    out.push(hubMedalLine(r, true), hubMedalLine(r, false));
    out.push(mapHelloLine(r, true), mapHelloLine(r, false), zoneNameLine(r));
    out.push(medalLockedLine(r, i), medalsStatusLine(1, r));

    for (const a of all) {
      if (a.kind !== 'vote') continue;
      (a as VoteActivity).rounds.forEach((round, k) => {
        for (const o of round.options) {
          out.push(voteWinLine(a.id, k, o.label, true), voteWinLine(a.id, k, o.label, false));
        }
      });
    }
  });

  const first = RIGHT_AREAS[0];
  if (first) out.push(medalsStatusLine(RIGHT_AREAS.length, first));
  out.push(mapChestLine(), finalDoneLine(true), finalDoneLine(false));
  for (let c = 0; c < RIGHT_AREAS.length; c++) out.push(finalProgressLine(c));

  const seen = new Set<string>();
  return out.filter((l) => !seen.has(l.text) && !!seen.add(l.text));
}
