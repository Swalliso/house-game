// D-196: a shop card's hold pin. On a good not held it's the hand's grey pushpin (D-186), a
// button that holds it for the next shop; on the held one it's red, pressed, and lets it go; with
// no pins to set (the last shop, the first job) the held good keeps its pin as a mark. None on a
// service or a sold good, and a good that can't be held says why. A line over the shelves says
// when a held good couldn't come back. HoldPin has no hooks, so it's called in place here.

import type { VNode } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, HOLD_REASONS, rules, type OfferView, type RunState } from '../../rules/index.ts';
import { holdOffer } from '../store.ts';
import { BACK_TIP, droppedText, HELD_TIP, HOLD_TIP, HoldPin } from './ShopScreen.tsx';

// The hold itself is the rules' (hold.test.ts): here, only that the pin asks for the right one.
vi.mock('../store.ts', async (original) => ({
  ...(await original<typeof import('../store.ts')>()),
  holdOffer: vi.fn(() => true),
}));
const held = vi.mocked(holdOffer);

afterEach(() => {
  held.mockClear();
});

/** A real run's first shop, opened by the ?debug panel. */
function shop(): RunState {
  const s = rules.newRun({
    seed: 'hold-pin',
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });
  return rules.apply(s, { t: 'debug', op: 'forceShop' }).state;
}

type Host = VNode<Record<string, unknown>>;
const pinOf = (o: OfferView, can = { ok: true }, toggles = true) =>
  HoldPin({ o, can, toggles }) as Host | null;

describe('a shop card’s hold pin (D-196)', () => {
  const s = shop();
  const offers = rules.shopOffers(s);
  const good = offers.find((o) => o.offer.kind !== 'service')!;

  it('holds a good not held: a grey pushpin button that turns red when pressed', () => {
    const pin = pinOf(good)!;
    expect(pin.type).toBe('button');
    expect(pin.props['aria-pressed']).toBe(false);
    expect(pin.props['data-tip']).toBe(HOLD_TIP);
    expect(pin.props['aria-label']).toBe(`Hold ${good.name} for the next shop`);
    expect(pin.props.disabled).toBe(false);
    (pin.props.onClick as () => void)();
    expect(held).toHaveBeenCalledWith(good.i);
  });

  it('lets the held good go', () => {
    const pin = pinOf({ ...good, held: true })!;
    expect(pin.props['aria-pressed']).toBe(true);
    expect(String(pin.props.class)).toContain('is-held');
    expect(pin.props['data-tip']).toBe(HELD_TIP);
    expect(pin.props['aria-label']).toBe(`Held for the next shop: let ${good.name} go`);
  });

  it('says why a good can’t be held, and does nothing when pressed', () => {
    const can = { ok: false, reason: HOLD_REASONS.atLimit };
    const pin = pinOf(good, can)!;
    expect(pin.props.disabled).toBe(true);
    expect(pin.props['data-tip']).toBe(HOLD_REASONS.atLimit);
    (pin.props.onClick as () => void)();
    expect(held).not.toHaveBeenCalled();
  });

  it('is a mark on the held good with no pins to set, and nothing on the rest', () => {
    const mark = pinOf({ ...good, held: true }, { ok: false }, false)!;
    expect(mark.type).toBe('span');
    expect(mark.props['data-tip']).toBe(BACK_TIP);
    expect(pinOf(good, { ok: false }, false)).toBeNull();
  });

  it('is never on a service or a sold good', () => {
    const service = offers.find((o) => o.offer.kind === 'service')!;
    expect(pinOf(service)).toBeNull();
    expect(
      pinOf({
        ...good,
        ok: false,
        reason: 'Sold.',
        offer: { ...good.offer, sold: true },
      } as OfferView),
    ).toBeNull();
  });
});

describe('the line about a hold that couldn’t come back (D-196)', () => {
  it('says the run owns it, or that the house has as many as it can take', () => {
    const blueprint = Object.values(CONTENT.blueprints)[0]!;
    expect(droppedText({ good: { kind: 'blueprint', id: blueprint.id }, why: 'owned' })).toBe(
      `Your hold on ${blueprint.name} is gone: you own it now.`,
    );
    expect(droppedText({ good: { kind: 'piece', id: 'hotTub' }, why: 'limit' })).toBe(
      `Your hold on the ${CONTENT.pieces.hotTub.name} is gone: your house has as many as it can take.`,
    );
  });
});
