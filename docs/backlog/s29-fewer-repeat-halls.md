# S29 · Fewer repeat Hallways and Fences in the hand

| | |
|---|---|
| Size | S, a day and a sim trial |
| Kind | Content. The content hash changes |
| Branch | `phase/fewer-repeat-halls` |
| Needs first | The user's OK (Ask the user first): it changes D-160 and D-121, both Accepted |

## Story

The weekly hand shows a Hallway or a Fence half as often, since Your goods always holds one of
each. The hand shows something new more often.

## Why

- Since D-160 and D-169, Your goods holds a free Hallway and a free Fence pack, refilled each
  milestone, and placing one doesn't use the week (D-163). A Hallway or a Fence in the hand
  repeats a card you already have, and playing it from the hand costs the week.
- In the 2026-11-20 review of rarely used goods
  (https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X, 400 greedy runs logging each week's
  first hand), the Hallway, the Long Hallway and the Fence were 8 of the 111 cards a run's
  hands show. The bot placed 5.8 Hallways and 3.8 Fences a run, nearly all from the stock.
- D-169 found that the free Hallways already make houses sprawl, so fewer in the hand doesn't
  cost a house its halls.

## Ask the user first

"Halve the Hallway's and the Fence's draw weight, from 10 to 5?" D-160 kept both types in the
draw with their weights as they were, and D-121 set the Fence pack at 10. Both are Accepted.
The user was asked on 2026-11-20; if they said yes, the thread that builds this has their
message.

## Build

1. In `src/content/pieces.ts`, `hallway` and `fence` go from `drawWeight: 10` to 5. The Long
   Hallway stays at 10: the stock never brings it. The Driveway stays at 10, so the two packs
   no longer draw alike (D-121); say so in the log.
2. Nothing else moves: the stock, strikes and the strike floor (D-084, D-121), and the clients'
   pools (the Hendersons' and the Barkers' +100% on the Fence now make it 10).
   `validateContent`'s check that the stock's pieces are in the weekly draw still passes at 5.
3. **Tests:** the two weights. Seeded tests that drew one of these cards will draw something
   else: update each expectation and check it's a draw change, not a rule change.
4. **The sim:** a paired-seed trial, 600 runs an arm on `check-*`: Hallways and Fences in the
   hand and placed per run, from the hand and from the stock; runs ending with a fenced yard,
   the Hendersons' A fenced yard and the Barkers' A big fenced yard; the compact outline and
   the glance test (D-169); `--check`'s "fences pay their way"; and wins. Report it; don't
   change the targets here.

## Leave out

- The stock and its refill (D-160, D-169), and the Driveway's weight.
- Taking the Hallway out of the draw. `validateContent` keeps the stock's pieces in it, and a
  strike already does that for a player who wants it.
- D-169's brake on the sprawl (the Fence alone topped up). The user decides that after playing.

## Where it lives

- `src/content/pieces.ts`: `hallway`, `fence`.
- `src/content/clients.ts` (the pools that weight the Fence) and `validateContent`
  (`src/content/index.ts`), read only.
- `sim/simulate.ts` (`wallOffers`) and `sim/report.ts` (`fenceStats`), read only.

## Watch for

- The content hash changes, so runs in progress drop on merge.
- "Fences pay their way" in `npm run sim -- --check` wants 50% of runs to be offered their
  probe's count of Fences by milestone 4, and it counts only the hand's (`wallOffers`), not the
  stock's. Halving the weight may fail it. If it does, report whether it passes with the
  stock's Fences counted, and ask the user before changing the probe.
- Old run codes diverge from the first week a seed would have drawn one of these.

## Done when

- [ ] The Hallway and the Fence draw at 5, and the stock still brings one of each.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

Any `?seed=`: play the first two milestones, count the Hallways and Fences in the hands, and
check that Your goods holds one of each from week 1.

## Decision log

A new entry, with dated notes on:

- D-160: the stock's two types draw at half weight.
- D-121: the Fence pack draws at 5 and the Driveway at 10.
