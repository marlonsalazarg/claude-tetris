'use strict';

// Sintetizador procedural con Web Audio API: sin assets externos.
// El AudioContext se crea de forma perezosa en unlock(), que debe llamarse
// desde un gesto del usuario (keydown/click) por la política de autoplay.

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.2;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (_) {
      this.ctx = null; // navegador sin soporte: todo queda como no-op
    }
  }

  // Un oscilador con envolvente (ataque corto + decaimiento exponencial para evitar clics).
  // `dest` permite enrutar por un nodo intermedio (p. ej. distorsión).
  _tone({ freq, type = 'sine', duration = 0.15, gain = 0.6, when = 0, slideTo = null, dest = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp);
    amp.connect(dest || this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // Tono ascendente: +2 semitonos por cada nivel de combo, tope de 2 octavas.
  playLineClear(comboCount = 0) {
    if (!this.ctx) return;
    const steps = Math.min(Math.max(0, comboCount) * 2, 24);
    const freq = 440 * Math.pow(2, steps / 12);
    this._tone({ freq, type: 'square', duration: 0.12, gain: 0.35 });
    this._tone({ freq: freq * 1.5, type: 'square', duration: 0.14, gain: 0.3, when: 0.07 });
  }

  // Quinta rápida y brillante.
  playTetris() {
    if (!this.ctx) return;
    this._tone({ freq: 392, type: 'triangle', duration: 0.18, gain: 0.5 });
    this._tone({ freq: 587, type: 'triangle', duration: 0.3, gain: 0.5, when: 0.08 });
  }

  // Tono grave y distorsionado (diente de sierra bajando + WaveShaper).
  playTSpin() {
    if (!this.ctx) return;
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = SoundEffects._distortionCurve(60);
    shaper.oversample = '4x';
    shaper.connect(this.master);
    this._tone({ freq: 110, slideTo: 70, type: 'sawtooth', duration: 0.35, gain: 0.5, dest: shaper });
    this._tone({ freq: 55, slideTo: 40, type: 'square', duration: 0.35, gain: 0.3, dest: shaper });
  }

  // Arpegio ascendente C-E-G-C y acorde final sostenido.
  playPerfectClear() {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this._tone({ freq, type: 'triangle', duration: 0.25, gain: 0.5, when: i * 0.07 });
    });
    const chordAt = notes.length * 0.07;
    notes.forEach(freq => {
      this._tone({ freq, type: 'triangle', duration: 0.8, gain: 0.3, when: chordAt });
    });
  }

  // Curva de saturación clásica para WaveShaperNode.
  static _distortionCurve(amount) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
}
