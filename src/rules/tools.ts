// Tools (implementation-plan.md §5 Shop goods, Appendix A · M3b): one-shot free actions from
// the supplies, used only on the build screen. One small function per kind:
// - move (Moving Truck): a placed piece, fixture and all, to another legal spot; it can't
//   split the house, and keeps its uid, timers, and place in the placement order
// - copy (Copy Machine): a placed piece's card into the reserve (needs a free slot); never a
//   member's room (M4b)
// - weekModifiers (Rush Order, Open House Party): modifiers for this week's tally only
// - specialHand (Catalog): this hand redrawn from special pieces and fixtures, as a draw
//   (n + 1) that doesn't use a reroll
// - advanceTimers (Fertilizer): every piece's ageBonus goes up
// - reward (Dumpster), levelSet (Remodel Plans: +1 level for a set type, for the run)
// - extraPlay (Weekend Crew, D-075/D-083): this week's next play doesn't end the week; one a week

import type {
  Availability,
  Card,
  Content,
  GameEvent,
  HouseState,
  Legality,
  Reward,
  RunState,
  ToolDef,
  UseToolAction,
} from './index.ts';
import type { Layout } from './layout.ts';
import type { PlacementCheck } from './placement.ts';
import { reserveUsed, SHOP_REASONS, slotsFor } from './shop.ts';

/** What the tools need from the run's rules. */
export interface ToolCtx {
  content: Content;
  layoutFor(state: RunState, house?: HouseState): Layout;
  checkMove(state: RunState, action: UseToolAction): PlacementCheck;
  drawSpecial(state: RunState): Card[];
  payReward(state: RunState, reward: Reward, key: string, events: GameEvent[]): RunState;
  /** `lot` is the lot before the play, which still has the finds on it. */
  payFinds(
    state: RunState,
    finds: Legality['finds'],
    events: GameEvent[],
    lot: HouseState['lot'],
  ): RunState;
}

export function toolAt(content: Content, state: RunState, i: number): ToolDef | null {
  const s = Number.isInteger(i) ? state.supplies[i] : undefined;
  return s?.kind === 'tool' ? content.tools[s.id] : null;
}

/** Whether a tool can be used now, with this target. */
export function canUseTool(ctx: ToolCtx, state: RunState, action: UseToolAction): Availability {
  if (state.screen !== 'build') return { ok: false, reason: 'Tools are used while building.' };
  const def = toolAt(ctx.content, state, action.i);
  if (!def) return { ok: false, reason: 'There’s no tool there.' };
  const uid = action.target?.uid;
  switch (def.use.kind) {
    case 'move': {
      if (uid === undefined) return { ok: false, reason: 'Pick a piece to move.' };
      const check = ctx.checkMove(state, action);
      return check.legal ? { ok: true } : { ok: false, reason: check.reason };
    }
    case 'copy': {
      const piece = uid === undefined ? undefined : state.house.pieces.find((p) => p.uid === uid);
      if (!piece) return { ok: false, reason: 'Pick a piece to copy.' };
      // M4b: a member's room is theirs alone (one per arrival, D-103).
      if (ctx.content.pieces[piece.defId].member) {
        return { ok: false, reason: 'A household member’s room can’t be copied.' };
      }
      if (reserveUsed(state) >= slotsFor(ctx.content, state).reserve) {
        return { ok: false, reason: SHOP_REASONS.reserveFull };
      }
      return { ok: true };
    }
    case 'specialHand':
      return state.hand.length > 0
        ? { ok: true }
        : { ok: false, reason: 'There’s no hand to redraw.' };
    case 'extraPlay':
      return state.freePlay === 'none'
        ? { ok: true }
        : { ok: false, reason: 'A Weekend Crew already worked this week.' };
    case 'levelSet':
      return Object.hasOwn(ctx.content.sets, def.use.set)
        ? { ok: true }
        : { ok: false, reason: 'That set isn’t in the game yet.' };
    case 'weekModifiers':
    case 'advanceTimers':
    case 'reward':
      return { ok: true };
  }
}

/** Uses the tool (already checked legal): its effect, then it leaves the supplies. */
export function useTool(
  ctx: ToolCtx,
  state: RunState,
  action: UseToolAction,
  events: GameEvent[],
): RunState {
  const def = toolAt(ctx.content, state, action.i)!;
  const uid = action.target?.uid;
  let s: RunState = { ...state, supplies: state.supplies.filter((_, k) => k !== action.i) };
  const used: Extract<GameEvent, { t: 'toolUsed' }> = { t: 'toolUsed', tool: def.id };
  switch (def.use.kind) {
    case 'move': {
      const check = ctx.checkMove(state, action);
      const from = ctx.layoutFor(state).cells.get(uid!) ?? [];
      events.push({ ...used, uid });
      events.push({
        t: 'moved',
        uid: uid!,
        defId: state.house.pieces.find((p) => p.uid === uid)!.defId,
        from,
        cells: check.cells,
        clearedTrees: check.clearedTrees,
      });
      s = { ...s, house: check.house! };
      return ctx.payFinds(s, check.finds, events, state.house.lot);
    }
    case 'copy': {
      const piece = state.house.pieces.find((p) => p.uid === uid)!;
      events.push({ ...used, uid });
      return { ...s, reserve: [...s.reserve, { id: piece.defId }] };
    }
    case 'weekModifiers':
      events.push(used);
      return {
        ...s,
        timedEffects: [
          ...s.timedEffects,
          { source: def.id, until: { week: s.week }, modifiers: def.use.modifiers },
        ],
      };
    case 'specialHand': {
      events.push(used);
      const hand = ctx.drawSpecial(s);
      events.push({
        t: 'handDrawn',
        phase: s.phase,
        slot: s.slot,
        overtimeWeek: s.overtimeWeek,
        hand,
        free: false,
        reroll: false,
        special: true,
      });
      return { ...s, hand, draws: s.draws + 1 };
    }
    case 'advanceTimers': {
      events.push(used);
      const weeks = def.use.weeks;
      return {
        ...s,
        house: {
          ...s.house,
          pieces: s.house.pieces.map((p) => ({ ...p, ageBonus: (p.ageBonus ?? 0) + weeks })),
        },
      };
    }
    case 'reward':
      events.push(used);
      return ctx.payReward(s, def.use.reward, `tool/${s.week}/${s.draws}/${action.i}`, events);
    case 'levelSet': {
      events.push(used);
      const set = def.use.set;
      return { ...s, setLevels: { ...s.setLevels, [set]: (s.setLevels[set] ?? 1) + 1 } };
    }
    case 'extraPlay':
      events.push(used);
      return { ...s, freePlay: 'ready' };
  }
}
