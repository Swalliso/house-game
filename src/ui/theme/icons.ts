// The interface's icons (M5a), drawn for Open House in LimeZu's palette (art.ts has the key):
// an ink outline, light from the top left. One art px is one UI pixel (--px), so an 8×8 icon
// stands as tall as Pixel Operator 8's capitals plus one, and sits in a line of body text.
// Button icons are 12×12. Icons stand in for the symbols the pixel fonts lack (▲ ▼ ✕ ★ ✦ ⚠)
// and for the old text glyphs.

export const ICONS = {
  // --- The score and the budget ------------------------------------------------------------
  /** Budget: a gold coin. */
  coin: `
    ..kkkk..
    .kuyyyk.
    kuyyyyYk
    kyyYyyYk
    kyyYyyYk
    kyyyyYYk
    .kYYYYk.
    ..kkkk..
  `,
  /** Comfort (points): an armchair in Comfort's blue. */
  comfort: `
    .kkkkkk.
    .kBBBBk.
    kkBBBBkk
    kBkkkkBk
    kBbbbbBk
    kkbbbbkk
    .kkkkkk.
    .k....k.
  `,
  /** Charm (+Mult): a prize rosette in Charm's rose. */
  charm: `
    ..kkkk..
    .kqRRqk.
    kqRrrRqk
    kqRrrRqk
    .kqRRqk.
    ..krrk..
    .krkkrk.
    .kk..kk.
  `,
  /** Sparkle (×Mult): a gold twinkle. */
  sparkle: `
    ....k....
    ...kuk...
    ...kyk...
    .kkuyYkk.
    kuyyyyyYk
    .kkyYYkk.
    ...kYk...
    ...kYk...
    ....k....
  `,
  // --- Marks ---------------------------------------------------------------------------------
  /** A rise (good, with Comfort's blue): ▲. */
  up: `
    ...k...
    ..kjk..
    .kjjjk.
    kjjjjjk
    kkkkkkk
  `,
  /** A fall (bad, in orange): ▼. */
  down: `
    kkkkkkk
    knnnnnk
    .knnnk.
    ..knk..
    ...k...
  `,
  /** ✕: can't, or lost. */
  cross: `
    kk...kk
    kkk.kkk
    .kkkkk.
    ..kkk..
    .kkkkk.
    kkk.kkk
    kk...kk
  `,
  /** ★: a set completed, a find. */
  star: `
    ....k....
    ...kuk...
    kkkkuykkk
    kuuuyyyYk
    .kyyyyYk.
    ..kyyYk..
    .kyYkYYk.
    .kYk.kYk.
    .kk...kk.
  `,
  /** ⚠: an unmet requirement. */
  warn: `
    ....k....
    ...kyk...
    ...kyk...
    ..kykyk..
    ..kykyk..
    .kyykyyk.
    .kyyyyyk.
    kyyykyyyk
    kkkkkkkkk
  `,
  /** An overtime week: a clock. */
  clock: `
    ..kkkk..
    .kwwwwk.
    kwwkwwwk
    kwwkwwwk
    kwwkkkwk
    kwwwwwwk
    .kwwwwk.
    ..kkkk..
  `,
  /** The milestone's target: a pennant. */
  flag: `
    kk........
    kkkkkkk...
    kkxxxxxkk.
    kkxxxxxxxk
    kkXXxxxkk.
    kkkkkkk...
    kk........
    kk........
    kk........
    kk........
    kk........
    kkkk......
  `,
  // --- Tags (12) -----------------------------------------------------------------------------
  Quiet: `
    kkkkkkk.
    kzzzzzk.
    kkkkzkk.
    ..kzk...
    .kzkkkk.
    kzzzzzk.
    kkkkkkk.
  `,
  Loud: `
    ....k...
    ...kk..k
    kkkgk.k.
    kGGgk.k.
    kGGgk.k.
    kkkgk.k.
    ...kk..k
    ....k...
  `,
  Social: `
    .kkkkkkk.
    kwwwwwwwk
    kwkwkwkwk
    kwwwwwwwk
    .kkwkkkk.
    ..kk.....
  `,
  Wet: `
    ...k....
    ..kBk...
    ..kBk...
    .kCBBk..
    kCBBBbk.
    kBBBBbk.
    .kbbbk..
    ..kkk...
  `,
  Sunny: `
    ....k....
    .k..k..k.
    ..kkkkk..
    ..kuuyk..
    kkkuyykkk
    ..kyyYk..
    ..kkkkk..
    .k..k..k.
    ....k....
  `,
  Outdoor: `
    ..kkkk..
    .kvvAvk.
    kvvvvAvk
    kVvvvvvk
    .kVVVVk.
    ..kkkk..
    ...ke...
    ..kkkk..
  `,
  Green: `
    .....kkk
    ...kkAAk
    ..kAAvvk
    .kAvvvVk
    .kvvvVk.
    kkvVVk..
    k.kkk...
  `,
  Kid: `
    ..kkkk..
    .kxxwwk.
    kxxxwwbk
    kxxxwbbk
    kwwwbbbk
    kwwbbbbk
    .kbbbbk.
    ..kkkk..
  `,
  Pet: `
    ..........
    .kk....kk.
    kwwkkkkwwk
    .kwwwwwwk.
    kwwkkkkwwk
    .kk....kk.
    ..........
  `,
  Pretty: `
    ...kk...
    ..kqqk..
    .kkqqkk.
    kqqyyqqk
    kqqyyqqk
    .kkqqkk.
    ..kqqk..
    ...kk...
  `,
  Dark: `
    ..kkk...
    .kGGk...
    kGGk....
    kGGk...k
    kGGGk.kk
    kGGGGkGk
    .kGGGGk.
    ..kkkk..
  `,
  House: `
    ...kk...
    ..kxxk..
    .kxxxxk.
    kxxxxxxk
    kkkkkkkk
    .kPPkPk.
    .kPPkPk.
    .kkkkkk.
  `,
  // --- Buttons (12×12, but for the two free actions) -----------------------------------------
  gear: `
    ....kkkk....
    ....kggk....
    .kkkkggkkkk.
    .kggggggggk.
    .kggkkkkggk.
    kkggk..kggkk
    kgggk..kgggk
    .kggkkkkggk.
    .kggggggggk.
    .kkkkggkkkk.
    ....kggk....
    ....kkkk....
  `,
  menu: `
    ............
    ............
    .kkkkkkkkkk.
    .kkkkkkkkkk.
    ............
    .kkkkkkkkkk.
    .kkkkkkkkkk.
    ............
    .kkkkkkkkkk.
    .kkkkkkkkkk.
    ............
    ............
  `,
  help: `
    ............
    ...kkkkkk...
    ..kkkkkkkk..
    ..kk....kk..
    ........kk..
    ......kkk...
    .....kkk....
    .....kk.....
    ............
    .....kk.....
    .....kk.....
    ............
  `,
  rotate: `
    ............
    ....kkkkk...
    ...kk...kk..
    ..kk.....kk.
    ..k...kkkkkk
    ..k....kkkk.
    ..k.....kk..
    ..kk........
    ...kk...kk..
    ....kkkkk...
    ............
    ............
  `,
  /** Reroll: a die, 8×8 for the small free-action buttons. */
  reroll: `
    kkkkkkk.
    kwwwwwk.
    kwkwkwk.
    kwwwwwk.
    kwkwkwk.
    kwwwwwk.
    kkkkkkk.
  `,
  /** Demolish: a hammer, 8×8 like the die. */
  hammer: `
    kkkkkkk.
    kwGGGGk.
    kgggggk.
    kkkkkkk.
    ..kHk...
    ..kHk...
    ..kok...
    ..kkk...
  `,
  fit: `
    kkkk....kkkk
    kkkk....kkkk
    kk........kk
    kk........kk
    ............
    ............
    ............
    ............
    kk........kk
    kk........kk
    kkkk....kkkk
    kkkk....kkkk
  `,
  plus: `
    ............
    ............
    .....kk.....
    .....kk.....
    .....kk.....
    ..kkkkkkkk..
    ..kkkkkkkk..
    .....kk.....
    .....kk.....
    .....kk.....
    ............
    ............
  `,
  minus: `
    ............
    ............
    ............
    ............
    ............
    ..kkkkkkkk..
    ..kkkkkkkk..
    ............
    ............
    ............
    ............
    ............
  `,
  close: `
    ............
    ............
    ..kk....kk..
    ..kkk..kkk..
    ...kkkkkk...
    ....kkkk....
    ....kkkk....
    ...kkkkkk...
    ..kkk..kkk..
    ..kk....kk..
    ............
    ............
  `,
  copy: `
    ............
    ...kkkkkkk..
    ...kwwwwwk..
    .kkkkkkkwk..
    .kwwwwwkwk..
    .kwkkkwkwk..
    .kwwwwwkwk..
    .kwkkkwkkk..
    .kwwwwwk....
    .kkkkkkk....
    ............
    ............
  `,
  exit: `
    ............
    .kkkkkk.....
    .koooek.....
    .koooek..k..
    .kooeek..kk.
    .koooekkkkkk
    .koooek..kk.
    .koooek..k..
    .koooek.....
    .kkkkkk.....
    ............
    ............
  `,
  sound: `
    ............
    ......kk....
    .....kgk..k.
    .kkkkggk...k
    .kggggggk.k.
    .kggggggk..k
    .kggggggk.k.
    .kkkkggk...k
    .....kgk..k.
    ......kk....
    ............
    ............
  `,
} as const;
