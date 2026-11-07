// The camera (implementation-plan.md §12, Art; D-057, D-097). It zooms by changing the board's
// scale (CSS px per art px; a cell is CELL × scale CSS px) and re-laying it out, never with
// transform: scale(), which blurs pixel art in Safari. Zoom levels are whole device pixels per
// art pixel, from one device pixel up to 3×: 1×, 2× and 3× at a devicePixelRatio of 1, and
// 0.5× steps on a Retina screen. The default (fitScale) is always one of them, 1× rounded down
// to whole device pixels where display scaling isn't a whole number, and the Fit overview is
// the one fractional scale. The board pans with its scroll container (drag, or the middle
// button), and a zoom keeps the point under the pointer (or the middle of the view) where it was.

import { computed, signal } from '@preact/signals';
import { FEEL } from '../fx/feel.ts';
import { CELL } from '../sprites.ts';
import { defaultFloor, fitScale, overviewScale, snapZoom, zoomStep } from './geometry.ts';

/**
 * The player's zoom: null for the default (fitScale, which follows the window), both at first
 * and once a zoom step lands back on it; a scale the player picked (kept when the window
 * resizes, and snapped to whole device pixels on another screen); or 'fit' (recomputed).
 */
export const zoom = signal<number | 'fit' | null>(null);

/**
 * The space the board has, in CSS px, and the devicePixelRatio it was measured at (moving the
 * window to another screen changes the default and Fit scales); set by the board.
 */
export const viewSize = signal<{ width: number; height: number; dpr: number } | null>(null);
/** The lot's size in tiles, not counting the street row; set by the board. */
export const lotSize = signal<{ width: number; height: number }>({ width: 24, height: 24 });

/** The devicePixelRatio the board was measured at, or the window's before it measures. */
function currentDpr(): number {
  return viewSize.value?.dpr ?? (window.devicePixelRatio || 1);
}

/** The scale the board draws at: CSS px per art pixel. */
export const cameraScale = computed<number>(() => {
  const z = zoom.value;
  const view = viewSize.value;
  const lot = lotSize.value;
  const dpr = currentDpr();
  if (typeof z === 'number') return snapZoom(z, dpr);
  // Before the board first measures: the default's floor, one of this screen's steps.
  if (!view) return defaultFloor(dpr);
  return z === 'fit'
    ? overviewScale(view.width, view.height, lot.width, lot.height, dpr)
    : fitScale(view.width, view.height, lot.width, lot.height, dpr);
});

export const isFit = computed(() => zoom.value === 'fit');

/** The scroll container and the board, registered by the board for anchoring zooms. */
export const cameraEls: { scroll: HTMLElement | null; board: HTMLElement | null } = {
  scroll: null,
  board: null,
};

interface Anchor {
  /** The lot point (in cells) that should stay put… */
  lotX: number;
  lotY: number;
  /** …at this screen point. */
  clientX: number;
  clientY: number;
}

let pendingAnchor: Anchor | null = null;
/** The scale the board's DOM is laid out at right now (it lags a zoom by one render). */
let renderedScale = 1;
let beforeFit: number | null = null;

/** The lot point under a screen point, or under the middle of the view. */
function anchorAt(at?: { clientX: number; clientY: number }): Anchor | null {
  const { scroll, board } = cameraEls;
  if (!scroll || !board) return null;
  const s = scroll.getBoundingClientRect();
  const clientX = at?.clientX ?? s.left + s.width / 2;
  const clientY = at?.clientY ?? s.top + s.height / 2;
  const b = board.getBoundingClientRect();
  const px = CELL * renderedScale;
  return { lotX: (clientX - b.left) / px, lotY: (clientY - b.top) / px, clientX, clientY };
}

function setZoom(next: number | 'fit' | null, at?: { clientX: number; clientY: number }): void {
  const anchor = anchorAt(at);
  zoom.value = next;
  // Only a real change re-lays out the board; a stale anchor would jump the next one.
  pendingAnchor = cameraScale.value !== renderedScale ? anchor : null;
}

/**
 * After the board re-lays out at a new scale: scrolls so the anchored lot point is back under
 * the pointer (or the middle of the view). The board calls this from a layout effect.
 */
export function applyZoomAnchor(scale: number): void {
  renderedScale = scale;
  const a = pendingAnchor;
  pendingAnchor = null;
  const { scroll, board } = cameraEls;
  if (!a || !scroll || !board) return;
  const b = board.getBoundingClientRect();
  const px = CELL * scale;
  scroll.scrollLeft += b.left + a.lotX * px - a.clientX;
  scroll.scrollTop += b.top + a.lotY * px - a.clientY;
}

/**
 * One step in or out, in whole device pixels per art pixel. From Fit, the first step rounds. A
 * step that lands on the default goes back to it, so the board follows the window again.
 */
function step(dir: 1 | -1, at?: { clientX: number; clientY: number }): void {
  const s = cameraScale.value;
  const dpr = currentDpr();
  const next = zoomStep(s, dir, dpr);
  if (next === s) return;
  const view = viewSize.value;
  const lot = lotSize.value;
  const home = view ? fitScale(view.width, view.height, lot.width, lot.height, dpr) : null;
  setZoom(next === home ? null : next, at);
}

export function zoomIn(at?: { clientX: number; clientY: number }): void {
  step(1, at);
}

export function zoomOut(at?: { clientX: number; clientY: number }): void {
  step(-1, at);
}

/** Fit shows the whole lot; pressing it again goes back to the zoom from before. */
export function toggleFit(): void {
  if (zoom.value === 'fit') {
    setZoom(beforeFit);
    return;
  }
  beforeFit = zoom.value;
  setZoom('fit');
}

export function canZoomIn(): boolean {
  const s = cameraScale.value;
  return zoomStep(s, 1, currentDpr()) !== s;
}

export function canZoomOut(): boolean {
  const s = cameraScale.value;
  return zoomStep(s, -1, currentDpr()) !== s;
}

let wheelTravel = 0;
let lastWheel = -Infinity;
let lastStep = -Infinity;

/**
 * The mouse wheel zooms in whole steps at the pointer. A gesture's first event steps at once
 * (one notch, one step); a long trackpad scroll steps once per FEEL.camera.wheelStepPx.
 */
export function wheelZoom(e: WheelEvent): void {
  const now = performance.now();
  const lines = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
  // A trackpad pinch arrives as ctrl + small deltas.
  const dy = e.deltaY * lines * (e.ctrlKey ? 4 : 1);
  if (dy === 0) return;
  const fresh = now - lastWheel > FEEL.camera.wheelGestureMs;
  lastWheel = now;
  if (fresh || Math.sign(dy) !== Math.sign(wheelTravel)) wheelTravel = 0;
  wheelTravel += dy;
  const due =
    fresh ||
    (Math.abs(wheelTravel) >= FEEL.camera.wheelStepPx &&
      now - lastStep >= FEEL.camera.wheelStepGapMs);
  if (!due) return;
  lastStep = now;
  wheelTravel = 0;
  if (dy < 0) zoomIn(e);
  else zoomOut(e);
}
