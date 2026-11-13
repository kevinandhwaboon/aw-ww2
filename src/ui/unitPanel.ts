import { UNITS } from "../engine/data/units";
import { veterancyFor } from "../engine/data/veterancy";
import type { Modifier } from "../engine/modifiers";
import { displayHp, type GameState, type Unit } from "../engine/state";
import * as stats from "../engine/stats";
import { unitName as unitTypeName } from "../game/artPack";
import { playerColors } from "../game/placeholderUnits";
import { el, stars } from "./dom";

function describeModifier(m: Modifier): string {
  const value = m.op === "add" ? `${m.value >= 0 ? "+" : ""}${m.value}` : m.op === "multiply" ? `×${m.value}` : `=${m.value}`;
  return `${m.source}: ${m.stat} ${value}`;
}

/** Stats of the unit under the cursor, as the engine computes them (through the modifier layer). */
export function createUnitPanel(root: HTMLElement): { show: (state: GameState, unit: Unit | undefined) => void } {
  const panel = el("div", "panel unit-panel");
  panel.hidden = true;
  root.append(panel);

  return {
    show(state, unit) {
      panel.hidden = !unit;
      if (!unit) return;
      const def = UNITS[unit.type];
      const owner = state.players[unit.owner];
      const vet = veterancyFor(unit.kills);
      const range = stats.attackRange(state, unit);
      const ammo = stats.maxAmmo(state, unit);

      const rows: [string, string][] = [];
      const row = (label: string, value: number | string, base?: number) => {
        const changed = base !== undefined && typeof value === "number" && value !== base;
        rows.push([label, changed ? `${value} (base ${base})` : String(value)]);
      };
      row("HP", `${displayHp(unit.hp)} / 10  (internal ${unit.hp})`);
      const burn = stats.fuelPerDay(state, unit);
      const perMove = stats.fuelPerMove(state, unit);
      const costs = [...(burn > 0 ? [`−${burn} per turn`] : []), ...(perMove > 1 ? [`−${perMove} per tile moved`] : [])];
      row("Fuel", `${unit.fuel} / ${stats.maxFuel(state, unit)}${costs.length > 0 ? `  (${costs.join(", ")})` : ""}`);
      row("Ammo", def.primaryWeapon ? `${unit.ammo} / ${ammo}  (${def.primaryWeapon.name})` : "—");
      if (def.secondaryWeapon) row("Secondary", def.secondaryWeapon.name);
      row("Move", stats.movePoints(state, unit), def.movePoints);
      row("Move type", def.movementType);
      row("Vision", stats.vision(state, unit), def.vision);
      row("Range", range ? (range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`) : "—");
      row("Attack", stats.attackMod(state, unit), 100);
      row("Defense", stats.defenseMod(state, unit), 100);
      row("Terrain", stars(stats.terrainStars(state, unit)));
      row("Rank", `${vet.level} (${unit.kills} kills)`);
      row("Cost", stats.unitCost(state, unit.owner, unit.type), def.cost);
      row("Acted", unit.hasActed ? "yes" : "no");
      if (unit.cargo.length > 0) {
        row("Carrying", unit.cargo.map((c) => `${unitTypeName(c.type)} (${displayHp(c.hp)} HP)`).join(", "));
      }

      const title = el("div", "panel-title", unitTypeName(unit.type));
      const ownerLine = el("div", "unit-owner", `${owner?.name ?? "?"} · unit #${unit.id}`);
      ownerLine.style.color = playerColors(unit.owner)[0];
      const table = el("table", "stat-table");
      for (const [label, value] of rows) {
        const tr = el("tr");
        tr.append(el("th", undefined, label), el("td", undefined, value));
        table.append(tr);
      }
      const mods = stats.modifiersAffecting(state, unit);
      const modList = el("ul", "modifier-list");
      for (const m of mods) modList.append(el("li", undefined, describeModifier(m)));
      if (mods.length === 0) modList.append(el("li", "muted", "no modifiers"));
      panel.replaceChildren(title, ownerLine, table, el("div", "panel-subtitle", "Modifiers"), modList);
    },
  };
}
