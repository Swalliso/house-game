// How to play opens short (D-158): the game in five lines, then every section folded under its
// plank, opened one at a time (or all at once), with the first-time hints this browser has been
// through to read again. It had grown to 1,316 words in 13 sections.

import type { ComponentChildren, VNode } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT, rules } from '../../rules/index.ts';
import { HINTS } from '../hud/FirstHints.tsx';
import { seenHints } from '../hud/seen-hints.ts';
import { run } from '../store.ts';
import {
  HowToPlayText,
  openSections,
  Section,
  SECTIONS,
  sectionsAtOpen,
  ShortVersion,
  TipsSoFar,
  toggleSection,
  type SectionId,
} from './HowToPlay.tsx';

/** The host elements a tree renders, function components called in place (none here use hooks). */
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

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sections = (tree: ComponentChildren) =>
  [...walk(tree)].filter((v) => v.type === 'section' && v.props['data-section'] !== undefined);
const open = (...ids: SectionId[]) => (openSections.value = new Set(ids));

afterEach(() => {
  openSections.value = new Set();
  seenHints.value = new Set();
});

describe('How to play', () => {
  it('opens short: five lines, then every section folded under its plank', () => {
    const tree = HowToPlayText();
    const all = sections(tree);
    // Every section but the tips, which wait for a hint to have been seen.
    expect(all.map((v) => v.props['data-section'])).toEqual(SECTIONS.filter((id) => id !== 'tips'));
    for (const v of all) expect(String(v.props.class)).toContain('folded');
    const short = [...walk(tree)].find((v) => String(v.props.class).includes('howto-short'))!;
    expect([...walk(short)].filter((v) => v.type === 'li')).toHaveLength(5);
    // The sheet a newcomer first meets: a screenful, where it was 1,316 words.
    expect(words(text(tree))).toBeLessThan(150);
  });

  it('takes the short version’s numbers from the balance', () => {
    const b = CONTENT.balance;
    expect(text(ShortVersion({ first: false }))).toContain(
      `${b.phases.length} milestones of ${b.weeksPerPhase} weeks`,
    );
  });

  it('sends a first visit to Start, and says nothing of it to anyone else', () => {
    expect(text(ShortVersion({ first: true }))).toContain('New here? Press Start');
    expect(text(ShortVersion({ first: false }))).not.toContain('New here?');
  });

  it('opens a section from its plank, and folds it again', () => {
    const plank = () =>
      [...walk(HowToPlayText())].find(
        (v) => v.type === 'button' && text(v as unknown as ComponentChildren).includes('A week'),
      )!;
    expect(plank().props['aria-expanded']).toBe(false);
    expect(text(HowToPlayText())).not.toContain('press End week twice');
    (plank().props.onClick as () => void)();
    expect(openSections.value.has('week')).toBe(true);
    expect(plank().props['aria-expanded']).toBe(true);
    expect(text(HowToPlayText())).toContain('press End week twice');
    toggleSection('week');
    expect(openSections.value.size).toBe(0);
  });

  it('starts on the shop’s section from the shop, and the change orders’ from their sheet', () => {
    expect([...sectionsAtOpen('game', 'shop')]).toEqual(['shop']);
    expect([...sectionsAtOpen('game', 'changeOrder')]).toEqual(['orders']);
    expect(sectionsAtOpen('game', 'build').size).toBe(0);
    // From the title or the job board, whatever the run under them is doing.
    expect(sectionsAtOpen('title', 'shop').size).toBe(0);
    expect(sectionsAtOpen('jobs', 'shop').size).toBe(0);
  });

  it('says a room can be in one set of each kind, by the content’s names', () => {
    // Scoring also draws the sets' pictures, which use hooks: read its lists alone, from the
    // section as the sheet hands it over, without rendering the rest.
    const vnodes = (kids: ComponentChildren): VNode<Record<string, unknown>>[] =>
      [kids]
        .flat(Infinity as 1)
        .filter((c): c is VNode<Record<string, unknown>> => !!c && typeof c === 'object');
    const sheet = HowToPlayText() as VNode<Record<string, unknown>>;
    const scoring = vnodes(sheet.props.children as ComponentChildren).find(
      (v) => v.type === Section && v.props.id === 'scoring',
    )!;
    const said = vnodes(scoring.props.children as ComponentChildren)
      .filter((v) => v.type === 'ul')
      .map((v) => text(v as unknown as ComponentChildren))
      .join(' ');
    const { jackAndJill, suite } = CONTENT.sets;
    const bathroom = CONTENT.pieces.bathroom.name;
    expect(said).toContain(
      `A room can be in one set of each kind: one ${bathroom} can serve a ${jackAndJill.name} ` +
        `and a ${suite.name}, but two ${suite.name}s need a ${bathroom} each.`,
    );
  });

  it('says the stock is there from the start, and from Foundation in a first job (D-162)', () => {
    open('week');
    const said = () => text(HowToPlayText());
    expect(said()).toContain('Always in stock: a Hallway and a Fence wait in your reserve');
    const before = run.value;
    try {
      run.value = rules.newRun({ ...before.setup, mode: 'firstJob' });
      expect(said()).toContain(
        'Always in stock: from Foundation on, a Hallway and a Fence wait in your reserve',
      );
    } finally {
      run.value = before;
    }
  });

  it('introduces blueprints as bonuses you don’t build', () => {
    open('shop');
    expect(text(HowToPlayText())).toContain(
      'Blueprints are bonuses that stay on for the whole run; you don’t build them.',
    );
  });
});

describe('Tips so far', () => {
  it('is nothing until a hint has been seen', () => {
    expect(TipsSoFar()).toBeNull();
  });

  it('lists the hints seen, folded with their count, and opens to what each said', () => {
    seenHints.value = new Set(['firstWeek', 'checklist']);
    expect(text(TipsSoFar())).toBe('Tips so far (2)');
    open('tips');
    const said = text(TipsSoFar());
    expect(said).toContain(HINTS.checklist.title);
    expect(said).toContain(HINTS.checklist.text);
    for (const step of HINTS.firstWeek.steps!) expect(said).toContain(step);
  });
});
