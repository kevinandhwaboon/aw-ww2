# WW2 Tactics (working title)

A turn-based, grid-based WW2 strategy game for the browser, inspired by the mechanics of the GBA-era Advance Wars games, with original art and names.

**Play the latest build:** https://kevinandhwaboon.github.io/aw-ww2/

## Status

Phase 1 (core MVP) is complete. Two players on one device can pick from four test maps and play to a finish: movement with terrain costs and fuel, combat with luck, counterattacks, indirect fire, a damage forecast and veterancy, an economy with capture, income, building and repair, Halftrack transport, supply and joining units, win conditions with a results screen, and bunkers and obstacles that can be destroyed. Phase 2 is under way: Fighters, Bombers and Flak Guns are in. Ships come next, then landings and the first AI. See [`docs/11-tech-setup.md`](docs/11-tech-setup.md) §6 for the milestone plan.

## Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Move cursor | Move the mouse | Arrow keys |
| Select unit / choose destination / choose menu item | Left click | Z, Enter or Space |
| Open the turn menu (Resign, End Turn) | Click any tile with no unit ready to move | Z on any tile with no unit ready to move |
| Fire at a target | FIRE in the menu, then click a red target | Z on FIRE, arrow keys step between targets, Z on one, X to go back |
| Capture a property | CAPTURE in the menu | Z on CAPTURE |
| Build a unit | Click your empty factory, then a unit | Z on the factory, arrow keys, Z |
| Load or join | Move onto your Halftrack or a damaged unit of the same type, then LOAD or JOIN | The same with arrow keys and Z |
| Unload | UNLOAD in the menu, then click a blue tile | Z on UNLOAD, arrow keys step between tiles, Z on one, X to go back |
| Cancel | Right click, or click outside the menu | X, Esc or Backspace |
| Show any unit's move and threat range | Hold right click on it, with nothing selected | Hold X on it, with nothing selected |
| Undo last move this turn | None | U or Cmd/Ctrl+Z |
| End turn | END TURN in the turn menu | Z twice on any tile with no unit ready to move, or E |
| Resign | RESIGN in the turn menu, then RESIGN NOW | The same with arrow keys and Z |
| Menus and screens | Click | Arrow keys, Z to choose, X to go back. On map select, arrows pick a map, Z moves to Start, and Up from there reaches the options |

## Art packs

The game's art, colors and unit names can be swapped without changing code: add `?pack=night-ops` to the URL to see the example, or see [`docs/08-art-pipeline.md`](docs/08-art-pipeline.md) §13 to make your own.

## Development

Requires Node.js 24+.

```bash
npm install
npm run dev       # play locally
npm run check     # typecheck + lint + tests
npm run test:ui   # browser test viewer
```

Design docs live in [`docs/`](docs/); start with [`00-master-design.md`](docs/00-master-design.md). Build instructions for Claude Code are in [`CLAUDE.md`](CLAUDE.md).
