# S17 · One wish on the lot

| | |
|---|---|
| Size | M to L, three to four days and a sim trial |
| Kind | Rules, content and UI. The content hash changes |
| Branch | `phase/lot-wish` |
| Needs first | Part of the rules batch |

## Story

One thing already on your lot asks for company: the Pond where there is one, otherwise the
Old Shed. Build enough of the pieces it likes beside it, and a shop-only piece drops into
Your goods: a Hot Tub from the Pond, a Henhouse from the Shed.

## Why

- D-078 is still Open, and its last note lists "a wish that reads the lot" as not yet done.
- D-091 asked for finds worth building around. In playtest 3 the Old Shed was cleared in
  week 1; D-145 gave pieces a reason to stand beside it, and this gives the player one.
- The research on Dorfromantik (`docs/research.md`) credits its quests with keeping late
  turns alive, with a warning: a quest that becomes impossible feels unfair. The scope below
  is cut to respect that.

## Build

Starting numbers are marked. Tune them by the sim and by play.

1. **A reward that pays a piece.** `Reward` in `src/rules/index.ts` gains a piece field.
   `payReward` in `src/rules/run.ts` puts it in the reserve in an extra slot with a new
   mark, so it doesn't use a bought slot. `rewardText` in `src/rules/text.ts` and
   `validateContent` learn about it.
2. **The wish, as content.** One definition per feature, for example in
   `src/content/features.ts`: the feature, what to count, how many, and the prize.
   - Pond: 3 Green pieces touching it pays a Hot Tub. (Starting numbers.)
   - Old Shed: 2 of the pieces that already want it (Greenhouse, Garage, Herb Garden)
     touching it pays a Henhouse. (Starting numbers.)
3. **A condition for one feature.** Today a house condition is about the whole house. Add
   "pieces matching a selector that touch this feature". The Pond and the Old Shed are each
   one body, so the body's id says which.
4. **Which wish a lot gets.** Worked out from the lot alone: the Pond if it has one,
   otherwise the Old Shed, otherwise none. A lake lot has no Pond. No new stream is needed.
   The first job gets none.
5. **State and events.** Whether the wish is filled, checked after every action that changes
   the house (a placement, a demolition, a move, a transform, an extension). It pays once.
   A new event when it fills, and a view the UI can read: have, need, prize, filled.
6. **A wish that can't be met any more.** If the Shed is demolished before its wish is
   filled, the wish ends. The Shed's own tool still pays. Inspect on the Shed says what
   clearing it gives up.
7. **On screen.** No badge at rest: the text diet (D-167) applies. The count shows when the
   pointer is on the feature, in Inspect, and while a card that counts is picked. Filling it
   plays the find's burst (the `findClaimed` beat) and the delivery's pop. The card in Your
   goods gets a tag.
8. **The sim.** The greedy bot places for this week's Wow and will mostly ignore the wish.
   Either give `src/rules/estimate.ts` a hint for it or say in the log that the trial
   understates it. Run a paired-seed trial and report it; don't change the targets here.

## Leave out

- Trees and Boulders. A Tree is one tile among fifty, and a wish on it can be built over.
- The Time Capsule's choice of two. That needs a pick sheet on the build screen.
- More than one wish a lot, and a badge that stays on the board.

## Where it lives

- `src/rules/index.ts`: `FeatureDef` (it already has an optional reward) and `Reward`.
- `src/rules/run.ts`: `payReward` and the finds' payout.
- `src/content/features.ts`: `pond`, `oldShed` and `timeCapsule`.
- `src/rules/layout.ts`: the feature-neighbor list with body ids.
- `src/rules/conditions.ts`: where conditions are evaluated.
- `src/ui/fx/director.ts`: the `findClaimed` beat.

## Watch for

- Free builds are the most balance-sensitive thing in the game: D-163's trial of free goods
  moved the greedy bot by 20 to 35 points. One free piece a run is small, but measure it.
- It is one more goal beside wishes, house rules, sets, lot traits and change orders, in a
  game an outside tester said had requirements too numerous to complete. Keeping it to one,
  shown only on demand, is the answer to that; don't let it grow in review.

## Done when

- [ ] A lot with a Pond or an Old Shed carries one wish; other lots and the first job carry
      none.
- [ ] Filling it pays its piece once into an extra slot, with the burst and the tag.
- [ ] Demolishing the Shed ends its wish cleanly, and Inspect warned of it.
- [ ] Rules tests cover the count, the single payout, the dead wish and a replay.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

Find a Pond lot and a Shed lot by trying seeds on the job board's lot maps, then fill each
wish with cards from the debug panel.

## Decision log

A new entry, with dated notes on:

- D-078: the wish that reads the lot.
- D-082 and D-091: the Old Shed gains a second payout.
- D-049: a lot feature can carry a goal.
- D-163 and D-160: a new source of free builds, and a new mark in the reserve.
