// The board (the BoardView of D-033): the terrain canvas, the fenced-yard tint, the house's
// layers (HouseLayers.tsx: floors, items, walls, highlights, labels), the ghost that follows
// the cursor, the preview's badges, the demolish tool's target, and the tally's popups. The
// pointer maps to a cell by arithmetic on one element (D-049).
//
// The camera (camera.ts) zooms by re-laying out the board at a new scale, never with a CSS
// transform (D-057). Dragging pans the scroll container: a left-button drag past a few pixels
// pans and then doesn't place or select on release, and the middle button always pans. So a
// click acts on release.

import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  definite,
  placedCells,
  rules,
  SCORE_LABELS,
  type Cell,
  type DemolishPreview,
  type Lot,
  type PieceId,
  type Rot,
  type SetScore,
  type SourceRef,
  type SunSide,
  type UseToolAction,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy, fxHooks, popups, setHold, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { shakeOffsets } from '../fx/juice.ts';
import { formatNumber, signed } from '../format.ts';
import { changeOrderShown, shopShown } from '../hud/actions.ts';
import { Icon } from '../kit/kit.tsx';
import {
  activePlay,
  demolishArmed,
  demolishAt,
  demolishPreview,
  heldPiece,
  hoverCell,
  inspected,
  installArmed,
  installGains,
  installSupply,
  movingUid,
  packCells,
  packNext,
  packPlay,
  preview,
  renovateUids,
  rotation,
  run,
  selected,
  selection,
  tentative,
  tool,
  toolAction,
  toolArmed,
  toolPreview,
  useToolNow,
  type Inspected,
  type PackNext,
} from '../store.ts';
import { CELL } from '../sprites.ts';
import { uiPixel } from '../theme/pixel.ts';
import {
  applyZoomAnchor,
  cameraEls,
  cameraScale,
  canZoomIn,
  canZoomOut,
  isFit,
  lotSize,
  toggleFit,
  viewSize,
  wheelZoom,
  zoomIn,
  zoomOut,
} from './camera.ts';
import { newRoomLook, roomLook } from '../art/rooms.ts';
import { newPieceLook, pieceLook, yardModel } from '../art/yard.ts';
import {
  boardRows,
  canopyRoom,
  center,
  furnitureSpot,
  isIndoor,
  keepInView,
  labelLines,
  labelRows,
  labelSpot,
  occupancy,
  startScrollTop,
  streetLabelRun,
  streetLabelSize,
  uidAt,
  viewReach,
  type Occupancy,
} from './geometry.ts';
import { hallLinks, houseModel, sunLight } from './house-model.ts';
import { spreadBadges } from './label-layout.ts';
import {
  FloorLayer,
  GhostPiece,
  HighlightsLayer,
  ItemsLayer,
  LabelsLayer,
  OverhangLayer,
  WallsLayer,
} from './HouseLayers.tsx';
import { layerVars } from './layers.ts';
import { ChainArc, RoofLayer, ToppedOut } from './MomentLayers.tsx';
import { wobble } from './piece-fx.ts';
import { Outline, TerrainLayer, YardTint } from './TerrainLayer.tsx';
import './board-m2.css';
import './labels.css';
import './install-gains.css';

/** The layers' z-indexes as CSS variables, set once on the board element. */
const LAYER_VARS = layerVars();

/** The scroll container's padding (app.css), kept clear around the board. */
const PAD = 6;
/** Cells smaller than this many CSS px get the smaller badges and labels (board-m2.css). */
const SMALL_CELL_PX = 32;

/** Rotates the card being placed; a tentative placement turns where it is. */
export function rotate(): void {
  const sel = selection.value;
  // A fixture has no shape to turn; a tool only turns the piece the Moving Truck carries.
  if (sel?.kind === 'fixture') return;
  // A pack (D-106) is the tiles clicked out, so it has nothing to turn, and a Renovation
  // waiting for End week (D-102) is the room as it stands.
  if (sel?.kind === 'piece' && CONTENT.pieces[sel.id].pack) return;
  if (tentative.value?.t === 'renovate') return;
  if (sel?.kind === 'tool') {
    if (movingUid.value === null) return;
    rotation.value = ((rotation.value + 1) % 4) as 0 | 1 | 2 | 3;
    toolArmed.value = null;
    audio.play('rotate');
    return;
  }
  const r = ((rotation.value + 1) % 4) as 0 | 1 | 2 | 3;
  rotation.value = r;
  const pending = tentative.value;
  if (pending?.t === 'place') {
    const turned = { ...pending, rot: r };
    // A tentative placement turns where it is if it still fits there; otherwise it goes back
    // to following the pointer, so End week never tries to build somewhere illegal.
    tentative.value = rules.checkPlay(run.value, turned).legal ? turned : null;
    if (!tentative.value) {
      hoverCell.value = { x: pending.x, y: pending.y };
      audio.play('illegal');
      return;
    }
  }
  audio.play('rotate');
}

/**
 * A tap places tentatively; End week commits it (D-036, D-047). A hand fixture goes in
 * tentatively the same way. A supply is a free action, so it takes two clicks on the same
 * piece, like a demolition (D-073): the first arms it, the second installs it.
 */
function placeTentatively(): void {
  const play = activePlay.value;
  const p = preview.value;
  if (!play) return;
  if (!p?.legal) {
    installArmed.value = null;
    audio.play('illegal');
    return;
  }
  if (play.t === 'install' && play.from === 'supplies') {
    if (installArmed.value === play.uid) {
      if (installSupply(play.i, play.uid)) audio.play('place-room', { rate: 1.3 });
      else audio.play('illegal');
      return;
    }
    installArmed.value = play.uid;
    audio.play('select', { rate: 0.8 });
    return;
  }
  tentative.value = { ...play };
  audio.play('select', { rate: 0.8 });
}

/**
 * A pack card (D-106): each click adds a tile to the pack waiting for End week, or takes one
 * off. The pack stays legal: a click that would break it (water, a gap) is refused.
 */
function packClick(cell: Cell): void {
  const sel = selection.value;
  if (sel?.kind !== 'piece') return;
  const pending = tentative.value;
  const tiles = pending?.t === 'place' && pending.shape ? packCells(pending) : [];
  const had = tiles.some((c) => c.x === cell.x && c.y === cell.y);
  const next = had ? tiles.filter((c) => c.x !== cell.x || c.y !== cell.y) : [...tiles, cell];
  if (next.length === 0) {
    tentative.value = null;
    audio.play('select', { rate: 0.7 });
    return;
  }
  const play = packPlay(sel.from, sel.i, next);
  if (!rules.checkPlay(run.value, play).legal) {
    audio.play('illegal');
    return;
  }
  tentative.value = play;
  // Each tile a little higher, like counting them out.
  audio.play('select', { rate: had ? 0.7 : FEEL.packTile.rate + next.length * FEEL.packTile.step });
}

const sameCell = (a: Cell | null | undefined, b: Cell | null | undefined): boolean =>
  !!a && !!b && a.x === b.x && a.y === b.y;
const hasCell = (cells: readonly Cell[], c: Cell): boolean =>
  cells.some((q) => q.x === c.x && q.y === c.y);

const sameAction = (a: UseToolAction | null, b: UseToolAction | null): boolean =>
  !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

/**
 * A tool's click on the lot. The Copy Machine: click a piece twice. The Moving Truck: click a
 * piece to pick it up, then a spot twice (R turns it). Other tools are used from their panel.
 */
function toolClick(c: Cell | 'street' | null, occUid: number): void {
  const sel = selection.value;
  if (!sel || sel.kind !== 'tool') return;
  const use = CONTENT.tools[sel.id].use.kind;
  if (use === 'move' && movingUid.value === null) {
    const piece = occUid ? run.value.house.pieces.find((p) => p.uid === occUid) : undefined;
    if (!piece) {
      audio.play('illegal');
      return;
    }
    movingUid.value = piece.uid;
    rotation.value = piece.rot;
    audio.play('select', { rate: 0.8 });
    return;
  }
  if (use !== 'move' && use !== 'copy') return;
  if (!c || c === 'street') return;
  // The target under the pointer now, not the armed one: a click elsewhere re-arms there.
  const armed = toolArmed.value;
  toolArmed.value = null;
  const action = toolAction.value;
  const p = toolPreview.value;
  if (!action || !p?.ok) {
    audio.play('illegal');
    return;
  }
  if (sameAction(armed, action)) {
    // A copy is a good gained, not the ×Mult bell ('stamp'), which is for ×Mult only (D-058).
    if (useToolNow(action)) audio.play(use === 'move' ? 'place-room' : 'buy');
    else audio.play('illegal');
    return;
  }
  toolArmed.value = action;
  audio.play('select', { rate: 0.8 });
}

/** An empty tile clicked in demolish mode: it says why until the pointer moves on. */
const demolishNote = signal<Cell | null>(null);

/** Demolish mode's click: the first arms a target, a second on the same target demolishes it. */
function demolishClick(c: Cell | 'street' | null): void {
  demolishNote.value = null;
  if (!c || c === 'street') {
    demolishArmed.value = null;
    return;
  }
  const armed = demolishArmed.value ? demolishPreview.value : null;
  if (armed?.legal && hasCell(armed.cells, c)) {
    if (!demolishAt(c.x, c.y)) audio.play('illegal');
    return;
  }
  const p = rules.previewDemolish(run.value, c.x, c.y);
  if (p.legal) {
    demolishArmed.value = { x: c.x, y: c.y };
    audio.play('select', { rate: 0.7 });
    return;
  }
  demolishArmed.value = null;
  if (!p.target) demolishNote.value = c;
  audio.play('illegal');
}

/** Right-click in demolish mode: disarm, or put the tool away. */
function cancelDemolish(): void {
  demolishNote.value = null;
  if (demolishArmed.value) demolishArmed.value = null;
  else tool.value = 'build';
}

function sameInspected(a: Inspected | null, b: Inspected): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'piece' && b.kind === 'piece') return a.uid === b.uid;
  if (a.kind === 'tile' && b.kind === 'tile') return a.x === b.x && a.y === b.y;
  if (a.kind === 'street' && b.kind === 'street') return a.x === b.x;
  return false;
}

interface Drag {
  id: number;
  button: number;
  x: number;
  y: number;
  left: number;
  top: number;
  panning: boolean;
  /** A tally was playing at the press: the click skips it instead of acting. */
  skip: boolean;
  /** Another finger joined (touch): the gesture never counts as a tap. */
  multi?: boolean;
}

export function Board() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const lastScale = useRef(Number.NaN);
  const needsCenter = useRef(true);
  const [panning, setPanning] = useState(false);
  const state = run.value;
  const { lot } = state.house;
  const scale = cameraScale.value;
  const px = CELL * scale;
  const dpr = viewSize.value?.dpr ?? (window.devicePixelRatio || 1);
  // Room above the lot for its top row's tree tops, inside the scroll area (geometry.ts).
  const room = canopyRoom(scale, dpr);
  const demolishing = tool.value === 'demolish';
  const { house } = state;
  const occ = occupancy(house);
  // The house as drawn: walls, doorways and windows from the pieces, with the Hallways'
  // doors from the rules' links and the sun's light on the Sunny rooms (D-120). Cached per
  // house, so hovering never rebuilds it.
  const links = useMemo(() => hallLinks(state), [state]);
  const sun = useMemo(() => sunLight(state), [state]);
  const model = houseModel(house, links, sun);
  // The yard pieces' ground and props, cached per house model.
  const yard = yardModel(house, model);
  const p = demolishing ? null : preview.value;
  // The house's layers re-render only when the house or the zoom changes: the highlights and
  // labels follow the tally and the preview by themselves, and never redraw a canvas.
  const floorLayer = useMemo(
    () => <FloorLayer lot={lot} scale={scale} model={model} yard={yard} />,
    [lot, scale, model, yard],
  );
  const itemsLayer = useMemo(
    () => <ItemsLayer house={house} model={model} yard={yard} scale={scale} />,
    [house, model, yard, scale],
  );
  const wallsLayer = useMemo(
    () => <WallsLayer lot={lot} scale={scale} model={model} />,
    [lot, scale, model],
  );
  const overhangLayer = useMemo(
    () => <OverhangLayer model={model} yard={yard} scale={scale} />,
    [model, yard, scale],
  );
  const highlightsLayer = useMemo(
    () => <HighlightsLayer house={house} occ={occ} lot={lot} scale={scale} />,
    [house, occ, lot, scale],
  );
  const seed = state.setup.seed;
  const labelsLayer = useMemo(
    () => (
      <LabelsLayer
        house={house}
        model={model}
        yard={yard}
        occ={occ}
        scale={scale}
        dpr={dpr}
        seed={seed}
      />
    ),
    [house, model, yard, occ, scale, dpr, seed],
  );

  useEffect(() => {
    fxHooks.wobble = wobble;
    fxHooks.shake = (amount: number) => {
      const el = boardRef.current;
      // Whole CSS px, scaled by the Screen shake setting: a small enough one is none.
      const o = shakeOffsets(amount);
      if (!el || !o) return;
      const { full: a, half: h } = o;
      // Added to a Huge week's lean-in, if one is playing, rather than replacing it.
      el.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: `translate(${a}px, ${-h}px)` },
          { transform: `translate(${-a}px, ${h}px)` },
          { transform: `translate(${h}px, ${a}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: FEEL.shake.decayMs, easing: 'ease-out', composite: 'add' },
      );
    };
    // A Huge week (D-124): the board leans in on the middle of the view and back, a short
    // celebration tween (the camera itself never zooms with a transform).
    fxHooks.zoom = () => {
      const el = boardRef.current;
      const view = scrollRef.current;
      if (!el || !view) return;
      const b = el.getBoundingClientRect();
      const v = view.getBoundingClientRect();
      el.style.transformOrigin = `${v.left + v.width / 2 - b.left}px ${v.top + v.height / 2 - b.top}px`;
      const z = FEEL.ladder.zoom;
      el.animate(
        [
          { transform: 'scale(1)' },
          { transform: `scale(${z.scale})`, offset: 0.35, easing: 'ease-in-out' },
          { transform: 'scale(1)' },
        ],
        { duration: z.ms, easing: 'ease-out' },
      );
    };
    // A lot cell's place in the viewport, for a burst; null when it's out of the board's view.
    fxHooks.toScreen = (x: number, y: number) => {
      const el = boardRef.current;
      const view = scrollRef.current;
      if (!el || !view) return null;
      const b = el.getBoundingClientRect();
      const v = view.getBoundingClientRect();
      const cell = CELL * cameraScale.value;
      const at = { x: b.left + x * cell, y: b.top + y * cell };
      const inside = at.x >= v.left && at.x <= v.right && at.y >= v.top && at.y <= v.bottom;
      return inside ? at : null;
    };
  }, []);

  // The camera: measure the space the board has, and zoom with the wheel at the pointer.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    cameraEls.scroll = el;
    cameraEls.board = boardRef.current;
    const measure = () => {
      const width = el.clientWidth - 2 * PAD;
      const height = el.clientHeight - 2 * PAD;
      const dpr = window.devicePixelRatio || 1;
      const v = viewSize.value;
      // A hidden board measures 0: keep the last real size.
      if (width <= 0 || height <= 0) return;
      if (!v || v.width !== width || v.height !== height || v.dpr !== dpr) {
        viewSize.value = { width, height, dpr };
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    // A move to a screen with another devicePixelRatio needn't resize the window (a Mac's
    // displays keep its CSS size), so watch the ratio too: each change re-measures and re-arms.
    let ratio: MediaQueryList | null = null;
    const onRatio = () => {
      measure();
      watchRatio();
    };
    const watchRatio = () => {
      ratio?.removeEventListener('change', onRatio);
      ratio = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      ratio.addEventListener('change', onRatio);
    };
    watchRatio();
    const onWheel = (e: WheelEvent) => {
      // A sideways scroll (a trackpad, or Shift + wheel) pans natively.
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      wheelZoom(e);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      ratio?.removeEventListener('change', onRatio);
      el.removeEventListener('wheel', onWheel);
      if (cameraEls.scroll === el) {
        cameraEls.scroll = null;
        cameraEls.board = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const l = lotSize.value;
    if (l.width !== lot.width || l.height !== lot.height) {
      lotSize.value = { width: lot.width, height: lot.height };
    }
  }, [lot.width, lot.height]);

  // A new run starts centered across, with the street in view: most houses start near it.
  useLayoutEffect(() => {
    needsCenter.current = true;
  }, [state.setup]);

  const cellAt = (clientX: number, clientY: number): Cell | 'street' | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / px);
    const y = Math.floor((clientY - rect.top) / px);
    if (x < 0 || x >= lot.width || y < 0 || y > lot.height) return null;
    return y === lot.height ? 'street' : { x, y };
  };

  const setHover = (c: Cell | 'street' | null) => {
    const cell = c === 'street' ? null : c;
    const prev = hoverCell.value;
    if (cell?.x !== prev?.x || cell?.y !== prev?.y) hoverCell.value = cell;
    if (demolishNote.value && !sameCell(demolishNote.value, cell)) demolishNote.value = null;
  };

  /** What the inspect panel shows for the cell under the pointer, when nothing is being placed. */
  const inspectAt = (clientX: number, c: Cell | 'street' | null) => {
    if (selected.value !== null || tentative.value) return;
    let next: Inspected | null = null;
    if (c === 'street') {
      const x = Math.floor((clientX - boardRef.current!.getBoundingClientRect().left) / px);
      next = { kind: 'street', x };
    } else if (c) {
      const uid = uidAt(occ, c.x, c.y);
      next = uid ? { kind: 'piece', uid } : { kind: 'tile', x: c.x, y: c.y };
    }
    if (next && !sameInspected(inspected.value, next)) inspected.value = next;
  };

  // After a re-layout at a new scale: keep the zoom's anchor put, and the hover cell honest.
  // A new run (once the scale has settled) centers the lot across and shows the street.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scale !== lastScale.current) {
      lastScale.current = scale;
      applyZoomAnchor(scale);
      const at = pointer.current;
      const d = drag.current;
      if (d && at) {
        // Zoomed mid-drag: the drag carries on from here.
        Object.assign(d, { x: at.x, y: at.y, left: el.scrollLeft, top: el.scrollTop });
      }
      if (at && !d?.panning) setHover(cellAt(at.x, at.y));
    }
    if (needsCenter.current && viewSize.value && scale === cameraScale.value) {
      needsCenter.current = false;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = startScrollTop(el.scrollHeight, el.clientHeight, px);
    }
  });

  const startPan = (e: PointerEvent) => {
    try {
      scrollRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone.
    }
    setPanning(true);
  };

  const endPan = (e: PointerEvent) => {
    try {
      scrollRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Not captured.
    }
    setPanning(false);
  };

  const onPointerMove = (e: PointerEvent) => {
    let d = drag.current;
    // One pointer per gesture: a second finger's moves are ignored.
    if (d && d.id !== e.pointerId && e.pointerType === 'touch') return;
    pointer.current = { x: e.clientX, y: e.clientY };
    // The button came up somewhere we never heard about: drop the press, back to hovering.
    if (d && d.id === e.pointerId && e.pointerType === 'mouse') {
      const bit = d.button === 1 ? 4 : 1;
      if (!(e.buttons & bit)) {
        if (d.panning) endPan(e);
        drag.current = d = null;
      }
    }
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.panning && Math.hypot(dx, dy) > FEEL.camera.dragPx) {
        d.panning = true;
        startPan(e);
      }
      if (d.panning) {
        const el = scrollRef.current!;
        el.scrollLeft = d.left - dx;
        el.scrollTop = d.top - dy;
        return;
      }
    }
    const c = cellAt(e.clientX, e.clientY);
    setHover(c);
    inspectAt(e.clientX, c);
  };

  const onPointerDown = (e: PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY };
    if (e.button === 2) {
      if (busy.value) setHold(true);
      else if (demolishing) cancelDemolish();
      else if (selected.value !== null) rotate();
      return;
    }
    if (e.button !== 0 && e.button !== 1) return;
    const el = scrollRef.current!;
    if (drag.current && drag.current.id !== e.pointerId) {
      // A second finger: keep tracking the first, and make the gesture a non-tap.
      drag.current.multi = true;
      return;
    }
    // Capture the press, so its moves and release reach the board even off its edge.
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone.
    }
    drag.current = {
      id: e.pointerId,
      button: e.button,
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      panning: e.button === 1,
      skip: busy.value,
    };
    if (e.button === 1) {
      // The middle button pans at once (and doesn't start the browser's autoscroll).
      e.preventDefault();
      startPan(e);
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 2) setHold(false);
    const d = drag.current;
    if (!d || d.id !== e.pointerId || d.button !== e.button) return;
    drag.current = null;
    const c = cellAt(e.clientX, e.clientY);
    if (d.panning) {
      endPan(e);
      if (e.pointerType !== 'touch') setHover(c);
      return;
    }
    if (d.button !== 0 || d.multi) return;
    if (d.skip) {
      // Only if the tally is still playing: a banner it revealed since the press stays up.
      if (busy.value) skip();
      return;
    }
    // Touch has no hover: a tap moves the hover cell there and inspects what it hit.
    if (c && c !== 'street') setHover(c);
    inspectAt(e.clientX, c);
    if (demolishing) {
      demolishClick(c);
      return;
    }
    if (selection.value?.kind === 'tool') {
      toolClick(c, c && c !== 'street' ? uidAt(occ, c.x, c.y) : 0);
      return;
    }
    if (selected.value !== null) {
      const sel = selection.value;
      if (
        sel?.kind === 'piece' &&
        CONTENT.pieces[sel.id].pack &&
        activePlay.value?.t !== 'renovate'
      ) {
        if (c && c !== 'street') packClick(c);
        return;
      }
      tentative.value = null;
      // A click on another piece re-arms a supply install there.
      if (sel?.kind === 'fixture' && sel.from === 'supplies' && c && c !== 'street') {
        const uid = uidAt(occ, c.x, c.y);
        if (installArmed.value !== null && installArmed.value !== uid) installArmed.value = null;
      }
      placeTentatively();
      return;
    }
    // Nothing picked: a click on a placed piece holds Inspect on it (a second click lets go),
    // and a click anywhere else lets go (store.ts heldPiece).
    const uid = c && c !== 'street' ? uidAt(occ, c.x, c.y) : 0;
    heldPiece.value = uid && heldPiece.value !== uid ? uid : null;
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (drag.current && drag.current.id !== e.pointerId) return;
    if (drag.current?.panning) setPanning(false);
    drag.current = null;
  };

  const ghostCells = (() => {
    if (demolishing) return null;
    const play = activePlay.value;
    const sel = selection.value;
    if (!play || play.t !== 'place' || sel?.kind !== 'piece') return null;
    return {
      defId: sel.id,
      rot: play.rot,
      // A pack's tiles (D-106) are the play's own shape.
      shape: play.shape,
      cells: placedCells(play.shape ?? CONTENT.pieces[sel.id].shape, play.x, play.y, play.rot),
    };
  })();
  const installing = !demolishing && activePlay.value?.t === 'install';
  // D-107: a fixture is selected, so every legal host shows its gain.
  const choosingHost = !demolishing && selection.value?.kind === 'fixture';
  const renovating = !demolishing && activePlay.value?.t === 'renovate';
  const tooling = !demolishing && selection.value?.kind === 'tool';

  const boardClass = [
    'board',
    !demolishing && selected.value !== null ? 'placing' : '',
    demolishing ? 'demolishing' : '',
    // With a hair of slack: at a ratio like 125% × 80% browser zoom (1.0000000149), 1× comes out
    // a hair under 32 px and is still full size.
    px < SMALL_CELL_PX - 1e-6 ? 'small' : '',
    // Under the shop's sheet or a change order's (M4b): the water and the animated props hold
    // still (terrain.css).
    shopShown.value || changeOrderShown.value ? 'covered' : '',
  ].join(' ');

  return (
    <>
      <div
        class={`board-scroll ${panning ? 'panning' : ''}`}
        ref={scrollRef}
        // A cell's size, for the lot's surroundings (terrain.css), which zoom with the board; and
        // over the padding at the top, the canopy's room.
        style={{ '--board-cell': `${px}px`, paddingTop: `${PAD + room}px` }}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onPointerLeave={(e) => {
          pointer.current = null;
          // A finger lifting "leaves" too; keep a tap's hover so its ghost stays put.
          if (e.pointerType !== 'touch') setHover(null);
          setHold(false);
        }}
        onMouseDown={(e) => e.button === 1 && e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={boardRef}
          class={boardClass}
          style={{
            ...LAYER_VARS,
            width: `${lot.width * px}px`,
            height: `${boardRows(lot.height) * px}px`,
          }}
        >
          <TerrainLayer
            lot={lot}
            scale={scale}
            seed={state.setup.seed}
            house={state.house}
            around={viewReach(viewSize.value, lot.width, lot.height, scale, dpr, PAD)}
          />
          <YardTint state={state} scale={scale} />
          <StreetLabel lot={lot} occ={occ} px={px} dpr={dpr} />
          {floorLayer}
          {itemsLayer}
          {wallsLayer}
          {overhangLayer}
          {highlightsLayer}
          <ChainArc lot={lot} scale={scale} />
          <RoofLayer lot={lot} scale={scale} model={model} />
          {labelsLayer}
          <ToppedOut scale={scale} model={model} />
          {demolishing && <DemolishTarget scale={scale} />}
          {ghostCells && (
            <Ghost
              defId={ghostCells.defId}
              rot={ghostCells.rot}
              shape={ghostCells.shape}
              cells={ghostCells.cells}
              scale={scale}
            />
          )}
          {installing && <InstallTarget scale={scale} />}
          {choosingHost && <HostBadges scale={scale} />}
          {!demolishing && <RenovateHints scale={scale} />}
          {renovating && <RenovateTarget scale={scale} />}
          {tooling && <ToolTarget scale={scale} />}
          {p?.legal && <Badges scale={scale} />}
          <PopupLayer scale={scale} />
        </div>
      </div>
      <SunMarker side={lot.sun} />
      <CameraControls />
    </>
  );
}

/**
 * The side the sun shines from (D-120), on the board's view rather than the lot, so it stays in
 * sight however the lot is panned: a warm light along that edge, in steps, and the sun's plaque
 * at its middle (board-chrome.css). The checklist's sun chip says the same in words.
 */
function SunMarker({ side }: { side: SunSide }) {
  return (
    <div class={`sun-marker ${side}`} aria-hidden="true">
      <span class="sun-plaque">
        <Icon name="Sunny" /> Sun
      </span>
    </div>
  );
}

/**
 * A Driveway, in whatever tiles its pack took (D-106): where one meets the street, its concrete
 * crosses the sidewalk.
 */
const isDriveway = (id: PieceId) => (CONTENT.pieces[id].countsAs ?? id) === 'driveway';

/**
 * The street row's name, painted on the sidewalk: on its longest stretch with no curb cut
 * (geometry.ts streetLabelRun), sized to the row (streetLabelSize), and sticky (terrain.css), so
 * it stays whole inside the view's left edge while that stretch is in view, however the lot is
 * panned across.
 */
function StreetLabel({ lot, occ, px, dpr }: { lot: Lot; occ: Occupancy; px: number; dpr: number }) {
  const size = streetLabelSize(px, uiPixel(dpr), dpr);
  const cuts = Array.from({ length: lot.width }, (_, x) => {
    const p = occ.byUid.get(uidAt(occ, x, lot.height - 1));
    return !!p && isDriveway(p.defId);
  });
  const { from, to } = streetLabelRun(cuts);
  return (
    <div
      class="street-row"
      style={{
        left: `${from * px}px`,
        top: `${lot.height * px}px`,
        width: `${(to - from) * px}px`,
        height: `${px}px`,
      }}
    >
      <span class="street-label" style={{ fontSize: `${size}px` }}>
        Street
      </span>
    </div>
  );
}

/**
 * A label by the pointer (the ghost's stack of labels, the install, Renovate, tool and demolish
 * labels), centered over its spot (geometry.ts labelSpot) and nudged sideways to stay inside the
 * board's view, which can be narrower than the lot: a long label near the view's edge would be
 * cut off. The nudge is measured after each render and set as a CSS variable (labels.css), so it
 * never renders twice; a pan without a new hover keeps the old nudge until the pointer moves.
 */
function BoardLabel({
  class: cls,
  style,
  children,
}: {
  class: string;
  style: JSX.CSSProperties;
  children: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const view = el?.closest('.board-scroll');
    if (!el || !view) return;
    el.style.removeProperty('--label-dx');
    const r = el.getBoundingClientRect();
    const v = view.getBoundingClientRect();
    el.style.setProperty('--label-dx', `${keepInView(r.left, r.right, v.left, v.right)}px`);
  });
  return (
    <div ref={ref} class={cls} style={style}>
      {children}
    </div>
  );
}

/** The UI pixel on this screen, in CSS px (theme/pixel.ts): the labels' text is sized in it. */
function boardUiPixel(): number {
  return uiPixel(viewSize.value?.dpr ?? (window.devicePixelRatio || 1));
}

/** Where a one-label stack of `text` goes over `cells` (geometry.ts labelSpot, labelRows). */
function oneLabelSpot(cells: readonly Cell[], lotW: number, px: number, text: string) {
  return labelSpot(cells, lotW, labelRows([labelLines(text)], px, boardUiPixel()));
}

function Ghost({
  defId,
  rot,
  shape,
  cells,
  scale,
}: {
  defId: PieceId;
  rot: Rot;
  /** A pack's tiles (D-106): the play's own shape, not the card's. */
  shape?: readonly string[] | undefined;
  cells: Cell[];
  scale: number;
}) {
  const p = preview.value;
  const legal = !!p?.legal;
  const pending = !!tentative.value;
  const px = CELL * scale;
  const { lot } = run.value.house;
  const def = CONTENT.pieces[defId];
  // A pack being clicked out (D-106): the ghost is the tiles End week builds, and the tile under
  // the pointer gets its own outline, saying what a click there would do.
  const next = def.pack ? packNext.value : null;
  // A pack: how many of its tiles are out, beside the change to the week, and what comes next
  // on a line of its own, so neither wraps in the pixel font (labels.css's widest label). A
  // click's own effect is the next tile's label (PackNextLabel).
  const pack = def.pack ? `${cells.length} of ${def.pack.maxTiles} tiles` : null;
  const then = pending ? 'End week to build' : 'Click to start';
  const inside = cells.filter((cell) => cell.x >= 0 && cell.y >= 0);
  // M4b: a running restriction this placement would break. It stays legal; it just pays nothing.
  const breaks = legal && p?.breaks ? CONTENT.changeOrders[p.breaks].name : null;
  const reason = p?.reason ?? 'Can’t build there';
  const arrow = p && p.delta > 0 ? '▲ +' : p && p.delta < 0 ? '▼ −' : '';
  const change = p ? `${arrow}${formatNumber(Math.abs(p.delta))} ${SCORE_LABELS.total}` : '';
  const after = pack ? ` · ${pack}` : pending ? ' · End week to build' : '';
  // A building that would be Sunny there (D-120) says so, with the sun's icon: its ☀ stands in
  // for the icon when the label is measured.
  const sunny = legal && !!p?.sunny;
  const first = change + (sunny ? ' · ☀ Sunny' : '') + after;
  // Keep the labels on the board: away from the side edges, and below the ghost at the top. A
  // pack's next tile counts too, so its label and the ghost's stack clear of both. The stack
  // needs as many rows above them as it's tall, line by line (geometry.ts labelRows): more
  // where cells are small, as at 0.5×, since the labels keep their size.
  const lines = [
    ...(!legal && inside.length > 0 ? [labelLines(`✕ ${reason}`)] : []),
    ...(legal && p ? [labelLines(first) + (pack ? 1 : 0)] : []),
    ...(breaks ? [labelLines(`✕ Breaks ${breaks}`)] : []),
    ...(next ? [labelLines(packNextText(next).join(''))] : []),
  ];
  const rows = labelRows(lines, px, boardUiPixel());
  const spot = labelSpot(next ? [...cells, next.cell] : cells, lot.width, rows);
  const label = { left: `${spot.x * px}px`, top: `${spot.y * px}px` };
  return (
    <>
      <GhostPiece
        defId={defId}
        rot={rot}
        shape={shape}
        cells={cells}
        scale={scale}
        look={
          isIndoor(defId)
            ? newRoomLook(run.value.house, defId)
            : newPieceLook(run.value.house, defId)
        }
        class={`ghost ${legal ? 'legal' : 'illegal'} ${pending ? 'pending' : ''}`}
      />
      {next && (
        <Outline
          cells={[next.cell]}
          scale={scale}
          lot={lot}
          class={`install-target pack-next ${!next.legal ? 'illegal' : next.kind === 'add' ? 'legal' : 'remove'}`}
        />
      )}
      {/* One stack, measured and nudged into the view as one (labels.css .ghost-labels). */}
      <BoardLabel class={`ghost-labels ${spot.below ? 'below' : ''}`} style={label}>
        {!legal && inside.length > 0 && (
          <div class="ghost-reason">
            <span aria-hidden="true">✕ </span>
            {reason}
          </div>
        )}
        {legal && p && (
          <div class={`ghost-delta ${p.delta > 0 ? 'good' : p.delta < 0 ? 'bad' : ''}`}>
            {change}
            {sunny && (
              <span class="ghost-sun">
                {' · '}
                <Icon name="Sunny" /> Sunny
              </span>
            )}
            {after}
            {pack && <span class="ghost-then">{then}</span>}
          </div>
        )}
        {breaks && (
          <div class="ghost-reason">
            <span aria-hidden="true">✕ </span>
            Breaks {breaks}
          </div>
        )}
        {next && <PackNextLabel next={next} />}
      </BoardLabel>
    </>
  );
}

/**
 * A pack's next tile (D-106): blue to add it, orange to take it off, or orange with the rules'
 * reason when the pack that would leave isn't legal (a gap, too many tiles, water).
 */
function PackNextLabel({ next }: { next: PackNext }) {
  const [mark, text] = packNextText(next);
  const tone = !next.legal
    ? 'ghost-reason'
    : next.kind === 'remove'
      ? 'ghost-delta bad'
      : 'ghost-delta good';
  return (
    <div class={tone}>
      <span aria-hidden="true">{mark}</span>
      {text}
    </div>
  );
}

/** A pack's next tile's label (PackNextLabel): its mark, and its words. */
function packNextText(next: PackNext): [mark: string, text: string] {
  if (!next.legal) {
    const off = next.kind === 'remove' ? 'Can’t take it off: ' : '';
    return ['✕ ', `${off}${next.reason ?? 'It can’t go there.'}`];
  }
  if (next.kind === 'remove') return ['− ', 'Click to take off'];
  return ['+ ', `Click to add · ${next.tiles} of ${next.maxTiles} tiles`];
}

/** The rooms the selected card can renovate (D-102), outlined faintly so they're easy to find. */
function RenovateHints({ scale }: { scale: number }) {
  const uids = renovateUids.value;
  const state = run.value;
  if (uids.length === 0 || tentative.value) return null;
  const occ = occupancy(state.house);
  return (
    <>
      {uids.map((uid) => (
        <Outline
          key={uid}
          cells={occ.cells.get(uid) ?? []}
          scale={scale}
          lot={state.house.lot}
          class="renovate-hint"
        />
      ))}
    </>
  );
}

/**
 * Renovating (D-102): the room under the pointer outlined, blue with the level it would reach
 * and what it would do to the week's Wow, or orange with why not (not at the limit yet, the
 * wrong room, fully renovated).
 */
function RenovateTarget({ scale }: { scale: number }) {
  const p = preview.value;
  const play = activePlay.value;
  const state = run.value;
  const { lot } = state.house;
  if (!p || !play || play.t !== 'renovate') return null;
  const occ = occupancy(state.house);
  const cells = occ.cells.get(play.uid) ?? [];
  if (cells.length === 0) return null;
  const px = CELL * scale;
  const room = occ.byUid.get(play.uid);
  const name = room ? CONTENT.pieces[room.defId].name : 'room';
  const pending = tentative.value?.t === 'renovate';
  const wow = SCORE_LABELS.total;
  const change =
    p.delta > 0
      ? `▲ +${formatNumber(p.delta)} ${wow}`
      : p.delta < 0
        ? `▼ −${formatNumber(-p.delta)} ${wow}`
        : `±0 ${wow}`;
  const legal = p.legal && !!p.renovates;
  const then = pending ? ' · End week to renovate' : '';
  const text = legal
    ? `Renovate ${definite(name)} to level ${p.renovates!.level}: ${change}${then}`
    : (p.reason ?? 'It can’t be renovated.');
  const spot = oneLabelSpot(cells, lot.width, px, legal ? text : `✕ ${text}`);
  const style = { left: `${spot.x * px}px`, top: `${spot.y * px}px` };
  const below = spot.below ? 'below' : '';
  const label = legal ? (
    <BoardLabel
      class={`ghost-delta install-label ${p.delta > 0 ? 'good' : p.delta < 0 ? 'bad' : ''} ${below}`}
      style={style}
    >
      {text}
    </BoardLabel>
  ) : (
    <BoardLabel class={`ghost-reason ${below}`} style={style}>
      <span aria-hidden="true">✕ </span>
      {text}
    </BoardLabel>
  );
  return (
    <>
      <Outline
        cells={cells}
        scale={scale}
        lot={lot}
        class={`install-target renovate-target ${p.legal ? 'legal' : 'illegal'} ${pending ? 'armed' : ''}`}
      />
      {label}
    </>
  );
}

/**
 * Installing a fixture: the piece under the pointer outlined, blue if it can take it (with
 * what it would do to the week's Wow, and what it would replace) or orange with why not.
 */
function InstallTarget({ scale }: { scale: number }) {
  const p = preview.value;
  const play = activePlay.value;
  const state = run.value;
  const { lot } = state.house;
  if (!p || !play || play.t !== 'install') return null;
  const px = CELL * scale;
  const hover = hoverCell.value;
  const cells: readonly Cell[] = p.cells.length > 0 ? p.cells : hover ? [hover] : [];
  if (cells.length === 0) return null;
  const sel = selection.value;
  const name = sel?.kind === 'fixture' ? CONTENT.fixtures[sel.id].name : 'fixture';
  const pending = tentative.value?.t === 'install';
  const armed = installArmed.value === play.uid && play.from === 'supplies';
  const wow = SCORE_LABELS.total;
  const change =
    p.delta > 0
      ? `▲ +${formatNumber(p.delta)} ${wow}`
      : p.delta < 0
        ? `▼ −${formatNumber(-p.delta)} ${wow}`
        : `±0 ${wow}`;
  const replaces = p.replaces ? ` · replaces its ${CONTENT.fixtures[p.replaces].name}` : '';
  const then = pending
    ? ' · End week to install'
    : play.from === 'supplies'
      ? armed
        ? ' · click again to install'
        : ' · free: click twice'
      : '';
  const text = p.legal
    ? `${name}: ${change}${replaces}${then}`
    : (p.reason ?? 'It doesn’t go there.');
  const spot = oneLabelSpot(cells, lot.width, px, p.legal ? text : `✕ ${text}`);
  const style = { left: `${spot.x * px}px`, top: `${spot.y * px}px` };
  const below = spot.below ? 'below' : '';
  const label = p.legal ? (
    <BoardLabel
      class={`ghost-delta install-label ${p.delta > 0 ? 'good' : p.delta < 0 ? 'bad' : ''} ${below}`}
      style={style}
    >
      {text}
    </BoardLabel>
  ) : (
    <BoardLabel class={`ghost-reason ${below}`} style={style}>
      <span aria-hidden="true">✕ </span>
      {text}
    </BoardLabel>
  );
  return (
    <>
      <Outline
        cells={cells}
        scale={scale}
        lot={lot}
        class={`install-target ${p.legal ? 'legal' : 'illegal'} ${armed || pending ? 'armed' : ''}`}
      />
      {label}
    </>
  );
}

/** How far a host's gain badge sits below a preview mark on the same piece, in CSS px. */
const MARK_CLEARANCE = 20;
/** The farthest a host's gain badge moves off its spot to clear another, in CSS px (or a cell). */
const BADGE_REACH = 48;

/**
 * Puts each `[data-x]` badge in `ref`'s element on whole device pixels, centered on its spot
 * (data-x, data-y, in CSS px): as wide and tall as its text needs, rounded up to whole device
 * pixels, its corner on one. A badge as wide as its text, centered by a transform, would land
 * half a device pixel off and blur its ink ring. Where its spot would cover another badge or a
 * piece's digit or badge, it moves to the nearest clear one within `reach` CSS px (label-layout.ts
 * spreadBadges), the best gain's first, so that one keeps its spot. Measured after each render,
 * before the browser paints, like BoardLabel's nudge.
 */
function useCrispBadges(
  ref: { readonly current: HTMLElement | null },
  dpr: number,
  reach: number,
): void {
  useLayoutEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const els = [...layer.querySelectorAll<HTMLElement>('[data-x]')];
    for (const el of els) {
      el.style.width = '';
      el.style.height = '';
    }
    // In the window's CSS px, so they land on its device pixels wherever the board sits (at 2×
    // a board wider than its view starts at the side column's edge, which can be fractional).
    const origin = layer.getBoundingClientRect();
    // The border box's size (box-sizing: border-box), whatever transform its pop-in is at.
    const spots = els.map((el) => {
      const cs = getComputedStyle(el);
      const w = Math.ceil(parseFloat(cs.width) * dpr - 1e-6) / dpr;
      const h = Math.ceil(parseFloat(cs.height) * dpr - 1e-6) / dpr;
      const x = origin.left + Number(el.dataset.x) - w / 2;
      return { x, y: origin.top + Number(el.dataset.y) - h / 2, w, h };
    });
    // The pieces' digits and badges.
    const keepOff = [...(layer.parentElement?.querySelectorAll('.digit, .board-badge') ?? [])].map(
      (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      },
    );
    const order = els.map((_, i) => i);
    order.sort((a, b) => +els[b]!.classList.contains('best') - +els[a]!.classList.contains('best'));
    const boxes = spreadBadges(
      order.map((i) => spots[i]!),
      keepOff,
      reach,
      dpr,
    );
    order.forEach((i, k) => {
      const el = els[i]!;
      const b = boxes[k]!;
      el.style.width = `${b.w}px`;
      el.style.height = `${b.h}px`;
      el.style.left = `${b.x - origin.left}px`;
      el.style.top = `${b.y - origin.top}px`;
    });
  });
}

/**
 * D-107: while a fixture is selected, every legal host wears what installing it there does to
 * this week's Wow, net of any fixture it would replace (the rules' installGains, computed once
 * per selection), and the best one, if it gains, gets a ★ and a gold ring (install-gains.css).
 * The host being looked at (under the pointer, armed, or waiting for End week) has
 * InstallTarget's label instead; a host the preview marks as helping or hurting it keeps its
 * badge below that mark. Inside the board, so its layer (--z-badges) applies; on whole device
 * pixels, off each other and the pieces' digits, within a cell of its spot (useCrispBadges).
 */
function HostBadges({ scale }: { scale: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useCrispBadges(
    ref,
    viewSize.value?.dpr ?? (window.devicePixelRatio || 1),
    Math.min(CELL * scale, BADGE_REACH),
  );
  const gains = installGains.value;
  const sel = selection.value;
  if (gains.length === 0 || sel?.kind !== 'fixture') return null;
  const occ = occupancy(run.value.house);
  const px = CELL * scale;
  const play = activePlay.value;
  const looking = play?.t === 'install' ? play.uid : 0;
  const p = preview.value;
  const marked = new Set(
    p?.legal
      ? (p.newPiece?.lines ?? []).flatMap((l) =>
          l.from.flatMap((ref) => (ref.kind === 'piece' ? [ref.uid] : [])),
        )
      : [],
  );
  const best = Math.max(...gains.map((g) => g.gain));
  // A new selection mounts them afresh, so they pop in again.
  return (
    <div ref={ref} key={`${sel.from}-${sel.i}-${sel.id}`} class="host-badges" aria-hidden="true">
      {gains.map((g) => {
        const cells = occ.cells.get(g.uid);
        if (!cells) return null;
        const spot = furnitureSpot(cells);
        const top = (spot.y + 0.5) * px + (marked.has(g.uid) ? MARK_CLEARANCE : 0);
        const star = best > 0 && g.gain === best;
        const tone = g.gain > 0 ? 'good' : g.gain < 0 ? 'bad' : '';
        return (
          <div
            key={g.uid}
            class={`host-badge ${tone} ${star ? 'best' : ''} ${g.uid === looking ? 'current' : ''}`}
            data-x={(spot.x + 0.5) * px}
            data-y={top}
          >
            {star ? '★ ' : ''}
            {g.gain > 0 ? '▲ ' : g.gain < 0 ? '▼ ' : ''}
            {signed(g.gain)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The Copy Machine's and the Moving Truck's targets: the piece under the pointer outlined, or
 * the carried piece's ghost at its new spot, with what it would do to the week's Wow.
 */
function ToolTarget({ scale }: { scale: number }) {
  const sel = selection.value;
  const state = run.value;
  const { lot } = state.house;
  const hover = hoverCell.value;
  if (!sel || sel.kind !== 'tool' || !hover) return null;
  const use = CONTENT.tools[sel.id].use.kind;
  if (use !== 'move' && use !== 'copy') return null;
  const px = CELL * scale;
  const occ = occupancy(state.house);
  const p = toolPreview.value;
  const action = toolAction.value;
  const armed = !!toolArmed.value;
  const label = (cells: readonly Cell[], text: string, tone: string) => {
    const spot = oneLabelSpot(cells, lot.width, px, text);
    return (
      <BoardLabel
        class={`ghost-delta install-label ${tone} ${spot.below ? 'below' : ''}`}
        style={{ left: `${spot.x * px}px`, top: `${spot.y * px}px` }}
      >
        {text}
      </BoardLabel>
    );
  };
  const wow = (d: number) =>
    d > 0
      ? `▲ +${formatNumber(d)} ${SCORE_LABELS.total}`
      : d < 0
        ? `▼ −${formatNumber(-d)} ${SCORE_LABELS.total}`
        : `±0 ${SCORE_LABELS.total}`;
  if (use === 'copy' || movingUid.value === null) {
    const uid = action?.target?.uid ?? uidAt(occ, hover.x, hover.y);
    const cells = uid ? (occ.cells.get(uid) ?? [hover]) : [hover];
    const piece = uid ? state.house.pieces.find((q) => q.uid === uid) : undefined;
    const name = piece ? CONTENT.pieces[piece.defId].name : '';
    const ok = use === 'copy' ? !!p?.ok : !!piece;
    const text =
      use === 'copy'
        ? ok
          ? `Copy ${definite(name)} into your reserve · ${armed ? 'click again' : 'click twice'}`
          : (p?.reason ?? 'Pick a piece to copy.')
        : piece
          ? `Pick up ${definite(name)}`
          : 'Pick a piece to move';
    return (
      <>
        <Outline
          cells={cells}
          scale={scale}
          lot={lot}
          class={`install-target ${ok ? 'legal' : 'illegal'} ${armed ? 'armed' : ''}`}
        />
        {label(cells, text, ok ? 'good' : 'bad')}
      </>
    );
  }
  // Carrying a piece: its ghost at the pointer.
  const piece = state.house.pieces.find((q) => q.uid === movingUid.value);
  const t = action?.target;
  if (!piece || !t || t.x === undefined || t.y === undefined) return null;
  const cells = placedCells(piece.shape ?? CONTENT.pieces[piece.defId].shape, t.x, t.y, t.rot ?? 0);
  const ok = !!p?.ok;
  return (
    <>
      <Outline
        cells={occ.cells.get(piece.uid) ?? []}
        scale={scale}
        lot={lot}
        class="demolish-hint"
      />
      <GhostPiece
        defId={piece.defId}
        rot={t.rot ?? 0}
        shape={piece.shape}
        cells={cells}
        scale={scale}
        look={
          isIndoor(piece.defId)
            ? roomLook(state.house, piece.uid)
            : pieceLook(state.house, piece.uid)
        }
        class={`ghost ${ok ? 'legal' : 'illegal'} ${armed ? 'pending' : ''}`}
      />
      {label(
        cells,
        ok
          ? `Move here: ${wow(p!.delta)}${breaksText(p!.setsLost)} · ${armed ? 'click again' : 'click twice'}`
          : `✕ ${p?.reason ?? 'It can’t go there.'}`,
        ok ? (p!.delta > 0 ? 'good' : p!.delta < 0 ? 'bad' : '') : 'bad',
      )}
    </>
  );
}

function targetName(target: DemolishPreview['target']): string {
  if (!target) return '';
  return 'feature' in target
    ? CONTENT.features[target.feature].name
    : CONTENT.pieces[target.defId].name;
}

/** " · ✕ breaks Jack-and-Jill": the sets a demolition or a move would break, for its label. */
function breaksText(lost: readonly SetScore[]): string {
  if (lost.length === 0) return '';
  return ` · ✕ breaks ${lost.map((s) => CONTENT.sets[s.set].name).join(', ')}`;
}

/**
 * Demolish mode: the target under the pointer (or the armed one) outlined in red with what
 * demolishing it would do to the week's Wow, or why it can't go. While a target is armed,
 * another legal one under the pointer gets a lighter outline: clicking it re-arms there.
 */
function DemolishTarget({ scale }: { scale: number }) {
  const d = demolishPreview.value;
  const armed = demolishArmed.value;
  const hover = hoverCell.value;
  const note = demolishNote.value;
  const state = run.value;
  const { lot } = state.house;
  const px = CELL * scale;
  const hx = hover?.x;
  const hy = hover?.y;
  const other = useMemo(() => {
    if (!armed || hx === undefined || hy === undefined || !d || hasCell(d.cells, { x: hx, y: hy }))
      return null;
    const q = rules.previewDemolish(state, hx, hy);
    return q.legal ? q : null;
  }, [state, armed, d, hx, hy]);
  if (!d) return null;

  const cells: readonly Cell[] =
    d.cells.length > 0 ? d.cells : hover && sameCell(note, hover) ? [hover] : [];
  const hint = other && (
    <Outline cells={other.cells} scale={scale} lot={lot} class="demolish-hint" />
  );
  if (cells.length === 0) return hint || null;

  const wow = SCORE_LABELS.total;
  const change =
    d.delta < 0
      ? ` · ▼ −${formatNumber(-d.delta)} ${wow}/week`
      : d.delta > 0
        ? ` · ▲ +${formatNumber(d.delta)} ${wow}/week`
        : '';
  const name = targetName(d.target);
  const verb = armed ? `Click again to demolish ${definite(name)}` : `Demolish ${name}`;
  const text = d.legal
    ? `${verb}${change}${breaksText(d.setsLost)}`
    : (d.reason ?? 'That can’t be demolished.');
  const spot = oneLabelSpot(cells, lot.width, px, d.legal ? text : `✕ ${text}`);
  const style = { left: `${spot.x * px}px`, top: `${spot.y * px}px` };
  const below = spot.below ? 'below' : '';
  const tone = d.delta < 0 ? 'bad' : d.delta > 0 ? 'good' : '';
  const label = d.legal ? (
    <BoardLabel class={`ghost-delta demolish-label ${tone} ${below}`} style={style}>
      {text}
    </BoardLabel>
  ) : (
    <BoardLabel class={`ghost-reason ${below}`} style={style}>
      <span aria-hidden="true">✕ </span>
      {text}
    </BoardLabel>
  );
  return (
    <>
      {hint}
      <Outline
        cells={cells}
        scale={scale}
        lot={lot}
        class={`demolish-target ${d.legal ? 'legal' : 'illegal'} ${d.legal && armed ? 'armed' : ''}`}
      />
      {label}
    </>
  );
}

/** The preview's +/− badges: on pieces whose earnings change, and on what helps or hurts the new piece. */
function Badges({ scale }: { scale: number }) {
  const p = preview.value!;
  const occ = occupancy(run.value.house);
  const px = CELL * scale;
  const marks: { key: string; x: number; y: number; text: string; good: boolean; kind: string }[] =
    [];

  for (const line of p.lines) {
    if (line.isNew) continue;
    const cells = occ.cells.get(line.uid);
    if (!cells) continue;
    const top = Math.min(...cells.map((c) => c.y));
    const right = Math.max(...cells.map((c) => c.x)) + 1;
    const d = line.after - line.before;
    marks.push({
      key: `d${line.uid}`,
      x: right - 0.1,
      y: top + 0.1,
      text: d > 0 ? `+${d}` : `−${-d}`,
      good: d > 0,
      kind: 'delta',
    });
  }

  const sourceAt = (ref: SourceRef): { x: number; y: number } | null => {
    if (ref.kind === 'terrain') return { x: ref.x + 0.5, y: ref.y + 0.5 };
    if (ref.kind === 'street') return { x: ref.x + 0.5, y: run.value.house.lot.height + 0.5 };
    const cells = occ.cells.get(ref.uid);
    return cells ? center(cells) : null;
  };
  for (const line of p.newPiece?.lines ?? []) {
    for (const ref of line.from) {
      const at = sourceAt(ref);
      if (!at) continue;
      const key = `s${JSON.stringify(ref)}${line.label}`;
      marks.push({
        key,
        x: at.x,
        y: at.y,
        text: line.value >= 0 ? '+' : '−',
        good: line.value >= 0,
        kind: 'source',
      });
    }
  }
  for (const t of p.clearedTrees) {
    marks.push({
      key: `t${t.x},${t.y}`,
      x: t.x + 0.5,
      y: t.y + 0.5,
      text: '✕',
      good: false,
      kind: 'cleared',
    });
  }

  return (
    <div class="badges" aria-hidden="true">
      {marks.map((m) => (
        <div
          key={m.key}
          class={`badge ${m.kind} ${m.good ? 'good' : 'bad'}`}
          style={{ left: `${m.x * px}px`, top: `${m.y * px}px` }}
        >
          <span class="glyph">{m.text}</span>
        </div>
      ))}
    </div>
  );
}

/** How much wider a popup grows at its pop's peak, each side, as a share of its width (app.css). */
const POPUP_GROW = 0.1;

/**
 * The tally's and the week's popups (director.ts), each centered on its spot unless that would
 * cut it off at the side of the board's view, which can be narrower than the lot (1280×720):
 * then it's nudged inside, as BoardLabel is (a room's "Renovated · level 1" at the lot's edge),
 * with room for its pop's 1.2×. Measured after each render, by its layout width.
 */
function PopupLayer({ scale }: { scale: number }) {
  const px = CELL * scale;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layer = ref.current;
    const view = layer?.closest('.board-scroll');
    if (!layer || !view) return;
    const v = view.getBoundingClientRect();
    const origin = layer.getBoundingClientRect().left;
    for (const el of layer.querySelectorAll<HTMLElement>('.popup')) {
      const x = Number(el.dataset.x);
      const w = el.offsetWidth;
      const left = origin + x - w / 2 - w * POPUP_GROW;
      const right = origin + x + w / 2 + w * POPUP_GROW;
      el.style.left = `${x + keepInView(left, right, v.left, v.right)}px`;
    }
  });
  return (
    <div ref={ref} class="popups" aria-hidden="true">
      {popups.value.map((pop) => (
        <div
          key={pop.id}
          class={`popup ${pop.kind}`}
          data-x={pop.x * px}
          style={{
            left: `${pop.x * px}px`,
            top: `${pop.y * px}px`,
            animationDuration: `${pop.ms}ms`,
          }}
        >
          {pop.text}
        </div>
      ))}
    </div>
  );
}

/** The zoom buttons in the board's corner. Keys: + and − zoom, F toggles Fit (App.tsx). */
function CameraControls() {
  const fit = isFit.value;
  return (
    <div class="camera-controls" role="group" aria-label="Zoom">
      <button
        type="button"
        title="Zoom out (−)"
        aria-label="Zoom out"
        disabled={!canZoomOut()}
        onClick={() => zoomOut()}
      >
        −
      </button>
      <button
        type="button"
        class={fit ? 'on' : ''}
        aria-pressed={fit}
        title={fit ? 'Back to your zoom (F)' : 'Fit the whole lot (F)'}
        onClick={() => toggleFit()}
      >
        Fit
      </button>
      <button
        type="button"
        title="Zoom in (+)"
        aria-label="Zoom in"
        disabled={!canZoomIn()}
        onClick={() => zoomIn()}
      >
        +
      </button>
    </div>
  );
}
