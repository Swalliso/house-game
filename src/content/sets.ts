// Sets (Appendix B; values from Appendix A · M4a): a poker-hand ladder, where both the Points
// and the Mult rise with how hard the set is (D-056). M1 brought in Jack-and-Jill and the
// Entertainer, so Charm moved from the start; M4a adds the Suite and Full House, and holds the
// Entertainer to one per house (D-093). D-164 adds the yard sets, after the indoor ones and
// before Full House, the ladder's top. Mult is in hundredths: 50 is +0.5.

import type { SetDef, SetId } from '../rules/index.ts';

export const SETS: Readonly<Record<SetId, SetDef>> = {
  jackAndJill: {
    id: 'jackAndJill',
    name: 'Jack-and-Jill',
    tier: 'core',
    members: { bedroom: 2, bathroom: 1 },
    connected: true,
    hub: 'bathroom',
    points: 10,
    mult: 50,
    level: { points: 8, mult: 25 },
  },
  entertainer: {
    id: 'entertainer',
    name: 'Entertainer',
    tier: 'core',
    members: { kitchen: 1, diningRoom: 1, livingRoom: 1 },
    connected: true,
    // One per house (D-093): a second Kitchen, Dining Room, and Living Room earn their own
    // Comfort, but no second Entertainer.
    maxInstances: 1,
    points: 25,
    mult: 100,
    level: { points: 15, mult: 50 },
  },
  suite: {
    id: 'suite',
    name: 'Suite',
    tier: 'core',
    members: { bedroom: 1, bathroom: 1, closet: 1 },
    connected: true,
    points: 15,
    mult: 50,
    level: { points: 10, mult: 25 },
  },
  // The yard sets (D-164): yard pieces and outbuildings as members, so a yard card has a reason
  // beside the house. Matching is type-generic, so a pack (a Fence, a Driveway) is one member
  // however many tiles it has. Each is one per house, like the Entertainer, so none turns into a
  // clump engine or wants a fourth of a type (a tidy yard, D-105), and its members touch. They
  // sit on the ladder's lower rungs: the three-piece ones pay a Suite's or a Jack-and-Jill's,
  // Drive-In (two pieces) less, and none the Entertainer's. Members are cards the weekly draw
  // deals at full weight (the Greenhouse and the Doghouse, complexity 3, fully from Roofing);
  // the Fire Pit, the Hot Tub, and the Pool aren't, and a Sapling becomes a Tree (a lot feature,
  // not a piece), so none is a member.
  //
  // Two cross the wall, a room and the yard beside it. The Backyard: a Living Room opening onto
  // a Patio and a Lawn, the Layout row's two most offered pieces (5.5 a run each), which greedy
  // placed from 15% and 18% of their offers. The Harvest: the Kitchen, its Herb Garden, and a
  // Greenhouse. A Flower Bed in the Greenhouse's place (a Kitchen Garden) was wedged into the
  // house's notches nearly three times as often, and No yard inside the house fell from 73% to
  // 65% of greedy's wins.
  backyard: {
    id: 'backyard',
    name: 'Backyard',
    tier: 'core',
    members: { livingRoom: 1, patio: 1, lawn: 1 },
    connected: true,
    maxInstances: 1,
    points: 15,
    mult: 50,
    level: { points: 10, mult: 25 },
  },
  harvest: {
    id: 'harvest',
    name: 'Harvest',
    tier: 'core',
    members: { kitchen: 1, herbGarden: 1, greenhouse: 1 },
    connected: true,
    maxInstances: 1,
    points: 15,
    mult: 50,
    level: { points: 10, mult: 25 },
  },
  // The Doghouse, which earns only in a fenced yard, and the Treehouse, which needs a Tree,
  // each get a yard of their own around a Lawn and a Fence; one Lawn and one Fence can serve
  // both, and the Backyard too.
  dogRun: {
    id: 'dogRun',
    name: 'Dog Run',
    tier: 'core',
    members: { doghouse: 1, lawn: 1, fence: 1 },
    connected: true,
    maxInstances: 1,
    points: 10,
    mult: 50,
    level: { points: 8, mult: 25 },
  },
  playYard: {
    id: 'playYard',
    name: 'Play Yard',
    tier: 'core',
    members: { treehouse: 1, lawn: 1, fence: 1 },
    connected: true,
    maxInstances: 1,
    points: 10,
    mult: 50,
    level: { points: 8, mult: 25 },
  },
  // The Garage and the Driveway, the two cards played least (7% and 4% of offers): each was
  // the other's only reason. Two pieces, so it pays least.
  driveIn: {
    id: 'driveIn',
    name: 'Drive-In',
    tier: 'core',
    members: { garage: 1, driveway: 1 },
    connected: true,
    maxInstances: 1,
    points: 10,
    mult: 25,
    level: { points: 8, mult: 25 },
  },
  // One of each of the 9 Core indoor types; they needn't touch. The game's one set Sparkle.
  // ×1.5 since D-140 (was ×2): while the Garage could only be built by the street or a Driveway,
  // greedy held this set in 1.5% of runs. Built like any room, it's held in about 20%, from a
  // median week 23, and at ×2 those runs' final Wow nearly doubled (×1.95 against the same seeds
  // before); at ×1.5 it's about ×1.5. A Garage nothing reaches still counts (D-070).
  fullHouse: {
    id: 'fullHouse',
    name: 'Full House',
    tier: 'core',
    members: {
      bedroom: 1,
      bathroom: 1,
      kitchen: 1,
      diningRoom: 1,
      livingRoom: 1,
      closet: 1,
      hallway: 1,
      garage: 1,
      homeOffice: 1,
    },
    connected: false,
    maxInstances: 1,
    points: 40,
    mult: 100,
    times: 150,
    level: { points: 20, mult: 50 },
  },
};
