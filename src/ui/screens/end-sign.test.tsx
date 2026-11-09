// The run-end sign, the milestone's banner and the notes (playtest 5a): once the run is over,
// the replay's note and "Run code copied" sit just under the board's "It's a house." sign, in
// its column, instead of over it, and while a banner is up they sit just under it. Otherwise,
// and on the title, notes stay where they were (D-098). A note goes once the run moves on from
// the week and screen it came up in (M4). Also the stats' icon slots, which line their labels
// up.

import type { ComponentChildren, VNode } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { banner, busy } from '../fx/director.ts';
import { menuOpen, toast } from '../hud/actions.ts';
import { appScreen, notice, run } from '../store.ts';
import { ICON_SIZES } from '../theme/art.ts';
import { EndCaption, iconSlots } from './EndScreen.tsx';
import { endSignShown, MilestoneBanner, ModalToast, Notes, notesUnder } from './Overlays.tsx';

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

const classes = (v: VNode<Record<string, unknown>>) => String(v.props.class ?? '').split(/\s+/);
/** Each host element's first class, in document order. */
const outline = (node: ComponentChildren) => [...walk(node)].map((v) => classes(v)[0]);

const start = run.value;
function over(screen: 'won' | 'lost' | 'build' | 'shop'): void {
  appScreen.value = 'game';
  run.value = { ...start, screen };
}

afterEach(() => {
  run.value = start;
  appScreen.value = 'title';
  busy.value = false;
  banner.value = null;
  notice.value = null;
  toast.value = null;
  menuOpen.value = false;
});

describe('notes and the run-end sign', () => {
  it('puts the replay note under the sign once the run is over', () => {
    over('won');
    notice.value = { text: 'Replayed 49 actions.' };
    expect(endSignShown()).toBe(true);
    // The board's own notes step aside...
    expect(Notes({})).toBeNull();
    // ...for the sign's column: the sign, then the note.
    const sign = EndCaption();
    const order = outline(sign);
    expect(order.indexOf('run-end-caption')).toBeGreaterThan(-1);
    expect(order.indexOf('notes')).toBeGreaterThan(order.indexOf('run-end-caption'));
    const notes = [...walk(sign)].find((v) => classes(v).includes('notes'))!;
    expect(classes(notes)).toContain('under-sign');
    expect(text(notes)).toContain('Replayed 49 actions.');
  });

  it('puts "Run code copied" under the sign too, after a loss as after a win', () => {
    over('lost');
    toast.value = { id: 1, text: 'Run code copied' };
    expect(Notes({})).toBeNull();
    const notes = [...walk(EndCaption())].find((v) => classes(v).includes('under-sign'));
    expect(notes && text(notes)).toBe('Run code copied');
  });

  it('puts notes under the run-end banner while it plays, and at the top during the tally', () => {
    over('won');
    notice.value = { text: 'Replayed 48 actions.' };
    banner.value = { id: 1, title: 'Final Walkthrough complete', detail: '', tone: 'good' };
    expect(EndCaption()).toBeNull();
    expect(notesUnder()).toBe('banner');
    // The board's own notes step aside for the banner's column: the ribbon, then the note.
    expect(Notes({})).toBeNull();
    const place = MilestoneBanner();
    const order = outline(place);
    expect(order.indexOf('notes')).toBeGreaterThan(order.indexOf('banner'));
    const notes = [...walk(place)].find((v) => classes(v).includes('notes'))!;
    expect(classes(notes)).toContain('under-banner');
    expect(text(notes)).toContain('Replayed 48 actions.');
    banner.value = null;
    busy.value = true;
    expect(EndCaption()).toBeNull();
    expect(Notes({})).not.toBeNull();
  });

  it('puts notes under a milestone’s banner during the run, and leaves them otherwise', () => {
    over('build');
    notice.value = { text: 'Replayed 4 actions.' };
    banner.value = { id: 2, title: 'Groundbreaking complete!', detail: '', tone: 'good' };
    expect(Notes({})).toBeNull();
    const notes = [...walk(MilestoneBanner())].find((v) => classes(v).includes('notes'));
    expect(notes && classes(notes)).toContain('under-banner');
    banner.value = null;
    expect(classes(Notes({}) as VNode<Record<string, unknown>>)).not.toContain('under-banner');
  });

  it('leaves notes where they were during the run', () => {
    for (const screen of ['build', 'shop'] as const) {
      over(screen);
      notice.value = { text: 'A note' };
      expect(endSignShown()).toBe(false);
      const notes = Notes({}) as VNode<Record<string, unknown>>;
      expect(classes(notes)).toContain('notes');
      expect(classes(notes)).not.toContain('under-sign');
      expect(Notes({ under: 'sign' })).toBeNull();
      expect(Notes({ under: 'banner' })).toBeNull();
    }
  });

  it('puts a toast raised from the menu under the sign, over the menu’s scrim', () => {
    over('won');
    menuOpen.value = true;
    toast.value = { id: 3, text: 'Run code copied' };
    // Not among the sign's notes (they'd sit under the scrim), but in the toast's own layer.
    expect([...walk(EndCaption())].some((v) => classes(v).includes('toast'))).toBe(false);
    expect(classes(ModalToast() as VNode<Record<string, unknown>>)).toContain('under-sign');
    over('build');
    expect(classes(ModalToast() as VNode<Record<string, unknown>>)).not.toContain('under-sign');
  });

  it('shows notes on the title even when the last run was over', () => {
    run.value = { ...start, screen: 'won' };
    appScreen.value = 'title';
    notice.value = { text: 'That run couldn’t start.' };
    expect(endSignShown()).toBe(false);
    expect(Notes({})).not.toBeNull();
  });
});

describe('a note, as the run moves on (M4)', () => {
  it('stays through its week and goes once the week is played', () => {
    over('build');
    notice.value = { text: 'Replayed 4 actions.' };
    // The run changing within its week and screen (a cheat's budget) leaves it.
    run.value = { ...run.value, budget: run.value.budget + 1 };
    expect(notice.value?.text).toBe('Replayed 4 actions.');
    run.value = { ...run.value, week: run.value.week + 1 };
    expect(notice.value).toBeNull();
    expect(Notes({})).toBeNull();
  });

  it('goes once the screen moves on, and a note raised there stays until it moves again', () => {
    over('build');
    notice.value = { text: 'That piece can’t go there.' };
    run.value = { ...run.value, screen: 'changeOrder' };
    expect(notice.value).toBeNull();
    notice.value = { text: 'A note about the order' };
    run.value = { ...run.value, budget: run.value.budget + 1 };
    expect(notice.value?.text).toBe('A note about the order');
    run.value = { ...run.value, screen: 'shop' };
    expect(notice.value).toBeNull();
  });
});

describe("the stats' icons", () => {
  it('sit in slots as wide as the widest, centered on whole UI pixels', () => {
    const icons = ['House', 'clock', 'coin', 'flag', 'warn'] as const;
    const slots = iconSlots(icons);
    const widest = Math.max(...icons.map((i) => ICON_SIZES[i].w));
    icons.forEach((icon, i) => {
      const { lead, trail } = slots[i]!;
      // Every label starts the same distance from the row's start.
      expect(lead + ICON_SIZES[icon].w + trail).toBe(widest);
      expect(Number.isInteger(lead) && Number.isInteger(trail)).toBe(true);
      // Centered: an odd pixel goes to the right.
      expect(trail - lead === 0 || trail - lead === 1).toBe(true);
    });
  });
});
