# S25 · Pieces that pay off

| | |
|---|---|
| Size | M, three to four days with the sim trial |
| Kind | Content, a glossary line, and a painter change. The content hash changes |
| Branch | `phase/pieces-pay-off` |
| Needs first | Nothing. It can go alongside S24; each measures its own effect |

## Story

The pieces people rarely place start paying where you can see it. One Sapling card plants up
to three saplings, and its card says what a Tree gives. The Garage earns part of its keep
before the drive reaches it. The Fire Pit warms any Social room beside it. The Playroom stops
costing the Bedrooms it's meant to sit beside. The Hot Tub counts a Pool or a Fire Pit as
well as a Patio.

## Why

From the 2026-11-20 review of rarely used goods
(https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X, 1,000 greedy runs):

- Played from the hand: the Sapling 8% of the times it was offered (4.1 offers a run), the
  Fire Pit 9%, the Driveway 11%, the Garage 12%. The average piece card is played 26% of the
  time. The Playroom and the Pool reach the hand only with the Architect (3% each) and were
  bought 6% and 4% of the times they were on a shelf; the Hot Tub 8%.
- The user doesn't think they've ever placed a Sapling. It earns the least of any placed
  piece: 200 Wow a copy, where a Lawn earns 1,929. Its card says "Becomes a Tree after 4
  weeks" but not what a Tree gives: Bedrooms +1 a Tree, Birdhouses +1, a view for Patios and
  Living Rooms, a Treehouse can only go up against one, and Country Living pays for each; a
  Pool loses 2.
- A placed Garage earns nothing in 63% of its weeks, and runs end holding the Drive-In set 9%
  of the time: the Garage waits for the drive and the drive starts at the street.
- The Playroom pays +2 for each Bedroom beside it, but it's Loud (a Bedroom loses 2) and its
  aura costs each Quiet room beside it 2 more, so every pairing nets −2. The Nursery is Quiet
  too.
- The Fire Pit's +50% reaches only a Patio, which the bot builds about once a run.

## Build

In `src/content/pieces.ts`, unless it says otherwise:

1. **Sapling.** A pack, as the Fence and the Driveway are (D-106):
   `pack: { maxTiles: 3, shapes: [['#'], ['##'], ['###']] }`. It stays one piece earning +1 a
   week, and at its transform every tile becomes a Tree (the transform in `src/rules/run.ts`
   already turns each cell of `piece.shape`). Add a glossary term for the Tree (`glossary()`
   in `src/rules/text.ts`, built from the content where it can be) and link it from the
   Sapling's transform line, so a tip says what a Tree does. Inspect's line for a Tree
   (`src/ui/hud/Inspect.tsx`) can share its words.
2. **Garage.** Drop its `requires`. Keep +2 steady always, and put +3, the garage sales and the
   workshop (`SHED(3)`) each under a `conditional` whose `when` is
   `{ touching: { any: [{ feature: 'street' }, { piece: 'driveway' }] } }`. Reached by the
   drive, it earns what it does today.
3. **Fire Pit.** Its aura matches `{ tag: 'Social' }` (a Patio, a Hot Tub, a Living Room) at
   +50%. If the trial shows a Fire Pit beside every Living Room, try +25% and report both.
4. **Playroom.** Drop its aura on Quiet rooms; it stays Loud. Run a second arm with +3 a
   Bedroom, and report both.
5. **Hot Tub.** Its neighbor line matches `{ piece: ['patio', 'pool', 'firePit'] }`.
6. **The painters.** A Sapling pack draws a sapling on each of its tiles, on the board and
   everywhere the board's painters draw (the ghost, the hand and shop cards, the photos).
7. **Tests:** a three-tile Sapling becomes three Trees (`packs.test.ts`); a Garage off the
   drive earns 2 and one on it what it did; a Fire Pit beside a Living Room; a Playroom beside
   a Bedroom; a Hot Tub beside a Pool; the cards' text.
8. **The sim:** a paired-seed trial, 600 runs an arm on `check-*`: each piece's pick rate from
   the hand, Wow a copy and zero weeks, the Drive-In held at the end, and wins. Report it;
   don't change the targets here.

## Leave out

- **The Doghouse.** Its requirement drives D-179's wake-up (the dog on its lead until the
  fence closes, `src/ui/board/wake-up.ts`), so partial earnings would need a new kind of
  requirement. Revisit only if the user asks.
- The Patio and the Sunroom, which the review rated borderline.
- The draw weights (S29) and D-094's Sapling wave (Parked).

## Where it lives

- `src/content/pieces.ts`: `sapling`, `garage`, `firePit`, `playroom`, `hotTub`.
- `src/rules/run.ts` (the transform), `src/rules/text.ts` (the glossary, the transform line).
- `src/ui/hud/Inspect.tsx` (the Tree's line), and the yard painter that draws the Sapling.

## Watch for

- The content hash changes, so runs in progress drop on merge.
- The board's unmet look (D-179) no longer shows on a Garage off the drive. Its card's
  conditional line says what it's waiting for; check that it reads well.
- D-189's house report flags unreached Garages; keep that line meaning what it says.
- A tidy yard: Saplings never break it, and a three-tile pack is one piece.

## Done when

- [ ] One Sapling card can plant one to three tiles, and each becomes a Tree.
- [ ] The Sapling's card says what a Tree does.
- [ ] A Garage off the drive earns +2, and one the drive reaches earns as before.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

`?debug`: give a Sapling, a Garage, a Fire Pit, a Playroom and a Hot Tub, and place them.
Use a Fertilizer (two weeks on every timer) or play four weeks to see the Trees.

## Decision log

A new entry, with dated notes on:

- D-106: the Sapling joins the packs.
- D-140: the Garage earns part of its keep off the drive.
- D-145: the Fire Pit's aura.
- D-051: the Playroom and the Hot Tub, two of the shop's special pieces.
