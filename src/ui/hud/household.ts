// The household's arrivals as the UI words them (M4b, D-103): who's moving in, when, and what
// they bring. The rules hold the data (each client's `household`); this only phrases it, for the
// job board, the checklist, the reserve, the inspect panel, and the arrival's banner. D-160:
// likewise where any card in the reserve's extra slots came from: the crew, an arrival, the
// client, or the standing stock.

import {
  CONTENT,
  rules,
  type ArrivalDef,
  type ArrivalId,
  type ClientDef,
  type ClientId,
  type PieceId,
  type ReservePiece,
  type RunState,
} from '../../rules/index.ts';

const W = CONTENT.balance.weeksPerPhase;

/** The client's arrivals, in the order they come. */
export function arrivalsOf(clientId: ClientId): readonly ArrivalDef[] {
  return CONTENT.clients[clientId].household.arrivals;
}

export function arrivalOf(clientId: ClientId, id: ArrivalId): ArrivalDef | undefined {
  return arrivalsOf(clientId).find((a) => a.id === id);
}

/** The run's arrivals still to come. */
export function upcomingArrivals(s: RunState): readonly ArrivalDef[] {
  return arrivalsOf(s.setup.clientId).filter((a) => !s.arrived.includes(a.id));
}

/** "The twins" take a plural verb ("the twins arrive"); "Grandma arrives". */
export function isPlural(a: ArrivalDef): boolean {
  return /^the\s/i.test(a.name) && /s$/i.test(a.name);
}

/** A member's name mid-sentence: "the twins", "Grandma". */
export function midName(a: ArrivalDef): string {
  return a.name.replace(/^The\s/, 'the ');
}

/** The reserve's tag for a member's cards: "Twins", "Grandma". */
export function arrivalTag(a: ArrivalDef): string {
  const name = a.name.replace(/^the\s+/i, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Overtime weeks used so far: each makes the run a week longer (D-041), arrivals included. */
export function overtimeUsed(s: RunState): number {
  return Math.max(0, rules.rule(s, 'overtime') - s.overtimeLeft);
}

/**
 * The week an arrival lands: the first week of its phase, after any overtime used so far (more
 * overtime before then would push it back again).
 */
export function arrivalWeek(a: ArrivalDef, overtime = 0): number {
  return a.phase * W + 1 + overtime;
}

/** A card as a phrase: "a Nursery", "a Bathroom"; a possessive name takes no article. */
export function cardPhrase(id: PieceId): string {
  const name = CONTENT.pieces[id].name;
  if (name.includes('’')) return name;
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

/** "A Nursery", "Grandma’s Room and a Bathroom": a sentence's start. */
export function cardsPhrase(ids: readonly PieceId[]): string {
  const parts = ids.map(cardPhrase);
  const text =
    parts.length <= 2
      ? parts.join(' and ')
      : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Dale", "the Barkers": the client mid-sentence. */
export function clientMid(client: ClientDef): string {
  return client.name.replace(/^The\s/, 'the ');
}

/** "The Barkers" take a plural verb ("the Barkers bring"); "Dale brings". */
export function clientPlural(client: ClientDef): boolean {
  return /^the\s/i.test(client.name) && /s$/i.test(client.name);
}

/** "Dale’s", "the Barkers’". */
function possessive(name: string): string {
  return `${name}${name.endsWith('s') ? '’' : '’s'}`;
}

/**
 * Where a card in the reserve's extra slots came from (M4b, D-160), as Your goods and Inspect say
 * it: its slot's tag ("Crew", "Twins", "Dale", "Stock"), whose it is mid-sentence for the slot's
 * title (" (with the twins)"), and Inspect's line ("Came with the twins"). Null for a card in
 * the reserve's own slots (bought, picked or copied).
 */
export function extraSlotWords(
  clientId: ClientId,
  r: ReservePiece,
): { tag: string; whose: string; from: string } | null {
  if (r.crew) return { tag: 'Crew', whose: ' (your crew’s)', from: 'Your crew’s, from the start' };
  if (r.arrival !== undefined) {
    const member = arrivalOf(clientId, r.arrival);
    if (!member) return null;
    return {
      tag: arrivalTag(member),
      whose: ` (with ${midName(member)})`,
      from: `Came with ${midName(member)}`,
    };
  }
  if (r.client) {
    const client = CONTENT.clients[clientId];
    const name = clientMid(client);
    const tag = client.name.replace(/^The\s+/, '');
    return {
      tag,
      whose: ` (${possessive(name)})`,
      from: `${name.charAt(0).toUpperCase() + name.slice(1)} brought it`,
    };
  }
  if (r.stock) {
    return {
      tag: 'Stock',
      whose: ' (from your stock)',
      from: 'From your stock: another comes at the next milestone once it’s placed',
    };
  }
  return null;
}
