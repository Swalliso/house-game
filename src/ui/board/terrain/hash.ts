/**
 * A stable per-tile variation that isn't game randomness: the same place always gets the same
 * number, so the same lot always looks the same (photos and replays depend on it). Use it for
 * anything decorative that varies by place: tufts, flowers, lily pads, tree variants.
 */
export function tileHash(x: number, y: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
