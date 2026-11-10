// Paints the end screen's photos (D-136): the house at a milestone, through the run's frame,
// with the board's own painters in the board's order (layers.ts), as one picture at art
// resolution:
// - the terrain (TerrainLayer's draw) and the water's first frame,
// - the floor canvas (the yard's ground, the house's shadow, doormats, floors and wall faces),
// - every piece's items under the walls, south in front, as the items layer orders them,
// - the walls, then the tall items' tops over them (the overhang layer),
// - the trees' crowns (the canopy).
// No roof (the photos look inside, under the hero's roof), no digits or badges, and no tint.
//
// It paints from the state it's given, never through the board's components, so it can't touch
// the live board's caches or its car's slide (HouseLayers' lastCar).

import type { RunState } from '../../rules/index.ts';
import { artSize } from '../art/drawings.ts';
import { Canvas, paintFloors, paintWalls, type AtlasPixels } from '../art/house-paint.ts';
import { itemRows, roomItems, type Item } from '../art/rooms.ts';
import { yardModel } from '../art/yard.ts';
import { atlasPixels } from '../board/HouseLayers.tsx';
import { hallLinks, houseModel, sunLight, type Rect } from '../board/house-model.ts';
import { draw, streetFront } from '../board/TerrainLayer.tsx';
import { seedSalt } from '../board/terrain/hash.ts';
import { canopyBox, lotObjects, paintCanopy } from '../board/terrain/objects.ts';
import { paintWater, waterPlan } from '../board/terrain/water.ts';
import { atlasImage, CELL } from '../sprites.ts';
import type { PhotoFrame } from './photos.ts';

function canvas(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** An item's rows under the walls (`bottom`) or over them (`top`), as the board draws them. */
function blitPart(cv: Canvas, atlas: AtlasPixels, it: Item, part: 'top' | 'bottom'): void {
  const rows = itemRows(it)[part];
  if (!rows) return;
  const [from, to] = rows;
  // One frame of an animated item: its first, as the overhang always shows.
  cv.blit(atlas, it.sprite, it.x, it.y + from, {
    x: 0,
    y: from,
    w: artSize(it.sprite).w,
    h: to - from,
  });
}

/** The house at `state`, through `frame`, as a canvas at art resolution. */
export async function paintPhoto(state: RunState, frame: PhotoFrame): Promise<HTMLCanvasElement> {
  const [img, atlas] = await Promise.all([atlasImage(), atlasPixels()]);
  const { house } = state;
  const { lot } = house;
  const salt = seedSalt(state.setup.seed);
  const objects = lotObjects(lot, salt);

  // The ground, on a canvas the frame's size: the terrain, then the water's still frame.
  const ground = canvas(frame.w, frame.h);
  ground.translate(-frame.x, -frame.y);
  draw(ground, img, lot, objects, salt, streetFront(house));
  ground.setTransform(1, 0, 0, 1, 0, 0);
  const water = waterPlan(lot, salt);
  if (water.box) {
    const w = canvas(water.box.w * CELL, water.box.h * CELL);
    paintWater(w, img, water, 0);
    ground.drawImage(w.canvas, water.box.x * CELL - frame.x, water.box.y * CELL - frame.y);
  }
  const cv = new Canvas(frame.x, frame.y, frame.w, frame.h);
  cv.data.set(ground.getImageData(0, 0, frame.w, frame.h).data);

  // The house, as the board draws it.
  const model = houseModel(house, hallLinks(state), sunLight(state));
  const yard = yardModel(house, model);
  const floors = paintFloors(model, atlas, { yard });
  if (floors) cv.over(floors);
  const pieces: { box: Rect; items: readonly Item[]; i: number }[] = [];
  house.pieces.forEach((p, i) => {
    const room = model.rooms.get(p.uid);
    const at = room ? { box: room.box, items: roomItems(model, p.uid) } : yard.pieces.get(p.uid);
    if (at) pieces.push({ box: at.box, items: at.items, i });
  });
  // South in front: each piece by its bottom row, ties in the house's order (the DOM's).
  pieces.sort((a, b) => a.box.y + a.box.h - (b.box.y + b.box.h) || a.i - b.i);
  for (const p of pieces) for (const it of p.items) blitPart(cv, atlas, it, 'bottom');
  const walls = paintWalls(model);
  if (walls) cv.over(walls);
  for (const p of pieces) for (const it of p.items) blitPart(cv, atlas, it, 'top');

  // The trees' crowns over everything.
  const crowns = canopyBox(lot, objects);
  if (crowns) {
    const c = canvas(crowns.w, crowns.h);
    paintCanopy(c, img, objects, crowns);
    const d = c.getImageData(0, 0, crowns.w, crowns.h);
    cv.over({ x: crowns.x, y: crowns.y, w: crowns.w, h: crowns.h, data: d.data });
  }

  const out = canvas(frame.w, frame.h);
  out.putImageData(
    new ImageData(cv.data as Uint8ClampedArray<ArrayBuffer>, frame.w, frame.h),
    0,
    0,
  );
  return out.canvas;
}
