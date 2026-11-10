/**
 * The board's layers, bottom to top (D-097). Every element on the board takes its
 * z-index from here, so the lot, the house, and the interface add layers without
 * colliding. TypeScript uses LAYER directly; CSS reads the same numbers as
 * `var(--z-<name>)`, which the board element sets from layerVars().
 *
 * In a top-down 3/4 view, things further south are in front, so a layer that
 * draws above its own cells (tall furniture, tree tops) sits above everything
 * it can overlap. Inside the items and overhang layers, each piece's container
 * orders itself by its bottom row, and inside the labels layer the badges sit
 * over the digits.
 */
export const LAYER = {
  /**
   * Grass, the woods' floor and tree bases, the Trees' shade, rocks, the finds, the street and
   * the road (canvas). It shares a stacking group (`.ground`) with the water.
   */
  terrain: 0,
  /** Animated water over the water's bounding box (canvas), inside the terrain's group. */
  water: 1,
  /**
   * The yard's ground and curb cuts, the house's shadow, doormats, room floors, north wall
   * faces and floor shadows (canvas).
   */
  floor: 2,
  /** The front and back yard tint (SVG). */
  yardTint: 3,
  /** One DOM container per piece: furniture, props, fixtures. */
  items: 4,
  /** Wall bands, door gaps, window glass, garage rails, the painted fixtures (canvas). */
  walls: 5,
  /** Tall items above their own footprint: furniture over the north wall, outbuilding roofs. */
  overhang: 6,
  /** Kept for a roof over the house (D-097). Nothing draws here since D-147 took the roof out. */
  roof: 7,
  /** Tree tops above their own cells, over the lot and the row above it (canvas). */
  canopy: 8,
  /** The tally's active piece, a held set's and the preview's sets, each piece's flash (SVG). */
  highlights: 9,
  /** Digits, fixture and unmet badges, the street's label. */
  labels: 10,
  /** Demolish, install, and tool targets. */
  targets: 11,
  /** The piece being placed. */
  ghost: 12,
  /** The placement preview's per-piece badges. */
  badges: 13,
  /** The ghost's score change and its reason. */
  ghostText: 14,
  /** Tally popups. */
  popups: 15,
} as const;

export type LayerName = keyof typeof LAYER;

/** The board element's CSS custom properties: `--z-terrain: 0`, and so on. */
export function layerVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, z] of Object.entries(LAYER)) vars[`--z-${kebab(name)}`] = String(z);
  return vars;
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
