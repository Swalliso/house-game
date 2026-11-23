# S28 · A Photo Shoot, a Dog Door and a cheaper Weekend Crew

| | |
|---|---|
| Size | M, two to three days and a sim trial |
| Kind | Content and art. The content hash changes |
| Branch | `phase/new-goods` |
| Needs first | The user's playtest of S22 to S25, then their pick (Ask the user first) |

## Story

Two new goods and a cheaper old one. The Photo Shoot is an Uncommon tool: ×1.5 for the week
you use it. The Dog Door is a Common fixture that makes its room a Pet room and earns +25%
there. Weekend Crew becomes Uncommon, at 3.

## Why

- ×Mult is the big-number layer, and it lives on four Rare goods (Last-Minute Push, Model
  Home, Ahead of Schedule and the Chandelier) and the Full House set (D-056). In the 2026-11-20
  review of rarely used goods (https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X), Sparkle
  added 7% of a median run's Wow, and nothing in the bottom tenth of runs. One Uncommon ×Mult
  tool would give most runs a week where the score jumps, and its setup is the week you pick.
- Most goods add a percentage. A good that changes what a room is reads as a transformation
  (Wildfrost's charms and Combolands' Ghost Paint, `research.md`). A Dog Door's room is a Pet
  room, so the Barkers' +50% for Pets, Nana's Room's +2 for each Pet beside it and the puppies
  change order all reach it.
- Weekend Crew was bought 4% of the times it was on a shelf. Since D-163 a piece from Your
  goods is free to place, so all it adds is a second card from the hand, which isn't worth a
  Rare's 5. The General Contractor also brings three a run (D-171).

## Ask the user first

"Which of these do you want: the Photo Shoot, the Dog Door, Weekend Crew at Uncommon 3?" Build
only the ones the user picks. The Photo Shoot changes D-056, which keeps ×Mult on Rare goods
with a setup (Balatro puts it on 70% of its Rare jokers and 3% of its Common ones).

## Build

1. **Photo Shoot.** Add `photoShoot` to `ToolId` (`src/rules/index.ts`) and to `TOOLS` in
   `src/content/tools.ts`:
   `tool('photoShoot', 'Photo Shoot', 'uncommon', { kind: 'weekModifiers', modifiers: [{ kind:
   'xMult', times: 150 }] })`. The tally already takes a tool's ×Mult once, after the fixtures'
   and the blueprints' (`XMULT_ORDER` in `src/rules/scoring.ts`).
2. **Dog Door.** Add `dogDoor` to `FixtureId` and to `FIXTURES` in `src/content/fixtures.ts`:
   Common, `fits: roomsBut('bathroom', 'closet', 'garage', 'mudroom')` (a Mudroom is a Pet room
   already), `drawWeight: 5` and `fromPhase: 1` as the other room fixtures have, and
   `[{ kind: 'grantTag', target: HOST, tag: 'Pet' }, { kind: 'earn', target: HOST, pct: 25 }]`,
   with D-082's floor so it's never blank.
3. **Weekend Crew:** `'uncommon'`, with no price of its own, so it costs `PRICES.tool.uncommon`
   (3).
4. **Words.** Each card's line comes from `src/rules/text.ts`. `grantTag`'s line reads "Makes
   it Pet", since the other granted tags are adjectives (Sunny, Dark, Pretty): make it "Makes it
   a Pet room". Check that the Photo Shoot's line says what it multiplies and for how long.
5. **Art.** Icons for both in `src/ui/theme/icons.ts`, mapped in `src/ui/sprites.ts`, in
   LimeZu's palette. In a room, the Dog Door is a flap in a wall, painted with the room as the
   Bay Window is (`paintedShown` in `src/ui/art/rooms.ts`), or a dog bed as furniture, as Bunk
   Beds are: whichever reads at the board's zoom. The painters are shared, so it shows in the
   ghost, the cards and the photos too. The LimeZu packs are only in the main checkout's
   `art-source/`; without them, draw it in `src/ui/art/drawings.ts`.
6. **Tests:** the Photo Shoot multiplies its week once and stacks with another source
   (`tools.test.ts`); a Dog Door's room earns the Barkers' +50% and counts for Nana's Room
   (`fixtures.test.ts`); Weekend Crew's rarity and price (`src/content/tools.test.ts`); each
   card's text (`text.test.ts`).
7. **The sim.** No bot changes: the shop bot values `weekModifiers` tools already (`goodValue`
   in `sim/policies/shop.ts`), and the tool bot uses one in a last week that's short or runs
   out. A paired-seed trial, 600 runs an arm on `check-*`: buy rates of the three, Sparkle's
   share of a run's Wow (median and bottom tenth), the Barkers' runs on their own, and wins.
   Report it; don't change the targets here. A re-fit by D-146's method is its own step.

## Leave out

- A second ×Mult good, and any change to the four Rare ones.
- A Pet room counting toward the Barkers' Two Doghouses or the Dog Run set: those read the
  Doghouse itself.
- The Mudroom's aura. It reaches the pieces in the fenced yard it borders, never a room, so a
  Dog Door doesn't promise it.

## Where it lives

- `src/content/tools.ts`, `src/content/fixtures.ts`; `src/rules/index.ts` (`ToolId`,
  `FixtureId`); `src/rules/text.ts` (`grantTag`'s line).
- `src/ui/theme/icons.ts`, `src/ui/sprites.ts`, `src/ui/art/rooms.ts`.

## Watch for

- The content hash changes, so runs in progress drop on merge.
- ×Mult moves the score more than its price suggests. Look at the bottom tenth as well as the
  median.
- The Dog Door gives a room a tag the Barkers' tastes read, so their runs move most.

## Done when

- [x] The goods the user picked are on the shelf (and the Dog Door in the draw), each with an
      icon and its card's words. (All three, while the user picks.)
- [x] A Dog Door's room is a Pet room for the Barkers and Nana's Room.
- [x] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

`?debug`: give a Photo Shoot, use it and read the tally's Sparkle line. With `?client=barkers`,
give a Dog Door, install it in a Bedroom and look at the room in Inspect.

## Decision log

A new entry, with dated notes on:

- D-056: an Uncommon ×Mult tool, if the user picks it.
- D-083: Weekend Crew's rarity and price.
- D-050 and D-082: a new fixture, with the +25% floor.
