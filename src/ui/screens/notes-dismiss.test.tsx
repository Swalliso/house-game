// A note docked in the change order's sheet (D-110): the sheet holds the keyboard on its text,
// so a note's Dismiss, by mouse or keyboard, puts focus back there rather than let it fall to
// the page with the button it removes. Notes stays hook-free: it's called in place here.
// And the note about a run that was put aside: it offers "Go back to it" only when the store
// says the run can come back (a run from this build), beside the code's Copy button.

import type { ComponentChildren, RefObject, VNode } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { busy } from '../fx/director.ts';
import { notesDocked } from '../hud/actions.ts';
import { appScreen, notice, run } from '../store.ts';
import { Notes } from './Overlays.tsx';

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

/** The Dismiss button's click handler in a rendered note. */
function dismissOf(tree: ComponentChildren): () => void {
  const button = [...walk(tree)].find((v) => v.props['aria-label'] === 'Dismiss');
  if (!button) throw new Error('no Dismiss');
  return button.props.onClick as () => void;
}

/** The words on each button of a rendered note, in order. */
function buttonsOf(tree: ComponentChildren): string[] {
  const words = (node: ComponentChildren): string => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    if (Array.isArray(node)) return node.map(words).join('');
    const v = node as VNode<Record<string, unknown>>;
    if (typeof v.type === 'function')
      return words((v.type as (p: unknown) => ComponentChildren)(v.props));
    return words(v.props.children as ComponentChildren);
  };
  return [...walk(tree)].filter((v) => v.type === 'button').map((v) => words(v));
}

const start = run.value;

afterEach(() => {
  run.value = start;
  appScreen.value = 'title';
  busy.value = false;
  notice.value = null;
});

describe("a note docked in the change order's sheet", () => {
  it("puts focus back on the sheet's text when its Dismiss removes it", () => {
    appScreen.value = 'game';
    run.value = { ...start, screen: 'changeOrder' };
    notice.value = { text: 'Replayed 12 actions.', oldCode: 'OH1.x' };
    expect(notesDocked.value).toBe(true);
    const focus = vi.fn();
    const text = { current: { focus } } as unknown as RefObject<HTMLElement>;
    dismissOf(Notes({ docked: true, refocus: text }))();
    expect(notice.value).toBeNull();
    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('just goes where nothing holds the keyboard (the shop, the board)', () => {
    appScreen.value = 'game';
    run.value = { ...start, screen: 'build' };
    notice.value = { text: 'A note' };
    dismissOf(Notes({}))();
    expect(notice.value).toBeNull();
  });
});

describe('the note about a run that was put aside', () => {
  it('offers the way back to a run from this build, before the code', () => {
    appScreen.value = 'game';
    run.value = { ...start, screen: 'build' };
    notice.value = { text: 'Your run in progress was put aside.', oldCode: 'OH1.x', goBack: true };
    expect(buttonsOf(Notes({}))).toEqual(['Go back to it', 'Copy the old run code', '']);
  });

  it('offers only the code otherwise (the game updated, or an older build’s run)', () => {
    appScreen.value = 'game';
    run.value = { ...start, screen: 'build' };
    notice.value = { text: 'The game updated, so your last run couldn’t continue.', oldCode: 'x' };
    expect(buttonsOf(Notes({}))).toEqual(['Copy the old run code', '']);
  });
});
