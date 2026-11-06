// Tooltips for the game's terms (D-077, the light pass with the shop). The text comes from the
// rules' glossary, built from the content's numbers. Hover or focus a term to see it; the
// bubble lives in one fixed layer, so a scrolling panel never clips it.

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { CONTENT, glossary, type Term } from '../../rules/index.ts';

const GLOSSARY = glossary(CONTENT);

const shown = signal<{ term: Term; x: number; y: number; below: boolean } | null>(null);

function show(term: Term, el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  const below = r.top < 140;
  shown.value = { term, x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below };
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
  const left = Math.max(150, Math.min(window.innerWidth - 150, t.x));
  return (
    <div
      id="tip-bubble"
      role="tooltip"
      class={`tip-bubble ${t.below ? 'below' : ''}`}
      style={{ left: `${left}px`, top: `${t.y}px` }}
    >
      <strong>{g.title}</strong>
      <span>{g.text}</span>
    </div>
  );
}
