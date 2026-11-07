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
**Amended by:** D-097 (Accepted 2026-11-06): M5 splits in two, each ending in a playtest. M5a (art, UI chrome, and the visual juice) comes before M4, and M5b (sound and music) after it.

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
  - Doorways between touching rooms, windows in outside walls, and a front door are chosen by fixed rules and a tile hash, never by chance. They are decoration and change no score.
  - Furniture is laid out by rules per room type and footprint: several LimeZu sprites per room, never rotated (they're drawn in 3/4 view). Rooms of the same type vary by piece.
  - Fixtures show as sprites where they fit, and as a badge otherwise.
- **Palette:** LimeZu's, with its outline color #3a3a50 as the ink. Our own drawings sample it. The 32-color and 8-per-sprite limits apply only to the text-grid placeholders.
- **Pipeline:**
  - `art/limezu/*.json` lists each sprite we use: its pack, the path in the zip, its rect, and any frames or edits.
  - `npm run art:cut` runs locally only. It reads the zips in `art-source/` and writes only the listed sprites to `assets/limezu/`.
  - `npm run atlas` packs them with the placeholders at any size; a cut replaces the placeholder with the same id.
  - Every cut has its own entry in `assets/licenses.json`. `CREDITS.md` and the game credit LimeZu.
  - A test fails on a cut without a manifest entry or a license record.
- **Order:** M5 splits. M5a (art, UI chrome, and the visual juice) comes now, before M4. M5b (sound and music) follows M4.
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
**2026-11-06 (D-089):** the shop bot no longer strikes card types unless asked (`--strikes fixed` keeps D-084's order). It values the +1 reroll service at 0 while it holds a bonus reroll, and the Catalog at 0: it bought 21 in 100 runs and used none. `BOT_BLIND` lists every good it values at 0 by construction, and the economy report says so in its Bot column. "Wins" is confounded by run length, so strength questions go to `--ban` and `--gift`. The chaos test, not the random bot, now covers every economy action.

### D-089 · Gameplay tests and the sim's second pass
**Status:** Proposed · 2026-11-06, with the fix/gameplay-tests pull request. The targets don't change here: re-running `--suggest-targets` is the team's call.
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

### D-096 · The tally's closing beats aren't auto-accelerated
**Status:** Proposed · 2026-11-06, with the fix/ui-audit-bugs pull request (the UI and juice audit, item 9). It changes a detail of §12's Timing, approved with the plan under D-059, so it waits on the team's yes.
**Decision:** Auto-acceleration speeds up a tally's steps only: the triggers, the sets, and the ×Mult stamps. From the multiply moment on, the beats play at the chosen speed: the pause, the total's hold, the count-up, the target's ding, and the milestone's hold. Holding Space or the right button still fast-forwards them, and a click still skips.
**Why:** The accelerator kept growing through those beats, so the longest weeks, usually the biggest, got the shortest payoff. A 25-trigger week at 1× is at about 2× by the multiply moment, so its 0.4 s pause took about 0.2 s. The steps are where a long week drags; the payoff is short at any length.
**Changes:** `implementation-plan.md` §12, Timing. D-059 (Accepted) still holds: the tally speeds itself up.

### D-098 · M5a interface defaults: the pixel UI
**Status:** Proposed · 2026-11-06, with M5a's UI track (stage 2: part 1, the foundations, the build screen, the score panel and the top bar; part 2, the other screens). Implementation details within D-057, D-059, D-097 and §12; the number may move when the stage's tracks merge.
**Decision:**
- **Tokens:** every color is a token in `src/ui/theme/tokens.css`, from LimeZu's palettes with its outline #3a3a50 as the ink, with the UI audit's contrast fixes (secondary text #565972, Comfort #3d56d2, Charm #a82b52, Sparkle a gold fill under ink text). `theme.test.ts` keeps raw colors out of every other stylesheet but a shrinking legacy list (the screens still to restyle, and the board's), and checks each text color on its backgrounds at 4.5:1.
- **The UI pixel:** the chrome draws in its own pixel, `--px`: 2 CSS px at 1080p, rounded to whole device pixels and down on a tie, so 1.6 CSS px at 125% and 2 at 150% and 200%. Outlines, frames, shadows, spacing and pixel-font sizes are whole numbers of it. The board keeps the camera's scale. *Open for the team:* at 125% this makes pixel text 12.8 CSS px (16 device px, two per font pixel), so the 16 px floor holds in device pixels but not in CSS px. Rounding half up instead gives 2.4 CSS px and 19.2 px text, and lays the UI out like 1280×720 at 1×; that would also need the side columns sized in UI pixels (they're CSS px today, so they'd be narrower in UI pixels than at 1280×720).
- **Fonts (CC0):** Pixel Operator 8 for text and Public Pixel for numbers, at 8 × `--px` and its multiples, so nothing in pixel mode is under 16 px at 1080p. Public Pixel supplies the symbols Pixel Operator 8 lacks (− ≥ ≤ → ← ✓); ▲ ▼ ✕ ★ ⚠ are icons.
- **The readable-font option** (§12, D-059) is in Settings, saved with the others: every pixel text switches to the system font, at its own sizes.
- **Frames and icons are our own drawings** in LimeZu's palette (`theme/frames.ts`, `theme/icons.ts`): text grids turned into images at startup. They were drawn while Modern Interiors' license was an open question (D-097's note); the team has since cleared that pack, so a LimeZu piece can replace any of them where it looks better (`art/limezu/ui-mi.json`).
- **The top bar:** the milestone on a plaque, the milestone meter with a tick per week at the rules' pace and the target's flag, the budget beside a coin, the overtime clocks, the auto-complete switch, and Complete early, whose two labels share one cell so it keeps its width when armed and the second press lands where the first did (D-073). A Menu button opens a menu with Copy run code, the seed, How to play, Settings and Quit to title (the run stays saved for Continue). How to play and Settings keep their own buttons; the brand leaves the bar.
- **Coins come before amounts** everywhere, as on the budget's plaque: ●4, ●+1. Placed after a number, the coin read as a zero.
- **Sheets and the menu hold the keyboard** while open: focus moves in (the menu's Resume, a sheet's text), Tab stays inside, and focus goes back where it was when they close. A press that starts inside and ends on the scrim doesn't close them.
- **Pressing:** a hover lifts a control a UI pixel and a press sets it down; while pressed, its hit area reaches up over that travel, so a press at its top edge lands.
- **The controls strip** shows the keys for what you're doing now, as keycaps. On a window under 800 px tall it sits under the board only, so the side columns keep their full height, and leaves out what's least needed there (Scroll to zoom, Click to place, and the shop's two hints, which the sheet's foot covers), so it's one line.
- **The hand:** each card shows its piece's picture and its kind and tags as chips with icons. The picture is the piece as the board builds it, drawn unrotated by the board's own painters (the ghost's: a room's floor, furniture and outline walls, a yard piece's ground and props), and the shop's piece offers and How to play's sets use the same picture. Reroll and Demolish sit above the cards. The sticky bar holds square Rotate and Cancel buttons and End week, the view's one lime button, which sizes its words on its own width: it drops the Enter keycap first, then takes a short label (Pass, Again?). The picked card shows its shape as a small glyph, turned as the piece turns, so R shows with the pointer off the lot, and a card picked below the fold scrolls into view. On a window under 800 px tall the cards swap their pictures for that glyph, and in a narrow column Reroll and Demolish become an icon and a count on one row (Stop keeps its word while demolishing).
- **The inventory** stays hidden until the supply yard first opens, unless something's in it; empty slots are wells. On a window under 800 px tall the build screen leaves its empty rows out (the shop shows them). A name too long for its slot ends in an ellipsis.
- **The build stamp** moves to the bottom-left corner, clear of End week at 1280×720.
- **The shop** (D-087's sheet over the board) is a wood sheet. The budget is its header's hero counter, beside Refresh and Look at the lot. The goods are paper cards of one size packed onto shelves, as many sections side by side as the width holds, each card with an art slot (a piece's picture, or its kind's icon until the goods have sprites), its rarity as a band and a chip, a coin price, and Buy. Each section with goods that full slots block says so at its plank tag, in the rules' words (the advice after the first sentence only the first time the shop says it), and those goods' Buy buttons read Full. A good the budget can't reach shows its price in orange and a Buy that reads "Need 2", never the color alone. Leave is the sheet's one lime button, in a foot like End week's, with its saving bonus. Rare goods glint as they arrive, and the sale is a wood price tag. Hidden, the shop leaves a handle at the board's foot. A crate's options and the strike picker are sheets of the same cards over the shelves, sized to the board with their options scrolling inside and Set it aside or Cancel always in view; crate options glow by rarity in hard pixel steps. Below 800 px of height the cards drop their art.
- **The title screen** is a street at the street's whole-pixel scale: a banded sky with our own sun and clouds, and Modern Exteriors villas, trees, shrubs and planters on a lawn behind the street (`art/limezu/ui.json`), with a car that drives by (parked with Reduce motion). The lawn and the street are the lot's own (D-099): its grass with tufts and flowers, and the board's sidewalk, curb, road and dashed line. The menu is an "Open House" real-estate sign hanging from a post, its buttons hanging below it as riders. LimeZu is credited, with a link, on the far sidewalk. The wordmark stays in Public Pixel with the readable font, at 32 UI pixels (24 on a narrow window), so it's 48 px and up and on its font's grid in both modes.
- **Overlays:** the milestone banner is a ribbon stamped in, gold for a milestone met and orange for a miss or overtime, with its detail on a paper slip. "Target reached!" is a lime stamp; neutral notes are paper slips. Notes and toasts sit at the top center of the board, under the top bar; while the shop is open they sit inside it, under its header (and under a crate's sheet), so they never cover the goods or the hand. A toast raised while a sheet or the menu is open shows over it.
- **The board's labels** by the pointer (the ghost's change to the week's Wow or why it can't go there, and the install, tool and demolish labels) are the interface's chips: the pixel font, paper in the ink ring, a band in the label's tone, and a hard shadow. The preview's badges keep their small system-font numbers (a badge sits on one cell, and the pixel font has nothing under 16 px), square-cornered in the ink outline with a paper halo. The pieces' digits stay outlined system-font numbers that grow with the zoom.
- **Tooltips** (D-086) are paper notes with a pixel tail pointing at the term, placed on whole pixels. Terms keep D-086's dotted underline, drawn as pixel dots. The audit's idea of dropping the underline outside prose would amend D-086, so it's left to the team.
- **Settings** groups its controls (Game, Motion, Sound, Display) as pixel segmented controls, a switch and sliders. Settings, How to play and the copy fallback are wood sheets; How to play shows the formula as the score panel's own plaques, with icons and keycaps.
- **The end screen** stays in the right column (M6 builds the full-width finale): "Job done!" or "Run over" on its plank, the verdict as a stamp (gold for a win), the final Wow on the framed plaque, the milestones and stats as rows with icons, and New run kept in view down to the window's foot. "It's a house." is a wood sign over the board.

**Why:** The UI and juice audit (2026-11-06) found an interface that read as a web app beside the pixel-art board, with text at 9–13 px, hairline edges and blue for six meanings. D-057 asks for wood-panel frames and a chunky pixel font with a readable option. The audit's design system turned that into tokens, one pixel unit and a few primitives, so every screen shifts together.
**Changes:** None to settled decisions. D-073 (Accepted): the top bar keeps everything it lists. D-087 (Proposed): the inventory still sits above the hand, and the shop keeps its sections and the leave button's saving bonus, the button moving to the sheet's foot. D-086 (Proposed): unchanged, the underline only redrawn.

### D-099 · M5a lot defaults: the terrain in Modern Exteriors
**Status:** Proposed · 2026-11-06, with M5a's lot track (stage 2) and its merge into the phase branch. Implementation details within D-049 and D-097; §12 Art's Rendering bullets describe them.
**Decision:**
- **Grass:** LimeZu's muted grass on every cell, with a tuft on about 1 subtile of open ground in 11 and tiny flowers on 1 in 23, by tile hash salted with the run's seed. The same run always looks the same, and no two runs share their decoration.
- **The sunny side** follows `isSunny` exactly. LimeZu's grass edge, recolored, reaches 6 px into the shade beside it. A Tree inside the band stays in shade to its cell's edge, and no sunny edge faces the street.
- **Water:** LimeZu's animated water (8 frames, 130 ms each) on its own canvas over the water's bounding box, autotiled per 16 px subtile, its bank's blades in the colors of the grass around it, and still under Reduce motion or in a hidden tab. A creek shows about 12 px of open water per cell (the static set's was about 22). Lily pads float on a pond's open water only.
- **The woods:** one LimeZu tree per Tree cell (eight kinds by hash, nudged up to 2 px), greens at 92% saturation, on a step-darker woods floor with soft edges and a verge of grass where it meets the street. A big 64×52 tree stands only on a 2×2 block of Trees that no piece can touch, so every Tree a piece touches is a tree of its own and can be counted.
- **The canopy:** what rises above its own cells (tree tops) is on a canopy canvas at `LAYER.canopy`, over the pieces and under their digits and badges, covering the lot and the row above it; it never takes the pointer. The terrain and water canvases share one `.ground` group at `LAYER.terrain`. The board keeps 24 art px clear above the lot (`CANOPY_ROOM`), so the top row's tree tops are never cut flat; the default zoom and Fit count it.
- **Finds and rocks:** two or three LimeZu rocks per Boulder; the Old Shed is LimeZu's shack at its own 48×64; the Time Capsule is dug soil with a shovel in it.
- **The street:** the street row is a sidewalk with its curb, the lot's grass hanging over its edge except where water or a piece meets it, so a Driveway runs onto the sidewalk. Below it, `ROAD_ROWS = 2` rows of decoration: asphalt with a dashed line, then the far curb. The default zoom, Fit, the camera and the board's height count them, and the pointer finds nothing there. A new run starts scrolled to the street row, the road a short pan below.
- **Around the board:** dimmed LimeZu grass (a 256 px tile with unevenly scattered tufts) that zooms and pans with the board, no drop shadow, and a faint property line on the lot's other three edges. The road and each creek mouth run on, dimmed, to the edges of the view.

**Why:** The audit's prototype renders (scale-B, test-abc123-B) set the bar: a calm, muted garden that makes the house stand out, with every terrain rule still readable.
**Costs:** the board is 864 px tall at 1080p (the lot still fits at 1×). Fit's cells are 35 px at 1080p instead of 36, and about 22 px at 720p (0.69×) instead of 24 (0.75×). The default zoom's thresholds rise by 24 art px: 1.5× on a Retina screen needs 1332 CSS px of board height instead of 1296. Big trees are rarer than in the prototype. The atlas also packs the 256 px surroundings tile.
**Changes:** None to settled decisions. D-097 (Accepted) holds, its board counting the road rows and the canopy's room.

### D-100 · M5a house defaults: the cutaway and the yard
**Status:** Proposed · 2026-11-06, with M5a's pieces track (stage 2) and its merge into the phase branch. Implementation details within D-093 and D-097; §12 Art describes each rule.
**Decision:**
- **Walls:** every cell edge is open floor, a wall between two pieces (same type included, D-093), an outside wall, or a garage door. They're LimeZu-style bands drawn from a pixel mask: 6 px outside and 4 px between rooms, with 8 px north wall faces in each room's wallpaper and 3 px floor shadows.
- **Doors and windows** are decoration chosen by fixed rules, ties broken by the piece's uid hash:
  - Hallways open into the rooms the rules link through them.
  - The front door is on a south wall with nothing of the house between it and the street, in the best entry room (a Mudroom or hall first), never onto a tree, water, a boulder, the Old Shed, a fence or an outbuilding, paved ground preferred. It opens onto the woods only when nothing else can take it.
  - A back door opens onto each touching Patio or Hot Tub; a garage door spans the Garage's side toward a Driveway or the street.
  - Then a spanning tree from the entry, public rooms first, adds as few doors as it takes to reach every room. Doors keep to side walls (70% of the way down) and the ends of north walls, clear of the furniture.
  - Windows: about one per two cells of outside wall, every cell in a Sunroom, none in Closets, Garages or Hallways.
- **Layers** (`layers.ts`): a floor canvas (the yard's ground and curb cuts, the house's shadow, doormats, floors, wall faces), one items container per piece ordered by its bottom row, a walls canvas, the overhang, outline highlights (never CSS filters on whole pieces; sets in Charm's rose with a dashed edge), and the labels inside the walls. The canvases redraw only when the house changes, before the browser paints.
- **Furniture:** two to four LimeZu pieces per room, laid out by slot rules per room type and footprint (`rooms.ts`). Tall pieces rise over the north wall band, never past its top, on the overhang. Nothing stands in a doorway or the walkway in front of it; a dining table may cross a walkway, never the opening. Rooms of a type differ in color: the piece's hash, or the next color an older room of its type hasn't taken.
- **Fixtures** show as art where they fit: the Fireplace (animated), Bunk Beds and the Kitchen Island as furniture; Soundproofing, Blackout Curtains, the Skylight, the Chandelier and the Bay Window painted with the room; the Sprinkler, the Pergola and Garden Lights in the yard. A fixture that can't be drawn keeps its badge, so a purchase is always visible.
- **Yard pieces:** their ground is on the floor canvas (a Lawn's mown stripes, pavers, concrete with a curb cut through the street row, pools in LimeZu's coping), their props are items: a parasol and two chairs on a Patio (a small parasol where a door opens onto it), the house's one parked car on its oldest Driveway, planters, the Fire Pit's campfire, LimeZu's Greenhouse and Treehouse cut shorter (they rise 14 and 25 px), and a Henhouse made from a shed's front with two hens. Fences are a white picket line that joins another only through an end's open side, so each stays countable. Props keep off doors and their mats.
- **Our own drawings** in LimeZu's palette where it has nothing: the Doghouse, the hens, the Sprinkler, and the painted fixtures. A test keeps their colors in LimeZu's palette.
- **The ghost** (and the Moving Truck's carried piece) is drawn by the same painters, for that piece alone, as it will look once built.

**Why:** The audit's prototype (house-B, test-abc123-B) showed that LimeZu's pieces at 32 px cells read as a real house when rules choose the doors, windows and furniture well.
*Open for the team:* room colors. No rule that uses only the current house is both always distinct and always stable. Hash-then-next-free keeps older rooms fixed and same-type rooms distinct up to the palette's size, but demolishing a room can recolor a newer one it had bumped. A plain per-piece hash is always stable but lets two Bedrooms share a duvet.
**Changes:** None to settled decisions. D-093 (Open) is followed: a wall between every two pieces, every room type its own floor, no zone tints, doorways decoration only.

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

D-074 to D-080 came out of playtest 2 (M2, 2026-11-05), D-090 to D-093 out of playtest 3 (M3, 2026-11-06), and D-094 out of the Combolands systems research the same day. The team asked to hold off on changes until more of the game is in, so each one is Open until a later phase picks it up.

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
**2026-11-06 (playtest 3):** still no Fences in the player's run. M4a's Hendersons want a fenced yard, and the Barkers one of 12 tiles.
**2026-11-06 (Combolands research):** Combolands' walls, palisades, plateaus, and rails are building cards that each place several pieces, and two demo patches raised how many (walls 5 → 6, rails 2 → 3 → 4). Its walls were still skipped: one forum thread's opening post says enclosing anything takes two 6-wall cards and turns off the adjacency bonuses that make most points *(guide)*. See research.md's 2026-11-06 systems update.

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
**2026-11-06 (Combolands research):** Combolands' most requested feature after launch was a compendium of the run's buildings, heirlooms, and councillors (v1.0.5), and v1.0.7 took a confusing "counts as fish" line off a card. See research.md's 2026-11-06 systems update.

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

### D-079 · Treehouses shouldn't reward clustering
**Status:** Open · 2026-11-05, from playtest 2.
**Finding:** Three Treehouses touching each other earned 288 Wow, more than every Bedroom in the run. Each counts the others as Kid neighbors, on top of D-071's extra +2.
**Idea (the team's):** Reward one Treehouse per forest. Pay per touching Tree, and don't let Treehouses count toward each other's Kid bonus, or penalize them for touching.
**Would change:** D-071's Treehouse default.
**2026-11-06 (playtest 3):** Treehouses feel better: not overpowered, but still worth building. Their rules haven't changed since playtest 2; the shop's goods grew the rest of the house around them. The Hendersons like Kid pieces (+50%, M4a), which may make them strong again.
**2026-11-06 (Combolands research):** the Treehouse both reads Kid and is the base pool's only Kid piece (the Playroom is a shop piece), so Treehouses earn most by touching each other. Another Kid piece in the base pool would give them something else to touch, and another piece that reads Kid would give Kid pieces somewhere else to pay. Combolands keeps two of the same building out of each other's range *(guide)*.

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
**Status:** Open · 2026-11-06, from playtest 3.
**Finding:** Fixtures feel okay, but it's hard to tell whether one is worthwhile. The shop shows a fixture's text alone. On the board, pointing at a piece shows that piece's earnings this week before and after (D-087), one host at a time. Nothing says what a fixture adds over the rest of the run. The player installed six in their run: two Fireplaces, two Pergolas, a Kitchen Island, and Bunk Beds.
**Options:**
- In the shop, a fixture names its best host in your house and what it would add this week.
- While installing, every legal host shows its gain, so the best one stands out.
- The gain over the weeks left, since a fixture stays for the run.
- A comparison with the fixture it would replace.
**To decide:** which of these. The numbers come from `preview()`, so the UI still never scores anything itself.
**Would change:** D-087.
**2026-11-06 (Combolands research):** Combolands previews a building's score before you place it, yet a reviewer still wanted to try placements before committing (Geekly Grind), and its players asked for a compendium after launch.

### D-093 · Houses that look like houses
**Status:** Open · 2026-11-06, from playtest 3. Researched the same day in a session of its own (research.md, "Update: houses that look like houses"). The options and a recommendation are below, and the choice is the team's.
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

### D-094 · Chain reactions
**Status:** Open · 2026-11-06, the team's request after the Combolands systems research (research.md, "Update: how Combolands' systems fit together, and chain reactions"). The options and a recommendation are below, and the choice is the team's.
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

### Earlier open questions

- ~~Art direction and tone~~: decided by D-057 (cozy pixel art), 2026-11-05.
- ~~Sound and music approach~~: decided by D-058 (calm music, escalating reward sounds), 2026-11-05.
- Exact numbers. `jam-scope.md` has placeholders to tune with playtests and simulated runs.
- ~~Score name (D-019)~~: decided 2026-11-05: Comfort × Charm, with rare Sparkle, totaling Wow.
