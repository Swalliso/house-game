// Blueprints (D-051, D-056; Appendix B of implementation-plan.md): 18 run-long rule benders in
// 4 slots. Their archetypes come from Combolands' heirlooms: tag boosts, terrain, structure,
// economy, and a few rare rule-benders. ×Mult lives only on Rare blueprints (Last-Minute Push,
// Model Home, Ahead of Schedule), and each needs a setup. Prices come from balance.ts by
// rarity. Dream Home acts only on specs, so the shop holds it back until M4a adds clients.

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
  fengShui: blueprint('fengShui', 'Feng Shui', 'common', [
    { kind: 'earn', target: { property: 'view' }, pct: 50 },
  ]),
  curbAppeal: blueprint('curbAppeal', 'Curb Appeal', 'common', [
    { kind: 'earn', target: { in: 'frontYard' }, pct: 100 },
  ]),
  quietHours: blueprint('quietHours', 'Quiet Hours', 'common', [
    { kind: 'earn', target: { tag: 'Quiet' }, pct: 50 },
  ]),
  greenThumb: blueprint('greenThumb', 'Green Thumb', 'common', [
    { kind: 'earn', target: { tag: 'Green' }, pct: 50 },
  ]),
  partyHouse: blueprint('partyHouse', 'Party House', 'common', [
    { kind: 'earn', target: { tag: 'Social' }, pct: 50 },
  ]),
  waterfront: blueprint('waterfront', 'Waterfront', 'common', [
    { kind: 'earn', target: { touching: { feature: ['pond', 'creek'] } }, pct: 50 },
  ]),

  // Uncommon: structure, terrain, and economy.
  openConcept: blueprint('openConcept', 'Open Concept', 'uncommon', [
    { kind: 'link', among: ['kitchen', 'diningRoom', 'livingRoom'] },
  ]),
  goodBones: blueprint('goodBones', 'Good Bones', 'uncommon', [
    // Counts from the later of placement and purchase, so a blueprint bought late still grows.
    {
      kind: 'grantEffect',
      target: { property: 'room' },
      effect: { kind: 'growth', perWeek: 1, max: 10 },
    },
  ]),
  itsAHouse: blueprint('itsAHouse', 'It’s a House', 'uncommon', [
    { kind: 'mult', add: 15, per: { tag: 'House' } },
  ]),
  countryLiving: blueprint('countryLiving', 'Country Living', 'uncommon', [
    {
      kind: 'grantEffect',
      target: 'all',
      effect: { kind: 'neighbor', match: { feature: 'tree' }, amount: 1, max: 3 },
    },
  ]),
  moodLighting: blueprint('moodLighting', 'Mood Lighting', 'uncommon', [
    { kind: 'earn', target: { all: [{ property: 'room' }, { tag: 'Dark' }] }, pct: 100 },
  ]),
  showHome: blueprint('showHome', 'Show Home', 'uncommon', [
    { kind: 'earn', target: { hasFixture: 'any' }, pct: 50 },
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
  dreamHome: blueprint(
    'dreamHome',
    'Dream Home',
    'rare',
    [{ kind: 'rule', key: 'specBonus', add: 10 }],
    false, // Offered once M4a's clients bring specs.
  ),
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
