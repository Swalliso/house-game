// The score panel's folded sets (D-098, amended 2026-11-08), the Wow number's fallback steps,
// and Inspect's foot (D-110's note). The folded row says how many sets, with their Comfort and
// Charm summed, lists every set with its level in its tip, a line each, lights and pops for a
// beat, counts up from 0 in a tally, and keeps "No sets yet." with the first-set suggestion as
// its tip. FoldRow and TotalLine are hook-free, so they're called in place; a Tip has hooks, so
// it's read from its props, never called.

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import { SCORE_LABELS, type SetId, type SetScore } from '../../rules/index.ts';
import { FEEL } from '../fx/feel.ts';
import { TotalLine } from './Inspect.tsx';
import { FoldRow, setsTip, wowSizeClass } from './ScorePanel.tsx';
import { Tip } from './Tip.tsx';

type Node = VNode<Record<string, unknown>>;

/** The host elements and Tips a tree renders, function components called in place. */
function* walk(node: ComponentChildren): Generator<Node> {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
    return;
  }
  const v = node as Node;
  if (v.type === Tip) {
    yield v;
    yield* walk(v.props.children as ComponentChildren);
    return;
  }
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
  const v = node as Node;
  if (typeof v.type === 'function' && v.type !== Tip)
    return text((v.type as (p: unknown) => ComponentChildren)(v.props));
  return text(v.props.children as ComponentChildren);
}

const classOf = (v: Node) => String(v.props.class ?? '');
const byClass = (tree: ComponentChildren, cls: string) =>
  [...walk(tree)].filter((v) => classOf(v).split(' ').includes(cls));

const set = (id: SetId, points: number, mult: number, k = 0): SetScore => ({
  set: id,
  key: `${id}:${k}`,
  members: [k, k + 1],
  points,
  mult,
});
const SETS = [set('jackAndJill', 11, 55), set('entertainer', 44, 165), set('suite', 28, 83)];
const LEVELS: Partial<Record<SetId, number>> = { entertainer: 2, suite: 2 };
const level = (s: SetId) => LEVELS[s] ?? 1;

describe("the score panel's folded sets", () => {
  it('say how many, with their Comfort and Charm summed at the right', () => {
    const row = FoldRow({ sets: SETS, level, lit: null });
    expect(text(byClass(row, 'set-name')[0]!)).toBe('3 sets');
    expect(text(byClass(row, 'set-comfort')[0]!)).toBe('+83');
    expect(text(byClass(row, 'set-charm')[0]!)).toBe('+3.03');
    expect(text(FoldRow({ sets: SETS.slice(0, 1), level, lit: null }))).toMatch(/^1 set\+/);
  });

  it('put commas in a big sum', () => {
    const row = FoldRow({ sets: [set('suite', 1234, 250)], level, lit: null });
    expect(text(byClass(row, 'set-comfort')[0]!)).toBe('+1,234');
  });

  it('list every set in the tip, a line each, with its level, Comfort and Charm in words', () => {
    const tip = [...walk(FoldRow({ sets: SETS, level, lit: null }))].find((v) => v.type === Tip)!;
    expect(tip.props.title).toBe('Sets');
    const { points: COMFORT, mult: CHARM } = SCORE_LABELS;
    expect(tip.props.text).toBe(
      `Jack-and-Jill: +11 ${COMFORT}, +0.55 ${CHARM}.\n` +
        `Entertainer Lv 2: +44 ${COMFORT}, +1.65 ${CHARM}.\n` +
        `Suite Lv 2: +28 ${COMFORT}, +0.83 ${CHARM}.`,
    );
    expect(setsTip(SETS, level)).toBe(tip.props.text);
  });

  it('light the row and pop its numbers for a beat, and only then', () => {
    const lit = FoldRow({ sets: SETS, level, lit: '3,4,9' });
    expect(classOf([...walk(lit)].find((v) => v.type === 'li')!)).toBe('lit');
    const values = byClass(lit, 'set-values')[0]!;
    expect(classOf(values)).toContain('popping');
    expect(values.key).toBe('3,4,9');
    expect(values.props.style).toEqual({ animationDuration: `${FEEL.checklist.tickMs}ms` });

    const rest = FoldRow({ sets: SETS, level, lit: null });
    expect(classOf([...walk(rest)].find((v) => v.type === 'li')!)).toBe('');
    expect(classOf(byClass(rest, 'set-values')[0]!)).not.toContain('popping');
  });

  it('count up from 0 in a tally, dimmed until its first set', () => {
    const waiting = FoldRow({ sets: [], level, lit: null, waiting: true });
    const li = [...walk(waiting)].find((v) => v.type === 'li')!;
    expect(classOf(li)).toBe('waiting');
    expect(text(byClass(waiting, 'set-name')[0]!)).toBe('0 sets');
    expect(text(byClass(waiting, 'set-comfort')[0]!)).toBe('+0');
    expect([...walk(waiting)].some((v) => v.type === Tip)).toBe(false);
    // The first set's beat: its numbers, lit.
    const first = FoldRow({ sets: SETS.slice(0, 1), level, lit: '1,2', waiting: false });
    expect(classOf([...walk(first)].find((v) => v.type === 'li')!)).toBe('lit');
    expect(text(byClass(first, 'set-name')[0]!)).toBe('1 set');
  });

  it('keep "No sets yet." with the first-set suggestion as its tip', () => {
    const row = FoldRow({ sets: [], level, lit: null }) as Node;
    expect(classOf(row)).toBe('sets-empty sets-fold');
    const tip = [...walk(row)].find((v) => v.type === Tip)!;
    expect(text(tip.props.children as ComponentChildren)).toBe('No sets yet.');
    expect(tip.props.text).toMatch(/Jack-and-Jill.*Entertainer/);
  });
});

describe("the Wow number's steps without CSS round()", () => {
  it('step down at four digits and at six, so it fits the narrowest column', () => {
    expect(['0', '999', '1,037', '99,999', '123,456', '1,234,567'].map(wowSizeClass)).toEqual([
      '',
      '',
      'long',
      'long',
      'longer',
      'longer',
    ]);
  });
});

describe("Inspect's foot", () => {
  it("says the week's Wow before and after the play", () => {
    const line = TotalLine({ before: 1943, after: 1780 }) as Node;
    expect(classOf(line)).toBe('total-line');
    expect(text(line)).toBe(`This week: 1,943 → 1,780 ${SCORE_LABELS.total}`);
    expect(text([...walk(line)].find((v) => v.type === 'strong')!)).toBe('1,780');
  });
});
