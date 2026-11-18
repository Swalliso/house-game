# S19 · One scored visitor

| | |
|---|---|
| Size | L, four to five days |
| Kind | Rules, content and UI. The content hash changes |
| Branch | `phase/scored-visitor` |
| Needs first | S01 landed and the user wanting more. The user's OK on the payout. The batch |

## Story

In the last shop, one visitor's hope for the open house is shown as a single icon:
something they would love to see, such as a Pool or a Hot Tub. If the house has it when the
Final Walkthrough is met, their heart lifts the final Wow.

## Where this came from

The idea was "viewing day": three visitors in the last milestone, each adding Sparkle to the
last tally. The check against the code cut it down for four reasons.

- Wishes revealed with four placements left point at pieces you can't draw, so each visitor
  is either already pleased or out of reach. Showing one in the last shop makes the shop
  the decision.
- A Sparkle "in the last week" breaks two ways: Complete early and Auto skip that week, and
  overtime weeks would repeat it.
- Three Sparkles on the biggest phase could decide a run, and would hand every run a thing
  D-056 keeps rare.
- The moment without any rules (visitors at the kerb, hearts, confetti) is S01. Build that
  first; this story is only worth it if the user then wants the visitors to matter.

## Ask the user first

The payout is a design call. The default below never changes whether a run is won, which
keeps the targets as they are. If the user wants a visitor to count toward the last target,
that is a bigger version with a re-fit.

## Build

1. **Visitors as content.** A small table (a new `src/content/visitors.ts`): an id, an icon
   and a house condition. Start with about six that today's conditions can already say: the
   Harvest set, the Play Yard set, the Drive-In set, a Pool or a Hot Tub, the Entertainer
   with a Fireplace, two Quiet rooms touching. Add the checks to `validateContent`.
2. **The pick.** One visitor, picked on a new keyed stream when the last phase is set up.
   The shop opens with the next phase already set up, so the pick can show in the last
   shop. Skip a visitor whose hope is already met or can't be reached by this client, the
   way a change order's eligibility is checked.
3. **The payout (default).** When the Final Walkthrough is met and the hope holds, pay a
   bonus worth a percentage of the last phase's earnings, after the target check, the way
   leftover budget pays at the end (D-145). It lifts the final Wow and the verdict. It
   never turns a loss into a win. The percentage goes in `src/content/balance.ts`.
4. **Events and views.** An event for the pick and one for the verdict, and a view so the
   UI never works the hope out itself.
5. **On screen.** One icon in the last shop with a tip. One line on the checklist during
   the last phase, and no more: the text diet (D-167) applies. At the end, a heart or a
   shrug. If S01 is built, one of its crowd carries it.
6. **Tests.** The pick is seeded and replays. The payout comes once, only on a win, and
   after the target check. Content tests for every visitor's condition.

## Leave out

- Three visitors, and a new hope each run for each.
- Sparkle, and anything timed to "the last week".
- A walk up the drive to the piece they hoped for.
- A hope for "three kinds of Green piece". No condition counts distinct types today.

## Where it lives

- `src/rules/index.ts`: `HouseCondition`, with `count`, `set`, `adjacentPair`, `and`, `or`
  and `not`.
- `src/rules/run.ts`: `drawOrders`, a seeded pick with eligibility, and the milestone's
  resolution, where D-145's leftover budget pays.
- `src/rules/text.ts`: the words for a house condition.
- `src/ui/screens/ShopScreen.tsx` and `src/ui/hud/Checklist.tsx`.

## Watch for

- The name. Not "Open house…": the Open House Party tool has it, and D-137 dropped "Open
  house weekend" for the clash.
- A hope the player can't act on is the outside tester's complaint again: luck dressed as a
  goal. The eligibility check in step 2 is what prevents it. Test it per client.
- The verdict's bands are percentages of the last target, so a bonus makes the higher
  verdicts easier to reach. Report how often the verdict moves in the sim.

## Done when

- [ ] The user has chosen the payout.
- [ ] A standard run shows one reachable hope in the last shop and one line in the last
      phase.
- [ ] Meeting it on a win pays once, after the target check; a loss pays nothing.
- [ ] The pick and the payout replay from a run code.
- [ ] The log entry reports how often the bots meet the hope and how often the verdict
      moves.

## How to check

Use the debug panel's "add score" and "force the shop" to reach the last shop, buy what the
visitor hopes for, and finish the run both with and without it.

## Decision log

A new entry, with dated notes on:

- D-145: a second payout at the end of a won run.
- D-056: Sparkle's sources are unchanged by the default.
- D-109: a goal before the last phase that isn't a change order.
- D-155 and D-156: one of the street's figures means something to the rules.
