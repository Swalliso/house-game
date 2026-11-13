// The checklist's shared parts (M4a, D-101; the pixel UI, D-110): a line's progress marks each
// part that doesn't hold with a cross icon (the pixel fonts have no ✕), and a change order's
// terms say what a phase effect changes. Both are hook-free, so they're called in place; the
// change order's sheet uses them too. And what a play being looked at scrolls into view: the
// rows it flips, or the order it breaks, or for a play that does neither, the house rules' first
// two rows, which the checklist brings into view only while the tastes are folded (D-110).

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  modifierText,
  type ChangeOrderId,
  type ChecklistLine,
  type SpecGroup,
} from '../../rules/index.ts';
import {
  houseRuleRows,
  orderTerms,
  playTarget,
  ProgressParts,
  type Row,
  rulesOpen,
  shownParts,
  wishesFold,
} from './Checklist.tsx';

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

describe('the progress a line shows (D-142)', () => {
  const roof = [
    { text: '2 rooms (≥ 4)', ok: false },
    { text: 'fill 58% (≥ 60%)', ok: false },
    { text: 'box 4 × 3 (≤ 2:1)', ok: true },
  ];

  it('is only what is still missing, for a line that does not hold yet', () => {
    expect(shownParts({ met: false, progress: roof }, null).map((p) => p.text)).toEqual([
      '2 rooms (≥ 4)',
      'fill 58% (≥ 60%)',
    ]);
  });

  it('is every part for a line the play being looked at flips, and for one that holds', () => {
    expect(shownParts({ met: false, progress: roof }, 'gained')).toBe(roof);
    expect(shownParts({ met: true, progress: roof }, 'lost')).toBe(roof);
    expect(shownParts({ met: true, progress: roof }, null)).toBe(roof);
  });

  it('keeps every part where none is marked missing, so the line never goes blank', () => {
    const held = [{ text: 'beside each other', ok: true }];
    expect(shownParts({ met: false, progress: held }, null)).toBe(held);
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

  it('takes the rest it is given for a play that flips nothing and breaks nothing', () => {
    // A Lawn, a Closet or a Renovation: the house rules' first two rows, which the checklist
    // brings into view only while the tastes are folded, so tastes in view stay in view (D-110).
    expect(playTarget(rows(), undefined)).toBeNull();
    const rest = houseRuleRows(rows(), () => false);
    expect(playTarget(rows(), undefined, rest)).toBe(rest);
    // A flip or a break comes first.
    expect(playTarget(rows({ cozy: 'gained' }), undefined, rest)?.[0]).toBe('[data-row="cozy"]');
    expect(playTarget(rows(), 'bigDeadline', rest)).toEqual(['[data-order="bigDeadline"]']);
  });

  it("finds the house rules' first two rows as they show: a folded group is its one row", () => {
    expect(houseRuleRows(rows(), () => false)).toEqual([
      '[data-row="roomForEveryone"]',
      '[data-row="bathrooms"]',
    ]);
    expect(houseRuleRows(rows(), (g) => g === 'household')).toEqual([
      '[data-fold="household"]',
      '[data-row="underOneRoof"]',
    ]);
    expect(houseRuleRows(rows(), (g) => g !== 'yard')).toEqual([
      '[data-fold="household"]',
      '[data-fold="shape"]',
    ]);
    // Never a wish.
    const yardOnly = rows().filter((r) => r.line.group === 'yard' || r.line.group === 'wishes');
    expect(houseRuleRows(yardOnly, () => false)).toEqual(['[data-row="tidyYard"]']);
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

  it('folds the house rules into their row unless a line flips, the player opens them, or it’s a first visit', () => {
    // Playtest 4: folded by default, so Inspect gets the room.
    expect(rulesOpen(rows(), null, false, false)).toBe(false);
    // Open on a first visit (the checklist's first hint not yet dismissed), and as picked.
    expect(rulesOpen(rows(), null, true, false)).toBe(true);
    expect(rulesOpen(rows(), true, false, false)).toBe(true);
    expect(rulesOpen(rows(), false, true, false)).toBe(false);
    // A play that turns a rule on or off opens them, even folded by hand; a wish doesn't.
    expect(rulesOpen(rows({ cozy: 'lost' }), false, false, false)).toBe(true);
    expect(rulesOpen(rows({ fencedYard: 'gained' }), false, false, false)).toBe(false);
    // So does a tally that flipped one, until it ends.
    expect(rulesOpen(rows(), false, false, true)).toBe(true);
    // With no house rules there's nothing to fold.
    expect(
      rulesOpen(
        rows().filter((r) => r.line.group === 'wishes'),
        false,
        false,
        false,
      ),
    ).toBe(true);
  });

  it('brings in the change order a play would break when it flips no line', () => {
    expect(playTarget(rows(), 'bigDeadline')).toEqual(['[data-order="bigDeadline"]']);
    // A flipped line comes first.
    expect(playTarget(rows({ cozy: 'gained' }), 'bigDeadline')?.[0]).toBe('[data-row="cozy"]');
  });
});

describe('the wishes that hold fold into their row (D-167)', () => {
  /** A wish as the checklist builds its row: held or not, flipped or lit if asked. */
  const wish = (id: string, met: boolean, extra: Partial<Row> = {}): Row => ({
    line: { id, name: id, group: 'wishes', met, text: id, progress: [] },
    change: null,
    flash: undefined,
    pending: false,
    ...extra,
  });
  const ids = (rs: readonly Row[]) => rs.map((r) => r.line.id);
  const none = new Set<string>();

  it('keeps every wish in view, under the plain tag, while none holds', () => {
    const rows = [wish('bigYard', false), wish('doghouses', false), wish('mudroom', false)];
    const f = wishesFold(rows, false, none);
    expect(f.held).toBe(0);
    expect(f.folded).toBe(false);
    expect(ids(f.shown)).toEqual(['bigYard', 'doghouses', 'mudroom']);
    expect(f.hidden).toEqual([]);
  });

  it('folds the ones that hold, and spells out only what is still missing', () => {
    const rows = [wish('bigYard', true), wish('doghouses', false), wish('mudroom', true)];
    const f = wishesFold(rows, false, none);
    expect(f.held).toBe(2);
    expect(f.folded).toBe(true);
    expect(ids(f.shown)).toEqual(['doghouses']);
    expect(ids(f.hidden)).toEqual(['bigYard', 'mudroom']);
    // All of them held: the row alone.
    const all = wishesFold([wish('bigYard', true), wish('mudroom', true)], false, none);
    expect(all.shown).toEqual([]);
  });

  it('shows them all while the player has the row open', () => {
    const rows = [wish('bigYard', true), wish('doghouses', false)];
    const f = wishesFold(rows, true, none);
    expect(f.folded).toBe(false);
    expect(ids(f.shown)).toEqual(['bigYard', 'doghouses']);
    expect(f.hidden).toEqual([]);
  });

  it('brings back a held wish the play being looked at would turn off', () => {
    const rows = [wish('bigYard', true, { change: 'lost' }), wish('mudroom', true)];
    expect(ids(wishesFold(rows, false, none).shown)).toEqual(['bigYard']);
  });

  it('keeps a wish a tally turned on or off in view until the tally ends', () => {
    const met = { id: 1, index: 7, kind: 'met', ms: 700 } as const;
    const lost = { id: 2, index: 8, kind: 'lost', ms: 700 } as const;
    const held = { id: 3, index: 9, kind: 'held', ms: 250 } as const;
    // While its beat lights it.
    expect(ids(wishesFold([wish('a', true, { flash: met })], false, none).shown)).toEqual(['a']);
    expect(ids(wishesFold([wish('b', true, { flash: lost })], false, none).shown)).toEqual(['b']);
    // A beat on a wish that already held lights the row instead.
    expect(ids(wishesFold([wish('c', true, { flash: held })], false, none).hidden)).toEqual(['c']);
    // And after its beat, for as long as the tally lasts.
    expect(ids(wishesFold([wish('a', true)], false, new Set(['a'])).shown)).toEqual(['a']);
  });
});
