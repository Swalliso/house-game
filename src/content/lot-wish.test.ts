// D-205 on the real content: the lot's wish (S17). The Pond's, where the lot has one: three Green
// pieces touching it bring a Hot Tub to Your goods. Otherwise the Old Shed's: two of the
// Greenhouse, the Garage and the Herb Garden touching it bring a Henhouse. Once a run, free to
// build; a first job carries none, and an Old Shed demolished first takes its wish with it. The
// numbers follow features.ts and balance.ts; src/rules/lot-wish.test.ts holds the rule on the
// test content.

import { describe, expect, it } from 'vitest';
import type { Content, PieceId, PlaceAction, Rot, RunMode, RunState } from '../rules/index.ts';
import { lotWishText, rewardText, rules } from '../rules/index.ts';
import { inExtraSlot } from '../rules/shop.ts';
import { CONTENT, validateContent } from './index.ts';

const start = (seed: string, mode: RunMode = 'standard') =>
  rules.newRun({ seed, clientId: 'hendersons', crewId: 'generalContractor', mode });

/** The pull request's ?seed= checks: a lot with a Pond, and one with an Old Shed and none. */
const POND_SEED = 'oak';
const SHED_SEED = 'fir';

/** Puts `id` in Your goods (the debug panel's way) and builds it touching the wish's feature. */
function buildBeside(s: RunState, id: PieceId) {
  const given = rules.apply(s, { t: 'debug', op: 'giveGood', good: { kind: 'piece', id } }).state;
  const i = given.reserve.findLastIndex((r) => r.id === id);
  const view = rules.lotWish(given)!;
  const xs = view.cells.map((c) => c.x);
  const ys = view.cells.map((c) => c.y);
  for (let y = Math.min(...ys) - 3; y <= Math.max(...ys) + 1; y++) {
    for (let x = Math.min(...xs) - 3; x <= Math.max(...xs) + 1; x++) {
      for (const rot of [0, 1] as Rot[]) {
        const play: PlaceAction = { t: 'place', from: 'reserve', i, x, y, rot };
        if (!rules.checkPlay(given, play).legal) continue;
        if (rules.lotWish(given, play)!.counted.length > view.counted.length) {
          return rules.apply(given, play);
        }
      }
    }
  }
  throw new Error(`nowhere beside the ${view.feature} for a ${id}`);
}

/** The first legal placement of the reserve's card `i`, in reading order. */
function anywhere(s: RunState, i: number): PlaceAction {
  for (let y = 0; y < s.house.lot.height; y++) {
    for (let x = 0; x < s.house.lot.width; x++) {
      const play: PlaceAction = { t: 'place', from: 'reserve', i, x, y, rot: 0 };
      if (rules.checkPlay(s, play).legal) return play;
    }
  }
  throw new Error(`nowhere for the reserve's card ${i}`);
}

describe('the lot’s wish (D-205)', () => {
  it('is the Pond’s, else the Old Shed’s, each paying a shop-only piece', () => {
    expect(CONTENT.balance.lotWish).toEqual(['pond', 'oldShed']);
    expect(CONTENT.features.pond.wish).toEqual({
      count: { tag: 'Green' },
      need: 3,
      reward: { piece: 'hotTub' },
    });
    expect(CONTENT.features.oldShed.wish).toEqual({
      count: { piece: ['greenhouse', 'garage', 'herbGarden'] },
      need: 2,
      reward: { piece: 'henhouse' },
    });
    for (const id of ['hotTub', 'henhouse'] as const) {
      expect(CONTENT.pieces[id].special, id).toBe(true);
    }
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('reads the lot alone: the Pond where there is one, else the Old Shed, never a first job', () => {
    const seen = { pond: 0, oldShed: 0 };
    for (let k = 0; k < 40; k++) {
      const s = start(`check-${k}`);
      const has = new Set(s.house.lot.terrain);
      const want = has.has('pond') ? 'pond' : has.has('oldShed') ? 'oldShed' : null;
      const view = rules.lotWish(s);
      expect(view?.feature ?? null, `check-${k}`).toBe(want);
      if (view) seen[view.feature as keyof typeof seen]++;
      // The same lot as a first job: none.
      expect(rules.lotWish(start(`check-${k}`, 'firstJob'))).toBeNull();
    }
    // Both kinds turn up in forty lots.
    expect(seen.pond).toBeGreaterThan(0);
    expect(seen.oldShed).toBeGreaterThan(0);
  });

  it('says what it wants, what it gives and how far along it is', () => {
    expect(rewardText(CONTENT, { piece: 'hotTub' })).toBe('A Hot Tub');
    const pond = rules.lotWish(start(POND_SEED))!;
    expect(lotWishText(CONTENT, pond)).toBe(
      'Wants company: 3 Green pieces touching it, for a Hot Tub in Your goods (none yet).',
    );
    const shed = rules.lotWish(start(SHED_SEED))!;
    expect(lotWishText(CONTENT, shed)).toBe(
      'Wants company: 2 Greenhouses, Garages, or Herb Gardens touching it, for a Henhouse in Your goods (none yet).',
    );
    expect(lotWishText(CONTENT, { ...shed, counted: [7] })).toContain('(1 so far)');
    expect(lotWishText(CONTENT, { ...pond, filled: true })).toBe(
      'Kept company: it gave you a Hot Tub.',
    );
  });

  it('fills the Pond’s with three Green pieces: a Hot Tub, once, in an extra slot', () => {
    let s = start(POND_SEED);
    const kinds: PieceId[] = ['flowerBed', 'herbGarden', 'lawn'];
    for (const [k, id] of kinds.entries()) {
      const out = buildBeside(s, id);
      const filled = out.events.filter((e) => e.t === 'wishFilled');
      expect(filled, id).toHaveLength(k === 2 ? 1 : 0);
      s = out.state;
    }
    expect(s).toMatchObject({ week: 1, wishFilled: 'pond' });
    const prize = s.reserve.find((r) => r.wish)!;
    expect(prize).toEqual({ id: 'hotTub', wish: true });
    expect(inExtraSlot(prize)).toBe(true);
    // Building the prize pays nothing more: free, and the week goes on (D-163).
    const i = s.reserve.indexOf(prize);
    const built = rules.apply(s, anywhere(s, i));
    expect(built.events.some((e) => e.t === 'wishFilled')).toBe(false);
    expect(built.state).toMatchObject({ week: 1, wishFilled: 'pond' });
    expect(built.state.reserve.some((r) => r.wish)).toBe(false);
  });

  it('fills the Old Shed’s with two of the pieces that use a shed: a Henhouse', () => {
    const once = buildBeside(start(SHED_SEED), 'greenhouse');
    expect(once.events.some((e) => e.t === 'wishFilled')).toBe(false);
    const twice = buildBeside(once.state, 'herbGarden');
    const filled = twice.events.find((e) => e.t === 'wishFilled');
    expect(filled).toMatchObject({ feature: 'oldShed', reward: { piece: 'henhouse' } });
    expect(twice.state.reserve.find((r) => r.wish)).toEqual({ id: 'henhouse', wish: true });
  });

  it('ends with the Old Shed demolished first; its tool still pays', () => {
    const s = start(SHED_SEED);
    const at = rules.lotWish(s)!.cells[0]!;
    expect(rules.previewDemolish(s, at.x, at.y)).toMatchObject({ legal: true, endsWish: true });
    const out = rules.apply(s, { t: 'demolish', x: at.x, y: at.y });
    expect(out.events.map((e) => e.t)).toContain('findClaimed');
    expect(rules.lotWish(out.state)).toBeNull();
  });

  it('catches a wish’s mistakes', () => {
    const broken: Content = {
      ...CONTENT,
      features: {
        ...CONTENT.features,
        // A Tree is a tile among fifty, not one body; a Bedroom is no shop piece.
        tree: {
          ...CONTENT.features.tree,
          wish: { count: 'all', need: 1, reward: { piece: 'hotTub' } },
        },
        pond: {
          ...CONTENT.features.pond,
          wish: { count: { tag: 'Green' }, need: 0, reward: { piece: 'bedroom' } },
        },
        // A find pays no piece.
        timeCapsule: { ...CONTENT.features.timeCapsule, reward: { piece: 'hotTub' } },
      },
      balance: { ...CONTENT.balance, lotWish: ['pond', 'pond', 'creek'] },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toMatch(/tree.*wish/i);
    expect(problems).toMatch(/pond.*need/i);
    expect(problems).toMatch(/bedroom/i);
    expect(problems).toMatch(/timeCapsule.*piece/i);
    expect(problems).toMatch(/lotWish: pond twice/);
    expect(problems).toMatch(/lotWish.*creek/i);
  });
});
