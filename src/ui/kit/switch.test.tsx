// The Switch after a mouse click (the top bar's Auto): Chrome leaves focus on its checkbox, and
// the game's keyboard handler leaves an input's keys alone, so every shortcut went dead until
// the next click on the lot. A clicked switch gives focus back to the page; one reached with
// Tab keeps it, so Space still flips it.

import type { VNode } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './kit.tsx';

/** The checkbox inside a Switch (called in place: it has no hooks). */
function boxOf(tree: VNode<Record<string, unknown>>): VNode<Record<string, unknown>> {
  const children = tree.props.children as VNode<Record<string, unknown>>[];
  const box = children.find((c) => c?.type === 'input');
  if (!box) throw new Error('no checkbox');
  return box;
}

/** Flips the switch as the browser would, with focus shown (Tab) or not (a click). */
function flip(
  focusVisible: boolean,
  onChange: (on: boolean) => boolean | void = () => {},
  inSheet = false,
) {
  const box = {
    checked: true,
    matches: () => focusVisible,
    closest: () => (inSheet ? {} : null),
    blur: vi.fn(),
  };
  const input = boxOf(Switch({ checked: false, onChange }) as VNode<Record<string, unknown>>);
  (input.props.onChange as (e: unknown) => void)({ currentTarget: box });
  return box;
}

describe('a switch, once flipped', () => {
  it('gives focus back to the page after a click', () => {
    const seen: boolean[] = [];
    const box = flip(false, (on) => void seen.push(on));
    expect(seen).toEqual([true]);
    expect(box.blur).toHaveBeenCalledOnce();
  });

  it('keeps focus when it was reached with the keyboard', () => {
    expect(flip(true).blur).not.toHaveBeenCalled();
  });

  it('keeps focus in a sheet, which holds the keyboard (Settings)', () => {
    expect(flip(false, () => {}, true).blur).not.toHaveBeenCalled();
  });

  it('still goes back when the change is refused', () => {
    const box = flip(false, () => false);
    expect(box.checked).toBe(false);
  });
});
