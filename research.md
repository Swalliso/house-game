# Open House — Research Notes

Reference notes on the games we're borrowing from. Facts are paraphrased from the sources at the bottom; observations from our own screenshots are marked.

> **Note for Claude Code:** Combolands released in August 2026, so it may be newer than your training data. Specs in this repo describe mechanics directly instead of saying "like Combolands."

## Combolands: Roguelike Citybuilder (Crux Games, 2026)

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
