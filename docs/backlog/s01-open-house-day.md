# S01 · Open house day

| | |
|---|---|
| Size | M, about two days |
| Kind | UI only: no rules, content or balance change, and the content hash stays |
| Branch | `phase/open-house-day` |
| Needs first | Nothing |
| Comes before | S10, S11, S12 and S19, which build on this moment |

## Story

When a run is won, the street turns out. During the look down the street that already plays
at the end of a run, a crowd gathers on the sidewalk in front of the house, bigger for a
better verdict. A few cars are parked at the kerb, hearts rise over the rooms that earned
most, and a fanfare plays with confetti at the front door. A lost run plays as it does today.

## Why

- The game is named after this event, and a won run has no celebration of its own. The last
  milestone gets the ordinary banner (it reads "It's a house."), the ordinary `milestone`
  sound and the ordinary sparkles (`milestoneBanner` and the milestone case in
  `src/ui/fx/director.ts`). A loss already has its own treatment: the music slows.
- D-098 said M6 would build "the full-width finale". M6 shipped the share line and the
  polaroids, and no entry builds a finale.
- The user asked for a lot that feels alive and for a neighborhood in playtest 6. D-155's
  walkers and D-156's street are the stage; this puts them to use at the moment that matters.

## Build

1. **Trigger.** A run that ends won in this browser. Use the street view's guards (the
   `onEvents` effect in `src/ui/board/Board.tsx`: the run was in progress and no longer is,
   and it isn't a debug run), plus the run's screen being `won`. The parts you see also need
   Reduce motion off, as the street view does. The fanfare doesn't.
2. **Fanfare and confetti.** One new sound id with a recipe in `src/ui/audio/kit.ts` on the
   samples already there (`tier-huge` and `topped-out` are the models), played as the view
   starts to pull back, clear of the milestone chord. A confetti burst at the front door:
   `frontDoor(state)` in `src/ui/fx/moments.ts` gives the doormat.
3. **The crowd's plan.** A pure module beside `src/ui/board/life.ts`, tested in Node as
   `life.test.ts` is. From the run's seed, the verdict and the lot it returns each visitor's
   sprite, the end of the street they come from, where on the sidewalk they stop, and their
   delay. Picks come from the seed's hash (`seedSalt`, `tileHash`), as the crows' do.
   - Turnout follows the verdict's place in `CONTENT.balance.verdicts` (five bands, from
     Fixer-Upper to Dream Home): 1, 3, 5, 7 and 10 visitors to start with. The numbers go in
     `feel.ts`.
   - Visitors are the four walkers already cut (`life-walker-1` to `-4`), which face east and
     are mirrored to go west.
   - Stops are spread along the sidewalk, centered on the front door's column, and no two
     share a spot.
4. **Walking in and stopping.** `Drive` in `src/ui/fx/Drive.tsx` only crosses a span over and
   over. Add a one-way walk: the same stepped, transform-only CSS animation, ending at the
   visitor's stop and holding there on a standing frame. Visitors use the sidewalk's two lanes
   (`LANES.walkWest` and `LANES.walkEast` in `life.ts`).
5. **Cars at the kerb.** One to three of the cars already cut, parked in the lane by the
   sidewalk (`LANES.nearCar`). Each lane holds one regular so that no two overlap, so pause
   that lane's passing car while cars are parked in it.
6. **Hearts.** The existing `hearts` particle preset, over the top two or three earners of
   the last tally (`pilePieces()` in `src/ui/fx/ladder.ts`).
7. **Timing.** All of it plays inside the street view's window (`FEEL.streetView`: 1.2 s out,
   1.7 s held, 0.95 s back). If a win needs a longer hold, give it its own number in
   `feel.ts`. Keep the click, key and wheel hurry. The crowd stays where it stopped once the
   view comes back, until the next run starts.

## Leave out

- Anyone leaving the sidewalk: no walk to the door and no visitors in the rooms. The walkers
  have east and west frames only, and nothing in the game finds a path.
- A moving van, household characters, dusk (S12), an eighth polaroid, a sign or balloons.
- A new beat in front of the pull-back. This dresses the beat that already plays.
- Any name on screen. If one is ever needed, it can't start with "Open house": the Open House
  Party tool has that name, and D-137 dropped "Open house weekend" for the clash.

## Where it lives

- `src/ui/board/Board.tsx`: the street view's trigger and the pull-back.
- `src/ui/board/camera.ts`: the `streetView` signal and `streetViewScale`.
- `src/ui/board/LifeLayer.tsx`, `life.ts`, `life.css`: the walkers, the cars and their lanes.
- `src/ui/fx/Drive.tsx`: `FxSprite` and the stepping pattern.
- `src/ui/board/NeighborsLayer.tsx`: `streetFor`, the plots beside the lot.
- `src/ui/fx/feel.ts`: `streetView`, and the `hearts` and confetti presets.
- `src/ui/audio/kit.ts` and `audio.ts`: the recipe and the sound id.
- `src/ui/screens/EndPhotos.tsx`: the photos already wait for the street view to end.

## Watch for

- At 1440×900 at 2× the kerb is below the view at the default zoom (a known gap in D-155).
  That is why this plays during the pull-back. Once the view comes back the crowd may be out
  of sight, which is fine.
- `LifeLayer` draws nothing with Reduce motion on, and the street view is off then too. So
  with Reduce motion on, nothing of this is drawn; let the fanfare still play.
- The life layer's animations pause while the board is marked covered (`life.css`). Check
  that the end screen doesn't mark it covered.
- A fenced front yard or a house far up the lot makes no difference, since nobody leaves the
  sidewalk.

## Done when

- [ ] A won run that ends in the browser plays the fanfare, the confetti, a crowd sized by
      the verdict that walks in and stops in front of the house, parked cars and hearts over
      the top earners, all within the pull-back, and a click hurries it.
- [ ] A lost run, a debug run and a run loaded already over behave as today. With Reduce
      motion on, a win plays the fanfare and draws nothing new.
- [ ] The crowd's plan is pure and tested: the same run gives the same crowd, the turnout
      follows the verdict, and no two visitors share a spot.
- [ ] Nothing under `src/rules` or `src/content` changed.
- [ ] The counts and timings are in `feel.ts`.

## How to check

See "End-of-run moments need a run that ends in the browser" in the [README](README.md).
Win one run at each of two verdicts and compare the crowds. Look at all four window sizes
during the pull-back, and ask the user to listen to the fanfare, as D-154's sounds were
picked by ear.

## Decision log

A new entry, with dated notes on:

- D-156: the look down the street gains a win-only crowd.
- D-155: walkers that stop, and a lane's regular pausing for parked cars.
- D-124: a win-only fanfare outside the week's celebration tiers.

## If it lands

Visitors who walk up to the door (north and south walk cuts and a path), S19's scored
visitor, and S10 to S12.
