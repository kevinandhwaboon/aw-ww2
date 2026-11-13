// Plays engine events as animations on the map: moves, attacks, captures, labels (00-master-design §13).
// Split out of MapScene; it reaches the scene only through PlaybackHost.

import type Phaser from "phaser";
import type { Combatant, GameEvent } from "../engine/commands";
import type { Point } from "../engine/map";
import type { GameState, Unit, UnitId } from "../engine/state";
import { weatherOn } from "../engine/weather";
import type { BattlePlayer } from "./battle/BattleScene";
import { setBattleWeather } from "./battle/colors";
import { planDrop } from "./battle/drop";
import { planCombat, planFortAttack } from "./battle/plan";
import { planCapture, planGarrison } from "./battle/storm";
import { packColor, packColorNumber } from "./artPack";
import { TILE_SIZE } from "./placeholderTiles";

const MOVE_MS_PER_TILE = 70;
const COMBAT_MS = { nudge: 70, flash: 140, float: 480, explode: 260 };
/** How long the view takes to pan to the next thing that happens. */
export const ACTION_PAN_MS = 220;

/** What a shot lands on: a unit, or just a tile for a fortification. */
interface StrikeTarget {
  readonly pos: Point;
  readonly unitId?: UnitId;
}

/** The middle of a tile, in map pixels. */
export const center = (p: Point) => ({ x: p.x * TILE_SIZE + TILE_SIZE / 2, y: p.y * TILE_SIZE + TILE_SIZE / 2 });

/** The parts of the map scene that event playback uses. */
export interface PlaybackHost {
  readonly scene: Phaser.Scene;
  /** The game state before the events being played. */
  state(): GameState;
  battle(): BattlePlayer | null;
  readonly unitSprites: ReadonlyMap<UnitId, Phaser.GameObjects.Container>;
  readonly unitImages: ReadonlyMap<UnitId, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>;
  addUnitSprite(unit: Unit): void;
  revealTiles(tiles: readonly Point[], ms: number): Promise<void>;
  textTexture(text: string, color: string, outline?: string): string;
}

export class MapPlayback {
  constructor(private readonly host: PlaybackHost) {}

  private get state(): GameState {
    return this.host.state();
  }

  private get battle(): BattlePlayer | null {
    return this.host.battle();
  }

  private get unitSprites(): ReadonlyMap<UnitId, Phaser.GameObjects.Container> {
    return this.host.unitSprites;
  }

  private get unitImages(): ReadonlyMap<UnitId, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite> {
    return this.host.unitImages;
  }

  private get add(): Phaser.GameObjects.GameObjectFactory {
    return this.host.scene.add;
  }

  private get tweens(): Phaser.Tweens.TweenManager {
    return this.host.scene.tweens;
  }

  private addUnitSprite(unit: Unit): void {
    this.host.addUnitSprite(unit);
  }

  private revealTiles(tiles: readonly Point[], ms: number): Promise<void> {
    return this.host.revealTiles(tiles, ms);
  }

  private textTexture(text: string, color: string, outline?: string): string {
    return this.host.textTexture(text, color, outline);
  }

  /** Animates engine events. Call before setState(newState); resolves when the animations finish. */
  async playEvents(events: readonly GameEvent[]): Promise<void> {
    setBattleWeather({ season: this.state.weather.season, snowing: weatherOn(this.state) === "snow" });
    for (const event of events) {
      await this.revealTiles(this.eventTiles(event), ACTION_PAN_MS);
      if (event.type === "unitLaunched" && !this.unitSprites.has(event.unitId)) {
        // Takes off from the Carrier's tile, unless the launch preview already put it there.
        const aircraft = this.state.units.find((u) => u.id === event.carrierId)?.cargo.find((c) => c.id === event.unitId);
        if (aircraft) this.addUnitSprite({ ...aircraft, pos: event.pos, hasActed: false });
      }
      if (event.type === "unitMoved") {
        await this.walk(event.unitId, event.path);
        await this.playGarrison(event.unitId, event.path[0] ?? null, event.path[event.path.length - 1], events);
      }
      if (event.type === "unitUnloaded") {
        // A Transport Aircraft's passengers jump (08-art-pipeline §20); others may go into a bunker.
        const drop = this.battle && planDrop(this.state, event);
        if (this.battle && drop) await this.battle.playDrop(drop);
        else await this.playGarrison(event.unitId, null, event.pos, events);
      }
      if (event.type === "combat") await this.playCombat(event);
      if (event.type === "fortAttacked") {
        const plan = this.battle && planFortAttack(this.state, event);
        if (this.battle && plan) await this.battle.play(plan);
        else {
          const shooter = { unitId: event.attackerId, pos: event.attackerPos };
          await this.playStrike(shooter, { pos: event.pos }, event.attack.damage, event.hp === 0);
        }
      }
      if (event.type === "captureProgress" || event.type === "propertyCaptured") {
        // A capture plays as a storming scene when scenes are on (08-art-pipeline §19), else as a label.
        const plan = this.battle && planCapture(this.state, event);
        if (this.battle && plan) await this.battle.playStorm(plan);
        else if (event.type === "captureProgress") await this.floatLabel(event.pos, `${event.capturePoints} LEFT`, packColor("labelText"));
        else await this.floatLabel(event.pos, "CAPTURED", packColor("labelGold"));
      }
      if (event.type === "unitOutOfFuel") {
        const lost = { pos: event.pos, unitId: event.unitId };
        await Promise.all([this.explode(lost), this.floatLabel(event.pos, "OUT OF FUEL", packColor("labelWarning"))]);
      }
      if (event.type === "unitJoined") {
        const target = this.state.units.find((u) => u.id === event.targetId);
        if (target) await this.floatLabel(target.pos, "JOINED", packColor("labelText"));
      }
      if (event.type === "unitDived" || event.type === "unitSurfaced") {
        // The sprite has already walked to where the submarine dived or surfaced.
        const sprite = this.unitSprites.get(event.unitId);
        const tile = sprite && { x: Math.round(sprite.x / TILE_SIZE), y: Math.round(sprite.y / TILE_SIZE) };
        if (tile) await this.floatLabel(tile, event.type === "unitDived" ? "DIVE" : "SURFACE", packColor("submerged"));
      }
    }
    await Promise.all(this.repairLabels(events));
  }

  /** Foot soldiers going into a bunker play a storming scene, when scenes are on (08-art-pipeline §19). */
  private async playGarrison(unitId: UnitId, from: Point | null, to: Point | undefined, events: readonly GameEvent[]): Promise<void> {
    if (!this.battle || !to) return;
    const plan = planGarrison(this.state, unitId, from, to, events);
    if (plan) await this.battle.playStorm(plan);
  }

  /** Where an event happens, so the view can pan to it first. Repairs at turn start don't pan. */
  private eventTiles(event: GameEvent): Point[] {
    switch (event.type) {
      case "unitMoved":
        return event.path.slice(0, 1);
      case "combat":
        return [event.attacker.pos, event.defender.pos];
      case "fortAttacked":
        return [event.attackerPos, event.pos];
      case "captureProgress":
      case "propertyCaptured":
      case "unitOutOfFuel":
      case "unitLaunched":
        return [event.pos];
      case "unitJoined": {
        const target = this.state.units.find((u) => u.id === event.targetId);
        return target ? [target.pos] : [];
      }
      default:
        return [];
    }
  }

  /** "+2" over repaired units and "SUPPLY" over units only resupplied, all at once. */
  private repairLabels(events: readonly GameEvent[]): Promise<void>[] {
    const repaired = new Set<UnitId>();
    const labels: Promise<void>[] = [];
    // Aircraft aboard a Carrier are serviced there, so their labels show over the Carrier.
    const over = (unitId: UnitId, text: string, color: string) => {
      const unit = this.state.units.find((u) => u.id === unitId || u.cargo.some((c) => c.id === unitId));
      if (unit) labels.push(this.floatLabel(unit.pos, text, color));
    };
    for (const event of events) {
      if (event.type !== "unitRepaired") continue;
      repaired.add(event.unitId);
      over(event.unitId, `+${event.hp}`, packColor("labelGreen"));
    }
    for (const event of events) {
      if (event.type === "unitResupplied" && !repaired.has(event.unitId)) over(event.unitId, "SUPPLY", packColor("labelBlue"));
    }
    return labels;
  }

  /**
   * The attack, then the counter if there was one, then any promotions (00-master-design §13): as a
   * battle scene when they're on, otherwise on the map. After a battle scene, a destroyed unit
   * still blows up on the map so it's clear which one is gone.
   */
  private async playCombat(event: Extract<GameEvent, { type: "combat" }>): Promise<void> {
    const { attacker, defender, attack, counter } = event;
    if (this.battle) {
      await this.battle.play(planCombat(this.state, event));
      const lost = [attacker, defender].filter((u) => u.destroyed).map((u) => this.explode({ pos: u.pos, unitId: u.unitId }));
      await Promise.all(lost);
    } else {
      await this.playStrike(attacker, defender, attack.damage, counter === null && defender.destroyed);
      if (counter) await this.playStrike(defender, attacker, counter.damage, attacker.destroyed);
    }
    for (const unit of [attacker, defender]) {
      if (unit.promotedTo) await this.floatLabel(unit.pos, unit.promotedTo.toUpperCase(), packColor("labelGold"));
    }
  }

  /** The shooter nudges toward its target, which flashes and shows the damage. */
  private async playStrike(
    shooter: Pick<Combatant, "unitId" | "pos">,
    target: StrikeTarget,
    damage: number,
    destroyed: boolean,
  ): Promise<void> {
    const sprite = this.unitSprites.get(shooter.unitId);
    if (sprite) {
      const { x, y } = sprite;
      const dx = Math.sign(target.pos.x - shooter.pos.x) * 3;
      const dy = Math.sign(target.pos.y - shooter.pos.y) * 3;
      await this.tween(sprite, { x: x + dx, y: y + dy }, COMBAT_MS.nudge);
      await this.tween(sprite, { x, y }, COMBAT_MS.nudge);
    }
    const flash = this.add.rectangle(target.pos.x * TILE_SIZE, target.pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, packColorNumber("flash")).setOrigin(0);
    await this.tween(flash, { alpha: 0 }, COMBAT_MS.flash);
    flash.destroy();
    await Promise.all([
      this.floatLabel(target.pos, `-${damage}`, packColor("labelText")),
      destroyed ? this.explode(target) : Promise.resolve(),
    ]);
  }

  private async explode(target: StrikeTarget): Promise<void> {
    const { x, y } = center(target.pos);
    const blast = this.add.rectangle(x, y, 8, 8, packColorNumber("blast"));
    const sprite = target.unitId === undefined ? undefined : this.unitSprites.get(target.unitId);
    await Promise.all([
      this.tween(blast, { scaleX: 2.5, scaleY: 2.5, alpha: 0 }, COMBAT_MS.explode),
      sprite ? this.tween(sprite, { alpha: 0 }, COMBAT_MS.explode) : Promise.resolve(),
    ]);
    blast.destroy();
  }

  /** Text that rises from a tile and fades out. */
  private async floatLabel(tile: Point, text: string, color: string): Promise<void> {
    const { x, y } = center(tile);
    const label = this.add.image(x, y, this.textTexture(text, color, packColor("labelOutline")));
    await this.tween(label, { y: y - 9, alpha: 0 }, COMBAT_MS.float);
    label.destroy();
  }

  private tween(target: object, props: Record<string, number>, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ targets: target, ...props, duration, onComplete: () => resolve() });
    });
  }

  /** Tweens a unit marker tile by tile along a path. Skips if it's already at the end (previewed). */
  async walk(unitId: UnitId, fullPath: readonly Point[]): Promise<void> {
    const sprite = this.unitSprites.get(unitId);
    const end = fullPath[fullPath.length - 1];
    if (!sprite || !end) return;
    if (sprite.x === end.x * TILE_SIZE && sprite.y === end.y * TILE_SIZE) return;
    // A soldier leaving a garrisoned bunker comes out into view.
    this.unitImages.get(unitId)?.setVisible(true);
    for (const p of fullPath.slice(1)) {
      // The view keeps pace with the unit, so a long move never walks off screen.
      await Promise.all([
        this.revealTiles([p], MOVE_MS_PER_TILE),
        new Promise<void>((resolve) => {
          this.tweens.add({
            targets: sprite,
            x: p.x * TILE_SIZE,
            y: p.y * TILE_SIZE,
            duration: MOVE_MS_PER_TILE,
            onComplete: () => resolve(),
          });
        }),
      ]);
    }
  }
}
