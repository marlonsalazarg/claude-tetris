'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7ba7f0', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - nut (tuerca) steel gray
  '#f06292', // + - pink
  '#4db6ac', // U - teal
  '#a1887f', // Y - brown
  '#fff176', // 1x1 - single, light yellow
  '#607d8b', // basura - slate gray
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
  [[0,9,0],[9,9,9],[0,9,0]],                  // + (pentominó)
  [[10,0,10],[10,10,10]],                     // U (pentominó)
  [[0,11],[11,11],[0,11],[0,11]],             // Y (pentominó)
  [[12]],                                      // 1x1 (recompensa tras Tetris)
  null,                                        // basura (solo en el board, nunca es pieza)
];

const SINGLE_TYPE = 12;
const GARBAGE_TYPE = 13;

// Pesos de aparición (%): las clásicas son frecuentes; las difíciles, más raras.
// La 1x1 no está en el sorteo: solo sale como recompensa tras un Tetris.
const PIECE_WEIGHTS = { 1: 13, 2: 13, 3: 13, 4: 13, 5: 13, 6: 13, 7: 13, 8: 2, 9: 4, 10: 4, 11: 3 };

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const nextBtn = document.getElementById('next-btn');
const exitBtn = document.getElementById('exit-btn');
const modeSelect = document.getElementById('mode-select');
const challengePanel = document.getElementById('challenge-panel');
const chEls = Object.fromEntries(
  ['index', 'name', 'desc', 'goal', 'progress', 'time', 'garbage', 'mods', 'status']
    .map(k => [k, document.getElementById(`ch-${k}`)])
);
const themeToggle = document.getElementById('theme-toggle');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, rewardPending, lastActionWasRotation;

// Puntaje avanzado y efectos: viven en sus propios scripts (scoreManager.js, soundEffects.js, visualEffects.js)
const scoreManager = new ScoreManager({ onTurn: playTurnFeedback });
const sfx = new SoundEffects();
const vfx = new VisualEffects({
  layer: document.getElementById('fx-layer'),
  target: document.getElementById('board-wrap'),
});
// Modo Desafío (challenges.js + challengeManager.js): sin desafío elegido es el modo clásico
const challenge = new ChallengeManager(CHALLENGES);

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = light ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-pressed', String(light));
  themeToggle.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  // En pausa/game over el loop está cancelado: repintar manualmente
  if (board && next) {
    draw();
    drawNext();
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function pickType() {
  const entries = Object.entries(PIECE_WEIGHTS);
  let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [type, w] of entries) {
    roll -= w;
    if (roll < 0) return Number(type);
  }
  return 1;
}

function randomPiece(type = pickType()) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// dir: 1 = horario, -1 = antihorario (tres giros horarios)
function rotateShape(shape, dir) {
  const cw = rotateCW(shape);
  return dir < 0 ? rotateCW(rotateCW(cw)) : cw;
}

// dir es la intención del jugador; el desafío puede invertirla con rotationDirection
function tryRotate(dir = 1) {
  const rotated = rotateShape(current.shape, dir * challenge.modifiers.rotationDirection);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastActionWasRotation = true; // requisito del T-Spin
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function dropIntervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    level = Math.floor(lines / 10) + challenge.modifiers.startLevel;
    if (cleared === 4) rewardPending = true;
    dropInterval = dropIntervalFor(level);
    updateHUD();
  }
  return cleared; // el puntaje lo calcula ScoreManager en lockPiece
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy > current.y) lastActionWasRotation = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastActionWasRotation = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  // T-Spin se evalúa antes de merge(): las esquinas se miran contra el tablero sin la T
  const tSpin = ScoreManager.detectTSpin({
    board, piece: current, lastActionWasRotation, rows: ROWS, cols: COLS,
  });
  const levelAtLock = level; // clearLines puede subir el nivel; el puntaje usa el previo
  merge();
  const cleared = clearLines();
  const result = scoreManager.processTurn({ linesCleared: cleared, level: levelAtLock, tSpin, board });
  score += result.points;
  updateHUD();
  if (challenge.isActive) {
    challenge.recordTurn({ linesCleared: cleared, score, comboCount: result.comboCount });
    if (!challenge.isRunning) {
      // Victoria inmediata: sin spawn, para que un top-out posterior no la pise
      current = null;
      endGame();
      return;
    }
  }
  spawn();
}

// Callback de ScoreManager: traduce el resultado del turno a sonido y efectos visuales
function playTurnFeedback(result) {
  const { linesCleared, tSpin, isPerfectClear, comboCount, labels } = result;
  const isTSpin = tSpin !== 'none';

  if (isPerfectClear) sfx.playPerfectClear();
  else if (isTSpin) sfx.playTSpin();
  else if (linesCleared === 4) sfx.playTetris();
  else if (linesCleared > 0) sfx.playLineClear(comboCount);

  // Combo por encima del sonido principal, para que se oiga la subida de tono
  if (linesCleared > 0 && comboCount >= 1 && (isPerfectClear || isTSpin || linesCleared === 4)) {
    sfx.playLineClear(comboCount);
  }

  labels.forEach((text, i) => {
    const classes = [];
    if (text.startsWith('COMBO')) classes.push('combo');
    else if (text.includes('PERFECT')) classes.push('gold-glow', 'shake');
    else if (text.includes('T-SPIN')) classes.push('tspin');
    else classes.push('gold-glow');
    vfx.showText(text, classes, i);
  });

  if (isPerfectClear) vfx.shake('strong');
  else if (linesCleared === 4 || (isTSpin && linesCleared > 0)) vfx.shake();
}

function spawn() {
  current = next;
  next = randomPiece(rewardPending ? SINGLE_TYPE : undefined);
  rewardPending = false;
  lastActionWasRotation = false; // cada pieza nueva empieza sin rotación previa
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = cssVar('--block-highlight');
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = cssVar('--grid');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board: con invisibleLocked solo se omite el dibujo; el board lógico no se toca
  if (!challenge.modifiers.invisibleLocked || gameOver) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK);
  }

  drawGarbageWarning();

  if (!current) return; // victoria inmediata: la pieza ya se fusionó

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

// Franja pulsante en la fila inferior justo antes de que suba la basura
function drawGarbageWarning() {
  const warn = challenge.garbageWarning();
  if (!warn) return;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 80);
  ctx.globalAlpha = (0.2 + 0.5 * warn) * pulse;
  ctx.fillStyle = cssVar('--danger');
  ctx.fillRect(0, (ROWS - 1) * BLOCK, COLS * BLOCK, BLOCK);
  ctx.globalAlpha = 1;
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function showOverlay(title, detail, { success = false, next = false } = {}) {
  overlayTitle.textContent = title;
  overlayScore.textContent = detail;
  overlay.classList.toggle('success', success);
  restartBtn.textContent = challenge.isActive ? 'Reintentar' : 'Reiniciar';
  nextBtn.hidden = !next;
  exitBtn.hidden = !challenge.isActive;
  overlay.classList.remove('hidden');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  const scoreText = `Puntuación: ${score.toLocaleString()}`;
  if (!challenge.isActive) {
    showOverlay('GAME OVER', scoreText);
    return;
  }
  challenge.fail('topout'); // no-op si el desafío ya terminó por objetivo o tiempo
  updateChallengePanel();
  const won = challenge.status === 'won';
  showOverlay(
    won ? '¡COMPLETADO!' : 'DESAFÍO FALLIDO',
    `${challenge.getHUD().resultText}\n${scoreText}`,
    { success: won, next: won && challenge.nextId() !== null }
  );
}

// Basura: desplaza el contenido hacia arriba y añade filas nuevas por abajo.
// Cada fila es un array nuevo, nunca comparte referencias con piezas ni con otras filas.
function createGarbageRow(holes) {
  const row = new Array(COLS).fill(GARBAGE_TYPE);
  const free = Array.from({ length: COLS }, (_, i) => i);
  for (let i = 0; i < Math.min(Math.max(holes, 1), COLS - 1); i++) {
    row[free.splice(Math.floor(Math.random() * free.length), 1)[0]] = 0;
  }
  return row;
}

function addGarbageRows(count) {
  const { garbageHoles } = challenge.modifiers;
  for (let i = 0; i < count; i++) {
    if (board[0].some(v => v !== 0)) { endGame(); return; } // la fila superior saldría del tablero
    board.shift();
    board.push(createGarbageRow(garbageHoles));
  }
  // Si la pieza activa quedó incrustada en la basura, se sube hasta que quepa
  while (collide(current.shape, current.x, current.y)) current.y--;
  const topRow = current.shape.findIndex(row => row.some(Boolean));
  if (current.y + topRow < 0) endGame(); // quedaría fuera del tablero: merge() fallaría
}

// Copia un patrón de BOARD_PATTERNS (alineado al fondo) sobre el board vacío
function applyBoardPattern(pattern) {
  const offset = ROWS - pattern.length;
  pattern.forEach((line, i) => {
    for (let c = 0; c < COLS; c++) {
      const ch = line[c];
      board[offset + i][c] = ch === '#' ? GARBAGE_TYPE : (ch >= '1' && ch <= '9' ? Number(ch) : 0);
    }
  });
}

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

// Se llama cada frame en desafío: setText evita tocar el DOM si el texto no cambió
function updateChallengePanel() {
  const hud = challenge.getHUD();
  challengePanel.hidden = !hud.active;
  if (!hud.active) return;
  setText(chEls.index, `DESAFÍO ${hud.index} / ${hud.total}`);
  setText(chEls.name, hud.name);
  setText(chEls.desc, hud.description);
  setText(chEls.goal, hud.objective);
  setText(chEls.progress, hud.progress);
  setText(chEls.time, hud.time ?? '');
  setText(chEls.garbage, hud.garbage ?? '');
  setText(chEls.mods, hud.modifiers.join(' · ') || 'Ninguno');
  setText(chEls.status, hud.statusText);
  chEls.status.dataset.status = hud.status;
  chEls.time.classList.toggle('danger', hud.timeLow);
  chEls.garbage.classList.toggle('warning', hud.garbageWarning);
}

function updateChallenge(dt) {
  const { garbageRows } = challenge.update(dt);
  if (garbageRows) addGarbageRows(garbageRows);
  if (!gameOver && !challenge.isRunning) endGame(); // tiempo agotado
  updateChallengePanel();
}

function startMode(id) {
  challenge.select(id);
  init();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showOverlay('PAUSA', '');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastActionWasRotation = false;
    } else {
      lockPiece();
    }
  }
  if (!gameOver && challenge.isActive) updateChallenge(dt);
  draw();
  if (gameOver) return; // endGame() cancela un frame que ya se está ejecutando: no reprogramar
  animId = requestAnimationFrame(loop);
}

function init() {
  challenge.reset();
  const mods = challenge.modifiers;
  board = createBoard();
  if (mods.boardPattern) applyBoardPattern(mods.boardPattern);
  score = 0;
  lines = 0;
  level = mods.startLevel;
  paused = false;
  gameOver = false;
  rewardPending = false;
  lastActionWasRotation = false;
  scoreManager.reset();
  vfx.clear();
  dropInterval = dropIntervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  modeSelect.value = challenge.isActive ? challenge.definition.id : '';
  updateChallengePanel();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  sfx.unlock(); // el AudioContext solo puede iniciarse tras un gesto del usuario
  if (e.target === modeSelect) {
    // Enter/Space abren el desplegable; cualquier otra tecla devuelve el control al juego
    if (e.code === 'Enter' || e.code === 'Space') return;
    modeSelect.blur();
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) {
        current.x--;
        lastActionWasRotation = false;
      }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) {
        current.x++;
        lastActionWasRotation = false;
      }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate(1);
      break;
    case 'KeyZ':
      tryRotate(-1);
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
nextBtn.addEventListener('click', () => startMode(challenge.nextId()));
exitBtn.addEventListener('click', () => startMode(null));

for (const def of CHALLENGES) {
  modeSelect.add(new Option(`${CHALLENGES.indexOf(def) + 1}. ${def.name}`, def.id));
}
modeSelect.add(new Option('Clásico', ''), 0);
modeSelect.addEventListener('change', () => {
  startMode(modeSelect.value || null);
  modeSelect.blur(); // evita que las flechas sigan cambiando el modo durante el juego
});

// rAF se detiene con la pestaña oculta: pausar para que el reloj del desafío no salte al volver
document.addEventListener('visibilitychange', () => {
  if (document.hidden && challenge.isActive && !paused && !gameOver) togglePause();
});

themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Space/Enter reactiven el botón durante el juego
});

setTheme('dark');

init();
