// D-122 (score legibility, the jam slice): which of a play's causes the board names. The rules
// split the change into parts that add up to it, biggest first (rules/attribution.ts); the board
// only chooses among them. A card says what it pays itself, so the label names the biggest
// other cause in the same direction ("▲ +139 Wow · Suite"), and a big part pulling the other
// way, which the net would hide, gets a line of its own ("▼ −68 Wow · Cozy off").

import { SCORE_LABELS, type Preview, type WowPart } from '../../rules/index.ts';
import { formatNumber } from '../format.ts';

/** A named cause must be at least this share of the change (1 in 4), and at least 2 Wow. */
const SHARE = 4;
const MIN_CAUSE = 2;
/** A hidden part must be at least this big, and at least a quarter of the change. */
const MIN_HIDDEN = 10;

type Parts = Pick<Preview, 'delta' | 'parts'>;

/**
 * The biggest cause of the change besides the card's own (the piece, or the installed fixture's
 * own Charm), when it's a real share of it. A change of 0 names its biggest gain, which pays
 * for the loss on the line under it. "Other changes" (rounding) is never named.
 */
export function mainCause(p: Parts): WowPart | null {
  const sign = p.delta < 0 ? -1 : 1;
  const cause = p.parts.find(
    (x) => Math.sign(x.wow) === sign && x.kind !== 'piece' && x.kind !== 'other',
  );
  if (!cause) return null;
  const size = Math.abs(cause.wow);
  return size >= MIN_CAUSE && size * SHARE >= Math.abs(p.delta) ? cause : null;
}

/** The biggest part pulling against the change (against a gain, when nothing changes), if big. */
export function hiddenPart(p: Parts): WowPart | null {
  const sign = p.delta < 0 ? 1 : -1;
  const part = p.parts.find((x) => Math.sign(x.wow) === sign && x.kind !== 'other');
  if (!part) return null;
  const size = Math.abs(part.wow);
  return size >= MIN_HIDDEN && size * SHARE >= Math.abs(p.delta) ? part : null;
}

/** " · Suite": the main cause as the label's suffix, or nothing. */
export function causeSuffix(p: Parts): string {
  const cause = mainCause(p);
  return cause ? ` · ${cause.label}` : '';
}

/** "▼ −68 Wow · Cozy off": a hidden part as a line of its own. */
export function partLine(part: WowPart): string {
  const arrow = part.wow > 0 ? '▲ +' : '▼ −';
  return `${arrow}${formatNumber(Math.abs(part.wow))} ${SCORE_LABELS.total} · ${part.label}`;
}
