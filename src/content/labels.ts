// The score's names (D-019, implementation-plan.md §12). The code says points / mult / xMult /
// total; players see these words. They live here, in one place, so a playtest can rename them.

export const SCORE_LABELS = {
  points: 'Comfort',
  mult: 'Charm',
  xMult: 'Sparkle',
  total: 'Wow',
} as const;
