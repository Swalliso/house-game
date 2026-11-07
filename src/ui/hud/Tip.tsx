// Tooltips for the game's terms (D-077, D-086). The text comes from the rules: a glossary term
// (built from the content's numbers), or a line's own text, such as a checklist rule's card
// text. Hover or focus to see it; the bubble lives in one fixed layer, so a scrolling panel
// never clips it.

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { CONTENT, glossary, type Term } from '../../rules/index.ts';
import { appScreen } from '../store.ts';

const GLOSSARY = glossary(CONTENT);

interface Shown {
  /** The Tip that showed it: only that one hides it again. */
  owner: object;
  title: string;
  text: string;
  x: number;
  y: number;
  below: boolean;
}

const shown = signal<Shown | null>(null);

function show(owner: object, title: string, text: string, el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  const below = r.top < 140;
  shown.value = {
    owner,
    title,
    text,
    x: r.left + r.width / 2,
    y: below ? r.bottom + 6 : r.top - 6,
    below,
  };
}

function hide(owner: object): void {
  if (shown.value?.owner === owner) shown.value = null;
}

type TipProps =
  | { term: Term; title?: never; text?: never; children: ComponentChildren }
  | { term?: never; title: string; text: string; children: ComponentChildren };

export function Tip(props: TipProps) {
  const title = props.term ? GLOSSARY[props.term].title : props.title!;
  const text = props.term ? GLOSSARY[props.term].text : props.text!;
  // Its bubble goes when it does: a key that changes the screen or the panel under the pointer
  // removes the Tip, and a removed element never hears a mouseleave or a blur.
  const owner = useRef<object>({}).current;
  useEffect(() => () => hide(owner), []);
  return (
    <span
      class="tip"
      tabIndex={0}
      aria-describedby="tip-bubble"
      onMouseEnter={(e) => show(owner, title, text, e.currentTarget)}
      onMouseLeave={() => hide(owner)}
      onFocus={(e) => show(owner, title, text, e.currentTarget)}
      onBlur={() => hide(owner)}
    >
      {props.children}
    </span>
  );
}

/** The one tooltip bubble, rendered once by the app. */
export function TipLayer() {
  const t = shown.value;
  // A new screen starts without one, whatever the last screen left up.
  const screen = appScreen.value;
  useEffect(() => {
    shown.value = null;
  }, [screen]);
  if (!t) return null;
  const left = Math.max(150, Math.min(window.innerWidth - 150, t.x));
  return (
    <div
      id="tip-bubble"
      role="tooltip"
      class={`tip-bubble ${t.below ? 'below' : ''}`}
      style={{ left: `${left}px`, top: `${t.y}px` }}
    >
      <strong>{t.title}</strong>
      <span>{t.text}</span>
    </div>
  );
}
