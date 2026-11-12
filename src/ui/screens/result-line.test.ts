// The copyable result line (D-135): what it says for a win, an early one, a loss and a debug
// run; where its link points on each channel; and that the link really starts the same run,
// through loadInitialRun's own ?seed=&client=&crew= path, setting aside a friend's run in
// progress instead of losing it. The note about that run offers the way back to it (the polish
// review): not for a run that was already over, which gets no note, nor one from an older build.
// The note also says what the link opened: whose house, with which crew.
//
// And a save from another build (D-068, 2026-11-11): it carries on when its content is this
// build's and this build replays it to the run that was saved (the week, Wow, budget and pieces
// kept beside its code). Otherwise the note says the game updated and offers the old code.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT,
  decodeRunCode,
  encodeRunCode,
  rules,
  type Action,
  type MilestoneRecord,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { BUILD_CHANNEL, BUILD_SHA } from '../build-info.ts';
import {
  appScreen,
  canContinue,
  CONTENT_HASH,
  crash,
  dispatch,
  forgetFirstVisit,
  loadInitialRun,
  log,
  newRunAfterCrash,
  notice,
  restorePreviousRun,
  run,
} from '../store.ts';
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

  it('says a first job had its gentler targets (D-151), and links the lot as usual', () => {
    const s = {
      ...finished('won', Array(phases).fill('onTime'), 1),
      setup: { ...setup, mode: 'firstJob' },
    } as RunState;
    const line = resultLine(s, BASE);
    expect(line).toContain(`milestones, first-job targets. Play this lot: ${LINK}`);
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
  // The store's keys carry the build's channel: `local` here, `dev` or `main` where the deploy
  // job runs these tests before it builds each site.
  const SAVE = `openhouse:${BUILD_CHANNEL}:run`;
  const PREVIOUS = `openhouse:${BUILD_CHANNEL}:previous`;
  /** What the link to `setup` says it opened. */
  const SHARED = 'A shared lot: you’re building for the Hendersons with the General Contractor.';
  /** Another build's content hash. */
  const OTHER_CONTENT = 'c0ffee00';

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

  const VISITED = `openhouse:${BUILD_CHANNEL}:visited`;

  beforeEach(() => {
    store.clear();
    // A browser that has played before: its links are ordinary runs. A first visit's link is
    // its first job (D-149), with the first job's targets (D-151): tested at the end.
    store.set(VISITED, '1');
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
    canContinue.value = false;
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

  it('says what it opened: whose house, with which crew, by their names', () => {
    open(lotLink(setup, 'http://localhost:5173/'));
    expect(notice.value).toEqual({ text: SHARED });
    notice.value = null;
    open(
      lotLink({ ...setup, clientId: 'vladislav', crewId: 'architect' }, 'http://localhost:5173/'),
    );
    expect(notice.value).toEqual({
      text: 'A shared lot: you’re building for Count Vladislav with the Architect.',
    });
    // A ?client= link without a seed starts a random lot.
    notice.value = null;
    open('http://localhost:5173/?client=barkers');
    expect(notice.value).toEqual({
      text: 'A new lot: you’re building for the Barkers with the General Contractor.',
    });
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
    // The note can go back to it: it's from this build.
    expect(notice.value).toEqual({
      text: `${SHARED} Your run in progress was put aside.`,
      oldCode: theirs,
      goBack: true,
    });
    expect(store.get(PREVIOUS)).toBe(theirs);
    // The new run takes the save's place.
    expect(store.get(SAVE)).not.toContain(theirs);
  });

  /** A run on `seed` with one week passed, as its code, from this build or another one. */
  const oneWeek = (seed: string, build = BUILD_SHA, contentHash = CONTENT_HASH) =>
    encodeRunCode({
      build,
      contentHash,
      setup: { ...setup, seed },
      actions: [{ t: 'pass' }],
    });

  it('goes back to the run that was put aside, straight after the link opened', () => {
    const theirs = oneWeek('theirs');
    store.set(SAVE, JSON.stringify({ build: BUILD_SHA, code: theirs }));
    open(lotLink(setup, 'http://localhost:5173/'));
    appScreen.value = 'title';
    expect(restorePreviousRun(notice.value!.oldCode!)).toBe(true);
    expect(appScreen.value).toBe('game');
    expect(run.value.setup.seed).toBe('theirs');
    expect(log.value).toEqual([{ t: 'pass' }]);
    // It's the saved run again; the link's run had no weeks, so there's nothing to keep of it.
    expect(JSON.parse(store.get(SAVE)!).code).toBe(theirs);
    expect(notice.value).toEqual({ text: 'You’re back in your run.' });
  });

  it("puts the link's run aside in turn once it has a week, so the two swap back", () => {
    const theirs = oneWeek('theirs');
    store.set(SAVE, JSON.stringify({ build: BUILD_SHA, code: theirs }));
    open(lotLink(setup, 'http://localhost:5173/'));
    expect(dispatch({ t: 'pass' })).toBe(true);
    const links = JSON.parse(store.get(SAVE)!).code as string;
    restorePreviousRun(theirs);
    expect(run.value.setup.seed).toBe('theirs');
    expect(notice.value).toEqual({
      text: 'You’re back in your run. The other run was put aside.',
      oldCode: links,
      goBack: true,
    });
    expect(store.get(PREVIOUS)).toBe(links);
    restorePreviousRun(links);
    expect(run.value.setup).toEqual(setup);
    expect(log.value).toEqual([{ t: 'pass' }]);
    expect(notice.value?.oldCode).toBe(theirs);
  });

  it('offers only the code of a run from an older build, which may not replay', () => {
    const old = oneWeek('theirs', 'older00');
    store.set(SAVE, JSON.stringify({ build: 'older00', code: old }));
    open(lotLink(setup, 'http://localhost:5173/'));
    expect(notice.value).toEqual({
      text: `${SHARED} Your run in progress was put aside.`,
      oldCode: old,
    });
    expect(notice.value?.goBack).toBeUndefined();
  });

  /** A run on `seed` passed week after week until the client walks, as its code. */
  function walkedAway(seed: string, build = BUILD_SHA, contentHash = CONTENT_HASH): string {
    const actions: { t: 'pass' }[] = [];
    let s = rules.newRun({ ...setup, seed });
    while (s.screen === 'build' && actions.length < 60) {
      actions.push({ t: 'pass' });
      s = rules.apply(s, { t: 'pass' }).state;
    }
    expect(s.screen).toBe('lost');
    return encodeRunCode({
      build,
      contentHash,
      setup: { ...setup, seed },
      actions,
    });
  }

  it('says nothing of a saved run that was already over: nothing was in progress', () => {
    store.set(SAVE, JSON.stringify({ build: BUILD_SHA, code: walkedAway('theirs') }));
    open(lotLink(setup, 'http://localhost:5173/'));
    expect(run.value.setup).toEqual(setup);
    expect(notice.value).toEqual({ text: SHARED });
    expect(store.has(PREVIOUS)).toBe(false);
  });

  it("says the game updated for a run in progress that can't carry over, and nothing for one that was over", () => {
    // Another build's content: its runs can't carry over (D-068).
    const old = oneWeek('theirs', 'older00', OTHER_CONTENT);
    store.set(SAVE, JSON.stringify({ build: 'older00', code: old }));
    open('http://localhost:5173/');
    expect(appScreen.value).toBe('title');
    // No way back here: an older build's run may stop replaying.
    expect(notice.value).toEqual({
      text: 'The game updated, so your last run couldn’t continue.',
      oldCode: old,
    });
    expect(notice.value?.goBack).toBeUndefined();
    notice.value = null;
    store.clear();
    store.set(
      SAVE,
      JSON.stringify({ build: 'older00', code: walkedAway('theirs', 'older00', OTHER_CONTENT) }),
    );
    open('http://localhost:5173/');
    expect(appScreen.value).toBe('title');
    expect(notice.value).toBeNull();
    expect(store.has(PREVIOUS)).toBe(false);
  });

  it("keeps the run when the crash screen's Start a new run replaces it", () => {
    const theirs = oneWeek('theirs');
    store.set(SAVE, JSON.stringify({ build: BUILD_SHA, code: theirs }));
    open('http://localhost:5173/');
    expect(run.value.setup.seed).toBe('theirs');
    crash.value = { message: 'boom' };
    newRunAfterCrash();
    expect(crash.value).toBeNull();
    expect(appScreen.value).toBe('game');
    expect(run.value.setup.seed).not.toBe('theirs');
    expect(log.value).toEqual([]);
    expect(store.get(PREVIOUS)).toBe(theirs);
    expect(notice.value).toEqual({
      text: 'Your run in progress was put aside.',
      oldCode: theirs,
      goBack: true,
    });
  });

  it('says nothing of a save with no weeks played', () => {
    const fresh = encodeRunCode({
      build: BUILD_SHA,
      contentHash: CONTENT_HASH,
      setup: { ...setup, seed: 'fresh' },
      actions: [],
    });
    store.set(SAVE, JSON.stringify({ build: BUILD_SHA, code: fresh }));
    open(lotLink(setup, 'http://localhost:5173/'));
    expect(notice.value).toEqual({ text: SHARED });
    expect(store.has(PREVIOUS)).toBe(false);
  });

  describe('a save from another build (D-068)', () => {
    const theirs: RunSetup = { ...setup, seed: 'theirs' };
    /**
     * Three weeks built on their lot, the first legal placement each week (after a reroll in
     * the 0-based week `rerollIn`, if given), and what save() keeps beside the code (store.ts):
     * the run's week, Wow, budget and pieces.
     */
    function threeWeeks(rerollIn?: number) {
      const actions: Action[] = [];
      let built = rules.newRun(theirs);
      for (let week = 0; week < 3; week++) {
        if (week === rerollIn) {
          actions.push({ t: 'reroll' });
          built = rules.apply(built, { t: 'reroll' }).state;
        }
        const place = rules.legalActions(built).find((a) => a.t === 'place') ?? { t: 'pass' };
        actions.push(place);
        built = rules.apply(built, place).state;
      }
      const check = {
        week: built.week,
        score: built.score,
        budget: built.budget,
        pieces: built.house.pieces.length,
      };
      return { actions, check };
    }
    const { actions, check } = threeWeeks();
    const CARRIED = 'The game updated, and your run carried over.';
    const DROPPED = 'The game updated, so your last run couldn’t continue.';

    /**
     * Saves the run (or `acts`) as an older build would have: its code stamped with that build,
     * and the check beside it (`null` for a save from before the check was kept). Returns the
     * code.
     */
    function olderSave(
      opts: { contentHash?: string; acts?: Action[]; extra?: Action[]; check?: unknown } = {},
    ): string {
      const code = encodeRunCode({
        build: 'older00',
        contentHash: opts.contentHash ?? CONTENT_HASH,
        setup: theirs,
        actions: [...(opts.acts ?? actions), ...(opts.extra ?? [])],
      });
      const saved = { build: 'older00', code };
      store.set(
        SAVE,
        JSON.stringify(opts.check === null ? saved : { ...saved, check: opts.check ?? check }),
      );
      return code;
    }

    /** Opens the page: it starts a fresh run, keeping the saved code in the browser and the note. */
    function droppedFor(code: string): void {
      open('http://localhost:5173/');
      expect(appScreen.value).toBe('title');
      expect(canContinue.value).toBe(false);
      expect(run.value.setup.seed).not.toBe('theirs');
      expect(log.value).toEqual([]);
      expect(notice.value).toEqual({ text: DROPPED, oldCode: code });
      expect(store.get(PREVIOUS)).toBe(code);
    }

    it('carries a run in progress over when this build plays it out the same', () => {
      // A check worth the name: three pieces that have earned some Wow.
      expect(check.pieces).toBe(3);
      expect(check.score).toBeGreaterThan(0);
      olderSave();
      open('http://localhost:5173/');
      // The title offers Continue, and the note says why the run is still there.
      expect(appScreen.value).toBe('title');
      expect(canContinue.value).toBe(true);
      expect(run.value.setup).toEqual(theirs);
      expect(log.value).toEqual(actions);
      expect(notice.value).toEqual({ text: CARRIED });
      expect(store.has(PREVIOUS)).toBe(false);
      // It's this build's save now, with its check.
      const now = JSON.parse(store.get(SAVE)!);
      expect(now.build).toBe(BUILD_SHA);
      expect(now.check).toEqual(check);
      const code = decodeRunCode(now.code);
      expect(code.ok && code.data.build).toBe(BUILD_SHA);
      expect(code.ok && code.data.actions).toEqual(actions);
    });

    it('carries over a save from before the check was kept, on its content and a clean replay', () => {
      olderSave({ check: null });
      open('http://localhost:5173/');
      expect(canContinue.value).toBe(true);
      expect(log.value).toEqual(actions);
      expect(notice.value).toEqual({ text: CARRIED });
    });

    // A reroll deals other cards since D-132's note of 2026-11-11, so the same actions can replay
    // cleanly to a house the player never built. Only a check catches that (the user's call).
    const rerolled = threeWeeks(1);

    it('starts fresh from a save before the check was kept that used a reroll', () => {
      expect(rerolled.actions).toContainEqual({ t: 'reroll' });
      droppedFor(olderSave({ acts: rerolled.actions, check: null }));
      // The same lot's save without the reroll still carries over.
      notice.value = null;
      store.clear();
      olderSave({ check: null });
      open('http://localhost:5173/');
      expect(canContinue.value).toBe(true);
      expect(log.value).toEqual(actions);
      expect(notice.value).toEqual({ text: CARRIED });
    });

    it('leaves a save with a check that used a reroll to its check', () => {
      olderSave({ acts: rerolled.actions, check: rerolled.check });
      open('http://localhost:5173/');
      expect(canContinue.value).toBe(true);
      expect(log.value).toEqual(rerolled.actions);
      expect(notice.value).toEqual({ text: CARRIED });
      // A fresh page load: nothing carried over yet.
      notice.value = null;
      canContinue.value = false;
      store.clear();
      droppedFor(
        olderSave({
          acts: rerolled.actions,
          check: { ...rerolled.check, score: rerolled.check.score + 1 },
        }),
      );
    });

    it('carries a finished run over without a note: there was nothing to continue', () => {
      const over = walkedAway('theirs', 'older00');
      store.set(SAVE, JSON.stringify({ build: 'older00', code: over }));
      open('http://localhost:5173/');
      expect(run.value.screen).toBe('lost');
      expect(canContinue.value).toBe(false);
      expect(notice.value).toBeNull();
      expect(store.has(PREVIOUS)).toBe(false);
    });

    it("doesn't carry over a run made with other content", () => {
      droppedFor(olderSave({ contentHash: OTHER_CONTENT }));
    });

    it("doesn't carry over a run this build can't replay to the end", () => {
      // The shop isn't open in week 4, so this build stops at the last action.
      droppedFor(olderSave({ extra: [{ t: 'leaveShop' }] }));
    });

    it("doesn't carry over a run this build plays out differently", () => {
      droppedFor(olderSave({ check: { ...check, score: check.score + 1 } }));
      notice.value = null;
      store.clear();
      droppedFor(olderSave({ check: { ...check, pieces: 2 } }));
      notice.value = null;
      store.clear();
      // A check that can't be read is no match either.
      droppedFor(olderSave({ check: 'garbled' }));
    });
  });

  it('is a first visit’s first job: the same lot and hand, with gentler targets (D-151)', () => {
    store.delete(VISITED);
    forgetFirstVisit();
    open(lotLink(setup, 'http://localhost:5173/'));
    expect(run.value.setup).toEqual({ ...setup, mode: 'firstJob' });
    // Everything the run started with is a standard run's but its setup, and so its targets,
    // and the standing stock, which comes to a first job later (D-162).
    const plain = rules.newRun(setup);
    expect(run.value.reserve).toEqual([]);
    expect({ ...run.value, setup, reserve: plain.reserve }).toEqual(plain);
    expect(rules.target(run.value)).toBeLessThan(rules.target(plain));
    forgetFirstVisit();
  });
});
