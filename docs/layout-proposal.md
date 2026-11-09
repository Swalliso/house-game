# Layout: Hallways, bigger rooms, the Garage, paths, reach, and a Porch

**Date:** 2026-11-09, after playtest 4. Updated the same day with your answers on fusion, detached Garages and paths, and the Hallway experiment. **Status:** a proposal for you to choose from. Nothing under `src/` or in the decision log changed on this branch. Step 1 of the Hallway experiment is built: D-114, merged into develop in Swalliso/house-game#21. The other entries in §9 are drafts (D-115 to D-118; the lot, draw and legibility sessions hold D-119 to D-122). The PR that builds what you pick adds them to `decisions.md`.

**Read with:** `docs/playtests/playtest-4-findings.md` (§2, §7, §9, §10, §12, §14, §16), D-046, D-074, D-080, D-093, D-101, D-102, D-106, D-112, D-114, the Parked "Merged rooms" entry, `content-brainstorm.md` §15, and `house-systems-review.md` §5.2 and §5.10.

## In short

- **The Hallway experiment: run it, as step 1 only.** Both Hallway cards pay +2 Comfort for each room they touch, up to 4. In 200 held-out runs halls become a real play (0.27 → 1.67 a run; 84% of runs build one): Wow +7%\*, Cozy +6\*, wins level. It loosens the outline a little (H1g −7\*). It's in develop now (D-114, Swalliso/house-game#21), and that PR's own check agrees (Wow ×1.08\*). Hold the pack: alone at complexity 2 it cost Wow (×0.81\*), and with the pay it sprawled (glance test −17.5\*). If the playtest shows halls bolted along the outside, pay only for halls that run between rooms.
- **Bigger rooms: fusion, 2 a run.** Your idea plays as well as Extend. A fusion joins a card to a room of its type as you place it, or knocks two built rooms of one type together, at ★★. Wow +14%\*, wins +2 (within noise), and 89% of runs use one. Almost all of its value is in joining as you place (1.4 a run); knocking built rooms together rarely pays. As a shop item (a Sledgehammer) it's bought about once every two runs and changes nothing. Joining by default would usually be right, but it would silently merge the Bedrooms you put side by side on purpose.
- **Detached Garages: yes, as you said.** It stands by the street or a Driveway and earns +2 when a Driveway touches it. It's built 0.50 times a run (0.03 today), 97% of the time detached, with wins and Wow level to slightly up. **Stone paths: as art first.** The board draws stepping stones from a detached Garage or other outbuilding to the nearest door. As a card, a Stone Path didn't help (Wow ×0.97, within noise).
- **Noise:** Soundproofing also makes its room Quiet, which gives it a job (installed 0.41 times a run, 0.10 today). A Loud Nursery didn't, and Cozy skipping Garages changed nothing. **Country Living** counts the woods once (+2 for touching a Tree): a quarter fewer poke-outs.
- **Not now:** reach (Wow ×0.95, within noise: sets still count only touching rooms) and a Porch (Wow ×0.81\*, wins −12.5\*: it takes the walls the house would grow into).
- **Together** (the Hallway pay, 2 fusions, the Garage by its drive, the Quiet Soundproofing, Country Living's fix): Wow +28%\*, Cozy +9\*, wins +8.5 (about the size of the bot's own noise), the glance test −4 (within noise). The game gets easier, mostly late (×1.06 by week 15, ×1.19 by week 25), so the targets need a new fit when fusion lands.
- **A caution on wins:** shifting the bot's random streams alone moved wins by 4–9 points on these seeds, while Wow moved 1–3% and Cozy, Under one roof and the glance test 4 points at most. So the Wow ratios carry the findings here, and a win difference under about 9 points isn't evidence on its own (How this was tested).
- **Order:** the Hallway pay is in develop (D-114). One more data PR before playtest 5 (the Garage, Soundproofing, Country Living, and stepping stones); then fusion as its own phase. The Hallway pack, a Stone Path card, reach and the Porch stay parked. Your questions are in §11.

---

## How this was tested

- **Seeds:** 200 held-out seeds per arm (`check-0…199`, 40 per Core client, the General Contractor), played by greedy at today's targets. The default `sim` seeds are the ones the targets were fit on, so they aren't used here (findings §12). Playtest 4's own numbers came from the fit seeds, which is why some of them differ below.
- **Changes in memory.** Content changes were made in memory, as the research's scratch scripts did. What data can't express went into a patched copy of the rules in the scratchpad, never `src/`: an extension play, a spare-card check, reach (`within: N` on a neighbor effect), a "between rooms" condition for Hallways, roofed tiles in Under one roof's outline, and a fusion count with a Fuse action. With today's content the copy plays exactly like the real rules, action for action. The scripts are in the shared notes folder (Appendix).
- **Paired.** Every arm plays the same seeds with the same clients, so differences are per seed. Wins: the difference in points, with a 95% interval from the seeds that only one arm won (as `--ban` and `--gift` report it). Wow: the geometric mean of the per-seed ratio. **\*** marks an interval that excludes no change.
- **Two rounds.** Round 1 tested the brief. Round 2 tested your answers (fusion, paths) and topped every arm up to all 200 seeds. That mattered: an arm that adds a card to the draw changes every later draw, so its runs barely pair with today's, and on the first 100 seeds today's game happens to win 63% (44% on the rest). Run only there, such an arm looked worse than it is: the Porch was −23 points on the first 100 seeds and is −12.5 on all 200. Every number here is on all 200 seeds, and nothing was tuned between rounds.
- **Measures:** win rate; plays a run of the piece in question; mean final Wow; Under one roof and Cozy held at the last tally (in brackets, the change in points); the glance test (G = H1g a compact outline, H2 no yard inside the house, and H3 one of each shared room; `house-systems-review.md`'s Appendix); and research.md's plausibility check.
- **The bot's own noise, and why "today" wins 54% here.** Every A/B run gives the bot a do-nothing action at the first shop, as `--gift`'s placebo does, so all arms take the same steps. That shifts the bot's step-keyed random streams. Without it, the scratch copy matches a plain `npm run sim -- --seed check` on all 200 seeds (44.5% wins, as D-114's own check measured on develop). With it, today's game wins 54%, and 49.5% with the placebo at the second shop instead. The game is the same in all three; only the bot's coin flips moved. Yet wins moved 4–9 points, and two of the three comparisons would have passed the win test above (+9.0 [+2.6, +15.4]\* and +5.0 [+0.1, +9.9]\*). Wow moved 1–3%, within its intervals, and Cozy, Under one roof and the glance test 4 points at most, none starred. **So a win difference under about 9 points isn't evidence on its own; the Wow ratio is the steadier measure.** Today's row and every arm share the placebo, so the comparisons stay paired. The Hallway pay held up on develop in the plain sim, without the placebo: wins 44.5% → 48.0% (+3.5, within noise), Wow ×1.077\*.
- **What greedy can't tell us.** It never plans: it won't leave a gap for a corridor, or keep a spot open for a later room. Where a rule rewards planning, the sim's numbers are a floor, and the playtest decides.

**Today, on these seeds** (with the placebo; see above): 54% of runs win, mean Wow 21,326 (median 21,531). At the last tally Under one roof holds in 77% of runs and Cozy in 68% (69% and 46% of all tallies). 50% of houses pass the glance test (H1g 70%, H2 79%, H3 83%), with 10.9 rooms, fill 0.65 and 20 corners at the median. A run builds 0.27 Hallways (25% of runs build one), renovates 2.77 times, builds 0.03 Garages, and installs Soundproofing 0.10 times.

---

## 1. Hallways

**The experiment: run it.** You asked to wait for this report. It said: run step 1 in the next build, and that's done: D-114, merged into develop in Swalliso/house-game#21. Both Hallway cards earn +2 Comfort for each room they touch, up to 4 (the card reads "+2 per touching room (up to 4)"), and nothing else changes: no pack, no new rule. Halls become a real play (84% of runs build one), Wow +7%\*, Cozy +6\*, and wins are level. The outline loosens a little (H1g −7\*). In the playtest, watch for halls bolted along the outside. If you see them, the fix is to pay only for halls between rooms (below).

### Why a link pays so little

D-046's link is already Combolands' rail rule: every room along a Hallway counts as touching every other. In Combolands a railroad is "neutral glue": it scores nothing, and its value comes from buildings whose effects read their neighbors' categories (research.md, "Neutral glue buildings"). Our rooms have few such effects: a Bathroom pays for one Bedroom, a Kitchen per Dining Room, a Bedroom per Quiet neighbor (up to 3). So a link adds little, a sensible player already puts those pairs side by side, and a link can bring a penalty too (findings §7). The Hallway has to be the payoff itself.

### The arms

- **Pay** (step 1, the findings' proposal): both cards earn +2 Comfort for each room they touch, up to 4 (+8). It's the existing `neighbor` effect.
- **Half pay:** +1 a room, up to 4.
- **Pack** (step 2): one Hallway card at the two cards' weight (20), complexity 3 → 2, the Long Hallway retired. The bots try ten shapes: straight 2–6, L 3–5, and T 4 and 6. Also with straight and L shapes up to 4 tiles, and at complexity 3.
- **Between rooms:** the pay counts only while **every tile of the hall has rooms on at least two of its four sides** (`flanked`, a new piece condition of about 15 lines). A corridor between two rows of rooms passes, and so does its end at the front door. A hall bolted along the outside, wrapped around a room, or stubbing into the yard doesn't. It still links whatever it touches (D-046); only the pay waits.

### What the sim says

| Arm | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Hallways a run |
|---|---|---|---|---|---|---|---|---|
| Today | 54% | — | 21,326 | — | 77% | 68% | 50% | 0.27 |
| **Pay** | 55% | +1.5 [−2.3, +5.3] | 22,701 | ×1.070 [1.009–1.135]\* | 78% (+1.5) | 74% (+6.0\*) | 47% (−3.5) | 1.67 |
| Half pay | 53% | −0.5 [−3.7, +2.7] | 21,565 | ×1.008 [0.965–1.052] | 78% (+1.5) | 72% (+4.0) | 48% (−2.5) | 0.93 |
| Pay, between rooms | 53% | −1.0 [−2.4, +0.4] | 21,639 | ×1.017 [0.979–1.055] | 78% (+1.0) | 71% (+3.0) | 52% (+1.5) | 0.25 |
| Pack alone | 44% | −9.5 [−17.4, −1.6]\* | 19,201 | ×0.814 [0.688–0.964]\* | 82% (+5.5) | 69% (+0.5) | 46% (−4.0) | 0.32 |
| Pack alone, complexity 3 | 51% | −2.5 [−6.0, +1.0] | 21,489 | ×1.006 [0.973–1.039] | 79% (+2.5) | 68% (0) | 47% (−3.5) | 0.33 |
| Pack + pay | 55% | +1.5 [−6.3, +9.3] | 22,172 | ×1.000 [0.850–1.177] | 76% (−1.0) | 82% (+14.0\*) | 33% (−17.5\*) | 2.13 |
| Pack (straight and L, up to 4) + pay | 54% | 0 [−8.2, +8.2] | 22,285 | ×0.993 [0.842–1.170] | 78% (+1.0) | 82% (+13.5\*) | 37% (−13.5\*) | 2.17 |
| Pack + pay, between rooms | 44% | −10.0 [−18.3, −1.7]\* | 19,154 | ×0.812 [0.682–0.967]\* | 81% (+4.5) | 69% (+1.0) | 50% (0) | 0.48 |
| … paying up to 6 rooms | 44% | −10.0 [−18.3, −1.7]\* | 19,119 | ×0.810 [0.681–0.964]\* | 81% (+4.5) | 70% (+1.5) | 50% (−0.5) | 0.48 |

The outline:

| Arm | Runs with a hall | Tiles a hall | Rooms along it | Corners (median) | Wedged yard pieces | H1g (compact) | H2 (no yard inside) |
|---|---|---|---|---|---|---|---|
| Today | 25% | 2.4 | 2.9 | 20 | 0.98 | 70% | 79% |
| **Pay** | 84% | 2.5 | 3.1 | 22 | 1.01 | 64% (−7\*) | 76% (−3) |
| Half pay | 62% | 2.5 | 3.2 | 20 | 1.02 | 68% (−2) | 75% (−4) |
| Pay, between rooms | 23% | 2.3 | 3.5 | 20 | 0.99 | 73% (+3) | 79% (0) |
| Pack alone | 28% | 4.2 | 3.5 | 20 | 0.92 | 71% (+1) | 73% (−6) |
| Pack alone, complexity 3 | 27% | 4.0 | 3.4 | 20 | 1.03 | 71% (+1) | 74% (−5) |
| Pack + pay | 88% | 4.1 | 3.9 | 24 | 0.98 | 53% (−18\*) | 68% (−11\*) |
| Pack (straight and L) + pay | 87% | 3.2 | 3.7 | 24 | 0.98 | 54% (−16\*) | 72% (−7) |
| Pack + pay, between rooms | 36% | 3.4 | 3.9 | 20 | 0.93 | 76% (+6) | 76% (−3) |

- **The pay works, modestly.** A run builds 1.67 halls (0.27 today), each touching about 3 rooms, and a Hallway earns about 610 Wow a copy (44 for the Hallway and 111 for the Long Hallway today). Wins +1.5 (within noise), Wow ×1.07\*, Cozy +6\*. That's smaller than the experiment on the fit seeds (findings §7: +5 points of wins, +11.6% Wow). D-114's own check on develop, without the placebo, agrees: Wow ×1.077\*, wins +3.5 (within noise), 1.65 halls a run.
- **The outline pays a little:** H1g −7\* as median corners go from 20 to 22, and the glance test −3.5 (within noise). Some halls go along an outside wall.
- **Half the pay isn't enough:** 0.93 halls a run, and wins and Wow level.
- **The pack alone loses, mostly through its complexity.** At complexity 2, Wow ×0.81\* and wins −9.5\*; at complexity 3 both are level (×1.01, −2.5). Complexity 2 puts it in the first phase's draws 6 times as often (30% of its weight against 5%), where a card that scores nothing takes a room's place.
- **The pack with the pay sprawls.** Wins level and Cozy +14\*, but the glance test −17.5\* (H1g −18\*, H2 −11\*), and median corners 24. Straight and L shapes up to 4 tiles sprawl about as much (−13.5\*).
- **"Between rooms" keeps the outline, and empties the halls.** With the pay it holds H1g and the glance test, but greedy builds 0.25 halls a run, as today: it never leaves a corridor-shaped gap. With packs it's a dead card again (Wow ×0.81\*).

### Where greedy puts a pack

Pack + pay, with the pay counting rooms touching the hall. Seed `check-22` (the Barkers, won; 22 corners), and `check-7` (the Barkers, won with 37,457; 44 corners, fill 0.50), one of the arm's worst outlines:

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

- **Done: the pay on both cards** (D-114, in develop). Pure data, and the halls start to pay.
- **Hold the pack.** The corridor art (D-111's runner) and the door marks work with the two cards as they are, so the look doesn't wait for it. If a pack comes back, it stays at complexity 3.
- **Keep "between rooms" ready.** If the playtest shows halls bolted along the outside, it's the one rule that turns their pay off and leaves real corridors paid. The cost: a hall pays only once rooms line it, so it's a plan, not a filler.

### Planning ahead, and the optional ideas

- **Stubbing out is already allowed:** a Hallway only has to touch the house. With the pay, a stub earns +2 now and +2 more for each room built along it later, so laying a hall first and building the wing around it is a plan you can see on the board. That's the planning the findings asked about, and it costs no new rule.
- **Member rooms that like halls** ("+2 along a Hallway") can't be written as data: connectors aren't neighbors. Reach does the same job (members' rooms reaching 2 steps, so a hall brings more rooms within reach). With the pay it changed nothing (−0.5 points, Wow ×1.01), likely for §4's reason: in a compact house most rooms are already within two steps.
- **A Bedroom wing set** (2 Bedrooms, a Bathroom and a Hallway, connected) can't be data either: sets connect through `neighbors`, which leave Hallways out. It needs a rule for connector members in connected sets (small, in `sets.ts`). Worth trying only if halls still feel flat after the playtest.
- **More rail-like rooms** are the other way to make links pay: room effects that read their neighbors' kinds ("+1 per Social room it connects to"), so a hall multiplies them as a Combolands railroad does. It touches many cards and every number, so it belongs to a balance pass.

---

## 2. Bigger rooms, round 1: Extend

Round 1 tested the brief's form; round 2's fusion (§3) builds on it, and §3 recommends fusion instead.

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

| Arm | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Extensions a run | Renovations a run | Rooms |
|---|---|---|---|---|---|---|---|---|---|---|
| Today | 54% | — | 21,326 | — | 77% | 68% | 50% | — | 2.77 | 10.9 |
| Any card, one level | 50% | −4.0 [−8.3, +0.3] | 20,839 | ×0.999 [0.955–1.045] | 78% (+1.5) | 70% (+1.5) | 52% (+1.5) | 0.85 | 2.58 | 10.4 |
| Spare cards, one level | 49% | −4.5 [−8.0, −1.0]\* | 21,221 | ×1.006 [0.977–1.035] | 78% (+1.0) | 70% (+1.5) | 51% (+1.0) | 0.57 | 2.65 | 10.6 |
| Any card, two levels | 56% | +2.5 [−3.8, +8.8] | 22,510 | ×1.136 [1.042–1.239]\* | 75% (−2.0) | 71% (+2.5) | 51% (+1.0) | 1.83 | 2.21 | 10.4 |
| Spare cards, two levels | 55% | +1.0 [−3.4, +5.4] | 22,405 | ×1.119 [1.056–1.185]\* | 75% (−1.5) | 70% (+1.5) | 54% (+4.0) | 1.18 | 2.32 | 10.7 |

Extensions a run by type (Bathroom / Bedroom / Living Room / Home Office): any card, one level 0.41 / 0.17 / 0.15 / 0.13; spare, one level 0.38 / 0.08 / 0.04 / 0.07; any card, two levels 0.57 / 0.56 / 0.43 / 0.27; spare, two levels 0.57 / 0.28 / 0.17 / 0.15.

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
- **At one level it may also be a trap.** Both one-level arms lose about 4 points of wins, within the bot's own noise (How this was tested), with Wow level. The seeds they lost mostly had a Bathroom extended (12 of 14, and 10 of 11), against 6 of the 8 seeds they gained, so it's a weak sign. The way it would happen is plain, though: "spare" for a Bathroom means the Bathroom rule holds *now*; a later Bedroom breaks it, and a second Bathroom would also have made a later Jack-and-Jill or Suite (sets pay per instance, which no week's preview shows). A player could fall into it the same way.
- **Two levels make it a real choice.** At the limit an extension beats Renovate about half the time (40–80%), so the decision turns on the room's surroundings: open ground or a Tree beside it, the box, the views. One card for two levels is worth the floor the room takes. At two levels the Bathroom extension looks like a good play: runs with one score ×1.20 against today on the same seeds.
- **Spare cards keep the house's rooms** (10.7 against 10.4 with any card): below the limit a card would often join a room instead of becoming one.

### What carries over to fusion

Two levels (★★), the rectangle no longer than 2:1, once per room, members never, the four names (Full Bath, Primary Bedroom, Great Room, Study) in Inspect and on the label, and the furniture: `rooms.ts` already lays out any footprint, so a bigger room draws today; it just looks sparse. The bigger names want a few more pieces in their slot lists: a bathtub and a sink for the Full Bath (LimeZu's interiors have them, findings §9), a second nightstand and a chest for the Primary Bedroom, a second seating group for the Great Room, and a bookcase for the Study. Kitchens and Dining Rooms stay on Renovate (an L-Kitchen can't make a rectangle). Renovate's chip and first-time hint are already in (D-112).

---

## 3. Fusion: knocking rooms together

**Your idea:** instead of a card joining a room by default, or a choice on every placement, make joining an ability, like demolish, reroll and strike, or an item from the shop.

### What a fusion does

- **A fusion knocks out the wall between two rooms of one type,** so they become one bigger room at ★★, by §2's rules: a rectangle no longer than 2:1, once per room, never a member's room.
- **One fusion, two ways to spend it:** as you place a card against a room of its type (the ghost offers "Join · 1 fusion"), or later, on two rooms already built (click the wall between them, as you click a piece to demolish it).
- **Where fusions come from**, in the two versions tested: the run gives you **2** (as it gives 2 demolitions), or a shop item gives one (a **Sledgehammer**: a common tool at the Dumpster's price, 2 budget).

### Three ways a room gets bigger

| | Join by default | Extend (§2) | Fusion |
|---|---|---|---|
| What happens | A card placed against a room of its type joins it, unless you flip the ghost | A spare card can join; the ghost shows both outcomes, and the default is a room of its own | Joining spends a fusion: as you place, or on two built rooms |
| What limits it | Nothing | Spare cards only | 2 a run (or what you buy) |
| The decision | Rare: flip when you want two rooms | Each time a spare card has a spot | When to spend a scarce fusion |
| Surprises | A card merges when you wanted two Bedrooms | None | None: nothing joins unless you spend one |
| Edge cases | Extend's | The rectangle, once per room, members never; counts never drop | Extend's; on built rooms also two fixtures, two levels, one room fewer for the house rules, and sets that break |
| Build cost | Extend's, with joining as the default | The extension play, the two-outcome ghost and its key, the chip, names, furniture | Extend's, plus a fusion count (state and HUD) and, for built rooms, a Fuse action (target a wall, preview, animation) |

### What the sim says

| Arm | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Joins a run | Built rooms fused a run | Runs that use one |
|---|---|---|---|---|---|---|---|---|---|---|
| Today | 54% | — | 21,326 | — | 77% | 68% | 50% | — | — | — |
| Extend, spare cards (§2) | 55% | +1.0 [−3.4, +5.4] | 22,405 | ×1.119 [1.056–1.185]\* | 75% (−1.5) | 70% (+1.5) | 54% (+4.0) | 1.18 | — | 70% |
| Extend, any card | 56% | +2.5 [−3.8, +8.8] | 22,510 | ×1.136 [1.042–1.239]\* | 75% (−2.0) | 71% (+2.5) | 51% (+1.0) | 1.83 | — | 88% |
| **Fusion, 2 a run** | 56% | +2.0 [−4.2, +8.2] | 22,494 | ×1.140 [1.043–1.246]\* | 75% (−1.5) | 72% (+4.0) | 55% (+4.5) | 1.42 | 0.04 | 89% |
| Fusion, 2 a run, built rooms only | 54% | 0 [−2.0, +2.0] | 21,484 | ×1.029 [0.994–1.064] | 78% (+1.0) | 70% (+1.5) | 50% (0) | — | 0.27 | 23% |
| Fusion from a Sledgehammer | 51% | −3.0 [−7.8, +1.8] | 21,054 | ×0.994 [0.961–1.028] | 80% (+3.0\*) | 71% (+2.5) | 47% (−3.0) | 0.21 | 0.05 | 26% |

Joins a run by type, 2 a run: Bathroom 0.37, Bedroom 0.47, Living Room 0.37, Home Office 0.20. The bot spends a fusion as soon as it raises the week's total, and values the Sledgehammer at about 60% of an average piece for the weeks left, or the best fusion it could make now if that's more.

- **As a run ability, fusion plays like Extend.** With 2 a run, wins +2.0 (within noise), Wow ×1.14\*, Cozy +4, glance test +4.5. Runs join 1.42 rooms, and 89% use one. Almost all of it is joining as you place; with both forms open, the bot fuses built rooms 0.04 times a run.
- **Knocking built rooms together is rarely worth it.** On its own it happens 0.27 times a run and changes nothing measurable. Two built rooms each earn on their own and each count for the house rules and sets, so fusing them loses one room's Comfort, and often a rule (A Bathroom for every two Bedrooms, Room for everyone) or a set (a Jack-and-Jill's two Bedrooms). In a 50-run check, fusing two built rooms would have gained in 19 of the 61 weeks it was possible (Bathrooms 13 of 36, Bedrooms 6 of 13, Home Offices never); in the other 42 it would have cost up to 31% of the week.
- **As a shop item it barely shows up.** The Sledgehammer is offered 0.72 times a run and bought 0.48 times; a quarter of runs use one, and wins and Wow don't move (−3.0, ×0.99, within noise). It competes with fixtures for budget and a supply slot, and comes when the shop happens to roll it.
- **Join by default would usually be right, which is its trap.** In 100 runs where any card could join for free, a card could join a room 2.9 times a run: greedy joined 194 times and kept the card separate 98 times, but only 8 of those 98 were on a spot where it would have joined. So a join-by-default rule is right about 96% of the time. The other 4% are deliberate: two Bedrooms side by side for a Jack-and-Jill. Joining by default merges them silently, and losing a Bedroom breaks Room for everyone or a set.

### Ability or shop item?

- **The run ability plays better.** It's there in nearly every run, so players learn it, and it's a decision about when to spend, like demolitions. It doesn't compete with fixtures for budget.
- **The shop item is too rare to learn.** If you want fusions in the shop too, a **service** is the closer match to demolish, reroll and strike: always there, priced 1, 2, 3, 4 as demolitions are. That wasn't tested.

### Edge cases (for built rooms)

- **Fixtures:** one per room (D-050). The bigger room keeps the older room's fixture, or the other's if it had none; a second fixture goes back to your supplies if a slot is free, otherwise it's lost, and the preview says which.
- **Levels:** the room goes to ★★; levels on the other room are absorbed.
- **Counts:** the house has one room fewer of that type. Room for everyone, A Bathroom for every two Bedrooms, Cozy's 6 rooms and Under one roof's minimum can drop; a client with a room maximum gains a room of headroom. Under one roof's outline doesn't change (same tiles).
- **Sets:** a set that used both rooms (a Jack-and-Jill's two Bedrooms) breaks; one that used one of them keeps the bigger room.
- **Limits (D-102):** fusing two Living Rooms takes the type below its limit, so the next Living Room card is placed as a room again, and can't renovate until a second one is built.
- **Never:** members' rooms, the Nursery and Kids' Room, Kitchens and Dining Rooms. Demolish and the Moving Truck act on the whole bigger room.

### Recommendation

**Fusion as a run ability: 2 fusions a run, spent as you place a card or on two built rooms** (D-115), instead of Extend with spare cards. It's your idea, it plays as well as Extend in the sim (Wow +14%\*, wins level), and it's simpler to explain than "spare": no Bathroom-ratio or two-office rule, and nothing joins unless you choose it. Renovate stays as it is (a card at its limit levels a room in place).
- **Default: a card stays separate.** When you have a fusion and the ghost touches a room of its type on a spot that makes a rectangle, it also shows "Join → Primary Bedroom ★★ · 1 fusion", and a key flips to it.
- **On built rooms:** a Fuse button beside Demolish, then click the wall between two rooms of one type. The preview shows the net change, which is often negative, and names the rule or set you'd lose. A knock-through animation sells it (D-059).
- **If the built-room form costs too much to build well** (the two-fixture rule, a broken set), ship joining as you place first: in the sim it's 97% of the use.

---

## 4. Reach through the house

### The sketch

- **A step** is one room to another that it touches or is linked to by a Hallway. **Reach N** means within N steps, going only through rooms. Yard pieces and lot features count only at one step, as they do today.
- **It shares the link groups; it doesn't add any.** `computeLayout` already turns each connected group of Hallways into links and folds them into `neighbors`. Reach is a breadth-first walk over `neighbors`, rooms only, cached per layout. The prototype is about 35 lines in `scoring.ts` and needs nothing from the Hallway code: every room along a hall is one step from every other, so a hall extends reach for free.
- **What stays at one step:** sets (touching or linked, D-065's timing), the Patio rule, Cozy, and `touching` conditions. Reach is only for effects that ask for it.
- **Data:** an optional `within: N` on a `neighbor` effect, then on auras and `touching` conditions if they need it. Card text: "+2 per Bedroom within 2 steps (up to 3)".
- **UI:** while a piece with reach is placed or hovered, the rooms within reach light up (Combolands' highlight, findings §13 item 5), and Inspect names the way ("Bedroom, 2 steps, through the Hallway").

### The A/B

The test piece was the Bathroom, the room reach suits best: "+2 per Bedroom within 2 steps (up to 3)" in place of today's "+3 if touching a Bedroom". The same numbers without reach separate the range from the pay.

| Arm | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Bathroom's Wow a copy |
|---|---|---|---|---|---|---|---|---|
| Today | 54% | — | 21,326 | — | 77% | 68% | 50% | 552 |
| Reach: +2 per Bedroom within 2 steps | 51% | −3.0 [−7.6, +1.6] | 20,919 | ×0.946 [0.888–1.009] | 79% (+2.0) | 67% (−1.0) | 50% (0) | 774 |
| The same pay, touching only | 53% | −1.0 [−4.7, +2.7] | 21,243 | ×0.973 [0.931–1.017] | 79% (+2.5) | 70% (+1.5) | 55% (+4.5\*) | 609 |
| Members' rooms reach 2 steps, with the Hallway pay (against the pay alone) | 55% (55%) | −0.5 [−2.7, +1.7] | 22,717 (22,701) | ×1.009 [0.981–1.038] | 78% (−0.5) | 75% (+1.0) | 46% (−1.0) | — |

- **Reach doesn't help, and costs a little.** With reach the Bathroom earns more, yet greedy wins 3 points less and scores 5% less (both within noise). The same pay at one step is level with today, and passes the glance test a little more often.
- **Why:** the sets still count only touching rooms. A Bathroom that reaches three Bedrooms from two steps away isn't in their Jack-and-Jill or Suite, so reach pulls Bathrooms away from the spots that pay most.
- **It does nothing for halls.** With Hallway packs and the pay, reach left Hallway plays where they were (2.33 a run either way, round 1's bot). In a compact house most rooms are already within two steps through other rooms, so a hall extends reach very little.

**Recommendation: park reach** (D-118). The mechanism is cheap and ready whenever an effect needs it. Try range on yard pieces first, where it's drawn and slid (findings §10), and come back to reach for effects that don't compete with the sets: a Fireplace that warms rooms within 2 steps, or noise that carries through rooms (§5).

---

## 5. The Garage, paths, and noise

### Today

- **The Garage is a room** (2×2, Loud) that must touch the house, and the street or a Driveway (D-112's card text says so now). The street lies off the lot, so in practice it sits in the bottom row or at a Driveway's end, touching the house: 78% of offers have no legal spot, and greedy builds 0.03 a run.
- **When it's built at the drive's end it costs Wow:** it's a room touching one other, so Cozy turns off, and it can clear a Tree a neighbor counted (your week 14: −48, none of it from Loud; findings §2).
- **Loud is nearly empty:** only the street, the Garage, the Playroom and the Pool. Soundproofing is installed 0.10 times a run and earns nothing in 96% of offers.
- **The Nursery is Quiet** (and Kid), though the twins are the household's loudest members.

**Your answers:** detached Garages, yes. Sidewalks or stone paths beside the Driveway: maybe, not certain.

### The arms

- **Outbuilding:** the Garage stands anywhere it touches the street or a Driveway, attached to the house or not. It isn't a room, so Cozy and Under one roof never count it. It stays Loud, Full House still needs one (that set doesn't need its members connected), and it counts toward A tidy yard like any outbuilding. Pure data (`category: 'outbuilding'`).
- **Outbuilding, +2 with a Driveway:** the Garage earns +2 if a Driveway touches it, so the drive and the Garage are a pair (D-080).
- **Cozy skips Garages:** the Garage stays a room, and Cozy neither counts it toward its 6 rooms nor needs it to touch two. Pure data.
- **Nursery Loud:** the Nursery is Loud instead of Quiet, until it grows into the Kids' Room.
- **Soundproofing makes its room Quiet:** on top of today's "Loud neighbors can't bother it", its room counts as Quiet and stops being Loud. Bedrooms pay for Quiet neighbors, so it has a job in every house.
- **A Stone Path card** (round 2, on top of the Garage with its Driveway pay): a yard pack, straight or L, up to 6 tiles, at a common card's weight (10) and complexity 2, from the second phase. It starts at the house, an outbuilding, a Driveway or another path, and earns +1 for each yard piece or outbuilding along it (up to 4). It never breaks A tidy yard, as Driveways don't.

| Arm | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Garages a run (detached) | Soundproofing installed a run |
|---|---|---|---|---|---|---|---|---|---|
| Today | 54% | — | 21,326 | — | 77% | 68% | 50% | 0.03 (0%) | 0.10 |
| Outbuilding | 55% | +1.0 [−1.4, +3.4] | 23,950 | ×1.042 [0.996–1.091] | 77% (0) | 71% (+3.0) | 52% (+2.0) | 0.40 (94%) | 0.10 |
| **Outbuilding, +2 with a Driveway** | 55% | +1.0 [−1.8, +3.8] | 23,975 | ×1.039 [0.991–1.088] | 77% (0) | 71% (+3.0) | 50% (0) | 0.50 (97%) | 0.10 |
| Cozy skips Garages | 54% | 0 [−1.4, +1.4] | 21,781 | ×1.014 [0.999–1.029] | 77% (+0.5) | 68% (0) | 50% (0) | 0.05 (0%) | 0.10 |
| Nursery Loud | 53% | −1.0 [−4.1, +2.1] | 21,198 | ×0.997 [0.969–1.026] | 78% (+1.5) | 69% (+0.5) | 52% (+1.5) | 0.03 (0%) | 0.12 |
| Outbuilding + Nursery Loud | 54% | 0 [−3.7, +3.7] | 23,494 | ×1.026 [0.973–1.081] | 78% (+1.5) | 71% (+2.5) | 54% (+3.5) | 0.40 (94%) | 0.11 |
| … + **Soundproofing makes its room Quiet** | 54% | 0 [−3.9, +3.9] | 23,706 | ×1.034 [0.977–1.094] | 80% (+3.0) | 72% (+4.0) | 53% (+3.0) | 0.41 (94%) | 0.41 |
| Outbuilding, +2 with a Driveway, **+ a Stone Path card** (against the Driveway-pay arm, whose numbers are in brackets) | 47% (55%) | −7.5 [−14.4, −0.6]\* | 22,175 (23,975) | ×0.968 [0.877–1.067] | 80% (+3.5) | 72% (+1.0) | 54% (+4.0) | 0.56 (98%) | — |

- **The outbuilding fixes the Garage.** It's built 13 times as often (0.40 a run), nearly always detached by the street or a drive. Cozy holds a little more often (+3), and the outline is a little tidier (H1g 73% against 70%), because the Garage no longer juts out of the house; wins and Wow a little up, all within noise.
- **The Driveway pay makes them a pair.** 0.50 Garages a run, each earning about 480 Wow (260 without it). It gives D-080's Driveway a job whenever a Garage comes.
- **Cozy skipping Garages does nothing,** because the Garage is almost never built as a room. With the outbuilding the question goes away.
- **A Loud Nursery doesn't give Soundproofing a job.** The Nursery is built 0.18 times a run, so Soundproofing goes from 0.10 to 0.12 installs. Keep the Nursery Quiet.
- **A Quiet Soundproofing does:** 0.41 installs a run, with wins and Wow level.
- **A Stone Path card doesn't help.** It's offered 2.2 times a run and built 0.51 times, at about 300 Wow a copy, and Wow is level (×0.97, within noise). Wins drop 7.5 points\*, but a drop that size is within the bot's own noise (How this was tested), so it's a weak sign, not a finding.

### Stone paths

The look you're after (a property whose buildings are joined by walks) doesn't need a card:
- **Stepping stones as art** (recommended): the board draws a stone path from each detached outbuilding (the Garage, the Greenhouse, the Treehouse) to the nearest door or Driveway, and a front walk from the front door to the street. No rule, no draw, no cost to the run. The house model already knows the doors, and the yard layer already autotiles Driveways.
- **A Stone Path card, later and only if it earns a place:** as the yard's Hallway, linking the yard pieces along it the way a Hallway links rooms (D-080's Combolands rail note), late in the draw (complexity 3), and not as a wall-hugging pack. Linking yard pieces needs the link code to reach the yard, so it isn't data.

### Country Living

Country Living gives every piece +1 per touching Tree tile, up to 3, which is what paid for your office poke-out and your Hallway's +30 (findings §2). The fix counts the woods once: **+2 if it touches a Tree**, Hallways left out. Both arms get Country Living at the first shop, as `--gift` does, so every run has it.

| Arm (Country Living given) | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Pieces touching 2+ Tree tiles | Fill (median) |
|---|---|---|---|---|---|---|---|---|---|
| Today's Country Living | 68% | — | 25,833 | — | 79% | 69% | 54% | 3.81 | 0.65 |
| **+2 once for touching a Tree** | 65% | −2.5 [−7.4, +2.4] | 24,884 | ×0.963 [0.911–1.017] | 80% (+1.0) | 71% (+1.5) | 55% (+1.0) | 2.79 | 0.66 |

- **A quarter fewer poke-outs** (3.81 → 2.79 pieces a run touching two or more Tree tiles), with the house rules about as well held.
- **The gift stays worth taking:** 65% of runs win with the fixed gift, 68% with today's, and 54% with none on the same seeds.

### Recommendation

One decision (D-116): **the Garage is an outbuilding that stands by the street or a Driveway and pays +2 when a Driveway touches it; stepping stones join detached buildings to the house, as art; Soundproofing makes its room Quiet; the Nursery stays Quiet; Cozy stays as it is.** Country Living's fix is its own small entry (D-117).

---

## 6. A Porch or Deck

### What was tested

A **Porch**: a 1×3 yard piece built against a room (Outdoor, Social), +1 per room it touches (up to 3), +2 in the front yard, at a common card's weight (10) from the first phase. A **roofed** version also counts its tiles toward Under one roof's outline, as a covered porch would.

| Arm | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Porches a run | Rooms |
|---|---|---|---|---|---|---|---|---|---|
| Today | 54% | — | 21,326 | — | 77% | 68% | 50% | — | 10.9 |
| Porch | 41% | −12.5 [−21.3, −3.7]\* | 19,194 | ×0.808 [0.671–0.973]\* | 73% (−3.5) | 64% (−4.5) | 37% (−13.0\*) | 1.23 | 10.6 |
| Porch, roofed | 44% | −9.5 [−18.1, −0.9]\* | 19,445 | ×0.827 [0.692–0.989]\* | 70% (−6.5) | 65% (−3.5) | 38% (−12.0\*) | 1.10 | 10.6 |

- **It's a trap card.** It pays at once (about 480 Wow a copy) against a wall, and the walls are where the house grows. Greedy lays porches along the sides early, and later rooms go around them: the runs it loses build 9.7 rooms, against 12.1 today on the same seeds, and the score falls behind from week 5 (×0.97 by week 8).
- **Roofing it makes Under one roof worse,** not better (−6.5): its tiles stick out of the box.
- **A pack along the outside walls would block more,** not less.

**Recommendation: not now** (D-118). If a porch comes later, try it as a **fixture** of a room on the front row: a porch drawn outside the room's wall that takes no tile, so it can't block the house. The lot session's sunny-side idea (Sun A) would give it a natural home.

---

## 7. Everything recommended, together

The Hallway pay, 2 fusions a run, the Garage as an outbuilding with its Driveway pay, the Quiet Soundproofing, and Country Living's fix (in the runs that buy it; no gift). Round 1's package had spare-card Extend in place of fusion, and no Soundproofing.

| Arm | Wins | Δ wins, points [95%] | Mean Wow | Wow ratio [95%] | Under one roof | Cozy | Glance | Hallways / joins / Renovations / Garages a run |
|---|---|---|---|---|---|---|---|---|
| Today | 54% | — | 21,326 | — | 77% | 68% | 50% | 0.27 / — / 2.77 / 0.03 |
| Round 1's package | 59% | +5.5 [−0.1, +11.1] | 27,685 | ×1.242 [1.137–1.357]\* | 75% (−2.0) | 79% (+11.0\*) | 47% (−3.0) | 1.36 / 1.15 / 2.13 / 0.50 |
| **The recommended package** | 62% | +8.5 [+2.0, +15.0]\* | 28,166 | ×1.280 [1.145–1.432]\* | 77% (0) | 77% (+9.0\*) | 46% (−4.0) | 1.40 / 1.39 / 2.16 / 0.47 |

- **The game gets easier: Wow +28%\*, Cozy +9\*.** 124 of 200 runs clear all seven targets, against 107 today (+8.5 points\*). A win difference that size is within the bot's own noise, but with scores 28% higher the runs surely win more; how much more is for the re-fit's own check.
- **Mostly late, but not only.** Against today on the same seeds the score is ×1.03 at week 5, ×1.05 at week 10, ×1.06 at week 15, ×1.11 at week 20 and ×1.19 at week 25. Playtest 3 found the middle of the run too easy, and this adds a little there. Re-fit the targets with the sim when fusion lands (D-089's check on held-out seeds); the data PR alone moves less (each of its pieces was within noise on its own).
- **The outline holds:** median corners 20, the glance test −4 (within noise). The halls' looser outline is mostly made up by the detached Garage.
- **Room cards go further:** about 3.5 a run improve a room (1.4 joins, 2.2 Renovations), against 2.8 today. Soundproofing is installed 0.37 times a run.

---

## 8. What this means for the other sessions

**The draw brainstorm** asked four things. With these recommendations:
- **The Hallway stays two cards** (the Hallway and the Long Hallway), each with the +2-a-room pay. No pack card. They belong in the Layout row under its rule (a card goes in the row of where it's built).
- **The Garage stands detached**, as an outbuilding by the street or a Driveway: a Layout card.
- **No Porch, Deck or Stone Path card.** Paths are art.
- **Bigger rooms come from fusions** (2 a run), not from spare cards. A late room card is a room or a Renovation, as today; fusions add about 1.4 joins a run, so the Rooms row stays useful late about as it does now.
- **One finding for the draw itself:** a new card that comes early in the draw can cost the run. The Hallway pack at complexity 2 did (Wow ×0.81\*; level at complexity 3), and so did the Porch (×0.81\*); the Stone Path, from the second phase, didn't clearly (×0.97, within noise). A Layout row open from week 1 should be checked for the same thing, on Wow rather than wins.

**The legibility deep-dive** asked what a fusion chip needs to show:
- On a room card: **Joins** when a room of its type has a spot that makes a rectangle and a fusion is left, with the count ("Joins · 2"), beside Renovate (D-112). Renovate first, then Joins, then sets, as that proposal orders the chip row.
- On the ghost: the outcome and the cost ("Join → Primary Bedroom ★★ · 1 fusion"), and the key that flips it.
- In the HUD: fusions left, beside demolitions.

---

## 9. Draft decisions

### D-114 · The Hallway experiment, step 1: Hallways pay for the rooms they touch
**Built:** merged into develop in Swalliso/house-game#21, and its entry is in `decisions.md` there (Proposed): the pay, no pack for now, a pack's terms if one comes back, and the "between rooms" fix, as drafted here, with that PR's own check (Wow ×1.077\*, wins +3.5, within noise). One note it leaves out, for if a pack comes back: the sim's greedy then needs a separate shortlist cap for Hallway-pack plays (8, apart from `HINT_CAP` in `sim/policies/greedy.ts`), since their many link-hinted shapes push other cards' plays off the shortlist.

### D-115 · Bigger rooms: fusion, 2 a run
**Status:** Proposed (draft) · 2026-11-09, from playtest 4 (findings §9), the Parked "Merged rooms" entry, your fusion idea, and `docs/layout-proposal.md` §2–3.
**Decision:**
- Each run starts with **2 fusions**. A fusion joins two rooms of one type into one bigger room at ★★ (+8 Comfort): a card as you place it against a room of its type, or two rooms already built (a Fuse action beside Demolish: click the wall between them). It's a free action; the week goes on.
- The two rooms' tiles must make a rectangle no longer than 2:1: Bathroom → Full Bath (1×2), Bedroom → Primary Bedroom (2×4), Living Room → Great Room (3×4), Home Office → Study (2×2). Once per room. Never members' rooms, Kitchens or Dining Rooms.
- The bigger room is one piece (`PlacedPiece.shape`), one room of its type everywhere (rules, sets, counts, limits). It keeps the older room's uid and fixture; a second fixture goes back to the supplies if a slot is free. It takes its bigger name in Inspect and on its label.
- A card stays separate by default. The ghost offers "Join → Primary Bedroom ★★ · 1 fusion" when you have a fusion and it touches a room of its type on a spot that makes a rectangle, and a key flips to it. The Fuse preview shows the net change and names any rule or set it breaks.
- A room card's chip shows **Joins** (with the count) beside Renovate; the HUD shows fusions left beside demolitions.
- Renovate stays as D-102 has it.

**Why:** your idea, and it plays as well as the brief's Extend. With 2 a run: Wow ×1.14\*, wins +2 (within noise), Cozy +4, and 89% of runs use one, nearly all as a card is placed (1.4 joins a run). A one-level extension (the brief's +4) added nothing (Wow ×1.00: it's a weaker Renovate); a two-level extension from a spare card did about as well as fusion (Wow ×1.12\*), but "spare" needs extra rules for Bathrooms and Home Offices. A Sledgehammer in the shop was bought 0.48 times a run and moved nothing. Joining by default is right 96% of the time but silently merges Bedrooms placed side by side on purpose.
**Changes:** D-102 (Accepted): a room can grow as well as level up. The Parked "Merged rooms" entry becomes this. D-097's "rooms never merge" stands: a fused room is one room with one wall around it. Art: a few furniture pieces for the four bigger rooms, and a knock-through effect (D-059).

### D-116 · Detached Garages by the drive, stepping stones, and a Quiet Soundproofing
**Status:** Proposed (draft) · 2026-11-09, from playtest 4 (findings §2), your answer on detached Garages and paths, and `docs/layout-proposal.md` §5.
**Decision:**
- The Garage is an **outbuilding**: it stands anywhere it touches the street or a Driveway, attached to the house or not. It isn't a room, so Cozy, Under one roof, and the room counts never count it. It stays Loud, keeps its budget every 3 weeks, still counts for Full House, and counts toward A tidy yard. Card text: "Must touch the street or a Driveway."
- It earns **+2 if a Driveway touches it** (once).
- **Stepping stones** (art only): the board draws a stone path from each detached outbuilding to the nearest door or Driveway, and a front walk from the front door to the street.
- **Soundproofing** also makes its room Quiet (and not Loud). Loud neighbors still can't bother it.
- The Nursery stays Quiet. Cozy is unchanged. No Stone Path card (D-118).

**Why:** today 78% of Garage offers have no legal spot and greedy builds 0.03 a run; when one is built at the drive's end, it can turn Cozy off. As an outbuilding with the Driveway pay, it's built 0.50 times a run (97% detached), with wins and Wow level to slightly up. A Loud Nursery gave Soundproofing almost nothing to do (0.12 installs a run); a Quiet Soundproofing is installed 0.41 times a run.
**Changes:** D-080 (Open): the Driveway gets a partner. D-112's Garage text changes again. Art: the Garage drawn as a building in the yard, its car with it, and the stepping stones.

### D-117 · Country Living counts the woods once
**Status:** Proposed (draft) · 2026-11-09, from playtest 4 (findings §2).
**Decision:** Country Living gives every piece except Hallways **+2 if it touches a Tree** (once), instead of +1 per touching Tree tile, up to 3.
**Why:** the per-tile count paid for poke-outs: a room reaching into the woods for +3, and your Hallway's +30. The fix cuts pieces touching two or more Tree tiles by a quarter (3.81 → 2.79 a run), and the gift stays worth taking (65% of gifted runs win, against 68% today and 54% with no gift).
**Changes:** content only (`blueprints`).

### D-118 · Not now: reach, a Porch, and a Stone Path card
**Status:** Proposed (draft) · 2026-11-09, from `docs/layout-proposal.md` §4–6.
**Decision:**
- **Reach** waits. The sketch, for when an effect needs it: a step is one room to another that it touches or is linked to by a Hallway; reach N is within N steps, through rooms only. An optional `within: N` on a `neighbor` effect walks the layout's `neighbors` (about 35 lines, cached per layout). Sets, Cozy, the Patio rule and `touching` conditions stay at one step. First candidates: yard pieces' range, then effects that don't compete with sets (a Fireplace's warmth, noise through rooms).
- **No Porch or Deck card.** If one comes, try it as a fixture of a front-row room, drawn outside its wall, taking no tile.
- **No Stone Path card.** Paths are art (D-116). If one comes, as the yard's link, late in the draw.

**Why:** a Bathroom paying "+2 per Bedroom within 2 steps" lost 5% of Wow (within noise), because sets still count only touching rooms. A Porch against the walls cost about a fifth of the score (Wow ×0.81\*, ×0.83\* roofed; wins −12.5\* and −9.5\*). A Stone Path card didn't help (Wow ×0.97, within noise).
**Changes:** none.

---

## 10. Recommended order

1. **Before playtest 5, one data PR:** D-116 (the Garage as an outbuilding with its Driveway pay, the Quiet Soundproofing, the Garage's yard sprite and the stepping stones) and D-117 (Country Living). The Hallway pay (D-114) is already in develop. All content, card text and art; no new rules. Run `npm run sim -- --check` once.
2. **Playtest 5 watches for:** halls bolted along the outside (then "between rooms"), whether a detached Garage and its stones read as a garage and a walk, and whether Soundproofing gets bought.
3. **Next phase, D-115 (fusion), with its own playtest:** the fusion count; joining as you place (the ghost's Join option and its key); the Fuse action on built rooms (target a wall, preview, the knock-through); the names, the four rooms' furniture, the chip and the HUD count. Then re-fit the targets, since the full package scores 28% more.
4. **Parked:** the Hallway pack, reach, the Porch, and a Stone Path card (D-118).

---

## 11. Questions for you

1. **The Hallway experiment:** step 1 is in develop (D-114). If playtest 5 shows halls bolted along the outside, switch the pay to "between rooms"?
2. **Bigger rooms:** fusion, 2 a run, instead of Extend with spare cards?
3. **Fusion's two forms:** both (as you place, and on built rooms), or joining as you place first?
4. **Fusions from the shop:** none for now, or a service later (1, 2, 3, 4 budget, as demolitions)?
5. **The Garage:** detached by the street or a Driveway (your yes), with +2 when a Driveway touches it?
6. **Paths:** stepping stones as art, and no Stone Path card for now?
7. **Noise and the woods:** Soundproofing makes its room Quiet, the Nursery stays Quiet, and Country Living pays +2 once for touching a Tree?
8. **Not now:** reach and a Porch?
9. **Where it lands:** the data PR before playtest 5, and fusion as its own phase with a target re-fit?

---

## Appendix: the arms and scripts

Every arm ran on all 200 held-out seeds unless noted.

| Arm | What changes (in memory) |
|---|---|
| `base` | Nothing: today's content on the patched copy, with the placebo at the first shop, as every arm has |
| `base-noplacebo`, `base-placebo2` | The null checks: `base` without the placebo (the same as `npm run sim -- --seed check`, seed for seed), and with it at the second shop |
| `hpay` | Hallway and Long Hallway: +2 per room touching it, up to 4 |
| `hpay1` | The same at +1 a room |
| `hflank` | `hpay`, and the pay needs every tile flanked by rooms on 2+ sides (`flanked: 2`) |
| `hpack` | Hallway pack (up to 6 tiles, ten shapes), weight 20, complexity 2; Long Hallway weight 0 |
| `hpack+c3` | `hpack` at complexity 3 |
| `hpackpay` | `hpack` + `hpay` |
| `hpackIL` | Straight and L packs up to 4 tiles + `hpay` |
| `hpackflank`, `hpackflank6` | `hpackpay` with `flanked: 2`; up to 4 and up to 6 rooms |
| `*-oldbot` | Round 1's pack arms, before the bot's separate cap for pack plays (the same picture: pack alone −9.0\*) |
| `ext`, `ext2` | Extend any card of the four types, one or two levels |
| `extlim`, `ext2lim` | Extend with spare cards only, one or two levels |
| `fuse2` | 2 fusions a run (join as you place, or fuse built rooms), two levels |
| `fuseonly2` | 2 fusions a run, built rooms only |
| `fusetool` | No fusions; a Sledgehammer tool (common, 2 budget) gives one |
| `ext2j` | `ext2` again on 100 seeds, logging where a card could have joined |
| `reach` | Bathroom: +2 per Bedroom within 2 steps (up to 3), −2 per touching Kitchen |
| `bathpay` | The same pay at one step |
| `reachmem+hpay` | The neighbor bonus of Grandma's Room, Ivy's Room, the Nursery and Nana's Room reaches 2 steps, with `hpay` (against `hpay`) |
| `gout` | Garage `category: 'outbuilding'` |
| `gpay` | `gout` + "+2 if a Driveway touches it" |
| `gcozy` | Cozy's condition skips Garages |
| `nurs`, `gnurs` | Nursery tagged Loud and Kid; with `gout` |
| `gnurs+sq` | `gnurs` + Soundproofing grants Quiet and removes Loud on its room |
| `gpay+path` | `gpay` + the Stone Path card (above) |
| `cl`, `clfix` | Country Living given at the first shop; today's, and "+2 if touching a Tree, not Hallways" |
| `porch`, `porchroof` | A 1×3 Porch (above); roofed counts its tiles for Under one roof |
| `hpay+ext2lim+gpay+clfixed` | Round 1's package (Country Living's fix without the gift) |
| `hpay+fuse2+gpay+sq+clfixed` | The recommended package |

The scripts and every run's record are in the shared notes folder, `layout-sims/` (outside the repo, with a README). `patch.mjs` to `patch6.mjs` patch a copy of `src/rules`, `src/content` and `sim` at 0b9e9db: the extension play, reach, roofed tiles, the spare check, `flanked`, the bot's pack cap, a speed-up that keeps the same plays, and fusion (the count, the Fuse action, the bot's use of it, and the shop bot's value for a fusion tool). `variants.ts` holds the content changes; `ab.ts` runs an arm (`NOPLACEBO=1` drops the placebo, `PLACEBO_SHOP=2` moves it, `OUTNAME` names the output); `agg.ts`, `agg2.ts` and `final-tables.sh` make these tables; `draw.ts` draws a house; `extcheck.ts` made the extension-against-alternatives table.
