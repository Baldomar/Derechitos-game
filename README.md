# Derechitos: la aventura de Tori

Videojuego educativo web para niñas y niños de **5 a 7 años** que enseña **derechos humanos** mediante actividades lúdicas.
Proyecto del Laboratorio I, Cómputo III, Universidad Gerardo Barrios (El Salvador).

Tori, un **torogoz** (ave nacional de El Salvador), guía al jugador por la **Isla Derechitos**. En la isla hay una zona por cada derecho; dentro de cada una hay juegos, retos y una medalla. No hace falta saber leer: todas las indicaciones tienen **voz grabada** y un botón 🔊 para repetirlas.

- **Stack:** TypeScript (modo estricto) · Phaser 3 · Vite · vite-plugin-pwa · ESLint + Prettier
- **Instalable (PWA)** y funciona **sin internet** después de la primera visita.
- **Se actualiza solo:** al publicar una versión nueva, la página se recarga sola para mostrarla (el avance queda guardado).
- **Sin castigos:** no hay vidas ni pantallas de "perdiste". Siempre se gana al menos 1 estrella.

---

## La Isla Derechitos (para la presentación)

Al entrar por primera vez, Tori da la bienvenida (_"¡Te damos la bienvenida a la Isla Derechitos!"_) y dice qué zona tocar (_"Toca la zona Salud para iniciar tu aventura."_). Al tocar una zona, Tori dice el nombre del derecho y se entra a su pantalla.

Cada derecho tiene: **explicación con voz**, **3–4 Juegos**, **3 Retos** (el último es el **Desafío final**), **estrellas** y **medalla**.

- **Se abren en orden, uno a la vez:** solo el juego que toca está abierto; los demás tienen candado (_"Termina el juego 1"_). Al terminar los juegos se abre el primer reto, luego el siguiente, y el Desafío final al último. Lo ya jugado queda abierto para repetirlo y sacar más estrellas.
- **Mis medallas** muestra lo ganado y el **Diploma "Guardián de los Derechos"**: se escribe el nombre, se firma con el dedo y la **fecha se pone sola** el día en que se gana la 8.ª medalla.

| Derecho                          | Qué dice Tori                                                     | Juegos                                                                 | Retos                                                       | Medalla                           |
| -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- |
| **Salud**                        | Tengo derecho a recibir atención médica y cuidados.               | ¿Sano o no sano? · Lava tus manos · Visita al doctor · Clínica de Tori | ¡Fuera microbios! · Carrera sana · Desafío final            | Guardián de la Salud              |
| **Educación**                    | Todos los niños tienen derecho a aprender y asistir a la escuela. | Rompecabezas escolar · Une los puntos · Memorama de derechos           | Busca los útiles · Arma tu salón · Desafío final            | Guardián del Saber                |
| **Vida**                         | Mi vida debe ser protegida y respetada.                           | ¡Cruzo seguro! · Me cuidan y me protegen · Lugares seguros             | Camino seguro · ¡A salvo! · Desafío final                   | Guardián de la Vida               |
| **Alimentación**                 | Tengo derecho a recibir alimentos nutritivos.                     | Lonchera nutritiva · Pesca comida sana · Mercado de frutas             | Plato sano · ¿De dónde viene? · Desafío final               | Guardián de la Buena Alimentación |
| **Vivienda**                     | Tengo derecho a vivir en un lugar seguro.                         | Casa segura · Une los puntos · Construye tu casa                       | ¿Qué hay en mi casa? · En casa nos ayudamos · Desafío final | Guardián del Hogar                |
| **Igualdad y no discriminación** | Todos los niños merecen respeto, sin importar sus diferencias.    | Parque para todos · Todos merecemos respeto · Juntos es mejor          | Camino con rampas · Amigos diferentes · Desafío final       | Guardián de la Igualdad           |
| **Jugar y descansar**            | Tengo derecho a divertirme, descansar y disfrutar de mi infancia. | Día y noche · Atrapa los juguetes · Torre de bloques                   | Repite el juego · Carrera en el parque · Desafío final      | Guardián del Juego                |
| **Expresar opiniones**           | Puedo expresar lo que siento y pienso, y ser escuchado.           | Mi voz cuenta · La ronda de ideas · Votamos juntos                     | ¿Cómo se siente? · Hablo y escucho · Desafío final          | Guardián de Mi Voz                |

### Juegos destacados

| Juego                 | Derecho      | Qué se hace                                                                                                                                                                                                                                                              |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **¡Cruzo seguro!**    | Vida         | 3 niveles en la misma calle: **El semáforo** (dar la mano a mamá y cruzar en verde), **Mira a los dos lados** (tocar los ojitos y cruzar cuando no viene ningún carro) y **La pelota** (si se va a la calle, pedir ayuda a un adulto, nunca correr).                     |
| **La ronda de ideas** | Opinión      | 3 niveles en el salón: **Levanta la mano** (dar el micrófono a quien pide la palabra), **Escucho sin interrumpir** (calmar al que grita "¡Yo, yo!" para que espere su turno con la mano arriba) y **Mi turno de hablar** (escoger cómo decir lo que pienso con respeto). |
| **Parque para todos** | Igualdad     | Poner la rampa para que Sofía suba en su silla de ruedas; todos corren a jugar juntos.                                                                                                                                                                                   |
| **Casa segura**       | Vivienda     | Armar la casa; cuando llueve, tocar a la familia para que corra adentro.                                                                                                                                                                                                 |
| **Carrera sana**      | Salud        | El niño corre por el parque; se toca para saltar y recoger la comida sana.                                                                                                                                                                                               |
| **Pesca comida sana** | Alimentación | Lanzar la caña desde el bote y pescar solo comida nutritiva.                                                                                                                                                                                                             |
| **¿De dónde viene?**  | Alimentación | Unir con una línea cada comida con su origen (leche–vaca, huevos–gallina, mango–árbol, verduras–huerta).                                                                                                                                                                 |
| **Repite el juego**   | Jugar        | Escuchar los sonidos de los juguetes (pelota, carrito, piscucha…) y repetirlos en orden.                                                                                                                                                                                 |

### Reglas pedagógicas aplicadas

- **Primero se escucha, después se juega:** mientras Tori da una indicación, el juego no responde a los toques (el globo de Tori da un saltito). Al terminar de hablar ya se puede jugar. El botón **Volver** y el 🔊 siempre funcionan.
- **Sin repetir de más:** si el niño no toca nada, a los **5 s** aparece solo la **manita** (sin voz); a los **20 s** Tori repite la indicación **una sola vez**.
- **Error amable:** el objeto regresa con rebote, Tori inclina la cabeza y da una pista concreta en voz.
- **Acierto:** sonido alegre, destellos, palomita ✓ (forma e ícono, no solo color), vibración suave y un elogio variado.
- **Estrellas:** 3 sin errores, 2 con 1–2 errores, 1 con más. Las estrellas nunca bajan al repetir un juego.
- **Al terminar cada juego:** pantalla de estrellas y Tori dice _"Toca el botón amarillo para continuar."_

### Cómo cambiar o agregar juegos

Todo está en [src/config/rights.ts](src/config/rights.ts): cada derecho tiene su lista de `games` y `challenges`, y cada juego se define **solo con datos** usando uno de estos motores (`kind`):

| `kind`     | Motor                             |     | `kind`   | Motor                                         |
| ---------- | --------------------------------- | --- | -------- | --------------------------------------------- |
| `sort`     | Clasificar (arrastrar a su grupo) |     | `maze`   | Camino / laberinto                            |
| `sequence` | Ordenar pasos 1, 2, 3…            |     | `thumbs` | ¿Está bien o no está bien?                    |
| `memory`   | Memorama de parejas               |     | `fish`   | Pesca                                         |
| `choice`   | Elegir respuesta(s)               |     | `match`  | Unir con línea                                |
| `catch`    | Atrapar lo que cae                |     | `stack`  | Apilar / construir                            |
| `place`    | Poner cada cosa en su lugar       |     | `simon`  | Repetir la secuencia de sonidos               |
| `give`     | Dar a cada amigo lo que necesita  |     | `share`  | Repartir                                      |
| `vote`     | Votación con amigos               |     | `board`  | Juego de mesa con dado                        |
| `scrub`    | Tallar / limpiar                  |     | `cross`  | ¡Cruzo seguro! (3 niveles)                    |
| `runner`   | Carrera (tocar para saltar)       |     | `talk`   | La ronda de ideas (3 niveles)                 |
| `dots`     | Une los puntos                    |     | `level`  | Juego con escena propia (`Level01`…`Level08`) |
| `hidden`   | Busca lo escondido                |     | `pop`    | Reventar burbujas                             |

El **orden** en la lista es el orden en que se abren. Para que un reto entregue la medalla del derecho, márcalo con `medal: true`. Los dibujos disponibles están en [src/art/Art.ts](src/art/Art.ts). Después de cambiar textos, genera sus voces con `npm run voces` (ver abajo).

---

## Instalación

Requisitos: **Node.js 20 o superior** (probado con Node 24).

```bash
npm install
```

## Comandos

| Comando                             | Qué hace                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `npm start` (o `npm run dev`)       | Servidor de desarrollo con recarga en caliente, accesible desde la red local.  |
| `npm run build`                     | Revisa TypeScript y genera la versión de producción en `dist/`.                |
| `npm run preview`                   | Sirve la versión de producción (incluye la PWA y el modo sin internet).        |
| `npm run voces`                     | Genera las voces de Tori que falten o cuyo texto cambió (ver "Voces de Tori"). |
| `npm run typecheck`                 | Solo revisa tipos de TypeScript.                                               |
| `npm run lint` / `npm run lint:fix` | Revisa (y corrige) el código con ESLint.                                       |
| `npm run format`                    | Da formato con Prettier.                                                       |

### Probar en el celular (misma red Wi-Fi)

1. Ejecuta `npm start`.
2. En el celular abre la dirección **Network** que muestra Vite (por ejemplo `http://192.168.0.15:5173`).
3. Si no carga, permite Node.js en el Firewall de Windows para redes privadas.

> La instalación como app y el modo sin internet requieren **HTTPS**: pruébalos con la versión publicada en GitHub Pages.

---

## Voces de Tori

Tori habla con **voz grabada** (voz _Lorena_, de El Salvador, un poco más aguda y pausada para niños). Hay **785 audios** en `src/assets/audio/voice/`:

- **Frases fijas** (`<id>.mp3`, p. ej. `opi_talk_intro.mp3`): todas las de [docs/guion-de-voces.md](docs/guion-de-voces.md).
- **Frases que cambian al jugar** (`t_<código>.mp3`), como _"Te faltan 2 juegos. Sigue con…"_ o _"Llevas 3 de 8 medallas"_: todas sus variantes salen de [src/config/voiceCatalog.ts](src/config/voiceCatalog.ts) y el juego busca el audio por su texto.

### Generar o actualizar las voces

Se generan con **Edge TTS** (voces de Microsoft, gratis y sin cuenta):

```bash
python -m pip install edge-tts   # una sola vez
npm run voces -- --list          # ver todas las frases (no genera nada)
npm run voces -- --sample        # probar la voz con 3 frases
npm run voces                    # generar las que falten o cuyo texto cambió
```

- Solo genera lo nuevo o lo que cambió, y **borra los audios que ya no se usan**.
- La voz, el tono y la velocidad se cambian en `.env.local` (ver [.env.example](.env.example)): `EDGE_VOICE`, `EDGE_PITCH`, `EDGE_RATE`. También funciona con Azure o ElevenLabs (`VOICE_PROVIDER`).
- En desarrollo, si una frase no tiene audio, la consola del navegador avisa con `[voz automática]` y se usa la voz del navegador como respaldo.

### Sonido al abrir el juego

Los navegadores no dejan sonar una página hasta que la persona la toca. Por eso el juego intenta sonar al abrir (algunos navegadores lo permiten, p. ej. con el juego instalado) y, si no, la música y el saludo de Tori arrancan con **el primer toque en cualquier parte** de la pantalla.

### Efectos y música

- `src/assets/audio/sfx/` → `pop`, `success`, `hint`, `star`, `medal`, `fanfare` (`.mp3` u `.ogg`).
- `src/assets/audio/music/theme.mp3` → música de fondo en bucle.

Si no existen, los efectos, la música tipo marimba y los sonidos de los juguetes se generan en el navegador (no pesan nada).

---

## Modo maestro (oculto para los niños)

Mantén presionado el **logo "Derechitos" durante 3 segundos** en la pantalla de título. Desde ahí se puede:

- **Abrir desafíos:** abre todos los juegos y retos sin candado (útil para la presentación). Con **Cerrar desafíos** vuelven a abrirse en orden.
- Reiniciar el progreso (pide confirmación con un segundo toque).
- Ajustar el **volumen de música, efectos y voz por separado**, o silenciar cada uno.
- **Probar sonido** y ver un diagnóstico del audio.
- Abrir el **Laboratorio** de componentes (Tori, globo, arrastrar y soltar, efectos).

---

## Ilustraciones y logo

- Las ilustraciones son dibujos vectoriales **originales** hechos con código en [src/art/Art.ts](src/art/Art.ts) (personajes articulados en [src/components/Puppet.ts](src/components/Puppet.ts)). Cada dibujo tiene un nombre (`mango`, `huerta`, `icon-salud`…) y se convierte en textura solo cuando una escena lo necesita. Para usar arte final, carga una imagen con la clave `art-<nombre>` en `Preload`.
- El **logo** (Tori sobre un sol con rayos) está en [public/icons/](public/icons/): `icon-512.png` / `icon-192.png` (navegador y app), `favicon-64.png` (pestaña), `apple-touch-icon.png` (iPhone, cuadrado) y `icon-maskable-512.png` (Android, con margen para los recortes en círculo o gota).

---

## Cómo agregar un juego con escena propia

> Para la mayoría de los juegos basta con los motores de datos (ver arriba). Esta sección es para juegos con mecánica nueva.

1. Crea la escena en `src/scenes/` extendiendo `BaseActivity` (juego definido en `rights.ts`) o `BaseLevel` (nivel de [src/config/levels.ts](src/config/levels.ts)). La base ya incluye a Tori, el globo, la voz, el bloqueo mientras Tori explica, la ayuda automática, los aciertos, los errores amables, las estrellas y la pantalla de recompensa.
2. Regístrala en [src/core/SceneRegistry.ts](src/core/SceneRegistry.ts) (una línea: `MiJuego: () => import('@/scenes/MiJuego')`).
3. Agrégala a su derecho en `rights.ts` y ejecuta `npm run voces` para generar sus frases.

Ejemplo mínimo:

```ts
import { BaseLevel } from './BaseLevel';

export default class Level09Scene extends BaseLevel {
  protected readonly art = ['mango'] as const;
  constructor() {
    super('Level09');
  }
  protected override buildLevel(): void {
    // Crea objetos con DraggableItem / DropZone y llama a:
    // this.instruct(linea) → indicación (bloquea los toques mientras Tori habla)
    // this.correct(x, y)   → acierto
    // this.mistake(pista)  → error amable
    // this.complete(linea) → fin del juego
  }
}
```

---

## Despliegue en GitHub Pages

El workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) compila y publica el juego en cada `push` a `main`.

1. Sube el proyecto a GitHub y en **Settings → Pages → Source** elige **GitHub Actions**.
2. Espera a que termine la acción (pestaña **Actions**). La dirección será `https://<usuario>.github.io/<repositorio>/`.
3. Para la clase: genera un **código QR** con esa dirección.

El workflow define `BASE_PATH=/<repositorio>/` automáticamente.

### Si no se ve la versión nueva

El juego guarda una copia para funcionar sin internet. Desde que tiene la actualización automática, al publicar una versión nueva se recarga solo. Si un navegador sigue mostrando una versión vieja (copias de antes de esa función):

- **Computadora:** `Ctrl + Shift + R` en la página del juego, o cerrar todas sus pestañas y volver a abrirlo.
- **Android (Chrome):** ⋮ → Configuración → Configuración de sitios → Todos los sitios → _github.io_ → **Borrar y restablecer** (borra también el avance guardado en ese celular).
- **iPhone:** Ajustes → Safari → Avanzado → Datos de sitios web → borrar _github.io_.
- Para comprobar rápido: abrir el enlace en una **pestaña de incógnito**.

### Instalar en Android

Abre la dirección publicada en Chrome → menú ⋮ → **Instalar app** (o "Agregar a la pantalla principal"). Después de abrirla una vez con internet, funciona **sin conexión** (cada voz se guarda la primera vez que suena).

---

## Arquitectura

```
src/
  main.ts                  → Phaser (Scale.EXPAND, área 1280x720 centrada) y registro de la PWA
  config/
    rights.ts              → los 8 derechos: juegos, retos y textos (data-driven)
    levels.ts              → datos de los juegos con escena propia (Level01..Level08)
    phrases.ts             → frases generales de Tori (inicio, mapa, zonas, medallas, diploma)
    voiceCatalog.ts        → frases que cambian al jugar y todas sus variantes (para sus voces)
    theme.ts               → paleta, tipografías, tamaños mínimos táctiles
  art/
    Art.ts                 → ilustraciones vectoriales originales (texturas bajo demanda)
    GameIcons.ts           → miniaturas de cada juego en las tarjetas
  core/
    GameState.ts           → progreso, estrellas, medallas, orden de apertura, diploma y ajustes
    AudioManager.ts        → música, efectos, voces grabadas (por id o por texto), volumen y ducking
    voiceKey.ts            → nombre de archivo de una voz según su texto
    SceneTransition.ts     → transición animada y carga de escenas bajo demanda
    SceneRegistry.ts       → división de código: un archivo por escena
    Orientation.ts         → horizontal y pantalla completa en celulares
    Viewport.ts            → pantallas anchas o altas sin franjas
  components/
    Tori.ts / ToriGuide.ts → personaje y su globo
    SpeechBubble.ts        → globo de diálogo con botón 🔊 para repetir
    Puppet.ts              → personajes articulados (caminar, correr, saltar, levantar la mano)
    HelperHand.ts          → manita de ayuda (5 s sin tocar)
    BigButton.ts, PillButton.ts, DraggableItem.ts, DropZone.ts, StarReward.ts, Effects.ts, Badges.ts…
  scenes/
    Boot, Preload, Title, Intro, WorldMap (isla), RightHub (pantalla de cada derecho),
    GameplayScene / BaseActivity / BaseLevel (bases de todos los juegos),
    un motor por tipo de juego (SortGame, CrossGame, TalkGame…), Level01..Level08,
    ActivityReward, Medals, Final (diploma), Teacher (modo maestro), Lab
  assets/audio/{voice,sfx,music}/  → audios (se detectan solos)
scripts/generate-voices.mjs → genera las voces de Tori (npm run voces)
public/icons/              → logo e íconos de la PWA
docs/guion-de-voces.md     → guion con las frases fijas de Tori
```

## Rendimiento

- Cada escena es un archivo aparte y se descarga solo cuando se necesita.
- Sin imágenes que descargar: las ilustraciones se generan como texturas al entrar a cada escena; los fondos estáticos se "hornean" una sola vez.
- Las voces **no** van en la descarga inicial de la app (≈ 2 MB): cada una se guarda en caché la primera vez que suena, así una versión nueva se instala en segundos.
- Partículas recicladas (pooling); tweens, timers y listeners se destruyen al salir de cada escena.
- Textos con resolución limitada a `Math.min(devicePixelRatio, 2)`.

## Accesibilidad

- Textos en tinta oscura sobre fondos claros (contraste AA).
- El significado nunca depende solo del color: aciertos con palomita ✓, estrellas llenas vs. contorno, candados en lo bloqueado.
- Botones y objetos con área táctil grande y bien separados.
- Respeta `prefers-reduced-motion` (animaciones más cortas, menos partículas).
- Volumen de música, efectos y voz por separado (modo maestro).
- El cuadro para escribir el nombre del diploma funciona en celulares (teclado visible, sin bloqueos de selección).
