# S05 · The Doghouse wakes up

| | |
|---|---|
| Size | M, about two days |
| Kind | UI and our own drawings: no rules or content change, and the content hash stays |
| Branch | `phase/doghouse-wakes-up` |
| Needs first | Nothing |
| Shares files with | S02, S04, S07 and S09: build one at a time |

## Story

A Doghouse outside a fenced yard shows a dog sitting on its lead beside the kennel. Close the
fence and the dog is let loose: it hops between two spots in its cell, and the moment the
fence closes gets a wobble and a short bark.

## Why

- The Doghouse "can be built anywhere, but earns only inside a fenced yard" (the comment on
  it in `src/content/pieces.ts`). That is the requirement newcomers miss, and today only a ⚠
  badge and its tip say so.
- The Barkers bring a Doghouse in week 1 (D-160), so every Barkers run shows the state.
- It explains a rule with a picture, which is the direction the user chose over more text.

## Build

1. **The state.** `yardModel(house, model)` in `src/ui/art/yard.ts` gets the house, not the
   scores. Pass it the uids whose requirement isn't met. The board already has them: each
   piece's `unmet` text in the current tally is what `LabelsLayer` in `HouseLayers.tsx`
   reads for the ⚠ (the rules set it with `unmetRequirement` in `src/rules/scoring.ts`).
   Don't work the fenced yard out in the UI.
2. **Two drawings** in `src/ui/art/drawings.ts`, as text grids in LimeZu's palette: a dog
   sitting with a lead to the kennel, and a loose dog in two frames or two spots. LimeZu has
   no dog (D-111). The style references are the `own-doghouse` drawing in that file and the
   sleeping dog's cushion in Nana's Room. Check whether `assets/licenses.json` and
   `CREDITS.md` name our own drawings one by one, and add these if they do.
3. **Awake.** The loose dog hops between two spots inside the Doghouse's own cell, stepped
   in whole art pixels. With Reduce motion on, it stands still in the loose pose.
4. **The wake-up.** The rules send no event when a requirement becomes met. Detect a uid
   going from unmet to met in the UI between house changes, the way `HouseLayers.tsx` keeps
   the car's last spot, and play the piece's wobble and the bark. It must not fire on a load,
   on a new run, or for a Doghouse placed straight into a fenced yard, which is simply awake.
5. **The bark.** A ZzFX recipe (`src/ui/audio/zzfx.ts`) or a kit recipe on existing samples.
   No audio file. Its timing goes in `feel.ts`.
6. **The shared painters.**
   - The ghost shows the state the Doghouse would land in: `preview()` already reports
     `unmet` for the new piece.
   - Hand and shop cards show the loose dog.
   - The photo painter passes the same unmet set, so a photo shows the dog as it was.

## Leave out

- The Bathroom and the Henhouse. Neither has a requirement, so an "off" look would teach a
  rule that doesn't exist. D-162 settled that a piece earning nothing without a requirement
  is a plain piece.
- The Treehouse (it can't be built without a Tree) and off looks for the Patio, the Hot Tub
  and the Fire Pit.
- A dog that runs laps round the yard. It would need a path among the yard's props and its
  own place in their drawing order.
- Taking the ⚠ away. It stays.

## Where it lives

- `src/content/pieces.ts`: the Doghouse and its `requires` effect. Read only.
- `src/rules/index.ts`: `PieceScore.unmet`. Read only.
- `src/ui/art/yard.ts`: `yardModel` and the `doghouse` painter that stands `own-doghouse`.
- `src/ui/art/drawings.ts`: our own drawings.
- `src/ui/board/HouseLayers.tsx`: `LabelsLayer`, and `useCarSlide` as the model for
  remembering a last state.
- `src/ui/board/piece-fx.ts`: the wobble.
- Tests: `yard.test.ts`, the label layout's tests (labels keep off a prop's height), and a
  new test for the wake-up's detection.

## Watch for

- D-100 says the canvases redraw only when the house changes. That still holds: a fenced
  yard closes only when a Fence is placed, which is a house change.
- A dog on a lead must not read as a different piece or as a bug at 1×. Look at it small.

## Done when

- [ ] A Doghouse outside a fenced yard shows the dog on its lead, in the ghost too.
- [ ] Closing the fence swaps it for the loose dog, with one wobble and one bark.
- [ ] Loading a run with a fenced Doghouse plays no wake-up.
- [ ] Reduce motion shows the right dog, standing still.
- [ ] The palette test passes for the new drawings.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

Start with `?client=barkers`, place the Doghouse on open grass, then close a yard round it
with the Fence from Your goods. Look at 1× and 2×, and reload to check nothing replays.

## Decision log

A new entry, with a dated note on D-100: a yard piece's picture can depend on whether its
requirement is met.

## If it lands

The Garage's moment. It already draws shut with its boxes when nothing reaches it, and with
an open door and the car when a Driveway or the street does (D-140). What is missing is the
car sliding in with the existing tween and a wobble.
