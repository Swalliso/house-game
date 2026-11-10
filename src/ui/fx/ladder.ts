// The celebration ladder's sums (implementation-plan.md §12, The celebration ladder; D-124): a
// week's tier against its pace, the glow's strength, and how many pieces fly to the pile. They
// take plain numbers, so Node tests can check them. The rules expose the pace in the tally
// event; the UI only sorts a total the rules already worked out into a tier.
//
// Two small records live in the browser, as §12 says: the best week this browser has seen (a
// Great week that beats it is Huge), and which tiers it has seen (a tier's first appearance plays
// in full; after that a click skips it). They're UI records, not game state, and they're kept per
// channel like the saves, so a dev build's test weeks don't raise the release's best.

import { BUILD_CHANNEL } from '../build-info.ts';
import { FEEL } from './feel.ts';

export type Tier = 'normal' | 'good' | 'great' | 'huge';

export const TIERS: readonly Tier[] = ['normal', 'good', 'great', 'huge'];

/** I = log5(week total ÷ pace), or −∞ for a week that earned nothing (§12). */
export function intensity(total: number, pace: number): number {
  if (!(total > 0)) return -Infinity;
  return Math.log(total / Math.max(1, pace)) / Math.log(5);
}

/**
 * A week's tier (§12): Normal under 2× pace, Good from 2×, Great from 5×, Huge from 25×, or a
 * Great week that beats `best`, the best week this browser has seen (none yet when it's 0).
 */
export function tierOf(total: number, pace: number, best = 0): Tier {
  const l = FEEL.ladder;
  const p = Math.max(1, pace);
  if (!(total > 0) || total < l.good * p) return 'normal';
  if (total >= l.huge * p) return 'huge';
  if (total < l.great * p) return 'good';
  return best > 0 && total > best ? 'huge' : 'great';
}

/**
 * The score panel's glow, 0 to 1 (§12, The glow): none under pace, then `base`, rising with I to
 * full at I = `fullI`. The preview's total glows too, so a great placement lights up before it's
 * committed.
 */
export function glowOf(total: number | null, pace: number): number {
  const g = FEEL.glow;
  if (total === null || !(total > 0) || total < g.fromPace * Math.max(1, pace)) return 0;
  const i = Math.max(0, intensity(total, pace));
  return Math.min(1, g.base + (1 - g.base) * (i / g.fullI));
}

/** How many pieces fly to the pile for a tier (§12, The pile): none for a Normal week. */
export function pileCount(tier: Tier): number {
  return tier === 'normal' ? 0 : FEEL.pile[tier];
}

/**
 * The pieces that fly to the pile: the week's best earners, most first, up to `n`, ties going to
 * the earliest placed (the tally's order).
 */
export function pilePieces<T extends { uid: number; earned: number }>(
  pieces: readonly T[],
  n: number,
): T[] {
  return pieces
    .map((p, k) => ({ p, k }))
    .filter(({ p }) => p.earned > 0)
    .sort((a, b) => b.p.earned - a.p.earned || a.k - b.k)
    .slice(0, Math.max(0, n))
    .map(({ p }) => p);
}

// ---- The browser's records ----

const BEST_KEY = `openhouse:${BUILD_CHANNEL}:best-week`;
const SEEN_KEY = `openhouse:${BUILD_CHANNEL}:tiers-seen`;

function read(key: string): unknown {
  if (typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and blocked storage: the records last for this visit only.
  }
}

/** Kept for this visit when storage is blocked, so a tier still plays in full only once. */
let bestThisVisit = 0;
const seenThisVisit = new Set<Tier>();

/** The best week total this browser has seen: 0 before its first. */
export function bestWeek(): number {
  const v = read(BEST_KEY);
  const stored = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
  return Math.max(stored, bestThisVisit);
}

/** Records a week's total, if it's the best yet. */
export function recordWeek(total: number): void {
  if (!(total > bestWeek())) return;
  bestThisVisit = total;
  write(BEST_KEY, total);
}

/** Whether this browser has seen a tier's celebration before. */
export function tierSeen(tier: Tier): boolean {
  if (seenThisVisit.has(tier)) return true;
  const v = read(SEEN_KEY);
  return Array.isArray(v) && v.includes(tier);
}

/** Marks a tier as seen: from now on a click skips it. */
export function markTierSeen(tier: Tier): void {
  seenThisVisit.add(tier);
  const v = read(SEEN_KEY);
  const list = Array.isArray(v) ? v.filter((t): t is Tier => TIERS.includes(t as Tier)) : [];
  if (!list.includes(tier)) write(SEEN_KEY, [...list, tier]);
}
