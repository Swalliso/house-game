# Credits

Open House is a game jam entry for the theme "It's a house," built with Claude Code.

## Art, sound, and music

- **Art by [LimeZu](https://limezu.itch.io/):** sprites from
  [Modern Interiors](https://limezu.itch.io/moderninteriors) and
  [Modern Exteriors](https://limezu.itch.io/modernexteriors), paid packs used under their
  licenses. Both let you edit and use the asset in any commercial or non-commercial project,
  require credit to LimeZu, and forbid reselling or distributing the asset to others. Modern
  Exteriors' license also allows using it in open-source projects, GitHub included; Modern
  Interiors' license doesn't mention open source (D-057, D-095). The repository holds only the
  sprites we use, cut from the packs into `assets/limezu/` (and packed into `assets/atlas.png`)
  by `npm run art:cut`, each recorded in `assets/licenses.json` with its sheet and rect. The
  packs stay in the gitignored `art-source/` (D-095).
- **Placeholder sprites** (`art/*.txt`, packed into `assets/atlas.png`): drawn for Open House
  by Claude Code. Our own work. LimeZu cuts replace them one by one in M5a (D-095): so far the
  floors and the grass.
- **Placeholder sound effects:** generated in the browser with
  [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force (MIT). Its sample builder is
  vendored in `src/ui/audio/zzfx.ts` with its license notice.

No recorded audio yet. Every asset we add is listed here and recorded in
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

Built with [Preact](https://preactjs.com/) and
[@preact/signals](https://github.com/preactjs/signals) (MIT), [Vite](https://vite.dev/) (MIT),
[TypeScript](https://www.typescriptlang.org/) (Apache-2.0), [Vitest](https://vitest.dev/) (MIT),
[fast-check](https://fast-check.dev/) (MIT), and [ZzFX](https://github.com/KilledByAPixel/ZzFX)
(MIT, vendored). The code that ships in the build is also recorded in `assets/licenses.json`:
npm packages as `npm:<name>`, vendored files by their path (D-066).
