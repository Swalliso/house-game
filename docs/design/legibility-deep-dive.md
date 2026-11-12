# Score legibility: a deep-dive

> **Archived 2026-11-11.** Saved during branch cleanup from a session worktree where it sat uncommitted. The text below is as written on 2026-11-09; its status lines describe that day. D-122 (the legibility slice) was built from it.

**Date:** 2026-11-09. **Build:** develop at 0b9e9db, playtest 4's build. **Run:** seed `zcndxm`, the Hendersons, the General Contractor (won 32,057 against 30,625).

**Status:** research and design only. No code and no decision-log entry changed. This file is uncommitted: commit it with the first PR that acts on it, or delete it.

**The question.** A card's text says little about what playing it earns. In playtest 4 a Closet that says "+1 every week" paid +139 Wow a week. You said:

> "it feels like there's a lot of guesswork currently, and just looking at something that says +1 per week on the card doesn't really tell you much when there are all these other interactions and systems behind the scene that can turn that into something like 150 per week instead."

**Limits you set:** don't hand-hold, but improve; and don't light up the pieces a held card could combo with. A house rule from CLAUDE.md applies too: the UI never computes scores, so every number below has to come from the rules.

**How this was made:** the run code replays exactly on this build. For every play, a script split the change in the week's Wow into its causes (method in the appendix). I read the UI code for what each screen shows, and one research agent surveyed other games. Its findings are marked by confidence.

---

## 1. Audit

### 1.1 Where a play's Wow comes from

A week's Wow is Comfort × Charm (× Sparkle). A play's change splits exactly into two kinds of part:
- **Comfort parts**, each worth its Comfort × the old Charm. These are the card's own lines, boosts such as blueprints, neighbors that earn more or less, and a set's Comfort.
- **Charm parts**, each worth its Charm × the new Comfort. These are a set's Charm and checklist lines turned on or off.

The Closet's +139 is +15 Comfort × 5.0 = +75 and +0.5 Charm × 118 Comfort = +59 from the Suite, plus its own +10, less a Tree a Bedroom lost (−5).

**Across the run's 28 plays, only 15% of the Wow they moved came from the played card's own lines.** "Moved" counts gains and losses alike.

| Source | Share of the Wow moved | Net over the run's plays |
|---|---|---|
| Checklist lines turned on or off (house rules and the client's wishes) | 24% | +240 |
| Blueprints (Country Living, Feng Shui, Good Bones) | 21% | +386 |
| Sets completed | 16% | +296 |
| **The card's own lines** (at the week's Charm) | **15%** | +266 |
| Terrain (Trees cleared, views lost) | 7% | −80 |
| Neighbors earning more or less | 6% | +91 |
| Heat wave (a change order) | 5% | +94 |
| The Hendersons' tastes | 3% | +47 |
| Fixtures | 3% | +46 |

No ×Mult source came up in this run, so Sparkle never moved.

**The plays where the card's own text and the result differ most** (Wow a week; "own" is the card's lines × the week's Charm):

| Week · play | The card says | Own | Paid | Where the rest came from |
|---|---|---|---|---|
| 7 · Dining Room | "Touching Kitchens and Living Rooms earn +50%" | 0 | **+179** | Entertainer +137; Cozy on +17; Kitchen beside the Dining Room on +17; the Kitchen earns more +8 |
| 10 · Closet | "+1 every week" | 5 | **+139** | Suite +134 (+75 Comfort side, +59 Charm side); Feng Shui +5; a Bedroom loses a Tree −5 |
| 17 · Grandma's Room | "+3 every week, +2 per touching Bathroom…" | 26 | **+111** | Room for everyone on +43; Feng Shui +21; Country Living +16; a Bedroom +5 |
| 25 · Home Office | "+2 every week…" | 12 | **+97** | Cozy on +121; Trees it builds over cost the Patio −30 and the other Office −12; Good Bones +6 |
| 19 · Birdhouse | "+1 per touching Tree (up to 3)" | 17 | **+97** | A tidy yard on +48; Country Living +17; Feng Shui +17 |
| 28 · Lawn | "+1 every week, +1 per touching Lawn" | 13 | **+100** | Heat wave +25; the Lawn beside it +25; Country Living +13; the Hendersons +13; Feng Shui +13 |
| 14 · Garage | "+1 every week" (and Loud) | 6 | **−48** | Cozy off −31; the Living Room loses a Tree view −28 |
| 22 · Living Room | "+2 per touching view (up to 3)" | 38 | **+45** | +113 of gains hide **Cozy off −68** |
| 23 · Home Office | "+2 every week…" | 12 | **+54** (+36 one tile left) | Country Living: 3 Trees +18 here, 1 Tree +6 there; Feng Shui +18 / +12 |
| 23 · Hallway | (links rooms; earns nothing itself) | 0 | **+30** | All blueprints: Country Living +18, Feng Shui +12 |

**Upside the hand never showed.** These are weekly numbers only, so they leave out setup value (week 5's Kitchen set up week 7's +179). They aren't mistakes, but the hand gave no hint of them:
- **Week 5:** the Closet's best spot was **+69** (11 of its 16 spots completed the Suite). You played the Kitchen for +9.
- **Week 22:** 2 of the Bedroom's 12 spots completed a second Jack-and-Jill. The better one was worth **+269**, +200 of it from the set. You played the Living Room for +45.
- **Week 25:** a Bedroom spot was worth **+266** (Jack-and-Jill +316, less Under one roof −128). You played the Home Office for +97.
- Overall, in **10 of the 26 weeks with a play** the hand card whose own text promised the most wasn't the card that paid the most. You picked the better card anyway in 7 of them, presumably by sweeping the ghost over the lot. That sweep is the guesswork.

**Five patterns behind the surprises:**
1. **Sets and checklist lines are invisible on cards.** The three biggest gaps were sets (Entertainer, Suite, Jack-and-Jill), and no card names a set.
2. **Charm makes the same rule worth wildly different amounts.** A checklist line paid +2 Wow in week 2 and +121 in week 25. Jack-and-Jill paid +25 in week 3, and a second one would have paid +200 in week 22. Nothing on screen says what a rule or a set is worth now.
3. **A net hides its parts.** The week-22 Living Room showed +45; it was paying 68 a week to turn Cozy off. The week-25 Office showed +97; Cozy's +121 was paying for −42 of lost Trees.
4. **Run modifiers pay more than cards.** Country Living's per-Tree count explains both the Office's +54 against +36 and the Hallway's +30. The card can't say this, and the ghost doesn't either.
5. **Units are mixed.** The ghost speaks Wow; the badges on changed pieces speak Comfort. The Living Room's badge said "−5" while the Garage cost it 28 Wow.

Over the whole run, Charm did most of the work: under the tally's own layering, Charm from sets was 51% of the 31,195 Wow the weeks scored and Charm from checklist lines 32%. Comfort at ×1 was the remaining 17%, and the pieces' own lines alone were 3% (`house-systems-review.md` measured Charm's share at 73% for the median win). The cards speak only Comfort.

### 1.2 What the game shows today, moment by moment

**The card in hand** (`Hand.tsx`; hovering fills Inspect with the same text):
- *Shows:* name, picture, shape, a kind chip (Room, Yard, Hallway, Outbuilding), tag chips, effect lines generated from the data ("+1 every week"), notes on which lot features carry its tags or count as views, and a hatched "Nowhere fits".
- *Doesn't show:*
  - the sets its type belongs to (they're listed only in How to play);
  - the checklist lines it can move;
  - the run's modifiers that apply to it (Feng Shui, Country Living, the client's tastes, the crew);
  - Renovate (the quick-fix PR adds a chip);
  - what a Comfort is worth this week.

**The ghost while you choose a spot** (`Board.tsx`, `Inspect.tsx` PlacingInfo, `ScorePanel.tsx`, `Checklist.tsx`):
- *The board:*
  - the label: "▲ +139 Wow", the net change to this week's Wow, or "✕ reason";
  - each piece whose earnings change gets a badge with its **Comfort** change ("−5");
  - "+"/"−" marks on what helps or hurts the new piece, and "✕" on Trees it clears;
  - the members of a set it completes are outlined.
- *Inspect:*
  - "Closet earns 2" (Comfort), with its lines ("Every week +1", "Feng Shui +50%");
  - "Changes nearby: Bedroom 9 → 8";
  - "Completes Suite: +15 Comfort, +0.5 Charm";
  - "Turns on: Cozy (+0.25 Charm)", "Clears 1 Tree.", timers and budget;
  - the foot: "This week: 510 → 649 Wow".
- *The score panel:* "With this piece: Comfort 118 ▲16 × Charm 5.5 ▲0.5 = Wow 649 ▲139". Tall windows add the set list with a star on the new set, plus the checklist row.
- *The checklist:* it marks lines the play would turn on or off.
- *Doesn't show:*
  - what any part is worth in Wow (the Suite's +134);
  - why a neighbor changed ("loses a Tree view");
  - which part dominates;
  - a single unit for the board's numbers.

**After the play** (`director.ts`):
- *Shows:* the piece settles. Then the whole house's tally plays: every piece pops its Comfort in placement order; each set pops, a new one as "Suite!", with +Comfort and +Charm; checklist lines tick, "★ Cozy!" for one turned on and "✕ Cozy" for one turned off; then the +Mult goods, Sparkle, the multiply moment, the total, and the drain.
- *Doesn't show:* how this week differs from last week, or why. The new piece is one pop among 10–30. The tally speaks Comfort and Charm; Wow appears only at the multiply moment.

**Inspect on a placed piece** (`Inspect.tsx`):
- *Shows:*
  - "Living Room earns 10 a week" (Comfort);
  - tags with where each came from, breakdown lines, and "points × pct% = earned";
  - layout facts (exterior or interior, regions, view, Hallway links, fenced yard);
  - timers, its card text and its fixture.
- *Doesn't show:*
  - the sets it's in;
  - the checklist lines it holds up;
  - what it's worth to the house. The placed Closet "earns 2 a week", but removing it in week 11 would cost 144 Wow a week. Only the demolish tool shows that: its label gives the week's change, and Inspect lists the sets it would break, without a Wow figure for each.

**Elsewhere:** How to play lists the sets and their members, and the glossary explains the four score words. Fixtures already get values before you commit (D-107): the shop names the best host and its gain, and installing shows every host's gain with a ★ on the best. Pieces get only the net at the pointer.

### 1.3 The gap, in one line

`preview()` already has every input: each changed piece's lines before and after, the sets gained and lost, the checklist flips, the cleared Trees. The game shows those inputs in Comfort and Charm but never attributes the Wow. The card in hand shows only its own lines, which were 15% of the story.

## 2. How other games show combo value

The research agent's notes, with a few spot checks. H, M and L are confidence levels.

| Pattern | Example | What the player learns | What it costs discovery | Confidence |
|---|---|---|---|---|
| **Net preview at the pointer** | Islanders (a points popup and a range sphere before you place); Combolands (a point preview, added at launch on request); Open House today | Good or bad here, not why | None, but placement turns into sweeping the lot for the best number | M–H |
| **The formula visible, the total withheld** | Balatro shows the hand's type and its base Chips × Mult before you play, never the final score | The parts, with the payoff kept as suspense | Low; but players build calculators, and a popular mod adds the full preview. GMTK reads it as deliberate, quoting Soren Johnson that players "will optimize the fun out" | M–H |
| **A "Currently" line** | Balatro's growing jokers: "(Currently +12 Mult)" | What this card is worth in this run | None | M (wiki mirror) |
| **Numbers recolored live** | Slay the Spire's damage turns green or red under Strength or Weak; Marvel Snap's power | That the printed number has changed | None | L, unverified this session |
| **A cause list on demand** | Combolands' right-click detail panel; Marvel Snap's tap on power (unverified) | Why, when asked | None; totals stay at a glance | M / L |
| **A tally that shows each cause** | Balatro's jokers fire one by one; Combolands' trail along a chain | Cause, after the fact | None; surprise kept | M |
| **Neighbor tint while placing** | Combolands tints the surrounding tiles as positive or negative; Open House's +/− marks | What this spot touches | Little; only the spot in hand | M |
| **Partner highlights before you choose** | Backpack Battles draws lines to items a held one combines with | Where the combo is | High; it's the hand-holding you ruled out | L–M |
| **Every consequence shown** | Into the Breach shows every enemy action in advance; its developers would "sacrifice cool ideas for the sake of clarity every time" | Everything | Total; it works because the game is a puzzle | M–H |
| **Discover, then record** | Loop Hero's tile combos go unannounced; an encyclopedia records the ones found and how many are missing | What you've found | Kept, and rewarded | M |
| **Opaque by design** | Luck be a Landlord: no compendium; you learn the designer's mental map | Little | Highest; it draws real complaints | M |

**Combolands** (from `research.md`): its readability reviews are mixed. Players "win without understanding why", ask for clearer breakdowns, and find the text small. Its tools are the point preview, colored range and adjacency highlights, an overlay of last week's points, a right-click detail panel, a compendium (v1.0.5), and a combo animation. v1.0.7 took a confusing "counts as fish" line off a card.

**What this means for Open House:**
- **We already show the number Balatro withholds.** The net is on the ghost before you commit, so naming its causes costs no discovery: it explains a number you're already looking at.
- **The missing layer sits between the card and the pointer:** what the card plugs into. Balatro's answer is tags, "Currently" lines and a visible formula; Combolands' is categories plus partner highlights (ruled out).
- **One unit wins.** Balatro keeps its score readable as two numbers; ours is readable as an equation, but the parts of a play are in mixed units.
- **Learning across runs** comes from tallies with causes and from records (Loop Hero, Combolands' compendium), not from more previews.

## 3. Options

**Principles, from the audit and the research:**
1. Explain the number that's already shown before adding new numbers.
2. Speak Wow wherever a play's effect is shown. Comfort and Charm become the working.
3. A card may name what it plugs into, but the board never points at partners.
4. The rules attribute and the UI renders. The parts add up to the ghost's number exactly.

This builds on the playtest-4 findings' §13: its proposals 1, 2 and 4 are option A, its 3 is in B, and its 5 (partner highlights) is out.

### Option A: say why (lightest)

**What changes:**
- **The ghost names its biggest part:** "▲ +139 Wow · Suite", "▼ −48 Wow · Cozy off". When a positive net hides a big loss, the loss gets a line of its own.
- **Badges on changed pieces show Wow,** so they agree with the label. The Living Room's badge would read −28, not −5.
- **Inspect's placing view becomes a receipt:** one line per cause in Wow, biggest first, with the working under the big ones. It replaces today's separate set, checklist and "Changes nearby" notes.
- **Stakes in the tips:** the checklist's Charm row and each set's tip say what they're worth now ("each line ≈ +121 Wow a week").

**Mockups** (board labels in the pixel font; icons stand in where the font lacks ★, ✕, ▲ and ▼):

```
Week 10, the Closet at (17,16)                Week 14, the Garage at (11,18)

  ┌──────────────────────┐                      ┌──────────────────────┐
  │ ▲ +139 Wow · Suite   │                      │ ▼ −48 Wow · Cozy off │
  └──────────────────────┘                      └──────────────────────┘
  [Bedroom −5]   Suite members outlined         [Living Room −28]   ✕ on the Tree

Week 22, the Living Room at (19,13): a gain that hides a loss
  ┌──────────────────────┐
  │ ▲ +45 Wow            │
  │ ✕ Cozy off  −68      │
  └──────────────────────┘
```

```
┌ Closet ─────────────────────── +139 Wow ┐   ┌ Garage ─────────────────────── −48 Wow ┐
│ ★ Completes Suite                  +134 │   │ ✕ Turns off Cozy                   −31 │
│     +15 Comfort × 5.0 Charm = +75       │   │     −0.25 Charm × 125 Comfort          │
│     +0.5 Charm × 118 Comfort = +59      │   │     (9 of 10 rooms touch 2+)           │
│   Its own: 1 a week                  +5 │   │ ▼ Living Room loses a Tree view    −28 │
│   Feng Shui +50% (it has a view)     +5 │   │   Its own: 1 a week                 +6 │
│ ▼ Bedroom loses a Tree               −5 │   │   Feng Shui +50%                    +5 │
│ This week: 510 → 649 Wow                │   │ This week: 704 → 656 Wow               │
└─────────────────────────────────────────┘   └────────────────────────────────────────┘

┌ Home Office ─────────────────── +54 Wow ┐   ┌ Home Office, one tile left ──── +36 Wow ┐
│   Country Living: 3 Trees           +18 │   │   Country Living: 1 Tree            +6 │
│   Feng Shui +50%                    +18 │   │   Feng Shui +50%                   +12 │
│   Its own: 2 a week                 +12 │   │   Its own: 2 a week                +12 │
│   Good Bones                         +6 │   │   Good Bones                        +6 │
└─────────────────────────────────────────┘   └────────────────────────────────────────┘
```

**What the rules return:**

```ts
/** One cause of a play's change to the week's Wow. The rules attribute it; the UI renders it. */
export interface WowPart {
  kind: 'own' | 'boost' | 'neighbor' | 'set' | 'spec' | 'charm' | 'sparkle';
  /** Generated in text.ts: "Completes Suite", "Turns off Cozy", "Living Room loses a Tree view",
   *  "Country Living: 3 Trees", "Its own: 1 a week". */
  label: string;
  /** What it points at, for badges: a piece, a set instance's key, a spec, a modifier's source. */
  ref?: { uid?: number; setKey?: string; spec?: string; source?: ModSource };
  /** The working: its Comfort change and its Charm change (in hundredths). */
  comfort: number;
  charm: number;
  /** Its share of `delta`. A play's parts add up to `delta` exactly. */
  wow: number;
}

interface Preview {
  // … everything it has today, plus:
  /** Biggest first by size. */
  parts: readonly WowPart[];
}

/** What a Comfort, a checklist line, and each held set are worth this week, for the tips. */
stakes(state: RunState): { perComfort: number; perSpec: number; sets: readonly { key: string; wow: number }[] };
```

**How the rules compute it:**
- **Exact sums:** Comfort parts take the old Charm and Charm parts the new Comfort, as in §1.1, with a Sparkle change taking the rest. Integer math with largest-remainder rounding makes the parts add up to `delta` exactly.
- **Neighbor reasons:** diff each changed piece's lines before and after. `BreakdownLine.from` already names the pieces and lot features each line counts, so "loses a Tree (built over)" and "gains a Herb Garden next door +25%" come from data.
- **Cost:** the preview's before-tally is already cached with lines (`passTally`), so the extra work is arithmetic. If profiling says otherwise, `installGains` and the sim can skip it with a flag.
- **Tests:**
  - a property test that the parts add up to `delta` for random plays (beside the chaos suite's preview checks);
  - golden tests for the Closet and the Garage from this run;
  - text tests for the labels.

**Cost:** small to medium.
- Rules: about a day (attribution, neighbor reasons, text, tests).
- UI: about a day (the ghost's second part, the badges' units, the receipt, the tips), plus one verification round.
- Nothing changes in balance or the sim.

**What it fixes from playtest 4:**
- the Closet (the Suite is named), the Garage (Cozy and the Tree are named), and the Office and Hallway (Country Living's Trees are named);
- the week-22 Living Room's hidden Cozy loss.

It does nothing for the card in hand: the week-5 Closet and the week-22 and week-25 Bedrooms stay invisible unless you pick the card up and find the right spot.

### Option B: cards that know the house (recommended)

**Option A, plus two card facts.**
- **A set chip on room cards** names the sets the card's type belongs to. It's static membership only, so it never says where. Its tip gives the members, the rule ("touching"), whether the set can repeat, and what it pays now at your Charm and level.
  - The chip shares the card's chip budget with Renovate (the quick-fix PR) and Extends (if the layout session adds it). Their priority: Renovate, then Extends, then sets. If the row overflows, tags shrink to icons first, and two sets show as "Suite +1".
- **"In this house" lines** on the card's Inspect (hover a hand card) list the run's modifiers that can apply, each with its condition. These are the boosts you own but can't see from the card.

```
┌──────────────────────────────┐     tip on the chip:
│ 1  Closet               ▪    │     Suite: a Bedroom, a Bathroom and a Closet, touching.
│ [picture]                    │     +15 Comfort and +0.5 Charm every week: about
│ +1 every week                │     +134 Wow a week in your house now.
│ [Room] [◆ Suite]             │
└──────────────────────────────┘

┌ Home Office ─────────────────────────────────┐
│ +2 every week                                │
│ −2 per touching Loud neighbor                │
│ +1 budget every 2nd week                     │
│ In this house                                │
│   Country Living: +1 per touching Tree (≤3)  │
│   Feng Shui: +50% if it has a view           │
│   Good Bones: +1 a week it stands (≤10)      │
│ Click the card (or press 3), then point at   │
│ the lot.                                     │
└──────────────────────────────────────────────┘
```

**What the rules add:**

```ts
/** What a hand or reserve card plugs into in this run. Text from text.ts, numbers from stakes(). */
cardFacts(state: RunState, card: Card): {
  sets: readonly { id: SetId; name: string; members: string; repeats: boolean; worth: number }[];
  boosts: readonly { source: ModSource; text: string; when?: string }[];
};
```

- **Set membership** is a content lookup.
- **Boosts:** each active modifier's target is matched against the card. A tag or piece target "applies"; a property, region or neighbor target applies "if…". The text comes from the existing `modifierText` and `earnTargetText`.

**Cost:** medium. Option A plus about a day (rules half a day, UI half a day, and the chip row on short windows). Roughly 2.5–3 days in two PRs: A first, then the card facts.

**What it adds for playtest 4:**
- The week-5 Closet says "Suite" while your house already has a Bedroom and a Bathroom side by side.
- The week-22 and week-25 Bedrooms say "Jack-and-Jill · Suite", and the tip says Jack-and-Jill can repeat.
- The Office and the Hallway list Country Living before you place them.

**Two extras, if you want them** (both are questions below):
- **Lit chips:** the chip lights when the house already holds the set's other members. That's a strong hint, closer to the highlight you ruled out.
- **Set progress in the score panel:** "Suite 2/3", the sets' counterpart to the checklist's progress lines.

### Option C: the full ledger (fullest)

**Option B, plus receipts over time.**
- **After the play:** after the drain, a short receipt beat shows the week's change against last week: "▲ +139 · Suite +134 · Closet +10 · Bedroom −5". Alternatively the tally plays the play's causes first, which is D-094 option 1's "show the chains we already have".
- **Inspect on a placed piece:** what it's worth to the house and why. "Closet · earns 2 Comfort · worth 144 Wow a week · holds up Suite". The numbers are the demolish preview's, negated.
- **The end screen:** "Where your Wow came from". For this run: Charm from sets 51%, Charm from checklist lines 32%, and Comfort at ×1 17% (of which blueprints 5%, set Comfort 5% and the pieces' own lines 3%). It teaches the next run that sets and rules are the game.
- **Optional:** a record of the sets and rules you've completed, with your best week for each (Loop Hero's encyclopedia).

```
┌ This week ─────────────────────────────── ▲ +139 Wow ┐
│ ★ Suite +134 · Closet +10 · Bedroom loses a Tree −5 │
└──────────────────────────────────────────────────────┘

Where your Wow came from · 32,057
  Charm from sets            ██████████████████  51%
  Charm from checklist lines ███████████         32%
  Comfort (×1)               ██████              17%
     of which blueprints 5% · set Comfort 5% · the pieces' own lines 3% · Heat wave 2%
```

**What the rules add:**
- The `placed`, `installed` and `renovated` events carry the committed play's `parts`. `apply()` and `preview()` share the code, so they can't disagree.
- `pieceWorth(state, uid)` returns the parts the house would lose without the piece.
- A run ledger is updated in each tally. It's derived, so run codes still replay. The split is exact: Comfort at ×1, plus each Charm source × Comfort, plus Sparkle's extra.
- Tests check that the ledger adds up to the score and that replays match.

**Cost:** large, about 5 days.
- Option B, plus about a day for the after-play beat, which overlaps the juice PR's tally work.
- Half a day for the piece's worth.
- A day to a day and a half for the ledger and the end screen.

### Not proposed

- **Partner highlights while you hold a card:** you said no.
- **A best-spot number on hand cards** ("up to +139"):
  - it would choose the card for you, which is the spreadsheet problem Balatro avoids;
  - it needs a preview of every legal spot: up to 2,377 for a Fence this run, and about 3.5 s per hand in Node.
  - D-107 does this for fixtures because a fixture has few hosts.
- **Card text in Wow:** card text is generated from data and reads the same in every house. The house-dependent part belongs on the ghost.

## 4. Recommendation

**Option B, in two PRs: A first, then the card facts.** Then playtest with one question: "Did a number surprise you, and could you say why?"

**Why B over A:** your complaint is about the card. In this run the three largest gaps were sets, and no card names a set. A explains the number once you've found the spot. B also tells you what a card plugs into before you pick it up, without saying where. That's a fact about the rules, not a solution.

**Why not C yet:**
- The after-play beat overlaps the juice PR. Build it there, with D-094 option 1, if A and B still leave surprises.
- The ledger and a piece's worth are learning tools; they're worth more once each play explains itself.

**Order with the other work:**
- **The quick-fix PR's Renovate chip** sets the chip row that B's set chip joins.
- **The small UI PR's click-to-hold Inspect** makes A's receipt readable. Build A after it.
- **The layout session's possible "Extends" chip** shares B's budget.
- **The draw session's possible five-card hand** would mean compact cards, so the set chip is designed icon-first.
- **The balance pass:** A's receipt will show Country Living's per-Tree poke-outs in plain sight. Fix the rule there, not the display.
- **The decision log:** whichever you pick becomes one new entry. The other sessions hold D-112 to D-121, so this takes the next free number, D-122 if nobody has claimed it.

## 5. Summary

- **The ghost already shows the number, so there's no need to add more numbers; say where the number comes from.** Across playtest 4's 28 plays, the card's own lines were 15% of the Wow they moved. Checklist lines (24%), blueprints (21%) and sets (16%) did most of the rest, and the screen shows those in Comfort and Charm, never in Wow.
- **The biggest surprises were sets:** the Dining Room's +179 (Entertainer), the Closet's +139 (Suite), and two Bedrooms worth +266 to +269 (Jack-and-Jill) that the hand never hinted at. No card names a set.
- **Option A** (the ghost names its biggest part; one receipt in Wow; badges in Wow; stakes in tips) costs about 2 days and explains every number from playtest 4.
- **Option B** (A plus a static set chip and "In this house" boosts on the card) costs about 3 days and is the recommendation.
- **Option C** (B plus an after-play receipt, each piece's worth, and an end-screen ledger) costs about 5 days.
- **None of them lights up partners on the board.**

## 6. Questions for you

1. **Which option:** A, B (recommended), or C?
2. **Set chips:** static membership only, or lit when the house already holds the set's other members? Lit is closer to the highlight you turned down.
3. **Badges on changed pieces in Wow,** so they add up with the ghost's number? The pieces' own digits would stay in Comfort.
4. **Set progress in the score panel** ("Suite 2/3"): useful, or too much help?
5. **Stakes** ("each checklist line ≈ +121 Wow a week now"): on the checklist itself, or only in tips?

---

## Appendix: method and scratch data

- **The split:** W = P × A × X (Comfort × Charm × Sparkle), so ΔW = ΔP·A0·X0 + P1·ΔA·X0 + P1·A1·ΔX exactly.
  - The new piece's own Comfort is split by its lines: flat lines at their value, and each percentage line gets its share of the bonus.
  - A changed neighbor's reason is the diff of its lines before and after.
  - Every play's parts matched `preview().delta` to within rounding (under 1 Wow).
- **The run-wide ledger** splits each week's total as Comfort at ×1, plus each Charm source × Comfort, plus Sparkle's extra. Milestone rewards (862 Wow) are left out.
- **Scripts** are in this session's scratchpad (temporary), `/private/tmp/claude-501/-Users-sam-Desktop-Code-house-game--claude-worktrees-cranky-lamport-6bf2de/36c511e5-9e74-4fba-acc1-af92661ea83a/scratchpad/`:
  - `audit.ts` replays the run and splits every play (`--spots` ranks every legal spot of every hand card);
  - `probe.ts <action> <hand index>` gives one card's best spots with their parts;
  - `ledger.ts` is the run-wide split;
  - `worth.ts` is the Closet's worth after placing;
  - `audit.txt` and `audit-spots.json` are their output;
  - `research-notes.md` holds the research agent's notes and sources.
- **Sources for §2:**
  - Balatro: [GMTK on Balatro's hidden score](https://gmtk.substack.com/p/balatros-cursed-design-problem), [the Balatro Preview mod](https://github.com/DivvyCr/Balatro-Preview)
  - Into the Breach: [Game Developer on its UI](https://gamedeveloper.com/design/-i-into-the-breach-i-dev-on-ui-design-sacrifice-cool-ideas-for-the-sake-of-clarity-every-time-)
  - Islanders: [Wikipedia](https://en.wikipedia.org/wiki/Islanders_(video_game))
  - Loop Hero: [PC Gamer on its combos](https://www.pcgamer.com/uk/loop-hero-combos-cards-tile)
  - Luck be a Landlord: [Laura Michet on learning its map](https://blog.lauramichet.com/luck-be-a-landlord-is-about-learning-a-strangers-mental-map-of-the-universe/)
  - Combolands: [the Treyex guide](https://www.treyexgaming.com/combolands-roguelike-citybuilder-beginner-guide-map/), and `research.md`'s sources
