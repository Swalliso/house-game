// Tooltips for the game's terms (D-077, the light pass with the shop). The text comes from the
// rules' glossary, built from the content's numbers. Hover or focus a term to see it; the
// bubble lives in one fixed layer, so a scrolling panel never clips it.
//
// M5a draws the bubble as a paper note with a pixel tail pointing at its term. It's placed on
// whole device pixels (no translate(-50%)), so its pixel text stays crisp, and kept inside the
// window (tip-place.ts).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { CONTENT, glossary, type Term } from '../../rules/index.ts';
import { devicePixelRatio, uiPixel } from '../theme/pixel.ts';
import { placeTip } from './tip-place.ts';
import './tip.css';

const GLOSSARY = glossary(CONTENT);

const shown = signal<{ term: Term; x: number; top: number; bottom: number; below: boolean } | null>(
  null,
);

function show(term: Term, el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  const below = r.top < 160;
  shown.value = { term, x: r.left + r.width / 2, top: r.top, bottom: r.bottom, below };
}

export function Tip({ term, children }: { term: Term; children: ComponentChildren }) {
  return (
    <span
      class="tip"
      tabIndex={0}
      aria-describedby="tip-bubble"
      onMouseEnter={(e) => show(term, e.currentTarget)}
      onMouseLeave={() => (shown.value = null)}
      onFocus={(e) => show(term, e.currentTarget)}
      onBlur={() => (shown.value = null)}
    >
      {children}
    </span>
  );
}

/** The one tooltip bubble, rendered once by the app. */
export function TipLayer() {
  const t = shown.value;
  if (!t) return null;
  const g = GLOSSARY[t.term];
  const dpr = devicePixelRatio.value;
  const at = placeTip(t, { w: window.innerWidth, h: window.innerHeight }, uiPixel(dpr), dpr);
  const place = at.top !== undefined ? { top: `${at.top}px` } : { bottom: `${at.bottom}px` };
  return (
    <div
      id="tip-bubble"
      role="tooltip"
      class={`tip-bubble ui ${t.below ? 'below' : ''}`}
      style={{ left: `${at.left}px`, ...place, '--tail-x': `${at.tail}px` }}
    >
      <strong class="tip-title">{g.title}</strong>
      <span>{g.text}</span>
    </div>
  );
}
