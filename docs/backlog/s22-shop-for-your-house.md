# S22 · A shop that stocks for your house

| | |
|---|---|
| Size | M, two to three days and a sim trial |
| Kind | Rules and content. The content hash changes |
| Branch | `phase/shop-for-your-house` |
| Needs first | Nothing. Build it before S27, which also changes the shelf |

## Story

The shop's shelf leans toward goods that can do something for the house you're building:
Remodel Plans for a set you hold, a fixture with a room to go in, a special piece with room
on the lot. Waterfront only turns up on a lot with water.

## Why

- The user finds the shop's goods unexciting (2026-11-20, and D-143's status line: "many shop
  goods not worth buying"). The 2026-11-20 review of rarely used goods
  (https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X, 1,000 greedy runs over every client
  and crew) ranks this first for its payoff per day of work.
- What sells is what pays in this house now. Bought from a shelf in 400 runs: Remodel Plans:
  Entertainer 63% of the times on offer, Inspector's Visit 62%, the Fireplace 60%.
- What doesn't is often blank here. Waterfront was on a shelf 868 times, more than any other
  blueprint, and bought 7%: it pays only for pieces touching a pond, creek or lake. Remodel
  Plans: Full House was bought 15%; a run holds that set at the end about a third of the time.
  The Kitchen Island fits only a Kitchen, and a special piece at its one-per-house limit can't
  be placed at all.

## Build

1. **Can it pay here?** A pure function in `src/rules/shop.ts` (or a new `src/rules/shelf.ts`)
   that says whether a good can pay in the house as it stands:
   - a blueprint: its `stockIf` holds (below); every other blueprint, yes (its D-141 value
     line already says what it's waiting for);
   - a Remodel Plan (`levelSet`): its set is held now (the week's tally), or, for a set whose
     members needn't touch, `setProgress` is one member short or closer; any other tool, yes;
   - a fixture: some placed piece matches its `fits` (the same check `installHosts` makes,
     without the supplies);
   - a special piece: its type isn't at a limit for this client (`limitsOf`,
     `typesAtLimit`);
   - a crate or an upgrade: yes.
   Keep it cheap: no placement search.
2. **The weighting.** In `stockGoods`, after `pickByRarity` rolls the rarity, a candidate that
   can pay counts `shop.relevantWeight` times (3 to start) in that rarity's pick. A good whose
   `stockIf` fails isn't a candidate at all. The stream keys stay as they are
   (`shop/<shop>/<refresh>`), so the same seed and state give the same shelf.
3. **The content.** An optional `stockIf: { lotHas: TerrainId[] }` on `BlueprintDef`
   (`src/rules/index.ts`), set on Waterfront to the pond, the creek and the lake;
   `relevantWeight` in `balance.ts`'s `shop`; checks in `validateContent`.
4. **Crates.** `crateOptions` weights its fixtures the same way, and the Showroom skips a
   special piece at its limit.
5. **The sim.** A line in the shop report: offers per visit that the bot values at 0. Then a
   paired-seed trial, 600 runs an arm on `check-*`, as D-171's first stage did: buy rates per
   good, that new line, and wins. Report it; don't change the targets here.
6. **Tests.** In the style of `src/rules/shop.test.ts`: Waterfront never on a dry lot; a
   Remodel Plan for a held set turns up more often over many seeds; the same seed and state
   stock the same shelf.

## Leave out

- Any value line on the cards. That's S23.
- Hard filters past Waterfront's. A good that can't pay yet may pay later, and the shelf
  should still surprise.
- What a crate holds, past the weighting.

## Where it lives

- `src/rules/shop.ts`: `stockGoods`, `pickByRarity`, `crateOptions`, `stockUpgrade`.
- `src/rules/run.ts`: `limitsOf`, `installHosts`, `setProgress`, the week's tally.
- `src/content/blueprints.ts` (Waterfront), `src/content/balance.ts` (`shop`),
  `src/content/index.ts` (`validateContent`), `sim/report.ts`.

## Watch for

- The content hash changes, so runs in progress drop on merge, and old run codes diverge at
  the first shop whose shelf changes.
- Shop 1's Common-only blueprints and the first job's shops (D-158) still hold.
- Stocking runs at every shop open and refresh. Keep it fast.

## Done when

- [ ] Waterfront never appears on a lot without water.
- [ ] Goods that can pay in the house turn up about three times as often as before, in the
      sim's shelf counts.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

Find one seed whose lot has no water and one with a pond or a lake, and start each with
`?seed=`. Use `?debug` to force the shop and refresh it a few times on each; then build a
Kitchen, a Dining Room and a Living Room (the Entertainer) and look for its Remodel Plans.

## Decision log

A new entry, with dated notes on:

- D-051: the shop's goods are stocked for the house.
- D-143: no dead cards on the blueprint shelf, now by the lot as well.
- D-013: the shop between milestones.
