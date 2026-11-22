// Shop goods as the HUD and the shop describe them: names, rarity labels, and the text the
// rules generate from their data (D-038). Rarity is a colored border plus a label, never
// color alone (D-051). A fixture also says what it's worth in your house (D-107), from the
// rules' fixtureValue, a blueprint from the rules' blueprintValue (D-141), and a piece and a
// tool from the rules' pieceValue and toolValue (D-193): the UI only words the numbers.

import {
  blueprintText,
  cardText,
  CONTENT,
  crateText,
  fixtureText,
  ordinal,
  SCORE_LABELS,
  setText,
  toolText,
  upgradeText,
  type BlueprintId,
  type BlueprintValue,
  type CrateId,
  type FixtureId,
  type FixtureValue,
  type PieceDef,
  type PieceId,
  type PieceValue,
  type Rarity,
  type RunStat,
  type ShopOffer,
  type ToolId,
  type ToolValue,
  type UpgradeId,
} from '../../rules/index.ts';
import { signed } from '../format.ts';
import { Icon } from '../kit/kit.tsx';
import { Tip, withTerm } from './Tip.tsx';
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
  return 'Goes in your reserve. Placing it is free: it doesn’t use your week.';
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
  const terms = good.kind === 'piece' ? cardText(CONTENT, CONTENT.pieces[good.id]).terms : null;
  return (
    <>
      <p class="good-kind">
        {goodKind(good)}
        {rarity && <RarityTag rarity={rarity} />}
        {tags.length > 0 && <span class="muted"> · {tags.join(' · ')}</span>}
      </p>
      <ul class="effects">
        {goodLines(good).map((t, i) => {
          // A piece's effect lines come first, each with any glossary term it links (D-195).
          const term = terms?.[i];
          return <li key={t}>{term ? withTerm(t, term) : t}</li>;
        })}
      </ul>
      {where && <p class="muted good-where">{goodWhere(good)}</p>}
    </>
  );
}

/** Where a good's worth is shown: a strip on a shop card (shop.css), or a block in Inspect. */
export type WorthPlace = 'card' | 'panel';

const worthClass = (where: WorthPlace) => (where === 'card' ? 'pcard-worth' : 'good-worth');

/** "8 weeks", "1 week". */
const weeksText = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`;

/** The run's figure, with its tip: "about +1,400 over the run". */
function OverRun({ value, tip }: { value: number; tip: string }) {
  return (
    <Tip title="Over the run" text={tip}>
      about {signed(value)} over the run
    </Tip>
  );
}

/** Each week left added up (D-141's projection), as a blueprint's and a piece's tips say it. */
const SUMMED_TIP = (weeks: number) =>
  `What it adds in each of the ${weeksText(weeks)} left in the run, added up, if the house stays as it is. It won’t, so take it as a rough guide.`;

/**
 * D-107: a fixture's worth in your house, from the rules' fixtureValue: its best host, what it
 * would add to the week's Wow there (in the shop, the next week's), and roughly what that comes
 * to over the rest of the run. A strip on the shop's cards (shop.css): the gain first, in blue
 * with an up icon, or a loss in orange with a down icon; quiet when nothing takes it, or it adds
 * nothing yet. The host is named as it's valued: in the shop, a Nursery that grows into a Kids'
 * Room as the next phase starts is the Kids' Room. In Inspect (D-193) it's a plain block.
 */
export function FixtureWorth({
  value,
  where = 'card',
}: {
  value: FixtureValue | null;
  where?: WorthPlace;
}) {
  const wow = SCORE_LABELS.total;
  const cls = worthClass(where);
  if (!value) return <div class={`${cls} none`}>No piece here takes it yet</div>;
  if (value.gain === 0) {
    return <div class={`${cls} none`}>Fits, but adds no {wow} to your house yet</div>;
  }
  const good = value.gain > 0;
  const host = CONTENT.pieces[value.hostDefId].name;
  const old = value.replaces ? `, replacing its ${CONTENT.fixtures[value.replaces].name}` : '';
  return (
    <div class={`${cls} ${good ? 'good' : 'bad'}`}>
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
        <OverRun
          value={value.overRun}
          tip={`${signed(value.gain)} ${wow} a week for the ${weeksText(value.weeksLeft)} left in the run, if the house stays as it is. It won’t, so take it as a rough guide.`}
        />
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
  where?: WorthPlace;
}) {
  if (!value) return null;
  const wow = SCORE_LABELS.total;
  const cls = worthClass(where);
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
  const mark = <Icon name={good ? 'up' : 'down'} />;
  const when =
    value.when === 'lastWeek'
      ? 'in a phase’s last week'
      : value.growsTo !== undefined
        ? `a week, growing to ${signed(value.growsTo)}`
        : 'a week';
  const run = <OverRun value={value.overRun} tip={SUMMED_TIP(value.weeksLeft)} />;
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
      {value.budget !== 0 && <BudgetLine budget={value.budget} weeks={value.weeksLeft} />}
    </div>
  );
}

/** Budget over the run, on its own line with the coin: never turned into Wow (D-141). */
function BudgetLine({ budget, weeks }: { budget: number; weeks: number }) {
  return (
    <span class="worth-budget">
      <span class="worth-num">
        <Icon name="coin" />
        {signed(budget)}
      </span>{' '}
      <Tip
        title="Over the run"
        text={`What it pays over the ${weeksText(weeks)} left in the run, if the house stays as it is. It won’t, so take it as a rough guide.`}
      >
        budget over the run
      </Tip>
    </span>
  );
}

/**
 * D-193: a piece's worth in your house, from the rules' pieceValue: what it would add to a week's
 * Wow at its best spot (in the shop, the next week's), and roughly what that comes to over the
 * rest of the run, each week left added up, as a blueprint's line does. A piece with a rhythm
 * (the Pool) leads with what it adds in a week it pays, "every 3rd week"; a type at its limit
 * says the Renovation or the extension it would make; budget is its own line with the coin. With
 * no legal play it says so, quietly. The strip is the fixture's (shop.css), or a plain block in
 * the inspect panel.
 */
export function PieceWorth({
  value,
  where = 'card',
}: {
  value: PieceValue | null;
  where?: WorthPlace;
}) {
  const wow = SCORE_LABELS.total;
  const cls = worthClass(where);
  if (!value) return <div class={`${cls} none`}>No spot for it on your lot yet</div>;
  const shown = value.rhythm ? value.rhythm.gain : value.gain;
  if (shown === 0 && value.overRun === 0 && value.budget === 0) {
    return (
      <div class={`${cls} none`}>
        {value.nothing
          ? `Earns nothing (${value.nothing})`
          : `Fits, but adds no ${wow} to your house yet`}
      </div>
    );
  }
  // Wow leads; a piece that only pays budget is judged by that.
  const good = (value.overRun || shown || value.budget) > 0;
  const mark = <Icon name={good ? 'up' : 'down'} />;
  const room = value.room && CONTENT.pieces[value.room.defId].name;
  const how =
    value.how === 'renovate'
      ? `renovating your ${room}`
      : value.how === 'extend'
        ? `extending your ${room}`
        : null;
  return (
    <div class={`${cls} ${good ? 'good' : 'bad'}`}>
      {shown !== 0 && (
        <span class="worth-gain">
          <span class="worth-num">
            {mark}
            {signed(shown)}
          </span>{' '}
          {wow} {value.rhythm ? `every ${ordinal(value.rhythm.every)} week` : 'a week'}
        </span>
      )}
      {how && <span class="worth-host">{how}</span>}
      {value.overRun !== 0 && (
        <span class="worth-run">
          {/* Nothing in its first week: the run's sum leads. */}
          {shown === 0 && <span class="worth-num">{mark}</span>}
          {shown === 0 ? <>{wow}: </> : null}
          <OverRun value={value.overRun} tip={SUMMED_TIP(value.weeksLeft)} />
        </span>
      )}
      {value.budget !== 0 && <BudgetLine budget={value.budget} weeks={value.weeksLeft} />}
    </div>
  );
}

/**
 * D-193: a tool's worth in your house, from the rules' toolValue. A one-week tool (Rush Order)
 * says what it would add the week it's used, as the house stands; a Remodel Plan, what its set's
 * next level adds a week and over the run, or what it's waiting for; the rest say what they'd do
 * here (a Fertilizer's Sapling), or why they have no number, quietly.
 */
export function ToolWorth({
  value,
  where = 'card',
}: {
  value: ToolValue | null;
  where?: WorthPlace;
}) {
  if (!value) return null;
  const wow = SCORE_LABELS.total;
  const cls = worthClass(where);
  switch (value.kind) {
    case 'week': {
      const good = value.gain > 0;
      return (
        <div class={`${cls} ${good ? 'good' : 'bad'}`}>
          <span class="worth-gain">
            <span class="worth-num">
              <Icon name={good ? 'up' : 'down'} />
              {signed(value.gain)}
            </span>{' '}
            {wow}{' '}
            <Tip
              title="The week you use it"
              text={`What it adds to that week’s ${wow}, as your house stands now. It counts for one week, so a bigger week gets more from it.`}
            >
              the week you use it
            </Tip>
          </span>
        </div>
      );
    }
    case 'level': {
      const good = (value.overRun || value.gain) > 0;
      const mark = <Icon name={good ? 'up' : 'down'} />;
      return (
        <div class={`${cls} ${good ? 'good' : 'bad'}`}>
          {value.gain !== 0 && (
            <span class="worth-gain">
              <span class="worth-num">
                {mark}
                {signed(value.gain)}
              </span>{' '}
              {wow} a week
            </span>
          )}
          <span class="worth-host">
            {CONTENT.sets[value.set].name} to level {value.level}
          </span>
          <span class="worth-run">
            {value.gain === 0 && <span class="worth-num">{mark}</span>}
            {value.gain === 0 ? <>{wow}: </> : null}
            <OverRun value={value.overRun} tip={SUMMED_TIP(value.weeksLeft)} />
          </span>
        </div>
      );
    }
    case 'needs':
      return (
        <div class={`${cls} none`}>
          <span class="worth-needs">
            {value.set ? (
              <Tip title={CONTENT.sets[value.set].name} text={setText(CONTENT, value.set)}>
                {value.needs}
              </Tip>
            ) : (
              value.needs
            )}
          </span>
        </div>
      );
    case 'note':
      return (
        <div class={`${cls} none`}>
          <span class="worth-note">{value.note}</span>
        </div>
      );
  }
}
