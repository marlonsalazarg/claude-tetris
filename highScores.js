// Tabla de records local (Top 5 + mejor combo + líneas máximas) en localStorage.
// Clase pura, sin DOM. Todo acceso al almacenamiento va en try/catch: si no hay
// localStorage (modo privado, bloqueado), funciona en memoria durante la sesión.
class HighScores {
  static KEY = 'tetris.records';
  static MAX_ENTRIES = 5;
  static MAX_NAME = 12;

  constructor() {
    this.data = this._load();
  }

  static sanitizeName(name) {
    return String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, HighScores.MAX_NAME);
  }

  static _num(v) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  static _entry(e) {
    if (!e || typeof e !== 'object') return null;
    const score = HighScores._num(e.score);
    if (score <= 0) return null;
    return {
      name: HighScores.sanitizeName(e.name) || 'Anónimo',
      score,
      lines: HighScores._num(e.lines),
      level: Math.max(1, HighScores._num(e.level)),
      date: typeof e.date === 'string' ? e.date.slice(0, 40) : '',
    };
  }

  _load() {
    const empty = { entries: [], bestCombo: 0, maxLines: 0, lastName: '' };
    try {
      const raw = localStorage.getItem(HighScores.KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return empty;
      const entries = (Array.isArray(parsed.entries) ? parsed.entries : [])
        .map(HighScores._entry)
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, HighScores.MAX_ENTRIES);
      return {
        entries,
        bestCombo: HighScores._num(parsed.bestCombo),
        maxLines: HighScores._num(parsed.maxLines),
        lastName: HighScores.sanitizeName(parsed.lastName),
      };
    } catch (_) {
      return empty;
    }
  }

  _save() {
    try {
      localStorage.setItem(HighScores.KEY, JSON.stringify(this.data));
    } catch (_) { /* sin almacenamiento: se conserva solo en memoria */ }
  }

  getAll() { return this.data.entries.map(e => ({ ...e })); }
  get bestCombo() { return this.data.bestCombo; }
  get maxLines() { return this.data.maxLines; }
  get lastName() { return this.data.lastName; }

  // ¿Entraría esta puntuación en el top? (score > 0 y hay hueco o supera al último)
  qualifies(score) {
    const s = HighScores._num(score);
    if (s <= 0) return false;
    const { entries } = this.data;
    return entries.length < HighScores.MAX_ENTRIES || s > entries[entries.length - 1].score;
  }

  // Actualiza estadísticas globales (se llama en cada game over clásico)
  updateStats({ combo = 0, lines = 0 } = {}) {
    const c = HighScores._num(combo), l = HighScores._num(lines);
    if (c > this.data.bestCombo) this.data.bestCombo = c;
    if (l > this.data.maxLines) this.data.maxLines = l;
    this._save();
  }

  // Inserta la entrada; devuelve su posición (0-based) o -1 si no entra.
  // A igual puntuación, la nueva queda por debajo de las existentes.
  add(entry) {
    const e = HighScores._entry({ date: new Date().toISOString(), ...entry });
    if (!e || !this.qualifies(e.score)) return -1;
    const { entries } = this.data;
    let idx = entries.findIndex(x => e.score > x.score);
    if (idx === -1) idx = entries.length;
    entries.splice(idx, 0, e);
    entries.length = Math.min(entries.length, HighScores.MAX_ENTRIES);
    this.data.lastName = HighScores.sanitizeName(entry.name); // vacío si no escribió nombre (no recordar «Anónimo»)
    this._save();
    return idx;
  }

  reset() {
    this.data = { entries: [], bestCombo: 0, maxLines: 0, lastName: this.data.lastName };
    this._save();
  }
}
