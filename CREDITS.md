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
- **Placeholder sprites** (`art/*.txt`): drawn for Open House by Claude Code. Our own work.
  LimeZu cuts replaced them in M5a (D-097): the whole lot (its grass, water, woods, rocks,
  finds, street, and the grass around it), and the house and the yard (floors,
  wallpapers, furniture, the yard pieces and their props). The few left in `art/` are each
  covered by a cut of the same id, so `assets/atlas.png` holds none of them.
- **The house's and the yard's own drawings** (`src/ui/art/drawings.ts`,
  `src/ui/art/house-paint.ts`, `src/ui/art/yard.ts`): the Doghouse, the hens, the Sprinkler,
  the dogs' bed in Nana's Room, the walls and windows, the painted fixtures (the Chandelier,
  Blackout Curtains, Soundproofing, the Skylight's light, the Bay Window), and the yard's own
  touches (the Henhouse's straw, the Sprinkler's wet patch, Garden Lights' light), drawn for Open
  House by Claude Code in LimeZu's palette. Our own work.
- **The interface's frames, icons and the title's sky** (`src/ui/theme/frames.ts`,
  `src/ui/theme/icons.ts`, `src/ui/theme/scenery.ts`): drawn for Open House by Claude Code as
  text grids in LimeZu's palette, and turned into images in the browser at startup. Our own
  work. The icons include one for each fixture and tool (their badges on the board, their
  supply slots and their pictures in the shop). The title screen's houses, trees, shrub,
  planters and car are Modern Exteriors cuts (`art/limezu/ui.json`, and the Flower Bed's
  planters from `art/limezu/yard.json`), on the lot's own lawn and street (`art/limezu/terrain.json`).
- **Sound effects (M5b, D-129):** recorded instruments from the
  [Versilian Community Sample Library (VCSL)](https://github.com/sgossner/VCSL) by Versilian
  Studios and its contributors (CC0): marimba, hand chimes, vibraphone, glockenspiel, tubular
  bells, a gong, a mark tree, and a slit drum. Foley and interface sounds by
  [Kenney](https://kenney.nl) (CC0), from the OpenGameArt pages of his
  [RPG Audio](https://opengameart.org/content/50-rpg-sound-effects),
  [Casino Audio](https://opengameart.org/content/54-casino-sound-effects-cards-dice-chips) and
  [Interface Sounds](https://opengameart.org/content/interface-sounds) packs: cloth, coins,
  clay chips, clicks. CC0 asks for no credit; we give it anyway. Each sound is cut from its
  source by `npm run audio:cut` (`art/audio.json`, D-130) into `assets/audio/sfx/`, as Ogg Vorbis
  and AAC, and recorded in `assets/licenses.json`. The sources stay in the gitignored
  `art-source/audio/`.
- **Placeholder sound effects:** generated in the browser with
  [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force (MIT). Its sample builder is
  vendored in `src/ui/audio/zzfx.ts` with its license notice. A sound without a recording, or
  whose recording hasn't loaded yet, plays its ZzFX placeholder.

Every asset we add is listed here and recorded in
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
