// A piece on the board, drawn as a cutaway (§12, Art): its floor sprite on every cell, walls
// on exposed edges (heavier outside, light from the top-left), one furniture sprite, and the
// piece's weekly score as a small digit in its bottom-right cell.

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Cell, PieceId } from '../../rules/index.ts';
import { FEEL } from '../fx/feel.ts';
import { PIECE_SPRITES, spriteStyle, TILE } from '../sprites.ts';
import { digitCell, furnitureSpot, isIndoor, uidAt, type Occupancy } from './geometry.ts';

const WALL_OUT = '#4a2f22';
const WALL_IN = '#8a6a52';
const HEDGE = '#3d6b35';

/** Elements of placed pieces by uid, so the director can wobble them. */
export const pieceElements = new Map<number, HTMLElement>();

export function wobble(uid: number): void {
  const el = pieceElements.get(uid);
  el?.animate(
    [
      { transform: 'scale(1)' },
      { transform: `scale(${FEEL.wobble.scale}, ${2 - FEEL.wobble.scale})` },
      { transform: `scale(${2 - FEEL.wobble.scale * 0.97}, ${FEEL.wobble.scale * 0.97})` },
      { transform: 'scale(1)' },
    ],
    { duration: FEEL.wobble.ms, easing: 'ease-out' },
  );
}

interface Props {
  defId: PieceId;
  cells: readonly Cell[];
  scale: number;
  /** For walls: who's next door. Absent for the ghost. */
  occ?: Occupancy;
  uid?: number;
  earned?: number;
  class?: string;
  style?: JSX.CSSProperties;
  settle?: number;
}

export function PieceShape({
  defId,
  cells,
  scale,
  occ,
  uid,
  earned,
  class: cls,
  style,
  settle,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const px = TILE * scale;
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x));
  const maxY = Math.max(...cells.map((c) => c.y));
  const own = new Set(cells.map((c) => `${c.x},${c.y}`));
  const indoor = isIndoor(defId);
  const sprites = PIECE_SPRITES[defId];

  useEffect(() => {
    if (uid === undefined || !ref.current) return;
    pieceElements.set(uid, ref.current);
    return () => {
      if (pieceElements.get(uid) === ref.current) pieceElements.delete(uid);
    };
  }, [uid]);

  useEffect(() => {
    if (!settle || !ref.current) return;
    ref.current.animate(
      [
        { transform: 'translateY(-6%) scale(1.06)', opacity: 0.6 },
        { transform: 'translateY(0) scale(0.98)', opacity: 1 },
        { transform: 'scale(1)' },
      ],
      { duration: FEEL.placeMs, easing: 'ease-out' },
    );
  }, [settle]);

  const edge = (c: Cell, dx: number, dy: number) => {
    if (own.has(`${c.x + dx},${c.y + dy}`)) return null;
    if (!indoor) return 'hedge';
    if (!occ) return 'out';
    const other = uidAt(occ, c.x + dx, c.y + dy);
    const p = other ? occ.byUid.get(other) : undefined;
    return p && isIndoor(p.defId) ? 'in' : 'out';
  };

  const shadows = (c: Cell) => {
    const out: string[] = [];
    const sides: [number, number, string][] = [
      [0, -1, 'top'],
      [-1, 0, 'left'],
      [0, 1, 'bottom'],
      [1, 0, 'right'],
    ];
    for (const [dx, dy, side] of sides) {
      const kind = edge(c, dx, dy);
      if (!kind) continue;
      // Interior walls draw on the top and left only, so a shared wall isn't doubled.
      if (kind === 'in' && (side === 'bottom' || side === 'right')) continue;
      const heavy = side === 'bottom' || side === 'right';
      const t = (kind === 'out' ? (heavy ? 3 : 2) : 1) * scale;
      const color = kind === 'out' ? WALL_OUT : kind === 'in' ? WALL_IN : HEDGE;
      const w = kind === 'hedge' ? scale : t;
      const [x, y] =
        side === 'top' ? [0, w] : side === 'bottom' ? [0, -w] : side === 'left' ? [w, 0] : [-w, 0];
      out.push(`inset ${x}px ${y}px 0 0 ${color}`);
    }
    return out.join(', ');
  };

  const spot = furnitureSpot(cells);
  const digit = digitCell(cells);

  return (
    <div
      ref={ref}
      class={`piece ${indoor ? 'indoor' : 'yard'} ${cls ?? ''}`}
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
            boxShadow: shadows(c),
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
      {earned !== undefined && (
        <div
          class={`digit ${earned === 0 ? 'zero' : ''}`}
          style={{
            left: `${(digit.x - minX + 1) * px}px`,
            top: `${(digit.y - minY + 1) * px}px`,
            fontSize: `${Math.max(11, 5 * scale)}px`,
          }}
        >
          {earned}
        </div>
      )}
    </div>
  );
}
