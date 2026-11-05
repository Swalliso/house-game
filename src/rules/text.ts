// Rules text generated from content data (D-038): card text and the labels on breakdown lines.
// Plain language, such as "+1 per touching Tree or Quiet neighbor (up to 3)".

import type { Content, Effect, FeatureId, PieceDef, Property, Selector, Tag } from './index.ts';

const PROPERTY_NOUNS: Record<Property, [one: string, many: string]> = {
  indoor: ['indoor piece', 'indoor pieces'],
  yard: ['yard piece', 'yard pieces'],
  outbuilding: ['outbuilding', 'outbuildings'],
  room: ['room', 'rooms'],
  view: ['piece with a view', 'pieces with a view'],
  viewSource: ['view', 'views'],
};

/** How a selector reads: `one` "Tree or Quiet neighbor", `some` "Trees or Quiet neighbors", `every` "Trees and Quiet neighbors". */
export type Phrasing = 'one' | 'some' | 'every';

function plural(name: string): string {
  return name.endsWith('s') ? name : `${name}s`;
}

function featureNoun(content: Content, id: FeatureId, many: boolean): string {
  const def = content.features[id];
  if (id === 'street') return 'the street';
  if (def.body) return `the ${def.name}`;
  return many ? plural(def.name) : def.name;
}

function joinWords(words: readonly string[], conj: 'or' | 'and'): string {
  if (words.length <= 1) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} ${conj} ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, ${conj} ${words[words.length - 1]}`;
}

export function selectorText(content: Content, sel: Selector, phrasing: Phrasing = 'one'): string {
  const many = phrasing !== 'one';
  const conj = phrasing === 'every' ? 'and' : 'or';
  if (sel === 'all') return many ? 'neighbors' : 'neighbor';
  if ('piece' in sel) {
    const ids = typeof sel.piece === 'string' ? [sel.piece] : sel.piece;
    return joinWords(
      ids.map((id) => (many ? plural(content.pieces[id].name) : content.pieces[id].name)),
      conj,
    );
  }
  if ('feature' in sel) {
    const ids = typeof sel.feature === 'string' ? [sel.feature] : sel.feature;
    return joinWords(
      ids.map((id) => featureNoun(content, id, many)),
      conj,
    );
  }
  if ('tag' in sel) return `${sel.tag} ${many ? 'neighbors' : 'neighbor'}`;
  if ('property' in sel) return PROPERTY_NOUNS[sel.property][many ? 1 : 0];
  if ('any' in sel)
    return joinWords(
      sel.any.map((s) => selectorText(content, s, phrasing)),
      conj,
    );
  if ('all' in sel) {
    // Tags read as adjectives on the one noun: "Sunny room".
    const tags = sel.all.filter((s): s is { tag: Tag } => s !== 'all' && 'tag' in s);
    const rest = sel.all.filter((s) => s === 'all' || !('tag' in s));
    const noun =
      rest.length === 0
        ? many
          ? 'neighbors'
          : 'neighbor'
        : joinWords(
            rest.map((s) => selectorText(content, s, phrasing)),
            'and',
          );
    return [...tags.map((t) => t.tag), noun].join(' ');
  }
  return `anything but ${selectorText(content, sel.not, 'some')}`;
}

function signed(n: number): string {
  return n < 0 ? `−${-n}` : `+${n}`;
}

function article(noun: string): string {
  if (noun.startsWith('the ')) return noun;
  return /^[AEIOU]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

export function effectText(content: Content, effect: Effect): string {
  switch (effect.kind) {
    case 'steady':
      return `${signed(effect.amount)} every week`;
    case 'neighbor': {
      const what = selectorText(content, effect.match, 'one');
      if (effect.max === 1) return `${signed(effect.amount)} if touching ${article(what)}`;
      const cap = effect.max === undefined ? '' : ` (up to ${effect.max})`;
      return `${signed(effect.amount)} per touching ${what}${cap}`;
    }
    case 'aura': {
      const who = selectorText(content, effect.match, 'every');
      const parts: string[] = [];
      if (effect.pct) parts.push(`earn ${signed(effect.pct)}%`);
      if (effect.amount) parts.push(`get ${signed(effect.amount)}`);
      return `Touching ${who} ${parts.join(' and ')}`;
    }
  }
}

function selectorTags(sel: Selector, out: Set<Tag>, props: Set<Property>): void {
  if (sel === 'all') return;
  if ('tag' in sel) out.add(sel.tag);
  else if ('property' in sel) props.add(sel.property);
  else if ('any' in sel) sel.any.forEach((s) => selectorTags(s, out, props));
  else if ('all' in sel) sel.all.forEach((s) => selectorTags(s, out, props));
  else if ('not' in sel) selectorTags(sel.not, out, props);
}

export interface CardText {
  effects: string[];
  /** Reminders about lot features the effects mention: "The street is Loud." */
  notes: string[];
}

export function cardText(content: Content, def: PieceDef): CardText {
  const effects = def.effects.map((e) => effectText(content, e));
  const tags = new Set<Tag>();
  const props = new Set<Property>();
  for (const e of def.effects) if (e.kind !== 'steady') selectorTags(e.match, tags, props);
  const notes: string[] = [];
  const features = Object.values(content.features);
  for (const tag of tags) {
    const with_ = features.filter((f) => f.tags.includes(tag) && !f.inert);
    if (with_.length === 0) continue;
    const names = with_.map((f) => featureNoun(content, f.id, true));
    const singular = with_.length === 1 && isSingularFeature(with_[0]!.id);
    const sentence = `${joinWords(names, 'and')} ${singular ? 'is' : 'are'} ${tag}.`;
    notes.push(sentence.charAt(0).toUpperCase() + sentence.slice(1));
  }
  if (props.has('viewSource')) {
    const sources = features
      .filter((f) => f.viewSource)
      .map((f) => featureNoun(content, f.id, true));
    notes.push(`Views: ${joinWords(sources, 'and')}.`);
  }
  return { effects, notes };
}

/** "The street is", "the Pond is", but "Trees are". */
function isSingularFeature(id: FeatureId): boolean {
  return id === 'street' || id === 'pond' || id === 'creek';
}

/** "2 Trees, a Bedroom, and the Creek", for breakdown labels. */
export function countedNames(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const parts = [...counts].map(([name, n]) => {
    if (name.startsWith('the ')) return name;
    return n === 1 ? article(name) : `${n} ${plural(name)}`;
  });
  return joinWords(parts, 'and');
}

export function neighborName(content: Content, feature: FeatureId): string {
  return featureNoun(content, feature, false);
}
