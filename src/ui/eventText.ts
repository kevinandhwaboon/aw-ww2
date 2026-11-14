import type { Combatant, GameEvent } from "../engine/commands";
import { displayHp, type DefeatReason, type GameState } from "../engine/state";
import { terrainName, unitName as unitTypeName, weatherName } from "../game/artPack";

/** Why a player is out, for the event log. */
const OUT_TEXT: Record<DefeatReason, string> = {
  hqCapture: "HQ captured",
  rout: "no units left",
  resign: "resigned",
  captureProperties: "the enemy captured every objective",
  holdProperties: "the enemy held the objectives",
  surviveDays: "the enemy held out",
};

/** One line of the debug event log describing what happened. */
export function describeEvent(state: GameState, previous: GameState, e: GameEvent): string {
  const name = (id: number) => state.players[id]?.name ?? `Player ${id}`;
  const unitName = (id: number) => {
    // Boarded and merged units are gone from the map by now, so look in cargo and the previous state too.
    const everyone = [...state.units, ...state.units.flatMap((u) => u.cargo), ...previous.units];
    const unit = everyone.find((u) => u.id === id);
    return unit ? `${name(unit.owner)} ${unitTypeName(unit.type)} #${id}` : `unit #${id}`;
  };
  switch (e.type) {
    case "unitMoved": {
      const end = e.path[e.path.length - 1];
      const tiles = e.path.length - 1;
      return `${unitName(e.unitId)} moved ${tiles} tile${tiles === 1 ? "" : "s"} to (${end?.x}, ${end?.y}), fuel −${e.fuelUsed}`;
    }
    case "unitWaited":
      return `${unitName(e.unitId)} waits`;
    case "unitAmbushed":
      return `${unitName(e.unitId)} was ambushed by ${unitName(e.by)} at (${e.pos.x}, ${e.pos.y}) and stopped`;
    case "combat": {
      const who = (c: Combatant) => `${name(c.owner)} ${unitTypeName(c.type)}`;
      const tag = (c: Combatant) => (c.destroyed ? " (destroyed)" : c.promotedTo ? ` (now ${c.promotedTo})` : "");
      const counter = e.counter ? `, counter ${e.counter.damage}% (luck ${e.counter.luck})` : ", no counter";
      return `${who(e.attacker)}${tag(e.attacker)} hit ${who(e.defender)}${tag(e.defender)} for ${e.attack.damage}% (luck ${e.attack.luck})${counter}`;
    }
    case "unitLoaded":
      return `${unitName(e.unitId)} boarded ${unitName(e.transportId)}`;
    case "unitLaunched":
      return `${unitName(e.unitId)} took off from ${unitName(e.carrierId)}`;
    case "unitUnloaded":
      return `${unitName(e.unitId)} unloaded at (${e.pos.x}, ${e.pos.y})`;
    case "unitJoined":
      return `${unitName(e.targetId)} absorbed a unit, now ${displayHp(e.hp)} HP${e.refund > 0 ? `, refund ${e.refund.toLocaleString("en-US")}` : ""}`;
    case "fortAttacked": {
      const outcome = e.becomes ? `destroyed, now ${terrainName(e.becomes)}` : `${displayHp(e.hp)} HP left`;
      return `${unitName(e.attackerId)} hit the fortification at (${e.pos.x}, ${e.pos.y}) for ${e.attack.damage}% (luck ${e.attack.luck}): ${outcome}`;
    }
    case "unitOutOfFuel":
      return `${name(e.owner)} ${unitTypeName(e.unitType)} ran out of fuel and was lost`;
    case "captureProgress":
      return `${unitName(e.unitId)} is capturing (${e.pos.x}, ${e.pos.y}): ${e.capturePoints} left`;
    case "propertyCaptured":
      return `${name(e.player)} captured (${e.pos.x}, ${e.pos.y})${e.previousOwner === null ? "" : ` from ${name(e.previousOwner)}`}`;
    case "unitBuilt":
      return `${name(e.owner)} built ${unitTypeName(e.unitType)} for ${e.cost.toLocaleString("en-US")}`;
    case "incomeReceived":
      return `${name(e.player)} earned ${e.amount.toLocaleString("en-US")} (funds ${e.funds.toLocaleString("en-US")})`;
    case "unitRepaired":
      return `${unitName(e.unitId)} repaired +${e.hp} HP for ${e.cost.toLocaleString("en-US")}`;
    case "unitResupplied":
      return `${unitName(e.unitId)} resupplied`;
    case "unitDived":
      return `${unitName(e.unitId)} dived`;
    case "unitSurfaced":
      return `${unitName(e.unitId)} surfaced`;
    case "playerDefeated":
      return `${name(e.player)} is out (${OUT_TEXT[e.reason]})`;
    case "gameOver":
      return `Game over: ${e.result.winners.map(name).join(" and ")} won`;
    case "turnEnded":
      return `${name(e.player)} ended their turn`;
    case "dayStarted":
      return `Day ${e.day} begins`;
    case "weatherChanged":
      return `The weather turns to ${weatherName(e.weather)}`;
    case "turnStarted":
      return `Turn: ${name(e.player)} (day ${e.day})`;
  }
}
