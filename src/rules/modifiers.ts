// Run-level rule benders (implementation-plan.md §5). M2 has only the `rule` modifier, from
// crews: the General Contractor's extra reroll. Blueprints, upgrades, clients, and change
// orders add their own sources in M3 and M4.

import type { Content, CrewId, Modifier, RuleKey } from './index.ts';
import { roundHalfUp } from './scoring.ts';

/** Every modifier that applies to the run, from its crew (and later its blueprints and client). */
export function runModifiers(content: Content, crewId: CrewId): readonly Modifier[] {
  const crew = content.crews[crewId];
  if (!crew) throw new Error(`Unknown crew "${crewId}"`);
  return crew.modifiers;
}

/** A rule's value: (base + Σ add) × (100 + Σ pct) / 100, rounded half up, never below 0. */
export function ruleValue(content: Content, crewId: CrewId, key: RuleKey): number {
  let add = 0;
  let pct = 0;
  for (const m of runModifiers(content, crewId)) {
    if (m.kind !== 'rule' || m.key !== key) continue;
    add += m.add ?? 0;
    pct += m.pct ?? 0;
  }
  const base = Math.max(0, content.balance.rules[key] + add);
  return roundHalfUp(base * Math.max(0, 100 + pct), 100);
}
