// The first job (D-149, first-job.ts and store.ts): what its screen shows week by week, the
// opening its hints name, and which run a browser's first job is. The opening is held against
// the real lot (balance.ts's `firstSeed`): if the draw or the lot generator changes what that
// lot deals, these say so, and the seed is picked again.
//
// And a browser is guided once (D-149, 2026-11-11): a link, a Portfolio replay or a new run after
// a crash is guided only in a browser that has never had a first job, and a finished house ends
// a first visit as taking a contract does. The board keeps its first job until then.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT,
  jobBoard,
  lotTraits,
  rules,
  stream,
  type Contract,
  type PieceId,
  type PlaceAction,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { company, emptyCompany, fileJob, type Job } from '../company.ts';
import {
  firstJob,
  firstJobSeed,
  firstVisit,
  forgetFirstVisit,
  newRun,
  newRunAfterCrash,
  notice,
  run,
  takeContract,
} from '../store.ts';
import { playLotAgain } from './actions.ts';
import {
  arrivingIn,
  guideStepOf,
  OPENING,
  OPENING_WEEKS,
  openingCard,
  shown,
  shownIn,
  type Shown,
} from './first-job.ts';

const { firstSeed, firstClient } = CONTENT.balance.jobBoard;
const SETUP: RunSetup = {
  seed: firstSeed,
  clientId: firstClient,
  crewId: 'generalContractor',
  mode: 'standard',
};

const on = (s: Shown) => (Object.keys(s) as (keyof Shown)[]).filter((k) => s[k]).sort();
/** A run at `week` of Groundbreaking, or as given. */
const at = (week: number, extra: Partial<RunState> = {}): RunState => ({
  ...rules.newRun(SETUP),
  week,
  slot: week,
  ...extra,
});

describe('what the first job shows', () => {
  const all = on(shownIn(at(1), false));

  it('is everything, from week 1, for any other run', () => {
    expect(all).toHaveLength(9);
    expect(on(shownIn(at(3), false))).toEqual(all);
  });

  it('starts with the lot, the hand and the target alone', () => {
    expect(on(shownIn(at(1), true))).toEqual([]);
  });

  it('brings in the score panel, Inspect and the forecast as the first tally starts', () => {
    expect(on(shownIn(at(2), true))).toEqual(['forecast', 'inspect', 'score']);
    expect(on(shownIn(at(OPENING_WEEKS), true))).toEqual(['forecast', 'inspect', 'score']);
  });

  it('brings in the checklist and Reroll once the opening is played', () => {
    expect(on(shownIn(at(OPENING_WEEKS + 1), true))).toEqual([
      'checklist',
      'forecast',
      'inspect',
      'reroll',
      'score',
    ]);
  });

  it('shows everything from Foundation', () => {
    expect(on(shownIn(at(5, { phase: 1, slot: 1 }), true))).toEqual(all);
    // And in the first shop, which opens before Foundation's first week.
    expect(on(shownIn(at(5, { phase: 1, slot: 1, screen: 'shop' }), true))).toEqual(all);
  });

  it('shows budget as soon as a find pays some, and overtime in an overtime week', () => {
    expect(shownIn(at(3, { budget: 3 }), true).budget).toBe(true);
    expect(shownIn(at(3), true).budget).toBe(false);
    expect(shownIn(at(5, { overtimeWeek: 1 }), true).overtime).toBe(true);
    expect(shownIn(at(4), true).overtime).toBe(false);
  });

  it('keeps Demolish and Complete early for Foundation, target met or not', () => {
    const met = at(4, { score: 500 });
    expect(shownIn(met, true)).toMatchObject({ demolish: false, early: false });
  });
});

describe('what arrives this week', () => {
  const parts = (s: RunState, first = true) => [...arrivingIn(s, first)].sort();

  it('is each part in the week the first job first shows it', () => {
    expect(parts(at(1))).toEqual([]);
    expect(parts(at(2))).toEqual(['forecast', 'inspect', 'score']);
    expect(parts(at(3))).toEqual([]);
    expect(parts(at(OPENING_WEEKS + 1))).toEqual(['checklist', 'reroll']);
    expect(parts(at(5, { phase: 1, slot: 1 }))).toEqual([
      'budget',
      'demolish',
      'early',
      'overtime',
    ]);
    expect(parts(at(6, { phase: 1, slot: 2 }))).toEqual([]);
  });

  it('is nothing in any other run, or off the build screen', () => {
    expect(parts(at(2), false)).toEqual([]);
    expect(parts(at(5, { phase: 1, slot: 1, screen: 'shop' }))).toEqual([]);
  });
});

/** Every legal spot for the hand's `id`. */
function spots(s: RunState, id: PieceId): PlaceAction[] {
  const i = s.hand.findIndex((c) => c.kind === 'piece' && c.id === id);
  return rules
    .legalPlays(s)
    .filter((p): p is PlaceAction => p.t === 'place' && p.from === 'hand' && p.i === i);
}

describe('the opening', () => {
  it('is three weeks: a Bedroom, a Bathroom by it, and the Closet that makes a Suite', () => {
    expect(OPENING.map((o) => o.card)).toEqual(['bedroom', 'bathroom', 'closet']);
    expect(OPENING).toHaveLength(OPENING_WEEKS);
    expect(CONTENT.sets.suite.members).toEqual({ bedroom: 1, bathroom: 1, closet: 1 });
  });

  it('is what the first job’s lot deals, wherever the three pieces go', () => {
    const target = rules.target(rules.newRun(SETUP));
    for (let v = 0; v < 40; v++) {
      const rng = stream(firstSeed, `test/opening/${v}`);
      let s = rules.newRun(SETUP);
      for (const step of OPENING) {
        expect(openingCard(s)?.id, `variant ${v}, week ${s.week}`).toBe(step.card);
        const plays = spots(s, step.card);
        expect(plays.length).toBeGreaterThan(0);
        s = rules.apply(s, plays[rng.int(plays.length)]!).state;
      }
      // Three weeks in: the set holds, Groundbreaking's target is met, and the guide is done.
      expect(rules.currentTally(s).sets.map((x) => x.set)).toEqual(['suite']);
      expect(s.score).toBeGreaterThanOrEqual(target);
      expect(s.week).toBe(OPENING_WEEKS + 1);
      expect(openingCard(s)).toBeNull();
    }
  });

  it('is dealt on a plain lot: no creek, and no trait to read on the job’s card', () => {
    const { lot } = rules.newRun(SETUP).house;
    expect(lot.terrain).not.toContain('creek');
    expect(lotTraits(CONTENT, lot)).toEqual([]);
  });

  it('names a card only when the hand holds it and the house has what it builds on', () => {
    const start = rules.newRun(SETUP);
    // No Bedroom in the hand: nothing to name.
    const without = { ...start, hand: start.hand.filter((c) => c.id !== 'bedroom') };
    expect(openingCard(without)).toBeNull();
    // Week 2 with no Bedroom built: the Bathroom has nothing to touch.
    const skipped = rules.apply(start, { t: 'pass' }).state;
    expect(skipped.hand.some((c) => c.id === 'bathroom')).toBe(true);
    expect(openingCard(skipped)).toBeNull();
  });

  it('names the Closet only while the house is the Bedroom and the Bathroom alone', () => {
    let s = rules.newRun(SETUP);
    s = rules.apply(s, spots(s, 'bedroom')[0]!).state;
    s = rules.apply(s, spots(s, 'bathroom')[0]!).state;
    expect(openingCard(s)?.id).toBe('closet');
    // A third piece on the lot: the two might not touch, so the set isn't promised.
    const more = {
      ...s,
      house: { ...s.house, pieces: [...s.house.pieces, { ...s.house.pieces[0]!, uid: 99 }] },
    };
    expect(openingCard(more)).toBeNull();
  });

  it('is silent in an overtime week and off the build screen', () => {
    const start = rules.newRun(SETUP);
    expect(openingCard({ ...start, overtimeWeek: 1 })).toBeNull();
    expect(openingCard({ ...start, screen: 'shop' })).toBeNull();
  });
});

describe('week 1’s guide', () => {
  it('waits for a card, then a spot, then End week', () => {
    expect(guideStepOf(false, false)).toBe('pick');
    expect(guideStepOf(true, false)).toBe('place');
    expect(guideStepOf(true, true)).toBe('end');
  });
});

describe('a browser’s first job', () => {
  const store = new Map<string, string>();
  const contract = (seed: string): Contract => ({
    seed,
    clientId: 'hendersons',
    recommended: false,
    locked: false,
  });

  /** A house this browser finished: the company's record files it as its run ends. */
  const house = (seed: string): Job => ({
    seed,
    clientId: 'hendersons',
    crewId: 'generalContractor',
    won: true,
    score: 1000,
    verdict: 'Charmer',
    milestones: 7,
    phases: 7,
    at: 0,
  });
  /** Everything the build screen has: what any run but the first job shows from week 1. */
  const everything = on(shownIn(at(1), false));

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    // A new browser: no first job, no houses, and nothing kept.
    forgetFirstVisit();
    company.value = emptyCompany();
    store.clear();
  });
  afterEach(() => {
    forgetFirstVisit();
    company.value = emptyCompany();
    notice.value = null;
    vi.unstubAllGlobals();
  });

  it('is the first contract taken, and the board is open after it', () => {
    expect(firstVisit()).toBe(true);
    takeContract(contract('first'));
    expect(firstJob.value).toBe(true);
    expect(firstVisit()).toBe(false);
    // The next one is an ordinary run, and the first job is behind this browser.
    takeContract(contract('second'));
    expect(firstJob.value).toBe(false);
    expect(firstJobSeed.value).toBeNull();
  });

  it('survives a reload: the seed is kept in the browser, by channel', () => {
    takeContract(contract('kept'));
    expect([...store.entries()].some(([k, v]) => k.endsWith(':firstJob') && v === 'kept')).toBe(
      true,
    );
  });

  it('ends with its run, so the same lot played again is an ordinary run', () => {
    takeContract(contract('ends'));
    run.value = { ...run.value, screen: 'lost' };
    expect(firstJob.value).toBe(false);
    expect(firstJobSeed.value).toBeNull();
    takeContract(contract('ends'));
    expect(firstJob.value).toBe(false);
  });

  it('is a friend’s link too, which leaves the board as a first visit finds it', () => {
    newRun('shared');
    expect(firstJob.value).toBe(true);
    expect(firstVisit()).toBe(true);
    // Start then opens the first job proper, which takes over.
    takeContract(contract(firstSeed));
    expect(firstJob.value).toBe(true);
    expect(firstJobSeed.value).toBe(firstSeed);
  });

  it('is never a run started after the first', () => {
    takeContract(contract('a'));
    newRun('b');
    expect(firstJob.value).toBe(false);
    newRun('c');
    expect(firstJob.value).toBe(false);
  });

  it('comes from a link once: the next link shows the whole screen from week 1', () => {
    newRun('first-link');
    expect(firstJob.value).toBe(true);
    expect(on(shown.value)).toEqual([]);
    // Another link while the first job is going: an ordinary run, and the first job is over.
    newRun('second-link');
    expect(firstJob.value).toBe(false);
    expect(firstJobSeed.value).toBeNull();
    expect(run.value.week).toBe(1);
    expect(on(shown.value)).toEqual(everything);
    // The browser remembers it had one, as after a reload: a third link, and a crash's new run.
    newRun('third-link');
    expect(firstJob.value).toBe(false);
    newRunAfterCrash();
    expect(firstJob.value).toBe(false);
    expect(on(shown.value)).toEqual(everything);
    // The board still opens with the first job, and it's guided: no contract has been taken.
    expect(firstVisit()).toBe(true);
    takeContract(contract(firstSeed));
    expect(firstJob.value).toBe(true);
  });

  it('is over once a house is finished: a replay, a link and the board are ordinary', () => {
    // As seen on 2026-11-11: three houses finished from links, no contract taken from the
    // board, and nothing kept of a first job (a browser from before the guided key).
    for (const seed of ['one', 'two', 'three']) fileJob(house(seed));
    expect(firstVisit()).toBe(false);
    playLotAgain({ seed: 'two', clientId: 'hendersons', crewId: 'generalContractor' });
    expect(run.value.setup.seed).toBe('two');
    expect(firstJob.value).toBe(false);
    expect(run.value.week).toBe(1);
    expect(on(shown.value)).toEqual(everything);
    newRun('a-link');
    expect(firstJob.value).toBe(false);
    // The board deals its three contracts, none face down.
    const board = jobBoard(CONTENT, 'board', { firstVisit: firstVisit() });
    expect(board.some((c) => c.locked || c.recommended)).toBe(false);
  });

  it('is over once a friend finishes the house their link guided', () => {
    newRun('linked');
    expect(firstJob.value).toBe(true);
    run.value = { ...run.value, screen: 'won' };
    fileJob(house('linked'));
    expect(firstJobSeed.value).toBeNull();
    expect(firstVisit()).toBe(false);
    playLotAgain({ seed: 'linked', clientId: 'hendersons', crewId: 'generalContractor' });
    expect(firstJob.value).toBe(false);
    expect(on(shown.value)).toEqual(everything);
  });

  it('counts a first job saved before the guided key', () => {
    newRun('kept');
    // As a browser from before 2026-11-11 has it: the first job's seed and no guided key.
    for (const k of [...store.keys()]) if (k.endsWith(':guided')) store.delete(k);
    newRun('next');
    expect(firstJob.value).toBe(false);
    // Its end is kept, so a later link isn't guided either.
    newRun('later');
    expect(firstJob.value).toBe(false);
  });

  it('starts over with the ?debug panel’s First visit again, houses or not', () => {
    fileJob(house('before'));
    takeContract(contract('board'));
    expect(firstVisit()).toBe(false);
    forgetFirstVisit();
    expect(firstVisit()).toBe(true);
    newRun('link-again');
    expect(firstJob.value).toBe(true);
    // A house finished from now on ends it, as it would a new browser's.
    run.value = { ...run.value, screen: 'won' };
    fileJob(house('link-again'));
    expect(firstVisit()).toBe(false);
  });
});
