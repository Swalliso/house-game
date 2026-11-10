// The crews' icons (D-111): one for each crew, each its own, and 8×8 like the icons that sit in
// a line of text, so a crew's chip stands as tall as a tag's and its picture on the crew pick
// scales by whole UI pixels.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../rules/index.ts';
import { CREW_ICONS } from './sprites.ts';
import { ICON_SIZES } from './theme/art.ts';
import { ICONS } from './theme/icons.ts';

describe("the crews' icons", () => {
  it('give every crew an icon of its own', () => {
    expect(Object.keys(CREW_ICONS).sort()).toEqual(Object.keys(CONTENT.crews).sort());
    const icons = Object.values(CREW_ICONS);
    for (const icon of icons) expect(ICONS, icon).toHaveProperty(icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('are 8×8', () => {
    for (const [crew, icon] of Object.entries(CREW_ICONS)) {
      expect(ICON_SIZES[icon], crew).toEqual({ w: 8, h: 8 });
    }
  });

  it("aren't a tag's icon, which would read as a crew that pays for that tag", () => {
    const tags = new Set<string>(Object.values(CONTENT.pieces).flatMap((p) => p.tags));
    for (const icon of Object.values(CREW_ICONS)) expect(tags.has(icon), icon).toBe(false);
  });
});
