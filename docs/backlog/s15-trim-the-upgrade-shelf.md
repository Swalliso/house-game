# S15 · Trim the upgrade shelf

| | |
|---|---|
| Size | S, half a day and two sim passes |
| Kind | Content, with a one-line filter in the rules. The content hash changes |
| Branch | `phase/upgrade-shelf-trim` |
| Needs first | The user's answer to one question. Ship it with the rules batch |

*2026-11-20: replaced by [S26](s26-upgrades-that-deliver.md). The user keeps both upgrades
("okay to have and could be useful"), so S26 makes them deliver instead. Don't build this.*

*2026-11-23: S26 is built (D-209): the Storage Unit and the Tool Belt bring a special piece and a
Common tool each milestone, and the bot buys them now.*

## Story

The shop's one company-upgrade slot stops offering Storage Unit and Tool Belt, so it more
often shows something that changes how a week plays.

## Why

- D-143's status line says the user "still finds many shop goods not worth buying", and "a
  trim of the shelf is still to come". It was never started.
- In the review's one sim sample (greedy bot, General Contractor, 200 runs), Storage Unit was
  shown 151 times and Tool Belt 128 times, and neither was bought once. Together they were
  about a third of all upgrade offers.
- Storage Unit adds a slot for bought pieces. Since D-163 made pieces from Your goods free to
  build, they don't wait there long.

That evidence is a bot's, and the bots have been wrong about people before. Hence the
question.

## Ask the user first

"Have you ever bought Storage Unit or Tool Belt?" If yes to either, leave that one on the
shelf.

## Build

1. Add an `offered` flag to `UpgradeDef` in `src/rules/index.ts`, as blueprints and tools
   already have, and filter on it in `stockUpgrade` in `src/rules/shop.ts`. Add one test.
2. Set it to false on `storageUnit` and `toolBelt` in `src/content/upgrades.ts`. Their ids
   stay valid, so the tests that name them and old typed buys keep working.
3. In `validateContent` (`src/content/index.ts`), check that at least one upgrade is offered.
4. Run `npm run sim -- --check` and one pass with `--crew all`, before and after. The
   review's paired trial of a wider cut moved the greedy bot by half a point, inside the
   noise, so no re-fit is expected. Report what you find.

## Leave out

- Foreman. The bot buys it 11% of the time it is shown, and for three of the four crews it
  is the only way to a second reroll each phase.
- The shop's +1 strike service. D-157 said it would go if playtests found strikes plentiful,
  and no playtest has said so.
- Deleting the two upgrades or shrinking the `UpgradeId` union. That ripples through the
  test content and the sim's shop policy for no gain.
- Shop pieces and fixtures that are rarely bought (the Pool, the Playroom, Kitchen Island,
  Bunk Beds). S16 is one answer for the pieces.

## Where it lives

- `src/rules/index.ts`: `UpgradeDef`.
- `src/rules/shop.ts`: `stockUpgrade` picks the visit's upgrade from those the run doesn't
  own, on the stream `shop/<n>/upgrade`.
- `src/content/upgrades.ts`: the seven upgrades.
- `src/content/blueprints.ts` and `tools.ts`: how `offered` is used today.

## Watch for

- The content hash changes, so runs in progress drop when this merges. That is why it ships
  with the batch and not alone.
- An old run code that bought an upgrade can replay differently, because the pick now draws
  from five upgrades instead of seven.

## Done when

- [ ] The user has answered the question.
- [ ] Neither upgrade is ever offered; both still work if a test or the debug panel gives
      one.
- [ ] The two sim passes are reported in the log entry, before and after.

## How to check

Open several shops with the debug panel's "force the shop" and confirm the upgrade slot never
shows the two. Then give yourself one with "give a good" and confirm it still works.

## Decision log

A new entry, with dated notes on D-051 (seven company upgrades, two of them no longer
offered) and D-143 (the trim its status line was waiting for, in part).
