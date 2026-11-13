// D-153: a hand card's set chip says how far the house is toward Full House ("Full House 5/9"),
// with a check once it holds, and Inspect says the card's sets in words with the same count.
// The count is the rules' (setProgress): the member types placed, a Long Hallway as a Hallway,
// never a piece only being placed. SetChip and SetLines are hook-free, so they're called in place.

import type { ComponentChildren, VNode } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT, rules, type PieceId, type PlaceAction } from '../../rules/index.ts';
import { emptyRows, houseFrom, type Placement } from '../../rules/testing.ts';
import { run, tentative } from '../store.ts';
import { SetChip } from './Hand.tsx';
import { SetLines, SetProgressLines } from './Inspect.tsx';

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

/** One of each of Full House's 9 types, in a 3 × 3 grid of 4 × 4 slots (placed unchecked). */
const NINE: Placement[] = (
  [
    'bedroom',
    'bathroom',
    'kitchen',
    'diningRoom',
    'livingRoom',
    'closet',
    'hallway',
    'garage',
    'homeOffice',
  ] as const
).map((id, k): Placement => [id, (k % 3) * 4, Math.floor(k / 3) * 4]);

const start = run.value;
function withHouse(placements: readonly Placement[]): void {
  run.value = { ...start, house: houseFrom(CONTENT, emptyRows(12, 12), placements) };
}

afterEach(() => {
  run.value = start;
  tentative.value = null;
});

const chip = (id: PieceId) => SetChip({ id }) as Node;
/** The count's own span, which a narrow card in the pixel font hides beside a tag (hand.css). */
const count = (id: PieceId): string | null => {
  const kids = [chip(id).props.children].flat(Infinity) as ComponentChildren[];
  const span = kids.find(
    (k): k is Node =>
      typeof k === 'object' && k !== null && (k as Node).props?.class === 'set-count',
  );
  return span ? text(span) : null;
};

describe('the set chip (D-122, D-153)', () => {
  it('counts the Full House types built on a card whose only set it is', () => {
    withHouse(NINE.slice(0, 5));
    for (const id of ['hallway', 'longHallway', 'homeOffice'] as const) {
      expect(text(chip(id)), id).toBe('Full House 5/9');
      expect(count(id), id).toBe(' 5/9');
      expect(chip(id).props.icon, id).toBeUndefined();
    }
    // D-164: the Garage's touching set is Drive-In now, so its chip names that, and its tip
    // still counts Full House after it.
    expect(text(chip('garage'))).toBe('Drive-In');
    expect(String(chip('garage').props.tip).split('\n').at(-1)).toMatch(
      /^Full House: .* Your house has 5 of the 9\. /,
    );
    // Its tip says the set and the count in words.
    expect(chip('hallway').props.tip).toBe(
      'Full House: a Bedroom, a Bathroom, a Kitchen, a Dining Room, a Living Room, a Closet, a Hallway, a Garage, and a Home Office, anywhere in the house. +40 Comfort, +1 Charm, and ×1.5 Sparkle every week. One per house. Your house has 5 of the 9. Still to build: a Closet, a Hallway, a Garage, and a Home Office.',
    );
  });

  it('reads 8/9 on the card that would complete it, and a check once the house holds it', () => {
    const noHallway = NINE.filter(([id]) => id !== 'hallway');
    withHouse(noHallway);
    expect(text(chip('hallway'))).toBe('Full House 8/9');
    expect(chip('hallway').props.icon).toBeUndefined();
    // A Long Hallway built (in the Hallway's slot) counts as the Hallway.
    withHouse([...noHallway, ['longHallway', 0, 8]]);
    expect(text(chip('homeOffice'))).toBe('Full House');
    expect(count('homeOffice')).toBeNull();
    expect(chip('homeOffice').props.icon).toBe('check');
  });

  it('never counts a piece only being placed', () => {
    withHouse(NINE.filter(([id]) => id !== 'hallway'));
    // A Hallway card, placed where it would complete the set but not built until End week.
    run.value = { ...run.value, hand: [...run.value.hand, { kind: 'piece', id: 'hallway' }] };
    const play: PlaceAction = {
      t: 'place',
      from: 'hand',
      i: run.value.hand.length - 1,
      x: 2,
      y: 0,
      rot: 0,
    };
    expect(rules.preview(run.value, play).setsGained.map((g) => g.set)).toContain('fullHouse');
    tentative.value = play;
    expect(text(chip('hallway'))).toBe('Full House 8/9');
  });

  it('keeps naming the touching set with no count when it has one', () => {
    withHouse(NINE.slice(0, 5));
    expect(text(chip('bedroom'))).toBe('Suite +1');
    expect(count('bedroom')).toBeNull();
    expect(chip('bedroom').props.icon).toBeUndefined();
    expect(text(chip('diningRoom'))).toBe('Entertainer');
    // The tip still counts Full House, after the touching sets.
    expect(String(chip('bedroom').props.tip).split('\n').at(-1)).toMatch(
      /^Full House: .* Your house has 5 of the 9\. Still to build: /,
    );
    expect(SetChip({ id: 'sapling' })).toBeNull();
  });

  it('names a yard set on the yard cards, and on the rooms that start one (D-164)', () => {
    withHouse(NINE.slice(0, 5));
    // The shortest name among the touching sets, as D-122 picks it, so a room in a yard set
    // can name it: a Living Room's Backyard (8 letters) beats its Entertainer (11).
    expect(text(chip('livingRoom'))).toBe('Backyard +1');
    expect(text(chip('kitchen'))).toBe('Harvest +1');
    expect(text(chip('lKitchen'))).toBe('Harvest +1');
    expect(text(chip('patio'))).toBe('Backyard');
    expect(text(chip('herbGarden'))).toBe('Harvest');
    expect(text(chip('greenhouse'))).toBe('Harvest');
    expect(text(chip('lawn'))).toBe('Dog Run +2');
    expect(text(chip('fence'))).toBe('Dog Run +1');
    expect(text(chip('doghouse'))).toBe('Dog Run');
    expect(text(chip('treehouse'))).toBe('Play Yard');
    expect(text(chip('driveway'))).toBe('Drive-In');
    // A touching set has no count, and the tip has every set's terms: the Lawn's three.
    expect(count('lawn')).toBeNull();
    expect(String(chip('lawn').props.tip).split('\n')).toEqual([
      'Backyard: a Living Room, a Patio, and a Lawn, touching. +15 Comfort and +0.5 Charm every week. One per house.',
      'Dog Run: a Doghouse, a Lawn, and a Fence, touching. +10 Comfort and +0.5 Charm every week. One per house.',
      'Play Yard: a Treehouse, a Lawn, and a Fence, touching. +10 Comfort and +0.5 Charm every week. One per house.',
    ]);
  });
});

describe("Inspect's set lines (D-153)", () => {
  const lines = (id: PieceId) => text(SetLines({ id }));

  it('says each set a card counts toward, and how far the house is toward Full House', () => {
    withHouse(NINE.slice(0, 5));
    const all = lines('bedroom');
    expect(all.startsWith('Sets')).toBe(true);
    expect(all).toContain('Jack-and-Jill: 2 Bedrooms and a Bathroom');
    expect(all).toContain('Suite: a Bedroom, a Bathroom, and a Closet, touching.');
    expect(all).toContain(
      'One per house. Your house has 5 of the 9. Still to build: a Closet, a Hallway, a Garage, and a Home Office.',
    );
    withHouse(NINE);
    expect(lines('hallway')).toMatch(/One per house\. Your house has it\.$/);
    expect(SetLines({ id: 'sapling' })).toBeNull();
    // A yard card's sets, which need their members to touch, get no progress line (D-164).
    expect(lines('driveway')).toBe(
      'SetsDrive-In: a Garage and a Driveway, touching. +10 Comfort and +0.25 Charm every week. One per house.',
    );
  });

  it('with a card picked, give only how far the house is toward Full House', () => {
    const picked = (id: PieceId) => text(SetProgressLines({ id }));
    withHouse(NINE.slice(0, 5));
    // A Bedroom's touching sets (Suite, Jack-and-Jill) have their terms when it's pointed at.
    expect(picked('bedroom')).toBe(
      'Full House: your house has 5 of the 9. Still to build: a Closet, a Hallway, a Garage, and a Home Office.',
    );
    expect(picked('hallway')).toBe(picked('bedroom'));
    withHouse(NINE);
    expect(picked('garage')).toBe('Full House: your house has it.');
    expect(picked('patio')).toBe('');
  });
});
