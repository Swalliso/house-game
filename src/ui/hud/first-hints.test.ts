// The first-time hints' budget (D-142): each is one or two short sentences, within HINT_WORDS
// words, so a new player never meets a paragraph. The ones that state a rule are the rules' own
// (text.ts hintText, tested there for their numbers).

import { describe, expect, it } from 'vitest';
import { CONTENT, HINT_WORDS, hintText } from '../../rules/index.ts';
import { HINTS, type HintId } from './FirstHints.tsx';

const words = (text: string) => text.trim().split(/\s+/).length;

describe('the first-time hints', () => {
  const ids = Object.keys(HINTS) as HintId[];

  it(`keep to ${HINT_WORDS} words each`, () => {
    for (const id of ids) {
      const { text } = HINTS[id];
      expect(words(text), `${id}: “${text}”`).toBeLessThanOrEqual(HINT_WORDS);
    }
  });

  it('have a short title each', () => {
    for (const id of ids) expect(words(HINTS[id].title), id).toBeLessThanOrEqual(3);
  });

  it('use the rules’ words wherever the rules have them', () => {
    const rules = hintText(CONTENT);
    for (const id of Object.keys(rules) as (keyof typeof rules)[]) {
      expect(HINTS[id].text).toBe(rules[id]);
    }
  });
});
