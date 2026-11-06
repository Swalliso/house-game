// A piece's picture for the interface (M5a): its shape, each cell its floor, and its key
// furniture, from PIECE_SPRITES, the way the board draws it. Hand cards show it, and the shop's
// art slots can. It's drawn unrotated, so a card never changes size when the piece turns, at
// about 1 CSS px per art px on whole device pixels (pictureScale).

import { CONTENT, parseShape, type PieceId } from '../../rules/index.ts';
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
 * The piece's shape as little squares, for where its picture doesn't fit (a short window's
 * hand cards). One square per cell, four UI pixels across.
 */
export function ShapeGlyph({ id }: { id: PieceId }) {
  const cells = parseShape(CONTENT.pieces[id].shape);
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  return (
    <span
      class="shape-glyph"
      style={{ '--cols': String(w), '--rows': String(h) }}
      aria-hidden="true"
    >
      {cells.map((c) => (
        <span key={`${c.x},${c.y}`} style={{ gridColumn: c.x + 1, gridRow: c.y + 1 }} />
      ))}
    </span>
  );
}
