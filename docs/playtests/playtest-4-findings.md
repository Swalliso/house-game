# Playtest 4: findings and proposals

**Date:** 2026-11-09. **Build:** /dev/ at 0b9e9db (PR #17 merged into develop). **Run:** seed `zcndxm`, the Hendersons, the General Contractor. Won 32,057 Wow against 30,625.

**Status:** research notes, committed with the quick-fix PR (D-112). Your answers so far are in §17.

**How this was made:** the run code replays exactly in a harness (every number below about the run comes from `preview()` on the replayed state). Ten read-only investigators took one area each, using the harness, the sim, the code, research.md and the web. A reviewer then re-ran the claims that matter most. Where a number wasn't re-checked, it says so.

---

## 1. Your run in numbers

| Milestone | Score | Target | Lead |
|---|---|---|---|
| Groundbreaking | 135 | 19 | 7.1× |
| Foundation | 926 | 375 | 2.5× |
| Framing | 3,488 | 1,375 | 2.5× |
| Roofing (2 weeks early) | 7,250 | 3,813 | 1.9× |
| Drywall | 11,463 | 8,563 | 1.34× |
| Finishes | 18,338 | 16,438 | 1.12× |
| Final Walkthrough | 32,057 | 30,625 | 1.05× |

- M4's steeper targets took away most of playtest 3's mid-run slack (that run had 2.4×, 2.15× and 1.95× at milestones 4–6), and the end was tight but met. The first milestones are still loose. Nothing here asks for a target change.
- You said you had to chase every set and multiplier to win. That matches the sim: set bonuses are about 37% of greedy's points, and under the house rules Charm is about 73% of the Wow (house-systems-review.md). It's why a one-tile Closet can be worth +139: Charm multiplies everything.
- Other run facts: 4 rerolls of the General Contractor's 14 (weeks 1, 1, 5 and 7). Weekend Crew was bought at shop 4 and never used. "Working from home" was accepted after milestone 4 and missed (the Home Office came in week 23, after the deadline). You never renovated, and never built a Garage or a Hallway.

## 2. The numbers that surprised you, explained

All re-run and confirmed by the reviewer.

**The Closet, +139 (week 10).** Before, 102 Comfort × 5.00 Charm = 510; after, 118 × 5.50 = 649. The parts:
- the Closet's own 2 a week (1, +50% Feng Shui) × 5.0 = +10;
- a Bedroom loses a Tree the Closet clears: −5;
- the Suite (Bedroom + Bathroom + Closet, touching): +15 Comfort × 5.0 = +75, and +0.5 Charm × 118 Comfort = +59.

So +134 of the +139 is the Suite, which the card never mentions. Of the Closet's 19 legal spots that week, 7 completed the Suite (+110 to +139) and 12 scored +5 or worse. The screenshot's spot, (15,16), was +128: the Bathroom drops 5→3 because the Closet blocks its view, which turns off Feng Shui's +50%.

**The Garage, −48 (week 14).** It was the only legal spot that week, at (11,18), the top of the Driveway beside the Living Room.
- The Garage itself: +11 (1 a week, +50% Feng Shui, × 5.5).
- The Living Room drops 10→5: the Garage clears the Tree at (12,18), which the Living Room counted as a view. That's −28, the "−5" badge in the screenshot.
- Cozy turns off: the Garage is a room touching only one other room ("9 of 10 rooms touch 2+"). −0.25 Charm × 125 Comfort = −31.
- Loud plays no part. In week 9 the Garage had two spots (−14, −23), in week 24 one (−97).

**"It says garages can be placed next to the street."** The card says "Must be built touching the street or a Driveway". It leaves out that a Garage is a room, so it must also connect to the house, and the street itself lies off the lot. Checking every spot in rows 20–23 in week 14: 184 "Rooms must connect to the house", 108 "That's off the lot", 68 occupied, 12 boulder, 12 "must touch the street or a Driveway". In the sim, 78% of Garage offers have no legal spot at all, and greedy builds 0.04 Garages a run. It isn't a bug, but the card reads as if it were.

**The Home Office, +54 against +36 (week 23).** The whole gap is the Country Living blueprint you bought at shop 4: every piece gets +1 per touching Tree tile, up to 3.
- At (15,13): (2 a week + 3 Trees + 1 Good Bones) × 1.5 Feng Shui = 9, × 6.0 Charm = +54.
- At (14,13), right above Grandma's Room: (2 + 1 Tree + 1) × 1.5 = 6, so +36.
- Under one roof held at both (fill 62%→65%, box 8×8). So the poke-out pays because of how Country Living counts Trees, not because of the Office.

**The Hallway, +30 (the same week).** The same Tree bonus, on the Hallway itself (3 Trees × 1.5 = 5 points). It linked nothing: the only room it touched was Grandma's. In your four Hallway weeks there were 153 legal Hallway spots; 18 were positive, every one from Country Living, and a link never paid once. The glossary's "A Hallway earns nothing itself" is false under Country Living.

**Soundproofing, worth 0 everywhere.** Only the street, the Garage, the Playroom and the Pool are Loud. Your house had none and never touched the street. The Nursery is tagged Quiet (and Kid). With Soundproofing added to the hand at every week from 2 to 28, its best install would have gained 0 every time. In the sim it's bought 2 of 122 times offered, and it pays well (+117 on average) in the rare house with a Loud piece.

**The Fence along the street, 0 (week 21).** Your 8-tile Fence ran along row 23, the street row. It earned nothing because it didn't close a pocket: a fenced yard must be a closed area of 10+ tiles between Fences and the house that doesn't reach the street, and yours stayed open at its ends. That's also why "A fenced yard" stayed at 0 of 10. A front picket fence along the street is the most house-like fence there is, and today it pays nothing on its own.

**The Remodel Plans: Full House.** *Correction to what I told you mid-session:* they weren't the General Contractor's. They came from the Old Shed you demolished in week 1, which pays a random tool (one of 13). Full House needs one of each of the nine core indoor types, a Garage and a Hallway among them, so the tool was close to dead from the start. Greedy completes Full House in 3% of runs, no earlier than week 24.

**Renovate (Q7).** It isn't demolition. When a room type is at its checklist ceiling (you have your one Kitchen, or two Living Rooms), a spare card of that type can level up the existing room in place: +4 Comfort a level, up to 2 levels, shown as stars. You got 4 chances:
- week 7, a Kitchen, in a hand you rerolled away;
- week 26, an L-Kitchen: +56, a tie with the Lawn you played;
- week 27, a Living Room: +87, better than the Patio's +75;
- week 28, a Kitchen.

Nothing on a card says it can renovate. The option appears only after you pick the card up, as dashed outlines on the rooms.

---

## 3. Title screen

**Findings**
- The houses are LimeZu's Modern Exteriors villa sprite (one design, five colors). The game has no Porch, Deck or Balcony piece; the nearest are the Patio and the Sunroom.
- **The car really does drive backwards.** The sprite faces left (headlight and sloped hood on the left), the art manifest wrongly notes it as "facing right" (`art/limezu/ui.json:30`), and `title.css` drives it left to right.
- **The little roof** is a gable baked into the villa over the porch's plank deck. All five color variants have it, so swapping variants won't remove it. The art pipeline's `compose` op (`scripts/cut-art.ts`) can paint it out with plank texture from the same sprite, with no new art.
- **The dangling chains:** each plank hangs from chains 12 art px in from its edges. The How to play/Settings pair (~205 art px) is wider than Start (150), so the pair's chains fall outside Start and end in the air.
- **The credit:** both LimeZu licenses say only "Credits required (limezu.itch.io)", with nothing about where. How to play already has a Credits section linking to limezu.itch.io, and CREDITS.md has the full list, so the title footer's credit can go. Amend D-057's title note (decisions.md, "credited, with a link, on the far sidewalk") in the same PR.

**Proposals**
- Quick fixes: flip the car (`scale: -1 1` on `.title-car`, and fix the manifest note); move the pair's chains to 25% and 75% of its width (`.rider-pair::before { left: 25% } .rider-pair::after { right: 25% }`), which lands them under Start; drop "art by LimeZu" from the footer (keep "A game jam entry · theme: It's a house", or drop the footer).
- The porch, three looks, all composed from the villa's own pixels:
  - **Look 1:** no gable; a flat porch roof that is also the balcony's deck, on the existing posts. The safest.
  - **Look 3:** the same, with the door recessed under the balcony (a shadow band).
  - **Look 2:** a shallow pitched porch roof across the front on posts. The most realistic, the most trial and error.
- Subtitle candidates. My pick is the first: plain, warm, and understated like "It's a house."
  - "Build someone a house, one piece a week."
  - "One house. One client. One piece a week." (the title investigator's pick: punchy, but still a rules summary)
  - "A house, built one piece at a time."
  - "Someone needs a house. Piece by piece."
  - "Every week, one piece. Every run, one house."
- A Porch or Deck card: it fits the title, the "houses that look like houses" goal, and the yard-pack idea (a Deck pack clicked out along the outside walls would turn the notches that read as clutter into architecture). It's content work (a new piece, a street-side rule, art), so it belongs in the content brainstorm, not the fix PR.

## 4. The left column and the board's chrome

**Findings**
- **Overflow is a CSS bug.** The kit's `.btn` never wraps and Inspect's Use and Sell buttons have no max-width, so "Use Remodel Plans: Full House" runs past the panel. The investigator measured about seven tool names overflowing a 280 px column, and the four Remodel Plans even at 404 px (not re-measured); "Sell for N budget" overflows at 280 px too.
- **Inspect only follows the hover,** and with nothing selected it gets just 80 UI px while the checklist takes the rest. Reaching its scrollbar means crossing other tiles.
- **A click on a placed piece with nothing selected does nothing today,** so it's free for a pin. Every play mode already holds its preview after its first click, so there's no conflict.
- **The client's plank has no room for a collapse caret** at 280 px (the Hendersons' and the Count's names take 216–218 of its 228 px).
- **The arrival banner is the milestone banner** in a tan plank instead of a gold ribbon: same spot, same stamp, same 2.2 s, same chime. That's why it doesn't stick in memory.
- **The car parks on the oldest Driveway piece,** so an extension toward the house never gets it.

**Proposals**
- Quick fix: `max-width: 100%; white-space: normal` on Inspect's Use and Sell buttons, and shorter labels ("Use it now", "Sell for N" with the coin).
- **Click to hold:** with nothing selected, clicking a placed piece pins Inspect on it. While held it also takes the column's room (the layout used while a play is looked at). It lets go on Esc, on a second click, on clicking open ground, or on a pin button on the plank. Better than a hover delay or holding Shift.
- **Fold the house rules into one row** ("House rules ✓5/7"), open on a first visit and opening by itself when a play flips a rule, instead of collapsing the whole client panel. It reuses D-109's fold code, so it fits one small UI PR with one verification round.
- **An arrival as a doorbell:** a card that slides in with the member's name and their room's art, a "ding-dong" at the front door, and a sound of its own. In the juice PR.
- **The car:** park at the end nearest a Garage or the front door, and slide there when the drive grows (about 10 lines plus a tween). You said either way is fine, so this is your call.

## 5. Change orders

**Findings**
- **The pool is tiny by construction:** 12 orders in the game, 2 generic (Working from home, Heat wave) and 2 per client, so each client draws from 4, and a run offers 3 (after milestones 2, 4 and 6).
- **The pick is uniform,** not "own orders first" as D-109 and a code comment say.
- **The last offer must be a phase effect.** The Barkers, Juniper and Dale have no phase effect of their own, so after milestone 6 they can only get Heat wave, and if Heat wave came earlier, nothing. Of greedy runs that passed milestone 6, no third order came in 44–50% for the Barkers and Juniper (42% for Dale), against 14–16% for the Hendersons and the Count.
- Over 200 seeds per client, greedy saw 23–29 distinct offer sequences.
- **Wording:** "It's coming either way: it can't be declined" is a hard-coded line in `ChangeOrderScreen.tsx`; the missing Decline button already says it. "Entertainer pays +100% more" says double twice. "For the next phase" repeats the Until row.

**Proposals**
- Quick fixes: drop the footnote; "The Entertainer pays double"; drop "For the next phase"; correct D-109's "own first".
- **The easter egg, if you want one:** a flavor line on about one phase effect in three, picked by a UI-only hash of the seed and the order, so replays never change. Samples:
  - "No takebacks. The paperwork is already stapled."
  - "The clipboard has spoken."
  - "Signed in pencil, but the pencil is very firm."
  - "The foreman has read it and gone to lunch."
  - per client: "The Count has decreed it."
- **Grow the pool to about 8 per client:** 3–4 of their own, including at least one phase effect each, plus 4–5 generic. Pick weighted, own orders ×2. Optionally a rare tier: a big phase effect, even a rare Sparkle, which suits "rare ×Mult".
- New orders that change how you build for a phase, mostly expressible with today's data:
  - **Requests:** Room for the in-laws (a new Bedroom touching a Bathroom); Entertaining (a Kitchen touching a Patio); Curb appeal (a Fence or Flower Bed by the street; check the selector); Remodel the kitchen (renovate the Kitchen: needs a level condition, and it would also teach Renovate).
  - **Restrictions:** No new rooms this phase (build outward); Pause the garden (no yard pieces).
  - **Phase effects:** Cold snap (Sunny rooms +100%, Pools earn nothing); Power outage (Loud pieces earn nothing, Dark rooms +50%); Rainy season (Wet rooms and yard pieces +50%); Open house weekend (a ×Mult in the phase's last week).

## 6. House rules

**Findings**
- Every client gets the same seven lines (`houseRules()` in `house-rules.ts`), differing only in the Bedroom ranges and Juniper's room cap.
- The sim says four do most of the work: One Kitchen, the Bathroom ratio, Under one roof and Cozy. Room for everyone and a tidy yard steer less.

**Options**
- **(C) Display only, now:** the one-row fold in §4. It answers the space complaint and changes no rules.
- **(A) Four shared plus three per client,** one slot each in household, shape and yard. For example:
  - household: "The Count's quarters" (a Library, at most one Living Room) for the Count; "A place to work" for Dale;
  - yard: "A wild garden" (Trees and Flower Beds, no Fences) for Juniper and the Count, and "No clutter" (at most 3 yard pieces) for Dale.
  - This changes Accepted D-101 and needs a sim check per client. Keep a repeat brake in every client's yard slot, or the tidy yard's job is lost.
- **(B) Keep seven,** with in-voice variants of the same rule per client. Cheaper, but less different.

## 7. Hallways

**Findings**
- **The link rule is already Combolands' rail rule** (D-046: every room along a Hallway counts as touching every other).
- **The trouble is that a link is worth almost nothing.**
  - Few room pairs pay for touching, and their bonuses are small: Bathroom +3 for a Bedroom (once), Kitchen +2 per Dining Room, Dining Room +50% to a touching Kitchen or Living Room.
  - A sensible player already puts those pairs side by side, and a link brings the penalties too.
  - A Hallway costs a whole week and often a checklist line: 22 of 37 spots in week 9 lost Under one roof.
- **Sim (200 greedy runs):** a Hallway was in hand in 14.6% of weeks and played 0.28 times a run (6.7% of offers). When played, its value nearly always came from finishing a set (Full House) or turning on a house rule, not from link points.
- **Experiments** on 100 seeds, with the content changed in memory:

  | Variant | Hallways a run | Greedy wins | Mean score |
  |---|---|---|---|
  | Today | 0.25 | 49% | 20,368 |
  | A pack alone (1–5 tiles) | 0.32 | 49% | — |
  | +2 Comfort per room along it, up to 4 (an existing effect) | 1.52 | 54% | 22,740 (+11.6%) |
  | Pack and pay | 1.83 | 54% | — |

  - With the pay, Under one roof held in 79 houses of 100 (73 today) and Cozy in 82 (75).
  - The best Hallway plays in your four Hallway weeks went from 0/28/30/31 to 30/66/48/62.
  - The pack-only row wasn't re-checked by the reviewer; the pay row was.

**Proposals**
- **Step 1 (an afternoon, then a target re-fit):** the Hallway pays +2 Comfort per room along it, up to 4. It's an existing effect, so no new rules code. Card: "Links the rooms along it. +2 Comfort per room along it (up to 4)." Playtest whether a hall in a sensible spot now feels rewarding.
- **Step 2 (a day or two):** the Hallway becomes a D-106 pack of up to 6 tiles, clicked out like a Fence; the Long Hallway card retires. Its complexity drops 3→2 so a spine can come early. It needs corridor art for L and T shapes, door marks on the ghost, and a hall planner for the sim's bots. A pack without the pay changes almost nothing, so the pay comes first.
- **Later, if halls still feel flat:**
  - a "Bedroom wing" set (2 Bedrooms, a Bathroom and a Hallway, connected), or a family house rule "every Bedroom reaches a Bathroom, touching or along a hall";
  - for planning ahead (Q8), member rooms that earn more when built off a hall, with halls allowed to stub out into open ground to reserve the spot.
- **Watch:** with the pay, a hall could become filler played for points; Under one roof is the brake, so check the glance test.

## 8. The weekly draw

**Findings** (600 greedy runs on held-out seeds, first hand of each week)

| Phase | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| A hand holds any room | 96% | 77% | 70% | 62% | 63% | 62% | 60% |
| A hand holds a room the checklist still needs | 98% | 76% | 40% | 19% | 12% | 7% | 5% |
| Layout cards' share of offers | 33% | 35% | 45% | 51% | 51% | 52% | 53% |

- **From phase 4 the pool is 32% rooms, 32% yard, 7% Hallways, 11% outbuildings, 18% fixtures.** Fence and Driveway (weight 20 each) are 14% of it.
- **Eight weak types take about 29% of offers:** Fence, Driveway, both Hallways, Garage, Doghouse, Sapling, Greenhouse. Each is picked 23% of the time or less.
- **The Hendersons' +100% on Fences** makes the Fence 12% of their pool: it was in 7 of your 27 hands and taken once (the street Fence that earned 0).
- **Dead hands are rare; weak hands aren't.** 6.2 dead cards a run (8% of offers), and the free redraw fired twice in 600 runs.
- **Rerolls aren't the lever.** You used 4 of 14, none after week 7, and greedy uses about 0.5 a run. A reroll redraws all three cards blind, so it can't target what's missing.
- **Pool growth dilutes every card.** Today a plain card shows in about 10% of hands; double the content and that halves.
- **The Landscaper** is close to the General Contractor on held-out seeds: 42.0% against 44.5% wins (paired, n=200). D-109 had 39.7% against 41.5%, with the Architect at 45.5%. The 31% figure from one investigator came from the targets' own fit seeds. So the problem is its pieces: a Sapling earns about 50 Wow a copy (a Flower Bed 440–590), and a Fence earns 0 until a yard closes.

**Candidates for the brainstorm you suggested**
- **Rooms 3 + Layout 2, play one card from either** (your idea).
  - It guarantees a room and a layout option every week, and it's the only clean way for a yard crew to draw more yard without starving rooms, which D-109's sim saw.
  - Each row gets its own draw stream key, so replays stay exact.
  - Costs: five cards to read, a right column that needs compact cards, and Fence/Driveway weights that need cutting inside a 2-card row.
- **Rooms 3 + one standing Layout slot,** which stays until played (Castles of Mad King Ludwig's hallway supply). Less reading, less variety.
- **Packs that grow your pool:** after each milestone, pick 1 of 2 themed packs that join your draw (Islanders' packs, Combolands' guilds). The best answer to "lots of buildings", but another decision between phases.
- **Targeted rerolls** ("Rooms or Layout?"), and redrawing a card that has no legal spot. Cheap, but they don't scale.
- **Recommendation:** hold the session after the Hallway and bigger-room decisions, since they decide what a Layout row holds. Meanwhile the biggest lever on how hands feel is card value.

## 9. Bigger rooms ("Extend a room") and Renovate

**Findings**
- **Extending is cheaper than its Parked note assumed.** The engine already supports one room with a bigger outline: the per-piece `shape` added for packs feeds the layout, the walls, the furniture and the ghost. An extended room can be the same piece, uid kept, with the combined shape: one wallpaper, no inner wall, its fixture and level kept.
- **A prototype on your run** (the room given the combined shape in memory):
  - **The Bathroom, week 11** (screenshot 6): placed alone, +41, and it turned on "A Bathroom for every two Bedrooms". Merged, −5, or +28 with a Renovate level, and the rule stays unmet. Merging has to be a choice, not automatic.
  - **The Home Office, week 25:** +97 alone; merged +78, or +141 with a level.
  - **A Living Room, week 27:** merged +37, or +125 with a level, against the Patio's +75 and Renovate's +87.
  - A room card had a spot to extend in 17 of your 28 weeks, against 4 weeks with a Renovate chance.
- **Odd shapes hurt:** an L-Kitchen against the Kitchen broke Under one roof (−135). That argues for rectangles only, which also looks right.
- **Bigger rooms would look sparse.** Furniture lists are 2–6 items, so bigger rooms need a few more pieces. Only the Bathroom lacks sprites (a bathtub and a sink); LimeZu's interiors pack has 160 bathroom singles.

**Proposal: one "improve a room" system**
- A spare room card dropped beside a room of its type extends it; dropped on it, it renovates in place. Both share Renovate's +4 a level, the 2-level cap and the stars.
- Extending is an explicit choice: the ghost shows both outcomes ("Extend → Full Bath ★ +28" / "Own room +41"), and a key flips between them.
- One extension per room, rectangles only, counted once everywhere, allowed below a type's limit (Bathrooms and Home Offices have none).
- **First types:** Bathroom → Full Bath, Bedroom → Primary Bedroom, Living Room → Great Room, Home Office → Study. Kitchen and Dining Room stay on Renovate.
- **Card chip:** "Extends", lit while the house has a room it could join.
- **Renovate, now (in the fix PR):** a "Renovate" chip on cards that can, a first-time hint, and wording that says "in place; nothing is torn down". Optionally rename it Upgrade.
- **Cost:** rules and sim about M, UI about M, art S: roughly 3–4 days (an estimate).

## 10. Range

**Findings**
- **In Combolands and Islanders, each building has its own area,** drawn while you place it, and the fun is sliding it to cover more. Combolands also has range extenders (the Town Bell gives adjacent buildings +1 range), and rails count everything along them as adjacent.
- **Applied blanket to the house, range doesn't do what you'd hope:**
  - **Counting lot features within 2 tiles** removes your office poke-out (both spots +54). But it looked like a sizable buff (greedy 48% → 59%, n=80, noisy), and houses got no more compact.
  - **Views are already near-universal:** 72% of rooms touch one, and 81% would within 2 tiles.
  - **Noise has nothing to act on:** houses average 0.04 Loud pieces.
- **Reach through the house is the range that matters indoors:** steps through rooms and hall links. Bedrooms reaching a Bathroom go 72% in 1 step, 85% in 2. It shares the Hallway's link machinery, so halls become the range extenders.

**Proposals**
- **First step:** an optional `range` on neighbor and aura effects, used by two or three yard pieces, with the area drawn while placing and on hover:
  - a Fire Pit: "Social yard pieces within 2 earn +50%";
  - a Treehouse: "+2 per Kid room within 3";
  - a Birdhouse: "+1 per Tree within 2".
  - Ask at the next playtest whether sliding a piece to cover more was fun.
- **Then:** a Fireplace that warms rooms within 2; reach-through-the-house for Bathrooms and Bedrooms together with the Hallway redesign; extenders such as Garden Lights (+1 range), a Baby Monitor, an Open Floor Plan.
- **Not yet:** range on views, Trees or noise.
- **The poke-out problem is Country Living's per-tile Tree count.** Fix it in the balance pass: count the woods once per piece, or cap it, and leave connectors out of "every piece" grants.

## 11. The lot: creeks and the sun

**Findings**
- **Creeks are on 71% of lots** (`creekPct: 70`); D-049 chose "a creek on most lots" on purpose, to make siting a decision. A pond is on every lot.
- **The sunny side is a 4-row band on the top, left or right edge,** about a third each, picked blind and never on the street side.
- **The house is often far from it:** in the lot investigator's 120 greedy runs, within 1 tile only 39% of the time and more than 8 tiles away 34% of the time (not re-checked).
- **Sunny content earns under 1% of Wow** (Herb Garden, Sunroom).
- **The job board shows a lot only as its map;** a creek, or the sun's side, could be listed as traits.

**Options**
- **Creeks:** about 20–25% as a special lot with its own payoff, or about 40%. Either changes Accepted D-049's wording and needs a target check.
- **Sun A, the house's sunny face:** the lot has a sun direction, and a room is Sunny when its outside wall faces it with open ground in front. This is passive-solar design: living rooms want the sunny side, bedrooms don't mind, the Count hates it. It makes sun matter inside every house rather than at one edge of the lot. About a day or two.
- **Sun B, shade:** Trees and the house cast shade, so building changes the sun. The richest, and the costliest to preview and to read.
- **Sun C, a nearer patch:** a sunny patch near the build zone, two to choose between. Lot generation only, so the cheapest.
- **Whichever:** sun needs more payoffs (a Sunny-room set, a Greenhouse that wants it), or it stays at 1%.

## 12. Balance audit (for the pass after the milestones)

- **Weakest:**
  - Hallways: earn nothing in 81–90% of the weeks they stand.
  - Garage: no legal spot on 78% of offers.
  - Soundproofing: 96% of offers have no play worth more than 0.
  - Sapling: about 50 Wow a copy.
  - Greenhouse, Doghouse, Herb Garden: under 2 a week.
  - Bunk Beds: 65% of offers lose Wow.
  - Kitchen Island and Skylight: about a third of offers at 0 or less.
  - Fence: high-variance rather than weak, 0 until a yard closes.
- **Strongest:**
  - Library: 2,923 Wow a copy.
  - Living Room 2,125; L-Kitchen 1,751; Kitchen 1,587; Bedroom 1,545.
  - Fireplace, and Chandelier at +334 an install.
- **Rules that reward un-house-like layouts:**
  - Country Living's per-Tree-tile count (poke-outs);
  - the Garage at the end of the drive losing Cozy;
  - a front fence paying 0.
  - A lens for the pass: the realistic placement should never be worse than the weird one.
- **Full House** needs the two weakest cards. Consider 7 of 9 types, and leave Remodel Plans: Full House out of the Old Shed's random tool.
- **The Loud system is nearly empty.** Make one decision covering the Garage (a detached garage by the street or a Driveway?), Cozy (skip utility rooms?) and the Nursery (Loud at night, so a Soundproofed Bedroom beside it pays?).
- **The shop bot never buys** Solar Panels, Open Concept, Storage Unit or Tool Belt. That's a bot gap more than weak goods.
- **Before tuning:** add per-card "best delta when offered" and "delta when taken" to the sim report, and judge on held-out `check` seeds (the default `sim` seeds are the targets' fit seeds).
- **Afterwards:** one target re-fit for all the content changes together (Hallway pay, extending, range, the creek rate), not one per change.

## 13. Showing where Wow comes from

**Findings**
- `preview()` already returns everything: each changed piece's lines, the sets gained and lost, the checklist lines gained and lost, the cleared Trees.
- Inspect shows the inputs ("Completes Suite: +15 Comfort, +0.5 Charm"), but never what each is worth in Wow at this week's Charm, nor why a neighbor changed.
- The ghost label shows the net (−48) but not its biggest part (Cozy, −31).

**Proposals, lightest first**
1. **Each part's Wow in Inspect:** "Completes Suite · +134 Wow", "Turns off Cozy · −31 Wow". The rules attribute the parts; the UI still scores nothing.
2. **Why a neighbor changed:** "Living Room 10→5 · loses a Tree", "Bathroom 5→3 · loses its view".
3. **Set chips on cards:** "Suite", with members in the tip ("Bedroom + Bathroom + Closet, touching"). Full House as a progress count in the score panel ("7/9") rather than a chip on nine cards.
4. **The ghost names its biggest loss:** "▼ −48 Wow · Cozy off".
5. **Only if 1–4 aren't enough:** light up the placed pieces a held card would combo with (Combolands' highlight), then maybe a ★ on spots that complete a set (as D-107 stars a fixture's best host). No numbers on tiles.

One chip budget on the hand card covers Renovate, Extends and set membership, in that order of priority.

---

## 14. How the proposals fit together

- **Hallways and range share one room graph:** a hall's link makes rooms one step apart, and reach-through-the-house counts steps on that graph. Tile range for yard pieces is separate.
- **Extend and Renovate become one "improve a room"** idea with shared levels and stars.
- **The draft structure waits** on Hallways and Extend, since they decide what a Layout row holds.
- **The house rules:** the fold (display) can ship now; making them client-specific (content) needs your OK on D-101. Fold only the shared core, so flavored lines stay visible.
- **The Loud system:** the Garage, the Nursery's tag, noise range and Soundproofing are one decision, made with a sim A/B before tuning Soundproofing's numbers.
- **The yard crew needs one lever, not two:** a Layout row that draws more yard, or yard pieces with an area (a Fence that boosts what it encloses, a Fire Pit's radius).
- **Card chips** need one budget (see §13).

## 15. Suggested order

1. **A quick-fix PR**, no design questions:
   - the title car, chains and credit;
   - Inspect's button overflow and shorter labels;
   - change-order wording, and D-109's "own first";
   - the Garage's requirement text ("Must touch the house, and the street or a Driveway") and a specific rejection message;
   - Renovate's wording, a Renovate chip on cards, and a first-time hint;
   - the glossary's Hallway line;
   - Soundproofing's text naming what's Loud.
   - The subtitle and the porch look go in once you pick.
2. **A small UI PR:** click-to-hold Inspect and the house-rules fold row. One verification round.
3. **The Hallway experiment:** step 1's pay, a target re-fit, a short playtest.
4. **Design sessions:**
   - **Layout:** Hallway packs, Extend/Renovate, reach through the house, the Garage and Loud, a Porch/Deck.
   - **The draw:** the one you suggested, after Layout.
   - **The lot and the sun.**
   - **Variety:** change-order pool, new orders, client-flavored house rules.
5. **The juice PR** (already planned): the arrival as a doorbell, the car driving up.
6. **The balance pass** after the milestones (§12), then one re-fit.

## 16. Questions

For the fix PR:
1. Subtitle: "Build someone a house, one piece a week." or another from §3?
2. Title porch: Look 1 (flat deck carrying the balcony), Look 3 (recessed entry) or Look 2 (a porch roof on posts)?
3. "It's coming either way": drop it, or keep a rare flavor line (about one phase effect in three)?
4. Inspect and the checklist: click-to-hold plus a one-row house-rules fold, or collapse the whole client panel?
5. The car: drive up to the house end when the drive grows, or stay where it first parked?

Bigger calls:

6. Hallways: try step 1's +2 per room along it as the first experiment? Should a hall be allowed to stub out into open ground, to reserve a spot for an arrival?
7. Bigger rooms: when a card touches a room of its type, join by default or stay separate by default? Rectangles only? Keep Renovate beside Extend, and rename it Upgrade?
8. Garage: may it stand detached by the street or a Driveway, or stay a room that joins the house?
9. While holding a card, how much help: text only (§13's 1–4), plus lit partners, or plus a star on set-completing spots?
10. House rules: change D-101 to four shared plus three per client, or keep seven and only fold them?
11. Change orders: keep the last offer phase-effects-only? Add a rare tier?
12. Lot: creeks about 20–25% and special, or about 40%? Sun A (a sunny face), B (shade) or C (a nearer patch)? A pond on every lot?
13. Should the Nursery be Loud at night, so a Soundproofed Bedroom beside it pays?
14. The balance pass: should every piece earn something in most houses, or are some deliberate specialists?
15. A Porch or Deck card in the game, eventually?

About your run:

16. Weekend Crew: bought at shop 4 and never used. Saving it, or unclear when to use it?
17. Working from home: accepted, then missed (the Home Office came in week 23). Did you notice the miss?
18. When you sold the Full House plans, did you know Full House needs a Garage and a Hallway?

## 17. Your answers (2026-11-09)

- **Subtitle:** leave it as it is for now.
- **Porch:** Look 1, the safe one: the gable is painted out, and the porch roof is a flat deck under the balcony. It's in the quick-fix PR.
- **Inspect:** click to hold, plus the house rules folded into one row. That's the small UI PR.
- **Bigger rooms:** maybe a "fusion" ability, like demolish, reroll or ban, or a shop item. It needs a deep dive of its own, so it went to the layout session.
- **The Garage:** detached Garages, maybe with sidewalk or stone-path tiles beside the Driveway's. Not certain; also with the layout session.
- **Legibility:** no highlights on combo partners, but less guesswork: "+1 every week" says little when other systems make it +150. It has its own deep-dive session.
- **The Hallway experiment:** waits for the layout session's report.

---

## Appendix: scratch data

Scripts and outputs are in this session's scratchpad (temporary; it may not outlast the session): `/private/tmp/claude-501/-Users-sam-Desktop-Code-house-game--claude-worktrees-title-screen-feedback-012f65/eb535fc1-5ed8-4fc9-9a83-64e64b38e5a7/scratchpad/`
- `harness.ts`: replays the run code; `timeline.txt`: each week's hand, play and preview; `wf-result.json`: every investigator's full result and the reviewer's checks.
- Per area: `hallways/` (variants.ts: the in-memory Hallway A/B), `merging/` (userext.ts: the Extend prototype), `range/` (ab.ts and a patched rules copy), `draft/`, `scoring/`, `balance/` (probe.ts: per-card deltas), `lot/`, `changeorders/`, `review/`.
