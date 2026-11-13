import type { Point } from "../engine/map";
import type { GameState } from "../engine/state";
import { playerColors } from "../game/placeholderUnits";
import { tileInfo, type Passenger } from "../game/tileInfo";
import { el, stars } from "./dom";

/** The terrain under the cursor and its defense, and the unit there if any. Stays away from the cursor. */
/** `cursorOnLeft`: the cursor is in the left half of the screen, so the panel goes right. */
export function createTileInfo(root: HTMLElement): { show: (state: GameState, tile: Point, cursorOnLeft: boolean) => void } {
  const panel = el("div", "panel tile-info");
  const name = el("div", "panel-title");
  const defense = el("div", "tile-defense");
  const objectiveLine = el("div", "tile-objective", "★ Objective");
  const captureLine = el("div", "tile-capture");
  const unitLine = el("div", "tile-unit");
  const supplyLine = el("div", "tile-supply");
  const fuelText = el("span");
  const ammoText = el("span");
  supplyLine.append(fuelText, ammoText);
  const cargoLine = el("div", "tile-cargo");
  panel.append(name, defense, objectiveLine, captureLine, unitLine, supplyLine, cargoLine);
  root.append(panel);

  return {
    show(state, tile, cursorOnLeft) {
      const info = tileInfo(state, tile);
      name.textContent = info.terrain;
      defense.textContent = info.stars > 0 ? `Defense ${stars(info.stars)}` : "No defense";
      unitLine.hidden = !info.unit;
      unitLine.textContent = info.unit?.name ?? "";
      unitLine.style.color = info.unit ? playerColors(info.unit.owner)[0] : "";
      objectiveLine.hidden = !info.objective;
      const unit = info.unit;
      supplyLine.hidden = !unit;
      fuelText.textContent = unit ? `Fuel ${unit.fuel.left}/${unit.fuel.max}` : "";
      fuelText.classList.toggle("tile-low", unit?.fuel.low === true);
      ammoText.hidden = !unit?.ammo;
      ammoText.textContent = unit?.ammo ? `Ammo ${unit.ammo.left}/${unit.ammo.max}` : "";
      ammoText.classList.toggle("tile-low", unit?.ammo?.low === true);
      captureLine.hidden = !info.capture;
      captureLine.textContent = info.capture ? `Capture ${info.capture.left}/${info.capture.total}` : "";
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
      const fuel = el("span", p.fuel.low ? "tile-low" : undefined, `Fuel ${p.fuel.left}/${p.fuel.max}`);
      const parts: HTMLElement[] = [el("span", "tile-passenger-name", p.name), el("span", undefined, `HP ${p.hp}`), fuel];
      if (p.ammo) parts.push(el("span", p.ammo.low ? "tile-low" : undefined, `Ammo ${p.ammo.left}/${p.ammo.max}`));
      row.append(...parts);
      return row;
    }),
  ];
}
