// Tooltips for the game's terms (D-077, the light pass with the shop). The text comes from the
// rules' glossary, built from the content's numbers. Hover or focus a term to see it; the
// bubble lives in one fixed layer, so a scrolling panel never clips it.
//
// M5a draws the bubble as a paper note with a pixel tail pointing at its term. It's placed on
// whole device pixels (no translate(-50%)), so its pixel text stays crisp, over its term or under
// it, whichever has room for it, and kept inside the window (tip-place.ts).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { CONTENT, glossary, type Term } from '../../rules/index.ts';
import { devicePixelRatio, uiPixel } from '../theme/pixel.ts';
import { placeTip } from './tip-place.ts';
import './tip.css';

const GLOSSARY = glossary(CONTENT);

const shown = signal<{ term: Term; x: number; top: number; bottom: number } | null>(null);

function show(term: Term, el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  shown.value = { term, x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
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

/**
 * The one tooltip bubble, rendered once by the app. It's placed once its height is known
 * (tip-place.ts): measured after it renders, and moved before the browser paints it.
 */
export function TipLayer() {
  const t = shown.value;
  const ref = useRef<HTMLDivElement>(null);
  const dpr = devicePixelRatio.value;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!t || !el) return;
    const view = { w: window.innerWidth, h: window.innerHeight };
    const at = placeTip(t, view, uiPixel(dpr), dpr, el.getBoundingClientRect().height);
    el.classList.toggle('below', at.below);
    el.style.left = `${at.left}px`;
    el.style.top = at.top !== undefined ? `${at.top}px` : '';
    el.style.bottom = at.bottom !== undefined ? `${at.bottom}px` : '';
    el.style.setProperty('--tail-x', `${at.tail}px`);
  });
  if (!t) return null;
  const g = GLOSSARY[t.term];
  return (
    <div ref={ref} id="tip-bubble" role="tooltip" class="tip-bubble ui">
      <strong class="tip-title">{g.title}</strong>
      <span>{g.text}</span>
    </div>
  );
}
