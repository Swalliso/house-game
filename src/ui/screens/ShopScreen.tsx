// The shop between milestones (D-051; implementation-plan.md §7, M3a): a section per kind of
// good with rarity borders and labels, the sale, the rising refresh, the services (rerolls,
// demolitions, and D-076's strike), and Leave, which starts the next milestone. Selling is in
// the inventory beside it. The UI never prices anything: the rules' shopOffers() does.
//
// M5a draws it as a wood sheet over the board: the budget as the header's hero counter, the
// goods as paper cards of one size packed onto shelves (each with its art, its kind and
// rarity, a coin price, and Buy), a plank tag per section, and full slots said once at each
// shelf's tag instead of on every card (shelves.ts). Hidden, the shop leaves a handle at the
// board's foot.

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import {
  CONTENT,
  rules,
  type CardType,
  type OfferView,
  type ServiceId,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { busy } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { shopHidden } from '../hud/actions.ts';
import { BudgetCount } from '../hud/BudgetCount.tsx';
import { TagChips } from '../hud/Hand.tsx';
import { FixtureArt, PieceArt, ShapeGlyph } from '../hud/PieceArt.tsx';
import { TOOL_ICONS } from '../sprites.ts';
import {
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

/** The strike service's picker is open. */
const striking = signal<number | null>(null);
/** Offers just bought, for their pop. */
const justBought = signal<number | null>(null);

const noFocus = (e: MouseEvent) => e.preventDefault();

const SERVICE_TEXT: Record<ServiceId, string> = {
  reroll: 'One more reroll, to keep. Bought rerolls never run out.',
  demolition: 'One more demolition: clear a piece, a boulder, or something in the way.',
  strike: 'Pick a card type: it’s never drawn again this run.',
};

const SERVICE_ICON: Record<ServiceId, IconName> = {
  reroll: 'reroll',
  demolition: 'hammer',
  strike: 'cross',
};

function buyOffer(o: OfferView): void {
  if (!o.ok) {
    audio.play('illegal');
    return;
  }
  if (o.offer.kind === 'service' && o.offer.service === 'strike') {
    striking.value = o.i;
    audio.play('select');
    return;
  }
  if (buy(o.i)) {
    justBought.value = o.i;
    setTimeout(() => justBought.value === o.i && (justBought.value = null), FEEL.shop.boughtMs);
  }
}

/** The good's own icon (a tool's), or its kind's (blueprints, crates, the upgrade), for the art slot. */
function kindIcon(o: OfferView['offer']): IconName {
  switch (o.kind) {
    case 'service':
      return SERVICE_ICON[o.service];
    case 'piece':
      return 'House';
    case 'tool':
      return TOOL_ICONS[o.id];
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
  return (
    <Icon name={kindIcon(offer)} class={offer.kind === 'tool' ? 'art-icon own' : 'art-icon'} />
  );
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

function OfferCard({ o, mixed }: { o: OfferView; mixed: boolean }) {
  const good = offerGood(o.offer);
  const sold = isSold(o);
  const short = shortBy(o, run.value.budget);
  const alert = cardReason(o) ?? undefined;
  const service = o.offer.kind === 'service' ? o.offer.service : null;
  return (
    <Card
      class={`offer kind-${o.offer.kind} ${o.onSale ? 'on-sale' : ''} ${sold ? 'sold' : ''} ${justBought.value === o.i ? 'just-bought' : ''}`}
      tone={pieceTone(good)}
      rarity={o.rarity}
      title={o.name}
      lead={service ? <Icon name={SERVICE_ICON[service]} /> : undefined}
      aside={o.offer.kind === 'piece' ? <ShapeGlyph id={o.offer.id} /> : undefined}
      art={service ? undefined : <OfferArt offer={o.offer} />}
      chips={good ? <OfferChips good={good} kind={mixed} /> : undefined}
      lines={good ? goodLines(good) : undefined}
      note={service ? SERVICE_TEXT[service] : undefined}
      alert={alert}
      onMouseEnter={() => good && (inspected.value = { kind: 'offer', i: o.i })}
    >
      {o.rarity === 'rare' && <span class="offer-shine" aria-hidden="true" />}
      {o.onSale && !sold && (
        <span class="sale-tag">
          <Tip term="sale">Sale</Tip>
        </span>
      )}
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
              title={
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
  title: string;
  offers: readonly OfferView[];
  term?: Parameters<typeof Tip>[0]['term'];
  /** Text-only goods (the services): no art slot. */
  compact?: boolean;
}

/** A shelf of one kind of good, with what full slots keep you from buying said at its tag. */
function Section({ title, offers, term, compact = false, full }: Shelf & { full: ShelfNote[] }) {
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

/** D-076: pick a card type to strike from the draws for the rest of the run. */
function StrikePicker() {
  const i = striking.value;
  const s = run.value;
  if (i === null || s.screen !== 'shop') return null;
  const options = rules.strikeOptions(s);
  const offer = rules.shopOffers(s)[i];
  const close = () => (striking.value = null);
  const pick = (t: CardType) => {
    striking.value = null;
    // The purchase's sound comes with its 'bought' event, as for any good (director.ts).
    buy(i, t);
  };
  const name = (t: CardType) =>
    t.kind === 'piece' ? CONTENT.pieces[t.id].name : CONTENT.fixtures[t.id].name;
  const pieces = options.filter((t) => t.kind === 'piece');
  const fixtures = options.filter((t) => t.kind === 'fixture');
  const struck = s.struck.map(name);
  return (
    <div class="shop-scrim" role="dialog" aria-label="Strike a card type">
      <Panel
        class="shop-pick strike-sheet"
        title={
          <>
            Strike a card <Price price={offer?.price ?? 0} />
          </>
        }
      >
        <div class="pick-scroll">
          <p class="pick-note">
            It’s never drawn again this run. Shape variants go with it (Fence takes the L-Fence).
          </p>
          <h3 class="plank-tag">Pieces</h3>
          <div class="strike-options">
            {pieces.map((t) => (
              <Button key={t.id} size="sm" onClick={() => pick(t)}>
                {name(t)}
              </Button>
            ))}
          </div>
          {fixtures.length > 0 && (
            <>
              <h3 class="plank-tag">Fixtures</h3>
              <div class="strike-options">
                {fixtures.map((t) => (
                  <Button key={t.id} size="sm" onClick={() => pick(t)}>
                    {name(t)}
                  </Button>
                ))}
              </div>
            </>
          )}
          {struck.length > 0 && <p class="pick-note">Already struck: {struck.join(', ')}.</p>}
        </div>
        {/* Out of the scrolling part, so Cancel shows on any window. */}
        <div class="pick-foot">
          <Button onClick={close}>Cancel</Button>
        </div>
      </Panel>
    </div>
  );
}

/**
 * One of an open crate's options. It turns over on its beat (--beat, the delay of its CSS
 * animation and of a Rare's shimmer), and its sound is scheduled for the same beat when it
 * appears: once, with or without Reduce motion (which turns the animation off), and not twice
 * for a Rare (its shimmer is an animation of its own).
 */
function CrateOption({ good, i, ok }: { good: GoodRef; i: number; ok: boolean }) {
  const rarity = goodRarity(good);
  const beatMs = i * FEEL.shop.crateStaggerMs;
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
      art={<OfferArt offer={offer} />}
      chips={<OfferChips good={good} />}
      lines={goodLines(good)}
      alert={ok ? undefined : 'No room: sell something first'}
      style={{ '--beat': `${beatMs}ms` }}
    >
      {rarity === 'rare' && <span class="offer-shine" aria-hidden="true" />}
      <footer class="offer-foot">
        <Button
          size="sm"
          class="buy"
          disabled={!ok}
          title={ok ? `Keep ${goodName(good)}` : 'No room: sell something first'}
          onClick={() => (pickOption(i) ? audio.play('buy') : audio.play('illegal'))}
        >
          Keep
        </Button>
      </footer>
    </Card>
  );
}

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
  const detail =
    open.source === 'housewarming'
      ? 'Free: keep one Common blueprint, to start your rule book.'
      : 'Keep one. Sell from your goods on the right to make room.';
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
            {open.options.map((o, i) => (
              <CrateOption key={`${i}-${o.id}`} good={o as GoodRef} i={i} ok={legal.has(i)} />
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

/** The hidden shop's handle, at the foot of the board: it slides the sheet back up. */
function ShopHandle() {
  return (
    <div class="shop-handle-place">
      <Button
        variant="wood"
        class="shop-handle"
        onClick={() => (shopHidden.value = false)}
        title="The shop is still open"
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
  const shelves: Shelf[] = [
    { title: 'Blueprints', offers: of('blueprint'), term: 'blueprints' },
    { title: 'Pieces and fixtures', offers: cards, term: 'fixture' },
    { title: 'Tools', offers: of('tool'), term: 'tools' },
    { title: 'Crates', offers: of('crate'), term: 'crates' },
    { title: 'Company upgrade', offers: of('upgrade'), term: 'upgrades' },
    { title: 'Services', offers: of('service'), term: 'services', compact: true },
  ];
  const full = shelfReasons(shelves.map((shelf) => shelf.offers));
  const skip = CONTENT.balance.shop.skipReward;
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
          <Button
            icon="reroll"
            onMouseDown={noFocus}
            onClick={() =>
              refreshShop() ? audio.play('rotate', { rate: 0.8 }) : audio.play('illegal')
            }
            disabled={!refresh.ok}
            title={refresh.ok ? 'New goods (not the services)' : refresh.reason}
          >
            <Tip term="refresh">Refresh</Tip>
            <Price price={refresh.price} short={!refresh.ok && refresh.price > s.budget} />
          </Button>
          <Button
            icon="fit"
            class="shop-look"
            onMouseDown={noFocus}
            onClick={() => (shopHidden.value = true)}
            title="Hide the shop to look at the lot (it stays open)"
            aria-label="Look at the lot"
          >
            <span class="shop-look-text">Look at the lot</span>
          </Button>
        </div>
      </header>
      <Notes docked />
      <div class="panel-body shop-body">
        <div class="shelves">
          {shelves.map((shelf, k) => (
            <Section key={shelf.title} {...shelf} full={full[k]!} />
          ))}
        </div>
      </div>
      {/* Leaving is the sheet's one primary action, at its foot like End week's (D-087). */}
      <footer class="shop-foot">
        <p class="shop-foot-hint">
          <span class="hint-long">Sell from your goods on the right </span>
          <span class="hint-short">Sell on the right </span>
          <span aria-hidden="true">→</span>
        </p>
        <Button
          variant="primary"
          size="lg"
          class="leave"
          onMouseDown={noFocus}
          onClick={() => leaveShop()}
          title={visit.boughtAny ? leaveLabel : `${leaveLabel}, and +${skip} budget for saving up`}
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
      <StrikePicker />
      <CratePickSheet />
    </section>
  );
}
