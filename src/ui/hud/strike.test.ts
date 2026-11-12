// Strike mode (D-157, actions.ts): S or the Strike button, then a hand card clicked twice (or its
// number pressed twice) strikes it: its type is gone for the run, and a card from its row takes
// its place. Esc, a click on the lot, or the button again leaves the mode; D and S switch
// between the two modes; a reroll keeps it. A placement of a card a strike replaces goes with
// it, and a struck card with the keyboard's focus hands it to the new card in its slot. Strike's
// first-time hint waits for the opening, and the struck types bring Your goods in only with the
// next week's hand, never mid-week under the stamp.
//
// The store and the director play real runs here, on the ?debug panel's instant tally.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT,
  rules,
  struckText,
  type Card,
  type PlaceAction,
  type RunSetup,
} from '../../rules/index.ts';
import { busy, instantTally, struckSaid } from '../fx/director.ts';
import {
  debugAction,
  endWeek,
  inspected,
  log,
  reroll,
  run,
  selected,
  source,
  startRun,
  strikeArmed,
  struckAtDeal,
  tentative,
  tool,
} from '../store.ts';
import {
  cancelPlacement,
  selectCard,
  strikeFocus,
  toggleDemolish,
  toggleStrike,
} from './actions.ts';
import { strikeHintDue } from './FirstHints.tsx';
import { shownIn } from './first-job.ts';
import { foldCounts, foldedEmpty, inventoryRows, showsInventory } from './inventory-rows.ts';
import { seenHints } from './seen-hints.ts';

const SETUP: RunSetup = {
  seed: 'strike-hud',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};

/** The hand cards a strike can take now. */
const strikable = (): number[] =>
  run.value.hand.flatMap((_, i) => (rules.canStrikeCard(run.value, i).ok ? [i] : []));

/** A placement waiting for End week of the first card that can go both ways: placed or struck. */
function placeable(from: 'hand' | 'reserve'): PlaceAction {
  const can = strikable();
  const play = rules
    .legalPlays(run.value)
    .find(
      (p): p is PlaceAction =>
        p.t === 'place' && p.from === from && (from === 'reserve' || can.includes(p.i)),
    );
  if (!play) throw new Error(`no ${from} placement`);
  return play;
}

/** A document whose focus is on hand card `slot` (or on nothing in the hand). */
function focusOn(slot: number | null): void {
  vi.stubGlobal('document', {
    querySelector: () => null,
    querySelectorAll: () => [],
    activeElement: {
      closest: () => (slot === null ? null : { getAttribute: () => String(slot) }),
    },
  });
}

/** Arms hand card i in strike mode, then strikes it, as two clicks do. */
function strikeTwice(i: number): void {
  selectCard(i);
  selectCard(i);
}

beforeEach(() => {
  // The director waits on frames: here they're a timer's turn.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0),
  );
  // The director's bursts look for their elements, and find none.
  vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
  instantTally.value = true;
  startRun(SETUP);
});

afterEach(async () => {
  await vi.waitFor(() => expect(busy.value).toBe(false));
  instantTally.value = false;
  vi.unstubAllGlobals();
});

describe('strike mode', () => {
  it('arms a card with the first click, and strikes it with the second', () => {
    const s0 = run.value;
    expect(s0.strikesLeft).toBe(1);
    const [i] = strikable();
    expect(i).toBeDefined();
    toggleStrike();
    expect(tool.value).toBe('strike');
    const before = log.value;
    selectCard(i!);
    expect(strikeArmed.value).toBe(i);
    expect(inspected.value).toEqual({ kind: 'card', i });
    expect(log.value).toBe(before);
    selectCard(i!);
    expect(log.value.at(-1)).toEqual({ t: 'strikeCard', i });
    expect(tool.value).toBe('build');
    expect(strikeArmed.value).toBeNull();
    expect(run.value.strikesLeft).toBe(s0.strikesLeft - 1);
    expect(run.value.hand[i!]).not.toEqual(s0.hand[i!]);
    expect(seenHints.value.has('strike')).toBe(true);
    // Inspect lets go of the card that went (Risk 14): pointing at the new one shows it.
    expect(inspected.value).toBeNull();
  });

  it('refuses a card the weekly draw never deals, and the mode with no strikes left', () => {
    // A member's room, from the ?debug panel: no strike can take it.
    expect(debugAction({ t: 'debug', op: 'giveCard', id: 'nursery' })).toBe(true);
    const j = run.value.hand.length - 1;
    expect(rules.canStrikeCard(run.value, j).ok).toBe(false);
    toggleStrike();
    expect(tool.value).toBe('strike');
    const before = log.value;
    selectCard(j);
    expect(strikeArmed.value).toBeNull();
    selectCard(j);
    expect(log.value).toBe(before);
    // No strikes left: S and the button do nothing.
    cancelPlacement();
    run.value = { ...run.value, strikesLeft: 0 };
    toggleStrike();
    expect(tool.value).toBe('build');
  });

  it('stays out of the mode when no card in the hand can be struck', () => {
    // Special pieces the General Contractor and the Hendersons never draw.
    const ids = ['playroom', 'library', 'hotTub', 'henhouse'] as const;
    run.value = { ...run.value, hand: ids.map((id): Card => ({ kind: 'piece', id })) };
    expect(rules.canStrikeAny(run.value).reason).toBe('No card in your hand can be struck.');
    toggleStrike();
    expect(tool.value).toBe('build');
  });

  it('drops the placement of a card it replaces, and keeps a reserve piece’s', () => {
    const play = placeable('hand');
    selectCard(play.i);
    tentative.value = play;
    // Into the mode: the placement waits for End week (the lot hides it while the mode is on).
    toggleStrike();
    expect(tentative.value).toEqual(play);
    expect(selected.value).toBe(play.i);
    strikeTwice(play.i);
    expect(log.value.at(-1)).toEqual({ t: 'strikeCard', i: play.i });
    expect(tentative.value).toBeNull();
    expect(selected.value).toBeNull();

    // The Landscaper's reserve: a strike changes the hand, not the reserve.
    startRun({ ...SETUP, crewId: 'landscaper' });
    const kept = placeable('reserve');
    selectCard(kept.i, 'reserve');
    tentative.value = kept;
    toggleStrike();
    const [i] = strikable();
    strikeTwice(i!);
    expect(log.value.at(-1)).toEqual({ t: 'strikeCard', i });
    expect(source.value).toBe('reserve');
    expect(selected.value).toBe(kept.i);
    expect(tentative.value).toEqual(kept);
  });

  it('leaves with Esc, switches with D and S, and keeps the mode through a reroll', () => {
    toggleStrike();
    expect(tool.value).toBe('strike');
    cancelPlacement();
    expect(tool.value).toBe('build');
    toggleStrike();
    toggleDemolish();
    expect(tool.value).toBe('demolish');
    toggleStrike();
    expect(tool.value).toBe('strike');
    const [i] = strikable();
    selectCard(i!);
    expect(strikeArmed.value).toBe(i);
    expect(reroll()).toBe(true);
    expect(tool.value).toBe('strike');
    expect(strikeArmed.value).toBeNull();
  });

  it('says what a strike did for screen readers, until the next action strikes nothing', () => {
    run.value = { ...run.value, strikesLeft: 2 };
    let [i] = strikable();
    toggleStrike();
    strikeTwice(i!);
    expect(struckSaid.value).toMatch(/^No more .+ this run\. New cards?: .+\. 1 strike left\.$/);
    // Into the mode again: the line starts empty, so the old words aren't read out again.
    toggleStrike();
    expect(struckSaid.value).toBe('');
    [i] = strikable();
    strikeTwice(i!);
    expect(struckSaid.value).toMatch(/ 0 strikes left\.$/);
    // An action that strikes nothing clears them too.
    expect(reroll()).toBe(true);
    expect(struckSaid.value).toBe('');
  });

  it('notes the slot whose struck card had the keyboard’s focus, and only that', () => {
    run.value = { ...run.value, strikesLeft: 3 };
    // The focus on the card struck: the new card in its slot takes it (Hand.tsx).
    let [i] = strikable();
    focusOn(i!);
    toggleStrike();
    strikeTwice(i!);
    expect(log.value.at(-1)).toEqual({ t: 'strikeCard', i });
    expect(strikeFocus.value).toBe(i);
    strikeFocus.value = null;
    // The focus nowhere in the hand.
    [i] = strikable();
    focusOn(null);
    toggleStrike();
    strikeTwice(i!);
    expect(log.value.at(-1)).toEqual({ t: 'strikeCard', i });
    expect(strikeFocus.value).toBeNull();
    // The focus on a card that can't be struck: no strike, so nothing to hand on.
    expect(debugAction({ t: 'debug', op: 'giveCard', id: 'nursery' })).toBe(true);
    const j = run.value.hand.length - 1;
    focusOn(j);
    toggleStrike();
    const before = log.value;
    strikeTwice(j);
    expect(log.value).toBe(before);
    expect(strikeFocus.value).toBeNull();
  });
});

describe('Strike’s first-time hint', () => {
  it('is due once Strike is on screen with a strike to use, after the opening', () => {
    const s = rules.newRun(SETUP);
    const on = shownIn(s, false);
    // A standard run shows Strike from week 1: the opening's hints and the checklist's first.
    expect(strikeHintDue(s, on, new Set())).toBe(false);
    expect(strikeHintDue(s, on, new Set(['checklist']))).toBe(true);
    expect(strikeHintDue({ ...s, week: 4, slot: 4 }, on, new Set())).toBe(true);
    expect(strikeHintDue({ ...s, strikesLeft: 0 }, on, new Set(['checklist']))).toBe(false);
    expect(strikeHintDue({ ...s, screen: 'shop' }, on, new Set(['checklist']))).toBe(false);
    // The first job: not before Foundation's second week, where Strike arrives.
    const seen = new Set(['checklist']);
    for (const at of [
      { week: 4, phase: 0, slot: 4 },
      { week: 5, phase: 1, slot: 1 },
    ]) {
      const r = { ...s, ...at };
      expect(strikeHintDue(r, shownIn(r, true), seen)).toBe(false);
    }
    const r = { ...s, week: 6, phase: 1, slot: 2 };
    expect(strikeHintDue(r, shownIn(r, true), seen)).toBe(true);
  });
});

describe('Your goods after a strike', () => {
  const rows = () => inventoryRows(run.value, false, struckAtDeal.value);

  it('a strike before milestone 1 brings the panel in with the next week’s hand', async () => {
    // The General Contractor brings nothing, and here the standing stock's cards (D-162) have
    // been placed: an empty reserve before the first shop has no panel.
    expect(run.value.reserve.every((r) => r.stock)).toBe(true);
    run.value = { ...run.value, reserve: [] };
    expect(showsInventory(rows())).toBe(false);
    const [i] = strikable();
    toggleStrike();
    strikeTwice(i!);
    expect(run.value.struck).toHaveLength(1);
    // Mid-week it stays out: not brought in at 801 to 1099 px tall (the user's 1728×963), and
    // folded and empty up to 800 px, so the hand never moves under the stamp.
    expect(showsInventory(rows())).toBe(false);
    expect(foldedEmpty(run.value, rows())).toBe(true);
    // A reroll deals the same week's hand again.
    expect(reroll()).toBe(true);
    expect(showsInventory(rows())).toBe(false);
    // The next week's hand brings it in, with the struck count on its folded plank.
    endWeek();
    await vi.waitFor(() => expect(busy.value).toBe(false));
    expect(run.value.week).toBe(2);
    expect(rows().struck).toBe(true);
    expect(showsInventory(rows())).toBe(true);
    expect(foldedEmpty(run.value, rows())).toBe(false);
    expect(foldCounts(run.value)).toContainEqual([
      'strike',
      1,
      struckText(CONTENT, run.value.struck),
    ]);
  });

  it('a plank already showing counts a strike at once', () => {
    // The Landscaper's crew cards wait in the reserve, so the plank shows from week 1.
    startRun({ ...SETUP, crewId: 'landscaper' });
    expect(showsInventory(rows())).toBe(true);
    expect(foldCounts(run.value).some(([icon]) => icon === 'strike')).toBe(false);
    const [i] = strikable();
    toggleStrike();
    strikeTwice(i!);
    expect(foldCounts(run.value)).toContainEqual([
      'strike',
      1,
      struckText(CONTENT, run.value.struck),
    ]);
    // The open panel's Struck row is a line of its own: it waits for the next week's hand too.
    expect(rows().struck).toBe(false);
  });
});
