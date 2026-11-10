// The lot's own shade (D-120): the sun shines from one edge of the lot, and a tile a Tree or the
// Old Shed stands in front of, toward the sun, is in its shade. The rules read the same tiles
// (layout.ts): a room whose sunny wall has a Tree in front isn't Sunny there. Painted on the
// terrain canvas, so it changes only with the lot (a Tree cleared for a piece takes its shade
// with it); the house's own shade, which moves with every piece, isn't drawn here.

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

/** Paints the shade on `tiles`, darker by what casts it: toward the lot's sun. */
export function paintShade(
  ctx: CanvasRenderingContext2D,
  lot: Lot,
  tiles: readonly { x: number; y: number }[],
): void {
  const [dx, dy] = SUN_STEP[lot.sun];
  const { near } = LOT_SHADE;
  const far = CELL - near;
  ctx.save();
  ctx.fillStyle = LOT_SHADE.rgb;
  for (const t of tiles) {
    const x = t.x * CELL;
    const y = t.y * CELL;
    // The near part: the side toward the sun, where the Tree or the Old Shed stands.
    const nearRect =
      dy < 0
        ? [x, y, CELL, near]
        : dy > 0
          ? [x, y + far, CELL, near]
          : dx < 0
            ? [x, y, near, CELL]
            : [x + far, y, near, CELL];
    const farRect =
      dy < 0
        ? [x, y + near, CELL, far]
        : dy > 0
          ? [x, y, CELL, far]
          : dx < 0
            ? [x + near, y, far, CELL]
            : [x, y, far, CELL];
    ctx.globalAlpha = LOT_SHADE.alpha;
    ctx.fillRect(nearRect[0]!, nearRect[1]!, nearRect[2]!, nearRect[3]!);
    ctx.globalAlpha = LOT_SHADE.farAlpha;
    ctx.fillRect(farRect[0]!, farRect[1]!, farRect[2]!, farRect[3]!);
  }
  ctx.restore();
}
