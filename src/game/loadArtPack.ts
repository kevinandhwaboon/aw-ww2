// Loads an art pack at startup. Kept apart from artPack.ts because this part needs the browser.

import { BUILT_IN_PACK, parseArtPack, setActivePack, type ArtPack } from "./artPack";

const packUrl = (name: string, file: string) => new URL(`assets/packs/${name}/${file}`, document.baseURI).href;

/** The full address of a file in the active pack's folder. */
let packFolder = "";
export const packFileUrl = (path: string): string => new URL(path, packFolder).href;

/** The page's CSS colors come from the pack too (see the variables in ui/style.css). */
function applyPageColors({ colors }: ArtPack): void {
  const { style } = document.documentElement;
  style.setProperty("--bg", colors.uiBg);
  style.setProperty("--panel-bg", colors.uiPanel);
  style.setProperty("--panel-ink", colors.uiInk);
  style.setProperty("--panel-border", colors.uiBorder);
  style.setProperty("--accent", colors.uiAccent);
  style.setProperty("--highlight", colors.uiHighlight);
}

async function fetchPack(name: string): Promise<ArtPack> {
  // Pack names come from the URL, so they can't be allowed to point anywhere else.
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Bad pack name "${name}"`);
  const response = await fetch(packUrl(name, "pack.json"));
  if (!response.ok) throw new Error(`No pack named "${name}" (${response.status})`);
  return parseArtPack(await response.json());
}

/** Loads the named pack. A bad pack must never stop the game, so it falls back to the built-in look. */
export async function loadArtPack(name: string): Promise<void> {
  let pack = BUILT_IN_PACK;
  try {
    pack = await fetchPack(name);
    packFolder = packUrl(name, "");
  } catch (error) {
    console.warn(`Couldn't load art pack: ${error instanceof Error ? error.message : String(error)}`);
  }
  setActivePack(pack);
  applyPageColors(pack);
}
