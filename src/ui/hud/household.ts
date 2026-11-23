// The household's arrivals as the UI words them (M4b, D-103): who's moving in, when, and what
// they bring. The rules hold the data (each client's `household`); this only phrases it, for the
// job board, the checklist, the reserve, the inspect panel, and the arrival's banner. D-160:
// likewise where any card in the reserve's extra slots came from: the crew, an arrival, the
// client, the standing stock, (D-188) the wrong delivery, or (D-205) the lot's wish.

import {
  CONTENT,
  eachMilestone,
  rules,
  type ArrivalDef,
  type ArrivalId,
  type ClientDef,
  type ClientId,
  type CrewId,
  type PieceId,
  reserveSource,
  type ReservePiece,
  type RunState,
  type TerrainId,
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

/**
 * The arrivals the checklist lists under the household's lines: everyone still to come, or, for a
 * household that grows each milestone (D-219: the Bigsbys' five), only who's next.
 */
export function checklistArrivals(s: RunState): readonly ArrivalDef[] {
  const coming = upcomingArrivals(s);
  return eachMilestone(CONTENT.clients[s.setup.clientId].household) ? coming.slice(0, 1) : coming;
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

/**
 * Overtime weeks used so far: each makes the run a week longer (D-041), arrivals included. The
 * milestones' own counts and the overtime week on now, since D-206's gift can lift the weeks
 * left past what the run started with. A run that ends in an overtime week keeps that week on
 * the state, and its last milestone has counted it already, so it counts once.
 */
export function overtimeUsed(s: RunState): number {
  const over = s.screen === 'won' || s.screen === 'lost';
  return s.milestones.reduce((n, m) => n + m.overtimeUsed, 0) + (over ? 0 : s.overtimeWeek);
}

/**
 * The top bar's overtime clocks: one for every overtime week the run has had, the rule's and any
 * neighbor's gift (D-206), the spent ones after those left. Weeks used before the gift stay
 * spent clocks, so the bar never shows fewer weeks than the run has had.
 */
export function overtimeClocks(s: RunState): { total: number; left: number } {
  const left = Math.max(0, s.overtimeLeft);
  return { total: Math.max(rules.rule(s, 'overtime'), overtimeUsed(s) + left), left };
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
 * it: its slot's tag ("Crew", "Twins", "Dale", "Stock", "Mix-up", "Storage", "Pond"), whose it
 * is mid-sentence for the slot's tip (" (with the twins)"), and Inspect's line ("Came with the
 * twins"), or the whole of Inspect's note where it says more (a refilled stock's, the wrong
 * delivery's, a company upgrade's). Null for a card in the reserve's own slots (bought, picked or
 * copied).
 */
export function extraSlotWords(
  clientId: ClientId,
  r: ReservePiece,
  /** The run's crew: a card from its stock (D-171) says another comes each milestone. */
  crewId?: CrewId,
  /** D-205: the feature whose wish paid the run's prize (`RunState.wishFilled`). */
  wishFrom?: TerrainId,
): { tag: string; whose: string; from: string; note?: string } | null {
  // One case per mark (shop.ts' reserveSource): a new one doesn't compile until it's worded.
  switch (reserveSource(r)) {
    case 'own':
      return null;
    case 'crew': {
      // D-171: a crew's card comes from its stock, one each milestone; a starting card (M4b)
      // came once. The note is the stock's, in as many words (16).
      const stocked = !!crewId && (CONTENT.crews[crewId].stock ?? []).includes(r.id);
      return {
        tag: 'Crew',
        whose: ' (your crew’s)',
        from: stocked ? 'From your crew' : 'Your crew’s, from the start',
        ...(stocked && {
          note: 'From your crew, in an extra slot, not one of your reserve’s. Another comes each milestone.',
        }),
      };
    }
    case 'arrival': {
      const member = arrivalOf(clientId, r.arrival!);
      if (!member) return null;
      return {
        tag: arrivalTag(member),
        whose: ` (with ${midName(member)})`,
        from: `Came with ${midName(member)}`,
      };
    }
    case 'client': {
      const client = CONTENT.clients[clientId];
      const name = clientMid(client);
      const tag = client.name.replace(/^The\s+/, '');
      return {
        tag,
        whose: ` (${possessive(name)})`,
        from: `${name.charAt(0).toUpperCase() + name.slice(1)} brought it`,
      };
    }
    case 'stock':
      return {
        tag: 'Stock',
        whose: ' (from your stock)',
        from: 'From your stock',
        // D-169: a refilled stock's note says so, in as many words as the others' (16).
        ...(CONTENT.balance.standingStock.refill && {
          note: 'From your stock, in an extra slot, not one of your reserve’s. Another comes each milestone.',
        }),
      };
    case 'surprise':
      // D-188: the wrong delivery, once a run. Its note is the stock's and the crew's length (16).
      return {
        tag: 'Mix-up',
        whose: ' (delivered by mistake)',
        from: 'Delivered by mistake',
        note: 'Delivered here by mistake: yours to keep, in an extra slot, not one of your reserve’s.',
      };
    case 'upgrade': {
      // D-209: a company upgrade's piece (the Storage Unit's), one each milestone. Its tag is
      // the upgrade's first word, and its note is the stock's length (16).
      const name = CONTENT.upgrades[r.upgrade!].name;
      return {
        tag: name.split(' ')[0]!,
        whose: ` (from your ${name})`,
        from: `From your ${name}`,
        note: `From your ${name}: an extra slot, not one of your reserve’s. Another comes each milestone.`,
      };
    }
    case 'wish': {
      // D-205: the lot's wish's prize, for the pieces built beside its feature.
      if (!wishFrom) return null;
      const name = CONTENT.features[wishFrom].name;
      return {
        tag: name,
        whose: ` (from the ${name})`,
        from: `For keeping the ${name} company`,
      };
    }
  }
}
