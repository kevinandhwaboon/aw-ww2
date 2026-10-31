# WW2 Tactics (working title)

A turn-based, grid-based WW2 strategy game for the browser, inspired by the mechanics of the GBA-era Advance Wars games, with original art and names.

**Play the latest build:** https://kevinandhwaboon.github.io/aw-ww2/

## Status

Phase 1 (core MVP), in progress. Currently playable: hot-seat turns on a test map, unit movement with terrain costs and fuel, combat with luck, counterattacks, indirect fire, a damage forecast and veterancy, an economy with capture, income, building and repair, and Halftrack transport, supply and joining units. Win conditions come next. See [`docs/11-tech-setup.md`](docs/11-tech-setup.md) §6 for the milestone plan.

## Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Move cursor | Move the mouse | Arrow keys |
| Select unit / choose destination / choose menu item | Left click | Z, Enter or Space |
| Fire at a target | FIRE in the menu, then click a red target | Z on FIRE, arrow keys, Z on the target |
| Capture a property | CAPTURE in the menu | Z on CAPTURE |
| Build a unit | Click your empty factory, then a unit | Z on the factory, arrow keys, Enter |
| Load or join | Move onto your Halftrack or a damaged unit of the same type, then LOAD or JOIN | The same with arrow keys and Z |
| Unload | UNLOAD in the menu, then click a blue tile | Z on UNLOAD, arrow keys, Z on the tile |
| Cancel | Right click, or click outside the menu | X, Esc or Backspace |
| Show any unit's move and threat range | Hold right click on it, with nothing selected | Hold X on it, with nothing selected |
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
