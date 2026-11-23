// validateContent's checks from tonight's features that their own tests don't trip: D-205's
// lot's wish (a wish that counts no card, pays no piece or the wrong one, an unknown tool; a
// lotWish list with a non-feature or a wish left off it; and a piece paid by anything but a
// wish), D-206's tile-count condition, and D-209's Drafting Table with nothing to pick. Each
// broken content below trips exactly the problems named, since the real content trips none.

import { describe, expect, it } from 'vitest';
import type { Content, HouseCondition, Tag, TerrainId } from '../rules/index.ts';
import { CONTENT, validateContent } from './index.ts';

const pond = CONTENT.features.pond;
const pondWish = pond.wish!;

/** The content with the Pond's wish changed. */
const withWish = (wish: Partial<typeof pondWish>): Content => ({
  ...CONTENT,
  features: { ...CONTENT.features, pond: { ...pond, wish: { ...pondWish, ...wish } } },
});

describe('validateContent: the lot’s wish (D-205)', () => {
  it('the real content’s wishes pass', () => {
    expect(validateContent(CONTENT)).toEqual([]);
    expect(pondWish.reward.piece).toBeDefined();
  });

  it('a wish must count a card that exists', () => {
    expect(validateContent(withWish({ count: { tag: 'NoSuchTag' as Tag } }))).toEqual([
      'feature pond wish: no card matches what it counts',
    ]);
  });

  it('a wish pays a special piece, and nothing else will do', () => {
    expect(validateContent(withWish({ reward: { budget: 3 } }))).toEqual([
      'feature pond wish: its reward pays no piece',
    ]);
    // A member's room is neither the shop's nor ever sold.
    expect(validateContent(withWish({ reward: { piece: 'nursery' } }))).toEqual([
      "feature pond wish: nursery isn't a special piece",
      "feature pond wish: nursery is a member's room or an Addition",
    ]);
    expect(
      validateContent(withWish({ reward: { ...pondWish.reward, tool: 'noSuchTool' as never } })),
    ).toEqual(['feature pond wish: unknown reward tool "noSuchTool"']);
  });

  it('balance.lotWish lists lot features, and every feature with a wish', () => {
    const lotWish = [...CONTENT.balance.lotWish, 'street', 'noSuchFeature'] as TerrainId[];
    expect(validateContent({ ...CONTENT, balance: { ...CONTENT.balance, lotWish } })).toEqual([
      `balance lotWish: "street" isn't a lot feature`,
      `balance lotWish: "noSuchFeature" isn't a lot feature`,
    ]);
    const unlisted = CONTENT.balance.lotWish.filter((id) => id !== 'pond');
    expect(
      validateContent({ ...CONTENT, balance: { ...CONTENT.balance, lotWish: unlisted } }),
    ).toEqual(["balance lotWish: pond's wish isn't listed"]);
  });

  it('only a wish pays a piece: not a change order’s reward, nor a tool’s', () => {
    const order = Object.values(CONTENT.changeOrders).find((d) => d.kind !== 'phase')!;
    const ordered: Content = {
      ...CONTENT,
      changeOrders: {
        ...CONTENT.changeOrders,
        [order.id]: { ...order, reward: { ...order.reward, piece: 'hotTub' } },
      },
    };
    expect(validateContent(ordered)).toEqual([
      `change order ${order.id}: only a wish pays a piece (D-205)`,
    ]);
    const dumpster = CONTENT.tools.dumpster;
    expect(dumpster.use.kind).toBe('reward');
    const tooled: Content = {
      ...CONTENT,
      tools: {
        ...CONTENT.tools,
        dumpster: {
          ...dumpster,
          use: { kind: 'reward', reward: { demolitions: 2, piece: 'hotTub' } },
        },
      },
    };
    expect(validateContent(tooled)).toEqual(['tool dumpster: only a wish pays a piece (D-205)']);
  });
});

describe('validateContent: tiles in a region (D-206)', () => {
  it('a count of tiles in a region needs at least one', () => {
    const hendersons = CONTENT.clients.hendersons;
    const condition: HouseCondition = {
      tilesIn: { of: { piece: 'fence' }, region: 'leftSide', min: 0 },
    };
    const content: Content = {
      ...CONTENT,
      clients: {
        ...CONTENT.clients,
        hendersons: {
          ...hendersons,
          specs: [...hendersons.specs, { id: 'probe', name: 'Probe', group: 'wishes', condition }],
        },
      },
    };
    expect(validateContent(content)).toEqual([
      'client hendersons spec probe: tiles in a region needs a min of 1 or more',
    ]);
  });
});

describe('validateContent: the Drafting Table’s pick (D-209)', () => {
  it('needs an offered blueprint of its rarity to pick from', () => {
    const rarity = CONTENT.upgrades.draftingTable.delivers;
    expect(rarity).toMatchObject({ kind: 'blueprintPick' });
    const r = rarity?.kind === 'blueprintPick' ? rarity.rarity : 'common';
    const blueprints = Object.fromEntries(
      Object.entries(CONTENT.blueprints).map(([id, def]) => [
        id,
        def.rarity === r ? { ...def, offered: false } : def,
      ]),
    ) as Content['blueprints'];
    expect(validateContent({ ...CONTENT, blueprints })).toEqual([
      `upgrade draftingTable: no offered ${r} blueprint to pick from`,
    ]);
  });
});
