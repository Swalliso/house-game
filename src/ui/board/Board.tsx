// The board (the BoardView of D-033): the terrain canvas, the pieces, the ghost that follows
// the cursor, the preview's badges, and the tally's popups. The pointer maps to a cell by
// arithmetic on one element (D-049). M1 shows the lot at the default whole-number zoom; zoom,
// pan, and the Fit overview come in M2.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CONTENT, placedCells, type Cell, type SourceRef } from '../../rules/index.ts';
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
import {
  activePlay,
  currentTally,
  hoverCell,
  inspected,
  preview,
  rotation,
  run,
  selected,
  tentative,
} from '../store.ts';
import { TILE } from '../sprites.ts';
import { center, fitScale, occupancy, uidAt } from './geometry.ts';
import { PieceShape, wobble } from './PieceView.tsx';
import { TerrainLayer } from './TerrainLayer.tsx';
import { formatNumber } from '../format.ts';

/** Rotates the card being placed; a tentative placement turns where it is. */
export function rotate(): void {
  const r = ((rotation.value + 1) % 4) as 0 | 1 | 2 | 3;
  rotation.value = r;
  if (tentative.value) tentative.value = { ...tentative.value, rot: r };
  audio.play('rotate');
}

/** A tap places tentatively; End week commits it (D-036, D-047). */
function placeTentatively(): void {
  const play = activePlay.value;
  const p = preview.value;
  if (!play) return;
  if (!p?.legal) {
    audio.play('illegal');
    return;
  }
  tentative.value = { ...play };
  audio.play('select', { rate: 0.8 });
}

function useBoardScale(ref: { current: HTMLElement | null }, lotW: number, lotH: number): number {
  const [scale, setScale] = useState(2);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(fitScale(el.clientWidth - 12, el.clientHeight - 12, lotW, lotH));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [lotW, lotH]);
  return scale;
}

export function Board() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const state = run.value;
  const { lot } = state.house;
  const scale = useBoardScale(scrollRef, lot.width, lot.height);
  const px = TILE * scale;
  const occ = occupancy(state.house);
  const tally = currentTally.value;
  const earnedBy = new Map(tally.pieces.map((p) => [p.uid, p.earned]));
  const view = tallyView.value;
  const lit = new Set(highlighted.value);
  const p = preview.value;
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

  const cellAt = (e: PointerEvent): Cell | 'street' | null => {
    const rect = boardRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / px);
    const y = Math.floor((e.clientY - rect.top) / px);
    if (x < 0 || x >= lot.width || y < 0 || y > lot.height) return null;
    return y === lot.height ? 'street' : { x, y };
  };

  const onPointerMove = (e: PointerEvent) => {
    const c = cellAt(e);
    const cell = c === 'street' ? null : c;
    const prev = hoverCell.value;
    if (cell?.x !== prev?.x || cell?.y !== prev?.y) hoverCell.value = cell;
    if (selected.value === null && !tentative.value) {
      if (c === 'street')
        inspected.value = {
          kind: 'street',
          x: Math.floor((e.clientX - boardRef.current!.getBoundingClientRect().left) / px),
        };
      else if (c) {
        const uid = uidAt(occ, c.x, c.y);
        inspected.value = uid ? { kind: 'piece', uid } : { kind: 'tile', x: c.x, y: c.y };
      }
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 2) {
      if (busy.value) setHold(true);
      else if (selected.value !== null) rotate();
      return;
    }
    if (e.button !== 0) return;
    if (busy.value) {
      skip();
      return;
    }
    // Touch: the first tap also moves the hover cell there.
    const c = cellAt(e);
    if (c && c !== 'street') hoverCell.value = c;
    if (selected.value !== null) {
      tentative.value = null;
      placeTentatively();
    }
  };

  const ghostCells = (() => {
    const play = activePlay.value;
    if (!play) return null;
    const card = state.hand[play.i];
    if (!card) return null;
    return {
      defId: card.id,
      cells: placedCells(CONTENT.pieces[card.id].shape, play.x, play.y, play.rot),
    };
  })();

  return (
    <div class="board-scroll" ref={scrollRef}>
      <div
        ref={boardRef}
        class={`board ${selected.value !== null ? 'placing' : ''}`}
        style={{ width: `${lot.width * px}px`, height: `${(lot.height + 1) * px}px` }}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={(e) => e.button === 2 && setHold(false)}
        onPointerLeave={() => {
          hoverCell.value = null;
          setHold(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <TerrainLayer lot={lot} scale={scale} />
        <div class="street-label" style={{ top: `${lot.height * px}px`, height: `${px}px` }}>
          Street
        </div>
        {state.house.pieces.map((piece) => (
          <PieceShape
            key={piece.uid}
            uid={piece.uid}
            defId={piece.defId}
            cells={occ.cells.get(piece.uid)!}
            scale={scale}
            occ={occ}
            earned={earnedBy.get(piece.uid)}
            settle={placed?.uid === piece.uid ? placed.id : undefined}
            class={[
              view?.activeUid === piece.uid ? 'active' : '',
              lit.has(piece.uid) ? 'lit' : '',
              gained.has(piece.uid) ? 'set-preview' : '',
            ].join(' ')}
          />
        ))}
        {ghostCells && <Ghost defId={ghostCells.defId} cells={ghostCells.cells} scale={scale} />}
        {p?.legal && <Badges scale={scale} />}
        <PopupLayer scale={scale} />
      </div>
    </div>
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
  const c = center(cells);
  const inside = cells.filter((cell) => cell.x >= 0 && cell.y >= 0);
  return (
    <>
      <PieceShape
        defId={defId}
        cells={cells}
        scale={scale}
        class={`ghost ${legal ? 'legal' : 'illegal'} ${pending ? 'pending' : ''}`}
      />
      {!legal && inside.length > 0 && (
        <div
          class="ghost-reason"
          style={{ left: `${c.x * px}px`, top: `${Math.min(...cells.map((q) => q.y)) * px}px` }}
        >
          <span aria-hidden="true">✕ </span>
          {p?.reason ?? 'Can’t build there'}
        </div>
      )}
      {legal && p && (
        <div
          class={`ghost-delta ${p.delta > 0 ? 'good' : p.delta < 0 ? 'bad' : ''}`}
          style={{ left: `${c.x * px}px`, top: `${Math.min(...cells.map((q) => q.y)) * px}px` }}
        >
          {p.delta > 0 ? '▲ +' : p.delta < 0 ? '▼ −' : ''}
          {formatNumber(Math.abs(p.delta))} Wow{pending ? ' · End week to build' : ''}
        </div>
      )}
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
          {m.text}
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
