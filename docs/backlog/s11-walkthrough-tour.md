# S11 · The walkthrough tour

| | |
|---|---|
| Size | M, two to three days |
| Kind | UI only: no rules or content change, and the content hash stays |
| Branch | `phase/walkthrough-tour` |
| Needs first | S01 played by the user. Build at most one of S10, S11 and S12 at a time |

## Story

The last milestone is called the Final Walkthrough. When you win, the camera goes in close at
the front door and moves through up to six rooms in the order you would walk them, ending on
the room that earned the most Comfort. Then the look down the street begins.

## Why

- The end of a won run never shows the furnished rooms up close, and they are the art the
  user likes most.
- D-098 promised a finale for the end screen and no entry built one.
- "Tour-order scoring" is Parked because a scoring chain is hard to predict. This is a tour
  with no scoring, which is a different thing.

## Build

1. **The path.** A pure function over the house model that orders rooms by walking the
   `doors` from the room behind the front exit, and returns a stop at each room's center.
   Test it as `house-model.test.ts` tests the model.
   - Keep five or six stops: the first rooms in door order, with the last stop the room
     whose pieces earned the most Comfort over the run.
   - That total is a count of what the rules reported: sum each piece's weekly `earned` over
     a replay (`src/ui/screens/photos.ts` already replays the run). It isn't a new score.
   - A house with no front door, a part reached only by a side exit and a house with almost
     no rooms need a rule each. Skipping the tour is an acceptable rule.
2. **The camera.** Set the `zoom` signal to 2× so the board re-lays out (D-097: never a
   scale transform for the camera's zoom), then pan by tweening the scroll container from
   stop to stop. No pan helper exists yet. Add a camera state that blocks the player's zoom
   and pan while it runs, as the street view does, and that hands over to the street view
   when it ends. `EndPhotos` then waits for both.
3. **Set rings.** When the last member of a held set comes into view, play that set's
   existing ring. `Tally.sets[].members` has the uids.
4. **Limits.** Under about eight seconds in all. A click, a key or the wheel hurries it. Off
   with Reduce motion, for a debug run and for a run loaded already over.
5. **Numbers.** In `feel.ts`.

## Leave out

- A client sprite walking the route. It needs up and down walk frames for five clients and a
  place in each room's drawing order, and a figure clipping through a bed is the kind of
  thing the user removes.
- A Wow number over each room. Wow is the whole house's product, so a room's share needs a
  new rule in `src/rules`, and a surprising number at the end invites "why did that room earn
  that?" when nothing can be done about it.
- Hearts and shrugs for wishes. No view says which room holds a wish, and several wishes
  have no room.
- Folding the end panel's milestone and stat rows. D-148 and D-152 tuned those.

## Where it lives

- `src/ui/board/house-model.ts`: `doors` (each with its two rooms and its gap) and `exits`.
- `src/ui/board/camera.ts`: `zoom`, the zoom anchor and `streetView`.
- `src/ui/board/Board.tsx`: the street view's effect, the only scripted camera move today.
- `src/ui/screens/EndPhotos.tsx` and `photos.ts`.

## Watch for

- At 2× on a 1280×720 window the board shows about 11 cells across. A big room needs a rule
  for what to center on.
- A house of 20 rooms can't be toured in eight seconds. Hold to the cap on stops.
- This sits in front of the street view and the photo deal. If it feels long on the second
  win, shorten it before adding to it.

## Done when

- [ ] On a win, the camera goes to the front door at 2×, visits at most six rooms in door
      order, ends on the top Comfort room and hands over to the street view.
- [ ] The player can't zoom or pan during it, can hurry it, and gets control back after.
- [ ] Reduce motion, a debug run, a loaded run and a lost run don't play it.
- [ ] The path function is pure and tested, including the houses that skip the tour.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

See "End-of-run moments need a run that ends in the browser" in the [README](README.md).
Win with a small house and with a sprawling one, at 1280×720 and at 1920×1080.

## Decision log

A new entry, with dated notes on D-098 (the finale it promised, in this form), D-156 (the
look down the street starts after the tour) and D-136 (the deal waits for one more beat).

## If it lands

If the user watches it twice without skipping, a walking client and a number per room have
earned a second look.
