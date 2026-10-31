# WW2 Tactics (working title)

A turn-based, grid-based WW2 strategy game for the browser, inspired by the mechanics of the GBA-era Advance Wars games, with original art and names.

**Play the latest build:** https://kevinandhwaboon.github.io/aw-ww2/

## Status

Phase 1 (core MVP), in progress. Currently playable: hot-seat turns on a test map, unit movement with terrain costs and fuel, and combat with luck, counterattacks, indirect fire, a damage forecast and veterancy. Capture and production come next. See [`docs/11-tech-setup.md`](docs/11-tech-setup.md) §6 for the milestone plan.

## Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Move cursor | Move the mouse | Arrow keys |
| Select unit / choose destination / choose menu item | Left click | Z, Enter or Space |
| Fire at a target | FIRE in the menu, then click a red target | Z on FIRE, arrow keys, Z on the target |
| Cancel | Right click, or click outside the menu | X, Esc or Backspace |
| Show an enemy's move and threat range | Click the enemy | Z on the enemy |
| Undo last move this turn | Undo button | U or Cmd/Ctrl+Z |
| End turn | End Turn button | E |

## Development

Requires Node.js 24+.

```bash
npm install
npm run dev       # play locally
npm run check     # typecheck + lint + tests
npm run test:ui   # browser test viewer
```

Design docs live in [`docs/`](docs/); start with [`00-master-design.md`](docs/00-master-design.md). Build instructions for Claude Code are in [`CLAUDE.md`](CLAUDE.md).
