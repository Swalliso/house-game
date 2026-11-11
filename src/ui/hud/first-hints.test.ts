// The first-time hints' budget (D-142): each is one or two short sentences, within HINT_WORDS
// words, so a new player never meets a paragraph. The ones that state a rule are the rules' own
// (text.ts hintText, tested there for their numbers). The opening's (D-149) name their card when
// the hand holds it, and keep to the same budget, their steps counted.

import { describe, expect, it } from 'vitest';
import { CONTENT, HINT_WORDS, hintText, rules, type RunSetup } from '../../rules/index.ts';
import { hintFor, HINTS, OPENING_HINTS, type HintId } from './FirstHints.tsx';

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
