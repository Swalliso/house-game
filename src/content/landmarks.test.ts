// D-199 (S31): the landmarks. The Pool, the Library, the Henhouse and the Fountain reach every
// piece with a tile within 2 tiles of one of theirs, across or diagonally (a square around
// them), rooms and yard alike, touching or not. Their reach's percentages and points add as other
// auras' do (D-036, D-037), Soundproofing shields a room from a Loud landmark's penalty as from a
// Loud neighbor's, and the preview, the tally and the bot's estimate agree on all of it.

import { describe, expect, it } from 'vitest';
import type { Content, HouseState, PieceId, PlaceAction, RunState, Tally } from '../rules/index.ts';
import { cardText, glossary, rules } from '../rules/index.ts';
import { withFixture } from '../rules/fixtures.ts';
import { computeLayout } from '../rules/layout.ts';
import { tallyHouse } from '../rules/scoring.ts';
import { handCardLines, HAND_LINE_CHARS } from '../rules/text.ts';
import { emptyRows, houseFrom, type Placement } from '../rules/testing.ts';
import { CONTENT, validateContent } from './index.ts';

const open = emptyRows(10, 10);

function tallyOf(house: HouseState, week = 1): Tally {
  return tallyHouse(CONTENT, computeLayout(CONTENT, house), week, true);
}

const tally = (placements: readonly Placement[], week = 1) =>
  tallyOf(houseFrom(CONTENT, open, placements), week);

/** What each piece earns, in placement order. */
const earned = (placements: readonly Placement[], week = 1) =>
  tally(placements, week).pieces.map((p) => p.earned);

/** A piece's reach lines: "Pool within 2 tiles +25%". */
function reachLines(t: Tally, uid: number) {
  return t.pieces
    .find((p) => p.uid === uid)!
    .lines.filter((l) => l.label.includes('within'))
    .map((l) => [l.label, l.op, l.value]);
}

const LANDMARKS = ['pool', 'library', 'henhouse', 'fountain'] as const satisfies PieceId[];

describe('the landmarks’ reach (D-199)', () => {
  it('reaches 2 tiles, not 3: a Pool’s Social pieces earn +25%', () => {
    // A Patio below a Kitchen, two tiles from a Pool's east edge: the Patio's 2 at +25% is 2.5
    // and rounds up to 3, the Kitchen's 5 is 6.25, 6. The Pool earns nothing in week 1, and
    // nothing here is out back.
    const near = tally([
      ['pool', 0, 2],
      ['kitchen', 4, 0],
      ['patio', 4, 2],
    ]);
    expect(near.pieces.map((p) => p.earned)).toEqual([0, 6, 3]);
    expect(reachLines(near, 3)).toEqual([['Pool within 2 tiles', 'pct', 25]]);
    expect(near.pieces[2]!.lines).toContainEqual({
      label: 'Pool within 2 tiles',
      op: 'pct',
      value: 25,
      from: [{ kind: 'piece', uid: 1 }],
    });
    // One tile further: nothing.
    const far = tally([
      ['pool', 0, 2],
      ['kitchen', 5, 0],
      ['patio', 5, 2],
    ]);
    expect(far.pieces.map((p) => p.earned)).toEqual([0, 5, 2]);
    expect(reachLines(far, 2)).toEqual([]);
    expect(reachLines(far, 3)).toEqual([]);
  });

  it('adds up across landmarks: two Pools, one line at +50%', () => {
    const t = tally([
      ['pool', 0, 0],
      ['kitchen', 4, 0],
      ['patio', 4, 2],
      ['pool', 7, 2],
    ]);
    // The Patio's 2 at +50% is 3; the Kitchen's 5 is 7.5, 8.
    expect(t.pieces.map((p) => p.earned)).toEqual([1, 8, 3, 0]);
    expect(t.pieces[2]!.lines).toContainEqual({
      label: '2 Pools within 2 tiles',
      op: 'pct',
      value: 50,
      from: [
        { kind: 'piece', uid: 1 },
        { kind: 'piece', uid: 4 },
      ],
    });
  });

  it('keeps a Pool’s Bedrooms awake: −1 within 2 tiles, which Soundproofing shields', () => {
    const pool: Placement[] = [
      ['pool', 0, 0],
      ['bedroom', 4, 0],
    ];
    // Out back, the Pool's +1 (D-166). The Bedroom's 3, less 1.
    expect(earned(pool)).toEqual([1, 2]);
    expect(reachLines(tally(pool), 2)).toEqual([['Pool within 2 tiles', 'add', -1]]);
    // A tile further, nothing.
    expect(
      earned([
        ['pool', 0, 0],
        ['bedroom', 5, 0],
      ]),
    ).toEqual([1, 3]);
    // Soundproofing: Loud pieces can't lower it, the Pool's reach included, and nothing Loud
    // touches it, so it earns its +25% (D-194): 3.75, 4.
    const quiet = tallyOf(withFixture(houseFrom(CONTENT, open, pool), 2, 'soundproofing', 1));
    expect(quiet.pieces[1]!.earned).toBe(4);
    expect(reachLines(quiet, 2)).toEqual([]);
    // Touching the Pool, it loses 2 for a Loud neighbor and 1 for the reach, each its own line.
    const touching = tally([
      ['pool', 0, 0],
      ['bedroom', 3, 0],
    ]);
    expect(touching.pieces[1]!.lines.map((l) => [l.label, l.value])).toEqual([
      ['Every week', 3],
      ['Touching a Pool', -2],
      ['Pool within 2 tiles', -1],
    ]);
  });

  it('a Library quiets the rooms within 2 tiles and hushes what’s Loud there', () => {
    // A Bedroom and a Home Office two tiles off, neither touching it: +1 each. A Garage
    // diagonally two tiles off, Loud: −1. The Library touches none of them, so earns nothing.
    const t = tally([
      ['library', 0, 0],
      ['bedroom', 3, 0],
      ['homeOffice', 0, 3],
      ['garage', 3, 3],
    ]);
    expect(reachLines(t, 2)).toEqual([['Library within 2 tiles', 'add', 1]]);
    expect(reachLines(t, 3)).toEqual([['Library within 2 tiles', 'add', 1]]);
    expect(reachLines(t, 4)).toEqual([['Library within 2 tiles', 'add', -1]]);
    expect(t.pieces[0]!.earned).toBe(0);
  });

  it('a Henhouse feeds the Green pieces within 2 tiles, in place of its pay for a garden', () => {
    // A Flower Bed touching it and a Lawn two tiles off: +1 each. A Lawn three tiles off,
    // nothing. The Henhouse earns nothing for them now: its budget and the shed are its own.
    const t = tally([
      ['henhouse', 0, 0],
      ['lawn', 3, 0],
      ['lawn', 0, 3],
      ['flowerBed', 2, 0],
    ]);
    expect(t.pieces.map((p) => p.earned)).toEqual([0, 2, 1, 4]);
    expect(reachLines(t, 2)).toEqual([['Henhouse within 2 tiles', 'add', 1]]);
    expect(reachLines(t, 3)).toEqual([]);
    expect(reachLines(t, 4)).toEqual([['Henhouse within 2 tiles', 'add', 1]]);
  });

  it('the Fountain: +10% to the Outdoor and Pretty pieces within 2 tiles', () => {
    // A Patio (Outdoor) that a Kitchen pays 2, and a Flower Bed (Pretty) paying 3 in the front
    // yard: 2.2 and 3.3 round to 2 and 3, so a Fountain's +10% pays from 5 up. The Kitchen is
    // neither.
    const t = tally([
      ['kitchen', 4, 0],
      ['patio', 4, 2],
      ['fountain', 2, 3],
      ['flowerBed', 0, 3],
    ]);
    expect(t.pieces.map((p) => p.earned)).toEqual([5, 2, 3, 3]);
    expect(reachLines(t, 1)).toEqual([]);
    expect(reachLines(t, 2)).toEqual([['Fountain within 2 tiles', 'pct', 10]]);
    expect(reachLines(t, 4)).toEqual([['Fountain within 2 tiles', 'pct', 10]]);
    // Five Lawns in a row pay 1 each and +1 for each touching Lawn: the middle three earn 3, at
    // +10% 3.3, 3. With a second Fountain beside the first, +20% makes them 3.6, 4.
    const lawns: Placement[] = [0, 2, 4, 6, 8].map((x) => ['lawn', x, 0]);
    const one = earned([...lawns, ['fountain', 4, 2]]);
    const two = earned([...lawns, ['fountain', 4, 2], ['fountain', 5, 2]]);
    expect(one.slice(1, 4)).toEqual([3, 3, 3]);
    expect(two.slice(1, 4)).toEqual([4, 4, 4]);
  });

  it('the Fountain: a 1×1 yard piece from Framing at half weight, for the front yard', () => {
    const def = CONTENT.pieces.fountain;
    expect(def).toMatchObject({
      category: 'yard',
      shape: ['#'],
      tags: ['Wet', 'Pretty'],
      drawWeight: 5,
      fromPhase: 2,
      complexity: 2,
    });
    expect(CONTENT.balance.phases[def.fromPhase]!.name).toBe('Framing');
    expect(cardText(CONTENT, def).effects).toEqual([
      'Outdoor and Pretty pieces within 2 tiles earn +10%',
      '+1 every week',
      '+2 every week in the front yard',
    ]);
    // Alone: its 1, and +2 in the front yard (D-166).
    expect(earned([['fountain', 0, 0]])).toEqual([3]);
  });

  it('says how far on the full card, with a tip, and "nearby" in the hand', () => {
    for (const id of LANDMARKS) {
      const card = cardText(CONTENT, CONTENT.pieces[id]);
      const reach = card.effects.filter((line) => line.includes('within 2 tiles'));
      expect(reach.length, id).toBeGreaterThan(0);
      // Each reach line links the tip; the reach lines come first.
      card.effects.forEach((line, k) =>
        expect(card.terms?.[k] ?? null, `${id}: ${line}`).toBe(
          line.includes('within 2 tiles') ? 'reach' : null,
        ),
      );
      const [hand] = handCardLines(CONTENT, { kind: 'piece', id });
      expect(hand, id).toMatch(/nearby$/);
      expect(hand!.length, id).toBeLessThanOrEqual(HAND_LINE_CHARS);
    }
    // The tip's title is the words the cards link, so it reads as their definition.
    const tip = glossary(CONTENT).reach;
    expect(tip.title).toBe('Within 2 tiles');
    expect(tip.text).toContain('a square around it');
    expect(tip.text).toContain('Libraries, Pools, Henhouses, and Fountains');
  });

  it('reaches 1 to 3 tiles, no more, as content data (validateContent)', () => {
    const reaching = (within: number): Content => ({
      ...CONTENT,
      pieces: {
        ...CONTENT.pieces,
        fountain: {
          ...CONTENT.pieces.fountain,
          effects: [{ kind: 'aura', match: 'all', scope: { within }, pct: 10 }],
        },
      },
    });
    expect(validateContent(CONTENT)).toEqual([]);
    expect(validateContent(reaching(3))).toEqual([]);
    for (const within of [0, 4, 1.5]) {
      expect(validateContent(reaching(within)).join(' '), `${within}`).toContain(
        'an aura reaches within 1 to 3 tiles',
      );
    }
  });
});

describe('a landmark’s play (D-199)', () => {
  // A Kitchen with a Patio below it, a Bedroom off to the east, and a Library down the lot.
  const start = rules.newRun({
    seed: 'reach',
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });
  const s: RunState = {
    ...start,
    house: houseFrom(CONTENT, open, [
      ['kitchen', 4, 0],
      ['patio', 4, 2],
      ['bedroom', 7, 0],
      ['library', 0, 6],
    ]),
    hand: [{ kind: 'piece', id: 'pool' }],
  };
  const pool = (x: number, y: number): PlaceAction => ({
    t: 'place',
    from: 'hand',
    i: 0,
    x,
    y,
    rot: 0,
  });

  it('previews what the week will tally, and marks the pieces it reaches', () => {
    for (const [x, y] of [
      [0, 2],
      [0, 3],
      [1, 4],
    ] as const) {
      const play = pool(x, y);
      const p = rules.preview(s, play);
      expect(p.legal).toBe(true);
      const tallied = rules.apply(s, play).events.find((e) => e.t === 'tally');
      if (tallied?.t !== 'tally') throw new Error('no tally');
      expect(p.after.total, `(${x}, ${y})`).toBe(tallied.tally.total);
      expect(p.after.total).toBe(rules.scoreOnly(s, play));
      // Every piece whose earnings change is in its lines, touching or not, and the parts add
      // up to the change (D-122).
      const before = new Map(rules.currentTally(s).pieces.map((q) => [q.uid, q.earned]));
      const changed = tallied.tally.pieces
        .filter((q) => q.uid !== 5 && q.earned !== before.get(q.uid))
        .map((q) => q.uid);
      expect(changed.length).toBeGreaterThan(0);
      for (const uid of changed) expect(p.lines.map((l) => l.uid)).toContain(uid);
      expect(p.parts.reduce((a, q) => a + q.wow, 0)).toBe(p.delta);
    }
    // From (0, 2) it reaches the Kitchen and the Patio: 5 → 6, 3 → 4.
    const near = rules.preview(s, pool(0, 2));
    expect(near.lines.filter((l) => !l.isNew).map((l) => [l.defId, l.before, l.after])).toEqual([
      ['kitchen', 5, 6],
      ['patio', 3, 4],
    ]);
  });

  it('the bot’s estimate sees it, both ways', () => {
    const exact = (st: RunState, play: PlaceAction) =>
      rules.scoreOnly(st, play) - rules.scoreOnly(st, null);
    for (const [x, y] of [
      [0, 2],
      [0, 3],
      [1, 4],
      [0, 0],
    ] as const) {
      expect(rules.estimatePlay(s, pool(x, y)).delta, `(${x}, ${y})`).toBe(exact(s, pool(x, y)));
    }
    // With the Pool down, a Patio two tiles from it: its +25% on the new piece.
    const placed = rules.apply(s, pool(0, 2)).state;
    const next: RunState = {
      ...placed,
      screen: 'build',
      hand: [{ kind: 'piece', id: 'patio' }],
    };
    const patio: PlaceAction = { t: 'place', from: 'hand', i: 0, x: 4, y: 4, rot: 0 };
    expect(rules.estimatePlay(next, patio).delta).toBe(exact(next, patio));
  });

  it('shades its square: its own tiles and every tile within 2 of them (rules.reachTiles)', () => {
    const w = s.house.lot.width;
    const tiles = (list: readonly number[]) =>
      list.map((i) => `${i % w},${Math.floor(i / w)}`).join(' ');
    // The Pool's ghost at (1, 4): x −1 to 5, clipped to 0 to 5, and y 2 to 7, 6 × 6.
    const ghost = rules.reachTiles(s, {
      defId: 'pool',
      cells: [0, 1, 2].flatMap((dx) => [4, 5].map((y) => ({ x: 1 + dx, y }))),
    });
    expect(ghost).toHaveLength(36);
    expect(tiles(ghost)).toContain('0,2');
    expect(tiles(ghost)).toContain('5,7');
    expect(tiles(ghost)).not.toContain('6,4');
    // A placed Library (uid 4) at (0, 6): x 0 to 3, y 4 to 9.
    expect(rules.reachTiles(s, { uid: 4 })).toHaveLength(24);
    // A piece without a reach shades nothing.
    expect(rules.reachTiles(s, { uid: 1 })).toEqual([]);
    expect(rules.reachTiles(s, { defId: 'bedroom', cells: [{ x: 0, y: 0 }] })).toEqual([]);
  });
});
