'use strict';

// Módulo de puntaje independiente del render y del DOM.
// Se carga como script clásico (sin ES modules) para que el juego siga
// funcionando al abrir index.html directamente con file://.
//
// Uso: game.js calcula `tSpin` con ScoreManager.detectTSpin(...) justo antes de
// fusionar la pieza al tablero, y luego llama a processTurn(...) tras el colapso
// de líneas. El resultado trae los puntos ganados; game.js los suma a `score`.

const T_TYPE = 3; // índice de la T en PIECES / COLORS de game.js

// Tabla oficial (Tetris Guideline). Todo se multiplica por el nivel.
const CLEAR_SCORES = [0, 100, 300, 500, 800];          // índice = líneas
const TSPIN_SCORES = [400, 800, 1200, 1600];           // T-Spin: 0..3 líneas
const TSPIN_MINI_SCORES = [100, 200, 400];             // T-Spin Mini: 0..2 líneas
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]; // índice = líneas
const PERFECT_CLEAR_B2B_TETRIS = 3200;
const COMBO_BONUS = 50;
const B2B_MULTIPLIER = 1.5;

const LINE_NAMES = ['', ' SINGLE', ' DOUBLE', ' TRIPLE', ' TETRIS'];

class ScoreManager {
  /**
   * @param {{ onTurn?: (result: object) => void }} [options]
   *   onTurn se invoca al final de cada processTurn con el resultado.
   */
  constructor({ onTurn } = {}) {
    this.onTurn = onTurn;
    this.reset();
  }

  reset() {
    this.comboCount = -1;      // -1 = sin racha; el primer clear la pasa a 0
    this.isB2BActive = false;  // true tras un "movimiento difícil"
  }

  /**
   * Detecta T-Spin con la regla de 3 esquinas.
   * Debe llamarse ANTES de merge(): las esquinas se evalúan contra el tablero
   * sin la propia T, y la pieza aún tiene su forma/posición finales.
   *
   * @returns {'none' | 'mini' | 'full'}
   */
  static detectTSpin({ board, piece, lastActionWasRotation, rows, cols }) {
    // 1) Solo la T, y solo si el último movimiento exitoso fue una rotación.
    if (piece.type !== T_TYPE || !lastActionWasRotation) return 'none';

    // 2) Centro de la T. rotateCW mantiene la matriz 3x3 girando sobre la
    //    celda central [1][1], así que el centro es siempre (x+1, y+1).
    const cx = piece.x + 1;
    const cy = piece.y + 1;

    // 3) Una esquina cuenta como ocupada si está fuera del tablero
    //    (paredes laterales o suelo) o si hay un bloque fijo.
    //    Por encima del tablero (y < 0) se considera vacía.
    const occupied = (x, y) => {
      if (x < 0 || x >= cols || y >= rows) return true;
      if (y < 0) return false;
      return board[y][x] !== 0;
    };

    // 4) Dirección a la que apunta la T: la T tiene 3 vecinos ortogonales
    //    ocupados y 1 vacío; la punta ("nub") mira al lado OPUESTO al vacío.
    //    Ejemplo: forma inicial [[0,3,0],[3,3,3],[0,0,0]] -> vacío abajo, apunta arriba.
    const s = piece.shape;
    let dx = 0, dy = 0; // vector hacia donde apunta
    if (!s[0][1]) dy = 1;        // vacío arriba  -> apunta abajo
    else if (!s[2][1]) dy = -1;  // vacío abajo   -> apunta arriba
    else if (!s[1][0]) dx = 1;   // vacío izq.    -> apunta a la derecha
    else dx = -1;                // vacío der.    -> apunta a la izquierda

    // 5) Las 4 esquinas diagonales, separadas en frontales (lado de la punta)
    //    y traseras. Una esquina (sx, sy) es frontal si su componente en el eje
    //    de apuntado coincide con (dx, dy).
    let front = 0;
    let back = 0;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        if (!occupied(cx + sx, cy + sy)) continue;
        const isFront = dx !== 0 ? sx === dx : sy === dy;
        if (isFront) front++; else back++;
      }
    }

    // 6) Al menos 3 de 4 esquinas ocupadas, si no es un movimiento normal.
    if (front + back < 3) return 'none';

    // 7) T-Spin regular si las 2 esquinas frontales están ocupadas;
    //    si solo hay 1 frontal (y por tanto 2 traseras) es Mini.
    //    Nota: tryRotate solo tiene wall kicks horizontales, así que no existe
    //    la excepción SRS que asciende un Mini a regular por un kick 1x2.
    return front === 2 ? 'full' : 'mini';
  }

  /**
   * Procesa un bloqueo de pieza.
   *
   * @param {object} eventData
   * @param {number} eventData.linesCleared líneas eliminadas por esta pieza (0-4)
   * @param {number} eventData.level        nivel vigente al bloquear (antes de subir)
   * @param {'none'|'mini'|'full'} eventData.tSpin resultado de detectTSpin
   * @param {number[][]} eventData.board    tablero DESPUÉS del colapso de líneas
   */
  processTurn({ linesCleared, level, tSpin = 'none', board }) {
    const lines = linesCleared;
    const isTSpin = tSpin !== 'none';

    // --- Sin líneas: solo puede haber T-Spin sin líneas; el combo se rompe ---
    if (lines === 0) {
      this.comboCount = -1; // B2B no se altera con locks sin limpiar
      const points = isTSpin
        ? (tSpin === 'mini' ? TSPIN_MINI_SCORES[0] : TSPIN_SCORES[0]) * level
        : 0;
      return this._finish({
        points, linesCleared: 0, tSpin, isDifficult: false, b2b: false,
        comboCount: -1, isPerfectClear: false,
        labels: isTSpin ? [tSpin === 'mini' ? 'T-SPIN MINI!' : 'T-SPIN!'] : [],
      });
    }

    // --- Puntaje base ---
    let base;
    if (tSpin === 'mini') base = TSPIN_MINI_SCORES[Math.min(lines, 2)];
    else if (tSpin === 'full') base = TSPIN_SCORES[Math.min(lines, 3)];
    else base = CLEAR_SCORES[lines] || 0;

    // --- Back-to-Back ---
    // "Difícil" = Tetris o cualquier T-Spin que limpie >= 1 línea.
    // Un clear normal (1-3 líneas) rompe la racha.
    const isDifficult = isTSpin || lines === 4;
    const b2b = isDifficult && this.isB2BActive;
    this.isB2BActive = isDifficult;
    if (b2b) base = Math.floor(base * B2B_MULTIPLIER);

    let points = base * level;

    // --- Combo: 50 * combo * nivel (el primer clear es combo 0 => sin bonus) ---
    this.comboCount++;
    if (this.comboCount > 0) points += COMBO_BONUS * this.comboCount * level;

    // --- Perfect Clear: tablero completamente vacío tras el colapso ---
    const isPerfectClear = board.every(row => row.every(v => v === 0));
    if (isPerfectClear) {
      const pc = (lines === 4 && b2b) ? PERFECT_CLEAR_B2B_TETRIS : PERFECT_CLEAR_SCORES[lines];
      points += pc * level;
    }

    // --- Etiquetas para el feedback visual ---
    const main = isTSpin
      ? `T-SPIN${tSpin === 'mini' ? ' MINI' : ''}${LINE_NAMES[lines]}!`
      : lines === 4 ? 'TETRIS!' : '';
    const labels = [];
    if (main) labels.push(b2b ? `B2B ${main}` : main);
    if (this.comboCount >= 1) labels.push(`COMBO x${this.comboCount}`);
    if (isPerfectClear) labels.push('PERFECT CLEAR!');

    return this._finish({
      points, linesCleared: lines, tSpin, isDifficult, b2b,
      comboCount: this.comboCount, isPerfectClear, labels,
    });
  }

  _finish(result) {
    if (this.onTurn) this.onTurn(result);
    return result;
  }
}
