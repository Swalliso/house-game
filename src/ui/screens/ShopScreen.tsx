// The shop between milestones (D-051; implementation-plan.md §7, M3a): a section per kind of
// good with rarity borders and labels, the sale, the rising refresh, the services (rerolls,
// demolitions, and D-076's strike), and Leave, which starts the next milestone. Selling is in
// the inventory beside it. The UI never prices anything: the rules' shopOffers() does.

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
import { formatNumber } from '../format.ts';
import { GoodBody, goodName, goodRarity, offerGood, type GoodRef } from '../hud/goods.tsx';
import { Tip } from '../hud/Tip.tsx';
import { FIXTURE_GLYPHS, TOOL_GLYPHS } from '../sprites.ts';
import { buy, inspected, leaveShop, pickOption, refreshShop, run } from '../store.ts';
import './shop.css';

/** The shop is hidden to look at the lot (it's still open). */
export const shopHidden = signal(false);
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
    setTimeout(() => justBought.value === o.i && (justBought.value = null), 600);
  }
}

function Price({ o }: { o: OfferView }) {
  return (
    <span class="price">
      {o.onSale && <s class="full-price">{o.fullPrice}</s>}
      <strong>{o.price}</strong>
      <span class="price-unit"> budget</span>
    </span>
  );
}

function OfferCard({ o }: { o: OfferView }) {
  const good = offerGood(o.offer);
  const sold = o.offer.kind !== 'service' && !!o.offer.sold;
  const rarity = o.rarity;
  const glyph =
    o.offer.kind === 'fixture'
      ? FIXTURE_GLYPHS[o.offer.id]
      : o.offer.kind === 'tool'
        ? TOOL_GLYPHS[o.offer.id]
        : null;
  return (
    <article
      class={`offer kind-${o.offer.kind} ${rarity ? `rarity-${rarity}` : ''} ${o.onSale ? 'on-sale' : ''} ${sold ? 'sold' : ''} ${justBought.value === o.i ? 'just-bought' : ''}`}
      onMouseEnter={() => good && (inspected.value = { kind: 'offer', i: o.i })}
    >
      {o.onSale && <span class="sale-ribbon">Sale</span>}
      <header>
        {glyph && (
          <span class="glyph" aria-hidden="true">
            {glyph}
          </span>
        )}
        <h3>{o.name}</h3>
      </header>
      {good ? (
        <GoodBody good={good} />
      ) : (
        o.offer.kind === 'service' && <p class="service-text">{SERVICE_TEXT[o.offer.service]}</p>
      )}
      <footer>
        {sold ? (
          <span class="sold-stamp">Sold</span>
        ) : (
          <>
            <Price o={o} />
            <button
              type="button"
              class="buy"
              onMouseDown={noFocus}
              onClick={() => buyOffer(o)}
              disabled={!o.ok}
              title={o.ok ? `Buy ${o.name}` : o.reason}
            >
              Buy
            </button>
          </>
        )}
      </footer>
      {!o.ok && !sold && <p class="offer-reason">{o.reason}</p>}
    </article>
  );
}

function Section({
  title,
  offers,
  term,
}: {
  title: string;
  offers: readonly OfferView[];
  term?: Parameters<typeof Tip>[0]['term'];
}) {
  if (offers.length === 0) return null;
  return (
    <section class="shop-section">
      <h2>{term ? <Tip term={term}>{title}</Tip> : title}</h2>
      <div class="offers">
        {offers.map((o) => (
          <OfferCard key={`${o.i}-${o.name}`} o={o} />
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
    if (buy(i, t)) audio.play('stamp');
  };
  const name = (t: CardType) =>
    t.kind === 'piece' ? CONTENT.pieces[t.id].name : CONTENT.fixtures[t.id].name;
  const pieces = options.filter((t) => t.kind === 'piece');
  const fixtures = options.filter((t) => t.kind === 'fixture');
  const struck = s.struck.map(name);
  return (
    <div class="strike-picker" role="dialog" aria-label="Strike a card type">
      <div class="strike-sheet">
        <h2>Strike a card ({offer?.price ?? '?'} budget)</h2>
        <p class="muted">
          It’s never drawn again this run. Shape variants go with it (Fence takes the L-Fence).
        </p>
        <h3>Pieces</h3>
        <div class="strike-options">
          {pieces.map((t) => (
            <button key={t.id} type="button" onClick={() => pick(t)}>
              {name(t)}
            </button>
          ))}
        </div>
        {fixtures.length > 0 && (
          <>
            <h3>Fixtures</h3>
            <div class="strike-options">
              {fixtures.map((t) => (
                <button key={t.id} type="button" onClick={() => pick(t)}>
                  {name(t)}
                </button>
              ))}
            </div>
          </>
        )}
        {struck.length > 0 && <p class="muted">Already struck: {struck.join(', ')}.</p>}
        <button type="button" class="strike-cancel" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
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
    <div class="crate-pick" role="dialog" aria-label={title}>
      <div class="crate-sheet">
        <h2>{title}</h2>
        <p class="muted">{detail}</p>
        <div class="crate-options">
          {open.options.map((o, i) => {
            const good = o as GoodRef;
            const rarity = goodRarity(good);
            const ok = legal.has(i);
            return (
              <article
                key={`${i}-${o.id}`}
                class={`offer crate-option ${rarity ? `rarity-${rarity}` : ''}`}
                style={{ animationDelay: `${i * 220}ms` }}
                onAnimationStart={() => {
                  if (rarity === 'rare') audio.play('sparkle');
                  else audio.play('plink', { rate: 1 + i * 0.2 });
                }}
              >
                <header>
                  <h3>{goodName(good)}</h3>
                </header>
                <GoodBody good={good} />
                <footer>
                  <button
                    type="button"
                    class="buy"
                    disabled={!ok}
                    title={ok ? `Keep ${goodName(good)}` : 'No room: sell something first'}
                    onClick={() => (pickOption(i) ? audio.play('stamp') : audio.play('illegal'))}
                  >
                    Keep
                  </button>
                </footer>
                {!ok && <p class="offer-reason">No room: sell something first.</p>}
              </article>
            );
          })}
        </div>
        <button type="button" class="strike-cancel" onClick={() => pickOption(-1)}>
          Set it aside
        </button>
      </div>
    </div>
  );
}

export function ShopScreen() {
  const s = run.value;
  const visit = s.offers?.shop;
  // The shop waits for the milestone's tally and banner to finish.
  if (s.screen !== 'shop' || !visit || busy.value) return null;
  if (shopHidden.value) {
    return (
      <button type="button" class="shop-reopen" onClick={() => (shopHidden.value = false)}>
        Back to the shop
      </button>
    );
  }
  const offers = rules.shopOffers(s);
  const refresh = rules.canRefresh(s);
  // A shop the ?debug panel opened mid-week goes back to that week.
  const next = visit.forced ? `week ${s.slot}` : rules.phaseName(s.phase);
  const leaveLabel = visit.forced ? `Back to week ${s.slot}` : `Start ${next}`;
  const of = (kind: OfferView['offer']['kind']) => offers.filter((o) => o.offer.kind === kind);
  const cards = offers.filter((o) => o.offer.kind === 'piece' || o.offer.kind === 'fixture');
  const skip = CONTENT.balance.shop.skipReward;
  return (
    <div class="shop" role="region" aria-label={`Shop ${visit.number}`}>
      <header class="shop-head">
        <div>
          <h1>The supply yard</h1>
          <p class="muted">
            Shop {visit.number} of {CONTENT.balance.phases.length - 1}
            {visit.forced ? ' (debug)' : ''} · next up: {next}
          </p>
        </div>
        <div class="shop-budget" aria-label={`Budget ${s.budget}`}>
          <Tip term="budget">Budget</Tip> <strong>{formatNumber(s.budget)}</strong>
        </div>
        <div class="shop-buttons">
          <button
            type="button"
            onMouseDown={noFocus}
            onClick={() =>
              refreshShop() ? audio.play('rotate', { rate: 0.8 }) : audio.play('illegal')
            }
            disabled={!refresh.ok}
            title={refresh.ok ? 'New goods (not the services)' : refresh.reason}
          >
            <Tip term="refresh">Refresh</Tip> · {refresh.price}
          </button>
          <button type="button" onMouseDown={noFocus} onClick={() => (shopHidden.value = true)}>
            Look at the lot
          </button>
          <button
            type="button"
            class="leave"
            onMouseDown={noFocus}
            onClick={() => leaveShop()}
            title={
              visit.boughtAny ? leaveLabel : `${leaveLabel}, and +${skip} budget for saving up`
            }
          >
            {leaveLabel}
            {!visit.boughtAny && skip > 0 && (
              <span class="skip-hint">
                {' '}
                · <Tip term="skipReward">+{skip} for saving</Tip>
              </span>
            )}
          </button>
        </div>
      </header>
      <div class="shop-body">
        <Section title="Blueprints" offers={of('blueprint')} term="blueprints" />
        <Section title="Pieces and fixtures" offers={cards} term="fixture" />
        <Section title="Tools" offers={of('tool')} term="tools" />
        <Section title="Crates" offers={of('crate')} term="crates" />
        <Section title="Company upgrade" offers={of('upgrade')} term="upgrades" />
        <Section title="Services" offers={of('service')} term="services" />
      </div>
      <StrikePicker />
      <CratePickSheet />
    </div>
  );
}
