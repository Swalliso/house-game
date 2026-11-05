// The greedy bot (§8): the placement with the best exact scoreOnly() total this week.
//
// It ranks every legal placement by the rules' cheap local estimate and scores only the best
// few exactly (§4, Performance): the top TOP_K overall, the top PER_CARD of each card, and the
// top SET_HINTS of those that might complete a set, since sets move the week's Mult. Ties go
// to a random one of the best, from the seeded stream, so houses vary between runs.
//
// When even the best placement wouldn't raise this week's total, it rerolls if it can, and
// passes rather than lose score. It never demolishes or completes early (the early-completion
// bots come in M6).

import type { Action, PlaceAction, Rng, Rules, RunState } from '../../src/rules/index.ts';

export const TOP_K = 12;
const PER_CARD = 2;
const SET_HINTS = 4;

/** The plays worth scoring exactly, by the cheap estimate. */
export function shortlist(
  rules: Rules,
  state: RunState,
  plays: readonly PlaceAction[],
): PlaceAction[] {
  const ranked = plays
    .map((play, k) => ({ play, k, est: rules.estimatePlay(state, play) }))
    .sort((a, b) => b.est.delta - a.est.delta || a.k - b.k);
  const chosen = new Set<number>();
  ranked.slice(0, TOP_K).forEach((r) => chosen.add(r.k));
  const perCard = new Map<number, number>();
  let hints = 0;
  for (const r of ranked) {
    const n = perCard.get(r.play.i) ?? 0;
    if (n < PER_CARD) {
      perCard.set(r.play.i, n + 1);
      chosen.add(r.k);
    }
    if (r.est.setHint && hints < SET_HINTS) {
      hints++;
      chosen.add(r.k);
    }
  }
  return ranked.filter((r) => chosen.has(r.k)).map((r) => r.play);
}

export const greedy = {
  name: 'greedy',
  act(rules: Rules, state: RunState, rng: Rng): Action {
    const plays = rules.legalPlacements(state);
    const passTotal = rules.scoreOnly(state, null);
    let best: PlaceAction[] = [];
    let bestTotal = -Infinity;
    for (const play of shortlist(rules, state, plays)) {
      const total = rules.scoreOnly(state, play);
      if (total > bestTotal) {
        bestTotal = total;
        best = [play];
      } else if (total === bestTotal) best.push(play);
    }
    if (best.length === 0 || bestTotal <= passTotal) {
      if (rules.canReroll(state).ok) return { t: 'reroll' };
      if (best.length === 0 || bestTotal < passTotal) return { t: 'pass' };
    }
    return rng.pick(best);
  },
};
