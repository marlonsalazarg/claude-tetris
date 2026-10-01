// Menú de pausa: overlay propio (#pause-menu) con Reanudar, Reiniciar, Ver controles y Nivel inicial.
// Sin dependencias de game.js: este recibe callbacks desde init().
const PauseMenu = (() => {
  const STORAGE_KEY = 'tetris.startLevel';
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;

  const menu = document.getElementById('pause-menu');
  const resumeBtn = document.getElementById('pm-resume');
  const restartBtn = document.getElementById('pm-restart');
  const controlsBtn = document.getElementById('pm-controls-btn');
  const controlsList = document.getElementById('pm-controls');
  const levelSelect = document.getElementById('pm-level');

  let startLevel = MIN_LEVEL;
  let onResume = () => {};
  let onRestart = () => {};

  // Teclas físicamente presionadas y las que ya lo estaban al reanudar (se ignoran hasta soltarlas)
  const held = new Set();
  let suppressed = new Set();

  function clampLevel(n) {
    n = parseInt(n, 10);
    return Number.isFinite(n) ? Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n)) : MIN_LEVEL;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) startLevel = clampLevel(raw);
    } catch (_) { /* localStorage no disponible: se usa el valor por defecto */ }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, String(startLevel));
    } catch (_) { /* sin persistencia */ }
  }

  function isOpen() {
    return !menu.classList.contains('hidden');
  }

  function setControlsOpen(open) {
    controlsList.hidden = !open;
    controlsBtn.setAttribute('aria-expanded', String(open));
    controlsBtn.textContent = open ? 'Ocultar controles' : 'Ver controles';
  }

  function show() {
    levelSelect.value = String(startLevel);
    setControlsOpen(false);
    menu.classList.remove('hidden');
    resumeBtn.focus();
  }

  function hide() {
    menu.classList.add('hidden');
    if (document.activeElement && menu.contains(document.activeElement)) document.activeElement.blur();
  }

  // Al reanudar: las teclas mantenidas desde antes no deben mover la pieza
  function markResumed() {
    suppressed = new Set(held);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  // true si el keydown debe ignorarse (tecla mantenida desde antes de reanudar)
  function shouldIgnoreKey(e) {
    return suppressed.has(e.code);
  }

  function init(callbacks) {
    onResume = callbacks.onResume;
    onRestart = callbacks.onRestart;
    load();

    for (let n = MIN_LEVEL; n <= MAX_LEVEL; n++) levelSelect.add(new Option(String(n), String(n)));
    levelSelect.value = String(startLevel);

    resumeBtn.addEventListener('click', () => { resumeBtn.blur(); onResume(); });
    restartBtn.addEventListener('click', () => { restartBtn.blur(); onRestart(); });
    controlsBtn.addEventListener('click', () => {
      setControlsOpen(controlsList.hidden);
      controlsBtn.blur();
    });
    levelSelect.addEventListener('change', () => {
      startLevel = clampLevel(levelSelect.value);
      save();
      levelSelect.blur(); // solo afecta a la próxima partida
    });

    // Fase de captura: corre antes que el handler de game.js
    document.addEventListener('keydown', e => {
      if (!e.repeat) suppressed.delete(e.code); // una pulsación nueva vuelve a ser válida
      held.add(e.code);
    }, true);
    document.addEventListener('keyup', e => {
      held.delete(e.code);
      suppressed.delete(e.code);
    }, true);
    window.addEventListener('blur', () => { held.clear(); suppressed.clear(); });
  }

  return {
    init, show, hide, isOpen, markResumed, shouldIgnoreKey,
    get startLevel() { return startLevel; },
  };
})();
