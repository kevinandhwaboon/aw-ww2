import { terrainDef, type TerrainId } from "../engine/data/terrain";

/** HTML overlay panel showing the terrain under the cursor (00-master-design §12, HUD panels). */
export function createTerrainPanel(root: HTMLElement): { show: (id: TerrainId) => void } {
  const panel = document.createElement("div");
  panel.className = "panel terrain-panel";
  const name = document.createElement("div");
  name.className = "panel-title";
  const stars = document.createElement("div");
  stars.className = "stars";
  panel.append(name, stars);
  root.append(panel);

  return {
    show(id) {
      const def = terrainDef(id);
      name.textContent = def.name;
      stars.textContent = def.defenseStars > 0 ? "★".repeat(def.defenseStars) : "–";
      stars.title = `Defense: ${def.defenseStars}`;
    },
  };
}
