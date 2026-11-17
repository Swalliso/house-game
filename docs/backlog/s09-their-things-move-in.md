# S09 · Their things move in

| | |
|---|---|
| Size | M, about two days |
| Kind | UI and art: no rules or content change, and the content hash stays |
| Branch | `phase/their-things` |
| Needs first | Nothing |
| Shares files with | S02, S04, S05 and S07: build one at a time |

## Story

A client's own things show up in their house. Count Vladislav's first Bedroom has his coffin
where the bed would be, and a candle on the wall. The Barkers' Living Room has the dogs' bed.

## Why

- D-173's sheet showed three directions. The user picked the arrangements; "the client's
  taste" was passed over with the note "it could follow as signature pieces". This is that
  follow-up at its smallest.
- The user has said clients differ only somewhat. Member rooms already have telling
  furniture (D-111), but the ordinary rooms look the same for every client.

## Build

1. **The client reaches the painter.** Add an optional client id to the house model, as the
   sun is, pass it from the model's three callers (`Board.tsx`, `fx/moments.ts`,
   `screens/photo-paint.ts`) and add it to the model's cache key.
2. **An overlay in `src/ui/art/rooms.ts`.** Extend `Ctx` with the client. After the
   arrangement's wants in `layOut`, apply one signature want for the client's room type. It
   takes the place of a key piece, so that it survives in a 2×2 room, and it applies to all
   three arrangements.
   - `vladislav`: the Bedroom with the lowest uid that isn't a member's room gets the coffin
     as its bed, and a wall candle.
   - `barkers`: the Living Room gets `own-dog-bed`, which is already in the atlas.
3. **Cuts.** The coffin and the wall candle, from Modern Interiors. An unpushed local mock
   already found their rects: branch `mock/room-variety`, commit `9f17ac3`
   (`git show 9f17ac3:art/limezu/interiors.json`). Its `rooms.ts` has a `taste()` function
   that replaces whole layouts; this story wants an overlay, so borrow the rects and not the
   function. If that commit isn't in your clone, the coffin is on the pack's Halloween
   sheet. Record the cuts as the README describes.
4. **The ghost.** `PieceLook` gains the client, so a Bedroom's ghost shows the coffin when it
   would be the Count's first Bedroom. D-100's rule is that a ghost shows exactly what will
   be built. Hand and shop cards stay as they are.
5. **The table stays in `src/ui/art`.** Putting it on the client's definition would change
   the content hash for no gain.
6. **Fixtures.** Bunk Beds in the coffin's Bedroom: the fixture's bed wins and the coffin
   isn't drawn. Check the other bedroom fixtures against D-172's bar, "reads as a mistake".

## Leave out

- Moving boxes that unpack a week later. A look that depends on the week bends the ghost
  rule and doubles the test matrix.
- The other three clients, until these two have been played.
- Member rooms. They keep their own furniture (D-111).
- A pop when things appear.

## Where it lives

- `src/ui/board/house-model.ts`: `HouseModel`, `PieceLook` and the cache key.
- `src/ui/art/rooms.ts`: `Ctx`, `Want`, `layOut`. `rooms.test.ts` runs every arrangement in
  every rotation and footprint, with each fixture and extended; extend it for the two
  overlays.
- `art/limezu/interiors.json`: where the new cuts go.

## Watch for

- An object 16 to 22 px across in one room is easy to miss. The coffin is loud; the dog bed
  is quiet. If the dog bed doesn't register, say so in the pull request.
- Nana's Room already has the dogs' bed. It stays there too.
- The first job uses a real client, so the look shows there as well. It adds no text.

## Done when

- [ ] The Count's first Bedroom shows the coffin and candle in all three arrangements, at
      every rotation and footprint, and in the ghost.
- [ ] The Barkers' Living Room shows the dogs' bed, the same way.
- [ ] Other clients' rooms are pixel-for-pixel as before.
- [ ] `rooms.test.ts` covers both overlays, doorways and walkways stay clear, and each new
      cut is in `assets/licenses.json` and `CREDITS.md`.
- [ ] Nothing under `src/rules` or `src/content` changed.

## How to check

Start with `?client=vladislav` and place Bedrooms of several shapes; then `?client=barkers`
and a Living Room. Save before and after screenshots in `docs/playtests/`.

## Decision log

A new entry, with dated notes on:

- D-100 and D-097: a room's look can depend on the client.
- D-111: member rooms are unchanged.
- D-173: the option it passed over follows, as signature pieces.

## If it lands

Juniper, Dale and the Hendersons, and only then a pop when an arrival's things appear.
