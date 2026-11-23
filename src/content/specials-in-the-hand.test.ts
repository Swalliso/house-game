// D-200 on the real content: special pieces in the hand (the backlog's S32, stage 1). The
// Henhouse and the Library are dealt from Framing at half a card's weight, and stay special
// pieces: the shop's, the Showroom's and the Catalog's, and the Henhouse the wrong delivery's
// (D-188). Before Framing the draw is what it was, a client's or crew's weight (Vladislav's
// Library, the Architect's four) dealing them from week 1 as it always has.

import { describe, expect, it } from 'vitest';
import type { Content, Modifier, PieceId, RunState } from '../rules/index.ts';
import { rules } from '../rules/index.ts';
import { perHouseLimits, typesAtLimit } from '../rules/conditions.ts';
import { drawableTypes, drawWeights } from '../rules/draw.ts';
import { computeLayout } from '../rules/layout.ts';
import { crateOptions, stockGoods } from '../rules/shop.ts';
import { drawRows, emptyRows, houseFrom } from '../rules/testing.ts';
import { CONTENT, validateContent } from './index.ts';

const SPECIAL = [
  'playroom',
  'library',
  'mudroom',
  'pool',
  'hotTub',
  'henhouse',
] as const satisfies readonly PieceId[];
const DEALT = ['library', 'henhouse'] as const satisfies readonly PieceId[];
const FRAMING = 2;
const PHASES = CONTENT.balance.phases.length;

/** The content as it was before D-200: the Henhouse and the Library at weight 0, from week 1. */
const BEFORE: Content = {
  ...CONTENT,
  pieces: {
    ...CONTENT.pieces,
    library: { ...CONTENT.pieces.library, drawWeight: 0, fromPhase: 0 },
    henhouse: { ...CONTENT.pieces.henhouse, drawWeight: 0, fromPhase: 0 },
  },
};

/** Every Core client's and crew's draw modifiers, in pairs. */
const RUNS: { label: string; mods: Modifier[] }[] = Object.values(CONTENT.clients)
  .filter((c) => c.tier === 'core')
  .flatMap((client) =>
    Object.values(CONTENT.crews)
      .filter((k) => k.tier === 'core')
      .map((crew) => ({
        label: `${client.id} with the ${crew.id}`,
        mods: [...client.pool, ...crew.modifiers],
      })),
  );

const weightOf = (pool: ReturnType<typeof drawWeights>, id: PieceId) =>
  pool.find((w) => w.card.kind === 'piece' && w.card.id === id)?.weight ?? 0;

const start = (seed: string): RunState =>
  rules.newRun({ seed, clientId: 'hendersons', crewId: 'generalContractor', mode: 'standard' });

describe('special pieces in the hand (D-200)', () => {
  it('flags the six special pieces, and deals the Henhouse and the Library from Framing at 5', () => {
    const flagged = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
      (id) => CONTENT.pieces[id].special,
    );
    expect(flagged.sort()).toEqual([...SPECIAL].sort());
    expect(CONTENT.balance.phases[FRAMING]!.name).toBe('Framing');
    for (const id of SPECIAL) {
      const def = CONTENT.pieces[id];
      const dealt = (DEALT as readonly PieceId[]).includes(id);
      expect(def.drawWeight, id).toBe(dealt ? 5 : 0);
      expect(def.fromPhase, id).toBe(dealt ? FRAMING : 0);
    }
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('catches a special piece that is a member’s room or the Addition', () => {
    const broken: Content = {
      ...CONTENT,
      pieces: {
        ...CONTENT.pieces,
        ivysRoom: { ...CONTENT.pieces.ivysRoom, special: true },
        addition: { ...CONTENT.pieces.addition, special: true },
      },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toContain("piece ivysRoom: a member's room or an Addition is never a special");
    expect(problems).toContain("piece addition: a member's room or an Addition is never a special");
  });

  it('the weekly draw deals the Henhouse and the Library from Framing, and not before', () => {
    for (let phase = 0; phase < PHASES; phase++) {
      const rooms = drawWeights(CONTENT, phase, { row: 'rooms' });
      const layout = drawWeights(CONTENT, phase, { row: 'layout', lotCardsFull: true });
      const dealt = phase >= FRAMING;
      // Complexity 1, so the Library is never ramped down; the Henhouse is a lot card, at full
      // weight in a standard run (D-166). Weights are in hundredths.
      expect(weightOf(rooms, 'library'), `the Library in milestone ${phase + 1}`).toBe(
        dealt ? 500 : 0,
      );
      expect(weightOf(layout, 'henhouse'), `the Henhouse in milestone ${phase + 1}`).toBe(
        dealt ? 500 : 0,
      );
      expect(weightOf(layout, 'library')).toBe(0);
      expect(weightOf(rooms, 'henhouse')).toBe(0);
      // The other four never come up but at a client's or crew's weight.
      const all = drawWeights(CONTENT, phase).map((w) => w.card.id);
      for (const id of ['playroom', 'mudroom', 'pool', 'hotTub']) expect(all).not.toContain(id);
    }
    // A first job keeps D-055's ramp for the Henhouse (complexity 2: 85% at Framing).
    expect(weightOf(drawWeights(CONTENT, FRAMING, { row: 'layout' }), 'henhouse')).toBe(425);
  });

  it('deals them now and then: a Framing hand holds one about one week in six', () => {
    const N = 1000;
    let holding = 0;
    for (let k = 0; k < N; k++) {
      const hand = drawRows(CONTENT, `s32-${k}`, FRAMING, '1', 0, { lotCardsFull: true });
      if (hand.some((c) => c.kind === 'piece' && (DEALT as readonly string[]).includes(c.id))) {
        holding++;
      }
    }
    expect(holding / N).toBeGreaterThan(0.12);
    expect(holding / N).toBeLessThan(0.28);
  });

  it('before Framing, every client’s and crew’s draw is what it was; from Framing, only theirs changes', () => {
    for (const { label, mods } of RUNS) {
      for (let phase = 0; phase < PHASES; phase++) {
        for (const lotCardsFull of [true, false]) {
          const now = drawWeights(CONTENT, phase, { mods, lotCardsFull });
          const was = drawWeights(BEFORE, phase, { mods, lotCardsFull });
          const at = `${label}, milestone ${phase + 1}`;
          if (phase < FRAMING) {
            expect(now, at).toEqual(was);
            continue;
          }
          const others = (pool: typeof now) =>
            pool.filter((w) => !(DEALT as readonly string[]).includes(w.card.id));
          expect(others(now), at).toEqual(others(was));
          for (const id of DEALT) expect(weightOf(now, id), at).toBeGreaterThan(weightOf(was, id));
        }
      }
    }
  });

  it('a client’s or crew’s weight still deals the Library from week 1, and adds to it from Framing', () => {
    const vladislav = CONTENT.clients.vladislav.pool;
    const architect = CONTENT.crews.architect.modifiers;
    const library = (phase: number, mods: readonly Modifier[]) =>
      weightOf(drawWeights(CONTENT, phase, { mods, row: 'rooms' }), 'library');
    expect(library(0, vladislav)).toBe(2000); // +20, as before D-200
    expect(library(FRAMING, vladislav)).toBe(2500); // and the Library's own 5
    expect(library(0, architect)).toBe(500); // +5, as before
    expect(library(FRAMING, architect)).toBe(1000);
    // The Architect's other three are still dealt only by the Architect.
    expect(weightOf(drawWeights(CONTENT, 0, { mods: architect }), 'playroom')).toBeGreaterThan(0);
    expect(weightOf(drawWeights(CONTENT, FRAMING), 'playroom')).toBe(0);
  });

  it('a Library at its one-a-house limit draws at half weight, and its card renovates the Library', () => {
    const house = houseFrom(CONTENT, emptyRows(16, 16), [['library', 2, 2]]);
    const atLimit = typesAtLimit(perHouseLimits(CONTENT, computeLayout(CONTENT, house)));
    expect([...atLimit]).toContain('library');
    expect(CONTENT.balance.drawAtLimitPct).toBe(50);
    const pool = drawWeights(CONTENT, FRAMING, { row: 'rooms', atLimit });
    expect(weightOf(pool, 'library')).toBe(250);
    // The house's one Library takes a Library card as a Renovation (D-102, D-165).
    const s0 = start('s32-renovate');
    const s: RunState = {
      ...s0,
      phase: FRAMING,
      house,
      hand: [{ kind: 'piece', id: 'library' }, ...s0.hand.slice(1)],
    };
    expect(rules.renovateTargets(s, 'hand', 0)).toEqual([house.pieces[0]!.uid]);
  });

  it('the Catalog’s draw is unchanged: the six special pieces in every milestone, at equal weight', () => {
    for (let phase = 0; phase < PHASES; phase++) {
      const now = drawWeights(CONTENT, phase, { special: true });
      expect(now).toEqual(drawWeights(BEFORE, phase, { special: true }));
      const pieces = now.filter((w) => w.card.kind === 'piece');
      expect(pieces.map((w) => w.card.id).sort()).toEqual([...SPECIAL].sort());
      expect(new Set(pieces.map((w) => w.weight))).toEqual(new Set([100]));
    }
  });

  it('a strike can name them in any run: they’re in the base pool now (D-157)', () => {
    const types = (row: 'rooms' | 'layout') => drawableTypes(CONTENT, [], row).map((t) => t.id);
    expect(types('rooms')).toContain('library');
    expect(types('layout')).toContain('henhouse');
    expect(types('rooms')).not.toContain('playroom');
    expect(drawableTypes(BEFORE, [], 'rooms').map((t) => t.id)).not.toContain('library');
  });

  it('the shelves and the Showroom still stock all six, as before', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 120; k++) {
      const s = start(`s32-shelf-${k}`);
      for (let shop = 1; shop < PHASES; shop++) {
        const now = stockGoods(CONTENT, s, shop, 0);
        expect(now, `${s.setup.seed}, shop ${shop}`).toEqual(stockGoods(BEFORE, s, shop, 0));
        for (const o of now) if (o.kind === 'piece') seen.add(o.id);
      }
      const showroom = crateOptions(CONTENT, s, 'showroom', `s32/${k}`);
      expect(showroom).toEqual(crateOptions(BEFORE, s, 'showroom', `s32/${k}`));
      for (const o of showroom) {
        expect(o.kind).toBe('piece');
        if (o.kind === 'piece') seen.add(`showroom:${o.id}`);
      }
    }
    for (const id of SPECIAL) {
      expect(seen.has(id), `${id} on a shelf`).toBe(true);
      expect(seen.has(`showroom:${id}`), `${id} in the Showroom`).toBe(true);
    }
  });
});
