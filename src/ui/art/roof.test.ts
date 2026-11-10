import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../rules/index.ts';
import { emptyRows, houseFrom } from '../../rules/testing.ts';
import { houseModel } from '../board/house-model.ts';
import { CELL } from '../sprites.ts';
import { isLimeZuColor } from './palette.ts';
import { paintRoof } from './roof.ts';

const hex = (d: Uint8ClampedArray, i: number) =>
  [d[i]!, d[i + 1]!, d[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('');

describe('paintRoof (D-127)', () => {
  it('has nothing to cover before the first room', () => {
    const house = houseFrom(CONTENT, emptyRows(8, 8));
    expect(paintRoof(houseModel(house))).toBeNull();
  });

  it("covers every room's cells, past the walls by its eaves, and nothing far off", () => {
    // An L: a Living Room and a Bedroom beside it.
    const house = houseFrom(CONTENT, emptyRows(10, 10), [
      ['livingRoom', 2, 2],
      ['bedroom', 2 + CONTENT.pieces.livingRoom.shape[0]!.length, 2],
    ]);
    const m = houseModel(house);
    const roof = paintRoof(m)!;
    expect(roof.w).toBe(m.width * CELL);
    const opaque = (x: number, y: number) => roof.data[(y * roof.w + x) * 4 + 3] === 255;
    for (let cy = 0; cy < m.height; cy++) {
      for (let cx = 0; cx < m.width; cx++) {
        const mid = opaque(cx * CELL + CELL / 2, cy * CELL + CELL / 2);
        expect(mid, `cell ${cx},${cy}`).toBe(m.room[cy * m.width + cx] !== 0);
      }
    }
    // The eaves reach a little past the walls, and no further.
    const b = m.bounds!;
    expect(opaque(b.x * CELL - 1, b.y * CELL + 10)).toBe(true);
    expect(opaque(b.x * CELL - 8, b.y * CELL + 10)).toBe(false);
  });

  it("is drawn in LimeZu's palette", () => {
    const house = houseFrom(CONTENT, emptyRows(8, 8), [['livingRoom', 1, 1]]);
    const roof = paintRoof(houseModel(house))!;
    const colors = new Set<string>();
    for (let i = 0; i < roof.data.length; i += 4)
      if (roof.data[i + 3]) colors.add(hex(roof.data, i));
    expect(colors.size).toBeGreaterThan(4);
    for (const c of colors) expect(isLimeZuColor(c), c).toBe(true);
  });
});
