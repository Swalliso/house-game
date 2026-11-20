# S26 · Upgrades that deliver

| | |
|---|---|
| Size | M, two to three days and a sim trial |
| Kind | Rules and content. The content hash changes |
| Branch | `phase/upgrades-deliver` |
| Needs first | The user's playtest of S16 (D-188). It replaces S15 |

## Story

The three slot upgrades bring something you can see. The Storage Unit adds a slot, and a
special piece arrives in Your goods at each milestone's start. The Tool Belt adds a slot, and
a free Common tool arrives at each milestone's start. The Drafting Table adds a slot, and
opens a pick of three Common blueprints the moment you buy it.

## Why

- Bought from a shelf in 400 greedy runs (the 2026-11-20 review,
  https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X): the Storage Unit 0 of 274, the Tool
  Belt 0 of 305, the Drafting Table 7%. A slot only matters when it's full, and since D-163
  free builds empty Your goods and the supplies the week they fill.
- The user keeps both (2026-11-20, answering S15): "okay to have and could be useful", but
  not exciting. This makes them worth their 6.
- The delivery pipeline exists (D-160, D-171, D-188), and D-171's `crewTool` already puts a
  tool into the supplies, or sells it when they're full.

## Build

1. **The content.** A `delivers` field on `UpgradeDef` (`src/rules/index.ts`), set in
   `src/content/upgrades.ts`: the Storage Unit a special piece each milestone, the Tool Belt
   a Common tool each milestone, the Drafting Table a pick of three Common blueprints when
   bought. `validateContent` checks it.
2. **Each milestone.** In `arrive()` (`src/rules/run.ts`), beside `surprise` and `crewTool`,
   in each milestone's first week and never an overtime week:
   - the Storage Unit adds the next special piece in a run order (`upgrade/storage`), skipping
     types at a limit as `surprise` does, with `addExtra` and a new `from` (`'storage'`);
   - the Tool Belt adds the next offered Common tool in its own order (`upgrade/toolBelt`) to
     the supplies, or sells it at once when they're full, as `crewTool` does.
   An upgrade delivers from the first milestone after the shop that sold it.
3. **On purchase.** The Drafting Table opens a pick as shop 1's Housewarming crate does
   (`crateOptions(…, 'housewarming', …)` in `run.ts`), on its own key
   (`crate/<shop>/<refresh>/drafting`) and source.
4. **Words.** Each card says what arrives ("+1 slot. A special piece arrives each
   milestone."). Your goods tags the new mark (`extraSlotWords()` in
   `src/ui/hud/household.ts`), Inspect says where it came from, and the director's
   `deliveredBeat` plays its pop, as S16 did.
5. **The sim.** The shop bot (`sim/policies/shop.ts`) values what arrives: a special piece's
   best placement times the milestones left, discounted, and an average Common tool's use. A
   reserve-plays bucket for the new mark (`sim/simulate.ts`, `sim/report.ts`) and its key in
   `sim/chaos.test.ts`. Then a paired-seed trial: buy rates and wins. Report it; don't change
   the targets here.
6. **Tests,** in the style of `src/rules/stock.test.ts` and `src/rules/surprise.test.ts`, with
   a replay that proves the same seed delivers the same goods.

## Leave out

- The prices (6, 6 and 7).
- A second pin for the Storage Unit (S14's pin is one card; a second is its own idea).
- The Bigger Truck, the Foreman, the Supplier Discount and the Savings Account.

## Where it lives

- `src/content/upgrades.ts`; `src/rules/index.ts` (`UpgradeDef`, `ReservePiece`, the
  `delivered` event).
- `src/rules/run.ts`: `arrive`, `addExtra`, `surprise`, `crewTool`, an upgrade's purchase, the
  Housewarming pick. `src/rules/shop.ts`: `inExtraSlot`.
- `src/ui/hud/household.ts`, `sim/policies/shop.ts`.

## Watch for

- It's a fourth source of free cards (the stock, the crew's, S16's, now these). The user
  judges one at a time, which is why this waits for S16's playtest.
- The Storage Unit and S16's surprise can both bring a Pool. Skipping types at a limit doesn't
  stop that; say in the log whether two Pools is fine.
- Old run codes diverge from the first upgrade bought.

## Done when

- [ ] Each of the three delivers as its card says, from the first milestone after it's bought.
- [ ] The Tool Belt's tool is sold at once when the supplies are full, and the event says so.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

`?debug`: give each upgrade (the panel gives any shop good), then add score to reach the next
milestone, and look in Your goods and the supplies.

## Decision log

A new entry, with dated notes on:

- D-051: what the company upgrades do.
- D-160 and D-188: another delivery to the extra slots.
- D-171: a tool that arrives.
- S15: replaced by this story (the user keeps both upgrades, 2026-11-20).
