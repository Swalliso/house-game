// The interface's frames (M5a), drawn for Open House in LimeZu's palette (art.ts has the key).
// Each is a 9-slice for border-image: `slice` is the border in art px (top, right, bottom,
// left), and kit.css sets border-image-width to the same numbers of --px. The middle is
// transparent: a frame's fill is its element's own background, clipped to the padding box, so
// variants recolor it freely.
//
// Light comes from the top left, as in LimeZu's art: lit edges are on the top and left.

export interface Frame {
  readonly grid: string;
  readonly slice: readonly [top: number, right: number, bottom: number, left: number];
}

export const FRAMES = {
  /** The wood panel: an ink outline with notched corners, a beveled molding, a dark inner line. */
  wood: {
    slice: [5, 5, 5, 5],
    grid: `
      .kkkkkkkkkkk.
      kHHHHHHHHHHdk
      kHhhhhhhhhmdk
      kHhllllllomdk
      kHhleeeeeomdk
      kHhle...eomdk
      kHhle...eomdk
      kHhle...eomdk
      kHhleeeeeomdk
      kHhooooooomdk
      kHmmmmmmmmmdk
      kdddddddddddk
      .kkkkkkkkkkk.
    `,
  },
  /** One UI pixel of ink with notched corners: cards, chips, plaques, slots, buttons. */
  ring: {
    slice: [1, 1, 1, 1],
    grid: `
      .k.
      k.k
      .k.
    `,
  },
  /** The ring in a softer ink, for empty wells and disabled things. */
  ringSoft: {
    slice: [1, 1, 1, 1],
    grid: `
      .f.
      f.f
      .f.
    `,
  },
  /** A dark beam's ring, on wood. */
  ringWood: {
    slice: [1, 1, 1, 1],
    grid: `
      .e.
      e.e
      .e.
    `,
  },
} as const satisfies Record<string, Frame>;

/** Patterns, repeated as backgrounds. */
export const PATTERNS = {
  /**
   * The plank behind a panel's title: wood with a little grain, repeated both ways so a title
   * of any height reads as one board. Its lit top and dark bottom edges are box-shadows.
   */
  plank: `
    hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
    hhhhhhhhhhhhhllllllhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
    hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhllllhhhhhhh
    hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
    hhhhllllhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
    hhhhhhhhhhhhhhhhhhhhhhhhhllllllhhhhhhhhhhhhhhhhh
    hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
    hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhllllhhh
    hhhhhhhhhhhllllhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
    hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
  `,
} as const;

/**
 * Small pieces drawn onto the chrome, each one image: a milestone ribbon's tails (the left one;
 * the right one is the same, mirrored) and a tooltip's tail (pointing down; flipped when the
 * note sits below its term).
 */
export const PARTS = {
  /** A ribbon's tail, behind a gold banner: a notched end. */
  ribbonGold: `
    kkkkkkkkkkkkkk
    kYYYYYYYYYYYYk
    .kYYYYYYYYYYYk
    ..kYYYYYYYYYYk
    ...kYYYYYYYYYk
    ....kYYYYYYYYk
    ...kYYYYYYYYYk
    ..kYYYYYYYYYYk
    .kYYYYYYYYYYYk
    kYYYYYYYYYYYYk
    kkkkkkkkkkkkkk
  `,
  /** The same tail, behind an orange banner (a missed milestone, overtime). */
  ribbonOrange: `
    kkkkkkkkkkkkkk
    kNNNNNNNNNNNNk
    .kNNNNNNNNNNNk
    ..kNNNNNNNNNNk
    ...kNNNNNNNNNk
    ....kNNNNNNNNk
    ...kNNNNNNNNNk
    ..kNNNNNNNNNNk
    .kNNNNNNNNNNNk
    kNNNNNNNNNNNNk
    kkkkkkkkkkkkkk
  `,
  /** A tooltip's tail: its top row is the note's bottom edge, opened up. */
  tipTail: `
    kPPPPPPPk
    .kPPPPPk.
    ..kPPPk..
    ...kPk...
    ....k....
  `,
} as const;
