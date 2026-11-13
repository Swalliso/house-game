# Open House — Pieces & Clients (Brainstorm Draft)

**Status:** Draft for discussion. Nothing here is decided yet. Numbers are deliberately left out until there's a playable prototype to tune against.

**Tiers:** **Core** = proposed for the jam build · **Stretch** = if time allows · **Later** = after the jam

## 1. How pieces work (proposed model)

Every piece has a **shape** on the grid, a few **tags**, and one or two **effects**. All effects come from a small shared set of effect types, so the scoring engine stays small and new content is mostly data.

**Tags:** Quiet, Loud, Social, Wet, Sunny, Outdoor, Green, Kid, Pet, Pretty, Dark, House (every "-house" piece).

**Effect types**

| Type | What it does | Example |
|---|---|---|
| Steady | Earns a fixed amount every week | Closet |
| Neighbor bonus | Earns more for each adjacent piece or feature with a tag | Bedroom next to trees |
| Neighbor penalty | Earns less for each adjacent piece or feature with a tag | Bedroom next to the street |
| Aura | Multiplies adjacent pieces with a tag | Dining Room boosts the Kitchen |
| Rhythm | Earns a big amount every few weeks | Pool |
| Growth | Earns more the longer it exists | Good Bones blueprint |
| Set | Bonus when certain pieces form a connected group | Suite |
| Enclosure | Bonus for areas fully enclosed by fences, walls, or lot edges | Fenced Yard |
| Transform | Becomes another piece after some weeks or when a condition is met | Sapling → Tree |
| Economy | Produces budget instead of (or as well as) score | Home Office |

**Properties derived from the layout**
- **Exterior room:** an indoor piece touching the yard or the lot edge (it has windows).
- **Interior room:** an indoor piece touching only other indoor pieces. Interior rooms count as **Dark**.
- **View:** a piece touching a Tree, the Pond, or a garden has a View.
- **Front yard / back yard:** yard tiles between the house and the street, versus everything behind the house.
- **Fenced Yard:** yard tiles fully enclosed by fences, house walls, and lot edges.

Clients, change orders, HOA rules, and shop upgrades all target tags and properties ("Dark rooms earn double," "Pet pieces in a Fenced Yard earn more"), so none of them need special-case code.

## 2. Lot features

| Feature | Effect | Tier |
|---|---|---|
| Street edge | The front of the lot. Pieces touching it count as next to something Loud. Defines the front yard. | Core |
| Mature tree | Quiet and Green for its neighbors. Building over it removes it. | Core |
| Pond | Gives a View to adjacent pieces. Can't be built on. | Core |
| The sun | Shines from one edge of the lot. A room, Hallway or outbuilding with a wall facing it and no Tree or other building in front is Sunny (D-120; it was a sunny band along one edge). | Core |
| Boulder | Blocks a tile until demolished. | Core |
| Special feature | One per lot: an ancient oak, an old well, the neighbor's cemetery, power lines. | Stretch |

## 3. Indoor rooms (starter pool)

| Room | Size | Tags | Effect | Tier |
|---|---|---|---|---|
| Bedroom | 2×2 | Quiet | Steady earner; more per adjacent Tree or Quiet piece; less per adjacent Loud piece | Core |
| Bathroom | 1×1 | Wet | Only earns when touching a Bedroom; bigger bonus touching two (Jack-and-Jill); penalty if touching the Kitchen | Core |
| Kitchen | 2×2 or L | Social | More per adjacent Dining Room or Herb Garden | Core |
| Dining Room | 2×2 | Social | Aura: boosts an adjacent Kitchen and Living Room | Core |
| Living Room | 2×3 | Social | More per View | Core |
| Closet | 1×1 | — | Small steady earner; completes the Suite set | Core |
| Hallway | 1×2 or 1×3 | — | Rooms at both ends count as adjacent to each other | Core |
| Garage | 2×2 | Loud | Must touch the street or a Driveway; a little budget each week (garage sales) | Core |
| Home Office | 1×2 | Quiet | Economy: budget each week; earns less next to Loud pieces | Core |

## 4. Yard pieces (starter pool)

| Piece | Size | Tags | Effect | Tier |
|---|---|---|---|---|
| Lawn | 1×1 | Outdoor, Green | Small steady earner; more per connected Lawn tile | Core |
| Sapling | 1×1 | Green | Grows into a mature Tree after a few weeks | Core |
| Flower Bed | 1×1 | Green, Pretty | Bonus in the front yard (curb appeal); more per adjacent Flower Bed | Core |
| Herb Garden | 1×2 | Green | Bonus on Sunny tiles; boosts an adjacent Kitchen | Core |
| Patio | 2×2 | Outdoor, Social | More per adjacent Living Room or Kitchen, and per View | Core |
| Fence | 1×3 line | — | Creates Fenced Yards (enclosure) | Core |
| Driveway | 1×2 | — | Connects a Garage to the street; small curb appeal | Core |

## 5. Special pieces (shop, crews, clients)

| Piece | Size | Tags | Effect | Tier |
|---|---|---|---|---|
| Playroom | 2×2 | Loud, Kid | More per adjacent Bedroom (a kids' wing); penalty to adjacent Quiet pieces | Core |
| Library | 2×2 | Quiet | More per adjacent Quiet piece | Core |
| Mudroom | 1×2 | Pet | Boosts Pet pieces when it touches a Fenced Yard | Core |
| Pool | 2×3 | Wet, Sunny, Loud | Rhythm: big payout every few weeks; penalty per adjacent Tree (leaves) | Core |
| Home Theater | 2×3 | Loud, Dark | Rhythm: big payout every few weeks; penalty to adjacent Bedrooms | Stretch |
| Sunroom | 2×2 | Sunny | More per Sunny tile it covers | Stretch |
| Hot Tub | 1×1 | Wet, Social | Bonus next to a Patio | Stretch |
| Fire Pit | 1×1 | Social | Aura: boosts an adjacent Patio | Stretch |
| Playground | 2×2 | Kid, Loud | Bonus inside a Fenced Yard | Stretch |
| Secret Passage | 1×1 | — | Two rooms anywhere on the lot count as adjacent | Stretch |
| Wine Cellar | 2×2 | Dark | Basement only; boosts the Dining Room above it | Later |

## 6. The "-house" family

Small outbuildings that all carry the **House** tag. The shop upgrade **It's a House** pays out for every House piece on the lot, turning the theme's punchline into a build strategy.

| Piece | Size | Effect | Tier |
|---|---|---|---|
| Doghouse | 1×1 | Pet; needs a Fenced Yard; more per adjacent Lawn | Core |
| Treehouse | 2×2 | Kid; must touch a mature Tree; more per nearby Kid piece | Core |
| Greenhouse | 2×2 | Green; aura: boosts adjacent gardens | Core |
| Birdhouse | 1×1 | More per adjacent Tree | Stretch |
| Henhouse | 1×2 | Economy: budget each week (eggs); bonus next to a garden | Stretch |
| Pool House | 2×2 | Aura: boosts an adjacent Pool | Stretch |
| Guest House | 2×3 | Counts as a Bedroom and a Bathroom for client specs | Stretch |
| Outhouse | 1×1 | Cheap and terrible: small earner, penalty to neighbors. One client loves it. | Stretch |
| Boathouse | 2×2 | Lakefront lots only; bonus next to water | Later |

## 7. Room sets (poker hands)

| Set | Requirement | Tier |
|---|---|---|
| Suite | Bedroom + Bathroom + Closet, all connected | Core |
| Jack-and-Jill | A Bathroom touching two Bedrooms | Core |
| Entertainer | Kitchen + Dining Room + Living Room in a connected chain | Core |
| Full House | At least one of every core room type on the lot | Core |
| Kids' Wing | Two or more Bedrooms + a Playroom, connected | Stretch |

## 8. Fixtures (placed onto an existing room)

| Fixture | Effect | Tier |
|---|---|---|
| Fireplace | Boosts its room; Living Rooms and Libraries love it | Stretch |
| Skylight | Makes an interior room Sunny (and no longer Dark) | Stretch |
| Blackout Curtains | Makes an exterior room Dark | Stretch |
| Soundproofing | Removes Loud penalties from its room | Stretch |
| Kitchen Island | The Kitchen also counts as a Dining Room | Stretch |
| Bunk Beds | A Bedroom counts as two for client specs | Stretch |

## 9. Blueprints (run-long rule-benders bought in the shop)

| Blueprint | Effect | Tier |
|---|---|---|
| Open Concept | Kitchen, Dining Room, and Living Room count as adjacent if any two of them touch | Core |
| Feng Shui | Pieces with a View earn more | Core |
| Curb Appeal | Front-yard pieces earn double | Core |
| Good Bones | Rooms earn a little more for every week they've existed | Core |
| It's a House | Bonus for every House piece on the lot | Core |
| Zoning Variance | Ignore one HOA rule | Stretch |

## 10. Clients

Each client has a **brief**, a **spec checklist** (each item met multiplies weekly score; proposed in D-021), **tastes** (likes and dislikes by tag), and a few **signature change orders**. Clients change what a good house looks like, not how hard the run is.

Clients also have a **rarity**. Common clients make up most runs, Uncommon ones add variety, and Rare ones (like the vampire) are a fun surprise.

### The Hendersons — suburban family · Common · Core
- **Brief:** "Four beds, two baths, and a yard for the kids."
- **Specs:** 4 Bedrooms · 2 Bathrooms · Kitchen next to the Dining Room · a Fenced Yard
- **Tastes:** like Kid pieces and Lawn; dislike Loud pieces next to Bedrooms
- **Change orders:** "We're expecting twins!" (two more Bedrooms) · "We got a golden retriever" (a Doghouse in a Fenced Yard) · "We're hosting Thanksgiving" (the Entertainer set earns double next phase)
- **Plays like:** the balanced baseline that teaches the normal rules

### Count Vladislav — vampire · Rare · Core
- **Brief:** "Somewhere quiet. Somewhere… dark."
- **Specs:** 3 Dark rooms · a Library · no Pool
- **Tastes:** Dark pieces earn double; Sunny pieces earn nothing; likes Trees (shade); hates Herb Gardens (garlic)
- **Change orders:** "The coven is visiting" (two more interior rooms) · "Eternal night" (next phase, every room counts as Dark)
- **Plays like:** a compact, chunky house built around interior rooms, with a shady yard. Works without a basement; a basement would make him even more fun later.

### The Barkers — dog people · Common · Core
- **Brief:** "The dogs come first."
- **Specs:** a Fenced Yard of at least 12 tiles · 2 Doghouses · a Mudroom
- **Tastes:** Pet pieces and Lawn earn more; dislike Flower Beds (the dogs dig them up)
- **Change orders:** "Another rescue" (one more Doghouse) · "Agility course" (6 connected Lawn tiles inside the Fenced Yard)
- **Plays like:** yard-first; the house stays small

### Juniper Vale — minimalist · Uncommon · Core
- **Brief:** "Less, but better."
- **Specs:** 12 pieces or fewer · at least 2 rooms with a View · no Garage
- **Tastes:** every piece beyond the limit lowers all earnings; early-completion bonuses are doubled
- **Change orders:** "Declutter" (demolish a piece for a bonus) · "Tea garden" (a Patio with a View)
- **Plays like:** a few perfect placements, finishing milestones early

### Skye Starling — influencer · Uncommon · Stretch
- **Brief:** "It has to look amazing on camera."
- **Specs:** a Pool · 4 Flower Beds in the front yard · a Sunroom
- **Tastes:** Pretty pieces earn double; each week the single best-earning piece earns triple ("the shot"); hates a Garage facing the street
- **Change orders:** "Brand deal" (Pretty pieces earn triple next phase) · "Trend shift" (the tag she likes changes)
- **Plays like:** one spectacular showpiece area

### The Bigsbys — family of eleven · Uncommon · Stretch
- **Brief:** "We need room. Lots of room."
- **Specs:** 7 Bedrooms · 3 Bathrooms · a Playroom
- **Tastes:** Loud penalties are halved; Bedrooms earn more
- **Change orders:** "Triplets!" (three more Bedrooms) · "Family reunion" (a Guest House)
- **Plays like:** sprawl and packing efficiency

### Dale — remote worker · Common · Core
- **Brief:** "Fast internet and a quiet place to work."
- **Specs:** 2 Home Offices · nothing Loud next to an office
- **Tastes:** Economy pieces produce double
- **Change orders:** "Big deadline" (place nothing Loud next phase, for a bonus) · "Started a podcast" (an interior room for a studio)
- **Plays like:** an economy run: make money early, buy power in the shop

## 11. Crews (pick one per run)

| Crew | Strength | Tier |
|---|---|---|
| General Contractor | Balanced card pool; one extra reroll each phase. The starter crew. | Core |
| Landscaper | Yard pieces show up more and earn more; starts with a Sapling and a Fence | Core |
| Architect | More special rooms in the pool; Sets earn more | Core |
| Handyman | Fixtures show up often; a cheaper shop; can move one placed piece per phase | Stretch |

## 12. Generic change orders

Most are optional opportunities: meet the request by the next milestone for a bonus.

| Change order | Request | Tier |
|---|---|---|
| Working from home | Add a Home Office | Core |
| Grandma's moving in | A Bedroom with a Bathroom touching it | Core |
| Heat wave | Next phase: Pools and Trees earn double, Sunny rooms earn half | Core |
| Book club | A Quiet room touching the Living Room | Stretch |
| Garden party | Three Flower Beds touching a Patio | Stretch |

## 13. HOA rules and difficulty modifiers

| Rule | Effect | Tier |
|---|---|---|
| Setback rule | Only Lawn, Flower Beds, and Driveways within 1 tile of the street | Stretch |
| Lawn standards | Empty yard tiles cost budget each week | Stretch |
| Out of sight | House-tagged outbuildings must be in the back yard | Stretch |
| Rush job | Fewer weeks per milestone | Stretch |
| Tight budget | Shop prices go up | Stretch |

## 14. Suggested jam starter set (for discussion)

The Core items above add up to roughly 9 indoor rooms, 7 yard pieces, 4 special pieces, 3 "-house" pieces, 4 sets, 5 blueprints, 5 clients (four everyday clients plus the rare vampire), 3 crews, and 3 generic change orders (plus each client's own). Because everything is built from the shared effect types, most of the work is the engine; the content itself is data.

## 15. Merged rooms (from playtest 5a)

**Tier:** Later. It's on the decision log's Parked list; revisit after playtest 4 has tried M4's Renovate (D-102).

*2026-11-12:* built as *Extend a room*, D-168 (Accepted 2026-11-13): once a room, any week, +2 Comfort a tile, and a grown room takes a second group of furniture. No level comes with it; Renovate stays for a room that can't grow. Off the Parked list.

The team's idea: build a Living Room against another Living Room and the two become one bigger living room. Two Bedrooms could become a primary bedroom the same way. A limit keeps rooms from merging endlessly. A house that reshapes itself as it grows would feel more alive.

**Today:** the rules score every piece on its own. Two touching Bedrooms are two neighbors (each gives the other +1), and each fills its own slot in a set. On the board a wall stands between every two pieces, same type included (D-097, D-100). The one grouping rule is the Open Concept blueprint, which links touching Kitchens, Dining Rooms and Living Rooms without changing counts or walls. Bunk Beds make a Bedroom count twice in count conditions, never in sets.

**Three ways to build it**

| Shape | How it works | Rules | Art | Effort | The catch |
|---|---|---|---|---|---|
| **Extend a room** (the team's pick) | A spare room card grows a room of its type. Its cells join that room, which stays one piece with a bigger outline and a level. Rooms already placed never merge. A big Bedroom can be the primary bedroom. | A new play beside M4's Renovate (D-102), with a position and a rotation. The room takes the combined shape (a piece's own shape, which M4's packs added: D-106) and a level. No count changes, so sets and M4's house rules (D-101) stay as they are. | One piece, so the walls, doors, color and number already work. Big footprints need more furniture: one bed on a big floor looks sparse. | Medium | Two uses for one spare card (renovate or extend). A bigger outline touches more neighbors, so its value needs tuning. Needs M4 first. |
| Bigger room types | Two touching rooms of a type merge into a Great Room or a Primary Bedroom, with their own card text, scoring and size cap. | A merged room counts once everywhere: neighbors, effects, sets, specs, house rules, demolition and Renovate. The systems review's trial rewrote the per-piece model (232 lines in 8 rules files). | New room types need floors, furniture, icons and pictures. | Large | The biggest rules change. It breaks Jack-and-Jill pairs, and a size bonus that pulls rooms together becomes a clump engine (D-079). |
| Open plan, look only | The walls come down between touching rooms of one type, which share one color. The rules still count each piece. | None. | Walls, doors and colors per group; leftover wall stubs; the ghost can't show a wall coming down. | Small | The board shows one room where the rules count two, and two Bedrooms read as a dorm, not a primary bedroom. |

**Limits** (any one, or a mix):
- A size cap per room, for example 2 pieces. Dream Home prints 1 to 3 per room (`research.md`).
- One per house, as M4 caps the Entertainer (D-093) and Full House.
- Only once the type is at its limit, Renovate's trigger. M4's limits are soft (a third Living Room can still be built), so the cap needs its own rule.
- A cost: the week's turn, a shop tool (a knock-through beside the Remodel Plans), or budget.
- Only some types: Living Rooms and Bedrooms, never Kitchens, Bathrooms, Closets or Garages.
- No growing a room with a fixture in it (Dream Home's décor rule), which ties merging to fixtures.
- A size bonus that shrinks with each piece, applied after percentages.

**From the sim** (greedy's wins): today a third of Bedroom pairs touch, and in a quarter of the houses with two or more Bedrooms, four or more sit in one touching group (one house had 9). Under M4, 30–43% of Bedroom pairs touch, and 38–79% of those are one Jack-and-Jill's two Bedrooms.
