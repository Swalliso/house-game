// The controls strip's F hint (playtest 5a): it says what F does now. With Fit on, F goes back
// to the zoom from before (camera.ts toggleFit), so the strip says so, during the run and after
// it, instead of offering to fit the lot again. And M4's keys: a change order's sheet takes
// only Enter, Esc and D, and a pack (D-106) never turns. And the supplies: a tool or a fixture
// from them is free, so the strip says how it's aimed and never offers Enter (the polish review).

import type { ComponentChildren, VNode } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { zoom } from '../board/camera.ts';
import { busy } from '../fx/director.ts';
import { movingUid, run, selected, source, tentative, tool } from '../store.ts';
import { shopHidden } from './actions.ts';
import { Hints } from './Hints.tsx';

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

const hasClass = (v: VNode<Record<string, unknown>>, c: string) =>
  String(v.props.class ?? '')
    .split(/\s+/)
    .includes(c);

/** The words beside the F keycap, or null when the strip has no F. */
function fHint(): string | null {
  for (const v of walk(Hints())) {
    if (!hasClass(v, 'hint')) continue;
    const keys = [...walk(v.props.children as ComponentChildren)].filter((k) => k.type === 'kbd');
    if (keys.length === 1 && text(keys[0]) === 'F') {
      const words = [...walk(v.props.children as ComponentChildren)].find((k) =>
        hasClass(k, 'hint-text'),
      );
      return words ? text(words) : '';
    }
  }
  return null;
}

/** Each hint on the strip: its keys, and the words beside them. */
function strip(): { keys: string[]; words: string }[] {
  const out: { keys: string[]; words: string }[] = [];
  for (const v of walk(Hints())) {
    if (!hasClass(v, 'hint')) continue;
    const inside = [...walk(v.props.children as ComponentChildren)];
    const words = inside.find((k) => hasClass(k, 'hint-text'));
    out.push({
      keys: inside.filter((k) => k.type === 'kbd').map((k) => text(k)),
      words: words ? text(words) : '',
    });
  }
  return out;
}

const start = run.value;
function on(screen: typeof start.screen): void {
  run.value = { ...start, screen };
}

afterEach(() => {
  run.value = start;
  zoom.value = null;
  busy.value = false;
  shopHidden.value = false;
  selected.value = null;
  source.value = 'hand';
  tentative.value = null;
  movingUid.value = null;
  tool.value = 'build';
});

describe('the F hint', () => {
  it('offers Fit after the run, and the way back once it is on', () => {
    for (const screen of ['won', 'lost'] as const) {
      on(screen);
      expect(fHint()).toBe('fit the lot');
      zoom.value = 'fit';
      expect(fHint()).toBe('back to your zoom');
      zoom.value = null;
    }
  });

  it('does the same over a hidden shop', () => {
    on('shop');
    shopHidden.value = true;
    expect(fHint()).toBe('fit the lot');
    zoom.value = 'fit';
    expect(fHint()).toBe('back to your zoom');
    // With the shop's sheet up, F isn't offered at all.
    shopHidden.value = false;
    expect(fHint()).toBeNull();
  });

  it('keeps to a short word on the build screen, whose strip has to stay one line', () => {
    on('build');
    expect(fHint()).toBe('fit');
    zoom.value = 'fit';
    // "zoom back", or "fit" on a window too small for it (hints.css shows one of the two).
    const words = [...walk(Hints())].filter(
      (v) => hasClass(v, 'fit-long') || hasClass(v, 'fit-short'),
    );
    expect(words.map((v) => [v.props.class, text(v)])).toEqual([
      ['fit-long', 'zoom back'],
      ['fit-short', 'fit'],
    ]);
    // A zoom the player picked isn't Fit: F fits the lot again.
    zoom.value = 2;
    expect(fHint()).toBe('fit');
  });

  it('leaves F out while a tally plays or a card is picked', () => {
    on('won');
    busy.value = true;
    expect(fHint()).toBeNull();
    busy.value = false;
    on('build');
    selected.value = 0;
    expect(fHint()).toBeNull();
  });
});

describe("the strip's keys for M4's plays", () => {
  it("offers the change orders' keys, and no F, which does nothing on their sheet", () => {
    run.value = {
      ...start,
      screen: 'changeOrder',
      offers: { changeOrder: { ids: ['workingFromHome', 'heatWave'], phase: 0 } },
    };
    expect(strip()).toEqual([{ keys: ['1', '2'], words: 'pick one' }]);
    expect(fHint()).toBeNull();
  });

  it('offers Enter on an order offered alone (D-144)', () => {
    run.value = {
      ...start,
      screen: 'changeOrder',
      offers: { changeOrder: { ids: ['heatWave'], phase: 0 } },
    };
    expect(strip()).toEqual([{ keys: ['Enter'], words: 'accept' }]);
  });

  it('leaves R out for a pack, which is clicked out a tile at a time', () => {
    run.value = { ...start, screen: 'build', hand: [{ kind: 'piece', id: 'fence' }] };
    selected.value = 0;
    // Held with nothing clicked out, Enter passes the week, as the button says.
    expect(strip()).toEqual([
      { keys: ['Click'], words: 'the first tile' },
      { keys: ['Enter'], words: 'pass' },
      { keys: ['Esc'], words: 'put it back' },
    ]);
    // With tiles clicked out, a click adds or takes one off, and Esc clears them all.
    tentative.value = { t: 'place', from: 'hand', i: 0, x: 4, y: 4, rot: 0, shape: ['##'] };
    expect(strip()).toEqual([
      { keys: ['Click'], words: 'add or take off a tile' },
      { keys: ['Enter'], words: 'end the week' },
      { keys: ['Esc'], words: 'clear the tiles' },
    ]);
  });

  it('turns a room, and says when End week renovates one, which has nothing to turn', () => {
    run.value = { ...start, screen: 'build', hand: [{ kind: 'piece', id: 'bedroom' }] };
    selected.value = 0;
    expect(strip().map((h) => h.keys[0])).toEqual(['R', 'Click', 'Enter', 'Esc']);
    tentative.value = { t: 'renovate', from: 'hand', i: 0, uid: 1 };
    expect(strip()).toEqual([
      { keys: ['Click'], words: 'move it' },
      { keys: ['Enter'], words: 'renovate it' },
      { keys: ['Esc'], words: 'pick it up' },
    ]);
  });

  it('says install for a fixture from the hand, and keeps Enter: it is the week’s build', () => {
    run.value = { ...start, screen: 'build', hand: [{ kind: 'fixture', id: 'fireplace' }] };
    selected.value = 0;
    expect(strip()).toEqual([
      { keys: ['Click'], words: 'a piece to install it' },
      { keys: ['Enter'], words: 'pass' },
      { keys: ['Esc'], words: 'put it back' },
    ]);
    tentative.value = { t: 'install', from: 'hand', i: 0, uid: 1 };
    expect(strip().find((h) => h.keys[0] === 'Enter')?.words).toBe('end the week');
  });

  it('offers no Enter for a fixture from the supplies: installing it is free', () => {
    run.value = { ...start, screen: 'build', supplies: [{ kind: 'fixture', id: 'fireplace' }] };
    source.value = 'supplies';
    selected.value = 0;
    expect(strip()).toEqual([
      { keys: ['Click'], words: 'a piece twice to install it' },
      { keys: ['Esc'], words: 'put it back' },
    ]);
  });

  it('offers no Enter and no Click for a tool used from its panel (Rush Order)', () => {
    run.value = { ...start, screen: 'build', supplies: [{ kind: 'tool', id: 'rushOrder' }] };
    source.value = 'supplies';
    selected.value = 0;
    expect(strip()).toEqual([{ keys: ['Esc'], words: 'put it back' }]);
  });

  it('says how the Copy Machine and the Moving Truck are aimed', () => {
    run.value = {
      ...start,
      screen: 'build',
      supplies: [
        { kind: 'tool', id: 'copyMachine' },
        { kind: 'tool', id: 'movingTruck' },
      ],
    };
    source.value = 'supplies';
    selected.value = 0;
    expect(strip()).toEqual([
      { keys: ['Click'], words: 'a piece twice to copy it' },
      { keys: ['Esc'], words: 'put it back' },
    ]);
    selected.value = 1;
    expect(strip()).toEqual([
      { keys: ['Click'], words: 'the piece to move' },
      { keys: ['Esc'], words: 'put it back' },
    ]);
    // Carrying a piece: R turns it, and its new spot takes two clicks.
    movingUid.value = 1;
    expect(strip()).toEqual([
      { keys: ['R'], words: 'rotate' },
      { keys: ['Click'], words: 'its new spot twice' },
      { keys: ['Esc'], words: 'put it back' },
    ]);
  });

  it('offers R for the Moving Truck only once it carries a piece', () => {
    run.value = { ...start, screen: 'build', supplies: [{ kind: 'tool', id: 'movingTruck' }] };
    source.value = 'supplies';
    selected.value = 0;
    expect(strip().some((h) => h.keys.includes('R'))).toBe(false);
    movingUid.value = 1;
    expect(strip().some((h) => h.keys.includes('R'))).toBe(true);
  });
});

describe('the camera keys after Roofing (D-147)', () => {
  it('keeps Scroll on the build strip, and has no key for a roof', () => {
    const met = Array.from({ length: 4 }, (_, phase) => ({
      phase,
      result: 'onTime' as const,
      target: 0,
      score: 0,
      weeksSaved: 0,
      overtimeUsed: 0,
      reward: { score: 0, budget: 0, interest: 0 },
    }));
    run.value = { ...start, screen: 'build', milestones: met };
    expect(strip()).toContainEqual({ keys: ['Scroll'], words: 'zoom' });
    expect(strip().some((h) => h.keys.includes('T'))).toBe(false);
    run.value = { ...start, screen: 'won', milestones: met };
    expect(strip().some((h) => h.keys.includes('T'))).toBe(false);
  });
});

describe("the build strip's card keys", () => {
  it('numbers the whole hand, two rows of it, as keys 1–9 pick its cards (D-121)', () => {
    const card = { kind: 'piece', id: 'bedroom' } as const;
    run.value = { ...start, screen: 'build', hand: [card, card, card, card] };
    expect(strip()[0]).toEqual({ keys: ['1–4'], words: 'pick a card' });
    // The Bigger Truck or the Landscaper adds a fifth.
    run.value = { ...start, screen: 'build', hand: [card, card, card, card, card] };
    expect(strip()[0]).toEqual({ keys: ['1–5'], words: 'pick a card' });
  });
});
