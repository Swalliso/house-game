// A yard piece on the board, and the yard ghost: the placeholder look until the yard has its
// own art in the house layers (the house stage's yard part). Its floor sprite on every cell,
// a hedge line on its outside edges, and its one furniture sprite. Rooms are drawn by the
// house layers (HouseLayers.tsx); every piece's digit and badges are in the labels layer.
//
// A cell is CELL × scale CSS px. The hedge is sized in sixteenths of a cell (cellUnit).

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Cell, PieceId } from '../../rules/index.ts';
import { played } from '../fx/director.ts';
import { settings } from '../settings.ts';
import { CELL, cellUnit, PIECE_SPRITES, spriteStyle } from '../sprites.ts';
import { furnitureSpot } from './geometry.ts';
import { register, settle as settleFx } from './piece-fx.ts';

const HEDGE = '#3d6b35';

interface Props {
  defId: PieceId;
  cells: readonly Cell[];
  scale: number;
  /** A placed piece's uid, so it can wobble and settle. Absent for the ghost. */
  uid?: number;
  class?: string;
  style?: JSX.CSSProperties;
  settle?: number;
}

export function PieceShape({ defId, cells, scale, uid, class: cls, style, settle }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const px = CELL * scale;
  const unit = cellUnit(px);
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x));
  const maxY = Math.max(...cells.map((c) => c.y));
  const own = new Set(cells.map((c) => `${c.x},${c.y}`));
  const sprites = PIECE_SPRITES[defId];

  useEffect(() => {
    if (uid === undefined || !ref.current) return;
    return register(uid, 'yard', ref.current);
  }, [uid]);

  useEffect(() => {
    if (uid === undefined || !settle || settle <= played.settle || settings.value.reduceMotion)
      return;
    played.settle = settle;
    settleFx(uid);
  }, [settle]);

  /** A hedge line on each outside edge. */
  const hedge = (c: Cell) => {
    const out: string[] = [];
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [0, 1],
      [1, 0],
    ] as const) {
      if (own.has(`${c.x + dx},${c.y + dy}`)) continue;
      out.push(`inset ${-dx * unit}px ${-dy * unit}px 0 0 ${HEDGE}`);
    }
    return out.join(', ');
  };

  const spot = furnitureSpot(cells);
  return (
    <div
      ref={ref}
      class={`piece yard ${cls ?? ''}`}
      style={{
        left: `${minX * px}px`,
        top: `${minY * px}px`,
        width: `${(maxX - minX + 1) * px}px`,
        height: `${(maxY - minY + 1) * px}px`,
        ...style,
      }}
    >
      {cells.map((c) => (
        <div
          key={`${c.x},${c.y}`}
          class="cell"
          style={{
            left: `${(c.x - minX) * px}px`,
            top: `${(c.y - minY) * px}px`,
            width: `${px}px`,
            height: `${px}px`,
            ...spriteStyle(sprites.floor, scale),
            boxShadow: hedge(c),
          }}
        />
      ))}
      <div
        class="furniture"
        style={{
          left: `${(spot.x - minX) * px}px`,
          top: `${(spot.y - minY) * px}px`,
          width: `${px}px`,
          height: `${px}px`,
          ...spriteStyle(sprites.furniture, scale),
        }}
      />
    </div>
  );
}
