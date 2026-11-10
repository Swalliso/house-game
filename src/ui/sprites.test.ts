// The crews' icons (D-111): one for each crew, each its own, and 8×8 like the icons that sit in
// a line of text, so a crew's chip stands as tall as a tag's and its picture on the crew pick
// scales by whole UI pixels. The blueprints' icons (D-141): one for each blueprint, no two
// alike, and none borrowed from another good, a tag, or a kind of good.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../rules/index.ts';
import { BLUEPRINT_ICONS, CREW_ICONS, FIXTURE_ICONS, TOOL_ICONS } from './sprites.ts';
import { gridRows, ICON_SIZES } from './theme/art.ts';
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

describe("the blueprints' icons (D-141)", () => {
  const icons = Object.values(BLUEPRINT_ICONS);

  it('give every blueprint an icon of its own', () => {
    expect(Object.keys(BLUEPRINT_ICONS).sort()).toEqual(Object.keys(CONTENT.blueprints).sort());
    for (const icon of icons) expect(ICONS, icon).toHaveProperty(icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('are drawn differently: no two grids are the same picture', () => {
    const drawn = icons.map((icon) => gridRows(ICONS[icon]).join('/'));
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it("aren't another good's icon, a tag's, or the kind's", () => {
    const taken = new Set<string>([
      ...Object.values(FIXTURE_ICONS),
      ...Object.values(TOOL_ICONS),
      ...Object.values(CREW_ICONS),
      ...Object.values(CONTENT.pieces).flatMap((p) => p.tags),
      'blueprint',
      'fixture',
      'tool',
      'crate',
      'upgrade',
    ]);
    for (const icon of icons) expect(taken.has(icon), icon).toBe(false);
  });

  it('stand as tall as a tool’s or a fixture’s: 8 or 9 art px', () => {
    for (const [id, icon] of Object.entries(BLUEPRINT_ICONS)) {
      const { w, h } = ICON_SIZES[icon];
      expect(w === h && (w === 8 || w === 9), `${id}: ${w}×${h}`).toBe(true);
    }
  });
});
