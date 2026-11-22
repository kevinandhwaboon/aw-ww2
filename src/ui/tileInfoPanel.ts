import type { Point } from "../engine/map";
import type { GameState } from "../engine/state";
import { playerColors } from "../game/placeholderUnits";
import { tileInfo, type Passenger, type Supply } from "../game/tileInfo";
import { el, stars } from "./dom";
import { drawFlag } from "./flag";

/** The terrain under the cursor and its defense, and the unit there if any. Stays away from the cursor. */
/** `cursorOnLeft`: the cursor is in the left half of the screen, so the panel goes right. */
/** `inFog`: the tile is out of the viewer's sight (19-fog-of-war §7). */
export function createTileInfo(root: HTMLElement): { show: (state: GameState, tile: Point, cursorOnLeft: boolean, inFog: boolean) => void } {
  const panel = el("div", "panel tile-info");
  const name = el("div", "panel-title");
  const defense = el("div", "tile-defense");
  const objectiveLine = el("div", "tile-objective", "★ Objective");
  const fogLine = el("div", "tile-fog", "Fog: out of sight");
  const captureLine = el("div", "tile-capture");
  const bridgeLine = el("div", "tile-capture");
  const unitLine = el("div", "tile-unit");
  const unitFlag = el("span", "tile-flag");
  const unitName = el("span");
  unitLine.append(unitFlag, unitName);
  // The flag is only redrawn when the nation under the cursor changes.
  let flagOf: string | null = null;
  const supplyLine = el("div", "tile-supply");
  const fuelText = el("span");
  const ammoText = el("span");
  supplyLine.append(fuelText, ammoText);
  const cargoLine = el("div", "tile-cargo");
  panel.append(name, defense, fogLine, objectiveLine, captureLine, bridgeLine, unitLine, supplyLine, cargoLine);
  root.append(panel);

  return {
    show(state, tile, cursorOnLeft, inFog) {
      const info = tileInfo(state, tile);
      fogLine.hidden = !inFog;
      name.textContent = info.terrain;
      defense.textContent = info.stars > 0 ? `Defense ${stars(info.stars)}` : "No defense";
      unitLine.hidden = !info.unit;
      unitName.textContent = info.unit?.name ?? "";
      const nation = info.unit?.nation ?? null;
      unitFlag.hidden = nation === null;
      if (nation !== flagOf) {
        unitFlag.replaceChildren(...(nation ? [drawFlag(nation)] : []));
        flagOf = nation;
      }
      unitLine.style.color = info.unit ? playerColors(info.unit.owner)[0] : "";
      objectiveLine.hidden = !info.objective;
      const unit = info.unit;
      supplyLine.hidden = !unit;
      // A unit with no fuel tank (a Radar Station) shows no fuel line.
      fuelText.textContent = unit && unit.fuel.max > 0 ? `Fuel ${unit.fuel.left}/${unit.fuel.max}` : "";
      fuelText.classList.toggle("tile-low", unit?.fuel.low === true);
      fuelText.classList.toggle("tile-empty", unit?.fuel.empty === true);
      ammoText.hidden = !unit?.ammo;
      ammoText.textContent = unit?.ammo ? `${unit.ammo.label} ${unit.ammo.left}/${unit.ammo.max}` : "";
      ammoText.classList.toggle("tile-low", unit?.ammo?.low === true);
      ammoText.classList.toggle("tile-empty", unit?.ammo?.empty === true);
      captureLine.hidden = !info.capture;
      captureLine.textContent = info.capture ? `Capture ${info.capture.left}/${info.capture.total}` : "";
      // Major Bridges (02-terrain §4a).
      const bridge = info.bridge;
      bridgeLine.hidden = !bridge;
      bridgeLine.textContent = !bridge
        ? ""
        : bridge.action === "blow"
          ? `Can be blown by ${bridge.by}`
          : `Can be rebuilt by ${bridge.by}: ${bridge.left}/${bridge.total}`;
      // A transport lists who is aboard, each with HP, fuel and ammo (05-supply-transport §4).
      const cargo = info.unit?.cargo;
      cargoLine.hidden = !cargo;
      cargoLine.replaceChildren(...(cargo ? cargoRows(cargo) : []));
      panel.classList.toggle("tile-info-right", cursorOnLeft);
    },
  };
}

/** "Carrying: nothing", or a heading and one row per passenger with its HP, fuel and ammo. */
function cargoRows(cargo: readonly Passenger[]): HTMLElement[] {
  if (cargo.length === 0) return [el("div", undefined, "Carrying: nothing")];
  return [
    el("div", undefined, "Carrying:"),
    ...cargo.map((p) => {
      const row = el("div", "tile-passenger");
      const fuel = el("span", supplyClass(p.fuel), `Fuel ${p.fuel.left}/${p.fuel.max}`);
      const parts: HTMLElement[] = [el("span", "tile-passenger-name", p.name), el("span", undefined, `HP ${p.hp}`), fuel];
      if (p.ammo) parts.push(el("span", supplyClass(p.ammo), `${p.ammo.label} ${p.ammo.left}/${p.ammo.max}`));
      row.append(...parts);
      return row;
    }),
  ];
}

/** The warning classes for a fuel or ammo line: orange when low, red when empty (05-supply-transport §11). */
function supplyClass(supply: Supply): string | undefined {
  return supply.empty ? "tile-low tile-empty" : supply.low ? "tile-low" : undefined;
}
