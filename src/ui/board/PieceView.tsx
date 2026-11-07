// A piece on the board, drawn as a cutaway (§12, Art): its floor sprite on every cell, walls
// on exposed edges (heavier outside, light from the top-left), one furniture sprite, and the
// piece's weekly score as a small digit in its bottom-right cell. A piece whose requirement
// isn't met earns nothing and wears a ⚠ badge in its top-left cell; a Renovated room's stars
// go under it there, clear of the digit.

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { CONTENT, type Cell, type FixtureId, type PieceId } from '../../rules/index.ts';
import { played } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { settings } from '../settings.ts';
import { FIXTURE_GLYPHS, PIECE_SPRITES, spriteStyle, TILE } from '../sprites.ts';
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
  /** An unmet requirement, as text (PieceScore.unmet): the piece earns nothing. */
  unmet?: string;
  /** The fixture installed in it (D-050), shown as a badge. */
  fixture?: FixtureId;
  /** A Renovated room's level (M4a), shown as stars in its top-left cell. */
  level?: number;
  /** Set when the director plays this room's Renovation: its badge pops. */
  levelPop?: number;
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
  unmet,
  fixture,
  level,
  levelPop,
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
    if (!settle || settle <= played.settle || !ref.current || settings.value.reduceMotion) return;
    played.settle = settle;
    // At full opacity throughout: the pending ghost it replaces was drawn at full opacity.
    ref.current.animate(
      [
        { transform: 'translateY(-6%) scale(1.06)' },
        { transform: 'translateY(0) scale(0.98)' },
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
  const shown = unmet ? 0 : earned;
  const first = unmet ? [...cells].sort((a, b) => a.y - b.y || a.x - b.x)[0]! : null;

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
      {shown !== undefined && (
        <div
          class={`digit ${shown === 0 ? 'zero' : ''}`}
          style={{
            left: `${(digit.x - minX + 1) * px}px`,
            top: `${(digit.y - minY + 1) * px}px`,
            fontSize: `${Math.max(11, 5 * scale)}px`,
          }}
        >
          {shown}
        </div>
      )}
      {fixture && <FixtureBadge id={fixture} cells={cells} minX={minX} minY={minY} scale={scale} />}
      {!!level && (
        <LevelBadge
          level={level}
          pop={levelPop}
          cells={cells}
          minX={minX}
          minY={minY}
          scale={scale}
          unmet={!!first}
          fixture={!!fixture}
        />
      )}
      {first && (
        <div
          class="unmet-badge"
          title={`Earns nothing: it must be ${unmet}`}
          aria-label={`Earns nothing: it must be ${unmet}`}
          style={{
            left: `${(first.x - minX) * px + inset(scale)}px`,
            top: `${(first.y - minY) * px + inset(scale)}px`,
            fontSize: `${unmetFont(scale)}px`,
          }}
        >
          {'\u26A0\uFE0E'}
        </div>
      )}
    </div>
  );
}

// The corner badges' sizes in CSS px at a scale, so one can sit clear of another.
/** How far a badge sits in from its cell's edges, and the gap between two stacked badges. */
const inset = (scale: number) => Math.max(1, scale);
const unmetFont = (scale: number) => Math.max(11, 4.5 * scale);
/** The ⚠ badge's height: its font at line-height 1, a px of padding and of border each side. */
const unmetHeight = (scale: number) => unmetFont(scale) + 4;
const fixtureSize = (scale: number) => Math.max(14, 6 * scale);

/**
 * A Renovated room's level (M4a): a star per level in its top-left cell (the top row's
 * leftmost), under the ⚠ badge there, and under the fixture's if the top row is that one cell.
 * The corner digit sits in the bottom row's rightmost cell, so they never meet in a bigger room.
 */
function LevelBadge({
  level,
  pop,
  cells,
  minX,
  minY,
  scale,
  unmet,
  fixture,
}: {
  level: number;
  /** The director's id when this room was just renovated: the badge pops once per id. */
  pop?: number;
  cells: readonly Cell[];
  minX: number;
  minY: number;
  scale: number;
  /** The room shows the ⚠ badge (an unmet requirement), in the same corner. */
  unmet: boolean;
  /** The room shows a fixture's badge, in its top row's rightmost cell. */
  fixture: boolean;
}) {
  const px = TILE * scale;
  const ref = useRef<HTMLDivElement>(null);
  const top = Math.min(...cells.map((c) => c.y));
  const row = cells.filter((c) => c.y === top);
  const left = Math.min(...row.map((c) => c.x));
  const size = Math.max(12, 5 * scale);
  const above = Math.max(
    unmet ? unmetHeight(scale) : 0,
    fixture && row.length === 1 ? fixtureSize(scale) : 0,
  );
  const y = (top - minY) * px + inset(scale) + (above > 0 ? above + inset(scale) : 0);
  useEffect(() => {
    if (!pop || pop <= played.levelPop || !ref.current || settings.value.reduceMotion) return;
    played.levelPop = pop;
    ref.current.animate(
      [
        { transform: `scale(${FEEL.levelPop.scale})` },
        { transform: 'scale(0.9)' },
        { transform: 'scale(1)' },
      ],
      { duration: FEEL.levelPop.ms, easing: 'ease-out' },
    );
  }, [pop]);
  return (
    <div
      ref={ref}
      class="level-badge"
      title={`Renovated: level ${level}`}
      aria-label={`Renovated, level ${level}`}
      style={{
        left: `${(left - minX) * px + inset(scale)}px`,
        top: `${y}px`,
        height: `${size}px`,
        fontSize: `${Math.max(10, 4 * scale)}px`,
      }}
    >
      {'★'.repeat(level)}
    </div>
  );
}

/** A fixture's badge in the piece's top-right cell, with its rarity's edge. */
function FixtureBadge({
  id,
  cells,
  minX,
  minY,
  scale,
}: {
  id: FixtureId;
  cells: readonly Cell[];
  minX: number;
  minY: number;
  scale: number;
}) {
  const px = TILE * scale;
  const def = CONTENT.fixtures[id];
  // The top row's rightmost cell.
  const top = Math.min(...cells.map((c) => c.y));
  const right = Math.max(...cells.filter((c) => c.y === top).map((c) => c.x));
  const size = fixtureSize(scale);
  return (
    <div
      class={`fixture-badge rarity-${def.rarity}`}
      title={`${def.name} (fixture)`}
      aria-label={`${def.name} installed`}
      style={{
        left: `${(right - minX + 1) * px - size - inset(scale)}px`,
        top: `${(top - minY) * px + inset(scale)}px`,
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size * 0.72)}px`,
      }}
    >
      {FIXTURE_GLYPHS[id]}
    </div>
  );
}
