// What stands in each room (D-097). Until the furniture part, each room shows its key furniture
// sprite on its floor; an item that rises over its north wall splits for the overhang layer.

import { describe, expect, it } from 'vitest';
import { CONTENT, placedCells, type PieceId, type Rot } from '../../rules/index.ts';
import { pieceModel } from '../board/house-model.ts';
import { spritePos } from '../sprites.ts';
import { itemRows, roomItems } from './rooms.ts';

const ROOMS = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
  (id) => CONTENT.pieces[id].category === 'indoor',
);

describe('room items', () => {
  it('stay inside their room, for every room type and rotation', () => {
    for (const id of ROOMS) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const m = pieceModel(id, rot);
        const items = roomItems(m, 1);
        expect(items.length, id).toBeGreaterThan(0);
        const cells = placedCells(CONTENT.pieces[id].shape, 0, 0, rot);
        for (const it of items) {
          const { w, h } = spritePos(it.sprite);
          // Its bottom row stands on one of the room's cells, and it never leaves the room's box.
          const foot = { x: Math.floor((it.x + w / 2) / 32), y: Math.floor((it.y + h - 1) / 32) };
          expect(
            cells.some((c) => c.x === foot.x && c.y === foot.y),
            `${id} ${rot}`,
          ).toBe(true);
          expect(it.x).toBeGreaterThanOrEqual(0);
          expect(it.y).toBeGreaterThanOrEqual(0);
          expect(it.x + w).toBeLessThanOrEqual(m.width * 32);
          expect(it.y + h).toBeLessThanOrEqual(m.height * 32);
        }
      }
    }
  });

  it('split at their over line: the rows above it rise over the walls', () => {
    const { h } = spritePos('bed');
    expect(itemRows({ sprite: 'bed', x: 0, y: 40 })).toEqual({ top: null, bottom: [0, h] });
    expect(itemRows({ sprite: 'bed', x: 0, y: 40, over: 46 })).toEqual({
      top: [0, 6],
      bottom: [6, h],
    });
    expect(itemRows({ sprite: 'bed', x: 0, y: 40, over: 30 })).toEqual({
      top: null,
      bottom: [0, h],
    });
    expect(itemRows({ sprite: 'bed', x: 0, y: 40, over: 40 + h })).toEqual({
      top: [0, h],
      bottom: null,
    });
  });
});
