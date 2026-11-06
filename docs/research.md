# Open House — Research Notes

Reference notes on the games we're borrowing from. Facts are paraphrased from the sources at the bottom; observations from our own screenshots are marked.

> **Note for Claude Code:** Combolands released in August 2026, so it may be newer than your training data. Specs in this repo describe mechanics directly instead of saying "like Combolands."

## Combolands: Roguelike Citybuilder (Crux Games, 2026)

> **Update 2026-11-04:** several notes below are corrected by the "Update: reception, comparables, corrections" section at the end of this file. **2026-11-05:** the "Update: shop, items, and map" section adds detail on the shop, heirlooms, upgrades, potions, and the map, and the "Update: juice, sound, scoring, and art" section covers reward feedback, music, multipliers, and pixel art.

**Basics:** A pixel-art roguelike city builder from Crux Games, a two-person studio (makers of Terra Nil). Released August 24, 2026 on PC via Steam. It grew out of a free itch.io prototype called *Tiny Towns*. Very well received on Steam.

### Run structure
- A new procedurally generated island every run.
- Ten milestones with eight weeks between each, and a score target for each milestone. Runs take roughly 30–45 minutes.
- Every action uses up a week. Each week offers a small hand of building cards, with a limited number of rerolls and a few demolitions.
- Safety valve: a small pool of extra weeks you can spend when you'd otherwise miss a milestone. *(Screenshot: the "3 ⏰" counter in the top bar appears to be this pool.)*

### Cards and scoring
- Cards are buildings. Effects include flat points when triggered, modifiers to nearby buildings, adding or removing map features, and transforming into other buildings after a set number of weeks (e.g., a fountain turns a plot into a house, which can transform further).
- Adjacency to resources drives scoring (e.g., a hunter's hut scores more for each forest tile it touches).
- Effects fire on timers, and some buildings shorten the wait.
- Resource tension: clearing forest starves forest-dependent buildings but enables buildings that pay out on cleared ground.
- Walls only multiply fully enclosed tiles, and railroads arrive later, so early sprawl becomes a constraint.
- Chain reactions: one reviewer describes a trawler that triggers a ship, which then triggers every ship in range.

### Guilds
- Players choose two guilds at the start of a run (up to 21 pairings). Guilds decide which cards can appear, and the shop can offer cards from other guilds.

### Shop, items, and councilors
- A shop opens after each milestone, selling building upgrades, scoring modifiers, and rerolls. Chests can also hold modifiers or rerolls.
- Councilors unlock after a few runs and grant bonuses when you meet conditions, like building a set number of buildings during a milestone or using items.

### Difficulty
- Higher difficulties add hazards (random transformations, placement restrictions, buildings being removed) and penalties (a pricier shop, reduced scores, buildings that disappear after eight weeks).

### Early completion *(from our screenshots, v1.0.7a)*
- When the target is met with weeks left, a **Complete milestone early** button appears, along with an **Auto-complete milestone** checkbox.
- Example: a target of 500 met with 4 weeks remaining. Completing early paid **4 gold** (1 per week early; gold went from 4 to 8) and a milestone score of **25 base + 40% for weeks early = 35** (about 10% per week).
- The milestone was called **"Isolated Dwelling,"** apparently named after settlement size.

### Presentation (what reviewers praise)
- Tactile sound: a satisfying sound when a card is placed, a ticking tally as points count up, and a visual flourish for big scores.
- A steady stream of small, consequential decisions that never feels rushed, and very smooth onboarding.
- Reviewers repeatedly describe one run turning into several.

## Takeaways for Open House

- **Keep:** one action per week, adjacency-driven scoring, timed effects, transformations, rising milestone targets, a guild-like choice that shapes the card pool, a shop between milestones, the early-completion choice, and the auto-complete toggle.
- **Translate:** island → lot; resource nodes → lot features (trees, water, sunny side, street); walls → fences and courtyards; guilds → crews; councilors → change orders; hazards → HOA rules.
- **Make our own:** room shapes, poker-hand room sets, client specs and tastes, the house-versus-yard land tension, and the "-house" family.
- **Invest in juice:** placement sounds, the score tally, and a big-score moment do a lot of the work.

## Other references

- **Balatro:** run structure (blinds and antes, boss blinds that change the rules), jokers as rule-bending modifiers, money for unused hands, an endless mode after the final ante, and stakes as difficulty tiers.
- **The Sims:** floor switching with the floor below shown faded; a reference for a basement layer view.
- **Islanders and Dorfromantik:** tile-placement scoring based on neighbors, cited by reviewers as influences on Combolands.

## Sources

- Rogueliker review: https://rogueliker.com/combolands-roguelike-citybuilder/
- eGamers preview: https://egamers.io/combolands-is-a-roguelike-city-builder-that-fuses-balatros-combo-math-with-cities-skylines-tile-laying/
- Gamecritics review: https://gamecritics.com/rorenado/combolands-review/
- Aftermath impressions: https://aftermath.site/combolands-roguelike-citybuilder-balatro/
- GamingOnLinux launch news: https://gamingonlinux.com/2026/08/mini-roguelike-citybuilder-combolands-from-terra-nil-designer-launches-august-24th
- Steam store page: https://store.steampowered.com/app/4075620/Combolands/

---

## Update: reception, comparables, corrections (2026-11-04)

This update comes from a research pass done while planning (`implementation-plan.md` §2). The claims were spot-checked against their sources. Items marked *(guide)* come from community guides or forum posts rather than official sources.

### Combolands reception

- **Reception:** Overwhelmingly Positive on Steam (96% of about 2,000 reviews). Critic scores run from 7/10 to 9/10.
- **What players praise:** combos that snowball, runs of about 30–45 minutes, calm pacing with no timer, and tactile scoring feedback: a placement sound, a per-point "plink" tally, buildings stacking into a tower on big scores.
- **Main criticisms:**
  - It's too easy, even at the top rank, so decisions can feel weightless.
  - It gets repetitive after many hours.
  - Finished maps look like "a stamp collection", with walls and rails that serve no purpose.
  - Readability is mixed: some players win without understanding why, ask for clearer breakdowns, and find the text small.
- **RNG complaints** (dead draws, key buildings being rare) are real but secondary.

### Corrections to the notes above

- **Early completion** is an unlockable option added in demo v9 (June 2026), not a default feature. Forum players are mixed on it. Several say an extra placement plus another week of triggers is worth more than about 1 gold per week saved *(guide)*. It's used mostly in the first milestones, to afford an early shop item, or with gold-producing heirlooms. The "milestone score" bonus appears to feed a separate run score or meta-progression, not the next target.
- **Spare weeks:** a clock counter beside the timeline. The pool is spent automatically when a milestone would be missed, and is described as "a little extra time, but not much". Its size isn't confirmed; a pre-launch preview mentioned three.
- **Rerolls and removals** are tokens earned in play (buildings, chests, items), not fixed allowances. A **skip** option lets you pass on all three cards.
- **The shop** is locked behind meta-progression at first. It sells heirlooms (run-long passives in limited slots), potions, upgrades, and more; a refresh reportedly costs 5 gold *(guide)*. In Combolands, "blueprints" are free-to-place building copies. **Our blueprints correspond to their heirlooms.**
- **Onboarding** gets mixed reviews, not uniformly "very smooth". Most systems unlock gradually through meta-progression, and players complain when locked features aren't explained.
- **Adjacency:** guides describe it as "the nine tiles touching" a building (likely the 3×3 block around it), not edge-only.
- **Readability tools:** an automatic point preview on placement (added at launch after a player request), colored range and adjacency highlights, overlays for last week's points, a right-click detail panel, a compendium (v1.0.5), and a combo animation that tracks chains.
- **Tiny Towns**, the free prototype, names Islanders and Luck be a Landlord as its inspirations. Its structure (everything built earns every turn; pay rising amounts) is closer to Open House's D-004 and D-028 than Combolands is.

### Comparable games

- **Luck be a Landlord:**
  - Rent rises 12 times. The first rent can be paid without adding anything.
  - The designer bends rules so players never feel cheated, offers only Common symbols early, puts simpler effects on common symbols, and keeps items always-active rather than in the deck.
  - The main criticism is luck dependence with too few recovery tools.
  - Skipping a symbol choice is a deliberate option.
- **Islanders:** a live score preview before placing, and score thresholds that unlock new building packs. It launched without undo and added it after "persnickety placement" complaints. Repetition within a few hours is the top complaint.
- **Castles of Mad King Ludwig:**
  - Room shapes with adjacency bonuses, counted per connected room rather than per doorway.
  - Each room type gives a different completion reward (extra turn, money, re-score, card draw).
  - Criticized for analysis paralysis and constantly re-scoring earlier rooms.
- **Floor Plan and Dream Home:** both are house-building games where the highest-scoring house can be absurd (five adjacent dining rooms; no kitchen). Dream Home pushes back with functionality bonuses.
- **Balatro:**
  - Keeps escalating scores readable as two numbers (chips × mult).
  - Reveals boss blinds before the ante.
  - The designer says nearly all balance is changing numbers.
- **Dorfromantik:** optional quests with no penalty, rewarded in extra tiles. Late quests can become impossible, which feels unfair.

### Sources

- Combolands:
  - [Steam store](https://store.steampowered.com/app/4075620/Combolands/)
  - [Steam reviews (top-rated negative)](https://steamcommunity.com/app/4075620/negativereviews/?browsefilter=toprated&filterLanguage=english)
  - [Gamecritics review](https://gamecritics.com/rorenado/combolands-review/)
  - [Life Meets Pixel review](https://lifemeetspixel.com/reviews/combolands-review)
  - [Multiplayer.it review](https://multiplayer.it/recensioni/combolands-recensione.html)
  - [GamingOnLinux review](https://www.gamingonlinux.com/2026/10/combolands-will-take-away-all-your-free-time/)
  - [Patch notes (Steam news)](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4075620&count=40&maxlength=0)
  - [Early-completion forum thread](https://steamcommunity.com/app/4075620/discussions/0/564794422009731599/)
  - [Walls forum thread](https://steamcommunity.com/app/4075620/discussions/0/564797873721682770/)
  - [Treyex beginner guide](https://www.treyexgaming.com/combolands-roguelike-citybuilder-beginner-guide-map/)
  - [Tiny Towns](https://vfqd.itch.io/tiny-towns)
- Luck be a Landlord:
  - [Designer Q&A](https://blog.trampolinetales.com/questions-and-danswers/)
  - [Push Square review](https://www.pushsquare.com/reviews/ps4/luck-be-a-landlord)
  - [Rent table guide](https://gamepretty.com/luck-be-a-landlord-symbol-item-guide/)
- Islanders: [Wikipedia](https://en.wikipedia.org/wiki/Islanders_(video_game))
- Castles of Mad King Ludwig:
  - [Rules (BGA)](https://en.doc.boardgamearena.com/Gamehelpcastleofmadkingludwig)
  - [Meeple Like Us teardown](https://meeplelikeus.co.uk/the-castles-of-mad-king-ludwig-2014-accessibility-teardown/)
- Floor Plan:
  - [AV Club review](https://www.avclub.com/floor-plan-board-game-review)
  - [BoardGameQuest review](https://boardgamequest.com/floor-plan-review)
- Dream Home: [Opinionated Gamers review](https://opinionatedgamers.com/2016/11/29/dale-yu-review-of-dream-home/)
- Balatro:
  - [GMTK essay](https://gmtk.substack.com/p/balatros-cursed-design-problem)
  - [Rogueliker interview](https://rogueliker.com/balatro-interview/)
- Dorfromantik: [quests guide](https://itemlevel.net/dorfromantik-all-about-quests-guide/)

---

## Update: shop, items, and map (2026-11-05)

This update comes from a research pass on the shop, attachable upgrades, and map size, run for D-049 to D-051 in `implementation-plan.md`. The Combolands claims were spot-checked against their sources. Most of the detailed numbers come from a fan wiki marked as a work in progress, not from the developer, so treat them as *(guide)* unless noted.

### Combolands: the shop

- **Opening:** the shop starts locked and costs 40 gold once to repair, through meta-progression. After that it opens between milestones in every run. Reviewers say early runs drag until it's unlocked.
- **Stock grows over a run:** single cards plus packs. Visit 1 has 2 cards and 1 pack; visit 6 onward has 4 and 2. The first visit adds a free small heirloom chest.
- **Single cards** roll one of five kinds:
  - heirlooms, the most common
  - council votes
  - blueprints: a building you can place without spending a week, from any unlocked guild
  - building supplies
  - potions
- **Packs** are choose-N-of-M: blueprint satchels, heirloom chests, ballots, potion bags, and material piles, at 4–10 gold.
- **Refresh:** 5 gold, +1 for each further refresh in the same visit, back to 5 at the next visit.
- **Services:** rerolls and removes are sold one at a time, starting at 1 gold. Each purchase raises that service's price for the rest of the run, up to 5.
- **Selling:** most heirlooms and consumables sell for half their price. Buying needs a free slot.
- **Skipping the shop** pays a small random reward: gold, rerolls, removes, or a pack.

### Combolands: heirlooms, upgrades, and potions

- **Heirlooms** are passives in limited slots. The fan wiki lists 134: 72 Common, 38 Uncommon, 21 Rare, and 3 Legendary. Common ones cost about 4–6 gold, Rare ones 7–12. Archetypes:
  - category boosts (a Tome per guild)
  - flat points on events (the gem family)
  - tag conversion ("Forest counts as frontier")
  - placement relaxers (build on Rocks)
  - time and choice trades (+1 week per milestone; +1 card a week but −1 week per milestone)
  - economy
  - containers that sell for an effect (Loaded Dice sells for 5 rerolls)
  - collection sets that pay off when full
- **Building upgrades** are consumables applied to one placed building, not to a card type:
  - **Building supplies** are permanent stat boosts.
  - **Paints** are one per building and mostly timed. Ghost Paint changes which category a building affects. A long-time player calls the ghost and wild paints the fastest way to break the scoring.
  - Players report upgrades that quietly made a building worse.
  - No source says whether applying one costs a week.
- **Potions** are one-shot: trigger a building now, place the next building anywhere, duplicate or move a building, recycle one for a better blueprint, and more.

### Combolands: the map

- No source gives the island's dimensions. Reviewers say the whole island fits on one screen and call it small. A patch made generated islands bigger.
- Terrain is a few base tile types (ground, sand, shore, ocean). Removable nature objects sit on top (forest, rocks, flowers, fish), and buildings count them, need them nearby, or remove them.
- Players read the starting map to choose guilds: rocks suggest one guild, fish another, thick forest a third.
- Limited map variety is the most common critic complaint.
- **Correction to the notes above:** the fan wiki lists 9 milestones, named from Isolated Dwelling to Metropolis. GameCritics says ten.

### Other games' shops

- **Balatro:**
  - Each shop has 2 card slots, 2 packs, and 1 voucher, a permanent run upgrade at $10.
  - Rerolls cost $5, rise $1 each, and reset at the next shop.
  - Jokers are 70% Common, 25% Uncommon, and 5% Rare all game.
  - Anything sells for half.
  - Interest is $1 per $5 held, up to $5.
  - The first shop always has a joker pack.
- **Slay the Spire:**
  - Fixed category slots: 5 colored cards (2 Attacks, 2 Skills, 1 Power), 2 colorless, 3 relics, 3 potions, and a card removal.
  - One card is half price.
  - Removal costs 75, then 25 more each time.
  - Designer view: every card needs a purpose, as a build-around or a staple; cards should be viable, not equally powerful.
- **Super Auto Pets, Backpack Battles, Brotato:** a free lock or freeze keeps an offer for the next visit. Backpack Battles shifts rarity odds round by round and gives each item a 10% chance of a sale.
- **Wildfrost:**
  - A card holds up to 3 permanent charms.
  - The shop has 4 items, one at half price.
  - A reviewer says charms feel good because they transform a card, not just buff it.
- **Monster Train:**
  - Merchants sell upgrades applied to a single card, with Common around 20 gold and Rare 80–100.
  - The purge service starts at 50 and rises by 25 per use.
- **Hades:** cheap, temporary goods (a buff for the next 6–8 encounters) sit alongside expensive permanent ones.
- **Islanders: New Shores:** one-shot boons boost the next building, delete one, or clone one. A reviewer found them most useful when space or score was tight.
- **Floor Plan** (roll-and-write): dice give either a room or a feature. Features (doors, windows, furnishings) go into existing rooms. This is the closest thematic model for fixtures.

### Board size and fill

- Small boards are meant to fill: Kingdomino uses 5×5 and Tiny Towns 4×4.
- Combolands fits roughly 70–80 placements onto a small, one-screen island (our estimate from its milestone count).
- Pocket City 2's maps are 40×40 to 72×72, with rivers that deliberately split the land.
- Dorfromantik players find rivers frustrating to place around.
- Islanders' top complaints are imprecise placement and generated terrain that makes a run unwinnable.
- Carcassonne's river rules (one continuous path, no U-turns) are a simple model for a generated creek.
- **Readable cell size:** WCAG 2.2 sets a 24 px minimum for pointer targets, and 44–48 px is comfortable. A 24×24 board at 1280×720 lands near 25–28 px, so zoom matters.

### Sources

- Combolands:
  - [Fan wiki: shop](https://combolandswiki.com/shop/)
  - [Fan wiki: heirlooms](https://combolandswiki.com/heirlooms/)
  - [Fan wiki: consumables](https://combolandswiki.com/consumables/)
  - [Fan wiki: milestones](https://combolandswiki.com/milestones/)
  - [Fan wiki: council](https://combolandswiki.com/council/)
  - [Fan wiki: concepts](https://combolandswiki.com/concepts/)
  - [Fan site: walls](https://combolands.site/walls/)
  - [Steam news and patch notes](https://steamcommunity.com/app/4075620/allnews/)
  - [Forum: map reading and guild choice](https://steamcommunity.com/app/4075620/discussions/0/582807520276462444/)
  - [Forum: upgrades that backfired](https://steamcommunity.com/app/4075620/discussions/0/564794422009758331/)
  - [Phenixx review](https://web.phenixxgaming.com/2026/08/24/combolands-pc-review/)
  - [Metacritic](https://www.metacritic.com/game/combolands-roguelike-citybuilder/)
- Balatro:
  - [Shop](https://balatrowiki.org/w/Shop)
  - [Interest](https://balatrowiki.org/w/Interest)
  - [Booster packs](https://balatrowiki.org/w/Booster_Packs)
  - [Tags](https://balatrowiki.org/w/Tags)
- Slay the Spire: [Shop](https://slaythespire.wiki.gg/wiki/Shop)
- Super Auto Pets: [Shop](https://superautopets.wiki.gg/wiki/Shop)
- Backpack Battles: [Game mechanics](https://backpackbattles.wiki.gg/wiki/Game_Mechanics)
- Brotato: [Shop](https://brotato.wiki.spellsandguns.com/Shop)
- Wildfrost:
  - [Charms](https://wildfrostwiki.com/Charms)
  - [Woolly Snail shop](https://wildfrostwiki.com/The_Woolly_Snail)
  - [Punished Backlog review](https://punishedbacklog.com/wildfrost-review/)
- Monster Train: [merchants guide](https://www.supercheats.com/monster-train-walkthrough-guide/where-to-find-merchants.htm)
- Hades: [Consumables](https://hades.wiki.fextralife.com/Consumables)
- Islanders: New Shores: [Quest Daily review](https://questdaily.com.au/review/review-islanders-new-shores-pc/)
- Floor Plan: [What's Eric Playing](https://whatsericplaying.com/2020/08/31/floor-plan)
- Kingdomino: [Rules (BGA)](https://en.doc.boardgamearena.com/Gamehelpkingdomino)
- Pocket City 2: [Map guide](https://www.levelwinner.com/?p=92652)
- Islanders: [Steam review summary](https://vaporlens.app/app/1046030/islanders.md)
- Creek generation: [Red Blob Games on rivers](https://www.redblobgames.com/maps/rivers/)
- Target size: [WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

---

## Update: juice, sound, scoring, and art (2026-11-05, second pass)

This pass researched what makes combo games feel rewarding, for D-055 to D-059 and `implementation-plan.md` §12. Key claims were spot-checked against their sources.

**A caveat on sources:** Balatro's exact timing and audio numbers come from a community decompilation of the shipped game, cross-checked against a second dump. We use them as reference only and never copy its code, sounds, or art.

### Reward feedback

- **Balatro's tally:**
  - **Triggers:** cards and jokers fire one at a time, about 0.75–0.94 s each at normal speed. Each trigger has a colored popup, a sound, a squash-and-wobble, and a tiny screen shake.
  - **Pitch:** it rises about 1.6% per trigger, continuously, not stepped to a scale.
  - **Auto-acceleration:** long tallies speed themselves up, about 0.2× per second after roughly 10 s at normal speed.
  - **Speed settings:** 0.5×, 1×, 2×, and 4×. Many players still find 4× slow after many hours.
  - **The multiply moment:** chips and mult collapse into the hand's total with a pulse, which then drains into the round score.
  - **The flames:** they light only once a hand beats the blind, and grow with the logarithm of the score. LocalThunk calls them his proudest feature. Fire sounds fade in with the flames, and an organ layer swells only when a hand overshoots the blind by a lot.
- **Combolands:** each point ticks with a "plink". Big weeks stack building sprites into a tower by the score box, and a "magic" trail follows big combos. Reviewers say every activation's sound and motion makes chains easy to follow. A patch (v1.0.7) added a way to speed up the victory screen, a pixel-perfect scaling toggle, and a readable high-resolution font option. At the end of a run it shows a photo for each milestone reached (GamingOnLinux). In screenshots, the UI panels sit over the sea around the island.
- **Vampire Survivors:**
  - Chests hold 1, 3, or 5 items. Each size has its own jingle after a shared "Treasure Found" one, and the visuals grow with the tier.
  - The first six chests are scripted (1, 1, 3, 1, 1, 5), so players see the big one early.
  - Unskippable 5-item chests were its most-cited annoyance until an update.
  - The developer previously made slot machines.
- **Peggle and Peggle 2:**
  - Extreme Fever (slow motion, a zoom, Ode to Joy) began as a placeholder that playtesters loved.
  - In Peggle 2, peg hits climb a 26-note scale that matches the current music phrase, so the ladder never clashes with the music.
- **Hearthstone:** cards glow by rarity before they're flipped, which builds anticipation.
- **Research on juice:** in a 3,018-player study (Kao, 2020), no juice and extreme juice both did worse than medium or high. "Juice it or lose it" (Jonasson and Purho) shows each layer as a separate toggle, and its demo is Zlib-licensed.
- **Accessibility:**
  - Balatro added reduced motion after motion-sickness reports.
  - The flashing guideline is under 3 flashes per second over a quarter of the screen.
  - Browsers expose `prefers-reduced-motion`.

### Sound and music

- **Balatro:**
  - Five tracks in 7/4 by LouisF start together and crossfade by volume, so state changes never restart the groove.
  - They play at 0.7× speed, which LocalThunk preferred.
  - On a loss the music slides down to half speed.
- **Combolands:** players praise the chill lo-fi music, but a single short loop is the most common audio complaint. No composer is credited.
- **Calm music:** tempo, not style, drives breathing and heart rate (Bernardi, Porta, and Sleight, *Heart* 2006). Townscaper is calm with almost no music, using only ambience and placement sounds.
- **Web audio:**
  - schedule against `AudioContext.currentTime` with a lookahead timer
  - resume audio on a user gesture
  - `detune` makes in-key pitch ladders cheap
  - there's no native sidechain ducking
  - ZzFX (MIT, under 1 KB) is good for placeholders
  - Tone.js is about 79 KB gzipped
- **Licenses:**
  - Kenney's audio is CC0.
  - Freesound mixes CC0, CC BY, and CC BY-NC, and can be filtered.
  - The Sonniss GDC bundles are royalty-free in games but can't be redistributed as sounds.
  - The Abstraction/Tallbeard music loop bundle is CC0.
  - YannZ's Indie Meditations is CC BY 4.0.
  - The VCSL and VSCO-2-CE sample libraries are CC0.

### Scoring and multipliers

- **Balatro:**
  - Score is Chips × Mult. Hands range from High Card 5×1 to Straight Flush 100×8, and Planet cards level a hand type.
  - Of 150 jokers, ×Mult sits on about 3% of Commons, 28% of Uncommons, and 70% of Rares.
  - Many ×Mult jokers need a setup: a Pair, the last hand of a round, or growth over time (Hologram).
  - Players confuse +Mult and ×Mult because both are red and called "mult".
  - Base blind requirements go 300, 800, 2,000, 5,000, 11,000, 20,000, 35,000, 50,000 over the 8 antes: about 2.1× per ante, slowing late.
- **Combolands:**
  - Players describe score as points × mult × enchant, where enchant is a final global multiplier.
  - Mult comes in small steps (+0.1 to +1).
  - Endless targets double each milestone.
  - Scores overflow near 10^19.
  - The fan wiki was unreachable this time; earlier claims stand.
- **Ballionaire:** each distinct multiplier source applies once, however many times it's hit, and distinct sources multiply.
- **JavaScript:** integers are exact up to 2^53 (about 9×10^15).

### Art

- **Combolands:** measured from official screenshots, it looks like 16px tiles at 3× on 1080p, with front-facing building sprites on a flat map. The sprites have colored dark outlines, heavier on the bottom and right, and a different palette per island. Reviewers find it charming, but dense towns get hard to read. No artist is credited.
- **Interiors:** The Sims' walls-down cutaway is the model for showing rooms from above. Slynyrd's Pixelblog covers top-down interiors on a 16px grid.
- **Asset licenses**, checked on each asset page:
  - **Kenney** (Tiny Town, Roguelike Indoors, RPG Urban): CC0.
  - **LimeZu Modern Interiors and Modern Exteriors:** paid, commercial use allowed, no redistribution, credit required. LimeZu said open-source projects may include the parts they use.
  - **LimeZu Serene Village Revamped:** CC BY 4.0.
  - **Ninja Adventure:** CC0, and includes music and sound effects.
  - **Free tiers of Sprout Lands, Cozy Farm, Modern Interiors, and Cute Fantasy:** non-commercial or private only.
- **Crisp pixel art in browsers:**
  - `image-rendering: pixelated` works at whole-number scales.
  - Non-integer `devicePixelRatio` makes some pixels larger than others.
  - Safari blurs canvases under a scaling CSS transform, a bug open since 2018.
  - Extruding atlas tiles prevents seams.
- **LLM-made pixel art:** hobby projects report that drawing commands or palette-indexed grids work for simple tiles, while raw pixel arrays don't.

### Sources

- Balatro:
  - [community decompilation (reference only)](https://github.com/balatro-src/balatro-src-reverse-engineering)
  - [wiki: Music](https://balatrowiki.org/w/Music)
  - [wiki: Blinds and Antes](https://balatrowiki.org/w/Blinds_and_Antes)
  - [wiki: Jokers](https://balatrowiki.org/w/Jokers)
  - [wiki: Mult](https://balatrowiki.org/w/Mult)
  - [wiki: Activation Sequence](https://balatrowiki.org/w/Activation_Sequence)
  - [GamesRadar on the flames](https://www.gamesradar.com/games/roguelike/after-winning-big-at-the-game-awards-and-taking-hours-of-our-time-in-2024-balatro-creator-reveals-their-most-productive-night-resulted-in-one-of-the-games-most-satisfying-features)
  - [speed thread](https://steamcommunity.com/app/2379780/discussions/0/4346606879508270539)
- Combolands:
  - [Indie Exposure review](https://www.indie-exposure.com/review-combolands/)
  - [Steam news](https://store.steampowered.com/news/app/4075620)
  - [scoring thread](https://steamcommunity.com/app/4075620/discussions/0/582806564883281718/)
  - [combolands.site scoring](https://combolands.site/scoring/)
- Vampire Survivors:
  - [Treasure Chest](https://vampire.survivors.wiki/w/Treasure_Chest)
  - [Chest](https://vampire.survivors.wiki/w/Chest)
  - [Options](https://vampire.survivors.wiki/w/Options)
- Peggle:
  - [Peggle 2 adaptive music](https://www.audiogang.org/peggle-2-storytelling-through-adaptive-music/)
  - [Peggle Blast peg hits](https://www.audiokinetic.com/en/peggle-blast-peg-hits-and-the-music-system/)
- Hearthstone: [card packs](https://hearthstone.wiki.gg/wiki/Card_pack)
- Ballionaire: [devlog build 3](https://newobject.itch.io/ballionaire/devlog/620660/build-3-released)
- Juice:
  - [juicy-breakout](https://github.com/grapefrukt/juicy-breakout)
  - [Vlambeer advice](https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)
  - [Kao 2020](https://www.x-mol.com/paper/1307980428882448384)
- Accessibility: [flashing guideline](https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/)
- Music and calm: [Bernardi et al. 2006](https://pmc.ncbi.nlm.nih.gov/articles/PMC1860846/)
- Web audio:
  - [audio scheduling](https://web.dev/articles/audio-scheduling)
  - [autoplay](https://developer.chrome.com/blog/autoplay)
  - [detune](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/detune)
  - [ZzFX](https://github.com/KilledByAPixel/ZzFX)
- Audio assets:
  - [Kenney support (CC0)](https://kenney.nl/support)
  - [Freesound FAQ](https://freesound.org/help/faq/)
  - [Sonniss](https://sonniss.com/gameaudiogdc)
  - [music loop bundle](https://tallbeard.itch.io/music-loop-bundle)
  - [VCSL](https://github.com/sgossner/VCSL)
- Art assets:
  - [Kenney Tiny Town](https://kenney.nl/assets/tiny-town)
  - [Kenney Roguelike Indoors](https://kenney.nl/assets/roguelike-indoors)
  - [LimeZu Modern Interiors](https://limezu.itch.io/moderninteriors)
  - [LimeZu Modern Exteriors](https://limezu.itch.io/modernexteriors)
  - [LimeZu Serene Village](https://limezu.itch.io/serenevillagerevamped)
  - [Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack)
- Pixel art:
  - [Slynyrd Pixelblog 35](https://www.slynyrd.com/blog/2021/11/30/pixelblog-35-top-down-interiors)
  - [MDN crisp pixel art](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look)
  - [WebKit bug 185683](https://www2.webkit.org/show_bug.cgi?id=185683)
  - [Asset Forge](https://matthewdeaves.github.io/assetforge)

---

## Update: houses that look like houses (2026-11-06)

This pass researched how other games reward plausible buildings without killing combos, for D-093. In playtest 3 the house had 4 Living Rooms, 2 Kitchens, 2 Home Offices, and 3 Bedrooms sharing 1 Bathroom. It starts from our own sim, then the comparables. Key claims were spot-checked against their sources. Items marked *(guide)* come from fan guides, wikis, transcriptions, or forum posts.

### The sim baseline *(our measurements)*

From 200 greedy runs (seeds `sim-0` to `sim-199`, default options, develop at `49dce94`), reading each run's house at the end. A script outside the repo did the reading and reproduces `npm run sim -- --runs 200 --policy greedy` run for run. The 124 wins are full 28-week houses, and the numbers are for them.

- **Repeats are the norm:**
  - Living Rooms average 3.4 per house: 90% of houses have two or more, 67% three or more, and one had 8.
  - Kitchens average 2.7: 72% have two or more, 50% three or more.
  - Dining Rooms average 2.1: 68% have two or more.
  - 88% of houses have some room other than a Bedroom, Bathroom, or Closet three or more times.
- **Bathrooms are scarce:** 1.6 per house against 3.5 Bedrooms. 23% of houses have none, and 40% have more than two Bedrooms per Bathroom.
- **Only 2% pass a simple plausibility check.** The check: at least one Bedroom, Kitchen, and Bathroom; a Bathroom for every three Bedrooms; and at most one Kitchen, one Dining Room, two Living Rooms, one Garage, two Home Offices, and one of each special room. The playtest house fails it too.
- **Repeats sit apart:**
  - In houses with two or more of a type, the copies never touch in 37% of houses for Living Rooms, 44% for Kitchens, and 65% for Dining Rooms. They form one group in only 10–15%. Each copy wants its own view sources or its own Dining Rooms.
  - Bedrooms cluster more, forming one group in 37% of houses, because each earns +1 per Quiet neighbor. Lawns and Treehouses almost always clump, by design.
  - No Bedroom touches a Loud piece. That part of the zoning already works.
- **Why repeats win:**
  - **Nothing counts copies.** Each Living Room earns its own +2 per view, so four Living Rooms earn four sets of views.
    - In the last week, a Living Room earns about 25 per copy, a Kitchen 22, a Bedroom 17, a Bathroom 9, and a Dining Room 5.
    - Living Rooms make 22% of the run's Wow, and Kitchens 14%.
  - **Sets pay per instance.** At the end, 47% of houses hold two or more Entertainers, and each pays 25 Points and +1 Charm a week. The sets' Points are 21% of the Wow, before their Charm.
  - **The Kitchen has two cards** (Kitchen and L-Kitchen) at normal weight, so it's offered twice as often as any other room: about 7 times a run against 3.4 for the Living Room.
  - **The Bathroom pays little.** It pays only for its first Bedroom (+3, capped because Jack-and-Jill pays for two), and loses 2 for each Kitchen it touches.

### What changes the houses *(in-memory experiments)*

These are the same 200 seeds with the rules changed in memory, in a scratch copy, at today's targets. The repo isn't changed.
- "One Entertainer per house" uses the plan's `maxInstances` field, which M4a builds for Full House.
- Specs are emulated as +0.25 Charm while their condition holds, the way M4a's will pay.
- The room columns count won houses. The Wins column counts all 200 runs.

| Change | Wins | 2+ Kitchens | 3+ Living Rooms | 2+ Dining Rooms | >2 Bedrooms per Bathroom | Plausible |
|---|---|---|---|---|---|---|
| Today | 62% | 72% | 67% | 68% | 40% | 2% |
| Every copy of a room type earns −25% per copy past the first (all but Bedrooms, Bathrooms, and Closets) | 61% | 69% | 46% | 64% | 38% | 2% |
| One Entertainer per house | 60% | 68% | 66% | 65% | 39% | 2% |
| Both, at −50% a copy | 54% | 66% | 8% | 62% | 39% | 6% |
| Kitchen cards at half weight | 50% | 58% | 69% | 56% | 37% | 3% |
| A Bedroom with no Bathroom touching it (or linked by a Hallway) earns −50% | 56% | 85% | 66% | 71% | 21% | 1% |
| A spec: one Kitchen | 78% | 31% | 61% | 64% | 38% | 11% |
| Three household specs at +0.1 each | 75% | 45% | 45% | 41% | 22% | 19% |
| Three household specs at +0.25 each | 86% | 10% | 11% | 10% | 13% | 54% |
| The specs, one Entertainer, half-weight Kitchens, and −25% | 74% | 2% | 1% | 2% | 17% | 69% |

The three household specs are:
- exactly one Kitchen
- a Bathroom for every two Bedrooms, with at least two Bedrooms
- one or two Living Rooms, and at most one Dining Room

What the experiments show:
- **Percentages add (D-037), so a per-copy penalty is weak.** A Kitchen that touches three Dining Rooms already has +150%, and −25% barely dents it. The penalty trims Living Rooms but not Kitchens.
- **Capping the Entertainer** removes repeated sets: houses holding two or more fall from 47% to 0%. It costs about 12% of the median Wow but barely changes the room counts. Kitchens pay on their own: +2 per Dining Room, the Dining Rooms' +50%, and the Patios' +2 per Kitchen.
- **Penalties backfire, because the bot routes around them.** Docking Bedrooms that lack a Bathroom made it build fewer Bedrooms (3.5 down to 2.7) and more Kitchens. Houses with no Bathroom rose from 23% to 31%.
- **Specs with a ceiling work.**
  - Building a second Kitchen loses the "one Kitchen" spec, and that loss shows in the placement's preview. So the bot sees the cost at the moment it matters, and a player would too.
  - The push scales with the spec's value: at +0.1 the specs moved much less.
  - The specs also add Charm, so the win rate rose 24 points at today's targets. They'd need a re-fit, and D-085 already finds the middle of the run too easy.
- **Side effects:**
  - Yard repeats rise as rooms are capped: houses with three or more Patios go from 40% to 51%.
  - Houses get smaller (a median of 11 rooms, down from 15), and the yard gets fuller.
  - Most of the remaining no-Bathroom houses (19%) have 0–2 Bedrooms, so the Bathroom spec never applies to them. A client's own Bedroom count would close that gap.

### Comparables

- **Dream Home** (Rebel, 2016):
  - **Merging:** touching cards of one room type on a floor merge into one room, up to the 1, 2, or 3 cards printed on the card. Bigger rooms score steeply: a Living Room is 1, 4, or 9 points at 1, 2, or 3 cards.
  - **Finishing:** a room is finished at full size or once it holds a décor token, and you can't build the same type next to a finished room. Each décor token goes in one room of its type.
  - **Functionality bonuses:** 3 points for a Bathroom on each upper floor, and 3 for a house with a Bathroom, a Kitchen, and a Bedroom (4 each with the Architect helper). Small cards add adjacency: a Pantry is 3 points next to a Kitchen, and a Sauna 3 next to a Bathroom.
  - No rule we found caps how many rooms of one type you build. The printed cards weren't checked.
- **Floor Plan** (Deep Water Games, 2020):
  - **Rooms:** rectangles sized by two dice and labeled by one die: Closet, Washroom, Bedroom, Kitchen, Dining Room, or Living Room. Nothing requires a Kitchen, a Washroom, doors, or connected rooms.
  - **Clients:** three client cards per game set the demands, such as a Bedroom with a window that looks out on a tree. A demand can be scored again with different rooms.
  - **Reviewers agree the best houses are absurd:**
    - BoardGameQuest: five dining rooms side by side, with no doors.
    - AV Club: six bedrooms and one closet.
    - What's Eric Playing: a win with no outside doors. The reviewer wished every house had to meet some basic requirements.
- **Castles of Mad King Ludwig** (2014):
  - **Completion rewards:** completing a room (every doorway joined) pays by its type:
    - Food: another turn
    - Living: re-score the room
    - Activity: 5 points
    - Sleeping: take up to 2 tiles from a stack and put them on top of the deck
    - Utility: draw 2 bonus cards and keep 1
    - Outdoor: 10,000 coins
    - Corridor: a free Hallway or Stairs
    - Downstairs: every second one takes another type's reward
  - **Adjacency** counts each joined room once, however many doorways join them. Activity rooms' penalties need only touching.
  - **End-game bonus cards** reward both specializing and variety. One counts the rooms of a chosen type, and another pays 7 points for having all 8 types. The King's Favors rank players on the count or footage of one type.
- **Between Two Castles of Mad King Ludwig** (Stonemaier, 2018) *(guide: a rules transcription)*:
  - Your 3rd room of a type earns that type's bonus (a Fountain, a Tower, a bonus card, and so on), and your 5th earns any specialty room. There's nothing at 2, 4, or 6+.
  - A Sleeping room scores 4 if the castle has all 6 other regular types, and 1 otherwise.
- **Islanders: New Shores** (2025):
  - The Guild Hall scores for each different building in range and loses as much for each duplicate: +12 and −12 *(guide)*.
  - A boon, Neighbourly, stops buildings from losing points for touching.
  - Penalties work by range, so spreading duplicates out dodges them.
- **Dorfromantik** *(guide)*: number quests need an exact count in an area, "+" quests at least that many, and flag quests only a closed area. Missing one costs nothing, and finishing one pays extra tiles.
- **Kingdomino and Cascadia** *(rules summaries)*:
  - Kingdomino scores each connected region of one terrain as its squares × its crowns.
  - Cascadia scores only the largest connected corridor of each habitat, at 1 point a tile, plus a bonus for the biggest.
  - In both, same-type tiles are worth more together, and a stray copy adds nothing.
- **The Sims:**
  - Players don't type rooms, and nothing scores the floor plan. In the original game, rooms feed a need of their own (Room), from size, light and windows, and décor, less dirt.
  - The Sims 4 counts a lot's beds and bathrooms itself, and lists them in the lot's details *(forum)*.
  - Community venues like restaurants and bars need a list of required objects to work, and residential lots need none *(forum, mod page)*.
  - Dream Home Decorator's clients judge a renovation by their likes and dislikes, not a list of required objects. A reviewer found the feedback thin.
- **RimWorld** *(wiki)*:
  - A room's role comes from its furniture: one bed makes a bedroom, and several make a barracks.
  - Sharing a bedroom costs mood, and eating at a table in a dining room lifts it.
- **House Flipper 2** *(guides)*:
  - Buyers ask for a household's worth of rooms. One Sakura buyer would like four bedrooms, two bathrooms, affordable furniture, and a small garden, and has hidden preferences besides.
  - A room counts as a bedroom with a bed, and as a bathroom with a toilet, a sink, and a bath or shower.
  - A base-game guide found no price gain past 3 bedrooms or 3 bathrooms. The total room count mattered more.
- **Real houses** (NAHB, from Census data):
  - New single-family homes started in 2025: 46.5% had 3 bedrooms, 31.7% had 4, 10.3% had 5 or more, and 11.5% had 2 or fewer.
  - In 2024: 65% had 2 full bathrooms, 23% had 3, 7% had 4 or more, and 4.5% had 1 or fewer. 46% also had at least one half bath.
  - So a typical new house has 3–4 bedrooms and 2 full baths: about 1.5–2 bedrooms per bathroom. Greedy's houses have 3.5 Bedrooms and 1.6 Bathrooms.

### Takeaways for Open House

- **What works elsewhere:**
  - a household's needs (The Sims, RimWorld, House Flipper's buyers)
  - small "is it a home?" bonuses (Dream Home)
  - goals with exact or capped counts (Dorfromantik, and our own Juniper's 4–8 rooms)
  - variety bonuses that compete with specializing (Castles, the Guild Hall)
- **Floor Plan is the warning:** it has none of these, and its best houses are absurd.
- **Merging** (Dream Home) makes repeats read as one bigger room, and pays for it with steep size scoring. Our repeats sit apart, though, so merging would need a second rule to pull them together.
- **In our sim, specs with a ceiling beat penalties.** A spec you'd lose shows in the placement's preview, while a penalty just gets routed around.

### Corrections to the notes above

The 2026-11-04 comparables say Floor Plan and Dream Home can both reward absurd houses (five adjacent dining rooms; no kitchen). Both examples come from Floor Plan's reviews (BoardGameQuest and AV Club). Dream Home's merging and functionality bonuses are its pushback.

### Combolands: what pays gold (for D-090)

There's no official list. These notes come from player comments and the unofficial combolands.site compendium, so all of them are *(guide)*:

- **Industrial** is called the best money guild, with Maritime and Commercial close behind:
  - One building pays +1 gold whenever a nature tile or resource is removed.
  - Workshops: one player earned about 100 gold in two weeks from enough Industrial workshops.
  - Ore loops: the Gold Nugget heirloom makes Gold Ore, and a Depot pays +1 gold when ore moves into it and +1 when it's removed.
- **Commercial:** the Gold Pan and the Vineyard are named as the early gold earners. One player's loop of a Gold Pan and two Marketplaces re-triggering each other paid about 20 gold a week.
- **Herbs:** a Jewelry between two Apothecaries turns their herbs into gold.
- **Agricultural** (demo v9): Manure paid +1 gold when it was removed.
- **Sources that aren't placement:**
  - heirlooms: the Ingot, Shears, and an unnamed relic that multiplies gold gain. Heirlooms also sell back for value.
  - council requests, which pay out on completion
  - early completion, at about 1 gold per week saved (our screenshots)
- **For D-090:** the placement sources are a producer next to a trigger, removing nature, and turning a resource into gold. No source gives totals, so the share of a run's gold that comes from placement is unknown.

### Sources

- Dream Home:
  - [Rules summary](https://lehi-innovation.github.io/boardgame-rules/rules/dream-home/)
  - [Rulebook (RulesPal)](https://rulespal.com/dream-home/rulebook)
  - [Opinionated Gamers review](https://opinionatedgamers.com/2016/11/29/dale-yu-review-of-dream-home/)
- Floor Plan:
  - [Rulebook (RulesPal)](https://rulespal.com/floor-plan/rulebook)
  - [AV Club review](https://www.avclub.com/floor-plan-board-game-review)
  - [BoardGameQuest review](https://boardgamequest.com/floor-plan-review)
  - [What's Eric Playing](https://whatsericplaying.com/2020/08/31/floor-plan)
- Castles of Mad King Ludwig:
  - [Rules (BGA)](https://en.doc.boardgamearena.com/Gamehelpcastleofmadkingludwig)
  - [Rulebook (RulesPal)](https://rulespal.com/castles-of-mad-king-ludwig/rulebook)
- Between Two Castles: [Rulebook (RulesPal)](https://rulespal.com/between-two-castles-of-mad-king-ludwig/rulebook)
- Islanders: New Shores:
  - [CubeD3 review](https://www.cubed3.com/games/reviews/nintendo-switch/islanders-new-shores)
  - [Trophy guide (Guild Hall values)](https://knoef.info/?p=87009)
  - [Checkpoint Gaming review](https://checkpointgaming.net/reviews/2025/07/islanders-new-shores-review-a-whole-new-world/)
- Dorfromantik: [Quests guide](https://gamepretty.com/dorfromantik-beginners-guide-quests-rewards-tile-placement/)
- Kingdomino: [Rules (BGA)](https://en.doc.boardgamearena.com/Gamehelpkingdomino)
- Cascadia:
  - [Rules summary](https://lehi-innovation.github.io/boardgame-rules/rules/cascadia/)
  - [How to play (Happy Piranha)](https://happypiranha.com/blogs/board-game-rules/how-to-play-cascadia-board-game-rules-instructions)
- The Sims:
  - [Room motive (Forbus, "The Sims Under the Hood")](https://users.cs.northwestern.edu/~forbus/c95-gd/lectures/The_Sims_Under_the_Hood_files/v3_slide0106.htm)
  - [Windows and room score](https://www.thesimswiki.com/wiki/Window)
  - [Bed and bath counts (forum)](https://forums.ea.com/discussions/the-sims-4-bug-reports-archive-en/fr-count-of-bedsbaths-for-rental-apartments-is-not-updated-after-editing/11635341/replies/11635346)
  - [Venue requirements (forum)](https://forums.ea.com/discussions/the-sims-4-general-discussion-en/venue-requirements---why-none-for-residential/2114286)
  - [No Venue Requirements mod](https://modthesims.info/d/543444)
  - [Dream Home Decorator: listen to your clients](https://simscommunity.info/2021/06/01/the-sims-4-dream-home-decorator-listen-to-your-clients)
  - [GamingTrend review](https://gamingtrend.com/reviews/shes-a-bit-of-a-fixer-upper-the-sims-4-dream-home-decorator-review/)
- RimWorld:
  - [Room roles](https://rimworldwiki.com/wiki/Room_roles)
  - [Rooms](https://rimworldwiki.com/wiki/Rooms)
- House Flipper 2:
  - [Sakura DLC guide](https://www.treyexgaming.com/house-flipper-2-sakura-dlc-achievements-guide/)
  - [Profit guide](https://gamesfuze.com/guides/house-flipper-2-how-to-make-profit-in-house-flipping-guide/)
- Real houses (NAHB):
  - [Bedrooms in 2025](https://eyeonhousing.org/2026/09/bedrooms-in-new-single-family-homes-in-2025/)
  - [Bathrooms in 2024](https://eyeonhousing.org/2025/12/number-of-bathrooms-in-new-single-family-homes-in-2024/)
- Combolands gold:
  - [Forum: powerful combinations](https://steamcommunity.com/app/4075620/discussions/0/582807198746355731/)
  - [Forum: earning lots of gold](https://steamcommunity.com/app/4075620/discussions/0/582807145029856051/)
  - [Late-game guide](https://gameplay.tips/guides/combolands-roguelike-citybuilder-late-game-fishing-and-commercial-strategy.html)
  - [combolands.site: gold](https://combolands.site/gold/)
  - [combolands.site: buildings](https://combolands.site/buildings/)
  - [combolands.site: heirlooms](https://combolands.site/heirlooms/)
