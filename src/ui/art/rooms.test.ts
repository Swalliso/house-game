// What stands in each room (D-097): LimeZu furniture by slot rules, for every room type and
// rotation, inside its walls, off its doorways and off each other; the same every time; rooms
// of a type that don't look copy-pasted; fixtures drawn where they fit, badged where not.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  placedCells,
  rules,
  type FixtureId,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import {
  EDGE,
  WALL,
  edge,
  hallLinks,
  houseModel,
  inset,
  overlaps,
  pieceModel,
  type HouseModel,
  type Rect,
} from '../board/house-model.ts';
import { CELL, spritePos } from '../sprites.ts';
import { artSize } from './drawings.ts';
import {
  byType,
  itemRows,
  newRoomLook,
  roomItems,
  roomLayout,
  roomLook,
  type Item,
} from './rooms.ts';

const INDOOR = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
  (id) => CONTENT.pieces[id].category === 'indoor',
);
const ROOM_FIXTURES: readonly FixtureId[] = [
  'fireplace',
  'skylight',
  'blackoutCurtains',
  'soundproofing',
  'bayWindow',
];

type Spec = readonly [PieceId, number, number, Rot?, FixtureId?];

function house(specs: readonly Spec[], size = 12): HouseState {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0, fixture], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot,
    placedWeek: i,
    ...(fixture ? { fixture: { id: fixture, week: 0 } } : {}),
  }));
  const rows = Array.from({ length: size }, () => '.'.repeat(size));
  return { lot: lotFromRows(rows), pieces, nextUid: pieces.length + 1 };
}

/** The model with the rules' Hallway links, as the board builds it. */
function modelOf(h: HouseState): HouseModel {
  const state = {
    ...rules.newRun({
      seed: 'rooms',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    }),
    house: h,
  };
  return houseModel(h, hallLinks(state));
}

const FLAT = /^(rug-|runner-|mat-|bath-mat)/;
/** Pieces that may stand in a doorway's walkway (never its opening): a one-cell room's key piece, and the car. */
const TIGHT = /^(toilet-|clothes-rail|car-)/;
/** And a dining table, which keeps its chairs before a walkway (its chairs keep out of it). */
const WALKWAY = /^(toilet-|clothes-rail|car-|dining-table)/;

/** An item's footprint: its sprite below the line it rises over. */
function foot(it: Item): Rect {
  const { w, h } = artSize(it.sprite);
  const top = it.over ?? it.y;
  return { x: it.x, y: top, w, h: it.y + h - top };
}

/** Problems with one room's layout, as messages (none when it's right). */
function problems(m: HouseModel, uid: number): string[] {
  const out: string[] = [];
  const room = m.rooms.get(uid)!;
  const items = roomItems(m, uid);
  const name = (it: Item) => `${room.defId} ${uid}: ${it.sprite} at ${it.x},${it.y}`;
  const own = (cx: number, cy: number) =>
    cx >= 0 && cy >= 0 && cx < m.width && cy < m.height && m.room[cy * m.width + cx] === uid;
  for (const it of items) {
    const f = foot(it);
    // The car covers its garage door's rail, and is 3 px longer than a Garage is deep inside.
    const car = it.sprite.startsWith('car-');
    const tol = car ? 3 : 1;
    const wall = (cx: number, cy: number, side: 'N' | 'E' | 'S' | 'W') =>
      car && edge(m, cx, cy, side) === EDGE.garage ? 0 : inset(m, cx, cy, side);
    // Inside the room's walls: on its cells, a pixel's tuck under a side wall at most.
    for (let cy = Math.floor(f.y / CELL); cy <= Math.floor((f.y + f.h - 1) / CELL); cy++) {
      for (let cx = Math.floor(f.x / CELL); cx <= Math.floor((f.x + f.w - 1) / CELL); cx++) {
        if (!own(cx, cy)) {
          out.push(`${name(it)} leaves the room at cell ${cx},${cy}`);
          continue;
        }
        // The part of it in this cell, against this cell's walls.
        const X0 = cx * CELL;
        const Y0 = cy * CELL;
        const x0 = Math.max(f.x, X0);
        const x1 = Math.min(f.x + f.w, X0 + CELL);
        const y0 = Math.max(f.y, Y0);
        const y1 = Math.min(f.y + f.h, Y0 + CELL);
        const w = wall(cx, cy, 'W');
        const e = wall(cx, cy, 'E');
        if (w && x0 < X0 + w - tol) out.push(`${name(it)} is in a west wall`);
        if (e && x1 > X0 + CELL - e + tol) out.push(`${name(it)} is in an east wall`);
        if (y0 < Y0 + wall(cx, cy, 'N')) out.push(`${name(it)} is in a north wall`);
        if (y1 > Y0 + CELL - wall(cx, cy, 'S')) out.push(`${name(it)} is in a south wall`);
      }
    }
    // It rises over its north wall's band, but never off its own cells: over a wall between two
    // rooms, over its own half of the band at most, so the other half shows (D-097: rooms never
    // merge). Only a tight piece may rise further, 8 px at most, and only over an outside wall.
    for (let cy = Math.floor(it.y / CELL); cy < Math.floor(f.y / CELL); cy++) {
      for (let cx = Math.floor(f.x / CELL); cx <= Math.floor((f.x + f.w - 1) / CELL); cx++) {
        if (own(cx, cy)) continue;
        const other = cx >= 0 && cy >= 0 && cx < m.width ? (m.room[cy * m.width + cx] ?? 0) : 0;
        if (other) out.push(`${name(it)} rises into room ${other} at cell ${cx},${cy}`);
        else if (!TIGHT.test(it.sprite) || it.y < (cy + 1) * CELL - 8) {
          out.push(`${name(it)} rises out of the house at cell ${cx},${cy}`);
        }
      }
    }
    // Never in an opening; out of the walkways in front of them unless it's a tight piece.
    for (const d of m.doors.filter((d) => d.a === uid || d.b === uid)) {
      if (overlaps(f, d.gap)) out.push(`${name(it)} is in a doorway`);
      if (!FLAT.test(it.sprite) && !WALKWAY.test(it.sprite) && overlaps(f, d.clear)) {
        out.push(`${name(it)} blocks a doorway`);
      }
    }
    for (const e of m.exits.filter((e) => e.uid === uid)) {
      if (overlaps(f, e.gap)) out.push(`${name(it)} is in an outside door`);
      if (!FLAT.test(it.sprite) && !WALKWAY.test(it.sprite) && overlaps(f, e.clear)) {
        out.push(`${name(it)} blocks an outside door`);
      }
    }
  }
  // Off each other: rugs and runners lie under things; dining chairs tuck 3 px under the table.
  const solid = items.filter((it) => !FLAT.test(it.sprite));
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = foot(solid[i]!);
      const b = foot(solid[j]!);
      const chair = /^chair-/.test(solid[i]!.sprite) || /^chair-/.test(solid[j]!.sprite);
      const table =
        /^dining-table/.test(solid[i]!.sprite) || /^dining-table/.test(solid[j]!.sprite);
      const tuck = chair && table ? 3 : 0;
      const shrunk = { x: a.x + tuck, y: a.y, w: Math.max(0, a.w - 2 * tuck), h: a.h };
      if (overlaps(shrunk, b)) out.push(`${name(solid[i]!)} overlaps ${solid[j]!.sprite}`);
    }
  }
  return out;
}

/** A room with one slab of rooms against each of `sides`, as in the contact sheets. */
function boxedIn(id: PieceId, rot: Rot, sides: string, fixture?: FixtureId): HouseState {
  const cells = placedCells(CONTENT.pieces[id].shape, 0, 0, rot);
  const specs: Spec[] = [[id, 3, 3, rot, fixture]];
  const used = new Set(cells.map((c) => `${c.x + 3},${c.y + 3}`));
  for (const s of sides) {
    const [dx, dy] = ({ N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] } as const)[s as 'N']!;
    const flat = s === 'N' || s === 'S';
    const out = cells
      .map((c) => ({ x: c.x + 3 + dx, y: c.y + 3 + dy }))
      .filter((c) => !used.has(`${c.x},${c.y}`))
      .sort((a, b) => (flat ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y));
    for (const c of out) {
      if (used.has(`${c.x},${c.y}`)) continue;
      used.add(`${c.x},${c.y}`);
      specs.push(['closet', c.x, c.y]);
    }
  }
  return house(specs);
}

describe('room layouts', () => {
  it('lay out every room type in every rotation, alone and boxed in, without clashes', () => {
    for (const id of INDOOR) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        for (const sides of ['', 'NS', 'EW', 'NESW']) {
          const m = modelOf(boxedIn(id, rot, sides));
          expect(problems(m, 1), `${id} r${rot} ${sides}`).toEqual([]);
        }
      }
    }
  });

  it("give every room type its key piece when it stands alone (the ghost's model)", () => {
    const KEY: Readonly<Partial<Record<PieceId, RegExp>>> = {
      bedroom: /^bed-double/,
      bathroom: /^toilet/,
      kitchen: /^range/,
      lKitchen: /^range/,
      diningRoom: /^dining-table/,
      livingRoom: /^sofa/,
      closet: /^clothes-rail/,
      hallway: /^runner/,
      longHallway: /^runner/,
      homeOffice: /^desk/,
      playroom: /^toy-box/,
      library: /^bookcase/,
      mudroom: /^(washer|bench)/,
      sunroom: /^plant-tall/,
      // The members' rooms (D-103), each its own (D-111). Renfield's cot and Rowan's easel stand
      // in their one-cell-deep rooms too, in a second shape.
      nursery: /^crib-twin/,
      kidsRoom: /^bed-single/,
      grandmasRoom: /^bed-double/,
      renfieldsRoom: /^cot/,
      nanasRoom: /^bed-double/,
      rowansStudio: /^easel/,
      ivysRoom: /^bed-single/,
    };
    for (const id of INDOOR) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const items = roomItems(pieceModel(id, rot), 1);
        const key = KEY[id];
        if (key)
          expect(
            items.some((it) => key.test(it.sprite)),
            `${id} r${rot}`,
          ).toBe(true);
        expect(problems(pieceModel(id, rot), 1), `${id} r${rot}`).toEqual([]);
      }
    }
  });

  it('keep the key pieces their doors would push out', () => {
    // A one-cell-deep Mudroom with the front door in its south wall: its washer stands beside it.
    const mud = modelOf(house([['mudroom', 4, 4]]));
    expect(mud.exits.some((e) => e.uid === 1 && e.side === 'S')).toBe(true);
    expect(roomItems(mud, 1).map((i) => i.sprite)).toContain('washer');
    // A Dining Room whose front door takes its south wall's middle keeps a chair each side.
    const dining = modelOf(house([['diningRoom', 4, 4]]));
    const chairs = roomItems(dining, 1).filter((i) => i.sprite.startsWith('chair-'));
    expect(chairs.filter((i) => i.sprite.startsWith('chair-east')).length).toBeGreaterThan(0);
    expect(chairs.filter((i) => i.sprite.startsWith('chair-west')).length).toBeGreaterThan(0);
    // A one-cell-wide Home Office with doors in its north wall and a side wall: still a desk.
    const office = modelOf(boxedIn('homeOffice', 1, 'NE'));
    expect(roomItems(office, 1).some((i) => i.sprite.startsWith('desk-'))).toBe(true);
    expect(problems(office, 1)).toEqual([]);
  });

  it('put the car in a Garage through its garage door, nose in', () => {
    // A Garage on the front row opens onto the street.
    const m = modelOf(house([['garage', 4, 10]]));
    const items = roomItems(m, 1);
    expect(items.map((i) => i.sprite)).toContain('car-rear-0');
    expect(problems(m, 1)).toEqual([]);
  });

  it('split tall pieces at their over line: the rows above it rise over the walls', () => {
    const { h } = spritePos('bed-double-0');
    expect(itemRows({ sprite: 'bed-double-0', x: 0, y: 40 })).toEqual({
      top: null,
      bottom: [0, h],
    });
    expect(itemRows({ sprite: 'bed-double-0', x: 0, y: 40, over: 46 })).toEqual({
      top: [0, 6],
      bottom: [6, h],
    });
    // A one-cell Bathroom's toilet rises over the band; it is drawn above the walls.
    const m = modelOf(house([['bathroom', 4, 4]]));
    const toilet = roomItems(m, 1).find((it) => it.sprite.startsWith('toilet'))!;
    expect(toilet.over).toBeGreaterThan(toilet.y);
    expect(itemRows(toilet).top).not.toBeNull();
  });

  it('raise tall pieces over their own half of a wall between rooms, never the next room’s', () => {
    // Playtest 5a: a Home Office over a Library. The bookcase stands against the wall between
    // them with its top on the line between the rooms, so the office's half of the band (its
    // edge and a row of its fill) shows above it and the two never read as one room.
    const m = modelOf(
      house([
        ['homeOffice', 2, 1],
        ['library', 2, 2],
      ]),
    );
    const shared = roomItems(m, 2).find((it) => it.sprite.startsWith('bookcase'))!;
    expect(shared.y).toBe(2 * CELL);
    expect(itemRows(shared).top).toEqual([0, WALL.in / 2]);
    expect(problems(m, 2)).toEqual([]);
    // The floor in front of it is short for a gap now: the armchair stands right against it.
    const chair = roomItems(m, 2).find((it) => it.sprite.startsWith('armchair'))!;
    expect(chair.y).toBe(shared.y + artSize(shared.sprite).h);
    // Over an outside wall the whole band is the room's own: alone, the bookcase rises over it.
    const alone = modelOf(house([['library', 2, 2]]));
    const own = roomItems(alone, 1).find((it) => it.sprite.startsWith('bookcase'))!;
    expect(own.y).toBe(2 * CELL);
    expect(itemRows(own).top).toEqual([0, WALL.out]);
  });

  it('vary rooms of a type: three Bedrooms, three beds', () => {
    const m = modelOf(
      house([
        ['bedroom', 1, 1],
        ['bedroom', 3, 1],
        ['bedroom', 5, 1],
      ]),
    );
    const beds = [1, 2, 3].map(
      (uid) => roomItems(m, uid).find((it) => it.sprite.startsWith('bed-'))!.sprite,
    );
    expect(new Set(beds).size).toBe(3);
  });

  it('vary rooms of a type in more than their key piece: Living Rooms differ in sofa and rug', () => {
    // Four Living Rooms take the four colors; the two grey sofas never share a rug.
    const m = modelOf(
      house(
        [
          ['livingRoom', 1, 1, 0, 'fireplace'],
          ['livingRoom', 4, 1, 0, 'fireplace'],
          ['livingRoom', 7, 1, 0, 'fireplace'],
          ['livingRoom', 10, 1, 0, 'fireplace'],
        ],
        14,
      ),
    );
    const look = [1, 2, 3, 4].map((uid) => {
      const sprites = roomItems(m, uid).map((i) => i.sprite);
      return {
        sofa: sprites.find((sp) => sp.startsWith('sofa-'))!,
        rug: sprites.find((sp) => sp.startsWith('rug-'))!,
      };
    });
    expect(new Set(look.map((l) => l.sofa)).size).toBe(4);
    const greys = look.filter((l) => l.sofa === 'sofa-0' || l.sofa === 'sofa-1');
    expect(greys).toHaveLength(2);
    expect(greys[0]!.rug).not.toBe(greys[1]!.rug);
  });

  it('keep their colors when a newer room of their type comes or goes', () => {
    const beds = (specs: Spec[]) => {
      const m = modelOf(house(specs));
      return [...m.rooms.keys()].map(
        (uid) => roomItems(m, uid).find((it) => it.sprite.startsWith('bed-'))?.sprite,
      );
    };
    const two: Spec[] = [
      ['bedroom', 1, 1],
      ['bedroom', 3, 1],
    ];
    const three: Spec[] = [...two, ['bedroom', 5, 1]];
    expect(beds(three).slice(0, 2)).toEqual(beds(two));
  });

  it('give a type without an entry of its own its countsAs root’s (a member’s room, the Bedroom’s)', () => {
    expect(byType({ bedroom: 4 }, 'grandmasRoom')).toBe(4);
    expect(byType({ bedroom: 4, grandmasRoom: 2 }, 'grandmasRoom')).toBe(2);
    expect(byType({ kitchen: 3 }, 'lKitchen')).toBe(3);
    expect(byType({ bedroom: 4 }, 'garage')).toBeUndefined();
    // So two Grandma's Rooms take two of the Bedroom's four colors: two beds.
    const m = modelOf(
      house([
        ['grandmasRoom', 1, 1],
        ['grandmasRoom', 4, 1],
      ]),
    );
    const beds = [1, 2].map(
      (uid) => roomItems(m, uid).find((it) => it.sprite.startsWith('bed-'))!.sprite,
    );
    expect(new Set(beds).size).toBe(2);
  });

  it('are the same every time, and cached per model', () => {
    const specs: Spec[] = [
      ['livingRoom', 2, 2],
      ['kitchen', 4, 2],
      ['bedroom', 4, 4, 0, 'bunkBeds'],
      ['hallway', 2, 5, 1],
    ];
    const a = modelOf(house(specs));
    const b = modelOf(house(specs));
    for (const uid of [1, 2, 3, 4]) {
      expect(roomLayout(a, uid)).toEqual(roomLayout(b, uid));
      expect(roomLayout(a, uid)).toBe(roomLayout(a, uid));
    }
  });
});

describe('Hallways joined (D-159)', () => {
  const runner = (m: HouseModel, uid: number) =>
    roomItems(m, uid)
      .filter((it) => it.sprite.startsWith('runner-'))
      .sort((p, q) => p.x - q.x || p.y - q.y);
  /** Where a run of runner pieces starts and ends along x (or y), and the rows (columns) it's in. */
  const span = (items: readonly Item[], across: boolean) => ({
    from: Math.min(...items.map((i) => (across ? i.x : i.y))),
    to: Math.max(
      ...items.map((i) => (across ? i.x + artSize(i.sprite).w : i.y + artSize(i.sprite).h)),
    ),
    at: new Set(items.map((i) => (across ? i.y : i.x))),
  });

  it('lay one runner through halls end to end, lined up whatever walls each has', () => {
    // A Hallway under a Bedroom (an inside wall to its north) and a Long Hallway past it (an
    // outside wall): one straight corridor.
    const m = modelOf(
      house([
        ['bedroom', 2, 1],
        ['hallway', 2, 3],
        ['longHallway', 4, 3],
      ]),
    );
    const a = runner(m, 2);
    const b = runner(m, 3);
    const sa = span(a, true);
    const sb = span(b, true);
    // The first ends at the joint and the second starts there, in one row.
    expect(sa.to).toBe(4 * CELL);
    expect(sb.from).toBe(4 * CELL);
    expect(sa.at.size).toBe(1);
    expect([...sb.at]).toEqual([...sa.at]);
    // Its ends are at the corridor's two ends: no end pieces at the joint.
    expect(a.filter((i) => i.sprite === 'runner-h-0').map((i) => i.x)).toEqual([sa.from]);
    expect(a.some((i) => i.sprite === 'runner-h-2')).toBe(false);
    expect(b.some((i) => i.sprite === 'runner-h-0')).toBe(false);
    expect(b.filter((i) => i.sprite === 'runner-h-2').length).toBe(1);
    // Its middles start on even px on both sides of the joint, so its checks stay in step.
    for (const i of [...a, ...b].filter((p) => p.sprite === 'runner-h-1')) expect(i.x % 2).toBe(0);
  });

  it('end each runner cleanly where a hall turns a corner or meets another from the side', () => {
    const m = modelOf(
      house([
        ['longHallway', 2, 3],
        ['hallway', 4, 4, 1],
      ]),
    );
    const across = span(runner(m, 1), true);
    const down = span(runner(m, 2), false);
    // The first keeps its ends; the second starts below the first, inside its own cells.
    expect(runner(m, 1).map((i) => i.sprite)).toContain('runner-h-2');
    expect(runner(m, 2)[0]!.sprite).toBe('runner-v-0');
    expect(down.from).toBeGreaterThanOrEqual(4 * CELL);
    expect(across.to).toBeLessThanOrEqual(5 * CELL);
  });

  it('keep the walkway on through a joint: nothing stands against a wall that isn’t there', () => {
    // A Hallway up from a Long Hallway's west end: its south end opens into the corridor.
    const m = modelOf(
      house([
        ['hallway', 3, 3, 1],
        ['longHallway', 3, 5],
      ]),
    );
    for (const it of roomItems(m, 1)) {
      if (it.sprite.startsWith('runner-')) continue;
      // Its pieces stand clear of the open end's last few px.
      expect(it.y + artSize(it.sprite).h, it.sprite).toBeLessThanOrEqual(5 * CELL - 4);
    }
  });
});

describe('the ghost', () => {
  const kept = (items: readonly Item[], re: RegExp) =>
    items
      .map((i) => i.sprite)
      .filter((sp) => re.test(sp))
      .sort();

  it('has the colors a new room will get, bumped by the older rooms of its type', () => {
    const two: Spec[] = [
      ['bedroom', 1, 1],
      ['bedroom', 3, 1],
    ];
    const look = newRoomLook(house(two), 'bedroom');
    const ghost = roomItems(pieceModel('bedroom', 0, look), 1);
    const built = roomItems(modelOf(house([...two, ['bedroom', 5, 1]])), 3);
    // The same bed and rug (where they stand may differ: the house gives it doors).
    expect(kept(ghost, /^(bed-|rug-)/)).toEqual(kept(built, /^(bed-|rug-)/));
  });

  it('carries a moved room’s colors and fixture', () => {
    const h = house([
      ['livingRoom', 1, 1, 0, 'fireplace'],
      ['livingRoom', 4, 1],
    ]);
    for (const uid of [1, 2]) {
      const look = roomLook(h, uid);
      const ghost = roomItems(pieceModel('livingRoom', 0, look), 1);
      const built = roomItems(modelOf(h), uid);
      expect(kept(ghost, /^(sofa-|fireplace)/), `uid ${uid}`).toEqual(
        kept(built, /^(sofa-|fireplace)/),
      );
    }
    expect(roomLook(h, 1).fixture).toBe('fireplace');
  });
});

describe('fixtures', () => {
  const only = (id: PieceId, fixture: FixtureId, rot: Rot = 0) => {
    const m = modelOf(house([[id, 4, 4, rot, fixture]]));
    return { m, layout: roomLayout(m, 1) };
  };

  it('Bunk Beds replace the bed, so the room that counts twice reads at a glance', () => {
    const { layout } = only('bedroom', 'bunkBeds');
    expect(layout.items.some((it) => it.sprite.startsWith('bunk-bed'))).toBe(true);
    expect(layout.items.some((it) => it.sprite.startsWith('bed-double'))).toBe(false);
    expect(layout.fixtureShown).toBe(true);
  });

  it('Bunk Beds take the bed’s place in a member’s room, which counts as a Bedroom (D-111)', () => {
    // The 2×2 rooms: the twins' crib, the Kids' Room's two beds, Grandma's, Nana's and Ivy's.
    for (const id of ['nursery', 'kidsRoom', 'grandmasRoom', 'nanasRoom', 'ivysRoom'] as const) {
      const { layout } = only(id, 'bunkBeds');
      const sprites = layout.items.map((it) => it.sprite);
      expect(
        sprites.some((sp) => sp.startsWith('bunk-bed')),
        id,
      ).toBe(true);
      expect(
        sprites.filter((sp) => /^(crib-|bed-)/.test(sp)),
        id,
      ).toEqual([]);
      expect(layout.fixtureShown, id).toBe(true);
    }
    // The one-cell-across rooms have no floor for them: their badge shows. Renfield's cot stays.
    for (const rot of [0, 1] as Rot[]) {
      expect(only('renfieldsRoom', 'bunkBeds', rot).layout.fixtureShown, `r${rot}`).toBe(false);
      expect(only('rowansStudio', 'bunkBeds', rot).layout.fixtureShown, `r${rot}`).toBe(false);
    }
    const upright = only('renfieldsRoom', 'bunkBeds', 1).layout.items.map((it) => it.sprite);
    expect(upright).toContain('cot');
  });

  it('a Kitchen Island stands in the middle of the kitchen, or keeps its badge', () => {
    // With the Living Room south of it, the front door is the Living Room's.
    const m = modelOf(
      house([
        ['kitchen', 4, 4, 0, 'kitchenIsland'],
        ['livingRoom', 4, 6, 1],
      ]),
    );
    const layout = roomLayout(m, 1);
    expect(layout.items.map((it) => it.sprite)).toContain('kitchen-island');
    expect(layout.fixtureShown).toBe(true);
    // A Kitchen alone has the front door in its south wall, and the full island would stand in
    // its walkway: a smaller one stands beside it.
    const alone = only('kitchen', 'kitchenIsland');
    expect(alone.m.exits.some((e) => e.uid === 1 && e.side === 'S')).toBe(true);
    expect(alone.layout.items.map((it) => it.sprite)).not.toContain('kitchen-island');
    expect(alone.layout.items.some((it) => it.sprite.startsWith('kitchen-island-'))).toBe(true);
    expect(alone.layout.fixtureShown).toBe(true);
  });

  it('an L-Kitchen’s island stands in its arm, in every rotation', () => {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const { m, layout } = only('lKitchen', 'kitchenIsland', rot);
      expect(
        layout.items.some((it) => it.sprite.startsWith('kitchen-island')),
        `r${rot}`,
      ).toBe(true);
      expect(layout.fixtureShown, `r${rot}`).toBe(true);
      expect(problems(m, 1), `r${rot}`).toEqual([]);
    }
  });

  it('a Living Room keeps its sofa in every rotation, with a Fireplace or without', () => {
    for (const fixture of [undefined, 'fireplace'] as const) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const m = modelOf(house([['livingRoom', 4, 4, rot, fixture]]));
        const sprites = roomItems(m, 1).map((i) => i.sprite);
        expect(
          sprites.some((sp) => sp.startsWith('sofa-')),
          `r${rot} ${fixture ?? ''}`,
        ).toBe(true);
        if (fixture) expect(sprites, `r${rot}`).toContain('fireplace');
      }
    }
    // A landscape room has the wall for both: the sofa stands beside the fireplace.
    const wide = roomItems(modelOf(house([['livingRoom', 4, 4, 1, 'fireplace']])), 1);
    const fire = wide.find((i) => i.sprite === 'fireplace')!;
    const sofa = wide.find((i) => i.sprite.startsWith('sofa-'))!;
    expect(
      Math.abs(sofa.y + artSize(sofa.sprite).h - (fire.y + artSize('fireplace').h)),
    ).toBeLessThan(16);
  });

  it('a Library keeps a bookcase beside its Fireplace, or keeps the bookcase and the badge', () => {
    for (const rot of [0, 1] as Rot[]) {
      const { layout } = only('library', 'fireplace', rot);
      const sprites = layout.items.map((i) => i.sprite);
      expect(
        sprites.some((sp) => sp.startsWith('bookcase')),
        `r${rot}`,
      ).toBe(true);
      expect(sprites, `r${rot}`).toContain('fireplace');
    }
    // In any house, a Library with a Fireplace has a bookcase.
    for (let seed = 1; seed <= 200; seed++) {
      const m = modelOf(randomHouse(seed * 7919));
      for (const r of m.rooms.values()) {
        if (r.defId !== 'library' || r.fixture !== 'fireplace') continue;
        const sprites = roomItems(m, r.uid).map((i) => i.sprite);
        if (!sprites.some((sp) => sp.startsWith('bookcase'))) {
          // Only where no bookcase stands at all, fireplace or not.
          expect(sprites, `seed ${seed}`).not.toContain('fireplace');
        }
      }
    }
  });

  it('a kitchen’s run has the range and the counter with the sink', () => {
    for (const rot of [0, 1] as Rot[]) {
      const sprites = only('kitchen', 'skylight', rot).layout.items.map((i) => i.sprite);
      expect(sprites, `r${rot}`).toContain('range');
      expect(sprites, `r${rot}`).toContain('counter-sink');
    }
  });

  it('a Fireplace takes a Living Room’s north wall, and the sofa faces the room in front of it', () => {
    const { layout } = only('livingRoom', 'fireplace');
    const fire = layout.items.find((it) => it.sprite === 'fireplace')!;
    const sofa = layout.items.find((it) => it.sprite.startsWith('sofa'))!;
    expect(fire).toBeDefined();
    expect(sofa.y).toBeGreaterThan(fire.y + spritePos('fireplace').h - 8);
    expect(layout.fixtureShown).toBe(true);
  });

  it('keep their badge where they don’t fit: a Fireplace in a one-cell Bathroom', () => {
    expect(only('bathroom', 'fireplace').layout.fixtureShown).toBe(false);
    // Bunk Beds that don't fit leave the bed, and the badge.
    const m = modelOf(
      house([
        ['bedroom', 4, 4, 0, 'bunkBeds'],
        ['hallway', 4, 3],
      ]),
    );
    const layout = roomLayout(m, 1);
    if (!layout.fixtureShown)
      expect(layout.items.some((it) => it.sprite.startsWith('bed-double'))).toBe(true);
  });

  it('Blackout Curtains hang where the furniture leaves a north face in view, or keep their badge', () => {
    // A Closet has no windows to darken, and its rail stands in front of its north face.
    const closet = only('closet', 'blackoutCurtains').layout;
    expect(closet.drape).toBeUndefined();
    expect(closet.fixtureShown).toBe(false);
    // A Dining Room's table stands in the middle of the floor (the front door is the Living
    // Room's, below it): the drapes hang on its face.
    const m = modelOf(
      house([
        ['diningRoom', 4, 4, 0, 'blackoutCurtains'],
        ['livingRoom', 4, 6, 1],
      ]),
    );
    const dining = { m, layout: roomLayout(m, 1) };
    const d = dining.layout.drape!;
    expect(d.w).toBeGreaterThanOrEqual(10);
    expect(d.y).toBe(4 * CELL + WALL.out);
    expect(dining.layout.fixtureShown).toBe(true);
    // Never behind a piece of furniture.
    for (const it of dining.layout.items.filter((i) => !FLAT.test(i.sprite))) {
      const { w, h } = artSize(it.sprite);
      expect(overlaps(d, { x: it.x, y: it.y, w, h }), it.sprite).toBe(false);
    }
  });

  it('Soundproofing always shows: its pads line the room’s wall bands, over the furniture', () => {
    for (const id of INDOOR) {
      for (const rot of [0, 1] as Rot[]) {
        expect(only(id, 'soundproofing', rot).layout.fixtureShown, `${id} r${rot}`).toBe(true);
      }
    }
  });

  it('painted fixtures show wherever their room has the wall for them', () => {
    for (const f of ['skylight', 'soundproofing', 'blackoutCurtains', 'chandelier'] as const) {
      expect(only(f === 'chandelier' ? 'diningRoom' : 'bedroom', f).layout.fixtureShown, f).toBe(
        true,
      );
    }
    const bay = only('livingRoom', 'bayWindow');
    expect(bay.layout.fixtureShown).toBe(true);
    const pane = bay.m.windows.find((w) => w.bay);
    // The street side first.
    expect(pane?.side).toBe('S');
    // A room boxed in on every side has no outside wall for a bay: its badge shows.
    const m = modelOf(boxedIn('bathroom', 0, 'NESW', 'bayWindow'));
    expect(m.windows.some((w) => w.bay)).toBe(false);
    expect(roomLayout(m, 1).fixtureShown).toBe(false);
  });
});

describe('the members’ rooms (D-111)', () => {
  const sprites = (m: HouseModel, uid = 1) => roomItems(m, uid).map((it) => it.sprite);

  it('grow with the twins: the Nursery’s crib, then two beds once it is a Kids’ Room', () => {
    const nursery = sprites(modelOf(house([['nursery', 4, 4]])));
    expect(nursery.filter((sp) => sp.startsWith('crib-twin'))).toHaveLength(1);
    expect(nursery.some((sp) => sp.startsWith('bed-'))).toBe(false);
    // The same piece once it has grown (its type changes, so its art does).
    const kids = sprites(modelOf(house([['kidsRoom', 4, 4]])));
    expect(kids.filter((sp) => sp.startsWith('bed-single'))).toHaveLength(2);
    expect(kids.some((sp) => sp.startsWith('crib-'))).toBe(false);
  });

  it('keep Nana’s dogs close: their bed beside hers', () => {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const items = roomItems(pieceModel('nanasRoom', rot), 1);
      const bed = items.find((it) => it.sprite.startsWith('bed-double'))!;
      const dogs = items.find((it) => it.sprite === 'own-dog-bed')!;
      expect(dogs, `r${rot}`).toBeDefined();
      // Against the same north wall, side by side.
      const beside =
        dogs.x + artSize(dogs.sprite).w === bed.x || bed.x + artSize(bed.sprite).w === dogs.x;
      expect(beside, `r${rot}`).toBe(true);
    }
  });

  it('fit their one-cell-across rooms: Renfield’s cot and Rowan’s easel in both orientations', () => {
    // One cell wide (r1): the upright cot, the full easel. One cell deep (r0): the side-on cot and
    // the easel without its finial, 26 px, under the north wall's band and face.
    expect(sprites(pieceModel('renfieldsRoom', 1))).toContain('cot');
    expect(sprites(pieceModel('renfieldsRoom', 0))).toContain('cot-side');
    expect(sprites(pieceModel('rowansStudio', 1)).some((sp) => /^easel-\d/.test(sp))).toBe(true);
    expect(sprites(pieceModel('rowansStudio', 0)).some((sp) => sp.startsWith('easel-low'))).toBe(
      true,
    );
    for (const id of ['renfieldsRoom', 'rowansStudio'] as const) {
      for (const rot of [0, 1] as Rot[]) {
        expect(problems(pieceModel(id, rot), 1), `${id} r${rot}`).toEqual([]);
      }
    }
  });

  it('are never bare in any house', () => {
    const members = new Set<PieceId>(INDOOR.filter((id) => CONTENT.pieces[id].member));
    let seen = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const m = modelOf(randomHouse(seed * 7919));
      for (const r of m.rooms.values()) {
        if (!members.has(r.defId)) continue;
        seen++;
        expect(roomItems(m, r.uid).length, `seed ${seed} ${r.defId}`).toBeGreaterThan(0);
      }
    }
    expect(seen).toBeGreaterThan(200);
  });
});

// Random houses with random room fixtures: every room's layout keeps to the rules.
function randomHouse(seed: number): HouseState {
  let s = seed >>> 0 || 1;
  const rand = (n: number) => {
    s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0;
    return s % n;
  };
  const W = 14;
  const rows = Array.from({ length: W }, (_, y) =>
    Array.from({ length: W }, (_, x) => ((x * 7 + y * 13 + seed) % 23 === 0 ? 'T' : '.')).join(''),
  );
  const taken = new Set<string>();
  const indoor = new Set<string>();
  const pieces: PlacedPiece[] = [];
  const free = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < W && !taken.has(`${x},${y}`) && rows[y]![x] === '.';
  const place = (defId: PieceId) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const rot = rand(4) as Rot;
      const cells = placedCells(CONTENT.pieces[defId].shape, rand(W), rand(W), rot);
      if (!cells.every((c) => free(c.x, c.y))) continue;
      const touches = cells.some((c) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => indoor.has(`${c.x + dx!},${c.y + dy!}`)),
      );
      if (indoor.size > 0 && CONTENT.pieces[defId].category === 'indoor' && !touches) continue;
      for (const c of cells) {
        taken.add(`${c.x},${c.y}`);
        if (CONTENT.pieces[defId].category === 'indoor') indoor.add(`${c.x},${c.y}`);
      }
      const x = Math.min(...cells.map((c) => c.x));
      const y = Math.min(...cells.map((c) => c.y));
      const fixture =
        CONTENT.pieces[defId].category === 'indoor' && rand(3) === 0
          ? defId === 'bedroom' && rand(2)
            ? 'bunkBeds'
            : (defId === 'kitchen' || defId === 'lKitchen') && rand(2)
              ? 'kitchenIsland'
              : (defId === 'diningRoom' || defId === 'livingRoom') && rand(2)
                ? 'chandelier'
                : ROOM_FIXTURES[rand(ROOM_FIXTURES.length)]!
          : undefined;
      pieces.push({
        uid: pieces.length + 1,
        defId,
        x,
        y,
        rot,
        placedWeek: 0,
        ...(fixture ? { fixture: { id: fixture, week: 0 } } : {}),
      });
      return;
    }
  };
  const rooms = 4 + rand(12);
  for (let i = 0; i < rooms; i++) place(INDOOR[rand(INDOOR.length)]!);
  for (const y of ['patio', 'driveway', 'hotTub'] as const) place(y);
  return { lot: lotFromRows(rows), pieces, nextUid: pieces.length + 1 };
}

describe('any house', () => {
  it('lays every room out inside its walls, off its doorways and off itself', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const m = modelOf(randomHouse(seed));
        for (const uid of m.rooms.keys()) expect(problems(m, uid), `seed ${seed}`).toEqual([]);
      }),
      { numRuns: 400 },
    );
  });

  it('hangs Blackout Curtains in view, or shows their badge where no window or face shows them', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const m = modelOf(randomHouse(seed));
        for (const r of m.rooms.values()) {
          if (r.fixture !== 'blackoutCurtains') continue;
          const layout = roomLayout(m, r.uid);
          const d = layout.drape;
          if (d) {
            // On a north face of its own, in front of nothing that stands there.
            expect(d.w, `seed ${seed}`).toBeGreaterThanOrEqual(10);
            for (const it of layout.items.filter((i) => !FLAT.test(i.sprite))) {
              const { w, h } = artSize(it.sprite);
              expect(overlaps(d, { x: it.x, y: it.y, w, h }), `seed ${seed} ${it.sprite}`).toBe(
                false,
              );
            }
          }
          const windows = m.windows.some((w) => w.uid === r.uid);
          expect(layout.fixtureShown, `seed ${seed}`).toBe(windows || !!d);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('furnishes nearly every room (a narrow one with a door in each wall may stay bare)', () => {
    let rooms = 0;
    let furnished = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const m = modelOf(randomHouse(seed * 7919));
      for (const uid of m.rooms.keys()) {
        rooms++;
        if (roomItems(m, uid).length > 0) furnished++;
      }
    }
    expect(furnished / rooms).toBeGreaterThan(0.97);
  });
});
