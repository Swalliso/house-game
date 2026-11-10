// Every juice timing and intensity number, in one place (implementation-plan.md §12, D-059).
// UI code, not rules: tune these by playing. Times are milliseconds at 1× tally speed.

export const FEEL = {
  /** The weekly tally (§12). */
  tally: {
    /** Per piece trigger. Balatro uses 750–940 ms, but a house has 20–40 pieces. */
    stepMs: 450,
    /** Floating popups hold for the step minus this. */
    popupShortenMs: 150,
    /** Then this much more in real time, at any speed, to rise and fade out. */
    popupTailMs: 450,
    /** And no popup is shorter than this. */
    popupMinMs: 350,
    /**
     * Each set held lights up, adding Comfort, then Charm. Also how long the score panel's
     * folded sets row stays lit when the sets change outside a tally (D-098's 2026-11-08 change).
     */
    setStepMs: 700,
    /** The pause before Comfort × Charm collapse into the week's total. */
    multiplyPauseMs: 400,
    /**
     * How long the week's total holds before it drains into the run total; a tier adds to it
     * (FEEL.ladder.holdMs).
     */
    totalHoldMs: 800,
    /** The run total counting up. */
    drainMs: 650,
    /** The count-up's coin ticks, at most. */
    drainCoins: 6,
    /**
     * Auto-acceleration: grows by this × speed per second during a tally's steps (Balatro's).
     * The closing beats, from the multiply moment on, play at the chosen speed, so the biggest
     * weeks keep their payoff.
     */
    accelPerSecond: 0.2,
    /** Effective speed = chosen speed + max(0, accelerator − 1), capped at +this. */
    accelCap: 8,
    /** Holding Space or the right mouse button fast-forwards at this speed. */
    holdSpeed: 8,
  },

  /** Tally speeds offered in Settings. */
  speeds: [0.5, 1, 2, 4, 8] as const,

  /**
   * The celebration ladder (§12, D-124): a week's tier is its total against the phase's pace.
   * Normal under `good`× pace, Good from it, Great from `great`×, and Huge from `huge`×, or a
   * Great week that beats the best week this browser has seen. I = log5(total ÷ pace).
   */
  ladder: {
    good: 2,
    great: 5,
    huge: 25,
    /**
     * How much longer the week's total holds for each tier, past totalHoldMs: a closing beat, at
     * the chosen speed (D-096), and a click skips it. A tier's first appearance in this browser
     * holds `firstMs` in real time instead, skipped or not, so it's seen once in full (§12).
     */
    holdMs: { normal: 0, good: 250, great: 700, huge: 1500 },
    firstMs: { normal: 0, good: 900, great: 1800, huge: 2800 },
    /** Huge: the last trigger plays this many times as slow. */
    slowMo: 2.5,
    /** Huge: the board leans in and back, a short tween (CLAUDE.md allows it for celebrations). */
    zoom: { scale: 1.04, ms: 1600 },
    /** Great and Huge: the warm wash over the screen, in and out. */
    warmMs: 1800,
    /** Huge: one soft white flash as the total lands (none with Flashing off). */
    flashMs: 450,
  },
  /**
   * The glow (§12): the score panel glows once the week passes `fromPace`× pace, at `base`, and
   * more strongly as I grows, fully at I = `fullI` (25× pace).
   */
  glow: { fromPace: 1, base: 0.3, fullI: 2 },

  /**
   * The pile (§12, Combolands'): from a Good week up, the week's best pieces fly off the board
   * into a stack by the score panel, more for a bigger tier; a Huge week builds a little tower.
   */
  pile: { good: 3, great: 6, huge: 12, flyMs: 560, staggerMs: 80, holdMs: 1500, fadeMs: 400 },

  /**
   * The milestone moment (§12, from Peggle): when a week's count-up is about to cross the
   * target, it slows to `slow`× for the last `leadShare` of the way, with a drumroll, and the
   * target's sting lands as it crosses. Under `maxMs` in all; a click skips it.
   */
  milestoneMoment: { slow: 0.5, leadShare: 0.3, maxMs: 2400 },

  /**
   * Distinct moments (D-125): each one's beat, as a share of the plain beat it replaces, or in
   * ms. They play at tally speed unless noted.
   */
  moments: {
    /** A set completing for the first time: its beat is this many times a set's. */
    setComplete: 1.5,
    /** A Rhythm payout (the Pool's every third week): its piece's step is this many times one. */
    rhythm: 1.6,
    /** A find dug up: the dirt flies, then its reward pops out after this long. */
    findRewardMs: 160,
    /** "Topped out!" over the house, the first week Under one roof holds: real time. */
    toppedOutMs: 1700,
    /** A crate's lid shakes, glowing in its best option's rarity, for this long before it opens. */
    crateShakeMs: 520,
    /** A Rare arriving in the shop waits for the sheet to land before its burst. */
    rareDelayMs: 280,
  },

  /** The parked car slides along the drive to its new spot when the drive grows (D-126). */
  car: { slideMs: 900 },

  /**
   * D-094's option 1: in the tally, an arc runs from a boosting piece to the one it sets going.
   * It bows out by `bend` of its length, traces in `traceShare` of that piece's step, and fades
   * by the step's end.
   */
  chain: { bend: 0.28, traceShare: 0.45 },

  /**
   * Particles (D-125): bursts on one canvas over the page, drawn in whole UI pixels, none with
   * Reduce motion. Speeds in CSS px a second, gravity in px/s² (negative floats up), drag as
   * the share of speed lost a second, lives and `overMs` (a fountain's spread) in ms, sizes in
   * UI px. Colors are tokens.css names; an icon is one of theme/icons.ts.
   */
  particles: {
    /** At most this many at once: a burst past it drops the rest. */
    max: 700,
    bursts: {
      /** Great and Huge: the fountain from the score panel. */
      confetti: {
        count: 46,
        shape: 'confetti',
        speed: [420, 820],
        angle: -90,
        spread: 70,
        gravity: 950,
        drag: 1.1,
        life: [1300, 1900],
        size: [2, 3],
        colors: ['--sparkle', '--charm-shade', '--good-fill', '--action', '--gold-hi'],
        overMs: 700,
      },
      coins: {
        count: 12,
        shape: 'icon',
        icon: 'coin',
        speed: [380, 700],
        angle: -90,
        spread: 45,
        gravity: 1150,
        drag: 0.6,
        life: [1100, 1500],
        size: [1, 1],
        colors: [],
        overMs: 600,
      },
      /** Good and up: sparkles around the score panel. */
      sparkles: {
        count: 12,
        shape: 'spark',
        speed: [70, 210],
        angle: 0,
        spread: 180,
        gravity: -40,
        drag: 2.2,
        life: [550, 950],
        size: [1, 2],
        colors: ['--gold-hi', '--sparkle', '--card-hi'],
      },
      /** A Renovation's level-up, a spec met, Topped out!: gold stars. */
      stars: {
        count: 9,
        shape: 'icon',
        icon: 'star',
        speed: [160, 340],
        angle: -90,
        spread: 80,
        gravity: 520,
        drag: 1,
        life: [700, 1050],
        size: [1, 1],
        colors: [],
      },
      /** A client's wish met: Charm's hearts, rising. */
      hearts: {
        count: 7,
        shape: 'icon',
        icon: 'charm',
        speed: [90, 220],
        angle: -90,
        spread: 60,
        gravity: -90,
        drag: 1.4,
        life: [800, 1150],
        size: [1, 1],
        colors: [],
      },
      /** A set completing: Charm-colored bits in a ring. */
      set: {
        count: 22,
        shape: 'square',
        speed: [180, 340],
        angle: 0,
        spread: 180,
        gravity: 180,
        drag: 2,
        life: [550, 850],
        size: [2, 3],
        colors: ['--charm', '--charm-shade', '--gold-hi'],
      },
      /** A find dug up, a house rule lost: dust and dirt. */
      dust: {
        count: 12,
        shape: 'puff',
        speed: [50, 170],
        angle: -90,
        spread: 100,
        gravity: 260,
        drag: 2.4,
        life: [420, 720],
        size: [1, 3],
        colors: ['--wood-light', '--wood', '--paper-line'],
      },
      /** A change order's stamp: ink spatter round where it lands. */
      ink: {
        count: 14,
        shape: 'square',
        speed: [90, 260],
        angle: 0,
        spread: 180,
        gravity: 500,
        drag: 3,
        life: [280, 520],
        size: [1, 2],
        colors: ['--ink', '--ink-soft'],
      },
      /** A Rhythm payout, the doorbell: one ring spreading out. */
      ring: {
        count: 1,
        shape: 'ring',
        speed: [70, 70],
        angle: 0,
        spread: 0,
        gravity: 0,
        drag: 0,
        life: [560, 560],
        size: [1, 1],
        colors: ['--card-hi'],
      },
      /** A crate opening, a Rare on the shelf: glints in the rarity's color. */
      glints: {
        count: 16,
        shape: 'spark',
        speed: [160, 380],
        angle: -90,
        spread: 180,
        gravity: 300,
        drag: 1.6,
        life: [500, 850],
        size: [1, 2],
        colors: ['--gold-hi', '--sparkle'],
      },
    },
  },

  /**
   * Screen shake in px at 50% of the setting (the default), scaling with it; per-trigger shake
   * stays small (Kao, 2020). Offsets round to whole CSS px, so a low setting can mean none.
   */
  shake: {
    triggerPx: 2,
    setPx: 3,
    bigWeekPx: 7,
    milestonePx: 5,
    decayMs: 200,
  },

  /** Squash-and-wobble on a triggering piece. */
  wobble: { ms: 260, scale: 1.12 },
  /**
   * A piece's floor flashes white as it wobbles or settles, peaking at this opacity: its floor
   * and walls are drawn with the whole house, so the flash shows which room is reacting.
   */
  flash: { peak: 0.32 },
  /** A wobbling piece's digit pops to this size, then back. */
  digitBump: 1.35,
  /** A pack's tiles (D-106): each click's tick rises in pitch by `step`, from `rate`. */
  packTile: { rate: 0.85, step: 0.05 },
  /** A Renovation (M4a): the room's level badge pops in. */
  levelPop: { ms: 420, scale: 1.6 },
  /** A Renovation's beat (M4a): the room wobbles, says its new level, and knocks twice. */
  renovateMs: 480,

  /**
   * The client's checklist in the tally (M4a), after the sets: each line held lights its row
   * and adds its Charm, a quick beat each, since a checklist has 8–10 lines. A line the week
   * turned on (★, a pop) or off (✕, a shake) gets a longer beat, with its name on the board.
   * A row's flash lasts as long as a popup for its beat would.
   */
  checklist: {
    stepMs: 250,
    flipMs: 700,
    /**
     * Two lines flipped in one week: the second's popups land this many cells below the first's,
     * so they clear its "+Charm" while it rises (at 1× zoom and up to about 4× tally speed).
     */
    flipRows: 1.5,
    /** A held line's chime, under a line turned on (full volume). */
    chimeGain: 0.55,
    /** A line turned on pops its row to this scale, and its Charm to `charmScale`. */
    popScale: 1.05,
    charmScale: 1.4,
    /** A line turned off shakes its row this many UI px (whole UI px: 6 CSS px at 1080p). */
    shakePx: 3,
    /** The share of a row's flash its pop or shake takes; the tint fades over all of it. */
    moveShare: 0.6,
    /**
     * The score panel's "N checklist lines" pulses as each line lands, and its folded sets row's
     * numbers as each set is counted.
     */
    tickMs: 200,
  },

  /** Each fast-forwarded week when a milestone completes early (D-040). */
  fastForward: { weekMs: 420 },

  /** A demolition's puff. */
  demolishMs: 500,

  /**
   * A piece growing into another at a week's start (the Nursery into a Kids' Room, a Sapling
   * into a Tree): it wobbles, and its popup holds as a beat of `stepMs` would. In a phase's first
   * week (as the shop closes) a household member may arrive too: the growth waits until their
   * doorbell has rung and their cards have landed (FEEL.arrival), `afterArrivalMs` in all.
   */
  transform: { stepMs: 700, afterArrivalMs: 1000 },

  /**
   * How long the tally waits on a milestone banner before playing what comes next. When the
   * shop or a change order follows, it waits the banner out instead, in real time at any tally
   * speed (holding hurries it, a click skips it), so the banner is read before the sheet opens
   * over it.
   */
  milestoneHoldMs: 900,
  /** When a phase's last week crosses its target, the target's ding gets this long alone. */
  targetDingMs: 450,

  /** Banners, in real time. */
  bannerMs: 2200,
  /** A banner with more to read (early completion, overtime) stays up this many times as long. */
  longBannerScale: 1.3,
  targetFlashMs: 1400,

  /** The placed piece's settle. */
  placeMs: 220,

  /**
   * Budget counts coin by coin (§12, Shop and crates; Balatro's): 0.18 s a coin, faster above
   * 9 and above 20, and one "+N" jump above 60. Spending counts down at the fastest rate.
   */
  budget: {
    coinMs: 180,
    fastAbove: 9,
    fastMs: 90,
    fasterAbove: 20,
    fasterMs: 40,
    jumpAbove: 60,
    /** How long a jump's "+N" shows beside the number. */
    jumpMs: 900,
    /** The number's pop after it changes. */
    bumpMs: 250,
  },

  /** An installed fixture's pop on its piece. */
  installMs: 360,

  /**
   * Change orders (M4b). The sheet arrives with a paper flourish: it slides up from a slight
   * tilt and settles, over a backdrop that fades in. Its keys wait for the flourish, so an
   * Enter pressed for the week before can't answer it. An answer is stamped on the sheet, in
   * real time (holding hurries it, a click skips it), before the shop opens.
   */
  changeOrder: {
    inMs: 420,
    /** The tilt it arrives from, in degrees. */
    tiltDeg: -3,
    keyDelayMs: 450,
    /** The stamp lands in this long, then the sheet holds until `stampMs`. */
    stampInMs: 160,
    stampMs: 700,
    /** A restriction broken (✕ on the piece), and each order resolving at its milestone. */
    brokenMs: 650,
    resolvedMs: 900,
  },

  /**
   * A household member arriving (M4b, D-103; D-126): the doorbell rings at the front door, their
   * card slides in (`cardInMs`) and stays up `cardMs` in real time, and their cards pop into the
   * reserve once it has rung, with a shimmer.
   */
  arrival: {
    dongMs: 300,
    landDelayMs: 450,
    popMs: 520,
    popScale: 1.25,
    cardInMs: 380,
    cardMs: 3400,
  },

  /** A ×Mult source's gold stamp in the tally (D-056): each lands on its own beat. */
  sparkleStepMs: 650,

  /** The shop (§12, Shop and crates). */
  shop: {
    /** How long a bought good keeps its just-bought class: longer than its pop. */
    boughtMs: 600,
    /** A bought good's pop (shop.css reads it as --dur-shop-pop). */
    popMs: 420,
    /** An opened crate's options turn over this far apart, each with its sound. */
    crateStaggerMs: 220,
    /** Each option's turn (--dur-shop-turn). */
    turnMs: 480,
    /** A Rare's glint crossing it as it arrives (--dur-shop-shimmer). */
    shimmerMs: 1600,
  },

  /**
   * The interface's own motion (M5a): theme.ts publishes each as --dur-<name> for the CSS.
   * Hover lifts a control one UI pixel, a press sinks it one; a modal pops in.
   */
  chrome: {
    hover: 120,
    press: 80,
    modal: 180,
    /** The milestone meter's fill and forecast sliding to a new value. */
    meter: 250,
    /** The shop's sheet sliding up over the board. */
    sheet: 260,
    /** A milestone's ribbon stamping in (it stays up for bannerMs). */
    banner: 380,
    /**
     * The target's stamp (and a neutral note) scaling in, and fading out at the end of its
     * targetFlashMs. The scale is its own short animation, so the text is drawn crisp again
     * once it lands.
     */
    stamp: 280,
  },

  /**
   * The end screen's photos (M6, D-136): a polaroid for each milestone, dealt onto the table one
   * after another once the end screen is up, each with a soft flick as it lands, its picture
   * developing from a warm blank. Reduce motion puts them all down at once, developed.
   */
  photos: {
    delayMs: 650,
    staggerMs: 140,
    dealMs: 420,
    developMs: 1100,
    /** How far below the strip a polaroid starts, and how far it turns as it comes, in deg. */
    fromPx: 48,
    spinDeg: -9,
    /** A hovered or focused polaroid rises this far, in CSS px (whole pixels: crisp text). */
    liftPx: 6,
  },

  /** The title screen's street (M5a): a car drives by now and then. */
  title: {
    /** Its speed, in art px a second (it moves a whole art px at a time). */
    carPxPerSecond: 56,
    /** How long the street stays empty between cars. */
    carPauseMs: 5000,
  },

  /**
   * The job board and the crew pick (M4, D-110): the cards are pinned up one after another,
   * `staggerMs` apart, each landing in `inMs` (jobs.css reads them as --beat and --jobs-in).
   */
  jobs: {
    staggerMs: 70,
    inMs: 350,
  },

  /** The camera (§12, Art; D-057): wheel zoom in whole steps, drag to pan. */
  camera: {
    /** A left-button drag pans once it has moved this many px; a shorter one is a click. */
    dragPx: 5,
    /** Wheel events closer together than this are one gesture; a gesture's first event zooms at once. */
    wheelGestureMs: 220,
    /** Within a gesture, each further zoom step takes this much wheel travel (px). */
    wheelStepPx: 80,
    /** And at least this long between steps, so a trackpad fling doesn't race to the end. */
    wheelStepGapMs: 120,
  },
} as const;

export type TallySpeed = (typeof FEEL.speeds)[number];
