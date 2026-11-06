// The UI pixel (M5a): the interface's chrome is drawn in its own pixel, 2 CSS px at the 1080p
// design target, kept on whole device pixels. tokens.css reads it as --px; every outline,
// frame, shadow offset, spacing step and pixel-font size is a whole number of it. The board's
// art keeps the camera's own scale (D-097).

import { signal } from '@preact/signals';

/** The page's devicePixelRatio, kept current, for whatever sizes itself in device pixels. */
export const devicePixelRatio = signal(
  typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
);

/**
 * Device px per UI pixel: 2 × devicePixelRatio, rounded to a whole number (down on a tie, as
 * the title's street rounds its tiles), and at least 1. 2 at 1×, 2 at 1.25 (2.5 → 2), 3 at
 * 1.5, 4 at 2.
 */
export function uiPixelDevice(dpr: number): number {
  const x = 2 * (Number.isFinite(dpr) && dpr > 0 ? dpr : 1);
  const down = Math.floor(x);
  return Math.max(1, x - down > 0.5 ? down + 1 : down);
}

/** The UI pixel in CSS px: 2 at 1× and 2×, 1.6 at 125%, 2 at 150%. */
export function uiPixel(dpr: number): number {
  return uiPixelDevice(dpr) / (Number.isFinite(dpr) && dpr > 0 ? dpr : 1);
}

let watching: MediaQueryList | null = null;

/** Sets --px on the page and keeps it right when the window moves to another screen or zooms. */
export function applyUiPixel(): void {
  const dpr = window.devicePixelRatio || 1;
  devicePixelRatio.value = dpr;
  document.documentElement.style.setProperty('--px', `${uiPixel(dpr)}px`);
  watching?.removeEventListener('change', applyUiPixel);
  try {
    watching = window.matchMedia(`(resolution: ${dpr}dppx)`);
    watching.addEventListener('change', applyUiPixel);
  } catch {
    watching = null;
  }
}

/**
 * A sprite's scale for a small picture in the interface (a hand card's piece): about 1 CSS px
 * per art px, kept on whole device pixels (1 at 1× and 2×, 0.8 at 125%, 0.67 at 150%).
 */
export function pictureScale(dpr: number): number {
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const down = Math.floor(d);
  return Math.max(1, d - down > 0.5 ? down + 1 : down) / d;
}
