# S07 · Finished rooms light up

| | |
|---|---|
| Size | Stage 1 is S, a day or two. Stage 2 is M, with the rules batch |
| Kind | Stage 1 is UI with one read-only rules view. Stage 2 is rules and content |
| Branch | `phase/finished-rooms` for stage 1 |
| Needs first | Stage 2 needs the user to say the lights landed, and it joins the rules batch |
| Shares files with | S02, S04, S05 and S09: build one at a time |

## Story

A room that has a fixture and has been grown, by Extend or by Renovate, is finished: a lamp
comes on in it with a small pop. In stage 2, finishing a room also pays 2 budget, once.

## Why

- The user has said that Renovate doesn't change anything you can see. A light coming on is
  the visible result.
- D-090 has been Open since playtest 3: budget comes almost entirely from milestones, and
  where and what you build barely changes it. Its options already name the room-completion
  rewards of Castles of Mad King Ludwig. Stage 2 is the smallest form of that.

## Build

**Stage 1: the lights.**

1. **What finished means.** A room is finished when it has a fixture and its `level` or its
   `extended` is above zero. All three are stored on the placed piece, and none can be undone
   (a fixture can be replaced, never removed).
   Add this as a pure exported helper in `src/rules`, with a test, so stage 2 and the UI
   share one definition. It reads state and changes nothing.
2. **The look.** A new painter in `src/ui/art/house-paint.ts`, beside the Chandelier's glow:
   a warm pool round a lamp. Lamp sprites are already in the atlas (`lamp-floor`,
   `nightlamp`, `side-lamp`), and a grown room already gets a floor lamp (D-168); light that
   one. It has to read apart from the Chandelier's glow and from a Sunny room's light.
3. **The moment.** When a play makes a room finished, the director plays a pop and a short
   light-switch flicker on it, reusing the find's burst. Timing in `feel.ts`. The flicker
   respects the Flashing setting, and Reduce motion shows the light already on.
4. **Which rooms.** Only rooms that can be grown. Bathrooms, Closets and Hallways keep their
   size (D-168) and can't be renovated, so they never light. That is intended.
5. **The shared painters.** The lit look comes from state, so the photos show it.

**Stage 2: 2 budget. Don't build it until the user says the lights landed.**

6. In `apply()`, compare the touched room before and after each install, renovation and
   extension. `src/rules/run.ts` has three paths to hook: the free install from Your goods,
   the play that doesn't end the week, and `resolveWeek`. When a room becomes finished, pay
   `{ budget: 2 }` through `payReward` on a keyed stream such as `finish/<uid>`, and send a
   new event.
7. `preview()` reports that a play would finish the room and what it pays, so the UI never
   works it out. The amount goes in `src/content/balance.ts`, which changes the content hash.
8. A demolished and rebuilt room has a new uid and could pay again. Either accept that or cap
   it, and say which in the log.
9. The bots won't chase it. Measure on paired seeds and report the crews apart: the Handyman's
   free installs and the Architect's Addition gain most, and the General Contractor is
   already the weakest crew for the greedy bot.

## Leave out

- A different gift for each room type (a reroll, a strike, a demolition, an extra play).
  Several don't work as written: a Bathroom can never be finished, and an extra play is lost
  when the finishing play ends the week.
- A badge at rest beside Renovate's star, in stage 1. The light is the mark.

## Where it lives

- `src/rules/index.ts`: `PlacedPiece` (its `fixture`, `level` and `extended`) and `Reward`.
- `src/rules/run.ts`: `payReward`, and the three paths named above.
- `src/ui/art/house-paint.ts`: the glow painters.
- `src/ui/board/HouseLayers.tsx`: Renovate's star badge, for where a room's marks go.
- `src/ui/fx/director.ts`: the `findClaimed` beat, whose burst this reuses.

## Watch for

- Three kinds of light in one room (a Chandelier, the sun, and this) must stay tellable
  apart. Try a Sunny room with a Chandelier that then gets finished.
- In stage 2, the user's text diet (D-167) leaves room for one preview line and no table.

## Done when

**Stage 1**

- [ ] A room with a fixture that has been extended or renovated shows a lit lamp.
- [ ] The play that finishes it gets the pop, and a loaded run shows the light with no pop.
- [ ] The helper in `src/rules` is pure and tested, and the content hash is unchanged.

**Stage 2**

- [ ] Finishing a room pays 2 budget once, through `payReward`, and the preview says so.
- [ ] A rules test in the style of `extend.test.ts` covers all three paths, and a run code
      replays the payouts exactly.
- [ ] The paired-seed result and the crews' spread are in the log entry.

## How to check

With `?debug`, give yourself a Bedroom, a second Bedroom card to extend it, and a Fireplace
or Bunk Beds. Finish the room in each order: fixture first, then growth, and the reverse.

## Decision log

Stage 1: a new entry, with dated notes on D-102 and D-168 (a renovation or an extension can
now complete a room's look).

Stage 2: a note on D-090, which it would decide, and on D-013 and D-085 (a budget source
outside the milestones) and D-050 (an install can pay a reward).
