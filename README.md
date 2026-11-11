# Derechitos: la aventura de Tori

Videojuego educativo web para niñas y niños de **5 a 7 años** que enseña **derechos humanos** mediante actividades lúdicas.
Proyecto del Laboratorio I, Cómputo III, Universidad Gerardo Barrios (El Salvador).

Tori, un **torogoz** (ave nacional de El Salvador), guía al jugador por la **Isla Derechitos**. En la isla hay una casita por cada derecho; dentro de cada una hay juegos, desafíos y una medalla. No hace falta saber leer: todas las instrucciones tienen voz y un botón 🔊 para repetirlas.

- **Stack:** TypeScript (modo estricto) · Phaser 3 · Vite · vite-plugin-pwa · ESLint + Prettier
- **Instalable (PWA)** y funciona **sin internet** después de la primera visita.
- **Sin castigos:** no hay vidas, cronómetro ni pantallas de "perdiste". Siempre se gana al menos 1 estrella.

---

## La Isla Derechitos (para la presentación)

Al tocar **¡Jugar!** el niño llega a la **isla**, con una casita por derecho (ícono grande, color propio y nombre corto). Al tocar una casita, Tori dice una frase sencilla del derecho y se entra a su pantalla.

Cada derecho tiene: **explicación animada** (2–3 frases con voz), **Juegos**, **Desafíos** (se abren al completar los juegos; el desafío final se abre al completar los otros desafíos), **barra de progreso**, **estrellas** y **medalla**. La pantalla **Mis medallas** muestra lo ganado y, con al menos una medalla, el **Diploma "Guardián de los Derechos"**.

| Derecho | Qué dice Tori | Juegos | Medalla |
|---------|---------------|--------|---------|
| **Salud** (principal, completo) | Tengo derecho a recibir atención médica y cuidados. | ¿Sano o no sano? · Lava tus manos · Visita al doctor · Clínica de Tori — **Desafíos:** Mi día saludable · Ayuda a tu amigo · Desafío final | Guardián de la Salud |
| Educación | Todos los niños tienen derecho a aprender y asistir a la escuela. | Rompecabezas escolar · Útiles escolares · Memorama de derechos | Guardián del Saber |
| Vida | Mi vida debe ser protegida y respetada. | Me cuidan y me protegen · *próximamente* | Guardián de la Vida |
| Alimentación | Tengo derecho a recibir alimentos nutritivos. | Plato sano · Lonchera nutritiva · *próximamente* | Guardián de la Buena Comida |
| Vivienda | Tengo derecho a vivir en un lugar seguro. | Casa segura · Mi hogar y mi familia · *próximamente* | Guardián del Hogar |
| Igualdad y no discriminación | Todos los niños merecen respeto, sin importar sus diferencias. | Parque para todos · Todos merecemos respeto · *próximamente* | Guardián de la Igualdad |
| Jugar y descansar | Tengo derecho a divertirme, descansar y disfrutar de mi infancia. | ¿Jugar o descansar? · Día y noche · *próximamente* | Guardián del Juego |
| Expresar opiniones | Puedo expresar lo que siento y pienso, y ser escuchado. | Mi voz cuenta · *próximamente* | Guardián de Mi Voz |

Los desafíos de los derechos distintos de Salud están marcados como *próximamente*, con la misma estructura para completarlos.

### Mecánica de cada juego

| Juego | Derecho | Mecánica |
|-------|---------|----------|
| ¿Sano o no sano? / Plato sano / ¿Jugar o descansar? | Salud / Alimentación / Jugar | Arrastrar cada cosa a su grupo (carita feliz o triste, sol o luna); lo incorrecto rebota con una pista. |
| Lava tus manos / Mi día saludable | Salud | Ordenar pasos en sus números (mojar → jabón → frotar → enjuagar → secar). |
| Visita al doctor / Útiles escolares / Mi hogar y mi familia | Salud / Educación / Vivienda | Memorama de 6 parejas. |
| Ayuda a tu amigo / Desafío final / Me cuidan y me protegen / Todos merecemos respeto | Salud / Vida / Igualdad | Elegir la(s) respuesta(s) correcta(s) con imágenes. |
| Clínica de Tori | Salud | Elegir en orden quién ayuda (doctora), qué usa (termómetro, curita) y qué protege (vacuna). El osito se recupera. |
| Casa segura | Vivienda | Armar la casa (paredes, techo, ventana, puerta); cuando llueve, llevar a la familia adentro. Sale el arcoíris. |
| Lonchera nutritiva | Alimentación | Llenar la lonchera con alimentos nutritivos; dulces, soda y papitas rebotan con una pista amable. |
| Rompecabezas escolar | Educación | Rompecabezas de 6 piezas del salón; el salón cobra vida y se relacionan útiles con su sombra. |
| Parque para todos | Igualdad | Poner una rampa para Sofía (silla de ruedas) e invitar a todos. "Cuando todos caben, todos ganamos." |
| Día y noche | Jugar | El cielo pasa de día a noche; llevar cada objeto al sol (jugar) o a la luna (descansar). |
| Mi voz cuenta | Expresar opiniones | Elegir cómo se siente y votar por el nombre del perrito. **No hay respuestas incorrectas.** |
| Memorama de derechos | Educación | Memoria con 8 parejas de derechos; al final se arma la imagen de la isla. |

### Reglas pedagógicas aplicadas

- **Error amable:** el objeto regresa con rebote, Tori inclina la cabeza y da una pista concreta en voz ("¡Inténtalo otra vez!").
- **Acierto:** sonido alegre, destellos, palomita ✓ (forma e ícono, no solo color), vibración suave y un elogio variado.
- **Estrellas:** 3 sin errores, 2 con 1–2 errores, 1 con más. Las estrellas nunca bajan al repetir un juego.
- **Ayuda automática:** tras 8 s sin interacción aparece una manita que muestra qué tocar o arrastrar, y Tori repite la instrucción.

### Cómo completar un derecho "próximamente"

Todo está en [src/config/rights.ts](src/config/rights.ts). Hay 4 motores de minijuegos reutilizables; solo se escriben datos:

| `kind` | Motor | Qué se define |
|--------|-------|---------------|
| `sort` | Clasificar (arrastrar a su grupo) | `bins` (grupos con dibujo) e `items` (cada cosa con su grupo y una pista) |
| `sequence` | Ordenar pasos 1, 2, 3… | `steps` en el orden correcto, cada uno con su pista |
| `memory` | Memorama de parejas | `items` (6 parejas recomendadas) |
| `choice` | Elegir respuesta(s) | `rounds`: pregunta + opciones (`correct: true/false`, pista opcional) |
| `level` | Juego con escena propia | `sceneKey` de una escena en `src/scenes/` (como `Level01`…`Level08`) |

Reemplaza un `soon('id', 'Título', 'icono')` por una actividad con alguno de esos `kind`. Para que un desafío entregue la medalla del derecho, márcalo con `medal: true`. Los dibujos disponibles están en [src/art/Art.ts](src/art/Art.ts).

---

## Instalación

Requisitos: **Node.js 20 o superior** (probado con Node 24).

```bash
npm install
```

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm start` (o `npm run dev`) | Servidor de desarrollo con recarga en caliente, accesible desde la red local. |
| `npm run build` | Revisa TypeScript y genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve la versión de producción (incluye la PWA y el modo sin internet). |
| `npm run typecheck` | Solo revisa tipos de TypeScript. |
| `npm run lint` / `npm run lint:fix` | Revisa (y corrige) el código con ESLint. |
| `npm run format` | Da formato con Prettier. |

### Probar en el celular (misma red Wi-Fi)

1. Ejecuta `npm start`.
2. En el celular abre la dirección **Network** que muestra Vite (por ejemplo `http://192.168.0.15:5173`).
3. Si no carga, permite Node.js en el Firewall de Windows para redes privadas.

> La instalación como app y el modo sin internet requieren **HTTPS**: pruébalos con la versión publicada en GitHub Pages.

---

## Modo maestro (oculto para los niños)

Mantén presionado el **logo "Derechitos" durante 3 segundos** en la pantalla de título. Desde ahí se puede:

- Abrir todos los desafíos (útil para la presentación) o volver a que se abran al terminar los juegos.
- Reiniciar el progreso (pide confirmación con un segundo toque).
- Ajustar el **volumen de música, efectos y voz por separado**, o silenciar cada uno.
- **Probar sonido** y ver un diagnóstico (si el audio está activo y qué voz en español se usa).
- Abrir el **Laboratorio** de componentes (Tori, globo, arrastrar y soltar, efectos).

---

## Cómo reemplazar las voces de Tori

Por defecto Tori habla con la voz sintética del navegador en español (es-MX / es-US, tono un poco agudo).
Para usar voces grabadas por el equipo:

1. Abre **[docs/guion-de-voces.md](docs/guion-de-voces.md)**: tiene las 170 líneas con el nombre de archivo de cada una.
2. Graba cada línea y guárdala como `src/assets/audio/voice/<id>.mp3` (por ejemplo `level01_intro.mp3`). También se acepta `.ogg` o `.m4a`.
3. Listo: Vite detecta los archivos solos al compilar. No hay que editar ninguna lista. Las líneas sin grabación siguen usando la voz sintética.

También se pueden reemplazar los efectos y la música:

- `src/assets/audio/sfx/` → `pop`, `success`, `hint`, `star`, `medal`, `fanfare` (`.mp3` u `.ogg`).
- `src/assets/audio/music/theme.mp3` → música de fondo en bucle.

Si no existen, los efectos y una música suave tipo marimba se generan en el navegador (no pesan nada).

## Cómo reemplazar las ilustraciones

Las ilustraciones son placeholders vectoriales **originales** dibujados con código en [src/art/Art.ts](src/art/Art.ts). Cada dibujo tiene un nombre (`mango`, `doctora`, `icon-salud`…) y se convierte en textura `art-<nombre>` solo cuando una escena lo necesita.

Para usar arte final: carga una imagen (PNG/WebP o un atlas) con la clave `art-<nombre>` en `Preload` y el juego la usará en lugar del dibujo.

---

## Cómo agregar un juego con escena propia

> Para la mayoría de los juegos basta con los 4 motores de datos (ver arriba). Esta sección es para juegos con mecánica nueva. Al final, agrégalo a su derecho en `rights.ts` con `level('id', 'Título', 'icono', 'LevelNN')`.

Los niveles están definidos por datos en [src/config/levels.ts](src/config/levels.ts) (textos, objetos, respuestas, pistas y mensaje final).

**Para cambiar el contenido de un nivel existente** (otros alimentos, otras preguntas, otras pistas) solo edita sus datos en `levels.ts`; no hace falta tocar el motor.

**Para agregar un nivel nuevo:**

1. En `levels.ts`, agrega una entrada a `LEVELS` con su `id`, número, zona del mapa (`zone`), medalla, estampa, diálogos y `content`. Puedes reutilizar uno de los tipos de mecánica existentes (`lunchbox`, `clinic`, `daynight`…) o crear uno nuevo en `LevelContent`.
2. Crea `src/scenes/LevelNN.ts` extendiendo `BaseLevel`. Solo implementas `buildLevel()` (y opcionalmente `onIntroDone()` y `getHint()`). `BaseLevel` ya incluye a Tori, el globo de diálogo, la voz, la ayuda automática, los aciertos, los errores amables, las estrellas y el paso a la recompensa.
3. Registra la escena en [src/core/SceneRegistry.ts](src/core/SceneRegistry.ts) (una línea: `LevelNN: () => import('@/scenes/LevelNN')`) y agrega la clave a `LevelSceneKey`.

Ejemplo mínimo de escena:

```ts
import { BaseLevel } from './BaseLevel';

export default class Level09Scene extends BaseLevel {
  protected readonly art = ['mango'] as const;
  constructor() {
    super('Level09');
  }
  protected override buildLevel(): void {
    // Crea objetos con DraggableItem / DropZone y llama a:
    // this.correct(x, y)  → acierto
    // this.mistake(pista) → error amable
    // this.complete(linea) → fin del nivel
  }
}
```

---

## Despliegue en GitHub Pages

El workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) compila y publica el juego en cada `push` a `main`.

1. Crea un repositorio en GitHub y sube el proyecto:
   ```bash
   git add .
   git commit -m "Derechitos: la aventura de Tori"
   git branch -M main
   git remote add origin https://github.com/<usuario>/<repositorio>.git
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Source → GitHub Actions**.
3. Espera a que termine la acción (pestaña **Actions**). La dirección será `https://<usuario>.github.io/<repositorio>/`.
4. Para la clase: genera un **código QR** con esa dirección para que los compañeros lo escaneen.

El workflow define `BASE_PATH=/<repositorio>/` automáticamente, así que no hay que configurar nada más.

### Instalar en Android

Abre la dirección publicada en Chrome → menú ⋮ → **Instalar app** (o "Agregar a la pantalla principal"). Después de abrirla una vez con internet, funciona **sin conexión**.

---

## Arquitectura

```
src/
  main.ts                  → configuración de Phaser (Scale.FIT, 1280x720, autoCenter)
  config/
    levels.ts              → datos de los 8 niveles y los derechos (data-driven)
    phrases.ts             → frases generales de Tori (intro, elogios, mapa, álbum, final)
    theme.ts               → paleta, tipografías, tamaños mínimos táctiles
  art/Art.ts               → ilustraciones vectoriales originales (texturas bajo demanda)
  core/
    GameState.ts           → progreso, estrellas, medallas, álbum y ajustes (localStorage con try/catch)
    AudioManager.ts        → música, efectos, voz, volumen por canal y ducking
    SceneTransition.ts     → transición animada y carga de escenas bajo demanda
    SceneRegistry.ts       → división de código: un chunk por escena
    Textures.ts / Bake.ts  → texturas de Tori y efectos; "horneado" de fondos estáticos
    Device.ts              → prefers-reduced-motion y vibración
  components/
    Tori.ts                → personaje con estados idle, talk, happy, think, celebrate (+ saludo)
    SpeechBubble.ts        → globo de diálogo con botón 🔊 para repetir
    BigButton.ts           → botón grande (≥ 88 px) con squash & stretch y sonido
    DraggableItem.ts       → objeto arrastrable con retorno elástico
    DropZone.ts            → zona de destino que se resalta al pasar encima
    StarReward.ts          → estrellas que vuelan al contador
    Effects.ts             → confeti y destellos con object pooling
    HelperHand.ts          → manita de ayuda tras 8 s sin interacción
    Badges.ts              → medallas y estampas
  scenes/
    Boot, Preload, Title, Intro, WorldMap (isla con las casitas), RightHub (pantalla de cada derecho),
    SortGame, SequenceGame, MemoryGame, ChoiceGame (motores), Level01..Level08 (juegos con escena propia),
    ActivityReward, Medals, Final (diploma), Teacher, Lab
  assets/audio/{voice,sfx,music}/  → audios opcionales (se detectan solos)
public/icons/              → íconos de la PWA
docs/guion-de-voces.md     → guion para grabar las voces
```

## Rendimiento

- **Carga inicial ≈ 340 KB comprimidos** (Phaser ≈ 319 KB + juego ≈ 15 KB). Cada escena es un archivo aparte de 1–3 KB y se descarga solo cuando se necesita; se precarga **solo el nivel siguiente**.
- Sin imágenes que descargar: las ilustraciones se generan como texturas al entrar a cada escena.
- Fondos y botones se "hornean" en texturas una sola vez (no se redibujan en cada cuadro).
- Partículas recicladas (pooling); tweens, timers y listeners se destruyen al salir de cada escena.
- Textos con resolución limitada a `Math.min(devicePixelRatio, 2)`.
- Durante una transición la escena anterior deja de dibujarse para no competir con la carga de la siguiente.

## Accesibilidad

- Textos en tinta oscura sobre fondos claros (contraste AA).
- El significado nunca depende solo del color: aciertos con palomita ✓, estrellas llenas vs. contorno, candados en zonas bloqueadas.
- Botones y objetos con área táctil mínima de 88 px y bien separados.
- Respeta `prefers-reduced-motion` (animaciones más cortas, menos partículas).
- Volumen de música, efectos y voz por separado (modo maestro).
