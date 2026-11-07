// LimeZu's palette (D-097): the colors of Modern Exteriors' Palette.png, which its sheets are drawn
// in. Our own drawings (drawings.ts) and the fixtures and walls we paint (house-paint.ts, yard.ts)
// use only these, so they sit with LimeZu's art. Light and shade laid over the art as blends (the
// house's and the floor's shadows, a Skylight's sun, the Chandelier's and Garden Lights' glow, a
// ground piece's darker edge) aren't colors of their own, so they're not held to it.

/** The palette's 174 colors, as lowercase hex without the #, in the sheet's order. */
export const LIMEZU_PALETTE: ReadonlySet<string> = new Set(
  `
  c4d7e3 e2f2f3 cce6ec bad2e0 a4bbd5 8fa1c8 738ca8 f0efde 89bcc6 eee1b7 f8f8f8 ebe4f2
  d8d0e0 c6bdd5 b2aecb 989ebe 8b8bab 73b8c6 d0cea0 e0d0b2 dad4e0 74aabf b1bac8 9da3b7
  7d7f99 6c6e85 565972 46465e 3a3a50 d0be9c 6499ba ccc890 b99e86 cac3d5 968bab 887ca4
  76689e 54467f 5085b4 b18a74 416095 c8c27e b8b5cb defff7 b7ffee 95e3e3 50a7e8 4995e3
  4280dd 3d56d2 787dbf 2d4275 b0b0a0 bda766 a2a6be 689183 588278 46756a 32675a b8d040
  9bc246 64b63b 568d61 4e6e61 455c5b b48f54 60b08f 63a650 fefcfe 74b453 529760 538261
  465e62 5ea592 ac7949 49a92f d4dee6 d8dde1 f1ffe6 d8ffb7 ace89b 2da233 b9c3d5 acafbf
  539b8f 7e6151 21983d 838897 fff59a ffe57b f8d239 f2b22b ed931e 66451e 381a08 49928f
  5c4a44 268b49 f8c7cf b2977e ab9078 a17f6c 8e595c 845156 6b383b 367f82 17704b 2e7177
  1f614f eea5b8 ff8575 fc5c46 e63f38 d93232 cb2a2a a82b2d 9e2b2d 2a575b 1a5249 e88dad
  ffa0a0 e07070 d56868 b95d72 b05469 a82b52 9e2b4f d6cab3 d6779d f2bd7a a9764f 916e41
  6b4c2c cbbead c3ac90 94566f b29638 974d9e 7758ab 564d9e a7604a c2b3a6 b69c85 a14f44
  ab9a8f 8a7a77 f1ce8e e0b870 daa463 c78c59 c18452 b5754d a85f46 978786 7c6e6f 943c3f
  d9a16a ca8854 b35e3f ae5539 ab4a36 a13a30 877c7d 716467 9c786b 916662 7d3846 887044
  7b5b3a 6b4b30 63412f 573c2c 7b6e71 5e5051
`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * The colors of Modern Interiors' palette (palette_interiors.png) that Modern Exteriors' lacks,
 * and one its sheets use that neither palette file lists (6b5052, the Room_Builder's and the
 * furniture's deep wood). With LIMEZU_PALETTE, every color LimeZu draws in: the interface's own
 * drawings (theme/art.ts) keep to these.
 */
export const LIMEZU_INTERIORS_EXTRA: ReadonlySet<string> = new Set(
  `
  1652b9 4c4e8f 616355 645d9a 787b69 8d9580 91a5cf 949a8e a2a6a0 a7afa5 c56b9a fdfcfd
  6b5052
`
    .split(/\s+/)
    .filter(Boolean),
);

/** Whether a #rrggbb color is one LimeZu draws in, in either pack. */
export function isLimeZuColor(hex: string): boolean {
  const c = hex.replace('#', '').toLowerCase();
  return LIMEZU_PALETTE.has(c) || LIMEZU_INTERIORS_EXTRA.has(c);
}

/** Whether an RGB color is one of LimeZu's. */
export function inPalette(rgb: readonly number[]): boolean {
  const hex = rgb.slice(0, 3).map((v) => v.toString(16).padStart(2, '0'));
  return LIMEZU_PALETTE.has(hex.join(''));
}
