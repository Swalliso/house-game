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
