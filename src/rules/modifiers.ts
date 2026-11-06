// Rule benders (implementation-plan.md §5). A run's modifiers come from its crew, its
// blueprints, and (from M3b) its company upgrades and this week's tools; fixtures carry their
// own, on their host, and are gathered from the house when it's tallied (scoring.ts). Clients
// and change orders add theirs in M4.
//
// `rule` modifiers change run-level numbers: (base + Σ add) × (100 + Σ pct) / 100, rounded half
// up, never below 0. The layout kinds (grantTag, removeTag, grantView, countsAs, link) change
// the layout (layout.ts); every other kind changes the tally (scoring.ts).

import type { Content, CrewId, ModSource, Modifier, RuleKey, RunState } from './index.ts';
import { roundHalfUp } from './scoring.ts';

/** A modifier in play, with where it came from. */
export interface ActiveMod {
  mod: Modifier;
  source: ModSource;
  /** Granted effects' timers count from this week (a blueprint's purchase). */
  since: number;
  /** For a fixture's modifiers: the piece it's installed in. */
  host?: number;
}

/** Just what the run's modifiers depend on, so tests and the sim can build one cheaply. */
export type ModState = Pick<RunState, 'setup' | 'blueprints'>;

/** Every run-level modifier: the crew's, then each blueprint's in the order bought. */
export function runModifiers(content: Content, state: ModState): ActiveMod[] {
  const crew = content.crews[state.setup.crewId];
  if (!crew) throw new Error(`Unknown crew "${state.setup.crewId}"`);
  const out: ActiveMod[] = crew.modifiers.map((mod) => ({
    mod,
    source: { kind: 'crew', id: crew.id },
    since: 0,
  }));
  for (const owned of state.blueprints) {
    const def = content.blueprints[owned.id];
    if (!def) throw new Error(`Unknown blueprint "${owned.id}"`);
    for (const mod of def.modifiers) {
      out.push({ mod, source: { kind: 'blueprint', id: def.id }, since: owned.boughtWeek });
    }
  }
  return out;
}

/** A rule's value from a list of modifiers. */
export function ruleFrom(content: Content, mods: readonly ActiveMod[], key: RuleKey): number {
  let add = 0;
  let pct = 0;
  for (const { mod } of mods) {
    if (mod.kind !== 'rule' || mod.key !== key) continue;
    add += mod.add ?? 0;
    pct += mod.pct ?? 0;
  }
  const base = Math.max(0, content.balance.rules[key] + add);
  return roundHalfUp(base * Math.max(0, 100 + pct), 100);
}

/** A rule's value for a run, after its crew and blueprints (and, from M3b, its upgrades). */
export function ruleValue(content: Content, state: ModState, key: RuleKey): number {
  return ruleFrom(content, runModifiers(content, state), key);
}

/** A rule's value for a crew alone, as a new run starts. */
export function crewRule(content: Content, crewId: CrewId, key: RuleKey): number {
  return ruleValue(content, { setup: { seed: '', crewId, mode: 'standard' }, blueprints: [] }, key);
}

/** The name of a modifier's source, for breakdown lines: "Feng Shui", "Fireplace". */
export function sourceName(content: Content, source: ModSource): string {
  switch (source.kind) {
    case 'crew':
      return content.crews[source.id].name;
    case 'blueprint':
      return content.blueprints[source.id].name;
    case 'fixture':
      return content.fixtures[source.id].name;
  }
}
