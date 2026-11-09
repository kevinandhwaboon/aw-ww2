// The shape every battle figure shares (08-art-pipeline §18). A rig draws one figure, facing right,
// with its feet (or waterline, or the middle of an aircraft) at (0, 0), as a pure function of time.

import type { NationId } from "../../engine/data/nations";
import type { FireKind } from "./plan";
import type { Painter, TeamShades } from "./paint";

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface Look {
  readonly team: TeamShades;
  readonly nation: NationId | null;
  readonly paratrooper: boolean;
  /** A paratrooper's helmet card suit: 0 spade, 1 heart, 2 diamond, 3 club. */
  readonly suit: number;
  readonly submerged: boolean;
  /** Foot soldiers on a bunker fight from behind sandbags and concrete. */
  readonly dugIn: boolean;
  /** A Landing Craft run aground on a beach, its ramp down on the sand. */
  readonly beached: boolean;
}

/** Where a shot leaves, and the barrel's angle there (0 = straight ahead, negative = up). */
export interface Muzzle extends Pt {
  readonly angle?: number;
}

export interface Pose {
  /** Scene time in ms, for idle motion. */
  readonly t: number;
  /** Which figure of the formation this is. */
  readonly index: number;
  /** The weapon this side is using while its strike plays; null while it waits or takes hits. */
  readonly fire: FireKind | null;
  /** Time into the current firing cycle, or null between cycles. */
  readonly ct: number | null;
  readonly atAir: boolean;
  /** The half's displayed HP right now. */
  readonly hp: number;
  /** Ms since this figure was knocked out; absent while it's alive. */
  readonly down?: number;
}

/** How a figure goes down: soldiers fall, machines burn, aircraft drop out of the sky, ships settle. */
export type BodyKind = "soldier" | "machine" | "air" | "ship";

export interface Rig {
  readonly body: BodyKind;
  /** Where shots aimed at it land. */
  readonly hit: Pt;
  draw(p: Painter, pose: Pose, look: Look): void;
  /** Where shot number `shot` of a cycle leaves from. */
  muzzle(pose: Pose, shot: number, look: Look): Muzzle;
  /**
   * Soldiers draw their own fall (from `pose.down`): each man topples about his own feet while the
   * gear around him (a mortar, sandbags) stays put. True while that gear is still on the ground
   * after the men have gone, so its shadow stays too.
   */
  gearStays?(look: Look): boolean;
}

/** Whose equipment a figure carries: Japan's, Germany's, or the US look every other Allied nation shares. */
export type Kit = "us" | "de" | "jp";
export const kitOf = (look: Pick<Look, "nation">): Kit => (look.nation === "germany" ? "de" : look.nation === "japan" ? "jp" : "us");

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
/** 0 before a, 1 after b, a straight ramp between. */
export const seg = (t: number | null, a: number, b: number): number => (t === null ? 0 : clamp01((t - a) / (b - a)));
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
/** A quick kick back at `at` that eases home over `back` ms. */
export function kick(t: number | null, at: number, rise: number, back: number): number {
  if (t === null || t < at) return 0;
  if (t < at + rise) return (t - at) / rise;
  return clamp01(1 - (t - at - rise) / back);
}
/** Whether a cycle time falls just after any of the given shot times. */
export function justFired(t: number | null, shots: readonly number[], window: number): number {
  if (t === null) return -1;
  return shots.findIndex((s) => t >= s && t < s + window);
}
/** A point `len` along `angle` from (x, y). */
export const along = (x: number, y: number, angle: number, len: number): Pt => ({ x: x + Math.cos(angle) * len, y: y + Math.sin(angle) * len });
