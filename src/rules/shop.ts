// The shop between milestones (D-051; implementation-plan.md §5 Shop goods, Appendix A · M3a).
// It opens after milestones 1–6, from the very first run.
//
// - Stock: each visit's slot counts and rarity weights come from balance.ts, by shop. Offers
//   come from the `shop/<shop>/<refresh>` stream and never include a blueprint the run owns.
//   Blueprint and fixture slots roll rarity with the shop's weights; a rarity with nothing
//   left falls back to the likeliest one that has something.
// - Where things go: blueprints into their slots; pieces into the reserve (placing one is the
//   week's turn); fixtures into supplies (free to install).
// - Prices: the item's price × the `shopPricePct` rule, rounded half up, then the sale (one
//   random good per visit, never a service). Services rise by a step per purchase for the rest
//   of the run, up to a cap; the refresh rises within a visit and resets at the next. Neither
//   is discounted.
// - Selling pays half the item's price at the current discount, rounded down, whatever was
//   paid, so buying on sale and selling back is never a profit.
// - The strike service (D-076) names a card type, which never comes up in the draws again.
//   At least `strikeMinTypes` drawable types always remain.

import type {
  Availability,
  BlueprintId,
  CardType,
  Content,
  FixtureId,
  OfferView,
  PieceId,
  Rarity,
  RunState,
  ServiceId,
  ShopOffer,
  ShopStock,
  ShopVisit,
  Slots,
  Supply,
} from './index.ts';
import { drawableTypes, isStruck } from './draw.ts';
import { ruleValue } from './modifiers.ts';
import { stream, type Rng } from './rng.ts';
import { roundHalfUp } from './scoring.ts';

export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare'];
export const SERVICES: readonly ServiceId[] = ['reroll', 'demolition', 'strike'];

export const SHOP_REASONS = {
  sold: 'Sold.',
  budget: 'Not enough budget.',
  owned: 'You already own it.',
  blueprintsFull: 'Your blueprint slots are full. Sell one first.',
  reserveFull: 'Your reserve is full. Place a piece from it first.',
  suppliesFull: 'Your supplies are full. Use or sell one first.',
  noStrike: 'There’s nothing left to strike.',
  notOpen: 'The shop isn’t open.',
} as const;

export function slotsFor(content: Content, state: RunState): Slots {
  return {
    reserve: ruleValue(content, state, 'reserveSlots'),
    supplies: ruleValue(content, state, 'supplySlots'),
    blueprints: ruleValue(content, state, 'blueprintSlots'),
  };
}

/** Reserve pieces that count against its slots (a crew's starting pieces don't). */
export function reserveUsed(state: RunState): number {
  return state.reserve.filter((r) => !r.crew).length;
}

export function stockFor(content: Content, shop: number): ShopStock {
  const rows = content.balance.shop.stock;
  return rows[Math.min(Math.max(shop, 1), rows.length) - 1]!;
}

export function offerRarity(content: Content, offer: ShopOffer): Rarity | undefined {
  if (offer.kind === 'blueprint') return content.blueprints[offer.id].rarity;
  if (offer.kind === 'fixture') return content.fixtures[offer.id].rarity;
  return undefined;
}

export function offerName(content: Content, offer: ShopOffer): string {
  switch (offer.kind) {
    case 'blueprint':
      return content.blueprints[offer.id].name;
    case 'piece':
      return content.pieces[offer.id].name;
    case 'fixture':
      return content.fixtures[offer.id].name;
    case 'service':
      return SERVICE_NAMES[offer.service];
  }
}

export const SERVICE_NAMES: Readonly<Record<ServiceId, string>> = {
  reroll: '+1 reroll',
  demolition: '+1 demolition',
  strike: 'Strike a card',
};

/** The item's own price, before the discount and the sale. */
export function listPrice(
  content: Content,
  offer: Exclude<ShopOffer, { kind: 'service' }>,
): number {
  switch (offer.kind) {
    case 'blueprint':
      return content.blueprints[offer.id].price;
    case 'piece':
      return content.balance.shop.piecePrice;
    case 'fixture':
      return content.fixtures[offer.id].price;
  }
}

export function supplyPrice(content: Content, supply: Supply): number {
  return content.fixtures[supply.id].price;
}

/** A price after the `shopPricePct` rule (Supplier Discount), never below 1. */
function discounted(content: Content, state: RunState, price: number): number {
  return Math.max(1, roundHalfUp(price * ruleValue(content, state, 'shopPricePct'), 100));
}

export function servicePrice(content: Content, state: RunState, service: ServiceId): number {
  const p = content.balance.shop.services[service];
  return Math.min(p.max, p.base + p.step * state.servicesBought[service]);
}

export function refreshPrice(content: Content, state: RunState): number {
  const r = content.balance.shop.refresh;
  return r.base + r.step * (state.offers?.shop?.refreshes ?? 0);
}

/** What an offer costs now, and before the sale. */
export function offerPrice(
  content: Content,
  state: RunState,
  visit: ShopVisit,
  i: number,
): { price: number; fullPrice: number; onSale: boolean } {
  const offer = visit.offers[i]!;
  if (offer.kind === 'service') {
    const price = servicePrice(content, state, offer.service);
    return { price, fullPrice: price, onSale: false };
  }
  const fullPrice = discounted(content, state, listPrice(content, offer));
  const onSale = visit.sale === i && !offer.sold;
  const price = onSale
    ? Math.max(1, roundHalfUp(fullPrice * content.balance.shop.salePct, 100))
    : fullPrice;
  return { price, fullPrice, onSale };
}

/** Selling pays half the item's price at the current discount, rounded down (Appendix A). */
export function sellPrice(content: Content, state: RunState, list: number): number {
  return Math.floor((discounted(content, state, list) * content.balance.shop.sellPct) / 100);
}

/** Card types the strike service could name now. */
export function strikeOptions(content: Content, state: RunState): CardType[] {
  const left = drawableTypes(content, state.struck);
  return left.length - 1 >= content.balance.shop.strikeMinTypes ? left : [];
}

export function canStrike(content: Content, state: RunState, type: CardType): Availability {
  if (!type || (type.kind !== 'piece' && type.kind !== 'fixture')) {
    return { ok: false, reason: 'Pick a card type to strike.' };
  }
  const options = strikeOptions(content, state);
  if (options.length === 0) return { ok: false, reason: SHOP_REASONS.noStrike };
  const known =
    type.kind === 'piece'
      ? Object.hasOwn(content.pieces, type.id)
      : Object.hasOwn(content.fixtures, type.id);
  if (!known) return { ok: false, reason: 'That card isn’t in the draws.' };
  if (isStruck(content, state.struck, type)) {
    return { ok: false, reason: 'That card is already struck.' };
  }
  if (!options.some((o) => o.kind === type.kind && o.id === type.id)) {
    return { ok: false, reason: 'That card isn’t in the draws.' };
  }
  return { ok: true };
}

/** Whether there's a free slot for the good, regardless of price. */
export function roomFor(content: Content, state: RunState, offer: ShopOffer): Availability {
  const slots = slotsFor(content, state);
  switch (offer.kind) {
    case 'blueprint':
      if (state.blueprints.some((b) => b.id === offer.id)) {
        return { ok: false, reason: SHOP_REASONS.owned };
      }
      if (state.blueprints.length >= slots.blueprints) {
        return { ok: false, reason: SHOP_REASONS.blueprintsFull };
      }
      return { ok: true };
    case 'piece':
      return reserveUsed(state) >= slots.reserve
        ? { ok: false, reason: SHOP_REASONS.reserveFull }
        : { ok: true };
    case 'fixture':
      return state.supplies.length >= slots.supplies
        ? { ok: false, reason: SHOP_REASONS.suppliesFull }
        : { ok: true };
    case 'service':
      if (offer.service === 'strike' && strikeOptions(content, state).length === 0) {
        return { ok: false, reason: SHOP_REASONS.noStrike };
      }
      return { ok: true };
  }
}

export function viewOffers(content: Content, state: RunState): OfferView[] {
  const visit = state.offers?.shop;
  if (state.screen !== 'shop' || !visit) return [];
  return visit.offers.map((offer, i) => {
    const { price, fullPrice, onSale } = offerPrice(content, state, visit, i);
    const base = {
      i,
      offer,
      name: offerName(content, offer),
      rarity: offerRarity(content, offer),
      price,
      fullPrice,
      onSale,
    };
    if (offer.kind !== 'service' && offer.sold) {
      return { ...base, ok: false, reason: SHOP_REASONS.sold };
    }
    const room = roomFor(content, state, offer);
    if (!room.ok) return { ...base, ...room };
    if (price > state.budget) return { ...base, ok: false, reason: SHOP_REASONS.budget };
    return { ...base, ok: true };
  });
}

// ---------------------------------------------------------------------------------------
// Stock.

function rollRarity(rng: Rng, weights: readonly [number, number, number]): Rarity {
  const total = weights[0] + weights[1] + weights[2];
  if (total <= 0) return 'common';
  let r = rng.int(total);
  for (let k = 0; k < 3; k++) {
    if (r < weights[k]!) return RARITIES[k]!;
    r -= weights[k]!;
  }
  return 'rare';
}

/** One item of the rolled rarity, or of the likeliest rarity that still has one. */
function pickByRarity<T extends string>(
  rng: Rng,
  weights: readonly [number, number, number],
  candidates: readonly T[],
  rarityOf: (id: T) => Rarity,
): T | null {
  if (candidates.length === 0) return null;
  const rolled = rollRarity(rng, weights);
  const order = [
    rolled,
    ...[...RARITIES]
      .filter((r) => r !== rolled)
      .sort((a, b) => weights[RARITIES.indexOf(b)]! - weights[RARITIES.indexOf(a)]!),
  ];
  for (const r of order) {
    const of = candidates.filter((id) => rarityOf(id) === r);
    if (of.length > 0) return rng.pick(of);
  }
  return null;
}

/** The goods a visit offers (everything but the services, which `openShop` adds). */
export function stockGoods(
  content: Content,
  state: RunState,
  shop: number,
  refresh: number,
): ShopOffer[] {
  const rng = stream(state.setup.seed, `shop/${shop}/${refresh}`);
  const stock = stockFor(content, shop);
  const b = content.balance.shop;
  const out: ShopOffer[] = [];

  const owned = new Set<BlueprintId>(state.blueprints.map((o) => o.id));
  let blueprints = (Object.keys(content.blueprints) as BlueprintId[]).filter(
    (id) => content.blueprints[id].offered && !owned.has(id),
  );
  for (let k = 0; k < stock.blueprints; k++) {
    const id = pickByRarity(rng, stock.rarity, blueprints, (x) => content.blueprints[x].rarity);
    if (!id) break;
    out.push({ kind: 'blueprint', id });
    blueprints = blueprints.filter((x) => x !== id);
  }

  let pieces = (Object.keys(content.pieces) as PieceId[]).filter(
    (id) => content.pieces[id].drawWeight === 0,
  );
  let fixtures = Object.keys(content.fixtures) as FixtureId[];
  for (let k = 0; k < stock.cards; k++) {
    const wantFixture = rng.chance(b.cardFixturePct);
    const fixture = wantFixture
      ? pickByRarity(rng, stock.rarity, fixtures, (x) => content.fixtures[x].rarity)
      : null;
    if (fixture) {
      out.push({ kind: 'fixture', id: fixture });
      fixtures = fixtures.filter((x) => x !== fixture);
      continue;
    }
    if (pieces.length === 0) continue;
    const id = rng.pick(pieces);
    out.push({ kind: 'piece', id });
    pieces = pieces.filter((x) => x !== id);
  }
  return out;
}

function withServices(goods: readonly ShopOffer[]): ShopOffer[] {
  return [...goods, ...SERVICES.map((service): ShopOffer => ({ kind: 'service', service }))];
}

/** The sale: one random good, from the visit's own stream. */
function pickSale(state: RunState, shop: number, refresh: number, goods: number): number | null {
  if (goods === 0) return null;
  return stream(state.setup.seed, `shop/${shop}/${refresh}/sale`).int(goods);
}

export function openVisit(
  content: Content,
  state: RunState,
  shop: number,
  forced = false,
): ShopVisit {
  const goods = stockGoods(content, state, shop, 0);
  return {
    number: shop,
    offers: withServices(goods),
    sale: pickSale(state, shop, 0, goods.length),
    refreshes: 0,
    boughtAny: false,
    ...(forced ? { forced: true as const } : {}),
  };
}

/** A refresh rerolls every good (not the services); the sale moves with it. */
export function refreshVisit(content: Content, state: RunState, visit: ShopVisit): ShopVisit {
  const refreshes = visit.refreshes + 1;
  const goods = stockGoods(content, state, visit.number, refreshes);
  return {
    ...visit,
    offers: withServices(goods),
    sale: pickSale(state, visit.number, refreshes, goods.length),
    refreshes,
    boughtAny: true,
  };
}
