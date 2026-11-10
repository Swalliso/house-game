// The change order's sheet (M4b; the pixel UI, D-110): its list of terms says what an order
// asks or changes, and leaves a request's or a restriction's reward to the Pays line, which
// shows it coin first, so the sheet never says it twice.

import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  changeOrderText,
  modifierText,
  rewardText,
  type ChangeOrderId,
  type ChangeOrderView,
} from '../../rules/index.ts';
import { ORDER_FLAVOR, orderFlavor, sheetTerms } from './ChangeOrderScreen.tsx';

/** The sheet's view of an order as the rules build it (run.ts orderView), without progress. */
function viewOf(id: ChangeOrderId): ChangeOrderView {
  const def = CONTENT.changeOrders[id];
  const view: ChangeOrderView = {
    id,
    name: def.name,
    kind: def.kind,
    text: def.text,
    terms: changeOrderText(CONTENT, def),
    phase: 1,
    declinable: def.kind !== 'phase',
  };
  return def.kind === 'phase' ? view : { ...view, reward: def.reward };
}

const ids = Object.keys(CONTENT.changeOrders) as ChangeOrderId[];

describe("a change order's sheet", () => {
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

describe("a phase effect's flavor line (playtest 4)", () => {
  it('shows on about one phase effect in four, the same line every time for the same run', () => {
    const lines = Array.from({ length: 2000 }, (_, k) => orderFlavor(`seed${k}`, 'heatWave', 5));
    const shown = lines.filter((l) => l !== null);
    expect(shown.length / lines.length).toBeGreaterThan(0.2);
    expect(shown.length / lines.length).toBeLessThan(0.3);
    for (const l of shown) expect(ORDER_FLAVOR).toContain(l);
    // Every line turns up, and a replay of the same run shows the same one.
    expect(new Set(shown).size).toBe(ORDER_FLAVOR.length);
    expect(orderFlavor('zcndxm', 'heatWave', 5)).toBe(orderFlavor('zcndxm', 'heatWave', 5));
  });
});
