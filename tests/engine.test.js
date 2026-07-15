import assert from "node:assert/strict";
import {
  DIRS,
  Game,
  LevelGenerator,
  findGroups,
  makeEmptyGrid,
  makeTile,
  removeGroups,
  slideGrid,
} from "../src/engine.js";

function gridSignature(grid) {
  return grid
    .map((column) => column.map((tile) => tile ? `${tile.color}${tile.blocker ? "b" : ""}` : ".").join(""))
    .join("|");
}

{
  const a = new LevelGenerator(12345).next();
  const b = new LevelGenerator(12345).next();
  assert.equal(gridSignature(a.grid), gridSignature(b.grid));
  assert.deepEqual(a.solution, b.solution);
}

{
  const level = new LevelGenerator(42).next();
  assert.equal(findGroups(level.grid).length, 0);
  assert.ok(Object.values(DIRS).some((dir) => {
    const copy = level.grid.map((column) => column.map((tile) => tile ? { ...tile } : null));
    return slideGrid(copy, dir) && findGroups(copy).length > 0;
  }));
}

{
  const grid = makeEmptyGrid(3);
  grid[1][1] = makeTile(1, 1, 2);
  grid[2][1] = makeTile(2, 1, 0, true);
  assert.equal(slideGrid(grid, DIRS.right), false);
  assert.equal(slideGrid(grid, DIRS.left), true);
  assert.equal(grid[0][1].color, 2);
  assert.equal(grid[2][1].blocker, true);
}

{
  const grid = makeEmptyGrid(3);
  grid[0][0] = makeTile(0, 0, 1);
  grid[1][0] = makeTile(1, 0, 1);
  grid[0][1] = makeTile(0, 1, 1);
  grid[1][1] = makeTile(1, 1, 1);
  const groups = findGroups(grid);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 4);
  assert.deepEqual(removeGroups(grid, groups), { groupsRemoved: 1, tilesRemoved: 4 });
  assert.equal(grid.flat().filter(Boolean).length, 0);
}

{
  const game = new Game({ seed: 7 });
  const before = gridSignature(game.grid);
  const moved = Object.keys(DIRS).some((dir) => game.move(dir).moved);
  assert.equal(moved, true);
  assert.notEqual(gridSignature(game.grid), before);
  assert.equal(game.undo(), true);
  assert.equal(gridSignature(game.grid), before);
}

console.log("engine tests passed");
