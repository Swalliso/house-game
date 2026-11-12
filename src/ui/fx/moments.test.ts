import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, type GameEvent, type PieceScore, type RunSetup } from '../../rules/index.ts';
import { computeLayout } from '../../rules/layout.ts';
import { tallyHouse } from '../../rules/scoring.ts';
import { emptyRows, houseFrom, withPieces } from '../../rules/testing.ts';
import {
  isHouseRule,
  markToppedOut,
  rhythmPaid,
  targetCrossed,
  toppedOutBefore,
} from './moments.ts';

/** A piece's score in the week given, from the rules' own tally (lines included). */
function scoreIn(week: number, effects: Parameters<typeof withPieces>[0]): PieceScore {
  const content = withPieces(effects, CONTENT);
  const house = houseFrom(content, emptyRows(6, 6), [['closet', 0, 0]]);
  const t = tallyHouse(content, computeLayout(content, house), week, true);
  return t.pieces.find((p) => p.uid === 1)!;
}

describe('rhythmPaid', () => {
  it("reads a Rhythm payout from the rules' breakdown in its week, and nothing off it", () => {
    const rhythm = { closet: { effects: [{ kind: 'rhythm' as const, every: 3, amount: 12 }] } };
    // Placed in week 1: it pays in weeks 3 and 6.
    expect([1, 2, 3, 4, 5, 6].map((w) => rhythmPaid(scoreIn(w, rhythm)))).toEqual([
      0, 0, 12, 0, 0, 12,
    ]);
  });

  it("isn't fooled by a steady earner or an economy cadence", () => {
    const steady = { closet: { effects: [{ kind: 'steady' as const, amount: 4 }] } };
    expect(rhythmPaid(scoreIn(3, steady))).toBe(0);
    const economy = { closet: { effects: [{ kind: 'economy' as const, budget: 2, every: 3 }] } };
    expect(rhythmPaid(scoreIn(3, economy))).toBe(0);
  });

  it('counts the Pool, the game’s own Rhythm piece', () => {
    expect(CONTENT.pieces.pool.effects.some((e) => e.kind === 'rhythm')).toBe(true);
  });
});

describe('isHouseRule', () => {
  it('tells the three house rules on the checklist from a client’s wishes (D-165)', () => {
    for (const id of Object.keys(CONTENT.clients) as (keyof typeof CONTENT.clients)[]) {
      const specs = CONTENT.clients[id].specs;
      const rules = specs.filter((_, k) => isHouseRule(id, k));
      expect(rules.length, id).toBe(3);
      expect(rules.map((s) => s.id)).toContain('underOneRoof');
      expect(isHouseRule(id, specs.length)).toBe(false);
    }
  });
});

describe('the milestones', () => {
  it("finds the target a tally crosses, and not the next tally's", () => {
    const tally = { t: 'tally' } as GameEvent;
    const reached = { t: 'targetReached', phase: 1, target: 560, score: 600 } as GameEvent;
    const met = { t: 'specMet', id: 'tidyYard', index: 2 } as GameEvent;
    expect(targetCrossed([tally, met, reached], 0)).toBe(560);
    expect(targetCrossed([tally, tally, reached], 0)).toBeNull();
    expect(targetCrossed([tally], 0)).toBeNull();
  });
});

describe('topped out, once a run', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  const run = (seed: string): RunSetup => ({
    seed,
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });

  it('remembers a run that topped out, and only that run', () => {
    expect(toppedOutBefore(run('abc123'))).toBe(false);
    markToppedOut(run('abc123'));
    expect(toppedOutBefore(run('abc123'))).toBe(true);
    expect(toppedOutBefore(run('zzz999'))).toBe(false);
  });

  it('keeps a few weeks of runs, not every one', () => {
    for (let i = 0; i < 50; i++) markToppedOut(run(`s${i}`));
    const kept = JSON.parse([...store.values()][0]!) as string[];
    expect(kept.length).toBeLessThanOrEqual(30);
    expect(kept).toContain('s49:hendersons:generalContractor');
  });
});
