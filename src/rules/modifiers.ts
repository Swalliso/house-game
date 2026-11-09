// Rule benders (implementation-plan.md §5). A run's modifiers come from its crew, its client's
// tastes and pool (M4a), its blueprints, its company upgrades, this week's tools, and (M4b) a
// change order's phase effect while its phase runs; fixtures carry their own, on their host,
// and are gathered from the house when it's tallied (scoring.ts).
//
// `rule` modifiers change run-level numbers: (base + Σ add) × (100 + Σ pct) / 100, rounded half
// up, never below 0. The layout kinds (grantTag, removeTag, grantView, countsAs, link) change
// the layout (layout.ts); every other kind changes the tally (scoring.ts).

import type {
  ChangeOrderId,
  Content,
  ModSource,
  Modifier,
  RuleKey,
  RunSetup,
  RunState,
  TimedEffect,
  ToolId,
} from './index.ts';
import { roundHalfUp } from './scoring.ts';

/**
 * Where a timed effect came from: a tool's lasts until a week (this week's tally), a change
 * order's phase effect until a phase (M4b).
 */
export function timedSource(effect: TimedEffect): ModSource {
  return 'week' in effect.until
    ? { kind: 'tool', id: effect.source as ToolId }
    : { kind: 'changeOrder', id: effect.source as ChangeOrderId };
}

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
export type ModState = Pick<RunState, 'setup' | 'blueprints'> &
  Partial<Pick<RunState, 'upgrades' | 'timedEffects'>>;

/**
 * Every run-level modifier: the crew's, the client's tastes and pool (M4a), each blueprint's in
 * the order bought, each company upgrade's, then the timed effects': this week's tools', and a
 * running phase effect's (M4b).
 */
export function runModifiers(content: Content, state: ModState): ActiveMod[] {
  const crew = content.crews[state.setup.crewId];
  if (!crew) throw new Error(`Unknown crew "${state.setup.crewId}"`);
  const out: ActiveMod[] = crew.modifiers.map((mod) => ({
    mod,
    source: { kind: 'crew', id: crew.id },
    since: 0,
  }));
  const client = content.clients[state.setup.clientId];
  if (!client) throw new Error(`Unknown client "${state.setup.clientId}"`);
  for (const mod of [...client.tastes, ...client.pool]) {
    out.push({ mod, source: { kind: 'client', id: client.id }, since: 0 });
  }
  for (const owned of state.blueprints) {
    const def = content.blueprints[owned.id];
    if (!def) throw new Error(`Unknown blueprint "${owned.id}"`);
    for (const mod of def.modifiers) {
      out.push({ mod, source: { kind: 'blueprint', id: def.id }, since: owned.boughtWeek });
    }
  }
  for (const id of state.upgrades ?? []) {
    const def = content.upgrades[id];
    if (!def) throw new Error(`Unknown upgrade "${id}"`);
    for (const mod of def.modifiers) out.push({ mod, source: { kind: 'upgrade', id }, since: 0 });
  }
  for (const effect of state.timedEffects ?? []) {
    const source = timedSource(effect);
    // A tool's granted timers count from its week; a phase effect's from placement.
    const since = 'week' in effect.until ? effect.until.week : 0;
    for (const mod of effect.modifiers) out.push({ mod, source, since });
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

/** A rule's value for a run's crew and client alone, as a new run starts. */
export function setupRule(
  content: Content,
  setup: Pick<RunSetup, 'crewId' | 'clientId'>,
  key: RuleKey,
): number {
  return ruleValue(
    content,
    { setup: { seed: '', mode: 'standard', ...setup }, blueprints: [] },
    key,
  );
}

/** The name of a modifier's source, for breakdown lines: "Feng Shui", "Fireplace". */
export function sourceName(content: Content, source: ModSource): string {
  switch (source.kind) {
    case 'crew':
      return content.crews[source.id].name;
    case 'client':
      return content.clients[source.id].name;
    case 'blueprint':
      return content.blueprints[source.id].name;
    case 'fixture':
      return content.fixtures[source.id].name;
    case 'upgrade':
      return content.upgrades[source.id].name;
    case 'tool':
      return content.tools[source.id].name;
    case 'changeOrder':
      return content.changeOrders[source.id].name;
  }
}
