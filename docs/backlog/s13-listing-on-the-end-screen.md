# S13 · The listing on the end screen

| | |
|---|---|
| Size | S, a day or two, most of it writing and testing phrases |
| Kind | UI, with perhaps one read-only rules helper. The content hash stays |
| Branch | `phase/end-screen-listing` |
| Needs first | The user's OK on the tone |

## Story

The end screen says something about the house you built, as a listing of two or three lines.
A headline from real counts ("3 bed, 1 bath Charmer on a creekside lot"), one line about the
client, and at most one dry line about a flaw.

## Why

- The end panel is a ledger: a verdict, a number, rows of milestones and stats. Nothing in it
  reacts to this house in particular, win or lose.
- It needs no rules change, no re-fit and no new art.

## Ask the user first

Two things cut against it, so confirm before building:

- The user has asked for less text, and this is more words, though only on the end screen.
- D-009 says "Not a realtor or sales game". A listing borrows that voice for a joke.

Show the user the phrase list (step 3) before wiring it in.

## Build

1. **A pure module** `src/ui/screens/listing.ts` with `listing(state)` returning the lines,
   tested in Node the way `result-line.test.ts` and `next-time.ts`'s tests are. The phrase
   table lives in `src/ui`, as `next-time.ts`'s wording does.
2. **Facts come from the rules.** Don't walk the house's pieces in the UI: D-150 turned down
   a line that would have.
   - Wishes held: `rules.checklist(state)`.
   - Sets, and a piece whose requirement isn't met (an unreached Garage): the last tally.
   - The lot: `lotTraits` and `lotBiome` in `src/rules/lot.ts`.
   - The verdict: `rules.verdict(state)`.
   - Bedroom and Bathroom counts have to respect `countsAs` (a member's room counts as a
     Bedroom). `countMatching` in `src/rules/conditions.ts` does that but isn't on the public
     facade. Either expose it or add a small pure `houseFacts(state)` to `src/rules`, with a
     test. It reads state and changes nothing.
3. **About 15 phrases, each with a trigger that is true by the rules.** No invented facts:
   "no natural light" is out unless a rule says so. For example, Count Vladislav's wish for
   three Dark rooms being met can earn a line about the dark. Write fallbacks for a lost run
   whose rooms were never built and for an empty house.
4. **Where it shows.** On the end screen only, under the verdict or the last photo. Check
   both fonts, and 1280×720 and 1728×963, where the end panel already runs below the fold.
5. **Tests.** Constructed runs for each phrase's trigger, and one bot-played run for each
   client to prove no line is ever empty or false.

## Leave out

- The Copy result line. D-135's one line for the group chat stays exactly as it is.
- Storing the listing with a house, the Portfolio, and the street's Inspect.
- A postcard picture.

## Where it lives

- `src/ui/screens/EndScreen.tsx` and `end.css`: the panel. `end-panel.test.tsx`,
  `end-sign.test.tsx` and `end-click.test.ts` walk it.
- `src/ui/screens/result-line.ts` and `next-time.ts`: the two wording modules to model on.
- `src/rules/run.ts`: `checklist` and `verdict` on the `Rules` interface.

## Watch for

- Template jokes wear out. A phrase that is funny once is tired by the third run, so prefer
  lines that state a fact about this house over lines that are only a quip.
- The outside tester tripped on misleading words. Every phrase has to be literally true of
  the house on screen.

## Done when

- [ ] The user has approved the tone and the phrases.
- [ ] A won run and a lost run each show two or three true lines on the end screen.
- [ ] The Copy result text is byte-for-byte what it was.
- [ ] `listing.test.ts` covers every phrase's trigger and a bot run for each client.
- [ ] Nothing under `src/content` changed, and any helper in `src/rules` is read-only.

## How to check

End a run for each client and read the lines against the house. The debug panel is fine
here: the listing doesn't depend on the street view.

## Decision log

A new entry, with dated notes on D-148 and D-152 (the end panel gains a block) and D-167
(the text diet, with the end screen as the one place this adds words).

## If it lands

After two runs the user enjoyed: append the listing to the copied result, and keep it with
each house in the Portfolio.
