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
  /** ✓: done, met (the end screen's milestones). */
  check: `
    .....kk
    ....kkk
    kk.kkk.
    kkkkk..
    .kkk...
    ..k....
  `,
  /** ○: not reached yet. */
  pending: `
    ..sss..
    .s...s.
    s.....s
    s.....s
    s.....s
    .s...s.
    ..sss..
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
    .kWWkWk.
    .kWWkWk.
    .kkkkkk.
  `,
  // --- Fixtures (8×8): a fixture's badge on the board, its supply slot, and the shop's art slot
  // where it has no sprite on the board (sprites.ts FIXTURE_ICONS) ----------------------------
  /** The Fireplace: a stone hearth, its fire on the logs. */
  fireplace: `
    kkkkkkkk
    kTTTTTTk
    kTkkkkTk
    kTKnKKTk
    kTKnyKTk
    kTnyynTk
    kTddddTk
    kkkkkkkk
  `,
  /** The Skylight: a window full of sky, the sun in its corner. */
  skylight: `
    kkkkkkkk
    kCCCkuyk
    kCCCkyYk
    kCCCkCCk
    kkkkkkkk
    kCCCkCCk
    kCCCkCCk
    kkkkkkkk
  `,
  /** Blackout Curtains: dark drapes on their rod, a sliver of night between them. */
  blackoutCurtains: `
    kkkkkkkk
    kZzKuzZk
    kZzKKzZk
    kZzKKzZk
    kZzKKzZk
    kZZzzZZk
    kZZkkZZk
    .kk..kk.
  `,
  /** Soundproofing: a quilted pad, buttoned. */
  soundproofing: `
    kkkkkkkk
    kLLLkLLk
    kLGLkGLk
    kLLLkLLk
    kkkkkkkk
    kLLLkLLk
    kLGLkGLk
    kkkkkkkk
  `,
  /** The Kitchen Island: a counter with fruit on it. */
  kitchenIsland: `
    ...xv...
    ..xxvy..
    kkkkkkkk
    kwwwwwwk
    kkkkkkkk
    komkkomk
    komkkomk
    kkkkkkkk
  `,
  /** Bunk Beds: one bed over another. */
  bunkBeds: `
    kkkkkkkk
    kwwBBBBk
    kkkkkkkk
    k......k
    kkkkkkkk
    kwwbbbbk
    kkkkkkkk
    k......k
  `,
  /** The Bay Window: three panes, the middle one facing out, on a sill. */
  bayWindow: `
    kkkkkkkk
    kckCCkck
    kckCwkck
    kckwCkck
    kckCCkck
    kkkkkkkk
    kddddddk
    kkkkkkkk
  `,
  /** The Sprinkler: its head in the grass, spraying. */
  sprinkler: `
    B..CC..B
    .B.CC.B.
    ..BCCB..
    ...kk...
    ..kgGk..
    ..kggk..
    vvkkkkvv
    VVVVVVVV
  `,
  /** The Pergola: two posts and a beam of slats, with a vine. */
  pergola: `
    kkkkkkkk
    khvhvhvk
    kkkkkkkk
    kok..kok
    kok..kok
    kok..kok
    kok..kok
    kkk..kkk
  `,
  /** Garden Lights: a lamp on its post, lit. */
  gardenLights: `
    ...kk...
    ..kuuk..
    .kuuyyk.
    .kyyyYk.
    ..kkkk..
    ...ks...
    ...ks...
    ..kkkk..
  `,
  /** The Chandelier: gold arms and two candles, on a chain. */
  chandelier: `
    ...kk...
    .u.kk.u.
    .y.kk.y.
    kwkYYkwk
    kYYYYYYk
    .kYYYYk.
    ..kkkk..
    ...kk...
  `,
  // --- Tools (8×8): a tool's supply slot and its art slot in the shop (sprites.ts TOOL_ICONS) ---
  /** The Moving Truck: a box truck. */
  movingTruck: `
    kkkkk...
    kwwwkkk.
    kwwwkCBk
    kwwwkBBk
    kkkkkkkk
    kxxxxxxk
    kkkkkkkk
    .kgk.kgk
  `,
  /** The Copy Machine: a page and its copy. */
  copyMachine: `
    kkkkk...
    kwwwkk..
    kwkkkkkk
    kwkwwwwk
    kwkwkkwk
    kkkwwwwk
    ..kwkkwk
    ..kkkkkk
  `,
  /** A Rush Order: a stopwatch. */
  rushOrder: `
    ..kkkk..
    ...kk...
    .kkkkkk.
    kwwwkwwk
    kwwwkkwk
    kwwwwwwk
    kwwwwwwk
    .kkkkkk.
  `,
  /** An Open House Party: two balloons. */
  openHouseParty: `
    .kk..kk.
    kuxkkwBk
    kxxkkBBk
    .kk..kk.
    ..k..k..
    ...kk...
    ...k....
    ...k....
  `,
  /** The Catalog: a booklet of pages. */
  catalog: `
    kkkkkkk.
    kwwwwwkk
    kwkkkwkk
    kwwwwwkk
    kwkkwwkk
    kwwwwwkk
    kkkkkkkk
    .kkkkkkk
  `,
  /** Fertilizer: a sack with a leaf on it. */
  fertilizer: `
    .kkkkkk.
    kTkkkkTk
    kTTTTTTk
    kTTvvTTk
    kTvAvvTk
    kTTvVTTk
    kTTTTTTk
    kkkkkkkk
  `,
  /** The Inspector's Visit: a clipboard, checked. */
  inspectorsVisit: `
    ..kkkk..
    kkkgGkkk
    kwwwwwwk
    kwwwwkwk
    kwkwkwwk
    kwwkwwwk
    kwwwwwwk
    kkkkkkkk
  `,
  /** The Dumpster: a green bin on wheels. */
  dumpster: `
    .kkkkkk.
    kvvvvvvk
    kkkkkkkk
    kVvVVvVk
    kVvVVvVk
    kVvVVvVk
    kkkkkkkk
    .kk..kk.
  `,
  /** A remodel: a set's level up, in Charm's rose. */
  remodel: `
    ...kk...
    ..kqrk..
    .kqrrrk.
    kqrrrrrk
    kkkrrkkk
    ..krrk..
    ..krrk..
    ..kkkk..
  `,
  /** The Weekend Crew: a hard hat. */
  weekendCrew: `
    ..kkkk..
    .kuyyYk.
    kuyykyYk
    kyyykyYk
    kkkkkkkk
    kYYYYYYk
    .kkkkkk.
    ........
  `,
  // --- Kinds of goods (12×12): the shop's art slots, until each good has its own sprite -------
  /** A blueprint: a house drawn on blue paper. */
  blueprint: `
    kkkkkkkkk...
    kjjjjjjjjk..
    kjjjjjjjjBk.
    kjjjjwjjjBBk
    kjjjwjwjjkkk
    kjjwjjjwjjjk
    kjwwwwwwwjjk
    kjjwjjjwjjjk
    kjjwjwjwjjjk
    kjjwwwwwjjjk
    kjjjjjjjjjjk
    kkkkkkkkkkkk
  `,
  /** A fixture: a pendant lamp. */
  fixture: `
    .....kk.....
    .....kk.....
    ....kkkk....
    ...kHhhok...
    ..kHhhhhok..
    .kHhhhhhhok.
    kkkkkkkkkkkk
    ....kuyk....
    ....kyYk....
    .....kk.....
  `,
  /** A tool: a toolbox. */
  tool: `
    ....kkkk....
    ...kk..kk...
    kkkkkkkkkkkk
    kxxxxxxxxxxk
    kxxxxxxxxxxk
    kkkkkHHkkkkk
    kXXXXkkXXXXk
    kXXXXXXXXXXk
    kXXXXXXXXXXk
    kkkkkkkkkkkk
  `,
  /** A crate: a wooden box, braced. */
  crate: `
    kkkkkkkkkkkk
    kHHHHHHHHHok
    kkkkkkkkkkkk
    khhkllllkhok
    khhlkllkhhok
    khhllkkhhhok
    khhllkkhhhok
    khhlkllkhhok
    khhkllllkhok
    kkkkkkkkkkkk
    kmmmmmmmmmdk
    kkkkkkkkkkkk
  `,
  /** A company upgrade: the crew's hard hat. */
  upgrade: `
    ............
    ....kkkk....
    ...kuyyyk...
    ..kuyykyYk..
    .kuyyykyyYk.
    .kyyyykyyYk.
    kkkkkkkkkkkk
    kyyyyyyyyYYk
    .kkkkkkkkkk.
  `,
  /** A notice: a letter. */
  mail: `
    kkkkkkkkkkkk
    kkWWWWWWWWkk
    kWkWWWWWWkWk
    kWWkWWWWkWWk
    kWWWkkkkWWWk
    kWWWWWWWWWWk
    kWWWWWWWWWWk
    kkkkkkkkkkkk
  `,
  /** The house is finished: a trophy. */
  trophy: `
    .kkkkkkkkkk.
    kkuyyyyyyYkk
    kykuyyyyyYkk
    kykuyyyyyYkk
    .kkuyyyyyYk.
    ..kkuyyyYkk.
    ....kkyYk...
    .....kYk....
    ....kkYkk...
    ...kYYYYYk..
    ...kkkkkkk..
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
