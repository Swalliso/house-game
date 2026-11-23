# S20 · The Bigsbys

| | |
|---|---|
| Size | L, four to five days, then a fit if the spike is liked |
| Kind | Content, with a small change to the rules' types and one house rule. The hash changes |
| Branch | `phase/the-bigsbys` |
| Needs first | The user playing a spike before any fit. Part of the rules batch |

## Story

A new client: a big family whose members keep arriving. Someone new rings the doorbell at
five milestones, and each one needs one more Bedroom.

## Why

- `docs/content-brainstorm.md` has had the Bigsbys since the start, as a Stretch client: "We
  need room. Lots of room." It was never built and never turned down.
- The user has said clients differ only somewhat. This one's house ends up visibly
  different: a large family home, with the doorbell at nearly every milestone.
- Arrivals are driven by data, and the content check already allows one at any phase from
  1 to 6. Only Framing and Drywall are used today.

## Build

This is the cut-down client. It has no new rooms and no new art.

1. **Types.** Add `bigsbys` to `ClientId` and five ids to `ArrivalId` in
   `src/rules/index.ts`, and ids for their change orders. `src/rules/testing.ts` holds test
   content keyed by client, so it needs matching entries.
2. **An arrival without a room of its own.** Today every arrival must name a member's room,
   and each member's room belongs to one arrival (`validateContent` in
   `src/content/index.ts`). `roomForEveryone` in `src/content/house-rules.ts` raises the
   Bedroom range by one for each arrival and requires each arrived member's room. Make the
   room optional: an arrival with none brings a plain Bedroom card and only raises the
   range. That gets D-173's arrangements for free.
3. **The client.** In `src/content/clients.ts`: the brief from the brainstorm, the
   household, and one wish (a Playroom, with pool weight for it, the way other clients'
   signature rooms are done). A placeholder target factor of 100. The brainstorm makes them
   Uncommon; note that a rarity's weight is split among its clients, so they halve
   Juniper's showings on the job board.
4. **The household.** In `src/content/households.ts`: arrivals at phases 1 to 5, each with a
   `bedroom` card.
5. **Short words.** The checklist's Bedroom line is generated with one clause for each
   arrival. Five clauses is a paragraph. Give the generator a short form for this case
   ("one more Bedroom each milestone"), and the job card's household line the same.
6. **Change orders.** Two or three of their own, one of them a phase effect so that the
   offer after milestone 6 always comes (D-137).
7. **Tests.** `households.test.ts` has the member list and "at Framing or Drywall" written
   in. `change-orders.test.ts` expects two or three orders a client. Add a
   `witness-bigsbys.test.ts`: every client has a hand-built house proving its checklist can
   be met at every milestone, and here that is a compact house of seven Bedrooms.
8. **The spike, before any fit.** Start a run with `?client=bigsbys` at the placeholder
   target and ask the user to play it. The question is whether packing that many Bedrooms is
   fun and whether the house still reads as a house.
9. **Only then, the fit.** With the batch: `npm run sim -- --suggest-targets` moves the
   curve and all six clients' factors, then `--check` on held-out seeds. Read the houses
   report for the compact outline and the glance test on the Bigsbys' houses.

## Leave out

- Named rooms for each member, with their own furniture. That is five new pieces and their
  room specs, and is the follow-up if the spike is liked.
- A Kids' Wing set. Sets apply to every client, and the Playroom is shop-only, so it would
  rarely fire and would shift Charm for everyone.
- Faces on the job card. The card has no portraits.
- Making Bunk Beds matter. That means an arrival raising the range by more than one, which
  amends D-103.
- The brainstorm's halved-Loud taste and its Guest House, which doesn't exist as a piece.

## Where it lives

- `src/content/clients.ts`, `households.ts`, `house-rules.ts`, `change-orders.ts`.
- `src/content/index.ts`: the checks on arrivals and member rooms.
- `src/rules/index.ts`: `ArrivalDef` (its `room` and `cards`).
- `src/rules/jobs.ts`: how the job board weighs rarities.
- `src/content/witness-*.test.ts`: the five existing witness houses, as models.

## Watch for

- Sprawl is already an open question, and "A compact house" may fight this brief the way it
  fights Juniper's. The spike is where to see that.
- Five free Bedroom builds lengthen a run, and the user found five-week milestones too long.
- The Hendersons are already the growing family. If the Bigsbys play like more of the same,
  say so after the spike and stop.

## Done when

- [x] An arrival can come without a member's room, with tests, and existing households are
      unchanged.
- [x] The Bigsbys can be picked, their five arrivals land, and the checklist and job card
      use the short form.
- [x] The witness test passes.
- [ ] The user has played the spike and said whether to fit it.

## How to check

`?client=bigsbys` and the debug panel's "force an arrival" to see all five doorbells in a
few minutes. Then a full run by hand before asking the user.

## Decision log

A new entry, with dated notes on:

- D-103: an arrival may come without a room of its own.
- D-142 and D-167: the household's short form on the job card and the checklist.
- D-031: a sixth client, and what it does to its rarity's showings.
