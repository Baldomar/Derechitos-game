# Derechitos: la aventura de Tori

Videojuego educativo web para niñas y niños de **5 a 7 años** que enseña **derechos humanos** mediante actividades lúdicas.
Proyecto del Laboratorio I, Cómputo III, Universidad Gerardo Barrios (El Salvador).

Tori, un **torogoz** (ave nacional de El Salvador), guía al jugador por la **Isla Derechitos**. Cada zona de la isla es un nivel con una mecánica distinta. No hace falta saber leer: todas las instrucciones tienen voz y un botón 🔊 para repetirlas.

- **Stack:** TypeScript (modo estricto) · Phaser 3 · Vite · vite-plugin-pwa · ESLint + Prettier
- **Instalable (PWA)** y funciona **sin internet** después de la primera visita.
- **Sin castigos:** no hay vidas, cronómetro ni pantallas de "perdiste". Siempre se gana al menos 1 estrella.

---

## Niveles, derechos y mecánicas (para la presentación)

| # | Zona | Derecho(s) | Mecánica | Lo que aprende el niño |
|---|------|-----------|----------|------------------------|
| 1 | Casa segura | Vivienda y vida | Arrastrar paredes, techo, ventana y puerta a su silueta; cuando llueve, llevar a la familia adentro por la puerta. Sale el arcoíris. | Todos tienen derecho a un hogar seguro y a vivir protegidos. |
| 2 | Lonchera nutritiva | Alimentación | Arrastrar alimentos nutritivos (mango, guineo, frijoles, leche, verduras) a la lonchera. Dulces, soda y papitas rebotan con una pista amable. | Comer rico y nutritivo todos los días. |
| 3 | Clínica de Tori | Salud | Elegir en orden quién ayuda (doctora), qué usa (termómetro, curita) y qué protege (vacuna). El osito se recupera. | Recibir cuidados cuando enfermamos. |
| 4 | Rompecabezas escolar | Educación | Rompecabezas de 6 piezas del salón de clases; el salón cobra vida y se relacionan útiles escolares con su sombra. | Ir a la escuela y aprender. |
| 5 | Parque para todos | Igualdad y no discriminación | Poner una rampa para Sofía (silla de ruedas) y luego invitar a todos tocándolos. | "Cuando todos caben, todos ganamos." |
| 6 | Día y noche | Jugar y descansar | El cielo pasa de día a noche y se divide; llevar pelota, papalote y trompo al sol, y cama, pijama y cuento a la luna. | Jugar y descansar nos ayudan a crecer. |
| 7 | Mi voz cuenta | Expresar opiniones | Elegir una carita de cómo se siente (Tori responde con empatía) y votar por el nombre del perrito del parque. **No hay respuestas incorrectas.** | Decir lo que pensamos y sentimos. |
| 8 | Memorama de derechos | Repaso de todos | Memoria con 8 parejas (ilustración ↔ ícono y nombre del derecho). Al terminar se arma la imagen de la isla. | Recordar los 8 derechos. |

Al completar todo se obtiene el **Diploma "Guardián de los Derechos"**, y el **Álbum** guarda las 8 estampas (al tocarlas, Tori repite el derecho aprendido).

### Reglas pedagógicas aplicadas

- **Error amable:** el objeto regresa con rebote, Tori inclina la cabeza y da una pista concreta en voz.
- **Acierto:** sonido alegre, destellos, palomita ✓ (forma e ícono, no solo color), vibración suave y un elogio variado.
- **Estrellas:** 3 sin errores, 2 con 1–2 errores, 1 con más. Las estrellas nunca bajan al repetir un nivel.
- **Ayuda automática:** tras 8 s sin interacción aparece una manita que muestra qué tocar o arrastrar, y Tori repite la instrucción.
- **Desbloqueo secuencial** de niveles en el mapa.

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

- Desbloquear todos los niveles (útil para la presentación) o volver al desbloqueo secuencial.
- Reiniciar el progreso (pide confirmación con un segundo toque).
- Ajustar el **volumen de música, efectos y voz por separado**, o silenciar cada uno.
- **Probar sonido** y ver un diagnóstico (si el audio está activo y qué voz en español se usa).
- Abrir el **Laboratorio** de componentes (Tori, globo, arrastrar y soltar, efectos).

---

## Cómo reemplazar las voces de Tori

Por defecto Tori habla con la voz sintética del navegador en español (es-MX / es-US, tono un poco agudo).
Para usar voces grabadas por el equipo:

1. Abre **[docs/guion-de-voces.md](docs/guion-de-voces.md)**: tiene las 75 líneas con el nombre de archivo de cada una.
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

## Cómo agregar un nivel

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
    Boot, Preload, Title, Intro, WorldMap, Level01..Level08, Reward, Album, Final, Teacher, Lab
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
