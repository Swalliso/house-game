// Shop goods as the HUD and the shop describe them: names, rarity labels, and the text the
// rules generate from their data (D-038). Rarity is a colored border plus a label, never
// color alone (D-051). A fixture also says what it's worth in your house (D-107), from the
// rules' fixtureValue, and a blueprint from the rules' blueprintValue (D-141): the UI only words
// the numbers.

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
  type BlueprintValue,
  type CrateId,
  type FixtureId,
  type FixtureValue,
  type PieceDef,
  type PieceId,
  type Rarity,
  type RunStat,
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

/** A piece's kind, as its card's tint and chip show it: a Hallway is a kind of its own. */
export type PieceKind = 'room' | 'yard' | 'hall' | 'outbuilding';

export function pieceKind(def: PieceDef): PieceKind {
  if (def.connector) return 'hall';
  if (def.category === 'indoor') return 'room';
  if (def.category === 'yard') return 'yard';
  return 'outbuilding';
}

export const PIECE_KIND_LABEL: Record<PieceKind, string> = {
  room: 'Room',
  yard: 'Yard',
  hall: 'Hallway',
  outbuilding: 'Outbuilding',
};

/** What kind of thing it is, in a word or two: a piece's in the hand card's word. */
export function goodKind(g: GoodRef): string {
  if (g.kind === 'blueprint') return 'Blueprint';
  if (g.kind === 'fixture') return 'Fixture';
  if (g.kind === 'tool') return 'Tool';
  if (g.kind === 'upgrade') return 'Company upgrade';
  if (g.kind === 'crate') return 'Crate';
  return PIECE_KIND_LABEL[pieceKind(CONTENT.pieces[g.id])];
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

/** One more of a run stat, as the line under a scaling ×Mult says it (Ahead of Schedule). */
const STAT_EACH: Record<RunStat, string> = {
  milestonesEarly: 'milestone completed early',
};

/**
 * D-141: a blueprint's worth in your house, from the rules' blueprintValue: what it would add to
 * a week's Wow (in the shop, the next week's), and roughly what that comes to over the rest of
 * the run, each week left added up. The strip is the fixture's (shop.css), with the cases a
 * week's snapshot gets wrong said in words: one that grows says how far, one that acts only in a
 * phase's last week says so, budget is its own line with the coin, and a ×Mult that scales with
 * early milestones says what each would add. A blueprint with nothing to add yet says what it's
 * waiting for ("No Dark rooms yet"), quietly. `where` is the strip on a card, or a plain block in
 * the inspect panel for a blueprint you hold.
 */
export function BlueprintWorth({
  value,
  where = 'card',
}: {
  value: BlueprintValue | null;
  where?: 'card' | 'panel';
}) {
  if (!value) return null;
  const wow = SCORE_LABELS.total;
  const cls = where === 'card' ? 'pcard-worth' : 'good-worth';
  const each = value.perStat && value.perStat.gain !== 0 && (
    <span class="worth-host">
      {signed(value.perStat.gain)} {wow} a week for each {STAT_EACH[value.perStat.stat]}
    </span>
  );
  // A Mult counted per piece (It's a House, Model Home): what each one adds, so the card names
  // its build even while the house has none (D-143).
  const piece = value.perPiece && value.perPiece.gain !== 0 && (
    <span class="worth-host">
      {signed(value.perPiece.gain)} {wow} a week for each {value.perPiece.what}
    </span>
  );
  if (value.needs !== undefined) {
    return (
      <div class={`${cls} none`}>
        <span class="worth-needs">{value.needs}</span>
        {each}
        {piece}
      </div>
    );
  }
  // Wow leads; a blueprint that only pays budget is judged by that.
  const sum = value.overRun || value.gain || value.budget;
  const good = sum > 0;
  const weeks = `${value.weeksLeft} ${value.weeksLeft === 1 ? 'week' : 'weeks'}`;
  const mark = <Icon name={good ? 'up' : 'down'} />;
  const when =
    value.when === 'lastWeek'
      ? 'in a phase’s last week'
      : value.growsTo !== undefined
        ? `a week, growing to ${signed(value.growsTo)}`
        : 'a week';
  const run = (
    <Tip
      title="Over the run"
      text={`What it adds in each of the ${weeks} left in the run, added up, if the house stays as it is. It won’t, so take it as a rough guide.`}
    >
      about {signed(value.overRun)} over the run
    </Tip>
  );
  return (
    <div class={`${cls} ${good ? 'good' : 'bad'}`}>
      {value.gain !== 0 && (
        <span class="worth-gain">
          <span class="worth-num">
            {mark}
            {signed(value.gain)}
          </span>{' '}
          {wow} {when}
        </span>
      )}
      {value.gain !== 0 && each}
      {piece}
      {value.overRun !== 0 && (
        <span class="worth-run">
          {/* Nothing in the first week (a Sapling that isn't a Tree yet): the run's sum leads. */}
          {value.gain === 0 && <span class="worth-num">{mark}</span>}
          {value.gain === 0 ? <>{wow}: </> : null}
          {run}
        </span>
      )}
      {value.budget !== 0 && (
        <span class="worth-budget">
          <span class="worth-num">
            <Icon name="coin" />
            {signed(value.budget)}
          </span>{' '}
          <Tip
            title="Over the run"
            text={`What it pays over the ${weeks} left in the run, if the house stays as it is. It won’t, so take it as a rough guide.`}
          >
            budget over the run
          </Tip>
        </span>
      )}
    </div>
  );
}
