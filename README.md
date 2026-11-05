# Open House

A browser roguelite house builder for a game jam on the theme **"It's a house."** You run a
home-building company: each run is one client, one lot, and one house, built one piece per week.

## Play

- **Latest release:** https://swalliso.github.io/house-game/
- **Work in progress** (the `develop` branch): https://swalliso.github.io/house-game/dev/

The corner of the screen shows which build you're playing: its channel (`main`, `dev`, or
`local`) and its git commit.

## Run it locally

You need Node 26 (see `.nvmrc`) and npm.

```bash
npm ci
```

```bash
npm run dev
```

Then open the address it prints (usually http://localhost:5173/).

Other commands:

| Command             | Does                                                          |
| ------------------- | ------------------------------------------------------------- |
| `npm test`          | runs the tests                                                |
| `npm run typecheck` | type-checks everything, and `src/rules` again without the DOM |
| `npm run atlas`     | rebuilds the sprite atlas in `assets/` from `art/`            |
| `npm run build`     | rebuilds the atlas, type-checks, and builds into `dist/`      |
| `npm run preview`   | serves the `dist/` build                                      |
| `npm run format`    | formats the code with Prettier                                |
| `npm run sim`       | the headless sim: bots play runs and report (`-- --help`)     |

## Report a bug

Every run can be replayed from a **run code**, a single string that starts with `OH1.` and
records the build, the setup, and every action you took.

1. Copy the run code: use **Copy run code** in the game, or on the "Something broke" screen
   if it crashed.
2. [Open an issue](https://github.com/Swalliso/house-game/issues/new) with the run code, what
   you did, what you expected, and what happened instead.

A run code replays the exact run on the build it came from, so the bug can be reproduced and
turned into a test. To open one, add it to the address: `…/house-game/dev/?run=OH1.…`. If the
game crashes, its "Something broke" screen has the run code and a link that opens a GitHub
issue with it filled in.

To play a particular lot, add `?seed=` and any word: `…/house-game/dev/?seed=maple`. Your run
in progress is saved, and the title screen offers Continue.

Add `?debug` to open the debug panel: jump to a milestone with a bot-built house, meet or miss
a target, add budget, give a card, or skip the tally animations. Its cheats are recorded in the
run code, so a debug run still replays.

## Docs

The design and plan are in [`docs/`](docs/): the decision log, the jam scope, the
implementation plan, the content brainstorm, and research notes. Asset credits are in
[`CREDITS.md`](CREDITS.md).
