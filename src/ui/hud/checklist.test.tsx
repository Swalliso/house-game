// The checklist's shared parts (M4a, D-101; the pixel UI, D-110): a line's progress marks each
// part that doesn't hold with a cross icon (the pixel fonts have no ✕), and a change order's
// terms say what a phase effect changes. Both are hook-free, so they're called in place; the
// change order's sheet uses them too. And what a play being looked at scrolls into view: the
// rows it flips, or the order it breaks, and nothing for a play that does neither.

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  modifierText,
  type ChangeOrderId,
  type ChecklistLine,
  type SpecGroup,
} from '../../rules/index.ts';
import { orderTerms, playTarget, ProgressParts, type Row } from './Checklist.tsx';

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

/** An Icon's name, from its custom property (kit.tsx: `--icon: var(--art-icon-<name>)`). */
const iconOf = (v: VNode<Record<string, unknown>>) => {
  const style = v.props.style as Record<string, string> | undefined;
  return /--art-icon-(\w+)/.exec(style?.['--icon'] ?? '')?.[1];
};

describe("the checklist's progress parts", () => {
  const parts = [
    { text: '2 Bedrooms (2–3)', ok: true },
    { text: 'Bathrooms 0 of 1', ok: false },
  ];

  it('mark a part that does not hold with a cross icon, and only that part', () => {
    const tree = ProgressParts({ parts });
    const spans = [...walk(tree)].filter((v) => v.props.class === 'ok' || v.props.class === 'miss');
    expect(spans.map((s) => s.props.class)).toEqual(['ok', 'miss']);
    const icons = (s: VNode<Record<string, unknown>>) =>
      [...walk(s.props.children as ComponentChildren)].map(iconOf).filter(Boolean);
    expect(icons(spans[0]!)).toEqual([]);
    expect(icons(spans[1]!)).toEqual(['cross']);
    expect(text(tree)).toBe('2 Bedrooms (2–3) · Bathrooms 0 of 1');
  });

  it('never put a ✕ in the text', () => {
    expect(text(ProgressParts({ parts: [{ text: 'fill 0% (≥ 60%)', ok: false }] }))).not.toMatch(
      /✕/,
    );
  });
});

describe("a change order's terms", () => {
  it('say what a phase effect changes, and pass a request’s or a restriction’s through', () => {
    const ids = Object.keys(CONTENT.changeOrders) as ChangeOrderId[];
    const phase = ids.find((id) => CONTENT.changeOrders[id].kind === 'phase')!;
    const def = CONTENT.changeOrders[phase];
    if (def.kind !== 'phase') throw new Error('expected a phase effect');
    expect(orderTerms(phase, ['for the next phase'])).toEqual(
      def.modifiers.map((m) => modifierText(CONTENT, m)),
    );
    const request = ids.find((id) => CONTENT.changeOrders[id].kind === 'request')!;
    expect(orderTerms(request, ['A new Home Office'])).toEqual(['A new Home Office']);
  });
});

describe('what a play being looked at scrolls into view', () => {
  /** A row as the checklist builds it, held, and flipped by the play if `change` says so. */
  const row = (id: string, group: SpecGroup, change: Row['change'] = null): Row => {
    const line: ChecklistLine = { id, name: id, group, met: true, text: id, progress: [] };
    return { line, change, flash: undefined, pending: false };
  };
  const rows = (flip: Record<string, Row['change']> = {}): Row[] =>
    (
      [
        ['roomForEveryone', 'household'],
        ['bathrooms', 'household'],
        ['oneKitchen', 'household'],
        ['underOneRoof', 'shape'],
        ['cozy', 'shape'],
        ['tidyYard', 'yard'],
        ['fencedYard', 'wishes'],
      ] as const
    ).map(([id, g]) => row(id, g, flip[id] ?? null));

  it('leaves the checklist where it is for a play that flips nothing and breaks nothing', () => {
    // A Lawn, a Closet or a Renovation: the tastes in view stay in view (D-110).
    expect(playTarget(rows(), undefined)).toBeNull();
  });

  it('brings in the first row the play flips, with the line above it in its group', () => {
    expect(playTarget(rows({ oneKitchen: 'gained', cozy: 'lost' }), undefined)).toEqual([
      '[data-row="oneKitchen"]',
      '[data-row="bathrooms"]',
    ]);
  });

  it('takes the line below a group’s first row, and none for a row alone in its group', () => {
    expect(playTarget(rows({ underOneRoof: 'lost' }), undefined)).toEqual([
      '[data-row="underOneRoof"]',
      '[data-row="cozy"]',
    ]);
    expect(playTarget(rows({ tidyYard: 'gained' }), undefined)).toEqual(['[data-row="tidyYard"]']);
  });

  it('brings in the change order a play would break when it flips no line', () => {
    expect(playTarget(rows(), 'bigDeadline')).toEqual(['[data-order="bigDeadline"]']);
    // A flipped line comes first.
    expect(playTarget(rows({ cozy: 'gained' }), 'bigDeadline')?.[0]).toBe('[data-row="cozy"]');
  });
});
