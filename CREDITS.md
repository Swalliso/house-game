# Credits

Open House is a game jam entry for the theme "It's a house," built with Claude Code.

## Art, sound, and music

- **Art by [LimeZu](https://limezu.itch.io/):** sprites from
  [Modern Interiors](https://limezu.itch.io/moderninteriors) and
  [Modern Exteriors](https://limezu.itch.io/modernexteriors), paid packs used under their
  licenses. Both let you edit and use the asset in any commercial or non-commercial project,
  require credit to LimeZu, and forbid reselling or distributing the asset to others. Modern
  Exteriors' license also allows using it in open-source projects, GitHub included; Modern
  Interiors' license doesn't mention open source (D-057, D-097). The repository holds only the
  sprites we use, cut from the packs into `assets/limezu/` (and packed into `assets/atlas.png`)
  by `npm run art:cut`, each recorded in `assets/licenses.json` with its sheet and rect. The
  packs stay in the gitignored `art-source/` (D-097).
- **Placeholder sprites** (`art/*.txt`, packed into `assets/atlas.png`): drawn for Open House
  by Claude Code. Our own work. LimeZu cuts replaced them in M5a (D-097): the whole lot (its
  grass, sunny side, water, woods, rocks, finds, street, and the grass around it), and the house
  and the yard (floors, wallpapers, furniture, the yard pieces and their props).
- **The house's and the yard's own drawings** (`src/ui/art/drawings.ts`,
  `src/ui/art/house-paint.ts`): the Doghouse, the hens, the Sprinkler, the walls and windows,
  and the painted fixtures (the Chandelier, Blackout Curtains, Soundproofing, the Skylight's
  light, the Bay Window), drawn for Open House by Claude Code in LimeZu's palette. Our own work.
- **The interface's frames, icons and the title's sky** (`src/ui/theme/frames.ts`,
  `src/ui/theme/icons.ts`, `src/ui/theme/scenery.ts`): drawn for Open House by Claude Code as
  text grids in LimeZu's palette, and turned into images in the browser at startup. Our own
  work. The title screen's houses, trees, planters and car are Modern Exteriors cuts
  (`art/limezu/ui.json`).
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

## Fonts

Both are CC0 1.0 (public domain); the legal code is in `assets/fonts/CC0-1.0.txt`.

- **[Public Pixel](https://ggbot.itch.io/public-pixel-font)** by GGBotNet
  (`assets/fonts/PublicPixel.ttf`): numbers and display text.
- **[Pixel Operator](https://www.dafont.com/pixel-operator.font)** by Jayvee Enaguas
  (HarvettFox96), its 8 px cut, regular and bold (`assets/fonts/PixelOperator8.ttf`,
  `assets/fonts/PixelOperator8-Bold.ttf`): body text.

Settings has a readable-font option that shows every text in the system's own font instead.

## Code

Built with [Preact](https://preactjs.com/) and
[@preact/signals](https://github.com/preactjs/signals) (MIT), [Vite](https://vite.dev/) (MIT),
[TypeScript](https://www.typescriptlang.org/) (Apache-2.0), [Vitest](https://vitest.dev/) (MIT),
[fast-check](https://fast-check.dev/) (MIT), and [ZzFX](https://github.com/KilledByAPixel/ZzFX)
(MIT, vendored). The code that ships in the build is also recorded in `assets/licenses.json`:
npm packages as `npm:<name>`, vendored files by their path (D-066).
