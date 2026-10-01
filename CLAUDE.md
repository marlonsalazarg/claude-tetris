# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas. No dependencies, no build step, no package manager, no tests or linter. README is in Spanish; in-game UI text is also Spanish ("PAUSA", "Puntuación").

## Running

Open `index.html` directly in a browser, or serve the directory (e.g. `python3 -m http.server`) and visit it.

## Architecture

`index.html` (layout + element IDs), `style.css`, and classic scripts loaded in this order (no modules, so `file://` keeps working): `scoreManager.js`, `challenges.js`, `challengeManager.js`, `soundEffects.js`, `visualEffects.js`, then `game.js` (main game logic).

`game.js` is built around module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...) declared in a single `let` and reset by `init()`. Key points:

- `board` is a `ROWS x COLS` grid of integers: `0` = empty, `1–12` = piece type (8 = the 3x3 hollow "tuerca" challenge piece; 9 `+`, 10 `U`, 11 `Y` = pentominoes; 12 = 1x1 single; 13 = garbage block, board-only, `PIECES[13]` is `null`). The same integer indexes `COLORS` and `PIECES`, so adding/changing a piece means updating both arrays in sync, plus `PIECE_WEIGHTS` (spawn weights used by `pickType`; rarer for harder pieces). The 1x1 is not in `PIECE_WEIGHTS`: `clearLines` sets `rewardPending` on a Tetris (4 lines) and `spawn` makes the next piece the 1x1 (`SINGLE_TYPE`). Special pieces give no extra score.
- Pieces are `{type, shape, x, y}`; rotation replaces `shape` with a rotated matrix (`rotateCW`) and `tryRotate` applies simple horizontal wall kicks `[0,-1,1,-2,2]`.
- Game flow: `requestAnimationFrame` `loop` accumulates `dropAccum` and gravity-drops when it exceeds `dropInterval`; locking goes `lockPiece` → `merge` → `clearLines` (updates score/level/speed) → `spawn` (calls `endGame` if the new piece collides).
- Pause/game-over cancel the animation frame; `togglePause` restarts `loop`, and `init` (Restart button) resets everything. The overlay element is reused for both PAUSA and GAME OVER.
- Rendering: `draw()` redraws board, ghost piece (via `ghostY`), and current piece each frame; `drawNext()` renders the preview on a separate canvas and is called from `spawn`.
- Scoring lives in `ScoreManager` (`scoreManager.js`, pure, no DOM; owns only `comboCount` and `isB2BActive`). `lockPiece` calls `ScoreManager.detectTSpin` *before* `merge` (needs the board without the T and the `lastActionWasRotation` flag, set by `tryRotate` and cleared by moves/drops/`spawn`), then `clearLines` (returns the cleared count, no longer scores), then `scoreManager.processTurn`, and adds `result.points` to `score`. `processTurn` calls the `onTurn` callback (`playTurnFeedback` in `game.js`), which drives `SoundEffects` (Web Audio, unlocked on first `keydown`) and `VisualEffects` (floating text in `#fx-layer`, shake on `#board-wrap`; CSS in the `Efectos` section of `style.css`). `init` resets the manager and clears effects.
- Challenge mode: `challenges.js` is data only (`CHALLENGES` = ordered progression, `BOARD_PATTERNS`); `ChallengeManager` (`challengeManager.js`, pure, no DOM, no timers) holds status/time/stats. `game.js` feeds it `dt` from `loop` (`updateChallenge`) and each lock's cleared-line count (`recordTurn` in `lockPiece`; a win ends the game immediately without `spawn`). Gameplay reads `challenge.modifiers` (`rotationDirection`, `startLevel`, `invisibleLocked`, `boardPattern`, `garbageInterval`...); with no challenge selected it is `DEFAULT_MODIFIERS`, so classic mode is unaffected. Add a challenge = new entry in `CHALLENGES`; add a modifier = new key in `DEFAULT_MODIFIERS` + the engine code that reads it. `startMode(id)` selects a challenge (null = classic) and calls `init()`.
- Input is a single `keydown` handler (arrows, `X` rotate CW, `Z` rotate CCW, `Space` hard drop, `P` pause). `tryRotate(dir)` multiplies `dir` by `modifiers.rotationDirection`.

Scoring/levels: `CLEAR_SCORES` (in `scoreManager.js`) × level, plus T-Spin/combo/B2B ×1.5/Perfect Clear bonuses; soft drop +1/cell, hard drop +2/cell; level = `floor(lines/10)+startLevel` (1 in classic); `dropInterval = max(100, 1000 - (level-1)*90)`.
