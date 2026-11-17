# S21 · A house already on the lot

| | |
|---|---|
| Size | L, about a week, then a fit |
| Kind | Rules, content and art. The content hash changes |
| Branch | `phase/old-cottage` |
| Needs first | The user's OK, the verdicts on D-174 and D-145, and a played spike. The batch |

## Story

Some lots aren't empty. A small, tired cottage from a previous owner stands there: two or
three rooms that look faded and earn half. Fit one out, grow it or renovate it, and it
repaints with a pop and earns in full.

## Why

- The user's strongest delight is a room that visibly changes. A faded room that repaints
  is that, and it gives Renovate the visible result the user said it lacks.
- A lot that starts with rooms makes week 1 a different problem, in a way traits and biomes
  don't.
- D-025 kept the house's data apart from the run's on purpose, to keep "the door open for a
  future renovation mode that starts from an existing house".

## Ask the user first

"Renovation mode" is Parked, with the note "Revisit once the core is fun", and D-014 says
renovation modes wait. This isn't the mode: it is a kind of lot. It is close enough that the
user should say yes before it is built.

## Build

1. **The cottages, as content.** One or two hand-made templates of two or three rooms: the
   piece ids, their rotations and their cells relative to each other.
2. **Laying one down.** From `newRun` in `src/rules/run.ts`, where the house starts empty
   today. Try a template at offsets from its own keyed stream (such as
   `lot/<attempt>/house`) and place its rooms through `addPiece` in
   `src/rules/placement.ts`, so they get adjacency, sets, house rules, doors and
   arrangements with no extra work. Keep off water, Boulders and old Trees, keep the lot's
   free-ground checks, and fall back to the plain lot when nothing fits, as `shapeLot` does.
3. **A lot kind and a trait.** A new entry in `LOT_KINDS` (`src/rules/lot.ts`) and a lot
   trait for the chip on the contract and the checklist (a trait's blurb is held to 37
   characters). A low weight in `balance.lot.biomes`. Never on the first job, whose lot is
   one fixed seed.
4. **Old rooms.** An `old` flag on `PlacedPiece`, cleared when the room gets a fixture, is
   extended, is renovated or takes the Architect's Addition. It survives the Moving Truck
   and a transform. An old room earns half; the share goes in `balance.ts`, and the
   breakdown labels it so `preview()` can show what waking the room is worth.
5. **Things to check against the given rooms.**
   - A given Kitchen is the one Kitchen a house may have, so every Kitchen card extends or
     renovates from week 1. Choose the templates with that in mind.
   - The client's Bedroom range and room limits count the given rooms.
   - Seeded rooms have `placedWeek` 0. Check timers, and the end screen's count of pieces
     built, which is the next uid minus one today.
   - A demolition can't split the house, so what can be knocked down depends on the
     template's shape.
6. **The look.** A fade for each old room in the floor and wall painters, the way
   `dimPixels` in `src/ui/board/terrain/outside.ts` dims the garden, and faded furniture as
   recolored cuts through the `recolor` step in `scripts/cut-art.ts` (D-174's method, with
   license records). No CSS filter on a whole piece: the house's styles rule that out. The
   ghost, the Moving Truck's carried piece and the photos share the painters and follow.
7. **On screen.** The cottage's footprint on the job board's lot map
   (`src/ui/screens/lot-map.ts`), a line in Inspect, and a repaint pop with its timing in
   `feel.ts`.
8. **The spike, before any fit.** Reach a cottage lot through a seed and ask the user to
   play it at today's targets.
9. **The sim.** The greedy bot never demolishes, so the fit treats the cottage as rooms you
   must keep. Report the kind's own win rate, as D-174 did for each kind. The fit itself is
   the batch's.

## Leave out

- A contract or a mode built on this: a third run mode, a five-milestone run, budget for
  salvage, extra demolitions. That is the Parked idea, and several times the size.
- Generated cottages. Hand-made templates only.
- A target factor for the lot. Half pay for old rooms is how the head start is paid for.
- A past client's house coming back from the Portfolio. D-139 and D-156 store a picture,
  not a layout.
- Worn art beyond a fade: peeling paper, broken furniture, cobwebs.

## Where it lives

- `src/rules/run.ts`: `newRun`. `src/rules/placement.ts`: `addPiece`.
- `src/rules/lot.ts`: `LOT_KINDS`, `shapeLot`, `KIND_CHECKS` and `lotFromRows`.
- `src/rules/index.ts`: `PlacedPiece`.
- `src/content/balance.ts`: the biomes' kinds and weights, and `firstSeed`.
- `src/content/lot-traits.ts`: the traits.
- `src/ui/art/house-paint.ts` and `src/ui/board/HouseLayers.tsx`: the painters and the
  furniture.

## Watch for

- "Keep it or knock it down" is probably not a real choice: rooms that earn from week 1 are
  never worth one of two demolitions. The choice this version offers is "wake the old room
  or build a new one". Judge the spike on that.
- About two thirds of a win's Wow comes from pieces placed in the first two milestones
  (D-145's table), so a head start matters a great deal. Half pay is the brake; the sim will
  say whether it is enough.
- A given Kitchen changes what Kitchen cards do from the first week, which a newcomer won't
  expect. That is one more reason it stays off the first job and at a low weight.

## Done when

- [ ] The user has said yes to a cottage lot.
- [ ] A cottage lot starts with two or three faded rooms that pass every placement check,
      and the same seed gives the same cottage.
- [ ] Fitting, extending or renovating an old room clears the flag, repaints it with a pop
      and restores full pay, and the preview says what that is worth.
- [ ] Rules tests cover the layout's fallback, the flag's every path, half pay and a
      replay.
- [ ] The user has played the spike, and the kind's win rate is in the log entry.

## How to check

Find a cottage seed with a small script over `newRun`, open it with `?seed=`, and wake each
room a different way: a fixture, an extension, a renovation.

## Decision log

A new entry, with dated notes on:

- D-014 and the Parked "Renovation mode": an existing house comes in as a lot kind, and the
  mode stays Parked.
- D-025: the door it left open.
- D-166 and D-174: a new lot kind and trait.
- D-102 and D-168: renovating or extending an old room also wakes it.
