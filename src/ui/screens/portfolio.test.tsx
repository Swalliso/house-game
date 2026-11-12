// The Portfolio's "Play this lot again" (D-139, 2026-11-11): each house starts a new run on its
// lot, for the same client with the same crew, straight into the game with the sheet closed. A run
// in progress would be lost, so it asks first, as the title's New run does. A house whose client
// or crew this build no longer has gets no button. House is hook-free, so it's called in place.

import type { ComponentChildren, VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rules, type RunSetup } from '../../rules/index.ts';
import { company, emptyCompany, type Job } from '../company.ts';
import { portfolioOpen } from '../hud/actions.ts';
import { appScreen, log, run } from '../store.ts';
import { House } from './Portfolio.tsx';

/** The host elements a tree renders, function components called in place (none use hooks). */
function* walk(node: ComponentChildren): Generator<VNode<Record<string, unknown>>> {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
    return;
  }
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function') {
    yield* walk((v.type as (p: unknown) => ComponentChildren)(v.props));
    return;
  }
  yield v;
  yield* walk(v.props.children as ComponentChildren);
}

function text(node: ComponentChildren): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function')
    return text((v.type as (p: unknown) => ComponentChildren)(v.props));
  return text(v.props.children as ComponentChildren);
}

/** A house's Play this lot again button, if it shows one. */
function againButton(job: Job): VNode<Record<string, unknown>> | undefined {
  return [...walk(House({ job }))].find(
    (v) =>
      v.type === 'button' && text(v.props.children as ComponentChildren) === 'Play this lot again',
  );
}

/** Clicks a house's Play this lot again. */
function playAgain(job: Job): void {
  const button = againButton(job);
  if (!button) throw new Error('no Play this lot again');
  (button.props.onClick as () => void)();
}

const job: Job = {
  seed: 'lot42',
  clientId: 'vladislav',
  crewId: 'architect',
  won: true,
  score: 12345,
  verdict: 'Charmer',
  milestones: 7,
  phases: 7,
  at: 0,
};
const itsSetup: RunSetup = {
  seed: 'lot42',
  clientId: 'vladislav',
  crewId: 'architect',
  mode: 'standard',
};
const other: RunSetup = {
  seed: 'other',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};

const start = { run: run.value, log: log.value };
let confirm: ReturnType<typeof vi.fn<(question: string) => boolean>>;

beforeEach(() => {
  confirm = vi.fn<(question: string) => boolean>(() => true);
  vi.stubGlobal('window', { confirm });
  // A browser with a house in its portfolio has finished one: its first visit is over, so a
  // lot played again is an ordinary run, not a first job (D-149, D-151).
  company.value = { ...emptyCompany(), built: 1 };
  // On the title, with the sheet open over it.
  appScreen.value = 'title';
  portfolioOpen.value = true;
});
afterEach(() => {
  vi.unstubAllGlobals();
  company.value = emptyCompany();
  run.value = start.run;
  log.value = start.log;
  appScreen.value = 'title';
  portfolioOpen.value = false;
});

describe("a portfolio house's Play this lot again", () => {
  it('starts a run on its lot, for its client with its crew, and closes the sheet', () => {
    // Nothing in progress: a run with no weeks played.
    run.value = rules.newRun(other);
    log.value = [];
    playAgain(job);
    expect(confirm).not.toHaveBeenCalled();
    expect(run.value).toEqual(rules.newRun(itsSetup));
    expect(log.value).toEqual([]);
    expect(portfolioOpen.value).toBe(false);
    expect(appScreen.value).toBe('game');
  });

  it('asks first when a run is in progress, and leaves it be on a no', () => {
    const playing = rules.apply(rules.newRun(other), { t: 'pass' }).state;
    run.value = playing;
    log.value = [{ t: 'pass' }];
    confirm.mockReturnValue(false);
    playAgain(job);
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0]![0]).toBe(
      'Play this lot again? The run in progress will be lost.',
    );
    expect(run.value).toBe(playing);
    expect(portfolioOpen.value).toBe(true);
    expect(appScreen.value).toBe('title');
    // A yes starts the lot.
    confirm.mockReturnValue(true);
    playAgain(job);
    expect(run.value).toEqual(rules.newRun(itsSetup));
    expect(portfolioOpen.value).toBe(false);
    expect(appScreen.value).toBe('game');
  });

  it("doesn't ask about a run that's over: its house is already in the portfolio", () => {
    run.value = { ...rules.newRun(other), screen: 'won' };
    log.value = [{ t: 'pass' }];
    playAgain(job);
    expect(confirm).not.toHaveBeenCalled();
    expect(run.value.setup).toEqual(itsSetup);
  });

  it('is left out when this build no longer has the client or the crew', () => {
    expect(againButton(job)).toBeDefined();
    expect(againButton({ ...job, clientId: 'retiredClient' })).toBeUndefined();
    expect(againButton({ ...job, crewId: 'retiredCrew' })).toBeUndefined();
  });

  it('names the house it plays for a screen reader, beginning with the words it shows', () => {
    expect(againButton(job)!.props['aria-label']).toBe(
      'Play this lot again: Count Vladislav, Architect',
    );
  });
});
