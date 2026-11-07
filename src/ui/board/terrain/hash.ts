/**
 * A stable per-tile variation that isn't game randomness: the same place always gets the same
 * number, so the same lot always looks the same (photos and replays depend on it). Use it for
 * anything decorative that varies by place: tufts, flowers, lily pads, tree variants. The salt
 * (seedSalt) makes each run's lot its own: without it every lot would wear the same pattern.
 */
export function tileHash(x: number, y: number, salt = 0): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A run's salt for tileHash, from its seed (FNV-1a): the same run always gets the same one, so
 * a run code or a replay shows the same lot, and two runs never share their decoration.
 */
export function seedSalt(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
