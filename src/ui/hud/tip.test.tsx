// A tip's words in the bubble (D-098, D-110): the pixel fonts have no warning sign, so the one
// in the rules' glossary (the Requirements tip's "(⚠ on the board)", text.ts) is drawn as the
// warning icon, in both fonts, and never left as text for the system font to draw.

import type { ComponentChildren, VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import { CONTENT, glossary } from '../../rules/index.ts';
import { tipWords } from './Tip.tsx';

/** The words and icons a tip's text renders, in order: strings, and `icon:<name>`. */
function pieces(node: ComponentChildren): string[] {
  if (node == null || typeof node === 'boolean' || node === '') return [];
  if (typeof node !== 'object') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(pieces);
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function')
    return pieces((v.type as (p: unknown) => ComponentChildren)(v.props));
  const icon = /--art-icon-(\w+)/.exec((v.props.style as Record<string, string>)?.['--icon'] ?? '');
  return icon ? [`icon:${icon[1]}`] : pieces(v.props.children as ComponentChildren);
}

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

const SIGN = String.fromCodePoint(0x26a0);
/** The emoji form's selector, after the sign. */
const EMOJI = String.fromCodePoint(0xfe0f);

describe("a tip's words", () => {
  it('draw the glossary’s warning sign as the warning icon, named for screen readers', () => {
    const { text } = glossary(CONTENT).requirement;
    expect(text).toContain(`(${SIGN} on the board)`);
    const out = pieces(tipWords(text));
    expect(out.join('')).not.toContain(SIGN);
    expect(out.filter((p) => p === 'icon:warn')).toHaveLength(1);
    // The icon stands where the sign was, the words around it whole.
    expect(out.join('')).toBe(text.replace(SIGN, 'icon:warn'));
    const icon = [...walk(tipWords(text))].find((v) => v.props.role === 'img');
    expect(icon?.props['aria-label']).toBe('warning sign');
  });

  it('keep the icon on one line with the characters it touches: "(" and the icon', () => {
    const { text } = glossary(CONTENT).requirement;
    const signs = [...walk(tipWords(text))].filter((v) => v.props.class === 'tip-sign');
    expect(signs.map((v) => pieces(v))).toEqual([['(', 'icon:warn']]);
    // The words either side touch nothing: the icon alone.
    expect(
      pieces([...walk(tipWords(`a ${SIGN} b`))].find((v) => v.props.class === 'tip-sign')),
    ).toEqual(['icon:warn']);
    // Several, the emoji form among them: each keeps what touches it.
    const several = tipWords(`x${SIGN}${EMOJI}y, ${SIGN}`);
    expect(pieces(several).join('')).toBe('xicon:warny, icon:warn');
    expect(
      [...walk(several)].filter((v) => v.props.class === 'tip-sign').map((v) => pieces(v)),
    ).toEqual([['x', 'icon:warn', 'y,'], ['icon:warn']]);
  });

  it('leave words without a sign as they are', () => {
    expect(tipWords('Open ground behind the house.')).toBe('Open ground behind the house.');
  });

  it('leave no sign in any glossary tip', () => {
    for (const [term, { title, text }] of Object.entries(glossary(CONTENT))) {
      expect(pieces(tipWords(title)).join(''), term).not.toContain(SIGN);
      expect(pieces(tipWords(text)).join(''), term).not.toContain(SIGN);
    }
  });
});
