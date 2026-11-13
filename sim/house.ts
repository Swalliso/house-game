// The house report's measures (house-systems-review.md, Appendix "The house"; D-089's reports,
// D-093): what the finished house looks like, from its pieces alone. Pure, like enclosure.ts.
//
// Choices the review leaves open, made here:
// - Rooms are counted by their own card's type (an L-Kitchen is a Kitchen). Fixture
//   modifiers don't add rooms: a Kitchen Island isn't a Dining Room, and Bunk Beds don't make
//   a second Bedroom (the checklist counts them twice; a glance at the house doesn't).
// - Corners count every turn in the house's outline, a courtyard's included: a 2×2 scan of
//   each grid vertex gives 4 for a rectangle, 6 for an L, and 2 for a diagonal pinch.
// - A yard piece is "inside the house" (H2) when every tile is inside the box around the
//   indoor tiles and it touches 2 or more indoor pieces (Hallways included).
// - An outdoor room is "beside the house" (Y1) when it touches an indoor tile.

import type { Content, HouseState, PieceDef, PieceId } from '../src/rules/index.ts';
import { placedCells } from '../src/rules/index.ts';

/** The special rooms H3 and the plausibility check allow one of each. */
const SPECIAL_ROOMS: readonly PieceId[] = ['playroom', 'library', 'mudroom', 'sunroom'];
/** Outdoor rooms (the Patio rule, Y1). */
const OUTDOOR_ROOMS: readonly PieceId[] = ['patio', 'hotTub', 'firePit'];
/** Yard types that never count as repeats (they don't break the tidy yard). */
const NOT_REPEATS: readonly PieceId[] = ['fence', 'driveway', 'sapling'];

export interface HouseStats {
  /** Rooms: indoor pieces that aren't connectors. */
  rooms: number;
  /** Rooms by type (the countsAs root). */
  roomCounts: Partial<Record<PieceId, number>>;
  bedrooms: number;
  bathrooms: number;
  kitchens: number;
  livingRooms: number;
  diningRooms: number;
  /** Indoor tiles ÷ the tiles in the box around them, 0–1. */
  fill: number;
  corners: number;
  /** The box around the indoor tiles. */
  box: { w: number; h: number };
  /** The box around everything built, as a share of the lot. */
  buildBox: number;
  /** Yard pieces (yard and outbuildings) wedged inside the house's box. */
  wedged: number;
  /** D-164: the wedged pieces by type (the countsAs root). */
  wedgedTypes: Partial<Record<PieceId, number>>;
  /** Tiles inside the box that aren't indoor and can't reach outside it. */
  courtyard: number;
  /** The most of one yard type (Fences, Driveways, and Saplings left out). */
  yardRepeat: number;
  treehouses: number;
  outbuildings: number;
  patios: number;
  /** Outdoor rooms (Patio, Hot Tub, Fire Pit) that don't touch the house. */
  outdoorAway: number;
  // The review's yes/no measures.
  visibleRepeats: boolean;
  plausible: boolean;
  h1: boolean;
  h1g: boolean;
  h2: boolean;
  h3: boolean;
  glance: boolean;
  y1: boolean;
  noHousehold: boolean;
  bathroomRatio: boolean;
  tiny: boolean;
}

const rootOf = (def: PieceDef): PieceId => def.countsAs ?? def.id;
const isRoomDef = (def: PieceDef) => def.category === 'indoor' && !def.connector;

export function houseStats(content: Content, house: HouseState): HouseStats {
  const { width: W, height: H } = house.lot;
  const indoor = new Uint8Array(W * H);
  const owner = new Int32Array(W * H).fill(-1);
  const cellsOf = new Map<number, { x: number; y: number }[]>();
  const counts: Partial<Record<PieceId, number>> = {};
  let rooms = 0;
  let bedrooms = 0;
  let minAll = { x: W, y: H };
  let maxAll = { x: -1, y: -1 };
  for (const p of house.pieces) {
    const def = content.pieces[p.defId];
    const cells = placedCells(p.shape ?? def.shape, p.x, p.y, p.rot);
    cellsOf.set(p.uid, cells);
    for (const c of cells) {
      owner[c.y * W + c.x] = p.uid;
      if (def.category === 'indoor') indoor[c.y * W + c.x] = 1;
      minAll = { x: Math.min(minAll.x, c.x), y: Math.min(minAll.y, c.y) };
      maxAll = { x: Math.max(maxAll.x, c.x), y: Math.max(maxAll.y, c.y) };
    }
    if (isRoomDef(def)) {
      rooms++;
      const t = rootOf(def);
      counts[t] = (counts[t] ?? 0) + 1;
      if (t === 'bedroom') bedrooms++;
    }
  }
  const n = (t: PieceId) => counts[t] ?? 0;

  // The box around the indoor tiles, and the fill.
  let bx0 = W;
  let by0 = H;
  let bx1 = -1;
  let by1 = -1;
  let tiles = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!indoor[y * W + x]) continue;
      tiles++;
      bx0 = Math.min(bx0, x);
      by0 = Math.min(by0, y);
      bx1 = Math.max(bx1, x);
      by1 = Math.max(by1, y);
    }
  }
  const bw = tiles ? bx1 - bx0 + 1 : 0;
  const bh = tiles ? by1 - by0 + 1 : 0;
  const fill = tiles ? tiles / (bw * bh) : 0;
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && indoor[y * W + x] === 1;

  // Corners: each grid vertex, by the 2×2 block of tiles around it.
  let corners = 0;
  for (let y = 0; y <= H; y++) {
    for (let x = 0; x <= W; x++) {
      const a = filled(x - 1, y - 1);
      const b = filled(x, y - 1);
      const c = filled(x - 1, y);
      const d = filled(x, y);
      const k = Number(a) + Number(b) + Number(c) + Number(d);
      if (k === 1 || k === 3) corners++;
      else if (k === 2 && a === d) corners += 2; // a diagonal pinch
    }
  }

  // Courtyard tiles: inside the box, not indoor, and cut off from the box's edge.
  let courtyard = 0;
  if (tiles) {
    const inBox = (x: number, y: number) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1;
    const reach = new Uint8Array(W * H);
    const stack: number[] = [];
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const edge = x === bx0 || x === bx1 || y === by0 || y === by1;
        if (edge && !indoor[y * W + x]) {
          reach[y * W + x] = 1;
          stack.push(y * W + x);
        }
      }
    }
    while (stack.length > 0) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBox(nx, ny)) continue;
        const j = ny * W + nx;
        if (indoor[j] || reach[j]) continue;
        reach[j] = 1;
        stack.push(j);
      }
    }
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) if (!indoor[y * W + x] && !reach[y * W + x]) courtyard++;
    }
  }

  // The yard: wedged pieces, repeats, outbuildings, outdoor rooms by the house.
  let wedged = 0;
  const wedgedTypes: Partial<Record<PieceId, number>> = {};
  let outdoorAway = 0;
  let outbuildings = 0;
  const yardTypes = new Map<PieceId, number>();
  for (const p of house.pieces) {
    const def = content.pieces[p.defId];
    if (def.category === 'indoor') continue;
    const cells = cellsOf.get(p.uid)!;
    if (def.category === 'outbuilding') outbuildings++;
    const t = rootOf(def);
    if (!NOT_REPEATS.includes(t)) yardTypes.set(t, (yardTypes.get(t) ?? 0) + 1);
    const touchingIndoor = new Set<number>();
    let touchesHouse = false;
    for (const c of cells) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        if (filled(c.x + dx, c.y + dy)) {
          touchesHouse = true;
          touchingIndoor.add(owner[(c.y + dy) * W + c.x + dx]!);
        }
      }
    }
    const inside =
      tiles > 0 && cells.every((c) => c.x >= bx0 && c.x <= bx1 && c.y >= by0 && c.y <= by1);
    if (inside && touchingIndoor.size >= 2) {
      wedged++;
      wedgedTypes[t] = (wedgedTypes[t] ?? 0) + 1;
    }
    if (OUTDOOR_ROOMS.includes(t) && !touchesHouse) outdoorAway++;
  }
  const yardRepeat = Math.max(0, ...yardTypes.values());
  const patios = yardTypes.get('patio') ?? 0;
  const treehouses = yardTypes.get('treehouse') ?? 0;

  const bathrooms = n('bathroom');
  const kitchens = n('kitchen');
  const livingRooms = n('livingRoom');
  const diningRooms = n('diningRoom');
  const specialOk = SPECIAL_ROOMS.every((t) => n(t) <= 1);
  const caps =
    diningRooms <= 1 && livingRooms <= 2 && n('homeOffice') <= 2 && n('garage') <= 1 && specialOk;
  const h1 = fill >= 0.6 && corners <= 24;
  const h1g = h1 && Math.max(bw, bh) <= 2 * Math.min(bw, bh);
  const h2 = wedged <= 1 && courtyard <= 4;
  const h3 = kitchens === 1 && caps;
  const buildBox =
    maxAll.x < 0 ? 0 : ((maxAll.x - minAll.x + 1) * (maxAll.y - minAll.y + 1)) / (W * H);
  return {
    rooms,
    roomCounts: counts,
    bedrooms,
    bathrooms,
    kitchens,
    livingRooms,
    diningRooms,
    fill,
    corners,
    box: { w: bw, h: bh },
    buildBox,
    wedged,
    wedgedTypes,
    courtyard,
    yardRepeat,
    treehouses,
    outbuildings,
    patios,
    outdoorAway,
    visibleRepeats: kitchens >= 2 || livingRooms >= 3 || diningRooms >= 2,
    plausible:
      bedrooms >= 1 &&
      kitchens >= 1 &&
      bathrooms >= 1 &&
      bathrooms * 3 >= bedrooms &&
      kitchens <= 1 &&
      caps,
    h1,
    h1g,
    h2,
    h3,
    glance: h1g && h2 && h3,
    y1: outdoorAway === 0 && patios <= 2,
    noHousehold: bedrooms <= 1 || bathrooms === 0,
    bathroomRatio: bathrooms >= Math.max(1, Math.ceil(bedrooms / 2)),
    tiny: rooms <= 8,
  };
}
