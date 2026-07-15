export const DIRS = {
  left: { x: -1, y: 0, name: "left" },
  right: { x: 1, y: 0, name: "right" },
  up: { x: 0, y: -1, name: "up" },
  down: { x: 0, y: 1, name: "down" },
};

export const LEVEL_CONFIGS = [
  { size: 3, colors: 2, blockers: 0 },
  { size: 4, colors: 3, blockers: 0 },
  { size: 4, colors: 3, blockers: 0 },
  { size: 5, colors: 4, blockers: 1 },
  { size: 5, colors: 4, blockers: 1 },
  { size: 5, colors: 4, blockers: 2 },
  { size: 6, colors: 5, blockers: 2 },
  { size: 6, colors: 5, blockers: 3 },
  { size: 6, colors: 5, blockers: 3 },
  { size: 7, colors: 6, blockers: 4 },
];

export class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

export function makeTile(x, y, color, blocker = false) {
  return { x, y, color, blocker };
}

export function cloneGrid(grid) {
  return grid.map((column) => column.map((tile) => tile ? { ...tile } : null));
}

export function makeEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

export function inside(size, x, y) {
  return x >= 0 && x < size && y >= 0 && y < size;
}

export function slideGrid(grid, dir) {
  const size = grid.length;
  const xs = dir.x > 0 ? indexes(size).reverse() : indexes(size);
  const ys = dir.y > 0 ? indexes(size).reverse() : indexes(size);
  let moved = false;

  for (const x of xs) {
    for (const y of ys) {
      const tile = grid[x][y];
      if (!tile || tile.blocker) continue;

      const nx = x + dir.x;
      const ny = y + dir.y;
      if (!inside(size, nx, ny) || grid[nx][ny]) continue;

      grid[nx][ny] = tile;
      grid[x][y] = null;
      tile.x = nx;
      tile.y = ny;
      moved = true;
    }
  }

  return moved;
}

export function findGroups(grid) {
  const size = grid.length;
  const seen = new Set();
  const groups = [];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const tile = grid[x][y];
      const key = `${x},${y}`;
      if (!tile || tile.blocker || seen.has(key)) continue;

      const group = [];
      const queue = [tile];
      seen.add(key);

      while (queue.length) {
        const current = queue.shift();
        group.push(current);

        for (const dir of Object.values(DIRS)) {
          const nx = current.x + dir.x;
          const ny = current.y + dir.y;
          const nkey = `${nx},${ny}`;
          const neighbor = inside(size, nx, ny) ? grid[nx][ny] : null;

          if (neighbor && !neighbor.blocker && neighbor.color === tile.color && !seen.has(nkey)) {
            seen.add(nkey);
            queue.push(neighbor);
          }
        }
      }

      if (group.length >= 4) groups.push(group);
    }
  }

  return groups;
}

export function removeGroups(grid, groups = findGroups(grid)) {
  let removed = 0;

  for (const group of groups) {
    for (const tile of group) {
      if (grid[tile.x][tile.y]) {
        grid[tile.x][tile.y] = null;
        removed++;
      }
    }
  }

  return { groupsRemoved: groups.length, tilesRemoved: removed };
}

export function movableTiles(grid) {
  return grid.flat().filter((tile) => tile && !tile.blocker);
}

export class Game {
  constructor({ seed = dailySeed() } = {}) {
    this.seed = seed;
    this.totalLevels = LEVEL_CONFIGS.length;
    this.generator = new LevelGenerator(seed);
    this.levelNumber = 0;
    this.movesLeft = 3;
    this.initialMoves = 3;
    this.history = [];
    this.completed = 0;
    this.loadNextLevel();
  }

  loadNextLevel() {
    const level = this.generator.next();
    this.levelNumber++;
    this.level = level;
    this.grid = cloneGrid(level.grid);
    this.history = [];
    this.initialMoves = this.movesLeft;
    this.resolve();
    return level;
  }

  snapshot() {
    return {
      movesLeft: this.movesLeft,
      grid: cloneGrid(this.grid),
    };
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.movesLeft = previous.movesLeft;
    this.grid = cloneGrid(previous.grid);
    return true;
  }

  move(dirName) {
    const dir = typeof dirName === "string" ? DIRS[dirName] : dirName;
    if (!dir || this.movesLeft <= 0) return { moved: false, solved: false };

    const before = this.snapshot();
    const moved = slideGrid(this.grid, dir);
    if (!moved) return { moved: false, solved: this.isSolved() };

    this.history.push(before);
    this.movesLeft--;
    const clear = this.resolve();
    const solved = this.isSolved();

    if (solved) this.completed = this.levelNumber;
    return { moved, solved, ...clear };
  }

  resolve() {
    const groups = findGroups(this.grid);
    const clear = removeGroups(this.grid, groups);
    this.movesLeft += clear.groupsRemoved;
    return clear;
  }

  isSolved() {
    return movableTiles(this.grid).length === 0;
  }

  isGameOver() {
    return this.movesLeft <= 0 && !this.isSolved();
  }
}

export class LevelGenerator {
  constructor(seed) {
    this.random = new SeededRandom(seed);
    this.index = 0;
  }

  next() {
    if (this.index >= LEVEL_CONFIGS.length) throw new Error("No more levels");
    const config = LEVEL_CONFIGS[this.index];
    this.index++;

    const minRunLimit = Math.floor(config.size / 2);
    const firstRunLimit = Math.floor(minRunLimit + this.random.next() * (config.size - minRunLimit));
    const runLimits = [
      firstRunLimit,
      ...Array.from({ length: config.size - minRunLimit }, (_, offset) => minRunLimit + offset)
        .filter((candidate) => candidate !== firstRunLimit),
    ];

    for (const runLimit of runLimits) {
      for (let attempt = 0; attempt < 10000; attempt++) {
        const level = this.makeLevel({ ...config, runLimit });
        if (
          level &&
          findGroups(level.grid).length === 0 &&
          this.hasResolvingMove(level.grid) &&
          this.hasMinimumColorCounts(level.grid, config.colors)
        ) {
          return level;
        }
      }
    }

    throw new Error("Unable to generate a level");
  }

  makeLevel(config) {
    const grid = makeEmptyGrid(config.size);
    const actionDirs = [];
    const blockers = this.availablePositions(grid).slice(0, config.blockers);
    const colorOrder = this.shuffle(Array.from({ length: config.colors }, (_, index) => index + 1));

    for (const pos of blockers) {
      grid[pos.x][pos.y] = makeTile(pos.x, pos.y, 0, true);
    }

    for (const color of colorOrder) {
      if (!this.addSourceColor(grid, color, actionDirs, config.runLimit)) return null;
    }

    return {
      size: config.size,
      colors: config.colors,
      solution: actionDirs.slice().reverse().map((dir) => this.oppositeDir(dir).name),
      grid: cloneGrid(grid),
    };
  }

  addSourceColor(grid, color, actionDirs, runLimit) {
    for (const start of this.availablePositions(grid, (pos) => this.hasFiniteSourceDistance(grid, pos))) {
      const candidate = cloneGrid(grid);
      const group = this.makeConnectedGroupFrom(candidate, start);
      if (!group) continue;

      for (const pos of group) {
        candidate[pos.x][pos.y] = makeTile(pos.x, pos.y, color);
      }

      const slide = this.findSourceDispersal(candidate, actionDirs, runLimit);
      if (!slide) continue;

      this.copyGridInto(slide.grid, grid);
      actionDirs.push(slide.dir);
      return true;
    }

    return false;
  }

  findSourceDispersal(grid, actionDirs, runLimit) {
    const choices = Object.values(DIRS).map((dir) => ({
      dir,
      seed: Math.floor(this.random.next() * 2147483648),
    }));

    for (const { dir, seed } of choices) {
      if (!this.canSourceSlide(grid, dir) || !this.allowsSourceDirection(actionDirs, dir, runLimit)) continue;

      const copy = cloneGrid(grid);
      this.sourceRandomSlide(copy, dir, seed);
      if (findGroups(copy).length === 0) return { grid: copy, dir };
    }

    return null;
  }

  sourceRandomSlide(grid, dir, seed) {
    const rng = new SeededRandom(seed);
    this.slideOnce(grid, dir, (x, y) => {
      const distance = this.sourceDistance(grid, x, y, this.oppositeDir(dir));
      return rng.next() * (distance + 1) < distance || !Number.isFinite(distance);
    });
  }

  slideOnce(grid, dir, shouldMove = () => true) {
    const size = grid.length;
    const xs = dir.x < 0 ? indexes(size) : indexes(size).reverse();
    const ys = dir.y < 0 ? indexes(size) : indexes(size).reverse();
    let moved = false;

    for (const x of xs) {
      for (const y of ys) {
        const tile = grid[x][y];
        if (!tile || tile.blocker) continue;

        const nx = x + dir.x;
        const ny = y + dir.y;
        if (!inside(size, nx, ny) || grid[nx][ny] || !shouldMove(x, y)) continue;

        grid[nx][ny] = tile;
        grid[x][y] = null;
        tile.x = nx;
        tile.y = ny;
        moved = true;
      }
    }

    return moved;
  }

  canSourceSlide(grid, dir) {
    const size = grid.length;

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (
          grid[x][y] &&
          Number.isFinite(this.sourceDistance(grid, x, y, dir)) &&
          !Number.isFinite(this.sourceDistance(grid, x, y, this.oppositeDir(dir)))
        ) {
          return false;
        }
      }
    }

    return true;
  }

  allowsSourceDirection(actionDirs, dir, runLimit) {
    let run = 0;

    for (let i = actionDirs.length - 1; i >= 0; i--) {
      const previous = actionDirs[i];
      if (previous.x !== dir.x || previous.y !== dir.y) break;
      run++;
    }

    return run < runLimit;
  }

  hasFiniteSourceDistance(grid, pos) {
    return Object.values(DIRS).some((dir) => Number.isFinite(this.sourceDistance(grid, pos.x, pos.y, dir)));
  }

  sourceDistance(grid, x, y, dir) {
    const size = grid.length;
    let cx = x + dir.x;
    let cy = y + dir.y;

    while (inside(size, cx, cy)) {
      const tile = grid[cx][cy];
      if (!tile) return Infinity;
      if (tile.blocker) break;
      cx += dir.x;
      cy += dir.y;
    }

    return Math.hypot(cx - x, cy - y);
  }

  availablePositions(grid, predicate = () => true) {
    const positions = [];

    grid.forEach((column, x) => column.forEach((tile, y) => {
      const pos = { x, y };
      if (!tile && predicate(pos)) positions.push(pos);
    }));

    return this.shuffle(positions);
  }

  makeConnectedGroupFrom(grid, start) {
    const size = grid.length;
    const group = [];
    const queue = [start];

    while (queue.length) {
      const current = queue.shift();
      if (group.some((pos) => pos.x === current.x && pos.y === current.y)) continue;

      group.push(current);
      if (group.length === 4) return group;

      for (const dir of this.shuffle(Object.values(DIRS))) {
        const next = { x: current.x + dir.x, y: current.y + dir.y };
        const alreadyQueued = group.some((pos) => pos.x === next.x && pos.y === next.y);
        if (!inside(size, next.x, next.y) || grid[next.x][next.y] || alreadyQueued) continue;
        queue.push(next);
      }
    }

    return null;
  }

  hasResolvingMove(grid) {
    return Object.values(DIRS).some((dir) => {
      const copy = cloneGrid(grid);
      return slideGrid(copy, dir) && findGroups(copy).length > 0;
    });
  }

  hasMinimumColorCounts(grid, colors) {
    const counts = new Map();

    for (const tile of grid.flat()) {
      if (tile && !tile.blocker) counts.set(tile.color, (counts.get(tile.color) ?? 0) + 1);
    }

    for (let color = 1; color <= colors; color++) {
      if ((counts.get(color) ?? 0) < 4) return false;
    }

    return true;
  }

  copyGridInto(source, target) {
    source.forEach((column, x) => column.forEach((tile, y) => {
      target[x][y] = tile ? { ...tile } : null;
    }));
  }

  oppositeDir(dir) {
    if (dir.x === -1) return DIRS.right;
    if (dir.x === 1) return DIRS.left;
    if (dir.y === -1) return DIRS.down;
    return DIRS.up;
  }

  shuffle(items) {
    const result = [...items];

    for (let i = 0; i < result.length; i++) {
      const j = Math.floor(this.random.next() * result.length);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }
}

export function dailySeed(date = new Date()) {
  const utcMinusFive = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  return Date.parse(utcMinusFive.toISOString().slice(0, 10)) >>> 0;
}

function indexes(size) {
  return Array.from({ length: size }, (_, index) => index);
}
