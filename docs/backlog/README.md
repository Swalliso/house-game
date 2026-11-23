# Backlog: stories from the 2026-11-16 idea review and the 2026-11-20 shop and piece reviews

On 2026-11-15 and 16 a review asked "what else might we add?". It brainstormed 89 additions,
checked each one against `docs/decisions.md` and the code, and had a skeptical reviewer score
it. S01 to S21 are the 21 it rated worth trying. Each story is the smallest version of its idea
that would show whether the idea is fun, written so an agent can pick it up cold.

On 2026-11-20 a review of the goods, rooms and fixtures people rarely use
(https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X) added S22 to S30, at the user's ask: a
shop that's more exciting, and fixes for the pieces and fixtures that rarely pay.

Later that day a review of how pieces interact
(https://claude.ai/artifact/Egt1U8BQdXuqdacCpCueXE) added S31 to S33, the three the user
picked from its ranked options: pieces whose effects reach 2 tiles, the shop's special pieces
in the hand, and pieces that read a kind of piece instead of one name.

A story isn't decided until it's built and played. Building one adds a Proposed entry, and the
user's playtest decides whether it stays.

## How to pick up a story

1. Read the story, then the decision-log entries it names (search `docs/decisions.md` for
   `### D-###`).
2. If the story has an **Ask the user first** section, ask before writing code.
3. Branch off develop. The story names the branch.
4. Build what **Build** lists. **Leave out** is part of the scope: those parts were cut on
   purpose, mostly because the check against the code found they cost far more than they look
   or don't work as imagined.
5. Check it, log it and open the pull request, as described below.

Being asked to build a story is the user's OK for the changes its **Decision log** section
lists. Anything past that list that would change an Accepted decision still needs a question
first (CLAUDE.md).

## What every story has to respect

These are on top of CLAUDE.md's rules.

- **UI only means UI only.** A story marked UI only edits nothing under `src/rules` or
  `src/content`, so the content hash stays the same and saves and run codes carry over. Where a
  story needs a new read-only view in `src/rules`, it says so; that doesn't change the hash
  either, since the hash covers the content alone (`contentHash` in `src/rules/runcode.ts`).
- **Looks are never content.** A table that maps a client or a change order to a sprite or a
  look lives in `src/ui`, not on a definition in `src/content`.
- **The UI never works out a rule.** Which pieces a rule touches, whether a wish is met and
  what a play would earn come from the rules' views (`currentTally`, `checklist`, `preview`
  and the rest of the `Rules` interface in `src/rules/run.ts`).
- **Motion.** Timing numbers go in `src/ui/fx/feel.ts`. A beat that holds input skips on a
  click. Each story says what happens under the Reduce motion setting, and a flash respects
  the Flashing setting. Things move a whole art pixel at a time (D-097). The camera zooms by
  re-laying out the board; short tweens may use transforms.
- **The pointer.** Nothing new takes the pointer unless the story says so. A tip is the
  game's own note (`tip` or `data-tip`), never a `title` attribute: `tips.test.tsx` checks.
- **The painters are shared.** The ghost, the hand and shop cards, the milestone photos
  (`src/ui/screens/photo-paint.ts`) and the houses stored for the street all draw through the
  same code as the board. A change to how a room or a yard piece looks shows up in all of
  them, and each story says what to do about that.
- **Art.** A new cut from the LimeZu packs goes in `art/limezu/*.json`, then
  `npm run art:cut` and `npm run atlas`, with a record in `assets/licenses.json` and a line in
  `CREDITS.md` (`scripts/licenses.test.ts` checks). The packs are in the gitignored
  `art-source/` folder of the main checkout; a worktree doesn't have it. Our own drawings go
  in `src/ui/art/drawings.ts` or `src/ui/theme/icons.ts`, in LimeZu's palette (a test holds
  them to it).
- **Sound.** A new sound is a recipe in `src/ui/audio/kit.ts` on the samples already there, or
  a ZzFX recipe. A new audio file needs a CC0 or CC BY source and the same records as art.

## Checking your work

- `npm test`, `npm run typecheck` and `npm run format`.
- One round in the dev build (`preview_start` with the "dev" config), at 1280×720, 1440×900
  at 2×, 1728×963 at 2× and 1920×1080. Then stop, and list what you didn't look at under
  Known gaps in the log entry. One round, not several.
- Ways to reach a state quickly:
  - `?debug` opens the debug panel: add score, add budget, give a card or any shop good,
    force a miss, force the shop, force a change order, force an arrival.
  - `?seed=`, `?client=` and `?crew=` start a run directly. `?run=` opens a run code.
- **End-of-run moments need a run that ends in the browser.** The look down the street
  (D-156) doesn't play for a run that used a debug action, a run that loads already over, or
  with Reduce motion on (the `onEvents` effect in `src/ui/board/Board.tsx`). Stories that
  hang off it keep those guards, so the debug panel's "add score" can't show them. Play the
  last weeks of a real run, or drive `rules.apply` with the greedy policy
  (`sim/policies/greedy.ts`) in a throwaway script and open its run code a week short of the
  end. Relaxing the debug guard locally while you test is fine; don't commit that.
- When a story changes how something looks, save before and after screenshots in
  `docs/playtests/`, as D-159 and D-173 did.
- Sim jobs share the machine. Run a few at a time, not dozens.

## Logging it and opening the pull request

- Add a decision-log entry, Proposed, with the next free number (D-175 when this was written;
  D-175 to D-183 went to S01 to S09 on 2026-11-16. On 2026-11-20 D-192 to D-198 were held for
  S22, S23, S24, S25, S27, S29 and S30; check develop and the open pull requests), in the same
  pull request as the change. Put a dated note on each entry the story lists under **Decision
  log**.
- Branch `phase/<slug>`, a phase pull request into develop, the PR monitor on, auto-merge
  off. The user merges after a look or a playtest.
- The pull request says what to look at and how to get there in under a minute (the debug
  steps, a seed or a run code).

## The order

Sizes: S is a day or two, M is two to four days, L is about a week. They are estimates from
reading the code, not from building anything.

| Story | What the player gets | Size | Kind | Needs first | Status |
|---|---|---|---|---|---|
| [S01](s01-open-house-day.md) | A win brings a crowd to the kerb, hearts and a fanfare | M | UI only | | Accepted 2026-11-18: #94, batch #93 (D-175) |
| [S02](s02-set-doors.md) | Rooms in a set open into each other | M | UI only | The user's pick from a sheet | Stage 1 merged by the user (#102, width B) and Accepted 2026-11-18 (D-176); stage 2 built 2026-11-22 (D-202, #133), with D-208's kitchens after it; waiting on the user's playtest |
| [S03](s03-household-walks-in.md) | An arriving member walks up and waits at the door | M | UI and art | | Accepted 2026-11-18: #95, batch #93 (D-177) |
| [S04](s04-furniture-drops-in.md) | A placed room's furniture drops in piece by piece | S | UI only | | Accepted 2026-11-18: #96, batch #93 (D-178) |
| [S05](s05-doghouse-wakes-up.md) | The Doghouse's dog is on a lead until the fence closes | M | UI and art | | Accepted 2026-11-18: #97, batch #93 (D-179) |
| [S06](s06-rain-for-rainy-season.md) | It rains while Rainy season runs, with puddles on the Patios | S | UI only | | Accepted 2026-11-18: #98, batch #93 (D-180) |
| [S07](s07-finished-rooms-light-up.md) | A fitted and grown room turns its lights on | S, then M | UI only, then rules | Stage 2: the user's go, given 2026-11-23 | Stage 1 Accepted 2026-11-18: #99, batch #93 (D-181). Stage 2 built 2026-11-23 (D-211, `phase/finished-room-pays`): a finished room pays 2 budget, once; waiting on the user's playtest |
| [S08](s08-client-at-the-door.md) | The client appears at each milestone, with hearts on their wishes | M | UI and art | Easier after S03 | Accepted 2026-11-18: #100, batch #93 (D-182) |
| [S09](s09-their-things-move-in.md) | The Count's coffin and the Barkers' dog bed | M | UI and art | | Accepted 2026-11-18: #101, batch #93 (D-183) |
| [S10](s10-house-builds-itself.md) | The house rebuilds itself on the end screen | M | UI only | S01 played | Built 2026-11-20 (D-187): Play in the photo viewer, then the rebuild on the board the user asked for after it; waiting on their playtest on /dev/ |
| [S11](s11-walkthrough-tour.md) | The camera tours the rooms after a win | M | UI only | S01 played | Not started; S01 played 2026-11-18 |
| [S12](s12-dusk-when-you-win.md) | Evening falls and the rooms light up after a win | S, then M | UI only | S01 played; a mockup the user likes | Not started; S01 played 2026-11-18 |
| [S13](s13-listing-on-the-end-screen.md) | The end screen writes a short listing for the house | S | UI only | The user's OK on the tone | Built 2026-11-23 (D-212, #139) in the straight tone, the user's pick; waiting on their playtest on /dev/ |
| [S14](s14-pin-one-card.md) | Keep one card for next week | M | Rules and UI, no re-fit | | Accepted 2026-11-20: #111 (D-186) |
| [S15](s15-trim-the-upgrade-shelf.md) | The upgrade slot stops offering two dead cards | S | Content | The user's answer | Replaced by S26 on 2026-11-20: the user keeps both upgrades |
| [S16](s16-wrong-delivery.md) | A free yard showpiece arrives once a run | M | Rules and content | D-171's verdict | Built 2026-11-20 (D-188, #110); waiting on their playtest on /dev/ |
| [S17](s17-one-wish-on-the-lot.md) | The Pond or the Old Shed asks for company and pays a piece | M to L | Rules and content | The batch | Built 2026-11-23 (D-205, #143); waiting on the user's playtest on /dev/ |
| [S18](s18-neighbors-ask.md) | A neighbor asks for Fence along their side | L | Rules and content | The batch | Built 2026-11-23 (D-206, `phase/neighbors-ask`): at Roofing's start on about 2 runs in 3, 5 Fence tiles along their side pay an overtime week; waiting on the user's playtest |
| [S19](s19-one-scored-visitor.md) | One visitor's wish, shown in the last shop | L | Rules and content | S01 landed | Not started |
| [S20](s20-the-bigsbys.md) | A client whose family keeps arriving | L | Content and a little rules | A played spike | Spike built 2026-11-23 (D-219, `phase/the-bigsbys`), steps 1 to 8 at a placeholder target; waiting on the user's play before step 9's fit |
| [S21](s21-house-already-on-the-lot.md) | Some lots start with a tired cottage | L | Rules, content and art | D-174's and D-145's verdicts | Not started; D-174 Accepted 2026-11-18, D-145 still Proposed |
| [S22](s22-shop-for-your-house.md) | The shelf leans toward goods that can pay in your house | M | Rules and content | Before S27 | Built 2026-11-20 (D-192, #119); waiting on the user's playtest |
| [S23](s23-every-good-shows-its-worth.md) | Every piece and tool on the shelf says what it's worth | M to L | Rules views and UI | | Built 2026-11-20 (D-193, `phase/every-good-shows-its-worth`); waiting on the user's playtest |
| [S24](s24-fixtures-always-pay.md) | Five fixtures pay something wherever they fit | S | Content | | Built 2026-11-20 (D-194, `phase/fixtures-always-pay`); waiting on the user's playtest |
| [S25](s25-pieces-that-pay-off.md) | A Sapling plants up to three; the Garage, Fire Pit, Playroom and Hot Tub pay more often | M | Content | | Built 2026-11-20 (D-195, `phase/pieces-pay-off`); waiting on the user's playtest |
| [S26](s26-upgrades-that-deliver.md) | Storage Unit, Tool Belt and Drafting Table bring something you can see | M | Rules and content | The user's playtest of S16 | Built 2026-11-23 (D-209, `phase/upgrades-deliver`), before S16's playtest at the user's pick; waiting on the user's playtest |
| [S27](s27-hold-a-good.md) | Hold one good for the next shop | M | Rules and UI | After S22 | Built 2026-11-20 (D-196, #125, on S22's branch); waiting on the user's playtest |
| [S28](s28-new-goods.md) | A Photo Shoot, a Dog Door, and Weekend Crew at 3 | M | Content and art | The playtest of S22 to S25, and the user's pick | Built 2026-11-23 (D-210, `phase/new-goods`): all three, the user's pick; waiting on the user's playtest |
| [S29](s29-fewer-repeat-halls.md) | The hand repeats your free Hallway and Fence half as often | S | Content | | Built 2026-11-20 (D-197); waiting on the user's playtest |
| [S30](s30-bunk-beds-cap.md) | Bunk Beds never break Room for everyone | S | Rules | | Built 2026-11-20 (D-198); waiting on the user's playtest |
| [S31](s31-landmarks-with-reach.md) | A Pool, a Library, a Henhouse and a new Fountain pay what's within 2 tiles, shaded while you place them | M | Rules, content, UI and one sprite | | Built 2026-11-22 (D-199, `phase/landmarks-with-reach`); waiting on the user's playtest |
| [S32](s32-specials-in-the-hand.md) | The shop's special pieces turn up in the hand from Framing, once each pays its way | S per stage | Content and a little rules | Stage 2: S31 and S25 played | Stage 1 built 2026-11-22 (D-200, `phase/specials-in-the-hand`): the Henhouse and the Library; waiting on the user's playtest. Stage 2 not started |
| [S33](s33-categories-not-names.md) | The Patio, Dining Room and Doghouse read a kind of piece, not one name | S | Content | | Built 2026-11-22 (D-201, `phase/categories-not-names`); waiting on the user's playtest |

## The groups

**S01 to S09: start now.** UI only, so none of them moves a target, and they can be played
on /dev/ while D-171 to D-174 wait for their verdicts. *2026-11-18: all nine are built, played
and Accepted (D-175 to D-183, playtest 9).*

- S02, S04, S05, S07 and S09 all change the room and yard painters (`house-model.ts`,
  `rooms.ts`, `yard.ts`, `HouseLayers.tsx`). Build them one at a time.
- S01, S03, S06 and S08 live in the street and life layers and the director. S03 and S08
  share people sprites and a people layer; build S03 first if both are wanted.

**S10 to S13: the end of a run.** S10, S11 and S12 each want the same few seconds after the
last tally that S01 uses. Build S01, let the user play it, and then build at most one of
these at a time; the first one played decides whether any more are wanted. S13 is separate:
it is text on the end panel.

**S14: rules without a re-fit.** It adds an action but no content, so the hash holds and the
bots' results don't move. It can be tried by itself at any time.

**S15 to S21: the rules batch.** Wait for the user's verdicts on D-171 to D-174, which were
still Proposed when this was written. *2026-11-18: all four are Accepted (playtest 9).*

- Each of these changes the content hash, so runs in progress drop when it merges.
- Each story measures its own effect on paired seeds and reports it. None of them changes
  the milestone targets.
- When the user has chosen which ones to keep, merge those into one batch branch and fit
  once, by D-169's method (2,000 runs each of `sim-*`, `check-*` and `hold-*`, the clients'
  factors, and `firstTargetPct`).

**S22 to S30: the shop and content review (2026-11-20).** The review found that the goods
people skip are the ones whose payoff is late, conditional or invisible, and that the shop
feels flat for the same reason. Its order: the shop first (S22, S23), then the blank cards
(S24, S25), then the rest.

- S22, S23 and S27 all change the shop (`shop.ts`, `ShopScreen.tsx`). Merge one before
  building on the next, and S27 after S22.
- S24 and S25 are content passes that each measure their own effect, so they can go side by
  side.
- S26 waits for the user's playtest of S16, so they judge one new source of free cards at a
  time. S28 waited for the playtest of S22 to S25, then the user's pick; the user had it
  started on 2026-11-23, all three goods were built while they picked, and they picked all three.
- S29 and S30 change Accepted decisions (D-160 and D-121; D-101). The user OK'd both on
  2026-11-20.
- As with S15 to S21, none of them changes the milestone targets. Each reports a paired-seed
  trial, and once the user has chosen which to keep, one fit by D-169's method follows.
- S15 is replaced by S26: the user keeps the Storage Unit and the Tool Belt (2026-11-20), and
  S26 makes them deliver instead.

**S31 to S33: deeper piece interactions (2026-11-20).** The review found that almost every piece
reads only the pieces it touches, so 53% of placements change nothing else on the board. Its
order: reach first (S31), then the special pieces in the hand (S32), with categories (S33)
alongside.

- S32 has two stages. The first (the Henhouse and the Library) can go at any time. The second
  waits for the user's playtest of S31 and S25, whose changes are what make the Pool, the
  Playroom and the Hot Tub worth dealing, and deals only the pieces its trial shows are played.
- S31 and S33 leave alone the pieces S25 changes, so they can go beside it.
- As with S15 to S30, none of them changes the milestone targets. Each reports a paired-seed
  trial, and once the user has chosen which to keep, one fit by D-169's method follows.
- The review ranked four more options lower, and they aren't stories yet: views at range
  (D-166's follow-up, which changes D-035), pieces that count the whole house, garden paths
  that link yard pieces, and chains (D-094, Parked).

## Not in this backlog

- The other 68 ideas, which the reviewers rated marginal or worse as pitched.
- Four small ones from the review's summary. They were rated marginal as pitched, but their
  cut-down versions are about a day each and could be added here:
  - A Closet that dresses by its neighbor: a pantry beside a Kitchen, a laundry beside a
    Bathroom (`src/ui/art/rooms.ts` only). *Built 2026-11-23 (D-216,
    `phase/closet-by-neighbor`), reading only the rooms built before it; waiting on the user's
    playtest.*
  - A stepping-stone walk from the front doormat to the kerb, as art only.
  - A Play button in the photo viewer that flips through the milestone polaroids.
  - A second click on the ghost builds the piece, the outside tester's ask.
