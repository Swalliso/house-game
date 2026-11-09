# Layout: Hallways, bigger rooms, reach, the Garage, and a Porch

**Date:** 2026-11-09, after playtest 4. **Status:** a proposal for you to choose from. Nothing under `src/` or in the decision log changed. The D-### entries in §8 are drafts (D-112 to D-118); the PR that builds what you pick adds them to `decisions.md`.

**Read with:** `docs/playtests/playtest-4-findings.md` (§2, §7, §9, §10, §12, §14, §16; uncommitted, in the title-screen-feedback worktree), D-046, D-074, D-080, D-093, D-101, D-102, D-106, the Parked "Merged rooms" entry, `content-brainstorm.md` §15, and `house-systems-review.md` §5.2 and §5.10.

## In short

- **Hallways: pay both cards now, hold the pack.** "+2 Comfort for each room it touches, up to 4" takes Hallways from 0.27 to 1.67 a run (84% of runs build one): Wow +7%\*, Cozy +6 points\*, wins level. It costs the outline a little (H1g −7\*). Every pack tried either lost wins (−16\* alone) or, with the pay, sprawled: corridors bolted around the outside, glance test −18\*. "Pays only between rooms" fixes the outline, but then greedy builds almost no halls. It's the fallback if the playtest shows bolted-on halls.
- **Improve a room: yes, but an extension is worth two levels.** At one level (+4, Renovate's step) extending loses 4 points of wins, whether any card can extend or only spare ones; most of the lost seeds had a Bathroom extended early. At two levels (straight to ★★) from a spare card, wins are level, Wow +11%\*, and the house keeps its rooms.
- **Reach: park it.** It lost 3 points and 5% of Wow (within noise), because sets still count only touching rooms, so reach pulls Bathrooms away from them. The mechanism is about 35 lines and ready when an effect needs it.
- **The Garage: an outbuilding by the street or a Driveway, +2 when a Driveway touches it.** It's built 0.50 a run (0.03 today), 98% detached, with the outline a little better and wins a little up (within noise). Cozy skipping Garages changes nothing. A Loud Nursery doesn't give Soundproofing a job; "Soundproofing makes its room Quiet" does (installed 0.48 a run, 0.10 today). Country Living's fix (+2 once for touching a Tree) cuts poke-outs by a third.
- **A Porch: not now.** As a yard piece against a room it loses about 20 points of wins (−23\*, −19\* roofed): greedy lays it along the walls the house would grow into.
- **Together** (the Hallway pay, two-level extensions, the Garage by its drive, Country Living's fix): wins level (+1), Wow +20%\*, Cozy +11\*, glance test level. The gain comes after week 20; up to week 15 the score is within 4% of today's, so mid-run difficulty doesn't move.
- **Order:** one data PR (Hallway pay, Garage, Soundproofing, Country Living) before the next playtest; then Extend as its own phase. Packs, reach, and the Porch stay parked. Your questions are in §10.

---

## How this was tested

- **Seeds:** up to 200 held-out seeds per arm (`check-0…199`, 40 per Core client, the General Contractor), played by greedy at today's targets. The default `sim` seeds are the ones the targets were fit on, so they aren't used here (findings §12). Playtest 4's own numbers came from the fit seeds, which is why some of them differ below. Arms run on fewer seeds use the first 60, 100, or 150, and show today's numbers on those same seeds in brackets.
- **Changes in memory.** Content changes were made in memory, as the research's scratch scripts did. Five things data can't express went into a patched copy of the rules in the scratchpad, never `src/`: an extension play, a spare-card check, reach (`within: N` on a neighbor effect), a "between rooms" condition for Hallways, and roofed tiles in Under one roof's outline. With today's content the copy plays exactly like the real rules (10 of 10 seeds, action for action). The scripts are in the shared notes folder (Appendix).
- **Paired.** Every arm plays the same seeds with the same clients, so differences are per seed. Wins: the difference in points, with a 95% interval from the seeds that only one arm won (as `--ban` and `--gift` report it). Wow: the geometric mean of the per-seed ratio. **\*** marks an interval that excludes no change. An arm that adds a card to the pool changes every later draw, so its seeds pair less tightly and its intervals are wider.
- **Measures:** win rate; plays a run of the piece in question; mean final Wow; Under one roof and Cozy held at the last tally (in brackets, the change in points); the glance test (G = H1g a compact outline, H2 no yard inside the house, and H3 one of each shared room; `house-systems-review.md`'s Appendix); and research.md's plausibility check.
- **One round.** Round 1's houses suggested a few follow-up arms (Hallways that pay only between rooms, smaller packs, extending only with a spare card, two levels per extension, a Quiet Soundproofing). Each ran once, and nothing was tuned after it. One bot fix came out of round 1 (D-113), and the pack arms were run again with it.
- **What greedy can't tell us.** It never plans: it won't leave a gap for a corridor, or keep a spot open for a later room. Where a rule rewards planning, the sim's numbers are a floor, and the playtest decides.

**Today, on these seeds:** 54% of runs win, mean Wow 21,326 (median 21,531). At the last tally Under one roof holds in 77% of runs and Cozy in 68% (69% and 46% of all tallies). 50% of houses pass the glance test (H1g 70%, H2 79%, H3 83%), with 10.9 rooms, fill 0.65 and 20 corners at the median. A run builds 0.27 Hallways (25% of runs build one), renovates 2.77 times, builds 0.03 Garages, and installs Soundproofing 0.10 times.

---

## 1. Hallways

### Why a link pays so little

D-046's link is already Combolands' rail rule: every room along a Hallway counts as touching every other. In Combolands a railroad is "neutral glue": it scores nothing, and its value comes from buildings whose effects read their neighbors' categories (research.md, "Neutral glue buildings"). Our rooms have few such effects: a Bathroom pays for one Bedroom, a Kitchen per Dining Room, a Bedroom per Quiet neighbor (up to 3). So a link adds little, a sensible player already puts those pairs side by side, and a link can bring a penalty too (findings §7). The Hallway has to be the payoff itself.

### The arms

- **Pay** (step 1, the findings' proposal): both cards earn +2 Comfort for each room they touch, up to 4 (+8). It's the existing `neighbor` effect.
- **Half pay:** +1 a room, up to 4.
- **Pack** (step 2): one Hallway card at the two cards' weight (20), complexity 3 → 2, the Long Hallway retired. The bots try ten shapes: straight 2–6, L 3–5, and T 4 and 6. Also with straight and L shapes up to 4 tiles, and at complexity 3.
- **Between rooms:** the pay counts only while **every tile of the hall has rooms on at least two of its four sides** (`flanked`, a new piece condition of about 15 lines). A corridor between two rows of rooms passes, and so does its end at the front door. A hall bolted along the outside, wrapped around a room, or stubbing into the yard doesn't. It still links whatever it touches (D-046); only the pay waits.

### What the sim says

| Arm | Seeds | Wins (today) | Δ wins, points [95%] | Mean Wow (today) | Wow ratio [95%] | Under one roof | Cozy | Glance | Hallways a run |
|---|---|---|---|---|---|---|---|---|---|
| Today | 200 | 54% | — | 21,326 | — | 77% | 68% | 50% | 0.27 |
| **Pay** | 200 | 55% (54%) | +1.5 [−2.3, +5.3] | 22,701 (21,326) | ×1.070 [1.009–1.135]\* | 78% (+1.5) | 74% (+6.0\*) | 47% (−3.5) | 1.67 |
| Half pay | 60 | 55% (58%) | −3.3 [−9.8, +3.1] | 22,106 (22,202) | ×0.954 [0.846–1.076] | 80% (0) | 73% (+5.0) | 47% (−5.0) | 0.95 |
| Pay, between rooms | 195 | 53% (54%) | −1.0 [−2.4, +0.4] | 21,805 (21,482) | ×1.017 [0.979–1.057] | 78% (+1.0) | 71% (+3.1) | 52% (+1.5) | 0.25 |
| Pack alone | 100 | 47% (63%) | −16.0 [−27.7, −4.3]\* | 19,642 (22,796) | ×0.792 [0.640–0.980]\* | 86% (+4.0) | 66% (−3.0) | 45% (−5.0) | 0.33 |
| Pack alone, complexity 3 | 60 | 55% (58%) | −3.3 [−11.3, +4.6] | 23,044 (22,202) | ×1.018 [0.965–1.074] | 83% (+3.3) | 72% (+3.3) | 47% (−5.0) | 0.42 |
| Pack + pay | 100 | 61% (63%) | −2.0 [−13.4, +9.4] | 23,090 (22,796) | ×0.999 [0.825–1.211] | 76% (−6.0) | 83% (+14.0\*) | 32% (−18.0\*) | 2.07 |
| Pack (straight and L, up to 4) + pay | 60 | 50% (58%) | −8.3 [−22.4, +5.7] | 21,055 (22,202) | ×0.908 [0.693–1.191] | 80% (0) | 78% (+10.0) | 30% (−21.7\*) | 2.13 |
| Pack + pay, between rooms | 100 | 47% (63%) | −16.0 [−28.0, −4.0]\* | 19,355 (22,796) | ×0.767 [0.611–0.962]\* | 83% (+1.0) | 68% (−1.0) | 44% (−6.0) | 0.54 |
| … paying up to 6 rooms | 60 | 43% (58%) | −15.0 [−28.7, −1.3]\* | 18,546 (22,202) | ×0.762 [0.602–0.965]\* | 82% (+1.7) | 67% (−1.7) | 42% (−10.0) | 0.48 |

The outline:

| Arm | Runs with a hall | Tiles a hall | Rooms along it | Corners (median) | Wedged yard pieces | H1g (compact) | H2 (no yard inside) |
|---|---|---|---|---|---|---|---|
| Today | 25% | 2.4 | 2.9 | 20 | 0.98 | 70% | 79% |
| **Pay** | 84% | 2.5 | 3.1 | 22 | 1.01 | 64% (−7\*) | 76% (−3) |
| Half pay | 60% | 2.5 | 3.4 | 20 | 1.00 | 73% (+2) | 73% (−8) |
| Pay, between rooms | 23% | 2.3 | 3.5 | 20 | 1.01 | 74% (+3) | 78% (0) |
| Pack alone | 31% | 3.8 | 3.6 | 22 | 1.03 | 71% (−4) | 67% (−10\*) |
| Pack alone, complexity 3 | 28% | 4.3 | 3.6 | 20 | 1.03 | 70% (−2) | 73% (−8) |
| Pack + pay | 87% | 4.0 | 3.8 | 24 | 1.08 | 56% (−19\*) | 61% (−16\*) |
| Pack (straight and L) + pay | 87% | 3.2 | 3.7 | 24 | 1.12 | 60% (−12) | 63% (−18\*) |
| Pack + pay, between rooms | 41% | 3.4 | 3.8 | 20 | 1.04 | 77% (+2) | 66% (−11) |

Round 1's bot, on all 200 seeds, before the shortlist fix (D-113): pack alone −9.0 [−17.0, −1.0]\*, Wow ×0.823\*; pack + pay +1.5, glance −18.0\*; pack + pay up to 6 rooms +2.0, glance −21.5\*.

- **The pay works, modestly.** A run builds 1.67 halls (0.27 today), each touching about 3 rooms, and a Hallway earns about 610 Wow a copy (44 for the Hallway and 111 for the Long Hallway today). Wins +1.5 (within noise), Wow ×1.07\*, Cozy +6\*. That's smaller than the experiment on the fit seeds (findings §7: +5 points of wins, +11.6% Wow).
- **The outline pays a little:** H1g −7\* as median corners go from 20 to 22, and the glance test −3.5 (within noise). Some halls go along an outside wall.
- **Half the pay isn't enough:** 0.95 halls a run, and wins and Wow slightly down (within noise).
- **The pack alone loses, mostly through its complexity.** −16\* on 100 seeds (−9\* on 200 with round 1's bot). At complexity 3 it's level (−3.3, within noise). Complexity 2 puts it in the first phase's draws 6 times as often (30% of its weight against 5%), where a card that scores nothing takes a room's place.
- **The pack with the pay sprawls.** Wins level and Cozy +14\*, but the glance test −18\* (H1g −19\*, H2 −16\*), and median corners 24. Straight and L shapes up to 4 tiles sprawl the same (−22\*).
- **"Between rooms" keeps the outline, and empties the halls.** With the pay it holds H1g and the glance test (+3, +1.5), but greedy builds 0.25 halls a run, as today: it never leaves a corridor-shaped gap. With packs it's a dead card again (−16\*).

### Where greedy puts a pack

Pack + pay, with the pay counting rooms touching the hall. Seed `check-22` (the Barkers, won; 22 corners), and `check-7` (the Barkers, won with 37,457; 44 corners, fill 0.50), the most corners in the arm:

```
check-22            check-7
 ffffff...          ..........====.......
 ....ff...          ..........^KK=.......
 *=CWffg*.          .......ffffKKOO......
 ^====AA..          .......f...O====rr...
 ppWBBAA=.          *.h....f...O.DD=rr...
 ppCBBMM=.          ..h....f.*.W.DDLL....
 BB==DD==.          .......f..====.LL^..^
 BBLLDDC=.          .~~~....LLL^C=MLL=.^^
 W^LLKK^=.          .~~~....LLL^BBM=^==^^
 ppLLKKC..          .~~~...pp^==BB==C=pp^
 pp^ppf...          ..b....pp..^^WAAGGpp^
 ^g^ppf*..          ......*.......AAGG^^.
 ffffff...
```

`=` Hallway · B Bedroom · W Bathroom · K Kitchen · D Dining Room · L Living Room · C Closet · M Mudroom · O Home Office · A a member's room · G Garage · p Patio · f Fence · g Doghouse · r Greenhouse · h Herb Garden · b Flower Bed · `^` Tree · `~` water · `*` boulder.

The pay counts rooms touching the hall, so a long pack earns most **outside**: along a row of rooms, or wrapped around a Bathroom, where one hall touches four rooms. In `check-22` the column on the right runs down the outside wall past four rooms; in `check-7` corridors wrap the whole house. Inside a compact house there's rarely a gap for a corridor, and greedy never leaves one. Each bolt-on adds corners, and the yard pieces it fences in count as wedged.

### Recommendation

- **Now: the pay on both cards** (D-112). Pure data, and the halls start to pay.
- **Hold the pack** (D-113). The corridor art (D-111's runner) and the door marks work with the two cards as they are, so the look doesn't wait for it.
- **Keep "between rooms" ready.** If the playtest shows halls bolted along the outside, it's the one rule that turns their pay off and leaves real corridors paid. The cost: a hall pays only once rooms line it, so it's a plan, not a filler.

### Planning ahead, and the optional ideas

- **Stubbing out is already allowed:** a Hallway only has to touch the house. With the pay, a stub earns +2 now and +2 more for each room built along it later, so laying a hall first and building the wing around it is a plan you can see on the board. That's the planning the findings asked about, and it costs no new rule.
- **Member rooms that like halls** ("+2 along a Hallway") can't be written as data: connectors aren't neighbors. Reach does the same job (members' rooms reaching 2 steps, so a hall brings more rooms within reach). With the pay it changed nothing (−1.7 points, Wow ×1.00 on 60 seeds), likely for §3's reason: in a compact house most rooms are already within two steps.
- **A Bedroom wing set** (2 Bedrooms, a Bathroom and a Hallway, connected) can't be data either: sets connect through `neighbors`, which leave Hallways out. It needs a rule for connector members in connected sets (small, in `sets.ts`). Worth trying only if halls still feel flat after the playtest.
- **More rail-like rooms** are the other way to make links pay: room effects that read their neighbors' kinds ("+1 per Social room it connects to"), so a hall multiplies them as a Combolands railroad does. It touches many cards and every number, so it belongs to a balance pass.

---

## 2. Improve a room: Renovate in place, or Extend

### What was tested

The findings' idea (§9): a room card dropped **on** a room of its type renovates it in place; dropped **beside** it, the card's tiles join the room. One system, sharing D-102's +4 a level, its cap of 2, and its stars.

The engine already draws a piece from its own tiles (`PlacedPiece.shape`, added for packs), so an extended room stays the same piece with a bigger outline: one wallpaper, no inner wall, its uid, fixture and level kept. In the prototype an extension is a Renovation with a position:
- the card's tiles must be a legal placement, and with the room's tiles make a **rectangle no longer than 2:1**: a Full Bath (1×2), a Primary Bedroom (2×4), a Great Room (3×4), or a Study (2×2);
- once per room, never a member's room, and the room still counts once everywhere (rules, sets, counts);
- Trees under the new tiles are cleared, as for any placement.

Four arms:
- **Any card, one level:** any card of the type extends, for one level (+4).
- **Spare cards, one level:** only a **spare** card extends. Spare means Renovate's trigger (the type at its D-102 limit), plus a Bathroom once "A Bathroom for every two Bedrooms" holds and a Home Office once the house has two (those types have no ceiling).
- **Any card, two levels:** an extension takes the room straight to ★★ (+8).
- **Spare cards, two levels.**

### What the sim says

| Arm | Seeds | Wins (today) | Δ wins, points [95%] | Mean Wow (today) | Wow ratio [95%] | Under one roof | Cozy | Glance | Extensions a run | Renovations a run | Rooms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Today | 200 | 54% | — | 21,326 | — | 77% | 68% | 50% | — | 2.77 | 10.9 |
| Any card, one level | 200 | 50% | −4.0 [−8.3, +0.3] | 20,839 | ×0.999 [0.955–1.045] | 78% (+1.5) | 70% (+1.5) | 52% (+1.5) | 0.85 | 2.58 | 10.4 |
| Spare cards, one level | 200 | 49% | −4.5 [−8.0, −1.0]\* | 21,221 | ×1.006 [0.977–1.035] | 78% (+1.0) | 70% (+1.5) | 51% (+1.0) | 0.57 | 2.65 | 10.6 |
| Any card, two levels | 200 | 56% | +2.5 [−3.8, +8.8] | 22,510 | ×1.136 [1.042–1.239]\* | 75% (−2.0) | 71% (+2.5) | 51% (+1.0) | 1.83 | 2.21 | 10.4 |
| **Spare cards, two levels** | 197 | 55% (54%) | +0.5 [−3.8, +4.8] | 22,498 (21,449) | ×1.112 [1.051–1.178]\* | 75% (−2.0) | 70% (+1.5) | 54% (+4.1) | 1.17 | 2.33 | 10.7 |

Extensions a run by type (Bathroom / Bedroom / Living Room / Home Office): any card, one level 0.41 / 0.17 / 0.15 / 0.13; spare, one level 0.38 / 0.08 / 0.04 / 0.07; any card, two levels 0.57 / 0.56 / 0.43 / 0.27; spare, two levels 0.58 / 0.28 / 0.16 / 0.15.

For each card that could extend (60 runs each), the best extension against the same card as its own room, and against Renovate where it could renovate:

| Card | One level: beats its own room | One level: beats Renovate | Two levels: beats its own room | Two levels: beats Renovate |
|---|---|---|---|---|
| Bathroom, below a limit | 38% | — | 68% | — |
| Bedroom, below its limit | 20% | — | 57% | — |
| Bedroom, at its limit | 53% | 6% | 92% | 46% |
| Living Room, below | 18% | — | 67% | — |
| Living Room, at its limit | 78% | 4% | 93% | 80% |
| Home Office, below | 25% | — | 78% | — |
| Home Office, at its limit | 100% | 14% | 100% | 40% |

- **At one level, extending is a weaker Renovate.** Both add +4, and the bigger outline usually costs more than it brings: a Tree cleared (a view, for this room or a neighbor), or Under one roof's box pushed out. At the limit it beats Renovate only 4–14% of the time.
- **At one level it's also a trap, spare card or not.** Both one-level arms lose about 4 points of wins. Of the 14 seeds the any-card arm lost, 12 had a Bathroom extended; of the 11 the spare arm lost, 10 did. "Spare" for a Bathroom means the Bathroom rule holds *now*; a later Bedroom breaks it, and a second Bathroom would also have made a later Jack-and-Jill or Suite (sets pay per instance, which no week's preview shows). A player would fall into it the same way.
- **Two levels make it a real choice.** At the limit an extension beats Renovate about half the time (40–80%), so the decision turns on the room's surroundings: open ground or a Tree beside it, the box, the views. One card for two levels is worth the floor the room takes.
- **Spare cards keep the house's rooms.** Any card, two levels, wins slightly more (+2.5 against +0.5, both within noise), but builds 10.4 rooms: below the limit a card often extends instead of becoming a new room. Spare cards keep 10.7 rooms and the best glance test (+4.1). At two levels the Bathroom extension turns from a trap into a good play: runs with one score ×1.20 against today, and 10 of the 11 seeds this arm won and today lost had one.

### How it plays

- **Spare cards only.** One rule covers both forms: "a spare room card improves a room: on it, Renovate; beside it, Extend". The card's chip says which: **Renovate** when it can renovate, **Extends** when a room of its type has a spot to grow into, and both can show (the legibility proposal's chip row puts them first: Renovate, Extends, then sets).
- **The choice on the ghost.** Beside a room of its type the ghost shows both outcomes, "Own room +41 · Extend → Full Bath ★★ +28", and a key flips between them. The default is the card's own room, as today, so nothing joins by surprise. A spare card that can't be its own room without breaking a rule still shows that number, in orange.
- **Renovate, findable** (the playtest-4 fix PR, already planned): the chip, a first-time hint the first time a card can renovate or extend, and "in place; nothing is torn down" in its text. Keep the name Renovate (D-102); "Extend" names the other form, so no umbrella word reaches the player.
- **Names:** an extended room takes its bigger name in Inspect and on the board's label: Full Bath, Primary Bedroom, Great Room, Study. Kitchens and Dining Rooms stay on Renovate (an L-Kitchen can't make a rectangle, and a second Kitchen card is the commonest spare).
- **Art:** `rooms.ts` already lays out furniture for any footprint, so an extended room draws today; it just looks sparse. The bigger names want a few more pieces in their slot lists: the Full Bath a bathtub and a sink (LimeZu's interiors have them, findings §9), the Primary Bedroom a second nightstand and a chest, the Great Room a second seating group, and the Study a bookcase.

---

## 3. Reach through the house

### The sketch

- **A step** is one room to another that it touches or is linked to by a Hallway. **Reach N** means within N steps, going only through rooms. Yard pieces and lot features count only at one step, as they do today.
- **It shares the link groups; it doesn't add any.** `computeLayout` already turns each connected group of Hallways into links and folds them into `neighbors`. Reach is a breadth-first walk over `neighbors`, rooms only, cached per layout. The prototype is about 35 lines in `scoring.ts` and needs nothing from the Hallway code: every room along a hall is one step from every other, so a hall extends reach for free.
- **What stays at one step:** sets (touching or linked, D-065's timing), the Patio rule, Cozy, and `touching` conditions. Reach is only for effects that ask for it.
- **Data:** an optional `within: N` on a `neighbor` effect, then on auras and `touching` conditions if they need it. Card text: "+2 per Bedroom within 2 steps (up to 3)".
- **UI:** while a piece with reach is placed or hovered, the rooms within reach light up (Combolands' highlight, findings §13 item 5), and Inspect names the way ("Bedroom, 2 steps, through the Hallway").

### The A/B

The test piece was the Bathroom, the room reach suits best: "+2 per Bedroom within 2 steps (up to 3)" in place of today's "+3 if touching a Bedroom". The same numbers without reach separate the range from the pay.

| Arm | Seeds | Wins (today) | Δ wins, points [95%] | Mean Wow (today) | Wow ratio [95%] | Under one roof | Cozy | Glance | Bathroom's Wow a copy |
|---|---|---|---|---|---|---|---|---|---|
| Today | 200 | 54% | — | 21,326 | — | 77% | 68% | 50% | 552 |
| Reach: +2 per Bedroom within 2 steps | 200 | 51% | −3.0 [−7.6, +1.6] | 20,919 | ×0.946 [0.888–1.009] | 79% (+2.0) | 67% (−1.0) | 50% (0) | 774 |
| The same pay, touching only | 200 | 53% | −1.0 [−4.7, +2.7] | 21,243 | ×0.973 [0.931–1.017] | 79% (+2.5) | 70% (+1.5) | 55% (+4.5\*) | 609 |
| Members' rooms reach 2 steps, with the Hallway pay (against the pay alone) | 60 | 55% (57%) | −1.7 [−4.9, +1.6] | 22,542 (22,872) | ×0.999 [0.956–1.043] | 82% (0) | 73% (+1.7) | 53% (0) | — |

- **Reach doesn't help, and costs a little.** With reach the Bathroom earns more, yet greedy wins 3 points less and scores 5% less (both within noise). The same pay at one step is level with today, and passes the glance test a little more often.
- **Why:** the sets still count only touching rooms. A Bathroom that reaches three Bedrooms from two steps away isn't in their Jack-and-Jill or Suite, so reach pulls Bathrooms away from the spots that pay most.
- **It does nothing for halls.** With Hallway packs and the pay, reach left Hallway plays where they were (2.33 a run either way, round 1's bot). In a compact house most rooms are already within two steps through other rooms, so a hall extends reach very little.

**Recommendation: park reach** (D-115). The mechanism is cheap and ready whenever an effect needs it. Try range on yard pieces first, where it's drawn and slid (findings §10), and come back to reach for effects that don't compete with the sets: a Fireplace that warms rooms within 2 steps, or noise that carries through rooms (§4).

---

## 4. The Garage and noise: one decision

### Today

- **The Garage is a room** (2×2, Loud) that must touch the house, and the street or a Driveway. The street lies off the lot, so in practice it sits in the bottom row or at a Driveway's end, touching the house: 78% of offers have no legal spot, and greedy builds 0.03 a run.
- **When it's built at the drive's end it costs Wow:** it's a room touching one other, so Cozy turns off, and it can clear a Tree a neighbor counted (your week 14: −48, none of it from Loud; findings §2).
- **Loud is nearly empty:** only the street, the Garage, the Playroom and the Pool. Soundproofing is installed 0.10 times a run and earns nothing in 96% of offers.
- **The Nursery is Quiet** (and Kid), though the twins are the household's loudest members.

### The arms

- **Outbuilding:** the Garage stands anywhere it touches the street or a Driveway, attached to the house or not. It isn't a room, so Cozy and Under one roof never count it. It stays Loud, Full House still needs one (that set doesn't need its members connected), and it counts toward A tidy yard like any outbuilding. Pure data (`category: 'outbuilding'`).
- **Outbuilding, +2 with a Driveway:** the Garage earns +2 if a Driveway touches it, so the drive and the Garage are a pair (D-080).
- **Cozy skips Garages:** the Garage stays a room, and Cozy neither counts it toward its 6 rooms nor needs it to touch two. Pure data.
- **Nursery Loud:** the Nursery is Loud instead of Quiet, until it grows into the Kids' Room.
- **Soundproofing makes its room Quiet:** on top of today's "Loud neighbors can't bother it", its room counts as Quiet and stops being Loud. Bedrooms pay for Quiet neighbors, so it has a job in every house.

| Arm | Seeds | Wins (today) | Δ wins, points [95%] | Mean Wow (today) | Wow ratio [95%] | Under one roof | Cozy | Glance | Garages a run (detached) | Soundproofing installed a run |
|---|---|---|---|---|---|---|---|---|---|---|
| Today | 200 | 54% | — | 21,326 | — | 77% | 68% | 50% | 0.03 (0%) | 0.10 |
| Outbuilding | 150 | 61% (59%) | +1.3 [−1.3, +3.9] | 24,870 (22,420) | ×1.046 [0.998–1.097] | 78% (0) | 72% (+3.3) | 55% (+2.7) | 0.41 (97%) | 0.11 |
| **Outbuilding, +2 with a Driveway** | 103 | 65% (63%) | +1.9 [−1.8, +5.7] | 26,223 (22,922) | ×1.064 [0.995–1.138] | 83% (0) | 71% (+1.9) | 50% (0) | 0.50 (98%) | 0.13 |
| Cozy skips Garages | 103 | 62% (63%) | −1.0 [−2.9, +0.9] | 22,892 (22,922) | ×0.999 [0.997–1.001] | 83% (0) | 69% (0) | 50% (0) | 0.03 (0%) | 0.14 |
| Nursery Loud | 103 | 62% (63%) | −1.0 [−6.0, +4.1] | 22,889 (22,922) | ×1.007 [0.972–1.042] | 84% (+1.9) | 70% (+1.0) | 50% (+1.0) | 0.02 (0%) | 0.15 |
| Outbuilding + Nursery Loud | 105 | 63% (63%) | 0 [−5.3, +5.3] | 25,216 (22,819) | ×1.039 [0.966–1.117] | 84% (+1.9) | 71% (+2.9) | 54% (+4.8) | 0.43 (98%) | 0.13 |
| … + **Soundproofing makes its room Quiet** | 100 | 64% (63%) | +1.0 [−5.5, +7.5] | 26,215 (22,796) | ×1.068 [0.981–1.163] | 84% (+2.0) | 72% (+3.0) | 53% (+3.0) | 0.43 (98%) | 0.48 |

- **The outbuilding fixes the Garage.** It's built 14 times as often (0.41 a run), nearly always detached by the street or a drive, and the house gets tidier: median corners 20 → 18 and H1g +4 points (78% against 74% on the same seeds), because the Garage no longer juts out of the house. Wins and Wow a little up, within noise.
- **The Driveway pay makes them a pair.** 0.50 Garages a run, and each earns about 500 Wow (240 without it). Wins +1.9 and Wow +6%, both within noise. It gives D-080's Driveway a job whenever a Garage comes.
- **Cozy skipping Garages does nothing,** because the Garage is almost never built as a room. With the outbuilding the question goes away.
- **A Loud Nursery doesn't give Soundproofing a job.** The Nursery is built 0.18 times a run, so Soundproofing goes from 0.10 to 0.15 installs. Keep the Nursery Quiet.
- **A Quiet Soundproofing does:** 0.48 installs a run, about 76 Wow each, with wins and Wow level to slightly up.

### Country Living

Country Living gives every piece +1 per touching Tree tile, up to 3, which is what paid for your office poke-out and your Hallway's +30 (findings §2). The fix counts the woods once: **+2 if it touches a Tree**, Hallways left out. Both arms get Country Living at the first shop, as `--gift` does, so every run has it.

| Arm (Country Living given) | Seeds | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Pieces touching 2+ Tree tiles | Fill (median) |
|---|---|---|---|---|---|---|---|---|---|---|
| Today's Country Living | 100 | 71% | — | 26,441 | — | 78% | 67% | 51% | 3.87 | 0.65 |
| **+2 once for touching a Tree** | 100 | 67% | −4.0 [−10.1, +2.1] | 25,196 | ×0.970 [0.904–1.040] | 82% (+4.0) | 73% (+6.0) | 54% (+3.0) | 2.69 | 0.66 |

- **A third fewer poke-outs** (3.87 → 2.69 pieces a run touching two or more Tree tiles), and the house rules a little better held, all within noise.
- **The gift stays worth taking:** 67% of runs win with the fixed gift, 71% with today's, and 63% with none on the same seeds.

### Recommendation

One decision (D-116): **the Garage is an outbuilding that stands by the street or a Driveway and pays +2 when a Driveway touches it; Soundproofing makes its room Quiet; the Nursery stays Quiet; Cozy stays as it is.** Country Living's fix is its own small entry (D-117).

---

## 5. A Porch or Deck

### What was tested

A **Porch**: a 1×3 yard piece built against a room (Outdoor, Social), +1 per room it touches (up to 3), +2 in the front yard, at a common card's weight (10) from the first phase. A **roofed** version also counts its tiles toward Under one roof's outline, as a covered porch would.

| Arm | Seeds | Wins (today) | Δ wins, points [95%] | Mean Wow (today) | Wow ratio [95%] | Under one roof | Cozy | Glance | Porches a run | Rooms |
|---|---|---|---|---|---|---|---|---|---|---|
| Today | 200 | 54% | — | 21,326 | — | 77% | 68% | 50% | — | 10.9 |
| Porch | 100 | 40% (63%) | −23.0 [−34.7, −11.3]\* | 18,597 (22,796) | ×0.706 [0.578–0.861]\* | 75% (−7.0) | 65% (−4.0) | 37% (−13.0) | 1.28 | 10.4 |
| Porch, roofed | 100 | 44% (63%) | −19.0 [−30.7, −7.3]\* | 19,284 (22,796) | ×0.750 [0.623–0.904]\* | 71% (−11.0\*) | 66% (−3.0) | 37% (−13.0\*) | 1.18 | 10.6 |

- **It's a trap card.** It pays at once (about 470 Wow a copy) against a wall, and the walls are where the house grows. Greedy lays porches along the sides early, and later rooms go around them: the runs it loses build 10.1 rooms, against 12.4 today on the same seeds, and the score falls behind from week 5 (×0.96 by week 8).
- **Roofing it makes Under one roof worse,** not better (−11\*): its tiles stick out of the box.
- **A pack along the outside walls would block more,** not less.

**Recommendation: not now** (D-118). If a porch comes later, try it as a **fixture** of a room on the front row: a porch drawn outside the room's wall that takes no tile, so it can't block the house. The lot session's sunny-side idea (Sun A) would give it a natural home.

---

## 6. Everything recommended, together

The Hallway pay, spare two-level extensions, the Garage as an outbuilding with its Driveway pay, and Country Living's fix (in the runs that buy it; no gift), on 100 seeds. The Quiet Soundproofing ran after this arm, so it isn't in it; on its own it's small.

| Arm | Seeds | Wins (today) | Δ wins, points [95%] | Mean Wow (today) | Wow ratio [95%] | Under one roof | Cozy | Glance | Hallways / extensions / Renovations / Garages a run |
|---|---|---|---|---|---|---|---|---|---|
| Today | 200 | 54% | — | 21,326 | — | 77% | 68% | 50% | 0.27 / — / 2.77 / 0.03 |
| **All four** | 100 | 64% (63%) | +1.0 [−6.6, +8.6] | 28,997 (22,796) | ×1.203 [1.052–1.375]\* | 78% (−4.0) | 80% (+11.0\*) | 51% (+1.0) | 1.36 / 1.34 / 2.13 / 0.55 |

- **Wins level, Wow +20%\*, Cozy +11\*.** The outline holds (glance +1, median corners 20): the detached Garage and the extensions make up for the halls.
- **The gain comes late.** Against today on the same seeds, the score is ×1.02 at week 5, ×1.03 at week 10, ×1.04 at week 15, ×1.09 at week 20, and ×1.19 at week 25. Playtest 3 found the middle of the run too easy; this barely touches it, and the targets don't need a new fit for wins. Final scores grow by about a fifth, so anything keyed to final Wow (a best score, a celebration threshold) moves with them.
- **Room cards go further:** about 3.5 a run improve a room (1.3 extensions, 2.1 Renovations) instead of 2.8 today.

---

## 7. What this means for the draw session

The draw brainstorm (serene-hertz) asked four things; with these recommendations:

- **The Hallway stays two cards** (the Hallway and the Long Hallway), each with the +2-a-room pay. No pack card. They belong in the Layout row under its rule (a card goes in the row of where it's built).
- **The Garage stands detached**, as an outbuilding by the street or a Driveway: a Layout card.
- **No Porch or Deck card.**
- **Spare room cards extend** (and renovate). About 3.5 room cards a run go into improving rooms, so a Rooms row stays useful late, and a room card drawn at its limit is never dead.
- **One finding for the draw itself:** any new card that comes early and isn't a room costs wins. The Hallway pack at complexity 2 lost 16 points and at complexity 3 only 3; the Porch, from the first phase, lost 23. A Layout row open from week 1 should be checked for the same thing.

---

## 8. Draft decisions

### D-112 · Hallways pay for the rooms they join
**Status:** Proposed (draft) · 2026-11-09, from playtest 4 (findings §7) and `docs/layout-proposal.md`.
**Decision:**
- Both Hallway cards (the Hallway and the Long Hallway) earn **+2 Comfort for each room they touch, up to 4** (+8). It's the existing `neighbor` effect on rooms; the link (D-046) is unchanged.
- Card text: "Links the rooms it touches. +2 for each room it touches (up to 4)."
- No pack (D-113) and no new condition. If the playtest shows halls bolted along the outside, the fix is ready: the pay counts only while every tile of the hall has rooms on two or more of its sides ("between rooms", a piece condition of about 15 lines).

**Why:** a link pays only when the rooms along it read their neighbors, and few do, so today a Hallway earns 44 Wow a copy (111 for the Long Hallway) and greedy builds one in a quarter of runs. With the pay: 1.67 a run, 84% of runs, about 610 Wow a copy; Wow ×1.07\*, Cozy +6\*, wins +1.5 (within noise), on 200 held-out seeds. The outline pays a little (H1g −7\*).
**Changes:** content only (`pieces.ts`). D-046's "connectors aren't neighbors" stands.

### D-113 · Hallway packs wait
**Status:** Proposed (draft) · 2026-11-09, from `docs/layout-proposal.md`.
**Decision:**
- The Hallway stays two cards. No Hallway pack for now.
- If a pack comes back: complexity 3 (not 2), with D-112's pay, and an outline rule ("between rooms", or a better one) tested on held-out seeds before it ships.
- The sim's greedy gives Hallway-pack plays their own shortlist cap (8), apart from `HINT_CAP` (`sim/policies/greedy.ts`), if a pack ships.

**Why:** alone, the pack lost 16 points of wins (−9\* on 200 seeds with round 1's bot), almost all from complexity 2: at complexity 3 it was level. With the pay it sprawled: corridors bolted around the outside, the glance test −18\* (−22\* with straight and L shapes up to 4). With the pay counting only between rooms, greedy built almost none, and the pack was a dead card again (−16\*).
**Changes:** none now. The bot fix: a pack's many link-hinted shapes used up the shared hint cap and pushed other cards' set and rule plays off the shortlist.

### D-114 · Improve a room: Renovate in place, or Extend
**Status:** Proposed (draft) · 2026-11-09, from playtest 4 (findings §9), the Parked "Merged rooms" entry (*Extend a room*), and `docs/layout-proposal.md`.
**Decision:**
- A **spare** room card improves a room of its type: dropped on the room, it renovates it in place (D-102); dropped beside it, its tiles join the room (**Extend**).
- Spare: the card's type is at its limit (D-102's trigger), or it's a Bathroom and the house already has one for every two Bedrooms, or it's a Home Office and the house has two.
- An extension takes the room to the top level, ★★: two levels for one card, because the card's tiles go into it. Once per room.
- The new tiles must be a legal placement, and with the room's tiles make a rectangle no longer than 2:1. Bathroom → Full Bath (1×2), Bedroom → Primary Bedroom (2×4), Living Room → Great Room (3×4), Home Office → Study (2×2). Kitchens and Dining Rooms only renovate; members' rooms never extend.
- The room stays one piece (`PlacedPiece.shape`): its uid, fixture and level go with it, it's one room of its type everywhere (rules, sets, counts, limits), and it takes its bigger name in Inspect and on its label.
- Beside a room of its type, the ghost shows both outcomes ("Own room +41 · Extend → Full Bath ★★ +28"), a key flips them, and the default is the card's own room.
- It's the week's turn, like a Renovation: from the hand or the reserve, and it can be Weekend Crew's next play. A card that can only improve a room doesn't count as fitting for the free redraw (as D-102).
- The card's chip shows Renovate or Extends; a first-time hint the first time a card can do either; Renovate's text says "in place; nothing is torn down".

**Why:** at one level (+4) an extension is a weaker Renovate and a trap: it lost about 4 points of wins whether any card or only spare cards could extend, mostly through Bathrooms extended early. At two levels from a spare card, wins are level (+0.5), Wow ×1.11\*, and the house keeps its rooms (10.7; 10.4 with any card), on 197 held-out seeds. At the limit, an extension beats Renovate about half the time, so the choice turns on the room's surroundings.
**Changes:** D-102 (Accepted): Renovate gets its second form, and Bathrooms and Home Offices become spare as above (for extending; see Q4). The Parked "Merged rooms" entry becomes this. D-097's "rooms never merge" stands: an extended room is one room. Art: a few more furniture pieces for the four bigger rooms (D-111's list).

### D-115 · Reach through the house: sketched, parked
**Status:** Proposed (draft) · 2026-11-09, from `docs/layout-proposal.md` §3.
**Decision:**
- No reach for now.
- The sketch, for when an effect needs it: a step is one room to another that it touches or is linked to by a Hallway; reach N is within N steps, through rooms only. An optional `within: N` on a `neighbor` effect; a breadth-first walk over the layout's `neighbors`, cached per layout (about 35 lines). Sets, Cozy, the Patio rule, and `touching` conditions stay at one step. The UI lights up the rooms within reach while placing.
- First candidates: yard pieces' range (findings §10), then effects that don't compete with sets (a Fireplace's warmth, noise through rooms).

**Why:** a Bathroom paying "+2 per Bedroom within 2 steps" lost 3 points of wins and 5% of Wow (within noise), because sets still count only touching rooms; the same pay at one step was level. Reach didn't make halls more useful either.
**Changes:** none.

### D-116 · The Garage stands by the drive, and Soundproofing makes a room Quiet
**Status:** Proposed (draft) · 2026-11-09, from playtest 4 (findings §2) and `docs/layout-proposal.md` §4.
**Decision:**
- The Garage is an **outbuilding**: it stands anywhere it touches the street or a Driveway, attached to the house or not. It isn't a room, so Cozy, Under one roof, and the room counts never count it. It stays Loud, keeps its budget every 3 weeks, still counts for Full House, and counts toward A tidy yard.
- It earns **+2 if a Driveway touches it** (once).
- **Soundproofing** also makes its room Quiet (and not Loud). Loud neighbors still can't bother it.
- The Nursery stays Quiet. Cozy is unchanged.

**Why:** today 78% of Garage offers have no legal spot and greedy builds 0.03 a run; when one is built at the drive's end, it can turn Cozy off. As an outbuilding with the Driveway pay, it's built 0.50 a run (98% detached), the outline gets a little tidier (H1g +4 points), and wins and Wow are level to slightly up. A Loud Nursery gave Soundproofing almost nothing to do (0.15 installs a run); a Quiet Soundproofing is installed 0.48 times a run.
**Changes:** D-080 (Open): the Driveway gets a partner. Art: the Garage drawn as a building in the yard, its car with it.

### D-117 · Country Living counts the woods once
**Status:** Proposed (draft) · 2026-11-09, from playtest 4 (findings §2).
**Decision:** Country Living gives every piece except Hallways **+2 if it touches a Tree** (once), instead of +1 per touching Tree tile, up to 3.
**Why:** the per-tile count paid for poke-outs: a room reaching into the woods for +3, and your Hallway's +30. The fix cuts pieces touching two or more Tree tiles by a third (3.87 → 2.69 a run), with the house rules a little better held, and the gift stays worth taking (67% of gifted runs win, against 71% today and 63% with no gift).
**Changes:** content only (`blueprints`).

### D-118 · A Porch waits
**Status:** Proposed (draft) · 2026-11-09, from `docs/layout-proposal.md` §5.
**Decision:** No Porch or Deck card now. If one comes later, try it as a fixture of a room on the front row, drawn outside the room's wall and taking no tile.
**Why:** as a 1×3 yard piece against a room it lost 23 points of wins\* (19\* roofed). It pays at once against a wall, where the house would grow, so later rooms go around it.
**Changes:** none.

---

## 9. Recommended order

1. **Before the next playtest, one data PR:** D-112 (the Hallway pay), D-116 (the Garage, the Driveway pay, Soundproofing), and D-117 (Country Living). All content and card text, plus the Garage's yard sprite. It rides with the playtest-4 fix PR, or follows it. Run `npm run sim -- --check` once; the package's wins were level.
2. **The playtest watches for:** halls bolted along the outside (then "between rooms"), whether detached Garages read as a garage and a drive, and whether Soundproofing gets bought.
3. **Next phase, D-114 (Extend), with its own playtest:** the extension play (rules, `legalPlays`, `preview`), the ghost's two outcomes and its key, the names, the four rooms' furniture, the chip and the first-time hint. It's the biggest piece here, and the most fun to try.
4. **Parked:** D-113 (packs), D-115 (reach), and D-118 (the Porch).

---

## 10. Questions for you

1. **Hallways:** pay both cards now (+2 a room, up to 4) and hold the pack? Or do you want the pack for how it feels, at complexity 3, despite the sprawl?
2. **Bolted-on halls:** if the playtest shows them, is "pays only between rooms" the fix you want? Halls get rarer, but every paid one is a real corridor.
3. **Extend:** two levels per extension (straight to ★★) from spare cards only? The findings had it share Renovate's +4 a level; at one level it loses 4 points of wins.
4. **Spare Bathrooms and Home Offices:** in the sim these two (which have no ceiling) count as spare only for extending: a Bathroom once the Bathroom rule holds, a Home Office once there are two. Should they also renovate in place, so one trigger covers both forms? And should their draws halve then, as D-104 does at a limit? Neither was tested.
5. **The Garage:** an outbuilding that may stand detached by the street or a Driveway, +2 with a Driveway? It stops being a room, so Cozy and Under one roof skip it.
6. **Noise:** Soundproofing makes its room Quiet, and the Nursery stays Quiet?
7. **Country Living:** +2 once for touching a Tree, Hallways left out?
8. **Parking:** reach and the Porch wait?
9. **Where it lands:** the data changes before the next playtest (with the fix PR or right after it), and Extend as its own phase?

---

## Appendix: the arms and scripts

| Arm | Seeds | What changes (in memory) |
|---|---|---|
| `base` | 200 | Nothing: today's content on the patched copy |
| `hpay` | 200 | Hallway and Long Hallway: +2 per room touching it, up to 4 |
| `hpay1` | 60 | The same at +1 a room |
| `hflank` | 200 | `hpay`, and the pay needs every tile flanked by rooms on 2+ sides (`flanked: 2`) |
| `hpack` | 100 | Hallway pack (up to 6 tiles, ten shapes), weight 20, complexity 2; Long Hallway weight 0 |
| `hpack+c3` | 60 | `hpack` at complexity 3 |
| `hpackpay` | 100 | `hpack` + `hpay` |
| `hpackIL` | 60 | Straight and L packs up to 4 tiles + `hpay` |
| `hpackflank`, `hpackflank6` | 100, 60 | `hpackpay` with `flanked: 2`; up to 4 and up to 6 rooms |
| `*-oldbot` | 200 | Round 1's pack arms, before the bot's separate cap for pack plays |
| `ext`, `ext2` | 200 | Extend any card of the four types, one or two levels |
| `extlim`, `ext2lim` | 200, 197 | Extend with spare cards only, one or two levels |
| `reach` | 200 | Bathroom: +2 per Bedroom within 2 steps (up to 3), −2 per touching Kitchen |
| `bathpay` | 200 | The same pay at one step |
| `reachmem+hpay` | 60 | The neighbor bonus of Grandma's Room, Ivy's Room, the Nursery and Nana's Room reaches 2 steps, with `hpay` (against `hpay`) |
| `gout` | 150 | Garage `category: 'outbuilding'` |
| `gpay` | 103 | `gout` + "+2 if a Driveway touches it" |
| `gcozy` | 103 | Cozy's condition skips Garages |
| `nurs`, `gnurs` | 103, 105 | Nursery tagged Loud and Kid; with `gout` |
| `gnurs+sq` | 100 | `gnurs` + Soundproofing grants Quiet and removes Loud on its room |
| `cl`, `clfix` | 100 | Country Living given at the first shop; today's, and "+2 if touching a Tree, not Hallways" |
| `porch`, `porchroof` | 100 | A 1×3 Porch (above); roofed counts its tiles for Under one roof |
| `hpay+ext2lim+gpay+clfixed` | 100 | The package (Country Living's fix without the gift) |

The scripts and every run's record are in the shared notes folder, `layout-sims/` (outside the repo, with a README): `patch.mjs` to `patch5.mjs` patch a copy of `src/rules`, `src/content` and `sim` at 0b9e9db (the extension play, reach, roofed tiles, the spare check, `flanked`, the bot's pack cap, and a speed-up that keeps the same plays); `variants.ts` holds the content changes; `ab.ts` runs an arm; `agg.ts` and `agg2.ts` make these tables; `draw.ts` draws a house; `extcheck.ts` made the extension-against-alternatives table.
