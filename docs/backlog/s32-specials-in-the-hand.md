# S32 · Specials in the hand

| | |
|---|---|
| Size | S, a day or two with the sim trial, for each of its two stages |
| Kind | Content and a little rules (a `special` flag). The content hash changes |
| Branch | `phase/specials-in-the-hand` |
| Needs first | Stage 1: nothing. Stage 2: S31 and S25, both played |

## Story

The shop's special pieces turn up in the hand now and then from Framing on, and stay on the
shop's shelf too. Some weeks the hand holds a Henhouse or a Library; later a Pool, a Playroom
or a Hot Tub, once each of those pays its way.

## Why

From the 2026-11-20 review of how pieces interact
(https://claude.ai/artifact/Egt1U8BQdXuqdacCpCueXE) and its trial: the same 300 seeds
(`check-0` to `check-299`) on develop at c92de7b, the greedy bot, the six special pieces at
draw weight 5 from Framing and still in the shop.

- The user asked whether the pieces that only show up in the shop could come to the hand, to
  freshen runs up and add some depth.
- Dealt as they are, the specials turned up 6.7 more times a run but were played only 0.6 more
  times. Wins went from 46.0% to 42.0% (40 seeds won only without them, 28 only with them:
  within noise, but the wrong way), and the median final Wow from 69,545 to 64,141.
- Extra plays per extra offer in the hand: the Henhouse 26%, the Library 16%, the Mudroom 7%,
  the Hot Tub 5%, the Pool 2% and the Playroom 2%. The Sunroom, which D-120 moved from the
  shop to the draw, is played from 19% of its offers. A weak card in the hand takes a better
  card's place.
- A run already sees 23 of the 25 dealt piece types in its hand. With the specials it saw 27,
  but built with one more type, 19 against 18: variety alone doesn't add depth, pieces worth
  placing somewhere in particular do. S31 gives the Pool that reason, and S25 the Playroom and
  the Hot Tub.
- The Mudroom pays only for a Pet piece (a Doghouse) in a fenced yard, and the Barkers' runs
  already deal it (+20).

## Build

1. **The flag.** `special?: true` on `PieceDef` (`src/rules/index.ts`), set on the Playroom,
   Library, Mudroom, Pool, Hot Tub and Henhouse. The places that find the special pieces by
   `drawWeight === 0` read the flag instead, so a special piece stays one when it's dealt:
   - the shelf's special pieces (`stockGoods`) and the Showroom crate (`crateOptions`), both in
     `src/rules/shop.ts`, and the crate filter in `sim/policies/shop.ts`;
   - the Catalog's draw (`opts.special` in `drawWeights`, `src/rules/draw.ts`);
   - the chaos bot's list of special pieces (`sim/policies/chaos.ts`).
2. **Stage 1: the Henhouse and the Library**, at `drawWeight: 5` from Framing
   (`fromPhase: 2`), the way D-145 deals the Fire Pit and the Porch late. A Library card at its
   one-a-house limit draws at half weight and extends or renovates the Library there, as D-104,
   D-165 and D-168 already have it.
3. **Stage 2, once S31 and S25 have been played:** the Pool, the Playroom and the Hot Tub the
   same way, each only if a trial shows it played from at least 15% of its offers in the hand.
   One that falls short stays shop-only, and the log entry says why.
4. **The Mudroom stays out of the draw**, with the Barkers' +20 as it is.
5. **The modifiers' text.** The `drawWeight` modifier's line in `src/rules/text.ts` says a
   piece will "show up in the weekly draw" only when every piece it names is at weight 0.
   Once the Library is dealt, Vladislav's +20 (`src/content/clients.ts`) reads "more often",
   and the Architect's +5 on four specials (`src/content/crews.ts`) names some dealt pieces and
   some not. Make both lines say what they do.
6. **Tests:** a dealt special still stocks on the shelf and in the Showroom; the draw deals
   the Henhouse from Framing and not before; the Catalog's draw is unchanged; a Library at its
   limit draws at half weight; the modifiers' text.
7. **The sim:** a paired-seed trial, 600 runs an arm on `check-*`, for each stage: each
   special's offers, pick rate from the hand and Wow a copy; specials built a run; piece types
   offered and built a run; and wins. Report it; don't change the targets here.

## Leave out

- Taking the specials out of the shop, as D-120 did with the Sunroom. The user wants them in
  the hand as well.
- Blueprints, tools, upgrades and crates in the hand. They're the reason to visit the shop, and
  the hand is the week's one piece. Every fixture but the Chandelier is already dealt.
- A rework of the Mudroom.

## Where it lives

- `src/rules/index.ts` (`PieceDef`), `src/content/pieces.ts` (the six specials).
- `src/rules/draw.ts` (`drawWeights`, `drawableTypes`), `src/rules/shop.ts` (`stockGoods`,
  `crateOptions`), `src/rules/text.ts` (the `drawWeight` modifier's line).
- `src/content/crews.ts` (the Architect), `src/content/clients.ts` (Vladislav, the Barkers).
- `sim/policies/shop.ts`, `sim/policies/chaos.ts`.

## Watch for

- The content hash changes, so runs in progress drop on merge.
- A dealt special can be struck like any dealt type (D-076, D-157): `drawableTypes` lists it
  once it has a weight.
- D-055's complexity ramp applies to a dealt special as to any dealt piece.
- If S31 hasn't merged yet, the Henhouse is dealt with its old touching line. That's fine for
  stage 1; the trial says which version it measured.

## Done when

- [ ] From Framing, the Henhouse and the Library turn up in the hand, and all six specials
      still stock in the shop and the Showroom.
- [ ] Stage 2 deals only the specials that cleared 15%.
- [ ] Each stage's paired-seed result is in the log entry, and the targets are untouched.

## How to check

`?debug`: add score through the first two milestones to reach Framing, then reroll a few
hands and watch for a Henhouse or a Library. Force the shop to see them on the shelf too.

## Decision log

A new entry, with dated notes on:

- D-051: special pieces can be dealt as well as bought.
- D-120 and D-145: the Sunroom's, Birdhouse's and Fire Pit's move to the draw, but these stay
  in the shop.
- D-055: the draw's complexity ramp covers them.
- D-104 and D-165: a special at its one-a-house limit draws at half weight.
