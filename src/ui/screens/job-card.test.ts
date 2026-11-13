// A contract's card in short (D-142): the household and the tastes as a line each, their detail
// in the line's tip, in the rules' words; and the house rules a client has in numbers of their own,
// which the card lists with the wishes now that the board names the house rules once.

import { describe, expect, it } from 'vitest';
import { CONTENT, modifierText, specText } from '../../rules/index.ts';
import {
  deliveryLine,
  deliveryTip,
  helps,
  householdLine,
  householdTip,
  ownHouseRules,
  tasteCounts,
  tastesTip,
} from './job-card.ts';

const { hendersons, vladislav, juniper, dale } = CONTENT.clients;

describe("a card's household line", () => {
  it('names who moves in later, with the verb their number takes', () => {
    expect(householdLine(hendersons)).toBe('The twins and Grandma move in later');
    expect(householdLine(vladislav)).toBe('Renfield moves in later');
  });

  it('says the Bedrooms for a household that does not grow', () => {
    const alone = { ...dale, household: { ...dale.household, arrivals: [] } };
    expect(householdLine(alone)).toBe('1–2 Bedrooms to start');
  });

  it('keeps the whole of it in its tip: the rule, then each arrival, when, and what they bring', () => {
    const lines = householdTip(hendersons).split('\n');
    const rule = hendersons.specs.find((s) => s.id === 'roomForEveryone')!;
    expect(lines[0]).toBe(specText(CONTENT, rule));
    // Each milestone's first week: weeks 11 and 21 at five weeks a milestone (D-170).
    const W = CONTENT.balance.weeksPerPhase;
    const [twins, grandma] = hendersons.household.arrivals;
    expect(lines[1]).toBe(`Framing (week ${2 * W + 1}): ${twins!.text}`);
    expect(lines[2]).toBe(`Drywall (week ${4 * W + 1}): ${grandma!.text}`);
    expect(lines).toHaveLength(3);
  });
});

describe('what a client brings for a wish (D-160)', () => {
  it('is a line of its own on Dale’s and the Barkers’ cards, with the verb their number takes', () => {
    expect(deliveryLine(dale)).toBe('Dale brings a Home Office');
    expect(deliveryLine(CONTENT.clients.barkers)).toBe('The Barkers bring a Doghouse');
    for (const client of [hendersons, vladislav, juniper]) expect(deliveryLine(client)).toBeNull();
  });

  it('says when in its tip, as an arrival’s does, and where it waits', () => {
    const lines = deliveryTip(dale).split('\n');
    expect(lines[0]).toBe(`Groundbreaking (week 1): ${dale.deliveries![0]!.text}`);
    expect(lines[1]).toMatch(/reserve/);
    expect(lines).toHaveLength(2);
  });
});

describe("a card's tastes", () => {
  it('are counted: likes, dislikes, and what the draw has more of', () => {
    expect(tasteCounts(hendersons)).toEqual({ likes: 2, dislikes: 1, draws: 1 });
    expect(tasteCounts(dale)).toEqual({ likes: 1, dislikes: 0, draws: 1 });
  });

  it('are all in the tip, a line each in the rules’ words: none is lost from the card', () => {
    for (const client of Object.values(CONTENT.clients)) {
      const lines = tastesTip(client).split('\n');
      expect(lines).toHaveLength(client.tastes.length + client.pool.length);
      for (const m of client.tastes) {
        const word = helps(m) ? 'Likes' : 'Dislikes';
        expect(lines).toContain(`${word}: ${modifierText(CONTENT, m)}`);
      }
      for (const m of client.pool) expect(lines).toContain(`Draws: ${modifierText(CONTENT, m)}`);
    }
  });
});

describe('the house rules a client has in numbers of their own', () => {
  it('are Juniper’s A compact house, for 4–8 rooms, and no one else’s', () => {
    expect(ownHouseRules(juniper).map((s) => s.id)).toEqual(['underOneRoof']);
    for (const client of [hendersons, vladislav, dale, CONTENT.clients.barkers]) {
      expect(ownHouseRules(client)).toEqual([]);
    }
  });

  it('leave Room for everyone to the household’s line', () => {
    for (const client of Object.values(CONTENT.clients)) {
      expect(ownHouseRules(client).map((s) => s.id)).not.toContain('roomForEveryone');
    }
  });
});
