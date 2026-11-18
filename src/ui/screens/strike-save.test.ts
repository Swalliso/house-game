// A run in progress with a hand strike (D-157) survives a reload, as any other run does: its
// save's code decodes and replays on the same build, with no note and the same log.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rules } from '../../rules/index.ts';
import { BUILD_CHANNEL } from '../build-info.ts';
import { appScreen, canContinue, dispatch, loadInitialRun, log, notice, run } from '../store.ts';

describe('a save with a hand strike', () => {
  const store = new Map<string, string>();
  let address = '';
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
    store.set(`openhouse:${BUILD_CHANNEL}:visited`, '1');
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

  it('carries on after a reload, on the same build', () => {
    open('http://localhost:5173/?seed=strikesave&client=hendersons&crew=generalContractor');
    notice.value = null;
    expect(run.value.strikesLeft).toBeGreaterThan(0);
    const i = run.value.hand.findIndex((_, k) => rules.canStrikeCard(run.value, k).ok);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(dispatch({ t: 'strikeCard', i }, { keepWeek: true })).toBe(true);
    expect(dispatch({ t: 'pass' })).toBe(true);
    const actions = log.value;
    expect(actions[0]).toEqual({ t: 'strikeCard', i });
    // A reload.
    open('http://localhost:5173/');
    expect(notice.value).toBeNull();
    expect(canContinue.value).toBe(true);
    expect(log.value).toEqual(actions);
    expect(run.value.struck).toHaveLength(1);
  });
});
