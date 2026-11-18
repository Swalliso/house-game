# S14 · Pin one card

| | |
|---|---|
| Size | M, three to four days, most of it in the hand's layout and the edge rules |
| Kind | Rules and UI. No content change, so the hash and saves hold. No re-fit |
| Branch | `phase/pin-a-card` |
| Needs first | Nothing. It can be tried by itself at any time |

## Story

Stick a pushpin in one hand card you didn't play. Next week it is still in your hand, in
place of one fresh card of its row.

## Why

- It is the one idea in this backlog that adds a real choice every week with no rules text.
  The draw is two Rooms cards and two Layout cards a week (D-121), so a pin gives up half of
  next week's fresh row.
- `docs/house-systems-review.md` named the gap once ("There's no way to hold a card") and no
  decision followed.
- The outside tester found the game luck-heavy. The user tends to prefer a guarantee over
  luck.

## The rules, settled

These are the defaults. Change one only with a reason, and log it.

- One pin at a time, on a card in either row.
- The pin is set before the play that ends the week. End week discards the rest of the hand.
- Next week the pinned card takes one slot of its row: the slot that dealt the same card if
  there is one, so the row stays distinct (D-043), and a fixed slot otherwise. The free swap
  for a card with no play (D-121) skips that slot. Then the pin is gone.
- A card that was kept this way can't be pinned again the week after. Re-pinning forever
  would bring back the standing card D-121 turned down.
- A pin doesn't cross a milestone's shop or Complete early, which both empty the hand. It
  does carry into an overtime week.
- A reroll leaves the kept card where it is and redraws the rest (D-132).
- A strike on the pinned card's type clears the pin (D-157).
- A fixture card can be pinned.
- The Catalog tool's redraw leaves the kept card.
- It is hidden in the guided first job.

## Build

**Rules**

1. `src/rules/index.ts`: a pin action that toggles (`{ t: 'pin', i }`), `RunState.pinned`,
   a field on the `handDrawn` event saying which slot holds the kept card, and `canPin` on
   the `Rules` interface.
2. `src/rules/run.ts`: the action as a free one in `apply()`. `startWeek` draws both rows on
   the same keys as today and then overwrites one slot. Handle the reroll, `strikeFromHand`,
   `swapDead`, the shop and Complete early as the rules above say. Add it to `legalActions`.
3. `src/rules/draw.ts` needs no new stream: the draw's keys are per row and per week, so
   nothing shifts, and `DrawOptions.held` already stops a reroll dealing a duplicate.
4. `src/rules/runcode.ts`: a validator for the new action, beside the one for `strikeCard`.
5. **Hard-code "one pin" in the rules, not in `balance.ts`.** A key in the content would
   change the hash and drop runs in progress. Hard-coded, a run with no pin replays exactly
   as before.
6. Tests, following D-157's: a `pin.test.ts` (no stream shifted, rows stay distinct, swaps,
   reroll, strike, the shop, Complete early, overtime, run codes), a property in
   `properties.test.ts`, and the new action in `sim/chaos.test.ts`'s `ACTION_KINDS` with a
   kind in `sim/policies/chaos.ts`.

**UI**

7. `src/ui/hud/Hand.tsx` and `hand.css`: a pushpin toggle on the card's corner, sharing it
   with the "Swapped in" badge. Its click must not select the card. Give it a key (R, D, S
   and F are taken), a `tip` and a label for screen readers.
8. The kept card stays put while the rest of the hand deals (`src/ui/fx/director.ts`, with
   the timing in `feel.ts`).
9. A pushpin icon of our own in `src/ui/theme/icons.ts`, and one new sound as a kit recipe.
10. No first-time hint and no How to play line in this version. The tip explains it.

## Leave out

- A bot that pins, and a re-fit. See "How to check".
- A pin count in the content, a shop good that adds pins, or more than one pin.

## Where it lives

Named in the Build list. The closest precedent is D-157 (strikes from the hand), which
touched the same files: read its entry and its tests first.

## Watch for

- **The ordering trap.** Placing a piece ends the week, so a player who places first has
  lost the chance to pin. Make the pin visible on every card from the start of the week.
- **The hand is tight.** It is fitted at 1280×720, 1440×900, 1600×900 and at 2×, in two
  fonts, and its plank already holds Reroll, Strike and Demolish. Check all of them.
- It is a fourth control over the hand's luck, beside the reroll, the free swap and the
  strike. That is the reason for the test below.

## Done when

- [ ] A card can be pinned and unpinned; next week it is in its row in place of a fresh card.
- [ ] Every rule in "The rules, settled" has a test.
- [ ] A run code with a pin replays; an old run code replays exactly as before.
- [ ] `contentHash(CONTENT)` is unchanged.
- [ ] The hand reads at all the sizes above, and the pin isn't shown in the first job.

## How to check

- The greedy bot never pins. Run `npm run sim -- --check --json <file>` before and after and
  compare the records: they should be identical, which is what shows the targets stand.
- Then the user plays two runs. **Cut it** if they pin fewer than about three times a run or
  a pin never helps finish a set. Say that plainly in the pull request.

## Decision log

A new entry, with dated notes on:

- D-036: the hand is no longer wholly fresh each week, and the free actions gain one.
- D-121: a row can hold one kept card, which swaps skip.
- D-132: a reroll leaves the kept card.
- D-157: a strike clears a pin.
- D-089: the chaos test's action kinds.
- D-098: the hand card gains a control.
