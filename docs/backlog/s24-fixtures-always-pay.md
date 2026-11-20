# S24 · Fixtures that always pay

| | |
|---|---|
| Size | S, a day or two and a sim trial |
| Kind | Content, and one painter check. The content hash changes |
| Branch | `phase/fixtures-always-pay` |
| Needs first | Nothing |

## Story

Every fixture earns something wherever it fits. Soundproofing and the Bay Window get a +25%
floor, Garden Lights earn out back as well as in front, the Kitchen Island's dead line is
swapped for one that pays, and the Pergola fits a Lawn as well as a Patio.

## Why

From the 2026-11-20 review of rarely used goods
(https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X, 400 runs logging each week's first hand):

- Installed from the hand: Soundproofing 9%, the Kitchen Island 11%, Garden Lights 15%, the
  Bay Window 16%. The average fixture goes in 25% of the time, the Fireplace 57%.
- Bought from a shelf: the Kitchen Island 0 of 184, Soundproofing 2%, the Pergola 2%, Garden
  Lights 10%, the Bay Window 14%.
- They share one cause: the line that pays works in a few houses, and anywhere else the card
  is blank. D-082 gave the Skylight, the Blackout Curtains and the Bunk Beds +25% for exactly
  this reason.
- The Kitchen Island counts as a Dining Room only for the pieces touching it, never for a set
  or a checklist line (D-081). The only such reader is another Kitchen's "+2 per Dining
  Room", and since D-165 a house holds one Kitchen, so the line never pays. It gains the least
  of any fixture the week it goes in (55 Wow).
- Where Soundproofing applies it pays well (374 Wow the week it goes in, second only to the
  Chandelier), so the floor is only for the other rooms.

## Build

In `src/content/fixtures.ts`:

1. **Soundproofing:** add `{ kind: 'earn', target: HOST, pct: 25 }` after its
   `blockPenalties`.
2. **Bay Window:** add `{ kind: 'earn', target: HOST, pct: 25 }`.
3. **Garden Lights:** `earn` +25% on its host anywhere, and the front-yard line at +25%, so it
   stays +50% in front.
4. **Kitchen Island:** replace `countsAs diningRoom` with
   `{ kind: 'grantEffect', target: HOST, effect: { kind: 'neighbor', match: { piece:
   ['diningRoom', 'herbGarden'] }, amount: 2 } }`, so its Kitchen's +2 for each Dining Room or
   Herb Garden beside it becomes +4. Its `earn` stays first (D-148's card order).
5. **Pergola:** `fits: { piece: ['patio', 'lawn'] }`. A Lawn is 2×2, as the Patio is, so the
   Pergola's art should stand over it as it is; check the painter.
6. **Tests:** each new line (`fixtures.test.ts`, `modifiers.test.ts`), the Kitchen Island's
   doubled line on a Kitchen beside a Dining Room and an Herb Garden, the Pergola on a Lawn,
   and each card's text (`text.test.ts`).
7. **The sim:** a paired-seed trial, 600 runs an arm on `check-*`: installs per run and the
   from-hand rate of the five, their shop buy rates, and wins. Report it; don't change the
   targets here.

## Leave out

- Bunk Beds (S30), the Chandelier, the Sprinkler and the Fireplace.
- New fixtures (S28).
- A Pergola over a Hot Tub: it's 1×1 and would need new art.

## Where it lives

- `src/content/fixtures.ts`; the card lines in `src/rules/text.ts`.
- The Pergola's painter: search `pergola` under `src/ui/art` and `src/ui/board`.

## Watch for

- The content hash changes, so runs in progress drop on merge.
- D-107's value lines read the new numbers. Check that the Kitchen Island's line names what
  it doubles.
- The painters are shared: a Pergola on a Lawn shows on the board, the ghost, the hand and
  shop cards and the photos.

## Done when

- [ ] Each of the five pays something in any room or yard piece it fits.
- [ ] The Kitchen Island's card says what it adds, and it pays beside a Dining Room or an Herb
      Garden.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

`?debug`: give each fixture, then install Soundproofing and the Bay Window in a plain
Bedroom, Garden Lights and the Pergola on a back-yard Lawn, and the Kitchen Island in a
Kitchen beside a Dining Room. Check the preview, then the tally.

## Decision log

A new entry, with dated notes on:

- D-082: the +25% floor reaches Soundproofing, the Bay Window and Garden Lights.
- D-050: what the fixtures do.
- D-081: the Kitchen Island no longer counts as a Dining Room.
- D-172: where the Pergola fits.
- D-107: the value lines read the new numbers.
