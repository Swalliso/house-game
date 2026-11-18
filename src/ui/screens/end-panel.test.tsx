// The end panel's buttons (D-152, playtest 2026-11-11): Copy run code sits on the plank beside
// "Job done!" ("Run over"), where it's in view as the screen comes up, not under the stats. After
// a loss, Try this lot again and the "Next time" tip come straight under the verdict, before the
// milestones; after a win, Play this lot again stays under the stats, over Title.

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../../rules/index.ts';
import { run } from '../store.ts';
import { EndPanel } from './EndScreen.tsx';

type Host = VNode<Record<string, unknown>>;

/** The lists measure the page in hooks, so the walk names them instead of calling them. */
const MEASURED = new Set(['Milestones', 'Stats']);

/**
 * The panel's tree in document order: each host element, and each measured list by its name.
 * Every other function component is called in place (none of them uses hooks).
 */
function* walk(node: ComponentChildren): Generator<Host | string> {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
    return;
  }
  const v = node as Host;
  if (typeof v.type === 'function') {
    const name = (v.type as { name: string }).name;
    if (MEASURED.has(name)) yield name;
    else yield* walk((v.type as (p: unknown) => ComponentChildren)(v.props));
    return;
  }
  yield v;
  yield* walk(v.props.children as ComponentChildren);
}

function text(node: ComponentChildren): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  const v = node as Host;
  if (typeof v.type === 'function') {
    const name = (v.type as { name: string }).name;
    return MEASURED.has(name) ? '' : text((v.type as (p: unknown) => ComponentChildren)(v.props));
  }
  return text(v.props.children as ComponentChildren);
}

const hasClass = (v: Host | string, c: string) =>
  typeof v !== 'string' &&
  String(v.props.class ?? '')
    .split(/\s+/)
    .includes(c);

/** Where each part of the panel comes, in document order. */
function places(s: RunState) {
  const parts = [...walk(EndPanel({ s }))];
  const at = (find: (v: Host | string) => boolean) => parts.findIndex(find);
  const button = (label: string) =>
    at((v) => typeof v !== 'string' && v.type === 'button' && text(v).includes(label));
  return {
    parts,
    tip: at((v) => hasClass(v, 'run-end-tip')),
    again: at((v) => hasClass(v, 'run-end-again')),
    milestones: at((v) => v === 'Milestones'),
    stats: at((v) => v === 'Stats'),
    more: at((v) => hasClass(v, 'run-end-more')),
    title: button('Title'),
  };
}

/** The plank: the panel's header, with its title and anything after it. */
function plank(s: RunState): Host {
  const head = [...walk(EndPanel({ s }))].find((v) => hasClass(v, 'panel-head'));
  if (!head || typeof head === 'string') throw new Error('no plank');
  return head;
}

const start = run.value;
/** A finished run. With no set at its last tally, a loss gets the "Next time" tip (D-150). */
const over = (screen: 'won' | 'lost'): RunState => ({ ...start, screen, lastTally: null });

describe("the end panel's plank", () => {
  for (const screen of ['won', 'lost'] as const) {
    it(`has Copy run code beside its title after a ${screen === 'won' ? 'win' : 'loss'}`, () => {
      const parts = [...walk(plank(over(screen)))];
      const title = parts.find((v) => hasClass(v, 'panel-title'));
      expect(title && text(title as Host)).toBe(screen === 'won' ? 'Job done!' : 'Run over');
      const copy = parts.find((v) => typeof v !== 'string' && v.type === 'button') as Host;
      expect(copy.props['aria-label']).toBe('Copy run code');
      expect(copy.props['data-tip']).toBe('Copy run code');
      // Its words, the long and the short (end.css shows the one the plank has room for).
      expect(text(copy)).toBe('Copy run codeCopy code');
      expect(parts.indexOf(copy)).toBeGreaterThan(parts.indexOf(title!));
    });
  }

  it('is the only Copy run code on the panel: none under the stats', () => {
    for (const screen of ['won', 'lost'] as const) {
      const { parts } = places(over(screen));
      const copies = parts.filter(
        (v) => typeof v !== 'string' && v.type === 'button' && text(v).includes('Copy run code'),
      );
      expect(copies).toHaveLength(1);
      expect(hasClass(copies[0]!, 'run-end-code')).toBe(true);
    }
  });
});

describe("the end panel's order", () => {
  it('after a loss, has Try this lot again and the tip before the milestones', () => {
    const p = places(over('lost'));
    expect(p.tip).toBeGreaterThan(-1);
    expect(text(p.parts[p.again] as Host)).toContain('Try this lot again');
    // The button leads: on a short window the tip's lines would push it under the sticky bar.
    expect(p.again).toBeLessThan(p.tip);
    expect(p.tip).toBeLessThan(p.milestones);
    expect(p.milestones).toBeLessThan(p.stats);
    // Title stays under the stats, on its own there.
    expect(p.stats).toBeLessThan(p.more);
    expect(p.more).toBeLessThan(p.title);
    expect(text(p.parts[p.more] as Host)).toBe('Title');
  });

  it('after a win, keeps Play this lot again under the stats, over Title', () => {
    const p = places(over('won'));
    expect(p.tip).toBe(-1);
    expect(text(p.parts[p.again] as Host)).toContain('Play this lot again');
    expect(p.milestones).toBeLessThan(p.stats);
    expect(p.stats).toBeLessThan(p.more);
    expect(p.more).toBeLessThan(p.again);
    expect(p.again).toBeLessThan(p.title);
  });
});
