// Shop goods as the HUD and the shop describe them: names, rarity labels, and the text the
// rules generate from their data (D-038). Rarity is a colored border plus a label, never
// color alone (D-051).

import {
  blueprintText,
  cardText,
  CONTENT,
  fixtureText,
  type BlueprintId,
  type FixtureId,
  type PieceId,
  type Rarity,
  type ShopOffer,
} from '../../rules/index.ts';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
};

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return <span class={`rarity-tag rarity-${rarity}`}>{RARITY_LABEL[rarity]}</span>;
}

export type GoodRef =
  | { kind: 'blueprint'; id: BlueprintId }
  | { kind: 'fixture'; id: FixtureId }
  | { kind: 'piece'; id: PieceId };

export function goodName(g: GoodRef): string {
  switch (g.kind) {
    case 'blueprint':
      return CONTENT.blueprints[g.id].name;
    case 'fixture':
      return CONTENT.fixtures[g.id].name;
    case 'piece':
      return CONTENT.pieces[g.id].name;
  }
}

export function goodRarity(g: GoodRef): Rarity | undefined {
  if (g.kind === 'blueprint') return CONTENT.blueprints[g.id].rarity;
  if (g.kind === 'fixture') return CONTENT.fixtures[g.id].rarity;
  return undefined;
}

/** What kind of thing it is, in a word or two. */
export function goodKind(g: GoodRef): string {
  if (g.kind === 'blueprint') return 'Blueprint';
  if (g.kind === 'fixture') return 'Fixture';
  const def = CONTENT.pieces[g.id];
  if (def.category === 'indoor') return 'Room';
  if (def.category === 'yard') return 'Yard';
  return 'Outbuilding';
}

/** Where it goes, and how it's used. */
export function goodWhere(g: GoodRef): string {
  if (g.kind === 'blueprint')
    return 'Goes in a blueprint slot and works every week, on every piece it names.';
  if (g.kind === 'fixture')
    return 'Goes in your supplies. Installing it is free: it doesn’t use your week.';
  return 'Goes in your reserve. Placing it is your week’s build, any week you like.';
}

/** The good's effects as plain sentences. */
export function goodLines(g: GoodRef): string[] {
  switch (g.kind) {
    case 'blueprint':
      return blueprintText(CONTENT, CONTENT.blueprints[g.id]);
    case 'fixture': {
      const t = fixtureText(CONTENT, CONTENT.fixtures[g.id]);
      return [t.fits, ...t.effects];
    }
    case 'piece': {
      const t = cardText(CONTENT, CONTENT.pieces[g.id]);
      return [...t.effects, ...t.notes];
    }
  }
}

export function offerGood(o: ShopOffer): GoodRef | null {
  return o.kind === 'service' ? null : ({ kind: o.kind, id: o.id } as GoodRef);
}

/** A good's description: kind, rarity, effects. */
export function GoodBody({ good, where = false }: { good: GoodRef; where?: boolean }) {
  const rarity = goodRarity(good);
  const tags = good.kind === 'piece' ? CONTENT.pieces[good.id].tags : [];
  return (
    <>
      <p class="good-kind">
        {goodKind(good)}
        {rarity && <RarityTag rarity={rarity} />}
        {tags.length > 0 && <span class="muted"> · {tags.join(' · ')}</span>}
      </p>
      <ul class="effects">
        {goodLines(good).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {where && <p class="muted good-where">{goodWhere(good)}</p>}
    </>
  );
}
