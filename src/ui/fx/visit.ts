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
  heldSets,
  houseModel,
  overlaps,
  sunLight,
  WALL,
  type HouseModel,
  type Rect,
} from '../board/house-model.ts';
import {
  besideWaiting,
  householdBoxes,
  people,
  standsClear,
  waitingBoxes,
} from '../board/people.ts';
import { CELL, spriteFrames, type SpriteId } from '../sprites.ts';

/** Each client's figure (art/limezu/clients.json): a household shows as one figure. */
export const CLIENT_FIGURES: Record<ClientId, SpriteId> = {
  hendersons: 'client-hendersons',
  vladislav: 'client-vladislav',
  barkers: 'client-barkers',
  juniper: 'client-juniper',
  dale: 'client-dale',
  // D-219: the spike has no art of its own, so the Bigsbys come as the Hendersons' family figure.
  bigsbys: 'client-hendersons',
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
  bigsbys: { playroom: 'playroom' },
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
 * A thought bubble (MomentLayers.tsx draws the client's and each heart's): a 16 × 32 frame whose
 * tail ends at (tailX, tailY) in it, kept on the lot. The client's tail ends `dx` art px right of
 * the middle of their figure, a pixel above its tallest head. What a bubble draws, through each
 * frame of its pop-in and of both icons, is the `drawn` part of its frame.
 */
export const BUBBLE = {
  tailX: 8,
  tailY: 24,
  dx: 4,
  drawn: { x: 1, y: 0, w: 14, h: 24 },
} as const;

/** Where the client's bubble's tail ends, their feet at `feet`. */
export function bubbleTail(feet: ArtPoint): ArtPoint {
  return { x: feet.x + BUBBLE.dx, y: feet.y - FIGURE_BOX.h - 1 };
}

/** What the client's bubble draws over, in lot art px, their feet at `feet`. */
export function bubbleBox(feet: ArtPoint): Rect {
  const tail = bubbleTail(feet);
  return {
    x: tail.x - BUBBLE.tailX + BUBBLE.drawn.x,
    y: Math.max(0, tail.y - BUBBLE.tailY) + BUBBLE.drawn.y,
    w: BUBBLE.drawn.w,
    h: BUBBLE.drawn.h,
  };
}

/** The client's figure, from their tallest head to their feet at `feet`, in lot art px. */
const figureAt = (feet: ArtPoint): Rect => ({
  x: feet.x - FIGURE_HALF,
  y: feet.y - FIGURE_BOX.h,
  ...FIGURE_BOX,
});

/**
 * How far the client steps aside to keep themselves and their bubble off the household, in art
 * px: `along` their row, either way, a figure and a half; and `out` of the line's way, as far as
 * their bubble rises over their head, so that a bubble over the line clears it.
 */
export const STEP_ASIDE = { along: 24, out: BUBBLE.tailY - BUBBLE.drawn.y + 1 } as const;

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
 * with no front door, with their suitcase, and a member with a room stands in one of its doorways,
 * which can be the front door's own (board/people.ts). Neither the client nor their bubble may
 * cover any of them (householdBoxes). Where their own spot would, the client joins the end of the
 * line of those waiting, as the next to wait there would (besideWaiting). With no place free in
 * it, they step out of the line's way (outOfTheirWay), and, where their bubble would still cover
 * someone, to the nearest spot near there that keeps it clear (nearestFit); with nobody waiting
 * in their way, to the nearest one along their own row. Where none is near, the figure at least
 * keeps off the line, as it did before the bubble counted.
 */
export function doorstep(state: RunState): ArtPoint | null {
  // The house as the board draws it (the board's own model, from its cache), the held sets'
  // doors too (D-176): a member may stand in one (board/people.ts doorwaySpot).
  const model = houseModel(
    state.house,
    hallLinks(state),
    sunLight(state),
    state.setup.clientId,
    heldSets(state),
  );
  const own = atTheDoor(model);
  if (!own) return null;
  const household = people(state, model);
  const waiting = household.filter((p) => p.place !== 'room');
  const line = waitingBoxes(waiting);
  const boxes = householdBoxes(household);
  const clear = (at: ArtPoint) =>
    !boxes.some((b) => overlaps(figureAt(at), b) || overlaps(bubbleBox(at), b));
  if (clear(own)) return own;
  const fits = (at: ArtPoint) => clear(at) && standsClear(model, at, FIGURE_BOX, []);
  const aside = outOfTheirWay(model, own, line);
  return (
    besideWaiting(model, waiting, FIGURE_BOX, fits) ??
    nearestFit(aside?.at, fits, aside?.away) ??
    nearestFit(own, fits) ??
    besideWaiting(model, waiting, FIGURE_BOX) ??
    (aside && standsClear(model, aside.at, FIGURE_BOX, line) ? aside.at : null) ??
    own
  );
}

/**
 * Where no place in the waiting line is free: the client's own spot moved just clear of the
 * line's figures and suitcases it covers, in front of the line (south of it), or behind it
 * (north) at a north door and at the kerb, where in front would be the road; and which way is
 * further out of the line's way. Null when it covers none of them.
 */
function outOfTheirWay(
  model: HouseModel,
  own: ArtPoint,
  line: readonly Rect[],
): { at: ArtPoint; away: -1 | 1 } | null {
  const hit = line.filter((b) => overlaps(figureAt(own), b));
  if (hit.length === 0) return null;
  const side = model.exits.find((e) => e.kind === 'front')?.side;
  const behind = side === undefined || side === 'N';
  const y = behind
    ? Math.min(...hit.map((b) => b.y))
    : Math.max(...hit.map((b) => b.y + b.h)) + FIGURE_BOX.h;
  return { at: { x: own.x, y }, away: behind ? -1 : 1 };
}

/**
 * The nearest spot to `from` that `fits`, by |dx| + |dy| (of two as near, the one nearer its row,
 * then the one east): up to STEP_ASIDE.along either way along its row, and with `away`, up to
 * STEP_ASIDE.out further that way, south (1) or north (−1). Null if none does.
 */
function nearestFit(
  from: ArtPoint | undefined,
  fits: (at: ArtPoint) => boolean,
  away: -1 | 0 | 1 = 0,
): ArtPoint | null {
  if (!from) return null;
  const out = away === 0 ? 0 : STEP_ASIDE.out;
  for (let d = 0; d <= STEP_ASIDE.along + out; d++) {
    for (let k = 0; k <= Math.min(d, out); k++) {
      const dx = d - k;
      if (dx > STEP_ASIDE.along) continue;
      for (const x of dx === 0 ? [from.x] : [from.x + dx, from.x - dx]) {
        const at = { x, y: from.y + away * k };
        if (fits(at)) return at;
      }
    }
  }
  return null;
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
