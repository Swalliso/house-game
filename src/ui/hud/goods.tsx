// Shop goods as the HUD and the shop describe them: names, rarity labels, and the text the
// rules generate from their data (D-038). Rarity is a colored border plus a label, never
// color alone (D-051). A fixture also says what it's worth in your house (D-107), from the
// rules' fixtureValue: the UI only words the numbers.

import {
  blueprintText,
  cardText,
  CONTENT,
  crateText,
  fixtureText,
  SCORE_LABELS,
  toolText,
  upgradeText,
  type BlueprintId,
  type CrateId,
  type FixtureId,
  type FixtureValue,
  type PieceId,
  type Rarity,
  type ShopOffer,
  type ToolId,
  type UpgradeId,
} from '../../rules/index.ts';
import { signed } from '../format.ts';
import { Icon } from '../kit/kit.tsx';
import { Tip } from './Tip.tsx';
import './goods.css';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
};

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return (
    <Tip term="rarity">
      <span class={`rarity-tag rarity-${rarity}`}>{RARITY_LABEL[rarity]}</span>
    </Tip>
  );
}

export type GoodRef =
  | { kind: 'blueprint'; id: BlueprintId }
  | { kind: 'fixture'; id: FixtureId }
  | { kind: 'piece'; id: PieceId }
  | { kind: 'tool'; id: ToolId }
  | { kind: 'upgrade'; id: UpgradeId }
  | { kind: 'crate'; id: CrateId };

export function goodName(g: GoodRef): string {
  switch (g.kind) {
    case 'blueprint':
      return CONTENT.blueprints[g.id].name;
    case 'fixture':
      return CONTENT.fixtures[g.id].name;
    case 'piece':
      return CONTENT.pieces[g.id].name;
    case 'tool':
      return CONTENT.tools[g.id].name;
    case 'upgrade':
      return CONTENT.upgrades[g.id].name;
    case 'crate':
      return CONTENT.crates[g.id].name;
  }
}

export function goodRarity(g: GoodRef): Rarity | undefined {
  if (g.kind === 'blueprint') return CONTENT.blueprints[g.id].rarity;
  if (g.kind === 'fixture') return CONTENT.fixtures[g.id].rarity;
  if (g.kind === 'tool') return CONTENT.tools[g.id].rarity;
  return undefined;
}

/** What kind of thing it is, in a word or two. */
export function goodKind(g: GoodRef): string {
  if (g.kind === 'blueprint') return 'Blueprint';
  if (g.kind === 'fixture') return 'Fixture';
  if (g.kind === 'tool') return 'Tool';
  if (g.kind === 'upgrade') return 'Company upgrade';
  if (g.kind === 'crate') return 'Crate';
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
  if (g.kind === 'tool') return 'Goes in your supplies. Use it any week, for free: it’s one use.';
  if (g.kind === 'upgrade') return 'Yours for the rest of the run.';
  if (g.kind === 'crate') return 'Opens at once: keep one of what’s inside.';
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
    case 'tool':
      return toolText(CONTENT, CONTENT.tools[g.id]);
    case 'upgrade':
      return upgradeText(CONTENT, CONTENT.upgrades[g.id]);
    case 'crate':
      return crateText(CONTENT, CONTENT.crates[g.id]);
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

/**
 * D-107: a fixture's worth in your house, from the rules' fixtureValue: its best host, what it
 * would add to the week's Wow there (in the shop, the next week's), and roughly what that comes
 * to over the rest of the run. A strip on the shop's cards (shop.css): the gain first, in blue
 * with an up icon, or a loss in orange with a down icon; quiet when nothing takes it, or it adds
 * nothing yet. The host is named as it's valued: in the shop, a Nursery that grows into a Kids'
 * Room as the next phase starts is the Kids' Room.
 */
export function FixtureWorth({ value }: { value: FixtureValue | null }) {
  const wow = SCORE_LABELS.total;
  if (!value) return <div class="pcard-worth none">No piece here takes it yet</div>;
  if (value.gain === 0) {
    return <div class="pcard-worth none">Fits, but adds no {wow} to your house yet</div>;
  }
  const good = value.gain > 0;
  const host = CONTENT.pieces[value.hostDefId].name;
  const old = value.replaces ? `, replacing its ${CONTENT.fixtures[value.replaces].name}` : '';
  const weeks = `${value.weeksLeft} ${value.weeksLeft === 1 ? 'week' : 'weeks'}`;
  return (
    <div class={`pcard-worth ${good ? 'good' : 'bad'}`}>
      <span class="worth-gain">
        <span class="worth-num">
          <Icon name={good ? 'up' : 'down'} />
          {signed(value.gain)}
        </span>{' '}
        {wow} a week
      </span>
      <span class="worth-host">
        in your {host}
        {old}
      </span>
      <span class="worth-run">
        <Tip
          title="Over the run"
          text={`${signed(value.gain)} ${wow} a week for the ${weeks} left in the run, if the house stays as it is. It won’t, so take it as a rough guide.`}
        >
          about {signed(value.overRun)} over the run
        </Tip>
      </span>
    </div>
  );
}
