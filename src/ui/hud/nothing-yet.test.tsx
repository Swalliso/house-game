// D-162: a piece that earns nothing yet says what it waits for. The standing stock's Hallway and
// Fence come in week 1, before there are rooms to touch or a house to close a yard against: a
// Hallway waits for its neighbors, a Fence for a fenced yard, in as few words as before.

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../rules/index.ts';
import { NothingYet } from './Inspect.tsx';

type Node = VNode<Record<string, unknown>>;

function text(node: ComponentChildren): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  const v = node as Node;
  if (typeof v.type === 'function')
    return text((v.type as (p: unknown) => ComponentChildren)(v.props));
  return text(v.props.children as ComponentChildren);
}

const words = (s: string) => s.trim().split(/\s+/).length;
const NEIGHBORS = 'Nothing yet: it needs the right neighbors.';

describe('what a piece that earns nothing yet waits for (D-162)', () => {
  it('a Fence waits for a fenced yard, and says so with the glossary’s term', () => {
    const said = text(NothingYet({ def: CONTENT.pieces.fence }));
    expect(said).toBe('Nothing yet: it needs a fenced yard.');
    expect(words(said)).toBeLessThanOrEqual(words(NEIGHBORS));
    const tip = (NothingYet({ def: CONTENT.pieces.fence }) as Node).props.children as Node[];
    expect(tip.some((c) => typeof c === 'object' && c?.props?.term === 'fencedYard')).toBe(true);
  });

  it('a Hallway, a Doghouse or anything else waits for its neighbors, as before', () => {
    for (const def of [
      CONTENT.pieces.hallway,
      CONTENT.pieces.longHallway,
      CONTENT.pieces.doghouse,
    ]) {
      expect(text(NothingYet({ def })), def.id).toBe(NEIGHBORS);
    }
    expect(text(NothingYet({}))).toBe(NEIGHBORS);
  });
});
