# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Modo Desafío](#modo-desafío)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** de la Tetris Guideline (100 / 300 / 500 / 800 × nivel) con **combos**, **T-Spin** (Mini y regular), **Back-to-Back** (×1.5) y **Perfect Clear**.
- **Feedback audiovisual**: sonidos sintetizados con Web Audio API, textos flotantes y _screen shake_ en las jugadas grandes.
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `Z`       | Rotar en sentido antihorario      |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Pausar / reanudar                 |

---

## Modo Desafío

El selector **MODO** del panel derecho cambia entre el modo clásico y cinco desafíos. Cada uno muestra en un panel a la izquierda su objetivo, progreso, tiempo y modificadores; al terminar aparece un overlay con **Siguiente desafío**, **Reintentar** y **Salir del desafío**.

| # | Desafío | Objetivo | Modificadores |
| - | ------- | -------- | ------------- |
| 1 | Sprint de 40 líneas | 40 líneas en 120 s (si se agota el tiempo, pierdes) | — |
| 2 | Basura ascendente | Sobrevivir 90 s | Cada 10 s sube una fila de basura con 1 hueco (aviso rojo los 3 s previos) |
| 3 | Tablero pre-colocado | 10 líneas | Empiezas con el patrón `piramide` en el fondo |
| 4 | Piezas invisibles | 10 líneas | Los bloques fijados no se dibujan, pero siguen en el tablero |
| 5 | Rotación inversa | 15 líneas | Nivel inicial 6; `↑`/`X` giran a la izquierda y `Z` a la derecha |

Para añadir un desafío basta con una entrada nueva en `CHALLENGES` (`challenges.js`) con su `goal`, `timeLimit` opcional y los `modifiers` que cambia (ver `DEFAULT_MODIFIERS` en `challengeManager.js`). Un patrón de tablero nuevo es otra entrada en `BOARD_PATTERNS`; un tipo de objetivo nuevo (puntuación, combo...) es una entrada en `GOAL_TYPES`.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: `lockPiece` detecta el T-Spin (`ScoreManager.detectTSpin`) y delega el cálculo en `ScoreManager.processTurn` (ver abajo); el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **`lastActionWasRotation`**: bandera que se activa al rotar con éxito y se apaga con cualquier movimiento, caída o pieza nueva; es el requisito del T-Spin.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.

### 4. `scoreManager.js`, `soundEffects.js`, `visualEffects.js`

Scripts clásicos (sin ES modules, para que el juego siga abriéndose con `file://`) que se cargan antes de `game.js`.

- **`ScoreManager`** (puro, sin DOM): guarda `comboCount` (empieza en `-1`) e `isB2BActive`. `processTurn({ linesCleared, level, tSpin, board })` devuelve `{ points, labels, comboCount, b2b, isPerfectClear, ... }` y llama al callback `onTurn`.
  - **Base** (× nivel): 100 / 300 / 500 / 800; T-Spin 400 / 800 / 1200 / 1600; T-Spin Mini 100 / 200 / 400.
  - **Combo**: `50 × comboCount × nivel`; un bloqueo sin líneas lo reinicia a `-1`.
  - **B2B**: Tetris y T-Spin con líneas son "difíciles"; dos seguidos multiplican el valor base por 1.5. Una limpieza normal de 1–3 líneas rompe la racha.
  - **Perfect Clear**: tablero vacío tras el colapso; 800 / 1200 / 1800 / 2000 (3200 para un Tetris con B2B) × nivel.
  - **T-Spin** (`detectTSpin`): solo la T, tras una rotación, con ≥ 3 de sus 4 esquinas diagonales ocupadas (paredes y suelo cuentan). Es regular si están ocupadas las 2 esquinas frontales (las del lado al que apunta la T) y Mini si no.
- **`SoundEffects`**: `AudioContext` creado en el primer `keydown`; tonos ascendentes por combo, diente de sierra distorsionado para T-Spin y arpegio + acorde para Perfect Clear.
- **`VisualEffects`**: `showText` (clases `fade-up`, `shake`, `gold-glow`, `tspin`, `combo`) sobre la capa `#fx-layer` y `shake` sobre `#board-wrap`. Los estilos están en la sección `Efectos` de `style.css` y respetan `prefers-reduced-motion`.

### 5. `challenges.js`, `challengeManager.js`

- **`challenges.js`**: solo datos (`CHALLENGES`, `BOARD_PATTERNS`).
- **`ChallengeManager`** (puro, sin DOM): guarda el desafío activo, su estado (`running` / `won` / `lost`), el tiempo y las estadísticas. `game.js` le pasa el `dt` del bucle (`update`) y el resultado de cada pieza fijada (`recordTurn`, con las líneas que devuelve `clearLines`), y consulta `modifiers`. Sin desafío activo, `modifiers` devuelve `DEFAULT_MODIFIERS`, así que el clásico nunca hereda configuración. No usa timers: pausa y game over congelan el reloj porque cancelan el bucle.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme) y efectos
├── game.js         # Lógica del Tetris (tablero, piezas, bucle, input)
├── scoreManager.js # Puntaje: combos, T-Spin, B2B, Perfect Clear
├── challenges.js   # Datos del Modo Desafío (desafíos y patrones de tablero)
├── challengeManager.js # Lógica del Modo Desafío (estado, tiempo, modificadores)
├── soundEffects.js # Sonidos procedurales (Web Audio API)
├── visualEffects.js# Textos flotantes y screen shake
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 7 colores             |
| `CLEAR_SCORES` | Puntos por 1–4 líneas (en `scoreManager.js`) | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Triage automático de issues

Cada vez que se crea un issue o se edita su título/descripción, el workflow `.github/workflows/claude-issue-triage.yml` usa Claude para asignar labels (tipo, `area:*`, `priority:*`) y publicar un único comentario con un diagnóstico general del problema. Requiere el secret `CLAUDE_CODE_OAUTH_TOKEN` en el repositorio.

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
