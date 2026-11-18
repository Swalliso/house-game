# S12 · Dusk when you win

| | |
|---|---|
| Size | Stage 1 is S, half a day. Stage 2 is M, about two days |
| Kind | UI only: no rules or content change, and the content hash stays |
| Branch | `phase/dusk-when-you-win` |
| Needs first | S01 played by the user, and a mockup the user likes (stage 1) |

## Story

When the last target is met, evening falls on the yard and the street while the rooms stay
bright. Each room gets a warm pool of light and a spill from its windows, one room after
another in the order you built them, with a rising plink. The doorbell rings once, and the
look down the street begins.

## Why

- Winning would look different from clearing any other milestone.
- `docs/implementation-plan.md` lists "dusk with glowing windows" as an art idea that was
  never built.
- It is visible change on the board with no text.

## Ask the user first

The user took the roof out (D-147) because it didn't look good, and D-154 turned down
time-of-day light during play for darkening the board. A tint over this pixel art could read
as muddy the same way. So stage 1 is a still picture, and the user decides from it. If the
answer is no, stop there and note it in the log.

## Build

**Stage 1: one still.**

1. Paint a finished house at dusk with `paintPhoto` and a first version of the dusk painter
   below. Save it as `docs/playtests/dusk-mockup.png` beside the same house by day, and show
   the user both.

**Stage 2: the beat, after a yes.**

2. **The painter.** A pure `paintDusk(model, yard, litUids)` beside
   `src/ui/art/house-paint.ts`. It tints the yard and the street in pixel steps, never a
   smooth gradient (`terrain/shade.ts` and the glow painters are the patterns). Rooms keep
   full brightness and gain a warm pool on the floor and a spill outside each window. The
   house model lists every `WindowPane` with its room.
3. **The reach.** The tint has to cover what the pull-back shows: the garden, the road and
   the neighbors past the lot. Otherwise the street view frames a dusk lot in daylight.
4. **The beat.** About 2.5 s between the last tally and the street view. Rooms light in
   build order, each with the Comfort plink pitched to the track's key (`kit.ts`), and then
   the `doorbell` once. A click skips it. With Reduce motion on, show the dusk picture with
   no sequence. Respect the Flashing setting. Numbers in `feel.ts`.
5. **The sun's patches.** D-120's sunny patches are painted into the floors. Decide from the
   mockup whether sun and lamplight can share a floor or the floors need repainting without
   the sun for dusk.
6. **When it lifts.** The dusk lifts as the view comes back from the street, so the finished
   house is inspected by day. D-147's reason for removing the roof was that the end screen
   should show the furnished rooms clearly.

## Leave out

- A moving van, and smoke: there has been no roof or chimney since D-147.
- Lit windows on earlier houses. The street's plots are flat stored pictures.
- A dusk polaroid. D-136's photos share one painter and no tint.
- Any time of day during play.

## Where it lives

- `src/ui/art/house-paint.ts`: the Chandelier's glow as the pattern for stepped light.
- `src/ui/board/house-model.ts`: `WindowPane` and `windows`.
- `src/ui/board/terrain/shade.ts`: painted shade.
- `src/ui/board/Board.tsx` and `camera.ts`: the street view this goes in front of.
- `src/ui/fx/fx.css`: `.tier-wash`, a screen-wide wash that already handles the Flashing and
  Reduce motion settings.
- `src/ui/screens/photo-paint.ts`: `paintPhoto` takes options, which is where the mockup's
  dusk variant can hook in.

## Watch for

- The view is a roofless cutaway. "Lit from inside" reads as warm floors, not as glowing
  windows on a facade. Judge the mockup with that in mind.
- A house with windowless rooms (a Closet, a Hallway, the Garage) needs a rule: a floor glow
  only, or nothing.

## Done when

- [ ] Stage 1: the user has seen the day and dusk stills and said yes or no.
- [ ] Stage 2: a won run plays the dusk, lights the rooms in build order with plinks, rings
      the doorbell and hands over to the street view; a click skips it.
- [ ] Reduce motion, the Flashing setting, a debug run, a loaded run and a lost run are each
      handled as the Build list says.
- [ ] The painter is pure and tested: stepped tones, the palette rule, the build order.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

See "End-of-run moments need a run that ends in the browser" in the [README](README.md).
Look at the pull-back on each biome, since the tint sits over four different palettes.

## Decision log

A new entry, with dated notes on D-156 (a beat before the look down the street), D-125 (the
Flashing and Reduce motion lists gain a moment) and D-120 (how the sun's patches are
treated at dusk).
