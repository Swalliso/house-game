# Open House — Decision Log

Our game jam entry for the theme **"It's a house."** A one-week jam with friends, built with Claude Code.

**How to use this file:** each entry is one decision with a status. Update the status instead of deleting entries. When a decision changes, mark the old entry *Superseded* and point to its replacement.

| Status | Meaning |
|---|---|
| Accepted | Agreed; build on it |
| Proposed | Suggested, waiting on a yes or no |
| Parked | Good idea, deliberately deferred |
| Open | Needs a decision |

Related docs: `research.md` (sources and reference notes), `content-brainstorm.md` (draft pieces, clients, and crews), `jam-scope.md` (jam scope and starting numbers), `implementation-plan.md` (architecture and build order), `house-systems-review.md` (how houses grow without sprawling: D-093's systems review).

## The game in one paragraph

You run a home-building company. Each run is one contract: one client, one plot of land, one house. Every week you place one piece (a room or a yard feature), and every piece on the lot earns score each week based on what it touches. Every few weeks there's a milestone with a target that rises each time; miss it and the client fires you. Hit it with weeks to spare and you choose between completing the milestone early for a bonus or using the remaining weeks to keep building. Between milestones you spend budget in a shop. Each client judges the house in their own way, and change orders shake things up mid-run.

---

## Accepted

### D-001 · Concept: Open House
**Status:** Accepted · 2026-11-04
**Decision:** A roguelite house-building engine-builder: place rooms and yard pieces on a lot, chase combos, hit rising targets.
**Why:** The best hook for the build risk of the four pitches, and the most literal take on the theme.
**Considered:** *Do Not Disturb* (you are the house, protecting your sleeping family from burglars), *Chicken Legs* (FTL-style walking house), *Housesitter* (anomaly hunt).

### D-002 · Top-down map view
**Status:** Accepted · 2026-11-04
**Decision:** The lot is shown top-down on a grid, similar to Combolands.

### D-003 · One client, one lot, one house per run
**Status:** Accepted · 2026-11-04
**Decision:** The house persists through every milestone of a run, and the client stays the same.
**Why:** Players can commit to a specialized build, no later evaluator punishes earlier choices, and each run has a clear identity.
**Considered:** A new buyer every round. Rejected because it forces generic houses and needs a story patch for why buyers don't just buy the house.

### D-004 · Weekly earning
**Status:** Accepted · 2026-11-04
**Decision:** Each week is one turn in which you place one piece. Every placed piece earns every week, so early placements earn more over time.
**Amended by:** D-036: a week may also be passed without placing (confirmed 2026-11-04). D-050 and D-051 (Accepted 2026-11-05): a week's turn can instead be installing a drawn fixture; tools and bought fixtures are free actions, and no week ever gets a second piece.
**To be amended by:** D-074 and D-075 (Open). The team confirmed after playtest 2 (2026-11-05) that a week may place more than one piece, through packs or banked buildings. *Decided by D-083 (Weekend Crew, 2026-11-05) and D-106 (packs, 2026-11-06).*
**Amended by:** D-102 (Accepted 2026-11-06, with D-093's option B): a week's turn can instead be a Renovation, which levels a room you already have. D-106 (Accepted 2026-11-06): a Fence or Driveway pack places several connected tiles as one piece, in one play.

### D-005 · Milestones with rising targets
**Status:** Accepted · 2026-11-04
**Decision:** Every few weeks the accumulated score must reach a target, and targets rise each milestone. Missing one ends the run (the client fires you).
**Amended by:** D-041 (Accepted 2026-11-04): 2 overtime weeks are spent before a miss ends the run.

### D-006 · Early completion
**Status:** Accepted · 2026-11-04
**Decision:** Once a milestone's target is met with weeks to spare, the player can complete it early for a bonus (budget for each week saved, plus a score bonus) or keep building through the remaining weeks to get more pieces down.
**Why:** A real greed-versus-growth decision. Modeled on Combolands' "Complete milestone early" button (see `research.md`).
**Addition:** an auto-complete toggle for players who want to skip the decision. *Resolved by D-040 (Accepted): included, off by default.*
**Amended by:** D-040 (Accepted 2026-11-04): the skipped weeks fast-forward, and the reward scales with the phase.

### D-007 · The yard is part of the build
**Status:** Accepted · 2026-11-04
**Decision:** The lot includes both the house and the yard. Yard pieces are first-class, and every tile is a choice between house and yard.

### D-008 · Open House is its own game, not a reskin
**Status:** Accepted · 2026-11-04
**Decision:** Keep these house-specific ideas central:
- Rooms have real floor-plan shapes.
- Groups of rooms score like poker hands (e.g., a Suite, a Full House).
- Scoring follows real-world floor-plan intuition (bedrooms want quiet, kitchens want dining rooms), and clients bend those rules.
- "-house" outbuildings: doghouse, treehouse, greenhouse, and so on.

### D-009 · Framing: you're the building company
**Status:** Accepted · 2026-11-04
**Decision:** The player runs a home-building company that takes contracts. Each contract is a plot of land with unique features plus a client with specifications. Not a realtor or sales game.

### D-010 · Clients differ in flavor, not necessarily difficulty
**Status:** Accepted · 2026-11-04
**Decision:** A client like the vampire should feel different from a typical 4-bed, 2-bath family, not just harder.

### D-011 · Change orders
**Status:** Accepted · 2026-11-04
**Decision:** Mid-run, the client makes new requests that push the player to adapt.

### D-012 · Crews
**Status:** Accepted · 2026-11-04
**Decision:** At the start of a run the player picks a builder or crew with its own strengths and focus (the equivalent of Combolands' guilds).

### D-013 · Shop between milestones
**Status:** Accepted · 2026-11-04
**Decision:** Budget earned from milestones and early completions is spent in a shop between milestones.
**Amended by:** D-046: economy pieces are a budget source too (confirmed 2026-11-04). D-049 and D-051 (Accepted 2026-11-05): finds, selling for half the list price, the shop's skip reward, and Savings Account interest are budget sources too.

### D-014 · v1 is building for the client
**Status:** Accepted · 2026-11-04
**Decision:** The first build focuses on constructing the house for a client. Renovation modes wait (see Parked).

### D-026 · Everyday clients are common; eccentrics are rare
**Status:** Accepted · 2026-11-04
**Decision:** Most clients have everyday but varied needs (a family, dog owners, a remote worker, a minimalist). Eccentric clients like the vampire show up rarely, as a fun surprise.
**Why:** Varied needs drive replayability, and rare eccentrics stay special.

### D-033 · Render with Preact and the DOM, not Phaser
**Status:** Accepted · 2026-11-04 (confirmed by the team)
**Decision:** Preact renders everything, including the board:
- a CSS grid for input
- an absolutely positioned layer for pieces
- SVG outlines
- the Web Animations API and CSS for juice, plus one canvas for particles

The board sits behind a small `BoardView` interface, so Phaser could replace just the board later.
**Why:** Most of the screen is panels (hand, top bar, checklist, shop, job board, end screen). The board is 144 cells and turn-based. One renderer avoids a canvas-to-DOM bridge right where the core interaction happens. About 9 kB gzip against 357 kB for Phaser 4.
**Considered:** Phaser 4 board + DOM panels (runner-up), PixiJS + DOM, all-Phaser. Amends the Phaser hint in D-027.
**Note 2026-11-05:** with the 24×24 lot (D-048) the board is 576 cells. Preact and the DOM, with no Phaser, still holds.
**Amended by:** D-049 (Accepted 2026-11-05): the input bullet changes from a CSS grid of cells to pointer arithmetic on one element, and terrain becomes one layer that re-renders only when terrain changes.
**Amended by:** D-057 (Accepted 2026-11-05 with the plan): for pixel art, terrain is drawn into one canvas layer and pieces use a sprite atlas. SVG stays for outlines and highlights.

### D-040 · Early completion fast-forwards the rest of the phase
**Status:** Accepted · 2026-11-04 (confirmed by the team)
**Decision:**
- Completing a milestone early fast-forwards its remaining weeks (every week of the phase not yet tallied): pieces keep earning and timers keep ticking, but no hands are drawn and nothing is placed.
- The reward is budget per week saved plus a score bonus of a percentage of this phase's earnings per week saved, tuned per phase by the sim.
- It's offered in every phase, including the last.
- Auto-complete exists but is off by default.

**Why:** D-006 doesn't say what happens to the skipped weeks. If they were simply lost, each would cost about 5% of the final score, and +1 budget could never pay for that; Combolands players mostly ignore its version. With fast-forward, you trade placements for budget. That favors building early and cashing out late, and it shortens sessions.
**Considered:** Losing the weeks, with a much larger reward.
**Changes:** D-006 (Accepted), by defining what it leaves open, and resolves its proposed auto-complete toggle.
**2026-11-06 (systems review):** under the review's option B, completing early always wins 11–13.5 points less often than never, at every target curve where greedy wins about 45%. That's outside §8's 10 points, though each interval crosses the line (fail, unsure).
- Today's game fails too, by 14.5 points at today's targets.
- A skipped week costs more than the reward pays (+2 budget and 10% of the phase's earnings per week saved). At 20% or 30% per week saved, the gap is −10.0 or −9.5 points: a pass, but the interval crosses the line.
- The reward is the sim's to tune, so this is tuning, not a change (`house-systems-review.md` §5.8).
**2026-11-06 (M4a):** on M4a's content (1,000 held-out runs, greedy's targets re-fitted, no arrivals yet), always against never: −12.2 points at 10% of the phase's earnings per week saved, −11.2 at 20%, and −9.8 at 30% (a pass, unsure). The reward is now +2 budget and 30% per week saved (`balance.ts`). M4b's re-check with the arrivals decides whether it needs more.
**2026-11-07 (M4b):** with the arrivals and greedy's sense of the checklist (1,000 held-out runs, all three crews), always against never: −9.7 points at +2 budget per week saved, −5.7 at +4 (a pass, sure: 110 seeds won only by completing early, 167 only by never doing so), and −1.7 at +6. A bigger Wow share didn't help (40%: −12.4 before the arrivals): a skipped week's pieces compound, and budget buys goods that compound too. The reward is now +4 budget and 30% per week saved.

### D-041 · Overtime weeks
**Status:** Accepted · 2026-11-04 (confirmed by the team)
**Decision:** Each run has 2 overtime weeks.
- When a phase ends short of its target, they're spent automatically, one at a time.
- Each is an extra placement week appended to that phase, with its own hand. The next phase still gets its full 4 weeks.
- The run ends only when the target is still missed after the last overtime week.
- A clock counter shows how many are left.

**Why:** A hard fail with few recovery tools is the top complaint about Luck be a Landlord, and Combolands' version of this pool is a big part of why reviewers call it relaxed.
**Changes:** D-005 (Accepted). Missing a milestone still ends the run, but only after overtime runs out.

### D-042 · Run length: 7 milestones × 4 weeks
**Status:** Accepted · 2026-11-04 (confirmed by the team)
**Decision:** Keep the 7 construction-phase milestones, with 4 weeks each instead of 6: 28 placements, about 20 minutes. Weeks per milestone is a number in `balance.ts`.
**Why:** 42 placements plus 6 shops is 35–45 minutes for a first run, longer than most jam players give a game, and a late loss wastes 25 minutes. A shorter run also leaves the lot about 60% full instead of nearly full (on 12×12; on the 24×24 lot of D-048, 28 placements cover about 15%, and D-049 handles emptiness instead of fill).
**Changes:** D-029 (Accepted), its starting numbers.

### D-048 · Lot size: 24×24
**Status:** Accepted · 2026-11-05 (requested by the team)
**Decision:** The lot is 24×24 tiles instead of 12×12. Width and height are separate numbers in `balance.ts`, and the rules work at any size.
**Why:** A yard needs room to feel like a yard, and terrain such as a creek needs room to be interesting. The game is turn-based and light, so where fun and performance pull apart, fun wins. A finished house covers roughly 15% of the lot, so tiles stop being scarce; what's scarce is the 28 placements and the best tiles. D-007 still holds in that sense: each placement is a house-or-yard choice.
**Considered:** 12×12, the original placeholder. 20×20 and 24×18 (24×18 fits a 16:9 screen with bigger cells); both stay a one-line change if the M1 playtest finds the cells too small or the lot too empty.
**Changes:** D-029 (Accepted), its lot size. The terrain and rules that make the size work are in D-049. D-033's reasoning cites 144 cells; Preact and the DOM still hold at 576, and its input bullet changes through D-049.

### D-049 · Terrain and big-lot rules
**Status:** Accepted · 2026-11-05 (confirmed by the team)
**Decision:**
- **Terrain:**
  - woods (clusters of Trees) and lone Trees
  - a creek on most lots
  - a pond, boulders, and the sunny side
  - from M3b, two kinds of **finds**: the Old Shed (demolish it for a random tool) and Time Capsules (the first piece built over one pays budget)

  Terrain covers about a fifth of the lot. Each kind is a `FeatureDef` in `src/content`.
  *Changed by D-119 (Proposed 2026-11-09):* a creek on about a quarter of lots, not most, and a creek lot is Creekside (pieces touching the creek earn +50%, all run). The pond stays on every lot without a creek and on half the creek lots.
  *Changed by D-120 (Proposed 2026-11-09):* the sunny side becomes the sun's side, one edge of the lot. A tile is in the sun unless it's a Tree, or a Tree, the Old Shed or a building stands one step toward the sun, and a building with a tile in the sun is Sunny.
- Water bodies count once as a neighbor. Each Tree tile counts separately, so effects that count Trees or views have a cap.
- Only a Driveway can be built over the creek (a culvert), so the house sits on one bank but can still have a Garage.
- The lot edge bounds a fenced yard like a wall, so a house near an edge makes a cheap fenced yard. A fenced yard must also border the house, so a lone Fence in a corner doesn't count.
- The front yard is counted by rows (nearer the street than the house's front), so it stays a real position on a wide lot.
- Bigger yard shapes: the Lawn is 2×2, the Fence comes as a 1×4 and a 5-tile L, and the Driveway as 1×3 and 1×5.
- The board draws terrain as one layer that re-renders only when terrain changes, and maps the pointer to a cell by arithmetic. A camera fits the lot to the screen, with zoom and pan.
  *Amended by D-057 (Accepted 2026-11-05 with the plan):* for pixel art, the camera zooms in whole-number scales by re-laying out the board rather than with a CSS transform, which blurs canvases in Safari.
- The sim ranks candidate placements by a cheap local score and scores only the top few exactly.

**Why:** On 24×24, 28 placements cover about 15% of the lot. Without dense terrain and bigger yard pieces, three things go wrong:
- the lot feels empty
- Fences take too many placements
- counting Trees per tile makes pieces at the edge of the woods too strong

With these rules, where to put the house becomes the run's first big decision.
**Considered:** Revealing the lot in stages. A footbridge across the creek (Stretch). A hill that gives a View (Stretch). Special features such as an ancient oak or the neighbor's cemetery (Stretch, and cheap now that terrain is data).
**Changes:** D-013 (Accepted): finds are a budget source. D-033 (Accepted): its input layer, from a CSS grid of cells to pointer arithmetic. D-035 (Accepted): terrain neighbors. D-046 (Accepted): the fenced-yard rule. `content-brainstorm.md` §2 and §4 (a Draft): new terrain and bigger yard shapes.

### D-050 · Fixtures are in the jam build
**Status:** Accepted · 2026-11-05 (requested and confirmed by the team; `jam-scope.md` listed fixtures as Stretch)
**Decision:**
- A fixture is a card. It's installed in a piece you've already placed, such as a Fireplace in a room or a Sprinkler in a Lawn. Fixtures show up in the weekly hand from phase 2, and in the shop.
- Installing a **drawn** fixture is the week's turn, instead of placing a piece. A fixture **bought** in the shop goes into your supplies and installs as a free action: you paid budget instead of a week.
- One fixture per piece; installing a new one replaces the old. A fixture goes when its host is demolished.
- A fixture's effects are modifiers on its host, so a new fixture is data.
- Core: 10 fixtures, 7 for rooms and 3 for the yard (Appendix B of `implementation-plan.md`).
**Amended by:** D-056 (Accepted 2026-11-05): the Rare Chandelier, a ×Mult source, makes 11 fixtures (8 for rooms). D-102 (Accepted 2026-11-06, with D-093's option B): a Renovation is a week's turn too, like installing a drawn fixture.

**Why:** Fixtures make the house better without making it bigger, so late placements still matter (the snowball problem in `implementation-plan.md` §2), and every hand offers a choice between growing and improving. Combolands' closest equivalent is its single-building upgrades, which are bought consumables. Floor Plan draws features into existing rooms the way our hands draw fixtures. The cost decides the split: a drawn fixture costs a week, so it competes with a piece, and a bought one costs budget, so it's free to install.
**Considered:** Every install as a free action, which turns the hand into a shopping list. Every install costing a week, which makes bought fixtures a poor buy. Fixtures only in the shop.
**Changes:** D-004 (Accepted): a week's turn can be an install instead of a placement. A week never gets a second piece. `jam-scope.md`: Fixtures move from Stretch into the jam build.
**2026-11-06 (D-095, Proposed):** Garden Lights in a Sapling vanished when it became a Tree, since a Tree is a lot feature, not a piece. A piece that becomes a lot feature now can't hold a fixture. How a fixture leaves is unchanged.

### D-051 · The shop: five kinds of goods
**Status:** Accepted · 2026-11-05 (confirmed by the team)
**Decision:**
- **Five kinds of goods:**
  - **Blueprints:** run-long rule-benders in 4 slots, Common, Uncommon, or Rare
  - **Pieces:** special pieces, which go into the reserve
  - **Fixtures:** go into supplies and install for free (D-050)
  - **Tools:** one-shot free actions, such as moving a piece, a week's bonus, or a redraw from special pieces. They share the 3 supply slots with fixtures. None adds a second piece in a week or an overtime week.
  - **Company upgrades:** permanent rule changes, one offered per visit from the second shop
- **Crates:** pick-1-of-3 packs of blueprints, fixtures, or pieces. The first shop always gives a free crate of Common blueprints.
- **Services:** +1 reroll and +1 demolition, whose prices rise with each purchase for the rest of the run.
- **Every visit:**
  - fixed category slots
  - one item at half price
  - a refresh whose price rises within the visit and resets at the next
  - selling blueprints and supplies for half their list price
  - offers you can't take (a full slot, a blueprint you own) are greyed out, and an opened crate can be discarded
  - a small reward for leaving without buying
- **Rarity:** weights shift toward Rare in later shops, and rarity is shown on every blueprint, fixture, and tool.
- **Core catalog:** 16 blueprints, 10 fixtures, 9 special pieces, 8 tools, 7 upgrades, and 4 crates (Appendix B of `implementation-plan.md`). Five of the special pieces (Sunroom, Hot Tub, Fire Pit, Henhouse, Birdhouse) were Stretch in `content-brainstorm.md`.
  *Changed by D-120 (Proposed 2026-11-09):* the Sunroom leaves the special pieces for the weekly draw, so the shop sells 8.
- The shop is open in every run, including the first.
**Amended by:** D-056 (Accepted 2026-11-05): 18 blueprints, 11 fixtures, and 12 tools from 7 kinds (the Remodel Plans level sets); It's a House and Rush Order become +Mult, and Last-Minute Push becomes ×Mult.

**Why:** The team asked for much more variety. Combolands' shop mixes passives, consumables, single-building upgrades, and packs, with stock that grows over a run. Balatro, Slay the Spire, and others add the patterns that make each visit feel different: guaranteed category slots, a sale, escalating rerolls, packs, and selling for half. Combolands players say its locked early shop made first runs drag. Each good reuses an existing building block or adds one small mechanism (a tool kind, a rule key, the crate screen), so the catalog stays data. Sources are in `research.md`'s 2026-11-05 update.
**Considered:** Freezing an offer for the next visit (Super Auto Pets, Backpack Battles), held for Stretch. A tool that plays a second piece in a week, left out because it would break D-004. An Overtime Voucher tool, left out because it would change D-041's 2 overtime weeks. "Sell-to-use" blueprints (Combolands' Loaded Dice), which tools cover more simply.
**Changes:**
- D-004 (Accepted): tools and bought fixtures are free actions during a week, and none adds a second piece.
- D-013 (Accepted): selling, the skip reward, and Savings Account interest are budget sources.

Also: D-036 and D-043 (Accepted), where hand size becomes the `handSize` rule (3 by default, 4 with Bigger Truck). D-046 (Accepted), where this replaces its shop defaults in Appendix A (one paid refresh per visit, no selling).
*Changed by D-121 (Proposed 2026-11-09):* hand size is two rules, `roomsRow` (2) and `layoutRow` (2); the Bigger Truck adds a Rooms card.

### D-052 · Schedule: feature freeze at the end of day 4
**Status:** Superseded by D-053 · 2026-11-05 (the team is two people with no day timeboxes)
**Decision:**
- **Day 1:** the scaffold and the vertical slice.
- **Day 2:** the full run, rules breadth, and the sim.
- **Days 3–4, in parallel:**
  - the economy, shop, fixtures, and tools
  - clients, sets, change orders, and crews
  - the UI shell, sound, the art pass (its direction chosen on day 2), hints, and sim reports
- **Feature freeze at the end of day 4.**
- **Days 5–6:** playtesting, balance, juice, art, and sound, with two builds a day. The final friend playtest is at midday on day 6, and content freezes at the end of day 6.
- **Day 7:** ship.
- Each milestone is timeboxed to its day. Unfinished work goes to the cut list instead of moving the freeze.

**Why:** The previous plan built features until day 5 and held one playtest, on the evening of day 6, which left no time to act on what friends found. This kind of game gets fun through tuning, and the sim and the daily link make tuning cheap once the systems exist.
**Changes:** D-029 (Accepted), its suggested build order.

### D-047 · Desktop first
**Status:** Accepted · 2026-11-05 (confirmed by the team)
**Decision:**
- Designed for mouse and keyboard at a minimum of 1280×720, which is also the itch.io embed size, with fullscreen enabled.
- Rotate has an on-screen button.
- Tapping places a piece tentatively and **End week** commits it, so touch works too.
- Below about 900px wide, a "best played on a computer" notice replaces any attempt at a phone layout.

**Why:** Friends will open the link from a group chat, and the itch.io embed is a fixed size. Both need deciding before the layout is built. The team agreed on 2026-11-05 not to aim for mobile.
**Amended by:** D-057 (confirmed by the team 2026-11-05): the design target is 1920×1080, since most players have at least a 1080p screen. The whole 24×24 lot fits there at a crisp 2×. 1280×720 still works, by panning. An itch.io page is optional now that Pages hosts both builds (D-060); if we make one, its embed is 1600×900 with fullscreen.
**Amended by:** D-097 (Accepted 2026-11-06): with 32 art px per cell, the whole lot fits at 1080p at 1×, the same size on screen as the 16 px art's 2×.

### D-053 · A two-person, phased build with a playtest after each phase
**Status:** Accepted · 2026-11-05 (requested by the team)
**Decision:**
- The team is two: the user and Claude. Claude implements; the user playtests, reviews, and decides.
- The build goes in phases, M0 to M7 (`implementation-plan.md` §7). M1 to M6 each end with something playable, a short list of playtest questions, and a fix pass before the next phase starts. M0 is setup, and M7 is the release.
- There are no day timeboxes. The phase order is the priority order, so stopping after any playtested phase leaves a working game.
- Before each playtest, Claude runs the tests and the sim, plays a quick run in the browser pane, and writes a short note on what to try.

**Why:** The other jam members are building their own games, so there are no parallel tracks to coordinate. There's until next week to build and playtest before sharing with the larger group, and playtesting at every phase catches what isn't working while it's still cheap to change.
**Changes:** Supersedes D-052. D-029 (Accepted): its suggested build order.
**Amended by:** D-097 (Accepted 2026-11-06): M5 splits in two, each ending in a playtest. M5a (art, UI chrome, and the visual juice) comes before M4, and M5b (sound and music) after it. Since 2026-11-07, M5a's visual juice is its own pull request after M4, with its own playtest (D-097's juice note).

### D-054 · Branches: develop and main
**Status:** Accepted · 2026-11-05 (requested by the team)
**Decision:**
- `develop` is cut from `main`, and all work lands there.
- Each phase gets a branch off `develop` (for example `phase/m1-slice`), merged into `develop` by PR after its playtest.
- A release merges `develop` into `main` with a tag (`v0.1`, `v0.2`, …). Only `main` deploys to GitHub Pages.
- CI tests every push and PR to both branches.
- Playtests run locally from `develop` or a phase branch.

**Why:** Keeps `main` and the public link stable while work is in progress, and makes each phase one reviewable diff.
**Changes:** D-034 (Accepted): its hosting bullet.
**Amended by:** D-060 (Accepted 2026-11-05): Pages also serves `develop` at `/dev/`; `develop` is the GitHub default branch; releases are PRs from `develop` into `main` that the user opens and merges, and tagging is optional.

### D-060 · GitHub Pages: releases at the root, develop at /dev/
**Status:** Accepted · 2026-11-05 (requested by the team)
**Decision:**
- **Two builds on one GitHub Pages site:**
  - `main` at the root: https://swalliso.github.io/house-game/
  - `develop` at `/dev/`: https://swalliso.github.io/house-game/dev/, a work-in-progress build that can be shared with other jam members
  - before the first release, the root shows a short placeholder that links to `/dev/`
- **One deploy job builds both:** a push to either branch runs it. It builds both branch tips into one Pages artifact, because a Pages site holds one artifact at a time. Vite's relative `base: './'` lets the same build work at either path.
- **Saves stay separate:** both builds share one origin, so saves and settings are namespaced by channel (`main`, `dev`, `local`). The build label shows the channel and the short SHA.
- **`develop` is the GitHub default branch,** so PRs, and new work generally, target it.
- **Releases are manual:** the user opens and merges a PR from `develop` into `main` at a good point. A tag (`v0.1`, …) is optional.
- **The `github-pages` environment allows both branches to deploy.** By default it allows only one, and a deploy from the other branch fails with an "environment protection rules" error.
- Local playtests still work too: `npm run dev`.

**Why:** The team wants a link for other jam members while the stable link stays on releases. Building both branches into one artifact is the simplest way for one Pages site to serve two branches.
**Changes:** D-054 (Accepted): Pages and the release flow. D-034 (Accepted): hosting.
**Amended by:** D-063 (Accepted 2026-11-05): CI and deploys are separate workflows, each branch is tested before it's published, and a broken `develop` never blocks a release.

### D-061 · Branch protection: develop and main change only by pull request
**Status:** Accepted · 2026-11-05 (requested by the team)
**Decision:**
- Two repository rulesets, "develop: changes by pull request" and "main: releases by pull request". On both branches:
  - no deleting the branch, and no force pushes
  - changes arrive only through pull requests; nobody pushes directly
  - a code owner's review is required. `.github/CODEOWNERS` makes the user (`@Swalliso`) the owner of every file.
  - the CI job `test` must pass
- **`main` takes merge commits only,** so `develop` stays an ancestor of `main` and release PRs never re-show changes that were already released. `develop` takes any merge method.
- **The repository admin (the user) may bypass these rules only inside a pull request:** they can merge a PR that lacks the review, but nobody can push straight to either branch.
- **Claude pushes with the user's account,** and GitHub doesn't let an author approve their own PR. So Claude's PRs also need that bypass: the user ticks "Merge without waiting for requirements to be met". Claude never merges PRs; the user does.
- **Nobody else can push anyway:** the user is the only collaborator, and outsiders can only fork and open PRs, which need the user's review.
- CODEOWNERS reaches `main` with the first release PR. Until then nothing on `main` changes except through a PR the user merges.

**Why:** The repo is public, and the user wants to be the gatekeeper of every change. The rules turn the agreed workflow (D-054, D-060) into something GitHub enforces rather than a promise: no accidental pushes or force pushes to the two long-lived branches, CI before every merge, and the code owner on every change.
**Considered:**
- Requiring an approval with no bypass: it deadlocks, since an author can't approve their own PR.
- A separate GitHub account for Claude, so the user can approve its PRs normally: possible later, if the bypass click gets old.
- Requiring branches to be up to date before merging: it would force merging `main` back into `develop` after every release.

**Changes:** D-054 and D-060 (Accepted): now enforced by rules.
**Amended by:** D-064 (Accepted 2026-11-05): no code-owner review is required any more, so the user merges their own PRs normally, and Claude merges its setup and fix PRs. PRs only, the `test` check, no force pushes or deletion, and merge commits only on `main` all stay.

### D-019 · Score name
**Status:** Accepted · 2026-11-05 (chosen by the team)
**Decision:** The week's three layers (D-056) are **Comfort** (what pieces earn; blue), **Charm** (the additive multiplier; rose), and **Sparkle** (the rare ×Mult; gold). The score is **Wow**: each week's total and the run total. In the tally: "Comfort 240 × Charm 2.5, Sparkle ×2 = 1,200 Wow". The code keeps the neutral names `points`, `mult`, `xMult`, and `total`.
**Why:** Three distinct words avoid Balatro's +Mult and ×Mult confusion, and Wow was already the working name. Alternatives considered: Delight, Hearth, Appraisal (`implementation-plan.md` §12). It can still change after a playtest.

### D-056 · Scoring is Points × Mult, with rare, planned ×Mult
**Status:** Accepted · 2026-11-05 (the team's request, and the model confirmed by the team). The numbers are placeholders for the sim.
**Decision:**
- A week scores **Points × Mult**:
  - **Points:** what the pieces earn, plus each held set's Points
  - **Mult:** starts at ×1 and adds +0.25 per spec met, each held set's Mult, and a few +Mult blueprints and tools
- **×Mult** sources each multiply the week's Mult once, however many pieces trigger them, and distinct sources multiply each other. They're rare and each needs a setup:
  - the Full House set (×2)
  - three Rare blueprints: Last-Minute Push (×2 in a phase's last week), Model Home (×(1 + 0.1 per piece with a fixture)), and Ahead of Schedule (×(1 + 0.2 per milestone completed early))
  - one Rare fixture, the Chandelier (×1.25 while its room is in an Entertainer)
- **Sets work like poker hands:** each pays Points and +Mult every week, rising with difficulty. Four Remodel Plans tools level a set type for the rest of the run, like Balatro's Planet cards.
- Per-piece percentage bonuses still add, as in D-037.
- The order is fixed (+Mult, then ×Mult), and each layer gets its own color and sound.

**Amended by:** D-093 (Accepted 2026-11-06): one Entertainer per house (`maxInstances: 1`), beside M4a's Suite and Full House.
**Why:** In Balatro and Combolands, big moments come from multipliers. Making them powerful but rare and conditional means you plan for them rather than stumble into them. Balatro puts ×Mult on 70% of its Rare jokers and 3% of its Common ones, and its players confuse +Mult with ×Mult when they look alike. Keeping multiplication in one weekly step avoids D-037's ×15–×36 per-piece blowups. Targets come from the sim's median curve, which ×Mult may steepen.
**Changes:**
- D-037 (Accepted): the week's formula.
- D-021 (Accepted): how specs pay.
- D-019: the layers' names (Comfort, Charm, Sparkle, Wow).
- D-050 and D-051 (Accepted): adds the Chandelier (11 fixtures), Model Home and Ahead of Schedule (18 blueprints), and the Remodel Plans tool kind (12 tools); turns It's a House and Rush Order into +Mult; turns Last-Minute Push into ×Mult.

### D-018 · Milestones are construction phases
**Status:** Accepted · 2026-11-05 (with the plan's approval)
Groundbreaking → Foundation → Framing → Roofing → Drywall → Finishes → Final Walkthrough. Each milestone is a client walkthrough.

### D-020 · Pieces built from tags and effect types
**Status:** Accepted · 2026-11-05 (with the plan's approval), as refined by D-038
Every piece has tags (Quiet, Loud, Social, Wet, Sunny, Outdoor, Kid, Pet, Green, Dark, …) and effects built from a small shared set of effect types. Clients, change orders, HOA rules, and shop upgrades target tags, so new content is mostly data. See `content-brainstorm.md`.
See also D-038 (Accepted): the data format, piece-id targets, relational selectors, and four more effect kinds.

### D-021 · Client spec checklist
**Status:** Accepted · 2026-11-05 (with the plan's approval), as amended by D-056: each spec met adds +0.25 Mult
Each client has a short spec checklist (e.g., 4 Bedrooms, 2 Bathrooms, a Fenced Yard), and each item met multiplies weekly score. Together with the client's tastes, this is how clients judge the house differently.
See also D-037 (Accepted): spec bonuses add (+25% each) rather than compound. D-056 (Accepted 2026-11-05): each spec met adds +0.25 to the week's Mult.
**Amended by:** D-101 (Accepted 2026-11-06, with D-093's option B): every checklist starts with seven house rules in the client's numbers, and a spec can have a ceiling as well as a floor. Each house rule has a floor, so Appendix A's "specs are positive achievements" still holds.

### D-025 · House data separate from run data
**Status:** Accepted · 2026-11-05 (with the plan's approval). The state shape is in `implementation-plan.md` §4 (`HouseState` separate from `RunState`).
Keeps the door open for a future renovation mode that starts from an existing house.

### D-027 · Tech defaults
**Status:** Accepted · 2026-11-05 (with the plan's approval), as amended by D-033 (rendering) and D-034 (versions and hosting)
TypeScript + Vite. The game rules live in a pure TypeScript module with no rendering code, covered by unit tests, with a thin rendering layer on top (Phaser is a good fit for the board and animations; settle this during planning). Seeded randomness from day one. Static hosting (itch.io or GitHub Pages) so friends can play from a link. Where the repo's existing conventions differ, follow the repo.
Rendering settled by D-033 (Accepted 2026-11-04): Preact and the DOM, not Phaser. Versions and hosting: D-034 (Accepted).

### D-028 · Score accumulates across the run
**Status:** Accepted · 2026-11-05 (with the plan's approval)
One running total, with each milestone at a higher total, shown as a single progress bar with phase markers. Weekly earnings are never wasted, so choosing to keep building instead of completing early always adds to the total.

### D-029 · Jam scope and starting numbers
**Status:** Accepted · 2026-11-05 (with the plan's approval), as amended by D-042, D-044, D-046, D-048, D-049, and D-053. `jam-scope.md` was updated to match in M0.
See `jam-scope.md` for what's in, what's stretch, what's out, placeholder numbers, and a suggested build order.
Amended by D-042 (Accepted 2026-11-04): 4 weeks per milestone instead of 6. Amended by D-048 (Accepted 2026-11-05): a 24×24 lot instead of 12×12; see also D-049 (terrain) and D-053 (the phased build), both Accepted. See also D-044 (Accepted): the sim moves to M2; D-046 (Accepted): early-completion reward numbers.

### D-030 · Placeholder art first
**Status:** Accepted · 2026-11-05 (with the plan's approval), as refined by D-057
Build with simple shapes and labels until the core loop is fun, then do an art and sound pass. CC0 asset packs are fine for the jam.
*Refined by D-057 (2026-11-05): the final look is cozy pixel art, and placeholders are simple sprites in the final atlas format, so swapping in real art is free.*

### D-034 · Toolchain, hosting, and repo layout
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Decision:**
- npm and Node 26.
- TypeScript pinned to ~6.0, the last JavaScript-based compiler, verified with this stack.
- Vite 8, Vitest 5 with fast-check, Preact 10 (not 11, which is newer than Claude's training data), and Prettier.
- No ESLint: a DOM-free tsconfig plus a small test keep `src/rules` pure.
- One GitHub Actions workflow tests every push and deploys `main` to GitHub Pages; itch.io gets a manual upload for the jam.
- The design docs move into `docs/`, and a short `CLAUDE.md` points future sessions to them.

**Why:** D-027's defaults, with versions checked on 2026-11-04. Pages gives a live link without secrets.
**Amended by:** D-054 (Accepted 2026-11-05): work lands on `develop`. D-060 (Accepted 2026-11-05): Pages serves `main` at the root and `develop` at `/dev/`, and `develop` is the GitHub default branch.
**Refined by:** D-062 (2026-11-05): the versions, JSX setup, build stamp, purity checks, and deploy details chosen in M0.

### D-035 · Board rules: adjacency, lot features, one house
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Confirmed 2026-11-04:** indoor rooms must connect into one house. **Confirmed 2026-11-05:** the terrain-neighbor rules from D-049. The rest was accepted with the plan.
**Decision:**
- Adjacency is orthogonal (no diagonals), and each distinct neighbor counts once.
- Each Tree tile is a Quiet, Green neighbor, so effects that count Trees have a cap. The Pond and the Creek each count once. The Street is one Loud neighbor along the bottom edge. Boulders and finds give nothing (D-049).
- If any indoor piece exists, a new one must touch one. Demolishing an indoor piece that would split the house isn't allowed.
- A Garage must also touch the street or a Driveway, and a Driveway must touch the street or another Driveway.

**Why:** Adjacency has to be fixed before any number is tuned. A connected house keeps the result looking like a house: Floor Plan and Combolands are both criticized for finished layouts that make no sense. It also gives exterior and interior rooms and the front yard a clear meaning.
**Considered:** Rooms anywhere; 8-way adjacency (Combolands).

### D-036 · Week flow
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Confirmed 2026-11-04:** Pass (amends D-004). **Confirmed 2026-11-05:** the free actions and hand size from D-050 and D-051. The rest was accepted with the plan.
**Decision:**
- **Start of week:** transforms resolve, then a hand of distinct cards is drawn: 3 by default, set by the `handSize` rule (pieces, plus fixtures from phase 2; D-050). If nothing in the week's first hand fits, there's one free redraw.
- **During the week:** reroll, demolish, installing a fixture from supplies, and using a tool are free actions (D-050, D-051). Then place one piece, install a drawn fixture, or **Pass**. A placement stays tentative until **End week**, so undo is free.
- **End of week:** the new piece earns that same week. Scoring is a single pass, and no effect triggers another.

**Why:** Pass is needed for full lots and dead hands; Luck be a Landlord and Combolands both have one. Resolving transforms first means the preview always matches the tally. A single pass avoids Combolands' infinite-loop bug and its hidden trigger cap.
**Changes:** D-004 (Accepted). Each week is still one turn, but Pass places nothing.
**Amended by:** D-102 and D-103 (Accepted 2026-11-06, with D-093's option B): a week's turn can be a Renovation, and the household's arrivals add a start-of-week step, after transforms and before the draw.
*Changed by D-121 (Proposed 2026-11-09):* the hand is two rows, Rooms 2 and Layout 2 (the `roomsRow` and `layoutRow` rules replace `handSize`). A card with no play is swapped for another from its row instead of the free redraw, and a reroll redraws one row.
*Changed by D-132 (Proposed 2026-11-10):* a reroll redraws both rows.

### D-037 · Scoring math and the live preview
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Decision:**
- Each piece earns `floor((max(0, points) × max(0, 100 + Σ pct) + 50) / 100)` in integer math. Percentage bonuses add rather than compound, and "earns nothing" overrides to 0.
- Sets and specs are week-level terms: the week's score is Points × Mult (D-056), and each spec met adds +0.25 to Mult.
- The live preview shows the net change to the whole weekly total, with a +/− on every affected piece.

**Why:** Multiplying everything gives ×15 to ×36 on single pieces, which no target curve can absorb. A new piece changes its neighbors' earnings, so showing only its own number misleads. Refines D-021.
*Refined by D-056 (2026-11-05): the week's score becomes Points × Mult, with rare ×Mult sources. Per-piece percentages still add.*

### D-038 · Content is typed data
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Decision:**
- Pieces, features, sets, blueprints, clients, crews, change orders, and balance numbers are typed object literals in `src/content`.
- The rules implement a fixed set of building blocks: effect kinds, selectors (including relational ones such as "touching X" and "in the fenced yard"), piece and house conditions, and modifiers. An escape hatch covers true one-offs.
- Card text is generated from the data.
- Appendix B of `implementation-plan.md` writes every Core item in this format, without the escape hatch.

**Why:** Refines D-020. The Core content needs piece-id targets, relational selectors, four more effect kinds (per-tile, link, requires, conditional), and a separate set definition.

### D-039 · Randomness, run codes, replays
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Decision:**
- A hand-rolled `sfc32` generator.
- Every random decision derives a fresh stream from the run seed and a key (`lot/<attempt>`, `draw/<phase>/<slot>/<n>`, `shop/<phase>/<refresh>`, `crate/<phase>/<refresh>/<slot>`, `find/<x>,<y>`, `co/<phase>`, `jobs/<i>`).
- A run is `build + seed + setup + action log`, shared as a run code that replays exactly.
- Replays return the failing step instead of throwing, and a stale save starts a fresh run with a note.

**Why:** Keyed streams stop rerolls, overtime, or early completion from shifting later hands or the shop. That keeps bug reports reproducible and makes the Daily Lot (D-022) fair. The build stamp copes with deploys on every push.
*Changed by D-121 (Proposed 2026-11-09):* each row of the hand has its own stream, `draw/<phase>/<slot>/<n>/<row>`, and a swap draws from `draw/<phase>/<slot>/<n>/<row>/swap<k>`. A run code's reroll carries its row.
*Changed by D-132 (Proposed 2026-11-10):* a reroll redraws both rows, each on its stream, and a run code's reroll names no row.

### D-043 · Draws: distinct, weighted, phase-gated
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Decision:**
- Each hand holds `handSize` (3 by default) distinct card types: pieces, plus fixtures from phase 2 (D-050).
- Weights are integers (10 = normal) and come only from the piece, client, and crew, so they're fixed for the run.
- Special pieces have weight 0 unless a client or crew adds them.
- The client's spec pieces get +100%, and their signature special pieces (Library, Mudroom) are added at weight 20.
- Each piece has a `fromPhase`, so phase 1 draws only simple pieces. *Refined by D-055: simple pieces are weighted up early instead of complex ones being locked out; `fromPhase` stays only as a hard gate where a card can't work yet.*

**Why:** With uniform draws, the Hendersons' checklist takes a median of 23–24 weeks to complete, and about 6% of runs never finish it (estimate from a planning model). With weighting, the median is 14–16. The phase gate keeps the first run learnable.
**Amended by:** D-104 (Accepted 2026-11-06, with D-093's option B): while a room type is at its limit in the client's checklist, its cards draw at half weight. Otherwise weights stay fixed for the run.
*Changed by D-121 (Proposed 2026-11-09):* each row holds its own distinct cards, Rooms 2 and Layout 2, with the weights as here.

### D-044 · The sim sets milestone targets
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Decision:**
- A minimal headless sim (random and greedy bots, about 200 runs) arrives in M2, not M5.
- Targets are a rising fraction of the median greedy-bot score at each milestone (about 0.6 → 0.85), times a per-client factor.
- Per-piece, per-client, early-completion, and shop reports come in M3 and M4. A planner bot and fuller sweeps come in M6, only as needed (D-053).

**Why:** Score grows roughly with the square of the week, so hand-picked targets will be wrong, and they shift with every content change.
**Changes:** D-029 (Accepted), its suggested build order.

### D-045 · First-run onboarding without saved progress
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Decision:**
- Every run, including the first, starts with the job board and a crew pick (D-012, D-032). On a first visit, the Hendersons and the General Contractor are marked "Recommended for your first job".
- Phase 1 draws mostly simple pieces (D-055).
- The shop opens after milestone 1 and change orders start after milestone 2.
- First-time hints are dismissible and remembered in the browser. That's UI only, not game state.

**Why:** A first run otherwise meets about 75 concepts. With no meta-progression in the jam, the run itself has to do the teaching.
**Considered:** A fixed first contract. Rejected because it changes D-012 and needs a saved run count.

### D-046 · Defaults for the rules the docs leave open
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Confirmed 2026-11-04:** economy pieces are a budget source (amends D-013). **Confirmed 2026-11-05:** the fenced-yard rule from D-049. The rest was accepted with the plan.
**Decision:** Appendix A of `implementation-plan.md` lists every rule the docs leave open, with a default. The ones that change a number or content item in the existing docs are:
- **Budget:** economy pieces (paying every 2–3 weeks), change-order rewards, and set rewards are budget sources too (amends D-013).
- **Early completion reward:** placeholders of +2 budget and 10% of the phase's earnings per week saved, replacing +1 budget and an undefined "+10% phase bonus".
- **Lawn:** earns per adjacent Lawn (max 4) instead of per connected Lawn tile.
- **Specs:** must be positive achievements. "No Pool" and "no Garage" become tastes. Juniper's limit becomes the spec "a house of 4–8 rooms", plus a −10% taste per room over 8. Dale's "nothing Loud next to an office" ignores the street.
- **Jack-and-Jill:** stays a set, and the Bathroom's own Bedroom bonus is capped at one Bedroom.
- **Change orders:** one after each of milestones 2, 4, and 6, as `jam-scope.md` says. Requests and restrictions can be declined. Phase effects are announced and apply.
- **Fence:** earns per tile of the fenced yards it borders (capped in total). A fenced yard needs a Fence, at least 4 tiles, no contact with the street edge, and contact with the house (D-049). *Amended by D-069 (Accepted 2026-11-05): at least 10 tiles.*
- **Hallway:** links every room touching it, not just the rooms at its two ends. *Extended by D-114 (Proposed 2026-11-09): it also earns +2 for each room it touches, up to 4.*

**Why:** Each one fixes a contradiction or a degenerate case the design review found (see `implementation-plan.md` §2).
**Changes:** D-013 (Accepted), by adding budget sources; D-029 (Accepted), its early-completion numbers.

### D-055 · Simple pieces are more likely early in a run
**Status:** Accepted · 2026-11-05: the direction at the team's request, and the weights below with the plan's approval.
**Decision:**
- Every piece has a complexity from 1 to 3:
  - 1: plain earners (Bedroom, Kitchen, Lawn)
  - 2: conditions, regions, timers, or requirements (Garage, Herb Garden, Sapling)
  - 3: build-arounds (Fence, Hallway, special pieces)
- A piece's draw weight is scaled by a per-phase percentage: complexity 3 is at 5% in phase 1, 25% in phase 2, 60% in phase 3, and 100% from phase 4. The table is in `balance.ts` and Appendix A.
- Complex pieces can still appear early, just rarely. Client spec pieces keep their +100% on top.
- `fromPhase` stays only as a hard gate where a card can't work yet (fixtures, from phase 2).

**Why:** The team wants early phases to feel like Combolands: the simple, readable pieces show up first, and the game opens up as you learn it. Luck be a Landlord also offers mostly simple symbols early. Weighting rather than locking out keeps surprises possible.
**Changes:** D-043 and D-045 (Accepted), their phase gate.

### D-057 · Art: cozy top-down pixel art
**Status:** Accepted · 2026-11-05: the direction at the team's request, and the details below with the plan's approval.
**Confirmed 2026-11-05:** design for 1080p and up, since the team expects most players to have at least a 1080p screen. The whole lot fits at a crisp 2× there; smaller windows pan at 2×, with the Fit overview.
**Decision:**
- Cozy pixel art like Combolands: detailed enough to read what you're building, not so detailed that it distracts.
- 16×16 tiles, one shared palette of 24–32 colors, colored dark outlines, and light from the top-left.
- Rooms are shown as a top-down cutaway, with a floor and one key furniture sprite each. Installed fixtures show as small sprites. Roofs appear for the Roofing milestone and the end screen.
- Rendering is crisp at whole-number scales:
  - terrain in a canvas layer, and pieces from a sprite atlas
  - the camera zooms by re-laying out the board in whole steps, not with a CSS transform
  - the default zoom is at least 2×, panning when the lot overflows: at 1080p the whole lot fits at 2×, and at 1280×720 it pans
  - the one exception is the Fit overview, which shows the whole lot at the largest scale that fits, even a non-integer one (1.75× at 720p)
  - short juice tweens (pops, wobble, the celebration zooms) may use transforms
- If we make an itch.io page, its embed is 1600×900 with fullscreen. The main way to share is Pages (D-060).
- **Sources:**
  - Claude-drawn placeholder sprites in the final atlas format from M1.
  - **Final art (chosen by the team, 2026-11-05):** LimeZu's Modern Interiors and Modern Exteriors, which the user buys, plus LimeZu's free Serene Village (CC BY 4.0) for terrain and water. The license is paid, allows commercial use, forbids redistribution, and requires credit.
  - The full packs stay out of the public repo, in an `art-source/` folder in the main checkout that git ignores through the repo's local exclude file (and, from M0, `.gitignore`). Only the sprites we use are cut into `assets/`, which LimeZu has said is fine for open-source projects.
  - Every asset is recorded in `assets/licenses.json` and `CREDITS.md`.

**Why:** The team chose the look. The rendering rules come from browser constraints: pixel art blurs at fractional scales and under transforms in Safari. The licensing rules keep a public repo safe.
**Changes:** Resolves the art Open question. D-030: placeholders become sprites. Confirmed 2026-11-05, the first on its own and the other two with the plan:
- D-047 (Accepted): the 1080p design target.
- D-049 (Accepted): the camera, from a CSS transform to re-layout in whole steps, with 2× panning rather than fitting at 1280×720.
- D-033 (Accepted): terrain in a canvas layer and pieces from a sprite atlas.

**Amended by:** D-097 (Accepted 2026-11-06): a cell is 32 art px, a 2×2 block of LimeZu's 16 px tiles, and the default zoom is never below 1× (at 1080p, the same size on screen as 2× was; where display scaling isn't a whole number, 1× rounded down to whole device pixels). Crisp now means whole device pixels per art pixel rather than whole-number scales: k ÷ devicePixelRatio, so 1×, 2× and 3× at a devicePixelRatio of 1 and 0.5× steps on a Retina screen, with Fit still the exception. Rooms get several furniture sprites. The palette is LimeZu's, with the color limits only for the placeholders, and Serene Village isn't needed.
**2026-11-06 (M5a review):** no link or quote is recorded for "LimeZu has said" in the Sources bullet, and the two packs' licenses differ on open source. The team chose to keep the Sources bullet's approach for both packs; see D-097's license note.

### D-058 · Sound: calm music, rewards that escalate
**Status:** Accepted · 2026-11-05: the direction at the team's request, and the details below with the plan's approval.
**Decision:**
- **Music:**
  - calm: 70–90 BPM, sparse plucked and mallet instruments, rests
  - 3–4 synced stems that crossfade between screens
  - at least 2–3 tracks
- **Reward sounds:**
  - Points, +Mult, and ×Mult each have their own timbre
  - a pitch ladder that climbs the music's scale during each week's tally
  - escalation layers that fade in above the week's pace, and ducking under big jingles
- Our own small Web Audio wrapper, scheduled on the audio clock. ZzFX makes placeholders.
- CC0 sources first, CC BY with credit, and nothing non-commercial, share-alike, GPL, or ripped from other games.

**Why:** The team wants calm music with the dopamine moments given their due, like Balatro, Combolands, and Vampire Survivors. Details and sources are in `implementation-plan.md` §12.
**Changes:** Resolves the sound Open question.

### D-059 · Juice is a core feature
**Status:** Accepted · 2026-11-05: the direction at the team's request, and the details below with the plan's approval.
**Decision:**
- Reward feedback is built from the vertical slice on, not left for polish: the M1 slice has the tally director, the Points × Mult counters, the pitch ladder, and one big-week tier.
- M5 builds the full celebration ladder (`implementation-plan.md` §12):
  - four tiers against the week's pace (Normal, Good, Great, Huge), each with its own jingle
  - the glow during the preview
  - the pile of room sprites
  - the milestone moment
  - rarity glow on crates
- Every celebration is skippable after the first time it's seen. The tally speeds itself up, and there are speed settings.
- Reduce motion, screen-shake, flashing, and volume settings.

**Why:** In these games, the satisfaction of a big combo is the product. Research says medium-to-high juice beats both none and extreme, and that unskippable or slow celebrations wear thin after many viewings.
**Changes:** None to settled decisions. Juice isn't on the cut list.

### D-062 · M0 setup details
**Status:** Accepted · 2026-11-05, with the M0 pull request. Implementation details within D-034 and D-060.
**Decision:**
- **Versions,** checked on npm on 2026-11-05: Vite 8.3, TypeScript 6.0.3 (`~6.0.3`), Vitest 5.1, Preact 10.29 with `@preact/signals` 2.11, fast-check 4.10, Prettier 3.9, and `@types/node` 26. The lockfile pins the exact versions. CI uses `actions/checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, and `deploy-pages@v5`.
- **JSX:** Vite 8's built-in Oxc transform compiles Preact's JSX (`oxc.jsx.importSource` in `vite.config.ts`). There's no `@preact/preset-vite`, so no Babel; the cost is no Prefresh hot reload, so editing a component reloads the page. CSS still hot-reloads, and from M1 a reload resumes the saved run. `preact/debug` loads in dev builds only.
- **Build stamp:** `vite.config.ts` defines `__BUILD_SHA__` (`git rev-parse --short=7 HEAD`) and `__BUILD_CHANNEL__` (from `VITE_CHANNEL`: `main`, `dev`, or `local`, the default; any other value fails the build). Only `src/ui/build-info.ts` reads them, and the corner label shows `channel · sha`. The rules stay build-agnostic: the UI will pass the build into run codes.
- **Purity:** `src/rules` and `src/content` may import only from each other: no packages, no Node built-ins, no `src/ui`. `src/rules/purity.test.ts` reads the syntax tree and also bans `Math.random`, `Date`, and browser globals, so card text such as "Date Night" is fine. `tsconfig.rules.json` turns JSX off, because Preact's JSX types pull in the DOM lib; a test checks that the rules program loads no DOM, Node, or Vite types. It also resolves imports the way Node does (`nodenext`), so an import without its `.ts` extension, which Vite accepts but the sim's Node can't run, fails the typecheck.
- **Deploy:** see D-063. Until `main` has a `package.json`, the root is `.github/pages-placeholder/index.html` from `develop`.
- **Assets:** `assets/licenses.json` is an object keyed by each file's path under `assets/`, with `source`, `author`, and `license`. `CREDITS.md` shows the format.
- **Tooling:** Prettier with single quotes and 100 columns. It skips `docs/`, so the planning docs keep their hand formatting, and CI doesn't check formatting. Vitest only looks in `src/`, `sim/`, and `scripts/`, Vite's dev-server watcher ignores this checkout's own `.claude/`, and Prettier ignores `.claude/worktrees/`, because the main checkout holds Claude's worktrees there. The watcher's pattern is anchored to the checkout, because every worktree's own path contains `/.claude/`. `.claude/launch.json` has `dev` and `preview` servers for the browser pane.

**Why:** These are choices D-034 left open. Each keeps the setup small: fewer dependencies, checks that catch mistakes early, and and checks before anything is published.
**Considered:** `@preact/preset-vite` for Prefresh hot reload, which brings Babel and is easy to add later if reloads get annoying. A regex purity test, which flags comments and card text.

### D-063 · CI and deploys are separate, and a broken develop never blocks a release
**Status:** Accepted · 2026-11-05 (the team's request, following the team's earlier projects Dig Deep and Spore & Sprawl)
**Decision:**
- **Two workflows:**
  - `ci.yml` runs the required `test` job (typecheck, tests, build) on every pull request and on pushes to `phase/**` and `fix/**` branches. It deploys nothing.
  - `deploy.yml` runs on pushes to `main` and `develop`, and by hand.
- **Each branch is tested before it's published.** Pages holds one site, so every deploy still rebuilds both branch tips, but each one's `npm test` and `npm run build` (which typechecks) must pass first.
- **A broken `develop` never blocks a release.** On a push to `main`, a `develop` that fails is left out, so `/dev/` is missing until it's fixed. On a push to `develop`, a failing `develop` fails the run and the live site stays as it was.
- The build job can only read the repo; only the small deploy job can write to Pages. `configure-pages` is dropped, since nothing used its output.

**Why:** The team wants `main` and `develop` deploys kept apart, as in Dig Deep and Spore & Sprawl, where this exact pattern runs. D-062's single job tested only the pushed commit, so a release also rebuilt whatever `develop` was, and a `develop` that didn't build blocked every deploy, releases included.
**Considered:** Reusing the other branch's last good build from an earlier run's artifact, which would keep `/dev/` up during a release with a broken `develop`, at the cost of more moving parts. A second Pages site for `/dev/`, which needs another repo.
**Changes:** D-060 (Accepted): its "one deploy job" detail. D-062: its Deploy bullet. Pushes to `develop` and `main` are now tested inside `deploy.yml` rather than by the `test` job, which stays the required check on pull requests.

### D-064 · Merging: the user merges their own PRs, and Claude merges setup and fix PRs
**Status:** Accepted · 2026-11-05 (the team's request)
**Decision:**
- **No code-owner review is required** on `develop` or `main`, as in Dig Deep and Spore & Sprawl: zero approvals. Everything else in D-061 stays: changes only by PR, the `test` check must pass, no force pushes or deletion, and `main` takes merge commits only. CODEOWNERS stays, so the user is still asked to review every PR. Claude's tools aren't allowed to loosen branch rules, so the user makes this change in the repo's ruleset settings.
- **Auto-merge is on** for the repo.
- **Claude merges its own PRs into `develop`:**
  - setup, fix, and CI PRs (M0, and `fix/…` branches) as soon as `test` passes, with GitHub's auto-merge and a merge commit
  - phase PRs (`phase/m1-…` to `phase/m6-…`) only after the user says the playtest went well
- Claude watches CI on its own PRs and fixes failures. In this repo it may switch on the app's PR monitor and auto-merge without asking each time (`.claude/settings.json`).
- **`main` is the user's:** Claude never merges into `main` and opens a release PR only when asked.

**Why:** Claude pushes with the user's account, and GitHub doesn't let an author approve their own PR, so a required code-owner review meant the user had to tick "Merge without waiting for requirements to be met" on every PR, their own included. Small fixes shouldn't wait on the user, while each phase still lands as one reviewed diff after its playtest (D-054).
**Considered:** Keeping the review requirement and having Claude merge with the admin bypass, which also skips the `test` check. Merging every PR once CI passes, phases included. Merging only when the user says so.
**Changes:** D-061 (Accepted): the code-owner review, and "Claude never merges PRs". D-054 (Accepted): unchanged; phases still merge after their playtest.

### D-065 · M1 rules structure
**Status:** Accepted · 2026-11-05, with the M1 pull request. Implementation details within D-035 to D-039 and D-055.
**Decision:**
- **One factory, bound to content:** `createRules(content)` gives `newRun`, `apply`, `preview`, `scoreOnly`, `legalActions`, `cardFits`, `replay`, and helpers, with their layout and preview caches inside it. `rules/index.ts` exports `rules`, bound to `src/content`, for the UI and the sim.
- **Rules tests use their own content** (`src/rules/testing.ts`), and `src/content` has its own tests, so tuning a number never breaks a rules test.
- **Ids are written out** as unions in `rules/index.ts` (`PieceId`, `FeatureId`, `SetId`, `Tag`), and content is a `Record` of each, so a typo or a missing definition is a compile error. Each phase extends them.
- **`FeatureDef.inert`** marks lot features that give nothing as neighbors (boulders).
- **Sets match in completion order:** walking the pieces in placement order, each one forms an instance with earlier, unused pieces if it can. §5's "greedily in placement order" is read this way so that placing a piece can add a set but never reshuffle or break one already held. A depth-first search finds the connected group, so an early dead end can't hide a valid one.
- **Draw weights are in hundredths** (`drawWeight × percent`), so nothing rounds to zero: a weight-10 complexity-3 piece at 5% stays drawable, as D-055 intends.
- **Pace** (§12) is left unrounded: 30 Wow over 4 weeks is 7.5.
- **Run codes** hold actions as JSON objects, with UTF-8 and base64url written by hand, since the rules have no DOM. The content hash is FNV-1a of the content's JSON.
- **Lot generation details:** the creek stays 6 rows clear of the street (`creekStreetGap`); a side-to-side creek stays in the back two-fifths of the lot and may reverse its drift only after three steps across, so it never doubles back. A seed that fails the checks 50 times gets a lot without a creek (none of 1,000 test seeds needed it).

**Why:** These are choices §4 to §6 leave open. Most keep tests independent of tuning; the set and draw rules came from the M1 rules review, which found the earlier versions could lose a held set or lock complex pieces out of phase 1.

### D-066 · M1 asset and library records
**Status:** Accepted · 2026-11-05, with the M1 pull request. Extends D-062's Assets bullet, at the team's request for M1.
**Decision:**
- `assets/licenses.json` also records third-party code that ships in the build: npm packages as `npm:<name>`, and vendored files by their path in the repo. `CREDITS.md` lists both.
- ZzFX (MIT) is vendored as `src/ui/audio/zzfx.ts`, keeping only its `buildSamples` function, typed, with its license notice. The npm module creates an AudioContext when it's imported; ours builds sounds only after the first click.
- **The atlas:** `art/` holds the placeholder sprites as palette-indexed 16×16 text grids, and `scripts/build-atlas.ts` packs them into `assets/atlas.png` and `atlas.json` (18×18 cells: each sprite extruded by 1px). The generated files are committed, so `npm run dev` works without a build step; `npm run build` regenerates them, and a test fails if `atlas.json` is stale. LimeZu sprites cut from `art-source/` will join the same atlas.

**Why:** One place answers "where did this come from, and may we ship it?" for code as well as art. Vendoring keeps the audio side-effect free and dependency free.
**Amended by:** D-097 (Accepted 2026-11-06): the atlas (version 2) packs the placeholders doubled to 32×32 and LimeZu cuts of any size from `assets/limezu/`, which `npm run art:cut` writes from the manifests in `art/limezu/`. A cut replaces the placeholder with its id.

### D-067 · M1 content defaults
**Status:** Accepted · 2026-11-05: held up in playtest 1 (confirmed by the team with the M2 brief). The targets were replaced by the sim's in M2 (D-072).
**Decision:**
- **Kitchen and L-Kitchen** earn +2 per touching Dining Room only for now. The Herb Garden joins that bonus when the piece arrives in M2.
- **Shapes and tags Appendix B leaves open** come from `content-brainstorm.md` §3: the Dining Room is 2×2 and the Living Room 2×3, and the Kitchen, Dining Room, and Living Room are Social.
- **Draws:** all seven cards are weight 10 and complexity 1, so the Kitchen type, with two cards, comes up about twice as often as the others, and a hand can hold both Kitchen cards.
- **Targets:** 30, 200, and 700 Wow for Groundbreaking, Foundation, and Framing, from a throwaway greedy bot on 120 seeds (median 57, 317, and 1,017): about 0.55, 0.65, and 0.7 of it. The sim replaces them in M2.
- **Verdicts** (§12): Starter Home at the final target, Charmer at 125%, Showhome at 150%, and Dream Home at 200%. A lost run is a Fixer-Upper.

**Why:** Defaults so the slice is playable; each is a number or a line of data in `src/content`.

### D-068 · M1 interface defaults
**Status:** Accepted · 2026-11-05: held up in playtest 1 (confirmed by the team with the M2 brief). M2 adds the title screen and the camera (D-073).
**Decision:**
- **Passing takes a second press** (Enter or the button) within 2.5 seconds, since a stray click would waste a week. Placing is a tap that places tentatively, then End week.
- **The ghost** centers on the cursor; R, right-click, or the Rotate button turn it, and a tentative placement turns where it is.
- **The tally** skips pieces that earn 0 (their corner digit still shows 0), then plays each held set's Comfort and Charm, the multiply moment, and the drain into the run total.
- **M1's one celebration tier** is the big week: a week of at least 2× pace gets confetti and coins, a jingle, and a bigger shake. The score panel starts to glow at 1× pace. The full ladder is M5.
- **Save and resume:** every action saves the run code under `openhouse:<channel>:run`, and a reload on the same build resumes it, as D-062 promised; otherwise a fresh run starts with a note and the old code. `?run=` replays a code and shows its pending placement; `?seed=` starts a given seed. The title screen with Continue is still M2.
- **Settings in M1:** tally speed, Reduce motion, screen shake, and master and sound-effect volume. They're kept in the browser and shared across channels, since they aren't saves. Flashing, music volume, and the readable font come in M5.
- **The default zoom** counts the street row, so the lot and the street fit together at the largest whole scale of at least 2×. A smaller window scrolls until M2's camera.

**Why:** Choices the plan leaves to the build, picked so the slice can answer playtest 1's questions.
**Amended by:** D-097 (Accepted 2026-11-06): with 32 art px per cell, the default zoom is at least 1×, the same 32 CSS px per cell as 2× was. Where display scaling isn't a whole number (125%, 150%, 175%), the floor is 1× rounded down to whole device pixels (D-097's zoom note).

### D-069 · A fenced yard needs at least 10 tiles
**Status:** Accepted · 2026-11-05 (chosen by the team in the M2 build, from the sim's enclosure probe)
**Decision:** A fenced yard (§4, Layout rules) must have at least 10 tiles, not 4. The rest of the rule is unchanged: it borders a Fence and the house and doesn't touch the street edge. The number is `fencedYardMin` in `balance.ts`.
**Why:** §8 asks that a fenced yard cost about 2–3 placements on a typical lot. The sim's enclosure probe (the fewest Fence cards that close a yard next to the greedy bot's house after milestone 3, 80 houses) found that at 4 tiles one Fence usually closes a pocket in a notch of the house (median 1 card). At 10 tiles the median is 2 and the middle half is 2–3, and every fenced yard pays a Fence its full +6.
**Considered:** 8 tiles (median 2, but a quarter of houses close one with a single card). Keeping 4 (cheap, strong fences).
**Changes:** D-046 (Accepted) and D-049 (Accepted): the fenced-yard rule's "at least 4 tiles".
**Playtest 2:** fenced yards still felt too hard and not worth it, mostly because of drawing enough Fences. See D-074.

### D-070 · M2 rules structure
**Status:** Accepted · 2026-11-05 (proposed with the M2 pull request; held up in playtest 2, confirmed by the team). Implementation details within D-035, D-036, D-040, D-041, and Appendix A · M2.
**Decision:**
- **Overtime weeks** are `RunState.overtimeWeek` (0 normally, k in the phase's k-th overtime week), and `slot` carries on past the phase's last week. §4's `slot: number | 'ot<k>'` union is kept only in the draw key, `draw/<phase>/ot<k>/<n>`.
- **Timers:** a piece's age is `week − placedWeek`, 0 in the week it's built. "Every 3rd week" (rhythm, economy) pays when age + 1 is a multiple of 3, so the build week counts as the first. Growth earns `perWeek × (age + 1)`. A transform resolves at the start of the week once age ≥ `afterWeeks`, in fast-forwarded weeks too.
- **An unmet requirement** makes a piece earn nothing and pay no budget, and none of its own effects (auras included) apply. It still counts for sets. `blocksPlacement` requirements are checked on the house as it would be, with Trees under the piece already gone.
- **Early completion:** the bonus is computed when the milestone completes, from the phase's earnings so far, and paid when the milestone resolves after the fast-forward. A manual click saves the current, untallied week too; auto-complete saves the weeks after the one just tallied.
- **The free redraw** happens on its own at the start of a week, when none of the first hand fits anywhere.
- **The forecast** uses this week's total as the house stands (with the placement being looked at, if legal) rather than §4's `lastTally`, so demolitions and transforms show at once.
- **Milestones** pay +3 budget (Appendix A · M3a's number) from M2, so budget accrues before the shop exists; each one is recorded in `RunState.milestones` for the end screen.
- **Run setup** names the crew (`crewId`); the General Contractor is the default and its `rule` modifier gives the extra reroll. Rule values combine as §5 says.
- **Debug cheats are actions** (`{ t: 'debug', … }`: add Wow, add budget, give a card, force a miss), so a debug run's code still replays exactly, and the run is marked as a debug run.
- **Bots:** `legalPlacements()`, a cheap `estimatePlay()` for ranking candidates, and `fencedYards()` serve the sim; `legalActions()` also lists the free actions.

**Why:** Choices §4 and Appendix A leave open. Each keeps the preview equal to the tally and every run replayable.
**2026-11-06 (systems review):** if the team chooses the review's Renovate, this entry needs to say whether a card that can only renovate counts as fitting for the free redraw. The sim said no (`house-systems-review.md` §8).
**2026-11-06 (D-102, settled by the team):** a card that can only renovate doesn't count as fitting for the free redraw, as the sim had it. `cardFits()` still asks only whether a card has a legal spot or host.
*Changed by D-121 (Proposed 2026-11-09):* swaps replace the free redraw: each card with no play (no spot, no host, no Renovation) is swapped for another from its row, up to 3 tries, whenever a row is drawn.

### D-072 · The M2 sim and the first real targets
**Status:** Accepted · 2026-11-05 (proposed with the M2 pull request; held up in playtest 2, confirmed by the team).
**Decision:**
- **Bots:** `random` places a random legal placement each week. `greedy` scores every legal placement with the rules' cheap estimate, scores the best ones exactly with `scoreOnly` (the top 12, the best 2 of each card, and the best 4 that might complete a set), and takes the best; it rerolls when nothing would raise the week's total. Neither demolishes or completes early.
- **Targets** (`--suggest-targets`, D-044): each is α × the greedy bot's median cumulative Wow at that milestone, from runs with no targets, but α is set per milestone rather than following §8's curve (0.6 rising to a flat 0.85). Greedy's spread is wide (at milestone 3 its p10 is under half its p90), so a flat 0.85 lets it win most runs, and a plateau high enough for a ~45% win rate fails it at milestone 3 a quarter of the time. Instead α follows a survival curve that meets §8's criteria: milestone 1 teaches (α 0.4, low enough that random play usually passes it), greedy clears milestones 1–3 about 95% of the time, and survival then falls evenly to about 45% at the last milestone. Survival is estimated from the untargeted runs with overtime modelled. Targets are rounded to tidy numbers and written between markers in `balance.ts`. The first run (200 seeds): 15, 120, 270, 650, 1,350, 2,900, and 5,300 Wow (α 0.36, 0.72, 0.57, 0.68, 0.79, 1.03, 1.25).
- **The enclosure probe** measures "a fenced yard costs 2–3 placements": the fewest Fence cards that would close a fenced yard next to the greedy house after milestone 3, trying every rectangle of up to 6×6 tiles touching the house and confirming the cheapest with the rules.
- **The benchmark gate:** one greedy run on the densest-terrain lot of 50 seeds must take under a second; `npm run sim` fails if it doesn't.
- **npm test** runs the smoke sim: 5 random runs played to the end, each replayed from its run code, and the same seed and policy giving the same results.

**Why:** §8 asks for the minimum that answers "are the targets right?". A greedy bot can't plan a fence, so the fence criterion needs its own measure.
**Changes:** §8's starting α curve (a Proposed default), as above.
**Playtest 2:** the targets felt fair, and milestone 1 at 15 Wow didn't feel too easy. The enclosure probe counts placements, not the odds of drawing the Fences, so it undersold the fence problem (D-074).
**2026-11-06 (D-089):** greedy broke estimate ties by list position, which put every house at the back of the lot. It now breaks them by a seeded key, and scores exactly the Fences that would close a yard and the Hallways that would link rooms. Its `--early` variants complete milestones early. `--suggest-targets` now fits on `sim-*` and checks the result on held-out `check-*`. The report puts Fence cards offered next to the probe, so the draw odds show. npm test also runs full greedy runs and a chaos test. These targets stand until the team re-runs the fit.

### D-073 · M2 interface defaults
**Status:** Accepted · 2026-11-05 (proposed with the M2 pull request; held up in playtest 2, confirmed by the team).
**Decision:**
- **The title screen** comes first, with Start, Continue (when a run is saved), How to play, and Settings. A `?run=` or `?seed=` link goes straight to the game.
- **The camera** (D-057): the wheel zooms in whole steps from 1× to 6×, keeping the tile under the pointer in place; dragging pans; Fit (F) shows the whole lot at the largest scale that fits. The default is still the largest whole scale of at least 2× that fits.
- **Irreversible actions take two presses,** like Pass (D-068): Complete early, and a demolition (click the piece, then click it again).
- **The top bar** shows the forecast as a marker on the progress bar, the overtime counter as clocks, the budget, and the auto-complete switch (off by default, D-040).
- **The ?debug panel** is a small floating panel: jump to a milestone with a bot-built house, meet the target or force a miss, add budget, give a card, and instant tallies.

**Why:** Choices §7 leaves to the build.
**Amended by:** D-097 (Accepted 2026-11-06): with 32 art px per cell, the default is the largest scale that fits, never below 1× (rounded down to whole device pixels where display scaling isn't a whole number), and the wheel steps in whole device pixels per art pixel up to 3×: 1×, 2× and 3× at a devicePixelRatio of 1, and 0.5× steps on a Retina screen. Fit is still the one fractional scale.

### D-083 · Weekend Crew: D-075's banked building, as a tool
**Status:** Accepted · 2026-11-05 (the team chose it for M3, resolving D-075). The price is a placeholder.
**Decision:**
- **Weekend Crew** is a Rare tool (5 budget) of a new tool kind, `extraPlay`. It sits in a supply slot like any tool.
- Using it in a build week is a free action. The week's **next play** (a piece from the hand or the reserve, or a fixture from the hand) then doesn't end the week: it goes down at once, and the player plays on with the rest of the hand or the reserve. The play after that ends the week as usual.
- One a week: a second can't be used until the next week. The extra piece is built this week, so it earns from this week's tally.
- A D-074 pack, when it comes, counts as one play, so the two don't clash.
- **Sim:** the tool bot uses it when a placement would raise the week's total.

**Why:** The team asked for a shop good that places an extra piece in a week (D-075). A tool keeps it a single, visible decision, and gives the reserve a use: a bought piece plus a Weekend Crew costs no week. Rare and pricier than other tools, since a piece placed early earns for the rest of the run.
**Considered:** Prefab pieces that place from the reserve as free actions (two kinds of reserve piece to explain). Holding it until packs (D-074).
**Changes:** D-004 (Accepted): a week can place more than one piece. D-051 (Accepted): it left out "a tool that plays a second piece in a week".
**2026-11-06 (systems review):** if the team chooses the review's Renovate, this entry needs to say whether a Renovation can be Weekend Crew's next play. The sim allowed it (`house-systems-review.md` §8).
**2026-11-06 (D-102, settled by the team):** a Renovation can be Weekend Crew's next play, as the sim had it. It goes down at once and the week goes on.

### D-084 · Striking card types: a shop service
**Status:** Accepted · 2026-11-05 (the team chose it for M3, resolving D-076). Prices are placeholders.
**Decision:**
- **Strike a card** is the shop's third service, beside +1 reroll and +1 demolition: 2 budget, then 1 more per purchase for the rest of the run, up to 5.
- Buying it names a card type: a piece type (shape variants go with it, so striking the Fence takes the L-Fence) or a fixture. That type is never drawn again this run.
- At least 8 drawable card types always remain (`strikeMinTypes`).
- The draw streams don't change (§6), so replays stay exact: a strike changes the pool, not the stream.
- **Sim:** the shop bot strikes Driveway, Fence, Hallway, Doghouse, then Sapling (M2's weakest cards for the greedy bot) when the strike clears its value bar.

**Why:** D-076: removal in the spirit of Luck be a Landlord's tokens, and a clear use for budget, and so for early completion's reward.
**Considered:** A company upgrade with 3 strikes. A few strikes per run.
**Changes:** D-043 (Accepted): draw weights stay fixed for the run except for struck types. D-051 (Accepted): a third service.
**2026-11-06 (D-089, confirmed by the team):** the Sim line's order came from M2's greedy, which couldn't see yards or links and built at the back of the lot, so it struck the very cards D-074 and D-080 ask about. The default bot now strikes nothing; `--strikes fixed` keeps this order for comparisons. The service itself is unchanged.
*Changed by D-121 (Proposed 2026-11-09):* the floor holds per row: at least 5 Rooms types and 4 Layout types stay drawable.

### D-097 · Art at 32 px cells, and the look-and-feel pass before M4
**Status:** Accepted · 2026-11-06. The team chose 32 px cells after a visual audit that rendered the playtest-3 house (seed jbf3zs, week 21) both ways with LimeZu's art.
**Finding:**
- LimeZu's furniture is drawn for rooms about 4 tiles wide, in a 3/4 view: a double bed is 26×40 px, a toilet 14×34, a fireplace 32×40, the car 32×57. At 16 px per cell a 2×2 Bedroom is 32×32 px and a Bathroom 16×16, so 12 of the 15 room types can't show their key item, and the house reads as a floor plan with icons.
- At 32 px per cell (2×2 LimeZu tiles), every room type shows two to four real LimeZu pieces, the walls get doorways and windows, and a roof computed for any footprint looks like a real house.

**Decision:**
- **One cell is 32 art px,** a 2×2 block of LimeZu's 16 px tiles. Sprites are drawn in art px, and the board's scale is CSS px per art px. The text-grid placeholders are doubled to 32×32 when the atlas is built, until LimeZu cuts replace them.
- **The camera:**
  - The default is the largest scale that fits, in whole device pixels per art pixel and never below 1× rounded down to whole device pixels: 1× at a devicePixelRatio of 1 or 2, and 0.8×, 0.67× and 0.57× at 125%, 150% and 175% display scaling (the zoom note). So it's always one of the wheel's steps. At 1080p the whole lot fits at 1×: 32 CSS px per cell, the same size on screen as before. At 1280×720 it pans.
  - The wheel steps in whole device pixels per art pixel, up to 3×: 1×, 2× and 3× at a devicePixelRatio of 1, and 0.5× steps on a Retina screen.
  - Fit stays the one fractional scale.
- **Rooms are a walls-down cutaway built from the house,** all in the UI, from the placed pieces:
  - Every room type has its own floor.
  - Walls are bands in LimeZu's style, drawn from a mask: heavier on outside edges, lighter between rooms, with short north wall faces and floor shadows.
  - There is a wall between every two pieces, same type included. Rooms never merge visually (D-093).
  - Doorways between touching rooms, windows in outside walls, and a front door are chosen by fixed rules, never by chance: ties go by position, and between rooms by the order the rooms were built (the hash note). They are decoration and change no score.
  - Furniture is laid out by rules per room type and footprint: several LimeZu sprites per room, never rotated (they're drawn in 3/4 view). Rooms of the same type vary by piece.
  - Fixtures show as sprites where they fit, and as a badge otherwise.
- **Palette:** LimeZu's, with its outline color #3a3a50 as the ink. Our own drawings sample it. The 32-color and 8-per-sprite limits apply only to the text-grid placeholders.
- **Pipeline:**
  - `art/limezu/*.json` lists each sprite we use: its pack, the path in the zip, its rect, and any frames or edits.
  - `npm run art:cut` runs locally only. It reads the zips in `art-source/` and writes only the listed sprites to `assets/limezu/`.
  - `npm run atlas` packs them with the placeholders at any size; a cut replaces the placeholder with the same id.
  - Every cut has its own entry in `assets/licenses.json`. `CREDITS.md` and the game credit LimeZu.
  - A test fails on a cut without a manifest entry or a license record.
- **Order:** M5 splits. M5a (art, UI chrome, and the visual juice) comes now, before M4. M5b (sound and music) follows M4. M5a's visual juice became its own pull request after M4 (the juice note).
- Serene Village isn't needed: Modern Exteriors covers terrain and water in the same artist's palette.

**Why:** The team's worry was whether LimeZu's pieces could make a house that looks like a house. They can, at LimeZu's own proportions. At a devicePixelRatio of 1 or 2 the board stays the same size on screen. The costs are finer pixels on a 1080p monitor (a Retina screen still shows each art pixel as 2×2 device pixels), a smaller board on a 1440p screen at a devicePixelRatio of 1 and where display scaling isn't a whole number (the zoom note), and more art work.
**Changes:**
- D-057: its 16×16 tiles, one key furniture sprite, default zoom of at least 2×, the 24–32-color palette, and Serene Village.
- D-047's 1080p amendment: the whole lot fits at 1×.
- D-066: the atlas takes LimeZu PNG cuts of any size.
- D-068 and D-073: the default zoom's floor, and the zoom steps.
- D-053 and §7: the phase order.
- §12 Art: the wall widths and the terrain canvas size.

**2026-11-06 (M5a review), the licenses, to settle before this work is pushed:** the two packs' licenses differ on open source.
- Modern Exteriors' (`Modern_Exteriors_License.pdf` in its zip) allows using the asset in open-source projects, GitHub included. The 4 grass cuts come from it.
- Modern Interiors' (`LICENSE.txt` in its zip, and its itch.io page) doesn't mention open source, and forbids distributing the asset to others. The 10 floor cuts come from it.
- So those floors rest on D-057's "LimeZu has said that's fine for open-source projects", which has no recorded link or quote.
- *To decide:* link LimeZu's statement in `research.md` and D-057, or get LimeZu's OK in writing. Until then, the Modern Interiors cuts could stay out of the repo, with the placeholder floors in their place.
- *Decided by the team, 2026-11-06:* commit as D-057 says, for both packs. The repo holds only the sprites the game uses, each cut on its own by `npm run art:cut` (never a sheet or a whole pack), recorded in `assets/licenses.json` with its pack, sheet and rect, and credited to LimeZu in `CREDITS.md` and in the game. Any LimeZu sprite may be used; a cut comes from one pack.

**2026-11-06 (M5a review), the default zoom at 125% and 150%, for the team:** at a devicePixelRatio between 1 and 2 (Windows' 125% and 150% display scaling), 1× isn't a whole number of device pixels per art pixel. The whole steps on either side are 1/dpr and 2/dpr: 0.8× and 1.6× at 1.25, 0.67× and 1.33× at 1.5.
- When 2/dpr doesn't fit, the default is 1× (`fitScale`), with uneven pixels (1.25 or 1.5 device px per art px). That's every window from 1280×720 to 1920×1080 CSS px. 1× isn't one of the wheel's steps, and Fit goes back to the zoom from before it, so after the first zoom step nothing returns to the default until a reload.
- So "in whole device pixels" and "Fit stays the one fractional scale" don't hold at these ratios yet. On develop, the 16 px art's default was crisp at 150% (2×: 3 device px per art px), and at 125% only in large windows (2.4×).
- *Options:*
  1. The smallest whole step from 1× up (1.6× or 1.33×). It's crisp and fits this decision's wording, but cells are 51 or 43 CSS px, so the board pans more: at 125%, a 1920×1080 window no longer fits the lot.
  2. The visual audit's rule: whole steps, and uneven pixels only where cells would drop below about 24 CSS px. That gives a crisp 0.8× at 125% (25.6 CSS px cells, the whole lot fits) and keeps the uneven 1× at 150%. It goes below this decision's 1× floor.
  3. Keep 1× (the board the same size on screen as before), list the uneven pixels as a cost here and in §12, and make 1× a wheel step at these ratios.
- *Decided by the team, 2026-11-06:* round down, at every ratio, to whole device pixels per art pixel and at least one. The default's floor is 1× rounded down that way (`defaultFloor` in `geometry.ts`). Where display scaling isn't a whole number, that's one device pixel per art pixel: 0.8× at 125%, 0.67× at 150% and 0.57× at 175%, cells of 25.6, 21.3 and 18.3 CSS px. At a devicePixelRatio of 1, 2 or 3 it's 1× as before. It's option 2 without its 24 px exception.
  - The default is always crisp and always one of the wheel's steps. A zoom step that lands on it, or leaving Fit, goes back to the default, which then follows the window again. Fit is the one fractional scale at every ratio.
  - A window that holds two device pixels per art pixel gets them: 1.6× at 125%, 1.33× at 150%.
  - Below a ratio of 1 (a browser zoomed out), one device pixel per art pixel is more than 1×: 1.11× at 90%. So zooming the browser out doesn't shrink the default board, where before it dropped art pixels.
  - The cost: where two device pixels per art pixel don't fit, the board is 80%, 67% or 57% of 1×'s size on screen (at 125%, 150% and 175%), and its labels and badges cover more of each cell.

**2026-11-07 (M5a final review), the hash behind the house's choices:** no tile hash is used, though this decision's text names one. The front door, the back doors and the windows break their ties by position (reading order). The doorways between rooms break theirs by the rooms' placement order (their uids) and a hash of a room's uid, and the rooms' and yard pieces' colors come from a hash of the piece's uid; the stage-2 brief allowed either. It's as deterministic, but the same footprint built in another order, or rebuilt after a demolition, can get other doorways between its rooms and other colors. D-100 (Proposed) records it under its Changes, for the team to accept with it. *Corrected 2026-11-07, with M5a's pull request:* this note first said the front door and the windows also went by the uid's hash.
- *Decided by the team, 2026-11-07 (playtest 5a):* accepted with D-100. This decision's doorway bullet says so now.

**2026-11-07 (playtest 5a):** the team played a full run on M5a (seed `bv6bsv`, build 1712fd6, a win with 10,005 Wow against 9,500 after one week of overtime) and "couldn't be happier with the graphical overhaul". What they singled out: rooms that change as fixtures go into them, and that connect to the rooms and the yard around them. A re-render of their run matched their screenshot exactly. The review's visual problems were fixed in M5a's pull request (D-098's and D-100's notes), and D-098 to D-100 were accepted as built. The run's balance is in D-085's note, and the team's idea of merged rooms is Parked. The rules didn't change in M5a.

**2026-11-07 (M5a's pull request), the juice after M4:** M4 was built at the same time as M5a, on its own branch (`phase/m4-clients`, pull request #17). A trial merge of the two on 2026-11-07 conflicts in 23 files, and both number their new decisions from D-097.
- *Decided by the team, 2026-11-07:* M5a's pull request holds the art, the lot, the house and the pixel UI (D-098 to D-100) and goes to playtest 5a now. The visual juice moves to its own pull request after M4 and before M5b, with its own playtest: §12's celebration ladder, §7's distinct moments, particles and the Flashing toggle, and the roof reveal at Roofing. It reworks the tally's director, `feel.ts` and the score panel, which M4 also changes, so building it before M4 merges would add more conflicts with M4.
- M5a merges first, as this decision's order says. M4 then merges `develop`, numbers its decisions from D-101 and restyles its new screens (the job board and its crew pick, the checklist, the change-order sheet and the first-time hints) with M5a's interface (`src/ui/kit` and the theme's tokens). If M4 merges first, M5a renumbers instead.
- D-094 (chain reactions, Open) is raised with the team before the juice pull request reworks the tally, as §7 says: option 1 would land in it, and options 2 and 3, if chosen, before it or with it (D-094's note of this date).
- *Done, 2026-11-08:* M5a merged first (pull request #18). M4 then renumbered its decisions in a commit of its own (84a1601), before merging `develop`, in one pass so no number moved twice: D-097 → D-101 (the house rules), D-098 → D-102 (Renovate), D-099 → D-103 (the household's arrivals), D-100 → D-104 (half-weight draws), D-101 → D-105 (the yard rules), D-102 → D-106 (packs), D-103 → D-107 (a fixture's worth), D-104 → D-108 (client numbers) and D-105 → D-109 (M4b's rules structure). M4's commit messages from before it use the old numbers. The merge (6874cd0) kept M5a's structure and ported M4's features onto it; M4 then restyled its new screens with M5a's interface and drew its new pieces in LimeZu's art (D-110, D-111). The juice pull request still comes after M4, as decided above.

**2026-11-10 (D-136), a second downscale exception:** the end screen's photos of the house at each milestone are drawn smaller than one device pixel per art pixel, smoothly, as Fit's overview is. Their larger view keeps whole device pixels per art pixel wherever the window holds one.

### D-098 · M5a interface defaults: the pixel UI
**Status:** Accepted · 2026-11-07 (proposed 2026-11-06 with M5a's UI track, stage 2: part 1, the foundations, the build screen, the score panel and the top bar; part 2, the other screens. Held up in playtest 5a, confirmed by the team). Implementation details within D-057, D-059, D-097 and §12. It kept its number when the stage's tracks merged; the lot's and the house's defaults are D-099 and D-100.
**Decision:**
- **Tokens:** every color is a token in `src/ui/theme/tokens.css`. The inks, the wood, the score layers' colors and most fills are LimeZu's (its outline #3a3a50 is the ink), with the UI audit's contrast fixes (secondary text #565972, Comfort #3d56d2, Charm #a82b52, Sparkle a gold fill under ink text). Some are the interface's own, not LimeZu's: the two papers (#f4efdf, #fbf8ef), text colors picked for contrast (losses #a8480c, Sparkle's text #8a5a00, the light text on wood), the danger red, the shop's rarity tints, the title's four sky bands, and the board's overlay washes and highlights. `theme.test.ts` keeps raw colors out of every other stylesheet but a shrinking legacy list (app.css's last board rules and the ?debug panel), and checks each text color on its backgrounds at 4.5:1.
- **The UI pixel:** the chrome draws in its own pixel, `--px`: 2 CSS px at 1080p, rounded to whole device pixels and down on a tie, so 1.6 CSS px at 125% and 2 at 150% and 200%. Outlines, frames, shadows, spacing and pixel-font sizes are whole numbers of it. The board keeps the camera's scale. *Open for the team:* at 125% this makes pixel text 12.8 CSS px (16 device px, two per font pixel), so the 16 px floor holds in device pixels but not in CSS px. Rounding half up instead gives 2.4 CSS px and 19.2 px text, and lays the UI out like 1280×720 at 1×; that would also need the side columns sized in UI pixels (they're CSS px today, so they'd be narrower in UI pixels than at 1280×720). *Decided by the team, 2026-11-07 (playtest 5a):* round down, as built.
- **Fonts (CC0):** Pixel Operator 8 for text and Public Pixel for numbers, at 8 × `--px` and its multiples, so nothing in pixel mode is under 16 px at 1080p. Public Pixel supplies the symbols Pixel Operator 8 lacks (− ≥ ≤ → ← ✓); ▲ ▼ ✕ ★ ⚠ are icons.
- **The readable-font option** (§12, D-059) is in Settings, saved with the others: every pixel text switches to the system font, at its own sizes.
- **Frames and icons are our own drawings** in LimeZu's palette (`theme/frames.ts`, `theme/icons.ts`): text grids turned into images at startup. Every color they use is LimeZu's, from its two packs' palettes or (the deep wood, #6b5052) its Modern Interiors sheets; a test holds them to it. Each fixture and each tool has an 8×8 icon (the two Remodel Plans share one): a fixture's badge on the board, a supply's slot, and the shop's art slot where the board has no sprite for it. They were drawn while Modern Interiors' license was an open question (D-097's note); the team has since cleared that pack, so a LimeZu piece can replace any of them where it looks better (`art/limezu/ui-mi.json`).
- **The top bar:** the milestone on a plaque, the milestone meter with a tick per week at the rules' pace and the target's flag (the score and its target always whole above it, the forecast's number beside them only where it fits whole: its fill and tick on the meter always show), the budget beside a coin, the overtime clocks, the auto-complete switch, and Complete early, whose two labels share one cell so it keeps its width when armed and the second press lands where the first did (D-073). A Menu button opens a menu with Copy run code, the seed, How to play, Settings and Quit to title (the run stays saved for Continue). How to play and Settings keep their own buttons; the brand leaves the bar.
- **Coins come before amounts** everywhere, as on the budget's plaque: ●4, ●+1. Placed after a number, the coin read as a zero.
- **Sheets and the menu hold the keyboard** while open: focus moves in (the menu's Resume, a sheet's text), Tab stays inside, and focus goes back where it was when they close. A press that starts inside and ends on the scrim doesn't close them.
- **Pressing:** a hover lifts a control a UI pixel and a press sets it down; while pressed, its hit area reaches up over that travel, so a press at its top edge lands.
- **The controls strip** shows the keys for what you're doing now, as keycaps. On a window under 800 px tall it sits under the board only, so the side columns keep their full height, and leaves out what's least needed there (Scroll to zoom, Click to place, and the shop's two hints, which the sheet's foot covers), so it's one line. F's words follow Fit: after the run and over a hidden shop it says "fit the lot", or "back to your zoom" with Fit on (the Fit button's words). The build screen's strip says "fit", or "zoom back" with Fit on where the strip has room for that on one line, and "fit" where it hasn't, so it never wraps and moves the board. `hints.css` measures the strip in its own em, so this holds at any display scaling or browser zoom.
- **The hand:** each card shows its piece's picture and its kind and tags as chips with icons. The picture is the piece as the board builds it, drawn unrotated by the board's own painters (the ghost's: a room's floor, furniture and outline walls, a yard piece's ground and props), and the shop's piece offers and How to play's sets use the same picture. Reroll and Demolish sit above the cards. The sticky bar holds square Rotate and Cancel buttons and End week, the view's one lime button, which sizes its words on its own width: it drops the Enter keycap first, then takes a short label (Pass, Again?). The picked card shows its shape as a small glyph, turned as the piece turns, so R shows with the pointer off the lot, and a card picked below the fold scrolls into view. On a window under 800 px tall the cards swap their pictures for that glyph, and in a narrow column Reroll and Demolish become an icon and a count on one row (Stop keeps its word while demolishing).
- **The inventory** stays hidden until the supply yard first opens, unless something's in it; empty slots are wells. On a window under 800 px tall the build screen leaves its empty rows out (the shop shows them). A name too long for its slot ends in an ellipsis.
- **The build stamp** moves to the bottom-left corner, clear of End week at 1280×720.
- **The shop** (D-087's sheet over the board) is a wood sheet. The budget is its header's hero counter, beside Refresh and Look at the lot. The goods are paper cards of one size packed onto shelves, as many sections side by side as the width holds, each card with an art slot (a piece's picture; a fixture's art as the board draws it, the Fireplace's stove or the Bunk Beds, or its icon for the ones painted with their room; a tool's own icon; else its kind's icon), its rarity as a band and a chip, a coin price, and Buy. Each section with goods that full slots block says so at its plank tag, in the rules' words (the advice after the first sentence only the first time the shop says it), and those goods' Buy buttons read Full. A good the budget can't reach shows its price in orange and a Buy that reads "Need 2", never the color alone. Leave is the sheet's one lime button, in a foot like End week's, with its saving bonus. Rare goods glint as they arrive, and the sale is a wood price tag. Hidden, the shop leaves a handle at the board's foot. A crate's options and the strike picker are sheets of the same cards over the shelves, sized to the board with their options scrolling inside and Set it aside or Cancel always in view; crate options glow by rarity in hard pixel steps. Below 800 px of height the cards drop their art.
- **The title screen** is a street at the street's whole-pixel scale: a banded sky with our own sun and clouds, and Modern Exteriors villas, trees, shrubs and planters on a lawn behind the street (`art/limezu/ui.json`), with a car that drives by (parked with Reduce motion). The lawn and the street are the lot's own (D-099): its grass with tufts and flowers, and the board's sidewalk, curb, road and dashed line. The menu is an "Open House" real-estate sign hanging from a post, its buttons hanging below it as riders. LimeZu is credited, with a link, on the far sidewalk. *(2026-11-09, D-112: the title keeps just the jam note; LimeZu's credit is in How to play's Credits and CREDITS.md.)* The wordmark stays in Public Pixel with the readable font, at 32 UI pixels (24 on a narrow window), so it's 48 px and up and on its font's grid in both modes.
- **Overlays:** the milestone banner is a ribbon stamped in, gold for a milestone met and orange for a miss or overtime, with its detail on a paper slip. "Target reached!" is a lime stamp; neutral notes are paper slips. Notes and toasts sit at the top center of the board, under the top bar; while the shop is open they sit inside it, under its header (and under a crate's sheet), so they never cover the goods or the hand. While a milestone's banner is up they sit just under it, and once the run is over just under the "It's a house." sign, so neither is covered. A toast raised while a sheet or the menu is open shows over it, except on the end screen, where it lands under the sign.
- **The board's labels** by the pointer (the ghost's change to the week's Wow or why it can't go there, and the install, tool and demolish labels) are the interface's chips: the pixel font, paper in the ink ring, a band in the label's tone, and a hard shadow. The preview's badges keep their small system-font numbers (a badge sits on one cell, and the pixel font has nothing under 16 px), square-cornered in the ink outline with a paper halo. The pieces' digits stay outlined system-font numbers that grow with the zoom. Their badges (a fixture that can't be drawn, an unmet requirement's ⚠) are square paper in LimeZu's ink, one icon pixel wide, around their pixel icon, a fixture's paper tinted by its rarity and the ⚠'s warning yellow, on whole device pixels.
- **Tooltips** (D-086) are paper notes with a pixel tail pointing at the term, placed on whole pixels: over the term, or under it when the note, measured, doesn't fit above it, and always inside the window. Terms keep D-086's dotted underline, drawn as pixel dots. The audit's idea of dropping the underline outside prose would amend D-086, so it's left to the team. *Decided by the team, 2026-11-07 (playtest 5a):* keep the underline everywhere, as built.
- **Settings** groups its controls (Game, Motion, Sound, Display) as pixel segmented controls, a switch and sliders. Settings, How to play and the copy fallback are wood sheets; How to play shows the formula as the score panel's own plaques, with icons and keycaps.
- **The score panel's sets** share one shape: two lines each in the pixel font (the name, led by a preview's star or cross; then the level, the Comfort and the Charm), one in the readable font. On a window under 1000 px tall, while nothing is looked at, they fold into one row of that shape, how many sets with their Comfort and Charm added up, the full list in its tip; taller windows keep the full list (2026-11-08, the note below; D-110).
- **The end screen** stays in the right column (M6 builds the full-width finale): "Job done!" or "Run over" on its plank, the verdict as a stamp (gold for a win), the final Wow on the framed plaque, the milestones and the stats, and New run kept in view down to the window's foot. The milestones are rows that share one shape, the most compact every row fits: the name on a line of its own, then the mark, how it went ("Not reached" for one not reached), an early finish's bonus ("+68") and the Wow against the target, on one line or with the figures on the next, every row as tall as the tallest. The stats are rows with icons, each icon in a slot as wide as the widest so the labels line up, on one line each, or each value under its label where any wouldn't fit beside it. "It's a house." is a wood sign over the board.

**Why:** The UI and juice audit (2026-11-06) found an interface that read as a web app beside the pixel-art board, with text at 9–13 px, hairline edges and blue for six meanings. D-057 asks for wood-panel frames and a chunky pixel font with a readable option. The audit's design system turned that into tokens, one pixel unit and a few primitives, so every screen shifts together.
**Costs:** the pixel font is wide, so the side columns are wider: at 1280×720 their 280 px leave the board 720 px, and at 1× the lot is a little wider than its view, so it pans across as well as down (a new run shows 24 px less of each edge column; before M5a it fit across). The street's label sticks inside the view, so it still reads whole. Narrower columns would wrap the cards' text further and push the hand down; that trade is the team's to revisit. In the pixel font, rows that share one shape cost height on the end screen: with the team's playtest-5a run, the right column hides 302 px at 1724×962 (242 before the review's fixes) and 638 px at 1280×720, but only 16 px at 1920×1080; a run with a multi-week early bonus gets taller rows throughout at 1280×720.
**Changes:** None to settled decisions. D-073 (Accepted): the top bar keeps everything it lists. D-087 (Accepted 2026-11-06): the inventory still sits above the hand, and the shop keeps its sections and the leave button's saving bonus, the button moving to the sheet's foot. D-086 (Accepted 2026-11-06): unchanged, the underline only redrawn.

**2026-11-07 (playtest 5a), the review's fixes:** made with the team's OK before merging, and described in the bullets above.
- Notes and toasts no longer cover the "It's a house." sign or a milestone's banner.
- The end screen's milestone and stat rows, and the score panel's sets, each share one shape, and the stat labels line up.
- F's hint follows Fit; on the build screen it measures the strip, because "zoom back" first wrapped it at 90% browser zoom.
- Left as they were: the end panel scrolls at most window sizes (M6 builds the full-width finale), and the disabled Auto-complete switch stays in the top bar after the run.

*Changed with the team's OK, 2026-11-08:* on windows under 1000 px tall, the score panel's idle set list folds into one row, with the full list in its tip, so M4's checklist has room; taller windows keep the full list. While a play is looked at, the panel is as it was: the list, with the sets the play would make and break, or under 800 px tall only the equation (D-110). D-110 has the row's details and the numbers. *2026-11-09, before playtest 4, for the team to confirm:* the equation-only rule while a play is looked at now starts under 1000 px tall, as the fold does, so the list never comes back on a short window: between 800 and 1000 px tall it came back while placing and, late in a run, pushed the inspect panel's total below a 1536×864 window. The inspect panel's notes name the sets a play would make and break; windows 1000 px tall and up keep the list, with them.
*Changed by D-121 (Proposed 2026-11-09):* the hand's two rows under ROOMS and LAYOUT labels, each with its Reroll; Demolish on the hand's plank; compact cards with a thumbnail; and Your goods folding to its plank on windows under 1100 px tall.
*Changed by D-132 (Proposed 2026-11-10):* one Reroll for both rows, on the hand's plank before Demolish; the rows keep their labels.

### D-099 · M5a lot defaults: the terrain in Modern Exteriors
**Status:** Accepted · 2026-11-07 (proposed 2026-11-06 with M5a's lot track, stage 2, and its merge into the phase branch; held up in playtest 5a, confirmed by the team). Implementation details within D-049 and D-097; §12 Art's Rendering bullets describe them.
**Decision:**
- **Grass:** LimeZu's muted grass on every cell, with a tuft on about 1 subtile of open ground in 11 and tiny flowers on 1 in 23, by tile hash salted with the run's seed. The same run always looks the same, and no two runs share their decoration.
- **The sunny side** follows `isSunny` exactly. LimeZu's grass edge, recolored, reaches 6 px into the shade beside it. A Tree inside the band stays in shade to its cell's edge, and no sunny edge faces the street.
  *Changed by D-120 (Proposed 2026-11-09):* the band goes, and its warmer grass, edge, shore, rocks and Time Capsule with it. The grass is the same everywhere, with a soft shade on the tile behind each Tree and the Old Shed, away from the sun.
- **Water:** LimeZu's animated water (8 frames, 130 ms each) on its own canvas over the water's bounding box, autotiled per 16 px subtile, its bank's blades in the colors of the grass around it. The frames are painted side by side once per lot and CSS steps through them (transform only), so the water costs the main thread nothing between placements; it's still under Reduce motion and paused under the shop's sheet. A creek shows about 12 px of open water per cell (the static set's was about 22). Lily pads float on a pond's open water only.
- **The woods:** one LimeZu tree per Tree cell (eight kinds by hash, nudged up to 2 px), greens at 92% saturation, on a step-darker woods floor with soft edges and a verge of grass where it meets the street. A big 64×52 tree stands only on a 2×2 block of Trees that no piece can touch, so every Tree a piece touches is a tree of its own and can be counted.
- **The canopy:** what rises above its own cells (tree tops) is on a canopy canvas at `LAYER.canopy`, over the pieces and under their digits and badges, covering the lot and the row above it; it never takes the pointer. The terrain and water canvases share one `.ground` group at `LAYER.terrain`. The board keeps 24 art px clear above the lot (`CANOPY_ROOM`), so the top row's tree tops are never cut flat; the default zoom and Fit count it.
- **Finds and rocks:** two or three LimeZu rocks per Boulder; the Old Shed is LimeZu's shack at its own 48×64; the Time Capsule is dug soil with a shovel in it.
- **The street:** the street row is a sidewalk with its curb, the lot's grass hanging over its edge except where water or a piece meets it, so a Driveway runs onto the sidewalk. Its STREET label lies on the longest stretch of sidewalk with no curb cut, sticks inside the view's left edge, and is half size in a short row (0.5× on a Retina screen). Below it, `ROAD_ROWS = 2` rows of decoration: asphalt with a dashed line, then the far curb. The default zoom, Fit, the camera and the board's height count them, and the pointer finds nothing there. A new run starts scrolled to the street row, the road a short pan below.
- **Around the board:** dimmed LimeZu grass (a 256 px tile with unevenly scattered tufts) that zooms and pans with the board, no drop shadow, and a faint property line on the lot's other three edges. The road and each creek mouth run on, dimmed, to the edges of the view.

**Why:** The audit's prototype renders (scale-B, test-abc123-B) set the bar: a calm, muted garden that makes the house stand out, with every terrain rule still readable.
**Costs:** the board is 864 px tall at 1080p (the lot still fits at 1×). Fit's cells are 34 px at 1080p with the M5a interface (35 on the lot's own branch) instead of 36, and about 22 px at 720p (0.69×) instead of 24 (0.75×). The default zoom's thresholds rise by 24 art px: 1.5× on a Retina screen needs 1332 CSS px of board height instead of 1296. Big trees are rarer than in the prototype. The atlas also packs the 256 px surroundings tile.
**Changes:** None to settled decisions. D-097 (Accepted) holds, its board counting the road rows and the canopy's room.

**2026-11-07 (playtest 5a):** accepted as built, with D-098 and D-100. The review of the team's run found one gap. The board doesn't show where the front yard starts: below the house's lowest indoor row (D-049). In their house an L-Kitchen's one-cell tail made the row of planters along the house's front count as back yard. It cost nothing there, since Herb Gardens earn nothing extra in either yard, but a Flower Bed or Garden Lights in that row would miss its front-yard bonus with no mark on the board. The inspect panel's region chip names the yard on hover, though not while placing.

### D-100 · M5a house defaults: the cutaway and the yard
**Status:** Accepted · 2026-11-07 (proposed 2026-11-06 with M5a's pieces track, stage 2, and its merge into the phase branch; held up in playtest 5a, confirmed by the team). Implementation details within D-093 and D-097; §12 Art describes each rule.
**Decision:**
- **Walls:** every cell edge is open floor, a wall between two pieces (same type included, D-093), an outside wall, or a garage door. They're LimeZu-style bands drawn from a pixel mask: 6 px outside and 4 px between rooms, with 8 px north wall faces in each room's wallpaper and 3 px floor shadows. Each face stands apart from its floor (a test holds every face at ΔE 20 or more from it).
- **Doors and windows** are decoration chosen by fixed rules. Ties go by position (reading order), and between rooms by the rooms' placement order and a hash of a room's uid:
  - Hallways open into the rooms the rules link through them.
  - The front door is on a south wall with nothing of the house between it and the street, in the best entry room (a Mudroom or hall first), never onto a tree, water, a boulder, the Old Shed, a fence or an outbuilding, paved ground preferred. It opens onto the woods only when nothing else can take it.
  - A back door opens onto each touching Patio or Hot Tub; a garage door spans the Garage's side toward a Driveway or the street.
  - Then a spanning tree from the entry, public rooms first, adds as few doors as it takes to reach every room. Doors keep to side walls (70% of the way down) and the ends of north walls, clear of the furniture.
  - Windows: about one per two cells of outside wall, every cell in a Sunroom, none in Closets, Garages or Hallways.
- **Layers** (`layers.ts`): a floor canvas (the yard's ground and curb cuts, the house's shadow, doormats, floors, wall faces), one items container per piece ordered by its bottom row, a walls canvas, the overhang, outline highlights (never CSS filters on whole pieces; sets in Charm's rose with a dashed edge), and the labels inside the walls. The canvases redraw only when the house changes, before the browser paints.
- **Labels:** each piece's digit in its bottom-right cell, its badges in its top corners (a fixture that can't be drawn, top right; the ⚠, top left), sized with the cell, and never over the digit (`label-layout.ts`, tested at every zoom): where a badge would touch it (a one-cell or one-row piece), the badge rises to its cell's top edge over the wall band, then the digit drops toward the cell's bottom edge, then the badge shrinks. Labels also keep off what isn't their piece's: another piece's prop rising into their cells (a Greenhouse's or a Treehouse's roof, a Birdhouse, a side-on car's roof), a tree's crown, and doors' mats. The digit rises above it (into its own cells above, if it must) or moves left onto its own cells, whichever is shorter, leaving a badge in its column room for its icon; where it can't get clear, it stays rather than squeeze a badge out of its icon. A badge moves off a mat, never onto the digit.
- **Furniture:** LimeZu pieces laid out by slot rules per room type and footprint (`rooms.ts`), from one in the smallest rooms (a one-cell Bathroom's toilet, a Closet's rail) to six in a Dining Room (a table, four chairs and a rug). Tall pieces rise over their north wall's band, never past its top, on the overhang, and never off their own room: all of an outside band, only their room's half of a band between two rooms, so a wall between rooms always shows. Nothing stands in a doorway or the walkway in front of it; a dining table may cross a walkway, never the opening. Rooms of a type differ in color: the piece's hash, or the next color an older room of its type hasn't taken.
- **Fixtures** show as art where they fit: the Fireplace (animated), Bunk Beds and the Kitchen Island as furniture; Soundproofing, Blackout Curtains, the Skylight, the Chandelier and the Bay Window painted with the room; the Sprinkler, the Pergola and Garden Lights in the yard. The Pergola stands over its Patio in place of the parasol; where a door opens onto the Patio, a cut of the same LimeZu sprite stands on its far side, shallower for a north or south door and two slats narrower for an east or west one, and its badge shows only where doors open onto two sides. A fixture that can't be drawn keeps its badge, so a purchase is always visible.
- **Yard pieces:** their ground is on the floor canvas (a Lawn's mown stripes, pavers, concrete with a curb cut through the street row, pools in LimeZu's coping), their props are items: a parasol and two chairs on a Patio (a small parasol where a door opens onto it), the house's one parked car on its oldest Driveway, planters, the Fire Pit's campfire, LimeZu's Greenhouse and Treehouse cut shorter (they rise 14 and 25 px), and a Henhouse made from a shed's front with two hens. Fences are a white picket line that joins another only through an end's open side, so each stays countable. Props keep their whole sprite off doors and their mats. An outbuilding's own building (the Treehouse, the Greenhouse, the coop, the Doghouse, the Birdhouse) always stands, since no door opens onto one: only its roof, rising over the row behind it, can hide part of a mat there.
- **Our own drawings** in LimeZu's palette where it has nothing: the Doghouse, the hens, the Sprinkler, and the painted fixtures. A test keeps their colors in LimeZu's palette.
- **The ghost** (and the Moving Truck's carried piece) is drawn by the same painters, for that piece alone, as it will look once built, tall furniture rising over its north wall as on the board; so are the cards' and the shop's pictures of it.

**Why:** The audit's prototype (house-B, test-abc123-B) showed that LimeZu's pieces at 32 px cells read as a real house when rules choose the doors, windows and furniture well.
*Open for the team:* room colors. No rule that uses only the current house is both always distinct and always stable. Hash-then-next-free keeps older rooms fixed and same-type rooms distinct up to the palette's size, but demolishing a room can recolor a newer one it had bumped. A plain per-piece hash is always stable but lets two Bedrooms share a duvet. *Decided by the team, 2026-11-07 (playtest 5a):* hash-then-next-free, as built.
**Changes:** D-097 (Accepted): its doorways, windows and front door are chosen "by fixed rules and a tile hash"; here no tile hash is used: ties go by position, and between rooms by the rooms' uids and a hash of one (the colors come from a hash of the uid), which the stage-2 brief allowed. As deterministic, but the same footprint built in another order, or rebuilt after a demolition, can get other doorways between its rooms and other colors. D-093 (Accepted 2026-11-06, option B) is followed: a wall between every two pieces, every room type its own floor, no zone tints, doorways decoration only.
*Accepted with this decision, 2026-11-07 (playtest 5a):* the change to D-097, whose doorway bullet and hash note say so now.

**2026-11-07 (playtest 5a):** the team loved how the rooms change as fixtures go into them, and how they connect to the rooms and the yard around them. In their run that happened at almost every step: the Dining Room took a doorway and a window from the Living Room, Bunk Beds replaced a bed and its nightstand, a Pergola replaced a Patio's parasol, a back door opened onto each Patio, and a Bay Window widened a Living Room's wall.
- The review also found the door tree running through bedrooms when no public room touches a Hallway. In their house Bedroom 3 was the only way from the living rooms to the hall wing, and the Library and the Home Office opened off a bedroom. Doors are decoration, so no score changes; it's for a later pass on how houses read (D-093).
- *The team's idea, Parked:* merged rooms. Two Living Rooms would become one big living room, and two Bedrooms a primary bedroom, with a limit so rooms can't merge endlessly. Today a wall stands between every two pieces, same type included (this decision's Walls). See the Parked list and `content-brainstorm.md` §15.

**2026-11-07 (playtest 5a), the review's fixes:** made with the team's OK before merging, and described in the bullets above.
- The wall between two rooms always shows. Tall furniture keeps to its own room's half of the band, and four wall faces were recut to stand apart from their floors: the Library's (pale olive, where its red-brown panelling matched its floor), the Bathroom's (mint with a white stripe), the Garage's (light grey paint) and the Closet's (white panels). In the team's house the Home Office and the Library had read as one room.
- Labels keep off other pieces' roofs, tree crowns and mats. The team's Patio 12 had its 15 on a Greenhouse's roof.
- The Pergola stands clear of a door's mat, in the new cuts where it must.
- Outbuildings no longer vanish beside a door. Before, a Treehouse or Greenhouse whose roof reached a mat wasn't drawn at all.
- *Changed with the team's OK:* this decision's Labels bullet put every digit in its piece's bottom-right cell. Keeping off roofs moves a digit out of that cell in about 2.4% of the labels in bot-built houses.
- Known gaps:
  - A one-cell or one-row piece right in front of a Treehouse still has its digit and ⚠ on the roof, which rises 25 of the cell's 32 px. Cutting the Treehouse shorter, as the Greenhouse is, would fix it.
  - An outbuilding standing over a mat hides part of it: 6 of 793 bot snapshots.
  - A Patio with doors on two opposite sides and a Pergola shows the badge on bare paving.
  - At 0.5× a two-figure digit can reach over its neighbor's planter.
  - Closets' shoes, which only fit on the neighbor's half of the band, no longer show.

### D-093 · Houses that look like houses
**Status:** Accepted · 2026-11-06: the team chose the systems review's option B, with its recommended defaults (below). Was Open, from playtest 3, and researched the same day (research.md, "Update: houses that look like houses"; `house-systems-review.md`).
**Decision (2026-11-06):** option B of `house-systems-review.md`, built in M4:
- D-101: seven house rules start every client's checklist, each +0.25 while it holds (the review's default).
- D-102: Renovate, +4 Comfort a level, up to 2 (the default), and the name Renovate.
- D-103: the household's arrivals, fixed rather than declinable (the default).
- D-104: half-weight draws for a type at its limit.
- D-105: the yard rules: the Patio rule, a tidy yard as the yard brake (the default), and Treehouses that don't count each other.
- One Entertainer per house (`maxInstances: 1`), as this entry recommended.
- The review's targets start the re-fit (D-085).
- The fallback after playtest 4 stays: option 3 as a term after percentages, or option 5's wings.
**Changes, approved with the choice:** D-021, D-043, and D-056 (option A's three), and D-004, D-036, and D-050 (Renovate's turn and the arrivals' start-of-week step), each with an "Amended by" pointer. D-070 and D-083 are settled for Renovate in their entries.
**Finding:** Houses come out unrealistic. The playtest house had 4 Living Rooms, 2 Kitchens, 2 Home Offices, and 3 Bedrooms sharing 1 Bathroom, spread across the house. Scoring rewards repeating the strongest rooms wherever they combo. Floor Plan's reviewers describe the same absurd winning houses (five dining rooms side by side; no kitchen). Dream Home pushes back by merging touching rooms of a type, and with small functionality bonuses.
**The sim agrees** (200 greedy runs; the numbers are for the 124 wins):
- Houses average 3.4 Living Rooms, 2.7 Kitchens, and 2.1 Dining Rooms. 72% have two or more Kitchens, and 67% have three or more Living Rooms.
- Houses average 1.6 Bathrooms for 3.5 Bedrooms, and 23% have none.
- Only 2% pass research.md's plausibility check.
- Repeats mostly sit apart: in 37% of the houses with more than one Living Room, no two of them touch.
- **Causes:**
  - No effect counts copies of a type.
  - Sets pay per instance, and 47% of houses hold two or more Entertainers.
  - The Kitchen has two cards, so it's offered twice as often as other rooms.
  - The Bathroom pays little: +3 for its first Bedroom.
**Idea (the team's):** more sets, and other ways to make houses look and feel like real houses.
**Options:** research.md has the in-memory experiments behind each sim number below. They all ran at today's targets.
1. **Household specs.** Each client's checklist describes their household, with a ceiling as well as a floor, so a second Kitchen loses a spec instead of just adding Comfort. For example, every client wants one Kitchen and a Bathroom for every two Bedrooms, and the Hendersons want 4–5 Bedrooms. Juniper's 4–8 rooms already works this way.
   - *Data:* `count` specs with `min` and `max`, in M4a's format. "A Bathroom for every two Bedrooms" needs either a new condition kind that compares two counts, or fixed numbers per client.
   - *Cost:* content, plus that condition kind (small, with tests) if wanted. The targets need a re-fit, because specs add Charm.
   - *Touches:*
     - D-021.
     - Appendix A · M4a's rule that specs are achievements. Each household spec needs a floor ("one Kitchen"), not just a ceiling ("no second Kitchen").
     - Appendix B's Clients table.
     - D-085's targets.
   - *Sim:* M4's per-client piece mixes (§8), plus a house report: room counts, repeats, Bedrooms per Bathroom, and the plausibility check.
     - Three such specs at +0.25 each raised plausible wins from 2% to 54%, and cut two-Kitchen houses from 72% to 10%.
     - At +0.1 each, plausible wins reached only 19%.
     - The win rate rose from 62% to 86%.
2. **One Entertainer per house, and sets that describe a house.**
   - The Entertainer holds once per house (`maxInstances: 1`, the field M4a builds for Full House). Suite and Jack-and-Jill can still repeat, since a house has several bedrooms.
   - New sets could describe a whole house, each once per house, on the ladder below Full House: a Starter Home (Bedroom, Bathroom, Kitchen, Living Room), or a Family Home. Castles of Mad King Ludwig has a bonus card for having all 8 room types.
   - *Data:* SetDef as it is, plus `maxInstances`. A set's one-time `reward` on first completion could pay budget (D-090), like Castles' completion rewards.
   - *Cost:* data, plus re-balancing the ladder.
   - *Touches:* D-056's ladder (Accepted), the Sets in Appendices A · M4a and B, the Remodel Plans tools, and the Architect and Thanksgiving (both use `setBonus`).
   - *Sim:* how often each set is held, and its share of Charm. Capping the Entertainer cut houses holding two or more from 47% to 0%, and cost 12% of the median Wow. It barely changed the Kitchen count, because Kitchens pay on their own.
3. **Diminishing returns.** A house needs only so many of a room type. Past that, each copy earns less, and its breakdown says so ("3rd Living Room").
   - *Data:* `perCountOver` (Juniper's taste) can already express this, as a taste. But percentages add (D-037), so −25% is a small cut on a Kitchen that already has +150%. A real version is a new term applied after percentages, such as a per-type count on PieceDef past which copies earn half.
   - *Cost:* a taste is data. The new term is small rule work, with text and tests, and changes D-037's formula.
   - *Touches:* D-037 (Accepted), D-020, D-038.
   - *Sim:* counts per type, and earnings per copy.
     - At −25% per extra copy, houses with three or more Living Rooms fell from 67% to 46% (8% at −50% with the Entertainer cap), but two-Kitchen houses stayed near 69%.
     - The bot routes around penalties. Docking Bedrooms that lack a Bathroom made it build fewer Bedrooms, and houses with no Bathroom rose from 23% to 31%.
4. **Merging.** Touching rooms of one type become one bigger room, as in Dream Home. Two touching Living Rooms make one, which counts once for sets and specs, scores its effects once over the combined outline, and earns a size bonus, up to a cap.
   - *Cost:* the largest of the five. Rooms made of several pieces affect layout, scoring, sets, demolition, card text, and the art.
   - *Touches:* D-035, D-037, D-065, D-057.
   - *Sim:* group sizes per type. Merging alone changes little, because greedy keeps repeats apart (only 20% of Living Room pairs touch), so it also needs a reason to merge.
5. **Zones and wings.** Rooms prefer their own zone: sleeping (Bedroom, Bathroom, Closet), living (Kitchen, Dining Room, Living Room), and service (Garage, Mudroom).
   - Bedrooms already earn +1 per Quiet neighbor and −2 per Loud one, and the bot never puts a Bedroom against a Loud piece.
   - A wing could be a set with a Hallway as a member, which would give Hallways a job (D-074). Or it could be a spec with the `group` condition ("the Bedrooms form one group").
   - *Data:* existing effects, set members, and `group` (M4a builds it for the Barkers).
   - *Cost:* content only.
   - *Touches:* the content defaults of D-071 and D-082, and Appendix B. D-079 is the warning: same-type bonuses make clumps.
   - *Sim:* the share of Bedrooms in the largest sleeping group, and Hallway pick rates. Zones arrange a house but don't cap repeats, so they'd go with options 1–3, not replace them.
**Recommendation:**
- **In M4a, with the clients and sets:** option 1, and the Entertainer cap from option 2.
  - Give each client household specs with a floor and a ceiling: one Kitchen, plus their Bedroom and Bathroom counts, as `count` specs in M4a's format. Add the condition that compares counts only if fixed counts don't hold up in the sim.
  - Hold the Entertainer to once per house with `maxInstances: 1`.
  - Re-fit the targets afterward, as M4a means to anyway. In the experiment, which stood in for M4a's specs, the specs and the cap together raised greedy's win rate from 62% to 85% at today's targets.
  - Add the house report to §8's per-client piece mixes, with a criterion such as "most greedy wins pass the plausibility check".
- **After playtest 4, if houses still repeat or sprawl:** option 3 as a term after percentages, or option 5's wings.
- **Park option 4** until after the jam. It costs the most, and doesn't fix scattered repeats on its own.
- **Keep the Kitchen's two cards.** Halving their weights only cut two-Kitchen houses to 58%, and cost 12 points of win rate. The specs do the job.
**To decide:** which options, and whether option 1 and the Entertainer cap land in M4a.
**Would change:**
- D-021's specs and Appendix B's Clients (household specs).
- D-056 and the Sets in Appendices A and B (one Entertainer per house).
- D-085's targets, and §8's reports.
- Options 3–5 would also change D-037, D-035, or D-071 and D-082.

**2026-11-06 (systems review):** `house-systems-review.md` is the deeper pass on this entry. It recommends option B, which keeps this entry's recommendation and adds to it:
- **Seven house rules** start every client's checklist, at +0.25 each:
  - four household rules, from this entry's option 1: Room for everyone, a Bathroom for every two Bedrooms, One Kitchen, and a living room or two
  - the Bathroom rule needs the condition that compares counts, which this entry would add only if fixed counts didn't hold up. In the sim, "4–6 Bedrooms, 2–3 Bathrooms" left 27% of wins with no Bathroom, against the ratio's 23%
  - two shape rules: Under one roof (4+ rooms filling 60% of a box no longer than 2:1), and Cozy (6+ rooms, each touching 2+)
  - a tidy yard
- **One Entertainer per house** (`maxInstances: 1`, option 2's cap), as this entry recommends.
- **Renovate:** a room card whose type is at its limit can level up that room instead: +4 Comfort, up to 2 levels.
- **The household's arrivals** on a schedule shown from week 1 (the twins at Framing, Grandma at Drywall), each bringing a room.
- **Small rules:**
  - the Patio rule, and Treehouses that don't count each other (D-079)
  - half-weight draws while a type is at its limit, which isn't the whole-run halving this entry rejected
- **In the sim, against today's rules:**
  - Visible repeats fell from 92% to 7% of greedy's wins, and wins without a household from 27% to 4%.
  - research.md's plausibility check passed in 75% of wins. This entry's three household specs reached 54% in research.md's experiment, on a different runner.
  - A look-ahead bot's gain over greedy held about level: +22.8% against today's +22.4% at 4 weeks ahead, and +24.2% against +20.5% at 8. Both differences are noise. Under option A it was 9 points lower than under B (real).
  - Charm's share of the Wow rose from 59% to 73%, M4a's Suite and Full House included.
  - Two-thirds of wins still failed the review's glance test, about as often from yard pieces tucked into the house's notches as from the outline.
- **Beyond this entry's Would change list:**
  - every option changes D-043, since the draws would read the house
  - Renovate (in A plus Renovate and in B) also changes D-004, D-036, and D-050, and needs D-070 and D-083 settled
  - B's arrivals also add a start-of-week step (D-036)
- **The choice is the team's:** A (the checklist only), A plus Renovate, B, or C (B plus merging rooms or construction stages).

**2026-11-08 (M4 merged with `develop`):** on M4's branch these parts were D-097 to D-101 until M5a, merged first, took D-097 to D-100. M4 renumbered them before its merge (D-097's juice note has the map), so its older commit messages use the old numbers: "D-093 Accepted with option B; D-097 to D-103" means D-101 to D-107.

### D-101 · The house rules: seven lines every checklist starts with
**Status:** Accepted · 2026-11-06 (D-093's option B, chosen by the team). The numbers are placeholders for the sim.
**Decision:**
- Every client's checklist starts with seven house rules, written in that client's numbers. Each adds +0.25 Charm while it holds, like any spec (`specBonus`, so Dream Home and Inspector's Visit raise them too).
  - **The household:** Room for everyone (the client's Bedroom range, rising as the household grows), a Bathroom for every two Bedrooms (at least one), One Kitchen (exactly one; an L-Kitchen counts), and a living room or two (1–2 Living Rooms, and at most one Dining Room).
  - **The shape:** Under one roof (4+ rooms, filling at least 60% of their box, and the box no longer than twice its width) and Cozy (6+ rooms, each touching 2 or more rooms; a Hallway's link counts as touching).
  - **The yard:** a tidy yard (D-105).
- A client wish that repeats a house rule becomes that client's numbers for it instead of paying twice. The Hendersons' 4+ Bedrooms and 2+ Bathrooms are where their household ends up; Juniper's 4–8 rooms is her Under one roof.
- A spec can have a ceiling as well as a floor (D-093's option 1). Each house rule keeps a floor, so Appendix A's "specs are positive achievements" holds.
- The checklist shows the house rules first, under "The household", "The shape", and "The yard", then the client's wishes, each line with its progress ("3 Bedrooms (3–4)", "fill 64% (≥ 60%)").
- **New house conditions,** each with card text and tests: `ratio` (one count against another), `outline` (rooms, the fill of the box around the indoor tiles, and the box's aspect), `variety` (a minimum of pieces, no type past a count, and types that are exempt), and `stages` (a condition by milestone, for a household that grows). Cozy is data: a count of rooms plus `none` over rooms touching fewer than two.
- **Counting:** a count over piece types counts rooms by their own card, weighted by countsAs modifiers for that same type. Bunk Beds make a Bedroom count twice (D-082); a Kitchen Island doesn't make a second Dining Room.
- Until M4b's arrivals, Room for everyone steps up at Framing and Drywall as the review's option A did: 2–3 Bedrooms, then 2–4 from Framing, then 3–5 from Drywall for the Hendersons.

**Why:** `house-systems-review.md` §4. In the sim, separate lines beat compound ones on the Kitchen and the Bathroom ratio, and the shape rules make a filled outline pay where today raggedness costs nothing.
**Changes:** D-021 (Accepted): every checklist starts with the house rules, and specs can have a ceiling. D-085: the targets need a re-fit.

### D-102 · Renovate
**Status:** Accepted · 2026-11-06 (D-093's option B; the team chose +4 a level, up to 2, and the name Renovate).
**Decision:**
- A room card whose type is at its limit can renovate a room of that type instead of being placed. The room gains a level: +4 Comfort a level, flat and before its percentages, up to 2 levels (`renovate` in `balance.ts`).
- A type's limit is its ceiling in the client's checklist: Kitchen 1, Living Rooms 2, Dining Room 1, and Bedrooms at the top of the current range. A type is at its limit once its count (Bunk Beds counting twice) reaches the ceiling. A member's room counts as a Bedroom here (D-103).
- It's the week's turn, like placing a piece or installing a drawn fixture, from the hand or the reserve.
- Levels show on the board and in the inspect panel. They stay through the Moving Truck and through a transform (the Nursery growing into the Kids' Room), and go with a demolished room.
- A Renovation can be Weekend Crew's next play (D-083). A card that can only renovate doesn't count as fitting for the free redraw (D-070).
- The names stay apart: Renovate is the turn, the Remodel Plans tools level a set type, and the parked renovation mode keeps its name.

**Why:** a duplicate card gets somewhere better to go than a second copy across the lot (the review's force 3). Without it the ceilings make dead cards: under option A, 38% of Kitchen cards were dead, against 6% with Renovate.
**Changes:** D-004, D-036, and D-050 (Accepted): a week's turn can be a Renovation.
**2026-11-08 (M4 merged with `develop`):** "Levels show on the board" is now a pixel badge with a star per level, by the room's other badges. It's placed with M5a's labels, so it never covers the digit or another badge, and it pops on a Renovation. Where it can't fit it's left out, and the inspect panel states the level (D-111).

### D-103 · The household's arrivals
**Status:** Accepted · 2026-11-06 (D-093's option B; the team chose fixed arrivals, not declinable). Built in M4b.
**Decision:**
- Each client is a household that grows on a schedule, shown on the job board from week 1. Arrivals are client data, separate from change orders, and can't be declined.
- At the start of an arrival's phase, after transforms and before the draw, the member's cards go into the crew's extra reserve slots. They're never drawn or sold.
- A member's room counts as a Bedroom. Room for everyone's range rises with each arrival, and from that arrival on it also needs the member's room. The member's card says so.
- The Hendersons' twins arrive at Framing (a Nursery, which grows into the Kids' Room 8 weeks after it's placed) and Grandma at Drywall (Grandma's Room and a Bathroom card). They replace the Twins and Grandma's moving in change orders. Every other client gets an arrival with a member room of its own.

**Why:** the review's §4. A household line alone didn't make the bot build a household; rooms that arrive as cards did.
**Changes:** D-036 (Accepted): a start-of-week step. M4b's change orders: the Twins and Grandma's moving in become arrivals.
**2026-11-07 (M4b):** built (D-109). The other clients' members: Count Vladislav's Renfield (Framing, a 1×2 room: +2, +1 per touching room up to 3), the Barkers' Nana (Drywall, 2×2: +3, +2 per Pet piece up to 2), Juniper's Rowan (Drywall, a 1×2 studio: +2, +2 per view up to 2), and Dale's daughter Ivy (Framing, 2×2, Kid: +3, +2 if touching a Home Office). Their Bedroom ranges go 1–2, then 2–3 from the arrival.

### D-104 · Half-weight draws for a type at its limit
**Status:** Accepted · 2026-11-06 (D-093's option B).
**Decision:** while a room type is at its limit (D-102), its cards draw at half weight (`drawAtLimitPct`, 50). The draw streams don't change, so a replay stays exact.
**Why:** the draw couldn't see the house: 63–67% of offered room cards went untaken in the review's packages. It isn't the whole-run halving of the Kitchen's cards that D-093 rejected; a weight drops only while its type is at its limit.
**Changes:** D-043 (Accepted): draw weights depend on the house while a type is at its limit.

### D-105 · The yard rules: the Patio rule, a tidy yard, and Treehouses
**Status:** Accepted · 2026-11-06 (D-093's option B; the team chose the tidy yard as the yard brake).
**Decision:**
- **The Patio rule:** the Patio, Hot Tub, and Fire Pit earn nothing unless they touch a room. It doesn't block placement, and touching only a Hallway doesn't count.
- **A tidy yard,** the seventh house rule: "6 or more yard pieces, and no yard type stands 4 or more times. Fences, Driveways, and Saplings never break it." Outbuildings count as yard pieces. It doesn't hold below 6 pieces. Fences, Driveways, and Saplings count toward the 6 but never break it, so a fenced yard or a long drive is always fine, packs included (D-074, D-106).
- **Treehouses don't count each other** as Kid partners. They keep D-071's steady +2 and still need a Tree (D-079).

**Why:** the review's §4. With the ceilings in, the yard became the new repeat engine: one yard type stood 4+ times in 70% of P5's wins.
**Changes:** D-071 and D-079 (the Treehouse); D-074 (packs stay free under the tidy yard).
**2026-11-06 (M4a sim):** counting only yard types for the tidy yard (outbuildings neither count toward the 6 nor break it) was tried: one yard type standing 4+ times rose from 5% to 11% of wins, and greedy won 2 points less. Outbuildings keep counting.

### D-106 · Packs: Fences and Driveways you shape
**Status:** Accepted · 2026-11-06 (the team chose it for M4a, resolving D-074). The numbers are placeholders.
**Decision:**
- One Fence card places 1–8 connected Fence tiles in one week, clicked out tile by tile, as one piece. It earns one enclosure payout (still capped at +6), and is demolished and moved whole.
- One Driveway card places 1–6 connected tiles that reach the street or a Driveway.
- They replace the 1×4 Fence and L-Fence cards and the 1×3 and 1×5 Driveway cards, at the same draw weight. Hallways stay as cards.
- A pack is one play, so it works with Weekend Crew (D-083).
- Built after M4a's content and before the re-fit: a piece with its own cells, a tile-by-tile placing UI with its preview, and a fence planner for the sim's bots.

**Why:** D-074. Closing a yard took 2–3 Fence cards in the right shapes, the player never built one, and the Hendersons and the Barkers want fenced yards.
**Changes:** D-004 and D-036 (Accepted): a week's play can place a pack. D-049 (Accepted): the yard shapes. D-071: the variant cards. D-072: the enclosure probe.
**2026-11-08 (M4 merged with `develop`):** M5a's painters draw a pack from its own tiles, never the card's shape: its ghost as the tiles are clicked out, the built pack, and the Moving Truck's carried pack. A Fence's picket line runs through any connected shape, and a lone tile is a short run with a post at each end. The house's car stands only on its Driveway's own tiles, and a Driveway of two tiles or more, of any shape, parks it (D-111).
*Changed by D-121 (Proposed 2026-11-09):* the Fence and Driveway packs draw at 10, not 20, in the Layout row.

### D-107 · Showing what a fixture is worth
**Status:** Accepted · 2026-11-06 (the team chose it, resolving D-092). Built with M4b's UI.
**Decision:**
- **In the shop,** each fixture names its best host in your house, what it adds this week, and roughly what it adds over the rest of the run (this week's gain × weeks left).
- **While installing,** every legal host shows its gain on the board, with the best one marked. A host that already holds a fixture shows the net change after losing the old one.
- The numbers come from the rules (`preview()`), so the UI still scores nothing.

**Why:** D-092: the shop showed a fixture's text alone, and the board showed one host at a time.
**Changes:** D-087: the shop's fixture offers and the install flow.
**2026-11-07 (M4b):** built. The rules give `fixtureValue(state, id)` (the best host in the house as it stands, this week's gain from an install's own preview, and gain × weeks left) and `installGains(state, from, i)` (every legal host's gain).
- In the shop, the value is for the next phase's first week, after its start-of-week transforms. Weeks left counts the rest of this phase and the later phases, not overtime.
- A tie goes to the first host placed. ★ marks every host tied for best, and only when the gain is above 0. A loss is shown in orange (late Bunk Beds can lose Wow once the house has all its Bedrooms).
- While installing, the host under the pointer drops its badge so its own label stands alone. A crate's fixture options get the shop's line too.

### D-081 · M3 rules structure
**Status:** Accepted · 2026-11-06 (proposed with the M3 pull request; held up in playtest 3, confirmed by the team). Implementation details within D-050, D-051, D-056, and Appendix A · M3a and M3b.
**Decision:**
- **Modifiers** in play: the crew's, each blueprint's (its granted timers count from the week it was bought), each company upgrade's, this week's tools' (a timed effect that ends with the week's tally), and each fixture's on its host. The layout kinds (grantTag, removeTag, grantView, countsAs, link) are resolved when the layout is built, with targets matched against the layout before any modifier (Hallway links only); the rest act in the tally. The layout cache keys on the house and the run's (interned) layout modifiers.
- **grantView** (Bay Window, Pergola) gives the view property and counts as one more view for the host's own "per view" bonuses. It matches only a view selector, never "any neighbor".
- **countsAs modifiers** count for selectors, not sets: a Kitchen with an Island never fills an Entertainer's Dining Room slot. Bunk Beds' ×2 waits for M4a's count conditions. **earnNothing** zeroes a piece's earnings but not its budget.
- **×Mult** sources are distinct by kind and id (two Chandeliers are one), in the order sets, fixtures, blueprints, tools, then upgrades and the crew; a ×1.00 source is left out.
- **The shop:** shop k opens after milestone k with the next phase already set up. Streams: `shop/<k>/<refresh>` (goods), `shop/<k>/<refresh>/sale`, `shop/<k>/upgrade` (kept by a refresh), `crate/<k>/<refresh>/<offer>`, `crate/<k>/0/housewarming`. A good's price is its list price × `shopPricePct`, rounded half up, at least 1; the sale halves it. Services and the refresh aren't discounted. Selling pays half the discounted list price, rounded down, so selling back is never a profit. A refresh counts as buying for the skip reward; the free Housewarming crate doesn't. The sale ends when its good is bought. An open crate blocks buying, refreshing, and leaving, but selling to make room is fine.
- **Interest** (Savings Account) is min(⌊budget held before the reward ÷ 5⌋, `interestMax`), at each met milestone.
- **Rerolls:** a phase's rerolls are set again when it starts, after the shop, so a Foreman counts at once. Bought rerolls are spent after the phase's own.
- **Fixtures:** installing the fixture a piece already has is illegal. preview() takes supply installs too.
- **Tools** are used on the build screen only. The Moving Truck keeps the piece's uid, timers, fixture, and place in the placement order; it's checked as a new placement on the house without the piece, and can't split the house. The Catalog is a draw at n = draws. Fertilizer adds to `ageBonus`. Weekend Crew's state is `freePlay`: none, ready, used.
- **Finds** are placed after a lot passes its checks, from `lot/<attempt>/finds`, so every lot's other terrain is what it was. They sit at least 4 rows back from the street and never touch another find. Demolishing any Old Shed tile removes all four. A Time Capsule clears like a Tree and pays before the week's tally. The Old Shed's random tool comes from `find/<x>,<y>` (its top-left tile) among the offered tools; with full supplies it's sold at once for half.
- **Debug:** forceShop opens shop min(max(1, phase + 1), 6) mid-week; leaving it goes back to the same week with a fresh hand at n = draws. giveGood puts any good where buying would.
- **Budget earned** for the end screen counts income, not refunds from selling.

**Why:** Choices §4, §5, and Appendix A leave open. Each keeps the preview equal to the tally and every run replayable.

### D-082 · M3 content defaults
**Status:** Accepted · 2026-11-06 (proposed with the M3 pull request; held up in playtest 3, confirmed by the team).
**Decision:**
- **Shapes Appendix B leaves open:** Playroom 2×2, Library 2×2, Mudroom 1×2, Pool 2×3.
- **Skylight, Blackout Curtains, and Bunk Beds also earn +25%** on their host. Their Appendix B effects (Sunny, Dark, counting twice) pay off only with a blueprint or M4a's specs, so they'd be dead cards in M3's draw.
- **Held back until M4a:** Dream Home (blueprint) and Inspector's Visit (tool) act only on specs, so the shop doesn't offer them; the Remodel Plans for Suite and Full House join with those sets.
- **Shop stock:** a card slot is a fixture half the time, otherwise a special piece. Tools cost 2, 3, or 4 by rarity; crates 4; upgrades 6–8 (Appendix A's placeholders).
- **Finds:** one Old Shed and one or two Time Capsules a lot.

**Why:** Defaults so every M3 good does something in M3; each is a line of data.
**2026-11-06 (systems review):** counting Bunk Beds once toward a household's Bedroom range was simulated with the review's house rules. It didn't help, and cost 4 points of the Bathroom ratio, so the review keeps them counting twice (`house-systems-review.md` §5.7).
**2026-11-06 (confirmed by the team):** Bunk Beds keep counting twice toward a household's Bedrooms. The systems review tested counting them once, and it didn't help (D-101).

### D-086 · Tooltips, first pass (with the shop)
**Status:** Accepted · 2026-11-06 (proposed with the M3 pull request, as D-077's light pass; held up in playtest 3, confirmed by the team).
**Decision:**
- Hover or focus a dotted-underlined term for a short explanation. One fixed tooltip layer, so scrolling panels never clip it.
- The text comes from the rules (`glossary()` in `text.ts`), with its numbers read from `balance.ts`, as card text is (D-038).
- Terms: Comfort, Charm, Sparkle, Wow, budget, complete early, fixtures, the reserve, supplies, blueprints, rarity, the sale, the refresh, saving up (the skip reward), services, strikes, tools, crates, and company upgrades.
- Board terms (yards, requirements, links, timers) wait for D-078 and D-080.

**Changes:** D-077 (Open): its first part.

### D-087 · M3 interface defaults
**Status:** Accepted · 2026-11-06 (proposed with the M3 pull request; held up in playtest 3, confirmed by the team).
**Decision:**
- **The shop** is a sheet over the board, after the milestone's tally and banner. A section per kind of good; "Look at the lot" hides it; the leave button says what leaving without buying pays.
- **The inventory** sits above the hand: reserve, supplies, and blueprint slots, with owned upgrades under Company. Hover an item to read it in the inspect panel, with Sell. A reserve piece places like a hand card.
- **Installs and tools follow D-073's two presses** for free, irreversible actions: a supply fixture installs on a second click on the same piece; the Copy Machine copies on a second click; the Moving Truck picks a piece up, shows its ghost, and moves on a second click on the same spot. Other tools have a Use button in the inspect panel, with what they'd do to this week's total. A hand fixture goes in tentatively, like a hand piece, and End week commits it.
- **Rarity** is a colored border plus a label: Common green-grey, Uncommon blue, Rare gold.
- **Juice (D-059):** budget counts coin by coin (§12); Rare goods shimmer in with a sound; a bought good pops and stamps; crate options turn over one at a time with a glow by rarity; ×Mult sources land as gold Sparkle stamps on their own beat; Crown Jewel marks its top earner; installs, tool uses, moves, and finds get their own popups.
- **Debug:** Force the shop, Give any good, and Jump stops at the shop before the chosen milestone.
- **Art:** placeholder sprites for the special pieces, the Old Shed, and Time Capsules; fixtures and tools wear text glyph badges until M5's art.

**Why:** Choices §7 leaves to the build.
**2026-11-06 (playtest 3):** fixtures felt okay, but it was hard to tell whether one was worth it: see D-092, and D-107, which adds each fixture's value to the shop and to installing.

### D-088 · The M3 sim: the shop bot and the economy reports
**Status:** Accepted · 2026-11-06 (proposed with the M3 pull request; held up in playtest 3, confirmed by the team).
**Decision:**
- **The shop bot** values each offer by one tally with it applied, times the weeks left in the run, per unit of budget: blueprints on the house as built (×1.25 for pieces built later; Last-Minute Push weighted by the last week; Good Bones by its growth), reserve pieces at half their best placement (they take a week), fixtures at their best install, tools by their rule, crates by the best of a few sample options, upgrades and services by rough heuristics. It buys the best value while it earns at least 0.12 weeks of current income per budget; keeps the best crate option; sells its weakest blueprint for a much better one; refreshes once when it has 8 more than the refresh costs and nothing is worth buying.
- **Tool rules:** Remodel Plans and the Dumpster at once; Fertilizer unless it costs this week; the Copy Machine on the top earner; Weekend Crew when a placement would help; Rush Order and Open House Party in a phase's last week when short of the target, or in the run's last week; the Catalog on a hand with nothing worth building and no rerolls. It never uses the Moving Truck. Supply fixtures go in their best host.
- **Reports:** how often each good is offered, bought, kept from crates, and in runs and wins; budget earned and left unspent; skip rewards and sells; installs per fixture (from the hand and from supplies) and uses per tool, each with its average weekly gain. `--json` writes every run's record.
- **The random bot** also shops and uses tools at random, so the smoke sim covers the economy.

**Why:** §7 M3b and §8's added reports. A value-per-budget bot is the plan's design; the heuristics are rough, and the reports show what they buy.
**2026-11-06 (D-089):** the shop bot no longer strikes card types unless asked (`--strikes fixed` keeps D-084's order). It values the +1 reroll service at 0 while it holds a bonus reroll, and the Catalog at 0: it bought 21 in 100 runs and used none. `BOT_BLIND` lists every good it values at 0 by construction, and the economy report says so in its Bot column. "Wins" is confounded by run length, so strength questions go to `--ban` and `--gift`. The chaos test, not the random bot, now covers every economy action.

### D-089 · Gameplay tests and the sim's second pass
**Status:** Accepted · 2026-11-06 (proposed with the fix/gameplay-tests pull request; held up in playtest 3, confirmed by the team). Its targets weren't applied; M4's re-fit uses its method (D-085).
**Decision:**
- **Greedy's tie-break:** equal estimates break by a seeded key per play, never by list position.
- **The estimate sees fenced yards and Hallway links.** `estimatePlay` flags a Fence that would close a new fenced yard (`yardHint`) and a Hallway that would link rooms not linked now (`linkHint`), beside `setHint`. Greedy scores up to 24 flagged plays exactly, on top of the top 12 and the best 2 of each card.
- **Bots:** `novice` picks a random card that fits and puts it at its best spot, and shops like `random`. It's the floor for "milestone 1 teaches". Greedy's variants share its name, so they play the same seeds alike: `--early never|always|last` and `--strikes none|fixed`.
- **The shop bot** strikes nothing by default, skips the reroll service while it holds a bonus reroll, and values the Catalog at 0 (D-088's note).
- **Step caps:** a run past 400 actions in a week, or 20,000 in all, stops with a SimError. So does any bot or apply() error. The error names the seed, the step, the week, and the action, and carries a run code. `npm run sim` prints failed runs, reports the rest, and exits 1.
- **Reports** gain rates with Wilson 95% intervals; each piece's offers, dead cards, picks, Wow share, and clusters; Comfort, Charm, and Sparkle shares; flat points by source; house siting; early completion per milestone; Fence cards offered next to the probe; and the economy's Bot, Crates, and "Gain × weeks left" columns, strikes by type, bonus rerolls, and spendable budget.
- **`npm run sim -- --check`** runs greedy, random, novice, and greedy with early always on held-out seeds (`check-*`). It prints each of §8's starting criteria as PASS, FAIL, or NOT MEASURED, with what was measured and whether the 95% interval agrees (§8 says how each is measured).
- **`--ban kind:id` and `--gift kind:id`** compare paired seeds. A ban takes a good off the shelves. A gift hands it over at a shop, against a placebo action at the same moment. Both report the seeds won by only one arm. Until there's a planner, this is the "no must-buy" check.
- **`--suggest-targets`** fits on `sim-*` (`--fit-seed`) and checks the new targets on held-out `check-*`, next to what the fit estimated. `--dry-run` writes nothing.
- **CI:** the `test` job times out after 10 minutes. A separate `sim` job runs `--check` on pull requests and writes it to the run's summary. It's informational: never required, and it never fails the run.
- **npm test** plays more of the real content: a chaos bot (every action kind, with debug cheats to reach the economy and all seven phases; invariants, and preview against apply, after every step), full greedy runs replayed from their run codes, greedy beating random on 5 seeds, a looping bot stopped by the step cap, and tests that pin the real tools, upgrades, and crates.

**Why:** an audit found the sim's numbers partly measured the bots' blind spots:
- `legalPlacements` lists the back row first, so greedy built every house against the back of the lot. That cost it about 10–15 points of win rate.
- The estimate couldn't see yards or links, so Fences and Hallways looked dead to the bot. A fixed strike order then struck Driveways and Fences in nearly every run, which would hide any fix to them.
- §8's criteria were never checked, and the target fit reported on the seeds it fitted.
- npm test's smoke runs ended by week 10 with no tools, and a looping bot would have held CI for hours.

**Numbers** (`npm run sim -- --check`, 200 runs each on `check-0…199`, today's targets):
- Greedy wins 60.0% [53.1–66.5] and clears milestones 1–3 in 93.5% [89.2–96.2]: FAIL against 40–50%. The old greedy won about 52% on held-out seeds.
- The floors: random loses by milestone 3 in 96.5% of runs; novice passes milestone 1 in 92.5%. Both PASS.
- Early completion, always against never: 45.5% against 60.0% wins, −14.5 points [−21.3, −7.7]; 12 seeds won only by always, 41 only by never. FAIL: completing early whenever it's offered is a trap at today's rewards.
- Fences: 0.41 placed per run (0.03 before) and 27% of runs end with a fenced yard (3% before). The probe's p50 is 2 cards; 51% of runs are offered that many Fence cards by milestone 4. Hallways are picked 3–4% of the time they're offered and earn nothing in about two thirds of their weeks.
- The lot matters: runs that end with the house 0–3 rows from the street win 69%, and 10 or more rows back 48%. Lot features are 26% of flat points and the street 0%. Charm is 57% of the Wow (playtest 2: 58%), Sparkle 7%.
- A fit on 400 fresh untargeted runs (`--suggest-targets --dry-run --runs 400 --fit-seed fit`) suggests 15, 190, 530, 1,250, 2,650, 6,100, and 12,800 Wow. On 400 held-out runs those give greedy 43.3% wins and 92.8% through milestone 3, and random loses by milestone 3 in 94.8%. Not applied.
- npm test takes about 7 s (it took 2 s): the chaos test about 6 s of it, alongside the other files.

**Also:**
- The chaos test's coverage (every action, tool use, milestone result, good, and shop, a win and a loss) is checked across its fixed seeds; when a content change leaves a gap, it plays up to 6 more seeds, checked the same way, before it fails. One run starts with the ×Mult goods, whose conditions random play rarely meets.
- The lot test also checks the real lot balance over 1,000 seeds, before the finds go down: the finds are placed after the checks by design, and an Old Shed on the street's side can tip 3 lots in 1,000 a fraction under `minStreetSidePct`.

**Changes:** D-072 (Accepted): how greedy ranks plays, and how the targets are checked; its targets stand. D-084 (Accepted): its Sim line, since the default bot no longer strikes. The team confirmed both on 2026-11-06. D-085 (Proposed): its numbers came from the old greedy. D-088 (Proposed): the shop bot's strike, reroll, and Catalog rules, and the reports.
**2026-11-06 (systems review):** the review proposes adding its house report to §8's reports: room counts, repeats, Bedrooms per Bathroom, research.md's plausibility check, and the glance measures (`house-systems-review.md` §6 and Appendix).
**2026-11-07 (M4a):** the house report is in (`npm run sim`, after the piece table), with wins and all runs side by side, and per-client and per-crew tables with each checklist line's hold rates and the client spread criterion. Greedy's cheap estimate now sees the checklist lines that counts can decide (`count`, `ratio`, `outline`, `variety`, by the current stage): a play that turns one on or off moves its estimate by what the line's Charm would add. Pair lines (the Hendersons' Kitchen beside the Dining Room) get a hint for exact scoring. On 400 runs, the shortlist finds the week's exact best 87% of the time (82% before), and Under one roof holds at the end for more of every client's houses (Juniper 24% → 34%). A sim's speed is unchanged, and the benchmark passes at 610–680 ms.

### D-071 · M2 content defaults
**Status:** Accepted · 2026-11-06 (proposed with the M2 pull request; the team settled the Treehouse in D-105 and asked for this to be Accepted unless the sim showed the Hendersons' Kid taste making Treehouse clusters dominant. It doesn't: see below).
**Decision:**
- **Shapes and tags** Appendix B leaves open come from `content-brainstorm.md` §3, §4, and §6, as D-067 did: Closet 1×1; Garage 2×2, Loud; Home Office 1×2, Quiet; Sapling 1×1, Green; Flower Bed 1×1, Green and Pretty; Herb Garden 1×2, Green; Patio 2×2, Outdoor and Social; Doghouse 1×1; Treehouse and Greenhouse 2×2.
- **Card names** for the shape variants: Long Hallway (1×3), L-Fence (the 5-tile L), and Long Driveway (1×5), each sharing its type with the short card.
- **Every card is weight 10,** as in D-067, so the four types with two cards (Kitchen, Hallway, Fence, Driveway) come up about twice as often.
- **The Treehouse** also earns a steady +2. Appendix B gives it only +2 per Kid neighbor, and the base pool has no other Kid piece until the shop's Playroom, so it would be a dead card in M2.
- **The Kitchen** now earns +2 per touching Herb Garden too (D-067 deferred it to M2).

**Why:** Defaults so every base-pool piece is playable in M2; each is a line of data.
**Playtest 2:** the Treehouse's extra +2 plus its Kid bonus made clusters too strong (D-079). The other defaults held. It stays Proposed until D-079 is settled.
**2026-11-06 (M4a):** the L-Fence and Long Driveway cards are gone: the Fence and the Driveway are packs (D-106). In M4a's sim (1,000 held-out greedy runs), the Hendersons place 1.2 Treehouses a run and they earn 1.9% of their Wow; 3+ Treehouses appear in 11–15% of wins across clients, against the review's 12–14%.

### D-094 · Chain reactions
**Status:** Accepted · 2026-11-10: option 1, for the jam. The user chose it when the juice pull request (`phase/juice`) asked, and that pull request builds it. Options 2 to 4 are Parked until after the jam, and the points under *To decide* stay open for them. The team asked for chain reactions on 2026-11-06, after the Combolands systems research (research.md, "Update: how Combolands' systems fit together, and chain reactions").
**Decision:** option 1, in `src/ui/fx/chain.ts`, with no rule change:
- The tally plays a week's pieces depth first along what boosts what. A piece boosts another when the other's breakdown has a line that adds to it and names it in `from`: a neighbor it counts, or an aura from next door. Penalties and modifiers don't count.
- An arc runs from the booster to each piece it sets going, for that piece's step (`FEEL.chain`).
- The placement preview draws the same arcs, dashed: from the pieces that would boost the play's piece, and from it to the pieces it would boost.
- Every piece plays once and earns what it does today.
**Finding:**
- Since D-036, a week is one scoring pass and no effect triggers another. That keeps the preview equal to the tally and rules out loops, but it leaves out what reviewers single out in Combolands and what Balatro's retriggers do: one piece setting off another.
- Every interaction today is one hop. Auras change what a neighbor earns, links count as adjacency, and sets pay as a group. The tally pops pieces in placement order, so a big week reads as a list rather than a chain.
- Neighbor and aura lines already record the pieces and lot features they count (`BreakdownLine.from`); modifier lines name their source only in the label.

**Idea (the team's):** chain reactions like Combolands' and Balatro's.
**Options:**
1. **Show the chains we already have.** No rule change. The tally plays pieces depth first along what boosts what: from each piece not yet played, in placement order, it plays the piece, then each piece that piece boosts that hasn't played yet. Each piece plays once, and options 2 and 3's extra activations play inside the same walk, right after their causes. The preview draws the same arcs.
   - *Cost:* UI only, part of M5's tally work.
   - *Limit:* it's feel and legibility; no piece earns more than it does today.
2. **Extra activations ("Again!").** A piece can activate more than once a week, and each extra activation adds its earnings again. Earnings are still worked out once, in today's pass, so percentages and fixtures keep their shape.
   - *Data:* one modifier kind, `retrigger { target, times }`: the target activates `times` more a week, and an extra activation doesn't retrigger again. It goes on fixtures (target `{ host: true }`), blueprints, crews, tools (`weekModifiers`), and, from M4, tastes and phase change orders. A set that sets off its members would need a `SetDef` field or an `inSet` selector. For example, a Doorbell fixture (its host activates again), a Bedtime Stories blueprint (Bedrooms that touch a Kid piece activate again), or a Block Party tool (every piece activates once more this week).
   - *Bound:* at most 3 activations per piece per week, its own included (`maxActivations` in `balance.ts`). Every activation counts, a relay's that earns nothing included, and one past the cap is dropped, not deferred. Counts are per placed piece, and no piece is added or removed during a tally. The resolution throws past 3 × pieces activations, so a bug fails fast instead of hanging.
   - *Cost:* small: the kind, its card text, the tally's "Again!" step, and tests.
3. **Relays: activations that spread.** A relay passes activations on, as in "when this activates, each touching Social piece activates again." Each activation of a relay sets off each piece it reaches once, never itself, so a chain can run from A to B to C.
   - *Order:* activations resolve depth first. Pieces take their turns in the tally's order (option 1); a turn is one activation, then the piece's retriggers. Each activation, as it plays, sets off the pieces its relays reach, in placement order, and each of those plays at once, with everything it sets off, before the next. A piece's own turn always comes, so its extra activations stop at 2.
   - *Bound:* option 2's cap. Every activation uses one of a piece's 3, so the resolution always ends, and two relays that reach each other both stop at the cap.
   - *Data:* an effect kind shaped like `aura`: `relay { match: Selector; scope: 'adjacent' | 'region'; every?: number }`, on pieces. A fixture carries one through `grantEffect { target: { host: true }, effect: relay }`, as Good Bones grants growth. A relay may earn nothing itself and only pass activations on. As with auras, `adjacent` means scoring neighbors, so a relay reaches rooms linked by a Hallway.
   - *Examples:*
     - a Butler's Pantry: when it activates, each touching Kitchen and Dining Room activates again
     - Wind Chimes for a Patio: touching Social pieces activate again
     - an Intercom fixture: touching rooms activate again
     - an Irrigation line that sets off the touching Green pieces every 2 weeks
     - a Rare blueprint with a setup, in D-056's style: ×(1 + 0.05 per extra activation that earns Points this week), up to ×2. `plusPer` would gain a week stat (`extraActivations`) and a `max`.
   - *Cost:* the resolution, the kind, text, termination and preview tests, and the tally playing the chain. More than option 2, but the same activation machinery.
4. **One-time ripples.** Events that spread once and can't repeat. A Sapling that grows into a Tree also grows each touching Sapling a week, so an orchard grows in a wave; a piece with a Salvage fixture pays budget when it's demolished.
   - *Rules:* a ripple is a one-time event, not an activation, so it may move a timer or pay once. Ripples resolve at the start of the week, after every transform: a Sapling that a ripple pushes past its timer becomes a Tree the next week, so the wave moves one ring a week, and `pieceTimers()` counts the ripple.
   - *Cost:* content, plus a small hook per event.

**Shared rules for options 2 and 3:**
- An extra activation repeats only the piece's own earnings, with every term in them: percentages, fixtures, rhythm and growth payouts (0 in a Pool's off week), and capped terms, so a `max` or `cap` holds per activation. Its auras on its neighbors apply once. Sets (at their Remodel Plans level), specs, +Mult, and ×Mult pay once a week, however often their pieces activate. Extra activations never pay budget and never move timers. A piece with an unmet `requires` doesn't activate or relay; one under `earnNothing` still activates and relays, and adds 0.
- `PieceScore` keeps `earned` (one activation) and gains `activations` and `weekly` (earned × activations), so the UI never multiplies. Its lines gain one per extra activation, naming the cause. The preview lists a piece when its `weekly` changes, and the property test checks that. The tally, the tile's digit, and Crown Jewel use `weekly`: the top earner is the piece with the highest `weekly`, ties going to the earliest placed, and its +100% applies to that.
- Each piece's activations, and so the week's total, come out the same in any order; the order only decides how the tally plays them, and the rules produce it. `preview()` runs the same resolution. A §9 property test checks the counts against a plain fixpoint, and that no piece passes the cap.
- The `tally` event lists every activation in play order with its cause (a piece, or a modifier's source), so the UI only plays it. An extra activation takes a shorter step than a turn (`againStepMs`, about 0.2 s, in `feel.ts`), a piece's retriggers play as one step ("Again ×2"), a relay pulses even when it earns nothing, and the pitch ladder climbs along a chain. At the cap, a 40-piece week would then take about 18 s at 1×, against about 12 s now. Card text and the inspect panel show the cap, since D-036 rejected a hidden one.
- Chain pieces in the base pool are complexity 3 (D-055). Fixtures have no complexity, and shop goods ignore it, so chain fixtures, blueprints, and tools are Uncommon or Rare (shop 1 offers Commons only), and drawn chain fixtures join a phase after the other fixtures (`fromPhase` 2).
- *Sim:* report activations per week, chain length, the share of Points from extra activations, how often a piece hits the cap, and the largest per-piece multiplier. `estimatePlay` counts activations, which are local: the candidate's own, from the relays it would touch and the retriggers that match it; its neighbors', from the pass tally; and one more for each neighbor a new relay would reach, under the cap. A play whose value it still can't see (a relay through a Hallway link, or a second hop) gets a `chainHint` and is scored exactly with the other hints (D-089).

**Recommendation:**
- **Option 1 in M5, whatever else is chosen.** It's the cheapest way to make today's interactions read as chains.
- **Options 2 and 3 together, as a small phase between M4a and M4b, or inside M4b,** so M4b's crews and change orders can use them and M5's juice is built around them. Start with 4–6 chain items, and ask in its playtest whether a chain felt like the player's own doing.
- **Option 4** where it fits the theme, starting with the Sapling wave.
- **If time runs short:** option 2 alone gives the "Again!" moment with the least rule work, and relays wait until after the jam.
- Re-fit the targets afterward (D-044), since extra activations raise Points.

**To decide:** which options, and where they land (inside M4b, a phase between M4a and M4b, or after the jam); the cap; whether budget ever chains; whether a relay passes on the activations it receives (this entry assumes it does).

**Would change:**
- D-036: a week can include extra activations, within a cap that card text and the inspect panel show.
- D-037: a piece contributes its earnings times its activations: ×3 at most, on top of percentages that add, so a +300% piece at the cap with Crown Jewel would earn ×24 its points, the range D-037 was written to avoid. Crown Jewel picks by that weekly amount.
- D-056: Points include extra activations; +Mult and ×Mult apply once a week; option 3's Rare blueprint would be a fourth ×Mult blueprint.
- D-050's and D-051's item counts, and D-089's hints.
- §4's scoring pipeline, API (`PieceScore`, `Preview.lines`, the `tally` event, Crown Jewel's step) and Performance; §5's effect and modifier kinds; §8's reports; §9's property tests; §12's tally; Appendix A (`maxActivations`, the ×Mult goods); and Appendix B (the new items).
- D-053, §7, and jam-scope.md's build order, if chains get a phase of their own.
- Check against D-093 (chain items shouldn't reward repeating a room type) and D-090 (under these rules, a fixture that pays budget each time its host fires would pay once a week).

**2026-11-06 (D-097):** M5 is now split, and M5a, with the visual juice and its tally work, comes before M4. So the Recommendation's "M5" is M5a: option 1 would land in M5a's juice stage. Options 2 and 3 can no longer land in M4 and still have the juice built around them: they would either come before M5a's juice stage, or add their "Again!" steps and arcs to the tally when they land in M4.

**2026-11-06 (systems review):** under the review's house rules, a house is paid to keep one Kitchen and at most two Living Rooms, and Renovate takes a repeated room card. So chain items needn't reward repeats, and a relay that reads Social would reward packing the shared rooms into a hub. Untested (`house-systems-review.md` §8).

**2026-11-07 (D-097):** M5a's visual juice is now its own pull request after M4 (D-097's juice note), and M4 was built without chain reactions. So option 1 would land in that pull request, and options 2 and 3, if chosen, come after M4: before the juice pull request, so its tally is built around them, or with it.

### D-096 · The tally's closing beats aren't auto-accelerated
**Status:** Accepted · 2026-11-10, the user's yes, asked with the juice pull request (`phase/juice`). Proposed 2026-11-06 with the fix/ui-audit-bugs pull request (the UI and juice audit, item 9), as a change to a detail of §12's Timing, which D-059 approved with the plan.
**Decision:** Auto-acceleration speeds up a tally's steps only: the triggers, the sets, and the ×Mult stamps. From the multiply moment on, the beats play at the chosen speed: the pause, the total's hold, the count-up, the target's ding, and the milestone's hold. Holding Space or the right button still fast-forwards them, and a click still skips.
**Why:** The accelerator kept growing through those beats, so the longest weeks, usually the biggest, got the shortest payoff. A 25-trigger week at 1× is at about 2× by the multiply moment, so its 0.4 s pause took about 0.2 s. The steps are where a long week drags; the payoff is short at any length.
**Changes:** `implementation-plan.md` §12, Timing. D-059 (Accepted) still holds: the tally speeds itself up.

### D-112 · Playtest 4's quick fixes
**Status:** Accepted · 2026-11-10, played in playtest 5 with no issues raised (`docs/playtests/playtest-5-findings.md`). Proposed 2026-11-09, with the fix pull request after playtest 4 (`docs/playtests/playtest-4-findings.md` has the findings).
**Decision:**
- **The title screen:**
  - The car is mirrored at the cut (`art/limezu/ui.json`), so it faces the way it drives.
  - How to play and Settings hang their chains a quarter in from each end, under Start.
  - The villas' little gable over the front door is painted out with their own siding, trim and deck planks (a compose), so the porch roof reads as a flat deck under the balcony. That was the user's pick of three looks.
  - The footer keeps just the jam note. LimeZu's credit stays in How to play's Credits and in CREDITS.md: both packs' licenses ask for credit and say nothing about where.
- **Inspect's buttons** may wrap, so they never run past the panel. They say "Use it now" (the tool's name is the heading) and "Sell for N" (the coin says budget).
- **Change orders:**
  - The sheet's "It's coming either way: it can't be declined" goes, since the missing Decline button says it.
  - About one phase effect in four shows a flavor line instead. A UI-only hash of the seed, the order and its phase picks it, so a replay shows the same one.
  - Set bonuses read "The Entertainer pays double" and "Every set pays 10% more", not "+100% more".
- **The Garage:** its card says "Must touch the house, and the street or a Driveway". A spot off the house says "The Garage is a room: it must connect to the house."
- **Soundproofing** names what's Loud: "Loud neighbors (the street, Garages, Playrooms, and Pools) can't take points off it".
- **Renovate:**
  - A card that can renovate shows a ★ Renovate chip.
  - A first-time hint explains it the first time a card can.
  - The glossary says it's done in place, with nothing torn down.
- **The glossary's Hallway links** no longer say a Hallway earns nothing itself, since a blueprint like Country Living pays it.

**Why:** playtest 4's notes:
- the car drove backwards, the chains ended in the air, and the gable looked unrealistic;
- long tool names ran the Use button off the panel;
- the footnote was funny once;
- the Garage card read as if the street alone would do;
- Soundproofing was worth nothing in every week of the run;
- the player never knew Renovate existed. It came up 4 times, once worth more than the play made.

**Changes:**
- D-098's title note: the credit moves off the title.
- D-109's change-order bullet: the pick is even among the client's own orders and the generic ones; the old wording said "then".
- D-102 (Renovate) gains the chip. D-045 (first-time hints) gains the Renovate hint.

### D-113 · Inspect holds a clicked piece, and the house rules fold into one row
**Status:** Accepted · 2026-11-10, played in playtest 5 with no issues raised (`docs/playtests/playtest-5-findings.md`). Proposed 2026-11-09, with the small UI pull request after playtest 4. The user picked this over collapsing the whole client panel.
**Decision:**
- **Click to hold:** with nothing picked, a click on a placed piece holds Inspect on it, so the pointer can go to the panel and scroll its notes.
  - The board marks the held piece with a dotted pale rim in the tally's active colors.
  - Inspect's plank gets a ✕.
  - While a piece is held, Inspect gets the left column's room first, as it does while a play is looked at.
  - It lets go on a second click on the piece, a click on open ground or the street, Esc, the ✕, picking something, demolishing, a new week, another screen, or the piece going.
  - It's UI only (`store.ts` heldPiece).
- **The house rules fold into one row:** "House rules 5/7", with their Charm while folded. A click opens or folds them.
  - Folded by default, but open on a first visit (until the checklist's first hint is dismissed).
  - They open by themselves while a play being looked at turns one on or off, or a tally flips one, until the tally ends.
  - A tally's beat on a line that holds lights the folded row, as a folded group's row does.
  - The row replaces the "House rules" plank tag, and the groups' own folds work as before.
  - Who's still to move in shows either way, and the client's wishes and change orders never fold.
- How to play and the controls list say so.

**Why:** playtest 4.
- Inspect followed the pointer, so reaching its scrollbar crossed other tiles, and a long note couldn't be read.
- A click on a placed piece did nothing with nothing picked, so it was free for this.
- The client panel's plank had no room for a collapse caret at 280 px.
- Every client has the same seven house rules, which took the room Inspect needed.

**Changes:** D-109's UI note: the house-rule groups now fold inside one row for the whole rules. D-110's left column: a held piece counts as looked at.

### D-114 · The Hallway experiment, step 1: Hallways pay for the rooms they touch
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`): the Hallways "felt good", and the user didn't bolt them to the outside just for their +2, so step 1's "between rooms" fallback isn't needed. Proposed 2026-11-09, after playtest 4 (`docs/playtests/playtest-4-findings.md` §7) and the layout session's proposal (§1, on its own branch). Built for playtest 5; the user asked for it once that session reported.
**Decision:**
- Both Hallway cards (the Hallway and the Long Hallway) earn **+2 Comfort for each room they touch, up to 4** (+8). It's the existing `neighbor` effect on rooms, and the link (D-046) is unchanged.
  - Each hall counts the rooms it touches itself, each once however many tiles they share.
  - Another Hallway isn't a room, so a run of halls doesn't pay for the rooms at the far end.
  - The card adds "+2 per touching room (up to 4)" under the link's line.
- No Hallway pack for now, and no new condition. If a pack comes back: complexity 3 (not 2), with this pay, and an outline rule tested on held-out seeds first.
- If the playtest shows halls bolted along the outside, the fix is ready: the pay counts only while every tile of the hall has rooms on two or more of its sides ("between rooms").

**Why:** playtest 4: Hallways felt like a punishment.
- A link pays only when the rooms along it read their neighbors, and few do. A Hallway earned 44 Wow a copy (111 for the Long Hallway), and greedy built one in a quarter of runs.
- With the pay, on 200 held-out seeds: 1.67 a run, in 84% of runs, about 610 Wow a copy. Wow ×1.07\*, Cozy +6\*, wins +1.5 points (within noise). The outline pays a little (H1g −7\*). (\* = the 95% interval excludes no change.)
- The pack alone lost 9.5 points of wins\* at complexity 2; with the pay it sprawled (glance test −17.5\*); and paying only between rooms made it a dead card (−10\*).
- This PR's own check, greedy on 200 held-out seeds (`--seed check`), paired against develop: wins 44.5% → 48.0% (+3.5 points [−0.7, +7.7], within noise), Wow ×1.077 [1.012–1.147]\*, Hallways 0.24 → 1.65 a run. §8's criteria all pass. The estimate fix below changes nothing on its own (wins +0.0, Wow ×1.008).

**Changes:**
- The content (`pieces.ts`). D-046's "a Hallway isn't a neighbor for bonuses" stands.
- The sim's cheap estimate (`estimate.ts`) now counts a Hallway's +2 when a room is placed beside it: the Hallway isn't the room's neighbor, but the room is the Hallway's. Without it, greedy missed the week's best play when that play fed a Hallway.
- The targets aren't re-fit for this. A re-fit waits for bigger rooms (fusion), which moves the curve more.

**2026-11-09 (D-123):** re-fitted before fusion after all, with D-119, D-120 and D-121, which together took greedy to 81.5%. Fusion (D-115) will need a re-fit of its own.

### D-119 · Creek lots: Creekside, the pond, and the lot's traits on the job board
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`): with creeks on a quarter of lots, "the lack of creeks is okay", after seeing them on nearly every map before. Proposed 2026-11-09, after playtest 4 (`docs/playtests/playtest-4-findings.md` §11) and the lot session's proposal (`docs/proposals/lot-creeks-and-sun.md`). The user picked the proposal's package (§7); this is its first part. The sun (a sun direction per lot and Sunny payoffs) comes next, as its own entry. Built for playtest 5.
**Decision:**
- **Creeks on about a quarter of lots:** `creekPct` 25 (it was 70): 24.6% of 2,000 held-out lots have one, and a creek lot is on 52% of job boards. A lot that keeps its creek keeps its terrain; the others are drawn again without one.
- **Creekside:** a creek lot pays. Pieces touching the creek earn +50%, all run: Waterfront's effect, for the creek alone, from the lot. The lot's traits are a new source of run modifiers beside the crew and the client, and the breakdown line says "Creekside".
- **The pond:** every lot without a creek keeps it, so every lot has water, and half the creek lots do (`pondPctCreek` 50), so a creek lot looks different. The pick comes from its own `lot/<attempt>/pond` stream, so the rest of the lot stays as drawn, and a pond that goes leaves open ground. The regeneration checks run after it: more ground behind the creek can leave too little on the street's side.
- **Lot traits** are data (`src/content/lot-traits.ts`): a terrain and how many tiles of it, modifiers, a blurb, and the clients a trait suits. There are two:
  - **Creekside:** any creek.
  - **Wooded:** 100 or more Tree tiles (22% of lots; the median lot has 86). It pays nothing; it's a hint, and it suits Count Vladislav, who likes pieces touching Trees.
- **Where they show:**
  - A contract's card shows the lot's traits as wood chips under its map, each with a tip: what it pays, all run, then its blurb. A trait that suits the client wears the up icon, as a taste they like does.
  - A trait that pays stays on the checklist beside the crew's chip, as an icon beside the crew's on a window under 1000 px tall.
  - How to play says what a creek lot is.

**Why:** playtest 4: creeks felt too common.
- Before this, creeks were on 67% of lots and changed nothing. On 600 held-out seeds, creek lots won and scored like the rest, and 41% of the houses on them never touched the creek: scenery that blocked a few spots.
- At a quarter of lots, a creek shows up on about one job board in two, and Creekside makes it a reason to take that contract. 41% of lots now show a chip of some kind, and 78% of boards. In the proposal's prototype, Creekside pulled houses to the water: pieces touching the creek went from 2.0 to 4.7 a house on the same lots.
- **This PR's own check**, greedy on 200 held-out seeds (`--check`), paired against develop: wins 48.0% → 57.5%, +9.5 points [+4.0, +15.0]\*; final Wow ×1.050 [0.945–1.167]. That fails §8's "greedy wins 40–50%". The proposal expected about +5 and no re-fit, and it was wrong. Split by what happened to each seed's lot:
  - 86 seeds lost their creek and drew a new lot: wins 50% → 60% (+15/−6). On these seeds the creek lots were the harder ones, so fewer creeks alone makes runs easier.
  - 46 kept their creek, with Creekside: 37% → 57% (+10/−1), level with the lots without one (58%).
  - 68 seeds without a creek before or after: 53% → 54% (+1/−0).
- The other criteria: early completion's gap widens to −11.5 points (FAIL, unsure), and the clients' spread is 15.0 points (FAIL, unsure). The rest pass. (\* = the 95% interval excludes no change.)

**Considered:** creeks at 40% with no payoff (less samey, still scenery); a pond on 60% of all lots (one lot in eight with no water, and no change in play); Creekside at +25%, the step down if it's too strong.

**Changes:**
- D-049 (Accepted): its creek and pond lines, marked there. Appendix A's lot bullets in `implementation-plan.md`.
- The targets aren't re-fit here. The playtest-4 plan has one re-fit for all its content changes together, the creek rate among them (findings §12). If playtest 5 comes before that re-fit, Creekside at +25% is the step down. It can only take back part of Creekside's half of the rise; the rarer creek makes the other half.

**2026-11-09 (D-123):** the re-fit is done, with Creekside at +50% and creeks on a quarter of lots: greedy wins 48.0% on `--check`, so Creekside keeps its +50%.

### D-120 · The sun: a sunny face on every lot, and rooms that want it
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`): the sunny side "feels much better than the previous system". Proposed 2026-11-09, after playtest 4 (`docs/playtests/playtest-4-findings.md` §11) and the lot session's proposal (`docs/proposals/lot-creeks-and-sun.md` §4–§7). The user picked the proposal's package; this is its second part, after D-119. Built for playtest 5.
**Decision:**
- **Sun A, the sunny face.** Each lot's sun shines from one edge: the back, the left, the right or the street side, a quarter each, from its own `lot/<attempt>/sun` stream, so the terrain stays as drawn. `Lot.sun` replaces `sunnySide` and `sunnyRows`, and the sunny band goes.
  - A tile is **in the sun** unless it's a Tree, or a Tree, the Old Shed or a building stands one step toward the sun. Off the lot is open.
  - **Buildings** are the rooms, the Hallways and the outbuildings. They cast that one-tile shade, and a building with a tile in the sun is **Sunny**: in practice, one with a wall facing the sun and nothing in front of it.
  - Yard pieces cast no shade and aren't made Sunny by the sun (the Pool keeps its own tag). A garden still counts its tiles in the sun (the Herb Garden).
  - Building changes the sun only next door: a building put in front of a Sunny room's sunny wall takes its sun there, and clearing a Tree gives it back.
- **Payoffs, for rooms:**
  - The Living Room, the Kitchen, the L-Kitchen and the Dining Room earn **+2 every week while Sunny**.
  - The **Sunroom** leaves the special pieces (so the Showroom no longer sells it) for the weekly draw's Rooms row (D-121): weight 5, half a card's, from Foundation. It earns **+6 every week while Sunny** and has no Sunny tag of its own, so it has to be built in the sun. (It was Sunny by its card, +2 a tile on the sunny side.)
- **The other Sunny readers stay:** Count Vladislav's "Sunny pieces earn nothing", Heat wave's "Sunny rooms earn half", Solar Panels, and the Skylight (it grants Sunny). **Blackout Curtains** now also take Sunny off their room: the Count's way to keep a sunny Living Room.
- **Text:** a card's `{is: {tag}}` condition reads "while Sunny" ("+2 every week while Sunny"), and the `sunny` region reads "in the sun" ("+1 per tile in the sun"). A Sunny entry in the glossary gives the rule. Heat wave reads "Sunny rooms earn half".
- **The board:**
  - The sun's side is marked on the edge of the board's view that faces it, a ☀ Sun plaque on a strip of warm light, so it stays in sight however the lot is panned.
  - A sun chip ("Sun at the back") is on the contract's card and beside the crew on the checklist, and the job board's map says it in words ("sun from the left").
  - A soft shade, in two steps, lies on the tile behind each Tree and the Old Shed. The house's own shade isn't drawn.
  - A Sunny room has the sun on its floor along its sunny wall, deeper under its windows. A room with Blackout Curtains isn't Sunny, so it has none.
  - While placing, the ghost says "☀ Sunny" beside its change when the piece would be Sunny there (`Preview.sunny`).
  - Inspect: a Sunny piece's tag says why ("Its back wall faces the sun, with nothing in front"), and a tile says In the sun or In the shade.
  - The band's eight sprites (its grass, tufts, edge, shore, rocks and Time Capsule) leave the atlas: only the sprites we use are committed.
- **The sim:** the cheap estimate reads the sun: a building's own back tiles and the tile behind each one, the Trees a piece clears, and `{is: …}` conditions. A play that moves another piece's sun is flagged (`sunHint`) for exact scoring when a run modifier reads Sunny (the Count, Heat wave, Solar Panels), up to `SUN_HINT_CAP` 8 a week, apart from the other hints.

**Why:** playtest 4: "I rarely use the sunny side, it's usually far from where I build."
- The band paid almost nothing (0.4% of the Wow) and sat far from most houses. Under A every house has a sunny face.
- In the proposal's prototype with these payoffs (200 held-out seeds), the sun was 4.2% of the Wow (5.8% without the Count) and changed the value of 55% of greedy's plays. Greedy built the house as people do: 86% of Living Rooms and 83% of Kitchens Sunny, and Bedrooms where they fell (38%, as with no payoff).
- **This PR's own check,** greedy on 200 held-out seeds (`--check`), paired against develop with D-119 and D-121:
  - Wins 69.5% → 81.5%, +12.0 points [+4.3, +19.7]\* (44 seeds won only with the sun, 20 only without). The proposal expected about +10.
  - Wow ×1.19 [1.15–1.26]\* at milestone 3 and ×1.11 [1.07–1.17]\* at milestone 5, but ×1.03 [0.98–1.08] at the end on the 119 seeds both won: the sun pays most early, where the targets are loosest.
  - By client (40 runs each): the Hendersons 50% → 80%, the Barkers 72.5% → 85%, Dale 75% → 90%, Juniper 70% → 75%, and Count Vladislav 80% → 77.5% (+6/−7). In the proposal's prototype the Count dropped 12 points; this build adds Blackout Curtains taking Sunny away and the estimate's sun hint, which the prototype didn't have.
  - The Sunroom: 0.40 a run (0.04 from the Showroom), 713 Wow a copy. A Living Room earns 3,001 Wow a copy (2,505).
- §8's criteria: greedy's 40–50% wins fails further (81.5%), and greedy clears milestones 1–3 in 100% of runs (FAIL; it was 97.5%). Early completion passes, unsure (always −9.5 points against never). The clients' spread fails, unsure, at 15 points (30 before). The rest pass, and the benchmark gate passes (524 ms).
- (\* = the 95% interval excludes no change.)

**Considered:**
- B, a three-tile shade: about A's numbers for twice the work and the busiest board.
- C, two sunny clearings: the cheap fallback, but the sun did nothing in a quarter of runs.
- +1 while Sunny: the sun at 1.6% of the Wow, too little to steer a house.
- A Breakfast Nook set (a Kitchen and a Dining Room, both Sunny): the sun at 11% of the Wow, swamping everything, and a later room could take a member's sun and break the set, against D-065.
- "Sunny pieces earn half" for the Count: once rooms pay for the sun, it turns the sun into a gain for him.

**Changes:**
- D-049 (Accepted): the sunny side becomes the sun's side. D-099 (Accepted): the band's grass and its edge go. D-051 (Accepted): the Sunroom leaves the special pieces for the draw. Each is marked in place.
- `implementation-plan.md`: §4's Sunny tag, the state, Appendix A's lot and terrain rows, the room rows, the Herb Garden and the Blackout Curtains rows, and §12's terrain and fixture bullets. `content-brainstorm.md`: the sun's row.
- The targets aren't re-fit here: the playtest-4 plan has one re-fit for all its content changes together, as D-119 and D-121 do. The Count's `targetPct` goes into it. If playtest 5 comes first, the game is much easier: on the current targets greedy wins 81.5% with D-119, D-121 and this, against 48.0% before them.
- Solar Panels get stronger with about four Sunny buildings a house, which the sim can't see (its shop bot doesn't value budget). It's a balance-pass item: rooms only, or every 6 weeks.

**2026-11-09 (D-123):** the re-fit is done. Count Vladislav's `targetPct` is 90 (it was 110), and held out he wins 47.3%, level with the other clients. Solar Panels stay as they are: given free at the first shop, they're worth +16.0 points of wins and +13.6 budget a run, against +46.0 points for Good Bones, also Uncommon. Every 6th week would halve that; rooms only would change nothing, since nearly every Sunny piece is a room.

### D-121 · The weekly draw in two rows: Rooms and Layout
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`): the two rows "feel okay". The user asked for one reroll to redraw both rows, which D-132 (Proposed 2026-11-10) changes. Proposed 2026-11-09, after playtest 4 and the draw brainstorm (`docs/proposals/weekly-draw.md`). The user picked Rooms 2 + Layout 2, the proposal's recommendation, with its defaults (§9). Built for playtest 5.
**Decision:**
- **Two rows.** Each week draws a **Rooms** row of 2 distinct cards and a **Layout** row of 2, shown in that order and numbered across both (keys 1–9). You play one card from either row, a reserve piece, or a Renovation, or pass, as before (D-036). The rules `roomsRow` and `layoutRow` replace `handSize`.
- **A card's row is where it's built.**
  - Rooms: the rooms, the special rooms (Playroom, Library, Mudroom, Sunroom) and members' rooms, and the room fixtures.
  - Layout: both Hallways, the Garage, the yard (with the Pool, Hot Tub, and Fire Pit), the outbuildings (with the Henhouse and Birdhouse), and the yard's fixtures (Sprinkler, Pergola, Garden Lights).
  - A piece's or fixture's `row` names it where its category doesn't: the Garage and the three yard fixtures.
- **Weights inside a row are as before:** the card's weight × D-055's ramp × the client's and crew's modifiers, at half weight while a type is at its limit (D-104). The Fence and Driveway packs draw at 10, not 20 (D-106): in a row of their own at 20, each would show in about 23% of weeks.
- **Swaps replace the free redraw.** Whenever a row is drawn (the week's first draw, or a reroll), each card with no play (no legal spot, no host, and no Renovation) is swapped for another card from its row that isn't in the row: the first of up to 3 tries (`swapTries`) that has a play, else the last one tried. The card wears a "Swapped in" chip, with what it replaced in the chip's title, and a note over the board names the cards swapped out.
- **A reroll redraws one row,** the player's pick: each row's label has its own Reroll button, and both show the milestone's one count. The other row stays, and so does a card picked from it. A run code's reroll carries its row; a reroll without one (older codes) redraws both.
- **Goods:**
  - The Bigger Truck adds a Rooms card (Rooms 3 + Layout 2).
  - The Catalog redraws both rows from the special pools, with no swaps.
  - Weekend Crew's next play comes from either row (D-083).
  - The strike floor holds per row: at least 5 Rooms types and 4 Layout types stay drawable (`strikeMinTypes`, D-084).
- **The Landscaper draws a third Layout card** (Rooms 2 + Layout 3) besides its +50% yard earnings. D-109's yard draws crowded out rooms in one pool; in a row of their own they can't.
- **Replays:** each row has its own stream, `draw/<phase>/<slot>/<n>/rooms` and `draw/<phase>/<slot>/<n>/layout`, and a swap draws from `draw/<phase>/<slot>/<n>/<row>/swap<k>` (k: the card's place in its row). Swaps don't count as draws, so drawing one row never shifts the other or a later hand (D-039).
- **The right column** (the proposal's §5):
  - The rows sit under ROOMS and LAYOUT labels. Demolish moves to the hand's plank. In a narrow column, Reroll and Demolish show their icon and count.
  - **Compact cards:** the name, the first effect line (two lines at most), and the chips, beside a thumbnail of the piece. Inspect shows the whole card on hover. A fixture card shows where it goes and its first effect.
  - In a narrow column (1600×900 and below), the thumbnail is half size where the screen has the pixels for it (2×; D-097's whole device pixels), the kind's chip goes (the card's tint says it), and the tags show as icons named in their titles. Under 800 px tall the cards show the shape glyph instead, as before.
  - **Your goods folds** to its plank, with a count of what's in the reserve and the supplies, on a window under 1100 px tall (a 1080p screen's included). Its caret folds or opens it on any window. Weekend Crew's note stays in view, and in the shop it's always open.
- **The sim:** greedy plays from both rows as one hand and rerolls the row whose best play scored lower this week (Rooms on a tie). The offer stats count the cards swapped out as dead offers.
- **The targets aren't re-fit here.** The playtest-4 plan has one re-fit for all its content changes together (findings §12), as D-119 does.

**Why:** playtest 4: hands lacked the rooms the checklist needed, and weak layout cards crowded them out.
- In the proposal's A/B (400 greedy runs on held-out seeds, before D-114 and D-119), when the checklist needed a room the hand held one 52% of the time (27% from phase 3). With two rows of 2: 66% (39%), and the most yard of any split (8.4 layout plays a run, against 10.7 today; Rooms 3 + Layout 2 kept 6.4).
- Rows keep new content on one side from diluting the other. Swaps take the cards with no play from 4.2 a run to 0.3.
- **This PR's own check,** greedy on 200 held-out seeds (`--check`), paired against develop with D-114 and D-119:
  - Wins 57.5% → 69.5%, +12.0 points [+3.6, +20.4]\* (50 seeds won only with the rows, 26 only without).
  - Wow ×1.10 at milestone 3 and ×1.08 at milestone 5; ×1.09 [1.02–1.17]\* at the end on the 89 seeds both won.
  - Rerolls 0.37 → 0.09 a run. Fences placed 1.43 → 0.97 a run, and a fenced yard at the end in 46% of runs (53%).
- §8's criteria: greedy's 40–50% wins fails further (it failed at 57.5% before). Early completion passes, unsure (always −7.5 points against never; it was −11.5). The clients' spread fails, unsure, at 30 points (15 before): the Hendersons 50% (55%), against 70–80% for the rest (40 runs each).
- (\* = the 95% interval excludes no change.)

**Not built from the draft:** the ★ on a room card the checklist needs (it needs a rules helper; a follow-up), and greedy's reroll aimed by the checklist (the simple rule above).

**Considered:** Rooms 3 + Layout 2 (more needed rooms, 72% / 47%, but five cards, a smaller yard at 6.4 layout plays, and a bigger re-fit); Rooms 2 + Layout 1 (today's three cards, with one mostly weak Layout card and the smallest yard); a standing Layout card (it keeps the card no one plays); packs picked after each milestone (parked, as a way to grow each row later); targeted rerolls and swaps on one pool (they fix the dead cards, not the missing rooms); stronger yard numbers (they turn yard picks into traps, the proposal's §6).

**Changes:**
- D-036, D-043, and D-051 (Accepted): the hand is two rows of distinct cards; hand size is two rules.
- D-039 (Accepted): the stream keys.
- D-070 (Accepted): swaps replace the free redraw.
- D-084 (Accepted): the strike floor per row.
- D-106 (Accepted): Fence and Driveway at 10.
- D-098 (Accepted): the hand's layout and Your goods' fold.
- D-109 (Accepted): the Landscaper's third Layout card.
- Each is marked in place. `implementation-plan.md`: the state, the week's start, the stream keys, the rule keys, and Appendix A's rerolls and Bigger Truck.
- The targets wait for the playtest-4 re-fit. If playtest 5 comes first, the game is easier: on the current targets greedy wins 69.5% with this and Creekside, against 48.0% before both (D-119's check).

**2026-11-09 (D-123):** the re-fit is done, for this, D-114, D-119 and D-120 together. Greedy wins 48.0% on `--check` (it was 81.5%), and 44.0% on 2,000 held-out runs across the crews. Of those, the Landscaper with its third Layout card won 36.7%, against 48.5% and 46.6% for the other crews: inside §8's 15 points. Without the third card it won 38.8%, so the card isn't what holds it back.

**2026-11-09 (the hand's fix, before playtest 5):** an audit of 19e0def found the compact cards hid what they pay, and a fourth card under the Pass bar at 1600×900.
- **A compact card shows the line that says what it pays,** not its first (`handCardLines`, text.ts). That's the first line that earns points or budget, past a link ("Links the rooms it touches…"), a placement rule ("Must touch the house…", which the lot shows) or a change ("Becomes a Tree…"). A requirement that isn't about placement follows the pay, since without it the piece earns nothing: the Doghouse's "+1 every week in a fenced yard". A card with no line that pays shows its first. So the Hallways show "+2 per touching room (up to 4)" (D-114), and the Garage "+1 every week". A fixture still shows where it goes and its first effect, which is what it does (Makes it Sunny, Counts as 2 Bedrooms); its "Earns +25%" is in Inspect. `text.test.ts` checks every card's line and every drawable fixture's.
- **Four cards fit above the Pass bar** at 1600×900 and 1440×900, at 1× and 2×, beside Your goods' plank, with Renovate on both rooms and every card swapped in. Before, the fourth card's bottom 62 px (2×) to 126 px (1×) sat under the bar at 1600×900.
  - "Swapped in" is the reroll die as a badge on the card's corner, its words in its title and read out, instead of a chip: beside a narrow card's picture, it wrapped Renovate and the tags onto a second line.
  - Empty rows in a card's grid add no gap, and a narrow card has the padding and bullet of a window under 1500 px wide, so "+2 per touching / room (up to 4)" fits beside a room's thumbnail at 1600×900.
  - In the narrowest column (1440×900), the chips run across the card under the thumbnail.
  - Cards sit 8 px apart, not 12, on a window under 1100 px tall (where Your goods folds), so a plain five-card hand fits at 1080p.
  - At 1× on a window 900 px tall or less, a narrow card shows its shape's glyph instead of the whole picture, as a short window's cards do: there's no half-size thumbnail at 1× (D-097), and the whole picture made each card taller than four could be.
- **Overflow shows:** when the bar hides part of any card's text (1280×720, five cards with chips, or the readable font, whose chips keep their words, at 1600×900 and 2×), the bar gets a shade and an "N more cards" tab that scrolls the column to its end.
- The controls strip says "1–4 pick a card" (the hand's size; keys 1–9 pick), not "1 2 3", and Inspect calls a Hallway a Hallway, as its card does.
- No play changes: the rules' `apply()` and the sim are untouched, and `--check` on D-123's targets gives its numbers (greedy wins 48.0%, clears milestones 1–3 in 97.5%).

**2026-11-10 (D-132, Proposed):** one reroll redraws both rows, with one Reroll on the hand's plank before Demolish; the ROOMS and LAYOUT labels stay, without buttons. A run code's reroll names no row (a code from these builds that names one replays differently from that reroll on), and greedy rerolls the whole hand. Greedy wins 47.5% on `--check`, against 48.0%.

### D-123 · Playtest 5's re-fit: the targets and each client's factor
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`): harder than playtest 4, but "while challenging it still felt possible to complete". Milestone 2 keeps 560 (the user's run made it with 665 of 644), so the 450 step-down isn't needed. Proposed 2026-11-09, before playtest 5. It's the one re-fit that D-114, D-119, D-120 and D-121 left until all of playtest 4's content changes were in (playtest 4's findings §12).
**Decision:**
- **What it covers:** develop at 19e0def: the Hallway pay (D-114), creek lots and Creekside (D-119), the weekly draw in two rows with the Landscaper's third Layout card (D-121), and the sun (D-120). Nothing else that changes play merged after D-120 and D-121 (D-112 and D-113 are text and UI). The layout session's data PR (D-116, D-117), fusion (D-115) and the hand's card-lines fix aren't in; each runs its own `--check` against these targets.
- **Targets:** 20, 560, 1,750, 4,850, 10,200, 18,800, 32,600 Wow (they were 15, 300, 1,100, 3,050, 6,850, 13,150, 24,500). D-085's method: `--suggest-targets` on 2,000 untargeted greedy runs (seeds `sim-*`, the five clients and three crews in turn), checked on 2,000 held-out runs (`check-*`). Held out, greedy won 44.0% against the fit's 46.6%, inside §8's band, so the curve is used as fitted. (M4b's was eased by 4%, when held out came 5 points under.)
- **Each client's `targetPct`:** the Hendersons 115 (it was 125), Count Vladislav 90 (110), the Barkers 90 (80), Juniper 85 (85), Dale 115 (110). These are the fit's factors, used as fitted: held out, the clients are within 6.7 points of each other.
  - The Count's drop is the sun's (D-120). Every house now has rooms that face the sun, where the old sunny band rarely reached a room. His "Sunny pieces earn nothing" takes those rooms' points, while the other clients' sunny Living Rooms and Kitchens earn +2 a week more.
- **The crews' numbers stay.** Held out, the General Contractor won 48.5%, the Architect 46.6% and the Landscaper 36.7% (about 667 runs each). That's 11.8 points: inside §8's 15, but more than noise.
  - On the Landscaper's 665 held-out seeds, yard earnings at +75% won 38.8%, and at +100% 35.5%: greedy builds more yard, and yard pieces don't compound. Without the third Layout card it won 38.8%.
  - No number closes the gap, so it goes to the balance pass with the yard itself: yard pieces that grow with the house (`docs/proposals/weekly-draw.md` §6).
- **Solar Panels stay as they are** (D-120's flag). Given free at the first shop (400 paired held-out seeds, the General Contractor), they're worth +13.6 budget a run and +16.0 points of wins [+11.7, +20.3], Wow ×1.20, even though the shop bot sells them once it wants the slot.
  - Good Bones, also Uncommon, is worth +46.0 points [+41.0, +51.0] and Wow ×2.13 the same way, so Solar Panels aren't out of line.
  - At every 6th week they'd be worth +8.7 budget and +8.3 points. Rooms only changes nothing (+16.0): nearly every Sunny piece is a room. The balance pass can pick either.
- **Milestone 2 binds now.** At 560 (times the client's factor), greedy meets it on time in 80% of runs on `--check`, against 99% on the old targets. The rest take overtime there, and overtime weeks per run go from 0.66 to 1.34.
  - The fit puts it there because the score doubles from week 8 to week 10 (median 728 to 1,451), so 98% of runs reach 560 with both overtime weeks.
  - If playtest 5 finds milestone 2 harsh, 450 is the step down. In the fit's runs it puts greedy on time at milestone 2 in 84% of runs (70% at 560), and the estimated win rate stays at 46.6%.

**Why:** on the old targets, greedy won 81.5% of `--check`'s runs and cleared milestones 1–3 in all of them, against §8's 40–50% and 92–98%. It had won 44.5% before D-114; then 48.0% with D-114, 57.5% with D-119, 69.5% with D-121, and 81.5% with D-120. Playtest 3 found a run with that much slack too easy.

§8's criteria, before (19e0def) and after. The first four columns are `npm run sim -- --check` (200 runs, the General Contractor) and `--check --crew all` (200 runs, each client with every crew in turn). The last column is `--check --crew all` on 2,000 held-out runs.

| Criterion | `--check` before | `--check` after | `--crew all` before | `--crew all` after | 2,000 runs, after |
|---|---|---|---|---|---|
| random loses by milestone 3 (≥ 95%) | 100.0% PASS | 100.0% PASS | 100.0% PASS | 100.0% PASS | 100.0% PASS |
| novice passes milestone 1 (≥ 90%) | 99.0% PASS | 95.5% PASS | 96.5% PASS | 94.0% PASS, unsure | 95.0% PASS |
| greedy clears milestones 1–3 (92–98%) | 100.0% FAIL | 97.5% PASS, unsure | 99.5% FAIL, unsure | 95.0% PASS, unsure | 93.7% PASS |
| greedy wins (40–50%) | 81.5% FAIL | 48.0% PASS, unsure | 79.0% FAIL | 48.5% PASS, unsure | 44.0% [41.8–46.1] PASS |
| early completion: always vs never, within 10 points | −9.5 PASS, unsure | −1.0 PASS | −11.0 FAIL, unsure | −7.0 PASS, unsure | −3.4 [−5.9, −0.9] PASS |
| fences pay: probe p50 2–3, ≥ 50% offered that many | 2, 73.1% PASS, unsure | 2, 72.9% PASS, unsure | 2, 76.6% PASS | 2, 77.2% PASS | 2, 74.7% PASS |
| clients, crews within about 15 points | 15.0 FAIL, unsure | 27.5 FAIL, unsure | 20.0, 20.9 FAIL, unsure | 30.0, 13.8 FAIL, unsure | 6.7, 11.8 PASS, unsure |
| planner wins about 75%; no must-buy | not measured | not measured | not measured | not measured | not measured |

- **The spread at 200 runs is noise.** It has 40 runs a client. Five clients with the same win rate near 45% would read more than 15 points apart 68% of the time at 40 runs each (18 points on average), and about 6 apart at 400 each. The 2,000 runs read 6.7.
  - By client on the 2,000 runs: the Hendersons 40.5%, Count Vladislav 47.3%, the Barkers 42.5%, Juniper 47.3%, Dale 42.3%.
  - On `--check`'s 40 runs each: 50.0%, 62.5%, 35.0%, 37.5% and 55.0%.
- **The run's shape** on `--check`, as the median score of the runs that reached each milestone over its target: ×5.8, ×1.66, ×1.70, ×1.33, ×1.26, ×1.22 and ×1.24, against ×6.2, ×2.49, ×2.17, ×1.62, ×1.35, ×1.19 and ×1.13 before.
  - The slack in the middle of the run is gone. Playtest 4's run led by 2.5× at milestones 2 and 3, and 1.9× at 4.
  - Greedy's runs are lost from milestone 3 on (5, 10, 23, 34 and 32 runs at milestones 3–7), where before most were lost at 6 and 7.
- The benchmark gate passes (606 ms).
- The fit and the 2,000-run checks ran in parallel shards that play each seed exactly as `npm run sim` does. On the same seeds they matched the CLI's 200-run fit and its `--check --crew all` run for run. `npm run sim -- --suggest-targets --runs 2000 --crew all --dry-run` gives these numbers in about an hour.

**Considered:**
- **Easing milestones 4–7 by 4%,** as M4b did: held out came 2.6 points under the fit, not 5, and the General Contractor already sits in the band's upper half (48.0% on `--check`, 47.7% on 1,070 held-out runs).
- **Tightening the curve by 2%** to centre the General Contractor on 45%: about 2 points off every crew, the Landscaper to about 34%. That's not worth chasing at the bot's noise: the layout session found that shifting its random streams alone moves wins 4–9 points.
- **The 200-run fit** (`--suggest-targets --dry-run`, the General Contractor only): 20, 640, 2,000, 5,450, 10,800, 19,800, 34,400, with factors 110, 100, 90, 85 and 120. Held out, greedy won 37.5% on it: 200 runs are too few for the factors and the late targets.
- **Nudging the factors toward the middle,** as M4b did: a step of 5 moves a client 3–10 points, more than any client's gap from the mean (3.5 at most). Fitting them to `--check`'s 40 runs a client would undo the balance on 400.

**Changes:**
- D-085 (Proposed): its targets and factors, noted there. `balance.ts` and `clients.ts`.
- D-114, D-119, D-120 and D-121: each notes that its re-fit is done.
- `implementation-plan.md`: Appendix B's Landscaper row gains D-121's third Layout card, which the table had missed.

### D-124 · The celebration ladder: four tiers, the pile, and the milestone moment
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`): the Good, Great and Huge weeks "all seem good". Proposed 2026-11-09, with the juice pull request (`phase/juice`). It builds §12's celebration ladder, which D-059 approved with the plan; the numbers and the choices below are this pull request's, for the feel playtest.
**Decision:**
- **The tiers,** by the week's total against its pace (the `tally` event's `pace`), sorted by the UI (`fx/ladder.ts`): Normal under 2× pace, Good from 2×, Great from 5×, Huge from 25×, or a Great week that beats the best week this browser has seen.
  - **Good:** the score panel lifts once, sparkles burst round Wow, "Good week!" on paper, a short chime (`tier-good`), and a pile of 3.
  - **Great:** the panel pulses gold twice, "Great week!" on gold, a fountain of confetti and coins from Wow, a warm wash over the screen, `big-week`'s arpeggio as its sting, a 7 px shake, and a pile of 6.
  - **Huge:** three gold pulses, a bigger fountain, the board leaning in to 1.04× and back over 1.6 s (a celebration tween, which CLAUDE.md allows), one soft white flash with Flashing on, the fanfare (`tier-huge`), the week's last trigger in slow motion (2.5× its step), and the pile built into a tower of 12.
  - The week's total holds 250, 700 or 1,500 ms longer for Good, Great and Huge: a closing beat, at the chosen speed (D-096), that a click skips.
- **A tier's first appearance plays in full** (§12): 0.9, 1.8 or 2.8 s of real time that a click doesn't cut short. After that a click skips it like any beat. The browser keeps which tiers it has seen and its best week, per channel, like the saves; they're UI records, not game state.
- **The glow** starts at 1× pace at 0.3 and grows with I = log5(total ÷ pace), fully lit at I = 2 (25× pace). It lights the preview too.
- **The pile:** the week's best earners (ties to the earliest placed) fly from the board into a stack beside the score panel, each as its own picture (PieceArt) in a small framed block, and fade after 1.5 s.
- **The milestone moment:** when a week's count-up crosses the phase's target, its last 30% before the target slows to 0.5× with a drumroll (`drumroll`), and the target's sting and "Target reached!" land as it crosses, not after. The top bar's flag pops and stars burst from it. It stays under 2.4 s, and a click skips it.
  - §12 zooms on "the piece that crosses the line". In our tally the run total only moves in the count-up, after the multiply moment, so no piece crosses it; the flag takes the zoom's place.
- **For M5b:** the music swell, ducking under the jingles, and the soft pad are the sound pass's. The `celebration` signal carries the tier for them.

**Why:** §12 and D-059: big moments should escalate the way Vampire Survivors' chests do, and everything else should stay calm. The thresholds are §12's.
**Considered:**
- **Huge's best-week clause** makes most Great weeks in a browser's first run Huge: totals grow through a run, so a Great week late in a run is nearly always the best yet. It's §12's rule as written. If the playtest finds Huge too common, drop the clause, or count the best only from earlier runs.
- **A pile every week, Normal included** (§12 says bigger weeks stack higher): it would put 20 flying sprites in every week, so it starts at Good.

**Changes:** `implementation-plan.md` §12, The celebration ladder (the milestone moment's flag). In `feel.ts`, M1's `bigWeekPace`, `glowPace`, `celebration` and `tally.bigHoldScale` are gone; `ladder`, `glow`, `pile` and `milestoneMoment` replace them. D-059 (Accepted) still holds.

### D-125 · The reward moments, particles, and Flashing
**Status:** Accepted · 2026-11-10, played in playtest 5 with no issues raised (`docs/playtests/playtest-5-findings.md`); the user liked the tally. Proposed 2026-11-09, with the juice pull request. §7's distinct moments and M4's (`house-systems-review.md` §6), within D-059.
**Decision:**
- **Particles:** one canvas over the page, under the first-time hints and the modals, drawing bursts in whole UI pixels. The presets are in `feel.ts` (`particles.bursts`); their colors are tokens, and the coins, stars and hearts are the interface's own icons. None play with Reduce motion. At most 700 are in flight, and no burst outlives about 2.5 s.
- **The moments,** each with a sound id of its own (a ZzFX placeholder for M5b to replace):
  - **A set completing** for the first time: "*Set* complete!", a 1.5× beat, a chord (`set-complete`), a ring of Charm-colored bits, and a bigger shake.
  - **A Rhythm payout** (the Pool's every third week): "Every 3rd week!" over the piece, a 1.6× step, a double knock (`rhythm`), and two rings spreading from it. The UI reads it from the piece's breakdown line, which a test pins.
  - **A find:** dirt flies from its cell, then coins (budget) or glints (a tool), with a scoop and a ta-da (`find`).
  - **Opening a crate:** the crate glows in its best option's rarity and shakes for 0.52 s, then bursts open with glints in that color, a creak and a pop (`crate-open`), and the options turn over after it.
  - **A Rare in the shop:** its own bell (`rare`, where the sparkle played) and glints from its card as the sheet lands.
  - **A client's wish met:** "★ *name*!", Charm's hearts rising from its checklist row, and a warm chime (`wish-met`).
  - **A house rule met:** "✓ *name*" in blue (a new popup kind), sparkles from its row, and a crisp check (`rule-met`). One lost: its ✕, dust from its row, and a bonk (`rule-lost`). A wish lost keeps M4's.
  - **A Renovation's level-up:** stars from the room as its badge pops, three notes up (`level-up`), and a bigger shake.
  - **A change order's stamp:** a rubber-stamp thunk (`order-stamp`) and ink spattering where it lands.
- **Flashing** (Settings, under Motion): on by default and saved. Off, the score panel's gold pulses become a lift and a Huge week's white flash is dropped; the warm wash stays, as a tint that fades. With it on, nothing flashes more than 3 times a second.
- **Reduce motion** also stops the pile's flight, the Huge week's lean-in, the crate's shake and every particle. Its note in Settings says so.

**Why:** §7 asks for each of these moments to read as its own, and playtest 4 found M4's moments forgettable (its §4). Restraint (Kao, 2020): the per-trigger beats keep their 2 px shake, and the bursts go to moments that happen a few times a run.
**Changes:** `implementation-plan.md` §12, Settings and accessibility (what Flashing turns off).

### D-126 · An arrival as a doorbell, the arrivals' marker, and the car that drives up
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`): the doorbell and the arrivals are "nice". Proposed 2026-11-09, with the juice pull request: playtest 4's asks (its §4 and §15 item 5).
**Decision:**
- **The doorbell:** a household member's arrival rings the front door: "Ding-dong!" on a plank at the house's front doormat (the house's south edge before there's a front door), two rings spreading from it, and a two-tone bell of its own (`doorbell`).
- **Their card** slides in at the board's right edge, by the reserve their cards go to: the "Ding-dong!" plank rocking as the bell rings, their room's picture (the first card they bring), who's arrived, and what's waiting. It stays 3.4 s, and a click dismisses it. The first-time hints wait for it.
  - It replaces the arrival's banner, which was the milestone's banner in a tan plank, so nothing about an arrival reads as a milestone. The banner's `note` tone is gone.
- **The arrivals' marker on the progress bar:** the House after the meter's flag when someone moves in as this milestone is met; its tooltip says who, and the week. The meter is the phase's, so the whole schedule stays in the checklist's lines.
- **The car** parks on the Driveway nearest the front door or a Garage that has room for it (by the distance from its tiles), so a drive extended toward the house gets it. Ties, and a house with neither, go to the oldest Driveway, as before. When a play moves it, its body and roof slide there together in 0.9 s; a new run or a load never slides.

**Why:** the user asked for the doorbell and an arrival that doesn't read as a milestone. On the car the user said either way was fine; driving up makes a longer drive visible.
**Changes:** D-103 (Accepted): its banner. `implementation-plan.md` §12 has no rule on either.

### D-127 · The roof reveal at Roofing, and "Topped out!"
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`), but the reveal is brief and lands at the end of a week, so it's easy to miss. The user asked for a way to bring the roof back after Roofing, which D-133 (Proposed) adds: since 2026-11-10 the reveal's roof stays on until the player's next move instead of lifting after 1.8 s, a Roof button (T) puts it back on, and the end screen opens with it on. Proposed 2026-11-09, with the juice pull request. §12's roof reveal, and the review's "Topped out!" (`house-systems-review.md` §6).
**Decision:**
- **The roof** is painted from the house model in LimeZu's palette, by fixed rules: a terracotta gable over each column of rooms (the south slope lit, the north in shade, a ridge cap between them), shingles offset like bricks, a fascia along the south eaves, eaves 3 art px past the walls, an ink outline, and a brick chimney on the first room. An L or a T gets a ridge per wing. It's a canvas in the board's `roof` layer, which D-097 reserved.
- **At the Roofing milestone,** when it's met (on time, early or in overtime), the roof drops onto the house in 0.42 s, holds 1.8 s under the milestone's banner, and lifts off in 0.56 s, with a thump and a bell (`roof-on`). The tiles' digits and badges fade out while it's on. Reduce motion fades it in and out. A missed milestone gets no roof.
- **"Topped out!":** the first week Under one roof holds in a run, a wood plaque with the flag rises over the top of the house for 1.7 s, with stars and a cheer (`topped-out`). The rules keep no history of the checklist, so the browser remembers the runs that have topped out (by seed, client and crew, the last 30), and a replay of the same run doesn't show it again.
- The end screen's photo of the house at each milestone stays M6's.

**Why:** §12's roof reveal, and the review's idea from its parked construction stages: a stamp when the roof goes on.
**Changes:** none to settled decisions.

### D-128 · The music: three calm tracks, picked by ear
**Status:** Accepted · 2026-11-10, held up in playtest 5 (`docs/playtests/playtest-5-findings.md`): the music "is good", but three tracks "start to loop pretty noticeably" over a run, so D-134 (Proposed) adds about three more. Proposed 2026-11-10, with M5b (D-058; `implementation-plan.md` §12, Music). The user picked the three by ear from a shortlist of six; playtest 5b hears them over a whole run.
**Decision:**
- **Three tracks, shuffled (D-131), about eight minutes before one repeats:**
  - "Morning" by Kevin MacLeod (incompetech, 2023, CC BY 4.0): nylon guitar, harp and flute, no drums; 60 BPM, 2:28, E major.
  - "Sleepy Little Mouse" by Tsorthan Grove (OpenGameArt, CC BY 4.0): lo-fi electric piano and pad over a soft backbeat; 70 BPM, 2:54, C major. It comes as a mix with drums and the same mix without them, in time with each other, so it plays as two stems: the drums play while you build, at a milestone, and on a win; the title, the job board, the shop, a crate, and a loss drop them.
  - "Clear Air" by Kevin MacLeod (incompetech, CC BY 4.0): steel and nylon guitars, with a soft low piano in its second half; 68 BPM, 3:04. It leans G minor, so its key is B♭ major, which shares its notes.
- **A track's key is where its rewards play** (D-129). Each key was estimated from the recording (a pitch-class profile with the overtones removed, then Krumhansl–Schmuckler and a check of the thirds). A track that leans minor gets its relative major, so the jingles stay bright and every note of the ladder is still in the track.
- **Licenses were read on each track's own page.** CC BY's credit, with our changes (trimmed, levelled, re-encoded), is in `CREDITS.md` and How to play's Credits.
- **The shortlist** came from two research passes, one over game-asset sources (Tallbeard/Abstraction, Ninja Adventure, YannZ, Kenney, OpenGameArt, itch.io) and one over music libraries (Free Music Archive, incompetech, Freesound, ccMixter). The listening page also had "Folded" by Ketsa (CC BY 4.0; busier lo-fi), "On the road, looking at your feet" by Monplaisir (CC0; solo ukulele) and "Comfort Games 5" by HoliznaCC0 (CC0; a music box).

**Why:** §12 asks for 2–3 calm tracks of 2–3 minutes, around 70–90 BPM, sparse and plucked; a single short loop is Combolands' most common audio complaint. Guitar, harp and electric piano leave the mallets' register to the reward sounds.
**Considered:**
- Abstraction's "Interior Birdecorator" (CC0, four arrangements in sync) and the KitFit soundtrack (CC BY 4.0): each was written for another game, so we stayed clear of §12's "anything taken from another game", though their composers released them.
- Kevin MacLeod's "Cherry Blossom": marimba at 100 BPM, on top of the Comfort plink.
- YannZ's Contemplative Fantasy (loops in layers): its pages disagree about the license.
- Ninja Adventure (CC0): chiptune leads and short loops.

**Changes:** D-131: the one pick with stems mixes them by screen.
**2026-11-10 (D-134, Proposed):** after playtest 5, the shortlist's other three join these: "Folded", "On the road, looking at your feet" and "Comfort Games 5". Six tracks play about 16 minutes before one repeats.

### D-129 · The recorded sound set, in the music's key
**Status:** Accepted · 2026-11-10, played in playtest 5 with no issues raised (`docs/playtests/playtest-5-findings.md`). Proposed 2026-11-09, with M5b (D-058's reward sounds; `implementation-plan.md` §12, Sound). For playtest 5b's ears.
**Decision:**
- **Real instruments replace the ZzFX blips** where a recording fits (`src/ui/audio/kit.ts`), all CC0:
  - Comfort (Points): a marimba's soft wooden plink. Charm (+Mult): a warm hand chime on the key's fifth. Sparkle (×Mult): a tubular bell on the tonic over a low gong, about 3 dB under the chime. The bell and the gong play for ×Mult and nothing else (`kit.test.ts`).
  - Placing a room: a slit drum's thock, from 4 takes. A yard piece: a cloth's fwp, from 4 takes.
  - The jingles (a big week, a milestone met or missed, the target reached), the multiply moment, and a purchase: short phrases on marimba, vibraphone, glockenspiel and the chimes. The coin count: clay chips. Clicks and the "can't place" bonk: Kenney's Interface Sounds. The sparkle: a mark tree's run.
  - Sources: the VCSL sample library (Versilian Studios) and Kenney's RPG Audio, Casino Audio and Interface Sounds, through their OpenGameArt pages (kenney.nl turns scripts away). 46 short files, 1.2 MB in both formats.
- **Everything pitched is in the playing track's key.** A note is a step of the key's scale on an instrument's own register; the ladder climbs the key's pentatonic scale from its tonic each week (two octaves, then it holds and adds the sparkle). A caller's `rate` on a pitched sound moves each note to the nearest note of that pentatonic scale, so the director's pitch nudges (a chime at 1.1×, a shop row's rising plinks) stay in key. Unpitched sounds keep the random ±0.05 rate; every sound keeps ±1.5 dB (§12, Variation). Each instrument has 4–7 samples, so no note is shifted more than half an octave in any key (`kit.test.ts`).
- **Round-robin:** a set plays its takes in a shuffled order, never the same take twice in a row.
- **A small room:** the instruments and the mark tree (not the foley or the clicks) also go through a 1.3 s synthetic room at −16 dB, so the close-miked samples sit in the same space as the music.
- **Placeholders stay:** a sound with no recipe (Rotate's swish), or whose files haven't decoded yet, plays its ZzFX placeholder. A new moment can start with a placeholder and get a recipe later.
- **Levels** match the placeholders' within about 3 dB (peak and early RMS), so playtests 1–5's balance carries over: the user's ears tune them from there.

**Why:** D-058 asked for a timbre per score layer, a ladder in the music's key, and round-robin variants; recorded mallets also sit with calm acoustic music where synth blips don't.
**Considered:** Kenney's jingles (fixed keys, so they'd clash with the music); Freesound (originals need a login, and its licenses vary file by file); a sprite sheet of all the sounds in one file (AAC's priming offsets would shift every cut in Chrome).
**Changes:** none to settled decisions. `implementation-plan.md` §12 Sound: the ×Mult bell's register.
**2026-11-10 (the juice PR's moments, D-124 to D-126):** at the user's ask, this branch merged #27 before it merged, so one playtest hears both. Its 16 new moments get recipes after its placeholders' shapes: the Good and Huge weeks' jingles on chimes, marimba and vibraphone (ducking the music like Great's `big-week`), a set completing, the Rhythm payout's two knocks, a find, a crate opening (Kenney's wooden creak and a pop), a Rare on the shelf, a wish or a house rule met (chimes, a glockenspiel check) or a rule lost (a low knock and a falling third), a Renovation's level-up, the doorbell (a hand chime's falling third), a change order's stamp (Kenney's book thump), "Topped out!" and the roof going on. The drumroll keeps its ZzFX roll; no recording here rolls. The hand chimes' samples stop at G♯6, so a chime plays no higher than the key's fifth and the glockenspiel takes the octave. 51 files now.

### D-130 · Audio files: the cut, the formats, and loading after the title
**Status:** Accepted · 2026-11-10, played on /dev/ in playtest 5 with no issues raised (`docs/playtests/playtest-5-findings.md`). Right after the deploy, Pages answered one file (chip-3) with a 503; the loader fetched it again on the first click, and it decoded. Proposed 2026-11-09, with M5b (`implementation-plan.md` §12, Files and Audio sources and licenses).
**Decision:**
- **`npm run audio:cut`** (`scripts/cut-audio.ts`) works like `art:cut` (D-097): `art/audio.json` names each source (a folder or zip in the gitignored `art-source/audio/`, with its page, author and license) and each cut (a file in it, where to start, how long, the fade, a low-pass, mono or stereo, and a peak or, for music, a loudness). It writes `assets/audio/<cut>.ogg` and `.m4a`, `assets/audio/index.json` (each cut's length and hash), and the `audio/` records in `assets/licenses.json`. Unchanged cuts aren't encoded again; cuts no longer listed are removed. It runs locally on macOS (Homebrew's `vorbis-tools` and the system's `afconvert`); CI checks the committed files against the manifest (`cut-audio.test.ts`).
- **Formats:** Ogg Vorbis (quality 3 for sounds, 4 for music) where `canPlayType` says the browser plays it, AAC in M4A otherwise (Safari before 18.4). An Ogg file that won't decode is fetched again as M4A, and the rest follow it. Sounds are mono, music stereo. Music is cut to −16 LUFS (BS.1770) with peaks under −1 dBFS; sounds to a −1 dBFS peak.
- **Loading:** the files load 0.6 s after the first screen is up (the title, usually), and decode on the first click, when the AudioContext starts. Music loads one track at a time: the next track's bytes while one plays, decoded when it's due, so at most two tracks are in memory. With the music volume at 0, no music loads.

**Why:** the art pipeline's approach keeps paid or bulky sources out of the repo and every committed file traceable to its source and license. Loading after the title keeps the first screen quick.
**Changes:** none to settled decisions.

### D-131 · The music bus: screen mixes, ducking, the losing glide, and the volumes
**Status:** Accepted · 2026-11-10, played in playtest 5 with no issues raised (`docs/playtests/playtest-5-findings.md`). Proposed 2026-11-09, with M5b (`implementation-plan.md` §12, Music, Ducking and Losing).
**Decision:**
- **A shuffled playlist:** every track once before any repeats, never the last one first, with a 2.5 s rest between tracks and a 2.5 s fade in for the first. Tracks play through rather than loop, so there are no loop points to trim (§12, Files).
- **Each screen has its mix** (`tracks.ts`), crossfaded with a 0.3 s time constant, so a screen change never restarts the music: the title, the job board, the build screen, the shop, an open crate, a milestone's review, and a run won or lost. A track with stems also mixes them per screen (D-128's Sleepy Little Mouse drops its drums off the build screen, a milestone and a win), and every track changes through the bus's low-pass and level: plain while you build, a room away in the shop (3 kHz, −1.4 dB), hushed while a crate opens (1.3 kHz, −3.7 dB). The screen follows what the player sees: the rules are already in the shop while a milestone's tally and beats play, and that's "review" (`scene.ts`).
- **Ducking:** a jingle (a recipe marked `duck`, D-129) takes the music down 10 dB over 50 ms, holds it while the jingle rings, and lets it back up over 1 s. `audio.duck(seconds)` does the same for a moment without a recipe.
- **Losing:** when the run is lost and its end screen shows, the music glides down to 0.6× speed over a second (tape-slow, its pitch with it), and stays there. A new run glides it back over 1.5 s.
- **Volumes:** master, music and sound effects, saved with the other settings (default 70, 70 and 80). The music bus sits 6 dB under the sound effects' (`MUSIC_TRIM`), so −16 LUFS tracks play 8–10 dB under the sounds' peaks (§12, Mix). A music volume of 0 fades the track out and stops loading music.

**Why:** §12 and D-058: calm music that never restarts between screens, rewards given room by ducking, and a loss that sags instead of cutting out (Balatro).
**Considered:** `<audio>` elements for the music (they stream with less memory, but can't keep stems in sync or glide the speed smoothly); loops trimmed past the encoders' padding (a playlist of whole tracks needs none); fading the music out when the tab is hidden (players often keep calm music on in the background).
**Changes:** none to settled decisions. `implementation-plan.md` §12 Music: the screen-mix fallback for tracks without stems, and the playlist instead of loop points.

---

## Proposed

*Reserved numbers (2026-11-10): D-115 to D-118 are the layout session's drafts and D-122 the legibility session's; they aren't in this file yet. D-132 to D-134 are playtest 5's fixes, each logged by its own pull request: D-132 one reroll for both rows of the draw, D-133 the roof view, D-134 three more tracks. D-135 and D-136 are M6's end screen (D-135 the result line and link preview, D-136 the milestone photos); D-137 and D-138 belong to the release-day sessions. New entries start at D-139.*

### D-135 · Sharing a run: the result line, its link, and the link preview
**Status:** Proposed · 2026-11-10, with its fix pull request (`fix/share-result`), the first half of M6's end screen (implementation-plan.md §7 M6). For the group on release day.
**Decision:**
- **Copy result,** on the end screen above Copy run code, copies one line for the group chat: `Open House · The Hendersons · General Contractor — Charmer: 50,129 Wow, 7/7 milestones (1 early). Play this lot: https://swalliso.github.io/house-game/?seed=drf4yj&client=hendersons&crew=generalContractor`.
  - Its parts: the client and crew by their names, the verdict, the final Wow, the milestones met (overtime counts as met) and how many were early (left out when none were). A lost run adds "the client walked at Roofing"; a debug run adds "cheats used".
  - It's `resultLine(state)` in `src/ui/screens/result-line.ts`, pure apart from reading the channel: the rules say every number, it only words them (`result-line.test.ts`).
  - It goes through `copyText` like the run code: a toast says "Result copied", and where the clipboard is refused (itch.io's iframe) the copy fallback shows the line to copy by hand.
- **The link starts the same lot:** the run's seed, client and crew, through `loadInitialRun`'s `?seed=&client=&crew=`. That's the run's whole setup, so the lot, the draws and the shop are the same as long as the plays are; the friend plays their own run on it. The test opens the link through `loadInitialRun` itself and gets `rules.newRun(setup)` exactly.
  - **It points at Pages by the build's channel,** never at the page it was copied from: a release links to `https://swalliso.github.io/house-game/`, develop to `/dev/`, a local build to its own address. A run played in itch.io's iframe still links to Pages.
  - **A friend's run in progress is put aside, not lost** (the link's old behavior, unchanged): the link's run takes the save, the old run's code stays in the browser (`openhouse:<channel>:previous`), and the note says "Your run in progress was put aside." with "Copy the old run code". A save with no weeks played is replaced without a note. Saves are per channel, so a release link never touches a develop run.
- **The Auto switch hides on the end screen** (won or lost), where it was greyed out: there's no milestone left to complete.
- **The link preview,** for the group chat: `og:title`, `og:description` (the title screen's pitch), `og:image` with its size and alt text, and `twitter:card` (`summary_large_image`) in `index.html`.
  - **`public/og.png`** (1200×630): a finished run's house with its roof on, on its lot by the street, at two screen pixels per art pixel, under a wood sign in the game's style: "Open House" and "It's a house." It's captured from the game (seed og4, the greedy bot's win for Count Vladislav).
  - **Scrapers need absolute URLs,** so `vite.config.ts` fills in `%SHARE_BASE%`: develop's build points at `/dev/og.png`, which exists as soon as develop deploys; a release and a local build point at the root.
  - **`public/favicon.png`:** a 16×16 house in LimeZu's palette at 2×, for the tab. Both are recorded in `assets/licenses.json` and `CREDITS.md`, and the licenses test now checks `public/` too.

**Why:** M6's plan asks for "a copyable result line (with a fallback for itch.io's iframe)", and the game goes to the group on 2026-11-11. A line with a link to the same lot lets a friend try to beat a score on equal terms, and the preview makes the link worth clicking.
**Considered:**
- Linking the run code (`?run=`): it replays the sharer's whole house and lands on their end screen, which spoils the lot. The setup is enough to play it.
- The page's own address for every build: an itch.io iframe's address isn't a page a friend can open.
- `og:image` pointing at the release for every build: a develop link would show no picture until the next release.
- `navigator.share`: on desktop it opens the OS share sheet in only some browsers; the clipboard works everywhere the game runs.

**Changes:** implementation-plan.md §7 M6's end screen: the result line is done (D-135); the photos are D-136's.

### D-136 · The end screen's photos: a polaroid of the house at each milestone
**Status:** Proposed · 2026-11-10, with M6's phase pull request (`phase/m6-end-photos`), the second half of M6's end screen (implementation-plan.md §7 M6). For the user's playtest before it merges. An exception to D-097 (its dated note).
**Decision:**
- **A strip of polaroids along the foot of the board** on the end screen, under the roofed house, which stays the hero. There's one polaroid for each milestone that resolved: early, on time, in overtime, or the one the client walked at. A won run has seven; a lost one has one for each milestone up to and including the missed one.
  - Each polaroid shows its photo, the milestone's name, its mark (✓ or ✗, with early's flag or overtime's clock) and its Wow against the target.
  - The board gives up the strip's height, so the camera fits the house above it. The camera's buttons move up with it.
- **The photos come from the run itself.** `milestoneShots` (`src/ui/screens/photos.ts`, tested in Node) replays the setup and actions with `newRun` and `apply`, as a run code does. It keeps the state each time `state.milestones` grows. It's memoized per run, about 26 ms in the browser, and it stops quietly at an action that no longer applies.
- **One frame for every photo** (`photoFrame`): the finished house's rooms (or every piece, for a yard with no rooms), a cell around them, grown to 4:3 about their middle and kept on the board. The house grows in place from one photo to the next, like a time-lapse.
  - A house whose rooms run down 18 rows or more is taller than a 4:3 frame the board's width can hold, so it loses its top and bottom edges.
- **Painted with the board's own painters,** in the board's order (`photo-paint.ts`): the terrain (`TerrainLayer`'s `draw`, now exported), the water's first frame, the floors and the yard's ground, each piece's items with south in front, the walls, the tall items' tops, and the trees' crowns.
  - The photos look inside, without the roof, since the hero above has it on. They have no digits, badges or tint.
  - It never mounts the board's components, so the live board's caches and its car's slide (`HouseLayers`' module-level `lastCar`) are untouched.
  - The photos are painted one per frame once the end screen is up (about 0.1 s for seven) and shown as images.
- **The deal** (`FEEL.photos`):
  - The polaroids come up onto the table 650 ms after the end screen, once the roof has landed, 140 ms apart. Each flies 48 px up in 420 ms, turning from 9°, and lands square with a soft flick (`place-yard`, a little higher each time).
  - Each picture develops from a warm blank over 1.1 s once it's painted.
  - A run's strip is dealt once: back from the title, it's simply there. Reduce motion puts them down at once, developed, without the flicks.
  - At rest they lie square: tilted, the pixel captions would blur.
- **Sizes:** the photos share the board's width, seven side by side, from 140 px wide (the narrowest that holds "Final Walk-" on a line) to 176 px. The long names break at soft hyphens.
  - At 1920×1080 all seven fit side by side.
  - In a narrower window they overlap like a hand of cards, the last one whole. The one pointed at or focused comes to the front and rises 6 px.
- **The photos are a downscale exception to D-097,** like the Fit overview: the strip shows them smaller than one device pixel per art pixel, smoothly.
- **Click one** (or Tab to it and press Enter) to see it larger. A sheet shows the photo, with its mark, how it went, its Wow against the target and its week.
  - The photo is drawn at whole device pixels per art pixel where the window holds one (1× for a typical house at 1920×1080), else smoothly smaller.
  - ← and → (or Previous and Next) step through the strip, and Esc closes it (`modals.ts` `photoShown`).

**Why:** M6's plan asks for "a photo of the house at each milestone" on the end screen. The rooms that change as they're built and furnished were what playtest 5a liked best, and the roof hides them at the end. A strip of the house growing tells the run's story at a glance, under the finished house.
**Considered:**
- The roof on from Roofing: half the photos would be the same red roof.
- Framing each photo on its own house: the house would jump around instead of growing.
- Tilted polaroids at rest: the pixel captions blur.
- A strip that scrolls sideways: at 1280×720 it would hide the last milestones.
- A grid in the right-hand column: too narrow for seven.
- Captions under the type scale's 16 px floor.
- Rendering a second set of the board's components: twice the DOM, and the car's slide is shared state.

**Changes:** D-097 (Accepted): the photos are a second downscale exception (its dated note). implementation-plan.md §7 M6's end screen.

### D-133 · The roof view: the reveal's roof stays on, a Roof button brings it back, and the end screen opens with it
**Status:** Proposed · 2026-11-10, after playtest 5 (`docs/playtests/playtest-5-findings.md`), with its fix pull request. Extends D-127. For the next playtest on /dev/.
**Decision:**
- **The reveal's roof stays on.** At the Roofing milestone the roof drops on as before (0.42 s, with `roof-on`), and stays on until the player's next move on the lot, instead of lifting after 1.8 s. The change order and the shop that follow the milestone cover the lot but leave the roof on, so the lot comes back with it on.
- **The Roof button,** after the camera's: − Fit + Roof, once the Roofing milestone is met (a missed one leaves no roof). It's lit while the roof is on. Its key is T, which was free (R rotates, D demolishes, F fits).
  - It puts the roof on only while nothing is being built or tallied and no sheet covers the lot, and is greyed out otherwise. It takes the roof off whenever the lot is in view. Putting it on lets go of a room held in Inspect, which it would cover.
- **What takes it off,** so it never covers a play: picking any card or supply (placing, a Renovation, installing, a tool), demolishing, holding a room in Inspect, and ending the week (a pass, or completing a milestone early). Holding a yard piece leaves it on. It's off while you build: putting a card back doesn't bring it back.
- **While it's on,** the roof covers the house as in the reveal, and the rooms' digits and badges fade out with it; the yard's stay. It drops in 0.42 s and lifts in 0.56 s (`FEEL.roof`). The button's drop thumps like the reveal, without its bell or the music's duck. Reduce motion fades it in and out where it stands.
- **The end screen opens with the roof on** if Roofing put one on: every won run, and a run lost after Roofing. It drops on as the end screen comes up, and Roof or T looks inside. A finished run loaded from the save opens the same way. M6's photo of each milestone stays M6's.
- **The keys:** once Roofing is met, the build strip's "Scroll zoom" gives its place to "T roof", which is narrower, so the strip still fits its one line at 1280×720. The end screen's strip, and a hidden shop's, say "T look inside" or "T put the roof on". How to play lists T.
- **A one-time hint** (D-045's first-time hints): "The roof's on" comes the first time the lot is in view after Roofing, while the reveal's roof is still on, and says that picking a card takes it off and that Roof or T puts it back.

**Why:** in playtest 5 the reveal held up, but it "was only briefly visible and kind of happened at the end of a week and was easy to miss", and the end screen showed the house without its roof. They asked for "some sort of button after the roofing phase", and left the design open.
**Considered:**
- V for the key, also free. T sits by R and F, the keys for placing and the camera.
- Hiding the yard's digits too: the roof covers only the rooms, and the yard's labels stay readable beside it.
- Bringing the roof back when a card is put back: the lot would change under the player's hand. Building turns it off until it's asked for.
- Taking it off for the shop's buys and the change order's answer: they don't touch the lot, and the roof would lift under the sheet, unseen.
- Showing the hint when the roof first lifts: it would come mid-play. It comes while the roof is still on.

**Changes:** D-127 (Accepted): the reveal's roof holds until the player's next move instead of 1.8 s (its dated note). `implementation-plan.md` §7 M5a's juice and §12's roof reveal.

### D-134 · Three more tracks, from the same shortlist
**Status:** Proposed · 2026-11-10, after playtest 5 (`docs/playtests/playtest-5-findings.md`), with its fix pull request. Extends D-128. For the user's ears on /dev/.
**Decision:**
- **The shortlist's other three join D-128's,** so a run shuffles six tracks (D-131) and plays about 16 minutes before one repeats, where three played about eight. The user heard all six on M5b's listening page and turned none down, so these come in without another listening round:
  - "Folded" by Ketsa (Free Music Archive, CC BY 4.0): busier lo-fi downtempo; 78 BPM, 3:12, A major.
  - "On the road, looking at your feet" by Monplaisir (Free Music Archive, CC0): solo ukulele; 68 BPM, 1:58, G major.
  - "Comfort Games 5" by HoliznaCC0 (Free Music Archive, CC0): a music box; 70 BPM, 2:21, C major.
- **Cut and keyed like D-128's three:** Ogg and M4A at −16 LUFS (D-130), each key estimated from the recording the same way, so the rewards play in it (D-129). Each comes as one mix, so the bus's filter and level change it by screen (D-131). `music.test.ts` shuffles the six for 200 rounds: every track once a round, never the last one first.
- **Licenses were read again on each track's page.** The credits, with our changes, are in `CREDITS.md`, `assets/licenses.json` and How to play's Credits. CC0 asks for no credit; we give it anyway.
- **A limiter for loud plucks:** On the road's ukulele plucks peak far over the rest of it, so the −1 dBFS peak cap held it at −20 LUFS. A cut in `art/audio.json` can now take `limit`: it reaches its loudness through a look-ahead limiter (2 ms ahead, 80 ms release) that holds the peaks under −1 dBFS and leaves the rest alone (`cut-audio.test.ts`). On the road lands at −16 LUFS.
- **Size:** the three add 13.3 MB to the Pages build (6.1 MB of Ogg and 7.1 MB of M4A), so music is 33.5 MB of its 34 MB. A player still loads one format, about 2 MB a track, one track ahead (D-130).

**Why:** in playtest 5 the music "is good", but three tracks "start to loop pretty noticeably" over a run. The user had picked D-128's three from this shortlist by ear, and asked for "maybe an additional 3".
**Considered:**
- A new search for tracks: these three were already found, checked and heard.
- `limit` for Clear Air (−17.7 LUFS) and Sleepy Little Mouse's mix with drums (−16.8 LUFS), whose peaks also hold them under −16: the user called the music good as it is, so their levels wait for the user's ears.

**Changes:** D-128 (Accepted): six tracks, not three (its dated note). D-130 (Accepted): a cut can take `limit`. `implementation-plan.md` §7 M5b and §12 Music: six tracks, about 16 minutes.

### D-132 · One reroll redraws both rows of the draw
**Status:** Proposed · 2026-11-10, after playtest 5, at the user's ask (`docs/playtests/playtest-5-findings.md`). Changes D-121. The targets aren't re-fit here: the balance pass's one re-fit comes after it, on the last day.
**Decision:**
- **A reroll redraws both rows,** Rooms and Layout, for one reroll: the milestone's own first, then a kept one, as before. Each row draws on its own stream, `draw/<phase>/<slot>/<n>/<row>`, as a week's first draw does, then each card with no play is swapped as D-121 says. A card picked from the old hand goes with it, and the week goes on.
- **One Reroll,** on the hand's plank before Demolish, with the milestone's count. Its title says "New cards for both rows" and that it doesn't end the week, and it's read out as "Reroll: new cards for both rows, N left". The ROOMS and LAYOUT labels stay, without buttons.
- **The plank** holds the title, Reroll and Demolish. As in D-121's narrow column, the buttons show their icon and count where their words don't fit (their titles name them), and while demolishing, Stop keeps its word. On a narrow plank (in the pixel font, at 1600×900 and smaller windows) the title is "Cards", not "Pick a card", so both buttons fit beside it.
- **How to play** says "New cards for both rows" for Reroll, with the milestone's count. R rotates, as before, so the controls strip doesn't change: there's no reroll key.
- **Run codes:** a reroll names no row. A code from D-121's builds whose reroll names one still parses, but the row is dropped, so from that reroll on the code replays differently than it played. Its build stamp names the commit that replays it.
- **The sim:** greedy rerolls when no play would raise the week's total, as before, and no longer picks a row.

**Why:** in playtest 5 the user said "two rows of the draw feel okay, but I think a reroll should reroll both sections of the draw instead of just one." In their run (seed drf4yj, the Hendersons with the General Contractor, won with 50,129 against 37,490) they rerolled 10 times, 8 Rooms and 2 Layout, and twice spent two rerolls in a row, Rooms then Layout, to redraw the whole hand.
- **This PR's check,** greedy on 200 held-out seeds (`--check`), paired against develop (56e1e02):
  - Wins 48.0% → 47.5%, −0.5 points [−1.5, +0.5] (1 seed won only before, none only with this). Greedy early always wins 47.0% both ways.
  - Wow ×0.999 at milestone 3 and ×1.000 at milestone 5; at the end, ×0.999 on the 95 seeds both won (×0.988 over all 200, nearly all of it the one lost run). The median final Wow is 29,648 → 29,619.
  - Greedy rerolls only when no play would raise the week's total, 0.13 times a run before and 0.09 now, and 192 of the 200 runs end on the same Wow. So the sim says little about players, who reroll far more (the user, 10 times in a run).
  - §8's criteria keep their verdicts: greedy's wins pass, unsure, at 47.5% [40.7–54.4], it clears milestones 1–3 in 97.5%, and the clients' spread fails, unsure, at 25.0 points (27.5 before).

**Considered:** a third button for both rows beside each row's own (three buttons for one count); a count for each row (twice the rerolls, and a re-fit).
**Costs:** a good row can't be kept while the other redraws. Codes from D-121's builds with a row's reroll replay differently from it on.
**Changes:** D-121 (Accepted): its reroll, the run code's row, the Reroll buttons and the sim's reroll, with a dated note there. Its notes on D-036, D-039 and D-098 are marked too. `implementation-plan.md`: the `handDrawn` event, the week's start, and Appendix A's rerolls.

### D-111 · Art for M4's content: the members' rooms, packs, and Renovate's level
**Status:** Proposed · 2026-11-08, with the M4 pull request, after it merged `develop` (M5a). Implementation details within D-097, D-100, and §12 Art; for playtest 4.
**Decision:**
- **The members' rooms** (D-103): the Nursery, the Kids' Room, Grandma's Room, Renfield's Room, Nana's Room, Rowan's Studio, and Ivy's Room.
  - Each has its own floor and wallpaper, as every room type does (D-097), cut from LimeZu's Room_Builder sheets into a manifest of their own (`art/limezu/members.json`). Each wallpaper stands ΔE 20 or more from its floor, like every room's (D-100's test), and none reuses another type's floor or wallpaper: `house-paint.test.ts` now lets only the two kitchens and the two hallways share.
  - Their furniture is laid out by `rooms.ts`'s slot rules (D-100), from LimeZu cuts, most of them new, that say whose room it is: the twins' crib (a blue blanket beside a pink one), a low dresser to change them on, a rug and a teddy in the Nursery; two children's beds side by side, a toy box, a rug and a toy train in the Kids' Room; Grandma's bed with her vanity beside it, or her curio cabinet where the vanity won't fit, an armchair and a standard lamp; a cot, two candles that flicker and a spider bobbing on its thread in Renfield's (LimeZu has no corner cobweb); Nana's bed beside the dogs' bed, an armchair and a rug; an easel, a stool, a pot of paint and a finished painting on the wall in Rowan's Studio; a child's bed, a school desk and a globe in Ivy's Room.
  - Renfield's Room and Rowan's Studio are one cell across, so a piece in them is at most 22 px wide and 26 px tall, or comes in a second shape: an upright cot or a side-on one, an easel with or without its finial (or its painting on the wall, where a door's walkway leaves too little floor).
  - The dogs' bed in Nana's Room is our own drawing, in LimeZu's palette and ink, like the Doghouse (`drawings.ts`): a dog asleep on a red cushion, since LimeZu's interiors have a cat but no dog.
  - Bunk Beds stand in place of the crib or the bed in a member's 2×2 room, as in a Bedroom; in the two rooms one cell across they show as a badge. Doors treat a member's room as the Bedroom it counts as (D-103), and where they can, open the Nursery and the Kids' Room off a Bedroom, Ivy's Room off the Home Office and Nana's Room off the Mudroom (`house-model.ts`).
  - When the Nursery grows into the Kids' Room, its art changes with its type, the crib becoming two beds; its level and fixture stay (D-109).
- **Packs** (D-106) are drawn from their own tiles, never the card's shape: the ghost as the tiles are clicked out, the built pack, and the Moving Truck's carried pack (D-100's ghost rule).
  - A Fence's picket line runs through any connected shape, joining other Fences as D-100's do. A lone tile is a short run across its cell, with a post at each end.
  - The house's car stands only on its Driveway's own tiles: everything below its over line, wheels and body, with its roof rising over the row behind no further than a side-on car's does. A ragged pack parks it in another row (side on) or column (nose in), so a Driveway of two tiles or more, of any shape, parks it where no door is in the way. A lone tile sends it to the house's next Driveway.
- **Renovate's level** (D-102): a pixel badge with a star per level, as tall as the ⚠. `label-layout.ts` places it last, so it moves nothing: beside the ⚠, else under it (a row, then a column), else in the ⚠'s place, else under the fixture's badge, else under the top badges at the room's left, else at the top of another of its top cells (an L-Kitchen's other arm). It stays on the room's own cells inside its walls, clear of the digit, the other badges and what the labels keep off (D-100). Where only a smaller badge fits, it shrinks as the other badges do, never below a device pixel per icon pixel. It pops on a Renovation (`FEEL.levelPop`; not under Reduce motion). Where it can't fit it's left out, and the inspect panel states the level.
- **Renovate's outline** around the rooms a card can renovate is drawn in art pixels, so it grows with the zoom like the walls it follows and stays easy to find at 2× and 3×.
- **The crews' icons:** our own 8×8 drawings in LimeZu's palette, like D-098's icons, for a crew's chip and, at 4 UI px per art px, its card. The General Contractor's is the Weekend Crew's hard hat (the hammer already means Demolish), the Landscaper's a garden spade (its bonus is for yard pieces, and most of them aren't Green), and the Architect's the goods' blueprint, redrawn at 8×8. No crew's icon is a tag's.
- **Two carets** open and close folds and the contract's house rules (▸ closed, ▾ open): small wood triangles in the ink outline, smaller than the ▲ ▼ marks, so an open fold doesn't read as a dislike. The open one is the closed one turned a quarter in the same 8×8 box, so a row keeps its place when it toggles.

**Why:** M4's new pieces had no art in M5a's look. M5a drew a yard piece from its card's shape, which a pack doesn't keep, and the merge gave the members' rooms the Bedroom's floor and wallpaper for the time being. D-097 gives every room type its own floor and furniture, and D-100 draws every piece from its own cells. A Renovation needs a mark on the board, and M5a's labels already decide where a badge can go.
**Costs:** 50 new LimeZu cuts, each with its record in `assets/licenses.json` (`CREDITS.md` credits LimeZu already), and one more drawing of ours. A 2×2 room's north wall holds the bed and one piece, so Grandma's Room shows her vanity or her curio cabinet, rarely both, and no nightstand. Where Renfield's Room lies one cell deep and a door's walkway takes its floor (about one such room in seven, in random houses), there's no room for the cot: it shows the candles and the spider. The level badge is left out only where no badge fits: at 1×, a one-row room that also shows a fixture's badge and the ⚠ on a screen of ratio 1; Renfield's Room and Rowan's Studio at 0.5×; a one-row room a Treehouse's roof fills. A lone Driveway tile parks no car.
**Changes:** None to settled decisions. It extends D-100 (Accepted): its Furniture bullet gains the members' rooms, its Yard pieces bullet the packs' own shapes, the lone Fence tile and where the car parks, and its Labels bullet the level badge. D-098 (Accepted): the crews' icons and the carets join its icons.

**2026-11-08 (the visual checks), for playtest 4:** checked in D-110's six configs, with nothing to fix: the seven members' rooms at all four turns, bare and with Bunk Beds, Soundproofing or Blackout Curtains; the Nursery growing into the Kids' Room; Fences of one to eight tiles and Driveways of one to six (rows, L's, T's, a block) as they're clicked out, built and carried by the Moving Truck, at 0.5× to 2× and Fit, with their labels near the lot's top edge; the parked car; and Renovate's outline, its labels and the stars at levels 1 and 2, at 1×, 2× and Fit. The candles and the spider animate as the Fireplace does, so they hold still under Reduce motion and under a sheet over the board (`house.css`, `terrain.css`). The board's open items are D-110's host badges.

### D-110 · M4's screens in the pixel UI
**Status:** Proposed · 2026-11-08, with the M4 pull request, after it merged `develop` (M5a). Implementation details within D-098 and D-109; for playtest 4.
**Decision:**
- **One interface:** M4's screens are built from M5a's kit (`src/ui/kit`: panels, sheets, paper cards, chips, keycaps, and icons) on the theme's tokens, in the pixel font with the readable option, like every other screen (D-098). Every color is a token, so M4's stylesheets come off `theme.test.ts`'s legacy list, and its 4.5:1 check covers their text, on a translucent wash too (it blends the wash over the paper under it). Glyphs the pixel fonts lack are icons, the rules' own words included: a tip draws the glossary's warning sign (Requirements, "on the board") as the warn icon in both fonts, kept on one line with the "(" before it (`Tip.tsx` tipWords).
- **The job board and the crew pick:** one wood panel over the title's street, "The job board" or "Pick your crew" on its plank, with "Step 1 of 2" or "Step 2 of 2" as a chip. Contracts and crews are paper cards, three in a row, each with a keycap (1–3), a middle that scrolls, and a foot that doesn't, holding its button; a contract also has its rarity's band, fill and chip (a plain chip: the shop's rarity tag explains goods). 1–3 take a card, and Esc or Back goes back a step. Focus moves to the first card's button at each step. The columns and insets are whole UI pixels, so the cards rest on whole device pixels.
  - "Recommended for your first job" is a gold tab with a star on the card's top edge. On a first visit only that card's button is lime (the Hendersons' Take the job, then the General Contractor's Hire this crew), so the view has one lime button, as the build screen has End week (D-098).
  - A contract shows its lot as a small map of the lot and its street row in LimeZu's colors, at 3 UI px a cell (2 on a window up to 1500 px wide or under 800 px tall), in the ink ring, with the lot in words as its title (and as a line under it on a window 800 px tall or more); its tastes as rows with up, down and reroll icons (likes, dislikes, draws); and its house rules folded behind a caret.
  - A crew card shows the crew's icon at 4 UI px per art px (D-111), its blurb, its "All run" lines, and the pieces it starts with as the hand draws them, on every window (the cards have the room at 1280×720).
- **The change order** is a sheet over the board, 270 UI px wide, with the mail icon and "Change order" on its plank and the client's name beside them ("from the Hendersons", on one line).
  - It holds the keyboard on its text, never on a button, so a held Enter can't skip `FEEL.changeOrder`'s pause (D-109). Tab stays inside it, and focus goes back where it was when it closes. It isn't one of the modals (`anyModalOpen()`), so the game's keys answer it: Enter accepts (or says Got it to a phase effect), and Esc or D declines a request or a restriction.
  - Its middle scrolls: the order's name with a chip for its kind (a request's mail, a restriction's cross, a phase effect's clock), the client's words, the terms, "So far", how long it runs, and what it pays, the coin first (D-098). The terms leave a request's or a restriction's reward to that Pays line, so the sheet says it once. Its foot doesn't scroll: Decline, for a request or a restriction, is plain, and Accept or Got it is lime, each with its keycap.
  - The answer is a pixel stamp, a check or a cross and the word (Accepted, Declined, or Noted for a phase effect), that comes to rest unrotated, a set way down the sheet so it lands on whole device pixels, before the shop opens.
  - Notes dock inside it, under its plank: D-098's Overlays bullet now covers any sheet over the board, not only the shop. The sheet is narrow, so a note's buttons (an old run's Copy, and Dismiss) go under its words, at the right. A note's Dismiss, by mouse or keyboard, puts focus back on the sheet's text, which holds the keyboard, rather than let it fall to the page (`Notes`' refocus); the Enter that pressed it doesn't answer the order.
  - Under it, the board's water and animated props pause, as they do under the shop (D-099).
- **The client's checklist** is a panel in the left column. The client's name is on its plank, with their brief as its tip. The crew is a wood chip with its icon, first in the list, whose tip is the crew's blurb and its "All run" lines. The house rules, the client's wishes and the change orders sit under plank tags.
  - On a window under 1000 px tall the list's head is one row, so the first house rule starts right under it: the tastes fold into their row; the crew's chip shows its icon alone, with the same tip, on the plank beside the client's name (in the pixel font in a 280 px column, where the plank has no room beside the Hendersons' or Count Vladislav's name, 216 and 218 of its 228 px, at the end of the tastes' row instead); and the House rules tag is left out, the score panel's checklist row naming the checklist (2026-11-09: the chip, the tastes and the tag took the box's first 120–140 px at 1280×720).
  - Marks are icons: a check for a line that holds, a pending mark for one that doesn't, a star or a cross for a line turned on or off this week, a clock for a phase effect, the House for who's still to move in, and a caret on a fold row. A progress part that doesn't hold yet has a cross, here and on the change order's sheet.
  - On a window wider than 1500 px a held line shows its "+0.25"; on a narrower one (280 px columns), a Charm icon, with the value in its tip. The plank counts the lines held on a window wider than 1760 px, where it has room beside the longest client's name; the score panel's checklist row counts them on every window.
  - The tastes are a row each, marked up, down, or a dot for neither. On a window under 1000 px tall they fold into one row, "Tastes (3)" as the job board calls them, one line in every column ("Likes and dislikes (3)" took two in the pixel font). House-rule groups fold as D-109 says; a fold row shows its count with a check, and never takes focus on a click.
  - A change order's reward reads coin first, struck through once it's broken or missed. Only a play that would break a restriction takes the warning's tint: a resolved order's cross, struck name and result word say the rest.
- **The left column** is never taller than the window and never scrolls as a whole: the score panel keeps its height, and the checklist and the inspect panel share the rest, a box of their own, each scrolling inside its own body, with the inspect panel's plank and foot always in view. While a play is being looked at, the inspect panel comes first (D-109). The checklist keeps its plank and two rows (56 UI px). Pointed at something, the inspect panel keeps a few lines (80 UI px), or, on a short window late in a run, the share of the box the checklist's minimum leaves it (2026-11-09: late in Dale's run at 1280×720 the score panel took 416 of the column's 656 px, and the 80 UI px overflowed it by 40). A play being looked at brings into view the first row it flips, with a line beside it where both fit, or else the change order it would break. A play that does neither brings the house rules' first two rows into view while the tastes are folded into their row (under 1000 px tall, unless the player opened them), and otherwise leaves the checklist where it is, so tastes in view stay in view (placing a Lawn at 1920×1080 keeps "Lawns earn +50%"). Once the play is over, the checklist goes back where the player had it.
  - **The score panel's sets fold** into one row on a window under 1000 px tall (D-098, changed with the team's OK on 2026-11-08), so late in a run the checklist keeps its room. The row has a set's shape: "4 sets" (or "1 set") with their Comfort and Charm added up at the right, under a hairline where the "Sets" heading was, and every set's name, level, Comfort and Charm in its tip, a set a line. "No sets yet." keeps the first-set suggestion as its tip, in both fonts. The sums are the rules' per-set numbers added up for display, as the checklist's row multiplies its count by the bonus; the UI scores nothing. In a tally the row counts the sets as the tally does, with Comfort and Charm: "0 sets", dimmed, until the tally reaches them, then each set as it's counted, the row lighting with the set's members on the board, in the board's set highlight (a rose wash under a Charm edge), and its numbers popping from the right (`FEEL.checklist.tickMs`). It also lights for a set's beat (`FEEL.tally.setStepMs`) when the sets change outside a tally: a Remodel Plans' level, a demolition. Reduce motion keeps the light and drops the pop. Windows 1000 px tall and up keep the list, which shows the sets a play being looked at would make and break.
  - **The week's Wow** sizes itself to the room beside its word, so it never runs onto the plaque's frame, and keeps a gap after the word wider than a space (6 UI px; 2026-11-09: "56,789" sat 2 UI px from it at 1280×720). Public Pixel's glyphs are an em wide, so in the pixel font the size is that room over the number's glyph count, rounded down to the font's grid of 4 UI px and kept between 8 and 16 UI px (CSS `round()` in an inline-size container); the readable font's digits take about 0.62 em. At 1280×720 in the pixel font a Wow of 1,000 or more shows at 24 px and one of 10,000 or more at 16 px; at 1724×962 the hero 32 px holds to four digits, at 1920×1080 to five. A browser without `round()` steps the number down at four digits and at six.
  - **The inspect panel's total**, "This week: X → Y Wow", is its foot, under the body that scrolls, so it stays in view however long the preview: a placement, an install or a Renovation, a tool that can be used, a demolition. A tool's Use button and a demolition's "Click it again" end the body, above it.
  - **The budget line** keeps its coin beside the first line of its words, as the inspect panel's notes do: two lines in a 280 px column, not three.
  - On a window under 1000 px tall the score panel keeps to its equation while a play is looked at: its sets, its checklist row and its budget line hide, and the inspect panel's notes say which sets, checklist lines and budget the play would change. This was the 820 px rule M4 built for D-109's left column, then D-098's 800 px breakpoint; since 2026-11-09 it's the fold's 1000 px, as the list coming back between 800 and 1000 px tall pushed the inspect panel's total below a 1536×864 window late in a run. With nothing looked at, the idle inspect panel gives way first, down to its plank, and on a window under 800 px tall the checklist keeps 44 UI px. While a play is looked at, the checklist keeps 84 UI px in the pixel font, whose rows are two or three lines tall.
  - In a 280 px column the pixel font's checklist row in the score panel leaves out its check icon, as the equation's labels leave theirs, so "7 checklist lines" keeps to its first line: the row is two lines, a set's shape, not three.
  - On a window under 1000 px tall, a line a play would turn on leaves out its progress, which the play meets, so the row above it stays in view; while a play is looked at, so does a line it leaves as it was (a change order keeps its status). Until 2026-11-09 this was only on a 1280×720-class window (1500 px wide or less, 800 px tall or less): at 1536×864 a Home Office's flipped wish, with its progress, was taller than the checklist's box.
  - The aim at 1280×720 while placing: the score panel, at least two checklist rows, and the inspect panel's preview in view, in both fonts. *2026-11-09, before playtest 4:* met in 20 of 21 week-1 plays (every client and crew) in the pixel font and in all 21 in the readable font, with the preview's total always in view (2026-11-08: 3 and 16). Dale's Home Office shows one: its flipped row and the line beside it are taller than the box. The notes below have the numbers.
- **First-time hints** (D-045, D-077's note) are paper notes with a wood plank and the help icon, by the panel each explains, on whole device pixels and inside the window (`first-hint-place.ts`): the first week, the checklist, Complete early, the shop, a fixture, a change order, and an arrival. A note by the checklist that's taller than the room below it rises until it fits, rather than scroll its text in a sliver. They never take focus. Got it dismisses one for good, and Settings shows them again. They're `FirstHints.tsx`; `Hints.tsx` stays D-098's controls strip.
- **The controls strip** (D-098) adds a change order's keys (Enter accepts, Esc or D declines), a pack's clicks (click a tile to add it, and again to take it off), and a pending Renovation ("renovate it" on Enter), which has nothing to turn: the strip leaves out R, R does nothing, and the Rotate button is off.
- **The board's labels** (D-098): a pack's ghost label is two short lines, its change to the week's Wow with how many tiles are out ("3 of 8 tiles"), then "Click to start" or "End week to build"; the next tile's own chip says what a click there would do. Renovating, the room's label names the level it would reach and the change to the week. A stack of labels takes as many rows above its cells as it is tall (`geometry.ts` labelRows), so near the lot's top edge, at 0.5× and Fit, it drops below its cells rather than run off the board. These labels keep the ▲, ▼ and ✕ that M5a's labels use, which the pixel fonts lack (a known gap in both). A popup that would be cut off at the side of the board's view (a room's "Renovated · level 1" at the lot's edge at 1280×720) is nudged inside it, as the labels are.
- **A fixture's worth** (D-107) is a strip on the shop's fixture cards and on a crate's fixture options: the best host, this week's gain with an up or down icon, and the gain over the weeks left. While installing, each host's gain is one of D-098's preview badges, above the walls, the best ringed in gold, sized and placed on whole device pixels with no transform at rest, so its ink ring stays crisp. Where its spot would cover another host's badge or a piece's digit or badge (two one-cell rooms side by side at 1×), it moves to the nearest clear spot within a cell, up or down before sideways; the best gain's is placed first and keeps its spot (`label-layout.ts` spreadBadges).
- **The inventory** (D-098) adds the extra slots for the crew's and the household's cards after the reserve's own, each tagged ("Crew", "Twins"); where a name and its tag don't fit side by side (Grandma's Room in a 280 px column), the tag goes under the name, which stays whole. An arrival's cards pop in.
- **The client and the crew** are named on the checklist and in the Menu, beside the seed (the Menu is 200 UI px wide now, so the crew's chip fits beside its label). The top bar keeps D-098's layout, its week line reading "Change order" while one is open. The title's Continue says whose house the saved run is ("For the Hendersons"), above its phase, week and Wow.
- **End week** keeps D-098's measured labels. A pending Renovation says so in its title, in the strip ("renovate it"), and in the inspect panel.
- **An arrival's banner** is a wood plank with the House icon, not the gold milestone ribbon, so an arrival doesn't read as a milestone met. It doesn't hold up the week (D-109).
- **How to play** gains short sections on M4's systems, with numbers from the rules, the content and the glossary as the rest of the sheet has them: "Your client" (the job board, the checklist's seven house rules at +0.25 Charm a held line, the tastes, the household's arrivals), "Your crew" (each crew's icon and blurb), "Renovate" and "Change orders" (the milestones they follow, what they pay); packs are a line in "A week". Its controls add a change order's keys (Enter; Esc or D) and a pack's click (a tile again takes it off). Full House's picture wraps to fit the sheet.
- *Open for the team:* client portraits. LimeZu's premade Modern Interiors characters (a pack already cleared) could put a face on the job board and the change-order sheet. The default is none for playtest 4: the screens work with names, the lot map and text, and portraits could come with the juice pull request or M5b.

**Why:** M4 was built alongside M5a, in the old look, and merged after it (D-097's juice note). Playtest 4 should try M4's game in the interface the team approved in playtest 5a, not in two looks side by side. Each default follows D-098's rules: one lime button per view, icons for the glyphs the fonts lack, sheets that hold the keyboard, and whole device pixels.
**Costs:** the pixel font is wide (D-098's Costs). A 280 px column holds about 19 characters a line, and at 1280×720 the Hendersons' checklist needs about 2.5 times the space the column has, so it leans on folding and scrolling: there the list's head is one row, and a line a play flips, or else the house rules' first two, scrolls into view. While a play is looked at there, the lines it doesn't flip leave out their progress. Even so, a house rule's row with its progress is 64–164 px tall in a 280 px column in the pixel font, so with nothing looked at at 1280×720 the checklist often shows only one whole (the notes below). The crew's chip sits in three places by window: first in the list on a window 1000 px tall or more, as an icon on the plank under that, and on the tastes' row in a 280 px pixel-font column. On a window under 1000 px tall, picking a card hides the score panel's sets, checklist row and budget line until the play is over; the inspect panel's notes carry what the play changes. Late in a run on a short window, the inspect panel pointed at something can have only its plank and a line or two, with its body scrolling. The Wow's sizing needs CSS `round()` (Chrome 125, Safari 15.4, Firefox 118); an older browser steps the number down instead. The Hendersons' contract card needs about 660 px in the pixel font, more than a 1280×720 window gives it, so its middle scrolls.
**Changes:** D-098 (Accepted), with the team's OK (2026-11-08): on a window under 1000 px tall the score panel's sets fold into one row while nothing is looked at (its score panel bullet and its note). *2026-11-09, for the team to confirm:* under 1000 px tall the panel also keeps to its equation while a play is looked at, so the list never comes back on a short window (D-098's note says so). It also extends D-098: notes dock in any sheet over the board, and the left column's short-window rules use its 800 px breakpoint, where M4 used 820 px, and the fold's 1000 px. D-109 (Proposed): its UI bullet points here.

**2026-11-08 (the visual checks), for playtest 4:** three reviewers checked these screens, the HUD and the board in six configs: 1920×1080 and 1280×720 at a devicePixelRatio of 1, and 1724×962 at 2, each in the pixel and the readable font. A fix pass followed, then a second check, then a second fix pass (the bullets above include both). The second fix pass took on what the second check found in the HUD:
- late in a run at 1280×720 in the pixel font, the score panel took up to 612 px of the column's 656, so the checklist showed no whole row, and one of Dale's runs (seed `sw-d1`, the Architect) overflowed the column by 124 px, which put the inspect panel below the window;
- a weekly Wow of four digits ran onto its plaque's frame there;
- the inspect panel's "This week" total was cut off in 8 of 21 week-1 plays;
- on larger windows, a play that flipped nothing scrolled the tastes out of view ("Lawns earn +50%" while placing a Lawn at 1920×1080);
- a docked note's Dismiss dropped the keyboard's focus to the page;
- and the Requirements tip drew its ⚠ in the system font.

Measured again on the result, in the six configs: the left column overflows in none of 19 late states (the greedy bot's runs of all five clients at their change orders after milestones 2, 4 and 6, and the end) or 6 arrivals; the Wow stays inside its frame from one digit to seven; the total is whole in every placing play measured; and a Lawn, Closet, Fence, Driveway, Bedroom or Renovation leaves the checklist's scroll at 0. The job board and the crew pick, the change order, How to play, the hints, the inventory, the Menu and the board's labels and popups passed. What was still short in the left column went to a third check (the next note).

**2026-11-09 (the third check), before playtest 4:** two reviewers checked the left column again, with the pointer on things as well as away from them, and on windows between the six configs. They found:
- late in Dale's run at 1280×720 in the pixel font (seed `sw-d1`, the Architect), pointing at anything (the lot, a hand card, a good in the right column during the last change order) overflowed the column by 40 px, or 90 with a second Sparkle stamp: the inspect panel kept its 80 UI px, and its total went below the window;
- on windows 800 to 1000 px tall and under about 1700 px wide (1536×864, 1440×900, 1600×900), placing late in Dale's run brought the score panel's set list back and overflowed the column by up to 150 px, the total below the window;
- where the sets fold, the checklist seldom showed two house rules with their progress at scroll 0: in none of 30 idle states at 1280×720 in the pixel font (in 23 not even one), in 13 at 1724×962, and in none of 24 at 1536×864 or 1440×900, the crew's chip, the tastes and the House rules tag taking the box's first 120–256 px;
- at 1280×720 in the pixel font, placing in week 1, a play that flipped nothing showed no whole house rule: two rows showed in 3 of 21 plays;
- and smaller: the folded row showed the week's sets before the tally counted them; the Wow's digits crowded its word from five digits; the fold's tip ran the sets together; and placing late in a run at 1724×962 left the checklist a 66 px box.

A third fix pass took them on (the bullets above describe the result): the checklist and the inspect panel share what the score panel leaves, so the inspect panel's minimum is a share of that room and the column is never taller than the window; under 1000 px tall the score panel keeps to its equation while a play is looked at; the checklist's head is one row there (the tastes folded, the crew's icon on the plank or the tastes' row, no House rules tag), and a play that flips nothing brings the house rules' first two rows into view while the tastes are folded; the score panel's checklist row keeps to two lines in a 280 px column; the folded row counts up with the tally; its tip lists a set a line; and the Wow keeps a 6 UI px gap after its word.

Measured on the result, in nine configs (the six, and 1536×864, 1440×900 and 1600×900 in the pixel font):
- **The column is never taller than the window** in 423 states (in each config, the 19 late states, 6 arrivals and 5 late build weeks with nothing looked at, a hand card hovered, and placing each hand card), 441 with the pointer away or on open ground, a piece or a hand card, the last change order with the pointer on a blueprint or a supply, Dale with two Sparkle stamps (a 446 px score panel at 1280×720) idle and pointed, the tally's every frame, and Dale's late placing and installing and the Hendersons' won screen on ten more windows from 1366×768 to 1680×1050, in both fonts. The total is whole in every placing play.
- **At 1280×720 in the pixel font**, late in a run the score panel takes 272–396 px with nothing looked at (two stamps: 446) and the checklist's box 134–258 px; the head above the first house rule is 32 px (it was 120–140; 124–256 at 1724×962). Pointed at something, the inspect panel gets 140 px late in Dale's run (90 with two stamps), the checklist its plank and the tastes' row.
- **Whole house rules with their progress at scroll 0** (an unmet line with its progress, or a folded group's row with its count), two or more in the 30 idle states: at 1280×720 in 7 in the pixel font (none before; one in 20, none in 3) and 25 in the readable font (19 before); at 1724×962 in 29 and 30 (13 and 28); at 1536×864, 1440×900 and 1600×900 in the pixel font in 21, 23 and 25. Windows 1000 px tall and up are as they were (1920×1080: 18 and 30).
- **Placing in week 1** (21 plays, every client and crew), two whole checklist lines or more in 20 of 21 at 1280×720 in the pixel font (3 before; a Lawn now shows two, a Fence three), all 21 in the readable font (16), all 21 at 1724×962 in both fonts (14 in the pixel font), 20 at 1440×900 and all 21 at 1536×864 and 1600×900. Dale's Home Office shows one in a 280 px column: its flipped wish and the line beside it are taller than the box. Late in a run at 1724×962 the checklist's box while placing is 120–270 px (66 before), and the inspect panel's body 186–382 px.
- **The checklist's scroll:** at 1920×1080 a play that flips nothing leaves it at 0 with the tastes in view, as before; under 1000 px tall, where the tastes are folded, it brings the first two house rules into view only where they aren't (a Lawn and a Driveway at 1280×720 in the pixel font, 32 and 6 px); a flip still brings its row in, and Esc puts the box back.
- **The folded row** counts up with the tally ("0 sets", dimmed, then 1 to 4 sets at their beats) at 1280×720 in both fonts and at 1724×962, lit on every frame of a set's beat and on no other, also with Reduce motion; its tip names every set, a line each, inside the window. **The Wow** keeps 14 px or more after its word up to six digits in every config.

What's still short:
- **At 1280×720 in the pixel font, with nothing looked at,** two house rules with their progress show at scroll 0 in only 7 of the 30 idle states: an unmet line's row is 64–164 px tall in a 280 px column ("Room for everyone" with its progress takes up to eight lines), and held lines and who's still to move in sit between the unmet ones. Three show none: Count Vladislav's won screen and a late build week, and Dale's change order after milestone 4, where held lines come first.
- **A flipped row taller than the checklist's box** while placing shows cut: a Dining Room that turns off "A living room or two" late in Dale's run (144 px in a 122 px box at 1280×720).
- **1920×1080, 1000 px tall and up,** keeps D-098's list while a play is looked at, so the checklist keeps 56 UI px there: late in Dale's run its box is 60 px while placing, and in week 1 his Home Office shows its flipped wish cut. The pixel font's 84 UI px could apply there too, at the cost of the inspect panel's room.
- **The inspect panel:** a member's notes ("The twins' room: it counts as a Bedroom…") come after the card's kind and effects, so they're out of view while its card is only hovered. They show while it's being placed, cut short at 1280×720 in the pixel font.
- **Host badges while installing:** at 0.5× a badge moved off another can end up over the next room (the Closet's ±0 over a Bedroom), or, in a block of one-cell rooms, touch a digit. Hovering a host whose preview marks a neighboring host moves the other badges, and can put one on the preview's + mark. The install label covers the badges of the hosts above it, and stays there while an install is pending.
- **Smaller:** demolishing doesn't mark or bring into view the checklist lines it would flip, nor the score panel the sets it would break; the inspect panel lists both. A weekly Wow of seven digits in a 280 px column sits 2 UI px from its word, at the pixel font's 16 px floor.
- **From before M4, left as they are:** the build stamp covers the left column's foot at 1280×720 (D-098's corner, chosen to stay clear of End week), now the inspect panel's frame under its plank or its total; on the score panel's list, a set the play would make is tinted with Charm's tint, on which its Comfort reads at 4.1:1 and its Charm at 4.49:1 (M5a's colors, not yet among `theme.test.ts`'s pairs); and a click on a cell that can't take a pending play drops the play, a pending Renovation included.

### D-109 · M4b rules structure: change orders, arrivals, and crews
**Status:** Proposed · 2026-11-07, with the M4 pull request. Details within D-103, D-012, and Appendix A · M4b; numbers for the sim and playtest 4.
**Decision:**
- **Change orders:**
  - one after each of milestones 2, 4, and 6 (`changeOrderAfter`), on its own screen before the shop, drawn from the `co/<milestone>` stream, evenly among the client's own orders and the generic ones (Working from home, Heat wave), never one offered before in the run. *(2026-11-09, D-112: this said "the client's own orders, then the generic ones", which read as own first; the pick has always been even.)*
  - skipped: one already met, one needing more new pieces than a phase has weeks, a demolition request with no demolitions left, and one whose piece is neither in this phase's draw nor in the reserve. The plan's "less free space than it needs" isn't checked.
  - **before the last phase, only phase effects:** a request's or a restriction's reward would come at the run's end, where budget buys nothing
  - requests and restrictions can be declined at no cost; accepted, they run through the next phase and pay when its milestone is met (nothing if the run is lost). Rewards are budget, 3–5, in each order's definition.
  - a phase effect is announced (it can't be declined) and runs as a timed effect until the next phase's milestone
  - only a placement breaks a restriction (not a move or a transform); it stays legal, and the preview names the order it would break
  - Declutter counts the pieces demolished since it was accepted, not Boulders or the Old Shed
- **Arrivals** (D-103), as client data (`households.ts`): the Hendersons' twins (a Nursery, which grows into a Kids' Room 8 weeks after it's placed, keeping its level and fixture) at Framing and Grandma (Grandma's Room and a Bathroom card) at Drywall; Count Vladislav's Renfield at Framing; the Barkers' Nana at Drywall; Juniper's Rowan (a studio) at Drywall; and Dale's daughter Ivy at Framing.
  - Bedroom ranges: the Hendersons 2–3, then 3–4 from Framing and 4–5 from Drywall; the other four 1–2, then 2–3 from their member's arrival. M4a's placeholder steps are gone.
  - A member's room counts as a Bedroom everywhere a Bedroom counts: Room for everyone, the Bathroom ratio, the Bedroom limit, sets (a Nursery fills a Jack-and-Jill's Bedroom), and Bedroom effects. A member's card can't renovate, but a Bedroom card can renovate a member's room.
  - Member cards wait in the reserve's extra slots, like a crew's starting cards: buying, crates, and tools count only bought pieces.
- **Crews:** the Landscaper (yard pieces earn +50%; starts with a Sapling and a Fence) and the Architect (the Playroom, Library, Mudroom, and Pool in the weekly draw at weight 5; every set pays +10%), picked on the job board after the contract. On a first visit the General Contractor is marked "Recommended for your first job" with the Hendersons.
  - The plan's numbers (the Landscaper's yard draws +50% and earnings +25%, the Architect's sets +50%) failed §8's spread: the Architect won 60.9%, the General Contractor 37.9%, and the Landscaper 27.5% (1,000 held-out runs). Extra yard draws crowd out the rooms the checklist needs, and sets drive most of the Charm. At these numbers: 45.5%, 41.5%, and 39.7%.
- **Debug ops:** force a change order (offered now, running through the current phase) or a client's arrival (its cards now, once).

- **The UI** (2026-11-07): the left column fits 1280×720 and up: house-rule groups whose lines all hold fold into one row (they open while a line in them flips), and while a play is being looked at, Inspect comes first. A source with several earn lines names what each is for ("Count Vladislav (Dark pieces)"). A demolition's preview names the sets it would break; a set that re-forms from other pieces isn't counted. The change-order sheet takes its keys only after a short pause (so an Enter meant for End week can't answer it), and stamps the answer before the shop opens. Orders a milestone resolved stay in the checklist panel with their result until the next phase's first tally, so skipping the tally never hides them. An arrival's banner doesn't hold up the week.
  - *2026-11-08 (M4 merged with `develop`):* these screens are in M5a's pixel UI now, with these rules kept (D-110). The left column's short-window rule moved from 820 px to D-098's 800 px, and (2026-11-09) to the fold's 1000 px. Its aim at 1280×720 while placing: the score panel, at least two checklist rows and the inspect panel's preview in view, in both fonts. Re-checked at 1280×720 before playtest 4 (2026-11-09): the inspect panel's preview and its total are always in view, and the column is never taller than the window, the pointer on something or not. Two rows show in 20 of 21 week-1 plays (every client and crew) in the pixel font and in all 21 in the readable font; with nothing looked at late in a run, two house rules with their progress show at scroll 0 in 7 of 30 states in the pixel font and in 25 in the readable font (D-110's notes have the numbers).

**Why:** the plan's M4b, D-103, and the sim's needs. The last-phase rule is new: without it, the offer after milestone 6 paid budget at the end of the run.
**Changes:** jam-scope.md's change orders (the Twins and Grandma's moving in are arrivals now, D-103). Appendix A · M4b's skip rules (free space isn't checked).
*Changed by D-121 (Proposed 2026-11-09):* the Landscaper also draws a third Layout card every week.

### D-108 · Client numbers from M4a's sim: one signature room each, and the Hendersons' pool
**Status:** Proposed · 2026-11-06, with the M4 pull request; numbers for the sim and playtest 4.
**Decision:**
- A client's wish for its signature room has a ceiling, like One Kitchen: Count Vladislav wants **One Library**, the Barkers **One Mudroom**, and Dale **exactly two Home Offices**. Extra cards of those types renovate instead (D-102), and draw at half weight while the type is at its limit (D-104).
- The Hendersons' pool helps their Kitchen-beside-the-Dining-Room wish through the Dining Room (+100%, with Bedrooms, Bathrooms, and Fences), but not the Kitchen: every house takes exactly one, and spare Kitchen cards were the review's most common dead card.
- The fenced-yard wishes waiting on D-106 are in: the Hendersons want any fenced yard, and the Barkers a big one, 12 tiles or more (Appendix B).

**Why:** M4a's sim (1,000 held-out greedy runs, 200 per client). Without ceilings, Count Vladislav placed 4.2 Libraries a run and Dale 2.8 Home Offices, and one of each shared room (H3) held in 54% of wins, against the review's 77% for its A + Renovate. With them:
- one of each shared room 81% of wins, the glance test 44% (from 29%), research.md's plausibility check 76% (from 51%), and a compact outline 67% (from 59%)
- Count Vladislav places 1.2 Libraries a run, and his houses pass the glance test in 41% of runs (from 7%); Dale places 1.9 Home Offices (glance 52%, from 29%)
- greedy's win rate is unchanged (40.3% against 39.9%)

**Changes:** Appendix B's specs for Count Vladislav (library ≥ 1), the Barkers (mudroom ≥ 1), and Dale (homeOffice ≥ 2), and the Hendersons' pool (spec pieces + fence +100%).

### D-085 · M3 balance: the milestone budget and the targets
**Status:** Proposed · 2026-11-05, with the M3 pull request; numbers for the sim and playtests to tune.
**Decision:**
- **Milestones pay 4 budget,** not Appendix A's 3. At 3 the greedy bot (which never completes early) earned a median 25 a run against the plan's 30–40, so the shop was too tight to plan around. At 4 it earns a median 30 (p10 15, p90 42).
- **Targets** (`--suggest-targets`, 200 runs, with the shop bot): 15, 190, 490, 1,050, 2,250, 4,600, 9,500 Wow, up from M2's 15, 120, 270, 650, 1,350, 2,900, 5,300. The shop's blueprints, fixtures, and tools roughly double a late-run week. D-072's survival curve and criteria still hold: greedy clears milestones 1–3 93% of the time and wins 44%; random wins none and fails at milestone 1 or 2.
- The shop's other numbers are Appendix A's placeholders, in `balance.ts`.

**Changes:** Appendix A · M3a's +3 per milestone. D-072's targets.
**2026-11-06 (D-089):** these numbers came from the old greedy, whose estimate ties went to the back row, and whose shop bot always struck Driveways and Fences. On the same targets the new greedy clears milestones 1–3 in 93.5% [89.2–96.2] and wins 60.0% [53.1–66.5] (`--check`, 200 held-out runs), so the targets are now easy for it. The old greedy's 44% was also measured on the seeds the targets were fitted to; on held-out seeds it won about 52%. The budget numbers also came from a bot that never completes early; `--early always` shows what early completion earns. Re-running `--suggest-targets` is the team's call.
**2026-11-06 (playtest 3):** the team found the run too easy once the shop's goods were in, and the budget about right: they could buy what they wanted without being able to buy everything. Their run (seed `jbf3zs`, build 77016ef) won with 14,116 Wow against 9,500, and earned 41 budget.
- Milestones 1 and 2 were close: 20 against 15, and 247 against 190, which took a week of overtime.
- From milestone 3 the targets stopped binding: 1,172 against 490, 2,515 against 1,050, 4,830 against 2,250, 8,954 against 4,600 (completed a week early), and 14,116 against 9,500.
- Each of milestones 4, 5, and 6 was already met when its phase began, because the score carries over (D-028): 1,172 against 1,050, 2,515 against 2,250, and 4,830 against 4,600.
- They completed early once and found it hard to judge whether it paid, since the targets weren't pressing.
- D-089's unapplied fit (530 to 12,800) would still have lost to this run from milestone 3 on. A player who builds an engine pulls away in the middle of the run, so the curve's middle is too low, not just its end.

**2026-11-06 (systems review):** under the review's option B, greedy wins 94.5% of 200 held-out runs at these targets.
- The review's pick for option B is 15, 250, 870, 2,650, 5,800, 11,700, 20,900. On 200 held-out runs, greedy wins 46.5% and clears milestones 1–3 in 94%.
- A player like playtest 3's would face margins of 1.7, 1.4–1.5, and 1.2–1.3× at milestones 4–6, against the 2.4, 2.15, and 1.95× they had.
- Milestone 3 stays as loose as before, about 2.3–2.5× for such a player. It has to while greedy clears milestones 1–3 in 92% or more. Milestone 2 loosens, to about 1.7× against the 1.3× they had.
- The projection maps one playtest run onto the sim. M4a re-fits on the content it ships, and M4b re-fits again once the arrivals are in (`house-systems-review.md` §5.8, §6).
**2026-11-06 (M4a, preliminary):** re-fitted on M4a's content before M4b's arrivals (1,000 untargeted greedy runs to fit, 1,000 held out to check): 15, 310, 1,100, 3,150, 6,950, 12,800, 23,300 Wow, with each client's `targetPct` (the Hendersons 100, Count Vladislav 115, the Barkers 90, Juniper 85, Dale 105).
- Milestone 1's α is now 0.2, a target of about 15, where the review kept it. At the fit's old 0.4 (a target of 30), the novice bot passed milestone 1 in only 85% of runs; at 15, in 98%.
- Held out, greedy won 40.3%, about 6 points under the fit's estimate, so the final curve will be eased as the review's was. No client was more than 14 points from another (unsure).
- These aren't in `balance.ts` yet: the M4 pull request writes the curve fitted with the arrivals in.
**2026-11-07 (M4b, the numbers in `balance.ts`):** fitted with the arrivals, all five clients and three crews, the crews' balance (D-109), and +4 budget per week saved (D-040): 2,000 untargeted greedy runs to fit, then 2,000 held out to check.
- **Targets:** 15, 300, 1,100, 3,050, 6,850, 13,150, 24,500 Wow. The fit gave 3,200, 7,150, 13,700, 25,500 for milestones 4–7, and greedy won 41.2% held out against its estimated 46%, so those four are eased by 4%, as the review eased its curve.
- **Each client's `targetPct`:** the Hendersons 125, Count Vladislav 110, the Barkers 80, Juniper 85, Dale 110: the fit's factors, moved toward the middle by their held-out win rates.
- **§8 on 2,000 held-out runs:** greedy wins 44.3% [42.1–46.5] and clears milestones 1–3 in 94.4%; novice passes milestone 1 in 97.0%; random loses by milestone 3 in 98.9%; completing early always wins 5.1 points less than never; the clients are within 3.5 points of each other (42.5–46.0%) and the crews within 6.5 (40.2–46.6%). The planner's two criteria wait for M6's planner.

**2026-11-07 (playtest 5a):** M5a didn't change the rules, so this run (seed `bv6bsv`, build 1712fd6) played these targets. The team won with 10,005 Wow against 9,500 after one week of overtime, and earned 33 budget.
- Their lead shrank at every milestone: 113 against 15 (7.5×), 631 against 190 (3.3×), 1,273 against 490 (2.6×), 2,089 against 1,050 (2.0×), 3,477 against 2,250 (1.55×), 5,273 against 4,600 (1.15×), then 9,061 against 9,500 (0.95×) at the last deadline. Playtest 3's run was the reverse: tight at milestones 1 and 2, loose from milestone 3.
- Charm came early, then stalled. The Entertainer gave ×2 in week 4, and it stayed there until week 17. Two Jack-and-Jills took it to ×2.5 (week 17) and ×3 (week 24), and both Remodel Plans went in only in week 25, for ×4. The first was bought at the third shop and held for 12 weeks. A Remodel Plans levels its set even before the set exists, so using it the week it was bought reaches 9,627 by week 28, on time.
- That card doesn't say so: "Jack-and-Jill goes up a level for the rest of the run". The team didn't say whether that's why they held it. Its wording waits for M4, which rewrites the tools' text.
- Week by week, the placements were close to the best play for that week: 143 Wow short over the whole run. Greedy, dealt the same hands, won with 16,505. It built two Living Rooms with Fireplaces and had a second Entertainer by week 13.
- For playtest 4: M4's refit targets are about 3× steeper in the middle phases. Do they take away this kind of early slack without making the last two phases too tight for a player whose Charm comes late?

**2026-11-09 (D-123):** re-fitted for playtest 5 the same way, 2,000 untargeted runs to fit and 2,000 held out: 20, 560, 1,750, 4,850, 10,200, 18,800, 32,600 Wow, with factors the Hendersons 115, Count Vladislav 90, the Barkers 90, Juniper 85 and Dale 115, all used as fitted. Held out, greedy wins 44.0%.

### D-095 · A piece that becomes a lot feature can't hold a fixture
**Status:** Proposed · 2026-11-06, with the fix/transform-fixtures pull request. It fills a gap in D-050, which says how a fixture leaves but not what happens when its host transforms.
**Decision:**
- A fixture can't go in a piece that becomes a lot feature. Today that's only the Sapling, which becomes a Tree.
- The install check says so. Pointing a fixture at a Sapling shows "A Sapling becomes a Tree, so it can't hold a fixture." The Sapling isn't offered as a host, so Garden Lights with only a Sapling to go in are greyed out and count as not fitting for the free redraw.
- A fixture that doesn't fit the piece anyway, such as a Sprinkler, still says where it goes.
- A piece that transforms into another piece would keep its fixture, as a Bay Window stays when its room becomes interior.

**Why:** Garden Lights fit any yard piece, and the Sapling is one. When the Sapling became a Tree, its piece left the house and took the lights with it. The preview didn't warn about it, and the only thing on screen was "Grew into a Tree!". §4 names two ways a fixture leaves: a new one replaces it, or its host is demolished. The check is in the rules, so every fixture gets it, including new ones written as data, without naming the Sapling.
**Considered:**
- Taking the Sapling out of Garden Lights' `fits`. It's one line of data, but the card would read "Fits a yard piece and anything but Saplings" unless the text code learns a new phrasing, and every later yard fixture would have to repeat it.
- Returning the fixture to supplies when its host transforms. Demolition gives no refund (D-050), and supplies can be full.
- Keeping the loss and warning about it in the install preview and the transform's popup. That's more UI work, and the player still loses the card.

**Changes:** D-050 (Accepted): adds where a fixture can't go; how it leaves is unchanged. `implementation-plan.md` §4's fixture rules and the note under Appendix B's fixtures table. Garden Lights' card still says "Fits any yard piece". The sim's bots choose hosts through the same check, so they no longer put fixtures in Saplings.

### D-015 · Start small, grow into the corporation
**Status:** Proposed
The company starts as a two-person outfit with a pickup truck, and growing it is the meta-progression. Players name their company, and the name shows up next to shared scores.

### D-016 · Unlocks over power
**Status:** Proposed
Meta-progression unlocks new crews, clients, and pieces rather than permanent stat boosts, so runs stay challenging. The currency is Reputation, earned from finished jobs, with a bonus for early completions.

### D-017 · Difficulty is a separate setting
**Status:** Proposed
Contract difficulty tiers add HOA rules, rush jobs (fewer weeks), and tight budgets (a pricier shop), independent of which client you get.

### D-022 · Daily Lot
**Status:** Proposed
The same lot, client, and card draws for everyone each day, with a shorter run and a copyable result line for the group chat.

### D-023 · One extra floor at most for the jam: the basement
**Status:** Proposed
Floors are layers on the same grid with a floor switcher, with the other floor shown faded for reference. The staircase is a piece you draft. Basement only, and only as a stretch goal.

### D-024 · Endless mode after the Final Walkthrough
**Status:** Proposed
After winning, keep going with rising targets and more change orders. Nearly free if the milestone system keeps generating phases.

### D-031 · Client rarity tiers
**Status:** Proposed
Common, Uncommon, and Rare clients. The proposed lineup is in `content-brainstorm.md`, section 10.
**2026-11-06 (M4a):** built with five Core clients: the Hendersons, the Barkers, and Dale are Common, Juniper Uncommon, and Count Vladislav Rare.

### D-032 · Job board at run start
**Status:** Proposed
Choose from two or three contracts, each one a client plus a lot.
**2026-11-06 (M4a):** built: three contracts drawn by rarity (Common 65, Uncommon 27, Rare 8; D-026), each with a thumbnail of its lot, its wishes, household, and tastes. On a first visit the Hendersons come first, marked Recommended. The board sits outside the run code.

---

## Parked

- **Renovation mode:** the client lives in the house while you do renovations and additions. Revisit once the core is fun.
- **Upstairs floor:** revisit after the basement.
- **Tour-order scoring:** the walkthrough as a scoring chain, where some rooms boost every room visited after them. Interesting, but hard for players to predict.
- **Company HQ screen:** a visual home for meta-progression.
- **Merged rooms** (the team's idea from playtest 5a, 2026-11-07): two Living Rooms that become one big living room, or two Bedrooms that become a primary bedroom, with a limit so rooms can't merge endlessly. It's D-093's option 4 in another form. Of the three ways sketched in `content-brainstorm.md` §15, the team picked *Extend a room* as the closest: a spare room card grows a room of its type into one bigger room, on the model of M4's Renovate (D-102). Revisit after playtest 4 has tried Renovate.

## Open questions

D-074 to D-080 came out of playtest 2 (M2, 2026-11-05), D-090 to D-093 out of playtest 3 (M3, 2026-11-06), and D-094 out of the Combolands systems research the same day. The team asked to hold off on changes until more of the game is in, so each one is Open until a later phase picks it up. On 2026-11-06 the team settled D-093 (now Accepted, with D-101 to D-105), D-074 (D-106), and D-092 (D-107) for M4. On 2026-11-10 the user chose D-094's option 1 for the jam (now Accepted; options 2 to 4 are Parked until after it).

### D-074 · Packs: Fences, Driveways, and Hallways that you shape
**Status:** Decided · 2026-11-06: the team chose Fence and Driveway packs for M4a (D-106). Was Open, from playtest 2; the direction (a week may place more than one piece) was confirmed by the team.
**Finding:**
- The player never built a fenced yard or used a Driveway, and found Hallways hard to get.
- A fenced yard needs 2–3 Fence cards in the right shapes, plus open ground. Fences are complexity 3, so they're rare before milestone 4.
- D-072's enclosure probe counted placements, not the odds of drawing that many Fences.
- A Fence pays at most +6 a week.
**Idea (the team's):** Fences, Driveways, and Hallways come as packs. One card places several segments of its type in one week, so the player shapes the run any way they like.
**To decide:**
- Pack size and the shape rules, for example a number of single tiles that must connect.
- Whether a pack makes one piece or several, which matters for scoring, links, demolition, and the Fence's cap.
- How placing and previewing several segments works within one week.
- How the sim's bots place packs, and whether the 1×N and L cards stay.
**Would change:** D-004 and D-036 (one placement a week), D-049 (the bigger yard shapes), D-071 (the variant cards), and D-072 (the enclosure probe should include draw odds).
**2026-11-06 (playtest 3):** still no Fences in the player's run. M4a's Hendersons want a fenced yard, and the Barkers one of 12 tiles.
**2026-11-06 (Combolands research):** Combolands' walls, palisades, plateaus, and rails are building cards that each place several pieces, and two demo patches raised how many (walls 5 → 6, rails 2 → 3 → 4). Its walls were still skipped: one forum thread's opening post says enclosing anything takes two 6-wall cards and turns off the adjacency bonuses that make most points *(guide)*. See research.md's 2026-11-06 systems update.
**2026-11-06 (systems review):** under the review's tidy-yard rule, Fences and Driveways count toward the yard's 6 pieces but never break the rule, so packs of them stay free (`house-systems-review.md` §4).

### D-075 · Banked buildings: shop goods that place an extra piece in a week
**Status:** Decided · 2026-11-05: the team chose a tool, Weekend Crew (D-083). Was Open, from playtest 2 (the team's idea, after Combolands' blueprints and potions).
**Idea:** Shop goods you hold and spend to place more than one building in a week.
**Naming:** our Blueprints are run-long rule-benders (D-051), unlike Combolands' blueprints. So this would be a new kind of supply or a tool kind.
**To decide:**
- What it is: a tool, a reserve card, or a supply.
- Its price, and whether it stacks.
- How it works with the reserve (bought pieces wait there, D-051) and with packs (D-074).
- The sim bots' policy for using it.
**Would change:** D-004; D-051, which left out "a tool that plays a second piece in a week".

### D-076 · Banning card types from the draws
**Status:** Decided · 2026-11-05: the team chose a shop service (D-084). Was Open, from playtest 2.
**Idea:** Let the player strike a card type so it stops showing up, in the spirit of Luck be a Landlord's removal tokens.
**Options:**
- A shop service priced in budget. That would give budget, and so early completion's reward, a clear use.
- A crew or upgrade perk.
- A few per run.
**Would change:** D-043 (draw weights are fixed for the run) and D-051 (the services).

### D-077 · Tooltips that explain the game's terms
**Status:** Decided · 2026-11-07: built with M4 (below). Was Open, from playtest 2; its first pass, with the shop, is D-086.
**Finding:** Early completion was tempting, but its payoff was unclear. Budget does nothing until the shop, and nothing says so. The Driveway's front-yard rule was hard to read (D-080).
**Idea:** Hover tooltips for:
- Comfort and Charm
- budget and what it's for
- the early-completion bonus
- the front and back yards, and fenced yards
- requirements (Garage, Driveway, Doghouse)
- Hallway links, and timers
**To decide:** When (with M3's shop, or with D-045's first-time hints in M4b), and how. The text should be generated from the rules data, as card text is (D-038).
**2026-11-06 (Combolands research):** Combolands' most requested feature after launch was a compendium of the run's buildings, heirlooms, and councillors (v1.0.5), and v1.0.7 took a confusing "counts as fish" line off a card. See research.md's 2026-11-06 systems update.
**2026-11-07 (M4):** the board's terms are in the rules' glossary, written from the content: the front and back yards, fenced yards (with the 10-tile minimum), requirements (each base-pool piece's), Hallway links, timers, Renovate, and the checklist. Inspect puts them on its region names, requirement lines, link mentions, and timers, and a granted tag names where it came from ("Dark · from Eternal night"). First-time hints (D-045) cover the first week, the checklist, Complete early, the shop, a fixture, a change order, and an arrival.

### D-078 · Terrain and the house's position should matter more
**Status:** Open · 2026-11-05, from playtest 2.
**Finding:** The player felt neither mattered. In their run, Charm produced 3,128 of 5,382 Wow (58%), and terrain and street lines were 21 of the last week's 100 flat points.
**Options:**
- Pieces and client specs that care about the lot. M4a's clients already ask for things like a fenced yard of 12 tiles.
- Bigger terrain terms.
- Shading the front yard and the sunny side on the board while placing.
New content is preferred over raising existing numbers.
**2026-11-06 (playtest 3):** the player sites the house in the middle of the lot, neither near the street nor far back, and didn't feel pulled either way. D-089's sim says otherwise for greedy: houses 0–3 rows from the street win 69%, and 10 or more rows back 48%.
**2026-11-06 (Combolands research):** in Combolands, each kind of map feature has buildings that need it, make it, or clear it for a payout, and players read the island before picking guilds. Here only the Sapling makes terrain, Boulders give nothing, and clearing a Tree pays nothing. See research.md's 2026-11-06 systems update.
**2026-11-06 (systems review):** under the review's option B, Charm's share of greedy's Wow rises from 59% to 73%, which works against this entry. M4a's Suite and Full House, which ship anyway, are part of that rise. Of the new rooms, only the Kids' Room reads the terrain, through Trees (`house-systems-review.md` §8, §10).

### D-079 · Treehouses shouldn't reward clustering
**Status:** Decided · 2026-11-06: the team took the review's Kid half in D-105 (Treehouses don't count each other as Kid partners), to stand unless M4a's sim showed the Hendersons' Kid taste making clusters dominant. It doesn't (below). Was Open, from playtest 2.
**Finding:** Three Treehouses touching each other earned 288 Wow, more than every Bedroom in the run. Each counts the others as Kid neighbors, on top of D-071's extra +2.
**Idea (the team's):** Reward one Treehouse per forest. Pay per touching Tree, and don't let Treehouses count toward each other's Kid bonus, or penalize them for touching.
**Would change:** D-071's Treehouse default.
**2026-11-06 (playtest 3):** Treehouses feel better: not overpowered, but still worth building. Their rules haven't changed since playtest 2; the shop's goods grew the rest of the house around them. The Hendersons like Kid pieces (+50%, M4a), which may make them strong again.
**2026-11-06 (Combolands research):** the Treehouse both reads Kid and is the base pool's only Kid piece (the Playroom is a shop piece), so Treehouses earn most by touching each other. Another Kid piece in the base pool would give them something else to touch, and another piece that reads Kid would give Kid pieces somewhere else to pay. Combolands keeps two of the same building out of each other's range *(guide)*.
**2026-11-06 (systems review):** both halves were simulated with the review's house rules.
- In round 2, adding the Kid half to the package cut wins with 3+ Treehouses from 26% to 13%. That half means Treehouses don't count each other as Kid partners.
- Under option B, 12% of wins have 3+ Treehouses, against 21% today.
- The rule needs Renovate beside it: under option A, which has the rule but no Renovate, 25% of wins have 3+ Treehouses.
- Paying per touching Tree made Treehouses more common and pushed them deeper into the woods.
- The review recommends only the Kid half, keeping D-071's steady +2 (`house-systems-review.md` §4).
**2026-11-06 (M4a sim):** with the Kid half in, 1,000 held-out greedy runs: the Hendersons place 1.2 Treehouses a run, earning 1.9% of their Wow (other clients 1.6–2.0%); 3+ Treehouses in 11–15% of wins.

### D-080 · The Driveway: legibility, and a purpose without a Garage
**Status:** Open · 2026-11-05, from playtest 2.
**Finding:**
- The player read the Driveway as paying only when perpendicular to the street. In fact a 1×3 earns +1 either way. A Long Driveway standing up earns 0 when it reaches above the house's front row, because only the front yard pays.
- With no Garage drawn, the Driveway has no purpose.
**Options:**
- Show the front yard on the board while placing.
- Make it a pack (D-074).
- Give it a bonus of its own.
- Make a Garage likelier once a Driveway is down.
**2026-11-06 (playtest 3):** the player built more Driveways this time (two Long Driveways in their run).
**2026-11-06 (Combolands research):** a Combolands railroad makes everything beside it count as beside everything else along it *(guide)*. A Driveway could link the yard pieces along it the way a Hallway links rooms, which would give it a job without a Garage.

### D-090 · Budget from how you build
**Status:** Open · 2026-11-06, from playtest 3.
**Finding:** The budget felt about right. But it comes almost entirely from milestones: in the playtest run, 30 of 41 came from milestones and one early completion, and 11 from two Home Offices. Where and what you build barely changes what you earn.
**Idea (the team's):** more ways to earn budget through placement, the way some Combolands buildings and interactions pay gold. (research.md doesn't yet say which ones.)
**Options:**
- Pieces that pay budget for their neighbors or their spot, beside today's economy pieces (Garage, Home Office, Henhouse) and Solar Panels (Sunny pieces pay).
- Fixtures that pay budget.
- Sets that pay budget once when completed (Appendix A allows a set's one-time reward), as some room-completion rewards in Castles of Mad King Ludwig pay money.
- More finds that pay, like the Time Capsule.
**To decide:** which sources, and how big. A run's total should stay near D-085's band, so milestones may pay less. How the shop bot values them.
**Would change:** D-013 and D-085.
**2026-11-06 (Combolands research):** research.md now lists what pays gold ("Combolands: what pays gold", in the houses update). The systems update adds three patterns: a paint that pays a coin each time its building fires, for 8 weeks *(guide)*; a Vault that scores from the gold you hold *(guide)*; and removals that pay, such as manure (demo v9). Here they'd be a fixture, a piece, and a demolition reward.

### D-091 · Finds worth building around
**Status:** Open · 2026-11-06, from playtest 3.
**Finding:** The player noticed both finds, and demolished the Old Shed in the first week. Clearing it is a no-brainer: one demolition buys a random tool (a Rush Order, in their run) and frees a 2×2 that blocks building.
**Idea (the team's):** the Old Shed boosts buildings where that makes sense, so keeping it competes with clearing it.
**Options:**
- Pieces that would use a shed (a Garage, a Henhouse, a garden) earn more while they touch it.
- Its reward grows the longer it stands, so clearing it later pays a better tool.
- Time Capsules get a choice of their own.
**To decide:** which pieces, and how much; whether demolishing it still pays a tool; how the bots choose.
**Would change:** D-082's finds, and Appendix B's Old Shed and Time Capsule rows.
**2026-11-06 (Combolands research):** Combolands' rocks are an obstacle for some buildings and a resource for others: Barracks score for each rock nearby, and other buildings clear rock for value. An Old Shed that some pieces count, and that a salvage piece clears for more, would make keeping it a choice.

### D-092 · Telling whether a fixture is worth it
**Status:** Decided · 2026-11-06: the team chose a best-host line in the shop and a gain on every host while installing (D-107), built with M4b's UI. Was Open, from playtest 3.
**Finding:** Fixtures feel okay, but it's hard to tell whether one is worthwhile. The shop shows a fixture's text alone. On the board, pointing at a piece shows that piece's earnings this week before and after (D-087), one host at a time. Nothing says what a fixture adds over the rest of the run. The player installed six in their run: two Fireplaces, two Pergolas, a Kitchen Island, and Bunk Beds.
**Options:**
- In the shop, a fixture names its best host in your house and what it would add this week.
- While installing, every legal host shows its gain, so the best one stands out.
- The gain over the weeks left, since a fixture stays for the run.
- A comparison with the fixture it would replace.
**To decide:** which of these. The numbers come from `preview()`, so the UI still never scores anything itself.
**Would change:** D-087.
**2026-11-06 (Combolands research):** Combolands previews a building's score before you place it, yet a reviewer still wanted to try placements before committing (Geekly Grind), and its players asked for a compendium after launch.

### Earlier open questions

- ~~Art direction and tone~~: decided by D-057 (cozy pixel art), 2026-11-05.
- ~~Sound and music approach~~: decided by D-058 (calm music, escalating reward sounds), 2026-11-05.
- Exact numbers. `jam-scope.md` has placeholders to tune with playtests and simulated runs.
- ~~Score name (D-019)~~: decided 2026-11-05: Comfort × Charm, with rare Sparkle, totaling Wow.
