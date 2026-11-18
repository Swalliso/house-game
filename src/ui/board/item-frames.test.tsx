// An animated item steps as one: where it rises over its room's north wall, its rows on the
// overhang layer slide through the same frames, as long and in the same steps, as its rows under
// the walls. The Count's wall candle (D-183) hangs on an outside wall's band and face, with all of
// its flame on the band: with its top held on the first frame, the flame never flickered and only
// the glow under it did. Both layers key an item's parts by its place in its piece's whole list,
// and each part's strip by the item, so the two parts' strips are made in one render and start
// together.

import type { VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import atlas from '../../../assets/atlas.json';
import type { HouseState } from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { itemRows, roomItems, type Item } from '../art/rooms.ts';
import { yardModel } from '../art/yard.ts';
import { CELL, spriteStyle, type SpriteId } from '../sprites.ts';
import { ItemPart, OverhangLayer } from './HouseLayers.tsx';
import { WALL, houseModel } from './house-model.ts';

type Props = Record<string, unknown> & { style: Record<string, string> };
type Node = VNode<Props>;

/** An item's part as ItemPart draws it, at 2 CSS px per art px. */
const draw = (item: Item, part: 'top' | 'bottom') =>
  ItemPart({ item, box: { x: 0, y: 0 }, scale: 2, part }) as Node | null;

/** An animated part's strip of frames (the box's one child), or undefined for a still one. */
const strip = (v: Node) => (v.props.children as Node | undefined)?.props;

/** The strip's key: the same in both parts, so they're made anew together. */
const stripKey = (v: Node) => (v.props.children as Node).key;

/** How a part's frames step: the strip's width, its cycle, its steps and how far it slides. */
const timing = (v: Node) => {
  const s = strip(v)!.style;
  return [s.width, s.animationDuration, s.animationTimingFunction, s['--item-frames']];
};

/** The Count's first Bedroom, alone at (4, 4): its north wall is an outside one. */
function countsBedroom() {
  const house: HouseState = {
    lot: lotFromRows(Array.from({ length: 12 }, () => '.'.repeat(12))),
    pieces: [{ uid: 1, defId: 'bedroom', x: 4, y: 4, rot: 0, placedWeek: 0 }],
    nextUid: 2,
  };
  const model = houseModel(house, undefined, null, 'vladislav');
  return { house, model, items: roomItems(model, 1) };
}

describe('an animated item’s parts', () => {
  it('step together over and under the walls: the Count’s candle flickers on an outside wall', () => {
    const candle = countsBedroom().items.find((it) => it.sprite === 'wall-candle')!;
    expect(candle).toBeDefined();
    // Its top six rows (the flame's, rows 1 to 4, among them) are on the overhang, over the band.
    expect(itemRows(candle)).toEqual({ top: [0, WALL.out], bottom: [WALL.out, 14] });
    const top = draw(candle, 'top')!;
    const bottom = draw(candle, 'bottom')!;
    expect(strip(top)?.class).toBe('item-frames');
    expect(strip(bottom)?.class).toBe('item-frames');
    // Three frames 12 art px apart, 160 ms each, at 2 CSS px per art px.
    expect(timing(top)).toEqual(['72px', '480ms', 'steps(3)', '-72px']);
    expect(timing(bottom)).toEqual(timing(top));
    expect(stripKey(top)).toBe(`wall-candle@${candle.x},${candle.y}`);
    expect(stripKey(bottom)).toBe(stripKey(top));
    // Each part shows its own rows of each frame.
    const [bx, by] = spriteStyle('wall-candle', 2)
      .backgroundPosition!.split(' ')
      .map((v) => Number.parseFloat(v));
    expect(top.props.style.height).toBe(`${WALL.out * 2}px`);
    expect(strip(top)!.style.backgroundPosition).toBe(`${bx}px ${by!}px`);
    expect(bottom.props.style.height).toBe(`${WALL.face * 2}px`);
    expect(strip(bottom)!.style.backgroundPosition).toBe(`${bx}px ${by! - WALL.out * 2}px`);
  });

  it('step together for every animated sprite, wherever its over line falls', () => {
    const sprites = Object.entries(atlas.sprites).filter(([, s]) => 'frames' in s);
    expect(sprites.length).toBeGreaterThan(0);
    for (const [id, s] of sprites) {
      for (let cut = 1; cut < s.h; cut++) {
        const item: Item = { sprite: id as SpriteId, x: CELL, y: CELL, over: CELL + cut };
        const top = draw(item, 'top')!;
        const bottom = draw(item, 'bottom')!;
        expect(strip(top)?.class, `${id} ${cut}`).toBe('item-frames');
        expect(timing(top), `${id} ${cut}`).toEqual(timing(bottom));
        expect(stripKey(top), `${id} ${cut}`).toBe(stripKey(bottom));
      }
    }
  });

  it('leave a still item’s top a still picture', () => {
    const item: Item = { sprite: 'wardrobe-0', x: CELL, y: CELL, over: CELL + WALL.out };
    for (const part of ['top', 'bottom'] as const) {
      const v = draw(item, part)!;
      expect(strip(v), part).toBeUndefined();
      expect(v.props.class).toBe('item');
    }
  });

  it('are keyed alike in both layers: the overhang has its piece’s whole list, as under the walls', () => {
    const { house, model, items } = countsBedroom();
    const layer = OverhangLayer({ model, yard: yardModel(house, model), scale: 2 }) as Node;
    const pieces = [layer.props.children as Node[]].flat().filter(Boolean) as Node[];
    const room = pieces.find((p) => p.props.uid === 1)!;
    // The same list the items layer keys by place (roomItems is cached per model), not its tops.
    expect(room.props.items).toBe(items);
    expect(items.some((it) => !itemRows(it).top)).toBe(true);
  });
});
