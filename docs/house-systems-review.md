# Building up without sprawling: a systems review (2026-11-06)

**Status:** on 2026-11-06 the team chose option B with every recommended default (`decisions.md` D-093). M4 built it as D-101 to D-105, with the client numbers from its sim in D-108 and the arrivals' rules in D-109, for playtest 4 (pull request #17). §6's "M5: showing it" moved to M5a's juice pull request, after M4 (D-097's juice note): the arrivals as markers on the progress bar, "Topped out!", and D-094's option 1. M4 already pops a room's level badge on a Renovation (D-111). *Updated 2026-11-08.*

A systems review for D-093, after the team's note of 2026-11-06. Houses needn't "look exactly like a normal house", but they should "look vaguely house like instead of sprawling about and having multiples of rooms every which way". And the game should achieve "that combolands feeling of progressively building something out and planning ahead" while working within the constraints of the theme.

## The short version

- **Why houses sprawl:** the rules pay a town's way of building.
  - Each copy of a room earns in full, and each room earns from its own Trees and views, so the next copy goes somewhere new.
  - There's nothing better to do with a card than place it, and nothing requires the yard to touch the house.
  - Greedy's typical win is a half-empty box with a ragged edge, averaging 3.4 Living Rooms and 2.7 Kitchens. Greedy is the sim's bot: it takes each week's best-scoring play and never plans. The Appendix defines every term.
- **The idea:** a town grows by spreading out. A house grows by **filling in** (the outline), **filling up** (the household), and **settling in** (better rooms, not more of them). Its grounds are where spreading out belongs.
- **The recommendation, option B:**
  - Every client's checklist starts with seven **house rules**, each worth +0.25 Charm while it holds:
    - Room for everyone
    - a Bathroom for every two Bedrooms
    - One Kitchen
    - a living room or two
    - Under one roof
    - Cozy
    - a tidy yard
  - A room card whose type is at its limit can **renovate** the room you already have instead.
  - The **household grows on a schedule** you can see from week 1: the twins at Framing (a Nursery), and Grandma at Drywall (her room and a Bathroom). Each member's room pays for particular neighbors.
  - Smaller rules:
    - a Patio, Hot Tub, or Fire Pit earns nothing unless it touches a room
    - Treehouses stop counting each other as Kid partners
    - room types at their limit draw at half weight
    - one Entertainer per house
- **What it does, in the sim** (greedy's wins; held-out seeds in brackets):

  | | Today | Option B |
  |---|---|---|
  | Visible repeats (2+ Kitchens, 3+ Living Rooms, or 2+ Dining Rooms) | 92% [100%] | 7% [3%] |
  | One of each shared room (exactly 1 Kitchen, at most 2 Living Rooms, …) | 2% [0%] | 80% [82%] |
  | research.md's plausibility check (D-093's measure) | 2% [0%] | 75% [79%] |
  | Passes the glance test (compact, no yard inside, one of each shared room) | 0% [0%] | 35% [40%] |
  | No household (at most 1 Bedroom, or no Bathroom) | 27% [40%] | 4% [3%] |
  | House-building plays in weeks 17–28, of 12 | 5.6 [5.4], all rooms from the hand | 6.1 [5.7]: 2.8 [2.6] rooms from the hand, 1.9 [1.9] the arrivals' cards (Grandma's Room and her Bathroom), and 1.3 [1.2] Renovations |

- **Planning ahead holds up:**
  - A bot that looks ahead gains as much over greedy under B as it does today. That's +22.8% against +22.4% at 4 weeks ahead, and +24.2% against +20.5% at 8; both differences are noise.
  - Under B the gain is spread more evenly across seeds. The median seed gains +18%, against +9% today.
  - Under option A (the house rules without Renovate or the arrivals), the gain is 9 points lower than under B.
- **What it doesn't fix:**
  - Two-thirds of B's houses still fail the glance test. Herb Gardens and Patios tucked into the house's notches cause it about as often as a ragged outline does.
  - The arrivals' rooms are worth too little for the bot to plan around. M4b should make them pay more (untested).
- **What it costs:**
  - **Score balance:** Charm's share of the Wow rises from 59% to 73%; the house rules' own Charm is about 30% of a win's Wow. M4a's new sets, which ship with M4a anyway, are part of that rise.
  - **Dead cards** (a card whose best play loses score) rise from 0.5 to 2.9 a win.
  - **Rule work:** Renovate is a new kind of turn, and the arrivals need new rules as well as content.
  - **Decisions:** option B changes six Accepted decisions and needs two more settled for Renovate (D-070 and D-083). All eight need your OK (§8).
  - **Targets:** they need a re-fit. The sim's pick is 15, 250, 870, 2,650, 5,800, 11,700, 20,900. It tightens milestones 4–6. Milestone 3, where playtest 3's slack began, stays loose, and milestone 2 loosens (§5.8).
- **Your call:**
  - **A:** the seven house rules and the smaller rules, with no Renovate and no arrivals.
  - **B (recommended):** A, plus Renovate and the arrivals.
  - **C:** B, plus merging rooms or construction stages as rules. Not for the jam.
  - A plus Renovate alone is also possible. It has the most compact outlines and, on the tuning seeds, the best glance test, but small houses and a fifth with no household. Late, it places 3.1 rooms, against B's 2.8 from the hand plus 1.9 of the arrivals' cards (§5.5).
  - Then the smaller choices in §7. Nothing is built until you choose.

## How this was done

Nothing in the game changed. Everything ran on scratch copies of develop at `0541967`. Today's develop differs from that copy in its rules only by D-095 (a Sapling can't hold a fixture).

- **Round 1, ideas:**
  - Four analysts:
    - one mapped what in the rules causes sprawl
    - one measured 200 greedy runs and playtest 3's house
    - one mapped Combolands' mechanics onto ours
    - one looked at other games built around one bounded build
  - Five independent design packages, each simulated.
  - Four judges scored every package, one lens each: the Combolands feeling, the theme, feasibility, and a red team.
- **Round 2, the combination:**
  - The judges' shared ideas went into one sim runner: 33 arms on 200 seeds, and 6 packages on 100 held-out seeds.
  - Then a bot that looks ahead, a red team, and a first re-fit of the targets.
- **Round 3, the final package:**
  - The recommendation (option B) against today's game and 12 variants, option A among them.
  - The look-ahead bot on option B, and a target fit for it. The fit aims at greedy; one aimed at the look-ahead bot was tried and rejected (§5.8).
  - A red team on it.
  - Four rounds of fact-checks of this review against the data, the decision log, and a new reader's eye.
- **Also read:** the Combolands systems research (research.md, 2026-11-06) and D-094.

**How to read the numbers:**
- Unless marked, numbers are for greedy's wins on seeds `sim-0…199` at today's targets.
- In tables and short claims, [brackets] hold the same number on held-out seeds (`check-0…99`, never used for tuning). 95% intervals are written out.
- Greedy wins 62% of today's runs there and 95% of B's, so the Today column covers its better runs. Across all 200 runs at today's targets (a lost run stops at its milestone), today's visible repeats are 74% (92% of wins) and no household 35% (27%); B's are 7% and 7%.
- Every option in the sim has M4a's new sets, the Suite and Full House, which ship with M4a whatever the choice. Today's game doesn't. Without their Points, Charm, and Full House's ×2, B's houses would score about a sixth less, a tenth through their Charm alone. So a difference from today includes them. They pay a little less under A and A + Renovate (about 15% and 14%), so a difference between options includes them only through how much each house uses them.
- "Real" means a paired comparison's 95% interval excludes zero. "Noise" means it doesn't.
- The Appendix defines every term and measure. "The plan" means docs/implementation-plan.md, and "the plan's §8" its section on the sim, not this review's §8.

## 1. Why our houses sprawl

"Sprawl" means two things here: the house's ragged, half-empty outline, and a yard spread across the lot. This review fixes the first, and lets the yard spread within limits.

### What the measurements say

- **The house is a half-empty box with a ragged edge:**
  - The median win has 15 rooms and 58 tiles, a 13 × 9 box, and a fill of 48%. Each of those is a separate median. Packed, its rooms would fill 98% of a rectangle about 6 × 10.
  - Its outline is 2.2× the shortest possible, with about 40 corners. A hand-drawn ranch house of 40 tiles, with 3 Bedrooms and 2 Bathrooms, has 10.
  - On average, 99% of its rooms touch the outside.
- **It repeats the shared rooms:**
  - Wins average 3.4 Living Rooms and 2.7 Kitchens.
  - The copies often don't touch: no two of them touch in 37% of houses with 2+ Living Rooms, and in 44% of houses with 2+ Kitchens.
- **The yard drifts:**
  - Only 49% of yard pieces connect to the house through touching pieces.
  - The box around everything built spans 62% of the lot.
- **Raggedness doesn't buy score; copies and size do:**
  - Fill barely tracks the Wow (Spearman −0.07; near 0 means no link), but the Kitchen count does (+0.50).
  - So the shape can be asked for almost for free, while copies need a reason not to repeat.
- **Playtest 3's house:**
  - 13 rooms filling 49% of a 12 × 9 box: 4 Living Rooms, 2 Kitchens, 2 Home Offices, a Dining Room, and 3 Bedrooms sharing 1 Bathroom.
  - Its build was tighter than greedy's: the box around everything it built spans 32% of the lot, against greedy's 62%.
  - But only 4 of its 13 yard pieces touch the house, and those 4, 2 Herb Gardens and 2 Patios, sit wedged inside the outline.

### Five forces

1. **Copies earn in full:**
   - Each copy keeps its local bonuses, and Living Rooms make 22% of the Wow.
   - Per-copy cuts fade, because percentages add (D-037).
2. **Income faces outward:**
   - Trees, views, and yard partners pay only through an outside wall.
   - Each Tree tile counts as its own neighbor, so a room maxes out on its own stretch of woods. The next copy needs its own wall, which is why repeats sit apart.
3. **Volume with nowhere better to go:**
   - There are 28 placements, and passing adds nothing.
   - The Kitchen has two cards, and the draw can't see the house.
4. **An untethered yard:**
   - Only indoor pieces must touch the house.
   - Treehouses, Lawns, Flower Beds, and Driveways pay wherever they are, or best away from it.
5. **Per-instance sets:** each Entertainer adds +1 Charm, and 47% of houses hold two or more.

### A town's incentives without a town's limits

**Combolands spreads a town on purpose:**
- It pays each building for its own patch of nature.
- It keeps two of the same building out of each other's range *(guide; research.md, 2026-11-06)*.

**Its limits make spreading out cost something, or are meant to:**
- **Its island is small:** reviewers fit it on one screen. How full it gets by the end is an open question (§11).
- **Its railroads arrive later,** so early sprawl can become a constraint (research.md's first-pass notes).
  - The newer research adds that a building beside a railroad counts as beside everything along it.
  - So a railroad also joins up what sprawled.
- **Even so, critics say finished islands look like "a stamp collection",** with walls and rails that serve no purpose.
  - Whether critics mean the scattering or the purposeless walls is open (§11).
  - Either way, a sprawled town still reads as a town. A sprawled house doesn't read as a house, which is the team's point.

**We copied the incentive, but not the limits:**
- Each room earns from its own Trees and views.
- 28 placements cover about 15% of the lot (D-048), and nothing that arrives later judges the layout.

So the fix isn't to make the whole lot scarce, which would fight D-048 and the yard. It's to make the house's own outline the scarce space, and to give repeats something better to do.

## 2. How a house grows

**A town grows by spreading out. A house grows by filling in, filling up, and settling in, and its grounds are where spreading out belongs.**

| | What it is | Combolands' version | What makes you plan ahead |
|---|---|---|---|
| **Filling in** | The outline: a frame you complete | A small island; walls (which players often skip) | Gaps you can see, and shape rules on the checklist from week 1 |
| **Filling up** | The household grows, and each arrival needs a room | Railroads that arrive later; council requests | Arrivals known from week 1, whose rooms pay for particular neighbors |
| **Settling in** | Rooms deepen instead of multiplying | Upgrades, paints, and transformations | Timers (the Nursery grows up), and keeping a room's best walls free |
| **Spreading out** | The grounds | The whole town | The woods, the creek, a pocket for a fenced yard, Driveway routes |

- **Chains (D-094) fit filling in:**
  - In a house, a chain runs through touching rooms: Kitchen → Dining Room → Living Room → Patio.
  - A compact house with a hub should make longer chains than a sprawl. That's an expectation, not a measurement.
- **What this asks of the rules:**
  - something that pays for a filled outline
  - a ceiling on the rooms a house has one of
  - known arrivals
  - a use for a repeated card
- **Not all four are small:**
  - The outline rule and the ceilings are content, plus two to four new condition kinds across the house rules (§6).
  - The arrivals need rule work, and they reshape M4b's change orders.
  - A use for a repeated card is a new kind of turn.
  - §4 designs them, and §6 places them in M4a and M4b.

## 3. Five packages, four judges

Each package was designed independently and simulated on a scratch copy. Higher is better on all four lenses, and bold marks each lens's best. On the feeling lens, 5 is today's game.

| Package | The idea | Feeling | Theme | Feasibility | Red team |
|---|---|---|---|---|---|
| **P1 · Up to Code** | Each construction stage (D-018's milestones) gets its own card mix and an inspection published from week 1. The roof freezes the outline at Roofing | 6 | 5.5 | 3.5 | 3 |
| **P2 · Room to Grow** | A room built against one of its type merges into a bigger room (Family Room, Great Room) | 5.5 | 5 | 2 | 4 |
| **P3 · Who Lives Here** | The household is the plan. Ceilings per room type, and arrivals at Framing and Drywall that bring their own rooms | **7.5** | 4.5 | 4.5 | **7** |
| **P4 · One Roof, Open Grounds** | A compact core under a padded roofline, with the sprawl moved to the grounds | 4.5 | 7 | 7 | 5 |
| **P5 · Under One Roof** | Four shared lines on M4a's checklist (One Kitchen, 1–2 Living Rooms, Under one roof, Cozy), plus a household line per client. It proposed "4–6 Bedrooms, 2–3 Bathrooms" for the Hendersons, and simulated "a Bathroom for every two Bedrooms" | 4 | **7.5** | **8.5** | 6 |

**What each got right and wrong** (the judge who said it, in parentheses):
- **P1:**
  - Right: the best lookahead (feeling).
  - Wrong: the house stops growing after Roofing, at 0.3–0.7 rooms a stage (feeling). And it reopens eight Accepted decisions (feasibility).
- **P2:**
  - Right: every repeated card becomes an upgrade. Visible repeats fall to 11% of wins, counting a merged room once (theme).
  - That reads only if the art drops the inner walls: counted by pieces, only 11% of wins have one of each shared room.
  - Wrong: merging rewrites the per-piece model, 232 lines across 8 rules files in the scratch copy. And it doesn't fix the outline (feasibility).
- **P3:**
  - Right: the only package whose house grows again late, with 2.5 rooms in Drywall. P2, P4, and P5 add 0.8–1.3 rooms a phase after Roofing, and P1 0.3–0.7 (feeling).
  - Right: the only one where the household holds, with 3% of wins without one (red team).
  - Wrong: "spare rooms earn nothing" makes dead cards. Its eight lines, plus M4a's sets, put Charm at 73% of the Wow (feeling and red team).
  - Wrong: the outline stays ragged. H1, a compact outline before the 2:1 check, holds in 37% of wins (feeling, theme, and red team).
- **P4:**
  - Right: the padded roofline stopped greedy's accidental strips, with 0% of wins longer than 2:1 (theme). A deliberate strip still beat it (§5.6).
  - Wrong: the grounds become where leftover cards go: 3+ Treehouses in 42% of wins, against 21% today (theme and red team).
- **P5:**
  - Right: the best silhouette for about a day's work. 60% of wins are compact without being a strip, against P1's 47% (theme).
  - Wrong: no new verb (feeling), and 26% of wins without a household. Capped rooms spill into the yard: one yard type 4+ times in 70% of wins, against 56% today (red team).

**The judges' winners each needed the others' best ideas.** They grafted overlapping sets. Only the red team took all five:
- P5's lines
- P4's padding
- the Patio rule
- P3's arrivals
- P2's Remodel, where a duplicate room card levels up the room you have (it became Renovate, §4)

That five-part set is what round 2 tested. Three grafts were tested in the judges' own runs:
- **Padding:** strips fall from 15% to 1% of P5's wins, and H1 rises from 68% to 71%, while the share of runs won stays at 88%.
- **Household rooms delivered as cards:**
  - Wins without a household fall from 30% to 3%, and one of each shared room rises from 59% to 71%. H1 slips from 68% to 61%.
  - The two P5 runners count differently: this one counts Bunk Beds as two Bedrooms, as M4a will, and P5's own counted card types. That changes which runs win (178 against 176), and P5 reads 30% here against 26% on its own runner.
- **The Patio rule:**
  - Wins with an outdoor room off the house fall from 72% to 8%.
  - That test had padding on and a blocking form of the rule. Together they cost 5 points of one of each shared room, 3 of them the Patio rule's. That cost was gone by round 2's combination.

**A line alone doesn't make the bot build a household.**
- In place of the ratio line, "4–6 Bedrooms, 2–3 Bathrooms" left 27% of wins with no Bathroom, worse than the ratio line's 23%.
- Rooms that arrive as cards do work.

**What all five missed:**
1. **Nobody measured planning.** Greedy can't plan; §5.4 tests it with a bot that looks ahead.
2. **There's no way to hold a card.**
3. **The late game still lacks a building verb.**
4. **The yard becomes the new repeat engine.**
5. **The draw ignores ceilings:** 63–67% of offered room cards go untaken in the packages' wins, against 55% today.
6. **Soft lines may become requirements** once the targets are re-fit around them. That's the theme judge's argument, not a measurement. §5.6 measures how much the lines restrict at today's targets. Nobody has measured it at the re-fit targets (§10).
7. **M4a's plumbing isn't in code yet:** house conditions, the set cap, Full House's ×2, and the checklist UI.

## 4. The recommendation: house rules

**In one line:**
- Every client's checklist starts with the same seven house rules, written for that client's household.
- A room card whose type is at its limit can renovate the room you already have instead.
- The household grows on a schedule you can see from week 1.

Each part comes from one of the four ways a house grows (§2), and each answers one of the five forces (§1).

### Filling in: the shape rules

Two house rules make a filled, compact outline pay. Each adds +0.25 Charm while it holds, as a spec does (D-021, D-056).

- **Under one roof:** "4+ rooms, filling at least 60% of their box, and the box is no longer than twice its width."
  - It counters force 2 (income faces outward). A room still earns from its Trees and views, but the outline has to stay full, so you build inward and around a core rather than out along the woods.
  - The 2:1 limit replaced the judges' padded roofline. The two play the same for greedy. But a player could build a dense strip that kept the padded rule, and can't keep this one (§5.6).
- **Cozy:** "6+ rooms, each touching 2 or more rooms." A Hallway's link counts as touching.
  - It counters the half-empty box: wings one room wide stop paying.
  - It also tucks Bathrooms and Closets into the outline's notches, which smooths it. Exempting them was tested and made outlines worse (§5.7).

What you see: gaps in the outline you can fill, and both rules on the checklist from week 1. Under one roof first holds in a median week 5, and Cozy in week 10. A fifth of wins never hold Cozy.

### Filling up: the household

Four house rules describe who lives here (D-093's option 1). Each has a floor, and all but the Bathroom rule also have a ceiling:
- **Room for everyone:** "Bedrooms for the household: 2–3 to start, then one more for each arrival, and each arrival has their own room."
- **A Bathroom for every two Bedrooms** (at least one).
- **One Kitchen:** exactly one. An L-Kitchen counts.
- **A living room or two:** 1–2 Living Rooms, and at most one Dining Room.

They counter force 1 (copies earn in full). A second Kitchen now loses a rule, and the placement's preview shows that loss.

**The household grows on a schedule.** Each client is a household with a story, shown on the job board from week 1. In the sim the household is the Hendersons'. It's the only household tested (§10), and M4a and M4b would write one for each client.

| When | Who arrives | What lands in the reserve | What its room pays for |
|---|---|---|---|
| Framing (week 9) | Twins | A Nursery | A steady +2, plus +2 per touching Bedroom (up to 2). After 8 weeks it grows into a Kids' Room: a steady +4, plus +2 per touching Kid piece or Tree (up to 3) |
| Drywall (week 17) | Grandma | Grandma's Room, and a Bathroom | A steady +3, plus +2 per touching Bathroom, Living Room, or Kitchen (up to 3), and +1 per touching Flower Bed or Herb Garden (up to 2) |

- **The rules for arrivals:**
  - A member's room counts as a Bedroom.
  - Its card is never drawn or sold.
  - It waits in the crew's extra reserve slots, so it doesn't take a bought slot.
  - Room for everyone's range rises with each arrival, to 3–4 Bedrooms from Framing and 4–5 from Drywall.
  - From each arrival on, Room for everyone also needs that member's room. The member's card should say so.
- **What the arrivals are for:**
  - They give the house a schedule to plan around. You know who's coming and when, and each room pays for particular neighbors.
  - They're Combolands' later railroads and council requests in house form.
  - The Nursery's growth sets a second timer: where it goes in week 9 decides what the Kids' Room touches in week 17.
- **In the sim, they're too small to plan around:**
  - Their rooms bring 3% of the look-ahead bot's extra score, while the sets bring 73%.
  - A spot left beside a Living Room earns Grandma's room just +2 Comfort a week, the same as a Bathroom.
  - M4b should make each arrival worth planning for. For example, a small set for Grandma's Room with a Bathroom and a Living Room. That's untested, and playtest 4 asks whether people plan for them (§9).
- **They keep rooms going in:**
  - Framing and Drywall add 2.3 and 2.4 room pieces under B. Without arrivals (A + Renovate, which differs from B only by them), they add 1.6 and 1.2.
  - The arrivals' own cards more than cover that step: the Nursery is 0.9 of Framing's pieces, and Grandma's Room and her Bathroom 1.7 of Drywall's.
  - Rooms from the hand fall in both phases: 1.4 against 1.6 in Framing, and 0.7 against 1.2 in Drywall. Much of the late growth is the household's (§5.5).
- **M4b already plans the twins and Grandma.** Its change orders include the Hendersons' *Twins* and a generic *Grandma's moving in* (the plan's Appendix B), as one-off requests. This turns them into arrivals that are scheduled, shown in advance, and bring their own rooms.

### Settling in: Renovate

**Card text:** "Renovate: instead of placing a room card, play it on a room of the same type. The room gains a level: +4 Comfort, up to 2 levels."
- **When it's allowed:** while that room type is at its limit (Kitchen 1, Living Rooms 2, Dining Room 1, or Bedrooms at the top of the range). A member's room counts as a Bedroom here too.
- **The rest:**
  - It's a week's play, like installing a drawn fixture (D-050).
  - Levels show on the board, and they stay through a move or a transform.
  - The sim called it Remodel. A different name avoids a clash with the Remodel Plans tools, which level a set. "Renovate" clashes only with the parked renovation mode, so the name is the team's call.
- **What it fixes:**
  - It answers force 3: a duplicate card now has somewhere better to go than a second copy across the lot.
  - Without it, the ceilings make dead cards. Option A has no Renovate, and its dead cards are 8% of playable hand cards, against B's 4%. 38% of its Kitchen cards are dead, against 6%.
  - It also keeps the shared rooms single. From option A to A plus Renovate, one of each shared room rises 21 points, visible repeats fall 16, and the glance test rises 14 (all real).
- **In the sim:**
  - 91% of wins renovate at least once, about 2.4 times a win (median week 19).
  - Renovations rise from about 0.3 a phase in Foundation to 0.5–0.6 at the end.
  - Kitchens take 46% of them, Living Rooms 26%, Dining Rooms 15%, Bedrooms 11%, and member rooms 2%. 29% are second levels.
  - They give the late game a building verb that deepens the house instead of widening it.

### Spreading out: the grounds

The yard is where spreading out belongs. Three yard rules keep it from becoming the new repeat engine:
- **The Patio rule:** the Patio, Hot Tub, and Fire Pit earn nothing unless they touch a room.
  - The rule doesn't block placement, and touching only a Hallway doesn't count.
  - In the package, 72% [79%] of wins keep every outdoor room beside the house, with at most 2 Patios. In round 2, taking the rule out dropped that from 73% to 26%.
  - Nearly every remaining miss is a third Patio (§5.6).
- **A tidy yard:** the seventh house rule, worth +0.25. "6 or more yard pieces, and no yard type stands 4 or more times." It doesn't hold below 6 pieces. Fences, Driveways, and Saplings count toward the 6 but never break it, so a fenced yard or a long drive is always fine.
- **Treehouses don't count each other** as Kid partners:
  - Their steady +2 stays, and they still need a Tree.
  - In round 2, adding the rule to the package cut wins with 3+ Treehouses from 26% to 13% (real). Under option B it's 12% [9%], against 21% today.
  - It needs Renovate beside it: under option A, which has the rule, 25% [24%] of wins have 3+ Treehouses.
  - This is half of D-079's idea, and the half that works. The other half, paying per touching Tree, made Treehouses more common and pushed them deeper into the woods.

### Two changes to the draw and the sets

- **Capped rooms come up half as often:**
  - While a room type is at its limit, its cards draw at half weight.
  - That cuts about two Kitchen offers a run.
  - It changes D-043, under which weights are fixed for the run. It isn't the whole-run halving of the Kitchen's cards that D-093 rejected: the weight drops only while a type is at its limit.
- **One Entertainer per house** (`maxInstances: 1`), as D-093 already recommends, alongside M4a's Suite and Full House.

### A checklist, as a player would see it

The house rules come first, under three headings, then the client's own wishes. A client spec that repeats a house rule becomes that client's numbers for the rule, so nothing counts twice. For example, the Hendersons' "4+ Bedrooms" and "2+ Bathrooms" are where their household ends up (4–5 Bedrooms from Drywall, with a Bathroom for every two). So those two specs fold into Room for everyone and the Bathroom rule instead of paying again.

Each rule pays on its own. In round 2, separate lines beat compound ones on the Kitchen and the Bathroom ratio (the first row of the table at the end of this section). Mid-run, it might read:

```
HOUSE RULES
 The household
  ✓ Room for everyone           Bedrooms 3 (3–4), Nursery placed     +0.25
  ✗ A Bathroom per 2 Bedrooms   Bathrooms 1 of 2
  ✓ One Kitchen                 1                                     +0.25
  ✓ A living room or two        Living Rooms 2 (1–2), Dining 1 (≤ 1)  +0.25
 The shape
  ✓ Under one roof              fill 61% (≥ 60%), 9 × 6 (≤ 2:1)       +0.25
  ✗ Cozy                        7 of 8 rooms touch 2+ rooms
 The yard
  ✓ A tidy yard                 7 pieces (≥ 6), 2 of a type (≤ 3)     +0.25
THE HENDERSONS' WISHES
  ✓ Kitchen beside the Dining Room                                     +0.25
  ✗ A fenced yard               0 of 4 tiles
                                                      Charm from the list +1.50
```

A placement's preview already shows what it would gain or lose. With the house rules, it also shows the rules a placement would turn on or off.

### A run, stage by stage

Greedy's medians or means on its wins under option B:

- **Groundbreaking (weeks 1–4):**
  - The job board says who lives here and who's coming.
  - The first rooms go down: about 2.9 room pieces.
  - A living room or two is usually the first rule held (median week 3).
- **Foundation (weeks 5–8):**
  - Under one roof first holds (week 5), then One Kitchen (week 6) and Room for everyone (week 7).
  - From here every room has to keep the outline full and no longer than 2:1, so the house fills in.
  - Room pieces: 2.3. The first Renovations appear.
- **Framing (weeks 9–12):**
  - The twins arrive. The Nursery pays for Bedrooms beside it now, and its Kids' Room will pay for a Tree or a Kid piece in week 17.
  - The Bedroom range rises to 3–4.
  - A Bathroom for every two Bedrooms (week 9) and Cozy (week 10) first hold.
  - Room pieces: 2.3, the Nursery among them.
- **Roofing (weeks 13–16):**
  - The outline is mostly set, and duplicates turn up. A second Kitchen card renovates the Kitchen.
  - Room pieces: 1.3, plus 0.4 Renovations.
- **Drywall (weeks 17–20):**
  - Grandma moves in, with her room and a Bathroom card. Her room pays for a Bathroom, a Living Room, or the Kitchen beside it.
  - The range rises to 4–5.
  - A tidy yard switches on once the yard has 6 pieces (week 18).
  - Room pieces: 2.4, Grandma's Room and her Bathroom among them.
- **Finishes and Final Walkthrough (weeks 21–28):**
  - Second levels, fixtures, and the yard: a Patio against the Living Room, a Treehouse at the edge of the woods.
  - Room pieces: 1.3 and 1.1, plus 0.5–0.6 Renovations a phase.
  - The biggest weeks come from the sets and the rules a house holds together. Wins hold 6 of the 7 house rules at the end, on average.

### What the package leaves out, and why

| Idea | Where it came from | Why it's out |
|---|---|---|
| Four compound lines (the household, the shared rooms, Under one roof, Cozy) | Round 2, built from P5's lines | Separate lines did better on the Kitchen and the Bathroom ratio. Wins with no Kitchen fell from 7% to 1%, and the Bathroom ratio held in 84% against 71% (both real). A compound line pays nothing until all its parts hold, so a house that skips the Kitchen early never gets one |
| The padded roofline | P4 | Replaced by the 2:1 limit, which plays the same for greedy and can't be kept by a deliberate strip |
| A Treehouse that pays per Tree | P4 | It made Treehouses more common, deeper in the woods |
| The Estate (one each of five yard types) | P4 | A bonus of about 1,200 Wow held in about half of wins. It made yard repeats no rarer, and tiny houses more common |
| The Teen's Room chain | P3 | It forms around week 25 and changes no measure. Fine as flavor later |
| Renovate at +25% a level | Round 2 | Rarely used: 0.7 a win, against 3.0 at +4 in the same round-2 test (under B, +4 renovates 2.4 times a win). A quarter of a small room's Comfort is 1–2 |
| Renovate at +6 | Round 3 | See §5.7 |
| Cozy counting only rooms of 2+ tiles | Round 3 | See §5.7 |
| Bunk Beds counting once toward the range | Round 3 | See §5.7 |
| Merging rooms | P2 | The largest rule change of all, and it doesn't fix the outline. Park it |
| Construction stages with inspections, and a roof that freezes the outline | P1 | Reopens eight Accepted decisions, and the house stops growing after Roofing. Keep its UI ideas: the schedule on the progress bar, and a stamp when the roof goes on (§6, M5) |
| Per-copy percentage cuts | the analysts | Percentages add (D-037), so cuts fade |
| A hard slab (the outline poured at Foundation, with rooms off it counting as additions) | the analysts | It changes D-035, and with 3-card hands it means dead draws |
| A smaller lot | the analysts | It fights D-048 and the yard |

## 5. What the sim says

### 5.1 The options side by side

Greedy at today's targets, wins only, with two exceptions. "Runs won" is a share of all runs. The planning rows use all 200 tuning seeds with no targets, and have no held-out runs. Every option has M4a's Suite and Full House, and the Today column doesn't (see "How to read the numbers").

The options:
- **Option A:** the checklist alone. The seven house rules (Under one roof includes the 2:1 limit), One Entertainer per house, the Patio rule, half-weight draws, and Treehouses that don't count each other.
- **A + Renovate:** A, plus Renovate, but no arrivals.
- **Option B:** A, plus Renovate and the arrivals.

| | Today | A | A + Renovate | **B** |
|---|---|---|---|---|
| **The look** | | | | |
| Glance test passed | 0% [0%] | 31% [23%] | 45% [37%] | 35% [40%] |
| A compact outline (H1g) | 2% [5%] | 67% [70%] | 70% [77%] | 61% [64%] |
| No yard inside the house (H2) | 33% [31%] | 61% [61%] | 72% [64%] | 62% [61%] |
| One of each shared room (H3) | 2% [0%] | 56% [51%] | 77% [67%] | 80% [82%] |
| Visible repeats | 92% [100%] | 23% [28%] | 8% [10%] | 7% [3%] |
| research.md's plausibility check | 2% [0%] | 47% [47%] | 60% [53%] | 75% [79%] |
| Corners, median | 40 [38] | 22 [20] | 20 [20] | 22 [22] |
| Fill, median | 0.48 [0.49] | 0.65 [0.67] | 0.66 [0.66] | 0.64 [0.65] |
| **The household** | | | | |
| No household | 27% [40%] | 20% [20%] | 23% [21%] | 4% [3%] |
| Bathroom ratio held | 46% [55%] | 81% [86%] | 78% [82%] | 86% [87%] |
| Bedrooms per win | 3.5 [2.8] | 2.9 [2.8] | 2.7 [2.7] | 4.2 [4.0] |
| Rooms, median | 15 [15] | 12 [13] | 11 [12] | 14 [14] |
| Tiny houses (8 or fewer room pieces) | 1% [3%] | 10% [7%] | 14% [13%] | 4% [5%] |
| **The yard** | | | | |
| Outdoor rooms beside the house (Y1) | 34% [44%] | 60% [72%] | 67% [75%] | 72% [79%] |
| One yard type 4+ times | 56% [45%] | 7% [16%] | 6% [13%] | 6% [10%] |
| 3+ Treehouses | 21% [21%] | 25% [24%] | 14% [10%] | 12% [9%] |
| 3+ outbuildings (Treehouses, Greenhouses, Doghouses, Birdhouses, and Henhouses, in any mix) | 31% [31%] | 52% [47%] | 40% [35%] | 33% [32%] |
| **The feel** | | | | |
| Room pieces by phase, 1–7 | 2.8 2.4 2.2 1.9 2.1 1.8 1.9 | 3.0 2.5 1.8 1.4 1.4 1.2 1.0 | 3.0 2.3 1.6 1.2 1.2 1.0 0.9 | 2.9 2.3 2.3 1.3 2.4 1.3 1.1 |
| House-building plays in weeks 17–28, of 12 (§5.5) | 5.6 [5.4] | 3.6 [3.4] | 4.7 [4.5] | 6.1 [5.7] |
| Renovations per win | – | – | 2.7 [2.6] | 2.4 [2.3] |
| Big weeks, median | 8 | 9 | 9 | 9 |
| Share of the Wow from pieces placed in phases 1–2 | 51% [53%] | 60% [60%] | 64% [65%] | 57% [58%] |
| **Planning** (all runs, no targets) | | | | |
| The look-ahead bot's gain, 4 weeks ahead | +22.4% | +13.8% | not run | +22.8% |
| … 8 weeks ahead | +20.5% | not run | not run | +24.2% |
| Seeds where it beats greedy, 4 weeks ahead, of 200 | 128 | 123 | not run | 160 |
| **The cost** | | | | |
| Runs won at today's targets | 62% [62%] | 92% [90%] | 91% [91%] | 95% [94%] |
| Median Wow | 13,125 [12,993] | 15,431 [16,867] | 15,872 [17,422] | 17,431 [19,321] |
| Charm's share of the Wow | 59% [59%] | 71% [69%] | 70% [70%] | 73% [71%] |
| Dead cards per win | 0.5 [1.0] | 6.2 [6.5] | 3.1 [3.3] | 2.9 [3.1] |
| Dead Kitchen cards | 0% [2%] | 38% [41%] | 7% [11%] | 6% [8%] |

Room pieces by phase include each phase's overtime weeks. "Weeks 17–28" counts week numbers, which is why today's phases 5–7 add to 5.8 room pieces while its weeks 17–28 place 5.6 rooms.

**In short:**
- **A** fixes the outline, keeps outdoor rooms by the house, and stops single-type yard repeats. But:
  - visible repeats stay in about a quarter of wins, and a fifth of houses have no household
  - outbuildings pile up, with 3+ in 52% of wins
  - it has twice B's dead cards (6.2 a win against 2.9; today 0.5)
  - its planning gain is 9 points below B's (real). Against today's, the drop is noise.
- **A + Renovate** has the most compact outlines on both seed sets (77% against B's 64% held out, real). But:
  - its houses are small: a fifth have no household, and 14% are tiny
  - held out, its glance-test edge is gone (37% against B's 40%, noise), and it falls behind on one of each shared room (67% against 82%, real)
  - its planning gain wasn't measured.
- **B** is the only tested option that fixes the repeats and the household together.
  - On the look, it's level with A + Renovate held out (glance test 40% against 37%, noise), but behind it on the tuning seeds (35% against 45%, real).
  - It keeps the most house-building in the late game, though 1.9 of its 6.1 late house-building plays are the arrivals' rooms.
  - Its planning gain is level with today's and 9 points above A's.

### 5.2 The look

- **Repeats are gone:** visible repeats fall from 92% to 7% [3%], and one of each shared room rises from 2% to 80% [82%].
- **The outline fills in:** median fill rises from 0.48 to 0.64, and corners fall from 40 to 22. The box is fine: median 1.31:1, and only 2% of wins are longer than 2:1.
- **Why two-thirds of wins still fail the glance test:** yard pieces inside the house's box cause it about as often as the outline does.
  - 38% [39%] of wins fail H2, nearly all with two or more yard pieces wedged in the house's notches. They're mostly Herb Gardens (0.5 a win) and Patios (0.4).
  - Today's houses wedge more, at 2.0 yard pieces a win.
  - A Patio or Herb Garden in the L of a house can read as a terrace or a kitchen garden. Several inside the box read as playtest 3's house did. Playtest 4's screenshots should show which (§9).
  - 39% [36%] fail the compact outline, 21% only because of the 24-corner limit (their fill and box pass). Only 7% [9%] would pass the whole glance test but for that limit.
- **Size explains part of B's lower outline score:**
  - On the tuning seeds, B's houses with 14+ rooms (half its wins) pass the compact outline 54% of the time, about as often as A's (50%) and A + Renovate's (53%).
  - On held-out seeds it doesn't: 56% against 65% and 86%, on small samples.
- **Glue:**
  - Bathrooms and Closets make up 31% of the rooms (13% today), and 22% of wins have 3+ Closets. Part of that is M4a's Suite (a Bedroom, Bathroom, and Closet), which today's game doesn't have.
  - Cozy pushes them into the outline's notches, where they remove about 2.7 corners a house.
  - A player can push it further (§5.6).

### 5.3 The household

- **Wins without a household** fall from 27% to 4% [40% to 3%]. The Bathroom ratio holds in 86% [87%], against 46%.
- **On D-093's own measure,** research.md's plausibility check:
  - 75% [79%] of B's wins pass, against 2% today, 47% under A, and 60% under A + Renovate.
  - D-093's three household specs alone reached 54% in research.md's experiment, on a different runner.
- **The arrivals' rooms get built:**
  - Both member rooms stand in 93% [89%] of wins.
  - Before Room for everyone needed them, that was 80% [78%].
  - A member's card is left unplaced in 7% [11%] of wins, down from 20% [22%].
- **Grandma's neighbors:**
  - A Bathroom and a Living Room both touch her room in 37% [36%] of wins.
  - The Living Room is the bottleneck: only half her rooms touch one.
  - Her room pays the same +2 for a Bathroom, a Living Room, or the Kitchen, so a Bathroom alone pays as much. If her story says she wants the Living Room, her card should pay for it specifically.

### 5.4 Planning ahead

The look-ahead bot ("the planner") tries greedy's top 3 plays each week. It plays each one, lets greedy finish the next 4 or 8 weeks on two made-up futures, and keeps the best. It's a floor on planning, not a model of a player.

- **The typical gain is level with today's:**
  - The planner beats greedy on the same seed by +22.8% under B and +22.4% today, 4 weeks ahead. 8 weeks ahead, it's +24.2% against +20.5%.
  - Both differences are noise.
- **It pays off more evenly:**
  - 4 weeks ahead, planning pays on 160 of 200 seeds under B, against 128 today (real).
  - The median seed gains +18%, against +9% today (real). 8 weeks ahead it's +19% against +7%, on the edge of real, and the seeds where planning pays (144 against 133) are noise.
  - Today's gains are bigger where they come, which is why the typical gains match.
- **Option A pays planning less:**
  - +13.8% at 4 weeks ahead, 9.0 points below B (95% interval +3.5 to +14.5, real).
  - Against today's, the drop is noise. A + Renovate wasn't run.
- **In win rate,** on curves where greedy wins about 43% (for B, the fit the pick was eased from; for today, D-089's unapplied fit), on `sim-0…199`:
  - The planner wins 12.5 points more than greedy under B, and 11.0 more today (both real; the difference is noise).
  - At the recommended targets, on held-out `check-0…99`, it wins 70%, against greedy's 54% on the same seeds.
- **When the gain comes:**
  - Under B, 8 weeks ahead, at the end of milestones 2–7: +3, +9, +10, +16, +20, +24%.
  - Today's grows to the end too: +4, +9, +15, +17, +19, +21%.
  - B's runs behind today's through Roofing and catches up from milestone 5, when Grandma arrives. The cause of that step wasn't tested.
- **What planning means under B:**
  - Mostly arranging rooms so the sets connect. That's 73% of the planner's extra score: the Entertainer 33%, Jack-and-Jill 25%, the Suite 13%, and Full House 2%. Today it's 82%.
  - The arrivals' rooms bring 3%, and the house rules another 3%.
  - 48% of the planner's changes give up some of this week's Wow, against 27% today. The trades are small: about 90 Wow a run given up now.
- **The planner's houses** (all runs, without targets, so greedy's numbers here differ from §5.1's wins and from the targeted all-run figures in "How to read the numbers"; the glance test is at the recommended targets, on `check-0…99`):
  - It keeps one of each shared room (81% for both bots; visible repeats 7% → 6%).
  - It fills out the household: both member rooms 91% → 98%, and no household 6% → 1%.
  - 2+ Kitchens fall (5% → 1%), and 2+ Dining Rooms rise (0% → 4%), both real.
  - Its outlines are more ragged. 44% have more than 24 corners, against 33% (real), and the compact outline falls from 61% to 52% (noise), partly because its houses are bigger (+0.9 rooms).
  - At the recommended targets, its wins pass the glance test 29% of the time, against greedy's 41% (noise).
  - Today, the planner's houses repeat more than greedy's: visible repeats 77% → 87%, and 2+ Kitchens 57% → 72%.
- **What the bot can't show:**
  - It can't hold a spot open for weeks: it changes only this week's play, among greedy's top 3, and greedy plays every week of its futures.
  - Under it, Grandma's room touches a Living Room less often (51% → 39%): a Bathroom pays her room as much as a Living Room does, and the Living Rooms are busy in the Entertainer.
  - Whether people plan for the arrivals is playtest 4's question (§9).

### 5.5 The feel

**What the late game is made of:** plays in weeks 17–28, 12 a win.

| | Today | A | A + Renovate | **B** |
|---|---|---|---|---|
| Rooms from the hand | 5.6 [5.4] | 3.6 [3.4] | 3.1 [3.2] | 2.8 [2.6] |
| The arrivals' rooms | – | – | – | 1.9 [1.9] |
| Renovations | – | – | 1.5 [1.3] | 1.3 [1.2] |
| Yard pieces | 4.6 [4.8] | 6.3 [6.0] | 5.4 [5.4] | 4.5 [4.6] |
| Fixtures installed | 1.6 [1.7] | 2.0 [2.4] | 1.8 [1.9] | 1.3 [1.6] |
| Hallways | 0.2 [0.1] | 0.1 [0.2] | 0.2 [0.2] | 0.1 [0.1] |

Each week's play counts once here. The counts by phase in §5.1 count room pieces instead.

- **Under B, half the late weeks still go into the house** (rooms, the arrivals' rooms, and Renovations: 6.1 of 12), the most of any option.
- **But much of it is the household's.** The arrivals' rooms are 1.9 of B's 4.7 late rooms, and rooms from the hand fall to 2.8, from today's 5.6 (A + Renovate: 3.1).
- **Under A, the yard takes over the late game** (6.3 of 12).
- **Room pieces by phase** run 2.9, 2.3, 2.3, 1.3, 2.4, 1.3, 1.1.
  - Framing holds at 2.3, where A + Renovate, which differs from B only by the arrivals, drops to 1.6. Drywall steps up from 1.3 to 2.4, against A + Renovate's 1.2.
  - The arrivals' cards are 0.9 of Framing's pieces and 1.7 of Drywall's.
- **The rules arrive over the run:**
  - First held, by median week: a living room or two 3, Under one roof 5, One Kitchen 6, Room for everyone 7, a Bathroom for every two Bedrooms 9, Cozy 10, and a tidy yard 18.
  - At the end, wins hold 6 of the 7 on average. The most often missing are Cozy (held in 74%), Room for everyone (79%), and Under one roof (81%).
- **Big weeks:** 9 a run, against 8 today.
- **Early pieces carry a little more:**
  - Pieces placed in phases 1–2 make 57% of the Wow, against 51% today.
  - That's because fewer rooms go in late and Renovations deepen rooms already built. A + Renovate is the most front-loaded, at 64%.

### 5.6 Exploits, and how much the rules restrict

A red team ran nine bots, each greedy with one bias.
- **Nothing beats greedy,** which wins 190 of 200.
- **The best two only tie it:** a bot that chases rules (191, noise), and Renovate spam (190).
- **All nine ran at today's targets,** where greedy wins 95%. So a tie in wins says little; the score gaps matter more at the re-fit targets.

| Exploit | Result | Verdict |
|---|---|---|
| **A deliberate strip, 4 wide** | Wins 84% of runs, and 59% of its wins are strips. None of its wins holds Under one roof at the end. With the padded roofline, 40% of its wins did | Under one roof no longer pays for a strip, at no cost to greedy. Strips can still be built |
| **Glue stuffing** (packing Closets and Bathrooms) | Wins as often as greedy, for 2,980 less Wow held out (real). 3+ Closets in 58% of its wins (greedy 22%), and more Bathrooms than Bedrooms in 30% (greedy 9%). The glance test passes 58% of these houses (greedy 35%) | Still open. Its glue pays through the Suite: 1.92 Suites a win, against greedy's 1.44. Untested fix: brake the Suite, for example no more Closets than Bedrooms |
| **The stamp collector** (one yard type) | Wins as often, for 5% less Wow. One yard type 4+ times in 34% of its wins, against 6% for greedy. In round 2's package, which had no tidy-yard rule, it was 65% (25% with the rule added) | A soft brake, as intended |
| **Declining the arrivals** (two bots) | One never places the member rooms (wins 178 of 200); one also skips Grandma's Bathroom (175). Neither holds Room for everyone after week 9. About 7% and 11% less Wow | Ignoring an arrival costs a rule, as intended |
| **Renovate spam** | Ties greedy, with 0.7 fewer rooms, and 2,164 less Wow held out (real). Prettier held out (glance test 50% against 40%, real), but not on the tuning seeds (39% against 35%, noise) | Fine: greedy already renovates |
| **Yard first** | Wins 15% of runs | Loses |
| **A 6-room tiny core** | Wins 67% of runs (−28 points). Compact but empty: no household in 39% of its wins | Loses |

**How much the rules restrict** (greedy's wins):
- **Forced breaks** (every play of every card loses a held rule): 4 weeks out of 5,346.
- **Room-blocked weeks** (every room card in hand loses a rule): 4%.
- **Ceilings:**
  - They bind in 16% of weeks, rising to 23% in phase 7.
  - When one binds, greedy renovates 53% of the time.
- **Dead cards:**
  - 4% of playable hand cards, or 2.9 a win. Today it's 0.5.
  - They come late: 17% of hand room cards are dead in phase 7.
  - Garage cards are the worst, at 58% dead. But 49% are dead today too, since they need the street or a Driveway.
- **Breaking a rule by choice:**
  - Greedy also breaks a held rule by choice 1.3 times a win, in weeks where another play would have kept it.
  - It's mostly a Bathroom for every two Bedrooms (0.5), Under one roof (0.4), and Cozy (0.3).
- **In short, the rules steer, but they don't corner.** The friction is late, which is where playtest 4 should look.

**Small gaps the red team found** (all untested):
- **A third Patio** is what keeps outdoor rooms from passing Y1 in 52 of 53 misses, because the tidy yard allows 3 of a type. Capping Patios at 2 would close it.
- **A Sapling counts toward the tidy yard's 6 pieces,** so one that grows into a Tree can switch the rule off with no play. It happens 0.04 times a win. Counting only yard types would remove it.

### 5.7 Tried in round 3: what was dropped and what was kept

| Variant | What happened | Verdict |
|---|---|---|
| **Cozy counts only rooms of 2+ tiles** (so Closets and Bathrooms needn't touch 2) | The glue didn't drop (31% of rooms either way). Outlines got worse: on option B the glance test fell 15 points and a compact outline 27 (both real). Exempt from Cozy, Bathrooms and Closets stop filling the outline's notches, and add corners instead of removing them | Dropped |
| **Bunk Beds count once** toward Room for everyone | Changed the reading in 4–6% of weeks. On top of the member-room rule, the Bathroom ratio fell 4 points (real) | Dropped: Bunk Beds keep counting twice (D-082) |
| **Renovate at +6** | More Renovations (2.9 a win), 2 points more runs won, and look gains that are noise. But 0.34 fewer rooms, Grandma's neighbors met 5 points less often, and dead Kitchen cards up 2 points (all real) | Keep +4 |
| **Every rule pays +1/6** instead of +0.25 | Charm's share falls from 73% to 69%. But the glance test falls 8 points and a compact outline 11 (both real): at +1/6 the shape rules pay too little to hold the outline | Keep +0.25, and lower the targets if needed |
| **Room for everyone needs the arrivals' rooms** | Both member rooms stand in 93% of wins, up from 80%. More rooms go in late (+0.19 a win). No measurable cost to the look or the wins | Kept: it's in option B |
| **The 2:1 limit in place of the padded roofline** | No change for greedy (189 wins of 200 either way, tested before Room for everyone needed the arrivals' rooms). It stops a strip from holding Under one roof (§5.6) | Kept |

### 5.8 The targets

Option B scores more than today's game, so it needs new targets. At today's targets greedy would win 94.5% of the 200 held-out runs (95% [94%] in §5.1).

**The pick: 15, 250, 870, 2,650, 5,800, 11,700, 20,900.**
- It's fitted to greedy's scores under B. The fit overestimated greedy's win rate by about 2 points, so the pick is eased slightly (milestones 4–7 about 2–3% lower than the fit), and greedy measures 45.5–46.5%.
- Milestone 1 stays at 15.
- Against today's curve it's ×1.00, 1.32, 1.78, 2.52, 2.58, 2.54, 2.20.

The plan's §8 criteria (D-089), on 200 held-out runs (the planner's row on 60 and 100):

| Criterion | Result | Verdict |
|---|---|---|
| Random loses by milestone 3 in ≥ 95% | 98.5% | Pass |
| Novice passes milestone 1 in ≥ 90% | 96.0% | Pass |
| Greedy clears milestones 1–3 in 92–98% | 94.0% | Pass, unsure |
| Greedy wins 40–50% | 46.5% (45.5% on the tuning seeds) | Pass, unsure |
| Completing early always, against never, within 10 points | −12.5 points | Fail, unsure (today's game fails it too, by −14.5) |
| A planner wins about 75% | 65% on `check-0…59` and 70% on `check-0…99` (greedy wins 52% and 54% there), for this weaker planner | A floor under 75% |

- "Unsure" means the 95% interval crosses the line.
- **Three criteria weren't measured:**
  - fences paying their way (a fenced yard costs greedy 2–3 placements), since these dumps don't keep the enclosure probe
  - no must-buy, and the client and crew spread, which the plan leaves for M4 and M6
- **Why not aim the curve at the planner:**
  - A curve fitted to the planner's scores lets it win only 57–58%, and puts greedy at 38.5–41.5%, around the 40% floor.
  - With a 12–18 point gap between the bots, no curve gives the planner 75% while greedy stays within 40–50%.
- **Milestone 1 stays at 15:**
  - At the fit's own 25, novice passes only 85.5%, and 17% of greedy's runs need overtime in week 4.
  - Playtest 3's player would have scored about 18 there.
- **It tightens milestones 4–6:**
  - For a player like playtest 3's, the projected margins over the target at milestones 4–6 are 1.7, 1.4–1.5, and 1.2–1.3×, against the 2.4, 2.15, and 1.95× they had. The finish is tight (1.03–1.13×).
  - Milestone 3, where their slack began (2.4×), stays as loose (2.3–2.5×). It has to while greedy clears milestones 1–3 in 92% or more.
  - Milestone 2 loosens (1.7× against 1.3×).
  - The projection maps one playtest run onto the sim by rank.
- **For more pressure mid-run,** take the pick about 3% higher at milestones 3–6, rounded (15, 250, 900, 2,750, 6,000, 12,000, 21,000; milestone 7 rounds up by 100). That puts greedy at 42.5–46%.
- **Early completion fails at every curve near greedy's 45%** (−11 to −13.5 points; −12.5 at the pick), and today too (−14.5):
  - Completing early skips weeks of building. Under B, a skipped week costs more than D-040's reward pays: +2 budget and 10% of the phase's earnings per week saved.
  - At 20% or 30% of the phase's earnings per week saved, the check passes narrowly: −10.0 and −9.5 points, both unsure.
  - D-040 leaves its reward to the sim, so this is tuning, not a change of decision.

These targets fit the sim's emulation of option B. M4a re-fits on the content it actually ships.

### 5.9 Playtest 3's house under the house rules

Read under option B's rules, playtest 3's run (seed `jbf3zs`) holds 24% of its possible rule-weeks, against 60% for greedy's wins. It holds none of the seven at the end.

The run used a week of overtime at milestone 2. So it has 29 tallies, and its Framing started in week 10.

| Rule | Weeks held (of 29 tallies) | What broke it |
|---|---|---|
| Room for everyone | 6 (weeks 4–9) | The Nursery never came, so the rule fails from Framing (week 10 here) on. Its range also rose to 3–4 with 2 Bedrooms |
| A Bathroom for every two Bedrooms | 10 | A third Bedroom with one Bathroom (week 17) |
| One Kitchen | 11 | A second Kitchen (week 21) |
| A living room or two | 9 | A third Living Room (week 14) |
| Under one roof | 4 | The second Living Room dropped the fill under 60% (week 9) |
| Cozy | 0 | Two Living Rooms touch only one room each |
| A tidy yard | 8 | A fourth Lawn (week 26) |

To hold all seven, it needed:
- three Renovations in place of the second Kitchen and the third and fourth Living Rooms
- both member rooms, with one Bedroom fewer. One of its Bedrooms holds Bunk Beds, which count twice, so with both member rooms it would count 6 Bedrooms against the 4–5 range.
- two more Bathrooms (Grandma's card brings one)
- 12 more indoor tiles inside its box, where its 2 Herb Gardens and 2 Patios sit
- a second neighbor for two Living Rooms
- at most 3 Lawns

The player would have seen the rules and the arrivals, so they'd have played differently. Read it as how far today's habits are from the house rules, not as a replay.

### 5.10 The houses themselves

The red team drew today's house and option B's on six seeds:
- three drawn in earlier rounds: sim-1, sim-28, and sim-127
- three typical wins, near the median score in both: sim-76, sim-149, and sim-51

| Seed | Today: rooms · fill · corners | Option B: rooms · fill · corners | Option B's house rules held at the end |
|---|---|---|---|
| sim-1 | 21 · 0.39 · 52 | 16 · 0.79 · 22 | all 7 |
| sim-28 | 17 · 0.52 · 46 | 12 · 0.55 · 28 | 5 (not Bathrooms or Under one roof) |
| sim-127 | 15 · 0.49 · 40 | 14 · 0.61 · 22 | 6 (not the tidy yard: 4 Flower Beds) |
| sim-76 | 16 · 0.45 · 48 | 16 · 0.64 · 28 | 5 (not Cozy, or the tidy yard: 5 Lawns) |
| sim-149 | 14 · 0.46 · 40 | 13 · 0.63 · 24 | 6 (not Cozy) |
| sim-51 | 16 · 0.50 · 44 | 13 · 0.61 · 22 | 6 (not Room for everyone: 6 Bedrooms counted) |

- **Today:** all six show visible repeats, and none passes the glance test.
- **Option B:** none shows repeats, all six have both member rooms, and two pass the glance test.

sim-51, the top half of the lot, today (left) and under option B (right):

```
 0  ..............hh~~~~~~^^   |    ................~~~~~~^^
 1  ..........BB...K.....~^^   |    ........K............~^^
 2  ....tt....BB..KKLL...~^^   |    ....hhAAKKhh.........~^^
 3  .##.tt....^O.LL.LL...~^^   |    .##.hhAABB^..........~^^
 4  .##.^tt...*O.LL^LL...~~~   |    .##.^ppWBB*..........~~~
 5  .....ttLL..BBLL~~~.....*   |    .....ppLLW....?~~~.....*
 6  *...tt^LLBBBBBB~~~O.*...   |    *.....^LLBBNN..~~~..*...
 7  ....tt^LLBBW^BBWBBO.....   |    ......^LLBBNNtt.........
 8  ....^^LL^^^pp^LLBB......   |    ....^^LL^^BBWtt.........
 9  .....*LLLLLpp^LL........   |    .....*LLBBBB^^..........
10  ......LLLLL..^LL........   |    ......LLBBCpp^..........
11  ............ffrr........   |    ...........pp...........
```

- Indoor: B Bedroom, W Bathroom, K Kitchen, L Living Room, C Closet, O Home Office, N Nursery or Kids' Room, A Grandma's Room.
- Yard: p Patio, h Herb Garden, f Flower Bed, t Treehouse, r Greenhouse.
- The lot: ^ Tree, ~ water, * boulder, # Old Shed, ? Time Capsule.
- Today's house has 6 Living Rooms and 5 Bedrooms spread over the lot. Option B's has 2 Living Rooms, one Kitchen, and the household, in a 7 × 10 block.
- One of its Herb Gardens sits in a notch beside the Kitchen. Two sit just outside the box against Grandma's Room, which pays for them. This house passes the glance test.

## 6. How it would be built

The package fits M4's existing phases. Nothing here starts before the team chooses.

### M4a: the house rules, with the clients

M4a already builds clients, specs with progress ("Bedrooms 3/4"), sets with `maxInstances`, Full House's ×2, and the job board. The package adds:
- **The seven house rules,** as specs every client's checklist starts with:
  - Each client sets its own numbers: its Bedroom range, and anything it changes (Juniper's 4–8 rooms). A client spec that repeats a house rule becomes that client's numbers for it.
  - Until M4b's arrivals, Room for everyone uses each client's range without them. The sim's option A stepped that range up at Framing and Drywall (2–3, then 2–4, then 3–5 Bedrooms). A fixed range wasn't simulated with option A's rules.
  - They need two to four condition kinds the plan doesn't have yet, each with card text and tests:
    - a count compared with another count (a Bathroom for every two Bedrooms)
    - the outline: rooms, fill, and the box's aspect
    - a Bedroom range that steps up at milestones: a condition that reads the phase, or specs that change at milestones
    - no yard type past a count, from a minimum number of yard pieces. This could also be an `and` of per-type counts.
  - Cozy is data in the plan's format, shaped like Dale's spec: a count of rooms, plus `none` over rooms touching fewer than 2 rooms.
- **One Entertainer per house** (`maxInstances: 1`).
- **Renovate:**
  - a play kind beside placing and installing, checked and previewed like them
  - room levels in the house state, kept through the Moving Truck and through transforms
  - card text, an inspect-panel line, and a board badge
  - greedy scores each Renovation exactly, as it does installs
  - two Accepted rules to settle:
    - whether a Renovation can be Weekend Crew's next play (D-083; the sim allowed it)
    - whether a card that can only renovate counts as fitting for the free redraw (D-070; the sim said no)
- **Half-weight draws** for room types at their limit. These are draws that read the house (D-043); the plan's draw weights can't read the layout today.
- **Data:** the Patio rule, and Treehouses that don't count each other.
- **The sim:**
  - the house report: room counts, repeats, Bedrooms per Bathroom, research.md's plausibility check, and the glance measures (Appendix)
  - the re-fit (§5.8), on the content M4a ships
  - D-040's early-completion reward, tuned until the plan's §8 early-completion check passes
  - worth trying in the same pass (untested): a cap of 2 Patios, the tidy yard counting only yard types, and a brake on Closets through the Suite

### M4b: the household grows

- **Each client's household and arrivals, as data:**
  - M4b plans one change order after each of milestones 2, 4, and 6. Arrivals are separate: they're fixed for the client, and shown on the job board from week 1.
  - The *Twins* and *Grandma's moving in* change orders become the Hendersons' arrivals.
- **The rules arrivals need:**
  - Arrivals put their cards into the crew's reserve slots at the start of their phase, after transforms and before the draw. That's a new start-of-week step (D-036).
  - Room for everyone's range rises with each arrival, and needs each member's room from the arrival on. That takes either a condition that reads the arrivals, or arrivals that rewrite the spec.
- **Member rooms:**
  - the Nursery (it grows into the Kids' Room) and Grandma's Room, plus a member room for each other client's arrivals
  - each member's card says that Room for everyone needs their room
- **Make each arrival worth planning for** (untested): for example, a small set for Grandma's Room with a Bathroom and a Living Room. In the sim, her room's +2 a neighbor was too little to plan around (§5.4).
- **A first-time hint** for the first arrival.
- **Re-fit the targets again** once the arrivals are in. In the sim they add about 1,600 to greedy's median Wow (A + Renovate 15,872, B 17,431).

### M5: showing it

- The arrivals as markers on the progress bar.
- A stamp the first week Under one roof holds ("Topped out!").
- A level-up pop for each Renovation.
- D-094's option 1, chains drawn as arcs, so a compact house's chains are visible.

### Parked

- Merging rooms, construction stages as rules, a hard slab, per-copy percentage cuts, a smaller lot, the Estate, and the Teen's Room.
- D-093's fallback after playtest 4 stays: option 3 as a term after percentages, or option 5's wings.

## 7. Your choices

1. **How much to build:**

   | Option | What it is | Where it lands | What it fixes |
   |---|---|---|---|
   | **A · The checklist only** | The seven house rules, One Entertainer, the Patio rule, half-weight draws, and Treehouses that don't count each other. No Renovate, no arrivals | M4a: content, two to four new condition kinds (a stepped Bedroom range among them, §6), and draws that read the house (D-043) | The outline, outdoor rooms beside the house, and single-type yard repeats. But outbuildings pile up (3+ in 52% of wins, against 31% today), and visible repeats stay in about a quarter of wins. A fifth of houses have no household, 69% of wins fail the glance test, dead cards are 6.2 a win (B 2.9, today 0.5), and its planning gain is 9 points below B's. It changes three Accepted decisions (§5.1, §8) |
   | **B · Recommended** | A, plus Renovate and the arrivals | M4a (Renovate) and M4b (the arrivals, with rule work) | Most of A's (its compact outline is a little less common: 61% of wins against A's 67%), plus one of each shared room and the household. It keeps the most house-building in the late game, and gives a schedule to plan rooms around, though that's untested with players. But two-thirds of its houses still fail the glance test (A's: 69%), dead cards are 2.9 a win (A 6.2, today 0.5), and it changes A's three Accepted decisions plus three more, and needs two more settled (§8) |
   | **C · Bigger** | B, plus merging rooms or construction stages as rules | M4 and a phase of its own | Merging turns repeats into bigger rooms, and stages gave the best lookahead. Not for the jam: merging rewrites the per-piece model, and stages reopen eight Accepted decisions (§3) |

   **A plus Renovate, without arrivals,** is possible too.
   - It has the most compact outlines.
   - But its houses are small, and a fifth have no household.
   - Late, it places 3.1 rooms from the hand in weeks 17–28, against B's 2.8 from the hand plus 1.9 arrivals' rooms (§5.5).
   - See §5.1.
2. **Arrivals: fixed or declinable.** Recommended: fixed.
   - They're the client's household, not a request: where and when to build the room is yours.
   - Declinable arrivals would follow D-046's rule for requests.
   - In the sim, ignoring a fixed arrival cost Room for everyone for the rest of the run, and 6 points of wins. Under D-046 a declined request carries no penalty, so declinable arrivals would need their own test.
3. **Renovate:** +4 Comfort a level (recommended), or +6. +6 renovates more but builds fewer rooms (§5.7). It's the knob if playtest 4 finds Renovations too weak to bother with. It won't fix dead duplicate cards: at +6, dead Kitchen cards rose 2 points, because rooms reach the 2-level cap sooner.
4. **What a rule pays:** +0.25 (recommended; D-056's +0.25 a spec stays), or +1/6. +1/6 lowers Charm's share of the Wow (73% to 69%) but loosens the outline (§5.7). If the checklist feels compulsory, lower the targets instead.
5. **The yard brake:** the tidy-yard rule (recommended), the Estate (a set for one each of five yard types; it made yard repeats no rarer, §4), or neither.
6. **The targets:** the pick (recommended; 15, 250, 870, 2,650, 5,800, 11,700, 20,900), or the pick with more pressure mid-run (§5.8). Either way, M4a re-fits on its own content, and M4b re-fits again once the arrivals are in.
7. **Renovate's name:** "Renovate" (it clashes only with the parked renovation mode), or another word. Not "Remodel", which the Remodel Plans tools use (§4).

## 8. Decisions this touches

**Accepted decisions that would change, and need the team's OK.**
- Option A changes D-021, D-043, and D-056.
- Option B also changes D-004, D-036, and D-050, and needs D-070 and D-083 settled for Renovate. A plus Renovate changes the same six and needs the same two.

The changes:
- **D-021 (the spec checklist):**
  - every checklist starts with the seven house rules
  - specs can have a ceiling (D-093's option 1)
  - the plan's Appendix A rule, "specs are positive achievements", still holds: each house rule has a floor
- **D-056:** One Entertainer per house changes its set ladder, as D-093 already notes.
- **D-043 (draws):** weights would depend on the house while a type is at its limit.
- **D-004, D-036, and D-050 (a week's turn):** Renovate is a new kind of turn, as installing a drawn fixture was. The arrivals add a start-of-week step, after transforms and before the draw.
- **D-070 and D-083:**
  - whether a card that can only renovate counts as fitting for the free redraw (the sim said no)
  - whether a Renovation can be Weekend Crew's next play (the sim allowed it)

**Accepted decisions it builds on, unchanged:**
- **D-038:** two to four condition kinds and a play kind. That's the kind of building block it expects, not a change in approach.
- **D-040 (early completion):** its reward is the sim's to tune, and the sim says to raise it (§5.8).

**Proposed or Open decisions this would settle or amend:**
- **D-093 (Open):** this review is its deeper pass.
  - The recommendation keeps D-093's own: option 1, and option 2's Entertainer cap, in M4a.
  - It adds the shape rules, Renovate, the arrivals, three yard rules, and half-weight draws.
  - D-093's fallback after playtest 4 stays.
- **D-079 (Open):** Treehouses stop counting each other as Kid partners, and the "pay per touching Tree" half is dropped. D-071's steady +2 stays.
- **D-082 (Proposed):** Bunk Beds keep counting twice. Counting them once was tested and didn't help (§5.7).
- **D-085 (Proposed):** a new target curve (§5.8).
- **D-089 (Proposed):** the plan's §8 reports gain the house report.
- **D-094 (Open):**
  - Renovate is where a repeated room card goes, so chain items needn't reward copies, as D-094 asks.
  - Under the house rules a house is paid to keep one Kitchen and at most two Living Rooms. So a relay that reads a tag such as Social would reward packing them into a hub, not repeating them. Untested.
- **D-078 (Open):**
  - The Kids' Room pays for touching Trees, which ties one room to the lot's terrain. Grandma's flower beds tie hers only to the yard.
  - Charm's share rises, which works against terrain mattering (§10).
- **D-074 (Open):** packs. Fences and Driveways never break the tidy-yard rule.

## 9. What to ask in playtest 4

1. At the end, does the house look like a house? Take a screenshot of the finished lot. Do the yard pieces tucked into the house's notches read as a terrace and a kitchen garden, or as clutter?
2. Did a house rule stop you from building something you wanted? Which one, and what did you do instead?
3. Did you renovate? Did it feel like a reward, or a consolation for a card you couldn't use?
4. Did you leave a spot for the Nursery or for Grandma before she arrived? Was it worth it?
5. Did the checklist feel like the point of the game, with each room's own Comfort an afterthought?
6. Which house rule did you lose most often, and why?
7. Did weeks 17–28 still feel like building something?
8. Did the yard feel free enough, or did the tidy-yard rule get in the way?

## 10. Risks and what the sim can't tell us

- **Charm's share of the Wow rises,** from 59% today to about 73%:
  - The house rules' own Charm pays about 30% of a win's Wow.
  - More of the score comes from the checklist, and less from where each piece sits. That works against D-078 (terrain should matter more).
  - M4a's Suite and Full House, which ship with M4a anyway, are part of the rise.
  - The sim had no client wishes, and no Dream Home or Inspector's Visit. So in M4a, Charm's share will be above 73%.
  - Paying +1/6 a rule lowers Charm's share to 69%, but costs the outline (§5.7).
- **The checklist gets long:**
  - Seven house rules, plus a client's two to four wishes.
  - The headings help, and M4b's first-time hints should cover the first checklist.
- **Soft rules can become requirements:**
  - The rules' own Charm is about 30% of a win's Wow, and the re-fit targets assume it. The same house without them would score about 30% less; how much a run that ignores them loses wasn't measured.
  - At today's targets the rules steer rather than corner (§5.6), but nobody has measured that at the new targets.
  - That's the point of a checklist, but it can feel compulsory. Watch question 5.
- **One household:**
  - Every option B number comes from the Hendersons' schedule: the twins at week 9, Grandma at week 17, and Bedrooms 2–3, then 3–4, then 4–5.
  - Other clients' households haven't been written or tested.
  - Juniper's 4–8 rooms sits against Cozy's 6+ rooms and a growing household.
- **The arrivals may be too small to plan for:** in the sim, their rooms bring 3% of the planner's extra score (§5.4).
- **The bots plan less than a player:**
  - Greedy never looks ahead, and the planner sees a few weeks. Neither can hold a spot open for eight weeks.
  - So the sim shows the package doesn't punish planning, but not how much a person will plan for the arrivals.
- **Rules flip:**
  - 40% of wins lose a Bathroom for every two Bedrooms at some point after holding it, and 35% each lose Room for everyone and Under one roof.
  - That's 44%, 41%, and 37% of the wins that held each.
  - Room for everyone breaks, by design, when an arrival's room isn't built the week its card lands, and holds again once it is.
- **Yard pieces in the notches:** two-thirds of B's houses fail the glance test, about as often from Herb Gardens and Patios tucked into the house's box as from the outline (§5.2).
- **Glue stuffing is still open** (§5.6): a house can pack Closets for the Suite, and the glance test doesn't catch it.
- **H1's fixed 24-corner limit** marks bigger houses down. Part of option B's lower outline score comes from size (§5.2).
- **Everything ran on a scratch emulation,** with hooks in a patched copy of develop at `0541967`:
  - Dream Home and the Inspector's Visit, which scale specs, stayed out of the shop, so each rule paid a flat +0.25.
  - The sim kept the Nursery's age when it became the Kids' Room. Develop's transform restarts it, which matters only for timed effects such as Good Bones.
  - M4a's real code must re-run the house report and the re-fit.

## 11. Questions for the Combolands research

The Combolands systems research (research.md, 2026-11-06) answered several of the questions this review sent to that session:
- **Copies:** two of the same building can't sit in each other's range *(guide)*.
- **Council requests:** finished requests pay votes that climb a ladder, and some rungs rewrite rules.
- **Gold:** "Combolands: what pays gold".
- **Obstacles:** map features count as buildings, and some buildings need, make, or clear them.
- **Chains:** buildings that fire others, a cap of 10 a week per building, and how the tally shows them.

Still open, ranked by how much each answer would change this package:
1. **Copies:** on a finished island, how many of the most common building are there? Does anything cap copies, or upgrade the one you have when you draw it again (as Renovate does)?
2. **Lookahead:** what can a player see coming (next hands, milestone effects, council requests, timers), and how many turns ahead?
3. **Council requests:** how far ahead are they shown, how many at once, and can they be declined? (This bears on fixed versus declinable arrivals.)
4. **Railroads and other late systems:** when do they arrive? Do players save space for them ahead of time?
5. **Space:** how full is the island at the end, and when do good spots run out? Does anything reward a town center or density? Do late milestones turn into gap-filling?
6. **Score over time:** what share of the score comes in the last third, and how much of that from buildings placed in the first third?
7. **Timers and transformations:** what share of a late score comes from buildings that changed over time?
8. **Upgrades:** how many does a run have, on which buildings, and can you tell an upgraded building at a glance? (This bears on Renovate's badge.)
9. **Milestones:** besides raising the target, do they add buildings, rules, or map space?
10. **Looks:** critics call finished islands "a stamp collection" (research.md, 2026-11-04; §1). Which part do they mean: the scattered buildings, or the walls and rails with no purpose?

## Appendix: terms and measures

### Terms

| Term | Meaning |
|---|---|
| Wow, Comfort, Charm, Sparkle | Wow is the score. Each week adds Comfort (Points) × Charm (Mult), times any rare Sparkle (×Mult) (D-019, D-056) |
| A rule, a line | A checklist spec that adds +0.25 Charm in every week it holds (D-021, D-056). The house rules are lines |
| Sets | Each pays Points and Charm every week it holds. M4a adds the Suite and Full House. In the sim every option has them and today's game doesn't, so a difference from today includes them. "Connected" means one group through touching rooms, Hallway links included |
| The Entertainer | A Kitchen, Dining Room, and Living Room, connected |
| Jack-and-Jill | Two Bedrooms sharing a Bathroom |
| The Suite | A Bedroom, Bathroom, and Closet, connected |
| Full House | One of each of the 9 Core indoor types |
| Milestones | Groundbreaking (weeks 1–4), Foundation (5–8), Framing (9–12), Roofing (13–16), Drywall (17–20), Finishes (21–24), and the Final Walkthrough (25–28) (D-018). The sim calls them phases 1–7. Overtime weeks add to a phase |
| M4a, M4b | The next build phases. M4a adds clients, their checklists, house conditions, and the Suite and Full House. M4b adds change orders and crews |
| The plan | docs/implementation-plan.md. "The plan's §8" is its section on the sim, and "the plan's Appendix A and B" are its appendices |
| Renovate | Option B's new turn: play a room card whose type is at its limit onto a room of that type, for +4 Comfort a level, up to 2. The sim calls it Remodel |
| Arrivals | Household members who arrive on a schedule: the Nursery card at Framing (week 9), and Grandma's Room plus a Bathroom card at Drywall (week 17). The Nursery becomes a Kids' Room 8 weeks after it's placed |
| Today's targets | 15, 190, 490, 1,050, 2,250, 4,600, and 9,500 Wow (D-085) |
| Arm | One sim configuration (a set of rules), played on the same seeds as the others |
| Seeds | `sim-0…199` for tuning; `check-0…99` (and `check-0…199` for the targets) held out |
| Real, noise | Every comparison plays the same seeds in both arms, resampled 2,000 times. Real means the 95% interval excludes zero |
| Spearman | A rank correlation from −1 to +1. Near 0 means no link |
| Passing | Placing nothing in a week. The house still scores its week, but passing adds no piece and no reward of its own |
| Relays and tags | From D-094: a relay activates the touching pieces that match it again. Tags such as Social and Quiet are labels on pieces that effects read |

### The bots

- **Greedy:** each week, plays the best play by this week's exact score, from a shortlist (D-089). It never looks ahead.
- **Novice:** a random card that fits, at its best spot. It's the floor for "milestone 1 teaches".
- **Random:** a random legal play.
- **The planner** (scratch):
  - Each week it takes greedy's top 3 plays.
  - It plays each one, then lets greedy play the next 4 or 8 weeks, on 2 futures drawn from fresh seeds, so it never sees the real cards.
  - It keeps the play with the best average score.
  - It's a floor on planning, not a model of a player: it can't hold a spot open for 8 weeks.
- **The planning gain** is how much more the planner scores than greedy on the same seed:
  - The typical gain is the geometric mean of that ratio over 200 seeds; the median seed's gain is reported beside it.
  - These runs have no targets, so every run plays all 28 weeks.

### The house

| Measure | What it means |
|---|---|
| Fill | The house's indoor tiles ÷ the tiles in the box around them |
| Corners | Turns in the house's outline. A rectangle has 4 and an L has 6; a diagonal pinch counts 2 |
| H1 · compact, before the 2:1 check | Fill at least 0.6, and at most 24 corners |
| H1g · a compact outline | H1, and the box no longer than 2:1 |
| H2 · no yard inside the house | At most 1 yard piece wedged inside the house's box (touching 2+ indoor pieces, Hallways included), and at most 4 courtyard tiles (tiles inside the box that aren't indoor and can't reach outside it) |
| H3 · one of each shared room | Exactly 1 Kitchen; at most 1 Dining Room, 2 Living Rooms, 2 Home Offices, and 1 Garage; at most 1 of each special room (Playroom, Library, Mudroom, Sunroom) |
| The glance test (G) | H1g, H2, and H3 together: would a glance read this as a house? |
| Visible repeats | 2+ Kitchens, 3+ Living Rooms, or 2+ Dining Rooms |
| research.md's plausibility check | At least 1 Bedroom, Kitchen, and Bathroom; Bathrooms at least a third of the Bedrooms; at most 1 Kitchen, 1 Dining Room, 2 Living Rooms, 1 Garage, 2 Home Offices, and 1 of each special room (Playroom, Library, Mudroom, Sunroom). D-093's measure |
| Strips | Fill at least 0.6, but longer than 2:1 |
| No household | At most 1 Bedroom, or no Bathroom. Member rooms count as Bedrooms |
| Bathroom ratio held | At least one Bathroom for every two Bedrooms |
| Tiny houses | 8 or fewer room pieces |
| Y1 · outdoor rooms beside the house | Every Patio, Hot Tub, and Fire Pit within a tile of the house, and at most 2 Patios |
| Outbuildings | Treehouses, Greenhouses, Doghouses, Birdhouses, and Henhouses, in any mix |
| One yard type 4+ times | A yard type (Patio, Treehouse, Lawn, Flower Bed, Herb Garden, Greenhouse, Doghouse, Birdhouse, Henhouse, Hot Tub, Fire Pit, Pool) standing 4+ times |
| The build's box | The box around everything built, as a share of the lot |
| Padding (the padded roofline) | Under one roof measured against a box whose short side counts as at least half its long side, so a thin strip needs a much denser fill |

### The run

| Measure | What it means |
|---|---|
| Room pieces by phase | Rooms placed in each milestone's weeks, overtime included (Hallways excluded) |
| House-building plays | Plays in weeks 17–28 that place a room from the hand, place an arrival's room, or renovate |
| Big weeks | Weeks 5–28 whose total is at least 15% above the week before |
| Charm's share of the Wow | The Charm layer of the game's own score breakdown (what Charm adds on top of Comfort), as a share of a run's Wow, at the median win. Sparkle's extra is a separate layer |
| Share of the Wow from phases 1–2 | The share of a run's Wow earned by pieces placed in the first two milestones. High means early pieces carry the run |
| Dead card | A playable hand card whose best play scores less than passing that week |
| Forced break | A week where every play of every hand card loses a house rule the house holds |

### The house rules as simulated

| House rule | The sim's condition |
|---|---|
| Room for everyone | Bedrooms within the stage's range: 2–3 in weeks 1–8, 3–4 from the twins, 4–5 from Grandma (without arrivals, as in option A: 2–3, 2–4, 3–5). Bunk Beds count 2, and a member's room counts 1. From each arrival on, that member's room must stand |
| A Bathroom for every two Bedrooms | Bathrooms ≥ max(1, ⌈Bedrooms ÷ 2⌉). There's no ceiling |
| One Kitchen | Exactly 1 (an L-Kitchen counts) |
| A living room or two | 1–2 Living Rooms, and at most 1 Dining Room |
| Under one roof | 4+ rooms, fill at least 0.6, and the box no longer than 2:1 |
| Cozy | 6+ rooms, each touching 2+ rooms (Hallway links count) |
| A tidy yard | 6+ yard pieces, and no yard type 4+ times. Fences, Driveways, and Saplings count toward the 6 but never break it |

Each pays +0.25 Charm while it holds, through a hook in the week's Mult, as M4a's specs will.
- **The sim's names for them:** `beds` (with `bedsMembers`), `bathRatio`, `oneKitchen`, `living12dining1`, `roof` (with `box2`), `cozy`, and `curb`.
- **The `sep` token** turns on the six household and shape lines, with M4a's sets and the Entertainer cap.
- **The whole package** is `sep,box2,patio,events,remodel,curb,drawcap,treeKid,bedsMembers` (alias `R5`). Option A is `sep,box2,patio,curb,drawcap,treeKid`.
