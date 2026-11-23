// D-209 (S26) on the real content: the three slot upgrades bring something. The Storage Unit
// brings a special piece the house doesn't have yet at each milestone's start, the Tool Belt a
// Common tool, and the Drafting Table opens a pick of three Common blueprints as it's bought.
// Their cards say so. src/rules/upgrade-deliveries.test.ts holds the rules on the test content.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Content,
  GameEvent,
  PieceId,
  RunState,
  ToolId,
  UpgradeDef,
  UpgradeId,
} from '../rules/index.ts';
import { rules, upgradeText } from '../rules/index.ts';
import { CONTENT, validateContent } from './index.ts';

const start = (seed: string) =>
  rules.newRun({ seed, clientId: 'hendersons', crewId: 'landscaper', mode: 'standard' });

/** The next step of a run that only passes: shops left, change orders answered, targets met by a cheat. */
function passOn(s: RunState): Action {
  if (s.screen === 'shop') return s.offers?.pick ? { t: 'pick', i: -1 } : { t: 'leaveShop' };
  if (s.screen === 'changeOrder') return { t: 'answerChangeOrder', i: 0 };
  if (s.score < rules.target(s)) return { t: 'debug', op: 'addScore', amount: rules.target(s) };
  return { t: 'pass' };
}

/** A run with these upgrades from week 1, passed to its end; each step's events. */
function walk(seed: string, ids: readonly UpgradeId[]): { state: RunState; events: GameEvent[] } {
  let s = start(seed);
  for (const id of ids) {
    s = rules.apply(s, { t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id } }).state;
  }
  const events: GameEvent[] = [];
  for (let k = 0; k < 2000 && s.screen !== 'won' && s.screen !== 'lost'; k++) {
    const out = rules.apply(s, passOn(s));
    events.push(...out.events);
    s = out.state;
  }
  return { state: s, events };
}

const SPECIALS = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
  (id) => CONTENT.pieces[id]!.special,
);

describe('the slot upgrades bring something (D-209)', () => {
  it('each card says what it brings', () => {
    expect(upgradeText(CONTENT, CONTENT.upgrades.storageUnit)).toEqual([
      '+1 reserve slot',
      'A special piece arrives each milestone',
      'Permanent for the run',
    ]);
    expect(upgradeText(CONTENT, CONTENT.upgrades.toolBelt)).toEqual([
      '+1 supply slot',
      'A Common tool arrives each milestone',
      'Permanent for the run',
    ]);
    expect(upgradeText(CONTENT, CONTENT.upgrades.draftingTable)).toEqual([
      '+1 blueprint slot',
      'Pick 1 of 3 Common blueprints as you buy it',
      'Permanent for the run',
    ]);
    // The other four bring nothing but their rule.
    const others = (Object.keys(CONTENT.upgrades) as UpgradeId[]).filter(
      (id) => !['storageUnit', 'toolBelt', 'draftingTable'].includes(id),
    );
    for (const id of others) expect(CONTENT.upgrades[id].delivers, id).toBeUndefined();
    // Their prices stand (S26 leaves them).
    expect(CONTENT.upgrades.storageUnit.price).toBe(6);
    expect(CONTENT.upgrades.toolBelt.price).toBe(6);
    expect(CONTENT.upgrades.draftingTable.price).toBe(7);
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('catches a delivery with nothing to draw on, and a pick with no slot of its own', () => {
    const up = (patch: Partial<UpgradeDef>): Content => ({
      ...CONTENT,
      upgrades: { ...CONTENT.upgrades, foreman: { ...CONTENT.upgrades.foreman, ...patch } },
    });
    expect(validateContent(up({ delivers: { kind: 'tool', rarity: 'rare' } }))).toEqual([]);
    const noRareTools: Content = {
      ...up({ delivers: { kind: 'tool', rarity: 'rare' } }),
      tools: Object.fromEntries(
        Object.entries(CONTENT.tools).map(([k, t]) => [k, { ...t, offered: t.rarity !== 'rare' }]),
      ) as Content['tools'],
    };
    expect(validateContent(noRareTools)).toContain(
      'upgrade foreman: no offered rare tool to deliver',
    );
    expect(
      validateContent(up({ delivers: { kind: 'blueprintPick', rarity: 'common', options: 0 } })),
    ).toEqual([
      'upgrade foreman: a pick needs options ≥ 1',
      'upgrade foreman: a blueprint pick needs the blueprint slot it fills',
    ]);
    const noSpecials: Content = {
      ...up({ delivers: { kind: 'specialPiece' } }),
      pieces: Object.fromEntries(
        Object.entries(CONTENT.pieces).map(([k, p]) => [k, { ...p, special: undefined }]),
      ) as Content['pieces'],
    };
    expect(validateContent(noSpecials)).toContain('upgrade foreman: no special piece to deliver');
  });

  it('the Storage Unit brings a different special piece each milestone, as Your goods’ extras', () => {
    for (const seed of ['oak', 'ash', 'elm', 'pine']) {
      const { state, events } = walk(seed, ['storageUnit']);
      expect(state.screen, seed).toBe('won');
      const brought = events.flatMap((e) =>
        e.t === 'delivered' && e.from === 'upgrade' ? e.cards : [],
      );
      // From the second milestone to the last: six, each the run's special pieces in turn, a
      // repeat only once every one is in the house or Your goods.
      expect(brought, seed).toHaveLength(CONTENT.balance.phases.length - 1);
      for (const id of brought) expect(SPECIALS, seed).toContain(id);
      const firstRepeat = brought.findIndex((id, k) => brought.indexOf(id) !== k);
      if (firstRepeat >= 0) {
        // Nothing builds here, so the wrong delivery's piece waits too: by then all six are in.
        const have = new Set([...state.reserve.map((r) => r.id)]);
        for (const id of SPECIALS) expect(have.has(id), `${seed}: ${id}`).toBe(true);
      }
      // A one-per-house room never comes twice.
      for (const id of ['playroom', 'library', 'mudroom'] as const) {
        expect(brought.filter((x) => x === id).length, `${seed}: ${id}`).toBeLessThanOrEqual(1);
      }
      expect(state.reserve.filter((r) => r.upgrade === 'storageUnit').map((r) => r.id)).toEqual(
        brought,
      );
    }
  });

  it('the Tool Belt brings a Common tool each milestone, and sells one the supplies can’t take', () => {
    const { state, events } = walk('oak', ['toolBelt']);
    const tools = events.filter(
      (e): e is Extract<GameEvent, { t: 'upgradeTool' }> => e.t === 'upgradeTool',
    );
    expect(tools).toHaveLength(CONTENT.balance.phases.length - 1);
    for (const e of tools) {
      expect(CONTENT.tools[e.tool as ToolId].rarity).toBe('common');
      expect(CONTENT.tools[e.tool as ToolId].offered).toBe(true);
    }
    // Nothing is used here: four fill the supplies (three slots and the belt's), then each is
    // sold at once for half its price.
    const kept = tools.filter((e) => e.sold === undefined);
    expect(kept).toHaveLength(4);
    expect(tools.slice(4).every((e) => e.sold === 1)).toBe(true);
    expect(state.supplies.map((x) => x.id)).toEqual(kept.map((e) => e.tool));
    // No two alike while one waits in the supplies.
    expect(new Set(kept.map((e) => e.tool)).size).toBe(4);
  });
});
