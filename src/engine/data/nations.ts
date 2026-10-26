// Sides and nations, from docs/00-master-design.md section 6.
// Nations only affect which unit types a scenario offers (availability rule) and art, never stats.

export type Side = "allies" | "axis";

export const NATIONS = {
  us: { name: "United States", side: "allies" },
  uk: { name: "United Kingdom", side: "allies" },
  canada: { name: "Canada", side: "allies" },
  ussr: { name: "Soviet Union", side: "allies" },
  germany: { name: "Germany", side: "axis" },
} as const satisfies Record<string, { name: string; side: Side }>;

export type NationId = keyof typeof NATIONS;
