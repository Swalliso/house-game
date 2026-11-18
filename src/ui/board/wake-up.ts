// The Doghouse wakes up (D-179): when its requirement becomes met (a Fence closes its yard), its
// dog is let off its lead, with a wobble and a bark. The rules send no event for a requirement
// met, so the board notices it between house changes, as it notices the car's new spot
// (HouseLayers.tsx useCarSlide): it keeps which Doghouses it last showed on their lead, and one
// that's still there and isn't on its lead any more has woken up. Pure, so the tests can say
// when it fires: never on a load, a new run, or for a Doghouse placed straight into a fenced
// yard, which is simply awake.

import type { HouseState, PieceId } from '../../rules/index.ts';

/** The pieces drawn asleep while their requirement isn't met (yard.ts): the Doghouse. */
const WAKES: ReadonlySet<PieceId> = new Set(['doghouse']);

/** What the board last showed: the run it was (its setup, by identity), and who was asleep. */
export interface Seen {
  readonly run: object;
  readonly asleep: ReadonlySet<number>;
}

/** The pieces asleep in `house`: Doghouses whose requirement isn't met (yard.ts unmetOf). */
export function asleepIn(house: HouseState, unmet: ReadonlySet<number>): ReadonlySet<number> {
  return new Set(
    house.pieces.flatMap((p) => (WAKES.has(p.defId) && unmet.has(p.uid) ? [p.uid] : [])),
  );
}

/**
 * The pieces that woke up since `before`, in uid order: asleep then, and still here and awake
 * now, in the same run. A first look (no `before`), another run (a new one, or one loaded), a
 * piece placed straight into a fenced yard and one demolished wake nobody.
 */
export function wokenUp(
  before: Seen | null,
  run: object,
  house: HouseState,
  unmet: ReadonlySet<number>,
): number[] {
  if (!before || before.run !== run) return [];
  return house.pieces
    .filter((p) => WAKES.has(p.defId) && before.asleep.has(p.uid) && !unmet.has(p.uid))
    .map((p) => p.uid)
    .sort((a, b) => a - b);
}
