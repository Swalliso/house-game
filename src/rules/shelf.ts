// The shelf stocks for the house (D-192). A good that can pay in the house as it stands counts
// `shop.relevantWeight` times in its pick, on a shelf or in a Fixture Crate, against 1 for one
// that can't yet, so a good that can't pay yet may still turn up and pay later. A blueprint
// whose `stockIf` fails (Waterfront on a lot without water) isn't stocked at all, nor offered
// in a crate.
//
// Whether a good can pay here:
// - a blueprint: its `stockIf` holds and, if it names the pieces it pays on (`paysOn`), one is
//   placed: Waterfront, once a piece touches the water. Every other blueprint, yes (its value
//   line, D-141, says what it's waiting for). Every lot has water today (D-119), so it's
//   `paysOn` that leans Waterfront's shelves, and `stockIf` that keeps it off any lot without;
// - Remodel Plans (a `levelSet` tool): the house holds its set now, or, for a set whose members
//   needn't touch (Full House), it's one member short or closer; any other tool, yes;
// - a fixture: some placed piece could take it now (the install check, supplies aside);
// - a special piece: its type isn't at a limit for the client (the checklist's ceilings and the
//   cards' per-house caps, as the draw reads them);
// - a crate or a company upgrade: yes.
// It's cheap on purpose: no placement search, and each answer is worked out once per stocking.

import type {
  BlueprintId,
  Content,
  Lot,
  PieceId,
  RunState,
  SetId,
  ShelfGood,
  StockIf,
  TypeLimit,
} from './index.ts';
import { perHouseLimits, typeLimits, typesAtLimit } from './conditions.ts';
import { checkInstall } from './fixtures.ts';
import { isLayoutModifier, layoutCache, NO_LAYOUT_MODS, type Layout } from './layout.ts';
import { runModifiers } from './modifiers.ts';
import { matchesPiece, rootType } from './selectors.ts';
import { matchSets, setProgress } from './sets.ts';

/** What a shop leans toward, for one stocking: read from the house as it stands. */
export interface Shelf {
  /** Whether the shop stocks this blueprint here at all: its `stockIf` holds. */
  stocks(id: BlueprintId): boolean;
  /** Whether a good could pay in the house as it stands. */
  canPay(good: ShelfGood): boolean;
  /** A good's weight in its pick: `relevantWeight` if it can pay here, else 1. */
  weight(good: ShelfGood): number;
}

/** Whether a lot meets a good's `stockIf`. No condition: anywhere. */
export function lotMeets(lot: Lot, cond: StockIf | undefined): boolean {
  if (!cond) return true;
  return lot.terrain.some((t) => t !== null && cond.lotHas.includes(t));
}

/** One layout cache per content, for a shelf read without the rules' own (tests, tools). */
const layouts = new WeakMap<Content, ReturnType<typeof layoutCache>>();

function layoutOfRun(content: Content, state: RunState): Layout {
  let of = layouts.get(content);
  if (!of) layouts.set(content, (of = layoutCache(content)));
  const mods = runModifiers(content, state)
    .map((a) => a.mod)
    .filter(isLayoutModifier);
  return of(state.house, mods.length > 0 ? mods : NO_LAYOUT_MODS);
}

/**
 * The shelf for a run's state. The rules pass their own layout and limits (the run's cached
 * ones); without them they're worked out here, the same way, when first asked for.
 */
export function shelfFor(
  content: Content,
  state: RunState,
  seen: { layout?: () => Layout; limits?: () => readonly TypeLimit[] } = {},
): Shelf {
  let layout: Layout | undefined;
  const layoutNow = () => (layout ??= seen.layout?.() ?? layoutOfRun(content, state));
  let full: ReadonlySet<PieceId> | undefined;
  const atLimit = () => {
    if (!full) {
      const limits =
        seen.limits?.() ??
        (() => {
          const l = layoutNow();
          const specs = content.clients[state.setup.clientId]?.specs ?? [];
          return [
            ...typeLimits(content, l, specs, { phase: state.phase }),
            ...perHouseLimits(content, l),
          ];
        })();
      full = typesAtLimit(limits);
    }
    return full;
  };

  const setInReach = (set: SetId): boolean => {
    const l = layoutNow();
    const progress = setProgress(content, l, set);
    if (progress) return progress.held || progress.have >= progress.need - 1;
    return matchSets(content, l).some((s) => s.set === set);
  };

  const answers = new Map<string, boolean>();
  const stocks = (id: BlueprintId) => lotMeets(state.house.lot, content.blueprints[id].stockIf);
  const canPay = (good: ShelfGood): boolean => {
    const key = `${good.kind}:${good.id}`;
    let yes = answers.get(key);
    if (yes !== undefined) return yes;
    switch (good.kind) {
      case 'blueprint': {
        const on = content.blueprints[good.id].paysOn;
        const l = on ? layoutNow() : null;
        yes =
          stocks(good.id) &&
          (!on || l!.house.pieces.some((p) => matchesPiece(content, l!, on, p.uid)));
        break;
      }
      case 'tool': {
        const use = content.tools[good.id].use;
        yes = use.kind === 'levelSet' ? setInReach(use.set) : true;
        break;
      }
      case 'fixture': {
        const l = layoutNow();
        yes = l.house.pieces.some((p) => checkInstall(content, l, good.id, p.uid).legal);
        break;
      }
      case 'piece':
        yes = !atLimit().has(rootType(content.pieces[good.id]));
        break;
      case 'crate':
      case 'upgrade':
        yes = true;
        break;
    }
    answers.set(key, yes);
    return yes;
  };
  const w = content.balance.shop.relevantWeight;
  // With the lean off, nothing is worked out but the blueprints' `stockIf`.
  const weight = w === 1 ? () => 1 : (good: ShelfGood) => (canPay(good) ? w : 1);
  return { stocks, canPay, weight };
}
