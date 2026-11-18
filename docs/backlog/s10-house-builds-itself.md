# S10 · The house builds itself

| | |
|---|---|
| Size | M, two to three days |
| Kind | UI only: no rules or content change, and the content hash stays |
| Branch | `phase/house-builds-itself` |
| Needs first | S01 played by the user. Build at most one of S10, S11 and S12 at a time |

## Story

On the end screen, after the look down the street, the house rebuilds itself on the board
build by build in about five seconds, with the place sounds rising in pitch. Then the
polaroids deal in as they do now.

## Why

- The end screen's strip already reads as a time-lapse of one spot (D-136). This plays it.
- It gives the end of a run a moment of its own, for a win or a loss, with no text.
- Everything it needs exists: the run's action log, a replay through the rules, and a painter
  that turns any state into a picture.

## A cheaper first test

A Play button in the photo viewer that steps through the milestone shots already in memory,
about two a second, is an hour or two of work in `src/ui/screens/EndPhotos.tsx`. If the user
hasn't seen that yet, build it first and ask whether watching the house grow is worth more.

## Build

1. **The steps.** In `src/ui/screens/photos.ts`, add a sibling of `milestoneShots(setup,
   actions)` that replays the log with `rules.newRun` and `rules.apply` and keeps the state
   after every action that changes the house: its events include `placed`, `moved`,
   `demolished`, `transformed` or `extended`, or it installs a fixture. Keep it pure,
   memoized for the run, and quiet when an action no longer applies, as `milestoneShots` is.
   Test it beside `photos.test.ts`.
2. **The picture.** A canvas over the board, painted one step at a time by `paintPhoto` in
   `photo-paint.ts` (about 14 ms a frame at photo size). Either paint through
   `photoFrame(house)` and hide the live house layers while it plays, or paint the whole lot.
   Line the canvas up with the board at the camera's whole-pixel scale (`cameraScale`).
3. **Playback.** Plain cuts between builds, about 120 ms each, capped at about 5 s in all:
   with more builds than fit, shorten the step. Play `place-room` or `place-yard` for each
   build through `audio.play`'s delay, with the pitch climbing the tally's ladder.
4. **Sequence.** After the street view ends and before the photos deal. `EndPhotos` waits on
   `busy` and on `streetView` today; add this to what it waits on. Once per run, as the deal
   is (`dealtFor`). A click or a key skips it. It is off with Reduce motion, for a debug run
   and for a run loaded already over, as the street view is.
5. **Numbers.** A new `FEEL.timelapse` block.

## Leave out

- Saving it as a clip. Video softens pixel art and differs by browser, a GIF encoder is a few
  hundred lines to write, and an itch.io frame may refuse the download.
- Tweens (a wobble per piece, walls sliding), a burst for a win, and polaroids that drop as
  their milestone passes.
- Replays in the Portfolio. D-139 stores no run codes.

## Where it lives

- `src/ui/screens/photos.ts`: `milestoneShots` and `photoFrame`.
- `src/ui/screens/photo-paint.ts`: `paintPhoto`, which never mounts board components.
- `src/ui/screens/EndPhotos.tsx`: `EndPhotos`, `Strip` and `dealtFor`.
- `src/ui/store.ts`: `log`, the run's actions, kept for a finished run.
- `src/ui/board/camera.ts`: `cameraScale` and `streetView`.
- `src/ui/audio/audio.ts`: `play` and the ladder.

## Watch for

- This adds about five seconds to an end sequence that already has a four-second street view
  and the photo deal. The user dislikes length for its own sake, so the skip has to be
  instant and the total has to hold at five seconds for a long run.
- If the canvas is framed on the house, yard pieces outside the frame still show on the live
  board beneath. Hide the live layers or paint the whole lot.

## Done when

- [ ] After the street view, the house rebuilds on the board in about 5 s with rising place
      sounds, and then the photos deal.
- [ ] A click skips it at once, and it plays once per run.
- [ ] Reduce motion, a debug run and a run loaded already over don't play it.
- [ ] The step function is pure and tested, including a log that stops applying part way.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

See "End-of-run moments need a run that ends in the browser" in the [README](README.md).
Finish one short lost run and one long won run and time both.

## Decision log

A new entry, with dated notes on D-136 (the deal waits for one more beat) and D-156 (the end
of a run's sequence gains a step).

## If it lands

A silent GIF saved from the photo viewer, with an encoder of our own (nothing GPL).
