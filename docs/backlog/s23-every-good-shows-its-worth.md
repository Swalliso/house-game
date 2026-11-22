# S23 · Every good says what it's worth

| | |
|---|---|
| Size | M to L, three to five days |
| Kind | Rules views and UI. No content change, so the hash and saves hold |
| Branch | `phase/every-good-shows-its-worth` |
| Needs first | Nothing. It touches the shop screen, as S22 and S27 do: merge one before the next |

## Story

Every card on the shelf says what it would do for your house, as fixtures (D-107) and
blueprints (D-141) already do. A piece says what it would earn where it fits best, a tool what
it would add the week you use it, and a Remodel Plan what its set's next level adds.

## Why

- Only fixtures and blueprints carry a value line today. Pieces, tools and upgrades show only
  their rules text, so buying one is a guess. The 2026-11-20 review of rarely used goods
  (https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X) ranks this second, after S22.
- A guess hides good goods. Once placed, a Pool earns 1,790 Wow a copy, about what a Lawn
  does, but it was bought 4% of the times it was on a shelf: "+12 every third week" on a 2×3
  piece is hard to read.
- The user says yes to a guarantee more often than to luck (S16's Why). A number on the card
  turns a guess into a choice, and a big one is exciting by itself.

## Build

1. **Rules views** in the `Rules` interface (`src/rules/run.ts`), beside `fixtureValue` and
   `blueprintValue`, cached per state with a `WeakMap` as `blueprintValue` is:
   - `pieceValue(state, id)`: the best legal spot's gain in the week the piece would go down
     (in the shop, the next phase's first week after its transforms, as `installWeek` does),
     the run figure by D-141's projection (each week left added up, nothing more built), and
     the spot (`x`, `y`, `rot`) so Inspect can point at it. Search as the shop bot's
     `bestPlacement` does (`sim/policies/shop.ts`): `legalPlacements`, the best few by the
     rules' estimate, each scored exactly with `scoreOnly`. A rhythm piece's run figure counts
     its paying weeks. Null if there's no legal spot.
   - `toolValue(state, id)`: for `weekModifiers` (Rush Order, Open House Party, Inspector's
     Visit), the week's tally with it less without; for `levelSet` (Remodel Plans), the next
     level's gain this week and over the run, or what it's waiting for ("Needs the
     Entertainer"); for the rest (Weekend Crew, Copy Machine, Fertilizer, the Catalog, the
     Dumpster, the Moving Truck), no number, and one short line of what it would do here when
     the rules can say it (Fertilizer: "Your Sapling becomes a Tree next week").
   - Upgrades get no number. Their card says what they change (and, after S26, what arrives).
2. **On screen.** `PieceWorth` and `ToolWorth` in `src/ui/hud/goods.tsx`, in the style of
   `FixtureWorth` and `BlueprintWorth`: on shop cards, on an open crate's piece options (the
   Garden Center, the Showroom), and in Inspect. Values computed once per state in
   `ShopScreen.tsx`, as `fixtureValues` is.
3. **Tests.** Rules tests in the style of `fixture-value.test.ts` and
   `blueprint-value.test.ts`: a Remodel Plan for a held set; one for a set not held says what
   it needs; a Pool's rhythm; a piece with no legal spot is null. UI tests in
   `goods.test.tsx`.

## Leave out

- A value for a crate as a whole. Its options are random until it opens; each option shows
  its own line then.
- The bots. The shop bot keeps its own estimates (`sim/policies/shop.ts`), so the sim's
  numbers stay comparable with the review's.
- Marking a "best buy".

## Where it lives

- `src/rules/run.ts`: `fixtureValue`, `blueprintValue`, `installWeek`, `idleNextWeek`,
  `weeksLeft`, `legalPlacements`, `scoreOnly`.
- `src/rules/blueprint-value.ts`, `src/rules/estimate.ts`.
- `src/ui/hud/goods.tsx`, `src/ui/screens/ShopScreen.tsx`, `src/ui/hud/Inspect.tsx`.

## Watch for

- Speed. A piece's search runs at shop open for up to two pieces and three crate options.
  Measure it at a late-run house and keep the shop's open under about 50 ms more than today.
- The UI never works out a score: every number comes from these views.
- One line, in the fixture line's voice ("+120 this week, about 1,400 by the end").

## Done when

- [ ] Every piece and tool on a shelf or in an open crate shows its line, or says why it has
      none.
- [ ] A Remodel Plan for a set the house doesn't hold says what it's waiting for.
- [ ] The shop opens within the speed budget above.

## How to check

`?debug`: add budget, force the shop and give goods. Look at a Pool, a Remodel Plan with and
without its set, Rush Order and a Garden Center crate's options.

## Decision log

A new entry, with dated notes on:

- D-107 and D-141: a value line on every kind of good.
- D-092: telling whether a good is worth it.
