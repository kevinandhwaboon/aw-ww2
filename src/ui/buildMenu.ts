import type { UnitTypeId } from "../engine/data/units";
import type { GameState, Player } from "../engine/state";
import { activePack, findUnitArt, unitName as unitTypeName } from "../game/artPack";
import type { BuildMenu } from "../game/controller";
import { packFileUrl } from "../game/loadArtPack";
import { TILE_SIZE } from "../game/placeholderTiles";
import { drawUnitMarker } from "../game/placeholderUnits";
import { UNIT_GUIDE } from "../game/unitGuide";
import { el } from "./dom";
import { menuKeys } from "./menuKeys";

const SPRITE_SCALE = 2;

/** The unit's sprite from the art pack, facing the way it does on the map, or its placeholder marker. */
function unitPicture(player: Player | undefined, type: UnitTypeId): HTMLElement {
  const picture = el("div", "build-sprite");
  const pack = activePack();
  const art = player ? findUnitArt(pack, player.nation, player.id, type) : null;
  const sheet = art ? pack.unitSheets[art.sheet] : undefined;
  if (art && sheet) {
    const tile = TILE_SIZE * SPRITE_SCALE;
    picture.style.backgroundImage = `url("${packFileUrl(sheet.path)}")`;
    picture.style.backgroundSize = `${art.frames * tile}px auto`;
    picture.style.backgroundPosition = `0 ${-art.row * tile}px`;
    if (player?.facing === "left") picture.style.transform = "scaleX(-1)";
  } else if (player) {
    picture.append(drawUnitMarker(type, player.id));
  }
  return picture;
}

/** What the unit is for and what it beats and fears, as short lines for the build list. */
function guideLines(type: UnitTypeId): HTMLElement[] {
  const { role, strongVs, weakVs } = UNIT_GUIDE[type];
  const names = (types: readonly UnitTypeId[]) => types.map(unitTypeName).join(", ");
  return [
    el("div", "build-role", role),
    ...(strongVs.length > 0 ? [el("div", "build-strong", `Strong vs ${names(strongVs)}`)] : []),
    el("div", "build-weak", `Weak vs ${names(weakVs)}`),
  ];
}

/** The factory's list of units: a scrolling HTML list, as decided in 00-master-design §12. */
export function createBuildMenu(root: HTMLElement, getState: () => GameState): BuildMenu {
  const panel = el("div", "panel build-menu");
  panel.hidden = true;
  root.append(panel);

  return {
    open(options, onPick, onCancel) {
      const state = getState();
      const player = state.players[state.currentPlayer];
      const title = el("div", "panel-title", "Build");
      const list = el("div", "build-list");
      const buttons = options.map((option) => {
        const row = el("button", "list-row build-row");
        row.disabled = !option.affordable;
        const heading = el("div", "build-heading");
        heading.append(el("span", "build-name", unitTypeName(option.type)), el("span", "build-cost", option.cost.toLocaleString("en-US")));
        const details = el("div", "build-details");
        details.append(heading, ...guideLines(option.type));
        row.append(unitPicture(player, option.type), details);
        row.addEventListener("click", () => onPick(option.type));
        list.append(row);
        return row;
      });
      const cancel = el("button", "btn", "Cancel");
      cancel.addEventListener("click", onCancel);
      panel.replaceChildren(title, list, cancel);
      panel.hidden = false;

      const focusable = [...buttons.filter((b) => !b.disabled), cancel];
      focusable[0]?.focus();
      menuKeys(panel, focusable, onCancel);
    },
    close() {
      panel.hidden = true;
      panel.replaceChildren();
    },
  };
}
