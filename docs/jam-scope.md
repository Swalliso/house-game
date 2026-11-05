# Open House — Jam Scope (v1)

**Status:** Proposed. Confirm or adjust before building, and record changes in `decisions.md`.

**Goal for the jam:** one complete, replayable run, from picking a contract to the Final Walkthrough, playable in a browser from a link, with enough variety that friends want a second run.

## In the jam build

- **The lot:** a grid with a street edge, trees, a pond, a sunny side, and boulders, generated from a seed.
- **Weekly turns:** draw 3 cards, place 1 (with rotation), plus a few rerolls and demolitions.
- **Scoring:** tags and shared effect types (`content-brainstorm.md`, section 1), with a live preview while placing that shows what the piece would earn and which neighbors contribute.
- **Milestones:** construction phases with rising targets; missing one ends the run.
- **Early completion:** finish a phase early for budget, or keep building; plus an auto-complete toggle.
- **Shop between phases:** blueprints and special pieces.
- **Clients:** spec checklist, tastes, and change orders, with Common/Uncommon/Rare rarity.
- **Crews:** General Contractor, Landscaper, Architect.
- **Content:** the Core-tier items in `content-brainstorm.md`.
- **End screen:** the finished house captioned "It's a house.", the score, and a copyable result line.
- **Art:** placeholder shapes first; an art and sound pass at the end.

## Stretch (only if time allows)

- Daily Lot mode (cheap once randomness is seeded)
- Fixtures
- Stretch-tier pieces and clients
- The basement

## Not in the jam build

- Meta-progression (company growth, reputation, unlocks). Everything is available from the start.
- HOA rules and difficulty tiers
- Upstairs floor, endless mode, renovation mode

## Starting numbers (placeholders to tune)

| Setting | Starting value |
|---|---|
| Lot size | 12 × 12 tiles |
| Milestones per run | 7 (Groundbreaking → Final Walkthrough) |
| Weeks per milestone | 6 |
| Cards offered per week | 3 |
| Rerolls | 1 per phase (General Contractor: 2) |
| Demolitions | 2 per run |
| Early completion | +1 budget per week saved, +10% phase bonus per week saved |
| Change orders | One offered after milestones 2, 4, and 6 |
| Score | Accumulates across the run; each milestone is a higher total |

## Proposed tech defaults

See D-027 in `decisions.md`: TypeScript + Vite, a pure rules engine with unit tests, a thin rendering layer, seeded randomness, and static hosting. Where the repo's existing conventions differ, follow the repo.

## Suggested build order

1. **Vertical slice:** lot grid, 4–6 pieces, placement with rotation, weekly scoring with live preview, one milestone. Placeholder art.
2. **Full run loop:** all 7 milestones, rising targets, win and lose screens, early completion.
3. **Economy:** shop, blueprints, budget.
4. **Variety:** clients (spec checklist and tastes), change orders, crews, a run setup screen.
5. **Content and balance:** fill in the Core content; add a headless simulation of runs to tune targets.
6. **Juice:** placement and tally sounds, score animations, the big-score moment, the end screen.
7. **Ship:** art pass, playtest with friends, fix, publish the link.

## Definition of done

- A friend can open the link, start a run, and play to a win or loss without needing an explanation.
- A full run has no run-breaking bugs.
- Different clients and crews make runs feel noticeably different.
