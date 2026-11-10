// The fold carets (▸ ▾, which the pixel fonts lack): one 8×8 box for both, so a fold row keeps
// its place when it opens, and the open caret is the closed one turned a quarter, with an ink
// outline all round like the other icons. theme.test.ts checks every grid and the palette.

import { describe, expect, it } from 'vitest';
import { gridRows, ICON_SIZES } from './art.ts';
import { ICONS } from './icons.ts';

/** The drawn cells as "x,y", moved so the shape's top-left corner is 0,0. */
function shape(rows: readonly string[]): Set<string> {
  const cells = rows.flatMap((row, y) =>
    [...row].flatMap((ch, x) => (ch === '.' ? [] : [[x, y] as const])),
  );
  const x0 = Math.min(...cells.map(([x]) => x));
  const y0 = Math.min(...cells.map(([, y]) => y));
  return new Set(cells.map(([x, y]) => `${x - x0},${y - y0}`));
}

/** A shape turned a quarter clockwise. */
function turned(cells: Set<string>): Set<string> {
  const pts = [...cells].map((c) => c.split(',').map(Number) as [number, number]);
  const h = Math.max(...pts.map(([, y]) => y)) + 1;
  return new Set(pts.map(([x, y]) => `${h - 1 - y},${x}`));
}

describe('the carets', () => {
  it('share one 8×8 box', () => {
    expect(ICON_SIZES.caretRight).toEqual({ w: 8, h: 8 });
    expect(ICON_SIZES.caretDown).toEqual({ w: 8, h: 8 });
  });

  it('are one triangle: the open one is the closed one turned a quarter', () => {
    const right = shape(gridRows(ICONS.caretRight));
    expect([...turned(right)].sort()).toEqual([...shape(gridRows(ICONS.caretDown))].sort());
  });

  it('are outlined in ink, with a fill inside', () => {
    for (const name of ['caretRight', 'caretDown'] as const) {
      const rows = gridRows(ICONS[name]);
      const at = (x: number, y: number) => rows[y]?.[x] ?? '.';
      const edge: string[] = [];
      let fill = 0;
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === '.') return;
          const open = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('.');
          if (open) edge.push(ch);
          else if (ch !== 'k') fill++;
        }),
      );
      expect(new Set(edge), name).toEqual(new Set(['k']));
      expect(fill, name).toBeGreaterThan(0);
    }
  });
});
