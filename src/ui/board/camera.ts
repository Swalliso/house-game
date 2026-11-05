// The camera (implementation-plan.md §12, Art; D-057). It zooms by changing the board's scale
// and re-laying it out, never with transform: scale(), which blurs pixel art in Safari. Zoom
// levels are whole numbers from 1× to 6×; the Fit overview is the one fractional scale. The
// board pans with its scroll container (drag, or the middle button), and a zoom keeps the
// point under the pointer (or the middle of the view) where it was.

import { computed, signal } from '@preact/signals';
import { FEEL } from '../fx/feel.ts';
import { TILE } from '../sprites.ts';
import { fitScale, overviewScale } from './geometry.ts';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

/**
 * The player's zoom: null until they pick one (the default, max(2, fitScale), follows the
 * window), a whole-number scale (kept when the window resizes), or 'fit' (recomputed).
 */
export const zoom = signal<number | 'fit' | null>(null);

/**
 * The space the board has, in CSS px, and the devicePixelRatio it was measured at (moving the
 * window to another screen changes the default and Fit scales); set by the board.
 */
export const viewSize = signal<{ width: number; height: number; dpr: number } | null>(null);
/** The lot's size in tiles, not counting the street row; set by the board. */
export const lotSize = signal<{ width: number; height: number }>({ width: 24, height: 24 });

/** The scale the board draws at: CSS px per sprite pixel. */
export const cameraScale = computed<number>(() => {
  const z = zoom.value;
  const view = viewSize.value;
  const lot = lotSize.value;
  if (typeof z === 'number') return z;
  if (!view) return 2;
  return z === 'fit'
    ? overviewScale(view.width, view.height, lot.width, lot.height)
    : fitScale(view.width, view.height, lot.width, lot.height);
});

export const isFit = computed(() => zoom.value === 'fit');

/** The scroll container and the board, registered by the board for anchoring zooms. */
export const cameraEls: { scroll: HTMLElement | null; board: HTMLElement | null } = {
  scroll: null,
  board: null,
};

interface Anchor {
  /** The lot point (in tiles) that should stay put… */
  lotX: number;
  lotY: number;
  /** …at this screen point. */
  clientX: number;
  clientY: number;
}

let pendingAnchor: Anchor | null = null;
/** The scale the board's DOM is laid out at right now (it lags a zoom by one render). */
let renderedScale = 2;
let beforeFit: number | null = null;

/** The lot point under a screen point, or under the middle of the view. */
function anchorAt(at?: { clientX: number; clientY: number }): Anchor | null {
  const { scroll, board } = cameraEls;
  if (!scroll || !board) return null;
  const s = scroll.getBoundingClientRect();
  const clientX = at?.clientX ?? s.left + s.width / 2;
  const clientY = at?.clientY ?? s.top + s.height / 2;
  const b = board.getBoundingClientRect();
  const px = TILE * renderedScale;
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
  const px = TILE * scale;
  scroll.scrollLeft += b.left + a.lotX * px - a.clientX;
  scroll.scrollTop += b.top + a.lotY * px - a.clientY;
}

/** One whole step in or out. From a fractional scale (Fit), the first step rounds. */
function step(dir: 1 | -1, at?: { clientX: number; clientY: number }): void {
  const s = cameraScale.value;
  const next =
    dir > 0
      ? Math.min(MAX_ZOOM, Math.floor(s + 1e-6) + 1)
      : Math.max(MIN_ZOOM, Math.ceil(s - 1e-6) - 1);
  if (dir > 0 ? next <= s : next >= s) return;
  setZoom(next, at);
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
  return cameraScale.value < MAX_ZOOM;
}

export function canZoomOut(): boolean {
  return cameraScale.value > MIN_ZOOM;
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
