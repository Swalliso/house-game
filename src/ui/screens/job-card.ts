// What a contract's card says in short (D-142). A card leads with what differs between the
// clients on the board: who they are, their wishes and the lot. The household and the tastes are
// a line each, with the whole of it in the line's tip, in the rules' own words (text.ts). This
// only chooses and counts: every sentence comes from the rules and the content.

import {
  CONTENT,
  modifierText,
  rules,
  specText,
  type ArrivalDef,
  type ClientDef,
  type Modifier,
  type SpecDef,
} from '../../rules/index.ts';
import { arrivalWeek, isPlural, midName } from '../hud/household.ts';

/** Whether a taste helps (a like, a bonus) or hurts (a dislike). */
export function helps(mod: Modifier): boolean {
  if (mod.kind === 'earnNothing' || mod.kind === 'removeTag') return false;
  if ('pct' in mod && typeof mod.pct === 'number') return mod.pct >= 0;
  if ('add' in mod && typeof mod.add === 'number') return mod.add >= 0;
  return true;
}

/** "2–3 Bedrooms to start": the household's opening range. */
export function bedroomsText(client: ClientDef): string {
  const [min, max] = client.household.bedrooms;
  return `${min === max ? min : `${min}–${max}`} Bedrooms to start`;
}

/**
 * Who joins the household mid-run (D-103), in a line: "The twins and Grandma move in later",
 * "Renfield moves in later". A household that doesn't grow says its Bedrooms.
 */
export function householdLine(client: ClientDef): string {
  const arrivals: readonly ArrivalDef[] = client.household.arrivals;
  if (arrivals.length === 0) return bedroomsText(client);
  const names = arrivals.map((a, k) => (k === 0 ? a.name : midName(a)));
  const who =
    names.length <= 2
      ? names.join(' and ')
      : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  const plural = arrivals.length > 1 || isPlural(arrivals[0]!);
  return `${who} ${plural ? 'move' : 'moves'} in later`;
}

/**
 * The household's tip: Room for everyone in this client's numbers, then a line for each arrival,
 * when they come and what they bring.
 */
export function householdTip(client: ClientDef): string {
  const rule = client.specs.find((s) => s.id === 'roomForEveryone');
  const lines = rule ? [specText(CONTENT, rule)] : [bedroomsText(client)];
  for (const a of client.household.arrivals) {
    lines.push(`${rules.phaseName(a.phase)} (week ${arrivalWeek(a)}): ${a.text}`);
  }
  return lines.join('\n');
}

/** How many of the client's tastes help, how many hurt, and how many change the draw. */
export function tasteCounts(client: ClientDef): { likes: number; dislikes: number; draws: number } {
  const likes = client.tastes.filter(helps).length;
  return { likes, dislikes: client.tastes.length - likes, draws: client.pool.length };
}

/** The tastes' tip, a line each: what they like, what they dislike, then what's drawn more. */
export function tastesTip(client: ClientDef): string {
  const line = (word: string, m: Modifier) => `${word}: ${modifierText(CONTENT, m)}`;
  return [
    ...client.tastes.filter(helps).map((m) => line('Likes', m)),
    ...client.tastes.filter((m) => !helps(m)).map((m) => line('Dislikes', m)),
    ...client.pool.map((m) => line('Draws', m)),
  ].join('\n');
}

/**
 * The house rules this client has in numbers of their own (D-101: a wish that repeats a house
 * rule becomes that client's numbers for it): Juniper's Under one roof, for 4–8 rooms. The card
 * lists them with the wishes, since the board names the house rules only once. Room for everyone
 * is every client's own, and the household's line covers it.
 */
export function ownHouseRules(client: ClientDef): SpecDef[] {
  const others = Object.values(CONTENT.clients).filter((c) => c.id !== client.id);
  return client.specs.filter((spec) => {
    if (spec.group === 'wishes' || spec.id === 'roomForEveryone') return false;
    const text = specText(CONTENT, spec);
    const shared = others.filter((c) =>
      c.specs.some((o) => o.id === spec.id && specText(CONTENT, o) === text),
    ).length;
    return shared * 2 < others.length;
  });
}
