# S33 · Categories, not names

| | |
|---|---|
| Size | S, a day or two with the sim trial |
| Kind | Content. The content hash changes |
| Branch | `phase/categories-not-names` |
| Needs first | Nothing. It can go beside S31 and S32; each measures its own effect |

## Story

Three pieces read a kind of piece instead of one name. A Patio pays beside any Social room. A
Dining Room lifts any Social piece it opens onto, a Patio included. A Doghouse likes anything
green beside it. More of the house counts for each other, and a landmark's square (S31) is
worth planning around.

## Why

From the 2026-11-20 review of how pieces interact
(https://claude.ai/artifact/Egt1U8BQdXuqdacCpCueXE):

- Of the 36 effect lines that read other pieces, 15 name specific pieces, 7 read a tag, 7 a
  room property and 7 a lot feature.
- 7 of the 12 tags (Social, Wet, Outdoor, Green, Pretty, Dark, House) have no piece that reads
  them. Clients, change orders and blueprints read tags (D-020); pieces mostly read names.
- Combolands' buildings name categories, so a new building fits plans already on the board
  (`docs/research.md`).

## Build

In `src/content/pieces.ts`:

1. **Patio.** Its +2 neighbor line matches Social rooms,
   `{ all: [{ tag: 'Social' }, { property: 'room' }] }` (the Kitchen, L-Kitchen, Dining Room
   and Living Room), in place of the Living Room and the Kitchen by name.
2. **Dining Room.** Its +50% aura matches `{ tag: 'Social' }`: the Kitchens and Living Rooms
   as before, and now a Patio, a Hot Tub or a Fire Pit it touches.
3. **Doghouse.** Its +1 neighbor line matches `{ tag: 'Green' }` (a Lawn, a Sapling, a Flower
   Bed, a Herb Garden or a Greenhouse) in place of the Lawn. Its requirement and D-179's
   wake-up don't change.
4. **Tests:** a Patio beside a Dining Room earns +2; a Dining Room gives a Patio it touches
   +50%; a Doghouse beside a Flower Bed earns +1; the cards' text.
5. **The sim:** a paired-seed trial, 600 runs an arm on `check-*`: the three pieces' pick
   rates from the hand, Wow a copy and zero weeks; the Backyard and the Dog Run held at the
   end; and wins. If one change moves wins by more than the noise, run an arm with that change
   alone and report both. Don't change the targets here.

## Leave out

- The Henhouse: S31 gives it a reach over Green pieces.
- The lines S25 changes: the Fire Pit's aura (Social there already) and the Hot Tub's.
- The pairs that are a piece's point: the Driveway and its Garage, the Bathroom and its
  Bedroom, the Kitchen and its Dining Room or Herb Garden.
- The Lawn's and the Flower Bed's lines for their own kind, which make the clusters people
  build.
- A reader for Wet, Dark or House. That's a new piece's job.

## Where it lives

- `src/content/pieces.ts`: `patio`, `diningRoom`, `doghouse`.
- `src/rules/text.ts`: the cards' lines come from the selectors (`selectorText`), so check how
  they read.

## Watch for

- The content hash changes, so runs in progress drop on merge.
- The yard sets still ask for their named members: the Backyard is a Living Room, a Patio and
  a Lawn, and the Dog Run a Doghouse, a Lawn and a Fence (D-164).
- A Patio beside a Dining Room and a Living Room now gets +50% on top of its two +2s. Watch
  the Patio's Wow a copy in the trial.
- S25 points the Fire Pit's aura at Social pieces too. If both land, a Patio between a Fire Pit
  and a Dining Room takes both; name it in the log.

## Done when

- [ ] The Patio, the Dining Room and the Doghouse read their tags, and their cards say so.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

`?debug`: give a Patio, a Dining Room, a Fence and a Doghouse. Put the Patio against the Dining
Room, and the Doghouse in a fenced yard beside a Flower Bed; the preview shows each line.

## Decision log

A new entry, with dated notes on:

- D-020: pieces read tags more, as clients and blueprints already do.
- D-164: the yard sets still name their members.
- D-179: the Doghouse's requirement and wake-up are unchanged.
