'use strict';

// Efectos visuales basados en DOM + CSS: textos flotantes sobre el canvas y
// screen shake. No participa en el bucle de render del juego.

class VisualEffects {
  /**
   * @param {{ layer: HTMLElement, target: HTMLElement }} options
   *   layer: capa superpuesta al canvas donde aparecen los textos.
   *   target: contenedor que se sacude (el wrapper del canvas).
   */
  constructor({ layer, target }) {
    this.layer = layer;
    this.target = target;
    this._shakeTimer = null;
  }

  /**
   * @param {string} text
   * @param {string[]} [classes] modificadores CSS: 'gold-glow', 'shake', 'tspin', 'combo'
   * @param {number} [slot] posición vertical, para que varios textos del mismo turno no se solapen
   */
  showText(text, classes = [], slot = 0) {
    const el = document.createElement('div');
    el.className = ['fx-text', 'fade-up', ...classes].join(' ');
    el.textContent = text;
    el.style.setProperty('--slot', slot);
    el.style.animationDelay = `${slot * 120}ms`;
    el.addEventListener('animationend', e => {
      // .shake anima el mismo elemento: solo retirar al terminar el fade-up
      if (e.animationName === 'fx-fade-up') el.remove();
    });
    this.layer.appendChild(el);
  }

  shake(intensity = 'normal') {
    const cls = intensity === 'strong' ? 'screen-shake-strong' : 'screen-shake';
    const el = this.target;
    el.classList.remove('screen-shake', 'screen-shake-strong');
    void el.offsetWidth; // fuerza reflow para reiniciar la animación
    el.classList.add(cls);
    clearTimeout(this._shakeTimer);
    this._shakeTimer = setTimeout(() => el.classList.remove(cls), 500);
  }

  clear() {
    this.layer.replaceChildren();
    this.target.classList.remove('screen-shake', 'screen-shake-strong');
  }
}
