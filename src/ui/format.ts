// Number formatting (implementation-plan.md §12, Numbers). Formatting isn't scoring: the UI
// never computes a score, it only shows the rules' numbers.

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
