// The run's result as one line to paste in the group chat (M6's copyable result line, D-135):
// the client and crew, the verdict, the final Wow, the milestones met, and a link that starts
// the same lot. The rules say every number; this only words them.
//
// The link points at Pages, by the build's channel, never at the page it was copied from: a
// run played in itch.io's iframe would otherwise link to the iframe's own address. A local
// build links to wherever it's served. The link is loadInitialRun's ?seed=&client=&crew=
// (store.ts), which starts the run with the same setup: the same lot, the same draws.

import { CONTENT, rules, SCORE_LABELS, type RunSetup, type RunState } from '../../rules/index.ts';
import { BUILD_CHANNEL, type Channel } from '../build-info.ts';
import { formatNumber } from '../format.ts';

/** Where the releases are served (D-063): develop's builds are at dev/ under it. */
export const PAGES_URL = 'https://swalliso.github.io/house-game/';

/** Where a shared link plays: Pages for a release (main) or develop (dev), else this page. */
export function shareBase(
  channel: Channel = BUILD_CHANNEL,
  here: { origin: string; pathname: string } = location,
): string {
  if (channel === 'main') return PAGES_URL;
  if (channel === 'dev') return `${PAGES_URL}dev/`;
  return `${here.origin}${here.pathname}`;
}

/** A link that starts a run on this lot, for this client, with this crew. */
export function lotLink(setup: RunSetup, base: string = shareBase()): string {
  const query = new URLSearchParams({
    seed: setup.seed,
    client: setup.clientId,
    crew: setup.crewId,
  });
  return `${base}?${query.toString()}`;
}

/**
 * The finished run in one line, such as "Open House · The Hendersons · General Contractor —
 * Charmer: 50,129 Wow, 7/7 milestones (1 early). Play this lot: <link>". A lost run says
 * where the client walked; a debug run says cheats were used.
 */
export function resultLine(s: RunState, base: string = shareBase()): string {
  const client = CONTENT.clients[s.setup.clientId].name;
  const crew = CONTENT.crews[s.setup.crewId].name;
  const phases = CONTENT.balance.phases.length;
  const met = s.milestones.filter((m) => m.result !== 'failed').length;
  const early = s.milestones.filter((m) => m.result === 'early').length;
  const parts = [`${formatNumber(s.score)} ${SCORE_LABELS.total}`];
  parts.push(`${met}/${phases} milestones${early > 0 ? ` (${early} early)` : ''}`);
  if (s.screen === 'lost') parts.push(`the client walked at ${rules.phaseName(s.phase)}`);
  if (s.debug) parts.push('cheats used');
  return (
    `Open House · ${client} · ${crew} — ${rules.verdict(s)}: ${parts.join(', ')}. ` +
    `Play this lot: ${lotLink(s.setup, base)}`
  );
}
