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
| `npm run build`     | type-checks and builds into `dist/`                           |
| `npm run preview`   | serves the `dist/` build                                      |
| `npm run format`    | formats the code with Prettier                                |

## Report a bug

Every run can be replayed from a **run code**, a single string that starts with `OH1.` and
records the build, the setup, and every action you took.

1. Copy the run code: use **Copy run code** in the game, or on the "Something broke" screen
   if it crashed.
2. [Open an issue](https://github.com/Swalliso/house-game/issues/new) with the run code, what
   you did, what you expected, and what happened instead.

A run code replays the exact run on the build it came from, so the bug can be reproduced and
turned into a test. Run codes arrive with the first playable build (M1); until then, include
the build label from the corner of the screen.

## Docs

The design and plan are in [`docs/`](docs/): the decision log, the jam scope, the
implementation plan, the content brainstorm, and research notes. Asset credits are in
[`CREDITS.md`](CREDITS.md).
