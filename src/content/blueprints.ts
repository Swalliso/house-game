// Blueprints (D-051, D-056; Appendix B of implementation-plan.md): 18 run-long rule benders in
// 4 slots. Their archetypes come from Combolands' heirlooms: tag boosts, terrain, structure,
// economy, and a few rare rule-benders. ×Mult lives only on Rare blueprints (Last-Minute Push,
// Model Home, Ahead of Schedule), and each needs a setup. Prices come from balance.ts by
// rarity. Dream Home acts only on specs, so the shop holds it back until M4a adds clients.
//
// D-143 re-weighed the shelf by what holding each one is worth (given free at the first shop,
// against never on offer): the dead ones got a job, Feng Shui and Good Bones were narrowed, and
// It's a House became a build. Their numbers are placeholders for the playtest and the re-fit.

import type { BlueprintDef, BlueprintId, Modifier, Rarity } from '../rules/index.ts';
import { PRICES } from './balance.ts';

const blueprint = (
  id: BlueprintId,
  name: string,
  rarity: Rarity,
  modifiers: readonly Modifier[],
  offered = true,
): BlueprintDef => ({
  id,
  name,
  tier: 'core',
  rarity,
  price: PRICES.blueprint[rarity],
  modifiers,
  offered,
});

export const BLUEPRINTS: Readonly<Record<BlueprintId, BlueprintDef>> = {
  // Common: a tag or a place earns more.
  // Three views, not one (D-143): one Flower Bed no longer lights up every room around it, and
  // a room wants the woods, the water, or a small garden of its own.
  fengShui: blueprint('fengShui', 'Feng Shui', 'common', [
    { kind: 'earn', target: { touching: { property: 'viewSource' }, min: 3 }, pct: 50 },
  ]),
  // The front garden and the rooms behind it (D-143): yard pieces alone earned too little.
  curbAppeal: blueprint('curbAppeal', 'Curb Appeal', 'common', [
    { kind: 'earn', target: { in: 'frontYard' }, pct: 100 },
    { kind: 'earn', target: { touching: { in: 'frontYard' } }, pct: 100 },
  ]),
  quietHours: blueprint('quietHours', 'Quiet Hours', 'common', [
    { kind: 'earn', target: { tag: 'Quiet' }, pct: 75 },
  ]),
  // A garden that grows (D-143): half again of a Lawn's 1 was nothing.
  greenThumb: blueprint('greenThumb', 'Green Thumb', 'common', [
    { kind: 'earn', target: { tag: 'Green' }, pct: 50 },
    {
      kind: 'grantEffect',
      target: { tag: 'Green' },
      effect: { kind: 'growth', perWeek: 1, max: 3 },
    },
  ]),
  partyHouse: blueprint('partyHouse', 'Party House', 'common', [
    { kind: 'earn', target: { tag: 'Social' }, pct: 50 },
  ]),
  waterfront: blueprint('waterfront', 'Waterfront', 'common', [
    { kind: 'earn', target: { touching: { feature: ['pond', 'creek'] } }, pct: 100 },
  ]),

  // Uncommon: structure, terrain, and economy.
  // A great room is the Entertainer's three rooms, so it pays for the set (D-143). Its link
  // among them (a `link` modifier, which the rules still know) changed too little to notice.
  openConcept: blueprint('openConcept', 'Open Concept', 'uncommon', [
    { kind: 'setBonus', set: 'entertainer', pct: 50 },
  ]),
  goodBones: blueprint('goodBones', 'Good Bones', 'uncommon', [
    // Counts from the later of placement and purchase, so a blueprint bought late still grows.
    {
      kind: 'grantEffect',
      target: { property: 'room' },
      effect: { kind: 'growth', perWeek: 1, max: 3 },
    },
  ]),
  // The theme's build (D-143): every Doghouse, Treehouse, Greenhouse, Henhouse, and Birdhouse
  // adds Charm, up to 3 of a type, which is as many as a tidy yard holds (D-105).
  itsAHouse: blueprint('itsAHouse', 'It’s a House', 'uncommon', [
    { kind: 'mult', add: 50, per: { tag: 'House' }, maxEach: 3 },
  ]),
  countryLiving: blueprint('countryLiving', 'Country Living', 'uncommon', [
    {
      kind: 'grantEffect',
      target: 'all',
      effect: { kind: 'neighbor', match: { feature: 'tree' }, amount: 1, max: 3 },
    },
  ]),
  // Charm per Dark room (D-143): doubling the one enclosed room a house has was worth little,
  // and each room made Dark, by walls or by Blackout Curtains, now shows at once.
  moodLighting: blueprint('moodLighting', 'Mood Lighting', 'uncommon', [
    { kind: 'mult', add: 40, per: { all: [{ property: 'room' }, { tag: 'Dark' }] } },
  ]),
  showHome: blueprint('showHome', 'Show Home', 'uncommon', [
    { kind: 'earn', target: { hasFixture: 'any' }, pct: 100 },
  ]),
  solarPanels: blueprint('solarPanels', 'Solar Panels', 'uncommon', [
    {
      kind: 'grantEffect',
      target: { tag: 'Sunny' },
      effect: { kind: 'economy', budget: 1, every: 4 },
    },
  ]),

  // Rare: the rule-benders, and the only ×Mult blueprints (D-056).
  crownJewel: blueprint('crownJewel', 'Crown Jewel', 'rare', [{ kind: 'bestPiece', pct: 100 }]),
  dreamHome: blueprint('dreamHome', 'Dream Home', 'rare', [
    { kind: 'rule', key: 'specBonus', add: 10 },
  ]),
  // Pulls against completing early: a fast-forwarded last week doesn't count.
  lastMinutePush: blueprint('lastMinutePush', 'Last-Minute Push', 'rare', [
    { kind: 'xMult', times: 200, when: 'lastWeekOfPhase' },
  ]),
  modelHome: blueprint('modelHome', 'Model Home', 'rare', [
    { kind: 'xMult', times: 100, plusPer: { per: { hasFixture: 'any' }, add: 10 } },
  ]),
  // Rewards cashing out early.
  aheadOfSchedule: blueprint('aheadOfSchedule', 'Ahead of Schedule', 'rare', [
    { kind: 'xMult', times: 100, plusPer: { per: 'milestonesEarly', add: 20 } },
  ]),
};
