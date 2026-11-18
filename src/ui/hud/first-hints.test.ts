// The first-time hints' budget (D-142): each is one or two short sentences, within HINT_WORDS
// words, so a new player never meets a paragraph. The ones that state a rule are the rules' own
// (text.ts hintText, tested there for their numbers). The opening's (D-149) name their card when
// the hand holds it, and keep to the same budget, their steps counted.

import { describe, expect, it } from 'vitest';
import { CONTENT, HINT_WORDS, hintText, rules, type RunSetup } from '../../rules/index.ts';
import { FEEL } from '../fx/feel.ts';
import {
  hintFor,
  hintGone,
  HINTS,
  momentPassed,
  OPENING_HINTS,
  seenTips,
  type HintId,
} from './FirstHints.tsx';

const words = (text: string) => text.trim().split(/\s+/).length;
/** Everything a hint's card says under its title. */
const said = (h: { text: string; steps?: readonly string[] }) =>
  [h.text, ...(h.steps ?? [])].join(' ');

describe('the first-time hints', () => {
  const ids = Object.keys(HINTS) as HintId[];
  const every = [...ids.map((id) => [id, HINTS[id]] as const), ...Object.entries(OPENING_HINTS)];

  it(`keep to ${HINT_WORDS} words each, steps and all`, () => {
    for (const [id, hint] of every) {
      const text = said(hint);
      expect(words(text), `${id}: “${text}”`).toBeLessThanOrEqual(HINT_WORDS);
    }
  });

  it('have a short title each', () => {
    for (const [id, hint] of every) expect(words(hint.title), id).toBeLessThanOrEqual(3);
  });

  it('use the rules’ words wherever the rules have them', () => {
    const rules = hintText(CONTENT);
    for (const id of Object.keys(rules) as (keyof typeof rules)[]) {
      expect(HINTS[id].text).toBe(rules[id]);
    }
  });
});

describe('the opening’s hints (D-149)', () => {
  const { firstSeed, firstClient } = CONTENT.balance.jobBoard;
  const setup: RunSetup = {
    seed: firstSeed,
    clientId: firstClient,
    crewId: 'generalContractor',
    mode: 'standard',
  };
  const { bedroom, bathroom, closet } = CONTENT.pieces;

  it('walk week 1 through three plays, and name the Bedroom on the first job’s lot', () => {
    const start = rules.newRun(setup);
    expect(HINTS.firstWeek.steps).toHaveLength(3);
    expect(hintFor('firstWeek', start).steps?.[0]).toBe(`Pick the ${bedroom.name}.`);
    // Any other hand: the same three plays, with no card named.
    const other = { ...start, hand: start.hand.filter((c) => c.id !== 'bedroom') };
    expect(hintFor('firstWeek', other)).toBe(HINTS.firstWeek);
  });

  it('name the Bathroom in week 2 once a Bedroom is built, else say the rules’ line', () => {
    const start = rules.newRun(setup);
    const place = rules
      .legalPlays(start)
      .find((p) => p.t === 'place' && start.hand[p.i]?.id === 'bedroom')!;
    const built = rules.apply(start, place).state;
    const named = hintFor('score', built);
    expect(named).toBe(OPENING_HINTS.score);
    expect(named.text).toContain(`the ${bathroom.name} touching the ${bedroom.name}`);
    const passed = rules.apply(start, { t: 'pass' }).state;
    expect(hintFor('score', passed)).toBe(HINTS.score);
  });

  it('say what the third week’s Closet makes, by the content’s names', () => {
    expect(HINTS.sets.text).toContain(closet.name);
    expect(HINTS.sets.text).toContain(CONTENT.sets.suite.name);
  });
});

describe('a hint that asks for a play (D-158)', () => {
  it('has no “Got it”: the opening’s steps, its Bathroom and its Closet', () => {
    expect(HINTS.firstWeek.task).toBe(true);
    expect(OPENING_HINTS.firstWeek.task).toBe(true);
    expect(OPENING_HINTS.score.task).toBe(true);
    expect(HINTS.sets.task).toBe(true);
  });

  it('is no other hint: one that only explains keeps its “Got it”', () => {
    const tasks = new Set<HintId>(['firstWeek', 'sets']);
    for (const id of Object.keys(HINTS) as HintId[]) {
      expect(HINTS[id].task, id).toBe(tasks.has(id) ? true : undefined);
    }
  });
});

describe('how a hint leaves by itself (D-158)', () => {
  const READ = FEEL.hints.readMs;
  const build = (week: number) => ({ week, screen: 'build' as const });
  const since = { ...build(6), at: 1000 };

  it('stays through the week and the screen it came up in', () => {
    expect(momentPassed(build(6), build(6))).toBe(false);
    expect(hintGone('fixture', since, build(6), 1000 + READ * 10, READ)).toBe('stays');
  });

  it('goes with its week once it has been up long enough to read', () => {
    expect(momentPassed(build(6), build(7))).toBe(true);
    expect(hintGone('fixture', since, build(7), 1000 + READ, READ)).toBe('seen');
  });

  it('comes up again when the week left it behind sooner', () => {
    expect(hintGone('fixture', since, build(7), 1000 + READ - 1, READ)).toBe('again');
  });

  it('goes with its screen: the shop’s as the shop closes, in the same week', () => {
    const inShop = { week: 9, screen: 'shop' as const, at: 0 };
    expect(hintGone('shop', inShop, { week: 9, screen: 'shop' }, READ, READ)).toBe('stays');
    expect(hintGone('shop', inShop, build(9), READ, READ)).toBe('seen');
  });

  it('goes with its week when it’s one of the opening’s, read or not (D-149)', () => {
    const shown = { ...build(1), at: 0 };
    expect(hintGone('firstWeek', shown, build(1), READ * 10, READ)).toBe('stays');
    expect(hintGone('firstWeek', shown, build(2), 1, READ)).toBe('seen');
    expect(hintGone('sets', { ...build(3), at: 0 }, build(4), 1, READ)).toBe('seen');
  });
});

describe('the tips to read again (D-158)', () => {
  it('are the hints this browser has been through, in the order the game brings them up', () => {
    expect(seenTips(new Set())).toEqual([]);
    const tips = seenTips(new Set(['strike', 'checklist', 'firstWeek']));
    expect(tips.map((t) => t.id)).toEqual(['firstWeek', 'checklist', 'strike']);
    expect(tips[0]).toMatchObject({ title: HINTS.firstWeek.title, steps: HINTS.firstWeek.steps });
    expect(tips[1]!.text).toBe(HINTS.checklist.text);
  });

  it('leave out an id this build doesn’t know', () => {
    expect(seenTips(new Set(['gone-in-a-later-build']))).toEqual([]);
  });
});

describe('the checklist’s hint (D-158)', () => {
  it('says its lines are bonuses, and nothing about folding', () => {
    expect(HINTS.checklist.text).toContain('bonuses, not requirements');
    expect(HINTS.checklist.text).not.toMatch(/fold|click/i);
  });
});
