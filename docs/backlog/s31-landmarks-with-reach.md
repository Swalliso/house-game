# S31 · Landmarks with reach

| | |
|---|---|
| Size | M, three to four days with the sim trial |
| Kind | Rules, content, UI and one sprite. The content hash changes |
| Branch | `phase/landmarks-with-reach` |
| Needs first | Nothing. It leaves S25's pieces alone (the Sapling, Garage, Fire Pit, Playroom and Hot Tub) |

## Story

A few pieces reach past their neighbors. A Pool livens up the Social pieces within 2 tiles of
it and keeps the Bedrooms around it awake; a Library quiets the rooms around it; a Henhouse
feeds the garden around it; a new Fountain brightens the yard around it. While you place one,
the board shades the square it reaches and marks the pieces it would change, so where it goes
is a plan you can see.

## Why

From the 2026-11-20 review of how pieces interact
(https://claude.ai/artifact/Egt1U8BQdXuqdacCpCueXE, the greedy bot on develop at c92de7b,
seeds `check-*`):

- Every piece effect that reads another piece reads one it touches or one a Hallway links. The
  Mudroom's fenced yard is the one exception. In 150 runs, 53% of placements changed no other
  piece's earnings, and other pieces got 24% of the points a placement added.
- A placed piece touches or links 3.4 other pieces on average, 9.5% of the house. Within 2
  tiles, counted as a square, it has 6.8 (18.9%); within 3, 10.6 (29.8%).
- The user wants the impact and range that Combolands' buildings have (`docs/research.md`):
  each building has a radius, and its range lights up while you place it.
- Rooms are 2 steps apart on average and 74% of room pairs are within 2 steps, so a reach
  counted through the house's rooms would be nearly house-wide. Tiles are the measure.

## Build

1. **The scope.** The aura effect (the `Effect` union in `src/rules/index.ts`) takes
   `scope: { within: 2 }` beside `'adjacent'` and `'region'`: every other piece with a cell
   within 2 tiles of one of the landmark's cells, counted as a square (diagonals too), rooms and
   yard alike. `validateContent` allows 1 to 3. This is a scope, not a new effect kind.
2. **The query.** A function in `src/rules/layout.ts` that lists the pieces within r tiles of a
   piece. Work it out once per layout and keep it there: the tally runs for every preview and
   every play the bot weighs.
3. **The tally.** `case 'aura'` in `src/rules/scoring.ts` takes its targets from the query when
   the scope is `within` (`regionTargets` is the model). The rest stays as it is: the targets'
   percentages and points add as other auras' do (D-036, D-037), and Soundproofing (`blocked`)
   shields a room from a landmark's penalty as it does from a neighbor's.
4. **The landmarks**, in `src/content/pieces.ts`:

   | Piece | Within 2 tiles | What else it keeps |
   |---|---|---|
   | Pool | Social pieces +25%; Bedrooms −1 | +12 every 3rd week, −2 a Tree, +1 in the back yard |
   | Library | Quiet rooms +1; Loud pieces −1 | +2 for each Quiet room it touches, up to 3 |
   | Henhouse | Green pieces +1, in place of its +1 for each Herb Garden or Flower Bed it touches | the eggs and the shed |
   | Fountain (new) | Outdoor or Pretty pieces +10% | +1 a week, and `FRONT_YARD` (+2 in the front yard, D-166) |

   The Fountain is a 1×1 yard piece, Wet and Pretty, at `drawWeight: 5` from Framing
   (`fromPhase: 2`), complexity 2. Its match is `{ any: [{ tag: 'Outdoor' }, { tag: 'Pretty' }] }`.
5. **The cards.** `effectText` in `src/rules/text.ts` (the aura case, beside its `region`
   branch): "Social pieces within 2 tiles earn +25%". `glossary()` gets a term for "within 2
   tiles", and the line links to it.
6. **The estimate.** `src/rules/estimate.ts` counts only adjacent auras today. Add a new
   landmark's aura on the matching pieces in its reach, and the auras of placed landmarks whose
   reach covers the new piece. Greedy exact-scores its best 12 plays, so the estimate only has
   to put a landmark's good spots on that list. If the trial shows it doesn't, add a hint
   beside `setHint` and `yardHint` (`sim/policies/greedy.ts`).
7. **The board.** While a landmark is picked, shade the tiles in its reach around the ghost in
   D-166's yard tint (`--side-tint-fill`, `TerrainLayer.tsx`), from a rules view beside
   `yardTiles` in `src/rules/run.ts`, so the UI never works out the reach. Mark the pieces whose
   earnings the preview changes (its lines for the other pieces). Inspect on a placed landmark
   shades its square.
8. **Art.** A Fountain from the LimeZu packs if they have one (cut on the main checkout, where
   `art-source/` is), or else our own drawing in `src/ui/art/drawings.ts`. Records in
   `assets/licenses.json` and `CREDITS.md`.
9. **Tests:** a Pool 2 tiles from a Patio gives it +25%, and one 3 tiles away doesn't; a
   Bedroom 2 tiles from a Pool loses 1, and Soundproofing shields it; the preview equals the
   tally; the query on an L-shaped piece; the cards' text.
10. **The sim:** a paired-seed trial, 600 runs an arm on `check-*`: each landmark's pick rate
    from the hand, Wow a copy and zero weeks; other pieces' share of the points a placement
    adds (24% today); and wins. Report it; don't change the targets here.

## Leave out

- A reach that reads, where a piece earns for what's within 2 tiles of it. Only auras reach
  for now.
- Different radii per piece (1 for small pieces, 3 for the rarest, as in Combolands). Try 2
  everywhere first.
- Reach through the house's rooms, views at range (D-166's follow-up, which changes D-035), and
  chains (D-094, Parked).
- The Playroom, Hot Tub and Fire Pit as landmarks, until S25 has been played.
- Dealing the special pieces in the hand. That's S32.

## Where it lives

- `src/rules/index.ts` (`Effect`), `src/rules/layout.ts`, `src/rules/scoring.ts`
  (`case 'aura'`, `regionTargets`), `src/rules/estimate.ts`, `src/rules/text.ts`
  (`effectText`, `glossary`), `src/rules/selectors.ts` (`effectRegions`, if the new scope needs
  a case), `src/rules/run.ts` (the view).
- `src/content/pieces.ts` (`pool`, `library`, `henhouse`, a new `fountain`),
  `src/content/index.ts` (`validateContent`).
- `src/ui/board/Board.tsx` (D-166's shading hook), `src/ui/board/TerrainLayer.tsx`,
  `src/ui/hud/Inspect.tsx`, and the yard painter for the Fountain.

## Watch for

- The content hash changes, so runs in progress drop on merge.
- Speed: work out each piece's reach once per layout, not once per aura per tally.
- A big garden could make the Henhouse pay a lot. If the trial shows it, try 1 tile for the
  Henhouse and report both.
- A Bedroom touching a Pool already loses 2 for its Loud neighbor, and the reach adds −1.
  Check that the preview's lines read clearly when both apply.
- The painters are shared: the Fountain shows on the board, the ghost, the hand and shop cards,
  and the photos.
- Under Reduce motion nothing changes: the shading doesn't move.

## Done when

- [ ] The four landmarks pay what's within 2 tiles, in the tally and the preview alike.
- [ ] Picking one shades its reach around the ghost and marks the pieces it would change.
- [ ] Their cards say "within 2 tiles", and the glossary explains it.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

`?debug`: give a Patio, a Bedroom and a Pool. Place the Patio and the Bedroom 3 tiles apart,
then pick the Pool and move it between them: the shaded square follows the ghost, and the
Patio and the Bedroom are marked as they come into reach. Then try a Library beside a Home
Office and a Garage, a Henhouse in a garden, and a Fountain in the front yard.

## Decision log

A new entry, with dated notes on:

- D-035: adjacency stays touching; a landmark's reach is a scope of its own, as the Mudroom's
  fenced yard is.
- D-036 and D-037: auras with reach add in the same single pass, and their percentages add.
- D-051: the Pool, Library and Henhouse, three of the shop's special pieces.
- D-166: the board's shading, now for a landmark's reach as well as a yard.
- D-020: a new aura scope rather than a new effect kind.
