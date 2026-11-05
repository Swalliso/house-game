# Credits

Open House is a game jam entry for the theme "It's a house," built with Claude Code.

## Art, sound, and music

No third-party assets yet. Every asset we add is listed here and recorded in
[`assets/licenses.json`](assets/licenses.json).

`assets/licenses.json` maps each file's path under `assets/` to where it came from:

```json
{
  "sprites/example.png": {
    "source": "https://example.com/the-asset-page",
    "author": "Author Name",
    "license": "CC0-1.0"
  }
}
```

What we accept (D-057, D-058): CC0 first, CC BY with credit, and paid packs whose license
allows commercial use (only the sprites we use are committed; the packs stay in the
gitignored `art-source/`). Never non-commercial (NC), share-alike (SA), GPL, or anything
taken from another game.

## Code

Built with [Preact](https://preactjs.com/) (MIT), [Vite](https://vite.dev/) (MIT),
[TypeScript](https://www.typescriptlang.org/) (Apache-2.0),
[Vitest](https://vitest.dev/) (MIT), and [fast-check](https://fast-check.dev/) (MIT).
