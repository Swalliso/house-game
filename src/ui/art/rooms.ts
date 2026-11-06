// What stands in each room: its furniture as sprites at art px positions on the lot (D-097).
// Sprites never rotate (they're drawn in 3/4 view); a rotated piece only changes its cells.
//
// The house stage's furniture part lays rooms out by slot rules per room type and footprint
// (several LimeZu pieces per room, fixtures as sprites). Until then each room shows its key
// furniture sprite (PIECE_SPRITES) in the middle of its floor, below the north wall's face.

import { furnitureSpot } from '../board/geometry.ts';
import { floorTop, inset, type HouseModel } from '../board/house-model.ts';
import { CELL, PIECE_SPRITES, spritePos, type SpriteId } from '../sprites.ts';

/** One sprite in a room. */
export interface Item {
  sprite: SpriteId;
  /** Its top-left on the lot, in art px. */
  x: number;
  y: number;
  /**
   * The line (lot art px) its top rises above, over the room's north wall: the rows above it
   * are drawn on the overhang layer, over the walls. Without one, all of it stays under them.
   */
  over?: number;
}

/**
 * Which rows of an item's sprite (from its top, [from, to)) go under the walls (`bottom`) and
 * on the overhang above them (`top`): the rows above its `over` line rise over the north wall.
 */
export function itemRows(item: Item): {
  top: [number, number] | null;
  bottom: [number, number] | null;
} {
  const { h } = spritePos(item.sprite);
  const cut = item.over === undefined ? 0 : Math.min(Math.max(item.over - item.y, 0), h);
  return { top: cut > 0 ? [0, cut] : null, bottom: cut < h ? [cut, h] : null };
}

const cache = new WeakMap<HouseModel, Map<number, readonly Item[]>>();

/** The items in room `uid` of the model, back to front. Cached per model. */
export function roomItems(m: HouseModel, uid: number): readonly Item[] {
  let byUid = cache.get(m);
  if (!byUid) cache.set(m, (byUid = new Map()));
  let items = byUid.get(uid);
  if (!items) {
    items = layOut(m, uid);
    byUid.set(uid, items);
  }
  return items;
}

function layOut(m: HouseModel, uid: number): readonly Item[] {
  const room = m.rooms.get(uid);
  if (!room) return [];
  const sprite = PIECE_SPRITES[room.defId].furniture;
  const { w, h } = spritePos(sprite);
  // The middle of the room (an L's corner cell), then down onto the floor below the north
  // wall's face, staying inside the room's box.
  const spot = furnitureSpot(room.cells);
  const cx = Math.round(spot.x * CELL + CELL / 2);
  const col = Math.floor(cx / CELL);
  const rows = room.cells.filter((c) => c.x === col).map((c) => c.y);
  const floor = floorTop(m, col, Math.min(...rows));
  const last = Math.max(...rows);
  const bottom = (last + 1) * CELL - inset(m, col, last, 'S');
  const box = room.box;
  const x = Math.min(Math.max(cx - Math.floor(w / 2), box.x), box.x + box.w - w);
  const want = Math.max(Math.round(spot.y * CELL + CELL / 2 - h / 2), floor);
  const y = Math.min(Math.max(Math.min(want, bottom - h), box.y), box.y + box.h - h);
  return [{ sprite, x, y }];
}
