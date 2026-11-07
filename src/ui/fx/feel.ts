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
    /** Each set held lights up, adding Comfort, then Charm. */
    setStepMs: 700,
    /** The pause before Comfort × Charm collapse into the week's total. */
    multiplyPauseMs: 400,
    /** How long the week's total holds before it drains into the run total. */
    totalHoldMs: 800,
    /** A big week's total holds this many times as long. */
    bigHoldScale: 1.6,
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

  /** M1's one celebration tier: a week at or above this many times pace is a big week (§12). */
  bigWeekPace: 2,
  /** The score panel starts to glow at this many times pace. */
  glowPace: 1,

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

  /** Each fast-forwarded week when a milestone completes early (D-040). */
  fastForward: { weekMs: 420 },

  /** A demolition's puff. */
  demolishMs: 500,

  /**
   * How long the tally waits on a milestone banner before playing what comes next. When the
   * shop follows, it waits the banner out instead, in real time at any tally speed (holding
   * hurries it, a click skips it), so the banner is read before the shop opens over it.
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

  /** M1's big-week burst of confetti and coins. */
  celebration: {
    bits: 46,
    /** Each bit flies between these distances, in px. */
    minPx: 90,
    maxPx: 240,
    /** Bits start up to this long after the burst. */
    delayMs: 120,
    /** The burst is cleared after this long. */
    ms: 1800,
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

  /** The title screen's street (M5a): a car drives by now and then. */
  title: {
    /** Its speed, in art px a second (it moves a whole art px at a time). */
    carPxPerSecond: 56,
    /** How long the street stays empty between cars. */
    carPauseMs: 5000,
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
