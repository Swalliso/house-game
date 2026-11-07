// The house on the board (D-097), in the board's layers (layers.ts), bottom to top:
// - floor: one canvas of floors, north wall faces, floor shadows and the house's shadow
// - floor also holds the yard's ground (yard.ts), the doormats, and the curb cuts
// - items: one container per piece, ordered by its bottom row: a room's furniture, or a yard
//   piece's props (yard.ts)
// - walls: one canvas of wall bands, doorways, windows and garage rails
// - overhang: the parts of tall items that rise over their room's north wall, or above a yard
//   piece's own cells (outbuildings' roofs, the Treehouse, a Birdhouse's box)
// - highlights: the tally's active piece, a set's members, the placement's new sets, and each
//   piece's flash, as outlines (never CSS filters on whole pieces)
// - labels: each piece's digit and its fixture and ⚠ badges, inside its walls
//
// The canvases redraw only when the house changes: never on hover, a tally step, or zoom
// (zoom only changes their CSS size), and before the browser paints, so a new room's floor and
// walls show in the same frame as its furniture. The house model, the rooms' items and the yard
// are cached per house.

import type { JSX } from 'preact';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
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
  artFrames,
  artSize,
  drawingPixels,
  isDrawing,
  type ArtId,
  type DrawingId,
} from '../art/drawings.ts';
import {
  Canvas,
  paintFloors,
  paintPiece,
  paintWalls,
  paintYardPiece,
  type AtlasPixels,
  type Pixels,
} from '../art/house-paint.ts';
import { itemRows, roomItems, roomLayout, type Item } from '../art/rooms.ts';
import { yardPieceLayout, type YardModel } from '../art/yard.ts';
import { highlighted, justPlaced, played, tallyView } from '../fx/director.ts';
import { settings } from '../settings.ts';
import { atlasImage, CELL, FIXTURE_ICONS, spriteStyle } from '../sprites.ts';
import { ICON_SIZES, type IconName } from '../theme/art.ts';
import { currentTally, preview, tool } from '../store.ts';
import { cellsOutline, isIndoor, type Occupancy } from './geometry.ts';
import { inset, pieceModel, type HouseModel, type PieceLook, type Rect } from './house-model.ts';
import { pieceLabels, type BadgeSpot, type Side } from './label-layout.ts';
import { register, settle as settleFx } from './piece-fx.ts';
import './house.css';

let atlasData: Promise<AtlasPixels> | null = null;
/** The atlas's pixels once they're read: from then on the canvases paint before the browser does. */
let atlasReady: AtlasPixels | null = null;

/** The atlas's pixels, read once, for the painters. */
export function atlasPixels(): Promise<AtlasPixels> {
  atlasData ??= atlasImage().then((img) => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    atlasReady = { width: d.width, height: d.height, data: d.data };
    return atlasReady;
  });
  return atlasData;
}

/**
 * Paints with the atlas: at once when it's read, so a canvas changes in the same frame as the DOM
 * around it (a placed room's floor and walls with its furniture, never a frame of bare grass);
 * only the very first paint waits for it. Returns a canceller for a paint that's still waiting.
 */
function withAtlas(paint: (atlas: AtlasPixels) => void): () => void {
  if (atlasReady) {
    paint(atlasReady);
    return () => {};
  }
  let cancelled = false;
  atlasPixels()
    .then((atlas) => {
      if (!cancelled) paint(atlas);
    })
    .catch((e) => console.error(e));
  return () => {
    cancelled = true;
  };
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
  yard,
  layer,
}: {
  lot: Lot;
  scale: number;
  model: HouseModel;
  yard?: YardModel;
  layer: 'floor' | 'walls';
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Before the browser paints: the canvas changes in the same frame as the house's DOM.
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (layer === 'walls') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      put(ctx, paintWalls(model));
      return;
    }
    return withAtlas((atlas) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      put(ctx, paintFloors(model, atlas, { ...(yard ? { yard } : {}) }));
    });
  }, [model, yard, layer]);
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

/** The floor canvas: the yard's ground, the house's shadow, doormats, floors and wall faces. */
export function FloorLayer(p: { lot: Lot; scale: number; model: HouseModel; yard: YardModel }) {
  return <HouseCanvas {...p} layer="floor" />;
}

export function WallsLayer(p: { lot: Lot; scale: number; model: HouseModel }) {
  return <HouseCanvas {...p} layer="walls" />;
}

const drawingUrls = new Map<DrawingId, string>();

/** One of our drawings (drawings.ts) as an image, made once. */
function drawingUrl(id: DrawingId): string {
  let url = drawingUrls.get(id);
  if (!url) {
    const d = drawingPixels(id);
    const c = document.createElement('canvas');
    c.width = d.w * d.frames;
    c.height = d.h;
    const data = new Uint8ClampedArray(d.data);
    c.getContext('2d')!.putImageData(new ImageData(data, c.width, c.height), 0, 0);
    url = c.toDataURL();
    drawingUrls.set(id, url);
  }
  return url;
}

/**
 * An item's art as a CSS background at `scale` CSS px per art px: an atlas sprite, or one of our
 * drawings. (bx, by) is where its first frame's top-left starts.
 */
function artStyle(id: ArtId, scale: number): { style: JSX.CSSProperties; bx: number; by: number } {
  if (isDrawing(id)) {
    const d = drawingPixels(id);
    return {
      style: {
        backgroundImage: `url(${drawingUrl(id)})`,
        backgroundSize: `${d.w * d.frames * scale}px ${d.h * scale}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      },
      bx: 0,
      by: 0,
    };
  }
  const style = spriteStyle(id, scale);
  const [bx, by] = style.backgroundPosition!.split(' ').map((v) => Number.parseFloat(v));
  return { style, bx: bx!, by: by! };
}

/**
 * An item's rows under the walls (`bottom`: all of them, unless it rises above its cells) or over
 * them (`top`). An animated item's frames sit side by side in a strip that slides behind the
 * item's box (transform only), under the walls; its top stays on the first frame.
 */
function ItemPart({
  item,
  box,
  scale,
  part,
}: {
  item: Item;
  box: { x: number; y: number };
  scale: number;
  part: 'top' | 'bottom';
}) {
  const { w } = artSize(item.sprite);
  const rows = itemRows(item)[part];
  if (!rows) return null;
  const [from, to] = rows;
  const { style, bx, by } = artStyle(item.sprite, scale);
  const place = {
    left: `${(item.x - box.x) * scale}px`,
    top: `${(item.y + from - box.y) * scale}px`,
    width: `${w * scale}px`,
    height: `${(to - from) * scale}px`,
  };
  const anim = part === 'bottom' ? artFrames(item.sprite) : null;
  if (anim) {
    return (
      <div class="item" style={{ ...place, overflow: 'hidden' }}>
        <div
          class="item-frames"
          style={{
            ...style,
            backgroundPosition: `${bx}px ${by - from * scale}px`,
            width: `${anim.stride * anim.frames * scale}px`,
            height: '100%',
            animationDuration: `${anim.ms * anim.frames}ms`,
            animationTimingFunction: `steps(${anim.frames})`,
            '--item-frames': `${-anim.stride * anim.frames * scale}px`,
          }}
        />
      </div>
    );
  }
  return (
    <div
      class="item"
      style={{ ...style, ...place, backgroundPosition: `${bx}px ${by - from * scale}px` }}
    />
  );
}

/** A piece's items under the walls: a room's furniture, or a yard piece's props. */
function PieceItems({
  uid,
  box,
  items,
  scale,
  settle,
}: {
  uid: number;
  box: Rect;
  items: readonly Item[];
  scale: number;
  settle?: number | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Registered and settled before the browser paints, so the first frame a placed piece is seen
  // in is the settle's first (the parts that mount in other layers join it: piece-fx.ts).
  useLayoutEffect(() => (ref.current ? register(uid, 'items', ref.current) : undefined), [uid]);
  useLayoutEffect(() => {
    if (!settle || settle <= played.settle || settings.value.reduceMotion) return;
    played.settle = settle;
    settleFx(uid);
  }, [settle]);
  return (
    <div
      ref={ref}
      class="piece-items"
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
 * One container per piece: a room's furniture, or a yard piece's props. Each orders itself by its
 * bottom row, so things further south are in front.
 */
export function ItemsLayer({
  house,
  model,
  yard,
  scale,
}: {
  house: HouseState;
  model: HouseModel;
  yard: YardModel;
  scale: number;
}) {
  const placed = justPlaced.value;
  return (
    <div class="items">
      {house.pieces.map((p) => {
        const settle = placed?.uid === p.uid ? placed.id : undefined;
        const room = model.rooms.get(p.uid);
        const at = room
          ? { box: room.box, items: roomItems(model, p.uid) }
          : yard.pieces.get(p.uid);
        if (!at) return null;
        return (
          <PieceItems
            key={p.uid}
            uid={p.uid}
            box={at.box}
            items={at.items}
            scale={scale}
            settle={settle}
          />
        );
      })}
    </div>
  );
}

/**
 * The parts of items above their own cells, above the walls: tall furniture over its room's north
 * wall, and a yard piece's parts above its cells (outbuildings' roofs, the Treehouse, a car's roof).
 */
export function OverhangLayer({
  model,
  yard,
  scale,
}: {
  model: HouseModel;
  yard: YardModel;
  scale: number;
}) {
  const tops = (items: readonly Item[]) => items.filter((it) => itemRows(it).top);
  const parts = [
    ...[...model.rooms.values()].map((r) => ({
      uid: r.uid,
      box: r.box,
      items: tops(roomItems(model, r.uid)),
    })),
    ...[...yard.pieces.values()].map((l) => ({ uid: l.uid, box: l.box, items: tops(l.items) })),
  ];
  return (
    <div class="overhang">
      {parts.map((p) =>
        p.items.length > 0 ? (
          <PieceOverhang key={p.uid} uid={p.uid} box={p.box} items={p.items} scale={scale} />
        ) : null,
      )}
    </div>
  );
}

function PieceOverhang({
  uid,
  box,
  items,
  scale,
}: {
  uid: number;
  box: Rect;
  items: readonly Item[];
  scale: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => (ref.current ? register(uid, 'overhang', ref.current) : undefined), [uid]);
  return (
    <div
      ref={ref}
      class="piece-overhang"
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
  useLayoutEffect(() => (ref.current ? register(uid, 'flash', ref.current) : undefined), [uid]);
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
  useLayoutEffect(() => (ref.current ? register(uid, 'digit', ref.current) : undefined), [uid]);
  return (
    <div class={`digit ${value === 0 ? 'zero' : ''}`} style={style}>
      <span ref={ref} class="digit-n">
        {value}
      </span>
    </div>
  );
}

/**
 * A badge on a piece (label-layout.ts places it): a square in LimeZu's ink, one icon pixel wide,
 * its icon on whole device pixels; just the ring and its fill where the cell has no room for the
 * icon. Its title says what it is.
 */
function Badge({
  spot,
  icon,
  class: cls,
  label,
}: {
  spot: BadgeSpot;
  icon: IconName;
  class: string;
  label: string;
}) {
  const { w, h } = ICON_SIZES[icon];
  return (
    <div
      class={`board-badge ${cls}`}
      title={label}
      aria-label={label}
      style={{
        left: `${spot.x}px`,
        top: `${spot.y}px`,
        width: `${spot.w}px`,
        height: `${spot.h}px`,
        borderWidth: `${spot.ring}px`,
      }}
    >
      {spot.icon > 0 && (
        <span
          class="board-badge-icon"
          style={{
            width: `${w * spot.icon}px`,
            height: `${h * spot.icon}px`,
            backgroundImage: `var(--art-icon-${icon})`,
          }}
        />
      )}
    </div>
  );
}

/**
 * Each piece's labels: its weekly score in its bottom-right cell (or, while a tally plays, what
 * it earned in the week being tallied), its fixture's badge top right, and a ⚠ top left when a
 * requirement isn't met (it earns nothing then). Inside the room's walls, and never over the
 * digit (label-layout.ts): a badge that shares the digit's cell moves up over the wall band.
 */
export function LabelsLayer({
  house,
  model,
  yard,
  occ,
  scale,
  dpr,
}: {
  house: HouseState;
  model: HouseModel;
  yard: YardModel;
  occ: Occupancy;
  scale: number;
  dpr: number;
}) {
  const view = tallyView.value;
  const tally = currentTally.value;
  const scoreBy = new Map((view?.pieces ?? tally.pieces).map((s) => [s.uid, s]));
  const px = CELL * scale;
  return (
    <div class="labels">
      {house.pieces.map((piece) => {
        const cells = occ.cells.get(piece.uid);
        if (!cells) return null;
        const score = scoreBy.get(piece.uid);
        const room = model.rooms.has(piece.uid);
        const shown = score ? (score.unmet ? 0 : score.earned) : undefined;
        // A fixture shows as art where it fits (rooms.ts, house-paint.ts, yard.ts); its badge
        // stands in when it doesn't, so a purchase is always visible.
        const badged =
          !!piece.fixture &&
          !(room
            ? roomLayout(model, piece.uid).fixtureShown
            : (yard.pieces.get(piece.uid)?.fixtureShown ?? false));
        const l = pieceLabels({
          cells,
          inset: (c: Cell, side: Side) => (room ? inset(model, c.x, c.y, side) * scale : 0),
          px,
          dpr,
          digit: shown === undefined ? null : String(shown).length,
          fixture: badged,
          unmet: !!score?.unmet,
        });
        const fixture = piece.fixture ? CONTENT.fixtures[piece.fixture.id] : null;
        return (
          <div key={piece.uid} class="piece-labels">
            {l.fixture && fixture && (
              <Badge
                spot={l.fixture}
                icon={FIXTURE_ICONS[fixture.id]}
                class={`fixture-badge rarity-${fixture.rarity}`}
                label={`${fixture.name} installed`}
              />
            )}
            {l.unmet && score?.unmet && (
              <Badge
                spot={l.unmet}
                icon="warn"
                class="unmet-badge"
                label={`Earns nothing: it must be ${score.unmet}`}
              />
            )}
            {shown !== undefined && l.digit && (
              <Digit
                uid={piece.uid}
                value={shown}
                style={{
                  left: `${l.digit.right}px`,
                  top: `${l.digit.bottom}px`,
                  fontSize: `${l.digit.font}px`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A piece drawn alone by the house's painters, in its own frame (its bounding box's top-left cell
 * at (0, 0)): the box its canvas covers, in art px, and how to paint it. A room has its own
 * outline walls and no doors; a yard piece has its ground and props, its box grown to hold
 * whatever rises above its cells. The ghost uses it, and so do the cards' pictures (PieceArt).
 */
export interface PieceArtPlan {
  readonly frame: Readonly<Rect>;
  readonly paint: (atlas: AtlasPixels) => Pixels | null;
}

export function pieceArtPlan(defId: PieceId, rot: Rot, look?: PieceLook): PieceArtPlan {
  if (isIndoor(defId)) {
    const model = pieceModel(defId, rot, look);
    const frame = { x: 0, y: 0, w: model.width * CELL, h: model.height * CELL };
    return { frame, paint: (a: AtlasPixels) => paintPiece(model, a, roomItems(model, 1)) };
  }
  const layout = yardPieceLayout(defId, rot, look);
  let x0 = layout.box.x;
  let y0 = layout.box.y;
  let x1 = layout.box.x + layout.box.w;
  let y1 = layout.box.y + layout.box.h;
  for (const it of layout.items) {
    const { w, h } = artSize(it.sprite);
    x0 = Math.min(x0, it.x);
    y0 = Math.min(y0, it.y);
    x1 = Math.max(x1, it.x + w);
    y1 = Math.max(y1, it.y + h);
  }
  const frame = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  return { frame, paint: (a: AtlasPixels) => paintYardPiece(layout, a) };
}

/**
 * Paints one piece of the board's art (an atlas sprite, or one of our drawings: its first frame)
 * into a canvas its size: a fixture's picture in the shop (PieceArt.tsx FixtureArt). At once when
 * the atlas is read. Returns a canceller for a paint still waiting for the atlas.
 */
export function paintArt(canvas: HTMLCanvasElement | null, id: ArtId): () => void {
  return withAtlas((atlas) => {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { w, h } = artSize(id);
    const cv = new Canvas(0, 0, w, h);
    cv.blit(atlas, id, 0, 0);
    ctx.clearRect(0, 0, w, h);
    put(ctx, cv.pixels());
  });
}

/**
 * Paints a plan into a canvas as big as its frame: at once when the atlas is read, so it's never
 * seen blank. Returns a canceller for a paint still waiting for the atlas.
 */
export function paintPieceArt(canvas: HTMLCanvasElement | null, plan: PieceArtPlan): () => void {
  return withAtlas((atlas) => {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { frame } = plan;
    ctx.clearRect(0, 0, frame.w, frame.h);
    const p = plan.paint(atlas);
    if (p) put(ctx, { ...p, x: p.x - frame.x, y: p.y - frame.y });
  });
}

/**
 * The piece being placed (or carried by the Moving Truck), drawn by the same painters as the
 * house for that piece alone: a room with its own outline walls and no doors, a yard piece with
 * its ground and props (and whatever rises above its cells), and the placement's tint over its
 * cells. Redrawn only when the piece or its rotation changes; moving it is CSS.
 */
export function GhostPiece({
  defId,
  rot,
  cells,
  scale,
  look,
  class: cls,
}: {
  defId: PieceId;
  rot: Rot;
  cells: readonly Cell[];
  scale: number;
  /**
   * How the piece will look once placed: a room's colors, choices and fixture (rooms.ts roomLook,
   * newRoomLook), a yard piece's color and fixture (yard.ts pieceLook, newPieceLook).
   */
  look?: PieceLook | undefined;
  class: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = CELL * scale;
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const art = useMemo(
    () => pieceArtPlan(defId, rot, look),
    [defId, rot, look?.color, look?.flip, look?.fixture],
  );
  const { frame } = art;
  const bw = Math.max(...cells.map((c) => c.x)) - minX + 1;
  const bh = Math.max(...cells.map((c) => c.y)) - minY + 1;
  // One tint over the whole piece, outlined around its edge: no grid lines across its walls.
  const tint = useMemo(
    () =>
      cellsOutline(
        cells.map((c) => ({ x: c.x - minX, y: c.y - minY })),
        px,
      ),
    [cells, minX, minY, px],
  );
  // Before the browser paints, so the canvas is never seen blank (a new size clears it).
  useLayoutEffect(() => paintPieceArt(ref.current, art), [art]);
  return (
    <div
      class={`piece ghost-piece ${cls}`}
      style={{
        left: `${minX * px}px`,
        top: `${minY * px}px`,
        width: `${bw * px}px`,
        height: `${bh * px}px`,
      }}
    >
      <canvas
        ref={ref}
        width={frame.w}
        height={frame.h}
        style={{
          left: `${frame.x * scale}px`,
          top: `${frame.y * scale}px`,
          width: `${frame.w * scale}px`,
          height: `${frame.h * scale}px`,
        }}
      />
      <svg class="ghost-tint" width={bw * px} height={bh * px} aria-hidden="true">
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
