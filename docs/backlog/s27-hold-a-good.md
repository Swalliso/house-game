# S27 · Hold a good for the next visit

| | |
|---|---|
| Size | M, two to three days |
| Kind | Rules and UI. No content change, so the hash holds; run codes gain an action |
| Branch | `phase/hold-a-good` |
| Needs first | Nothing (S14 is Accepted, D-186). Build after S22, which also changes the shelf |

## Story

Put a hold on one good you can't buy yet. At the next shop it's back on the shelf, in place of
one fresh good of its kind, at that visit's price.

## Why

- Super Auto Pets and Backpack Battles let you freeze or lock an offer (`research.md`,
  Other games' shops). A Rare you can't afford becomes a plan for the next milestone, and a
  reason to save.
- The user prefers a guarantee to luck (S14's and S16's Why). S14's pinned card, Accepted on
  2026-11-20, is the hand's version, so the gesture is already known.
- The 2026-11-20 review of rarely used goods
  (https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X) lists it sixth of its shop ideas.

## Build

1. **The rule.** A `hold` action in the shop (`src/rules/run.ts`): one hold at a time, on any
   good but a service. The held offer is kept on the run state; `openVisit`
   (`src/rules/shop.ts`) puts it into the next visit's goods in place of the first good of its
   kind (a held upgrade replaces that visit's upgrade). Buying it clears the hold, and holding
   another moves it. A hold costs nothing. A refresh rerolls the goods but keeps the hold.
2. **What can't come back.** A good the run can't own by the next visit (a blueprint it now
   holds, a special piece at its limit) is dropped, and an event says so.
3. **Run codes.** The action joins the run code's actions; follow S14's pin (D-186) for the
   format and the replay tests.
4. **On screen.** A hold toggle on each shop card, in S14's pushpin look, and the pin on the
   card at the next visit. No hold toggle in the last shop of a run. Under Reduce motion the
   pin appears without its drop.
5. **The sim.** The shop bot holds the good it valued most but couldn't afford, or never holds
   (add it to `BOT_BLIND`); say which. Report how often a held good is bought.
6. **Tests:** hold, refresh, the next visit has it at that visit's price, buying clears it,
   holding another moves it, a blueprint owned by then drops, a replay.

## Leave out

- Holds that cost budget, more than one hold, and holding services.

## Where it lives

- `src/rules/shop.ts`: `openVisit`, `refreshVisit`, `stockGoods`.
- `src/rules/run.ts` (the shop's actions), `src/rules/runcode.ts`.
- `src/ui/screens/ShopScreen.tsx`, and S14's pin (search `pin` in `src/rules` and `src/ui`).

## Watch for

- The sale may land on the held good. That's fine.
- S22 and S23 change the shop too; merge one at a time.

## Done when

- [ ] A held good is on the next shelf at that visit's price.
- [ ] Holding, buying and dropping each show on screen and replay from a run code.

## How to check

`?debug`: force the shop, hold a Rare, then add score to reach the next milestone.

## Decision log

A new entry, with dated notes on:

- D-013: the shop between milestones.
- D-051: the shop's goods.
- D-186: the pin's look and run-code action, reused.
