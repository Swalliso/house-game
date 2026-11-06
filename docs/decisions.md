# Open House — Decision Log

Our game jam entry for the theme **"It's a house."** A one-week jam with friends, built with Claude Code.

**How to use this file:** each entry is one decision with a status. Update the status instead of deleting entries. When a decision changes, mark the old entry *Superseded* and point to its replacement.

| Status | Meaning |
|---|---|
| Accepted | Agreed; build on it |
| Proposed | Suggested, waiting on a yes or no |
| Parked | Good idea, deliberately deferred |
| Open | Needs a decision |

Related docs: `research.md` (sources and reference notes), `content-brainstorm.md` (draft pieces, clients, and crews), `jam-scope.md` (jam scope and starting numbers), `implementation-plan.md` (architecture and build order).

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
**To be amended by:** D-074 and D-075 (Open). The team confirmed after playtest 2 (2026-11-05) that a week may place more than one piece, through packs or banked buildings.

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
**Amended by:** D-056 (Accepted 2026-11-05): the Rare Chandelier, a ×Mult source, makes 11 fixtures (8 for rooms).

**Why:** Fixtures make the house better without making it bigger, so late placements still matter (the snowball problem in `implementation-plan.md` §2), and every hand offers a choice between growing and improving. Combolands' closest equivalent is its single-building upgrades, which are bought consumables. Floor Plan draws features into existing rooms the way our hands draw fixtures. The cost decides the split: a drawn fixture costs a week, so it competes with a piece, and a bought one costs budget, so it's free to install.
**Considered:** Every install as a free action, which turns the hand into a shopping list. Every install costing a week, which makes bought fixtures a poor buy. Fixtures only in the shop.
**Changes:** D-004 (Accepted): a week's turn can be an install instead of a placement. A week never gets a second piece. `jam-scope.md`: Fixtures move from Stretch into the jam build.

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
- The shop is open in every run, including the first.
**Amended by:** D-056 (Accepted 2026-11-05): 18 blueprints, 11 fixtures, and 12 tools from 7 kinds (the Remodel Plans level sets); It's a House and Rush Order become +Mult, and Last-Minute Push becomes ×Mult.

**Why:** The team asked for much more variety. Combolands' shop mixes passives, consumables, single-building upgrades, and packs, with stock that grows over a run. Balatro, Slay the Spire, and others add the patterns that make each visit feel different: guaranteed category slots, a sale, escalating rerolls, packs, and selling for half. Combolands players say its locked early shop made first runs drag. Each good reuses an existing building block or adds one small mechanism (a tool kind, a rule key, the crate screen), so the catalog stays data. Sources are in `research.md`'s 2026-11-05 update.
**Considered:** Freezing an offer for the next visit (Super Auto Pets, Backpack Battles), held for Stretch. A tool that plays a second piece in a week, left out because it would break D-004. An Overtime Voucher tool, left out because it would change D-041's 2 overtime weeks. "Sell-to-use" blueprints (Combolands' Loaded Dice), which tools cover more simply.
**Changes:**
- D-004 (Accepted): tools and bought fixtures are free actions during a week, and none adds a second piece.
- D-013 (Accepted): selling, the skip reward, and Savings Account interest are budget sources.

Also: D-036 and D-043 (Accepted), where hand size becomes the `handSize` rule (3 by default, 4 with Bigger Truck). D-046 (Accepted), where this replaces its shop defaults in Appendix A (one paid refresh per visit, no selling).

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

### D-053 · A two-person, phased build with a playtest after each phase
**Status:** Accepted · 2026-11-05 (requested by the team)
**Decision:**
- The team is two: the user and Claude. Claude implements; the user playtests, reviews, and decides.
- The build goes in phases, M0 to M7 (`implementation-plan.md` §7). M1 to M6 each end with something playable, a short list of playtest questions, and a fix pass before the next phase starts. M0 is setup, and M7 is the release.
- There are no day timeboxes. The phase order is the priority order, so stopping after any playtested phase leaves a working game.
- Before each playtest, Claude runs the tests and the sim, plays a quick run in the browser pane, and writes a short note on what to try.

**Why:** The other jam members are building their own games, so there are no parallel tracks to coordinate. There's until next week to build and playtest before sharing with the larger group, and playtesting at every phase catches what isn't working while it's still cheap to change.
**Changes:** Supersedes D-052. D-029 (Accepted): its suggested build order.

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

### D-043 · Draws: distinct, weighted, phase-gated
**Status:** Accepted · 2026-11-05 (with the plan's approval); proposed 2026-11-04
**Decision:**
- Each hand holds `handSize` (3 by default) distinct card types: pieces, plus fixtures from phase 2 (D-050).
- Weights are integers (10 = normal) and come only from the piece, client, and crew, so they're fixed for the run.
- Special pieces have weight 0 unless a client or crew adds them.
- The client's spec pieces get +100%, and their signature special pieces (Library, Mudroom) are added at weight 20.
- Each piece has a `fromPhase`, so phase 1 draws only simple pieces. *Refined by D-055: simple pieces are weighted up early instead of complex ones being locked out; `fromPhase` stays only as a hard gate where a card can't work yet.*

**Why:** With uniform draws, the Hendersons' checklist takes a median of 23–24 weeks to complete, and about 6% of runs never finish it (estimate from a planning model). With weighting, the median is 14–16. The phase gate keeps the first run learnable.

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
- **Hallway:** links every room touching it, not just the rooms at its two ends.

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

### D-073 · M2 interface defaults
**Status:** Accepted · 2026-11-05 (proposed with the M2 pull request; held up in playtest 2, confirmed by the team).
**Decision:**
- **The title screen** comes first, with Start, Continue (when a run is saved), How to play, and Settings. A `?run=` or `?seed=` link goes straight to the game.
- **The camera** (D-057): the wheel zooms in whole steps from 1× to 6×, keeping the tile under the pointer in place; dragging pans; Fit (F) shows the whole lot at the largest scale that fits. The default is still the largest whole scale of at least 2× that fits.
- **Irreversible actions take two presses,** like Pass (D-068): Complete early, and a demolition (click the piece, then click it again).
- **The top bar** shows the forecast as a marker on the progress bar, the overtime counter as clocks, the budget, and the auto-complete switch (off by default, D-040).
- **The ?debug panel** is a small floating panel: jump to a milestone with a bot-built house, meet the target or force a miss, add budget, give a card, and instant tallies.

**Why:** Choices §7 leaves to the build.

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

---

## Proposed

### D-071 · M2 content defaults
**Status:** Proposed · 2026-11-05, with the M2 pull request; to confirm at playtest 2.
**Decision:**
- **Shapes and tags** Appendix B leaves open come from `content-brainstorm.md` §3, §4, and §6, as D-067 did: Closet 1×1; Garage 2×2, Loud; Home Office 1×2, Quiet; Sapling 1×1, Green; Flower Bed 1×1, Green and Pretty; Herb Garden 1×2, Green; Patio 2×2, Outdoor and Social; Doghouse 1×1; Treehouse and Greenhouse 2×2.
- **Card names** for the shape variants: Long Hallway (1×3), L-Fence (the 5-tile L), and Long Driveway (1×5), each sharing its type with the short card.
- **Every card is weight 10,** as in D-067, so the four types with two cards (Kitchen, Hallway, Fence, Driveway) come up about twice as often.
- **The Treehouse** also earns a steady +2. Appendix B gives it only +2 per Kid neighbor, and the base pool has no other Kid piece until the shop's Playroom, so it would be a dead card in M2.
- **The Kitchen** now earns +2 per touching Herb Garden too (D-067 deferred it to M2).

**Why:** Defaults so every base-pool piece is playable in M2; each is a line of data.
**Playtest 2:** the Treehouse's extra +2 plus its Kid bonus made clusters too strong (D-079). The other defaults held. It stays Proposed until D-079 is settled.

### D-081 · M3 rules structure
**Status:** Proposed · 2026-11-05, with the M3 pull request. Implementation details within D-050, D-051, D-056, and Appendix A · M3a and M3b.
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
**Status:** Proposed · 2026-11-05, with the M3 pull request; to confirm at playtest 3.
**Decision:**
- **Shapes Appendix B leaves open:** Playroom 2×2, Library 2×2, Mudroom 1×2, Pool 2×3.
- **Skylight, Blackout Curtains, and Bunk Beds also earn +25%** on their host. Their Appendix B effects (Sunny, Dark, counting twice) pay off only with a blueprint or M4a's specs, so they'd be dead cards in M3's draw.
- **Held back until M4a:** Dream Home (blueprint) and Inspector's Visit (tool) act only on specs, so the shop doesn't offer them; the Remodel Plans for Suite and Full House join with those sets.
- **Shop stock:** a card slot is a fixture half the time, otherwise a special piece. Tools cost 2, 3, or 4 by rarity; crates 4; upgrades 6–8 (Appendix A's placeholders).
- **Finds:** one Old Shed and one or two Time Capsules a lot.

**Why:** Defaults so every M3 good does something in M3; each is a line of data.

### D-085 · M3 balance: the milestone budget and the targets
**Status:** Proposed · 2026-11-05, with the M3 pull request; numbers for the sim and playtests to tune.
**Decision:**
- **Milestones pay 4 budget,** not Appendix A's 3. At 3 the greedy bot (which never completes early) earned a median 25 a run against the plan's 30–40, so the shop was too tight to plan around.
- **Targets** (`--suggest-targets`, 200 runs, with the shop bot): 15, 150, 470, 1,050, 2,250, 4,950, 9,750 Wow, up from M2's last target of 5,300. The shop's blueprints, fixtures, and tools roughly double a late-run week. D-072's survival curve and criteria still hold: greedy clears milestones 1–3 95% of the time and wins 44%; random wins none and mostly fails at milestone 2.
- The shop's other numbers are Appendix A's placeholders, in `balance.ts`.

**Changes:** Appendix A · M3a's +3 per milestone. D-072's targets.

### D-086 · Tooltips, first pass (with the shop)
**Status:** Proposed · 2026-11-05, with the M3 pull request (the team chose the light pass of D-077 for M3).
**Decision:**
- Hover or focus a dotted-underlined term for a short explanation. One fixed tooltip layer, so scrolling panels never clip it.
- The text comes from the rules (`glossary()` in `text.ts`), with its numbers read from `balance.ts`, as card text is (D-038).
- Terms: Comfort, Charm, Sparkle, Wow, budget, complete early, fixtures, the reserve, supplies, blueprints, rarity, the sale, the refresh, saving up (the skip reward), services, strikes, tools, crates, and company upgrades.
- Board terms (yards, requirements, links, timers) wait for D-078 and D-080.

**Changes:** D-077 (Open): its first part.

### D-087 · M3 interface defaults
**Status:** Proposed · 2026-11-05, with the M3 pull request; to confirm at playtest 3.
**Decision:**
- **The shop** is a sheet over the board, after the milestone's tally and banner. A section per kind of good; "Look at the lot" hides it; the leave button says what leaving without buying pays.
- **The inventory** sits above the hand: reserve, supplies, and blueprint slots, with owned upgrades under Company. Hover an item to read it in the inspect panel, with Sell. A reserve piece places like a hand card.
- **Installs and tools follow D-073's two presses** for free, irreversible actions: a supply fixture installs on a second click on the same piece; the Copy Machine copies on a second click; the Moving Truck picks a piece up, shows its ghost, and moves on a second click on the same spot. Other tools have a Use button in the inspect panel, with what they'd do to this week's total. A hand fixture goes in tentatively, like a hand piece, and End week commits it.
- **Rarity** is a colored border plus a label: Common green-grey, Uncommon blue, Rare gold.
- **Juice (D-059):** budget counts coin by coin (§12); Rare goods shimmer in with a sound; a bought good pops and stamps; crate options turn over one at a time with a glow by rarity; ×Mult sources land as gold Sparkle stamps on their own beat; Crown Jewel marks its top earner; installs, tool uses, moves, and finds get their own popups.
- **Debug:** Force the shop, Give any good, and Jump stops at the shop before the chosen milestone.
- **Art:** placeholder sprites for the special pieces, the Old Shed, and Time Capsules; fixtures and tools wear text glyph badges until M5's art.

**Why:** Choices §7 leaves to the build.

### D-088 · The M3 sim: the shop bot and the economy reports
**Status:** Proposed · 2026-11-05, with the M3 pull request.
**Decision:**
- **The shop bot** values each offer by one tally with it applied, times the weeks left in the run, per unit of budget: blueprints on the house as built (×1.25 for pieces built later; Last-Minute Push weighted by the last week; Good Bones by its growth), reserve pieces at half their best placement (they take a week), fixtures at their best install, tools by their rule, crates by the best of a few sample options, upgrades and services by rough heuristics. It buys the best value while it earns at least 0.12 weeks of current income per budget; keeps the best crate option; sells its weakest blueprint for a much better one; refreshes once when it has 8 more than the refresh costs and nothing is worth buying.
- **Tool rules:** Remodel Plans and the Dumpster at once; Fertilizer unless it costs this week; the Copy Machine on the top earner; Weekend Crew when a placement would help; Rush Order and Open House Party in a phase's last week when short of the target, or in the run's last week; the Catalog on a hand with nothing worth building and no rerolls. It never uses the Moving Truck. Supply fixtures go in their best host.
- **Reports:** how often each good is offered, bought, kept from crates, and in runs and wins; budget earned and left unspent; skip rewards and sells; installs per fixture (from the hand and from supplies) and uses per tool, each with its average weekly gain. `--json` writes every run's record.
- **The random bot** also shops and uses tools at random, so the smoke sim covers the economy.

**Why:** §7 M3b and §8's added reports. A value-per-budget bot is the plan's design; the heuristics are rough, and the reports show what they buy.

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

### D-032 · Job board at run start
**Status:** Proposed
Choose from two or three contracts, each one a client plus a lot.

---

## Parked

- **Renovation mode:** the client lives in the house while you do renovations and additions. Revisit once the core is fun.
- **Upstairs floor:** revisit after the basement.
- **Tour-order scoring:** the walkthrough as a scoring chain, where some rooms boost every room visited after them. Interesting, but hard for players to predict.
- **Company HQ screen:** a visual home for meta-progression.

## Open questions

These came out of playtest 2 (M2, 2026-11-05). The team asked to hold off on changes until more of the game is in, so each one is Open until a later phase picks it up.

### D-074 · Packs: Fences, Driveways, and Hallways that you shape
**Status:** Open · 2026-11-05, from playtest 2. The direction is confirmed by the team: a week may place more than one piece, overriding D-004 once this is decided.
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
**Status:** Open · 2026-11-05, from playtest 2. Its first pass, with the shop, is D-086; the board's terms are still open.
**Finding:** Early completion was tempting, but its payoff was unclear. Budget does nothing until the shop, and nothing says so. The Driveway's front-yard rule was hard to read (D-080).
**Idea:** Hover tooltips for:
- Comfort and Charm
- budget and what it's for
- the early-completion bonus
- the front and back yards, and fenced yards
- requirements (Garage, Driveway, Doghouse)
- Hallway links, and timers
**To decide:** When (with M3's shop, or with D-045's first-time hints in M4b), and how. The text should be generated from the rules data, as card text is (D-038).

### D-078 · Terrain and the house's position should matter more
**Status:** Open · 2026-11-05, from playtest 2.
**Finding:** The player felt neither mattered. In their run, Charm produced 3,128 of 5,382 Wow (58%), and terrain and street lines were 21 of the last week's 100 flat points.
**Options:**
- Pieces and client specs that care about the lot. M4a's clients already ask for things like a fenced yard of 12 tiles.
- Bigger terrain terms.
- Shading the front yard and the sunny side on the board while placing.
New content is preferred over raising existing numbers.

### D-079 · Treehouses shouldn't reward clustering
**Status:** Open · 2026-11-05, from playtest 2.
**Finding:** Three Treehouses touching each other earned 288 Wow, more than every Bedroom in the run. Each counts the others as Kid neighbors, on top of D-071's extra +2.
**Idea (the team's):** Reward one Treehouse per forest. Pay per touching Tree, and don't let Treehouses count toward each other's Kid bonus, or penalize them for touching.
**Would change:** D-071's Treehouse default.

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

### Earlier open questions

- ~~Art direction and tone~~: decided by D-057 (cozy pixel art), 2026-11-05.
- ~~Sound and music approach~~: decided by D-058 (calm music, escalating reward sounds), 2026-11-05.
- Exact numbers. `jam-scope.md` has placeholders to tune with playtests and simulated runs.
- ~~Score name (D-019)~~: decided 2026-11-05: Comfort × Charm, with rare Sparkle, totaling Wow.
