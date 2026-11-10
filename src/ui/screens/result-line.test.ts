// The copyable result line (D-135): what it says for a win, an early one, a loss and a debug
// run; where its link points on each channel; and that the link really starts the same run,
// through loadInitialRun's own ?seed=&client=&crew= path, setting aside a friend's run in
// progress instead of losing it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT,
  decodeRunCode,
  encodeRunCode,
  rules,
  type MilestoneRecord,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { BUILD_SHA } from '../build-info.ts';
import { appScreen, CONTENT_HASH, loadInitialRun, notice, run } from '../store.ts';
import { lotLink, PAGES_URL, resultLine, shareBase } from './result-line.ts';

const setup: RunSetup = {
  seed: 'drf4yj',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
const BASE = 'https://swalliso.github.io/house-game/';
const LINK = `${BASE}?seed=drf4yj&client=hendersons&crew=generalContractor`;

const record = (phase: number, result: MilestoneRecord['result']): MilestoneRecord => ({
  phase,
  result,
  target: 1000,
  score: 1000,
  weeksSaved: result === 'early' ? 1 : 0,
  overtimeUsed: result === 'overtime' ? 1 : 0,
  reward: { score: 0, budget: 0, interest: 0 },
});

/** A finished run on `setup`: its milestones' results in order, and its final Wow. */
function finished(
  screen: 'won' | 'lost',
  results: MilestoneRecord['result'][],
  score: number,
  extra: Partial<RunState> = {},
): RunState {
  return {
    ...rules.newRun(setup),
    screen,
    score,
    phase: results.length - 1,
    milestones: results.map((r, i) => record(i, r)),
    ...extra,
  };
}

describe('the result line', () => {
  const phases = CONTENT.balance.phases.length;

  it('says the client, the crew, the verdict, the Wow, the milestones and the lot', () => {
    const results = Array.from({ length: phases }, (_, i) => (i === 2 ? 'early' : 'onTime'));
    const s = finished('won', results, 50129);
    expect(resultLine(s, BASE)).toBe(
      `Open House · The Hendersons · General Contractor — ${rules.verdict(s)}: 50,129 Wow, ` +
        `${phases}/${phases} milestones (1 early). Play this lot: ${LINK}`,
    );
  });

  it('leaves out the early count when none were early, and counts overtime as met', () => {
    const results = Array.from({ length: phases }, (_, i) => (i === 1 ? 'overtime' : 'onTime'));
    const line = resultLine(finished('won', results, 40000), BASE);
    expect(line).toContain(`40,000 Wow, ${phases}/${phases} milestones. Play this lot`);
    expect(line).not.toContain('early');
  });

  it('says where the client walked after a loss', () => {
    const s = finished('lost', ['early', 'onTime', 'overtime', 'failed'], 9610);
    expect(resultLine(s, BASE)).toBe(
      `Open House · The Hendersons · General Contractor — ${rules.verdict(s)}: 9,610 Wow, ` +
        `3/${phases} milestones (1 early), the client walked at ${rules.phaseName(3)}. ` +
        `Play this lot: ${LINK}`,
    );
  });

  it('owns up to cheats', () => {
    const s = finished('won', Array(phases).fill('onTime'), 1, { debug: true });
    expect(resultLine(s, BASE)).toContain(`milestones, cheats used. Play this lot`);
  });

  it('names another client and crew by their own names', () => {
    const s = {
      ...finished('won', ['onTime'], 1),
      setup: { ...setup, clientId: 'barkers', crewId: 'landscaper' },
    } as RunState;
    const line = resultLine(s, BASE);
    expect(line).toContain(
      `· ${CONTENT.clients.barkers.name} · ${CONTENT.crews.landscaper.name} —`,
    );
    expect(line).toContain('client=barkers&crew=landscaper');
  });
});

describe('where the link points', () => {
  const here = { origin: 'http://localhost:5173', pathname: '/' };

  it('links a release and develop to Pages, wherever they were played (itch.io too)', () => {
    expect(shareBase('main', here)).toBe(PAGES_URL);
    expect(shareBase('dev', here)).toBe(`${PAGES_URL}dev/`);
    expect(PAGES_URL).toBe(BASE);
  });

  it('links a local build to the page it is on', () => {
    expect(shareBase('local', here)).toBe('http://localhost:5173/');
    expect(shareBase('local', { origin: 'http://127.0.0.1:4173', pathname: '/house-game/' })).toBe(
      'http://127.0.0.1:4173/house-game/',
    );
  });
});

describe('opening the link', () => {
  const store = new Map<string, string>();
  let address = '';
  const SAVE = 'openhouse:local:run';
  const PREVIOUS = 'openhouse:local:previous';

  /** Opens `url` as a fresh page load would. */
  function open(url: string): void {
    const u = new URL(url);
    address = u.pathname + u.search + u.hash;
    vi.stubGlobal('location', {
      get search() {
        return new URL(address, u.origin).search;
      },
      pathname: u.pathname,
      hash: u.hash,
      origin: u.origin,
    });
    loadInitialRun();
  }

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    vi.stubGlobal('history', {
      replaceState: (_: unknown, __: string, url: string) => (address = url),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    notice.value = null;
    appScreen.value = 'title';
  });

  it('starts the same run: the same lot, hand and setup, straight into the game', () => {
    const s = finished('won', ['onTime'], 1);
    open(lotLink(s.setup, 'http://localhost:5173/'));
    expect(appScreen.value).toBe('game');
    expect(run.value.setup).toEqual(setup);
    // Everything the run started with: the lot, the first hand, the budget, the streams' keys.
    expect(run.value).toEqual(rules.newRun(setup));
    // The address bar drops the query, so a reload resumes the saved run.
    expect(address).toBe('/');
    // And it's saved, so a reload resumes it.
    const saved = decodeRunCode(JSON.parse(store.get(SAVE)!).code);
    expect(saved.ok && saved.data.setup).toEqual(setup);
  });

  it('starts another client and crew too', () => {
    const other: RunSetup = { ...setup, clientId: 'barkers', crewId: 'landscaper' };
    open(lotLink(other, 'http://localhost:5173/'));
    expect(run.value).toEqual(rules.newRun(other));
  });

  it("puts a friend's run in progress aside, with its code in the note", () => {
    const theirs = encodeRunCode({
      build: BUILD_SHA,
      contentHash: CONTENT_HASH,
      setup: { ...setup, seed: 'theirs' },
      actions: [{ t: 'pass' }],
    });
    store.set(SAVE, JSON.stringify({ build: BUILD_SHA, code: theirs }));
    open(lotLink(setup, 'http://localhost:5173/'));
    expect(run.value.setup).toEqual(setup);
    expect(notice.value).toEqual({ text: 'Your run in progress was put aside.', oldCode: theirs });
    expect(store.get(PREVIOUS)).toBe(theirs);
    // The new run takes the save's place.
    expect(store.get(SAVE)).not.toContain(theirs);
  });

  it('says nothing when the save had no weeks played', () => {
    const fresh = encodeRunCode({
      build: BUILD_SHA,
      contentHash: CONTENT_HASH,
      setup: { ...setup, seed: 'fresh' },
      actions: [],
    });
    store.set(SAVE, JSON.stringify({ build: BUILD_SHA, code: fresh }));
    open(lotLink(setup, 'http://localhost:5173/'));
    expect(notice.value).toBeNull();
    expect(store.has(PREVIOUS)).toBe(false);
  });
});
