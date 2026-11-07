// A piece's picture for the interface (M5a): its shape, each cell its floor, and its key
// furniture, from PIECE_SPRITES, the way the board draws it. Hand cards show it, and the shop's
// art slots can. It's drawn unrotated, so a card never changes size when the piece turns, at
// about 1 CSS px per art px on whole device pixels (pictureScale). The picked card's turn shows
// on its ShapeGlyph instead.

import { CONTENT, parseShape, shapeCells, type PieceId, type Rot } from '../../rules/index.ts';
import { furnitureSpot, isIndoor } from '../board/geometry.ts';
import { CELL, PIECE_SPRITES, spritePos, spriteStyle } from '../sprites.ts';
import { devicePixelRatio, pictureScale } from '../theme/pixel.ts';

export function PieceArt({ id, class: cls }: { id: PieceId; class?: string }) {
  const scale = pictureScale(devicePixelRatio.value);
  const px = CELL * scale;
  const cells = parseShape(CONTENT.pieces[id].shape);
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  const own = new Set(cells.map((c) => `${c.x},${c.y}`));
  const sprites = PIECE_SPRITES[id];
  const spot = furnitureSpot(cells);
  const furniture = spritePos(sprites.furniture);
  // The piece's outline, on every edge it doesn't share with itself: a wall for a room.
  const edges = (x: number, y: number) =>
    [
      [0, -1, '0 var(--px)'],
      [0, 1, '0 calc(var(--px) * -1)'],
      [-1, 0, 'var(--px) 0'],
      [1, 0, 'calc(var(--px) * -1) 0'],
    ]
      .filter(([dx, dy]) => !own.has(`${x + Number(dx)},${y + Number(dy)}`))
      .map(([, , offset]) => `inset ${offset} 0 var(--piece-edge)`)
      .join(', ');
  return (
    <span
      class={`piece-art ${isIndoor(id) ? 'indoor' : 'yard'} ${cls ?? ''}`}
      style={{ width: `${w * px}px`, height: `${h * px}px` }}
      aria-hidden="true"
    >
      {cells.map((c) => (
        <span
          key={`${c.x},${c.y}`}
          class="piece-art-cell"
          style={{
            left: `${c.x * px}px`,
            top: `${c.y * px}px`,
            width: `${px}px`,
            height: `${px}px`,
            ...spriteStyle(sprites.floor, scale),
            boxShadow: edges(c.x, c.y) || undefined,
          }}
        />
      ))}
      <span
        class="piece-art-furniture"
        style={{
          left: `${(spot.x + 0.5) * px - (furniture.w * scale) / 2}px`,
          top: `${(spot.y + 1) * px - furniture.h * scale}px`,
          width: `${furniture.w * scale}px`,
          height: `${furniture.h * scale}px`,
          ...spriteStyle(sprites.furniture, scale),
        }}
      />
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
