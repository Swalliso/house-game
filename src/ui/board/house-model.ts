// The house as the board draws it (D-097): a walls-down cutaway built from the placed pieces
// by fixed rules, never by chance, so the same house always looks the same (photos and
// replays depend on it). Pure: no DOM. Cached per house, like occupancy() in geometry.ts.
//
// - Edges. Every cell edge is no wall (one piece on both sides, or no room on either), a wall
//   between two rooms (any two pieces, same type included, so rooms never merge: D-093), an
//   outside wall (a room next to anything else, or the lot's edge), or a garage door.
// - Doorways are decoration and change no score. Hallways open into every room the rules link
//   through them (rules.describePiece's `linked`). A front door goes in a street-facing wall of
//   the best entry room, a back door onto each touching Patio or Hot Tub, and a garage door
//   faces a Driveway or the street. Then a spanning tree from the entry, public rooms first,
//   adds as few doors as it takes to reach every room. Doors keep to side walls and the ends
//   of north walls: a north wall's middle is for furniture.
// - Windows go in outside walls, about one per two cells of straight wall, except in closets,
//   garages and hallways.
//
// Geometry is in art px on the lot (CELL per cell, x right, y down); WALL has the sizes.

import {
  CONTENT,
  rules,
  terrainAt,
  type Cell,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type RunState,
} from '../../rules/index.ts';
import { CELL } from '../sprites.ts';
import { isIndoor, occupancy } from './geometry.ts';

export type Side = 'N' | 'E' | 'S' | 'W';

/** What a cell edge is. */
export const EDGE = { none: 0, inner: 1, outer: 2, garage: 3 } as const;
export type EdgeKind = (typeof EDGE)[keyof typeof EDGE];

/** Wall geometry in art px (§12 Art: the audit prototype's numbers). */
export const WALL = {
  /** An outside wall's band, all inside the room, so the house ends where its cells do. */
  out: 6,
  /** A wall between two rooms, centered on their boundary: half on each side. */
  in: 4,
  /** A north wall's face under its band, in the room's wallpaper (the 3/4 view). */
  face: 8,
  /** A doorway between rooms, and the narrower one where that won't fit. */
  door: 14,
  narrowDoor: 10,
  /** An outside door, and its doormat's depth. */
  exit: 16,
  mat: 6,
  /** A window, and a bathroom's. */
  window: 12,
  smallWindow: 8,
  /** A garage door's rail, where the band would be. */
  rail: 4,
  /** The floor's shadow under a north face and beside a west wall. */
  shadow: 3,
} as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A doorway between two indoor pieces. */
export interface Doorway {
  /** The pieces it joins: `a` is north of a horizontal wall, or west of a vertical one. */
  a: number;
  b: number;
  /** In a horizontal wall (h, the north wall of `b`) or a vertical one (v). */
  dir: 'h' | 'v';
  /** The opening through the wall band. */
  gap: Rect;
  /** The floor around it to keep clear of furniture. */
  clear: Rect;
  /** Why it's there: a Hallway's link, or the tree that reaches every room. */
  why: 'hall' | 'tree';
}

/** A door in an outside wall. */
export interface Exit {
  uid: number;
  /** The front door, a back door onto a Patio or Hot Tub, or the own door of a part of the house no doorway reaches. */
  kind: 'front' | 'back' | 'side';
  side: Side;
  /** The room's cell it's in. */
  cell: Cell;
  gap: Rect;
  clear: Rect;
  /** The doormat outside it. */
  mat: Rect;
  /** What it opens onto: a yard piece's uid, or 0 for open ground or the street. */
  onto: number;
}

/** A garage door: a run of a Garage's outside edges on one side, facing a Driveway or the street. */
export interface GarageDoor {
  uid: number;
  side: Side;
  cells: readonly Cell[];
  /** The rail, where the wall band would be. */
  rail: Rect;
}

export interface WindowPane {
  uid: number;
  side: Side;
  /** The glass, across the whole depth of the outside wall's band. */
  rect: Rect;
}

export interface Room {
  uid: number;
  defId: PieceId;
  cells: readonly Cell[];
  /** Its bounding box. */
  box: Rect;
}

export interface HouseModel {
  /** The lot, in cells. */
  width: number;
  height: number;
  /** The room (indoor piece) on each cell, by uid, or 0. */
  room: Int32Array;
  /** Edge kinds: h[y × width + x] is the top edge of cell (x, y), for y from 0 to height. */
  h: Uint8Array;
  /** v[y × (width + 1) + x] is the left edge of cell (x, y), for x from 0 to width. */
  v: Uint8Array;
  /** The indoor pieces, in placement order. */
  rooms: ReadonlyMap<number, Room>;
  doors: readonly Doorway[];
  exits: readonly Exit[];
  garageDoors: readonly GarageDoor[];
  windows: readonly WindowPane[];
  /** The rooms' bounding box in cells, or null before the first room. */
  bounds: Rect | null;
}

/** The rooms each room is linked to through Hallways: rules.describePiece's `linked`, by uid. */
export type HallLinks = ReadonlyMap<number, readonly number[]>;

const NO_LINKS: HallLinks = new Map();

const STEP: Readonly<Record<Side, readonly [number, number]>> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};
const SIDES: readonly Side[] = ['N', 'E', 'S', 'W'];

// ---------------------------------------------------------------------------------------
// Reading a model.

/** The kind of cell (x, y)'s edge on `side`. The cell must be on the lot. */
export function edge(m: HouseModel, x: number, y: number, side: Side): EdgeKind {
  const w = m.width;
  const k =
    side === 'N'
      ? m.h[y * w + x]
      : side === 'S'
        ? m.h[(y + 1) * w + x]
        : side === 'W'
          ? m.v[y * (w + 1) + x]
          : m.v[y * (w + 1) + x + 1];
  return (k ?? EDGE.none) as EdgeKind;
}

/** How deep cell (x, y)'s wall on `side` reaches into the cell, in art px: 0 with no wall. */
export function inset(m: HouseModel, x: number, y: number, side: Side): number {
  const k = edge(m, x, y, side);
  return k === EDGE.outer
    ? WALL.out
    : k === EDGE.inner
      ? WALL.in / 2
      : k === EDGE.garage
        ? WALL.rail
        : 0;
}

/** Whether cell (x, y) shows a north wall face: a wall (not a garage door) on its north edge. */
export function hasFace(m: HouseModel, x: number, y: number): boolean {
  const k = edge(m, x, y, 'N');
  return k === EDGE.inner || k === EDGE.outer;
}

/** Where cell (x, y)'s floor starts below its north wall: under the band and the face. */
export function floorTop(m: HouseModel, x: number, y: number): number {
  return y * CELL + inset(m, x, y, 'N') + (hasFace(m, x, y) ? WALL.face : 0);
}

export function roomAt(m: HouseModel, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return 0;
  return m.room[y * m.width + x]!;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

/** A stable per-piece variation that isn't game randomness (TerrainLayer's tile hash). */
export function uidHash(n: number, salt = 0): number {
  let h = Math.imul(n + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------------------------------------------------------------------------------------
// The cache.

const cache = new WeakMap<HouseState, { links: HallLinks; key: string; model: HouseModel }>();

function linksKey(links: HallLinks): string {
  return [...links]
    .filter(([, l]) => l.length > 0)
    .sort(([a], [b]) => a - b)
    .map(([uid, l]) => `${uid}:${[...l].sort((a, b) => a - b).join(',')}`)
    .join(';');
}

/**
 * The house's model, with Hallway doors from `links` (hallLinks). Cached per house object, and
 * a house never changes once made, so it's computed once per placement, not per render.
 */
export function houseModel(house: HouseState, links: HallLinks = NO_LINKS): HouseModel {
  const hit = cache.get(house);
  if (hit && hit.links === links) return hit.model;
  const key = linksKey(links);
  if (hit && hit.key === key) {
    hit.links = links;
    return hit.model;
  }
  const model = buildModel(house, links, true);
  cache.set(house, { links, key, model });
  return model;
}

/** The rooms each room is linked to through Hallways, from the rules. */
export function hallLinks(state: RunState): HallLinks {
  const out = new Map<number, readonly number[]>();
  for (const p of state.house.pieces) {
    if (!isIndoor(p.defId)) continue;
    const linked = rules.describePiece(state, p.uid)?.linked ?? [];
    if (linked.length > 0) out.set(p.uid, linked);
  }
  return out;
}

const solo = new Map<string, HouseModel>();

/**
 * One piece alone, for the ghost: its own outline walls, no doors or windows. In the piece's
 * own frame: its bounding box's top-left cell is (0, 0).
 */
export function pieceModel(defId: PieceId, rot: PlacedPiece['rot']): HouseModel {
  const key = `${defId}:${rot}`;
  let m = solo.get(key);
  if (!m) {
    const shape = CONTENT.pieces[defId].shape;
    const w = rot % 2 === 0 ? shape[0]!.length : shape.length;
    const h = rot % 2 === 0 ? shape.length : shape[0]!.length;
    const house: HouseState = {
      lot: {
        width: w,
        height: h,
        terrain: new Array(w * h).fill(null),
        sunnySide: 'top',
        sunnyRows: 0,
        attempt: 0,
      },
      pieces: [{ uid: 1, defId, x: 0, y: 0, rot, placedWeek: 0 }],
      nextUid: 2,
    };
    m = buildModel(house, NO_LINKS, false);
    solo.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------------------------------
// Building a model.

/** How public a room is: entries and hubs first, private rooms and dead ends last. */
const HUB: Readonly<Partial<Record<PieceId, number>>> = {
  hallway: 5,
  longHallway: 5,
  livingRoom: 4,
  diningRoom: 4,
  mudroom: 4,
  kitchen: 3,
  lKitchen: 3,
  sunroom: 3,
  library: 2,
  playroom: 2,
  homeOffice: 2,
  bedroom: 1,
  garage: 0,
  bathroom: -1,
  closet: -2,
};
const hub = (id: PieceId) => HUB[id] ?? 0;

/**
 * How good a front door each room makes: a mudroom or a hall first. A garage, a bathroom or a
 * closet only when nothing else can have one.
 */
const ENTRY: Readonly<Partial<Record<PieceId, number>>> = {
  mudroom: 6,
  hallway: 6,
  longHallway: 6,
  livingRoom: 5,
  diningRoom: 4,
  kitchen: 3,
  lKitchen: 3,
  sunroom: 3,
  library: 2,
  playroom: 2,
  homeOffice: 2,
  bedroom: 1,
  garage: -5,
  bathroom: -20,
  closet: -25,
};

/** Which room a room's one door should open from: a closet off a bedroom, a garage into the mudroom. */
function parentScore(child: PieceId, parent: PieceId): number {
  if (child === 'closet' && parent === 'bedroom') return 6;
  if (child === 'bathroom' && parent === 'bedroom') return 4.5;
  if (child === 'garage' && (parent === 'mudroom' || parent === 'kitchen' || parent === 'lKitchen'))
    return 5.5;
  return hub(parent);
}

/** Rooms without windows. */
const NO_WINDOWS: ReadonlySet<PieceId> = new Set(['closet', 'garage', 'hallway', 'longHallway']);

/** What a front door may open onto (besides open ground and the street), and the paved ones. */
const FRONT_ONTO: ReadonlySet<PieceId> = new Set(['patio', 'driveway', 'longDriveway', 'lawn']);
const PAVED: ReadonlySet<PieceId> = new Set(['patio', 'driveway', 'longDriveway']);
/** What gets a back door. */
const BACK_ONTO: ReadonlySet<PieceId> = new Set(['patio', 'hotTub']);
/** What a garage door faces. */
const DRIVEWAYS: ReadonlySet<PieceId> = new Set(['driveway', 'longDriveway']);

const isConnector = (id: PieceId) => !!CONTENT.pieces[id].connector;

/** A run of wall between two pieces along one line. */
interface Run {
  a: number;
  b: number;
  dir: 'h' | 'v';
  /** The line, in art px: y for h, x for v. */
  line: number;
  /** Its extent along the line, in art px. */
  from: number;
  to: number;
}

function buildModel(house: HouseState, links: HallLinks, openings: boolean): HouseModel {
  const { width: W, height: H } = house.lot;
  const occ = occupancy(house);
  const room = new Int32Array(W * H);
  const rooms = new Map<number, Room>();
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const p of house.pieces) {
    if (!isIndoor(p.defId)) continue;
    const cells = occ.cells.get(p.uid)!;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const c of cells) {
      room[c.y * W + c.x] = p.uid;
      x0 = Math.min(x0, c.x);
      y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + 1);
      y1 = Math.max(y1, c.y + 1);
    }
    rooms.set(p.uid, {
      uid: p.uid,
      defId: p.defId,
      cells,
      box: { x: x0 * CELL, y: y0 * CELL, w: (x1 - x0) * CELL, h: (y1 - y0) * CELL },
    });
    bx0 = Math.min(bx0, x0);
    by0 = Math.min(by0, y0);
    bx1 = Math.max(bx1, x1);
    by1 = Math.max(by1, y1);
  }

  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : room[y * W + x]!);
  const kindOf = (a: number, b: number): EdgeKind =>
    a === b ? EDGE.none : a && b ? EDGE.inner : EDGE.outer;
  const h = new Uint8Array(W * (H + 1));
  for (let y = 0; y <= H; y++) {
    for (let x = 0; x < W; x++) h[y * W + x] = kindOf(at(x, y - 1), at(x, y));
  }
  const v = new Uint8Array((W + 1) * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x <= W; x++) v[y * (W + 1) + x] = kindOf(at(x - 1, y), at(x, y));
  }

  const model: HouseModel = {
    width: W,
    height: H,
    room,
    h,
    v,
    rooms,
    doors: [],
    exits: [],
    garageDoors: [],
    windows: [],
    bounds: rooms.size > 0 ? { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 } : null,
  };
  if (openings && rooms.size > 0) addOpenings(model, house, links);
  return model;
}

function setEdge(m: HouseModel, x: number, y: number, side: Side, k: EdgeKind): void {
  const w = m.width;
  if (side === 'N') m.h[y * w + x] = k;
  else if (side === 'S') m.h[(y + 1) * w + x] = k;
  else if (side === 'W') m.v[y * (w + 1) + x] = k;
  else m.v[y * (w + 1) + x + 1] = k;
}

function addOpenings(m: HouseModel, house: HouseState, links: HallLinks): void {
  const occ = occupancy(house);
  const W = m.width;
  const H = m.height;
  const at = (x: number, y: number) => roomAt(m, x, y);
  const defOf = (uid: number) => m.rooms.get(uid)!.defId;
  const yardAt = (x: number, y: number): PlacedPiece | undefined => {
    if (x < 0 || y < 0 || x >= W || y >= H) return undefined;
    const uid = occ.uids[y * W + x]!;
    return uid ? occ.byUid.get(uid) : undefined;
  };
  const doors = m.doors as Doorway[];
  const exits = m.exits as Exit[];
  const garageDoors = m.garageDoors as GarageDoor[];
  const windows = m.windows as WindowPane[];
  /** Every opening's gap so far, so new ones keep their distance. */
  const gaps: Rect[] = [];
  const free = (r: Rect) => !gaps.some((g) => overlaps(grow(r, 3), g));

  // Garage doors: each Garage's outside edges facing a Driveway or the street, on the side
  // with the most of them (ties: south, east, west, north).
  for (const r of m.rooms.values()) {
    if (r.defId !== 'garage') continue;
    const facing = (c: Cell, s: Side) => {
      if (edge(m, c.x, c.y, s) !== EDGE.outer) return false;
      const [dx, dy] = STEP[s];
      if (s === 'S' && c.y + 1 === H) return true;
      const p = yardAt(c.x + dx, c.y + dy);
      return !!p && DRIVEWAYS.has(p.defId);
    };
    let best: Side | null = null;
    let most = 0;
    for (const s of ['S', 'E', 'W', 'N'] as const) {
      const n = r.cells.filter((c) => facing(c, s)).length;
      if (n > most) [best, most] = [s, n];
    }
    if (!best) continue;
    const side = best;
    const cells = r.cells.filter((c) => facing(c, side)).sort((p, q) => p.y - q.y || p.x - q.x);
    // One garage door per straight run of them.
    let run: Cell[] = [];
    const flush = () => {
      if (run.length === 0) return;
      for (const c of run) setEdge(m, c.x, c.y, side, EDGE.garage);
      const first = run[0]!;
      const last = run[run.length - 1]!;
      const rail: Rect =
        side === 'N' || side === 'S'
          ? {
              x: first.x * CELL,
              y: side === 'N' ? first.y * CELL : (first.y + 1) * CELL - WALL.rail,
              w: (last.x - first.x + 1) * CELL,
              h: WALL.rail,
            }
          : {
              x: side === 'W' ? first.x * CELL : (first.x + 1) * CELL - WALL.rail,
              y: first.y * CELL,
              w: WALL.rail,
              h: (last.y - first.y + 1) * CELL,
            };
      garageDoors.push({ uid: r.uid, side, cells: run, rail });
      run = [];
    };
    for (const c of cells) {
      const prev = run[run.length - 1];
      const next =
        prev &&
        (side === 'N' || side === 'S'
          ? c.y === prev.y && c.x === prev.x + 1
          : c.x === prev.x && c.y === prev.y + 1);
      if (!next) flush();
      run.push(c);
    }
    flush();
  }

  // Outside doors. A candidate per outside edge of a room that opens onto open ground, the
  // street, or a yard piece a door can open onto.
  interface ExitCand {
    uid: number;
    cell: Cell;
    side: Side;
    onto: number;
    ontoId: PieceId | null;
    street: boolean;
    gap: Rect;
    score: number;
  }
  const exitGap = (c: Cell, s: Side): Rect | null => {
    const X0 = c.x * CELL;
    const Y0 = c.y * CELL;
    const size = WALL.exit;
    if (s === 'N' || s === 'S') {
      const lo = inset(m, c.x, c.y, 'W') + 2;
      const hi = CELL - inset(m, c.x, c.y, 'E') - 2 - size;
      if (lo > hi) return null;
      const off = Math.floor((lo + hi) / 2);
      return { x: X0 + off, y: s === 'N' ? Y0 : Y0 + CELL - WALL.out, w: size, h: WALL.out };
    }
    const bottom = CELL - inset(m, c.x, c.y, 'S') - 2 - size;
    let lo = inset(m, c.x, c.y, 'N') + (hasFace(m, c.x, c.y) ? WALL.face : 0);
    if (lo > bottom) lo = inset(m, c.x, c.y, 'N') + 2;
    if (lo > bottom) return null;
    const off = Math.floor((lo + bottom) / 2);
    return { x: s === 'W' ? X0 : X0 + CELL - WALL.out, y: Y0 + off, w: WALL.out, h: size };
  };
  /** Whether the column below a south edge is clear of the house down to the street. */
  const streetFacing = (c: Cell) => {
    for (let y = c.y + 1; y < H; y++) if (at(c.x, y)) return false;
    return true;
  };
  const exitCands = (back: boolean): ExitCand[] => {
    const out: ExitCand[] = [];
    for (const r of m.rooms.values()) {
      for (const c of r.cells) {
        for (const s of SIDES) {
          if (edge(m, c.x, c.y, s) !== EDGE.outer) continue;
          const [dx, dy] = STEP[s];
          const nx = c.x + dx;
          const ny = c.y + dy;
          const street = s === 'S' && ny === H;
          const off = nx < 0 || ny < 0 || nx >= W || ny >= H;
          if (off && !street) continue;
          const p = off ? undefined : yardAt(nx, ny);
          if (back) {
            if (!p || !BACK_ONTO.has(p.defId) || r.defId === 'closet') continue;
          } else if (p ? !FRONT_ONTO.has(p.defId) : !street && terrainAt(house.lot, nx, ny)) {
            continue; // a tree, water, a boulder, the Old Shed or a find; a fence or an outbuilding
          }
          const gap = exitGap(c, s);
          if (!gap) continue;
          const entry = ENTRY[r.defId] ?? 0;
          const box = r.box;
          const centered =
            s === 'N' || s === 'S'
              ? Math.abs(gap.x + gap.w / 2 - (box.x + box.w / 2))
              : Math.abs(gap.y + gap.h / 2 - (box.y + box.h / 2));
          // A back door goes in a public room, one without an outside door yet if it can.
          const score = back
            ? hub(r.defId) * 10 - (exits.some((e) => e.uid === r.uid) ? 25 : 0) - centered * 0.05
            : (s === 'S' ? 1000 : 0) +
              (s === 'S' && streetFacing(c) ? 600 : 0) +
              entry * 40 +
              (street ? 8 : p && PAVED.has(p.defId) ? 6 : p ? 2 : 0) +
              // The front of the house: each row nearer the street counts.
              c.y * 30 -
              centered * 0.05;
          out.push({
            uid: r.uid,
            cell: c,
            side: s,
            onto: p?.uid ?? 0,
            ontoId: p?.defId ?? null,
            street,
            gap,
            score,
          });
        }
      }
    }
    // Best first; ties in reading order, so it's deterministic.
    return out.sort(
      (p, q) =>
        q.score - p.score ||
        p.cell.y - q.cell.y ||
        p.cell.x - q.cell.x ||
        SIDES.indexOf(p.side) - SIDES.indexOf(q.side),
    );
  };
  const addExit = (cand: ExitCand, kind: Exit['kind']) => {
    const { cell: c, side: s, gap } = cand;
    const X0 = c.x * CELL;
    const Y0 = c.y * CELL;
    const mat: Rect =
      s === 'S'
        ? { x: gap.x - 1, y: Y0 + CELL + 1, w: gap.w + 2, h: WALL.mat }
        : s === 'N'
          ? { x: gap.x - 1, y: Y0 - 1 - WALL.mat, w: gap.w + 2, h: WALL.mat }
          : s === 'W'
            ? { x: X0 - 1 - WALL.mat, y: gap.y - 1, w: WALL.mat, h: gap.h + 2 }
            : { x: X0 + CELL + 1, y: gap.y - 1, w: WALL.mat, h: gap.h + 2 };
    const clear: Rect =
      s === 'S'
        ? { x: gap.x, y: gap.y - 6, w: gap.w, h: gap.h + 6 }
        : s === 'N'
          ? { x: gap.x, y: gap.y, w: gap.w, h: gap.h + WALL.face + 4 }
          : s === 'W'
            ? { x: gap.x, y: gap.y, w: gap.w + 6, h: gap.h }
            : { x: gap.x - 6, y: gap.y, w: gap.w + 6, h: gap.h };
    exits.push({ uid: cand.uid, kind, side: s, cell: c, gap, clear, mat, onto: cand.onto });
    gaps.push(gap);
  };

  // The front door: a south wall with nothing of the house between it and the street, near
  // the front of the house, in the best entry room; paved ground (a Patio or a Driveway) or
  // the sidewalk over grass.
  const fronts = exitCands(false);
  const front = fronts.find((f) => free(f.gap));
  if (front) addExit(front, 'front');
  // A back door onto each touching Patio or Hot Tub the front door doesn't already open onto.
  const served = new Set(exits.map((e) => e.onto).filter((u) => u !== 0));
  for (;;) {
    const back = exitCands(true).find((c) => !served.has(c.onto) && free(c.gap));
    if (!back) break;
    addExit(back, 'back');
    served.add(back.onto);
  }

  // Walls between pieces, as straight runs per pair.
  const runs: Run[] = [];
  for (let x = 1; x < W; x++) {
    let cur: Run | null = null;
    for (let y = 0; y <= H; y++) {
      const a = y < H && m.v[y * (W + 1) + x] === EDGE.inner ? at(x - 1, y) : 0;
      const b = a ? at(x, y) : 0;
      if (cur && (cur.a !== a || cur.b !== b)) {
        runs.push(cur);
        cur = null;
      }
      if (a && !cur) cur = { a, b, dir: 'v', line: x * CELL, from: y * CELL, to: y * CELL };
      if (cur) cur.to = (y + 1) * CELL;
    }
  }
  for (let y = 1; y < H; y++) {
    let cur: Run | null = null;
    for (let x = 0; x <= W; x++) {
      const a = x < W && m.h[y * W + x] === EDGE.inner ? at(x, y - 1) : 0;
      const b = a ? at(x, y) : 0;
      if (cur && (cur.a !== a || cur.b !== b)) {
        runs.push(cur);
        cur = null;
      }
      if (a && !cur) cur = { a, b, dir: 'h', line: y * CELL, from: x * CELL, to: x * CELL };
      if (cur) cur.to = (x + 1) * CELL;
    }
  }
  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const runsOf = new Map<string, Run[]>();
  for (const r of runs) {
    const k = pairKey(r.a, r.b);
    const list = runsOf.get(k);
    if (list) list.push(r);
    else runsOf.set(k, [r]);
  }

  /** The north wall run of piece `b` in the row below `line` that contains column x. */
  const northRun = (b: number, line: number, x: number): [number, number] => {
    const y = line / CELL;
    let x0 = x;
    let x1 = x;
    while (at(x0 - 1, y) === b && hasFace(m, x0 - 1, y)) x0--;
    while (at(x1 + 1, y) === b && hasFace(m, x1 + 1, y)) x1++;
    return [x0 * CELL, (x1 + 1) * CELL];
  };

  /**
   * A doorway in a run, clear of the openings so far, or null. Levels: a full door below the
   * north faces, a narrow one, then a full one through a face.
   */
  const doorIn = (run: Run): { gap: Rect; clear: Rect; pref: number } | null => {
    const half = WALL.in / 2;
    for (let level = 0; level < 3; level++) {
      const size = level === 1 ? WALL.narrowDoor : WALL.door;
      let lo: number;
      let hi: number;
      let order: number[];
      if (run.dir === 'v') {
        const x = run.line / CELL;
        const yTop = run.from / CELL;
        const yBot = run.to / CELL - 1;
        const zone = (cx: number) =>
          inset(m, cx, yTop, 'N') + (level < 2 && hasFace(m, cx, yTop) ? WALL.face : 1);
        lo = run.from + Math.max(zone(x - 1), zone(x));
        hi = run.to - Math.max(inset(m, x - 1, yBot, 'S'), inset(m, x, yBot, 'S')) - 1 - size;
        if (lo > hi) continue;
        // The middle of the run, then outward.
        const mid = Math.floor((lo + hi) / 2);
        order = [];
        for (let d = 0; d <= hi - lo; d++) {
          if (mid - d >= lo) order.push(mid - d);
          if (d > 0 && mid + d <= hi) order.push(mid + d);
        }
      } else {
        const y = run.line / CELL;
        const xFirst = run.from / CELL;
        const xLast = run.to / CELL - 1;
        lo = run.from + Math.max(inset(m, xFirst, y - 1, 'W'), inset(m, xFirst, y, 'W')) + 1;
        hi = run.to - Math.max(inset(m, xLast, y - 1, 'E'), inset(m, xLast, y, 'E')) - 1 - size;
        if (lo > hi) continue;
        // Near an end of the lower room's north wall, never its middle: the end farther
        // from that wall's middle, or by the room's hash when both are as far.
        const [r0, r1] = northRun(run.b, run.line, xFirst);
        const mid = (r0 + r1) / 2;
        const dLo = Math.abs(lo + size / 2 - mid);
        const dHi = Math.abs(hi + size / 2 - mid);
        const fromLo = dLo > dHi || (dLo === dHi && uidHash(run.b) % 2 === 0);
        order = [];
        for (let d = 0; d <= hi - lo; d++) order.push(fromLo ? lo + d : hi - d);
      }
      for (const off of order) {
        const gap: Rect =
          run.dir === 'v'
            ? { x: run.line - half, y: off, w: WALL.in, h: size }
            : { x: off, y: run.line - half, w: size, h: WALL.in };
        if (!free(gap)) continue;
        const clear: Rect =
          run.dir === 'v'
            ? { x: run.line - half - 4, y: off, w: WALL.in + 8, h: size }
            : { x: off, y: run.line - half - 4, w: size, h: WALL.in + WALL.face + 8 };
        // Side walls first, then longer walls; a door in a north wall costs furniture room.
        const pref = (run.dir === 'h' ? 24 : 0) + level * 40 - (run.to - run.from) / CELL;
        return { gap, clear, pref };
      }
    }
    return null;
  };
  /** The best doorway between two touching pieces, over all their runs. */
  const doorBetween = (a: number, b: number): Doorway | null => {
    let best: (Doorway & { pref: number }) | null = null;
    for (const run of runsOf.get(pairKey(a, b)) ?? []) {
      const d = doorIn(run);
      if (!d) continue;
      if (!best || d.pref < best.pref) {
        best = {
          a: run.a,
          b: run.b,
          dir: run.dir,
          gap: d.gap,
          clear: d.clear,
          why: 'tree',
          pref: d.pref,
        };
      }
    }
    if (!best) return null;
    const { pref, ...door } = best;
    void pref;
    return door;
  };

  // Union-find over the pieces, joined by doorways.
  const parent = new Map<number, number>();
  for (const uid of m.rooms.keys()) parent.set(uid, uid);
  const find = (u: number): number => {
    let r = u;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(u, r);
    return r;
  };
  const join = (a: number, b: number) => parent.set(find(a), find(b));
  const addDoor = (d: Doorway) => {
    doors.push(d);
    gaps.push(d.gap);
    join(d.a, d.b);
  };

  // Hallways open into every room the rules link through them, and into touching Hallways.
  const touching = [...runsOf.keys()].map((k) => k.split('-').map(Number) as [number, number]);
  touching.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  for (const [a, b] of touching) {
    const ca = isConnector(defOf(a));
    const cb = isConnector(defOf(b));
    if (!ca && !cb) continue;
    const linked = (u: number) => (links.get(u)?.length ?? 0) > 0;
    if ((ca && cb) || (ca && linked(b)) || (cb && linked(a))) {
      const d = doorBetween(a, b);
      if (d) addDoor({ ...d, why: 'hall' });
    }
  }

  // The entry: the front door's room, or the most public room.
  const all = [...m.rooms.values()];
  const entry =
    exits.find((e) => e.kind === 'front')?.uid ??
    [...all].sort((p, q) => hub(q.defId) - hub(p.defId) || p.uid - q.uid)[0]!.uid;

  // The spanning tree: reach every room, the most public first, each through its best parent.
  const reached = () => new Set(all.map((r) => r.uid).filter((u) => find(u) === find(entry)));
  let inside = reached();
  while (inside.size < all.length) {
    let best: { door: Doorway; key: number } | null = null;
    for (const [a, b] of touching) {
      const ia = inside.has(a);
      if (ia === inside.has(b)) continue;
      const [from, to] = ia ? [a, b] : [b, a];
      const key = parentScore(defOf(to), defOf(from)) * 10 + hub(defOf(to)) * 2;
      // Ties keep the earlier pair (touching is sorted), so it's deterministic.
      if (best && key <= best.key) continue;
      const door = doorBetween(a, b);
      if (door) best = { door, key };
    }
    if (best) {
      addDoor(best.door);
      inside = reached();
      continue;
    }
    // A part of the house no doorway can reach gets its own door outside, if it can.
    const rest = all.filter((r) => !inside.has(r.uid));
    const own = new Set(rest.filter((r) => find(r.uid) === find(rest[0]!.uid)).map((r) => r.uid));
    const side = exitCands(false).find((c) => own.has(c.uid) && free(c.gap));
    if (side) addExit(side, 'side');
    for (const u of own) join(u, entry);
    inside = reached();
  }

  // Windows: in outside walls, about one per two cells of straight wall (one per cell in a
  // Sunroom), centered on each run; never in a door.
  for (const r of m.rooms.values()) {
    if (NO_WINDOWS.has(r.defId)) continue;
    const size = r.defId === 'bathroom' ? WALL.smallWindow : WALL.window;
    for (const s of SIDES) {
      const cells = r.cells
        .filter((c) => edge(m, c.x, c.y, s) === EDGE.outer)
        .sort((p, q) => (s === 'N' || s === 'S' ? p.y - q.y || p.x - q.x : p.x - q.x || p.y - q.y));
      const flat = s === 'N' || s === 'S';
      let i = 0;
      while (i < cells.length) {
        let j = i + 1;
        while (
          j < cells.length &&
          (flat
            ? cells[j]!.y === cells[i]!.y && cells[j]!.x === cells[j - 1]!.x + 1
            : cells[j]!.x === cells[i]!.x && cells[j]!.y === cells[j - 1]!.y + 1)
        )
          j++;
        const first = cells[i]!;
        const len = j - i;
        const count = r.defId === 'sunroom' ? len : Math.ceil(len / 2);
        for (let k = 0; k < count; k++) {
          const center = ((k + 0.5) * len * CELL) / count;
          const along = Math.round(center - size / 2);
          const rect: Rect = flat
            ? {
                x: first.x * CELL + along,
                y: s === 'N' ? first.y * CELL : (first.y + 1) * CELL - WALL.out,
                w: size,
                h: WALL.out,
              }
            : {
                x: s === 'W' ? first.x * CELL : (first.x + 1) * CELL - WALL.out,
                y: first.y * CELL + along,
                w: WALL.out,
                h: size,
              };
          if (exits.some((e) => overlaps(grow(rect, 3), e.gap))) continue;
          windows.push({ uid: r.uid, side: s, rect });
        }
        i = j;
      }
    }
  }
}
