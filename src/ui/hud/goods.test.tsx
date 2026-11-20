// Inspect names a piece's kind in the hand card's word (goods.tsx goodKind, Hand.tsx's chip):
// the Hallways are Hallways in both, not Rooms in one. And a blueprint's line (D-141): the
// rules' numbers in words, with the cases one week's snapshot gets wrong said plainly. And a
// piece's and a tool's (D-193), in the same voice.

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  type BlueprintValue,
  type PieceId,
  type PieceValue,
  type ToolValue,
} from '../../rules/index.ts';
import {
  BlueprintWorth,
  GoodBody,
  goodKind,
  PIECE_KIND_LABEL,
  PieceWorth,
  pieceKind,
  ToolWorth,
} from './goods.tsx';
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
  return v.type === 'span' &&
    /^worth-(gain|host|run|budget|needs|note)$/.test(String(v.props.class))
    ? `${inner}\n`
    : inner;
}

const linesOf = (node: ComponentChildren) =>
  words(node)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const lines = (value: BlueprintValue | null) => linesOf(BlueprintWorth({ value }));

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

describe("a piece's lines", () => {
  /** The Tips in a tree, with their terms and words. */
  function tips(node: ComponentChildren, out: [unknown, string][] = []): [unknown, string][] {
    if (node == null || typeof node !== 'object') return out;
    if (Array.isArray(node)) {
      for (const n of node) tips(n, out);
      return out;
    }
    const v = node as VNode<Record<string, unknown>>;
    if (v.type === Tip) out.push([v.props.term, words(v.props.children as ComponentChildren)]);
    else if (typeof v.type === 'function') {
      tips((v.type as (p: unknown) => ComponentChildren)(v.props), out);
    } else tips(v.props.children as ComponentChildren, out);
    return out;
  }

  it('link the Tree on the Sapling’s, so a tip says what one does (D-195)', () => {
    const body = GoodBody({ good: { kind: 'piece', id: 'sapling' } });
    expect(words(body)).toContain('Each tile becomes a Tree after 4 weeks');
    expect(tips(body)).toEqual([['tree', 'Tree']]);
    // A card that links no term has no tip in its lines.
    expect(tips(GoodBody({ good: { kind: 'piece', id: 'garage' } }))).toEqual([]);
  });
});

const piece = (over: Partial<PieceValue>): PieceValue => ({
  how: 'place',
  spot: { x: 0, y: 0, rot: 0 },
  gain: 0,
  weeksLeft: 12,
  overRun: 0,
  budget: 0,
  ...over,
});
const pieceLines = (value: PieceValue | null) => linesOf(PieceWorth({ value }));
const toolLines = (value: ToolValue | null) => linesOf(ToolWorth({ value }));
const classOf = (node: ComponentChildren) => (node as VNode<{ class: string }>).props.class;

describe("a piece's line (D-193)", () => {
  it('says its best spot’s gain and the run’s, as a fixture’s does', () => {
    expect(pieceLines(piece({ gain: 6, overRun: 72 }))).toEqual([
      '[up]+6 Wow a week',
      'about +72 over the run',
    ]);
    expect(pieceLines(piece({ gain: -2, overRun: -24 }))).toEqual([
      '[down]−2 Wow a week',
      'about −24 over the run',
    ]);
  });

  it('leads a rhythm with the week it pays', () => {
    const pool = piece({ rhythm: { every: 3, gain: 12 }, overRun: 48 });
    expect(pieceLines(pool)).toEqual(['[up]+12 Wow every 3rd week', 'about +48 over the run']);
  });

  it('names the room a Renovation or an extension would go to', () => {
    const room = { uid: 4, defId: 'library' } as const;
    const renovate = piece({ how: 'renovate', spot: undefined, room, gain: 4, overRun: 48 });
    expect(pieceLines(renovate)).toEqual([
      '[up]+4 Wow a week',
      'renovating your Library',
      'about +48 over the run',
    ]);
    const bedroom = { uid: 2, defId: 'bedroom' } as const;
    expect(pieceLines(piece({ how: 'extend', room: bedroom, gain: 5, overRun: 60 }))).toEqual([
      '[up]+5 Wow a week',
      'extending your Bedroom',
      'about +60 over the run',
    ]);
  });

  it('counts budget on its own line, and leads with the run when its week adds nothing', () => {
    expect(pieceLines(piece({ budget: 6 }))).toEqual(['[coin]+6 budget over the run']);
    expect(pieceLines(piece({ overRun: 20 }))).toEqual(['[up]Wow: about +20 over the run']);
  });

  it('says quietly when it fits but adds nothing, or has no spot', () => {
    const none = PieceWorth({ value: piece({}) });
    expect(classOf(none)).toBe('pcard-worth none');
    expect(linesOf(none)).toEqual(['Fits, but adds no Wow to your house yet']);
    const nowhere = PieceWorth({ value: null });
    expect(classOf(nowhere)).toBe('pcard-worth none');
    expect(linesOf(nowhere)).toEqual(['No spot for it on your lot yet']);
    // And what has it earn nothing, when that's why.
    expect(pieceLines(piece({ nothing: 'A litter of puppies' }))).toEqual([
      'Earns nothing (A litter of puppies)',
    ]);
  });

  it('is a plain block in Inspect', () => {
    expect(classOf(PieceWorth({ value: piece({ gain: 1, overRun: 12 }), where: 'panel' }))).toBe(
      'good-worth good',
    );
  });
});

describe("a tool's line (D-193)", () => {
  it('says what a one-week tool adds the week it’s used', () => {
    expect(toolLines({ kind: 'week', gain: 6 })).toEqual(['[up]+6 Wow the week you use it']);
  });

  it('says what a Remodel Plan’s next level adds, a week and over the run', () => {
    const level: ToolValue = {
      kind: 'level',
      set: 'jackAndJill',
      level: 2,
      gain: 20,
      weeksLeft: 12,
      overRun: 240,
    };
    expect(toolLines(level)).toEqual([
      '[up]+20 Wow a week',
      'Jack-and-Jill to level 2',
      'about +240 over the run',
    ]);
  });

  it('says quietly what it’s waiting for, or what it would do here', () => {
    const needs = ToolWorth({
      value: { kind: 'needs', needs: 'No Entertainer yet', set: 'entertainer' },
    });
    expect(classOf(needs)).toBe('pcard-worth none');
    expect(linesOf(needs)).toEqual(['No Entertainer yet']);
    const note = 'Your Sapling becomes a Tree 2 weeks sooner';
    expect(toolLines({ kind: 'note', note })).toEqual([note]);
    expect(ToolWorth({ value: null })).toBeNull();
  });
});
