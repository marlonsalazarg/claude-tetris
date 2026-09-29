# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas. No dependencies, no build step, no package manager, no tests or linter. README is in Spanish; in-game UI text is also Spanish ("PAUSA", "Puntuación").

## Running

Open `index.html` directly in a browser, or serve the directory (e.g. `python3 -m http.server`) and visit it.

## Architecture

Three files: `index.html` (layout + element IDs), `style.css`, and `game.js` (all logic, one script, no modules).

`game.js` is built around module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...) declared in a single `let` and reset by `init()`. Key points:

- `board` is a `ROWS x COLS` grid of integers: `0` = empty, `1–8` = piece type (8 = the 3x3 hollow "tuerca" challenge piece). The same integer indexes `COLORS` and `PIECES`, so adding/changing a piece means updating both arrays in sync (`randomPiece` uses `PIECES.length - 1`, so it follows automatically).
- Pieces are `{type, shape, x, y}`; rotation replaces `shape` with a rotated matrix (`rotateCW`) and `tryRotate` applies simple horizontal wall kicks `[0,-1,1,-2,2]`.
- Game flow: `requestAnimationFrame` `loop` accumulates `dropAccum` and gravity-drops when it exceeds `dropInterval`; locking goes `lockPiece` → `merge` → `clearLines` (updates score/level/speed) → `spawn` (calls `endGame` if the new piece collides).
- Pause/game-over cancel the animation frame; `togglePause` restarts `loop`, and `init` (Restart button) resets everything. The overlay element is reused for both PAUSA and GAME OVER.
- Rendering: `draw()` redraws board, ghost piece (via `ghostY`), and current piece each frame; `drawNext()` renders the preview on a separate canvas and is called from `spawn`.
- Input is a single `keydown` handler (arrows, `X` rotate, `Space` hard drop, `P` pause).

Scoring/levels: `LINE_SCORES` × level; soft drop +1/cell, hard drop +2/cell; level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
