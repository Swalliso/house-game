// The house on the board (D-097), in the board's layers (layers.ts), bottom to top:
// - floor: one canvas of floors, north wall faces, floor shadows and the house's shadow
// - items: one container per piece, ordered by its bottom row: a room's furniture, or a yard
//   piece (drawn as its placeholder cells until the yard has its own art)
// - walls: one canvas of wall bands, doorways, windows, garage rails and doormats
// - overhang: the parts of tall items that rise over their room's north wall
// - highlights: the tally's active piece, a set's members, the placement's new sets, and each
//   piece's flash, as outlines (never CSS filters on whole pieces)
// - labels: each piece's digit and its fixture and ⚠ badges, inside its walls
//
// The canvases redraw only when the house changes: never on hover, a tally step, or zoom
// (zoom only changes their CSS size). The house model and the rooms' items are cached per house.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import {
  CONTENT,
  type Cell,
  type FixtureId,
  type HouseState,
  type Lot,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import {
  paintFloors,
  paintPiece,
  paintWalls,
  type AtlasPixels,
  type Pixels,
} from '../art/house-paint.ts';
import { roomItems, type Item } from '../art/rooms.ts';
import { highlighted, justPlaced, played, tallyView } from '../fx/director.ts';
import { settings } from '../settings.ts';
import { atlasImage, CELL, cellUnit, FIXTURE_GLYPHS, spritePos, spriteStyle } from '../sprites.ts';
import { currentTally, preview, tool } from '../store.ts';
import { cellsOutline, digitCell, type Occupancy } from './geometry.ts';
import { inset, pieceModel, type HouseModel } from './house-model.ts';
import { PieceShape } from './PieceView.tsx';
import { register, settle as settleFx } from './piece-fx.ts';
import './house.css';

let atlasData: Promise<AtlasPixels> | null = null;

/** The atlas's pixels, read once, for the painters. */
export function atlasPixels(): Promise<AtlasPixels> {
  atlasData ??= atlasImage().then((img) => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    return { width: d.width, height: d.height, data: d.data };
  });
  return atlasData;
}

function put(ctx: CanvasRenderingContext2D, p: Pixels | null): void {
  if (p)
    ctx.putImageData(new ImageData(p.data as Uint8ClampedArray<ArrayBuffer>, p.w, p.h), p.x, p.y);
}

/** A canvas over the whole board (the lot and its street row), at art resolution. */
function HouseCanvas({
  lot,
  scale,
  model,
  layer,
}: {
  lot: Lot;
  scale: number;
  model: HouseModel;
  layer: 'floor' | 'walls';
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let cancelled = false;
    if (layer === 'walls') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      put(ctx, paintWalls(model));
    } else {
      atlasPixels()
        .then((atlas) => {
          if (cancelled) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          put(ctx, paintFloors(model, atlas));
        })
        .catch((e) => console.error(e));
    }
    return () => {
      cancelled = true;
    };
  }, [model, layer]);
  return (
    <canvas
      ref={ref}
      class={`house-${layer}`}
      width={lot.width * CELL}
      height={(lot.height + 1) * CELL}
      style={{
        width: `${lot.width * CELL * scale}px`,
        height: `${(lot.height + 1) * CELL * scale}px`,
      }}
      aria-hidden="true"
    />
  );
}

export function FloorLayer(p: { lot: Lot; scale: number; model: HouseModel }) {
  return <HouseCanvas {...p} layer="floor" />;
}

export function WallsLayer(p: { lot: Lot; scale: number; model: HouseModel }) {
  return <HouseCanvas {...p} layer="walls" />;
}

/** An item's part: all of it, or the rows above (`top`) or below its `over` line. */
function ItemPart({
  item,
  box,
  scale,
  part,
}: {
  item: Item;
  box: { x: number; y: number };
  scale: number;
  part: 'all' | 'top' | 'bottom';
}) {
  const { w, h } = spritePos(item.sprite);
  const cut = item.over === undefined ? 0 : Math.min(Math.max(item.over - item.y, 0), h);
  const from = part === 'bottom' ? cut : 0;
  const to = part === 'top' ? cut : h;
  if (to <= from) return null;
  const style = spriteStyle(item.sprite, scale);
  const [bx, by] = style.backgroundPosition!.split(' ').map((v) => Number.parseFloat(v));
  return (
    <div
      class="item"
      style={{
        ...style,
        backgroundPosition: `${bx}px ${by! - from * scale}px`,
        left: `${(item.x - box.x) * scale}px`,
        top: `${(item.y + from - box.y) * scale}px`,
        width: `${w * scale}px`,
        height: `${(to - from) * scale}px`,
      }}
    />
  );
}

/** A room's items under the walls. */
function RoomItems({
  uid,
  model,
  scale,
  settle,
}: {
  uid: number;
  model: HouseModel;
  scale: number;
  settle?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const room = model.rooms.get(uid)!;
  const items = roomItems(model, uid);
  useEffect(() => (ref.current ? register(uid, 'items', ref.current) : undefined), [uid]);
  useEffect(() => {
    if (!settle || settle <= played.settle || settings.value.reduceMotion) return;
    played.settle = settle;
    settleFx(uid);
  }, [settle]);
  const box = room.box;
  return (
    <div
      ref={ref}
      class="room-items"
      style={{
        left: `${box.x * scale}px`,
        top: `${box.y * scale}px`,
        width: `${box.w * scale}px`,
        height: `${box.h * scale}px`,
        zIndex: (box.y + box.h) / CELL,
      }}
    >
      {items.map((item, i) => (
        <ItemPart key={i} item={item} box={box} scale={scale} part="bottom" />
      ))}
    </div>
  );
}

/**
 * One container per piece: a room's furniture, or a yard piece's placeholder cells. Each
 * orders itself by its bottom row, so things further south are in front.
 */
export function ItemsLayer({
  house,
  model,
  occ,
  scale,
}: {
  house: HouseState;
  model: HouseModel;
  occ: Occupancy;
  scale: number;
}) {
  const placed = justPlaced.value;
  return (
    <div class="items">
      {house.pieces.map((p) => {
        const settle = placed?.uid === p.uid ? placed.id : undefined;
        if (model.rooms.has(p.uid)) {
          return <RoomItems key={p.uid} uid={p.uid} model={model} scale={scale} settle={settle} />;
        }
        const cells = occ.cells.get(p.uid)!;
        return (
          <PieceShape
            key={p.uid}
            uid={p.uid}
            defId={p.defId}
            cells={cells}
            scale={scale}
            settle={settle}
            style={{ zIndex: Math.max(...cells.map((c) => c.y)) + 1 }}
          />
        );
      })}
    </div>
  );
}

/** The parts of tall items that rise over their room's north wall, above the walls. */
export function OverhangLayer({ model, scale }: { model: HouseModel; scale: number }) {
  return (
    <div class="overhang">
      {[...model.rooms.values()].map((room) => {
        const tops = roomItems(model, room.uid).filter(
          (it) => it.over !== undefined && it.y < it.over,
        );
        return tops.length > 0 ? (
          <RoomOverhang key={room.uid} uid={room.uid} model={model} items={tops} scale={scale} />
        ) : null;
      })}
    </div>
  );
}

function RoomOverhang({
  uid,
  model,
  items,
  scale,
}: {
  uid: number;
  model: HouseModel;
  items: readonly Item[];
  scale: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? register(uid, 'overhang', ref.current) : undefined), [uid]);
  const box = model.rooms.get(uid)!.box;
  return (
    <div
      ref={ref}
      class="room-overhang"
      style={{
        left: `${box.x * scale}px`,
        top: `${box.y * scale}px`,
        width: `${box.w * scale}px`,
        height: `${box.h * scale}px`,
        zIndex: (box.y + box.h) / CELL,
      }}
    >
      {items.map((item, i) => (
        <ItemPart key={i} item={item} box={box} scale={scale} part="top" />
      ))}
    </div>
  );
}

/** A piece's flash: its cells in white, shown only while it wobbles or settles. */
function Flash({ uid, d }: { uid: number; d: string }) {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => (ref.current ? register(uid, 'flash', ref.current) : undefined), [uid]);
  return <path ref={ref} class="hl-flash" d={d} />;
}

/**
 * Highlights as outlines over the house: the tally's active piece (a warm rim), a held set's
 * members during its beat and the sets a placement would complete (Charm's rose, with a
 * dashed edge so it's never color alone), and each piece's flash.
 */
export function HighlightsLayer({
  house,
  occ,
  lot,
  scale,
}: {
  house: HouseState;
  occ: Occupancy;
  lot: Lot;
  scale: number;
}) {
  const px = CELL * scale;
  const active = tallyView.value?.activeUid ?? null;
  const lit = highlighted.value;
  const p = tool.value === 'demolish' ? null : preview.value;
  const gained = p?.setsGained.flatMap((s) => s.members) ?? [];
  const flashes = useMemo(
    () =>
      house.pieces.map((piece: PlacedPiece) => ({
        uid: piece.uid,
        d: cellsOutline(occ.cells.get(piece.uid) ?? [], px).fill,
      })),
    [house, occ, px],
  );
  const outline = (uid: number, cls: string) => {
    const cells = occ.cells.get(uid);
    if (!cells) return null;
    const { fill, edge } = cellsOutline(cells, px);
    return (
      <g key={`${cls}${uid}`} class={cls}>
        <path class="fill" d={fill} />
        <path class="edge" d={edge} />
      </g>
    );
  };
  return (
    <svg
      class="highlights"
      width={lot.width * px}
      height={(lot.height + 1) * px}
      aria-hidden="true"
    >
      {flashes.map((f) => (
        <Flash key={f.uid} uid={f.uid} d={f.d} />
      ))}
      {[...new Set(gained)].map((uid) => outline(uid, 'hl-set'))}
      {lit.map((uid) => outline(uid, 'hl-lit'))}
      {active !== null && outline(active, 'hl-active')}
    </svg>
  );
}

/** A piece's weekly score, in its bottom-right cell inside its walls. */
function Digit({ uid, value, style }: { uid: number; value: number; style: JSX.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => (ref.current ? register(uid, 'digit', ref.current) : undefined), [uid]);
  return (
    <div class={`digit ${value === 0 ? 'zero' : ''}`} style={style}>
      <span ref={ref} class="digit-n">
        {value}
      </span>
    </div>
  );
}

/** A fixture's badge in the piece's top-right cell, with its rarity's edge. */
function FixtureBadge({
  id,
  left,
  top,
  size,
}: {
  id: FixtureId;
  left: number;
  top: number;
  size: number;
}) {
  const def = CONTENT.fixtures[id];
  return (
    <div
      class={`fixture-badge rarity-${def.rarity}`}
      title={`${def.name} (fixture)`}
      aria-label={`${def.name} installed`}
      style={{
        left: `${left - size}px`,
        top: `${top}px`,
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size * 0.72)}px`,
      }}
    >
      {FIXTURE_GLYPHS[id]}
    </div>
  );
}

/**
 * Each piece's labels: its weekly score in its bottom-right cell (or, while a tally plays,
 * what it earned in the week being tallied), its fixture's badge top right, and a ⚠ top left
 * when a requirement isn't met (it earns nothing then). Inside the room's walls.
 */
export function LabelsLayer({
  house,
  model,
  occ,
  scale,
}: {
  house: HouseState;
  model: HouseModel;
  occ: Occupancy;
  scale: number;
}) {
  const view = tallyView.value;
  const tally = currentTally.value;
  const scoreBy = new Map((view?.pieces ?? tally.pieces).map((s) => [s.uid, s]));
  const px = CELL * scale;
  const unit = cellUnit(px);
  return (
    <div class="labels">
      {house.pieces.map((piece) => {
        const cells = occ.cells.get(piece.uid);
        if (!cells) return null;
        const score = scoreBy.get(piece.uid);
        const room = model.rooms.has(piece.uid);
        const ins = (c: Cell, side: 'N' | 'E' | 'S' | 'W') =>
          room ? inset(model, c.x, c.y, side) * scale : 0;
        const shown = score ? (score.unmet ? 0 : score.earned) : undefined;
        const d = digitCell(cells);
        const topRow = Math.min(...cells.map((c) => c.y));
        const tr = {
          x: Math.max(...cells.filter((c) => c.y === topRow).map((c) => c.x)),
          y: topRow,
        };
        const tl = [...cells].sort((a, b) => a.y - b.y || a.x - b.x)[0]!;
        const gap = Math.max(1, unit);
        const badge = Math.max(14, 6 * unit);
        return (
          <div key={piece.uid} class="piece-labels">
            {shown !== undefined && (
              <Digit
                uid={piece.uid}
                value={shown}
                style={{
                  left: `${(d.x + 1) * px - ins(d, 'E')}px`,
                  top: `${(d.y + 1) * px - ins(d, 'S')}px`,
                  fontSize: `${Math.max(11, 5 * unit)}px`,
                }}
              />
            )}
            {piece.fixture && (
              <FixtureBadge
                id={piece.fixture.id}
                left={(tr.x + 1) * px - ins(tr, 'E') - gap}
                top={tr.y * px + ins(tr, 'N') + gap}
                size={badge}
              />
            )}
            {score?.unmet && (
              <div
                class="unmet-badge"
                title={`Earns nothing: it must be ${score.unmet}`}
                aria-label={`Earns nothing: it must be ${score.unmet}`}
                style={{
                  left: `${tl.x * px + ins(tl, 'W') + gap}px`,
                  top: `${tl.y * px + ins(tl, 'N') + gap}px`,
                  fontSize: `${Math.max(11, 4.5 * unit)}px`,
                }}
              >
                {'⚠︎'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The room being placed (or carried by the Moving Truck): drawn with the house's own painters
 * for that piece alone, its own outline walls and no doors, with the placement's tint over
 * each cell. Redrawn only when the piece or its rotation changes; moving it is CSS.
 */
export function GhostRoom({
  defId,
  rot,
  cells,
  scale,
  class: cls,
}: {
  defId: PieceId;
  rot: Rot;
  cells: readonly Cell[];
  scale: number;
  class: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const model = pieceModel(defId, rot);
  const px = CELL * scale;
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  // One tint over the whole room, outlined around its edge: no grid lines across its walls.
  const tint = useMemo(
    () =>
      cellsOutline(
        cells.map((c) => ({ x: c.x - minX, y: c.y - minY })),
        px,
      ),
    [cells, minX, minY, px],
  );
  useEffect(() => {
    let cancelled = false;
    atlasPixels()
      .then((atlas) => {
        const ctx = ref.current?.getContext('2d');
        if (cancelled || !ctx) return;
        ctx.clearRect(0, 0, model.width * CELL, model.height * CELL);
        put(ctx, paintPiece(model, atlas, roomItems(model, 1)));
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [model]);
  return (
    <div
      class={`piece ghost-room ${cls}`}
      style={{
        left: `${minX * px}px`,
        top: `${minY * px}px`,
        width: `${model.width * px}px`,
        height: `${model.height * px}px`,
      }}
    >
      <canvas
        ref={ref}
        width={model.width * CELL}
        height={model.height * CELL}
        style={{ width: `${model.width * px}px`, height: `${model.height * px}px` }}
      />
      <svg
        class="ghost-tint"
        width={model.width * px}
        height={model.height * px}
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="ghost-hatch"
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect class="hatch-on" width="4" height="9" />
            <rect class="hatch-off" x="4" width="5" height="9" />
          </pattern>
        </defs>
        <path class="fill" d={tint.fill} />
        <path class="edge" d={tint.edge} />
      </svg>
    </div>
  );
}
