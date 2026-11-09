# The weekly draw: a brainstorm and a proposal

**Date:** 2026-11-09. **Status:** a proposal only. Nothing in `src/` or `decisions.md` changed, and there's no PR. The draft decision is **D-121** (§10), numbered after the layout session's D-112–D-118 and the lot session's D-119–D-120; whoever merges renumbers.

**What you asked (playtest 4):** should the weekly draw split into two groups, the core rooms and the layout pieces that make the house look like a house? And how should the draw cope once there are many more buildings: weights, rerolls, or something else?

**How this was made:**
- The four candidates from the playtest-4 findings (§8), three variants and a bot that rerolls for rooms (§3.5), and stronger yard pieces (§6), built as draw modes and content data in a patched copy of the rules outside the repo.
- Greedy on held-out `check` seeds, paired with today's draw on the same seeds: 400 runs an arm with the General Contractor (each client in turn), 200 for the controls and the stronger yard, 100 for the reroll bot and the other two crews.
- A paper replay of your playtest-4 run (seed `zcndxm`): what each candidate would have offered each week, at your house as you built it (Appendix A).
- The right column measured on /dev/ at 1920×1080 and 1280×720, at week 19 of your run.

---

## In short

- **Yes, split the draw: Rooms 2 + Layout 2.** It's your split with one Rooms card fewer. When the checklist needs a room, the week holds one it needs 66% of the time (today 52%), or 39% from phase 3 (today 27%), and every week shows two layout cards.
- **Your Rooms 3 + Layout 2 holds more needed rooms (72%, and 47% from phase 3) but shrinks the yard more.** Greedy builds 6.4 layout pieces a run instead of today's 10.7, and ends with a tidy yard in 53% of runs instead of 88%. Rooms 2 + Layout 2 keeps 8.4 and 68%.
- **Stronger yard pieces don't fix that.** Bigger flat numbers pull a player off the rooms, whose points grow with sets, checklist lines, and Renovations: greedy builds more yard and wins less. More yard needs pieces that grow with the house, in the balance pass.
- **Every split is a buff,** so the targets need a re-fit: scores ×1.16 for Rooms 2 + Layout 2, ×1.36 for 3 + 2. Do it once, with the layout session's changes.
- **Smaller pieces that go with it:** Fence and Driveway at weight 10; a swap for any card with no play instead of the free redraw (cards with no play fall from 4.2 a run to 0.3); a reroll that redraws one row of your choice; compact cards; and Your goods folding on short windows.
- **The yard crew:** the Landscaper draws a third Layout card. It builds more yard with it at the same win rate, while stronger pieces cost it the most.
- **Not now:** a standing Layout card (in your run it kept a Long Hallway for 4 weeks and a Garage for 4), and packs (a way to grow the rows later; greedy never picks Hallways or The drive).

---

## 1. What the draw has to do

Today, from 400 greedy runs (held-out seeds, the General Contractor, the first hand of each week):

| Phase | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| A hand holds a room | 97% | 79% | 71% | 65% | 65% | 63% | 61% |
| A hand holds a room the checklist still needs | 97% | 75% | 38% | 18% | 11% | 7% | 4% |
| Layout cards' share of offers | 35% | 44% | 53% | 58% | 57% | 59% | 60% |

This matches the findings' 600-run table within two points (the layout share here also counts the yard fixtures).

- Late in a run little is still needed, so the second row falls on its own. The fairer measure: **when the checklist still needs a room, the hand holds one it needs 52% of the time over a run, and 27% from phase 3.**
- 30% of offers are the eight weak types. 4.2 cards a run have no play at all, and greedy rerolls 0.6 times a run.

So the draw has four jobs:
1. When the checklist needs a room, show one.
2. Show layout pieces every week, without weak ones crowding out the rooms.
3. Keep working when the content doubles.
4. Keep the reading light: 3.1 cards a week today.

## 2. Two rows: which card goes where

Three candidates split the cards in two. The rule: **a card goes in the row of where it's built.**
- **Rooms:** the 8 room cards (Bedroom, Bathroom, Kitchen, L-Kitchen, Dining Room, Living Room, Closet, Home Office), any special room a client or crew adds (Library, Mudroom, Playroom, Sunroom), and the room fixtures.
- **Layout:** the yard (Lawn, Sapling, Flower Bed, Herb Garden, Patio, Fence, Driveway, and the Pool, Hot Tub, and Fire Pit where added), the outbuildings, both Hallways, the Garage, and the three yard fixtures (Sprinkler, Pergola, Garden Lights).
- **The Garage is Layout:** it belongs to the drive and the street, and no checklist line asks for it. If the layout session makes it a detached outbuilding, it stays there. A Porch or Deck would be Layout too.
- **Weights inside a row don't change:** the piece's weight × D-055's ramp × the client's and crew's modifiers, at half weight while a type is at its limit (D-104).
- **Fence and Driveway drop from 20 to 10.** D-106 kept 20 because one pack replaced two or three cards, but the pack already does their work. In a two-card row at 20 they'd show more often than today; at 10, less.

How often a card shows from phase 4 on (a client with no pool changes, unless named):

| Each week, from phase 4 | Today: 3 from one pool | Layout row of 2, Fence and Driveway at 20 | Layout row of 2, at 10 | One Layout card, at 10 |
|---|---|---|---|---|
| Fence | 20% | 23% | 13% | 7% |
| Driveway | 20% | 23% | 13% | 7% |
| any other Layout card (weight 10) | 10–12% | 11–13% | 13–15% | 7% |
| The Hendersons' Fence (+100%) | 33% | 39% | 24% | 12% |

| Each week, from phase 4 | Today | Rooms row of 3 | Rooms row of 2 |
|---|---|---|---|
| each room card | 10–12% | 25–26% | 17–18% |
| each room fixture | 5–6% | 13–14% | 8–9% |

**The Layout row is mostly weak cards.** From phase 4, the eight weak types are 55–61% of its weight (by client), against 30% of today's offers. A guaranteed Layout row is a guaranteed weak card unless the pieces get better (§6).

## 3. The candidates

Each candidate below has its rules, the decisions it amends, how replays stay exact, how greedy plays it, and what it would have done in your run. The sim results are together in §4, and the right column's sketches in §5.

### 3.1 Rooms 3 + Layout 2 (your idea)

**Rules**
- Each week draws two rows: Rooms (3 distinct cards) and Layout (2). You play one card from either row, or a reserve piece, or pass, as today.
- The free redraw redraws both rows when nothing in either fits.
- A reroll redraws both rows, as the sim ran it. §8 recommends a reroll of one row, your choice (§3.4).
- Weekend Crew's next play can come from either row.
- The Bigger Truck (+1 card) adds a Rooms card (§9, question 5).
- The strike floor (D-084: 8 drawable types) holds per row: at least 5 Rooms types and 4 Layout types.

**Amends:** D-036 (the hand of 3), D-043 (distinct, weighted, per row), D-050 (fixtures go in their host's row), D-084 (the floor), D-106 (Fence and Driveway at 10), D-083 (Weekend Crew), D-039 (the keys), D-098 and D-110 (the right column, §5).

**Replays:** each row has its own stream, `draw/<phase>/<slot>/<n>/rooms` and `draw/<phase>/<slot>/<n>/layout`. Drawing one never shifts the other.

**Greedy:** no change. Its plays list covers all five cards, and it plays the best. More cards are more for it to weigh, so the benchmark gate (one run on the densest lot under 1 s) needs a re-check.

**Your run:**
- In the 11 weeks your checklist still needed a room, the Rooms row held one in 10. Your hands held one in 8.
- The Layout row held the week's best card in 4 of 27 weeks: a Patio or Flower Bed (+4, week 3), a Patio (+95, week 18), a Fence that closes a yard (+155, week 24), and a Patio (+81, week 26).
- 5 of its 135 cards had no play.

### 3.2 Rooms 3 + one standing Layout card

**Rules**
- A Rooms row of 3 each week. Beside it stands one Layout card that stays until you play it.
- A new one comes the week after you play it, and at each milestone. One with nowhere to go at the start of a week is swapped free.
- A reroll redraws the Rooms row only.

**Amends:** D-036, D-043, D-050, D-106 and D-039 as in 3.1, and a new piece of run state (the standing card).

**Replays:** the Rooms row as in 3.1. The standing card comes from `draw/<phase>/<slot>/<n>/standing` in the week it's drawn. Whether it's still standing follows from the plays in the action log, so it replays.

**Greedy:** no change: the standing card is a fourth hand card.

**Your run:** a good standing card gets played and replaced, and a weak one stays, so the slot spends most of the run holding what you don't want:

| Weeks | Standing card | Best Wow it offered | Played? |
|---|---|---|---|
| 1–3 | Treehouse | 3–4 | week 3 |
| 4 | Patio | 6 | no (new milestone) |
| 5–8 | Flower Bed | 14–21 | no: a room was better every week |
| 9–12 | Long Hallway | 0 | no |
| 13–15 | Doghouse | 0–33 | no |
| 17–20 | Garage | −65 to −111 | no |
| 21–24 | Sapling | 35–38 | no |
| 25 | Fence | +246 (closes a yard) | yes |
| 26–28 | Sapling, then another | 62–63 | weeks 26 and 28 |

### 3.3 Packs that join your draw

**Rules**
- The run starts with a base pool:
  - the 8 room cards, Lawn, Patio, and Flower Bed;
  - the client's pool pieces: the Hendersons' and the Barkers' Fence, the Barkers' Doghouse and Mudroom, the Count's Library, Dale's Home Office;
  - the crew's: the Architect's special rooms;
  - fixtures from phase 2, as today.
- After each milestone, on the shop screen, pick 1 of 2 themed packs. Its cards join your draw for the rest of the run, at full weight. Six picks in a run.
- A hand is 3 cards from one pool, as today.
- The sim's nine packs. Each card adds weight 10, and "+" means more of a card you already draw:

| Pack | Cards |
|---|---|
| Hallways | Hallway, Long Hallway |
| The drive | Driveway, Garage |
| Kitchen garden | Herb Garden, Greenhouse |
| Woodland | Sapling, Treehouse |
| Fenced yard | Fence, Doghouse |
| Big family | +Bedroom, +Bathroom |
| Entertaining | +Dining Room, +Patio |
| Living space | +Living Room, +Home Office |
| Garden beds | +Flower Bed, +Lawn |

**Amends:** D-043 (the pool grows with your picks), D-055 (the ramp stays for the base pool; a pack's cards come at full weight), D-051 (a pick on the shop screen), D-084 (a strike can name a pack's card), D-045 (another choice at shop 1), D-109 (a crew could start with a pack), D-039 (the keys).

**Replays:** the offer comes from `packs/<milestone>`, and the pick is an action in the log. Hands keep `draw/<phase>/<slot>/<n>`: like a strike, a pick changes the pool, not the stream.

**Greedy:** a new choice. It takes the pack whose cards have the better plays now (each card's best preview, weighted by the pack's weights). That's as short-sighted as greedy itself.

**Your run:** greedy's picks from your house would have been Entertaining (over Fenced yard), Garden beds (over The drive), Woodland (over Hallways), Big family (over The drive), Kitchen garden (over Fenced yard), and Fenced yard (over Hallways). It never takes Hallways or The drive: nothing in them pays at the moment of the pick.

### 3.4 Targeted rerolls, and a swap for a card with no play

**Rules**
- A reroll asks "Rooms or Layout?" and draws three cards from that row.
- At the start of a week, and after a reroll, each card with no play at all (no spot, no host, no Renovation) is swapped once for another card from its row. This replaces the free redraw.
- Otherwise it's today's hand of 3.

**Amends:** D-036 and D-070 (the free redraw), D-039 (the keys).

**Replays:** `draw/<phase>/<slot>/<n>/<row>` for a targeted reroll, and `draw/<phase>/<slot>/<n>/swap<i>` for a swap.

**Greedy:** it rerolls only when nothing beats a pass (today's rule). It aims at Rooms when the checklist needs a room, Layout when the tidy yard is unmet, and Rooms otherwise. Greedy hardly rerolls, so a second bot, **eager**, also rerolls once a week when the checklist needs a room and the hand has none it needs. That's closer to how you used rerolls.

**Your run:**
- Two cards would have been swapped: week 5's Kitchen Island, and week 7's Pergola. The Pergola's swap was Garden Lights, which had nowhere to go either, so a swap should try until it finds a card with a play (D-121 says up to 3 tries).
- Your rerolls in weeks 1, 5, and 7 all wanted rooms. A Rooms reroll would have offered rooms the checklist needed each time, and in week 7 the same Dining Room (+183) that your blind reroll found.

### 3.5 Variants the data suggested

- **Rooms 2 + Layout 2:** four cards, the rules otherwise as in 3.1. A row of 2 is the first two cards of a row of 3 from the same stream, so in your run its Rooms row is the first two Rooms cards in Appendix A: it held a room your checklist needed in 9 of the 11 weeks that needed one (the row of 3: 10; your hands: 8).
- **Rooms 2 + Layout 1:** today's three cards, two from Rooms and one from Layout.
- **A control:** five cards from one pool (today's draw with a hand of 5), to tell "more cards" from "two rows".
- **A reroll bot:** greedy rerolls only when nothing beats a pass. The second bot also rerolls once a week when the checklist needs a room the hand lacks, as you did in weeks 1, 5, and 7. It plays today's draw and the targeted rerolls (3.4).

## 4. The A/B

The General Contractor on held-out `check` seeds, each arm paired with today's draw on the same seeds (± is one standard error of the difference). The needed-room column counts only weeks when the checklist still needs a room. Packs read about 0.9 more cards a week than the table shows: each pick shows two packs of two cards.

| Arm | Runs | Cards read a week | Wins | Δ wins vs today | Score × | Cards with no play, a run | Hands with a room | …a needed room, when one is needed (all / from phase 3) | Weak share of offers | Layout plays a run | Rooms placed a run | Tidy yard at the end |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Today: 3 from one pool | 400 | 3.1 | 46% | — | 1.00 | 4.2 | 72% | 52% / 27% | 30% | 10.7 | 9.5 | 88% |
| Control: 5 from one pool | 200 | 5.0 | 70% | +26 ± 4 | 1.14 | 8.1 | 87% | 60% / 35% | 31% | 10.1 | 10.4 | 86% |
| 1. Rooms 3 + Layout 2, Fence and Driveway at 20 | 400 | 5.0 | 86% | +40 ± 3 | 1.35 | 6.6 | 97% | 73% / 49% | 22% | 6.3 | 11.8 | 54% |
| 1. Rooms 3 + Layout 2 | 400 | 5.0 | 85% | +39 ± 3 | 1.36 | 7.2 | 97% | 72% / 47% | 20% | 6.4 | 11.8 | 53% |
| **Rooms 2 + Layout 2** | 200 | 4.0 | 68% | +23 ± 4 | 1.16 | 6.1 | 90% | 66% / 39% | 24% | 8.4 | 10.7 | 68% |
| Rooms 2 + Layout 1 | 400 | 3.1 | 71% | +24 ± 3 | 1.22 | 3.7 | 89% | 63% / 35% | 16% | 6.0 | 11.8 | 47% |
| 2. Rooms 3 + a standing Layout card | 400 | 3.4 | 88% | +42 ± 3 | 1.47 | 1.0 | 96% | 73% / 47% | 14% | 3.4 | 12.7 | 16% |
| 3. Packs | 400 | 3.1 | 68% | +21 ± 3 | 1.15 | 3.2 | 84% | 62% / 36% | 10% | 8.7 | 11.1 | 66% |
| 4. Targeted rerolls + swaps | 400 | 3.2 | 49% | +2 ± 2 | 1.00 | 0.3 | 69% | 52% / 27% | 30% | 10.8 | 9.5 | 88% |
| Today, with the reroll bot | 100 | 3.7 | 60% | +10 ± 5 | 1.01 | 4.4 | 72% | 57% / 27% | 30% | 10.2 | 10.2 | 91% |
| 4. Targeted rerolls + swaps, with the reroll bot (Δ vs the row above) | 100 | 3.7 | 73% | +13 ± 5 | 1.04 | 0.4 | 69% | 64% / 29% | 31% | 9.6 | 11.0 | 86% |

What it says:
- **The rows do it, not just the extra cards.** Five cards from one pool hold a needed room 60% of the time when one is needed (35% from phase 3). The same five cards in two rows hold one 72% of the time (47%), and the weak share of offers falls from 31% to 20%.
- **Every draw here is a buff, so every one needs a target re-fit.** The wins column says how much a draw adds, not how good it is. The score ratio says how far the targets would move: about +16% for Rooms 2 + Layout 2, +36% for Rooms 3 + Layout 2.
- **A Rooms card buys needed rooms; a Layout card buys yard.** From 2 + 1 to 2 + 2 the yard grows (6.0 to 8.4 layout plays a run, a tidy yard in 47% to 68% of runs). From 2 + 2 to 3 + 2 the needed rooms grow (66% to 72%, and 39% to 47% from phase 3), and the yard shrinks back (6.4 plays, 53%).
- **The yard shrinks under every split.** Today greedy builds the yard as filler: half of each hand is layout cards, often with no good room. Guarantee a room and it builds the room. Rooms 2 + Layout 2 keeps the most yard of the splits; §6 has the rest.
- **The standing card** wins the most because greedy treats it as a spare it plays only when it's good. The slot keeps the weak card, and the yard nearly vanishes (3.4 layout plays, a tidy yard in 16% of runs).
- **Packs** are a middling buff with the fewest weak offers (10%), because greedy never picks the weak packs: 0.05 Hallways, 0.15 Driveways, and 0.01 Garages a run, against 0.23, 0.97, and 0.03 today. They don't do much for needed rooms (62% / 36%).
- **Swaps work.** Cards with no play fall from 4.2 a run to 0.3, for 0.15 more cards read a week, and wins barely move.
- **Targeted rerolls matter to a player who rerolls.** Greedy rerolls 0.5 times a run. The reroll bot rerolls 4–6 times a run and wins 10 points more with blind rerolls, and 13 more again when it can ask for Rooms (100 seeds each, so ± 5).
- **Fence and Driveway at 20 or 10** make no difference to wins (86% and 85%) or to fenced yards (46% and 43% of runs; today 42%). At 10 the Layout row shows each in 13% of weeks instead of 23%.

## 5. The right column

**Measured on /dev/** (your run at week 19, the pixel font):

| | 1920×1080 | 1280×720 |
|---|---|---|
| The right column | 403 × 982 px | 280 × 656 px |
| Your goods (reserve, supplies, blueprints, company) | 310 px | 348 px |
| Today's three cards | 240, 200, and 332 px tall, with pictures | 228, 188, and 164 px, without |
| In view without scrolling | the first two cards and the top of the third | the top of the first card |

Today's hand already doesn't fit at 1280×720 and only just at 1920×1080. Any candidate with more than three cards needs two things, and today's three would gain from them too:
- **Compact cards:** one block each, with the picture as a thumbnail, the name, the kind and tag chips, ★ for a room the checklist needs, and the first effect line. Inspect shows the full text on hover, as it does now.
- **On short windows, Your goods folds** into one strip of slot icons (about 40 px) that opens on a click, like D-109's checklist fold.

**Rooms 3 + Layout 2 at 1920×1080** (about 500 px free under Your goods):

```
┌ Your goods ─────────────────────────────┐
│ Reserve ▢ ▢      Supplies ▣ ▢ ▢         │  310 px, as today
│ Blueprints ▣ ▣ ▢ ▢     Company ▣        │
└─────────────────────────────────────────┘
┌ Pick a card ────────────────────────────┐
│ [⟳ Reroll 2]   [⚒ Demolish 1]           │  32
│ ROOMS ──────────────────────────────────│  16
│ ┌─────────────────────────────────────┐ │
│ │1 ▦▦ Bedroom          Room · Quiet  ★│ │  about 72 each: thumbnail,
│ │     +1 per Quiet neighbor (up to 3) │ │  name, chips, first line
│ └─────────────────────────────────────┘ │
│ │2 ▦  Bathroom         Room · Wet     │ │
│ │3 ✦  Fireplace        Fixture · Rare │ │
│ LAYOUT ─────────────────────────────────│  16
│ │4 ▦▦ Patio            Yard · Social  │ │
│ │5 ▬  Fence            Yard · 1–8 tiles│ │
│ [↻] [      Pass this week        ⏎ ]    │  76, sticky
└─────────────────────────────────────────┘
  five cards ≈ 400 px: fits
```

**Rooms 3 + Layout 2 at 1280×720** (Your goods folded; about 470 px free):

```
┌ Your goods ▸ ▣ ▣▣ ▣ ───────┐  40, opens on a click
┌ Pick a card ───────────────┐
│ [⟳ 2]  [⚒ 1]               │  32
│ ROOMS                      │
│ │1 Bedroom ★   Quiet  ▦▦ │ │  about 56 each:
│ │  +1 per Quiet neighbor │ │  name, chips, one line
│ │2 Bathroom    Wet    ▦  │ │
│ │3 Fireplace   Fixture   │ │
│ LAYOUT                     │
│ │4 Patio       Social ▦▦ │ │
│ │5 Fence       1–8 tiles │ │
│ [↻] [   Pass   ⏎ ]         │  72
└────────────────────────────┘
  five cards ≈ 320 px: fits
```

**Rooms 2 + Layout 2** (recommended): the same with one card fewer under ROOMS. Four cards take about 320 px at 1920×1080 and 260 px at 1280×720. The Landscaper's third Layout card brings it back to five.

**Rooms 3 + a standing card:** the same as above, with one card under LAYOUT, marked "Stays until played · since week 9".

**Rooms 2 + Layout 1:** today's three cards with a thin LAYOUT divider above the third. At 1280×720 it still needs the compact cards and the fold.

**Packs:** the weekly column doesn't change. The pick is a shelf at the top of the shop: two pack cards side by side, each with its cards' thumbnails and names, and "Pick one: its cards join your draw". Your goods gets a row of small pack badges.

**Targeted rerolls:** the cards don't change. Reroll splits into two buttons, `⟳ Rooms` and `⟳ Layout`, sharing one count. A swapped card says so in its alert line: "New: the Garage had nowhere to go".

## 6. The yard, and the yard crew's lever

**Why the yard shrinks.** A yard piece earns a few points a week: a Lawn 1, +1 per touching Lawn; a Sapling 1, until it becomes a Tree; a Flower Bed 1, +2 in the front yard and +1 per touching Flower Bed; a Fence +1 per tile it encloses, up to 6. A room earns dozens in its set, and it counts for checklist lines and Renovations. Today greedy builds the yard when the hand has no good room, which is often. Guarantee a room and it builds the room.

**Stronger yard pieces, two levels, as data in the sim:**
- *Stronger:* a Fence boosts what it encloses (yard pieces and outbuildings in its fenced yard earn +50%), and a Sapling earns 2, +1 per touching Sapling or Tree (up to 3): an orchard.
- *Stronger, and paying for the house:* also, a Lawn and a Flower Bed earn +1 per touching room (up to 2), as the Patio does.

**The yard crew's lever:** the Landscaper (yard pieces earn +50%; it starts with a Sapling and a Fence) lost the plan's yard draws in D-109, because extra yard cards crowded out the rooms the checklist needs. In their own row they can't, so the sim gives it a third Layout card.

The General Contractor on `check-0` to `check-199`, the other crews on `check-0` to `check-99`:

| Crew | Draw | Yard numbers | Runs | Wins | Δ wins vs the same crew today | Δ wins vs the General Contractor, same draw | Layout plays a run | Yard pieces at the end | Yard share of Wow | Tidy yard | A fenced yard |
|---|---|---|---|---|---|---|---|---|---|---|---|
| General Contractor | Today | today's | 200 | 45% | — | — | 10.7 | 10.3 | 23% | 89% | 43% |
| General Contractor | Today | stronger, paying for the house | 200 | 42% | −3 ± 3 | — | 11.7 | 11.4 | 28% | 86% | 42% |
| General Contractor | Rooms 2 + Layout 2 | today's | 200 | 68% | +23 ± 4 | — | 8.4 | 8.0 | 18% | 68% | 36% |
| General Contractor | Rooms 3 + Layout 2 | today's | 200 | 88% | +43 ± 4 | — | 6.4 | 6.2 | 13% | 52% | 43% |
| General Contractor | Rooms 3 + Layout 2 | stronger | 200 | 80% | +35 ± 5 | — | 7.7 | 7.5 | 15% | 53% | 42% |
| General Contractor | Rooms 3 + Layout 2 | stronger, paying for the house | 200 | 77% | +33 ± 5 | — | 8.3 | 8.2 | 18% | 64% | 45% |
| Landscaper | Today | today's | 100 | 42% | — | −8 ± 5 | 10.4 | 11.8 | 32% | 91% | 51% |
| Landscaper | Rooms 3 + Layout 2 | today's | 100 | 75% | +33 ± 6 | −13 ± 5 | 7.4 | 8.5 | 22% | 73% | 54% |
| Landscaper | Rooms 3 + Layout 3 | today's | 100 | 73% | +31 ± 6 | −15 ± 5 | 9.0 | 9.8 | 28% | 72% | 50% |
| Landscaper | Rooms 3 + Layout 2 | stronger | 100 | 60% | +18 ± 7 | −21 ± 6 | 9.1 | 10.7 | 28% | 70% | 49% |
| Architect | Today | today's | 100 | 51% | — | +1 ± 6 | 10.2 | 9.7 | 20% | 82% | 41% |
| Architect | Rooms 3 + Layout 2 | today's | 100 | 84% | +33 ± 6 | −4 ± 3 | 6.2 | 6.0 | 12% | 50% | 38% |

What it says:
- **Stronger yard pieces win back part of the yard, and cost wins.** Under Rooms 3 + Layout 2 both levels together take the yard from 6.4 to 8.3 layout plays and the tidy yard from 52% to 64% of runs, mostly with Saplings (0.24 to 1.86 a run). But greedy wins less: 88% falls to 77%, and with today's draw 45% to 42%. A yard piece's points come now and stay flat; a room's grow with its set, the checklist, and Renovations. Bigger flat numbers make the yard a trap for a player who takes the points in front of them.
- **Rooms 2 + Layout 2 gets the same yard with no change to the pieces:** 8.4 layout plays and a tidy yard in 68% of runs.
- **If you want more yard than that, it needs pieces that grow with the house,** not bigger numbers. Some shapes for the balance pass with the layout session: a Flower Bed's view counting for the rooms that see it; a garden set (Flower Bed, Herb Garden, Sapling); a checklist line for a planted or fenced yard; the layout session's Porch or Deck joining the yard to the rooms. Yard packs (one card plants up to 3 Flower Beds or Saplings, as the Fence pack lays its tiles) weren't simulated; they'd build the look faster, but they multiply flat points, so they'd risk the same trap.
- **The Landscaper falls further behind under rows:** −8 against the General Contractor today, −13 under Rooms 3 + Layout 2, because its +50% pays on a yard that shrinks. The Architect keeps up (−4): its special rooms land in the Rooms row, 1.5 a run instead of 1.0.
- **A third Layout card is the Landscaper's lever.** It doesn't change its wins (73% against 75%, ± 6), but it builds the crew's yard: 9.0 layout plays a run instead of 7.4. Stronger pieces cost it the most (60%): its +50% makes the flat points even more tempting.
- So the Landscaper should draw a third Layout card, and the re-fit should bring its win rate back into D-109's spread through its numbers (its +50%), not through stronger pieces for everyone. The crew arms ran on Rooms 3 + Layout 2; under the recommended 2 + 2 the Landscaper's draw would be Rooms 2 + Layout 3.

## 7. What depends on the layout session

The layout session (Hallways, "Extend a room", reach, the Garage and Loud, a Porch or Deck) hasn't written its proposal yet; its notes say it will say what a Layout row holds. What changes here:
- **A Hallway pack** (the findings' step 2) makes the two Hallway cards one. The Layout row loses a weak card's weight, which helps every candidate with a Layout row.
- **The Hallway's +2 per room along it** (step 1) moves the Hallway from weak to useful (greedy's Hallways went from 0.25 to 1.52 a run). Then a Layout row shows a useful card more often.
- **A detached Garage** stays in Layout. A Garage that joins the house could go either way; Layout is still the better fit, since no checklist line asks for it.
- **A Porch or Deck** joins Layout.
- **Extend a room** gives a spare room card somewhere to go, like Renovate. That raises the value of late room cards, so a Rooms row matters more late in a run, and the "needed room" measure undercounts it.
- **Reach through the house** doesn't touch the draw.

None of these changes the recommendation: they change which cards sit in the Layout row and how good they are, which is §6's question too.

## 8. Recommendation

**Split the draw into Rooms 2 + Layout 2, with swaps and a reroll for each row.** It's your split with one Rooms card fewer.

What to build, in order:
1. **Two rows,** Rooms 2 and Layout 2 (§2, §3.1), with Fence and Driveway at weight 10.
2. **Swaps instead of the free redraw:** a card with no spot, no host, and no Renovation is swapped for another from its row, up to 3 tries (§3.4).
3. **A reroll redraws one row, your choice** (`⟳ Rooms` or `⟳ Layout`), from one count.
4. **Compact cards, and Your goods folding on short windows** (§5). Today's three cards need them at 1280×720 anyway.
5. **The Landscaper draws a third Layout card** (Rooms 2 + Layout 3), rather than everyone getting stronger yard pieces (§6).
6. **One target re-fit** after this and the layout session's changes.

**Why Rooms 2 + Layout 2:**
- **It fixes most of what you hit.** When the checklist needs a room, the week holds one it needs 66% of the time (today 52%), and 39% from phase 3 (today 27%). In your run it would have held one in 9 of the 11 weeks that needed one, against your hands' 8. When it doesn't, a Rooms reroll digs where you need it.
- **It keeps the most yard of the splits:** 8.4 layout plays a run and a tidy yard in 68% of runs (today 10.7 and 88%; Rooms 3 + Layout 2, 6.4 and 53%). Every week shows two layout cards, so the yard is always on offer.
- **Four cards to read,** one more than today, and they fit at 1280×720 as compact cards.
- **The smallest re-fit of the splits:** scores ×1.16.
- **The rows scale.** When the content doubles, new yard pieces dilute only the Layout row, and new rooms only Rooms.

**Your Rooms 3 + Layout 2** is the better pick if rooms matter more to you than the yard: needed rooms 72% / 47%, one more card to read, a yard of 6.4 layout plays with a tidy yard in 53% of runs, and a bigger re-fit (×1.36). Stronger yard pieces don't win that yard back (§6).

**Not now:**
- **The standing card:** it keeps the card nobody wants (in your run, a Long Hallway for 4 weeks and a Garage for 4), and the yard nearly vanishes.
- **Packs:** worth keeping for when the content doubles, as a way to choose what joins each row. On their own they don't fix the missing rooms, and greedy never picks Hallways or The drive.
- **Stronger yard numbers** to make up for the rows (§6).

## 9. Questions for you

1. **Rooms 2 + Layout 2, or your Rooms 3 + Layout 2?** Or one pool with swaps and targeted rerolls only?
2. **How much yard do you want?** Under any split, a player chasing the score builds less yard than today. Is that fine, or should a yard pass (§6: pieces that grow with the house) come with the split?
3. **The Landscaper: a third Layout card,** with its numbers re-fit? It builds more yard with it (9.0 layout plays a run against 7.4) at the same win rate. Or leave its draw alone and let the re-fit bring it back?
4. **The order:** build the rows after the layout session's Hallway changes, with one target re-fit for both?
5. **Defaults I'd use unless you say otherwise:** Fence and Driveway at 10; swaps instead of the free redraw; a reroll redraws one row; the Bigger Truck adds a Rooms card; the Garage in Layout; Weekend Crew's next play from either row; packs parked; the standing card dropped.

## 10. D-121 draft

For `decisions.md`, with the build PR:

### D-121 · The weekly draw in two rows: Rooms and Layout
**Status:** Proposed · 2026-11-09 (the draw brainstorm after playtest 4: `docs/proposals/weekly-draw.md`). The numbers are placeholders until the re-fit.
**Decision:**
- **Two rows.** Each week draws a **Rooms** row of 2 distinct cards and a **Layout** row of 2. You play one card from either row, a reserve piece, or a Renovation, or pass, as today (D-036).
- **A card's row is where it's built.** Rooms: the room cards, the special rooms (Library, Mudroom, Playroom, Sunroom), and the room fixtures. Layout: the yard (with the Pool, Hot Tub, and Fire Pit where a client or crew adds them), the outbuildings, both Hallways, the Garage, and the yard fixtures (Sprinkler, Pergola, Garden Lights). Each piece and fixture names its row in its data.
- **Weights inside a row are today's:** the card's weight × D-055's ramp × the client's and crew's modifiers, at half weight while a type is at its limit (D-104). The Fence and Driveway packs draw at 10, not 20 (D-106).
- **Swaps replace the free redraw.** At the start of a week, and after a reroll, a card with no spot, no host, and no Renovation is swapped for another card from its row, up to 3 tries. Its alert line says what it replaced.
- **A reroll redraws one row,** the player's choice (`⟳ Rooms` or `⟳ Layout`), from one count.
- **Goods:** Weekend Crew's next play can come from either row (D-083). The Bigger Truck adds a Rooms card. The strike floor holds per row: at least 5 Rooms types and 4 Layout types stay drawable (D-084).
- **The Landscaper draws a third Layout card** (Rooms 2 + Layout 3): D-109's yard draws, which crowded out rooms in one pool and can't in their own row. Its +50% yard earnings are re-fit to D-109's spread.
- **Replays:** each row has its own stream, `draw/<phase>/<slot>/<n>/rooms` and `draw/<phase>/<slot>/<n>/layout`, and a swap draws from `draw/<phase>/<slot>/<n>/<row>/swap<i>`. Drawing one row never shifts the other (D-039).
- **The right column:** the rows under ROOMS and LAYOUT labels, as compact cards (a thumbnail, the name, chips, ★ for a room the checklist needs, the first effect line; Inspect has the rest). On a window under 800 px tall, Your goods folds into a strip of slot icons that opens on a click (D-098, D-110).
- **The sim:** greedy plays from both rows as one hand. Its reroll aims at Rooms when the checklist needs a room and at Layout when the tidy yard is unmet. The targets are re-fit once, after this and the layout session's changes (D-089's criteria).

**Why:** Playtest 4: hands lacked the rooms the checklist needed, and weak layout cards crowded them out. In 400 greedy runs, when the checklist needed a room the hand held one it needed 52% of the time (27% from phase 3). With two rows of 2: 66% (39%), with the most yard of any split (8.4 layout plays a run, against 10.7 today). Rows keep new content on one side from diluting the other. Swaps take the cards with no play from 4.2 a run to 0.3.
**Considered:** Rooms 3 + Layout 2 (more needed rooms, 72% / 47%, but five cards, a smaller yard at 6.4 layout plays, and a bigger re-fit); Rooms 2 + Layout 1 (today's three cards, with one mostly weak Layout card and the smallest yard); a standing Layout card (it keeps the card no one plays); packs picked after each milestone (parked as a way to grow each row later); targeted rerolls and swaps on today's hand (they fix the dead cards, not the missing rooms); stronger yard numbers (they turn yard picks into traps, §6).
**Changes:** D-036 and D-043 (Accepted): the hand is two rows of distinct cards. D-050 (Accepted): a fixture draws in its host's row. D-070: swaps replace the free redraw. D-083 and D-084 (Accepted): Weekend Crew and the strike floor. D-106 (Accepted): Fence and Driveway at 10. D-039 (Accepted): the stream keys. D-098 and D-110: the right column. D-109: the Landscaper's third Layout card.

---

## Appendix A: your run, week by week

Seed `zcndxm`, the Hendersons, the General Contractor. Each week shows the cards each candidate would have offered at your house as you built it, with greedy's best Wow for each card this week (its own shortlist and fence planner). ★ is a room the checklist still needed; ✗ is a card with no play. ‖ separates the rows, and ▶ marks a standing card that greedy would have played. The packs column uses greedy's picks (listed under the table). The last column shows today's hand after its swaps, then what a Rooms reroll would have drawn.

Greedy's numbers can miss a spot you found: in week 25 it rates the Home Office +30, and you found +97.

| Wk | Your first hand → what you played | 1. Rooms ‖ Layout | 2. Rooms ‖ standing card | 3. Packs | 4. After swaps · a Rooms reroll |
|---|---|---|---|---|---|
| 1 | ★Dining 0, ★Closet 1, ★Bath 0 → **Bed 6** (rerolled 2×) | ★Bed 6, ★Bath 0, ★Living 8 ‖ Patio 0, Lawn 2 | ★Bed 6, ★Bath 0, ★Living 8 ‖ Treehouse 3 | ★L-Kitchen 0, ★Living 8, ★Bath 0 | no swap · ★Bed 6, ★Living 8, ★Dining 0 |
| 2 | ★Bed 9, ★Dining 0, ★Bath 5 → **Bath 5** | ★Bed 9, ★Bath 5, ★L-Kitchen 2 ‖ Patio 3, Lawn 2 | ★Bed 9, ★Bath 5, ★L-Kitchen 2 ‖ Treehouse 3 | ★Bed 9, ★Dining 0, ★Bath 5 | no swap · ★Bed 9, ★Bath 5, ★L-Kitchen 2 |
| 3 | ★Living 12, ★Kitchen 3, ★Bed 39 → **Bed 39** | ★Dining 0, ★Kitchen 3, ★L-Kitchen 3 ‖ Patio 4, Flowers 4 | ★Dining 0, ★Kitchen 3, ★L-Kitchen 3 ‖ Treehouse 4 ▶ | ★Dining 0, ★Bath 4, ★Bed 39 | no swap · ★Kitchen 3, ★L-Kitchen 3, ★Bed 39 |
| 4 | ★L-Kitchen 13, ★Bed 12, ★Living 28 → **Living 18** | ★Living 28, ★Bath 13, ★Dining 6 ‖ Lawn 4, Drive 2 | ★Living 28, ★Bath 13, ★Dining 6 ‖ Patio 6 | ★Kitchen 13, ★Bed 12, ★Dining 6 | no swap · ★L-Kitchen 13, ★Living 28, ★Kitchen 13 |
| 5 | ★Bath 13, ★Closet 69, Island ✗ → **Kitchen 9** (rerolled 1×) | ★Bath 13, ★Kitchen 9, ★Closet 69 ‖ Flowers 15, Treehouse 10 | ★Bath 13, ★Kitchen 9, ★Closet 69 ‖ Flowers 15 | ★Bath 13, ★Dining 3, Bay Window 8 | ★Bath 13, ★Closet 69, ★Dining 3 (1 swapped) · ★Bed 11, ★Dining 3, Bay Window 8 |
| 6 | ★Bath 15, Treehouse 11, Bay Window 8 → **Treehouse 11** | Soundproof 0, Bay Window 8, ★Dining 177 ‖ Lawn 6, Hall 0 | Soundproof 0, Bay Window 8, ★Dining 177 ‖ Flowers 14 | ★Bath 15, Fence 0, Sprinkler ✗ | no swap · ★Living 33, Island 0, ★Dining 177 |
| 7 | Pergola ✗, ★Kitchen 11, Bay Window 8 → **Dining 179** (rerolled 1×) | ★Living 34, ★Bath 16, Fireplace 8 ‖ Patio 17, Long Hall 0 | ★Living 34, ★Bath 16, Fireplace 8 ‖ Flowers 14 | Pergola ✗, ★Kitchen 11, Sprinkler ✗ | Lights ✗, ★Kitchen 11, Bay Window 8 (1 swapped) · ★Bed 25, ★Closet 79, ★Dining 183 |
| 8 | Drive 9, Treehouse 17, Bath 17 → **Drive 4** | Bath 17, Dining 26, Closet 110 ‖ Lawn 9, Pergola ✗ | Bath 17, Dining 26, Closet 110 ‖ Flowers 21 | Patio 21, Fireplace 13, Bath 17 | no swap · Bath 17, Living 47, L-Kitchen 26 |
| 9 | Garage -14, Herbs 45, Long Hall 0 → **Nursery (reserve) 40** | Dining 30, ★Bed 19, Curtains 10 ‖ Flowers 25, Doghouse 0 | Dining 30, ★Bed 19, Curtains 10 ‖ Long Hall 0 | Living 55, Lawn 10, Dining 30 | no swap · Living 55, ★Bed 19, Bath 20 |
| 10 | Closet 139, Curtains 10, Soundproof 0 → **Closet 139** | Curtains 10, ★Bath 47, Closet 139 ‖ Greenhouse 20, Treehouse 40 | Curtains 10, ★Bath 47, Closet 139 ‖ Long Hall 0 | Dining 20, Island 5, Bunks 10 | no swap · Soundproof 0, ★Bath 47, Island 5 |
| 11 | Drive 11, ★Bath 41, Treehouse 44 → **Bath 41** | Dining 22, ★Bath 41, Office 17 ‖ Garage -19, Sapling 11 | Dining 22, ★Bath 41, Office 17 ‖ Long Hall 0 | Patio 28, ★Bath 41, Fireplace 17 | no swap · ★Bath 41, Bunks 11, Closet 6 |
| 12 | Doghouse 0, Greenhouse 23, Bath -2 → **Greenhouse 23** | Bunks 6, Living 52, Skylight 6 ‖ Sprinkler ✗, Treehouse 46 | Bunks 6, Living 52, Skylight 6 ‖ Long Hall 0 | Fence 0, Skylight 6, Bed 75 | no swap · Office 23, Bath 0, Soundproof 0 |
| 13 | Flowers 34, Drive 10, Fence 0 → **Drive 0** | Bath -2, Skylight 5, Bed 62 ‖ Sapling 10, Flowers 34 | Bath -2, Skylight 5, Bed 62 ‖ Doghouse 0 | Lawn 10, Fence 0, Patio 24 | no swap · Bath -2, Living 43, Dining 19 |
| 14 | Garage -48, Herbs 33, Drive 11 → **Herbs 28** | Bed 72, Skylight 6, Bath -6 ‖ Sapling 11, Drive 11 | Bed 72, Skylight 6, Bath -6 ‖ Doghouse 0 | Closet 226, Sapling 11, Fence 0 | no swap · Office 22, Bunks 6, Bay Window 0 |
| 15 | Bunks 5, Curtains 5, Lawn 44 → (completed early) | Closet 228, Bath -7, Living 49 ‖ Fence 33, Greenhouse 33 | Closet 228, Bath -7, Living 49 ‖ Doghouse 33 | Bay Window 0, Soundproof 0, Office 22 | no swap · Closet 228, Dining 33, Bath -7 |
| 17 | Bath 0, Patio 89, Treehouse 139 → **Grandma’s Room (reserve) 111** | Closet 252, Office 47, Soundproof 0 ‖ Sapling 73, Herbs 78 | Closet 252, Office 47, Soundproof 0 ‖ Garage -65 | ★Bed 79, Sapling 73, Treehouse 139 | no swap · Fireplace 26, Living 73, Bath 0 |
| 18 | Sapling 78, Long Hall 28, Bath 61 → **Bathroom (reserve) 61** | Kitchen 50, Bay Window 0, Island 6 ‖ Drive 78, Patio 95 | Kitchen 50, Bay Window 0, Island 6 ‖ Garage -111 | Closet 317, Kitchen 50, Bed 31 | no swap · Bed 31, Bath 61, Closet 317 |
| 19 | Drive 80, Fence 74, Living 88 → **Birdhouse 97** | Bed 205, Fireplace 27, Skylight 16 ‖ Sprinkler ✗, Flowers 97 | Bed 205, Fireplace 27, Skylight 16 ‖ Garage -72 | Fence 74, Flowers 91, Bath 49 | no swap · L-Kitchen 49, Bay Window 0, Dining 33 |
| 20 | Herbs 40, Patio 52, Fence 29 → **Patio 52** | Bay Window 0, Bed 215, L-Kitchen 52 ‖ Sapling 35, Sprinkler ✗ | Bay Window 0, Bed 215, L-Kitchen 52 ‖ Garage -75 | Lawn 46, Sapling 17, Flowers 52 | no swap · Bunks 17, Bed 215, Bath 40 |
| 21 | Drive 35, Bath 58, Fence 29 → **Fence 0** | Office -5, Skylight 17, Bath 58 ‖ Sapling 35, Sprinkler ✗ | Office -5, Skylight 17, Bath 58 ‖ Sapling 35 | Fence 29, Bed 241, Herbs 40 | no swap · Bath 58, Dining 35, Bed 241 |
| 22 | Bed 269, Fence 32, Living 63 → **Living 45** | Dining 38, Fireplace 38, Bay Window 0 ‖ Doghouse 0, Hall 32 | Dining 38, Fireplace 38, Bay Window 0 ‖ Sapling 38 | Bed 269, Patio 57, L-Kitchen 57 | no swap · Office -9, Island 7, Fireplace 38 |
| 23 | Curtains 18, Hall 30, Office 54 → **Office 54** | Office 54, Closet 428, Bunks 18 ‖ Greenhouse 30, Herbs 42 | Office 54, Closet 428, Bunks 18 ‖ Sapling 36 | Curtains 18, Bath 72, Office 54 | no swap · Dining 36, Bath 72, Kitchen 54 |
| 24 | Greenhouse 30, Garage -97, Lawn 48 → **Lawn 48** | Bath 54, Curtains 24, Living 60 ‖ Flowers 54, Fence 155 | Bath 54, Curtains 24, Living 60 ‖ Sapling 36 | Greenhouse 30, Dining 36, Office 48 | no swap · Kitchen 54, Bath 54, Bed 224 |
| 25 | Office 30, Bed 265, Fence 246 → **Office 97** | Bath 90, Dining 36, L-Kitchen 54 ‖ Patio 78, Herbs 60 | Bath 90, Dining 36, L-Kitchen 54 ‖ Fence 246 ▶ | Closet 566, Bed 265, Fence 246 | no swap · Skylight -12, Bed 265, Fireplace 78 |
| 26 | Hall 0, L-Kitchen 56, Lawn 100 → **Lawn 56** | Dining 37, Island 12, L-Kitchen 56 ‖ Fence 50, Patio 81 | Dining 37, Island 12, L-Kitchen 56 ‖ Sapling 62 ▶ | Kitchen 56, Bath 69, Lawn 100 | no swap · Skylight -6, Bath 69, Living 87 |
| 27 | Fence 50, Patio 81, Living 87 → **Patio 75** | Dining 37, Living 87, Bed 434 ‖ Lawn 100, Greenhouse 31 | Dining 37, Living 87, Bed 434 ‖ Sapling 62 | Patio 81, Herbs 62, Bath 62 | no swap · Office 50, Fireplace 93, Island 18 |
| 28 | Kitchen 57, Lawn 100, Pergola 38 → **Lawn 100** | Soundproof 0, L-Kitchen 57, Curtains 32 ‖ Doghouse 0, Fence 50 | Soundproof 0, L-Kitchen 57, Curtains 32 ‖ Sapling 63 ▶ | Bath 69, Sapling 32, Pergola 38 | no swap · Bed 456, Office 50, Skylight -6 |

**Greedy's pack picks from your house:** after milestone 1: Fenced yard or Entertaining → **Entertaining**; after milestone 2: Garden beds or The drive → **Garden beds**; after milestone 3: Hallways or Woodland → **Woodland**; after milestone 4: Big family or The drive → **Big family**; after milestone 5: Fenced yard or Kitchen garden → **Kitchen garden**; after milestone 6: Fenced yard or Hallways → **Fenced yard**

## Appendix B: method

- **The rules copy:** `src/` and `sim/` copied outside the repo and patched with the draw modes (two rows, a standing card, packs, targeted rerolls with swaps) and the stronger yard pieces, as content data. Everything else is develop at 0b9e9db. The scripts are in this session's scratchpad: `patch-arena.ts`, `arms.ts`, `runner.ts`, `agg.ts`, `agg-md.ts`, `replay.ts`, `weights.ts`.
- **Seeds:** `check-0` to `check-399` for the General Contractor's arms (the client goes Hendersons, Count, Barkers, Juniper, Dale in turn); `check-0` to `check-199` for the controls (five cards from one pool, Rooms 2 + Layout 2) and the stronger yard; `check-0` to `check-99` for the reroll bot, the Landscaper, and the Architect. Every arm plays the same seeds as the arm it's compared with, so differences are paired. ± is one standard error of the paired difference.
- **Measures** are taken on the first hand of each week, after the free redraw or swaps:
  - *a room:* a regular room card (not a Hallway or a special room);
  - *a needed room:* a room that an unmet checklist line asks for, as the findings counted it (Cozy and Under one roof ask for any room until they have enough);
  - *no play:* no spot, no host, and no Renovation;
  - *cards read a week:* every card drawn (first hands, redraws, rerolls, swaps, a new standing card) over the weeks played.
- **Targets** are today's. Every candidate that offers more cards also scores more, so a target re-fit would follow any of them; the score ratio says how much.
- **Known gaps:**
  - Under two rows, the Bigger Truck (+1 card) does nothing in the sim. The shop bot buys it in about 7% of runs.
  - Greedy never plans: it doesn't build toward a tidy yard or keep a standing card for later. People value the look of a yard, so the sim undercounts layout plays.
  - Greedy's pack pick is its own invention, and the packs are one possible list.
  - The crew arms ran on Rooms 3 + Layout 2, before the recommendation settled on 2 + 2. Not run: the crews on 2 + 2, the first level of stronger yard alone on today's draw, and Rooms 2 + Layout 2 with the reroll bot. The reroll bot and the other crews ran on 100 seeds instead of 200, to share the machine with the layout session's sims.
