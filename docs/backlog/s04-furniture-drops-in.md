# S04 · Furniture drops in

| | |
|---|---|
| Size | S, a day or a little more |
| Kind | UI only: no rules or content change, and the content hash stays |
| Branch | `phase/furniture-drops-in` |
| Needs first | Nothing |
| Shares files with | S02, S05, S07 and S09: build one at a time |

## Story

When you place a room, its furniture drops in one piece after another, with a puff of dust
and a couple of pitched thocks, where today it lands as one block.

## Why

- Placing a piece is the most frequent action in the game, juice is core (D-059), and the
  furniture is the art the user likes most (D-100, D-173).
- No playtest has said that placing feels flat, so this is polish on a beat that works. That
  is why the scope is small and the rule is that nothing gets slower.

## Build

1. **Per-item drops.** Today `settle(uid)` in `src/ui/board/piece-fx.ts` moves the piece's
   whole items container and its overhang container as one (up 6% and squashed, over
   `FEEL.placeMs`, 220 ms), and flashes the floor for 440 ms. Extend the module's register
   and play so it can address a piece's items by index, and drop each one in turn. A tall
   item is two parts, a bottom in the items layer and a top in the overhang layer, keyed by
   the same index in `HouseLayers.tsx`; the two must move together.
2. **The stagger.** A fixed budget of 300 to 350 ms for the whole room, with each item's
   delay the smaller of 60 ms and the budget divided by the item count. A room has from one
   to more than eight items, and more once it is extended. The numbers go in a new block in
   `feel.ts` beside `placeMs`.
3. **Sound and dust.** Two or three thocks from the takes already in the kit, pitched up a
   step each, through `audio.play`'s delay and rate. One dust puff with `boardBurst('dust')`.
4. **Don't hold input longer.** The director's `placed` case still waits `FEEL.placeMs` and
   no more. The tail of the drop plays while the player moves on.
5. **Skipping and speed.** Keep the animations' handles so a click finishes them, and match
   their playback rate to the tally speed setting. Today's settle is fixed-length and isn't
   cut by a skip.
6. **Reduce motion.** As today: no settle at all.
7. **Scope.** Rooms only. Yard pieces, packs and an extended room keep the beats they have.

## Leave out

- A floor that sweeps in and walls that rise. Floors and walls are painted on whole-house
  canvases, which the header of `piece-fx.ts` says never move, and a new room also changes
  its neighbors' walls and doorways. That is most of the cost and where glitches would show.
- Props at the kerb for each phase (lumber, stakes, cones). The roof was the first board
  visual tied to a phase, and D-147 removed it.
- Raising `placeMs`. With free goods and crew cards, several builds can land in one week.

## Where it lives

- `src/ui/board/piece-fx.ts` and `piece-fx.test.ts`, which pins the settle's timing and will
  need rewriting for the new shape.
- `src/ui/board/HouseLayers.tsx`: each furniture item is its own element, with tall items
  split across the items and overhang layers.
- `src/ui/fx/director.ts`: the `placed` case, and the `extended` case just below it as a
  model of a fuller beat (two thocks, a chime, dust, a wobble).
- `src/ui/fx/feel.ts`: `placeMs` and the `dust` particle preset.

## Watch for

- If a newer action is waiting, the director already hurries the current beat. The drop has
  to respect that, so a quick second build doesn't play over a half-finished first one.
- An item's two halves drifting apart by a frame reads as a tear. Start both from one call.

## Done when

- [ ] A placed room's items drop in turn inside the budget, with dust and pitched thocks.
- [ ] The player can act again as soon as they can today.
- [ ] A click finishes the drop, the tally speed setting scales it, and Reduce motion shows
      none of it.
- [ ] `piece-fx.test.ts` covers the stagger's cap and the two halves moving together.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

Place a 2×2 Bathroom and a large Living Room and compare. Then play a week with two free
builds from Your goods one straight after the other, at each tally speed.

## Decision log

A new entry. It changes no earlier decision.

## If it lands

The wall reveal, only if the user says the drop feels good and asks for more.
