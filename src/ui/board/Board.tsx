// The board (the BoardView of D-033): the terrain canvas, the fenced-yard tint, the pieces,
// the ghost that follows the cursor, the preview's badges, the demolish tool's target, and
// the tally's popups. The pointer maps to a cell by arithmetic on one element (D-049).
//
// The camera (camera.ts) zooms by re-laying out the board at a new scale, never with a CSS
// transform (D-057). Dragging pans the scroll container: a left-button drag past a few pixels
// pans and then doesn't place or select on release, and the middle button always pans. So a
// click acts on release.

import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  placedCells,
  rules,
  SCORE_LABELS,
  type Cell,
  type DemolishPreview,
  type SourceRef,
  type UseToolAction,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import {
  busy,
  fxHooks,
  highlighted,
  justPlaced,
  popups,
  setHold,
  skip,
  tallyView,
} from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatNumber } from '../format.ts';
import {
  activePlay,
  currentTally,
  demolishArmed,
  demolishAt,
  demolishPreview,
  hoverCell,
  inspected,
  installArmed,
  installSupply,
  movingUid,
  preview,
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
} from '../store.ts';
import { TILE } from '../sprites.ts';
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
import { center, labelSpot, occupancy, uidAt } from './geometry.ts';
import { PieceShape, wobble } from './PieceView.tsx';
import { Outline, TerrainLayer, YardTint } from './TerrainLayer.tsx';
import './board-m2.css';

/** The scroll container's padding (app.css), kept clear around the board. */
const PAD = 6;

/** Rotates the card being placed; a tentative placement turns where it is. */
export function rotate(): void {
  const sel = selection.value;
  // A fixture has no shape to turn; a tool only turns the piece the Moving Truck carries.
  if (sel?.kind === 'fixture') return;
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
    if (useToolNow(action)) audio.play(use === 'move' ? 'place-room' : 'stamp');
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
  const px = TILE * scale;
  const demolishing = tool.value === 'demolish';
  const occ = occupancy(state.house);
  const tally = currentTally.value;
  const scoreBy = new Map(tally.pieces.map((p) => [p.uid, p]));
  const view = tallyView.value;
  const lit = new Set(highlighted.value);
  const p = demolishing ? null : preview.value;
  const gained = new Set(p?.setsGained.flatMap((s) => s.members) ?? []);
  const placed = justPlaced.value;

  useEffect(() => {
    fxHooks.wobble = wobble;
    fxHooks.shake = (amount: number) => {
      const el = boardRef.current;
      if (!el || amount <= 0) return;
      const a = Math.max(1, Math.round(amount));
      el.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: `translate(${a}px, ${-a / 2}px)` },
          { transform: `translate(${-a}px, ${a / 2}px)` },
          { transform: `translate(${a / 2}px, ${a}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 200, easing: 'ease-out' },
      );
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
      el.scrollTop = el.scrollHeight - el.clientHeight;
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
      tentative.value = null;
      // A click on another piece re-arms a supply install there.
      const sel = selection.value;
      if (sel?.kind === 'fixture' && sel.from === 'supplies' && c && c !== 'street') {
        const uid = uidAt(occ, c.x, c.y);
        if (installArmed.value !== null && installArmed.value !== uid) installArmed.value = null;
      }
      placeTentatively();
    }
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
      cells: placedCells(CONTENT.pieces[sel.id].shape, play.x, play.y, play.rot),
    };
  })();
  const installing = !demolishing && activePlay.value?.t === 'install';
  const tooling = !demolishing && selection.value?.kind === 'tool';

  const boardClass = [
    'board',
    !demolishing && selected.value !== null ? 'placing' : '',
    demolishing ? 'demolishing' : '',
    scale < 2 ? 'small' : '',
  ].join(' ');

  return (
    <>
      <div
        class={`board-scroll ${panning ? 'panning' : ''}`}
        ref={scrollRef}
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
          style={{ width: `${lot.width * px}px`, height: `${(lot.height + 1) * px}px` }}
        >
          <TerrainLayer lot={lot} scale={scale} />
          <YardTint state={state} scale={scale} />
          <div class="street-label" style={{ top: `${lot.height * px}px`, height: `${px}px` }}>
            Street
          </div>
          {state.house.pieces.map((piece) => {
            const score = scoreBy.get(piece.uid);
            return (
              <PieceShape
                key={piece.uid}
                uid={piece.uid}
                defId={piece.defId}
                cells={occ.cells.get(piece.uid)!}
                scale={scale}
                occ={occ}
                earned={score?.earned}
                unmet={score?.unmet}
                fixture={piece.fixture?.id}
                settle={placed?.uid === piece.uid ? placed.id : undefined}
                class={[
                  view?.activeUid === piece.uid ? 'active' : '',
                  lit.has(piece.uid) ? 'lit' : '',
                  gained.has(piece.uid) ? 'set-preview' : '',
                ].join(' ')}
              />
            );
          })}
          {demolishing && <DemolishTarget scale={scale} />}
          {ghostCells && <Ghost defId={ghostCells.defId} cells={ghostCells.cells} scale={scale} />}
          {installing && <InstallTarget scale={scale} />}
          {tooling && <ToolTarget scale={scale} />}
          {p?.legal && <Badges scale={scale} />}
          <PopupLayer scale={scale} />
        </div>
      </div>
      <CameraControls />
    </>
  );
}

function Ghost({
  defId,
  cells,
  scale,
}: {
  defId: Parameters<typeof PieceShape>[0]['defId'];
  cells: Cell[];
  scale: number;
}) {
  const p = preview.value;
  const legal = !!p?.legal;
  const pending = !!tentative.value;
  const px = TILE * scale;
  const inside = cells.filter((cell) => cell.x >= 0 && cell.y >= 0);
  // Keep the label on the board: away from the side edges, and below the ghost at the top.
  const spot = labelSpot(cells, run.value.house.lot.width);
  const below = spot.below;
  const label = { left: `${spot.x * px}px`, top: `${spot.y * px}px` };
  return (
    <>
      <PieceShape
        defId={defId}
        cells={cells}
        scale={scale}
        class={`ghost ${legal ? 'legal' : 'illegal'} ${pending ? 'pending' : ''}`}
      />
      {!legal && inside.length > 0 && (
        <div class={`ghost-reason ${below ? 'below' : ''}`} style={label}>
          <span aria-hidden="true">✕ </span>
          {p?.reason ?? 'Can’t build there'}
        </div>
      )}
      {legal && p && (
        <div
          class={`ghost-delta ${p.delta > 0 ? 'good' : p.delta < 0 ? 'bad' : ''} ${below ? 'below' : ''}`}
          style={label}
        >
          {p.delta > 0 ? '▲ +' : p.delta < 0 ? '▼ −' : ''}
          {formatNumber(Math.abs(p.delta))} {SCORE_LABELS.total}
          {pending ? ' · End week to build' : ''}
        </div>
      )}
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
  const px = TILE * scale;
  const hover = hoverCell.value;
  const cells: readonly Cell[] = p.cells.length > 0 ? p.cells : hover ? [hover] : [];
  if (cells.length === 0) return null;
  const spot = labelSpot(cells, lot.width);
  const style = { left: `${spot.x * px}px`, top: `${spot.y * px}px` };
  const below = spot.below ? 'below' : '';
  const sel = selection.value;
  const name = sel?.kind === 'fixture' ? CONTENT.fixtures[sel.id].name : 'fixture';
  const pending = tentative.value?.t === 'install';
  const armed = installArmed.value === play.uid && play.from === 'supplies';
  let label;
  if (p.legal) {
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
    label = (
      <div
        class={`ghost-delta install-label ${p.delta > 0 ? 'good' : p.delta < 0 ? 'bad' : ''} ${below}`}
        style={style}
      >
        {name}: {change}
        {replaces}
        {then}
      </div>
    );
  } else {
    label = (
      <div class={`ghost-reason ${below}`} style={style}>
        <span aria-hidden="true">✕ </span>
        {p.reason ?? 'It doesn’t go there.'}
      </div>
    );
  }
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
  const px = TILE * scale;
  const occ = occupancy(state.house);
  const p = toolPreview.value;
  const action = toolAction.value;
  const armed = !!toolArmed.value;
  const label = (cells: readonly Cell[], text: string, tone: string) => {
    const spot = labelSpot(cells, lot.width);
    return (
      <div
        class={`ghost-delta install-label ${tone} ${spot.below ? 'below' : ''}`}
        style={{ left: `${spot.x * px}px`, top: `${spot.y * px}px` }}
      >
        {text}
      </div>
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
          ? `Copy the ${name} into your reserve · ${armed ? 'click again' : 'click twice'}`
          : (p?.reason ?? 'Pick a piece to copy.')
        : piece
          ? `Pick up the ${name}`
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
  const cells = placedCells(CONTENT.pieces[piece.defId].shape, t.x, t.y, t.rot ?? 0);
  const ok = !!p?.ok;
  return (
    <>
      <Outline
        cells={occ.cells.get(piece.uid) ?? []}
        scale={scale}
        lot={lot}
        class="demolish-hint"
      />
      <PieceShape
        defId={piece.defId}
        cells={cells}
        scale={scale}
        class={`ghost ${ok ? 'legal' : 'illegal'} ${armed ? 'pending' : ''}`}
      />
      {label(
        cells,
        ok
          ? `Move here: ${wow(p!.delta)} · ${armed ? 'click again' : 'click twice'}`
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
  const px = TILE * scale;
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

  const spot = labelSpot(cells, lot.width);
  const style = { left: `${spot.x * px}px`, top: `${spot.y * px}px` };
  const below = spot.below ? 'below' : '';
  let label;
  if (d.legal) {
    const wow = SCORE_LABELS.total;
    const change =
      d.delta < 0
        ? ` · ▼ −${formatNumber(-d.delta)} ${wow}/week`
        : d.delta > 0
          ? ` · ▲ +${formatNumber(d.delta)} ${wow}/week`
          : '';
    const name = targetName(d.target);
    const text = armed ? `Click again to demolish the ${name}` : `Demolish ${name}`;
    const tone = d.delta < 0 ? 'bad' : d.delta > 0 ? 'good' : '';
    label = (
      <div class={`ghost-delta demolish-label ${tone} ${below}`} style={style}>
        {text}
        {change}
      </div>
    );
  } else {
    label = (
      <div class={`ghost-reason ${below}`} style={style}>
        <span aria-hidden="true">✕ </span>
        {d.reason ?? 'That can’t be demolished.'}
      </div>
    );
  }
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
  const px = TILE * scale;
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

function PopupLayer({ scale }: { scale: number }) {
  const px = TILE * scale;
  return (
    <div class="popups" aria-hidden="true">
      {popups.value.map((pop) => (
        <div
          key={pop.id}
          class={`popup ${pop.kind}`}
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
