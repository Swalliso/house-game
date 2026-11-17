# S06 · Rain for Rainy season

| | |
|---|---|
| Size | S, a day or two |
| Kind | UI only: no rules or content change, and the content hash stays |
| Branch | `phase/rainy-season-rain` |
| Needs first | Nothing |

## Story

Pick the Rainy season change order and it rains on your lot for the whole phase. Each Patio
that earns nothing because of it shows a puddle.

## Why

- D-155's Considered list names "weather for the change orders" among its later batches "for
  after this playtest", and no later entry picks it up.
- A phase effect today is a card on the sheet, a line on the checklist and a label in the
  breakdown. Rain makes it something you see for four weeks.
- A puddle on a Patio that earns nothing explains the penalty with a picture.

## Build

1. **A weather layer.** `src/ui/board/WeatherLayer.tsx`, a pure `weather.ts` and
   `weather.css`, beside `LifeLayer` and with its habits: transform and opacity only, whole
   art pixel steps, timings in `feel.ts`, nothing by chance, no pointer, and paused while
   the board is covered.
2. **When.** While `RunState.timedEffects` holds an effect whose `source` is `rainySeason`.
   The table from a change order's id to its look lives in `src/ui`.
3. **Rain.** Stepped streaks clipped to the lot, light enough that labels, the ghost and the
   cards stay easy to read. Our own drawing, in the palette's tones.
4. **Puddles.** A small puddle mark of our own on each Patio the effect has zeroed. Find
   those from the current tally: the piece's breakdown line already names the cause ("Earns
   nothing (Rainy season)", through the line's `from`). Draw the mark on a layer over the
   piece's cells, not as a filter on the piece (D-100).
5. **Start and end.** The rain starts when the change-order sheet closes and stops when the
   phase's milestone resolves.
6. **Reduce motion.** No falling rain. The puddles are still drawn, because they carry
   information.

## Leave out

- A preview while hovering the offer. The sheet's scrim covers the board and pauses its
  animations (D-110, and `.covered` in `life.css`), and keyboard picks have no hover.
- Tints on the ground, and looks for Cold snap, Heat wave and Eternal night.
- Bats, a looping rain sound (the game has no ambient sound bus) and a change to the music.
- Weather in the milestone photos.

## Where it lives

- `src/content/change-orders.ts`: `rainySeason` (Green pieces earn more; Patios earn
  nothing). Read only.
- `src/rules/index.ts`: `TimedEffect` and `RunState.timedEffects`. `activeChangeOrders` on
  the `Rules` interface in `src/rules/run.ts`. Read only.
- `src/ui/board/LifeLayer.tsx`, `life.ts`, `life.css`: the conventions to follow.
- `src/ui/board/layers.ts`: the layer order.
- `src/ui/board/Board.tsx`: where the board is marked covered.

## Watch for

- The four biome looks (meadow, lakeside, autumn, dry). Check the rain on each.
- The last week's orange cue (D-154) and the sun's marker (D-120) must still read under it.
- Four weeks is a long time to look at an effect. If it tires the eye, thin it out.

## Done when

- [ ] With Rainy season running, rain falls over the lot and every zeroed Patio has a puddle.
- [ ] It starts as the sheet closes and ends at the milestone.
- [ ] Reduce motion shows puddles and no rain.
- [ ] A test in the style of `life.test.ts` covers which order maps to which look, the pause
      when covered and the puddles' pieces.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

Open `?debug`, build a Patio, and force the Rainy season change order (a debug run is fine
here). Check each biome with a few seeds, at 1× and 2×.

## Decision log

A new entry, with a dated note on D-155: the weather it listed as a later batch, as a layer
of its own.

## If it lands

Cold snap next: a frost tint on the yard and a glow on rooms with a Fireplace.
