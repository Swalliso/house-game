# Open House — Jam Scope (v1)

**Status:** Accepted · 2026-11-05 with the implementation plan (D-029 in `decisions.md`). Updated in M0 to match D-042, D-046, D-048 to D-051, D-053, D-056 to D-059, and D-019. Record further changes in `decisions.md`.

**Goal for the jam:** one complete, replayable run, from picking a contract to the Final Walkthrough, playable in a browser from a link, with enough variety that friends want a second run.

## In the jam build

- **The lot:** a 24×24 grid with a street edge, woods and lone Trees, a creek, a pond, boulders, and a sunny side, generated from a seed. From M3b, two kinds of finds: the Old Shed and Time Capsules (D-048, D-049).
- **Weekly turns:** draw 3 cards, then place 1 (with rotation), install a drawn fixture, or Pass; plus a few rerolls and demolitions (D-036, D-050).
- **Scoring:** tags and shared effect types (`content-brainstorm.md`, section 1). Each week scores Points × Mult, shown as **Comfort × Charm**, with rare **Sparkle** (×Mult) and the total in **Wow** (D-056, D-019). A live preview while placing shows the net change to the week and which neighbors contribute.
- **Milestones:** construction phases with rising targets. Missing one ends the run once the run's 2 overtime weeks are used up (D-041).
- **Early completion:** finish a phase early for budget and a score bonus while the skipped weeks fast-forward, or keep building; plus an auto-complete toggle, off by default (D-040).
- **Fixtures:** upgrades installed in a room or yard piece you've already placed, drawn from phase 2 or bought in the shop (D-050).
- **Shop between phases:** five kinds of goods (blueprints, special pieces, fixtures, tools, and company upgrades), plus crates and services (D-051).
- **Clients:** spec checklist, tastes, and change orders, with Common/Uncommon/Rare rarity.
- **Crews:** General Contractor, Landscaper, Architect.
- **Content:** the Core-tier items in `content-brainstorm.md`, as written in Appendix B of `implementation-plan.md`. Five pieces that were Stretch there (Sunroom, Hot Tub, Fire Pit, Henhouse, Birdhouse) are Core shop pieces now (D-051).
- **End screen:** the finished house captioned "It's a house.", the score, and a copyable result line.
- **Art and sound:** cozy pixel art from LimeZu's 16px packs, at 32 art px per cell (2×2 tiles, D-097), with Claude-drawn placeholder sprites from M1 (D-057). A first pass at juice from M1 (D-059). Calm music with reward sounds that escalate with the size of the moment (D-058). The full art pass is M5a, before M4, and the sound pass M5b, after it (D-097). M5a's visual juice is its own pull request between them.

## Stretch (only if time allows)

- Daily Lot mode (cheap once randomness is seeded)
- The other Stretch-tier pieces and clients
- The basement

## Not in the jam build

- Meta-progression (company growth, reputation, unlocks). Everything is available from the start.
- HOA rules and difficulty tiers
- Upstairs floor, endless mode, renovation mode

## Starting numbers (placeholders to tune)

| Setting | Starting value |
|---|---|
| Lot size | 24 × 24 tiles (D-048) |
| Milestones per run | 7 (Groundbreaking → Final Walkthrough) |
| Weeks per milestone | 4 (D-042) |
| Overtime | 2 weeks per run (D-041) |
| Cards offered per week | 3 (the `handSize` rule; 4 with Bigger Truck) |
| Rerolls | 1 per phase (General Contractor: 2), plus any bought in the shop |
| Demolitions | 2 per run, plus any bought in the shop |
| Early completion | +2 budget and +10% of the phase's earnings per week saved (D-046) |
| Budget | Starts at 0; +3 per milestone, plus early completion, economy pieces, finds, rewards, and selling (D-046, D-051) |
| Change orders | One offered after milestones 2, 4, and 6 |
| Score | Accumulates across the run; each milestone is a higher total |

The full list of rule defaults and numbers is Appendix A of `implementation-plan.md`. They all live in `src/content/balance.ts`, and the sim sets the milestone targets from M2 (D-044).

## Tech defaults

TypeScript + Vite with a pure rules module, Preact and the DOM for rendering, seeded randomness, and GitHub Pages hosting: D-027, D-033, D-034, and D-060 in `decisions.md`.

## Build order

Eight phases, M0 to M7 (D-053): M1 to M6 each end in a playtest, M0 is setup, and M7 is the release. M5 is split in two, each with its own playtest: M5a (art and UI chrome) comes before M4, its visual juice after M4 in a pull request of its own, and M5b (sound and music) after that (D-097). See §7 of `implementation-plan.md`.

## Definition of done

- A friend can open the link, start a run, and play to a win or loss without needing an explanation.
- A full run has no run-breaking bugs.
- Different clients and crews make runs feel noticeably different.
