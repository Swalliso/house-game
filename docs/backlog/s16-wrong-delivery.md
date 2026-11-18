# S16 · The wrong delivery

| | |
|---|---|
| Size | M, about two days and a sim trial |
| Kind | Rules and content. The content hash changes |
| Branch | `phase/wrong-delivery` |
| Needs first | The user's verdict on D-171. Part of the rules batch |

## Story

Once a run, at the start of Framing, a yard showpiece you didn't order turns up free in Your
goods: a Pool, a Hot Tub or a Henhouse. Which one depends on the run.

## Why

- These three are shop-only (their draw weight is 0), and the user finds many shop goods not
  worth buying. Their art is among the least seen in the game.
- The user says yes to a generous guarantee more often than to luck. One showpiece landing
  free gives each run a different centerpiece, with no new screen.
- The whole delivery pipeline exists (D-160, D-162, D-163, D-171). This is one more source.

## Why it waits

It is a third source of free cards, on top of the free stock at every milestone (D-169) and
D-171's crew cards. D-171 was still Proposed when this was written. Build this after its
verdict, so the user judges one new source of free cards at a time.

## Build

1. **The rule.** In `arrive()` in `src/rules/run.ts`, beside the crew's stock step: when the
   run isn't a first job, it is the first week of the phase named in the content, and it
   isn't an overtime week, pick the piece on a new keyed stream (for example
   `stream(seed, 'delivery/surprise')`) and add it with `addExtra`. The pick comes from the
   seed alone, so the run's state needs nothing new beyond the mark below, and run codes
   need no new format.
2. **The mark.** A new mark on `ReservePiece` (say `surprise`), a fourth value for `from` on
   the `delivered` event, and `inExtraSlot()` in `src/rules/shop.ts` so the card sits in an
   extra slot and doesn't use one of the two bought slots.
3. **The content.** In `src/content/balance.ts`, something like
   `surpriseDelivery: { phase: 2, pieces: ['pool', 'hotTub', 'henhouse'] }`, with checks in
   `validateContent`: the pieces exist, their draw weight is 0, the phase is in range.
4. **Skips.** If the picked type is at a limit for this client when it would arrive, take
   the next one in the stream's order; if none fits, nothing arrives. A struck type still
   arrives, as the standing stock ignores strikes (D-157).
5. **On screen.** `extraSlotWords()` in `src/ui/hud/household.ts` gets a tag for the new
   mark, and Inspect one line. The director's `deliveredBeat` plays the pop and sparkle it
   already has for the new source.
6. **The sim.** A new bucket in the reserve-plays record (`sim/simulate.ts`), its line in
   `sim/report.ts`, and its key in `sim/chaos.test.ts`'s coverage. Then a paired-seed trial
   with it on and off, 600 runs an arm, as D-171's first stage did. Expect roughly two to
   five points for the greedy bot. Report it; don't change the targets here.
7. **Tests.** In the style of `src/rules/stock.test.ts`, plus a replay that proves the same
   seed delivers the same piece.

## Leave out

- A crate with a "?" that shakes open in Your goods. The shop's crate animation would have
  to be ported; add it only if a Pool landing makes the user smile.
- The three shop-only rooms (Playroom, Library, Mudroom). Each is one per house, and they
  collide with clients' wishes and the Architect's cards.
- A random milestone. Fixed at Framing, only the piece varies.

## Where it lives

- `src/rules/run.ts`: `arrive`, `addExtra`, `crewStock`, `restock` and `stockDue`, which
  already branch on the first job and skip overtime.
- `src/rules/index.ts`: `ReservePiece` and the `delivered` event.
- `src/content/pieces.ts`: the three pieces. The Pool is 2×3 and wants the back yard; the
  Hot Tub earns only when it touches a room; the Henhouse pays budget every second week.
- `src/content/balance.ts`: `standingStock`, the model for the new entry.

## Watch for

- The content hash changes, so runs in progress drop on merge, and an old run code diverges
  from the delivery week because the reserve's indices shift (a known gap of D-160's).
- The sim's speed gate already fails under load. A 2×3 Pool scored every week until it is
  placed makes it slightly worse; note the number.

## Done when

- [ ] A standard run gets exactly one of the three at Framing's first week, the same one
      for the same seed, free to build from Your goods.
- [ ] A first job gets none.
- [ ] The card is tagged in Your goods and explained in Inspect.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

Start three seeds with `?seed=` and play, or use the debug panel's "add score", to Framing.
Check each seed's piece against the stream in a test, then place it.

## Decision log

A new entry, with dated notes on:

- D-160: a third kind of delivery to the extra slots.
- D-103: what the reserve's extra slots hold.
- D-051 and D-082: these three pieces are no longer shop, crate and Catalog only.
- D-098: a new origin tag in Your goods.
- D-089: the sim's reserve-plays line.
