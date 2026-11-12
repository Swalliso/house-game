// The shop between milestones (D-051; implementation-plan.md §7, M3a): a section per kind of
// good with rarity borders and labels, the sale, the rising refresh, the services (rerolls,
// demolitions, and D-157's strikes), and Leave, which starts the next milestone. Selling is in
// the inventory beside it. The UI never prices anything: the rules' shopOffers() does. Each
// fixture, on sale or in a crate, says what it's worth in your house (D-107): the rules'
// fixtureValue() does that. So does each blueprint, the free Housewarming pick included (D-141):
// the rules' blueprintValue() does that, and each has its own icon (sprites.ts BLUEPRINT_ICONS).
//
// M5a draws it as a wood sheet over the board: the budget as the header's hero counter, the
// goods as paper cards of one size packed onto shelves (each with its art, its kind and
// rarity, a coin price, and Buy), a plank tag per section, and full slots said once at each
// shelf's tag instead of on every card (shelves.ts). Hidden, the shop leaves a handle at the
// board's foot.
//
// The first job's shops run a shop behind (D-158; first-job.ts shopStageOf): its first is the
// housewarming gift alone, its second has the shelves any run's first shop has, and from its
// third it's the whole yard. A line under the shelves says what's still to come.

import { useEffect, useRef, useState } from 'preact/hooks';
import { computed, signal } from '@preact/signals';
import {
  CONTENT,
  lastShopText,
  rules,
  type BlueprintId,
  type FixtureId,
  type FixtureValue,
  type OfferView,
  type ServiceId,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { burstAt } from '../fx/particles.ts';
import { settings } from '../settings.ts';
import { shopHidden } from '../hud/actions.ts';
import { BudgetCount } from '../hud/BudgetCount.tsx';
import { shelfShown, shopStage, stageNote, type ShelfId } from '../hud/first-job.ts';
import { TagChips } from '../hud/Hand.tsx';
import { FixtureArt, PieceArt, ShapeGlyph } from '../hud/PieceArt.tsx';
import { BLUEPRINT_ICONS, TOOL_ICONS } from '../sprites.ts';
import {
  BlueprintWorth,
  FixtureWorth,
  goodKind,
  goodLines,
  goodName,
  goodRarity,
  offerGood,
  RARITY_LABEL,
  type GoodRef,
} from '../hud/goods.tsx';
import { Tip } from '../hud/Tip.tsx';
import {
  Button,
  Card,
  Chip,
  Icon,
  Panel,
  Price,
  type CardTone,
  type IconName,
} from '../kit/kit.tsx';
import { buy, inspected, leaveShop, pickOption, refreshShop, run } from '../store.ts';
import { Notes } from './Overlays.tsx';
import {
  cardReason,
  fullReason,
  isSold,
  shelfReasons,
  shortBy,
  type ShelfNote,
} from './shelves.ts';
import './shop.css';

/** Offers just bought, for their pop. */
const justBought = signal<number | null>(null);

/**
 * D-107: what each fixture on offer (or in an open crate) is worth in your house, from the
 * rules' fixtureValue(): once per state, not per render.
 */
const fixtureValues = computed(() => {
  const s = run.value;
  const out = new Map<FixtureId, FixtureValue | null>();
  if (s.screen !== 'shop') return out;
  for (const o of [...(s.offers?.shop?.offers ?? []), ...(s.offers?.pick?.options ?? [])]) {
    if (o.kind === 'fixture' && !out.has(o.id)) out.set(o.id, rules.fixtureValue(s, o.id));
  }
  return out;
});

/** A fixture's line: its best host in your house and what it would add (D-107). */
function Worth({ id }: { id: FixtureId }) {
  return <FixtureWorth value={fixtureValues.value.get(id) ?? null} />;
}

/**
 * A blueprint's line: what it would add to your house, or what it's waiting for (D-141). The
 * rules keep each state's values, so this asks them as it renders.
 */
function Plan({ id }: { id: BlueprintId }) {
  return <BlueprintWorth value={rules.blueprintValue(run.value, id)} />;
}

const noFocus = (e: MouseEvent) => e.preventDefault();

const SERVICE_TEXT: Record<ServiceId, string> = {
  reroll: 'One more reroll, to keep. Bought rerolls never run out.',
  demolition: 'One more demolition: clear a piece, a boulder, or something in the way.',
  strike: 'One more strike, to keep: a hand card’s type, gone for the run.',
};

const SERVICE_ICON: Record<ServiceId, IconName> = {
  reroll: 'reroll',
  demolition: 'hammer',
  strike: 'strike',
};

function buyOffer(o: OfferView): void {
  if (!o.ok) {
    audio.play('illegal');
    return;
  }
  if (buy(o.i)) {
    justBought.value = o.i;
    setTimeout(() => justBought.value === o.i && (justBought.value = null), FEEL.shop.boughtMs);
  }
}

/** The good's own icon (a tool's, a blueprint's), or its kind's (crates, the upgrade), for the art slot. */
function kindIcon(o: OfferView['offer']): IconName {
  switch (o.kind) {
    case 'service':
      return SERVICE_ICON[o.service];
    case 'piece':
      return 'House';
    case 'tool':
      return TOOL_ICONS[o.id];
    case 'blueprint':
      return BLUEPRINT_ICONS[o.id];
    default:
      return o.kind;
  }
}

/**
 * A good's picture: a piece as the board builds it, a fixture as the board draws it (or its
 * icon), or its own or its kind's icon, drawn large.
 */
function OfferArt({ offer }: { offer: OfferView['offer'] }) {
  if (offer.kind === 'piece') return <PieceArt id={offer.id} />;
  if (offer.kind === 'fixture') return <FixtureArt id={offer.id} />;
  const own = offer.kind === 'tool' || offer.kind === 'blueprint';
  return <Icon name={kindIcon(offer)} class={own ? 'art-icon own' : 'art-icon'} />;
}

/**
 * A blueprint's icon beside its title, for a short window, where the cards have no pictures
 * (shop.css shows it only there): a shelf of blueprints still tells them apart (D-141).
 */
function titleIcon(good: GoodRef | null) {
  if (good?.kind !== 'blueprint') return undefined;
  return <Icon name={BLUEPRINT_ICONS[good.id]} class="title-icon" />;
}

/** A piece's kind, for its card's tint and band (and lawn behind a yard piece's picture). */
function pieceTone(good: GoodRef | null): CardTone | undefined {
  if (good?.kind !== 'piece') return undefined;
  const def = CONTENT.pieces[good.id];
  if (def.connector) return 'hall';
  if (def.category === 'indoor') return 'room';
  return def.category === 'yard' ? 'yard' : 'outbuilding';
}

/** A good's chips: its kind (where its shelf mixes kinds), its rarity, and a piece's tags. */
function OfferChips({ good, kind = false }: { good: GoodRef; kind?: boolean }) {
  const rarity = goodRarity(good);
  return (
    <>
      {kind && <Chip tone="wood">{goodKind(good)}</Chip>}
      {rarity && (
        <Tip term="rarity">
          <Chip tone={rarity}>{RARITY_LABEL[rarity]}</Chip>
        </Tip>
      )}
      {good.kind === 'piece' && <TagChips tags={CONTENT.pieces[good.id].tags} />}
    </>
  );
}

/** Buy's label: Buy, Full (its reason is at the shelf's tag), or what the budget is short by. */
function buyLabel(o: OfferView, short: number): string {
  if (fullReason(o) !== null) return 'Full';
  return short > 0 ? `Need ${short}` : 'Buy';
}

/**
 * A Rare arriving on the shelf (D-125): once the sheet has landed, glints burst from it as its
 * shimmer crosses it (the director plays its bell with the shop's beats).
 */
function useRareArrival(rare: boolean): { current: HTMLSpanElement | null } {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!rare) return;
    const t = setTimeout(
      // From the card's top, which shows even when the shelf cuts the card off.
      () => burstAt('glints', ref.current, { fy: 0.1, area: { w: 60, h: 16 } }),
      FEEL.moments.rareDelayMs,
    );
    return () => clearTimeout(t);
  }, []);
  return ref;
}

function OfferCard({ o, mixed }: { o: OfferView; mixed: boolean }) {
  const good = offerGood(o.offer);
  const sold = isSold(o);
  const rareRef = useRareArrival(o.rarity === 'rare' && !sold);
  const short = shortBy(o, run.value.budget);
  const alert = cardReason(o) ?? undefined;
  const service = o.offer.kind === 'service' ? o.offer.service : null;
  return (
    <Card
      class={`offer kind-${o.offer.kind} ${o.onSale ? 'on-sale' : ''} ${sold ? 'sold' : ''} ${justBought.value === o.i ? 'just-bought' : ''}`}
      tone={pieceTone(good)}
      rarity={o.rarity}
      title={o.name}
      lead={service ? <Icon name={SERVICE_ICON[service]} /> : titleIcon(good)}
      aside={o.offer.kind === 'piece' ? <ShapeGlyph id={o.offer.id} /> : undefined}
      art={service ? undefined : <OfferArt offer={o.offer} />}
      chips={good ? <OfferChips good={good} kind={mixed} /> : undefined}
      lines={good ? goodLines(good) : undefined}
      note={service ? SERVICE_TEXT[service] : undefined}
      alert={alert}
      // D-157: the strikes held, since the hand's plank isn't on screen in the shop.
      tip={
        service === 'strike'
          ? `You hold ${run.value.strikesLeft} ${run.value.strikesLeft === 1 ? 'strike' : 'strikes'}.`
          : undefined
      }
      onMouseEnter={() => good && (inspected.value = { kind: 'offer', i: o.i })}
    >
      {o.rarity === 'rare' && <span class="offer-shine" aria-hidden="true" ref={rareRef} />}
      {o.onSale && !sold && (
        <span class="sale-tag">
          <Tip term="sale">Sale</Tip>
        </span>
      )}
      {o.offer.kind === 'fixture' && !sold && <Worth id={o.offer.id} />}
      {o.offer.kind === 'blueprint' && !sold && <Plan id={o.offer.id} />}
      <footer class="offer-foot">
        {sold ? (
          <span class="sold-stamp">Sold</span>
        ) : (
          <>
            <Price price={o.price} full={o.onSale ? o.fullPrice : undefined} short={short > 0} />
            <Button
              size="sm"
              class="buy"
              onMouseDown={noFocus}
              onClick={() => buyOffer(o)}
              disabled={!o.ok}
              tip={
                o.ok
                  ? `Buy ${o.name}`
                  : short > 0
                    ? `${o.reason} It needs ${short} more.`
                    : o.reason
              }
            >
              {buyLabel(o, short)}
            </Button>
          </>
        )}
      </footer>
    </Card>
  );
}

interface Shelf {
  id: ShelfId;
  title: string;
  offers: readonly OfferView[];
  term?: Parameters<typeof Tip>[0]['term'];
  /** Text-only goods (the services): no art slot. */
  compact?: boolean;
}

/** A shelf of one kind of good, with what full slots keep you from buying said at its tag. */
function Section({
  title,
  offers,
  term,
  compact = false,
  full,
}: Omit<Shelf, 'id'> & { full: ShelfNote[] }) {
  if (offers.length === 0) return null;
  const mixed = new Set(offers.map((o) => o.offer.kind)).size > 1;
  return (
    <section class={`shelf ${compact ? 'compact' : ''}`}>
      <header class="shelf-head">
        <h2 class="plank-tag">{term ? <Tip term={term}>{title}</Tip> : title}</h2>
      </header>
      {full.map((note) => (
        <p key={note.reason} class="shelf-full" role="note">
          <Icon name="warn" />
          <span>
            {note.text} <span aria-hidden="true">→</span>
          </span>
        </p>
      ))}
      <div class="offers">
        {offers.map((o) => (
          <OfferCard key={`${o.i}-${o.name}`} o={o} mixed={mixed} />
        ))}
      </div>
    </section>
  );
}

/**
 * One of an open crate's options. It turns over on its beat (--beat, the delay of its CSS
 * animation and of a Rare's shimmer), and its sound is scheduled for the same beat when it
 * appears: once, with or without Reduce motion (which turns the animation off), and not twice
 * for a Rare (its shimmer is an animation of its own).
 */
function CrateOption({
  good,
  i,
  ok,
  afterMs,
}: {
  good: GoodRef;
  i: number;
  ok: boolean;
  /** The crate's shake before it opens: the options turn over after it. */
  afterMs: number;
}) {
  const rarity = goodRarity(good);
  const beatMs = afterMs + i * FEEL.shop.crateStaggerMs;
  useEffect(() => {
    const delay = beatMs / 1000;
    if (rarity === 'rare') audio.play('sparkle', { delay });
    else audio.play('plink', { rate: 1 + i * 0.2, delay });
  }, []);
  const offer = good as OfferView['offer'];
  return (
    <Card
      class="offer crate-option"
      tone={pieceTone(good)}
      rarity={rarity}
      title={goodName(good)}
      lead={titleIcon(good)}
      art={<OfferArt offer={offer} />}
      chips={<OfferChips good={good} />}
      lines={goodLines(good)}
      alert={ok ? undefined : 'No room: sell something first'}
      style={{ '--beat': `${beatMs}ms` }}
    >
      {rarity === 'rare' && <span class="offer-shine" aria-hidden="true" />}
      {good.kind === 'fixture' && <Worth id={good.id} />}
      {good.kind === 'blueprint' && <Plan id={good.id} />}
      <footer class="offer-foot">
        <Button
          size="sm"
          class="buy"
          disabled={!ok}
          tip={ok ? `Keep ${goodName(good)}` : 'No room: sell something first'}
          onClick={() => (pickOption(i) ? audio.play('buy') : audio.play('illegal'))}
        >
          Keep
        </Button>
      </footer>
    </Card>
  );
}

/** The glints' colors by rarity, from tokens.css. */
const GLINTS: Readonly<Record<'common' | 'uncommon' | 'rare', readonly string[]>> = {
  common: ['--card-hi', '--paper-line'],
  uncommon: ['--good-fill', '--comfort-tint', '--card-hi'],
  rare: ['--gold-hi', '--sparkle', '--card-hi'],
};

/**
 * A crate opening (D-125): the crate itself, glowing in its best option's rarity, shakes for a
 * moment, then bursts open with glints in that color and a creak and a pop, and the options turn
 * over behind it. With Reduce motion it glows and opens without the shake or the glints.
 */
function CrateLid({ best }: { best: 'common' | 'uncommon' | 'rare' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ms = FEEL.moments.crateShakeMs;
    audio.play('rotate', { rate: 0.6 });
    audio.play('crate-open', { delay: ms / 1000 });
    const t = setTimeout(() => {
      burstAt('glints', ref.current, { colors: GLINTS[best], scale: best === 'rare' ? 1.5 : 1 });
      setOpen(true);
    }, ms);
    return () => clearTimeout(t);
  }, []);
  if (open) return null;
  return (
    <div
      ref={ref}
      class={`crate-lid rarity-${best} ${settings.value.reduceMotion ? '' : 'shaking'}`}
      style={{ '--lid-ms': `${FEEL.moments.crateShakeMs}ms` }}
      aria-hidden="true"
    >
      <Icon name="crate" />
    </div>
  );
}

/**
 * The housewarming gift's line: a new player's first blueprint, so it says what one is. An
 * outside playtester read the word as "a thing I would build" (D-158).
 */
export const GIFT_NOTE =
  'Free: keep one. A blueprint is a bonus that stays on for the whole run; you don’t build it.';
const CRATE_NOTE = 'Keep one. Sell from your goods on the right to make room.';

/**
 * An opened crate (or the Housewarming gift): its options turn over one at a time, each with
 * a glow by rarity (§12, Shop and crates), and one can be kept. Sell first to make room.
 */
function CratePickSheet() {
  const s = run.value;
  const open = s.offers?.pick;
  if (!open) return null;
  const legal = new Set(
    rules.legalActions(s).flatMap((a) => (a.t === 'pick' && a.i >= 0 ? [a.i] : [])),
  );
  const title =
    open.source === 'housewarming' ? 'A housewarming gift' : CONTENT.crates[open.source].name;
  // Its best option's rarity glows through the lid before it opens (§12, Hearthstone's packs).
  const rarities = open.options.map((o) => goodRarity(o as GoodRef));
  const best = rarities.includes('rare')
    ? 'rare'
    : rarities.includes('uncommon')
      ? 'uncommon'
      : 'common';
  const lidMs = FEEL.moments.crateShakeMs;
  const lidKey = open.options.map((o) => o.id).join(',');
  const detail = open.source === 'housewarming' ? GIFT_NOTE : CRATE_NOTE;
  return (
    <div class="shop-scrim" role="dialog" aria-label={title}>
      <Panel
        class="shop-pick crate-sheet"
        title={
          <>
            <Icon name="crate" /> {title}
          </>
        }
      >
        <div class="pick-scroll">
          <p class="pick-note">{detail}</p>
          <div class="crate-options">
            <CrateLid best={best} key={lidKey} />
            {open.options.map((o, i) => (
              <CrateOption
                key={`${i}-${o.id}`}
                good={o as GoodRef}
                i={i}
                ok={legal.has(i)}
                afterMs={lidMs}
              />
            ))}
          </div>
        </div>
        {/* Out of the scrolling part, so Set it aside shows on any window. */}
        <div class="pick-foot">
          <Button onClick={() => pickOption(-1)}>Set it aside</Button>
        </div>
      </Panel>
    </div>
  );
}

let lastRefresh = -Infinity;

/** Refresh, once for a double-click: the second click would pay again (FEEL.shop). */
export function refreshOnce(): void {
  const now = performance.now();
  if (now - lastRefresh < FEEL.shop.refreshGuardMs) return;
  lastRefresh = now;
  if (refreshShop()) audio.play('rotate', { rate: 0.8 });
  else audio.play('illegal');
}

/** The hidden shop's handle, at the foot of the board: it slides the sheet back up. */
function ShopHandle() {
  return (
    <div class="shop-handle-place">
      <Button
        variant="wood"
        class="shop-handle"
        onClick={() => (shopHidden.value = false)}
        tip="The shop is still open"
      >
        <span aria-hidden="true">↑</span> Back to the shop
      </Button>
    </div>
  );
}

export function ShopScreen() {
  const s = run.value;
  const visit = s.offers?.shop;
  // The shop waits for the milestone's tally and banner to finish.
  if (s.screen !== 'shop' || !visit || busy.value) return null;
  if (shopHidden.value) return <ShopHandle />;
  const offers = rules.shopOffers(s);
  const refresh = rules.canRefresh(s);
  // A shop the ?debug panel opened mid-week goes back to that week.
  const next = visit.forced ? `week ${s.slot}` : rules.phaseName(s.phase);
  const leaveLabel = visit.forced ? `Back to week ${s.slot}` : `Start ${next}`;
  const of = (kind: OfferView['offer']['kind']) => offers.filter((o) => o.offer.kind === kind);
  const cards = offers.filter((o) => o.offer.kind === 'piece' || o.offer.kind === 'fixture');
  // The first job's shops (D-158): the gift alone, then a first shop's shelves, then all of it.
  const stage = shopStage.value;
  const every: Shelf[] = [
    { id: 'blueprints', title: 'Blueprints', offers: of('blueprint'), term: 'blueprints' },
    { id: 'cards', title: 'Pieces and fixtures', offers: cards, term: 'fixture' },
    { id: 'tools', title: 'Tools', offers: of('tool'), term: 'tools' },
    { id: 'crates', title: 'Crates', offers: of('crate'), term: 'crates' },
    { id: 'upgrades', title: 'Company upgrade', offers: of('upgrade'), term: 'upgrades' },
    {
      id: 'services',
      title: 'Services',
      offers: of('service'),
      term: 'services',
      compact: true,
    },
  ];
  const shelves = every.filter((shelf) => shelfShown(stage, shelf.id));
  const later = stageNote(stage, next);
  const full = shelfReasons(shelves.map((shelf) => shelf.offers));
  const skip = CONTENT.balance.shop.skipReward;
  // The shop before the last phase (D-148): what budget kept past it is worth, from the rules.
  const lastShop =
    !visit.forced && s.phase === CONTENT.balance.phases.length - 1 ? lastShopText(CONTENT) : null;
  return (
    <section class="shop panel ui" role="region" aria-label={`Shop ${visit.number}`}>
      <header class="shop-head panel-head">
        <div class="shop-name">
          <h1 class="shop-title">The supply yard</h1>
          <p class="shop-sub">
            Shop {visit.number} of {CONTENT.balance.phases.length - 1}
            {visit.forced ? ' (debug)' : ''} · next up: {next}
          </p>
        </div>
        <div class="shop-budget" aria-label={`Budget ${s.budget}`}>
          <Tip term="budget">
            <Icon name="coin" class="shop-coin" label="Budget" />
          </Tip>
          {/* Counts like the top bar's; quiet, since the top bar's plays the coins. */}
          <BudgetCount value={s.budget} quiet />
        </div>
        <div class="shop-tools">
          {/* Nothing to refresh while the gift is the whole shop (D-158). */}
          {stage !== 'gift' && (
            <Button
              icon="reroll"
              onMouseDown={noFocus}
              onClick={refreshOnce}
              disabled={!refresh.ok}
              tip={refresh.ok ? 'New goods (not the services)' : refresh.reason}
            >
              <Tip term="refresh">Refresh</Tip>
              <Price price={refresh.price} short={!refresh.ok && refresh.price > s.budget} />
            </Button>
          )}
          <Button
            icon="fit"
            class="shop-look"
            onMouseDown={noFocus}
            onClick={() => (shopHidden.value = true)}
            tip="Hide the shop to look at the lot (it stays open)"
            aria-label="Look at the lot"
          >
            <span class="shop-look-text">Look at the lot</span>
          </Button>
        </div>
      </header>
      <Notes docked />
      <div class={`panel-body shop-body ${stage === 'gift' ? 'gift-only' : ''}`}>
        <div class="shelves">
          {shelves.map(({ id, ...shelf }, k) => (
            <Section key={id} {...shelf} full={full[k]!} />
          ))}
        </div>
        {later && (
          <p class={`shop-later ${stage}`} role="note">
            {later}
          </p>
        )}
      </div>
      {lastShop && (
        <p class="shop-last">
          <Icon name="coin" />
          <span>{lastShop}</span>
        </p>
      )}
      {/* Leaving is the sheet's one primary action, at its foot like End week's (D-087). */}
      <footer class="shop-foot">
        {/* With the gift alone there's nothing worth selling yet (D-158). */}
        {stage !== 'gift' && (
          <p class="shop-foot-hint">
            <span class="hint-long">Sell from your goods on the right </span>
            <span class="hint-short">Sell on the right </span>
            <span aria-hidden="true">→</span>
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          class="leave"
          onMouseDown={noFocus}
          onClick={() => leaveShop()}
          tip={visit.boughtAny ? leaveLabel : `${leaveLabel}, and +${skip} budget for saving up`}
        >
          {leaveLabel}
          {!visit.boughtAny && skip > 0 && (
            <span class="skip-hint">
              <Icon name="coin" />
              <Tip term="skipReward">+{skip}</Tip>
              <span class="skip-word">for saving</span>
            </span>
          )}
        </Button>
      </footer>
      <CratePickSheet />
    </section>
  );
}
