// A piece's picture for the interface (M5a): the piece as the board builds it, drawn by the
// house's own painters (HouseLayers.tsx pieceArtPlan, as for the ghost): a room's floor,
// furniture and outline walls, or a yard piece's ground and props. Hand cards show it, and so do
// the shop's art slots and How to play's sets. It's drawn unrotated, so a card never changes
// size when the piece turns, at about 1 CSS px per art px on whole device pixels (pictureScale).
// The picked card's turn shows on its ShapeGlyph instead.

import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { CONTENT, shapeCells, type PieceId, type Rot } from '../../rules/index.ts';
import { isIndoor } from '../board/geometry.ts';
import { paintPieceArt, pieceArtPlan } from '../board/HouseLayers.tsx';
import { devicePixelRatio, pictureScale } from '../theme/pixel.ts';

export function PieceArt({ id, class: cls }: { id: PieceId; class?: string }) {
  const scale = pictureScale(devicePixelRatio.value);
  const plan = useMemo(() => pieceArtPlan(id, 0), [id]);
  const ref = useRef<HTMLCanvasElement>(null);
  // Before the browser paints, so the picture is never seen blank.
  useLayoutEffect(() => paintPieceArt(ref.current, plan), [plan]);
  const { frame } = plan;
  const size = { width: `${frame.w * scale}px`, height: `${frame.h * scale}px` };
  return (
    <span
      class={`piece-art ${isIndoor(id) ? 'indoor' : 'yard'} ${cls ?? ''}`}
      style={size}
      aria-hidden="true"
    >
      <canvas ref={ref} width={frame.w} height={frame.h} style={size} />
    </span>
  );
}

/**
 * The piece's shape as little squares, turned `rot` quarter turns: a short window's cards show
 * it in place of the picture, and the picked hand card shows it turning as you rotate. A
 * `square` glyph is centered in a box as long as the shape, so turning it never changes the
 * card's size. Squares are three UI pixels across with a pixel between them, smaller for a
 * long shape, so the box is never taller than a keycap (12 UI pixels).
 */
export function ShapeGlyph({
  id,
  rot = 0,
  square = false,
}: {
  id: PieceId;
  rot?: Rot;
  square?: boolean;
}) {
  const shape = CONTENT.pieces[id].shape;
  const cells = shapeCells(shape, rot);
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  const long = Math.max(w, h);
  const cols = square ? long : w;
  const rows = square ? long : h;
  const dx = Math.floor((cols - w) / 2);
  const dy = Math.floor((rows - h) / 2);
  const cell = long <= 3 ? 3 : 2;
  const gap = long <= 4 ? 1 : 0;
  return (
    <span
      class="shape-glyph"
      style={{
        '--cols': String(cols),
        '--rows': String(rows),
        '--cell': String(cell),
        '--gap': String(gap),
      }}
      aria-hidden="true"
    >
      {cells.map((c) => (
        <span key={`${c.x},${c.y}`} style={{ gridColumn: c.x + dx + 1, gridRow: c.y + dy + 1 }} />
      ))}
    </span>
  );
}
