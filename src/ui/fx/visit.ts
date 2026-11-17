// The client at the door (D-182): at a milestone met that isn't the last, the client comes to
// the front door for a moment (D-018: each milestone is a client walkthrough). A heart pops over
// each piece one of their met wishes names, and their own bubble says how their wishes stand: a
// question mark while one is open, a heart once they all hold. Which wishes hold is the rules'
// checklist; this only finds where to draw. Looks are never content, so the figures and the
// table from a wish to its piece live here, in the UI.

import { CONTENT, rules, type ClientId, type PieceId, type RunState } from '../../rules/index.ts';
import { furnitureSpot, occupancy } from '../board/geometry.ts';
import {
  hallLinks,
  houseModel,
  overlaps,
  sunLight,
  WALL,
  type HouseModel,
  type Rect,
} from '../board/house-model.ts';
import { besideWaiting, people, standsClear, waitingBoxes } from '../board/people.ts';
import { CELL, spriteFrames, type SpriteId } from '../sprites.ts';

/** Each client's figure (art/limezu/clients.json): a household shows as one figure. */
export const CLIENT_FIGURES: Record<ClientId, SpriteId> = {
  hendersons: 'client-hendersons',
  vladislav: 'client-vladislav',
  barkers: 'client-barkers',
  juniper: 'client-juniper',
  dale: 'client-dale',
};

/**
 * The wishes that name a piece the board can point at, by client and checklist line, and the
 * type of piece each names. A wish about an area, a pair of rooms or a tag (a fenced yard, a
 * Kitchen beside a Dining Room, Dark rooms, rooms with a view, nothing Loud by an office) names
 * no place the rules can point at: it gets no heart, and counts only toward the client's bubble.
 */
export const WISH_PIECES: Partial<Record<ClientId, Readonly<Record<string, PieceId>>>> = {
  vladislav: { library: 'library' },
  barkers: { doghouses: 'doghouse', mudroom: 'mudroom' },
  dale: { offices: 'homeOffice' },
};

/** At most this many hearts: a wish's pieces could run to a few, and the visit is short. */
export const MAX_HEARTS = 6;

/** How long a bubble takes to open: the pop-in's own frames (visit-pop), played once. */
export function bubbleOpensMs(): number {
  const pop = spriteFrames('visit-pop');
  return pop ? pop.frames * pop.ms : 0;
}

/** A point on the lot in whole art px, from its top left corner. */
export interface ArtPoint {
  readonly x: number;
  readonly y: number;
}

/** What a visit shows, and where. */
export interface Visit {
  readonly clientId: ClientId;
  /** The middle of the client's feet, at the front door (`doorstep`). */
  readonly feet: ArtPoint;
  /** The client's own bubble: a question mark while a wish is open, a heart once all hold. */
  readonly bubble: 'ask' | 'heart';
  /** Where each heart's tail ends: the middle of each piece a met wish names, in wish order. */
  readonly hearts: readonly ArtPoint[];
}

/** Half the figure's width in art px. */
const FIGURE_HALF = 8;
/**
 * The figure as it stands, from its feet: 16 art px wide, its tallest head 24 px up (8 px down
 * its 32 px frame).
 */
const FIGURE_BOX = { w: 2 * FIGURE_HALF, h: 24 } as const;
/**
 * How far below a south door's mat their feet are, in art px: the tallest head (8 art px down
 * its 32 px frame) comes up to the door's sill, so they stand over the mat, clear of the house.
 */
const BELOW_MAT = 16;

/**
 * Where the client stands: at the front door, where the doorbell rings (D-126, `frontDoor` in
 * moments.ts, which gives the mat's middle but not its side), facing us, over its mat and clear
 * of the house. At a door in a south wall they stand below the mat, their head up to the sill:
 * an entry set back between two rooms has room for them there, where beside it a wall may not.
 * At a door in a north wall their feet are on the mat, by the wall, so all of them is north of
 * it. A door in a side wall has them on the mat's outer side. With no front door yet, under the
 * middle of the house's south edge. Null before the first room.
 *
 * D-177: a member of the household waiting for their room stands on that mat too, or at the kerb
 * with no front door, with their suitcase (board/people.ts). Where the client's spot would cover
 * any of them, the client joins the end of their line instead, as the next to wait there would
 * (besideWaiting); with no place free in it, they step out of the line's way (outOfTheirWay).
 */
export function doorstep(state: RunState): ArtPoint | null {
  // The house as the board draws it (the board's own model, from its cache).
  const model = houseModel(state.house, hallLinks(state), sunLight(state), state.setup.clientId);
  const own = atTheDoor(model);
  if (!own) return null;
  const waiting = people(state, model).filter((p) => p.place !== 'room');
  const boxes = waitingBoxes(waiting);
  const box = { x: own.x - FIGURE_HALF, y: own.y - FIGURE_BOX.h, ...FIGURE_BOX };
  if (!boxes.some((b) => overlaps(box, b))) return own;
  return besideWaiting(model, waiting, FIGURE_BOX) ?? outOfTheirWay(model, own, boxes) ?? own;
}

/**
 * Where no place in the waiting line is free: the client's own spot moved just clear of what it
 * covers, in front of the line (south of it), or behind it (north) at a north door and at the
 * kerb, where in front would be the road. Null if even that isn't on the lot and off the house.
 */
function outOfTheirWay(model: HouseModel, own: ArtPoint, boxes: readonly Rect[]): ArtPoint | null {
  const box = { x: own.x - FIGURE_HALF, y: own.y - FIGURE_BOX.h, ...FIGURE_BOX };
  const hit = boxes.filter((b) => overlaps(box, b));
  const side = model.exits.find((e) => e.kind === 'front')?.side;
  const behind = side === undefined || side === 'N';
  const y = behind
    ? Math.min(...hit.map((b) => b.y))
    : Math.max(...hit.map((b) => b.y + b.h)) + FIGURE_BOX.h;
  const at = { x: own.x, y };
  return standsClear(model, at, FIGURE_BOX, boxes) ? at : null;
}

/** The client's own spot at the front door (doorstep's), with nobody else there. */
function atTheDoor(model: HouseModel): ArtPoint | null {
  const front = model.exits.find((e) => e.kind === 'front');
  if (front) {
    const m = front.mat;
    switch (front.side) {
      case 'S':
        return { x: m.x + m.w / 2, y: m.y + m.h + BELOW_MAT };
      case 'N':
        return { x: m.x + m.w / 2, y: m.y + m.h };
      case 'W':
        return { x: m.x + m.w - FIGURE_HALF, y: m.y + m.h };
      case 'E':
        return { x: m.x + FIGURE_HALF, y: m.y + m.h };
    }
  }
  const b = model.bounds;
  if (!b) return null;
  // Where a mat would be: a pixel off the wall, as deep as one.
  return {
    x: Math.round((b.x + b.w / 2) * CELL),
    y: (b.y + b.h) * CELL + 1 + WALL.mat + BELOW_MAT,
  };
}

/**
 * The visit the house as it stands would get, or null with no house to come to. The wishes are
 * the checklist's (`rules.checklist`), so a heart is only ever over a wish the rules say holds.
 */
export function visitOf(state: RunState): Visit | null {
  const feet = doorstep(state);
  if (!feet) return null;
  const clientId = state.setup.clientId;
  const wishes = rules.checklist(state).filter((line) => line.group === 'wishes');
  const named = WISH_PIECES[clientId] ?? {};
  const occ = occupancy(state.house);
  const hearts: ArtPoint[] = [];
  for (const line of wishes) {
    const type = line.met ? named[line.id] : undefined;
    if (!type) continue;
    for (const p of state.house.pieces) {
      if ((CONTENT.pieces[p.defId].countsAs ?? p.defId) !== type) continue;
      const cells = occ.cells.get(p.uid);
      if (!cells?.length) continue;
      const spot = furnitureSpot(cells);
      hearts.push({ x: Math.round((spot.x + 0.5) * CELL), y: Math.round((spot.y + 0.5) * CELL) });
    }
  }
  return {
    clientId,
    feet,
    bubble: wishes.every((line) => line.met) ? 'heart' : 'ask',
    hearts: hearts.slice(0, MAX_HEARTS),
  };
}
