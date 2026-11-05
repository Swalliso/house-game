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
  tsconfig.rules.json (no DOM lib) and src/rules/purity.test.ts enforce this for
  src/rules and src/content, which may import only from each other.
- New content is data in src/content. Add an effect kind only when data can't
  express it, and test it.
- "Fixtures" are game content: upgrades installed in a placed piece.
- develop is the default branch. Work on a phase/<id> or fix/<topic> branch off
  develop and open a PR into develop. Rulesets (D-061, D-064) block direct pushes
  to develop and main, so always push a branch and open a PR. The required check
  is the job `test` in .github/workflows/ci.yml.
- Merging (D-064): turn on the PR monitor for your own PRs. Setup and fix PRs:
  turn on auto-merge (merge commit), so they merge once `test` passes. Phase PRs:
  merge only after the user says the playtest went well. Never merge into main:
  the user opens and merges develop → main release PRs, as merge commits.
- Pages: releases at https://swalliso.github.io/house-game/, develop at /dev/.
  deploy.yml tests both branches before publishing, and a broken develop never
  blocks a release (D-063). Every build shows its channel (main, dev, local) and
  git short SHA in a corner; CI sets VITE_CHANNEL. Saves are namespaced by channel.
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
- Vite 8 renamed build.rollupOptions → rolldownOptions and esbuild → oxc
  (vite.config.ts sets Preact's JSX through oxc). TypeScript is pinned to 6.0.x;
  Preact is pinned to 10.x.

## Commands

npm run dev · npm test · npm run typecheck · npm run build · npm run format
npm run sim -- --help (from M2)
In the browser pane, `preview_start` with the "dev" config in .claude/launch.json.
Bug reports are run codes: open them with ?run= or paste them into a replay test.
