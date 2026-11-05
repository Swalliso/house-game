// Every juice timing and intensity number, in one place (implementation-plan.md §12, D-059).
// UI code, not rules: tune these by playing. Times are milliseconds at 1× tally speed.

export const FEEL = {
  /** The weekly tally (§12). */
  tally: {
    /** Per piece trigger. Balatro uses 750–940 ms, but a house has 20–40 pieces. */
    stepMs: 450,
    /** Floating popups hold for the step minus this. */
    popupShortenMs: 150,
    /** Each set held lights up, adding Comfort, then Charm. */
    setStepMs: 700,
    /** The pause before Comfort × Charm collapse into the week's total. */
    multiplyPauseMs: 400,
    /** How long the week's total holds before it drains into the run total. */
    totalHoldMs: 800,
    /** The run total counting up. */
    drainMs: 650,
    /** Auto-acceleration: grows by this × speed per second during a tally (Balatro's). */
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

  /** Screen shake in px at 100% of the setting; per-trigger shake stays small (Kao, 2020). */
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

  /** How long the tally waits on a milestone banner before playing what comes next. */
  milestoneHoldMs: 900,

  /** Banners. */
  bannerMs: 2200,
  targetFlashMs: 1400,

  /** The placed piece's settle. */
  placeMs: 220,

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
