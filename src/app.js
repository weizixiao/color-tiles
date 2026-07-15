import { Game } from "./engine.js";

const COLORS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");
const levelLabel = document.querySelector("#level-label");
const movesLeft = document.querySelector("#moves-left");
const statusLabel = document.querySelector("#status-label");
const undoButton = document.querySelector("#undo");
const resetButton = document.querySelector("#reset");
const newRunButton = document.querySelector("#new-run");

let game = new Game();
let initialLevel = game.snapshot();
let animation = null;
let nextTileId = 1;
const tileIds = new WeakMap();

function tileId(tile) {
  if (!tileIds.has(tile)) tileIds.set(tile, nextTileId++);
  return tileIds.get(tile);
}

function captureTiles() {
  const tiles = [];

  for (const column of game.grid) {
    for (const tile of column) {
      if (!tile) continue;
      tiles.push({
        id: tileId(tile),
        tile,
        color: tile.color,
        blocker: tile.blocker,
        fromX: tile.x,
        fromY: tile.y,
      });
    }
  }

  return tiles;
}

function startMoveAnimation(beforeTiles) {
  const visibleIds = new Set();
  for (const column of game.grid) {
    for (const tile of column) {
      if (tile) visibleIds.add(tileId(tile));
    }
  }

  animation = {
    tiles: beforeTiles.map((item) => ({
      ...item,
      toX: item.tile.x,
      toY: item.tile.y,
      removed: !visibleIds.has(item.id),
    })),
    start: performance.now(),
    duration: 180,
  };
  requestAnimationFrame(render);
}

function render(now = performance.now()) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const size = game.grid.length;
  const boardSize = Math.min(rect.width, rect.height);
  const gap = Math.max(4, boardSize * 0.012);
  const tileSize = (boardSize - gap * (size + 1)) / size;
  const left = (rect.width - boardSize) / 2;
  const top = (rect.height - boardSize) / 2;

  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#f3f4f6";
  roundRect(ctx, left, top, boardSize, boardSize, 18);
  ctx.fill();

  const progress = animation ? Math.min(1, (now - animation.start) / animation.duration) : 1;
  const ease = 1 - Math.pow(1 - progress, 3);

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const px = left + gap + x * (tileSize + gap);
      const py = top + gap + y * (tileSize + gap);

      ctx.fillStyle = "#ffffff";
      roundRect(ctx, px, py, tileSize, tileSize, 10);
      ctx.fill();

      if (!animation) {
        const tile = game.grid[x][y];
        if (!tile) continue;
        drawTile(tile.color, tile.blocker, tile.x, tile.y, 1, left, top, gap, tileSize);
      }
    }
  }

  if (animation) {
    for (const tile of animation.tiles) {
      const drawX = tile.fromX + (tile.toX - tile.fromX) * ease;
      const drawY = tile.fromY + (tile.toY - tile.fromY) * ease;
      const alpha = tile.removed ? 1 - Math.max(0, progress - 0.55) / 0.45 : 1;
      drawTile(tile.color, tile.blocker, drawX, drawY, alpha, left, top, gap, tileSize);
    }
  }

  if (animation && progress < 1) {
    requestAnimationFrame(render);
  } else {
    animation = null;
  }

  levelLabel.textContent = `Level ${game.levelNumber}/${game.totalLevels}`;
  movesLeft.textContent = String(Math.max(0, game.movesLeft));
  undoButton.disabled = game.history.length === 0;

  if (game.isSolved()) {
    statusLabel.textContent = game.levelNumber >= game.totalLevels ? "Run complete" : "Solved";
  } else if (game.isGameOver()) {
    statusLabel.textContent = "Game over";
  } else {
    statusLabel.textContent = "Playing";
  }
}

function move(dir) {
  if (animation) return;
  const beforeTiles = captureTiles();
  const result = game.move(dir);
  if (result.moved) startMoveAnimation(beforeTiles);
  if (result.solved && game.levelNumber < game.totalLevels) {
    window.setTimeout(() => {
      game.loadNextLevel();
      initialLevel = game.snapshot();
      render();
    }, 250);
  }
  if (!result.moved) render();
}

function resetLevel() {
  animation = null;
  game.movesLeft = initialLevel.movesLeft;
  game.grid = initialLevel.grid.map((column) => column.map((tile) => tile ? { ...tile } : null));
  game.history = [];
  render();
}

function newRun() {
  animation = null;
  game = new Game({ seed: Date.now() >>> 0 });
  initialLevel = game.snapshot();
  render();
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawTile(color, blocker, x, y, alpha, left, top, gap, tileSize) {
  const tx = left + gap + x * (tileSize + gap);
  const ty = top + gap + y * (tileSize + gap);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = blocker ? "#111827" : COLORS[(color - 1) % COLORS.length];
  roundRect(ctx, tx + 2, ty + 2, tileSize - 4, tileSize - 4, 8);
  ctx.fill();
  ctx.restore();
}

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => move(button.dataset.dir));
});

undoButton.addEventListener("click", () => {
  animation = null;
  game.undo();
  render();
});

resetButton.addEventListener("click", resetLevel);
newRunButton.addEventListener("click", newRun);

window.addEventListener("keydown", (event) => {
  const keys = {
    ArrowLeft: "left",
    a: "left",
    ArrowRight: "right",
    d: "right",
    ArrowUp: "up",
    w: "up",
    ArrowDown: "down",
    s: "down",
  };
  const dir = keys[event.key];
  if (!dir) return;
  event.preventDefault();
  move(dir);
});

let pointerStart = null;
canvas.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
});

window.addEventListener("resize", render);
render();
