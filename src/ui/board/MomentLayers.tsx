// The board's moments that sit on the lot: "Topped out!" the first week Under one roof holds
// (D-127), and the tally's arcs along a chain (D-094's option 1). They're in the board, so they
// keep to the house however the lot is panned or zoomed, and they're drawn at the camera's
// scale. The roof that D-127 and D-133 drew over the house went with D-147.

import type { Lot, Preview } from '../../rules/index.ts';
import { previewArcs } from '../fx/chain.ts';
import { chainArc, toppedOut } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { Icon } from '../kit/kit.tsx';
import { CELL } from '../sprites.ts';
import type { Occupancy } from './geometry.ts';
import type { HouseModel } from './house-model.ts';

/**
 * "Topped out!" (D-127): a plaque with a flag over the top of the house, the first week Under
 * one roof holds, for FEEL.moments.toppedOutMs. The director's stars and cheer go with it.
 */
export function ToppedOut({ scale, model }: { scale: number; model: HouseModel }) {
  const t = toppedOut.value;
  const b = model.bounds;
  if (!t || !b) return null;
  const px = CELL * scale;
  return (
    <div
      class="topped-out ui"
      key={t.id}
      role="status"
      style={{
        left: `${(b.x + b.w / 2) * px}px`,
        top: `${b.y * px}px`,
        '--topped-ms': `${FEEL.moments.toppedOutMs}ms`,
      }}
    >
      <Icon name="flag" />
      <span>Topped out!</span>
    </div>
  );
}

type Point = { x: number; y: number };

/** A curve from a to b, bowing out to one side of the way it runs (up, running left to right). */
function arcPath(a: Point, b: Point): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = FEEL.chain.bend * len;
  const mx = (a.x + b.x) / 2 + (dy / len) * bow;
  const my = (a.y + b.y) / 2 - (dx / len) * bow;
  return `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
}

/**
 * D-094's option 1: while the tally plays a chain, an arc runs from the piece that boosts to the
 * one it sets going, tracing toward it and fading by the end of that piece's step. With Reduce
 * motion it's drawn whole and fades.
 */
export function ChainArc({ lot, scale }: { lot: Lot; scale: number }) {
  const arc = chainArc.value;
  if (!arc) return null;
  const px = CELL * scale;
  const b = { x: arc.to.x * px, y: arc.to.y * px };
  const d = arcPath({ x: arc.from.x * px, y: arc.from.y * px }, b);
  return (
    <svg
      key={arc.id}
      class="chain-arc"
      width={lot.width * px}
      height={(lot.height + 1) * px}
      style={{
        '--arc-ms': `${arc.ms}ms`,
        '--trace-ms': `${arc.ms * FEEL.chain.traceShare}ms`,
      }}
      aria-hidden="true"
    >
      <path class="arc-under" d={d} pathLength={100} />
      <path class="arc-line" d={d} pathLength={100} />
      <circle class="arc-end" cx={b.x} cy={b.y} r={Math.max(3, px * 0.12)} />
    </svg>
  );
}

/**
 * D-094's option 1 in the placement preview: while a play is looked at, dashed arcs run from the
 * pieces that would boost its piece, and from it to the pieces it would boost.
 */
export function PreviewArcs({
  preview,
  occ,
  lot,
  scale,
}: {
  preview: Preview;
  occ: Occupancy;
  lot: Lot;
  scale: number;
}) {
  const arcs = previewArcs(preview);
  if (arcs.length === 0) return null;
  const px = CELL * scale;
  const focus = preview.newPiece?.uid;
  // A piece's middle; the piece being placed isn't on the lot yet, so its cells are the play's.
  const mid = (uid: number): Point | null => {
    const cells = occ.cells.get(uid) ?? (uid === focus ? preview.cells : undefined);
    if (!cells?.length) return null;
    const n = cells.length;
    return {
      x: (cells.reduce((sum, c) => sum + c.x, 0) / n + 0.5) * px,
      y: (cells.reduce((sum, c) => sum + c.y, 0) / n + 0.5) * px,
    };
  };
  return (
    <svg
      class="chain-arc preview"
      width={lot.width * px}
      height={(lot.height + 1) * px}
      aria-hidden="true"
    >
      {arcs.map(({ from, to }) => {
        const a = mid(from);
        const b = mid(to);
        if (!a || !b) return null;
        const d = arcPath(a, b);
        return (
          <g key={`${from}>${to}`}>
            <path class="arc-under" d={d} />
            <path class="arc-line" d={d} />
            <circle class="arc-end" cx={b.x} cy={b.y} r={Math.max(3, px * 0.1)} />
          </g>
        );
      })}
    </svg>
  );
}
