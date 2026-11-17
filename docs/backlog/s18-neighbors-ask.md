# S18 · The neighbor's ask

| | |
|---|---|
| Size | L, three to four days and a sim check |
| Kind | Rules, content and UI. The content hash changes |
| Branch | `phase/neighbors-ask` |
| Needs first | Part of the rules batch. Cheaper after S03, which cuts standing figures |

## Story

Once a run, at the start of a mid-run milestone, a neighbor stands at one side of your lot
with a Fence icon and a count. Run that much Fence along their side before the milestone and
they hand over one overtime week.

## Why

- The user's lead idea in playtest 6 was a sense of building a neighborhood. D-156 built the
  street as pictures only: nothing about the neighbors reaches into a run.
- D-078 is still Open on where the house sits against the lot's edges.
- The standing stock tops up a Fence at every milestone (D-162, D-169), so the player can
  always answer the ask. That is why the ask is for Fence and nothing else.

## A caution

This is a fourth source of requirements, after wishes, house rules and change orders. The
outside tester said requirements were already too many to complete. The scope is one ask,
once, with a picture and a count. If the user reads it as one thing too many, it goes.

## Build

Starting numbers are marked.

1. **Side strips as regions.** The lot's west and east edges, a few columns deep (starting
   number: 2), join the `Region` type in `src/rules/index.ts`. That reaches the region bits
   in `layout.ts`, `pieceIn` in `selectors.ts`, `allInRegion` in `estimate.ts`, and the
   region's words and glossary keys in `text.ts`.
2. **A tile count.** Today's conditions count pieces, and a Fence pack is one piece of
   several tiles. Add a condition for "tiles of matching pieces inside a region, at least
   N", in `conditions.ts` with tests.
3. **The ask.** A seeded step in `src/rules/run.ts` at the start of one phase (starting
   number: Roofing). The side comes from a stream such as `neighbor/<phase>`. The rules pick
   it from the lot alone; they never read the company's record (D-016, D-156). Keep a record
   in the run's state beside the change orders, resolve it in the milestone's path next to
   `resolveOrders`, send an event when it is asked and when it resolves, and give the UI a
   view of its progress. There is no player action, so run codes keep their format.
4. **When there is no ask.** A first job. A side that is water or protected Trees (the lake,
   a creek, Old Woods, D-174). A side without enough free tiles.
5. **The gift.** `{ overtime: 1 }`. `Reward` and `payReward` already handle it; no content
   uses it yet.
6. **The numbers** go in `src/content/balance.ts`: the phase, the strip's depth and the
   count (starting number: 5 Fence tiles).
7. **On screen.**
   - A standing figure at the lot's edge on that side, one of the stock characters, from a
     new standing-frame cut.
   - A bubble with the Fence icon and "n/5", and no words.
   - The strip tinted while the ask runs, the way D-166 shades the yard a picked card reads.
   - One line in the checklist or Inspect, for anyone who can't read the picture.
   - The doorbell when the ask comes, and a heart with the gift's pop when it is met,
     through the director with timings in `feel.ts`. A still version under Reduce motion.

## Leave out

- A pool of different asks. Asks for pieces the draw may never deal repeat an old complaint.
- A strike as the gift. `Reward` has no field for strikes.
- "Within two tiles" of the edge as a real range. That would change D-035.
- Dressing the figure as a client whose house stands there. Clients have no portraits, and
  the rules can't know whose house it is.
- Asks about Trees or Loud pieces.

## Where it lives

- `src/rules/run.ts`: `drawOrders` and `resolveOrders`, the change orders' machinery this
  sits beside, and `payReward`.
- `src/content/change-orders.ts`: "A letter from the HOA" forbids building in the front
  yard, the nearest existing rule.
- `src/ui/board/NeighborsLayer.tsx` and `neighbors.ts`: the street's houses.
- `src/ui/hud/Checklist.tsx`: where a request's progress shows today.

## Watch for

- The bots take no action for it, and the greedy bot's estimate won't chase it, so the sim
  understates what a player gets. Run `--check` before and after, and call for a re-fit only
  if it moves past five points (D-174's rule). That re-fit is the batch's.
- An overtime week is a strong gift for a person. Say so in the log, so the playtest looks
  at it.

## Done when

- [ ] A standard run with a clear side gets one ask at the chosen phase; a first job and a
      blocked side get none.
- [ ] Enough Fence tiles in the strip by the milestone pays one overtime week, once.
- [ ] The figure, the count, the tint and the two moments play, with a still version under
      Reduce motion and a line for those who need words.
- [ ] Rules tests cover the region, the tile count, the skips, the payout and a replay.
- [ ] The `--check` comparison is in the log entry, and the targets are untouched.

## How to check

Reach the phase with the debug panel's "add score", lay the standing Fence along the asked
side, and meet the milestone. Then try a lake lot to see the skip.

## Decision log

A new entry, with dated notes on:

- D-109: requests gain a second source, and a reward that isn't budget.
- D-049 and D-166: the regions gain the lot's side strips.
- D-156: the street gains a figure the rules place, while the rules still never read the
  company's record.
