# S30 · Bunk Beds that never break Room for everyone

| | |
|---|---|
| Size | S, a day and a sim trial |
| Kind | Rules (one counting rule) and a card line. No content change, so the hash holds |
| Branch | `phase/bunk-beds-cap` |
| Needs first | Nothing. The user OK'd changing D-101 on 2026-11-20 |

## Story

Bunk Beds count their Bedroom twice toward Room for everyone only up to the top of its range.
A house at the top no longer breaks the line by putting them in.

## Why

- Bunk Beds make their Bedroom count as two (D-082). Room for everyone has a top as well as a
  bottom, and the ranges are tight: 1–2 for most households, rising by one at each end at each
  arrival (D-103). In a house at the top of its range, Bunk Beds break the line.
- In the 2026-11-20 review of rarely used goods
  (https://claude.ai/artifact/VF9nL6jQ4sVpgYri86rm1X): installed from the hand 12% of the
  times it was offered (a fixture's average is 25%), bought 3% of the times it was on a shelf,
  and in half the hands that offered it, its best install scored below a pass. D-107's value
  line already shows that loss in orange.
- D-101 kept the double count (2026-11-06): counting once didn't help, and cost 4 points of
  what was then the Bathroom ratio. This keeps it where it helps, reaching the bottom of a
  range, and drops it only past the top.

## Already asked

The user said yes on 2026-11-20, on a card in the review thread: "Also change the two settled
rules: hand Hallways and Fences, and Bunk Beds?", "Yes, build both". D-101 is Accepted, and
this is a third way the team hasn't tried; that yes covers changing it as **Build** says.

## Build

1. **The count.** In `src/rules/conditions.ts`, a `count` with a `max` over piece types reads
   `max(once, min(weighted, max))`, where `once` counts each matching piece once and `weighted`
   is today's count. Bunk Beds lift the count to the top and never past it, and a house over
   the top with plain Bedrooms still fails, as today, and reaching the bottom works as it does
   now. A count with no `max` reads the weighted count as before. Apply it where `inRange`
   checks a count condition and in that condition's checklist line, so the line shows what it
   checks.
2. **Limits stay.** `typeLimits` (Renovate and half-weight draws): a type is at its limit once
   the weighted count reaches the top, and the capped count reaches it at the same moment. Say
   so in a comment.
3. **The card.** "Counts as 2 Bedrooms for the client" (`countsAs` in `src/rules/text.ts`)
   gains its limit, say "Counts as 2 Bedrooms for the client, up to a range's top". D-107's
   value line shows the rest.
4. **Tests:** a house at the top of its range keeps Room for everyone with Bunk Beds; one below
   the top gains a Bedroom from them, and one a Bedroom short of the bottom reaches it; one over
   the top with plain Bedrooms still fails; `typeLimits` doesn't change; Bunk Beds'
   `fixtureValue` at the top is no longer a loss; the card's text.
5. **The sim:** a paired-seed trial, 600 runs an arm on `check-*`: Bunk Beds installed from the
   hand and bought, the share of hands where their best install scores below a pass (`--dead`),
   Room for everyone held at the end, and wins. Report it; don't change the targets here.

## Leave out

- Counting them once (D-101 tried it).
- Sets, where they already count once (D-081, `setProgress`).
- The Kitchen Island's `countsAs` (S24 replaces it).

## Where it lives

- `src/rules/conditions.ts`: `weightOf`, `countMatching`, `inRange`, the checklist's lines,
  `typeLimits`.
- `src/rules/text.ts` (the `countsAs` line); `src/content/fixtures.ts` (`bunkBeds`) and
  `src/content/house-rules.ts` (Room for everyone), read only.

## Watch for

- `countCache` in `conditions.ts` caches by layout and selector. A capped read mustn't leak into
  an uncapped read of the same selector.
- D-189's house report counts Bunk Beds once already; keep it so.
- Saves and run codes carry over, but a replayed run with Bunk Beds at the top of its range
  scores more than it did.

## Done when

- [ ] Bunk Beds at the top of the range keep Room for everyone, and below it still add a
      Bedroom.
- [ ] Their card says how far they count, and their value line no longer shows a loss for it.
- [ ] The paired-seed result is in the log entry, and the targets are untouched.

## How to check

`?debug`: build two Bedrooms in the first milestone (Room for everyone reads 2, the top of
1–2 for most clients), give Bunk Beds, and look at their value line and the checklist before
and after putting them in.

## Decision log

A new entry, with dated notes on:

- D-101: Bunk Beds count twice up to the top of a range.
- D-082: the Bunk Beds' count.
- D-107: their value line no longer shows a loss at the top.
