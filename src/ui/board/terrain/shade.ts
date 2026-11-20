// The lot's own shade (D-120): the sun shines from one edge of the lot, and a tile a Tree or the
// Old Shed stands in front of, toward the sun, is in its shade. The rules read the same tiles
// (layout.ts): a room whose sunny wall has a Tree in front isn't Sunny there. Painted on the
// terrain canvas, so it changes only with the lot (a Tree cleared for a piece takes its shade
// with it); the house's own shade, which moves with every piece, isn't drawn here. D-190: a
// run of shaded tiles ends in rounded corners on its far side, so it reads as a shadow and not
// as a row of squares; every shaded tile still shades all of its width.

import { SUN_STEP, terrainAt, type Lot } from '../../../rules/index.ts';
import { CELL } from '../../sprites.ts';

/**
 * LimeZu's ink, the grass's shadow color, at a soft strength: shade, not night. Two steps (pixel
 * light, not a smooth ramp): `alpha` over the `near` art px by what casts it, `farAlpha` beyond.
 */
export const LOT_SHADE = { rgb: '#3a3a50', alpha: 0.2, farAlpha: 0.1, near: 20 } as const;

/**
 * The tiles the lot's Trees and the Old Shed shade, in reading order: not their own tiles, which
 * their sprites cover.
 */
export function lotShade(lot: Lot): { x: number; y: number }[] {
  const [dx, dy] = SUN_STEP[lot.sun];
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      const own = terrainAt(lot, x, y);
      if (own === 'tree' || own === 'oldShed') continue;
      const t = terrainAt(lot, x + dx, y + dy);
      if (t === 'tree' || t === 'oldShed') out.push({ x, y });
    }
  }
  return out;
}

/** D-190: the radius, in art px, of the round corners on a run of shade's far side, at its ends. */
export const SHADE_ROUND = 12;

/**
 * How far in from a run's open end a row of shade starts, `depth` art px in from its far edge:
 * a quarter circle of SHADE_ROUND, so the run's far corners are round.
 */
export function shadeInset(depth: number): number {
  if (depth >= SHADE_ROUND) return 0;
  const r = SHADE_ROUND;
  const d = r - depth - 0.5;
  return r - Math.floor(Math.sqrt(r * r - d * d));
}

/**
 * Paints the shade on `tiles`, darker by what casts it: toward the lot's sun. Each tile is drawn
 * a row of art px at a time across the run (the way the shade runs beside a wood), so a tile at
 * the end of a run, with no shade beyond it, rounds its far corner (D-190).
 */
export function paintShade(
  ctx: CanvasRenderingContext2D,
  lot: Lot,
  tiles: readonly { x: number; y: number }[],
): void {
  const [dx, dy] = SUN_STEP[lot.sun];
  const { near } = LOT_SHADE;
  const shaded = new Set(tiles.map((t) => `${t.x},${t.y}`));
  // The run goes across the sun's line: east–west when the sun is at the top or the bottom.
  const [ax, ay] = dy !== 0 ? [1, 0] : [0, 1];
  ctx.save();
  ctx.fillStyle = LOT_SHADE.rgb;
  for (const t of tiles) {
    const startOpen = !shaded.has(`${t.x - ax},${t.y - ay}`);
    const endOpen = !shaded.has(`${t.x + ax},${t.y + ay}`);
    // Row k is k art px from the side toward the sun, where the Tree or the Old Shed stands.
    for (let k = 0; k < CELL; k++) {
      const depth = CELL - 1 - k;
      const from = startOpen ? shadeInset(depth) : 0;
      const to = CELL - (endOpen ? shadeInset(depth) : 0);
      if (to <= from) continue;
      ctx.globalAlpha = k < near ? LOT_SHADE.alpha : LOT_SHADE.farAlpha;
      // The row's place in the tile, and its run from `from` to `to` across it.
      const along = dy < 0 || dx < 0 ? k : CELL - 1 - k;
      if (dy !== 0) ctx.fillRect(t.x * CELL + from, t.y * CELL + along, to - from, 1);
      else ctx.fillRect(t.x * CELL + along, t.y * CELL + from, 1, to - from);
    }
  }
  ctx.restore();
}
