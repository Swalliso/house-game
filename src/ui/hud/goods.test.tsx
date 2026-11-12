// Inspect names a piece's kind in the hand card's word (goods.tsx goodKind, Hand.tsx's chip):
// the Hallways are Hallways in both, not Rooms in one. And a blueprint's line (D-141): the
// rules' numbers in words, with the cases one week's snapshot gets wrong said plainly.

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import { CONTENT, type BlueprintValue, type PieceId } from '../../rules/index.ts';
import { BlueprintWorth, goodKind, PIECE_KIND_LABEL, pieceKind } from './goods.tsx';
import { Tip } from './Tip.tsx';

describe("a piece's kind", () => {
  it('is the same word in Inspect as on its hand card', () => {
    expect(goodKind({ kind: 'piece', id: 'hallway' })).toBe('Hallway');
    expect(goodKind({ kind: 'piece', id: 'longHallway' })).toBe('Hallway');
    expect(goodKind({ kind: 'piece', id: 'bedroom' })).toBe('Room');
    expect(goodKind({ kind: 'piece', id: 'lawn' })).toBe('Yard');
    expect(goodKind({ kind: 'piece', id: 'treehouse' })).toBe('Outbuilding');
    for (const id of Object.keys(CONTENT.pieces) as PieceId[]) {
      expect(goodKind({ kind: 'piece', id }), id).toBe(
        PIECE_KIND_LABEL[pieceKind(CONTENT.pieces[id])],
      );
    }
  });
});

/**
 * What a tree says, in order: its words, and `[name]` for an icon. A Tip's words are its
 * children, read from its props; the other components are called in place.
 */
function words(node: ComponentChildren): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(words).join('');
  const v = node as VNode<Record<string, unknown>>;
  if (v.type === Tip) return words(v.props.children as ComponentChildren);
  if (typeof v.type === 'function') {
    return words((v.type as (p: unknown) => ComponentChildren)(v.props));
  }
  const icon = /--art-icon-(\w+)/.exec((v.props.style as Record<string, string>)?.['--icon'] ?? '');
  if (icon) return `[${icon[1]}]`;
  const inner = words(v.props.children as ComponentChildren);
  // Each part of the strip is its own line.
  return v.type === 'span' && /^worth-(gain|host|run|budget|needs)$/.test(String(v.props.class))
    ? `${inner}\n`
    : inner;
}

const lines = (value: BlueprintValue | null) =>
  words(BlueprintWorth({ value }))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const value = (over: Partial<BlueprintValue>): BlueprintValue => ({
  gain: 0,
  when: 'week',
  weeksLeft: 12,
  overRun: 0,
  budget: 0,
  held: false,
  ...over,
});

describe("a blueprint's line (D-141)", () => {
  it('says the week’s gain and the run’s, as a fixture’s does', () => {
    expect(lines(value({ gain: 24, overRun: 288 }))).toEqual([
      '[up]+24 Wow a week',
      'about +288 over the run',
    ]);
    expect(lines(value({ gain: -3, overRun: -36 }))).toEqual([
      '[down]−3 Wow a week',
      'about −36 over the run',
    ]);
  });

  it('says how far a growing one grows, and when a last-week one lands', () => {
    expect(lines(value({ gain: 6, growsTo: 60, overRun: 500 }))).toEqual([
      '[up]+6 Wow a week, growing to +60',
      'about +500 over the run',
    ]);
    expect(lines(value({ gain: 310, when: 'lastWeek', overRun: 930 }))).toEqual([
      '[up]+310 Wow in a phase’s last week',
      'about +930 over the run',
    ]);
  });

  it('counts budget on its own line, with the coin', () => {
    expect(lines(value({ budget: 6 }))).toEqual(['[coin]+6 budget over the run']);
    expect(lines(value({ gain: 2, overRun: 24, budget: 3 }))).toEqual([
      '[up]+2 Wow a week',
      'about +24 over the run',
      '[coin]+3 budget over the run',
    ]);
  });

  it('leads with the run when the first week adds nothing', () => {
    expect(lines(value({ overRun: 8 }))).toEqual(['[up]Wow: about +8 over the run']);
  });

  it('says what one more early milestone would add, with or without a gain today', () => {
    const perStat = { stat: 'milestonesEarly', gain: 40 } as const;
    expect(lines(value({ gain: 80, overRun: 960, perStat }))).toEqual([
      '[up]+80 Wow a week',
      '+40 Wow a week for each milestone completed early',
      'about +960 over the run',
    ]);
    expect(lines(value({ perStat, needs: 'No milestone completed early yet' }))).toEqual([
      'No milestone completed early yet',
      '+40 Wow a week for each milestone completed early',
    ]);
  });

  it('says what each counted piece would add, with or without a gain today (D-143)', () => {
    const perPiece = { what: 'House piece', gain: 85 };
    expect(lines(value({ gain: 170, overRun: 2040, perPiece }))).toEqual([
      '[up]+170 Wow a week',
      '+85 Wow a week for each House piece',
      'about +2,040 over the run',
    ]);
    expect(lines(value({ perPiece, needs: 'No House pieces yet' }))).toEqual([
      'No House pieces yet',
      '+85 Wow a week for each House piece',
    ]);
  });

  it('says what it needs, quietly, and nothing at all for a blueprint the rules don’t value', () => {
    const strip = BlueprintWorth({ value: value({ needs: 'No Dark rooms yet' }) }) as VNode<{
      class: string;
    }>;
    expect(strip.props.class).toBe('pcard-worth none');
    expect(words(strip).trim()).toBe('No Dark rooms yet');
    expect(BlueprintWorth({ value: null })).toBeNull();
  });
});
