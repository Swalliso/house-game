# S08 · The client at the door

| | |
|---|---|
| Size | M, two to three days |
| Kind | UI and art: no rules or content change, and the content hash stays |
| Branch | `phase/client-at-the-door` |
| Needs first | Nothing, but it is cheaper after S03, which builds the people layer |

## Story

After each milestone's banner, the client pops in beside the front door for a moment. A heart
bubble pops over each wish piece the house has, and a question-mark bubble over the client if
a wish is still open.

## Why

- Each milestone is a client walkthrough in the fiction (D-018), and the loss line already
  says "The client walked at…". Nothing on the board shows the client.
- D-110 left client portraits open and never came back to them.
- It is a wordless reminder of the wishes at the moment the player plans the next phase.

## Build

1. **Figures.** One standing frame for each of the five clients, cut from premade characters
   the sidewalk doesn't use. A household is shown as one figure. The table from client to
   sprite lives in `src/ui`. No premade character is a vampire, so pick the closest for Count
   Vladislav or compose one with the `compose` step in `scripts/cut-art.ts`. Put the five
   picks in the pull request for the user's look.
2. **Bubbles.** A heart and a question mark, with their pop-in frames, from Modern Interiors'
   thinking-emotes sheet. Record every cut as the README describes.
3. **Which pieces get a heart.** Only wishes that are met and that name a piece the UI can
   find: the Doghouse, the Library, the Home Office and the Mudroom. Whether a wish is met
   comes from `rules.checklist(state)`. A small table in `src/ui` maps those wishes to their
   piece type. Wishes about an area, a pair of rooms or a tag (a fenced yard, a Kitchen
   beside a Dining Room, Dark rooms, nothing Loud by an office) have no place the rules can
   name: they get no heart, and count only toward the question mark. Don't work a wish's
   condition out in the UI.
4. **The beat.** In the director's milestone case, for milestones that are met and aren't
   the last. About 1.5 s, most of it under the banner's last second so that the shop opens
   barely later than today. A click skips it. The numbers go in `feel.ts`.
5. **Where.** Beside the front door: `frontDoor(state)` in `src/ui/fx/moments.ts`, the spot
   the doorbell's card uses. Draw it on S03's people layer if that exists, or as a board
   moment in `src/ui/board/MomentLayers.tsx`, as "Topped out!" is.
6. **Reduce motion and the first job.** Skip the beat under Reduce motion and in the guided
   first job.

## Leave out

- The client driving up and walking the lot. At the walkers' pace, kerb to mid-lot is about
  19 seconds, seven times a run.
- Handing change orders over at the kerb. That rewrites the sheet's rules in Accepted D-109,
  D-110 and D-144.
- Faces on the job board and the end screen. The pack has no portraits and the figures have
  no expressions.
- A marker for where an open wish would go. The rules have no answer to that.
- Moving the camera. If the door is out of view, the beat plays unseen.

## Where it lives

- `src/ui/fx/director.ts`: the milestone case and `milestoneBanner`.
- `src/ui/board/MomentLayers.tsx` and `src/ui/fx/moments.ts`.
- `src/rules/run.ts`: `checklist` on the `Rules` interface. Read only.
- `src/content/clients.ts`: each client's wishes. Read only.
- `art/limezu/life.json` and `ui.json`: how characters and icons are cut.

## Watch for

- A question mark over a figure is a new symbol in a game newcomers found confusing. If it
  doesn't read at once, drop it and keep the hearts.
- The banner waits for the shop in real time (`feel.ts` explains). Don't lengthen that wait.

## Done when

- [ ] At a met milestone the client appears by the door, hearts pop over met wish pieces,
      and a question mark shows if any wish is open.
- [ ] The shop opens no more than about half a second later than today, and a click skips.
- [ ] Nothing plays on a failed milestone, the last milestone, the first job or with Reduce
      motion on.
- [ ] Each cut is in `assets/licenses.json` and `CREDITS.md`.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

Start with `?client=barkers`, build the Doghouse inside a fenced yard, and use the debug
panel's "add score" to meet the milestone. Repeat with `?client=dale` and no Home Office to
see the question mark alone.

## Decision log

A new entry, with dated notes on:

- D-110: its open note on client portraits, answered with a figure on the board.
- D-124 and D-127: the milestone's beat gains a visit.

## If it lands

The client's car at the kerb, and a figure on the contract card.
