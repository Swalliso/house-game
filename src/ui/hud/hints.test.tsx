// The controls strip's F hint (playtest 5a): it says what F does now. With Fit on, F goes back
// to the zoom from before (camera.ts toggleFit), so the strip says so, during the run and after
// it, instead of offering to fit the lot again.

import type { ComponentChildren, VNode } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { zoom } from '../board/camera.ts';
import { busy } from '../fx/director.ts';
import { run, selected, tool } from '../store.ts';
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
