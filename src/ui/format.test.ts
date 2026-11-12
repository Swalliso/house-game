// Where a long name breaks (format.ts SOFT_BREAKS): only at its soft hyphens, and every long
// word a card shows has them or was measured to fit. A card's title uses them (kit.tsx Card), so
// a name never runs off its card.

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../rules/index.ts';
import { SERVICE_NAMES } from '../rules/shop.ts';
import { breakable, SOFT_BREAKS } from './format.ts';
import { Card } from './kit/kit.tsx';

/** Every name a card's title can show: the shop's goods, the hand's cards, the job board's. */
const CARD_NAMES = [
  ...Object.values(CONTENT.pieces),
  ...Object.values(CONTENT.fixtures),
  ...Object.values(CONTENT.tools),
  ...Object.values(CONTENT.blueprints),
  ...Object.values(CONTENT.crates),
  ...Object.values(CONTENT.upgrades),
  ...Object.values(CONTENT.clients),
  ...Object.values(CONTENT.crews),
]
  .map((d) => d.name)
  .concat(Object.values(SERVICE_NAMES));

/**
 * Long words measured in headless Chrome to fit every card that shows them, in both fonts, at
 * 1728×963 at 2×, 1440×900 at 2×, 1920×1080 and 1280×720: each with why it has no soft hyphen.
 */
const FITS: Readonly<Record<string, string>> = {
  Entertainer:
    'fills a card title’s 84 UI px exactly; a soft hyphen broke “Remodel Plans: Entertainer” mid-word instead of at its space (2026-11-11)',
};

const letters = (word: string) => word.match(/\p{L}/gu)?.length ?? 0;

/** The host elements a tree renders, function components called in place (Card has no hooks). */
function* hosts(node: ComponentChildren): Generator<VNode<Record<string, unknown>>> {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* hosts(n);
    return;
  }
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function') {
    yield* hosts((v.type as (p: unknown) => ComponentChildren)(v.props));
    return;
  }
  yield v;
  yield* hosts(v.props.children as ComponentChildren);
}

describe('soft breaks in names', () => {
  it('put soft hyphens in the listed words, and change nothing else', () => {
    expect(breakable('Soundproofing')).toBe('Sound\u00ADproofing');
    expect(breakable('Remodel Plans: Entertainer')).toBe('Remodel Plans: Entertainer');
    expect(breakable('Inspector’s Visit')).toBe('Inspector’s Visit');
    // Only the list's own words, not a plain object's.
    expect(breakable('constructor toString')).toBe('constructor toString');
    for (const [word, broken] of Object.entries(SOFT_BREAKS)) {
      expect(broken.replaceAll('\u00AD', ''), word).toBe(word);
    }
  });

  it("are in a card's title", () => {
    const title = (name: string) =>
      [...hosts(Card({ title: name }))].find((v) => v.props.class === 'pcard-title')?.props
        .children;
    expect(title('Soundproofing')).toBe('Sound\u00ADproofing');
    expect(title('Remodel Plans: Entertainer')).toBe('Remodel Plans: Entertainer');
  });

  // A shop card's title is 84 UI px wide: "Entertainer", 11 letters of the bold pixel font,
  // fills it exactly, and "Soundproofing" (101 UI px) ran off the card in a playtest
  // (2026-11-11). A word's own hyphens break it already, so each part counts on its own. A long
  // word that fits goes in FITS, with its reason, once it's measured: the check stays at 11.
  it('cover every word of 11 letters or more that a card shows', () => {
    const long = CARD_NAMES.flatMap((name) => name.split(' '))
      .filter((w) => w.split('-').some((part) => letters(part) >= 11))
      .filter((w) => !Object.hasOwn(SOFT_BREAKS, w) && !Object.hasOwn(FITS, w));
    expect(long).toEqual([]);
  });

  it('list a word as fitting or as breaking, never both', () => {
    expect(Object.keys(FITS).filter((w) => Object.hasOwn(SOFT_BREAKS, w))).toEqual([]);
  });
});
