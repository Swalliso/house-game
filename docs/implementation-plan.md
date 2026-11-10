# Open House — Implementation Plan

**Status:** Approved · 2026-11-05. The statuses in §1d were applied to `decisions.md` in M0.
- **Confirmed so far:**
  - §1b, except the camera change
  - the 1080p design target, and Pages serving `develop` at `/dev/` (D-060)
  - branch protection on `develop` and `main` (D-061)
  - D-048 to D-051 (D-052 since superseded by D-053), D-053, D-054, and D-056
  - D-019's names, and LimeZu for the final art
  - the directions of D-055 and D-057 to D-059
- The rest was approved with the plan on 2026-11-05 (§1d).
**Revised 2026-11-05 after team feedback** (D-048 to D-052):
- **A 24×24 lot with real terrain** (woods, a creek, finds), plus a camera: §3, §4 Layout rules, Appendix A and B.
- **Fixtures are in the jam build:** cards you draw or buy and install in a piece you've already placed, a room or a yard piece (§4, §5, M3a).
- **A much bigger shop:** five kinds of goods, more blueprints, tools, and company upgrades (§5, M3a and M3b, Appendix A and B).
- **Feature freeze at the end of day 4**, so days 5 and 6 are for playtesting and refining (§7). *Superseded the same day by the second revision below.*

**Second revision, 2026-11-05** (D-053 to D-059):
- **A team of two, building in phases,** with a playtest at the end of each phase and no day timeboxes. Work lands on a `develop` branch; `main` is for releases (§7).
- **Simple pieces show up more early in a run** (weighted, not locked out) (§4, Appendix A).
- **Scoring is Points × Mult,** with rare, powerful ×Mult sources that take planning (§4).
- **Cozy pixel art, calm music, and reward feedback that escalates for big moments** (§12).
**Related:** `decisions.md` (decision log), `jam-scope.md` (jam scope and numbers), `content-brainstorm.md` (pieces, clients, crews), `research.md` (reference games; its 2026-11-04 update has the sources behind §2, and its 2026-11-05 update the sources for the shop, fixtures, and lot).

---

## 0. Summary

- **The idea holds up.** Every pillar we borrow comes from a hit (Combolands, Islanders, Luck be a Landlord, Balatro). The risks are in execution: readability, run length, luck, and a few mechanics that don't work as written. §2 lists them and the fixes.
- **Stack:** TypeScript 6 + Vite 8 + Vitest 5, npm, Node 26. Preact 10 renders everything, including the board (HTML/CSS with a canvas terrain layer, atlas sprites, and SVG outlines). No Phaser. GitHub Pages serves releases from `main` at the root and the work-in-progress `develop` build at `/dev/` (D-060).
- **Shape:** `src/rules` is a pure rules module (no DOM, no `Math.random`, no clock). It's a reducer: `apply(state, action) → { state, events }`. The UI renders state, asks the rules for placement previews, and animates the events. The headless sim drives the same reducer with bots.
- **The lot is 24×24 with real terrain:** woods, a creek, a pond, boulders, the sun on one side, and a couple of finds worth building toward. Where you put the house is the first big decision of a run (D-048, D-049).
- **Fixtures and a real shop:** fixtures are upgrades installed in a piece you've already placed (a room or a yard piece). You draw them (installing one is your week) or buy them (installing one is free). The shop sells five kinds of goods plus crates and services, with rarity, a sale, and selling for half (D-050, D-051).
- **Content is data:** pieces, fixtures, terrain, sets, blueprints, tools, company upgrades, clients, crews, change orders, and balance numbers are typed object literals in `src/content`. Card text is generated from them. Appendix B shows every Core item written in the format.
- **Randomness:** one run seed, split into keyed substreams. A run is fully described by `build + seed + setup + action log`, which becomes a copyable **run code** that replays any bug. The same scheme makes the Daily Lot fair.
- **Build order:**
  - Eight phases, M0 to M7 (D-053). M1 to M6 each end in a playtest; M0 ends with green CI, and M7 is the release. The order is the priority order, so stopping after any phase leaves a working game.
  - M1 is a 12-week slice: 3 milestones, 6 pieces, placeholder art, and a first pass at juice. That's long enough to tell whether the loop is fun.
  - The headless sim arrives in M2 to set targets.
  - Work happens on phase branches off `develop`, which merge after their playtest. `main` holds releases (D-054).

---

## 1. Decisions to confirm

### 1a. Existing Proposed and Open items that affect M0 and M1

M1 is the vertical slice: lot grid, a handful of pieces, placement with rotation, weekly scoring with a live preview, and milestone targets, all in placeholder art.

| Item | What M0/M1 needs from it | Default in this plan |
|---|---|---|
| **D-027** Tech defaults | The whole stack | As proposed, except Preact/DOM instead of Phaser (D-033), with versions in D-034 |
| **D-029** and `jam-scope.md` (both Proposed) | Lot size, weeks per milestone, cards per week | **24×24 lot instead of 12×12** (D-048), with the terrain in D-049; 3 cards; **4 weeks per milestone instead of 6** (D-042); other numbers in Appendix A (D-046) |
| **D-020** Tags and effect types | The data format | Use as the model, extended per D-038 |
| `content-brainstorm.md` §3–4 (Draft) | The six slice pieces' shapes, tags, and effects | As written in Appendix B, with placeholder numbers |
| **D-028** Cumulative score | What a milestone checks | One running total; each milestone is a higher total |
| **D-025** House data separate from run data | The state shape | `HouseState` separate from `RunState` (§4) |
| **D-030** Placeholder art first | The slice's look | Simple Claude-drawn 16px sprites and terrain tiles in the final atlas format (D-057), plus labels |
| **D-049** Terrain and big-lot rules (new) | Lot generation, the camera, piece sizes | Woods, creek, pond, boulders, sunny side in M1; finds in M3b |
| **D-018** Construction phases | Milestone names | Groundbreaking → Foundation → Framing → … |
| **D-019** Score name | The score labels | **Decided 2026-11-05:** Comfort × Charm, with rare Sparkle, totaling Wow (§12). The labels live in one constants file. |
| **D-022** Daily Lot | Not built, but the RNG design must support it | Keyed streams from day one (§6) |
| **D-034** Docs move and CLAUDE.md | M0 | Move the four docs and this plan into `docs/`; add `CLAUDE.md` (§11) |
| **Open:** exact numbers | Piece values and three hand-set targets | Placeholders in `balance.ts`; the sim sets real targets from M2 |
| **Open → decided:** art direction (D-057) | Placeholder sprites in the final atlas format | Cozy 16px pixel art. Claude-drawn placeholders from M1; LimeZu final art (chosen 2026-11-05) can land from M2; the full pass is in M5. |
| **Open → decided:** sound (D-058) | Placeholder zzfx sounds in the first pass at juice | Calm music and the full reward sound set in M5 |

Not needed for M0 or M1: D-015, D-016, D-017, D-021 (clients arrive in M4a), D-023, D-024, D-031, D-032, and the auto-complete toggle in D-006 (M2).

### 1b. Changes to Accepted decisions (all four confirmed 2026-11-04)

| Accepted | Change | Entry |
|---|---|---|
| **D-004** One piece per week | You may also **Pass** a week (place nothing). It's needed when the lot is full or no card fits, and Juniper needs it. No reward for passing. | D-036 |
| **D-005** Missing a milestone ends the run | It still does, but only after the run's **2 overtime weeks** are used up. | D-041 |
| **D-006** Early completion | Defines what D-006 leaves open: the skipped weeks **fast-forward** (pieces keep earning, nothing is placed), the reward scales with the phase, and auto-complete is off by default. It's offered in every phase, including the last. | D-040 |
| **D-013** Budget comes from milestones and early completions | Also from **economy pieces** (Garage and Home Office, both Core in the brainstorm), and from change-order and set rewards. | D-046 |

These four stay Accepted, with an "Amended by" pointer to the entry that changes them, since each original decision still holds. Kept as written: D-008 (Jack-and-Jill stays a set), D-012 (every run starts with a crew pick, including the first), D-026 (no guaranteed Rare).

**Raised by the 2026-11-05 revision (all confirmed 2026-11-05):**

| Accepted | Change | Entry |
|---|---|---|
| **D-004** One piece per week | A week's turn can also be **installing a drawn fixture** in a piece you've already placed, instead of placing a piece. Tools and bought fixtures are free actions, but none of them adds a second piece in a week. | D-050, D-051 |
| **D-013** Budget sources | Four more: **finds** on the lot, **selling** blueprints and supplies for half their list price, the shop's **skip reward** (+1 for leaving without buying), and **Savings Account** interest | D-049, D-051 |
| **D-007** Every tile is a choice between house and yard | No wording change. On a 24×24 lot, space itself isn't scarce. What's scarce is your 28 placements and the good tiles: the ring around the house, the creek bank, the edge of the woods, the sunny side. Each placement is still a house-or-yard choice. | D-048 |
| **D-033** Board rendering | Preact and the DOM, no Phaser, is unchanged. One bullet changes: input was a CSS grid with one element per cell; now the pointer maps to a cell by arithmetic, and terrain is one layer that re-renders only when terrain changes. Its reasoning said "144 cells"; it's 576 now. | D-048, D-049 |

**Raised by the second 2026-11-05 revision.** The fixture and shop changes were confirmed with the multiplier model, and the 1080p target on its own, all on 2026-11-05. The camera change waits for plan approval.

| Accepted | Change | Entry |
|---|---|---|
| **D-049** The camera | It zooms in whole-number pixel scales by re-laying out the board, not with a CSS transform, because Safari blurs pixel art under transforms | D-057 |
| **D-047** Desktop first | *Confirmed 2026-11-05:* the design target is 1920×1080, where the whole lot fits at a crisp 2×. 1280×720 still works by panning. An itch.io page is optional; if we make one, its embed is 1600×900. | D-057 |
| **D-050** Fixtures | One more, the Rare Chandelier, a ×Mult source (11 in all). *Confirmed.* | D-056 |
| **D-051** The shop | Two more Rare blueprints with ×Mult (18 in all); a seventh tool kind, Remodel Plans, which levels a set (12 tools); It's a House and Rush Order become +Mult; Last-Minute Push becomes ×Mult. *Confirmed.* | D-056 |

### 1c. New decisions (logged in `decisions.md`)

The Status column is as of planning. With the plan's approval, everything still Proposed here became Accepted (§1d); `decisions.md` has the current status of each.

| # | Decision | Needed by | Status |
|---|---|---|---|
| D-033 | Render with Preact and the DOM, board included; no Phaser | M0 | **Accepted** |
| D-034 | Toolchain and repo: TS 6.0, Vite 8, Vitest 5, Preact 10, npm, Node 26, GitHub Pages; docs move to `docs/` with a `CLAUDE.md` | M0 | Proposed |
| D-035 | Board rules: orthogonal adjacency counted once per neighbor, lot features as neighbors, indoor rooms form one connected house | M1 | Connected house and terrain neighbors (D-049) confirmed; rest Proposed |
| D-036 | Week flow: tentative placement until **End week**, free reroll and demolish, Pass, transforms at the start of the week, a single scoring pass | M1 | Pass, free actions, and `handSize` confirmed; rest Proposed |
| D-037 | Scoring math: one additive percentage bucket, a floor of 0, integer math, spec bonuses add; the preview shows the net weekly change | M1 | Proposed |
| D-038 | Content is typed data: fixed effect kinds, selectors, conditions, and modifiers, plus an escape hatch; generated card text | M1 | Proposed |
| D-039 | Randomness and run codes: `sfc32`, keyed streams, build-stamped run codes | M1 | Proposed |
| D-040 | Early completion fast-forwards (amends D-006) | M2 | **Accepted** |
| D-041 | Overtime: 2 weeks per run (amends D-005) | M2 | **Accepted** |
| D-042 | Run length: 7 milestones × 4 weeks (amends D-029) | M1 | **Accepted** |
| D-043 | Draws: `handSize` (3) distinct cards (pieces, plus fixtures from phase 2), run-fixed weights, client spec pieces weighted up, simple pieces weighted up early (D-055) | M1 / M4a | Proposed |
| D-044 | The sim sets milestone targets, starting in M2 | M2 | Proposed |
| D-045 | First-run onboarding without saved progress: a recommended first contract and crew, simple pieces early, first-time hints | M4 | Proposed |
| D-046 | Defaults for the rules the docs leave open (Appendix A), including D-013 | M1–M4b | Economy budget and the fenced-yard rule confirmed; rest Proposed |
| D-047 | Desktop first: 1280×720 minimum, mouse and keyboard plus tap support, no phone layout | M1 | **Accepted** |
| D-048 | Lot size: 24×24 (amends D-029) | M1 | **Accepted** (the team's request) |
| D-049 | Terrain and big-lot rules: woods, creek, finds, a camera, bigger yard pieces | M1 / M3b | **Accepted** (the creek's rate and the pond changed by D-119) |
| D-050 | Fixtures are in the jam build: drawn (installing one is the week's turn) or bought (installing one is free) | M3a | **Accepted** (the team's request) |
| D-051 | The shop: five kinds of goods plus crates and services, rarity, selling, a sale item, rising refresh prices | M3a / M3b | **Accepted** |
| D-052 | Schedule: feature freeze at the end of day 4, then two days of playtesting and refinement | M0 | *Superseded by D-053* |
| D-053 | A two-person, phased build with a playtest at the end of each phase; no day timeboxes (supersedes D-052) | M0 | **Accepted** (the team's request) |
| D-054 | Branches: `develop` cut from `main`, phase branches merge into `develop` by PR, releases merge into `main` with a tag (amends D-034) | M0 | **Accepted** (the team's request) |
| D-055 | Simple pieces are more likely early in a run: draws weighted by complexity and phase (refines D-043) | M1 | Direction **Accepted**; weights Proposed |
| D-056 | Scoring is Points × Mult; +Mult from specs and sets, rare ×Mult from planned sources (refines D-037) | M1 | **Accepted** (the team confirmed the model) |
| D-057 | Art: cozy top-down pixel art, rooms shown as a cutaway with furniture, integer scaling | M1 / M5 | Direction **Accepted**; details Proposed |
| D-058 | Sound: calm music, with reward sounds that escalate with the size of the moment | M1 / M5 | Direction **Accepted**; details Proposed |
| D-059 | Juice is a core feature: a tiered celebration ladder from the slice on | M1 / M5 | Direction **Accepted**; details Proposed |
| D-060 | Pages serves `main` at the root and `develop` at `/dev/`; `develop` is the default branch; releases are PRs you open from `develop` into `main` (amends D-054) | M0 | **Accepted** (the team's request) |
| D-061 | Branch protection: `develop` and `main` change only by PR, with your code-owner review and the CI job `test`; `main` takes merge commits only; you can bypass only inside a PR | M0 | **Accepted** (the team's request); set up 2026-11-05 |

### 1d. What changes status on approval

- D-018, D-020, D-025, D-027, D-028, D-029, and D-030 become **Accepted**, as amended by the entries above.
- D-021 becomes Accepted, with each spec met adding +0.25 Mult (D-056).
- D-006's "Proposed addition" (auto-complete) is resolved by D-040.
- The remaining Proposed entries among D-033 to D-047 become Accepted, along with the Proposed details of D-055 to D-059 and the second revision's changes to Accepted decisions (§1b). D-047 is already Accepted, and so are D-048 to D-054 (D-052 is superseded by D-053).
- D-004, D-005, D-006, and D-013 stay Accepted with their "Amended by" pointers (already in the log). The 2026-11-05 pointers are in too: D-004 to D-050 and D-051, D-013 to D-049 and D-051, D-033 to D-049, D-050 and D-051 to D-056, and proposed-amendment notes on D-033 (D-057), D-047 (D-057), and D-049 (D-057).
- In M0, `jam-scope.md` is updated to match:
  - the starting-numbers table
  - the lot line under "In the jam build" (woods, creek, finds)
  - Fixtures move from Stretch to "In the jam build", and five Stretch special pieces become Core shop pieces (D-051)
  - the shop line lists the five kinds of goods
  - the suggested build order points to §7
  - the Art line: cozy 16px pixel art with LimeZu final art (D-057), a first pass at juice from M1 (D-059), and calm music with escalating reward sounds (D-058)
  - the Scoring line: Points × Mult, shown as Comfort × Charm, with Sparkle and Wow (D-056, D-019)

  Its status line points to these entries.

---

## 2. Is it fun?

We researched Combolands' reception since launch and six comparable games, and ran a skeptical design review with quick throwaway models of the draw, fill, and score math. The figures below come from those models: rough estimates, not committed code. The sources are in `research.md`'s 2026-11-04 update.

### Verdict

**Yes, probably. The concept is low-risk.**

- Combolands, the closest blend of these mechanics, is at 96% positive across about 2,000 Steam reviews. Players praise snowballing combos, calm pacing, and tactile scoring feedback.
- Islanders' live preview, Luck be a Landlord's rising rent, and Balatro's rule-benders are all proven.
- Open House's own edge is that floor-plan common sense makes the rules guessable: bedrooms dislike the street, kitchens like dining rooms.
- Clients change what a good house looks like. That's cheap variety against the most common complaint across these games: repetition after a few runs.

The risks are in execution, and these are the changes this plan makes:

| # | Problem | Evidence | Change |
|---|---|---|---|
| 1 | **A run is long for a jam** | 42 placements plus 6 shops is about 35–45 minutes for a first run. Jam players usually give a game 10–15 minutes, and a loss at phase 6 wastes 25. | 7 × 4 weeks, about 20 minutes (D-042); save and resume; overtime (D-041) |
| 2 | **Early completion is a trap as written** | With cumulative targets and weekly earning, each skipped week costs about 5% of the final score. +1 budget can't pay for that, and Combolands players mostly ignore its version. | Fast-forward (D-040): skipped weeks still pay, so you trade placements for budget plus a bonus. That favors building early and cashing out late. The sim checks the choice is live in every phase. |
| 3 | **The run snowballs** | About 80% of the final score is locked in 60% of the way through. A late piece earns only a few times. | Late-game agency comes from revaluing the house (blueprints, fixtures, change orders, sets, specs). A forecast line on the progress bar. Targets stop tightening after milestone 4 (D-044). |
| 4 | **Client specs depend on draw luck** | With uniform draws, the Hendersons' checklist completes at a median of week 23–24, and about 6% of runs never finish it. The vampire's Library and the Barkers' Mudroom aren't in the base pool. | Spec pieces weighted ×2; signature pieces added to the client's pool (D-043). The model puts completion at a median of week 14–16. |
| 5 | **Too much to learn** | A first run meets about 75 concepts; the jam's bar is "no explanation needed". | Early phases draw mostly simple pieces (D-055). The shop opens after milestone 1, change orders after milestone 2. First-time hints. Plain-language card text, and the preview teaches (D-045). |
| 6 | **Multipliers stack without limit**, but the team wants them powerful | Multiplying every bonus on every piece gives ×15 on one Kitchen and ×36 on one Flower Bed. | Per-piece bonuses add. The week's **Points × Mult** keeps multiplication in one place: +Mult from specs and sets adds, and only rare ×Mult sources multiply, each once per week and each needing a setup (D-056). Targets come from the sim's median curve, which ×Mult may steepen. A per-client target factor (D-044). |
| 7 | **The lot fills up** (on 12×12) or **feels empty** (on 24×24) | On 12×12, favoring big pieces covers 93% of buildable tiles by week 36, and most of those runs hit a hand where nothing fits. On 24×24, 28 placements averaging about 3 tiles cover only about 15% of the lot. | The 24×24 lot (D-048) removes the fill problem. Against emptiness: terrain covers about a fifth of the lot, Lawn and the Fence get bigger shapes, and finds reward building out toward the edges (D-049). Lot width and height are numbers in `balance.ts`, so the M1 playtest can try 20×20 or 24×18 in a minute. Greyed-out cards, the free redraw, and Pass stay. |
| 8 | **The best house may not look like a house** | Floor Plan's top scores come from five adjacent dining rooms; finished Combolands maps look like "a stamp collection". | Rooms form one connected house (D-035); specs and Full House reward plausible houses; the sim reports what top houses contain |
| 9 | **New pieces change old pieces' earnings** | Castles of Mad King Ludwig's main criticism is re-checking earlier rooms. | The preview shows the net change to the weekly total, with +/− badges on every affected piece |
| 10 | **Fences are dead tiles** | Combolands walls are widely skipped as not worth building. On a big lot, closing a yard also takes more fence. | A Fence earns per tile of fenced yard it borders; an enclosure needs a Fence and at least 4 tiles; the lot edge counts as a wall; the Fence comes as a 1×4 and a 5-tile L. The sim reports how many placements an enclosure costs, aiming for 2–3. |
| 11 | **A hard fail with few recovery tools** | Luck be a Landlord's top complaint is runs that feel unwinnable. | Overtime, Pass, a free redraw for dead hands, and a nearly guaranteed first milestone |

### Things to lean into

- **Juice is the payoff, and it's core (D-059).** The tally sound and the big-score moment show up in nearly every positive Combolands review. A first pass ships with the M1 slice, and §12 specifies the full version. Build a speed-up into the tally from the start; a Combolands patch had to add a way to speed up its victory screen.
- **Readability belongs in the slice, not later:**
  - the exact number on placement
  - helpful and harmful neighbors marked differently (not by color alone)
  - an inspect panel per piece
  - readable number sizes

  Several Combolands players "won without knowing why".
- **Spend content time on clients before pieces.** Clients that change what scores well do more for "I want a second run" than extra pieces.
- **Sets pay like poker hands:** Points and Charm every week they hold, rising with how hard the set is, with levels from Remodel Plans (D-056). A set can still carry a one-time `reward` (budget, a reroll) like Castles of Mad King Ludwig's room completions; it's just data.
- **Make blueprints always-active, in limited slots, and announce change orders before they apply.** These come from Luck be a Landlord and Balatro.
- **Make every shop visit different** (D-051; sources in `research.md`'s 2026-11-05 update):
  - fixed category slots, so a visit never rolls only one kind of good (Slay the Spire)
  - a 50% sale item (Slay the Spire, Wildfrost, Isaac)
  - a refresh that gets pricier within a visit (Balatro, Combolands)
  - pick-1-of-3 crates (Combolands, Balatro)
  - something cheap in every visit, and selling for half
  - a generous first shop: Balatro's first shop always has a pack, and Combolands' first visit includes a free heirloom chest
- **Fixtures should change how a piece scores, not just add to it.** A Wildfrost reviewer says its charms feel good because they transform a card rather than just buff it. Combolands' Ghost Paint, which changes what a building affects, is called the fastest way to break its scoring, so transforming fixtures need watching in the sim. Players report Combolands upgrades that quietly made a building worse, so the preview shows the piece's before and after.

---

## 3. Tech stack and project structure

The repo has no code, tooling, or CLAUDE.md yet: just four markdown docs at the root. So D-027's defaults decide the stack, with versions checked against npm on 2026-11-04. The only existing convention, kebab-case markdown, is kept.

### Stack

| Area | Choice | Notes |
|---|---|---|
| Runtime | Node 26 (`.nvmrc`), npm with a committed lockfile | Node 26 runs `.ts` files directly, so the sim has no build step. |
| Language | TypeScript **~6.0.3**, strict | The last JavaScript-based compiler, verified with the rest of this stack. TS 7 (the Go compiler) is new and has no stable API yet. Settings: `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noUncheckedIndexedAccess`. |
| Build and dev | Vite 8 | `base: './'`, so one build works on GitHub Pages and itch.io |
| UI | Preact **10** + `@preact/signals` | About 9 kB gzip. Preact 11 is out, but it's newer than Claude's training data and the game needs nothing from it. |
| Board | HTML/CSS with pixel art (D-057): terrain drawn into one canvas layer, redrawn only when terrain changes; pieces as absolutely positioned elements using a sprite atlas; SVG for outlines and highlights. The pointer position maps to a cell by arithmetic, so there's no element per cell. The camera zooms in whole device pixels per art pixel by re-laying out the board (never `transform: scale()`, which blurs pixel art in Safari), with drag to pan and a Fit button. | Behind a small `BoardView` interface. At 1080p the 24×24 lot fits at 1× (32 art px per cell, D-097); at 1280×720 it pans at 1×, with a Fit overview (§12). |
| Juice | Web Animations API + CSS; one canvas overlay for particles; a first pass in M1, the full ladder in M5a's juice, after M4 (§12, D-097) | |
| Audio | Our own Web Audio wrapper, about 200–300 lines: buses, an audio-clock scheduler, the in-key pitch ladder, stem crossfades, ducking (§12). `zzfx` for placeholder sound effects. | Howler and Tone.js aren't needed. |
| Tests | Vitest 5 + `fast-check` | |
| Format | Prettier | Avoids formatting churn between sessions |
| Purity | `tsconfig.rules.json` without DOM types, plus a ~15-line Vitest test that scans `src/rules` for `Math.random`, `Date`, `window`, `document`, `localStorage`, and UI imports | Replaces ESLint, which isn't worth its setup in a jam |
| Hosting | GitHub Pages via two Actions workflows: `ci.yml` runs the `test` job on every PR, and `deploy.yml` runs on pushes to `main` or `develop`, tests both, and builds them into one site, `main` at the root and `develop` at `/dev/` (D-060, D-063). An itch.io page is optional. | The repo is public. The Pages source, the default branch, and the `github-pages` environment's branch rules are set once (M0). |

### Why not Phaser?

D-027 left the choice to planning. We compared Phaser board + DOM panels, all DOM, PixiJS + DOM, and all Phaser. **All DOM wins for this game:**

- Most of the screen is panels (hand, top bar, checklist, shop, job board, end screen), which the DOM does natively.
- The board is 576 cells (24×24) and about 30 pieces, and it's turn-based. Terrain changes only on a few events (a Tree built over, a Boulder or the Old Shed demolished, a Sapling becoming a Tree, a Time Capsule claimed), so the terrain layer re-renders on those events only. Pieces and highlights update as usual.
- The juice the research calls out is mostly sequencing, timing, and sound, not physics. Balatro's flames are a shader. Our glow uses the particle canvas and CSS instead, and `BoardView` keeps a WebGL board (PixiJS) possible if the art pass wants shaders. Pixel art works fine in the DOM at whole-number scales (§12).
- One renderer means no bridge between a canvas board and a DOM hand. That bridge would sit right where the core interaction happens: pick a card, hover the board, see the ghost and highlights.
- Claude writes Preact, CSS, and SVG most reliably.
- The bundle is about 9 kB gzip versus 357 kB for Phaser 4.

The `BoardView` interface (`render(snapshot)`, `play(events)`, `onCellHover`, `onCellClick`) means Phaser could still replace just the board later if the art pass wants shaders.

### Project structure

```
house-game/
├── CLAUDE.md
├── README.md                 # play link, how to run locally, how to report a bug
├── CREDITS.md                # every art, sound, and music asset, with its license
├── .gitignore                # node_modules/, dist/, art-source/
├── art-source/               # only in the main checkout (/Users/sam/Desktop/Code/house-game): the purchased LimeZu packs, never committed.
│                             # The cut script finds it from any worktree through `git rev-parse --git-common-dir`.
├── art/                      # placeholder sprite sources: palette-indexed 16×16 grids, as text
│   └── limezu/               # manifests: each LimeZu sprite we use, where it is in the packs, and its edits (D-097)
├── scripts/cut-art.ts        # cuts the manifests' sprites from art-source/ into assets/limezu/ (local only)
├── scripts/build-atlas.ts    # packs the art/ placeholders and the assets/limezu/ cuts into assets/atlas.png + atlas.json
├── assets/                   # atlas, LimeZu cuts, audio; licenses.json records source, author, and license per file
├── docs/                     # decisions, jam scope, brainstorm, research, this plan
├── index.html
├── package.json  .nvmrc  vite.config.ts  .prettierrc
├── tsconfig.json             # everything: DOM + JSX for ui/, Node types for sim/
├── tsconfig.rules.json       # src/rules + src/content only, NO DOM lib: `document` is a compile error
├── .github/CODEOWNERS        # @Swalliso owns every file (D-061)
├── .github/workflows/        # ci.yml: the test job on every PR; deploy.yml: main → / and develop → /dev/ (D-063)
├── src/
│   ├── rules/                # PURE game rules
│   │   ├── index.ts          # the public API and all shared types; ui/ and sim/ import only from here
│   │   ├── rng.ts            # sfc32 + keyed substreams
│   │   ├── grid.ts           # coordinates, shapes, rotation
│   │   ├── lot.ts            # lot generation from a seed: woods, creek, pond, boulders, the sun's side, finds
│   │   ├── layout.ts         # neighbors, connectivity, exterior/interior, the sun, view, yards, fenced yards
│   │   ├── selectors.ts      # selectors and conditions, and the tag-resolution order
│   │   ├── placement.ts      # legality checks that return a reason
│   │   ├── effects/          # one file per effect kind, plus a registry
│   │   ├── modifiers.ts      # run-level rule benders
│   │   ├── scoring.ts        # resolveWeek(), tally with breakdown, scoreOnly(), preview()
│   │   ├── sets.ts           # set instance matching
│   │   ├── draw.ts           # weighted hands
│   │   ├── milestones.ts     # targets, overtime, early completion
│   │   ├── fixtures.ts       # installing fixtures, host checks
│   │   ├── shop.ts           # offers, prices, selling, the sale item
│   │   ├── tools.ts          # one-shot tools from the shop, one function per tool kind
│   │   ├── conditions.ts     # house conditions: client specs, the house rules, change-order requests (D-101)
│   │   ├── jobs.ts           # the job board's contracts, outside the run code (D-032)
│   │   ├── run.ts            # RunState, apply(), legalActions(), the transition table, change orders, arrivals
│   │   ├── runcode.ts        # encode and decode run codes; replay()
│   │   └── text.ts           # rules text generated from content data
│   ├── content/              # DATA ONLY
│   │   ├── tags.ts  features.ts  pieces.ts  fixtures.ts  sets.ts
│   │   ├── blueprints.ts  tools.ts  upgrades.ts  crates.ts
│   │   ├── clients.ts  crews.ts  change-orders.ts
│   │   ├── house-rules.ts  households.ts   # the seven house rules (D-101) and each client's arrivals (D-103)
│   │   ├── balance.ts        # lot size, weeks, targets, prices, rewards (one owner)
│   │   └── index.ts          # registry + validateContent()
│   ├── ui/                   # Preact: renders state, calls rules, never computes scores
│   │   ├── App.tsx  store.ts  ErrorBoundary.tsx
│   │   ├── board/            # Board, camera, TerrainLayer (and terrain/), HouseLayers, the house model, layers, labels
│   │   ├── art/              # the house's and the yard's painters and layouts: rooms, yard, our own drawings
│   │   ├── kit/              # the pixel UI's primitives: Panel, Card, Button, Chip, Icon, Sheet…
│   │   ├── theme/            # tokens, the UI pixel, fonts, and our own frames, icons and sky as text grids
│   │   ├── hud/              # TopBar, ScorePanel, Hand, Inventory (reserve, supplies, blueprints), Inspect, Menu, Tip,
│   │   │                     # Checklist (the client's), Hints (the controls strip), FirstHints (first-time hints), household.ts
│   │   ├── screens/          # Title, JobBoard (the contracts, then the crew), ChangeOrderScreen, ShopScreen, EndScreen,
│   │   │                     # HowToPlay, Settings, Overlays (banners, notes, toasts)
│   │   ├── fx/               # tally director, celebration ladder, floating numbers, particles; feel.ts holds the timing numbers
│   │   ├── debug/            # ?debug panel
│   │   └── audio/            # Web Audio wrapper: buses, scheduler, pitch ladder, music stems
│   └── main.tsx
└── sim/
    ├── cli.ts                # node sim/cli.ts --runs 200 --policy greedy ...; --check, --ban, --gift
    ├── simulate.ts           # one run through apply(): the run record, step caps, SimError
    ├── policies/             # random, novice, greedy and its variants; chaos (for tests); change-order answers; planner (M6)
    ├── enclosure.ts  house.ts   # the enclosure probe and fence planner; the house report's measures (D-093)
    └── report.ts             # the report, §8's criteria, suggested targets
```

Tests are co-located (`scoring.test.ts` next to `scoring.ts`).

### Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | Vitest: rules, content validation, client witness layouts, the purity test, a quick smoke sim |
| `npm run typecheck` | `tsc` on both configs |
| `npm run art:cut` | cuts the LimeZu sprites the manifests in `art/limezu/` list from the packs in `art-source/` into `assets/limezu/`, with their license records. Local only (D-097). |
| `npm run atlas` | rebuilds `assets/atlas.png` and `atlas.json` from the `art/` placeholders and the committed cuts in `assets/limezu/` |
| `npm run build` | atlas + typecheck + Vite build, stamped with the git short SHA |
| `npm run sim -- …` | headless simulation (§8) |

---

## 4. Architecture: the rules module

### State

All state is plain, JSON-serializable data. D-025 keeps the house separate from the run, so a later renovation mode can start from an existing house.

```ts
interface HouseState {                 // the lot and what's on it
  lot: Lot                             // width × height, street edge, the sun's side (D-120), terrain (woods, creek, pond, boulders, finds)
  pieces: PlacedPiece[]                // { uid, defId, x, y, rot, placedWeek, ageBonus, fixture?: { id, week }, level?, shape? }
                                       // level: Renovations (D-102); shape: a pack's own tiles (D-106)
  nextUid: number
}

interface RunState {
  setup: RunSetup                      // { seed, clientId, crewId, mode: 'standard' | 'daily' }
  house: HouseState
  phase: number                        // 0-based milestone index
  slot: number | `ot${number}`         // week within the phase, or an overtime week
  week: number                         // weeks elapsed in the run (timers count from this)
  draws: number                        // draws so far this week (keys the RNG)
  score: number                        // D-028: one running total
  phaseStartScore: number
  budget: number
  hand: Card[]                         // this week's cards, the Rooms row then the Layout row (D-121: roomsRow 2, layoutRow 2); a Card is a piece or a fixture
  reserve: { id: PieceId; crew?: true }[]   // bought pieces (2 slots) + crew starting pieces (extra slots, marked crew)
  supplies: (FixtureId | ToolId)[]     // bought fixtures and tools (3 slots), used as free actions
  rerollsLeft: number                  // reset to rerollsPerPhase at each phase start
  bonusRerolls: number                 // bought from the shop; spent after rerollsLeft and never expire
  demolitionsLeft: number
  overtimeLeft: number
  swapped: { i: number; was: Card }[]  // D-121: the hand's cards that replaced a card with no play, and what each replaced
  blueprints: { id: BlueprintId; boughtWeek: number }[]   // 4 slots; sells for half its list price
  upgrades: UpgradeId[]                // company upgrades, permanent for the run
  servicesBought: { reroll: number; demolition: number }              // their prices rise per purchase
  changeOrders: ActiveChangeOrder[]    // requests and restrictions being worked on
  timedEffects: { source: ChangeOrderId | ToolId; until: { phase: number } | { week: number }; modifiers: Modifier[] }[]
  lastTally: { points: number; mult: number; total: number; specsMet: boolean[]; setInstances: string[] }   // specsMet in checklist order
  setsRewarded: SetId[]                // sets whose one-time reward has been paid
  setLevels: Partial<Record<SetId, number>>   // from Remodel Plans; 1 when absent
  milestonesEarly: number              // a RunStat for scaling ×Mult
  screen: 'build' | 'changeOrder' | 'shop' | 'won' | 'lost'
  offers?: {
    changeOrder?: ChangeOrderId
    shop?: { slots: ShopOffer[]; sale?: number; refreshes: number; boughtAny: boolean }
    pick?: { source: CrateId | 'housewarming'; options: PickOption[] }   // an opened crate waiting for a choice
  }
  autoComplete: boolean
}
```

The action log is kept alongside the state rather than inside it, for run codes.

### Actions, events, and the API

```ts
type Action =
  | { t: 'place'; from: 'hand' | 'reserve'; i: number; x: number; y: number; rot: 0 | 1 | 2 | 3
      shape?: string[] }                              // a pack card's tiles (D-106), as ASCII rows
  | { t: 'install'; from: 'hand' | 'supplies'; i: number; uid: number }  // a fixture into a placed piece
  | { t: 'renovate'; from: 'hand' | 'reserve'; i: number; uid: number }  // a capped room card on its room (D-102)
  | { t: 'pass' }
  | { t: 'useTool'; i: number; target?: { uid: number; x?: number; y?: number; rot?: 0 | 1 | 2 | 3 } }
  | { t: 'reroll' }
  | { t: 'demolish'; x: number; y: number }
  | { t: 'completeEarly' }
  | { t: 'setAutoComplete'; on: boolean }
  | { t: 'answerChangeOrder'; accept: boolean }      // phase effects can only be acknowledged
  | { t: 'buy'; i: number }                           // any shop slot, including services
  | { t: 'pick'; i: number }                          // choose from an opened crate
  | { t: 'sell'; from: 'blueprints' | 'supplies'; i: number }
  | { t: 'refreshShop' }
  | { t: 'leaveShop' }
```

`(x, y)` is the top-left cell of the rotated shape's bounding box, and each rotation's cells are normalized so their minimum x and y are 0. There's no mirroring: no Core shape needs it (the L-Kitchen's mirror image is one of its rotations, and so is the L-Fence's).

**The week's card versus free actions (D-050, D-051):**
- Placing a piece (from the hand or the reserve), installing a fixture **from the hand**, renovating a room (D-102), or passing is the week's turn, and it ends the week. In the rules, a week's play is `Play = { place } | { install } | { renovate } | null`. `resolveWeek` and `preview` take a `Play`, so a fixture or Renovation preview goes through the same path as a piece preview.
- Installing a fixture **from your supplies**, using a tool, rerolling, and demolishing are free actions during the week. A free install previews as the change to this week's projected total, `resolveWeek(after, null) − resolveWeek(before, null)`.
- No action places a second piece in a week, so D-004 still holds: one piece per week at most.

`GameEvent` covers:

- `handDrawn` (the final hand; with `row` for a one-row reroll, and `free` and `swapped` when swaps replaced cards with no play, D-121)
- `placed`, `installed`, `demolished`, `transformed`, `moved`
- `toolUsed`, `findClaimed` (a find's reward, for its own little moment)
- `tally` (week, per-piece lines, set lines, points, mult, each ×Mult source, total, budget, `fastForward`)
- `setCompleted`, `specMet`, `specLost` (distinct moments for juice), `renovated`
- `targetReached` (fires when the score first crosses the target)
- `overtimeUsed`
- `milestone` (phase, result `'onTime' | 'early' | 'overtime' | 'failed'`, weeks saved, overtime used, reward)
- `changeOrderOffered`, `changeOrderResolved`
- `shopOpened`, `bought`, `sold`, `crateOpened`, `picked`
- `runEnded`

Each phase writes out the full payload of the events and types it adds in `rules/index.ts` (§7, Contracts as we go).

| Function | Use |
|---|---|
| `newRun(setup) → RunState` | Lot from the seed; crew starting pieces into the reserve; first hand drawn. `autoComplete` always starts off. |
| `apply(state, action) → { state, events }` | The only way state changes. Throws `IllegalAction` with a reason. Never mutates its input. |
| `legalActions(state)` | For bots, and for greying out cards and buttons. |
| `resolveWeek(state, play \| null)` | The end-of-week step: apply the week's play (a placement, an install, or none), tally, add economy budget. Both `apply` and `preview` call it, so they can't disagree. |
| `preview(state, play) → Preview` | `{ legal, reason?, before, after, delta, lines, upcoming }`, where `before` and `after` are `WeekScore = { points, mult, total }` and `delta` is the change in total. `before` is `resolveWeek(state, null)`'s score (cached per state). `after` is the score with the play. `lines` lists every piece whose earnings change and why. `upcoming` flags timers (Rhythm, Growth) that a single number can't show. |
| `scoreOnly(state, play)` | The same total without building breakdown lines, for the sim. A property test checks it equals `preview().after`. |
| `forecast(state)` | `score + lastTally.total × weeks left in the phase`: a rough guide for the progress bar, not a promise. |
| `replay(setup, actions) → { state, failedAt? }` | Rebuilds a run from a run code. Returns the step where it fails instead of throwing, so a stale save never crashes the page. |

The UI keeps an event queue and plays it through an animation director (place → tally count-up → milestone banner), with a speed-up and a skip. The rules have already moved on, so animation speed never affects the game. The milestone banner is UI-only and driven by the `milestone` event; it isn't a rules screen.

### Transitions

| Screen | Legal actions | What happens |
|---|---|---|
| `build` | `place`, `install` from the hand, `renovate` (D-102), or `pass`: ends the week | → end of week (below) |
| | `reroll` if `rerollsLeft > 0` | new hand; `draws + 1` |
| | `demolish` if `demolitionsLeft > 0` and it wouldn't split the house | piece, boulder, or Old Shed removed, no refund; a find pays its reward |
| | `install` from supplies, `useTool`, `sell` | free; the week goes on |
| | `completeEarly` if score ≥ target, weeks remain in the phase, and it isn't an overtime week | → fast-forward (below) |
| `changeOrder` | `answerChangeOrder` | → `shop` |
| `shop` | `buy`, `sell`, `refreshShop`, `leaveShop`; while a crate is open, only `pick` (an option, or `i = -1` to discard) and `sell` | `leaveShop` → `build`, next phase, week 1. Leaving without buying anything pays the skip reward. |
| `won` / `lost` | none; every action throws | |

`setAutoComplete` is legal on every screen except `won` and `lost`, and takes effect from the next tally.

**End of week:**

1. `resolveWeek` runs and adds the tally to the score. Effects that last only this week (from tools) then expire.
2. If the score just crossed the target, `targetReached` fires. If auto-complete is on, the score is at or above the target, and weeks remain, the game completes early.
3. If that was the phase's last week (or an overtime week):
   - target met → the milestone resolves (below)
   - otherwise, if overtime is left → an overtime week starts
   - otherwise → `lost`
4. Otherwise the next week starts.

**Start of week:**

1. Transforms resolve (a Sapling old enough becomes a Tree), so the board the player sees is the board that scores.
2. The hand is drawn in two rows (D-121): `roomsRow` distinct Rooms cards (2) and `layoutRow` distinct Layout cards (2), each from its own pool: pieces, plus fixtures from phase 2. A type at its limit in the checklist draws at half weight (D-104).
3. Each card with no play (no legal spot, no legal host, and no Renovation) is swapped for another card from its row, up to `swapTries` (3) tries: the first with a play, else the last tried. A reroll redraws one row (or both) and swaps the same way; the reserve doesn't count.

**Fast-forward (D-040):**

1. `weeksSaved` is the number of the phase's weeks not yet tallied. For a manual click mid-week, that includes the current week, and its hand is discarded. The bonus is computed at that moment:
   - score: `roundHalfUp((score − phaseStartScore) × earlyScorePct × weeksSaved / 100)`
   - budget: `earlyBudget × weeksSaved`
   - `earlyRewardPct` (Juniper) scales both
2. Each remaining week then runs `resolveWeek(state, null)`. Pieces earn and timers tick, but no hands are drawn. These weeks aren't passes.
3. The milestone resolves with result `'early'`.

**Overtime week (D-041):** an extra week appended to the current phase. The next phase still gets its full 4 weeks, so a run can last up to 30 weeks. Its hand is keyed `draw/<phase>/ot<k>/<n>`, it uses the phase's remaining rerolls, phase effects still apply, and it can't be completed early. If the target still isn't met after the last overtime week's tally, the run is lost.

**Milestone resolves:**

1. Reward: budget, plus the early bonus if any, plus interest if you own the Savings Account upgrade.
2. Expired timed effects drop.
3. Active requests are checked, and unviolated restrictions are paid.
4. Then: after the last milestone → `won`; after milestones 2, 4, and 6 → `changeOrder`; otherwise → `shop`.

### Scoring pipeline (D-037, D-056)

A week's score is **Points × Mult**, in the style of Balatro's Chips × Mult and Combolands' points × mult × enchant. There are three layers, each with its own color, sound, and (eventually) name (§12):

- **Points:** what every piece earns from its neighbors. Common, local, and the bulk of every week.
- **+Mult:** additive and fairly common: specs met, sets held, and a few blueprints and tools. It starts at ×1.
- **×Mult:** multiplicative, rare, and powerful. Each source needs a setup you plan for: a set, the timing of the week, or something that builds up over the run. Only Rare blueprints, one Rare fixture, and the Full House set give it.

The research behind the split: Balatro puts ×Mult on 70% of its Rare jokers and 3% of its Common ones, and its players often confuse +Mult with ×Mult because both are red and called "mult". So the two get different colors and names.

Per piece, in placement order:

1. `points` = base + all flat terms: neighbor bonuses and penalties, per-tile bonuses, growth, rhythm payouts, flat bonuses or penalties from auras, and a Renovated room's +4 a level (D-102).
2. `pct` = the sum of all percentage terms: auras, tastes, blueprints, fixtures, crew, phase effects, and this week's tools. **Percentages add**, so two "earn double" effects make +200% (×3), not ×4.
3. `earned = floor((max(0, points) × max(0, 100 + pct) + 50) / 100)`. Integer math, rounding half up. Penalties can never combine into a positive score. If any "earns nothing" term applies, `earned = 0`.
4. `bestPiece` (Crown Jewel) then applies its percentage to the single highest `earned`, using the same formula. Ties go to the earliest-placed piece.

For the week (all Mult values are integers in hundredths, so ×1.25 is 125):

5. **Points** = `Σ earned + Σ set Points` (each set instance's Points at its level, scaled by any `setBonus` with the same formula).
6. **+Mult:** `mult = 100 + specBonus × specsMet + Σ set Mult + Σ mult modifiers`, where each set's Mult is also scaled by `setBonus`. `specBonus` is 25 in `balance.ts` (Dream Home raises it to 35), so 4 specs met give ×2, the same as D-037's additive spec bonus (refines D-021).
7. **×Mult:** each distinct active ×Mult source multiplies `mult` once, whatever number of pieces trigger it: `mult = floor((mult × times + 50) / 100)`. Distinct sources multiply each other, so three different ×2 sources make ×8, but one source can never apply twice (Ballionaire's rule). The order is fixed: sets, then fixtures, then blueprints, then this week's tools. That removes Balatro's joker-order puzzle, which suits a cozy game.
8. **Total** = `floor((Points × mult + 50) / 100)`.

The UI shows **Comfort × Charm** (D-019's names for Points and Mult), two visible numbers in the style of Balatro's chips × mult, with ×Mult sources landing as gold **Sparkle** stamps and the total in **Wow**. The tally plays the layers in order: pieces add Points, sets add Points and +Mult, specs add +Mult, then each ×Mult source lands separately (§12). Every term records a `BreakdownLine { source, label, op, value }`, and the preview shows the change to Points, to Mult, and to the total. "Earns nothing" only zeroes a piece's earnings: it still counts for sets, specs, and It's a House.

**Number range:** integer math is exact up to 2^53 (about 9×10^15) in JavaScript, far beyond a 7-milestone run. An endless mode (D-024) would need BigInt or floats, and big numbers get commas, then K/M suffixes, then scientific notation only above about 10^12.

### Layout rules (D-035)

Derived from `HouseState`, cached by house object identity:

- **Categories:** `indoor` (rooms, including the Garage and the Hallway), `yard`, and `outbuilding` (the "-house" pieces). A **room** is an indoor piece that isn't a connector (the Hallway is a connector).
- **Neighbors:** two pieces are neighbors if any of their tiles share an edge; no diagonals. A neighbor counts **once**, however many edges it shares, and once per effect even if it matches several parts of that effect.
- **Terrain as neighbors (D-049):**
  - Each Tree tile is a neighbor tagged Quiet and Green, and a view source. A piece at the edge of the woods can touch several, so every effect that counts Trees or views has a `max`.
  - **Water bodies** (the Pond and the Creek) count once each, however many of their tiles a piece touches. They have no tags and are view sources.
  - The **Street** runs along the bottom edge, outside the grid: one neighbor tagged Loud for any piece touching that edge.
  - Boulders give nothing.
  - **Finds** (M3b) give nothing as neighbors; they pay a one-time reward (below).
- **Placement:** inside the lot, not overlapping pieces, water, Boulders, or the Old Shed. Building over a Tree removes it, and the preview shows what's lost. Only a Driveway can be built over the Creek (it gets a culvert), so a house on the far bank can still have a Garage. Nothing else can, so the house sits on one bank; yard pieces can go on either.
- **Finds:** the **Old Shed** (2×2) blocks building until it's demolished, which pays its reward. The **Time Capsule** (1×1) doesn't block: the first piece built over it pays. Rewards are data (`Reward`), and the inspect panel shows them before you commit. A multi-tile feature is one object: demolishing any of its tiles removes all of it, its reward pays once, and its `find/<x>,<y>` key uses its top-left tile.
- **One house:**
  - If any indoor piece exists, a new indoor piece must touch one.
  - Demolishing an indoor piece that would split the house is illegal ("This would split the house").
  - If the last indoor piece is demolished, the next can go anywhere.
- **Garage and Driveway:** the Garage (indoor) must touch the house and also touch the street or a Driveway. A Driveway must touch the street or another Driveway, so driveways always connect to the street.
- **Effective tags**, resolved in a fixed order:
  1. layout facts
  2. own tags, plus **Dark** if interior and **Sunny** if a building (a room, a Hallway or an outbuilding) with a tile in the sun (D-120)
  3. `grantTag`, then `removeTag` modifiers (from blueprints, change orders, crews, and fixtures), matched against step 2's tags only; a modifier can't grant the tag it selects on
  4. type identity: `{ piece: X }` matches id X, `countsAs: X`, or a `countsAs` modifier
  5. conditions, specs, and sets
  6. per-piece effects
- **Exterior and interior:** a room is exterior if any of its tiles touches a non-indoor tile or the lot edge; otherwise it's interior.
- **View:** a piece touching a view source (a Tree, the Pond, the Creek, or a piece with `givesView`: Flower Bed, Herb Garden, Greenhouse), or one with a `grantView` modifier (Bay Window). "Per View" counts distinct adjacent sources, with a `max`.
- **Regions:** a multi-tile piece is *in* a region only if all its tiles are.
  - **Front yard:** every non-indoor tile in a row nearer the street than the house's front row (the row of its indoor tile closest to the street). Before the first room, all yard is front yard. Back yard is every other non-indoor tile, including the side yards. Counting by rows keeps "front yard" a real position on a wide lot, where a narrow house would otherwise make whole columns beside it front yard.
  - **Fenced yard:** flood-fill all non-wall tiles (walls are indoor tiles and Fence tiles; water, boulders, trees, finds, yard pieces, and outbuildings are all part of regions). The lot edge bounds the fill like a wall (it's the property line). A region is fenced if it doesn't touch the street edge, has at least 10 tiles (4 until D-069), borders at least one Fence, and borders the house (at least one indoor piece). The house rule stops a lone L-Fence in a corner from counting as a yard. "Fenced yard of 12 tiles" means the largest single one.
  - On a big lot this makes siting matter: a house built near a side or back edge closes a yard with one or two Fences, while a house in the middle needs more.
- **Links:** a Hallway (or a connected group of Hallways) links every room touching it. Open Concept links Kitchens, Dining Rooms, and Living Rooms in one connected group. Links count as adjacency for scoring, sets, and specs. They don't count for connectivity, exterior/interior, or enclosure, and a Hallway isn't itself a neighbor for bonuses.
- **Fixtures (D-050):**
  - A fixture is installed in a placed piece that matches its `fits` selector (a Fireplace fits any room; a Sprinkler fits a Lawn).
  - Each piece holds one fixture. Installing a second replaces the first, and the preview shows what's lost.
  - A fixture's modifiers apply to its host only (the `{ host: true }` selector), from the tally of the week it's installed.
  - It goes when its host is demolished; there's no refund.
  - A piece that becomes a lot feature (the Sapling, which becomes a Tree) can't hold one, since the fixture would go with it (D-095).
  - It doesn't change the host's shape, category, or connectivity.

### Performance

The 24×24 lot has four times the tiles of 12×12, so the sim needs more care than the UI.

- **Hover preview:** one `resolveWeek` per hovered cell and rotation, cached by `(card, x, y, rot)`. Well under a frame.
- **Layout:** cached per house. Flood fills over 576 tiles take microseconds.
- **Sim:**
  - `scoreOnly` skips breakdown lines.
  - Candidates are deduplicated by shape symmetry (a 2×2 has one orientation, a 1×N has two).
  - Indoor candidates must touch the house anyway. On a terrain-dense lot nearly every tile is near a feature, so pruning yard candidates saves little.
  - The greedy bot ranks candidates by a cheap local score (the piece's own earnings plus its neighbors' changes) and runs the full `scoreOnly` on the top 12 only. The top 12 always includes any candidate that completes a set instance or meets a spec (a cheap check against their definitions), since those move the week's Mult. This is the default design, not a fallback.
  - **Benchmark gate in M2:** one greedy run under 1 second on one core, measured on the densest-terrain lot of 50 seeds. If it misses, cut the top-K, then add worker threads.

---

## 5. Content data format (D-038)

Content is **typed object literals** in `src/content/*.ts` (`export const pieces = [...] as const satisfies readonly PieceDef[]`). Ids, tags, and properties are string-literal unions, so a typo is a compile error and editors autocomplete.

`validateContent()` checks what types can't:

- every id resolves
- every shape is a connected polyomino
- text generates for every piece
- every client's spec pieces have a nonzero draw weight for that client
- `drawWeight` modifiers appear only on clients and crews, so weights stay fixed for the run

Each client also has a hand-built **witness layout** in its tests that meets all its specs. That proves the specs can be met without writing a solver.

**What "content is data" means in practice:** the rules implement a fixed set of effect kinds, selectors, conditions, and modifiers. A new piece, client, crew, or change order built from them is pure data. A genuinely new mechanic (the influencer's "best piece earns triple") is one new effect kind in code, and then it's data again. A named escape hatch (`{ kind: 'custom', id }`) covers true one-offs without a refactor. Appendix B writes out every Core item this way; none needs the escape hatch.

### Pieces, selectors, and conditions

```ts
type Tag = 'Quiet' | 'Loud' | 'Social' | 'Wet' | 'Sunny' | 'Outdoor' | 'Green'
         | 'Kid' | 'Pet' | 'Pretty' | 'Dark' | 'House'
type Region = 'sunny' | 'frontYard' | 'backYard' | 'fencedYard'
type Property = 'indoor' | 'yard' | 'outbuilding' | 'room' | 'exterior' | 'interior' | 'view' | 'viewSource'

interface PieceDef {
  id: PieceId; name: string; tier: 'core' | 'stretch' | 'later'
  category: 'indoor' | 'yard' | 'outbuilding'
  connector?: true             // Hallway: links rooms, isn't a room itself
  wall?: true                  // Fence: blocks fenced-yard flood fill
  canCover?: FeatureId[]       // Driveway: ['creek'], a culvert
  givesView?: true
  countsAs?: PieceId           // L-Kitchen counts as a Kitchen
  shape: string[]              // ASCII rows: '#' filled, '.' empty
  tags: Tag[]
  drawWeight: number           // 10 = normal; 0 = not in the base pool (special pieces)
  complexity: 1 | 2 | 3        // D-055: 1 = plain earners, 2 = conditions and timers, 3 = build-arounds
  fromPhase: number            // hard gate, rarely used: earliest phase it can be drawn (fixtures: 1)
  effects: Effect[]
}

interface FeatureDef {         // terrain (D-049)
  id: FeatureId                // 'street' | 'tree' | 'pond' | 'creek' | 'boulder' | 'oldShed' | 'timeCapsule'
  name: string; tier
  tags: Tag[]                  // tree: Quiet, Green
  blocks: boolean              // can't be built on: pond, creek, boulder, oldShed
  clear?: 'buildOver' | 'demolish'   // tree: building over removes it; boulder, oldShed: a demolition
  viewSource?: true
  body?: true                  // orthogonally connected tiles of the same feature count as one neighbor: pond, creek
  size?: [number, number]      // a multi-tile object, such as the Old Shed's [2, 2]
  reward?: Reward              // finds: paid once when cleared (oldShed) or first built over (timeCapsule)
}
// Generation numbers (counts, sizes, the creek's chance) live in balance.ts, not here.

interface FixtureDef {         // D-050
  id: FixtureId; name: string; tier; rarity: Rarity
  fits: Selector               // which placed pieces can host it
  drawWeight: number           // 0 = shop only
  fromPhase: number
  price: number                // in the shop
  modifiers: Modifier[]        // targets are { host: true }
}

type Selector =                                   // which pieces (or features)
  | { piece: PieceId | PieceId[] }                // matches id or countsAs
  | { feature: FeatureId | FeatureId[] }
  | { host: true }                                // inside a FixtureDef: the piece it's installed in
  | { hasFixture: FixtureId | 'any' }
  | { tag: Tag }                                  // effective tags
  | { property: Property }
  | { in: Region }                                // every tile of the piece is in the region
  | { touching: Selector; min?: number }          // pieces touching at least `min` matches
  | { any: Selector[] } | { all: Selector[] } | { not: Selector }
  | 'all'

type PieceCondition =                             // about one piece: requires, conditional
  | { touching: Selector; min?: number }
  | { in: Region }
  | { borders: 'fencedYard' }
  | { is: Selector }
  | { inSet: SetId }                               // the piece is a member of a held instance of this set
  | { and: PieceCondition[] } | { or: PieceCondition[] } | { not: PieceCondition }

type HouseCondition =                             // about the house: specs, requests
  | { count: Selector; min?: number; max?: number }
  | { countNew: Selector; min: number }           // placed since the change order was accepted, still on the lot
  | { none: Selector }                            // pieces only; lot features don't count
  | { adjacentPair: [Selector, Selector] }
  | { fencedYardTiles: { min: number } }          // largest single fenced yard
  | { group: Selector; minTiles: number }         // largest connected group of matching tiles
  | { set: SetId; min?: number }
  | { demolishedSinceAccepted: { min: number } }
  // M4a, for the house rules (D-101):
  | { ratio: { count: Selector; per: Selector; every: number; min?: number } }   // a Bathroom for every 2 Bedrooms
  | { outline: { minRooms: number; maxRooms?: number; minFillPct: number; maxAspect: number } }  // Under one roof
  | { variety: { of: Selector; min: number; maxEach: number; exempt?: Selector } }              // a tidy yard
  | { stages: { fromPhase: number; condition: HouseCondition }[] }   // by milestone: a household that grows
  | { and: HouseCondition[] } | { or: HouseCondition[] } | { not: HouseCondition }
// Counts over piece types count rooms by their own card, weighted by countsAs modifiers for
// that type: Bunk Beds make a Bedroom count twice, and a Kitchen Island doesn't add a Dining
// Room (D-101). A count with a `max` over piece types is that type's limit (D-102, D-104).
```

### Effect kinds

The ten types from `content-brainstorm.md` become eight kinds here: the neighbor bonus and penalty merge into one kind, and sets get their own definition. Four new kinds and the escape hatch are added:

| Kind | Fields | Examples |
|---|---|---|
| `steady` | `amount` | Closet |
| `neighbor` | `match`, `amount` (negative = penalty), `max?` | Bedroom next to Trees; next to the street; Lawn per adjacent Lawn |
| `aura` | `match`, `pct?` or `amount?`, `scope: 'adjacent' \| 'region'` | Dining Room boosts the Kitchen; Playroom penalizes Quiet neighbors; Mudroom boosts Pet pieces in the fenced yard it borders |
| `rhythm` | `every`, `amount` | Pool |
| `growth` | `perWeek`, `max?` | Good Bones (granted by a blueprint; counts from the later of placement and purchase) |
| `enclosure` | `perTile`, `cap?` | Fence: per tile of the fenced yards it borders, with the cap on the total |
| `transform` | `into: { piece } \| { feature: 'tree' }`, `afterWeeks` | Sapling → Tree (becomes a lot feature) |
| `economy` | `budget`, `every?` | Garage, Home Office |
| **`perTile`** *(new)* | `region`, `amount` | Herb Garden on tiles in the sun |
| **`link`** *(new)* | — | Hallway |
| **`requires`** *(new)* | `condition: PieceCondition`, `blocksPlacement` | Garage must touch the street or a Driveway (blocks placement); Doghouse earns only in a fenced yard (doesn't block) |
| **`conditional`** *(new)* | `when: PieceCondition`, `effect` | Flower Bed bonus in the front yard |
| `custom` | `id` | Escape hatch |

An unmet `requires` makes the piece earn no score and no budget, and shows a warning icon. Nothing is removed automatically.

### Sets, rewards, modifiers, clients, crews, change orders

```ts
interface SetDef {
  id: SetId; name: string; tier
  members: Partial<Record<PieceId, number>>  // { bedroom: 1, bathroom: 1, closet: 1 }
  connected: boolean                         // members form one connected group (links count)
  hub?: PieceId                              // the hub touches every other member (Jack-and-Jill)
  maxInstances?: number                      // Full House: 1
  points: number; mult: number               // paid every week while the set holds, like a poker hand's chips and mult
  times?: number                             // a ×Mult while held (Full House: 200)
  level: { points: number; mult: number }    // added per level from the Remodel Plans tools (Balatro's Planets)
  reward?: Reward                            // anything else: paid once, on first completion
}
// Instances are matched greedily in placement order; a piece joins at most one instance per set type.
// RunState.setLevels: Partial<Record<SetId, number>> holds each set type's level, from 1.

interface Reward { score?: number /* a one-time Wow payout */; budget?: number; rerolls?: number; demolitions?: number; overtime?: number
                  tool?: ToolId | 'random' }          // a tool goes into supplies (the Old Shed's 'random')
// No Core content grants overtime, so D-041's 2 overtime weeks per run hold.

type Modifier =
  | { kind: 'earn'; target: Selector; pct: number; when?: 'lastWeekOfPhase' }  // "Dark pieces earn double" → +100
  | { kind: 'bestPiece'; pct: number }                               // Crown Jewel: the week's top earner, after other terms
  | { kind: 'mult'; add: number; per?: Selector }                    // +Mult in hundredths, optionally per matching piece (It's a House)
  | { kind: 'xMult'; times: number; plusPer?: { per: Selector | RunStat; add: number }
      when?: 'lastWeekOfPhase' | { house: HouseCondition } | { host: PieceCondition } }
      // ×Mult in hundredths: times + add × count. Model Home: times 100, plusPer {hasFixture any, 10} → ×(1 + 0.1 per fixture)
  | { kind: 'earnNothing'; target: Selector }
  | { kind: 'grantTag'; target: Selector; tag: Tag }                 // Eternal night
  | { kind: 'removeTag'; target: Selector; tag: Tag }                // Skylight: no longer Dark
  | { kind: 'grantView'; target: Selector }                         // Bay Window
  | { kind: 'blockPenalties'; target: Selector; from: Selector }     // Soundproofing: Loud neighbors' penalties don't apply
  | { kind: 'countsAs'; target: Selector; as: PieceId; times?: number }
  | { kind: 'link'; among: PieceId[] }                             // Open Concept
  | { kind: 'grantEffect'; target: Selector; effect: Effect }        // Good Bones; counts from the grant week
  | { kind: 'perCountOver'; match: Selector; over: number; pct: number }  // Juniper's room limit
  | { kind: 'setBonus'; set?: SetId; pct: number }                   // +N% to a set's Points and +Mult (Thanksgiving, Architect)
  | { kind: 'budget'; target: Selector | 'all'; pct: number }        // Dale: economy output doubled
  | { kind: 'drawWeight'; target: Selector; add?: number; pct?: number }  // clients and crews only
  | { kind: 'rule'; key: RuleKey; add?: number; pct?: number }

type RuleKey = 'rerollsPerPhase' | 'demolitions' | 'overtime' | 'reserveSlots'
             | 'shopPricePct' | 'earlyRewardPct'
             | 'blueprintSlots' | 'supplySlots' | 'roomsRow' | 'layoutRow' | 'specBonus' | 'interestMax'   // shop goods (D-121: the rows replace handSize)
type RunStat = 'milestonesEarly'                    // counts for scaling ×Mult (Ahead of Schedule)
// Values combine as (base + Σ add) × (100 + Σ pct) / 100, integer, rounded half up.

interface ClientDef {
  id; name; rarity: 'common' | 'uncommon' | 'rare'; tier; brief: string
  specs: { id: string; name: string; group: 'household' | 'shape' | 'yard' | 'wishes'
           condition: HouseCondition; text?: string }[]   // the seven house rules first (D-101)
  tastes: Modifier[]
  pool: Modifier[]               // drawWeight only
  changeOrders: ChangeOrderId[]
  targetPct: number              // per-client target factor from the sim; 100 = default
}

type Rarity = 'common' | 'uncommon' | 'rare'

interface BlueprintDef { id; name; tier; rarity: Rarity; price: number; modifiers: Modifier[] }

interface CrewDef { id; name; tier; blurb: string; modifiers: Modifier[]; startReserve?: PieceId[] }
// Starting pieces sit in extra reserve slots that don't count against the 2.

type ChangeOrderDef = { id; name; text: string; scope: 'generic' | ClientId; tier } & (
  | { kind: 'request'; condition: HouseCondition; reward: Reward }       // accept or decline; met by the next milestone
  | { kind: 'phase'; modifiers: Modifier[] }                             // announced; applies for the next phase
  | { kind: 'restriction'; forbid: Selector; reward: Reward }            // place nothing matching during the next phase
)

interface ActiveChangeOrder { id: ChangeOrderId; acceptedWeek: number; untilPhase: number; violated: boolean; demolished: number }
```

### Shop goods (D-051)

```ts
interface ToolDef { id: ToolId; name; tier; rarity: Rarity; price: number; use: ToolUse }

type ToolUse =                                         // one small function per kind in rules/tools.ts
  | { kind: 'move' }                                   // Moving Truck: a placed piece, fixture and all, to another legal spot
  | { kind: 'copy' }                                   // Copy Machine: a placed piece's card into the reserve
  | { kind: 'weekModifiers'; modifiers: Modifier[] }   // Rush Order, Open House Party: this week's tally only
  | { kind: 'specialHand' }                            // Catalog: redraw this hand from special pieces and fixtures
  | { kind: 'advanceTimers'; weeks: number }           // Fertilizer: every timer on the lot moves forward
  | { kind: 'reward'; reward: Reward }                 // Dumpster
  | { kind: 'levelSet'; set: SetId }                   // Remodel Plans: +1 level for a set type, for the rest of the run

interface UpgradeDef { id: UpgradeId; name; tier; price: number; modifiers: Modifier[] }   // `rule` modifiers, permanent

interface CrateDef {                                   // a pack: open it, see 3 options, keep 1
  id: CrateId; name; tier; price: number
  contents: 'blueprint' | 'fixture' | 'piece'
  pool?: 'base' | 'special' | 'all'                    // for pieces: Showroom 'special', Garden Center 'all'
  filter?: Selector                                    // Garden Center: yard pieces and outbuildings
}

type PickOption = { kind: 'blueprint' | 'fixture' | 'piece'; id: string }

type ShopOffer =
  | { kind: 'blueprint' | 'piece' | 'fixture' | 'tool' | 'crate' | 'upgrade'; id: string; price: number }
  | { kind: 'service'; service: 'reroll' | 'demolition'; price: number }
```

- **Where things go:** blueprints into their slots; pieces into the reserve (placing one is the week's turn); fixtures and tools into supplies (free to use).
- **Prices:** generated from the item's price, the `shopPricePct` rule, and the sale. Services rise by 1 per purchase for the rest of the run, up to a cap. The refresh price rises within a visit and resets at the next.
- **Stock:** each visit's slot counts and rarity weights per phase are numbers in `balance.ts` (Appendix A).
- **Rarity** is shown on every blueprint, fixture, and tool as a colored border plus a label, not color alone. Blueprint, fixture, and tool slots, and the Folio and Fixture Crate, all roll rarity with the current shop's blueprint weights.
- **Full slots:** buying needs a free slot where the good goes, and a crate needs a free slot of its contents' kind; otherwise the offer is greyed out with the reason. Offers and crate options never include a blueprint or upgrade you already own. An opened crate can be discarded instead of picked.

A request whose condition is already true when it would be offered is skipped for another. "Add a / an X" requests use `countNew`, so existing pieces don't count.

### Examples

```ts
// pieces.ts
{ id: 'bedroom', name: 'Bedroom', category: 'indoor', tier: 'core', drawWeight: 10, complexity: 1, fromPhase: 0,
  shape: ['##', '##'], tags: ['Quiet'],
  effects: [
    { kind: 'steady', amount: 3 },
    { kind: 'neighbor', match: { any: [{ feature: 'tree' }, { tag: 'Quiet' }] }, amount: 1, max: 3 },
    { kind: 'neighbor', match: { tag: 'Loud' }, amount: -2 },            // the street is Loud
  ] },
{ id: 'bathroom', name: 'Bathroom', category: 'indoor', tier: 'core', drawWeight: 10, complexity: 1, fromPhase: 0,
  shape: ['#'], tags: ['Wet'],
  effects: [
    { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 3, max: 1 }, // earns nothing alone; Jack-and-Jill pays the rest
    { kind: 'neighbor', match: { piece: 'kitchen' }, amount: -2 },
  ] },
{ id: 'garage', name: 'Garage', category: 'indoor', tier: 'core', drawWeight: 10, complexity: 2, fromPhase: 0,
  shape: ['##', '##'], tags: ['Loud'],
  effects: [
    { kind: 'requires', blocksPlacement: true,
      condition: { touching: { any: [{ feature: 'street' }, { piece: 'driveway' }] } } },
    { kind: 'steady', amount: 1 },
    { kind: 'economy', budget: 1, every: 3 },
  ] },
{ id: 'sapling', name: 'Sapling', category: 'yard', tier: 'core', drawWeight: 10, complexity: 2, fromPhase: 0,
  shape: ['#'], tags: ['Green'],
  effects: [{ kind: 'steady', amount: 1 }, { kind: 'transform', into: { feature: 'tree' }, afterWeeks: 4 }] },

// sets.ts
{ id: 'jackAndJill', name: 'Jack-and-Jill', tier: 'core',
  members: { bedroom: 2, bathroom: 1 }, connected: true, hub: 'bathroom',
  points: 10, mult: 50, level: { points: 8, mult: 25 } },        // Mult in hundredths: +0.5

// clients.ts
{ id: 'vladislav', name: 'Count Vladislav', rarity: 'rare', tier: 'core', targetPct: 100,
  brief: 'Somewhere quiet. Somewhere… dark.',
  specs: [
    { label: '3 Dark rooms', condition: { count: { all: [{ property: 'room' }, { tag: 'Dark' }] }, min: 3 } },
    { label: 'A Library',    condition: { count: { piece: 'library' }, min: 1 } },
  ],
  tastes: [
    { kind: 'earn', target: { tag: 'Dark' }, pct: 100 },
    { kind: 'earnNothing', target: { tag: 'Sunny' } },                    // so a Pool earns nothing: "no Pool"
    { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 50 }, // likes shade
    { kind: 'earn', target: { piece: 'herbGarden' }, pct: -100 },         // garlic
  ],
  pool: [{ kind: 'drawWeight', target: { piece: 'library' }, add: 20 }],
  changeOrders: ['covenVisiting', 'eternalNight'] },

// crews.ts
{ id: 'landscaper', name: 'Landscaper', tier: 'core', blurb: 'Yard pieces show up more and earn more.',
  modifiers: [
    { kind: 'drawWeight', target: { property: 'yard' }, pct: 50 },
    { kind: 'earn', target: { property: 'yard' }, pct: 25 },
  ],
  startReserve: ['sapling', 'fence'] },

// change-orders.ts
{ id: 'grandmaMovingIn', name: "Grandma's moving in", scope: 'generic', tier: 'core', kind: 'request',
  text: 'A new Bedroom with a Bathroom touching it.',
  condition: { countNew: { all: [{ piece: 'bedroom' }, { touching: { piece: 'bathroom' } }] }, min: 1 },
  reward: { budget: 3 } },
{ id: 'bigDeadline', name: 'Big deadline', scope: 'dale', tier: 'core', kind: 'restriction',
  text: 'Place nothing Loud next phase.', forbid: { tag: 'Loud' }, reward: { budget: 4 } },
{ id: 'heatWave', name: 'Heat wave', scope: 'generic', tier: 'core', kind: 'phase',
  text: 'Pools and shady spots earn double; sunny rooms earn half.',
  modifiers: [
    { kind: 'earn', target: { piece: 'pool' }, pct: 100 },
    { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 100 }, // Trees don't earn; their neighbors do
    { kind: 'earn', target: { all: [{ property: 'room' }, { tag: 'Sunny' }] }, pct: -50 },
  ] },
```

Shape variants (L-Kitchen, the long Hallway) are separate cards that share a type through `countsAs`. `text.ts` turns effects into plain sentences, such as "+1 for each touching Tree or Quiet piece".

---

## 6. Seeded randomness, run codes, and replays (D-039)

- **PRNG:**
  - A hand-rolled `sfc32` (128-bit state; add, shift, and xor only), seeded through `splitmix32` from an FNV-1a hash of the key, with the first 12 outputs discarded.
  - About 20 lines with no dependency.
  - `Math.imul`, `| 0`, and `>>> 0` keep results identical in every browser and in Node.
- **Keyed substreams, not one shared generator.** The rules never store a generator. Each random decision derives a fresh one from the run seed and a key:

  | Key | Decides |
  |---|---|
  | `lot/<attempt>` | Lot features (the attempt number goes up if a lot is regenerated) |
  | `jobs/<i>` | Contract *i*'s seed on the job board. The chosen contract's seed becomes the run seed. The board itself sits outside `apply` and the run code. |
  | `draw/<phase>/<slot>/<n>/<row>` | Each row of a hand (D-121: `rooms`, `layout`). `slot` is the week in the phase, or `ot1`/`ot2` for overtime. `n` counts this week's draws: 0 for the first, then +1 for each reroll and the Catalog tool. |
  | `draw/<phase>/<slot>/<n>/<row>/swap<k>` | The swaps for the row's k-th card, when it has no play (D-121). They don't count as draws. |
  | `shop/<phase>/<refresh>` | Shop offers |
  | `co/<phase>` | The change order offered |
  | `crate/<phase>/<refresh>/<slot>` | The 3 options inside a crate (and the first shop's free Housewarming crate) |
  | `find/<x>,<y>` | A find's random reward |
  | `bot/<phase>/<screen>/<n>` | Sim bots only |

  Keying hands by phase and slot means a reroll, overtime, or early completion never shifts any later hand, the shop, or change orders. Draw weights come only from the crew and client, so they're fixed for the run.
- **Daily Lot:** the seed is `daily-<UTC date>`, and the Daily fixes the client and the crew too. So every player gets the same lot and the same hand for the same week and draw count. UTC keeps friends in different time zones on the same day.
- **No floating-point drift:** scores are integers, and percentages use integer math (§4). No `Math.pow`, `exp`, or trig in the rules.
- **Run codes:**
  - `OH1.` + base64url of `{ build, contentHash, setup, actions, pending? }`.
  - `build` is the git short SHA, stamped in by Vite. The UI shows it in a corner with the channel: `main`, `dev`, or `local`.
  - `pending` is an optional tentative placement, so a "the preview said +12 but I got +9" bug can be reproduced.
  - A **Copy run code** button and a `?run=` URL parameter replay a run. A bug report is one string and becomes a regression test.
  - To reproduce a code from an older build: `git checkout <build>` and replay locally.
- **Save and resume:** the same structure goes to `localStorage` after every action (best-effort; itch.io's iframe can lose storage). Keys are namespaced by channel, because the release and `/dev/` builds share one origin (D-060). On load:
  - same `build` and replay succeeds → resume
  - otherwise → a short "The game updated, so this is a fresh run" note, with the old run code kept for a bug report

  Loading never blocks or crashes.
- **Error boundary:** any exception in `apply` or rendering shows "Something broke. Copy run code", with a feedback link. Every crash becomes a bug report.

---

## 7. Build order

### How we work (D-053, D-054)

- **The team is two:** you and Claude. Claude implements. You playtest, review, and decide. There are no parallel tracks.
- **Phases, each ending in a playtest.** Every phase ends with something you can play, a short list of questions it should answer, and a fix pass on what you find before the next phase starts. The phase order is the priority order: if time runs short, we stop after a phase that works.
- **No day timeboxes.** You have until next week to build and playtest before sharing with the larger group, so the plan doesn't schedule by day.
- **Before every playtest, Claude:**
  - runs the tests, and from M2 the smoke sim (per client once clients exist in M4a)
  - from M2, runs the target sim (`--suggest-targets`)
  - plays a quick run in the browser pane, and fixes anything broken
  - writes a one-screen note: what's new, what to try, and the playtest questions
- **Branches (D-054, D-060):**
  - `develop` is cut from `main`, is the GitHub default branch, and is where work lands.
  - Each phase gets a branch off `develop` (for example `phase/m1-slice`). It merges into `develop` by PR after its playtest, so every phase is one reviewable diff.
  - `main` holds releases. You open and merge a PR from `develop` into `main` whenever it's a good point for a release; tagging it (`v0.1`, …) is optional.
- **Protected branches (D-061):**
  - `develop` and `main` change only through PRs. Nobody can push to them directly, force-push, or delete them.
  - Every PR needs a passing CI job `test`. Since D-064, no code-owner review is required, so you merge your own PRs normally.
  - I merge my setup and fix PRs once `test` passes, and phase PRs after you say the playtest went well. Releases into `main` are yours (D-064).
  - Release PRs into `main` must be merge commits.
- **Two links on GitHub Pages (D-060):**
  - releases at https://swalliso.github.io/house-game/
  - the latest `develop` at https://swalliso.github.io/house-game/dev/, to share work in progress with other jam members
- **Playtests run locally** with `npm run dev`, which Claude can open in the browser pane, or `npm run build && npm run preview` for the production build. Once a phase merges, the same build is also at `/dev/`.
- **Contracts as we go:** each phase writes out the full types for what it builds in `rules/index.ts`. Later phases extend them. Nothing needs freezing for parallel work.

### Phase overview

| Phase | Builds | Playtest asks |
|---|---|---|
| M0 · Setup | Repo, branches, tooling, CI, docs move | (none: CI is green, and the placeholder page loads) |
| M1 · Vertical slice | 12 weeks, 6 pieces, the 24×24 lot, the preview, a first pass at juice | Is the loop fun? Is the lot the right size? Does a big week feel good? |
| M2 · Full run | 7 milestones, all base pieces, early completion, overtime, the sim | Does a whole run hold up? Are the targets fair? Is early completion a real choice? |
| M3 · Economy, shop, fixtures | M3a, then M3b | Is the shop exciting? Do fixtures feel like upgrades? Is anything a must-buy? |
| M5a · Look and feel | LimeZu's art at 32 px cells, the lot, the house cutaway, and the pixel UI | Does it look like a house? Can you read every piece at a glance? |
| M4 · Clients and variety | M4a (clients, sets), then M4b (change orders, crews, hints) | Do clients feel different? Are sets and multipliers worth planning for? |
| M5a · Juice | The full visual reward feedback and the roof reveal, in its own pull request | Do big moments land? Is anything too slow or too flashy? |
| M5b · Sound and music | Music and the reward sound set | Is the music calm? Do the sounds fit the moments? |
| M6 · Balance and polish | Full sim, tuning, the end screen, a codex if time allows | Would you show this to the group? |
| M7 · Release | Your PR from `develop` into `main`, which updates the root link; optional itch.io page | (shared with the group) |

M5 is split (D-097): M5a, the look and feel, comes after M3 and before M4, and M5b, the sound, after M4. M5a's visual juice is its own pull request after M4 and before M5b (D-097's juice note). Each ends in a playtest.

### M0 · Setup

- The planning docs are already on `develop` (committed 2026-11-05, before any code). Branch `phase/m0-setup` from it.
- `.gitignore` (`node_modules/`, `dist/`, `art-source/`), an empty `assets/licenses.json`, and `CREDITS.md`. The `.gitignore` backs up the local exclude that's already in place.
- npm project with Vite, Preact 10, TS 6, Vitest, and Prettier; the two tsconfigs; the purity test.
- **GitHub setup: already done (2026-11-05, with your OK, via the `gh` CLI):**
  - `develop` is the default branch, and the local `origin/HEAD` follows it
  - Pages is on, with *GitHub Actions* as its source, at https://swalliso.github.io/house-game/
  - the `github-pages` environment allows deployments from both `main` and `develop`
  - your main checkout is on `develop`
  - `art-source/` is in the repo's local `.git/info/exclude`, which covers every branch and worktree
  - branch rulesets for `develop` and `main`, and `.github/CODEOWNERS` (D-061)
- **One Actions workflow (`ci.yml`):**
  - a test job (typecheck, tests, build) on every push and PR to `develop` and `main`. Its id is exactly `test`, with no `name:` and no matrix, because the rulesets require a check by that name.
  - a deploy job on pushes to either branch. It checks out both branch tips, builds each with its channel (`main`, `dev`), and publishes one site: `main` at the root and `develop` at `/dev/`. Until `main` has a build, the root is a placeholder that links to `/dev/`.
  - *Changed by D-063 during M0:* `ci.yml` runs `test` on PRs and on `phase/**` and `fix/**` pushes, and `deploy.yml` tests both branches before publishing, so a broken `develop` never blocks a release.
  - deploys run one at a time, in a `pages` concurrency group
- Move the docs into `docs/`. Add `CLAUDE.md` (§11) and `README.md`. Update `jam-scope.md` to match the decisions (§1d).
- **Done when:** CI is green on the M0 PR into `develop`; after it merges, `/dev/` shows the placeholder page and the root shows its placeholder; `npm run dev` works locally.

### M1 · Vertical slice

- **Rules:**
  - grid, shapes, and rotation
  - lot generation on 24×24: the street, woods and lone trees, the creek, the pond, boulders, and the sunny side, with the regeneration checks (Appendix A)
  - placement checks with reasons, including the one-house rule
  - neighbors and View
  - effect kinds `steady`, `neighbor`, and `aura`
  - `resolveWeek`, the tally with breakdown, `preview`, Pass
  - scoring as **Points × Mult** (D-056), with **Jack-and-Jill and Entertainer as the first sets**, so Charm moves from the start; the other sets and specs come in M4a. All five of their members are slice pieces.
  - set matching (`sets.ts`) for those two sets
  - **3 milestones × 4 weeks with hand-set rising targets** from a `balance.ts` array
  - seeded hands of 3 distinct pieces, weighted toward simple pieces (D-055)
  - `apply` and events
  - run codes
- **Pieces (6, as 7 cards):** Bedroom, Bathroom, Kitchen (2×2, plus the 3-tile L-Kitchen card), Dining Room, Living Room, Lawn (2×2). Between them they cover bonuses, the street penalty, an aura, a piece that only earns with a neighbor, View, and indoor versus yard.
- **UI:**
  - the board with Claude-drawn 16px placeholder sprites and terrain tiles, built into the final atlas format and sprite ids (D-057), at the default whole-number scale (§12); zoom and pan come in M2
  - a settings panel with the tally speed (0.5×–8×) and Reduce motion (on by default when the browser asks for it)
  - 3 cards with generated text
  - a ghost that follows the cursor
  - rotate with R, right-click, or an on-screen button
  - legality with the reason, in colorblind-safe colors (blue for good, orange for bad, hatching for illegal) and never color alone
  - the live preview: net weekly change, with +/− badges on affected pieces and features
  - tentative placement plus **End week** (a tap places tentatively, which also covers touch)
  - a top bar with the week, Wow, and the target
  - inspect on hover or tap
  - a milestone banner and a run-end screen
  - a controls hint strip ("Pick a card · R rotate · click to place · End week")
  - the build label
  - below about 900px wide, a "best played on a computer" notice (D-047)
  - the error boundary, with a feedback link (a GitHub issue prefilled with the run code)
  - New run (showing the seed) and Copy run code
- **Juice, first pass (D-059):** enough feedback to judge whether the loop feels good:
  - the tally director: pieces pop one at a time, Points and Mult counters tick up, then multiply into the week's total
  - a rising-pitch blip per piece, from placeholder zzfx sounds
  - one bigger celebration tier for a big week
  - speed-up and skip
  - the audio unlock on the first click
- **Tests:**
  - shapes and rotation, placement, connectivity, neighbors
  - each effect kind
  - the scoring formula's edge cases (negative points, percentages below −100, exact halves)
  - `preview` equals the real tally (property test)
  - same seed → same game
- **Playtest 1:**
  - Would you start another run?
  - Does the 24×24 lot feel too big, too small, or right?
  - Can you tell why a placement scored what it did?
  - Does a big week feel like a big week? Does landing a Jack-and-Jill or an Entertainer, and watching its Charm multiply the week, feel good?
  - Your copied run code replays.

### M2 · Full run and rules breadth

- **Run loop:**
  - 7 milestones with names (D-018)
  - early completion with fast-forward and its reward
  - the auto-complete toggle (off)
  - overtime, rerolls, demolitions (with the split-house check), the free redraw
  - the forecast line
  - a title screen (Start, Continue, How to play)
  - save and resume; win and lose screens
  - the camera: wheel zoom in whole-number steps by re-laying out the board (D-057), drag to pan, and a Fit button
- **Rules breadth:**
  - every layout property (exterior/interior/Dark, Sunny, front and back yard, fenced yards)
  - the remaining effect kinds: `rhythm`, `growth`, `transform`, `perTile`, `link`, `requires`, `conditional`, `enclosure`, and `economy` (budget accrues; spending comes in M3)
  - every **base-pool** Core piece as data (9 indoor, 7 yard, 3 "-house"), each with a unit test, including the Fence's 1×4 and L cards and the Driveway's 1×3 and 1×5 cards
  - `rule` modifiers for crews, so the General Contractor (the only crew until M4b) gets its extra reroll
- **Sim v1 (§8):**
  - random and greedy bots, about 200 runs
  - `--suggest-targets` writes the first real target curve into `balance.ts`
  - the benchmark gate (§4)
  - lot fill and enclosure cost
- **Debug tools:**
  - a `?debug` panel: jump to phase N with a bot-built house, add budget, give a card, force a milestone result, instant tally
  - a `?seed=` override
  - later phases add their own hooks: force the shop and give any good (M3), `?client=` (M4a), force a change order and `?crew=` (M4b)
- **Art:** the source is chosen (LimeZu, D-057). Once you've bought the packs and put them in `art-source/`, sprites can replace placeholders whenever they're ready, without waiting for M5.
- **Playtest 2:**
  - Does a full 28-week run hold your attention?
  - Are the targets fair, with an early loss feeling deserved?
  - Is completing early ever tempting?
  - Do the terrain and the house's position matter?
  - Which pieces are confusing or never worth it?

### M3 · Economy, shop, and fixtures

**M3a, first:**

- Budget from milestone rewards, early completion, and economy pieces. Change-order rewards arrive in M4b.
- The full modifier set and every rule key, including the fixture modifiers (`removeTag`, `grantView`, `blockPenalties`), `bestPiece`, and the ×Mult sources (D-056).
- **Blueprints:** 4 slots, sold back for half. The five original blueprints first, then the rest of Appendix B's as data. Dream Home only acts on specs, so the shop offers it once M4a adds clients. The same goes for the Inspector's Visit tool in M3b.
- **Fixtures (D-050):**
  - `install` from the hand (the week's turn) and from supplies (free)
  - **supplies:** 3 slots, holding bought fixtures now and tools in M3b; sold for half
  - one fixture per piece
  - the 11 Core fixtures, as data. The Rare Chandelier (a ×Mult source) needs the Entertainer set and is offered from M3a, since that set arrives in M1.
  - fixtures join the draw from phase 2
- **Special pieces:** the 4 Core plus the 5 shop pieces (Appendix B), as data.
- **The HUD** for the reserve, supplies, and blueprint slots.
- **The shop screen (D-051):**
  - a section per kind of good, with rarity borders and labels
  - the sale item, the rising refresh, the reroll and demolition services, selling
  - offers from the `shop` stream

**M3b, then:**

- **Tools:** the 7 tool kinds and the 12 Core tools, sharing the supply slots. The Remodel Plans for Jack-and-Jill and Entertainer are offered from M3b; those for Suite and Full House join once M4a adds those sets.
- **Company upgrades:** one offered per visit from the second shop on; the 7 Core upgrades, as `rule` modifiers.
- **Crates:**
  - the pick-1-of-3 screen
  - the 4 Core crates
  - the first shop's free Housewarming crate (pick 1 of 3 Common blueprints)
- The skip reward and Savings Account interest.
- **Finds:** the Old Shed and Time Capsules on the lot, with their rewards.
- **The shop bot:**
  - Each offer is valued by one `scoreOnly` with it applied, times the weeks left, per unit of budget.
  - Tools follow simple rules (for example, Rush Order in the last week of a phase that's short of its target).
- **Sim reports** for shop purchases, and fixture and tool use (§8).

**Playtest 3:**
- Is every shop visit interesting?
- Is there something you want but can't afford?
- Do fixtures feel like upgrades to your house?
- Is any blueprint a must-buy, or never worth it?
- Are the tools fun to use?

### M5a · Look and feel: art and UI chrome

After M3 and before M4 (D-097): the visual half of what makes these games feel good (D-057, D-059, and §12). Its juice is its own pull request after M4 (below), and the sound half is M5b, after that.

- **Art (§12, Art):**
  - LimeZu's art at 32 art px per cell, cut from the packs by `npm run art:cut`, with the camera's new scales
  - terrain and the yard: muted grass, the sunny side, water, trees, and the yard pieces
  - the house as a walls-down cutaway built from the placed pieces: a floor per room type, walls with doorways and windows, and several furniture sprites per room
  - fixtures as sprites where they fit, and as badges otherwise
  - UI chrome (wood-panel frames and the pixel font), with the readable-font option
- **Playtest 5a:**
  - Does the house look like a house?
  - Can you read every piece at a glance?
  - Is the pixel interface easy to read, and can you find everything?

### M4 · Clients, sets, change orders, and crews

Built alongside M5a, on its own branch (`phase/m4-clients`, pull request #17), and merged after it (D-097's juice note). *2026-11-08:* M4 renumbered its decisions to D-101–D-109, merged `develop`, and put its new screens in M5a's pixel UI and its new pieces in LimeZu's art (D-110, D-111), for playtest 4.

**M4a, first:**

- Clients:
  - the spec checklist, live with progress ("Bedrooms 3/4")
  - a moment for a spec being met; M5a's juice, after M4, gives it its full celebration (§12)
  - tastes and pool weights
  - `targetPct`
  - rarity
- Order: Hendersons and Vladislav first, then the Barkers, Dale, and Juniper. Each comes with its witness layout test.
- Sets: Suite and Full House join Jack-and-Jill and Entertainer (from M1), as Mult sources (D-056).
- **Run setup:** a job board of 3 contracts, then a crew pick.
  - Each contract shows its lot as a thumbnail, so players can match a lot to a client. Combolands players read the starting map the same way to choose guilds.
  - On a first visit, contract 0 is always the Hendersons. They and the General Contractor are marked "Recommended for your first job". The board sits outside `apply` and the run code, so this doesn't affect replays.
  - Until M4b, the General Contractor is the only crew.

**M4b, then:**

- After milestones 2, 4, and 6, **one** change order arrives, as in `jam-scope.md`:
  - **requests:** accept or decline; reward, no penalty
  - **restrictions:** accept or decline; broken if a forbidden piece is placed
  - **phase effects:** announced, then applied for the next phase
- Crews: General Contractor, Landscaper, Architect.
- **First-time hints** at:
  - the first week
  - the first spec checklist
  - the first *Complete early* button
  - the first shop
  - the first fixture
  - the first change order
  - the first arrival (D-103)

  Each is dismissible and remembered in `localStorage` (UI only, not game state).
- **Sim reports** per client and per crew (§8).

**Playtest 4:**
- Do the Hendersons and Vladislav play differently?
- Did you plan around a set or a multiplier, and did it pay off?
- Are change orders fun or annoying?
- Does the crew pick matter?
- Would a newcomer get through a first run with the hints?

### M5a's juice · its own pull request

After M4 and before M5b (D-097's juice note): the reward feedback on M5a's art, for M4's game.

- the tiered celebration ladder (§12)
- distinct moments for a set completing, a Rhythm payout, a find, opening a crate, a Rare in the shop, and a spec being met
- M4's moments, beyond the simple pops M4 gives them (`house-systems-review.md` §6): a Renovation's level-up (M4 pops the room's stars, D-111), an arrival and the arrivals' markers on the progress bar, a change order's stamp, a house rule met or lost, and "Topped out!" the first week Under one roof holds
- screen shake and particles, with Reduce motion, the Screen shake slider, and the Flashing toggle
- the roof reveal at the Roofing milestone
- D-094 (chain reactions, Open) would change the tally's order and add steps to it. Raise it with the team before this pull request reworks the tally.
- **Its playtest:**
  - Do big moments feel big, and small ones stay out of the way?
  - Is anything too slow or too flashy?

### M5b · Sound and music

After M4 (D-097). The sound half of the feel pass (D-058 and §12).

- at least 2–3 calm tracks of 2–3 minutes, each with 3–4 synced stems (building, shop, milestone review, crate) (§12)
- the reward sound set, with pitch ladders in the music's key
- ducking under big moments
- master, music, and sound-effect volume, saved
- **Playtest 5b:**
  - Is the music relaxing after 20 minutes?
  - Do the reward sounds fit their moments, and does anything get too loud?

### M6 · Balance and polish

- **The full sim (§8):** the planner bot, early-completion variants, and per-client and per-crew sweeps.
- Tune targets, prices, rewards, rarity weights, Mult values, and each client's `targetPct`.
- **The end screen:** the finished house captioned "It's a house.", a photo of the house at each milestone, the score with its verdict (Fixer-Upper to Dream Home), and a copyable result line (with a fallback for itch.io's iframe).
- A codex, if time allows.
- Bug fixes from every earlier playtest's list.
- **Playtest 6:** play three full runs with different clients and crews. Would you show this to the group?

### M7 · Release

- You open and merge a PR from `develop` into `main` (tag it if you like). The deploy job updates the root link. Earlier releases can happen at any good point, not only here.
- Optionally, an itch.io page: cover image, 3 screenshots, short description, controls, and a 1600×900 embed with fullscreen (D-047, D-057).

### If time runs short

Phases go in priority order, so stopping after any playtested phase leaves a working game. Stopping after M2 is the smallest version worth sharing. Within a phase, cut in this order before dropping the phase. The catalog is data, so a smaller one (fewer blueprints, fixtures, tools, or upgrades) is always a valid cut.

- **In M2:**
  - drop the Treehouse, the Greenhouse, and the Sapling (and its transform); the Landscaper's starting pieces become a Fence and a Lawn
  - let the Garage touch only the street (no Driveway; a far-bank house then has no Garage)
  - give the Fence one card
  - move Growth to M3
  - keep Fit and defer zoom and pan
  - keep the debug panel to "jump to phase N" only
- **Later, in order:**
  1. The codex
  2. The job board → a simple client picker
  3. Crates and the pick screen; shop 1 gives one free Common blueprint instead of the Housewarming crate
  4. Tools down to 4 kinds: Moving Truck, Rush Order, Dumpster, and Remodel Plans
  5. Finds
  6. Savings Account, the skip reward, and rising service and refresh prices (flat prices instead)
  7. The Architect crew
  8. Company upgrades down to the three simplest: Storage Unit, Foreman, Supplier Discount
  9. Juniper and Dale
  10. Yard fixtures (keep the ones for rooms)
  11. Phase-effect and restriction change orders (keep requests)
  12. The Full House set

The auto-complete toggle isn't on this list: M2 builds it, and D-040 (Accepted) includes it. Juice isn't on it either: it's what makes the game worth playing (D-059).

---

## 8. Headless simulation and tuning (D-044)

The rules are pure, so the sim is the same `apply()` driven by bots in Node: no browser, no build step.

```
npm run sim -- --runs 200 --policy greedy
npm run sim -- --check
npm run sim -- --ban blueprint:fengShui
```

`--client` and `--crew` come with M4's clients and crews. `npm run sim -- --help` lists the rest.

### M2 version: the minimum that answers "are the targets right?"

- **Bots:**
  - `random`: a random legal placement each week
  - `greedy`: the best `scoreOnly` delta this week
- **Process:** one process, about 200 runs, top-K candidate ranking, and the 1-second benchmark gate.
- **Report:** cumulative score at each milestone (p10, p50, p90) and survival per milestone, plus lot fill and placements spent on enclosures, as a console table.
- **`--suggest-targets`:** cumulative score grows roughly with the square of the week, so targets follow the sim's median curve, a power curve so far, not ×2 per milestone. ×Mult may steepen it; the M3 and M4 reports will show by how much. Each target is `α × median greedy score` at that milestone, with α rising from about 0.6 (the first milestone teaches and should almost always pass) to about 0.85 by milestones 4–5, then flat. (D-072 sets α per milestone instead. Since D-089 the fit uses seeds `sim-*` and is checked on held-out seeds `check-*`.)

### Added in M3 and M4

- **Policies:** the M3b shop bot (value per budget) and tool rules, and a default change-order policy: accept requests, decline restrictions. Since D-089: `novice` (a random card that fits, at its best spot), greedy's `--early` and `--strikes` variants, and a chaos bot for tests.
- **Reports** (all exist: most since D-089, and the per-client, per-crew and house reports since M4a, D-089's M4a note):
  - per-piece pick rate, score share, and dead-card rate
  - per-client and per-crew piece mixes and win rates, and change orders by client (M4)
  - the house report: room counts, repeats, Bedrooms per Bathroom, research.md's plausibility check, the glance measures, and each checklist line's hold rate by client (D-093; `house-systems-review.md` Appendix)
  - early-completion choices and their payoff, per phase
  - shop: how often each good is offered, bought, and in winning runs; budget left unspent
  - fixtures and tools: how often each is used, and the weekly gain it brought
  - house siting (distance from the street and from the edges)
  - JSON output for spreadsheets
- **Paired A/B runs** (D-089): `--ban kind:id` and `--gift kind:id` on the same seeds, reporting the seeds won by only one arm. Use 400 or more runs before acting on a difference under about 7 points.

### Added in M6, only as needed

- **More bots:**
  - `planner`: greedy plus weights for missing spec items, unfinished sets, and early long-term earners
  - `early:smart`: early-completion choices by expected payoff. `early:always` and `early:never` exist since D-089, as `--early always` and `--early never`.
- **Reports:** overtime use, free redraws and passes, and what top-scoring houses contain. (Per-crew win rates exist since M4.)
- **Worker threads**, if a full sweep is slow.

### Starting criteria to playtest against

- `random` fails by milestone 2 or 3.
- `greedy` clears milestones 1–3 about 95% of the time and wins about 40–50% of runs.
- `planner` wins about 75% of runs.
- **Early completion is a live choice:** in every phase where it's offered, `early:smart` takes each option at least 25% of the time, and `early:always` and `early:never` end within about 10% of each other. Rewards per week saved are tuned per phase in `balance.ts`.
- No Core client or crew is more than about 15 points of win rate away from the others, after `targetPct`.
- **No must-buy:** no blueprint, upgrade, or tool appears in more than about 60% of `planner` wins, and every one appears in some.
- **Fences pay their way:** a fenced yard costs `greedy` 2–3 placements on a typical lot.

**Checking them** (D-089): `npm run sim -- --check` runs greedy, random, novice, and greedy with `--early always` on held-out seeds, and prints each criterion as PASS, FAIL, or NOT MEASURED. The verdict follows the estimate; it's "sure" when the 95% interval sits on the same side of the line. How each is measured:
- `random` loses at or before milestone 3 in at least 95% of runs.
- Milestone 1 teaches: `novice` passes it in at least 90% of runs.
- `greedy` clears milestones 1–3 in 92–98% of runs, and wins 40–50%.
- Early completion: `--early always` and `--early never` win within 10 points of each other, paired by seed, and the report prints the median ratio of their final scores. `early:smart`'s 25% waits for M6.
- Fences: the enclosure probe's median is 2–3 Fence cards, and at least 50% of greedy runs are offered that many Fence cards by milestone 4.
- `planner` and no must-buy print as NOT MEASURED until M6. Until then, `--ban` on paired seeds stands in for no must-buy. Since M4 the client and crew spread is measured on runs that cover more than one client or crew (`--client all`, the default, and `--crew all`).

### Determinism

Same seed and policy give identical results (a test). Each run is a pure function of seed, policy, and content, so the worker count never matters. A run past 400 actions in a week or 20,000 in all stops with a SimError that carries its run code (D-089), so a looping bot fails fast instead of hanging CI.

---

## 9. Testing

- **Rules unit tests:**
  - every part of `layout.ts`
  - each effect kind and modifier
  - placement, connectivity, and demolition
  - scoring edge cases
  - milestones: on time, early with fast-forward, overtime, failed
  - lot generation: the regeneration checks hold for 1,000 seeds, and the creek never touches the street edge
  - fixtures: install from the hand and from supplies, replacement, removal with the host
  - the shop: stock per visit, the sale, refresh and service prices, selling, crates, the skip reward
  - each tool kind and each change-order kind
- **Property tests** (fast-check, on TEST_CONTENT; the chaos test checks the first one on the real content), kept to the few that pay for themselves:
  - `preview(s, p).after` equals the `tally` total from `apply(s, p)` for a placement or an install, and `preview(s, p).before` equals the one from `apply(s, pass)`
  - `scoreOnly` equals `preview().after`
  - `replay(log)` reproduces the state
  - rotating four times is the identity
  - a free action (a supplies install or a tool) never changes `week` or any later week's hand; only Catalog redraws the current one
- **Content:** `validateContent()`, plus each client's witness layout meeting all its specs.
- **Purity test:** see §3.
- **Smoke sim in `npm test`:** the random bot, 5 seeded runs per Core client, under 30 seconds. It covers the "no run-breaking bugs" definition of done. Since D-089 greedy also plays the same 5 seeds to the end, each replayed from its run code, with at least 3 reaching shop 3 and using a tool or supply; it must beat random on every seed; and the step cap must stop a looping bot. Balance stays in `npm run sim`.
- **Chaos test on the real content** (D-089): a bot that tries every kind of action, with debug cheats to reach the economy, all seven phases, and the six shops. After every step it checks the state's invariants and preview() against apply(), and that a malformed action throws IllegalAction without changing anything. Each run replays from its run code. Across its seeds it must reach every action, every tool kind, every milestone result, a win, and a loss; if a content change leaves a gap, it plays up to 6 more seeds before it fails. It runs through `simulateRun`, so the step caps apply.
- **Real-content pins:** `src/content/tools.test.ts` pins the real tools, upgrades, and crates (ids, prices, and one effect each), like `fixtures.test.ts` does for fixtures.
- **UI:** no unit tests for the jam. Screens are checked by playing them locally before each playtest, with the `?debug` panel used to reach late-run screens quickly.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Players don't understand why they scored | The net-change preview, marked neighbors, the inspect panel, and generated plain-language text, all in M1 |
| The loop isn't fun | M1 is 12 weeks long with a "would you play again?" check; the core is cheap to rework before M2 |
| Balance can't be tuned in a week | The sim arrives in M2; targets and per-client factors are data |
| Time runs out before next week | Phases go in priority order and each ends playable; stopping after M2 is the smallest shareable version; the cut list within each phase (§7) |
| The 24×24 lot feels empty, or cells are too small to read | Terrain covers about a fifth of the lot; bigger yard pieces; finds; camera zoom; the M1 playtest asks about it, and the size is two numbers in `balance.ts` |
| More content than time allows (fixtures, a bigger shop) | Fixtures and shop goods are data on top of a few small mechanisms; the cut list trims tool kinds and catalog size before any client |
| Juice or art arrives too late to judge the feel | A first pass at juice is in M1, sprites can replace placeholders from M2 on, and M5 is a whole phase for feel |
| Multipliers blow up the targets | ×Mult is rare and tied to setups; the sim measures the spread from M3, and targets come from the sim (D-056) |
| New builds break saved runs and old codes | Build-stamped run codes; `replay` never throws; stale saves start fresh with a note |
| Someone opens the link on a phone | D-047: desktop first, tap works, and below about 900px a "best on a computer" notice |
| Libraries newer than Claude's training data (Vite 8, Vitest 5, TS 6) | Little config is touched; versions are pinned; CLAUDE.md lists the gotchas; Preact stays on 10 |
| itch.io iframe limits (clipboard, storage) | Clipboard fallback and best-effort storage; GitHub Pages stays the main link |
| Scope creep | `jam-scope.md` Stretch and Out lists stand, except the moves in D-050 and D-051 (Fixtures and five special pieces join the jam build); anything new goes into `decisions.md` as Proposed first |

---

## 11. Proposed CLAUDE.md

The repo has no CLAUDE.md, so M0 creates one with this content (the paths assume the move to `docs/`). *CLAUDE.md is the live copy now, and it has moved on since: read it, not this section.*

```markdown
# Open House

Our one-week game jam entry (theme: "It's a house"): a browser roguelite where you
build one house for one client, placing one piece per week.

## Read first
- docs/decisions.md is the decision log. Accepted = settled. Proposed = the default;
  build on it. Stop and ask only when an Open item blocks the phase you're on, or
  before changing an Accepted decision. Log new decisions as D-### entries and update
  statuses instead of deleting; do it in the same PR as the change.
- docs/implementation-plan.md: architecture, data format, build order.
- docs/jam-scope.md, docs/content-brainstorm.md, docs/research.md.
- Combolands (Aug 2026) is newer than your training data; use docs/research.md, not memory.

## Codebase rules
- src/rules is pure TypeScript: no DOM, no Preact, no Math.random, no Date. Randomness
  only through rules/rng.ts keyed streams; state changes only through apply().
  A test enforces this.
- New content is data in src/content. Add an effect kind only when data can't
  express it, and test it.
- "Fixtures" are game content: upgrades installed in a placed piece.
- develop is the default branch. Work on a phase branch off develop and open a
  PR into develop. main holds releases: the user opens develop → main PRs.
  Rulesets (D-061) block direct pushes to develop and main, so always push a
  branch and open a PR. Never merge PRs yourself; the user merges. The required
  CI check is the job `test`, and release PRs into main use merge commits.
- Pages: releases at https://swalliso.github.io/house-game/, develop at /dev/.
  Saves are namespaced by channel (main, dev, local).
- Score layers: code says points / mult / xMult / total; the UI says
  Comfort / Charm / Sparkle / Wow (D-019). Labels live in one constants file.
- Juice is core (D-059): timing numbers live in src/ui/fx/feel.ts. Pixel art
  renders at whole-number scales; the Fit overview is the one exception. The
  camera zooms by re-laying out the board, never with transform: scale().
  Short juice tweens (pops, wobble, celebration zooms) may use transforms.
- Assets: record every file in assets/licenses.json and CREDITS.md. Paid packs
  stay in the gitignored art-source/ folder; commit only the sprites we use.
  Never add NC, SA, or GPL assets, or anything taken from another game.
- The UI never computes scores: it renders state, calls preview(), and plays events.
- Node runs .ts directly: use .ts import extensions and `import type`; no enums or namespaces.
- Vite 8 renamed build.rollupOptions → rolldownOptions and esbuild → oxc.
  TypeScript is pinned to 6.0.x; Preact is pinned to 10.x.

## Commands
npm run dev · npm test · npm run typecheck · npm run sim -- --help
Bug reports are run codes: open them with ?run= or paste them into a replay test.
```

---

## 12. Feel: juice, sound, art, and the score's names (D-057, D-058, D-059)

The team treats reward feel as core: big combos should feel like Balatro and Combolands, big moments should escalate the way Vampire Survivors' chests do, and everything else should stay calm. The sources are in `research.md`'s second 2026-11-05 update.

- The numbers below are starting values. They live in `src/ui/fx/feel.ts`, which is UI code, not rules, and get tuned by playing.
- Balatro's numbers come from a community decompilation of the shipped game. We use them as reference only and reimplement the ideas; no code or assets are copied.

### The weekly tally

1. **Pieces trigger one at a time,** in placement order. Each trigger does four things:
   - a popup at the piece in the Points color
   - the next note of the pitch ladder
   - a squash-and-wobble on the piece
   - a tiny screen-shake impulse
2. **Sets held light up next,** each adding its Points (Points color) and its +Mult (Mult color, with a warmer chime). Then each spec met adds +Mult. The score panel lists the sets; on a window under 1000 px tall it folds them into one row (and keeps to its equation while a play is looked at), how many with their Points and Mult added up and the list in its tip, a set a line. In the tally that row counts up from "0 sets" with the sets counted so far, lighting with each one, its numbers popping (D-098's 2026-11-08 change, D-110).
3. **Each ×Mult source then lands on its own:** a gold "×2" stamp, a heavier, lower sound, and a bigger wobble. It's the heaviest-sounding moment in a normal week.
4. **The multiply moment:**
   - a 0.4 s pause
   - Points and Mult collapse into the week's total with a pulse
   - it holds for about 0.8 s, then drains into the run total, which counts up

**Timing:**
- About 0.45 s per trigger at 1× speed. Balatro uses 0.75–0.94 s, but a house has 20–40 pieces. Popups hold for the step minus 0.15 s.
- **Auto-acceleration**, as in Balatro, so long weeks never drag:
  - an accelerator grows by 0.2 × speed per second during a tally's steps: the triggers, the sets, and the ×Mult stamps
  - effective speed is the chosen speed + max(0, accelerator − 1), capped at +8×
  - the closing beats, from the multiply moment on, play at the chosen speed, so the biggest weeks keep their payoff (D-096)
- **Speed setting:** 0.5×, 1×, 2×, 4×, 8×.
- Hold Space (or the right mouse button) to fast-forward, or click to jump to the result. The final number is never hidden.

### The celebration ladder

Intensity is measured against **pace**: `max(1, (this phase's target − the score at the start of the phase) ÷ weeks per phase)`, fixed when the phase starts, so it never reaches zero even after the target is met. The rules expose it in the `tally` event. `I = log5(week total ÷ pace)`. Within the Normal tier, the glow and the soft pad start at 1× pace.

| Tier | When | What it adds |
|---|---|---|
| Normal | under 2× pace | the tally only |
| Good | 2× pace or more | sparkles on the score panel, a short chime |
| Great | 5× pace or more | its own sting, a confetti and coin fountain, a warmer background, a music swell |
| Huge | 25× pace or more, or a Great week that beats your all-time best week (kept in the browser) | slow motion on the last trigger, a gentle zoom, the full fanfare, the tower of house sprites |

- **Each tier has its own jingle,** like Vampire Survivors' 1-, 3-, and 5-item chests. The first time a tier appears it plays in full. After that every tier is skippable, since an unskippable top chest was Vampire Survivors' most-cited annoyance.
- **The glow,** our version of Balatro's flames: the score panel glows once the week's total passes pace, more strongly as `I` grows. It glows during the placement preview too, so a great placement lights up before you commit. LocalThunk calls the flames the feature he's proudest of.
- **The pile,** from Combolands: sprites of the week's scoring rooms fly into a stack by the score box. Bigger weeks stack higher, and a Huge week builds a little tower.
- **The milestone moment,** from Peggle:
  - when the tally is about to cross a milestone target, it slows to 0.5× and zooms gently on the piece that crosses the line
  - a drumroll, then a sting
  - under 2.5 s, and a click skips it
- **The roof reveal:** at the Roofing milestone (D-018) the house gets its roof for a moment. The end screen shows a photo of the house at each milestone, as Combolands does.
- **Shop and crates:**
  - crates glow by rarity before they open, as Hearthstone packs do
  - Rare goods arrive with a shimmer and a sound
  - budget counts up coin by coin: 0.18 s per coin, faster above 9 and above 20, and a single "+N" above 60, as in Balatro
- **Restraint:** a study of 3,018 players (Kao, 2020) found that no juice and extreme juice both did worse than medium or high. Per-trigger shake stays around 1–3 px and decays in about 0.2 s. Bigger impulses are only for tiers and milestones.

### Numbers

- Points are whole numbers. Mult shows at most two decimals (×1.5, ×2.25).
- Commas, then K/M suffixes above a million on popups. Scientific notation only above 10^12.
- The score panel's week total sizes itself to its plaque: from the hero size down, in whole steps of the pixel font's grid, as its digits grow, so a Wow of up to seven digits stays inside the frame in the narrowest column, and one of up to six keeps a clear gap after its word (D-110).
- Bigger numbers quiver slightly more with each extra digit, as in Balatro.
- Each tile's weekly score is a small white digit with a dark outline in the tile's bottom-right corner, as in Combolands (lifted above another piece's roof that rises into it).

### Settings and accessibility (from M1, completed in M5)

- **Reduce motion:** on by default when the browser reports `prefers-reduced-motion`. It turns off wobble, zoom, parallax, and shake.
- **Screen shake:** a slider from 0 to 100, default 50.
- **Flashing:** a toggle. Never more than 3 flashes per second over a quarter of the screen, and no red strobes.
- **Volume:** separate sliders for master, music, and sound effects, saved in the browser.
- **Font:** a readable-font option alongside the pixel font. Combolands added one after launch.

### Sound (D-058)

- **Each layer gets its own timbre:**
  - Points: a soft wooden plink
  - +Mult: a warm chime
  - ×Mult: a reserved bell or gong, lower and about 3 dB quieter but with more low end, never used for anything else
  - placing a piece: a soft "fwp" or "thock", with different sets for rooms and yard pieces
- **A pitch ladder in key,** from Peggle 2:
  - each trigger steps up the current track's pentatonic scale, starting from the root each week
  - after about two octaves it holds the top note and adds a sparkle
  - 3–5 samples cover the whole range through `detune`
  - Balatro's simpler continuous rise (+1.6% pitch per trigger) is the fallback
- **Scheduled on the audio clock:** a 25 ms timer schedules everything due in the next 100 ms. The visuals read the same clock, so pops and sounds never drift apart.
- **Escalation layers, gated on pace and scaled by log:** a soft pad at 1× pace, a shimmer at 3×, and a choir or organ swell at 10× or more, capped at about 40% volume. Balatro gates its flames, and the fire and organ sounds that go with them, on beating the blind in the same way.
- **Ducking:** under tier jingles the music drops 9–12 dB over 50 ms and recovers over 1 s. Web Audio has no sidechain, so this is gain automation.
- **Variation:** 3–4 round-robin samples per sound, with ±0.05 rate and ±1.5 dB of randomness. The ladder is the exception.
- **Losing:** the music glides down to about 0.6× speed over a second instead of cutting out (Balatro slides to half speed).

### Music

- **Calm:**
  - 70–90 BPM
  - sparse plucked and mallet instruments: nylon guitar, marimba, kalimba, soft Rhodes
  - major, mixolydian, or pentatonic harmony, with rests

  Tempo, not style, drives arousal (Bernardi et al., 2006). Balatro plays its tracks at 0.7× speed.
- **Synced stems:** 3–4 stems with the same tempo, key, and length (building, shop, milestone review, crate). They start together and crossfade with about a 0.3 s time constant, so changing screens never restarts the music. A track without stems changes with the screen through the music bus's low-pass filter and level instead (M5b, D-131).
- **Enough of it:** at least 2–3 tracks of 2–3 minutes. Combolands' single short loop is its most-cited audio complaint.
- **Files:** OGG with an M4A fallback, loaded after the title screen (D-130). The tracks play through in a shuffled order with a short rest between them, so no loop points are needed (D-131).
- **Mix:** about −16 to −18 LUFS, with music 8–10 dB under sound-effect peaks.

### Audio implementation

- **Our own Web Audio wrapper,** about 200–300 lines:
  - unlocks audio on the title screen's Start click
  - master, music, and sound-effect buses
  - the scheduler, the detune ladder, stem crossfades, and ducking
- **ZzFX** (MIT, under 1 KB) makes the placeholder sound effects from M1.
- No Tone.js or Howler: we'd use little of either.

### Audio sources and licenses

- **Prefer CC0:**
  - Kenney's audio packs (UI Audio, Interface Sounds, Casino Audio, Music Jingles)
  - Freesound, filtered to CC0
  - the Abstraction/Tallbeard music loop bundle
  - the VCSL and VSCO-2-CE sample libraries
  - Ninja Adventure's music and sound effects
- **CC BY 4.0** is fine with credit, for example YannZ's Indie Meditations loops.
- **Never:** CC BY-NC, CC BY-SA, GPL, or anything taken from another game. That includes Balatro's sounds, which are rehosted online.
- **Records:** every file goes in `assets/licenses.json` (source URL, author, license), and `CREDITS.md` lists them.

### Art (D-057, D-097)

- **The grid:** one game cell is 32 art px, a 2×2 block of LimeZu's 16 px tiles (D-097). LimeZu draws furniture in a 3/4 view for rooms about 4 tiles wide (a double bed is 26×40 px), so at one tile per cell a Bedroom couldn't hold its bed. Combolands looks like 16px tiles drawn at 3× on a 1080p screen.
- **Scale:** `scale` is CSS px per art px, in whole device pixels per art pixel: k ÷ devicePixelRatio, k a whole number. The default zoom is the largest such scale at which the board fits (the lot, its street row, and the two rows of road drawn below it, `ROAD_ROWS` in `geometry.ts`, plus 24 art px of room above the lot for the top row's tree tops, `CANOPY_ROOM`), and never below 1× rounded down to whole device pixels, panning when the board overflows. So it's always one of the wheel's steps. A new run starts scrolled to the street row, the road a short pan below it.
  - **The design target is 1080p** (confirmed 2026-11-05; most players have at least a 1080p screen). The whole lot fits there at 1×: 32 CSS px per cell, an 864px board with the street and the road, the lot the same size on screen as 2× was with 16 px art, with room for the top bar.
  - At 1280×720 the lot can't fit at 1×. The default there is 1× with panning, with UI panels overlaying the board's margins (Combolands' panels sit over the sea around its island).
  - The wheel steps one device pixel per art pixel at a time, up to 3×: 1×, 2×, and 3× at a devicePixelRatio of 1, and 0.5× to 3× by halves on a Retina screen.
  - The Fit button is the one exception to whole numbers: it shows the whole board at the largest scale that fits (about 0.69× at 720p), with slightly uneven pixels.
  - Where display scaling isn't a whole number (125%, 150% or 175%: a devicePixelRatio of 1.25, 1.5 or 1.75, or browser zoom on top), 1× isn't whole device pixels, so the default's floor rounds it down to one device pixel per art pixel: 0.8×, 0.67× and 0.57×, cells of 25.6, 21.3 and 18.3 CSS px (D-097's zoom note). A window that holds two device pixels per art pixel gets 1.6× or 1.33×. Below a ratio of 1 (a browser zoomed out) the floor is one device pixel per art pixel, above 1×. A zoom step that lands back on the default, or leaving Fit, returns to it, and it follows the window again.
  - The costs: finer pixels on a 1080p monitor (a Retina screen still shows each art pixel as 2×2 device pixels), a smaller board on a 1440p screen at a devicePixelRatio of 1, and where display scaling isn't a whole number a board 80%, 67% or 57% of 1×'s size (at 125%, 150% and 175%) when two device pixels per art pixel don't fit.
  - If we make an itch.io page, its embed is 1600×900 with fullscreen. 1280×720 stays the minimum (D-047).
- **Rooms are a walls-down cutaway,** like The Sims, built in the UI from the placed pieces (D-097):
  - a floor per room type
  - walls as bands in LimeZu's style (its outline color around a light fill), drawn from a mask over the whole house: about 6 art px on outside edges and 4 between rooms, with 8px north wall faces and 3px floor shadows, each face in a wallpaper that stands apart from its room's floor (ΔE 20 or more, held by a test). These are the audit prototype's numbers, for the house stage to tune.
  - a wall between every two pieces, same type included, so rooms never merge visually (D-093)
  - doorways (14 px), windows (12 px) in outside walls, and a front door, chosen by fixed rules, never by chance: ties go by position, and between rooms by the rooms' placement order and a hash of a room's uid. They're decoration and change no score (`src/ui/board/house-model.ts`):
    - Hallways open into every room the rules link through them.
    - The front door (16 px, with a doormat) goes in a south wall with nothing of the house between it and the street, near the front, in the best entry room (a Mudroom or a hall first). It goes through a Garage, a Bathroom or a Closet only when no other room has an outside wall a door can open from, on any side. It opens onto open ground, the street, or a Patio, Driveway or Lawn, and paved ground or the sidewalk beats grass; only when nothing around the house allows that (a house built into the woods) does a door open onto a Tree's tile, a Time Capsule's or a low yard piece (a Flower Bed, a Herb Garden, a Sapling). Never onto water, a boulder, the Old Shed, a Fence, an outbuilding or a Pool.
    - A back door opens onto each touching Patio or Hot Tub, and a Garage's door faces its Driveway or the street, across the Garage's whole side (a double door), so the car drives in square even off a one-cell Driveway.
    - Then a door tree from the entry, public rooms first, reaches every room with as few doors as it takes, so bedrooms keep their walls for furniture. Doors keep to side walls, low on them (furniture stands against the north walls, so a side wall's south part is free in both rooms), and to the ends of north walls.
    - Windows go about one per two cells of outside wall (one per cell in a Sunroom), never in closets, garages or hallways.
  - several LimeZu furniture sprites per room, laid out by rules per room type and footprint, never rotated (they're drawn in 3/4 view), varying by piece (`src/ui/art/rooms.ts`):
    - Each room type lists its pieces, most important first, with slots ported from the audit prototype: against a north wall (the widest run, centered, then sliding), beside what stands there, in the middle of the free floor, a rug or runner centered under everything, against the south wall or in its corners, and the Garage's car nose-in through its door. A piece and the ones beside it (a bed between its nightstands) are planned together: the room's fixture first, then the pieces in the order the room lists them (an earlier one outranks any number of later ones), dropping the least important until they fit. A key piece falls back to the middle of the floor when its doors leave no wall free (a kitchen's range and its counter stand there as one block). A fixture's own sprite goes through all its slots before anything stands in for it.
    - A Kitchen's run is the range and the counter with the sink (a plain counter where the sink won't fit), then the fridge where it still fits (on an L-Kitchen's other arm, or beside the run). A Dining Room's table keeps room for a chair each side: in the middle of the floor, else against the north wall's face, else over a door's walkway (never its opening), and the chairs keep out of the walkway. A Home Office too narrow or shallow for its desks gets a small writing desk.
    - The members' rooms (D-103) have their own floors, wallpapers and furniture (D-111, `art/limezu/members.json`): the twins' crib, a low dresser and a teddy in the Nursery; two children's beds, a toy box and a toy train in the Kids' Room; a bed with a vanity, or a curio cabinet where the vanity won't fit, and a standard lamp in Grandma's Room; a cot, two flickering candles and a spider on its thread in Renfield's Room; a bed beside the dogs' bed (our own drawing) in Nana's Room; an easel, a stool, a pot of paint and a painting in Rowan's Studio; a child's bed, a school desk and a globe in Ivy's Room. Renfield's Room and Rowan's Studio are one cell across, so their pieces are at most 22 × 26 px or come in a second shape (an upright or side-on cot, an easel without its finial). Bunk Beds stand in the crib's or the bed's place in a member's 2×2 room (a badge in the two narrow ones), and when the Nursery grows into the Kids' Room its art changes with it.
    - A piece against a north wall stands with its back on the floor's top edge, under the wall's face. A tall one (a fridge, a bookcase, a plant) rises over the wall band, never past its top edge nor off its own room's cells: all of an outside band, only its room's half of a band between two rooms, so a wall between rooms always shows. Its rows above the band are drawn on the overhang layer, over the walls.
    - Nothing stands in a doorway or its walkway, on another piece (rugs and runners lie under everything), in the walls (a pixel's tuck at most), or over a north window if it can help it. Only a one-cell room's key piece (the toilet, the rail), the car and a dining table may stand in a walkway, never in the opening. What doesn't fit is left out.
    - Some cuts are spliced or composed to fit 32 px rooms (`compose` in the manifest): a 26 px toilet, a 26 px washer (three rows of its plain top out, so it stands in a one-cell-deep Mudroom), 12 px hall runners in any length, counters with the sink, the island in 40, 24 and 16 px, a breakfast table, and the tan and lavender sofas put together from LimeZu's modular pieces.
    - Rooms of a type differ in color (duvets, nightstand woods, sofas, rugs, tables and chairs, bookcases, armchairs, cars): each takes the color its piece's hash picks, or the next one an older room of its type hasn't taken. So up to the palette's size no two look alike, a new room never changes an older one, and a demolition changes a room only if the demolished one had taken its pick. Small choices (which corner, which side) go by the hash too. Never by chance. A Living Room's rug follows a different stride from its sofa, so its two grey sofas (slate and light grey) never share a rug. A room's ghost looks as the room will once placed: its colors as the house will give them, its choices, and (carried by the Moving Truck) its fixture.
  - an installed fixture shows where it fits, and as its badge otherwise, so a purchase is always visible:
    - furniture: the Fireplace (LimeZu's animated stove and flue, 32 px wide, so a one-cell or one-cell-deep room, or a Bedroom or Dining Room whose bed or table takes the room, keeps its badge). It takes a Living Room's north wall, with the sofa beside it where the wall is long enough (a landscape room) or in front of it; a Library's beside a bookcase (a narrow one where a full one won't fit beside it; where neither fits, the bookcase stays and the Fireplace shows as its badge); a Kitchen's beside the range, in the counter's place; a Sunroom's with pots of flowers; elsewhere beside the key piece. Bunk Beds stand in place of the bed, against the north wall or in the middle of the floor. The Kitchen Island is a counter with a bowl of fruit in the middle of the kitchen, 24 or 16 px wide where the full one won't fit (an L-Kitchen's arm, beside a door's walkway).
    - painted with the room, our own drawings in LimeZu's palette: Soundproofing pads the room's side of its wall bands (on the walls canvas, over the furniture, so it always shows) and its north faces; Blackout Curtains draw drapes over the room's windows and hang across the widest stretch of north face the furniture leaves in view (a room with neither, like a Closet, keeps the badge); a Skylight lays a four-pane patch of sun over the floor and furniture (and a Sunny room has the sun along its sunny wall, deeper under its windows, D-120); the Chandelier hangs over the room in its own light; and a Bay Window turns one cell of outside wall to glass, with its bay outside, the street side first
    - the yard's fixtures show unless a door keeps them off (then their badge does): the Sprinkler on its Lawn with a wet patch round it, the Pergola over its Patio (in place of the parasol; where a door opens onto the Patio, a shallower or narrower cut of it on the far side, its badge only where doors open onto two sides), and Garden Lights as a bollard at each front corner of the piece, each with its light on the ground
- **The yard pieces** are laid out by rules from the placed pieces too, never by chance (`src/ui/art/yard.ts`):
  - Their ground goes on the floor canvas, under the house's shadow: a Lawn's mown stripes, a Patio's herringbone pavers, a Driveway's concrete with a curb cut through the sidewalk where it meets the street, and a Pool's and a Hot Tub's water inside LimeZu's white coping (a 3 × 3 sheet of its tiles, laid over any rectangle). A flat piece has a darker 1 px edge, softer where it meets another piece of its kind (two Lawns, or two Driveways), so touching pieces read as one patch and each stays countable (D-093). A piece's ground stays on its own cells.
  - Their props stand on their cells as items, so they wobble and settle with their piece: a parasol over a table and two chairs on a Patio; the house's one parked car on its oldest Driveway with room for it (nose in, or side on facing the house), standing only on that Driveway's own tiles, in another row or column of a ragged pack if it must (a lone tile has no room for it, D-111), orange or grey so it never matches the Garage's; a Pool's ladder and float; the Hot Tub's foam; the Fire Pit's animated fire in front of two stumps; a planter on a Flower Bed, and one per cell of a Herb Garden with greens instead of flowers; the Sapling on its soil; LimeZu's Greenhouse and modular Treehouse; a shed's front as the Henhouse's coop, with two hens on straw behind a picket front in its other cell; a Birdhouse on its pole.
  - Where LimeZu has none, our own drawings in its palette and ink: the Doghouse, the hens and the Sprinkler (`src/ui/art/drawings.ts`).
  - No prop stands on an outside door's mat or in front of its opening (nor rises over one on the overhang layer): a Patio's table and seats move clear of the door that opens onto it, under a small parasol in place of the full one (the audit prototype's), a Pergola gives way to a shallower or narrower cut on the Patio's far side, and the car parks further along its Driveway, or on the next one. Every prop keeps its whole sprite off mats and openings, and a test checks every prop's pixels against every door. An outbuilding's own building always stands: no door opens onto one, so only its roof, rising over the row behind it, can hide part of a mat.
  - Fences and Driveways are packs (D-106): a Fence is 1–8 connected tiles and a Driveway 1–6, in any shape (`packShapeProblem` in `src/rules/grid.ts`), clicked out one by one, so each is drawn from its own tiles (`PlacedPiece.shape`), never its card's shape: the ghost as the tiles go down, the built pack, and the Moving Truck's carried pack (D-111).
  - A Fence is a white picket line through the middle of its cells, out to their edges at its ends, with a post at each end and turn (LimeZu's pickets, posts and end-on strip, after the exteriors audit's line autotile). A lone tile is a short run across its cell, with a post at each end. Two Fences join only through an end's open side (the way its line runs on): in a corner or a T; end to end, each keeps its end post, so each stays countable; side by side, their ends never close them into a pen. A Fence's ghost is the Fence alone.
  - What rises above a piece's own cells (the Greenhouse's roof, the Treehouse, a Birdhouse's box, a side-on car's roof) goes on the overhang layer, over the walls. The Greenhouse and the Treehouse are cut down to rise less than a cell, so a piece behind them still shows.
  - Pieces of a type differ in color (parasols, planters, coops, birdhouses) the way rooms do, and a ghost takes the color its piece will have (or has, when the Moving Truck carries it, with its fixture).
- **Readability:**
  - terrain is muted and low-contrast
  - pieces have more contrast, with LimeZu's outline color #3a3a50 as the ink, and light from the top-left
  - the palette is LimeZu's: our own drawings and the walls and fixtures we paint use only its colors (`src/ui/art/palette.ts`, Modern Exteriors' Palette.png, held by a test); light and shade blended over the art (shadows, sun, glow) aren't colors of their own. The interface's own drawings (`src/ui/theme/`: frames, icons, the title's sky) keep to LimeZu's two palettes and the colors of its sheets, also held by a test. The text-grid placeholders keep one shared palette of 24–32 colors, at most 8 per sprite.
  - every sprite passes a grayscale test at 1×
- **Variety for free:** palette swaps per client or season (spring green, autumn rust, dusk with glowing windows), the way Combolands varies its islands.
- **UI chrome:** wood-panel frames and a chunky pixel font, as in Combolands, plus the readable-font option.
- **Rendering:**
  - terrain is drawn into a canvas of (lot width × 32) × ((lot height + 3) × 32) art px, 768×864 for 24×24 with the street row and the two rows of road, with smoothing off, shown at that size × scale with `image-rendering: pixelated`, and redrawn only when terrain changes
  - what stands on the lot is placed by rule and tile hash (`src/ui/board/terrain/objects.ts`), the hash salted with the run's seed, so every run's lot has its own tufts, flowers, and trees and the same run always looks the same: one LimeZu tree per Tree cell, so the trees beside a piece can be counted, and a big tree only on a 2×2 block of Trees that no piece can touch; a darker woods floor with soft edges under the Tree cells, closing with a verge of grass along the street; two or three rocks per Boulder; the Old Shed at LimeZu's size on its footprint; the Time Capsule's dug soil and shovel. Each sprite's part on its own cells goes on the terrain canvas, and what rises above them (tree tops) on a canopy canvas at `LAYER.canopy`, over the pieces and under their digits and badges (`LAYER.labels`). Neither takes the pointer. The board's scroll area keeps room above the lot (`CANOPY_ROOM`), so the top row's tree tops are never cut off.
  - the sun (D-120): the grass is the same everywhere; a soft shade in two steps lies on the tile behind each Tree and the Old Shed, away from the sun, the tiles the rules leave out of it (`src/ui/board/terrain/shade.ts`). The house's own shade isn't drawn: a Sunny room's light on its floor shows where the sun reaches (the walls canvas), and the view's edge toward the sun carries the sun's plaque
  - the street row is a sidewalk with its curb (the rules' street: clicks and the inspect panel find it there), the lot's grass hanging over its edge except where water or a piece meets it; the road below it, with a dashed line and the far curb, is decoration only
  - around the board, the scroll area shows dimmed LimeZu grass (an 8×8-cell tile with unevenly scattered tufts) that zooms and pans with the board, so the lot sits in a garden; a faint property line marks the lot's other three edges. The road and each creek mouth run on into it, dimmed like it, to the edges of the view (`src/ui/board/terrain/outside.ts`: one slice a cell deep, painted once per lot and repeated by CSS)
  - the lot's water (the pond and the creek) has its own canvas over the water's bounding box, just above the terrain and below everything else: LimeZu's animated water, picked per 16 px subtile by `src/ui/board/autotile.ts`, its bank's grass blades in the grass's colors. Its 8 frames are painted side by side once per lot, and CSS steps through them (transform only, 130 ms a frame), so the water never wakes the main thread; it's still under Reduce motion and paused while the shop's sheet covers the board
  - the terrain and canopy canvases redraw before the browser paints too (once the atlas has loaded), so a tree cleared for a piece goes in the same frame the piece appears
  - the house and the yard are drawn in the board's layers (`src/ui/board/layers.ts`): a floor canvas (the yard's ground and curb cuts, the house's shadow, doormats, floors, north wall faces, floor shadows) under one element per piece for its furniture or props, then a walls canvas (bands, doorways, windows, and the painted fixtures' light and glass), the overhang, outline highlights, and the labels. The fenced yards' tint sits between the floor canvas and the props. The canvases redraw only when the house changes, never on hover, a tally step, or zoom, and before the browser paints (with the atlas's pixels kept once read), so a new room's floor and walls show in the same frame as its furniture
  - a piece's parts in each layer (its items, their tops on the overhang, its flash, its digit) move as one: each animation is remembered while it plays, and a part that mounts mid-flight joins it where it has got to (`src/ui/board/piece-fx.ts`)
  - an animated sprite (the Fireplace, the Fire Pit, the Hot Tub's foam, the Sprinkler) is its frames side by side, stepped behind the piece's box with a transform; reduced motion stops it
  - furniture and yard props are absolutely positioned elements using a CSS-background atlas, placed at any art pixel × scale (a whole number of device pixels per art pixel at the camera's scales)
  - atlas sprites start at even positions and are extruded by 1px, so fractional screen scales show no seams
  - the pieces' score digits are sized in sixteenths of a cell (never under 11 CSS px), so 1× shows them as 2× did with 16 px art, and they grow with the zoom, in the piece's bottom-right cell inside its walls. A piece's badges (a fixture that can't be drawn, top right; an unmet requirement's ⚠, top left) are square paper in LimeZu's ink with their pixel icon, 14 CSS px at 1×, growing with the zoom and shrinking below 1× (never under 9 CSS px, nor under their icon at a device pixel a pixel), on whole device pixels. A badge never covers the digit (`src/ui/board/label-layout.ts`, tested at every zoom): one that shares the digit's row and would touch it rises to its cell's top edge, over the wall band, then the digit drops toward the cell's bottom edge, then the badge shrinks. Labels keep off what isn't their piece's: another piece's prop rising into their cells, a tree's crown (`canopyParts` in `terrain/objects.ts`), and doors' mats. The digit rises above it (into its own cells above, if it must) or moves left onto its own cells, whichever is shorter, keeping a badge in its column room for its icon. A renovated room's level (D-102) is one more badge, a star per level, placed last so it moves nothing: beside the ⚠, else under it, else in its place, else under the fixture's badge or the top badges, else in another top cell, by the same rules, shrinking as the other badges do. It pops on a Renovation, and where it can't fit it's left out, since the inspect panel states the level (D-111)
  - the street's label lies on the longest stretch of sidewalk with no curb cut, sticks inside the view's left edge so it reads whole however the lot is panned, and takes a smaller size in a short row (0.5× on a Retina screen)
  - the title screen's street is one canvas, like the terrain, so its tiles show no seams at 125% or 150% display scaling. Its lawn and street are drawn by the lot's own painters (the grass with its tufts and flowers, and the board's sidewalk, curb, road and dashed line), with one more row of far sidewalk for the credit. It keeps its old tile sizes (64, 48, or 32 CSS px by the window's height), rounded to whole device pixels per art pixel (down on a tie) and never under 32 CSS px, so the footer stays on the far sidewalk. On a Retina screen it's as it was. At a devicePixelRatio of 1 the 48 px size comes out at 32; at 1.25 every size comes out at 51.2; at 1.5 the 48 and 32 px sizes come out at 42.7.
  - **zoom changes the scale and re-lays out the board in whole steps, never with `transform: scale()`**: Safari blurs canvases under a scaling transform (a WebKit bug open since 2018). Transforms are only for short juice tweens. This changes D-049's camera.
- **The pipeline (D-097):**
  - `art/limezu/*.json` are the manifests: each LimeZu sprite we use, by its atlas id, with its pack (`mi` Modern Interiors or `me` Modern Exteriors), its path in the pack's zip, its rect, and any animation frames or edits (`tile`, `recolor`, `keyOut`, `flipX`, `compose`). One file per part of the game, so stages don't edit the same file.
  - `npm run art:cut` (`scripts/cut-art.ts`) runs locally only. It reads the zips in `art-source/` without extracting anything, and writes only the listed sprites to `assets/limezu/` (an animation's frames side by side), `assets/limezu/index.json` (each cut's size, frames, and a hash of its manifest entry), and one `assets/licenses.json` record per cut. It removes cuts no manifest lists.
  - `npm run atlas` packs the placeholders, doubled to 32×32, with the committed cuts at their own sizes, and a cut replaces the placeholder with its id. So CI never needs the packs, and art lands one sprite at a time. Since M5a every placeholder left in `art/` is covered by a cut (the rest were deleted), so the atlas holds only cuts.
  - Tests fail on a cut no manifest lists, a manifest entry without a committed cut, a cut older than its manifest entry, or a cut without a license record, and on any file under `assets/` without a record or a record without its file (`scripts/licenses.test.ts`). `CREDITS.md` and the game credit LimeZu.

**Where the art comes from** (licenses checked on each asset page):

| Option | What | License and cost | Fit |
|---|---|---|---|
| **A. LimeZu Modern Interiors + Modern Exteriors**, plus LimeZu Serene Village for terrain and water | One artist: modern suburban houses, furniture, and exteriors at 16px | Paid packs (about $1.50–$3 and $5): commercial use allowed, no redistribution, credit required. Serene Village: free, CC BY 4.0. | The most coherent. Keep the full packs out of the public repo and commit only the sprites we use; LimeZu has said that's fine for open-source projects (no link recorded; D-097's license note). You'd buy them. |
| **B. A free CC0 mix:** Kenney Tiny Town, Kenney Roguelike Indoors, Ninja Adventure | Exteriors, interiors, extras | CC0, free | The styles clash (outlined versus not), so it needs a palette remap and an outline pass at build time |
| **C. Sprites Claude draws** | 16×16 palette-indexed grids, turned into the atlas at build time | Ours | Fine for terrain, floors, fences, and simple furniture; weak for complex objects. Quality has to be judged by eye. |

**Chosen (2026-11-05):** C for placeholders from M1, in the final atlas format and sprite ids, so swapping is free later. A for the final art: you buy the two LimeZu packs and put them in the gitignored `art-source/` folder, and Claude cuts the sprites we use into `assets/`. B stays the free fallback. Since D-097, Serene Village isn't needed: Modern Exteriors covers terrain and water in the same artist's palette.

**Your to-dos, whenever convenient:**
- ~~Buy LimeZu Modern Interiors and Modern Exteriors~~: done 2026-11-05. Their zips are in `/Users/sam/Desktop/Code/house-game/art-source/`, which git ignores in every branch and worktree. `npm run art:cut` reads the zips as they are, so there's nothing to unzip.
- ~~Switch GitHub Pages to GitHub Actions~~: done 2026-11-05.

Avoid:
- the free tiers of Sprout Lands, Cozy Farm, Modern Interiors, and Cute Fantasy, which are non-commercial or private only
- 32px and 64px packs, whose scale doesn't match

### The score's names (D-019, decided)

The research suggests three rules:
- Give each layer its own word and color. Balatro calls both +Mult and ×Mult "mult", and players mix them up.
- Name an open-ended quantity of a thing, as Combolands' Population and Balatro's Chips do.
- Avoid stars and hearts, which read as ratings or health.

| Option | Points | +Mult | ×Mult | Week and run total |
|---|---|---|---|---|
| **1 (chosen, 2026-11-05)** | Comfort (blue) | Charm (rose) | Sparkle (gold) | Wow |
| 2 | Cozy | Charm | Sparkle | Delight; the run total is Client Delight |
| 3 | Warmth | Glow | ×Glow | Hearth; the run total is Homeyness |
| 4 | Appeal | Wow | ×Wow | Appraisal; the run total is Home Value. It clashes with Budget unless that's renamed. |

- Option 1, the one chosen, reads like this in the tally: **Comfort 240 × Charm 2.5, then Sparkle ×2 → 1,200 Wow.** It keeps the working name Wow, and each layer has a distinct word.
- Option 3 is the coziest and ties into Fireplace and Chandelier glow, but "×Glow" shares its word with the additive layer.
- **Run-end verdict by score band,** like Castles of Mad King Ludwig's solo titles: Fixer-Upper, Starter Home, Charmer, Showhome, Dream Home.

---

## Appendix A · Rules the docs leave open (D-046)

Grouped by the phase that builds them. Numbers are placeholders in `balance.ts` for the sim to tune.

### M1

- **Adjacency, lot features, one house, regions:** §4 Layout rules.
- **Lot generation (D-049),** on 24×24 (width and height are separate numbers in `balance.ts`):
  - the street on the bottom edge
  - **woods:** 3–4 clusters of 15–30 Tree tiles, grown as blobs, plus 6–10 lone Trees
  - **creek** on about a quarter of lots (`creekPct` 25, D-119; it was 70%): a 1-tile-wide meandering line from the back edge to a side edge, or side to side, stepping orthogonally (no diagonal steps, no U-turns), never touching the street edge or the pond. A creek lot is Creekside: pieces touching the creek earn +50%, all run (a lot trait, D-119)
  - one pond, 2×2 to 3×3: on every lot without a creek, and on half the creek lots (`pondPctCreek`, from its own `lot/<attempt>/pond` stream, D-119)
  - 6–10 single-tile boulders
  - the sun's side (D-120; it was a sunny band of 4 rows): the back, the left, the right or the street side, a quarter each, from its own `lot/<attempt>/sun` stream. A tile is in the sun unless it's a Tree, or a Tree, the Old Shed or a building (a room, a Hallway or an outbuilding) stands one step toward the sun; off the lot is open
  - **finds** (from M3b): one Old Shed and one or two Time Capsules, placed away from the street half
  - terrain covers about a fifth of the lot (about 110–130 tiles)
  - regenerate (with the next `lot/<attempt>` key) if fewer than 85% of tiles are free of water, Boulders, and the Old Shed, if fewer than 10 street-edge tiles are free, or if the creek leaves less than 60% of the buildable tiles on the street's side
- **First earning:** a piece earns in the week it's placed. Transforms happen at the start of the week, so the preview equals what the week adds.
- **Pass:** always allowed, no reward.
- **Hands:** 3 distinct card types, weighted. **Simple pieces are more likely early** (D-055), as in Combolands and Luck be a Landlord:
  - every piece has a complexity from 1 to 3
  - its draw weight is scaled by a per-phase percentage in `balance.ts`:

    | Phase | Complexity 1 | Complexity 2 | Complexity 3 |
    |---|---|---|---|
    | 1 | 100% | 30% | 5% |
    | 2 | 100% | 60% | 25% |
    | 3 | 100% | 85% | 60% |
    | 4 and later | 100% | 100% | 100% |

  - **complexity 1** (plain earners): Bedroom, Bathroom, Kitchen and L-Kitchen, Dining Room, Living Room, Closet, Lawn, Patio
  - **complexity 2** (a condition, a region, a timer, or a requirement): Flower Bed, Herb Garden, Sapling, Driveway, Garage, Home Office, Treehouse
  - **complexity 3** (build-arounds): Fence, Hallway, Doghouse, Greenhouse, and every special piece
  - Complex pieces can still show up early, just rarely. A client's spec pieces get their +100% on top, so the Hendersons' Fence isn't starved.
  - `fromPhase` stays only as a hard gate where a card can't work yet: fixtures join from phase 2 (M3a).
- **Shape variants:** separate cards (Kitchen and L-Kitchen; short and long Hallway) sharing a type for specs and sets.
- **Building over Trees:** allowed and free; the Tree is gone.
- **Lawn:** a 2×2 piece (was 1×1, so a big lot fills in; D-049), +1 per adjacent Lawn, at most 4. This replaces "per connected Lawn tile", which grows quadratically.
- **Counting Trees and views:** each Tree tile is a separate neighbor, so effects that count them carry a `max` (Bedroom: 3; Library: 3; Living Room and Patio views: 3; Pool's Tree penalty: 3).
- **Draw weights:** integers, with 10 = normal. Special pieces have weight 0 and arrive through the shop (M3a) or a client or crew (M4a and M4b).

### M2

- **Early completion:**
  - fast-forward (§4)
  - placeholders: +2 budget per week saved, and a score bonus of 10% of this phase's earnings per week saved
  - offered in every phase, including the last, where it ends the run with the bonus
  - auto-complete off by default
- **Overtime:** 2 per run, spent automatically one week at a time (§4), shown as a clock counter.
- **Rerolls:** 1 per phase (General Contractor: 2), not carried over (bought rerolls are, in `bonusRerolls`); a free action that redraws one row of the hand, the player's pick (D-121).
- **Swaps** (D-121, replacing the free redraw): a card with no play is swapped for another from its row, up to 3 tries.
- **Demolition:**
  - 2 per run; a free action
  - removes a whole piece, a Boulder, or the Old Shed (never water), with no refund; the Old Shed pays its find reward
  - points already earned are kept
  - can't split the house
- **Requirements that break later:** checked when placing only if `blocksPlacement` is set. An unmet requirement means no score and no budget, shown with a warning icon.
- **Timers:** Rhythm and economy cadence count from the week a piece was placed (`week − placedWeek`). Growth counts from the later of placement and the week it was granted. A Sapling becomes a Tree after 4 weeks, at the start of a week, and turns into a lot feature, so it no longer counts as a piece.
- **A loss** still shows the house captioned "It's a house.", with the score and the milestone reached.
- **Fence:** two cards, a 1×4 and a 5-tile L (was one 1×3; D-049). It takes tiles and earns +1 per tile of the fenced yards it borders, capped at 6 in total. A fenced yard must also border the house (§4).
- **Driveway:** two cards, 1×3 and 1×5 (was 1×2), so a house set back from the street can still have a Garage. It's the only piece that can be built over the Creek.

### M3a and M3b

- **Budget:**
  - start at 0
  - +3 per milestone, plus early completion
  - economy pieces pay every 2–3 weeks, and change-order rewards (and any set with a one-time `reward`) can pay budget (amends D-013)
  - finds pay too (Time Capsule +3), and selling pays half the price paid
  - target: 1 budget is worth about 3–5% of the final score, and a run earns roughly 30–40
- **Shop (D-051):** opens after milestones 1–6, from the very first run. Combolands players say its locked early shop made first runs drag.
  - **Shop 1:**
    - 2 blueprints and 2 cards
    - the reroll and demolition services
    - a free **Housewarming crate**: pick 1 of 3 Common blueprints. This teaches blueprints with something in hand.
  - **Shops 2–6:**
    - 3 blueprints, 2 cards (special pieces or fixtures), 2 tools, 1 crate, 1 company upgrade
    - the two services
  - One random offer (never the upgrade or a service) is **50% off** each visit.
  - **Refresh:** 2 budget, +1 for each further refresh in the same visit, back to 2 next visit. It rerolls everything except the upgrade and the services.
  - **Services:**
    - +1 reroll and +1 demolition, 1 budget each to start. A bought reroll goes into `bonusRerolls`, so the next phase's reset doesn't wipe it.
    - each purchase raises that service's price by 1 for the rest of the run, up to 4
  - **Selling:** blueprints and supplies, on the build and shop screens, for half the item's list price (rounded down), whatever you paid. Buying on sale and selling back is a wash, never a profit. Reserve pieces can't be sold.
  - **Skip reward:** leaving without buying anything pays +1 budget, so saving up is a choice too.
  - **Blueprint rarity** by shop:
    - shop 1: Common only
    - shops 2–3: 70 / 25 / 5 (Common / Uncommon / Rare)
    - shops 4–6: 55 / 33 / 12
  - **×Mult goods stay rare** (D-056): they're the three Rare ×Mult blueprints and the Rare Chandelier, so none can appear in shop 1. With these weights, a ×Mult blueprint is offered in roughly half of runs by the last shop (rough arithmetic for the sim to check). Any run can also plan for the Full House set's ×2.
  - **Placeholder prices:**
    - blueprints: Common 4, Uncommon 6, Rare 8
    - special pieces: 3
    - fixtures: 2, 3, or 4 by rarity
    - tools: Common 2, Uncommon 3, Rare 4
    - crates: 4
    - company upgrades: 6–8
- **Slots:**
  - **Reserve:** 2 pieces. A reserved piece can be placed in any later week as that week's turn. Crew starting pieces use extra slots.
  - **Supplies:** 3, shared by bought fixtures and tools, used as free actions in a build week.
  - **Blueprints:** 4, no duplicates.
  - Company upgrades add one of each (Storage Unit, Tool Belt, Drafting Table).
- **Blueprints:**
  - active from the next tally, and apply to existing pieces
  - Good Bones counts from purchase, capped
  - blueprints sold late should pay off right away
  - Last-Minute Push's "last week of a phase" means week 4 and any overtime week, **when it's actually played**: a fast-forwarded week 4 doesn't count, so the blueprint really does pull against completing early
- **Fixtures:**
  - drawn from phase 2 at weight 5 each (about one hand in two has one by midgame)
  - a drawn fixture with no legal host is greyed out and counts as not fitting for the free redraw
  - one per piece, and a new one replaces the old
  - no refund when the host is demolished
  - the Moving Truck moves a piece with its fixture
- **Tools:**
  - used only on the build screen, as free actions
  - Rush Order, Open House Party, and Inspector's Visit last for this week's tally; a `rule` modifier inside a timed effect counts while it's active
  - Fertilizer adds 2 to every piece's `ageBonus`, which Rhythm, economy cadence, Growth, and transforms all count
  - Copy Machine needs a free reserve slot
  - Catalog counts as a draw (`n + 1`) and doesn't use a reroll; it draws special pieces and fixtures at equal weight, respecting `fromPhase`, and never a shop-only card (the Chandelier)
- **Company upgrades:** permanent, no duplicates; Savings Account pays `min(floor(budget / 5), 3)` at each milestone, before the shop.
- **Finds:** paid once. The Old Shed's random tool goes into supplies, or is sold at once for half its price if supplies are full.

### M4a and M4b

- **Specs:**
  - checked every week (a demolition can lose one), each adds +0.25 Mult (`specBonus` 25), added together
  - specs are positive achievements: "no Pool" and "no Garage" become tastes (a penalty on that piece) instead of free bonuses from week 1
  - Dale's "nothing Loud next to an office" counts only once he has an office; the street doesn't count
- **The house rules** (D-093's option B, D-101): every checklist starts with seven, in the client's numbers, each +0.25 while it holds:
  - the household: Room for everyone (the client's Bedroom range), a Bathroom for every two Bedrooms (at least one), One Kitchen (an L-Kitchen counts), and a living room or two (1–2 Living Rooms, at most one Dining Room)
  - the shape: Under one roof (4+ rooms, filling 60% of their box, the box no longer than 2:1) and Cozy (6+ rooms, each touching 2+ rooms; a Hallway's link counts)
  - the yard: a tidy yard ("6 or more yard pieces, and no yard type stands 4 or more times"; outbuildings count; Fences, Driveways, and Saplings count toward the 6 but never break it)
  - a client wish that repeats a house rule becomes the client's numbers for it (the Hendersons' Bedrooms and Bathrooms; Juniper's 4–8 rooms is her Under one roof)
  - Room for everyone rises with the household's arrivals (M4b, D-103, D-109): both ends +1 at each arrival, and from that arrival on it needs the member's room. The Hendersons go 2–3, then 3–4 from Framing (the twins) and 4–5 from Drywall (Grandma); the other clients 1–2, then 2–3 from their member's arrival. (In M4a, before arrivals, it stepped up at Framing and Drywall.)
- **Renovate** (D-102): a room card whose type is at its limit can level a room of that type instead: +4 Comfort a level, up to 2. Levels stay through the Moving Truck and transforms. It can be Weekend Crew's next play, and a card that can only renovate doesn't count as fitting for the free redraw.
- **Half-weight draws** (D-104): a type at its limit draws at half weight while it stays there.
- **The yard rules** (D-105): the Patio, Hot Tub, and Fire Pit earn nothing unless they touch a room (not blocking; a Hallway alone doesn't count); Treehouses don't count each other as Kid partners.
- **Packs** (D-106): one Fence card places 1–8 connected tiles, and one Driveway card 1–6, in one week, as one piece.
- **Juniper:**
  - her limit becomes the spec "a house of 4–8 rooms", so it's an achievement rather than free from week 1, plus a −10% taste per room over 8. Under D-101 it's her Under one roof: 4–8 rooms, filling 60% of their box
  - early-completion rewards doubled
  - if she still doesn't work in the sim, move her to Stretch
- **Tastes:** a like is +50%, a dislike −50%, "earns double" +100%, all in the same bucket; "earns nothing" is ×0.
- **Change orders:**
  - one after each of milestones 2, 4, and 6, drawn from the client's list plus the generic ones
  - requests and restrictions can be declined and carry no penalty
  - phase effects are announced and apply for the next phase
  - requests are temporary goals and never change the spec
  - offers whose condition is already met, or that clearly can't be met (required pieces outside the current pool, more pieces needed than weeks left, or less free space than they need), are skipped
- **Pool:**
  - the base pool is 9 indoor + 7 yard + 3 "-house" pieces
  - each client's spec pieces get +100% weight, and their signature special pieces are added at weight 20
  - Landscaper: yard pieces +50% earnings (D-109; the plan's +50% weight and +25% earnings made it the weakest crew)
  - Architect: special rooms at weight 5, and sets +10% (D-109; +50% made it the strongest by 23 points)
- **Job board:**
  - 3 contracts with rarity weights Common 65, Uncommon 27, Rare 8
  - no guaranteed Rare (D-026)
  - first-visit "Recommended" marks only
- **Sets** (D-056): a poker-hand ladder, like Balatro's hand types, where both the Points and the Mult rise with how hard the set is:

  | Set | Points | +Mult | ×Mult | Per level |
  |---|---|---|---|---|
  | Jack-and-Jill | 10 | +0.5 | | +8 Points, +0.25 |
  | Suite | 15 | +0.5 | | +10 Points, +0.25 |
  | Entertainer (one per house, D-093) | 25 | +1 | | +15 Points, +0.5 |
  | Full House | 40 | +1 | ×2 | +20 Points, +0.5 |

  - checked every week; Points and Mult pay every week while the set holds; other reward types pay once, on first completion
  - levels come from the Remodel Plans tools and last for the run
  - instances are matched greedily in placement order
  - Full House = one of each of the 9 Core indoor types
  - Jack-and-Jill stays a set, so the Bathroom's own Bedroom bonus is capped at one Bedroom and the layout isn't rewarded twice

### Content wording

- "Nearby" (Treehouse) means touching.
- "Facing the street" means touching the street edge.
- "Gardens" (Greenhouse) are the `givesView` yard pieces.
- "Trees earn double" (Heat wave) means pieces touching a Tree earn double.
- "Interior room" in a change order means a room that's interior when the request is checked.
- **Hallway:** links every room touching it, not just the rooms at its two ends, so it works in any rotation.
- **Dale's spec:** the street doesn't count as a Loud neighbor for "nothing Loud next to an office".

---

## Appendix B · Core content coverage

Every Core item from `content-brainstorm.md`, written in the §5 format. Numbers are placeholders. None needs the escape hatch.

### Lot features

| Item | Encoding | Built in |
|---|---|---|
| Street | Feature on the bottom edge, tags Loud; one neighbor for pieces touching it; defines the front yard | M1 |
| Mature tree (woods and lone trees) | Feature per tile, tags Quiet and Green, view source; `clear: buildOver` | M1 |
| Pond | `blocks`, `body`, view source | M1 |
| **Creek** *(new)* | `blocks`, `body`, view source; 1 tile wide, never touches the street edge | M1 |
| The sun (D-120; was the sunny side) | `Lot.sun`, one edge; the `sunny` region: tiles no Tree, Old Shed or building stands in front of, toward the sun; a building with a tile in it gains the Sunny tag | M1 (the band), D-120 (the sun) |
| Boulder | `blocks`, `clear: demolish` | M1 (M2 demolish) |
| **Old Shed** *(new find)* | 2×2; `blocks`, `clear: demolish`; reward: a random tool | M3b |
| **Time Capsule** *(new find)* | 1×1; doesn't block; reward when first built over: +3 budget | M3b |

### Indoor rooms (base pool)

| Item | Encoding | Built in |
|---|---|---|
| Bedroom | `steady 3`; `neighbor {any: [tree, tag Quiet]} +1 max 3`; `neighbor {tag Loud} −2` | M1 |
| Bathroom | `neighbor bedroom +3 max 1`; `neighbor kitchen −2` | M1 |
| Kitchen (2×2) and L-Kitchen | Two cards. The L is the 3-tile `['#.', '##']` with `countsAs: 'kitchen'`. Both: `neighbor [diningRoom, herbGarden] +2`; `conditional {is Sunny} → steady 2` (D-120) | M1 |
| Dining Room | `aura [kitchen, livingRoom] +50% adjacent`; `conditional {is Sunny} → steady 2` (D-120) | M1 |
| Living Room | `neighbor {property viewSource} +2 max 3`; `conditional {is Sunny} → steady 2` (D-120) | M1 |
| Closet | `steady 1`; Suite member | M2 |
| Hallway (1×2, 1×3) | Two cards, `connector`, `link`; `neighbor {property room} +2 max 4` (D-114) | M2 |
| Garage | `requires {touching: [street, driveway]}` (blocks); `steady 1`; `economy 1 every 3` | M2 |
| Home Office | `steady 2`; `neighbor {tag Loud} −2`; `economy 1 every 2` | M2 |
| **Sunroom** (2×2) | Weight 5 from Foundation (D-120; it was a special piece, Sunny by its tag, `perTile sunny +2`); `conditional {is Sunny} → steady 6` | M3a (D-120: the draw) |

### Yard pieces (base pool)

| Item | Encoding | Built in |
|---|---|---|
| Lawn (2×2) | `steady 1`; `neighbor lawn +1 max 4`; tags Outdoor and Green | M1 |
| Sapling | `steady 1`; `transform into tree after 4` | M2 |
| Flower Bed | `givesView`; `steady 1`; `conditional {in: frontYard} → steady 2`; `neighbor flowerBed +1` | M2 |
| Herb Garden | `givesView`; `perTile sunny +1` (its tiles in the sun, D-120); `aura kitchen +25% adjacent` | M2 |
| Patio | `requires {touching {property room}}` (doesn't block: the Patio rule, D-105); `neighbor [livingRoom, kitchen] +2`; `neighbor {property viewSource} +1 max 3` | M2 (M4a: the Patio rule) |
| Fence | A pack of 1–8 connected tiles, one piece (D-106; was the 1×4 and 5-tile L cards); `wall`; `enclosure perTile 1 cap 6` | M2 (M4a: the pack) |
| Driveway | A pack of 1–6 connected tiles, one piece (D-106; was the 1×3 and 1×5 cards); `canCover: ['creek']`; `requires {touching: [street, driveway]}` (blocks); `conditional {in: frontYard} → steady 1` | M2 (M4a: the pack) |

### "-house" pieces (base pool)

| Item | Encoding | Built in |
|---|---|---|
| Doghouse | Outbuilding; tags Pet and House; `requires {in: fencedYard}` (doesn't block); `steady 1`; `neighbor lawn +1` | M2 |
| Treehouse | Outbuilding; tags Kid and House; `requires {touching: tree}` (blocks); `steady 2` (D-071); `neighbor {tag Kid ∧ not treehouse} +2` (D-105) | M2 (M4a: not counting each other) |
| Greenhouse | Outbuilding; tags Green and House; `givesView`; `aura {property viewSource ∧ yard} +50% adjacent` | M2 |

### Special pieces (shop, clients, crews; weight 0)

The last four were Stretch in `content-brainstorm.md`, with the Sunroom. They're promoted to Core as shop pieces, so the shop has buildings worth buying (D-051). Every one uses existing effect kinds. The Sunroom has been a room of the weekly draw since D-120 (the rooms table above).

| Item | Encoding | Built in |
|---|---|---|
| Playroom | Indoor; tags Loud and Kid; `neighbor bedroom +2`; `aura {tag Quiet} −2 flat adjacent` | M3a |
| Library | Indoor; tag Quiet; `neighbor {tag Quiet} +2 max 3` | M3a |
| Mudroom | Indoor; tag Pet; `conditional {borders: fencedYard} → aura {tag Pet} +50% region` | M3a |
| Pool | Yard; tags Wet, Sunny, Loud; `rhythm every 3 +12`; `neighbor tree −2 max 3` | M3a |
| **Hot Tub** (1×1) | Yard; tags Wet and Social; the Patio rule (D-105); `neighbor patio +3` | M3a |
| **Fire Pit** (1×1) | Yard; tag Social; the Patio rule (D-105); `aura patio +50% adjacent` | M3a |
| **Henhouse** (1×2) | Outbuilding; tag House; `economy 1 every 2`; `neighbor [herbGarden, flowerBed] +1` | M3a |
| **Birdhouse** (1×1) | Outbuilding; tag House; `neighbor tree +1 max 3` | M3a |

### Fixtures (D-050; drawn from phase 2 and sold in the shop)

Every fixture's modifiers target `{ host: true }`, written as "host" here. Draw weight 5 unless noted.

| Fixture | Fits | Encoding | Rarity | Built in |
|---|---|---|---|---|
| Fireplace | any room | `earn host +50`; `earn {host ∧ piece [livingRoom, library]} +50` (so +100 there) | Common | M3a |
| Skylight | any room | `grantTag host Sunny`; `removeTag host Dark` | Common | M3a |
| Blackout Curtains | any room | `grantTag host Dark`; `removeTag host Sunny` (D-120) | Common | M3a |
| Soundproofing | any room | `blockPenalties host from {tag Loud}` (the street included) | Common | M3a |
| Kitchen Island | kitchen | `countsAs host diningRoom`; `earn host +25` | Uncommon | M3a |
| Bunk Beds | bedroom | `countsAs host bedroom times 2` (counts twice in `count` conditions, such as the Hendersons' 4 Bedrooms; once in sets) | Uncommon | M3a |
| Bay Window | an exterior room | `grantView host` | Common | M3a |
| Sprinkler | lawn | `earn host +100` | Common | M3a |
| Pergola | patio | `grantView host`; `earn host +50` | Uncommon | M3a |
| Garden Lights | any yard piece | `grantTag host Pretty`; `earn {host ∧ in frontYard} +50` | Common | M3a |
| **Chandelier** *(D-056)* | dining room or living room | `xMult times 125 when {host: {inSet: entertainer}}`: ×1.25 Mult while its room is part of an Entertainer. Shop only (draw weight 0). | Rare | M3a |

`fits` is checked when a fixture is installed. A Bay Window stays if its room later becomes interior. No fixture goes in a Sapling, which becomes a Tree, so Garden Lights fit every yard piece but that one (D-095).

### Sets

Each set pays Points and +Mult every week it holds, like a poker hand (values in Appendix A).

| Item | Encoding | Built in |
|---|---|---|
| Suite | members bedroom, bathroom, closet; connected; Points 15, Mult +0.5 | M4a |
| Jack-and-Jill | members 2 bedrooms + bathroom; hub bathroom; Points 10, Mult +0.5 | M4a |
| Entertainer | members kitchen, diningRoom, livingRoom; connected; max 1 (D-093); Points 25, Mult +1 | M1 (M4a: max 1) |
| Full House | one of each of the 9 Core indoor types; not connected; max 1; Points 40, Mult +1, **×2** | M4a |

### Blueprints (18)

The first five come from `content-brainstorm.md`; the other thirteen are new (D-051, D-056). Their archetypes come from Combolands' heirlooms: tag boosts, terrain, structure, economy, and a few rare rule-benders. **×Mult lives only on Rare blueprints** (Last-Minute Push, Model Home, Ahead of Schedule), and each needs a setup. All are M3a, as data.

| Blueprint | Rarity | Encoding |
|---|---|---|
| Feng Shui | Common | `earn {property view} +50` |
| Curb Appeal | Common | `earn {in frontYard} +100` |
| **Quiet Hours** | Common | `earn {tag Quiet} +50` |
| **Green Thumb** | Common | `earn {tag Green} +50` |
| **Party House** | Common | `earn {tag Social} +50` |
| **Waterfront** | Common | `earn {touching {feature [pond, creek]}} +50` |
| Open Concept | Uncommon | `link among [kitchen, diningRoom, livingRoom]` |
| Good Bones | Uncommon | `grantEffect {property room} growth 1/week, max 10` (counts from the later of placement and purchase) |
| It's a House | Uncommon | `mult +15 per {tag House}`: +0.15 Mult for every "-house" piece on the lot |
| **Country Living** | Uncommon | `grantEffect all neighbor {feature tree} +1 max 3` |
| **Mood Lighting** | Uncommon | `earn {property room ∧ tag Dark} +100` |
| **Show Home** | Uncommon | `earn {hasFixture any} +50` |
| **Solar Panels** | Uncommon | `grantEffect {tag Sunny} economy 1 every 4` |
| **Crown Jewel** | Rare | `bestPiece +100`: the week's top earner earns double |
| **Dream Home** | Rare | `rule specBonus +10`: each spec met adds +0.35 Mult instead of +0.25 |
| **Last-Minute Push** | Rare | `xMult times 200 when lastWeekOfPhase`: ×2 in a phase's last week, which pulls against completing early |
| **Model Home** | Rare | `xMult times 100 plusPer {per {hasFixture any}, add 10}`: ×(1 + 0.1 per piece with a fixture); it grows as you install |
| **Ahead of Schedule** | Rare | `xMult times 100 plusPer {per milestonesEarly, add 20}`: ×(1 + 0.2 per milestone completed early this run), which rewards cashing out early |

### Tools (12, from 7 kinds; M3b)

Combolands' potions and Islanders' boons are the models: one-shot, cheap, and they bend the board.

| Tool | Rarity | Encoding |
|---|---|---|
| Moving Truck | Uncommon | `move`: a placed piece, with its fixture, to another legal spot; can't split the house |
| Copy Machine | Rare | `copy`: a placed piece's card into the reserve |
| Rush Order | Common | `weekModifiers [mult +50]`: +0.5 Mult this week |
| Open House Party | Common | `weekModifiers [earn {tag Social} +100, earn {tag Pretty} +100]` |
| Catalog | Common | `specialHand`: redraw this hand from special pieces and fixtures |
| Fertilizer | Uncommon | `advanceTimers 2` |
| Inspector's Visit | Uncommon | `weekModifiers [rule specBonus +25]`: this week, each spec met adds +0.5 Mult |
| Dumpster | Common | `reward {demolitions: 2}` |
| Remodel Plans: Suite | Common | `levelSet suite` |
| Remodel Plans: Jack-and-Jill | Common | `levelSet jackAndJill` |
| Remodel Plans: Entertainer | Common | `levelSet entertainer` |
| Remodel Plans: Full House | Uncommon | `levelSet fullHouse` |

The four Remodel Plans work like Balatro's Planet cards: each permanently levels one set type, so a player can choose a set to build the run around (D-056).

### Company upgrades (7; M3b)

The model is Balatro's vouchers: one per visit, pricier, and permanent for the run.

| Upgrade | Encoding |
|---|---|
| Storage Unit | `rule reserveSlots +1` |
| Tool Belt | `rule supplySlots +1` |
| Drafting Table | `rule blueprintSlots +1` |
| Bigger Truck | `rule roomsRow +1`: 3 Rooms cards and 2 Layout cards a week (D-121) |
| Foreman | `rule rerollsPerPhase +1` |
| Supplier Discount | `rule shopPricePct −25` (not services or the refresh) |
| Savings Account | `rule interestMax +3`: +1 budget per 5 held at each milestone, up to 3 |

### Crates (4; M3b)

Packs, as in Combolands and Balatro: open one and keep 1 of 3.

| Crate | Contents |
|---|---|
| Blueprint Folio | blueprints, using the shop's rarity weights |
| Fixture Crate | fixtures |
| Garden Center | `piece`, pool `all`, filter `{any: [{property yard}, {property outbuilding}]}` |
| Showroom | `piece`, pool `special` |
| *Housewarming* (free, shop 1 only) | Common blueprints |

### Clients

Every checklist starts with the seven house rules (D-101), in the client's numbers; the Specs column lists each client's own wishes and numbers. A wish that repeats a house rule became that rule's numbers.

| Client | Specs | Tastes | Pool | Change orders | Built in |
|---|---|---|---|---|---|
| **Hendersons** | Bedrooms 2–3, rising with the household (their bedroom ≥ 4 and bathroom ≥ 2 are where it ends up); adjacentPair kitchen–diningRoom; fencedYardTiles ≥ 4 (any fenced yard, D-069) | `earn {tag Kid} +50`; `earn lawn +50`; `earn {tag Loud ∧ touching bedroom} −50` | bedroom, bathroom, diningRoom, fence +100% (not the Kitchen, D-108) | *Golden retriever:* request `count {doghouse ∧ in fencedYard} ≥ 1`. *Thanksgiving:* phase `setBonus entertainer +100`. (*Twins* is now their arrival at Framing, D-103.) | M4a / M4b |
| **Count Vladislav** | `count {room ∧ tag Dark} ≥ 3`; library = 1 (D-108) | `earn {tag Dark} +100`; `earnNothing {tag Sunny}`; `earn {touching tree} +50`; `earn herbGarden −100` | library add 20 | *The coven is visiting:* request `countNew {room ∧ interior} ≥ 2`. *Eternal night:* phase `grantTag {property room} Dark` | M4a / M4b |
| **Barkers** | fencedYardTiles ≥ 12; doghouse ≥ 2; mudroom = 1 (D-108) | `earn {tag Pet} +50`; `earn lawn +50`; `earn flowerBed −50` | mudroom add 20; doghouse, fence +100% | *Another rescue:* request `countNew doghouse ≥ 1`. *Agility course:* request `group {lawn ∧ in fencedYard} minTiles 8` (two connected Lawns) | M4a / M4b |
| **Juniper Vale** | her Under one roof: 4–8 rooms (was `and(count {room} ≥ 4, count {room} max 8)`); `count {room ∧ view} ≥ 2` | `perCountOver {room} over 8 −10`; `earn garage −100`; `rule earlyRewardPct +100` | — | *Declutter:* request `demolishedSinceAccepted ≥ 1`. *Tea garden:* request `countNew {patio ∧ view} ≥ 1` | M4a / M4b |
| **Dale** | homeOffice = 2 (D-108); `and(homeOffice ≥ 1, none {tag Loud ∧ touching homeOffice})` | `budget all +100` | homeOffice +100% | *Big deadline:* restriction `forbid {tag Loud}`. *Started a podcast:* request `countNew {room ∧ interior} ≥ 1` | M4a / M4b |

### Crews

| Crew | Encoding | Built in |
|---|---|---|
| General Contractor | `rule rerollsPerPhase +1` | M4b (default crew from M2) |
| Landscaper | `earn {yard} +50` (was `drawWeight {yard} +50%`; `earn {yard} +25`, D-109); `rule layoutRow +1`, a third Layout card (D-121); `startReserve [sapling, fence]` | M4b |
| Architect | `drawWeight [playroom, library, mudroom, pool] add 5`; `setBonus +10` (was +50, D-109) | M4b |

### Generic change orders

| Item | Encoding | Built in |
|---|---|---|
| Working from home | request `countNew homeOffice ≥ 1` | M4b |
| ~~Grandma's moving in~~ | now the Hendersons' arrival at Drywall (D-103) | M4b |
| Heat wave | phase: pool +100; `{touching tree}` +100; `{room ∧ Sunny}` −50 | M4b |
