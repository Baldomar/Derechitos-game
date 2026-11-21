#!/usr/bin/env node
/**
 * Genera las voces de Tori con una voz artificial de buena calidad (en vez de la voz
 * automática del navegador) y las guarda en src/assets/audio/voice/<id>.mp3.
 * El juego las detecta solo: si una frase tiene archivo, suena grabada.
 *
 * Las frases se leen directamente del código (v('id', 'texto') y { id, text }),
 * así nunca falta ninguna aunque el guion no esté al día.
 *
 * Configuración en .env.local (no se sube a git):
 *   VOICE_PROVIDER=edge             # edge (gratis, sin cuenta) | azure | elevenlabs
 *   EDGE_VOICE=es-SV-LorenaNeural   # voz de Edge (requiere: python -m pip install edge-tts)
 *   EDGE_PITCH=+8Hz                 # opcional: un poco más aguda
 *   EDGE_RATE=-4%                   # opcional: un poco más despacio
 *   AZURE_SPEECH_KEY=...            # clave del recurso "Speech" de Azure
 *   AZURE_SPEECH_REGION=eastus      # región del recurso
 *   AZURE_VOICE=es-SV-LorenaNeural  # opcional (voz de El Salvador)
 *   AZURE_PITCH=+8%                 # opcional: un poco más aguda
 *   AZURE_RATE=-4%                  # opcional: un poco más despacio
 *   ELEVENLABS_API_KEY=...          # si se usa ElevenLabs
 *   ELEVENLABS_VOICE_ID=...         # id de la voz elegida en ElevenLabs
 *
 * Uso:
 *   npm run voces -- --list            muestra cuántas frases hay (no gasta nada)
 *   npm run voces -- --sample          genera solo 3 frases para probar la voz
 *   npm run voces                      genera las que falten o cuyo texto cambió
 *   npm run voces -- --only opi_talk   solo las que empiezan con ese prefijo
 *   npm run voces -- --force           vuelve a generar todas
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(SRC, 'assets', 'audio', 'voice');
const MANIFEST = join(OUT, '_manifest.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (existsSync(join(ROOT, '.env.local'))) process.loadEnvFile(join(ROOT, '.env.local'));
const env = process.env;

// ------------------------------------------------------------------ frases del juego

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'assets' ? [] : walk(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

/** Texto de un literal de JS entre comillas simples o dobles. */
const STR = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`;
const unescape = (s) => s.replace(/\\(.)/g, '$1');

function collectLines() {
  const lines = new Map();
  const patterns = [
    new RegExp(String.raw`\bv\(\s*'([\w-]+)',\s*(?:${STR})`, 'g'),
    new RegExp(String.raw`\bid:\s*'([\w-]+)',\s*text:\s*(?:${STR})`, 'g'),
  ];
  for (const file of walk(SRC)) {
    const code = readFileSync(file, 'utf8');
    for (const re of patterns) {
      for (const m of code.matchAll(re)) {
        const text = unescape(m[2] ?? m[3] ?? '').trim();
        if (text) lines.set(m[1], text);
      }
    }
  }
  return [...lines.entries()].map(([id, text]) => ({ id, text }));
}

// ------------------------------------------------------------------ proveedores

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const providers = {
  edge: {
    check() {
      return null;
    },
    voice: () => env.EDGE_VOICE || 'es-SV-LorenaNeural',
    tag: () => `${env.EDGE_PITCH || '+8Hz'}:${env.EDGE_RATE || '-4%'}`,
    synth(text) {
      // Voces de Microsoft Edge (lectura en voz alta) con el paquete de Python edge-tts.
      const dir = mkdtempSync(join(tmpdir(), 'voz-'));
      const file = join(dir, 'out.mp3');
      const py = env.VOICE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
      const argv = [
        '-m',
        'edge_tts',
        '--voice',
        this.voice(),
        `--pitch=${env.EDGE_PITCH || '+8Hz'}`,
        `--rate=${env.EDGE_RATE || '-4%'}`,
        '--text',
        text,
        '--write-media',
        file,
      ];
      return new Promise((ok, fail) => {
        execFile(py, argv, { timeout: 60000 }, (err, _out, stderr) => {
          try {
            if (err) throw new Error(`edge-tts: ${(stderr || err.message).slice(0, 200)}`);
            ok(readFileSync(file));
          } catch (e) {
            fail(e);
          } finally {
            rmSync(dir, { recursive: true, force: true });
          }
        });
      });
    },
  },
  azure: {
    check() {
      if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
        return 'Falta AZURE_SPEECH_KEY o AZURE_SPEECH_REGION en .env.local';
      }
      return null;
    },
    voice: () => env.AZURE_VOICE || 'es-SV-LorenaNeural',
    tag: () => `${env.AZURE_PITCH || '+8%'}:${env.AZURE_RATE || '-4%'}`,
    async synth(text) {
      const voice = this.voice();
      const lang = voice.split('-').slice(0, 2).join('-');
      const ssml =
        `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">` +
        `<prosody pitch="${env.AZURE_PITCH || '+8%'}" rate="${env.AZURE_RATE || '-4%'}">` +
        `${escapeXml(text)}</prosody></voice></speak>`;
      const res = await fetch(
        `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'derechitos-voces',
          },
          body: ssml,
        },
      );
      if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return Buffer.from(await res.arrayBuffer());
    },
  },
  elevenlabs: {
    check() {
      if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) {
        return 'Falta ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID en .env.local';
      }
      return null;
    },
    voice: () => env.ELEVENLABS_VOICE_ID,
    tag: () => env.ELEVENLABS_MODEL || '',
    async synth(text) {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_64`,
        {
          method: 'POST',
          headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3 },
          }),
        },
      );
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return Buffer.from(await res.arrayBuffer());
    },
  },
};

// ------------------------------------------------------------------ programa

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Frases que se arman al jugar ("Te faltan 2 juegos"...): se cargan TODAS sus variantes
 * desde src/config/voiceCatalog.ts (con Vite, que entiende TypeScript y los alias @/).
 * Se guardan con el nombre t_<hash del texto>, igual que las busca el juego.
 */
async function collectDynamic() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    root: ROOT,
    logLevel: 'silent',
    appType: 'custom',
    resolve: { alias: { '@': SRC } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const catalog = await server.ssrLoadModule('/src/config/voiceCatalog.ts');
    const { textVoiceKey } = await server.ssrLoadModule('/src/core/voiceKey.ts');
    return catalog.dynamicVoiceLines().map((l) => ({ id: textVoiceKey(l.text), text: l.text }));
  } finally {
    await server.close();
  }
}

async function main() {
  const fixed = collectLines();
  const fixedIds = new Set(fixed.map((l) => l.id));
  const dynamic = (await collectDynamic()).filter((l) => !fixedIds.has(l.id));
  const all = [...fixed, ...dynamic].sort((a, b) => a.id.localeCompare(b.id));
  console.log(
    `${fixed.length} frases fijas + ${dynamic.length} variantes de frases armadas al jugar.`,
  );
  const chars = all.reduce((n, l) => n + l.text.length, 0);
  if (flag('list')) {
    for (const l of all) console.log(`${l.id}\t${l.text}`);
    console.log(`\n${all.length} frases, ${chars} caracteres en total.`);
    return;
  }

  const name = (env.VOICE_PROVIDER || 'edge').toLowerCase();
  const provider = providers[name];
  if (!provider) throw new Error(`Proveedor desconocido: ${name} (usa azure o elevenlabs)`);
  const problem = provider.check();
  if (problem) throw new Error(problem);

  mkdirSync(OUT, { recursive: true });
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const voiceTag = `${name}:${provider.voice()}:${provider.tag()}`;
  const hash = (l) => createHash('sha1').update(`${voiceTag}|${l.text}`).digest('hex').slice(0, 12);

  let todo = all;
  const only = option('only');
  if (only) todo = todo.filter((l) => l.id.startsWith(only));
  if (flag('sample')) {
    const pick = (
      option('sample') && !option('sample').startsWith('--')
        ? option('sample')
        : 'title_hello,intro_01,praise_04'
    ).split(',');
    todo = all.filter((l) => pick.includes(l.id));
  }
  if (!flag('force')) {
    todo = todo.filter((l) => !existsSync(join(OUT, `${l.id}.mp3`)) || manifest[l.id] !== hash(l));
  }
  const todoChars = todo.reduce((n, l) => n + l.text.length, 0);
  console.log(`Voz: ${name} / ${provider.voice()}`);
  console.log(`${todo.length} de ${all.length} frases por generar (${todoChars} caracteres).`);

  let done = 0;
  const failed = [];
  for (const l of todo) {
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const mp3 = await provider.synth(l.text);
        writeFileSync(join(OUT, `${l.id}.mp3`), mp3);
        manifest[l.id] = hash(l);
        ok = true;
      } catch (err) {
        if (attempt === 3) failed.push(`${l.id}: ${err.message}`);
        else await sleep(1500 * attempt);
      }
    }
    done += 1;
    process.stdout.write(`\r${done}/${todo.length} ${l.id.padEnd(40)}`);
    // Guarda el avance de vez en cuando por si se interrumpe.
    if (done % 20 === 0) writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    await sleep(120);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nListo: ${done - failed.length} generadas.`);
  if (failed.length) {
    console.log(`Fallaron ${failed.length}:\n  ${failed.join('\n  ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exitCode = 1;
});
