# S03 · The household walks in

| | |
|---|---|
| Size | M, about three days, a good part of it cutting sprites |
| Kind | UI and art: no rules or content change, and the content hash stays |
| Branch | `phase/household-walks-in` |
| Needs first | A look in the art packs for a suitcase and standing frames (step 1) |
| Comes before | S08, which can reuse the people layer and the cutting work |

## Story

When the doorbell rings for an arrival, the new member of the household walks up from the
street to the front doormat and waits there with a suitcase. Once one of their rooms is
built, they stand in its doorway.

## Why

- D-155's Considered list names "the household walking in when a member arrives" among "the
  investigation's later batches, for after this playtest". That playtest has happened, and no
  later entry picks it up.
- The doorbell arrival (D-126) was liked, and the user asked in playtest 6 for a lot that
  feels lived in.
- Grandma on the doorstep with a suitcase says "someone still needs a room" as a picture.

## Build

1. **Check the art first.** In the main checkout's `art-source/` folder, confirm that Modern
   Exteriors has a suitcase single and that the premade character sheets of Modern Interiors
   have a north-facing walk row and a standing frame. The pack's animation guide documents
   the rows. If either is missing, stop and say so.
2. **The cast.** A table in `src/ui` from arrival id to sprite. The ids are in
   `src/content/households.ts`: `twins`, `grandma`, `renfield`, `nana`, `rowan` and `ivy`.
   Use premade characters the sidewalk doesn't (it uses 01, 05, 12 and 14). Start with the
   adults. The packs have no baby and no ready-made child: compose a child for Ivy with the
   `compose` step in `scripts/cut-art.ts` if it reads well, and leave the twins out for now.
3. **Cuts.** For each cast member a north-facing walk row and one standing frame, plus the
   suitcase. Record them as the README describes.
4. **Where each person is.** A pure, tested module (as `src/ui/board/life.ts` is): from the
   run's state and the house model it says, for each arrived member, whether they are at the
   doormat or in a room, and the exact spot.
   - A member has a room when a placed piece's type is in their `ArrivalDef.room`.
   - In a room they stand on one of its doorways' `clear` rects. Those are the only bits of
     floor that are free of furniture in all three of D-173's arrangements.
   - At the doormat, several waiting members stand side by side.
5. **The walk.** After the doorbell in `arrivalBeat` (`src/ui/fx/director.ts`), the member
   walks in straight lines from the street to the kerb to the doormat, in the stepped,
   transform-only way `src/ui/fx/Drive.tsx` moves the walkers. Keep it to about 1.5 s, with
   the number in `FEEL.arrival`. A run that loads, or a replay, shows people in place with no
   walk.
6. **Drawing.** A new layer for people. It can't be `LifeLayer`, which sits over the house
   and draws nothing with Reduce motion on. A person in a room has to sort with that room's
   furniture, which `HouseLayers.tsx` orders by bottom row with tall sprites split into a
   bottom half and an overhang; otherwise the walls will cut a 16×32 figure standing near a
   north wall.
7. **Reduce motion.** No walk. The figure is still drawn, standing, because it says someone
   is waiting.

## Leave out

- Walking through the house. Nothing in the game finds a path, and sorting a moving figure
  against walls and furniture is the expensive part.
- The starting household and the clients themselves, a queue for the Bathroom, hearts over
  wishes, the Barkers' dog, tips on hover and a hop when a room scores.
- People in the milestone photos and on the street's stored houses.
- The guided first job. Don't draw people there yet.

## Where it lives

- `src/rules/index.ts`: `ArrivalDef`, `RunState.arrived` and the `arrived` event. Read only.
- `src/ui/fx/director.ts`: `arrivalBeat`. `src/ui/hud/ArrivalCard.tsx`: the doorbell's card.
- `src/ui/fx/moments.ts`: `frontDoor`.
- `src/ui/board/house-model.ts`: the exits with their mat rects, and each `Doorway.clear`.
- `src/ui/board/HouseLayers.tsx`: how a room's items are ordered.
- `art/limezu/life.json`: how the walkers were cut.

## Watch for

- One-cell rooms such as Renfield's Room and Rowan's Studio are already tight: D-111 caps a
  piece there at 22×26 px. Check the figure fits in their doorways.
- The figure must not take clicks meant for the board.
- A house with no front door has no doormat. Stand the member at the kerb then.

## Done when

- [ ] On an arrival, the member walks to the doormat after the doorbell and waits with a
      suitcase.
- [ ] Placing one of their rooms moves them to its doorway, and they sort correctly with the
      furniture and walls in every arrangement.
- [ ] A loaded run and Reduce motion show them in place with no walk.
- [ ] The placement module is pure and tested.
- [ ] Each new cut is in `assets/licenses.json` and `CREDITS.md`.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

Start a run with `?client=hendersons`, open `?debug` and force Grandma's arrival. Watch the
walk, then build her room. Repeat for the Count's Renfield, whose room is one cell across.

## Decision log

A new entry, with dated notes on:

- D-126: the arrival gains a walk-in after the doorbell, and `FEEL.arrival` grows.
- D-155: people are a layer of their own, so its rules stand as written.
- D-136: the photos don't show people (a known gap).

## If it lands

The twins, people in the photos, and S08's client at the door.
