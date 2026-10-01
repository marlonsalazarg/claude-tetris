'use strict';

// Lógica del Modo Desafío, independiente del DOM y del render (como scoreManager.js).
// game.js le pasa el tiempo (update) y los resultados de cada turno (recordTurn),
// y consulta `modifiers` para adaptar el motor. No usa timers propios: el único
// reloj es el dt del game loop, así que pausa y game over lo congelan solos.

// Valores del modo clásico. Un desafío solo declara lo que cambia; sin desafío
// activo `modifiers` devuelve exactamente esto, así el clásico nunca hereda nada.
const DEFAULT_MODIFIERS = Object.freeze({
  rotationDirection: 1,    // 1 normal, -1 invierte la rotación
  startLevel: 1,
  invisibleLocked: false,  // no dibujar bloques fijados (siguen en el board)
  boardPattern: null,      // ver BOARD_PATTERNS en challenges.js
  garbageInterval: 0,      // segundos entre filas de basura; 0 = desactivado
  garbageRows: 1,          // filas por tanda
  garbageHoles: 1,         // huecos aleatorios por fila
  garbageWarning: 3,       // segundos de aviso visual previo
});

const fmtTime = ms => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Tipos de objetivo. Añadir uno nuevo (puntuación, combo...) es una entrada más:
// stats ya acumula lines, score, maxCombo y garbageRows.
const GOAL_TYPES = {
  lines: {
    isMet: (stats, goal) => stats.lines >= goal.target,
    objective: (goal, def) =>
      `Limpia ${goal.target} líneas${def.timeLimit ? ` en ${def.timeLimit} s` : ''}`,
    progress: (stats, goal) => `Líneas: ${Math.min(stats.lines, goal.target)} / ${goal.target}`,
  },
  survive: {
    // Se gana por tiempo (onTimeUp: 'win'); perder = top-out.
    isMet: () => false,
    objective: (goal, def) => `Sobrevive${def.timeLimit ? ` ${def.timeLimit} s` : ''}`,
    progress: stats => `Basura recibida: ${stats.garbageRows}`,
  },
};

const MODIFIER_LABELS = {
  rotationDirection: v => (v === -1 ? 'Rotación inversa' : null),
  startLevel: v => (v > 1 ? `Nivel inicial ${v}` : null),
  invisibleLocked: v => (v ? 'Piezas invisibles al fijarse' : null),
  boardPattern: v => (v ? 'Tablero pre-colocado' : null),
  garbageInterval: v => (v > 0 ? `Basura cada ${v} s` : null),
};

const RESULT_TEXT = {
  'won:goal': 'Objetivo cumplido',
  'won:timeup': 'Has sobrevivido',
  'lost:timeup': 'Se acabó el tiempo',
  'lost:topout': 'El tablero se llenó',
};

class ChallengeManager {
  /** @param {object[]} definitions lista ordenada de desafíos (CHALLENGES) */
  constructor(definitions) {
    this.definitions = definitions;
    this.select(null);
  }

  /** Elige un desafío por id; null o id desconocido = modo clásico. */
  select(id) {
    this.def = this.definitions.find(d => d.id === id) || null;
    this._modifiers = this.def
      ? Object.freeze({ ...DEFAULT_MODIFIERS, ...this.def.modifiers })
      : DEFAULT_MODIFIERS;
    this.reset();
  }

  /** Reinicia el progreso del desafío elegido (lo llama init() en cada partida). */
  reset() {
    this.status = this.def ? 'running' : 'idle'; // idle | running | won | lost
    this.reason = null;                          // goal | timeup | topout
    this.elapsed = 0;                            // ms de juego activo
    this.garbageAccum = 0;
    this.stats = { lines: 0, score: 0, maxCombo: 0, garbageRows: 0 };
  }

  get isActive() { return this.def !== null; }
  get isRunning() { return this.status === 'running'; }
  get definition() { return this.def; }
  get modifiers() { return this._modifiers; }

  /** Id del siguiente desafío de la progresión, o null si no hay. */
  nextId() {
    if (!this.def) return null;
    const next = this.definitions[this.definitions.indexOf(this.def) + 1];
    return next ? next.id : null;
  }

  /**
   * Avanza el reloj del desafío. Devuelve las filas de basura que toca añadir.
   * @param {number} dtMs milisegundos desde el frame anterior
   */
  update(dtMs) {
    if (!this.isRunning) return { garbageRows: 0 };
    this.elapsed += Math.max(0, dtMs);

    let garbageRows = 0;
    const { garbageInterval, garbageRows: perBatch } = this._modifiers;
    if (garbageInterval > 0) {
      this.garbageAccum += dtMs;
      const interval = garbageInterval * 1000;
      while (this.garbageAccum >= interval) {
        this.garbageAccum -= interval;
        garbageRows += perBatch;
      }
    }

    const limit = this.def.timeLimit;
    if (limit && this.elapsed >= limit * 1000) {
      this.elapsed = limit * 1000;
      this._finish(this.def.onTimeUp === 'win' ? 'won' : 'lost', 'timeup');
      garbageRows = 0; // el desafío ya terminó: no tocar el tablero
    }

    this.stats.garbageRows += garbageRows;
    return { garbageRows };
  }

  /** Registra el resultado de una pieza fijada; gana en cuanto se cumple el objetivo. */
  recordTurn({ linesCleared, score, comboCount }) {
    if (!this.isRunning) return;
    this.stats.lines += linesCleared;
    this.stats.score = score;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, comboCount);
    if (GOAL_TYPES[this.def.goal.type].isMet(this.stats, this.def.goal)) {
      this._finish('won', 'goal');
    }
  }

  fail(reason) {
    if (this.isRunning) this._finish('lost', reason);
  }

  /** 0..1 dentro de la ventana de aviso previa a la siguiente basura; 0 fuera de ella. */
  garbageWarning() {
    const { garbageInterval, garbageWarning } = this._modifiers;
    if (!this.isRunning || garbageInterval <= 0 || garbageWarning <= 0) return 0;
    const left = garbageInterval * 1000 - this.garbageAccum;
    const window = garbageWarning * 1000;
    return left <= window ? 1 - left / window : 0;
  }

  /** Fotografía lista para pintar en la UI. */
  getHUD() {
    if (!this.def) return { active: false };
    const def = this.def;
    const goalType = GOAL_TYPES[def.goal.type];
    const remaining = def.timeLimit ? Math.max(0, def.timeLimit * 1000 - this.elapsed) : null;
    const m = this._modifiers;
    const warning = this.garbageWarning();

    return {
      active: true,
      id: def.id,
      index: this.definitions.indexOf(def) + 1,
      total: this.definitions.length,
      name: def.name,
      description: def.description,
      objective: goalType.objective(def.goal, def),
      progress: goalType.progress(this.stats, def.goal),
      time: remaining === null ? null : `Tiempo: ${fmtTime(remaining)}`,
      timeLow: remaining !== null && remaining <= 10000 && this.isRunning,
      garbage: m.garbageInterval > 0 && this.isRunning
        ? `Basura en: ${Math.ceil((m.garbageInterval * 1000 - this.garbageAccum) / 1000)} s`
        : null,
      garbageWarning: warning > 0,
      modifiers: Object.keys(MODIFIER_LABELS)
        .map(key => MODIFIER_LABELS[key](m[key]))
        .filter(Boolean),
      status: this.status,
      statusText: { running: 'En curso', won: '¡Completado!', lost: 'Fallido' }[this.status],
      resultText: RESULT_TEXT[`${this.status}:${this.reason}`] || '',
    };
  }

  _finish(status, reason) {
    this.status = status;
    this.reason = reason;
  }
}
