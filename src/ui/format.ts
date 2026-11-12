// Number formatting (implementation-plan.md §12, Numbers), and where a long name may break.
// Formatting isn't scoring: the UI never computes a score, it only shows the rules' numbers.

const commas = new Intl.NumberFormat('en-US');

/** Whole numbers with commas; K and M suffixes above a million, scientific above 10^12. */
export function formatNumber(n: number, compact = false): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return n.toExponential(2).replace('e+', 'e');
  if (compact && abs >= 1e6) {
    return `${(n / 1e6).toFixed(abs >= 1e8 ? 0 : 1).replace(/\.0$/, '')}M`;
  }
  return commas.format(Math.round(n));
}

/** Mult is kept in hundredths: 250 → "2.5", 225 → "2.25", 100 → "1". */
export function formatMult(hundredths: number): string {
  return (hundredths / 100).toFixed(2).replace(/\.?0+$/, '');
}

export function signed(n: number, f: (n: number) => string = formatNumber): string {
  if (n > 0) return `+${f(n)}`;
  if (n < 0) return `−${f(-n)}`;
  return '±0';
}

/**
 * Where a name's long words may break across lines, for the narrow boxes that hold a name (a
 * card's title, a polaroid's caption): soft hyphens, so "Soundproofing" breaks as "Sound-" and
 * "proofing", and only where a line needs it. Chrome hyphenates no capitalized word (hyphens:
 * auto leaves it whole), and overflow-wrap would break it anywhere ("Soundproofin", "g"), so
 * the UI says where. Display only: the content's names stay as they are (they're in the content
 * hash). format.test.ts fails on a long word a card shows that's neither here nor on its list of
 * words measured to fit (FITS).
 */
export const SOFT_BREAKS: Readonly<Record<string, string>> = {
  // Milestones (the end screen's polaroids)
  Groundbreaking: 'Ground\u00ADbreaking',
  Foundation: 'Foun\u00ADdation',
  Walkthrough: 'Walk\u00ADthrough',
  // Goods: a card's title is 84 UI px wide, 11 letters of the bold pixel font ("Entertainer"
  // fills it), and 72 beside a blueprint's icon on a short window (D-141). Entertainer isn't
  // listed: it fits, and a soft hyphen moved "Remodel Plans: Entertainer"'s break off its space.
  Soundproofing: 'Sound\u00ADproofing',
  Waterfront: 'Water\u00ADfront',
};

/**
 * A name with soft hyphens in its long words (SOFT_BREAKS). Only the list's own words: a word
 * like "constructor" is the plain object's too.
 */
export function breakable(name: string): string {
  return name
    .split(' ')
    .map((w) => (Object.hasOwn(SOFT_BREAKS, w) ? SOFT_BREAKS[w]! : w))
    .join(' ');
}
