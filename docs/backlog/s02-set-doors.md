# S02 · Set doors

| | |
|---|---|
| Size | M, about the size of D-159's fence and hallway fix, after a sheet for the user |
| Kind | UI and art only: no rules or content change, and the content hash stays |
| Branch | `phase/set-doors` |
| Needs first | The user's pick from a before and after sheet (stage 1) |
| Shares files with | S04, S05, S07 and S09: build one at a time |

## Story

Rooms that form a set open into each other, and stay that way while the set holds. A Suite's
Bedroom has doors into its own Bathroom and Closet. Both Bedrooms of a Jack-and-Jill open
into the Bathroom they share. The Entertainer's Kitchen, Dining Room and Living Room get a
wider opening where two of them share a wall.

## Why

- "More house-like" is the user's strongest praise, and en-suite doors and an open kitchen
  and living run are how real houses are laid out.
- Nothing on the board shows a held set once its moment has played. This shows it with no
  text.
- D-100's note of 2026-11-07 logged a gap that is still open: "the door tree running through
  bedrooms when no public room touches a Hallway". Set doors laid before the tree take the
  place of some of those doors.

## Ask the user first

This changes the art of Accepted D-093, D-100 and D-159, which say a wall stands between
every two rooms and the tree adds as few doors as it takes. Build stage 1, show the sheet,
and get the user's pick on two things: whether to build it, and how wide the Entertainer's
opening is.

## Build

**Stage 1: the sheet.**

1. In `src/ui/board/house-model.ts`, add a door reason `set` to `Doorway.why` (today `hall`
   or `tree`). Lay set doors before the spanning tree and join them in its union-find, so the
   tree doesn't add a second door between the same two rooms.
2. Give `houseModel` the held sets as a new optional input beside the hall links and the sun,
   and add it to the model's cache key. `rules.currentTally(state).sets` lists each held
   instance's members by uid. Its three callers all hold the run's state: `Board.tsx`,
   `fx/moments.ts` and `screens/photo-paint.ts`.
3. The doors:
   - Suite: the Bedroom to the Bathroom, and the Bedroom to the Closet, where they share a
     wall.
   - Jack-and-Jill: each Bedroom to the shared Bathroom.
   - Entertainer: a wider opening between each two members that share a wall. Keep a stub of
     wall on both sides, so each room still reads as its own room.
   - Members joined only through a Hallway get nothing extra (`touchesAt` in
     `src/rules/sets.ts` allows that link).
4. Render four or five seeded houses before and after: one holding each of the three sets,
   and one where the tree runs through a bedroom today. Save them as
   `docs/playtests/set-doors-<n>-before.png` and `-after.png`, and show the user.

**Stage 2: after the OK.**

5. `src/ui/art/rooms.ts`: furniture already keeps off each door's `clear` rect. A wider
   opening in a north wall takes away wall that beds, counters and hutches stand against.
   Check every room type's layout in each of D-173's three arrangements at the smallest
   footprints, and fix the slot rules where a piece now stands in an opening.
6. Tests in `house-model.test.ts`: each set gets its doors; none is drawn for a Hallway link;
   the tree adds no duplicate; the doors follow when a demolition makes a set match
   differently. Extend the `rooms.test.ts` matrix for the wide opening.

## Leave out

- The wall coming down at the set's moment. The board repaints when the piece is placed, and
  the existing set pop and dust play over it.
- A gate in the Dog Run's Fence (`yard.test.ts` proves a yard looks closed pixel by pixel), a
  rolled-up garage door for the Drive-In, and trim for a Remodel Plans level.
- Full House, the Harvest, the Play Yard and the Backyard: none has a wall to open.
- A ghost that previews the opening. The ghost is the piece alone (`pieceModel`).

## Where it lives

- `src/ui/board/house-model.ts`: `Doorway`, `parentScore` (it already prefers a Closet or a
  Bathroom off a Bedroom) and `houseModel`.
- `src/ui/art/house-paint.ts`: walls and doorways are drawn in code from a pixel mask, and
  the mask's cut already handles a gap of any width. No new sprite is needed.
- `src/ui/art/rooms.ts` and its test (about 1,200 lines), and `house-model.test.ts` (about
  860 lines). Much of the layout is pinned there.

## Watch for

- Rooms never merge (D-093, restated in D-159). Open the wall; never remove it. D-100's
  review treated two rooms reading as one as a defect.
- Sets match again after a demolition, so a door can move. The model is derived from state,
  so that needs no extra work, only a test.
- Milestone photos and replays draw through the same model, so a finished house's new photos
  will show the doors. Houses already stored for the street are pictures and don't change.

## Done when

- [ ] The user has picked from the sheet.
- [ ] Each of the three sets shows its doors on the board at every rotation, and a set
      linked only through a Hallway shows none.
- [ ] No furniture stands in an opening in any arrangement.
- [ ] `house-model.test.ts`, `rooms.test.ts` and `yard.test.ts` pass, with the new cases.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

Give yourself the set's rooms with the debug panel's "give a card", build each set, and look
at 1× and 2×. Then demolish one member and check the doors go back to the tree's.

## Decision log

A new entry, with dated notes on D-093, D-100 and D-159 (their door rules gain set doors) and
on D-097's art rules. Update section 12 of `docs/implementation-plan.md` where it describes
doors. Because it changes Accepted art, the user merges it after a look, as with D-159.
