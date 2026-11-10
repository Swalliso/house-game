// Bot policies for the headless sim (implementation-plan.md §8). A policy picks one action at
// a time from the rules' own queries; the sim (and the ?debug panel) drive it through apply().
// Policies are pure: randomness comes from a keyed stream the caller passes in, so the same
// seed and policy always play the same game.
//
// - random: a random legal play; the floor the targets must beat.
// - novice: a random card that fits, at its best spot; the floor for "milestone 1 teaches".
// - greedy: the best exact play this week, with the shop bot; makeGreedy() builds its
//   variants (early completion, strikes), which share its name and so its streams.

import type { Action, Rng, Rules, RunState } from '../../src/rules/index.ts';
import { greedy, makeGreedy } from './greedy.ts';
import { novice } from './novice.ts';
import { random } from './random.ts';

export interface Policy {
  /** Keys the bot's random streams, so variants that share a name play the same seeds alike. */
  name: string;
  /** For reports, when variants share a name: "greedy · early always". Defaults to `name`. */
  label?: string;
  act(rules: Rules, state: RunState, rng: Rng): Action;
}

export type { EarlyMode, GreedyOptions } from './greedy.ts';
export type { StrikeMode } from './shop.ts';

export const POLICIES: Readonly<Record<string, Policy>> = { random, greedy, novice };

export { greedy, makeGreedy, novice, random };
