/**
 * Nombre de archivo de una voz según su TEXTO (no su id): `t_<hash>`.
 * Sirve para las frases que se arman mientras se juega, cuyo id se repite con textos
 * distintos (p. ej. "Te faltan 2 juegos" / "Te faltan 3 juegos"). El generador de voces
 * (scripts/generate-voices.mjs) usa exactamente esta misma función.
 */
export function textVoiceKey(text: string): string {
  // FNV-1a de 32 bits sobre el texto normalizado.
  let h = 0x811c9dc5;
  const s = text.trim().replace(/\s+/g, ' ');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `t_${h.toString(16).padStart(8, '0')}`;
}
