'use strict';

// Skins visuales. Cada una define su paleta (mismos índices que PIECES: 0 = null, 13 = basura),
// colores opcionales de fondo/cuadrícula (null = usar las variables CSS del tema claro/oscuro)
// y su función drawBlock(ctx, x, y, colorIndex, size, alpha). `cssVar` viene de game.js.

// Rect con esquinas redondeadas (roundRect con respaldo manual para navegadores antiguos)
function skinRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Aclara (amt > 0) u oscurece (amt < 0) un color #rrggbb mezclándolo con blanco/negro
function skinShade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const ch = s => Math.round(((n >> s) & 255) * (1 - p) + t * p);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const SKINS = {
  retro: {
    name: 'Retro',
    background: null,
    grid: null,
    colors: [
      null,
      '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7ba7f0', '#ffb74d',
      '#b0bec5', '#f06292', '#4db6ac', '#a1887f', '#fff176', '#607d8b',
    ],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = this.colors[colorIndex];
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.fillStyle = cssVar('--block-highlight');
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      ctx.globalAlpha = 1;
    },
  },

  neon: {
    name: 'Neon',
    background: '#000000',
    grid: '#16162a',
    colors: [
      null,
      '#00f0ff', '#ffee00', '#d500f9', '#39ff14', '#ff1744', '#448aff', '#ff9100',
      '#cfd8dc', '#ff4081', '#1de9b6', '#ffab40', '#ffff66', '#78909c',
    ],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      ctx.globalAlpha = alpha ?? 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.globalAlpha *= 0.25;
      ctx.fillRect(px, py, s, s);
      ctx.globalAlpha = alpha ?? 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 1;
    },
  },

  pastel: {
    name: 'Pastel',
    background: null,
    grid: null,
    colors: [
      null,
      '#a8e6ef', '#fff1b0', '#d9b8e6', '#b9e4bd', '#f4b6b6', '#b3cdf5', '#ffd6a5',
      '#d5dee3', '#f7bcd0', '#a9dcd5', '#cfbcb4', '#fff8b8', '#a9b8c2',
    ],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      const px = x * size + 1.5, py = y * size + 1.5, s = size - 3;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = this.colors[colorIndex];
      skinRoundRect(ctx, px, py, s, s, 8);
      ctx.fill();
      // brillo suave arriba
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      skinRoundRect(ctx, px + 4, py + 3, s - 8, 5, 2.5);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  },

  pixel: {
    name: 'Pixel art',
    background: null,
    grid: null,
    colors: [
      null,
      '#26c6da', '#fbc02d', '#ab47bc', '#66bb6a', '#ef5350', '#5c8df0', '#ffa726',
      '#90a4ae', '#ec407a', '#26a69a', '#8d6e63', '#ffee58', '#546e7a',
    ],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      const u = Math.max(2, Math.round(size / 10)); // "pixel" del bisel/textura
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, s, s);
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      ctx.fillStyle = skinShade(color, 0.45);
      ctx.fillRect(px, py, s, u);
      ctx.fillRect(px, py, u, s);
      ctx.fillStyle = skinShade(color, -0.4);
      ctx.fillRect(px, py + s - u, s, u);
      ctx.fillRect(px + s - u, py, u, s);
      // textura: tablero de ajedrez de cuadritos en el interior
      ctx.fillStyle = skinShade(color, -0.18);
      for (let j = 1; j < s / u - 1; j++)
        for (let i = 1; i < s / u - 1; i++)
          if ((i + j) % 2 === 0) ctx.fillRect(px + i * u, py + j * u, u, u);
      ctx.globalAlpha = 1;
    },
  },
};

const SKIN_STORAGE_KEY = 'tetris.skin';
const DEFAULT_SKIN = 'retro';
