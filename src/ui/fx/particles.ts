// Particles (D-125): small bursts for the reward moments, simulated here and drawn by
// Particles.tsx on one canvas over the page. A burst's numbers are FEEL.particles' presets
// (feel.ts), with what a moment changes (a count, its colors, a direction). Positions are CSS px
// in the viewport; the renderer draws them in whole UI pixels, as the rest of the interface is.
//
// None play with Reduce motion: §12's Reduce motion turns off what moves for show, and the
// moments keep their popups, sounds and glows without them. The randomness is the UI's own
// (Math.random): bursts never touch the game.
//
// This file has no DOM, so Node tests can spawn and step bursts.

import { FEEL } from './feel.ts';

type Presets = typeof FEEL.particles.bursts;
export type BurstName = keyof Presets;
export type Shape = 'confetti' | 'square' | 'spark' | 'puff' | 'ring' | 'icon';

/** A preset as data: what feel.ts holds for each burst. */
export interface BurstSpec {
  count: number;
  shape: Shape;
  /** An icon from theme/icons.ts, for `shape: 'icon'`. */
  icon?: string;
  speed: readonly [number, number];
  /** Degrees: 0 is right, −90 up. */
  angle: number;
  /** Half the cone, in degrees: 180 is every way. */
  spread: number;
  gravity: number;
  drag: number;
  life: readonly [number, number];
  size: readonly [number, number];
  /** tokens.css names. */
  colors: readonly string[];
  /** Spread the burst over this long, as a fountain. */
  overMs?: number;
}

/** What a moment changes about a preset. */
export type BurstOptions = Partial<Pick<BurstSpec, 'count' | 'angle' | 'spread' | 'colors'>> & {
  /** Scales the count (a bigger tier, a bigger find). */
  scale?: number;
  /** Starts the burst this long from now. */
  delayMs?: number;
  /** Scatters the starting points over a box this wide and tall (px), centered on the point. */
  area?: { w: number; h: number };
};

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** ms lived; negative while it waits for its turn in a fountain. */
  age: number;
  life: number;
  /** UI px. */
  size: number;
  /** A tokens.css name, or '' for an icon. */
  color: string;
  shape: Shape;
  icon: string;
  gravity: number;
  drag: number;
  /** Radians, and radians a second: confetti tumbles, sparks twinkle. */
  rot: number;
  spin: number;
}

const live: Particle[] = [];
let wake: (() => void) | null = null;
let enabled: () => boolean = () => true;

/** The renderer registers how to start its frames, and whether bursts may play at all. */
export function connect(onBurst: () => void, allowed: () => boolean): () => void {
  wake = onBurst;
  enabled = allowed;
  return () => {
    if (wake === onBurst) wake = null;
    enabled = () => true;
  };
}

const between = (r: readonly [number, number], rand: () => number) => r[0] + (r[1] - r[0]) * rand();

/**
 * A preset's particles at a point, with a moment's options, oldest first. `rand` is the UI's
 * randomness (tests pass a fixed one).
 */
export function spawn(
  spec: BurstSpec,
  at: { x: number; y: number },
  opts: BurstOptions = {},
  rand: () => number = Math.random,
): Particle[] {
  const count = Math.max(0, Math.round((opts.count ?? spec.count) * (opts.scale ?? 1)));
  const angle = ((opts.angle ?? spec.angle) * Math.PI) / 180;
  const spread = ((opts.spread ?? spec.spread) * Math.PI) / 180;
  const colors = opts.colors ?? spec.colors;
  const over = spec.overMs ?? 0;
  const delay = opts.delayMs ?? 0;
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const a = angle + (rand() * 2 - 1) * spread;
    const v = between(spec.speed, rand);
    const ox = opts.area ? (rand() - 0.5) * opts.area.w : 0;
    const oy = opts.area ? (rand() - 0.5) * opts.area.h : 0;
    out.push({
      x: at.x + ox,
      y: at.y + oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      // A fountain's particles take their turns evenly over its time.
      age: -(delay + (count > 1 ? (over * i) / (count - 1) : 0)),
      life: between(spec.life, rand),
      size: Math.round(between(spec.size, rand)),
      color: colors.length > 0 ? colors[i % colors.length]! : '',
      shape: spec.shape,
      icon: spec.icon ?? '',
      gravity: spec.gravity,
      drag: spec.drag,
      rot: rand() * Math.PI * 2,
      spin: (rand() * 2 - 1) * 14,
    });
  }
  return out;
}

/** Moves a particle on by `dt` ms. Returns false once it has lived its life. */
export function step(p: Particle, dt: number): boolean {
  if (p.age < 0) {
    p.age += dt;
    if (p.age < 0) return true;
    dt = p.age;
  } else {
    p.age += dt;
  }
  // A ring stays where it started and grows (its vx is how fast).
  if (p.shape === 'ring') return p.age < p.life;
  const s = dt / 1000;
  p.vy += p.gravity * s;
  const keep = Math.max(0, 1 - p.drag * s);
  p.vx *= keep;
  p.vy *= keep;
  p.x += p.vx * s;
  p.y += p.vy * s;
  p.rot += p.spin * s;
  return p.age < p.life;
}

/** A particle's opacity: full, then fading over the last third of its life. */
export function alpha(p: Particle): number {
  if (p.age < 0) return 0;
  const t = p.age / p.life;
  return t < 2 / 3 ? 1 : Math.max(0, 1 - (t - 2 / 3) * 3);
}

/** Starts a burst at a point in the viewport (CSS px). Nothing with Reduce motion. */
export function burst(name: BurstName, at: { x: number; y: number }, opts?: BurstOptions): void {
  if (!enabled() || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
  const spec = FEEL.particles.bursts[name] as BurstSpec;
  const room = FEEL.particles.max - live.length;
  if (room <= 0) return;
  live.push(...spawn(spec, at, opts).slice(0, room));
  wake?.();
}

/** A burst at an element's middle (or a point inside it, as shares of its box). */
export function burstAt(
  name: BurstName,
  el: Element | null | undefined,
  opts?: BurstOptions & { fx?: number; fy?: number },
): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  const at = { x: r.left + r.width * (opts?.fx ?? 0.5), y: r.top + r.height * (opts?.fy ?? 0.5) };
  burst(name, at, opts);
}

/** The particles in flight, for the renderer: it steps them and drops the spent ones. */
export function particles(): Particle[] {
  return live;
}

/** Clears every burst (a new run, Reduce motion turned on). */
export function clearParticles(): void {
  live.length = 0;
}
