# Minimal Color Tiles

Minimal Color Tiles is a small browser puzzle game inspired by Google Color Tiles. The player moves colored tiles on a square board, clears connected groups of matching colors, manages a limited move count, and progresses through a fixed set of levels.

![Algorithm overview](docs/algorithm-overview.png)

## Features

- Static browser implementation with no build step required.
- Canvas-rendered board, pieces, blockers, and movement animation.
- Keyboard, WASD, swipe, and on-screen direction controls.
- Deterministic daily puzzle seed for reproducible level generation.
- Ten configured levels with increasing board size, color count, and blockers.
- Undo support for valid moves.
- Local tests for the core game engine.

## Quick Start

```bash
npm start
```

Open:

```text
http://127.0.0.1:4173
```

Run tests:

```bash
npm test
```

## Game Rules

The board is an `N x N` grid containing colored tiles, blockers, and empty cells. A valid move shifts movable tiles by one cell in the chosen direction when the target cell is empty. Blockers never move.

Four or more same-color tiles connected orthogonally are cleared from the board. Each cleared group restores one move. A level is complete when only blockers remain or the board is empty. The game ends when colored tiles remain and no moves are left.

## Levels

This version includes 10 levels. Later levels increase the board size, number of colors, and number of blockers. After level 10, the run is complete.

## Project Layout

```text
github/
|-- index.html          Static page
|-- server.js           Local static server
|-- docs/               README images
|-- src/
|   |-- engine.js       Game rules, RNG, level generation, matching, undo
|   |-- app.js          Canvas rendering, input, and movement animation
|   `-- styles.css      Responsive styling
`-- tests/
    `-- engine.test.js  Core algorithm tests
```

## Useful Changes

- Edit `LEVEL_CONFIGS` in `src/engine.js` to tune difficulty.
- Adjust the daily seed logic to support fixed seeds or shareable puzzle ids.
- Change the group size rule to clear a different number of connected tiles.
- Modify the movement logic to experiment with different puzzle behavior.
