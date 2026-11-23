// D-188 on the real content: the wrong delivery. Once a run, at the start of Framing, a Pool, a
// Hot Tub or a Henhouse turns up free in Your goods, which one by the run's seed alone. All three
// are shop-only (draw weight 0). A first job gets none. The numbers follow balance.ts and
// pieces.ts; src/rules/surprise.test.ts holds the rule on the test content.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Content,
  CrewId,
  GameEvent,
  PieceId,
  RunMode,
  RunState,
} from '../rules/index.ts';
import { rules } from '../rules/index.ts';
import { CONTENT, validateContent } from './index.ts';

const start = (seed: string, crewId: CrewId = 'generalContractor', mode: RunMode = 'standard') =>
  rules.newRun({ seed, clientId: 'hendersons', crewId, mode });

/** The next step of a run that only passes: shops left, change orders answered, targets met by a cheat. */
function passOn(s: RunState): Action {
  if (s.screen === 'shop') return s.offers?.pick ? { t: 'pick', i: -1 } : { t: 'leaveShop' };
  if (s.screen === 'changeOrder') return { t: 'answerChangeOrder', i: 0 };
  if (s.score < rules.target(s)) return { t: 'debug', op: 'addScore', amount: rules.target(s) };
  return { t: 'pass' };
}

/** Plays a run on with passes until `stop` or its end, calling `seen` with every step's events. */
function play(
  from: RunState,
  stop: (s: RunState) => boolean,
  seen: (events: readonly GameEvent[], after: RunState) => void = () => {},
): RunState {
  let s = from;
  for (let k = 0; k < 2000 && !stop(s) && s.screen !== 'won' && s.screen !== 'lost'; k++) {
    const out = rules.apply(s, passOn(s));
    seen(out.events, out.state);
    s = out.state;
  }
  return s;
}

const framing = (s: RunState) => s.screen === 'build' && s.phase === 2 && s.slot === 1;
const never = () => false;

const surprises = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { t: 'delivered' }> =>
      e.t === 'delivered' && e.from === 'surprise',
  );

/** Three seeds, one of each piece: the pull request's ?seed= checks. */
const SEEDS: Readonly<Record<string, PieceId>> = { oak: 'pool', ash: 'hotTub', elm: 'henhouse' };

describe('the wrong delivery (D-188)', () => {
  it('is a Pool, a Hot Tub or a Henhouse at Framing’s start, all three shop-only', () => {
    const { phase, pieces } = CONTENT.balance.surpriseDelivery;
    expect(pieces).toEqual(['pool', 'hotTub', 'henhouse']);
    expect(CONTENT.balance.phases[phase]!.name).toBe('Framing');
    for (const id of pieces) {
      // Special pieces; the weekly draw deals the Henhouse from Framing too (D-200).
      expect(CONTENT.pieces[id]!.special, id).toBe(true);
      expect(CONTENT.pieces[id]!.perHouse, id).toBeUndefined();
    }
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('catches the wrong delivery’s mistakes', () => {
    const broken: Content = {
      ...CONTENT,
      balance: {
        ...CONTENT.balance,
        surpriseDelivery: {
          phase: 7,
          pieces: ['pool', 'bedroom', 'ivysRoom', 'addition', 'pool', 'jacuzzi' as PieceId],
        },
      },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toMatch(/surpriseDelivery: unknown piece "jacuzzi"/);
    expect(problems).toMatch(/surpriseDelivery: bedroom isn't a special piece/);
    expect(problems).toMatch(/surpriseDelivery: ivysRoom is a member's room or an Addition/);
    expect(problems).toMatch(/surpriseDelivery: addition is a member's room or an Addition/);
    expect(problems).toMatch(/surpriseDelivery: a piece twice/);
    expect(problems).toMatch(/surpriseDelivery: phase must be a phase of the run/);
  });

  it('comes once a run, in Framing’s first week, the same piece for the same seed', () => {
    for (const [seed, id] of Object.entries(SEEDS)) {
      const seen: { phase: number; week: number; cards: readonly PieceId[] }[] = [];
      const at = play(start(seed), framing, (events, after) => {
        for (const e of surprises(events)) {
          seen.push({ phase: e.phase, week: after.week, cards: e.cards });
        }
      });
      expect(at.week, seed).toBe(2 * CONTENT.balance.weeksPerPhase + 1);
      expect(seen, seed).toEqual([{ phase: 2, week: at.week, cards: [id] }]);
      expect(at.reserve.filter((r) => r.surprise)).toEqual([{ id, surprise: true }]);
      // Every crew gets the seed's piece.
      for (const crewId of ['landscaper', 'architect', 'handyman'] as const) {
        const other = play(start(seed, crewId), framing);
        expect(
          other.reserve.filter((r) => r.surprise),
          `${seed}, ${crewId}`,
        ).toEqual([{ id, surprise: true }]);
      }
      // And the rest of the run brings no other.
      const rest: GameEvent[] = [];
      const end = play(at, never, (events) => rest.push(...surprises(events)));
      expect(end.screen, seed).toBe('won');
      expect(rest).toEqual([]);
    }
  });

  it('never comes in a first job', () => {
    const seen: GameEvent[] = [];
    let last = 0;
    const end = play(start('oak', 'generalContractor', 'firstJob'), never, (events, after) => {
      seen.push(...surprises(events));
      last = Math.max(last, after.phase);
    });
    expect(end.screen).toBe('won');
    expect(last).toBeGreaterThan(CONTENT.balance.surpriseDelivery.phase);
    expect(seen).toEqual([]);
  });

  it('is free to build from Your goods', () => {
    for (const seed of Object.keys(SEEDS)) {
      const s = play(start(seed), framing);
      const i = s.reserve.findIndex((r) => r.surprise);
      const spot = rules.legalPlacements(s).find((p) => p.from === 'reserve' && p.i === i);
      expect(spot, seed).toBeDefined();
      expect(rules.endsWeek(s, spot!)).toBe(false);
      const { state, events } = rules.apply(s, spot!);
      expect(events[0]).toMatchObject({ t: 'placed', defId: s.reserve[i]!.id });
      expect(state).toMatchObject({ phase: 2, slot: 1, week: s.week, hand: s.hand });
    }
  });
});
