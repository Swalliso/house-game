// First contact (D-142): the short texts a new player meets first come from the rules data,
// and every first-time hint that states a rule keeps to the budget of words.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/index.ts';
import { HINT_WORDS, hintText, houseRulesText, type HintTerm } from './text.ts';

const words = (text: string) => text.trim().split(/\s+/).length;

describe('the house rules, named once for the job board', () => {
  const lines = houseRulesText(CONTENT).split('\n');

  it('names each house rule once, in the checklist’s order, whichever client has it', () => {
    const hendersons = CONTENT.clients.hendersons.specs
      .filter((s) => s.group !== 'wishes')
      .map((s) => s.name);
    expect(lines.slice(0, -1)).toEqual(hendersons);
    for (const client of Object.values(CONTENT.clients)) {
      for (const spec of client.specs) {
        if (spec.group !== 'wishes') expect(lines).toContain(spec.name);
        else expect(lines).not.toContain(spec.name);
      }
    }
  });

  it('ends with what a held one adds, from the balance', () => {
    expect(lines.at(-1)).toBe('Each adds +0.25 Charm in every week it holds.');
    const dearer = {
      ...CONTENT,
      balance: { ...CONTENT.balance, rules: { ...CONTENT.balance.rules, specBonus: 50 } },
    };
    expect(houseRulesText(dearer).split('\n').at(-1)).toContain('+0.5 Charm');
  });
});

describe('the first-time hints that state a rule', () => {
  const hints = hintText(CONTENT);

  it(`keep to ${HINT_WORDS} words each`, () => {
    for (const id of Object.keys(hints) as HintTerm[]) {
      expect(words(hints[id]), `${id}: “${hints[id]}”`).toBeLessThanOrEqual(HINT_WORDS);
    }
  });

  it('take their numbers from the balance', () => {
    const b = CONTENT.balance;
    expect(hints.shop).toContain(`pays ${b.milestoneBudget} more`);
    expect(hints.early).toContain(`${b.early.budgetPerWeek[0]} budget`);
    expect(hints.early).toContain(`${b.early.scorePct[0]}%`);
    expect(hints.renovate).toContain(`+${b.renovate.pointsPerLevel} Comfort a level`);
    expect(hints.renovate).toContain(`up to ${b.renovate.maxLevel}.`);
    expect(hints.checklist).toContain('+0.25 Charm');
  });
});
