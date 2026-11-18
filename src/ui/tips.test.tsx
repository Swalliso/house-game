// One kind of tooltip (D-077's 2026-11-12 note): every tip in the interface is the game's own
// note (hud/Tip.tsx), never the browser's title tooltip, which looked nothing like it. No DOM
// element in src/ui's components carries a title attribute: an element asks for a tip with
// data-tip, and the kit's components take a `tip`, which the typechecker holds them to. The
// ?debug panel (src/ui/debug) keeps the browser's. This reads the syntax tree, so a heading
// named title (a Panel's, a Sheet's, a Card's, a Tip's) is fine.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { ComponentChildren, VNode } from 'preact';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CONTENT, glossary } from '../rules/index.ts';
import { Tip } from './hud/Tip.tsx';
import { Button, Card, Chip, Icon, Segmented, Switch } from './kit/kit.tsx';

const UI = resolve('src/ui');
const DEBUG = join(UI, 'debug');

/** The interface's components: every .tsx under a folder, but the tests. */
function* components(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* components(path);
    else if (path.endsWith('.tsx') && !path.endsWith('.test.tsx')) yield path;
  }
}

/** Each title attribute on a DOM element (a lower-case tag) in a file, as "file:line <tag>". */
function nativeTitles(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'title') {
      const tag = node.parent.parent.tagName.getText(source);
      if (/^[a-z]/.test(tag)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push(`${relative(process.cwd(), file)}:${line + 1} <${tag}>`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

type Host = VNode<Record<string, unknown>>;

/** The host elements a tree renders, function components called in place (the kit's have no hooks). */
function* walk(node: ComponentChildren): Generator<Host> {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
    return;
  }
  const v = node as Host;
  if (typeof v.type === 'function') {
    yield* walk((v.type as (p: unknown) => ComponentChildren)(v.props));
    return;
  }
  yield v;
  yield* walk(v.props.children as ComponentChildren);
}

/** The first host element of a tree. */
const host = (tree: ComponentChildren): Host => walk(tree).next().value as Host;

describe('one kind of tooltip (D-077)', () => {
  it('puts no title attribute on any element outside the debug panel', () => {
    const files = [...components(UI)].filter((f) => !f.startsWith(DEBUG + sep));
    expect(files.length).toBeGreaterThan(30);
    expect(files.flatMap(nativeTitles)).toEqual([]);
  });

  it('would find one: the debug panel keeps the browser’s', () => {
    expect([...components(DEBUG)].flatMap(nativeTitles).length).toBeGreaterThan(0);
  });

  it("hands the kit's tips to the note, as data-tip, never as a title", () => {
    const button = host(Button({ tip: 'Zoom in (+)', iconOnly: true, icon: 'close' }));
    expect(button.type).toBe('button');
    expect(button.props['data-tip']).toBe('Zoom in (+)');
    expect(button.props.title).toBeUndefined();

    const chip = host(Chip({ tip: 'Suite: …\nFull House: …', label: 'Cozy', children: 'Cozy' }));
    expect(chip.props['data-tip']).toBe('Suite: …\nFull House: …');
    expect(chip.props['aria-label']).toBe('Cozy');
    expect(chip.props.title).toBeUndefined();

    // An icon's label names it for screen readers and is its tip.
    const icon = host(Icon({ name: 'coin', label: 'Budget' }));
    expect(icon.props).toMatchObject({ role: 'img', 'aria-label': 'Budget', 'data-tip': 'Budget' });
    expect(icon.props.title).toBeUndefined();
    expect(host(Icon({ name: 'coin' })).props['data-tip']).toBeUndefined();

    // A card's title is its heading; its tip is its own.
    const card = host(Card({ title: 'Bedroom', tip: 'Nowhere on the lot fits it right now' }));
    expect(card.props['data-tip']).toBe('Nowhere on the lot fits it right now');
    expect(card.props.title).toBeUndefined();

    const toggle = host(Switch({ checked: false, onChange: () => {}, tip: 'Complete early' }));
    expect(toggle.type).toBe('label');
    expect(toggle.props['data-tip']).toBe('Complete early');

    const seg = Segmented({
      options: [{ value: 'a', label: 'A', tip: 'The first' }],
      value: 'a',
      onChange: () => {},
      label: 'Choices',
    });
    const choice = [...walk(seg)].find((v) => v.type === 'button')!;
    expect(choice.props['data-tip']).toBe('The first');
    expect(choice.props.title).toBeUndefined();
  });

  it("gives a term's note its glossary title and text, with no hooks to call", () => {
    const term = host(Tip({ term: 'budget', children: 'budget' }));
    const { title, text } = glossary(CONTENT).budget;
    expect(term.props).toMatchObject({
      class: 'tip',
      tabIndex: 0,
      'data-tip': text,
      'data-tip-title': title,
    });
    expect(term.props.title).toBeUndefined();
  });
});
