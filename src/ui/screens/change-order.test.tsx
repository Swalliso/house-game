// The change orders' sheet (M4b; the pixel UI, D-110; D-144): two orders side by side, each
// with its own pick button and key. A card's list of terms says what an order asks or changes,
// and leaves a request's or a restriction's reward to its Pays line, which shows it coin first,
// so the card never says it twice; a phase effect's card says what it would do to the house as
// it stands, from the rules' number. OrderCard has no hooks, so it's called in place here.

import type { ComponentChildren, VNode } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT,
  changeOrderText,
  modifierText,
  rewardText,
  rules,
  type ChangeOrderId,
  type ChangeOrderView,
  type RunState,
} from '../../rules/index.ts';
import { busy, orderStamp, type OrderStamp } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { pickKeys } from '../hud/actions.ts';
import { answerChangeOrder, appScreen, run } from '../store.ts';
import { changeOrderKey, OrderCard, sheetTerms, todayText } from './ChangeOrderScreen.tsx';

// The pick itself is the rules' and the director's (change-orders.test.ts): here, only that
// the sheet asks for the right one.
vi.mock('../store.ts', async (original) => ({
  ...(await original<typeof import('../store.ts')>()),
  answerChangeOrder: vi.fn(() => true),
}));
const picked = vi.mocked(answerChangeOrder);

/** A card's view of an order as the rules build it (run.ts orderView), without progress. */
function viewOf(id: ChangeOrderId): ChangeOrderView {
  const def = CONTENT.changeOrders[id];
  const view: ChangeOrderView = {
    id,
    name: def.name,
    kind: def.kind,
    text: def.text,
    terms: changeOrderText(CONTENT, def),
    phase: 1,
  };
  return def.kind === 'phase' ? view : { ...view, reward: def.reward };
}

const ids = Object.keys(CONTENT.changeOrders) as ChangeOrderId[];

/** The host elements a tree renders, function components called in place (none use hooks). */
function* walk(node: ComponentChildren): Generator<VNode<Record<string, unknown>>> {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
    return;
  }
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function') {
    yield* walk((v.type as (p: unknown) => ComponentChildren)(v.props));
    return;
  }
  yield v;
  yield* walk(v.props.children as ComponentChildren);
}

/** A tree's words, as read. */
function textOf(node: ComponentChildren): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function') {
    return textOf((v.type as (p: unknown) => ComponentChildren)(v.props));
  }
  return textOf(v.props.children as ComponentChildren);
}

const hasClass = (v: VNode<Record<string, unknown>>, name: string) =>
  String(v.props.class ?? '')
    .split(/\s+/)
    .includes(name);

const start = run.value;

/** A run with two orders waiting: a phase effect on the left, a request on the right. */
function offering(offerIds: readonly ChangeOrderId[]): RunState {
  const s = rules.newRun({
    seed: 'sheet',
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });
  return {
    ...s,
    phase: 2,
    screen: 'changeOrder',
    offers: { changeOrder: { ids: offerIds, phase: 2 } },
  };
}

function card(state: RunState, i: number, stamp: OrderStamp | null = null) {
  const offer = rules.changeOrderOffer(state)!;
  const keys = pickKeys(offer.options.length);
  const tree = OrderCard({
    view: offer.options[i]!,
    i,
    keycap: keys[i]!,
    alone: offer.options.length === 1,
    stamp,
  });
  const hosts = [...walk(tree)];
  const button = hosts.find((v) => v.type === 'button')!;
  return { tree, hosts, button, section: hosts[0]! };
}

afterEach(() => {
  run.value = start;
  appScreen.value = 'title';
  busy.value = false;
  orderStamp.value = null;
  picked.mockClear();
  vi.restoreAllMocks();
});

describe("a change order's card", () => {
  it('lists what a request or a restriction asks, and leaves what it pays to Pays', () => {
    const asks = ids.filter((id) => CONTENT.changeOrders[id].kind !== 'phase');
    expect(asks.length).toBeGreaterThan(0);
    for (const id of asks) {
      const view = viewOf(id);
      const reward = rewardText(CONTENT, view.reward!);
      expect([`Met: ${reward}`, `Kept: ${reward}`], id).toContain(view.terms.at(-1));
      expect(sheetTerms(view), id).toEqual(view.terms.slice(0, -1));
      expect(sheetTerms(view).join(' '), id).not.toContain(reward);
    }
  });

  it("lists a phase effect's modifiers", () => {
    const phases = ids.filter((id) => CONTENT.changeOrders[id].kind === 'phase');
    expect(phases.length).toBeGreaterThan(0);
    for (const id of phases) {
      const def = CONTENT.changeOrders[id];
      if (def.kind !== 'phase') throw new Error('expected a phase effect');
      expect(sheetTerms(viewOf(id)), id).toEqual(
        def.modifiers.map((m) => modifierText(CONTENT, m)),
      );
    }
  });
});

describe('two orders, one pick (D-144)', () => {
  const pair = offering(['heatWave', 'workingFromHome']);

  it('gives each order its own card, with its name, its pick button and its key', () => {
    for (const [i, name] of ['Heat wave', 'Working from home'].entries()) {
      const { tree, button, section } = card(pair, i);
      expect(textOf(tree)).toContain(name);
      expect(section.props['aria-labelledby']).toBe(`co-name-${i}`);
      expect(textOf(button)).toBe(`Pick${i + 1}`);
      expect(button.props['data-tip']).toBe(`Pick ${name} (${i + 1})`);
      expect(button.props.disabled).toBe(false);
    }
  });

  it('picks the order whose button is pressed', () => {
    appScreen.value = 'game';
    run.value = pair;
    (card(pair, 1).button.props.onClick as () => void)();
    expect(picked.mock.calls).toEqual([[1]]);
    (card(pair, 0).button.props.onClick as () => void)();
    expect(picked.mock.calls).toEqual([[1], [0]]);
  });

  it('says what a phase effect would do to the house today, and what a request pays', () => {
    const phase = card(pair, 0);
    const gain = rules.changeOrderOffer(pair)!.options[0]!.houseGain!;
    expect(gain).toBe(0);
    expect(textOf(phase.tree)).toContain(todayText(gain));
    expect(textOf(phase.tree)).not.toContain('Pays');
    const request = card(pair, 1);
    expect(textOf(request.tree)).toContain('Pays+3');
    expect(textOf(request.tree)).toContain('So far:');
    expect(textOf(request.tree)).not.toContain('on your house today');
  });

  it('words a gain, a loss, and no change, in the rules’ number', () => {
    expect(todayText(38)).toBe('+38 Wow a week on your house today');
    expect(todayText(-1250)).toBe('−1,250 Wow a week on your house today');
    expect(todayText(0)).toBe('No Wow either way on your house today');
    // The strip shows the same words around its icon: up for a gain, down for a loss.
    const gain = { ...viewOf('heatWave'), houseGain: 38 };
    const strip = (view: ChangeOrderView) => {
      const hosts = [...walk(OrderCard({ view, i: 0, keycap: '1', alone: false, stamp: null }))];
      const at = hosts.find((v) => hasClass(v, 'co-today'))!;
      return { cls: String(at.props.class), text: textOf(at) };
    };
    expect(strip(gain)).toEqual({ cls: 'co-today good', text: todayText(38) });
    expect(strip({ ...gain, houseGain: -12 })).toEqual({
      cls: 'co-today bad',
      text: todayText(-12),
    });
    expect(strip({ ...gain, houseGain: 0 })).toEqual({ cls: 'co-today none', text: todayText(0) });
  });

  it('takes 1 and 2 once the sheet has landed, and nothing else', () => {
    appScreen.value = 'game';
    run.value = pair;
    const now = vi.spyOn(performance, 'now');
    // Before the sheet's flourish is over, a key held from the week before does nothing.
    now.mockReturnValue(FEEL.changeOrder.keyDelayMs - 1);
    expect(changeOrderKey('1')).toBe(false);
    now.mockReturnValue(FEEL.changeOrder.keyDelayMs + 1);
    for (const key of ['Enter', 'Escape', 'd', '3', '0'])
      expect(changeOrderKey(key), key).toBe(false);
    expect(picked).not.toHaveBeenCalled();
    expect(changeOrderKey('2')).toBe(true);
    expect(changeOrderKey('1')).toBe(true);
    expect(picked.mock.calls).toEqual([[1], [0]]);
    // Not while a tally plays over the board, or the stamp is landing.
    busy.value = true;
    expect(changeOrderKey('1')).toBe(false);
  });

  it('an order offered alone takes Enter, and its button says Accept', () => {
    const alone = offering(['hoaLetter']);
    appScreen.value = 'game';
    run.value = alone;
    const { button } = card(alone, 0);
    expect(textOf(button)).toBe('AcceptEnter');
    vi.spyOn(performance, 'now').mockReturnValue(FEEL.changeOrder.keyDelayMs + 1);
    expect(changeOrderKey('1')).toBe(false);
    expect(changeOrderKey('Enter')).toBe(true);
    expect(picked.mock.calls).toEqual([[0]]);
  });

  it('stamps the order picked, and steps the other back', () => {
    const stamp: OrderStamp = {
      id: 1,
      offer: rules.changeOrderOffer(pair)!,
      clientId: 'hendersons',
      picked: 1,
    };
    const passed = card(pair, 0, stamp);
    const taken = card(pair, 1, stamp);
    expect(hasClass(passed.section, 'passed')).toBe(true);
    expect(hasClass(taken.section, 'picked')).toBe(true);
    expect(passed.hosts.some((v) => hasClass(v, 'co-stamp'))).toBe(false);
    expect(textOf(taken.hosts.find((v) => hasClass(v, 'co-stamp'))!)).toBe('Accepted');
    // The pick is made: neither button takes another.
    expect(passed.button.props.disabled).toBe(true);
    expect(taken.button.props.disabled).toBe(true);
  });
});
