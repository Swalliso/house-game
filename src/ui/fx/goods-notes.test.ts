// D-209: the notes one action brings take turns over the board. Leaving shop 1 without buying,
// with the Storage Unit and the Tool Belt (given on the ?debug panel in week 1): the saving-up
// bonus's note first, then, a `targetFlashMs` later, one note for the milestone's goods, the
// upgrades' piece and tool together. Set in one moment, the last used to replace the others.
// The next action drops any still waiting.
//
// The store and the director play a real run here, on the ?debug panel's instant tally, as
// week-stamp.test.ts does.

import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, rules, type RunSetup } from '../../rules/index.ts';
import { busy, flash, instantTally } from './director.ts';
import { FEEL } from './feel.ts';
import {
  appScreen,
  debugAction,
  endWeek,
  leaveShop,
  pickOption,
  reroll,
  run,
  startRun,
} from '../store.ts';

const SETUP: RunSetup = {
  seed: 'notes-1',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};

/** Lets the director play what's queued, and the notes' microtask run. */
async function settle(): Promise<void> {
  await vi.waitFor(() => expect(busy.value).toBe(false));
  await new Promise((r) => setTimeout(r, 0));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "a Hot Tub", "an Open House Party", "Remodel Plans: Suite": the director's phrasing. */
const phrase = (name: string) =>
  /^Remodel Plans/.test(name) ? name : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;

describe('the notes one action brings (D-209)', () => {
  let texts: string[] = [];
  let stop: () => void = () => {};

  beforeEach(() => {
    // The tally waits on frames: here they're a timer's turn.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    );
    // The tally's bursts look for their elements, and find none.
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    instantTally.value = true;
  });

  afterEach(async () => {
    stop();
    await settle();
    appScreen.value = 'title';
    instantTally.value = false;
    vi.unstubAllGlobals();
  });

  /** A run with both upgrades, at shop 1 with its Housewarming pick set aside; notes recorded. */
  async function atShop(): Promise<void> {
    appScreen.value = 'game';
    startRun(SETUP);
    await settle();
    for (const id of ['storageUnit', 'toolBelt'] as const) {
      debugAction({ t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id } });
    }
    debugAction({ t: 'debug', op: 'addScore', amount: rules.toGo(run.value) });
    await settle();
    while (run.value.screen === 'build') {
      endWeek();
      await settle();
    }
    expect(run.value.screen).toBe('shop');
    expect(run.value.offers?.pick?.source).toBe('housewarming');
    expect(pickOption(-1)).toBe(true);
    await settle();
    texts = [];
    stop = effect(() => {
      const f = flash.value;
      if (f && f.tone === 'note' && texts.at(-1) !== f.text) texts.push(f.text);
    });
  }

  it('the saving-up bonus first, then the milestone’s goods in one note', async () => {
    await atShop();
    expect(leaveShop()).toBe(true);
    await settle();
    const s = run.value;
    const piece = s.reserve.find((r) => r.upgrade === 'storageUnit')!;
    const tool = s.supplies.at(-1)!;
    expect(tool.kind).toBe('tool');
    const goods =
      `Your Storage Unit brought ${phrase(CONTENT.pieces[piece.id].name)} · ` +
      `Your Tool Belt brought ${phrase(CONTENT.tools[tool.id as keyof typeof CONTENT.tools].name)}`;
    expect(texts).toEqual([`+${CONTENT.balance.shop.skipReward} budget for saving up`]);
    await wait(FEEL.targetFlashMs + 50);
    expect(texts.slice(0, 2)).toEqual([
      `+${CONTENT.balance.shop.skipReward} budget for saving up`,
      goods,
    ]);
  });

  it('the next action drops a note still waiting', async () => {
    await atShop();
    expect(leaveShop()).toBe(true);
    await settle();
    expect(texts).toHaveLength(1);
    // A reroll, at once: the goods' note never comes (the reroll may bring its own swaps').
    expect(reroll()).toBe(true);
    await settle();
    await wait(FEEL.targetFlashMs + 50);
    expect(texts.some((t) => t.startsWith('Your Storage Unit'))).toBe(false);
  });
});
