// Bot policies for the headless sim (implementation-plan.md §8). A policy picks one action at
// a time from the rules' own queries; the sim (and the ?debug panel) drive it through apply().
// Policies are pure: randomness comes from a keyed stream the caller passes in, so the same
// seed and policy always play the same game.

import type { Action, Rng, Rules, RunState } from '../../src/rules/index.ts';
import { greedy } from './greedy.ts';
import { random } from './random.ts';

export interface Policy {
  name: string;
  act(rules: Rules, state: RunState, rng: Rng): Action;
}

export const POLICIES: Readonly<Record<string, Policy>> = { random, greedy };

export { greedy, random };
