// Your houses on the street (D-156): the houses this browser has finished stand on the plots
// around the lot, beside it on the same street and across the road (neighbors.ts says which
// where), each as the picture filed with it when its run ended (company.ts Plot): the house alone,
// dimmed into the garden's light, at art resolution, so at every zoom step it's as crisp as the
// lot (D-097). Until there are houses enough, LimeZu's own houses stand on the nearest plots.
//
// The street is fixed for the run: the record as it stood when the run began (the house this
// run files at its end moves in for the next one). It sits under the ground's group, so the road
// running on past the lot's edges paints over a shadow reaching the sidewalk, in a box the size
// of the view's reach around the board that clips, so a house never makes the view scroll
// further. It never takes the pointer: the board finds the house under it (Board.tsx), and
// Inspect says whose it is and offers to play its lot again.

import { signal } from '@preact/signals';
import type { Lot } from '../../rules/index.ts';
import { company, jobKey } from '../company.ts';
import { FxSprite } from '../fx/Drive.tsx';
import { CELL, spritePos, type SpriteId } from '../sprites.ts';
import { heldNeighbor } from '../store.ts';
import { boardRows } from './geometry.ts';
import { neighbors, type Filler, type Neighbor } from './neighbors.ts';
import { waterSlices } from './terrain/outside.ts';
import type { Around } from './TerrainLayer.tsx';
import './neighbors.css';

/** LimeZu's own houses, for the plots yours don't stand on yet (art/limezu/neighbors.json). */
const FILLERS: readonly SpriteId[] = ['neighbor-country', 'neighbor-modern', 'neighbor-japanese'];

/** Whether a key on the street is one of LimeZu's houses rather than one of yours. */
export const isFiller = (key: string): boolean => (FILLERS as readonly string[]).includes(key);

/** The house on the street under the pointer, by key: lit up (neighbors.css), as a held one is. */
export const hoveredNeighbor = signal<string | null>(null);

/**
 * The street around a run's lot: the record's houses that kept a plot, newest first, less any
 * built on this lot (a lot played again doesn't stand next door to itself).
 */
export function streetFor(seed: string, lot: Lot): Neighbor[] {
  const houses = company
    .peek()
    .jobs.flatMap((j) => (j.plot && j.seed !== seed ? [{ key: jobKey(j), plot: j.plot }] : []));
  const fillers: Filler[] = FILLERS.map((sprite) => {
    const { w, h } = spritePos(sprite);
    return { sprite, w, h };
  });
  return neighbors(houses, fillers, lot, seed, waterSlices(lot));
}

export function NeighborsLayer({
  street,
  lot,
  scale,
  around,
}: {
  street: readonly Neighbor[];
  lot: Lot;
  scale: number;
  around: Around;
}) {
  if (street.length === 0) return null;
  const px = CELL * scale;
  const lit = new Set([hoveredNeighbor.value, heldNeighbor.value]);
  return (
    <div
      class="neighbors"
      aria-hidden="true"
      style={{
        left: `${-around.left}px`,
        top: `${-around.top}px`,
        width: `${lot.width * px + around.left + around.right}px`,
        height: `${around.top + boardRows(lot.height) * px + around.bottom}px`,
      }}
    >
      {street.map((n) => {
        const at = { left: `${around.left + n.x * scale}px`, top: `${around.top + n.y * scale}px` };
        const cls = lit.has(n.key) ? 'neighbor hover' : 'neighbor';
        return 'src' in n.look ? (
          <img
            key={n.key}
            class={cls}
            src={n.look.src}
            alt=""
            draggable={false}
            style={{ ...at, width: `${n.w * scale}px`, height: `${n.h * scale}px` }}
          />
        ) : (
          <FxSprite
            key={n.key}
            id={n.look.sprite as SpriteId}
            scale={scale}
            class={`${cls} filler`}
            style={at}
          />
        );
      })}
    </div>
  );
}
