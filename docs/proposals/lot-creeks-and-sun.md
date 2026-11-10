# The lot: creeks and the sun (brainstorm)

**Date:** 2026-11-09. **Status:** the user picked the recommended package (§7) on 2026-11-09. Its first part, the creek lots, Creekside, the pond and the lot traits, is D-119 in the decision log; the sun (Sun A and its payoffs) comes next, as its own entry. §8 below is the draft as it stood before that split. **Correction:** §2 says the creek changes need no target re-fit. Built on develop, they raised greedy's wins by 9.5 points on 200 held-out seeds, half from the rarer creek and half from Creekside (D-119 has the split), so they belong in the planned re-fit. **From:** playtest 4 ("creeks feel too common"; "I rarely use the sunny side, it's usually far from where I build"), §11 of the playtest-4 findings.

## The short version

- **Creeks are common and change nothing.** Two lots in three have one; creek lots win and score like the rest, and 41% of the houses on them never touch the creek. **Recommended:** a creek on about a quarter of lots, as a special lot with a payoff, **Creekside** (pieces touching the creek earn +50%), named by a chip on the contract. It pulls the house to the water (pieces touching the creek 2.0 → 4.7 a house). The pond stays on every creekless lot and goes on half the creek lots.
- **The sun moves 0.3% of the Wow today,** because no room wants sun and the band is usually far from the house. No design fixes that by itself: the payoffs set how much the sun matters, and the design sets where and how often it does.
- **Recommended: Sun A, the sunny face.** Each lot has a sun direction, and a room with a wall facing it, open in front, is Sunny. It reaches 98% of runs, changes the value of more than half of greedy's plays, and lays the house out the way real houses are: the Living Rooms and Kitchens take the sunny face (86% and 83% Sunny), the Bedrooms fall where they may (38%). About a day of rules and one or two on the board. B (shade) gives about the same for twice the work; C (two clearings) is the half-day fallback, but the sun still does nothing in a quarter of runs.
- **Payoffs for rooms:** the Living Room, the Kitchen, the L-Kitchen and the Dining Room +2 while Sunny, and the Sunroom in the weekly draw at +6 while Sunny. The sun becomes about 4% of the Wow (6% without the Count). No Sunny set: the Breakfast Nook tried here swamped everything and can break, against D-065.
- **Count Vladislav keeps "Sunny pieces earn nothing",** which becomes a real puzzle under A, and Blackout Curtains also take Sunny away. His wins drop about 12 points under A until his target is re-fit.
- **Lot traits** as chips under the contract's map (Creek, the sun's side, Wooded), so the lot becomes a reason to pick a contract.
- **All of it together**, 300 held-out seeds: greedy wins 57% against 44% today, before a re-fit; the targets would rise 23% at the first milestone and 3% at the last. It rides the re-fit planned after the balance pass, per client.
- Eight questions for you are in §9.

**How the numbers were made:** a scratch copy of the rules where the sun's design, the creek rate and the pond rate are switches (with every switch off it reproduces the shipped sim, run for run), plus a probe that scores every week twice, with the lot's sun and without it. Greedy, the General Contractor, the five Core clients in turn, on the held-out `check-*` seeds, never the targets' fit seeds. The appendix has the method and where the scripts are.

---

## 1. Today, measured

600 greedy runs on `check-0` to `check-599`:

| | |
|---|---|
| Greedy wins | 47.8% (44–52%) |
| Lots with a creek | 66.5% (`creekPct` is 70; some lots are regenerated) |
| Lots with a pond | 100% |
| Wins on creek lots / creekless lots | 47.4% (n 399) / 48.8% (n 201) |
| Pieces touching the creek, on creek lots | 1.9 a house |
| The house within 1 tile of the sunny band / more than 8 tiles away | 33% / 37% |
| Rooms that are Sunny at the end | 1.3 of 10.9 |
| **The sun's share of Wow** (each week scored with and without it) | **0.3%** (0.5% without the Count) |
| Wow of the Sunny-reading pieces (Herb Garden 0.55%, Sunroom 0.21%, Greenhouse 0.10%) | 0.9% |
| Runs where the sun helped / hurt / did nothing | 32% / 11% / 57% |

- **A creek changes nothing for greedy:** creek lots win as often as creekless ones, and score the same (20,828 against 20,572 mean Wow). So the creek rate is a question of variety and feel, not balance, and changing it needs no target re-fit (§2 checks this).
- **The sun is close to irrelevant:** it moves 0.3% of the Wow, it does nothing at all in more than half the runs, and in one run in four that it does touch, it costs more than it gives. Only a Herb Garden or a Sunroom (a Showroom special) ever earns from it; Heat wave and Count Vladislav take from it; Solar Panels pays budget for it.
- **Why the sun is far away:** the band is 4 rows on the back, left or right edge, never the street's, and greedy's houses sit a median 7 rows from the street. A band on the back edge is out of reach for most houses; a band on a side edge reaches the house when it's in that corner.
- **No room wants sun.** Today being Sunny gives a room nothing, and Heat wave halves it. So even a player who builds on the band gains almost nothing.

## 2. Creeks

**Findings**
- D-049 put "a creek on most lots" on purpose, so the house's bank would be a decision. In practice 41% of houses on creek lots never touch the creek (165 of 399), and creek lots win and score like creekless ones (§1). For most runs the creek is scenery that also blocks a few spots.
- On a job board of three contracts, a creek lot shows up on 96% of boards today. At 40% it would be 78%; at `creekPct` 25 (23% of lots once failed lots are redrawn), 54%: about one board in two.

**Options**
- **About 40%, nothing else.** Creeks get less samey, and nothing else changes. They stay scenery.
- **About 25%, as a special lot with its own payoff (recommended).** About one board in two offers a creek lot, and it's worth taking: the contract shows a **Creekside** trait, and pieces touching the creek earn +50% there (Waterfront's effect, for the creek only, free on that lot). It pulls the house to the water, which is what D-049 wanted from the creek, and it's a reason to pick that contract (§3).
  - At `creekPct` 25, 23% of lots end up with a creek (a lot that fails its checks is redrawn). Lowering the rate leaves every lot that keeps its creek exactly as it is today; the others are redrawn without one.
  - The rate alone changes nothing for greedy: overall wins 48.5% against 44.5% today (200 seeds, inside the noise; only the redrawn lots can change).
  - **Creekside on the same 46 creek lots:** pieces touching the creek 2.0 → 4.7 a house, houses that never touch it 17 → 7, mean Wow +12% (17,847 → 20,043), wins 15 → 26. Those 46 lots happen to be hard ones (today's creek lots win 47% overall), so the win count is loose, but the pull to the water is plain. Over all runs it's worth about +3% of the Wow, so the targets don't need to move for it.
  - If +50% feels like too much of a prize, +25% is the obvious step down; what matters is that the chip names a payoff.
- Other payoffs considered for a creek lot, for later: a Footbridge piece drawn only on creek lots (a yard piece over the creek that links the banks; new content and art); a Waterfront blueprint guaranteed in the first shop (needs a lot-aware shop).

**The pond**
- Today every lot has one (2×2 to 3×3). It's the only water on a creekless lot, a view for the rooms beside it, and what the Waterfront blueprint pays for there; 0.8 pieces a house touch it.
- **Recommended: a pond on every creekless lot and on half the creek lots,** so every lot keeps its water and a creek lot looks different. Then 87% of lots have a pond, and greedy doesn't notice (51.0% wins against 48.5% with a pond on every lot, 200 seeds): it's a look-and-feel call.
- A pond on 60% of all lots was also tried: 55% of lots got one, about one lot in eight had no water at all (12%), and houses touched a pond far less (0.3 pieces a house, from 0.9), for no change in play (46.0% wins against 44.5%, 200 seeds). Less water for nothing in return.

## 3. Lot traits on the job board

**Today** a contract shows its lot as a small map and a line of words ("A pond, a creek, woods, and 2 boulders · sunny on the right"). Nothing about a lot makes one contract better than another, so the pick is all about the client.

**Proposal:** one to three trait chips under the map, in the kit's chip style, each with a one-line tip. A trait is something the lot has that changes how you'll build, computed from the lot (a pure function in the rules, so the sim and tests can see it):

| Chip | On | Tip | Payoff |
|---|---|---|---|
| **Creek** | creek lots (§2) | "Creekside: pieces touching the creek earn +50%. Only a Driveway crosses it." | +50% by the creek, as a run modifier from the lot |
| **Sun ←** (the sun's side, with a sun on the map's edge) | every lot under A or B | "Rooms with a wall facing the sun, open in front, are Sunny." | none of its own: it tells you which face of the house to give the living rooms |
| **Two sunny clearings** | every lot under C | "Pieces on the bright grass are Sunny." | none of its own |
| **Wooded** | lots with 100+ Tree tiles, about a quarter (the median lot has 86) | "Trees give Bedrooms and Living Rooms their views, and shade." | none of its own |

- **What makes it a reason to pick:** a payoff the lot carries (Creekside), and traits that suit the client. The contract card already marks a client's tastes with up and down icons; a trait chip can take the same up icon when it suits that client (Wooded for Count Vladislav, who likes Trees and shade; Creek for Juniper, who wants rooms with a view). That's a small content table (trait → clients it suits), not a rule.
- **During the run** the trait stays on the checklist panel beside the crew's chip, so the +50% isn't forgotten after the job board.
- **Cost:** the trait function and Creekside's modifier source in the rules (the run's modifiers already come from blueprints, the crew, the client and change orders; the lot becomes one more source), the chips and tips on the contract card and the checklist, How to play's lot lines. About a day.

## 4. Three sun designs

All three were built in the scratch copy and played by greedy. The rules as prototyped:

- **A · The sunny face (passive solar).** Each lot has a sun direction: the back, the left, the right or the street side, a quarter each, drawn from the lot's seed on a stream of its own, so every lot's terrain stays as it is. A tile is in the sun unless it's a Tree, or a Tree, a room or an outbuilding stands on the next tile toward the sun (the lot's edge and the street count as open). A room or outbuilding is **Sunny when it has a tile in the sun**: in practice, a wall that faces the sun with open ground or a yard piece in front of it. Yard pieces don't become Sunny (the Pool keeps its own tag); a garden still counts its tiles in the sun (the Herb Garden). The sunny band goes away.
  - It's how houses are really laid out: the living rooms take the sunny face, bedrooms don't mind, and the Count wants it shaded or given to closets and the garage.
  - Building changes the sun, but only next door: a room built in front of a Sunny room takes its sun (its wall isn't outside any more), and clearing a Tree in front of a wall gives it sun.
- **B · Shade.** As A, but a Tree, a room or an outbuilding shades the 3 tiles behind it, away from the sun, and a building is Sunny when one of its tiles is out of every shadow. The woods throw long shadows, the house's wings shade each other, and a Sapling that grows into a Tree shades what's behind it.
- **C · Sunny clearings.** Two clearings of about 21 tiles (a disc 5 tiles across), one in each half of the lot, centered 3–9 rows from the street. The rest is today's rule: a piece on a sunny tile is Sunny.

One finished house (greedy, the Hendersons, seed `check-3`, the lot's bottom 11 rows), with the sun on the right, read by each rule:

```
A · sunny face            B · shade                 C · clearings
 SS·····*·····PPP·······   SS·····*·····PPP·······   SS     *     PPP
··················YYYYYY  ··················YYYYYY                 ···yyyyyy
· T*T· T·····*····Y·YY··    T*T  T·····*····Y·YY··    T*T  T     *····y yy
*····· TTTT··· T··YTYY··  *···   TTTT·   T  YTYY··  *····· TTTT   ·T··yTyy
····· TTTT········*LLL··  ···   TTTT······  *LLL··   ·····TTTT    ····*lll
····· TTTT T·· cwbbLLLOO  ···   TTTT T   cwbbLLLOO   ·····TTTT T   CWBBllloo
····· TTTT···· DDbbbbTOO  ···   TTTT··   ddbbbbTOO    ··· TTTT     ddBBbbToo
··············*DDYYbbwBB  ············  *ddyybbwBB                *ddyybbwbb
·············YYKKYYTBBBB  ············ yykkyyTBBBB               yykkyyTbbbb
·········*···YYKKlllBB··  ·········*·· yykklllBB··           *   yykklllbb
············YYYY lllT···  ············YYyy lllT···              yyyy lllT
street══════════════════  street══════════════════  street══════════════════
```

Capital letters are Sunny rooms, small ones aren't: **L** Living Room, **K** Kitchen, **D** Dining Room, **B** Bedroom, **W** Bathroom, **C** Closet. **O**/o an outbuilding, **Y**/y a yard piece on a tile in the sun or in shade. `·` is ground in the sun; a blank is shade (A: the one tile behind a Tree or a building; B: the three tiles behind; C: everything outside the clearings). T Tree, `*` boulder, P pond, S the Old Shed. Sunny rooms: A 5 of 11 (the upper Living Room, the Kitchen and the Dining Room beside the yard pieces, and the two Bedrooms on the right-hand wall), B 3 (Trees and the house's own wings shade the rest), C 3 (whichever rooms happened to land on the right-hand clearing).

### What each costs

| | A · sunny face | B · shade | C · clearings |
|---|---|---|---|
| **Rules** | `Lot.sun` replaces `sunnySide`/`sunnyRows`. `layout.ts` builds the sun mask from the house (≈35 lines in the prototype) and gives Sunny to buildings only. `estimate.ts`: a building shades its own back tiles (≈30 lines), reads `{is: …}` conditions (5 lines; nothing uses them today), and needs a **sun hint** so a play that takes a Sunny room's sun is scored exactly (not in the prototype). `text.ts`: "in the sun"; `{is: Sunny}` must read "while Sunny" (today it would print "if a Sunny neighbor"). Tests. **About a day.** | A's work, plus a 3-tile reach: the hint covers Sunny pieces up to 3 tiles behind a play, and a Sapling's transform changes the sun at a week's start, so the preview's upcoming timers should say so. **About two days.** | `lot.ts` only: the clearings' mask on the `Lot` (≈45 lines). `isSunny` keeps its signature, so every painter, the job board's map and the estimate work unchanged. **Half a day.** |
| **The board** | A sun outside the lot's edge on its side (like the STREET label) and on the job board's map. A Sunny room shows light through its sunny wall: the Skylight's patch of sun on the floor, by that wall (`house-paint.ts` already paints one). A soft one-tile shadow behind Trees and buildings. While placing, the ghost carries a sun badge when it would be Sunny. | The shade itself on the ground. Today's sunny and shaded grass and the sun-edge autotile (`sunny.ts`) paint any mask, but this one changes with every placement, so it leaves the terrain layer (re-rendered only when terrain changes, D-049) for a layer of its own, and the ghost previews its shadow on hover. The woods' shadows cover a lot of grass: the lot's look changes the most. | Today's art on the clearings instead of the band. No new art. |
| **Preview** | `preview()` recomputes the layout, so it's already exact. Inspect's "Sunny · on the sunny side" becomes "Sunny · its west wall faces the sun", and a room that loses its sun needs a reason ("the Kitchen stands in front of its sunny wall"). | As A, plus reasons that name a shadow's source up to 3 tiles away ("in the Greenhouse's shadow"); the changed pieces can include pieces the play doesn't touch. | Nothing new. |
| **Sim** | The estimate changes above. | The estimate changes above, with the longer hint. | Nothing new. |

### What each does

**With today's content, no design makes the sun matter.** Nothing pays a room for being Sunny, so a design only moves the sun's costs around (200 seeds, the same for every row):

| | Today (band) | A | B | C |
|---|---|---|---|---|
| Greedy wins | 44.5% | 41.0% | 44.0% | 46.0% |
| The sun's share of Wow | 0.4% | −0.5% | −0.1% | 0.3% |
| Sunny rooms a house | 1.1 of 10.8 | 3.5 | 2.6 | 0.8 |
| Count Vladislav's sun share | −0.3% | −3.5% | −2.0% | −0.2% |

Under A the Count pays for the sunny face and nobody gains from it. So every design needs the payoffs (§5). **With the light payoff package** (social rooms +1 while Sunny, the Sunroom in the draw, the Greenhouse +2 while Sunny), the same content for all four, 500 seeds:

| | Today | Band + payoffs | **A · sunny face** | B · shade | C · clearings |
|---|---|---|---|---|---|
| Greedy wins | 46.0% | 49.0% | 48.6% | 50.4% | 51.6% |
| … paired with today | – | +69/−54 | +78/−65 | +81/−59 | +77/−49 |
| The sun's share of Wow (without the Count) | 0.4% (0.6%) | 2.0% (2.8%) | 2.4% (3.8%) | 2.2% (3.3%) | 2.0% (2.6%) |
| Sunny rooms a house (of about 11) | 1.3 | 3.1 | **4.1** | 3.3 | 2.4 |
| Runs where the sun did nothing | 56% | 29% | **2%** | 5% | 27% |
| Plays the sun touched (200 seeds) | 11% | 37% | **56%** | 55% | 34% |
| … the sun's part of those plays' value | 1.3% | 4.1% | 7.9% | 6.9% | 3.6% |
| Living Rooms / Kitchens / Bedrooms that are Sunny (48 runs, no Count) | 15% / 20% / 20% | 68% / 68% / 36% | **86% / 83% / 38%** | 75% / 78% / 34% | 52% / 73% / 22% |
| The house within a tile of the sun | 32% | 57% | every house has a sunny face | every house | 63% |
| The house's front row, rows from the street (median) | 8 | 9 | 8 | 7 | 4 |
| Count Vladislav's wins (100 runs) / his sun share | 48% / −0.2% | 47% / −0.7% | 36% / −3.4% | 41% / −2.4% | 45% / −0.7% |
| Targets would move (M1 / M4 / M7) | – | 0% / +1% / −1% | +7% / +3% / −2% | +7% / +2% / −1% | 0% / +1% / +1% |

What the rows say:
- **The payoffs, not the design, set the sun's share:** with the same content the band, A, B and C all land at 2–2.5% of the Wow. With payoffs, greedy even walks to today's band (within a tile of it in 57% of runs, from 32%).
- **The design sets the reach and the shape of the house.** Under A the sun reaches 98% of runs and 4 rooms a house, it changes the value of more than half the plays greedy makes, and greedy lays the house out the way people do: the Living Room and the Kitchen take the sunny face (86% and 83% of them Sunny) while Bedrooms and Bathrooms land wherever (38%, 20%, as with no payoffs at all). With the band, greedy moves the whole house to the lot's edge instead (Bathrooms 30% Sunny). C's clearings pull the house toward the street (its front row a median 4 rows back, from 8), which wins a few points by itself, since houses near the street win more (D-089); but in a quarter of runs the sun still does nothing, and it touches a third of the plays.
- **B gives about what A gives** (3.3 Sunny rooms against 4.1, the same share and reach) for twice the rules work and the busiest board. Its extra depth, the woods' and wings' shade, mostly shows as fewer Sunny rooms.
- **Count Vladislav pays for A:** his sunny face earns him nothing, about 3.4% of his Wow, and his wins drop from 48% to 36%. §6 has the fixes.
- **Wins move a few points with any of them** (C's +5.6 is the only clear one), and the targets would move by 7% at most, at the loose first milestone, so the light package needs no re-fit of its own.

## 5. Sunny payoffs

Today only the Herb Garden (1×2, +1 a tile on the sunny side) and the Sunroom (a Showroom special, +2 a tile) earn from the sun: 0.9% of the Wow between them. The packages tried, all of them data except the set:

| | Today | Light | Rooms | Medium | Full |
|---|---|---|---|---|---|
| Living Room, Kitchen, L-Kitchen, Dining Room | – | +1 while Sunny | +1 or +2 while Sunny | +1 while Sunny | +2 while Sunny |
| Sunroom | Showroom only; +2 a tile on the sunny side | weekly draw, weight 5 from Foundation; +4 while Sunny | in the draw; +6 while Sunny | in the draw; +6 while Sunny | in the draw; +6 while Sunny |
| Greenhouse | +50% to touching gardens | and +2 while Sunny | as today | and +3 while Sunny | and +3 while Sunny |
| Herb Garden | +1 a tile in the sun | as today | as today | +2 a tile | +2 a tile |
| **Breakfast Nook** (new set) | – | – | – | – | a Kitchen and a Dining Room, both Sunny, touching: +10 Comfort, +0.5 Charm |

Under Sun A (200 seeds, the same for every row):

| Package | Greedy wins | paired with today | The sun's share of Wow (without the Count) | Sunny pieces' Wow | Plays the sun touched | Targets would move (M1 / M4 / M7) |
|---|---|---|---|---|---|---|
| Today's game (the band) | 44.5% | – | 0.4% (0.7%) | 0.9% | – | – |
| A, no payoffs | 41.0% | +10/−17 | −0.5% (0.4%) | 1.4% | 29% | – |
| A, light | 50.0% | +38/−27 | 2.3% (3.5%) | 2.5% | – | +7% / +4% / −1% |
| A, rooms +1 | 49.5% | +38/−28 | 1.6% (2.7%) | 2.5% | 53% | +7% / +5% / −1% |
| **A, rooms +2** | **55.0%** | **+41/−20** | **4.2% (5.8%)** | 2.5% | **55%** | **+19% / +10% / +1%** |
| A, medium | 47.5% | +33/−27 | 5.6% (7.5%) | 6.7% | 57% | +10% / +7% / +2% |
| A, light + Breakfast Nook | 62.5% | +55/−19 | 11.4% (13.2%) | 2.6% | 75% | +11% / +17% / +7% |
| A, full (with the Nook) | 66.0% | +60/−17 | 16.3% (19.3%) | 5.7% | – | +26% / +25% / +12% |

"Plays the sun touched" is the share of greedy's placements whose value (against a pass) the sun changed by at least 1 Wow; "–" where that run didn't record it. "Paired" counts the seeds a package won that today's game lost, and the other way round.

- **The Breakfast Nook is the big lever:** added to the light package it takes the sun from 2.3% to 11.4% of the Wow and greedy's wins from 50% to 62.5%. A set is the game's main reward, so a Sunny set would make the sun part of the core loop, but at this size it swamps everything else, and it has a catch: under A or B a later room can take a member's sun and break the set, which D-065 promises never happens to a set the house holds. If it comes back, it should be smaller (+5 Comfort, +0.25 Charm) and the preview must call out the break.
- **Yard payoffs are flat buffs under A.** With a one-tile shadow almost the whole yard is in the sun, so "+2 a tile in the sun" on the Herb Garden (the medium package) just raises it everywhere: the medium package's 5.6% share is partly that. Under A the payoffs that create a decision are the rooms'; the Herb Garden and the Greenhouse can stay as they are. (Under the band, B or C the yard's sun is a real place, and their yard payoffs would be decisions.)
- **A client wish is the cheapest targeted payoff:** "Three Sunny rooms" for Juniper ("a small house, beautifully done"), mirroring the Count's "Three Dark rooms", is a checklist line in data (`count {room ∧ Sunny} ≥ 3`), worth the usual +0.25 Charm. Not simulated.
- **Wording:** the generated text for `{is: {tag: 'Sunny'}}` reads "+2 every week if a Sunny neighbor"; it should read "+2 while Sunny" (a small `text.ts` change). The Herb Garden's "per tile on the sunny side" becomes "per tile in the sun".

## 6. Count Vladislav, Heat wave, and the other Sunny readers

**Count Vladislav** (Dark pieces +100%, "Sunny pieces earn nothing", touching a Tree +50%, Herb Gardens −100%):
- **Today** the band is far from where he builds, so the taste costs him 0.3% of his Wow and never shapes his house.
- **A:** every house has a sunny face, and what stands on it earns him nothing. That's a vampire's puzzle with a real answer: put the Closets, Bathrooms, the Garage and the Hallway on the sunny side, keep the Trees in front of it, or build inward (he wants three Dark rooms anyway). Greedy, which looks a week ahead, mostly pays the cost instead: with the light package his wins drop from 48% to 36% (100 runs) and the sun takes 3.4% of his Wow. With the recommended rooms +2 package it's 35% against 47% (60 runs), since the other clients' rooms gain and his don't.
- **B:** shade is easier to find, since a Tree up to 3 tiles out shades a wall, so siting the house in the woods' shadow is his move. His wins 41% (100 runs), the sun −2.4% of his Wow.
- **C:** he avoids the clearings, which sit where houses go. His wins 45%, the sun −0.7% of his Wow: about today.
- If A's cost is too steep, three fixes, cheapest first: lower his `targetPct` in the next re-fit; let Blackout Curtains take away Sunny too (data; it gives his fixture a job); or soften the taste to "Sunny pieces earn half". The last was tried and isn't recommended: with the light package it gave back about half of what the sun took from him (his mean Wow +6%) without moving his wins (43% against 45%, 40 runs), and once Sunny rooms earn more it turns the sun into a gain for him (+12% of his Wow with the full package), which is backwards for a vampire.

**Heat wave** ("Pools and pieces in the shade earn double, and Sunny rooms earn half"):
- Today Sunny rooms are rare, so it's a shade bonus with a footnote.
- Under A or B it's a real swing: for a phase, the sunny living rooms earn half while the rooms by the Trees earn double, and it reads exactly as worded. "In the shade" should stay "touching a Tree": read as "not in the sun", it would double every interior room.
- Under C, as today.

**The other Sunny readers:**
- **Solar Panels** (Sunny pieces pay 1 budget every 4 weeks): under A, about 4 Sunny rooms a house makes it about +1 budget a week by midgame. The shop bot never buys it ("values Wow, not budget"), so the sim can't see this; watch it in a playtest, or make it rooms only and every 6 weeks.
- **Skylight** (an interior room becomes Sunny): with the payoffs, an interior Living Room with a Skylight earns the sun bonus, which helps one of the weak fixtures (about a third of its offers are worth 0 or less today).
- **The Pool** is Sunny by its own tag in every design, so the Count's "no Pool" holds.
- **Cold snap**, a phase effect the playtest-4 findings propose (§5: Sunny rooms +100%, Pools earn nothing), only has teeth under A or B, where a house has about 4 Sunny rooms. With today's band (1.3 a house) it would mostly pay nothing.

## 7. Recommendation

1. **Creeks on about a quarter of lots, as a special lot.** `creekPct` 25, the Creekside trait (+50% for pieces touching the creek) and a Creek chip on the contract. The pond on every creekless lot and half the creek lots. Independent of the sun, small, and it can ship first.
2. **Sun A, the sunny face.** It's the design that reaches nearly every run (98%) and every house (4 rooms of 11), and it shapes the house the way real houses are shaped: with a reason to, greedy puts the Living Room and the Kitchen on the sunny face and leaves the Bedrooms and Bathrooms where they fall. It stays local (one tile), so the preview, the estimate and the board stay simple: about a day of rules and a day or two on the board. B gives about the same numbers for twice the work and the busiest board; keep its idea (Trees cast a longer shadow) for later if A feels flat. C is the cheap fallback (half a day, no new art) if the team wants the smallest change now.
3. **Payoffs for rooms, not the yard:** the Living Room, the Kitchen (and L-Kitchen) and the Dining Room +2 while Sunny, and the Sunroom in the weekly draw at +6 while Sunny. That makes the sun about 4% of the Wow (6% without the Count; it's 0.3% today), and it changes the value of more than half the plays greedy makes. Wins rise about 10 points, mostly in the first milestones, which are loose today; it rides the one target re-fit planned after the balance pass. No Sunny set for now.
4. **Count Vladislav keeps "Sunny pieces earn nothing",** so under A his house has a puzzle (shade the sunny face, or give it the closets and the garage), and Blackout Curtains also take away Sunny. His wins dip under A before a re-fit (§6); his `targetPct` goes into that re-fit.
5. **Lot traits on the job board:** Creek, the sun's side and Wooded, as chips with tips under the lot's map, kept on the checklist panel during the run.

**All of it together** (creeks at 25% with Creekside, the pond rule, Sun A, rooms +2), 300 seeds:

| | Today | All of it |
|---|---|---|
| Greedy wins | 44.3% | 57.3% (+70/−31 paired) |
| The sun's share of Wow (without the Count) | 0.4% (0.6%) | 4.4% (5.8%) |
| Plays the sun touched | 11% (seeds 300–499) | 57% |
| Runs where the sun did nothing | 55% | 2% |
| Lots with a creek / a pond | 67% / 100% | 22% / 87% |
| Creek lots against the other lots: wins / mean Wow | 42% against 50% / 20,437 against 21,706 | 55% against 58% / 23,650 against 22,722 |
| Pieces touching the creek, on creek lots | 2.0 | 5.3 |
| Targets would move (M1 / M4 / M7 / the final score) | – | +23% / +10% / +3% / +6% |
| Wins by client: the Hendersons, the Count, the Barkers, Juniper, Dale (60 runs each) | 47%, 47%, 43%, 35%, 50% | 47%, 35%, 68%, 72%, 65% |

- The win jump is the re-fit's job, and it has to be per client (each client's `targetPct`, as D-085 fitted them): Juniper and the Barkers move up the most, the Count moves down. 60 runs a client is ±12 points, so the re-fit should use the usual fit seeds, not these.
- On the same seeds, creek lots go from scoring 6% below the other lots to 4% above them, and win about as often (55% against 58%, 67 creek lots): a reason to pick one, not a free win.

**Order, if you pick this:** the creek PR first (the rate, the pond rule, Creekside and the chips); then Sun A's rules and payoffs with the text fix and the sun hint, sim-checked and re-fit; then the board (the sun marker, the lit floors, the shadows, the ghost's badge), which could ride the juice PR. A playtest after the second.

## 8. Draft decision

This would go into `docs/decisions.md` with the first PR that builds any of it. D-112 and D-113 are on develop now (playtest 4's quick fixes, Swalliso/house-game#19; Inspect's click to hold, Swalliso/house-game#20), and other sessions' drafts claim D-112 to D-118 (layout, which has to move its first two), D-121 (draw) and D-122 (legibility). So this one keeps D-119; whoever merges renumbers if needed.

### D-119 · The lot: creek lots, a sun direction, and lot traits
**Status:** Proposed · 2026-11-09, from playtest 4's lot findings (a brainstorm; nothing built). For the team to pick.
**Decision:**
- **Creek lots:** `creekPct` 25 (was 70): about one lot in four has a creek (23% once failed lots are redrawn), and a contract's card says so. A creek lot carries **Creekside**: pieces touching the creek earn +50%, a run modifier that comes from the lot. The pond stays on every creekless lot and goes on half the creek lots, so every lot has water.
- **The sun's direction (Sun A):** each lot has a sun direction, the back, the left, the right or the street side, a quarter each, drawn on the lot's own `lot/<attempt>/sun` stream, so no lot's terrain changes. A tile is in the sun unless it's a Tree, or a Tree, a room or an outbuilding stands on the next tile toward the sun; the lot's edge and the street count as open. A room is Sunny when one of its tiles is in the sun: in practice, when one of its walls faces the sun with open ground or the yard in front. Yard pieces and outbuildings aren't made Sunny by the sun (the Pool keeps its own tag); a garden still counts its tiles in the sun. The 4-row sunny band (`sunnySide`, `sunnyRows`) retires.
- **Sunny payoffs:** the Living Room, the Kitchen, the L-Kitchen and the Dining Room earn +2 while Sunny. The Sunroom joins the weekly draw at weight 5 from Foundation and earns +6 while Sunny (it was a Showroom special at +2 a sunny tile). Cards say "while Sunny"; the estimate reads `{is: …}` conditions and has a sun hint, so a play that takes a Sunny room's sun is scored exactly.
- **Count Vladislav** keeps "Sunny pieces earn nothing". Blackout Curtains also remove Sunny.
- **Lot traits:** a contract shows chips under its lot's map: Creek, the sun's side, Wooded (100+ Tree tiles), each with a one-line tip and the client's up icon when the trait suits them. The lot's traits stay on the checklist panel during the run.
- **The board:** a sun outside the lot's edge on its side, and on the job board's map; a Sunny room shows the Skylight's patch of sun by its sunny wall; a one-tile shadow lies behind Trees and buildings; the ghost carries a sun badge when the room would be Sunny; the inspect panel names the wall that faces the sun, and why a room lost its sun.

**Why:** In playtest 4 creeks felt too common and the sunny band was usually far from the house. On 600 held-out seeds, creek lots win and score like creekless ones, and 41% of houses on them never touch the creek; the house was within a tile of the band in a third of runs, and the sun moved 0.3% of the Wow and did nothing at all in more than half the runs. No design fixes that alone: with today's content the sun stays under 0.5% under all three. With rooms that want sun, Sun A reaches 98% of runs, puts the living rooms on the sunny face (86% of Living Rooms against 38% of Bedrooms, with the light package), and makes the sun about 4% of the Wow. It's how houses are really laid out, it gives the Count a puzzle, and it stays local, so the preview and the bots stay simple. Creekside pulls houses to the water (pieces touching the creek 2.0 → 4.7 a house) and gives a creek lot a reason to be picked.

**Considered:**
- **B, shade** (3-tile shadows from Trees and buildings): about A's numbers (3.3 Sunny rooms against 4.1, the same share and reach) for twice the rules work, a shade layer that redraws on every placement and on hover, and changes that reach pieces the play doesn't touch. Kept as a later step, for Trees only, if A feels flat.
- **C, two sunny clearings near the street:** the cheapest (lot generation only, today's art), and it draws houses toward the street; but in a quarter of runs the sun still does nothing, and it shapes the first rooms rather than the house.
- **Keeping the band and adding the payoffs:** greedy walks to the band (57% of houses within a tile), so the share matches A's, but the house moves to the lot's edge instead of turning to the sun.
- **Payoffs:** +1 a room (1.6% of the Wow, too faint); yard payoffs (flat buffs under A, since the yard is nearly all in the sun); the Breakfast Nook set (a Sunny Kitchen touching a Sunny Dining Room: +9 points of share and +12 of wins on its own, and a later room could break it, against D-065).
- **Creeks at 40%** with no payoff: less samey, still scenery. **The pond on 60% of lots:** one lot in eight would have no water, for no change in play (46.0% wins against 44.5%).
- **The Count at "Sunny pieces earn half":** it gave back half his sun cost with the light package without moving his wins (40 runs), and with bigger Sunny payoffs it made the sun a gain for him (+12% of his Wow): backwards for a vampire.

**Costs:** rules about two days (the sun, the payoffs and their text, the sun hint, the traits and Creekside's modifier source, tests); the board one to two days (the sun marker, lit floors, shadows, the ghost's badge, the chips); a target re-fit, per client, since greedy wins 10 to 13 points more before it, mostly at the first three milestones. Old run codes get the usual "The content has changed" note. Solar Panels gets stronger under A (about 4 Sunny rooms a house), which the sim can't see because its shop bot never buys it: a balance-pass item.

**Changes:** D-049 (Accepted): "a creek on most lots" becomes "a creek on about a quarter of lots, with Creekside", "the sunny side" becomes "the sun's direction", and the pond's line. D-099 (Accepted): its sunny-side bullet (the band's grass and edge) gives way to the sun marker, the lit floors and the one-tile shadows. D-078 (Open): the house's orientation and the lot's traits are two of its answers. D-065 (Accepted) is untouched as long as no set reads Sunny. Docs: implementation-plan.md (Appendix A's lot bullets; the Herb Garden, Sunroom and Greenhouse rows), content-brainstorm.md (the Sunny side row), How to play's sunny-side line, the inspect panel's region chip.

## 9. Questions for you

1. **Creeks:** about 25% as a special lot with Creekside (+50% by the creek), or about 40% with no payoff? If Creekside, is +50% the right size, or +25%?
2. **The pond:** on every creekless lot and half the creek lots, or on every lot as today?
3. **The sun:** A (the sunny face), B (shade) or C (two clearings)? And under A or B, may the sun come from the street side?
4. **How much the sun should matter:** rooms +2 and the Sunroom in the draw (about 4% of the Wow, wins +10 before a re-fit), or rooms +1 (about 2%, no re-fit needed)? A smaller Sunny set later, or none?
5. **Count Vladislav under A:** keep "Sunny pieces earn nothing" (a real puzzle; his wins dip until the re-fit), with Blackout Curtains removing Sunny, or soften it to "earn half"?
6. **The job board:** which chips (Creek, the sun's side, Wooded)? Should a chip carry the client's up icon when the trait suits them?
7. **Juniper:** add a "Three Sunny rooms" wish, the Count's "Three Dark rooms" turned around?
8. **The re-fit:** fold this into the one planned after the balance pass, or re-fit when the sun ships?

---

## Appendix: method and files

- **The prototype** is a scratch copy of `src/rules`, `src/content` and `sim/` with the sun's design, `creekPct`, a pond rate and a pond rate on creek lots as lot-balance switches, a set filter (a set whose members must match a selector, for the Breakfast Nook), and the estimate reading `{is: …}` conditions and a building's own shade. With every switch off it reproduced the shipped sim's final scores on `check-0`…`check-11` exactly. About 200 lines changed in all; the diff, the scripts and every run's record are saved outside the repo (below).
- **Runs:** greedy as `npm run sim` builds it, the General Contractor, client `i mod 5` on seed `check-i` (as `--check` does), the enclosure probe off (it doesn't change play). Variants are paired on the same seeds; the tables compare each variant with today's game on the seeds both played.
- **The sun's share of Wow:** before each week-ending play, the sim scores the play twice, once on the real lot and once with the lot's sun switched off (no tile in the sun; pieces keep their own tags, so the Pool stays Sunny). The share is the sum of the differences over the sum of the weeks' totals. It counts what the sun takes away too (Heat wave, the Count), so it can be negative.
- **The Sunny pieces' Wow** is the sim's own per-piece attribution for the Herb Garden, the Sunroom, the Greenhouse and the Pool (what §11 of the findings measured), whatever made it.
- **Plays the sun touched:** for the play greedy chose, its value against a pass, with the sun and without it; the play is touched when the two differ by 1 Wow or more.
- **What the targets would do:** for each milestone, the median over seeds of (the variant's score ÷ today's score) when both reached it. A re-fit would move the targets by about that much (D-044's fit is α × greedy's median).
- **Noise:** a change reshuffles many seeds both ways (typically +45/−30 of 300), so win rates within about 6 points of each other at 300 runs aren't different. The sun's share and the Sunny rooms are much steadier.
- **Files** (outside the repo, in the shared notes folder `side-session-notes/local_f4f68684-fc04-4823-a703-de48e2a1e32a/lot-creeks-sun-prototype/`): `prototype.diff` (the scratch copy against develop at 0b9e9db), the scripts (`variants.ts` defines every variant named here; `exp-run.ts` and `runv.sh` run them; `agg.ts`, `lotstats.ts`, `targets.ts` and `bytype.ts` make the tables; `viz.ts` drew §4's figure), and `results/`, one JSON line per run for every variant. To rerun one, apply the diff to a develop checkout at 0b9e9db, copy the scripts to its root, make an `out/` folder beside the checkout, and run e.g. `./runv.sh A_Pl 500 check 300` (plays `check-300`…`check-499`); the folder's README has the rest.
