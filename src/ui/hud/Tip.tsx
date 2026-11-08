// Tooltips for the game's terms (D-077, D-086). The text comes from the rules: a glossary term
// (built from the content's numbers), or a line's own text, such as a checklist rule's card
// text. Hover or focus to see it; the bubble lives in one fixed layer, so a scrolling panel
// never clips it.
//
// M5a draws the bubble as a paper note with a pixel tail pointing at its term. It's placed on
// whole device pixels (no translate(-50%)), so its pixel text stays crisp, over its term or under
// it, whichever has room for it, and kept inside the window (tip-place.ts).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { CONTENT, glossary, type Term } from '../../rules/index.ts';
import { Icon } from '../kit/kit.tsx';
import { appScreen } from '../store.ts';
import { devicePixelRatio, uiPixel } from '../theme/pixel.ts';
import { placeTip } from './tip-place.ts';
import './tip.css';

const GLOSSARY = glossary(CONTENT);

/**
 * The warning sign (U+26A0), the one symbol in the rules' words that the pixel fonts lack: the
 * glossary's Requirements tip says a piece that earns nothing shows one on the board (text.ts).
 * By its code point, since glyphs.test.ts looks for the symbol itself in the HUD's code. Its
 * emoji form (U+FE0F after it) goes with it.
 */
const WARNING_SIGN = new RegExp(
  `${String.fromCodePoint(0x26a0)}${String.fromCodePoint(0xfe0f)}?`,
  'u',
);

/**
 * A tip's words with the warning icon for each warning sign in them, in both fonts, so the
 * bubble never falls back to the system font for it (D-098, D-110). Each icon keeps to one line
 * with the characters it touches, as the sign did (tip.css), so a line never ends on the "(" of
 * "(sign on the board)" with the icon on the next. Screen readers read the icon as the sign.
 */
export function tipWords(words: string): ComponentChildren {
  const parts = words.split(WARNING_SIGN);
  if (parts.length === 1) return words;
  const out: ComponentChildren[] = [];
  let rest = parts[0]!;
  parts.slice(1).forEach((next, k) => {
    const before = /\S*$/.exec(rest)![0];
    const after = /^\S*/.exec(next)![0];
    out.push(
      rest.slice(0, rest.length - before.length),
      <span key={k} class="tip-sign">
        {before}
        <Icon name="warn" label="warning sign" />
        {after}
      </span>,
    );
    rest = next.slice(after.length);
  });
  out.push(rest);
  return out;
}

interface Shown {
  /** The Tip that showed it: only that one hides it again. */
  owner: object;
  title: string;
  text: string;
  /** The term's middle, and its top and bottom edges, in viewport px (tip-place.ts). */
  x: number;
  top: number;
  bottom: number;
}

const shown = signal<Shown | null>(null);

function show(owner: object, title: string, text: string, el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  shown.value = { owner, title, text, x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
}

function hide(owner: object): void {
  if (shown.value?.owner === owner) shown.value = null;
}

/** A glossary term's tip, or one with its own title and text (a checklist line's rule). */
type TipProps =
  | { term: Term; title?: never; text?: never; children: ComponentChildren }
  | { term?: never; title: string; text: string; children: ComponentChildren };

/**
 * A term with a tip. It uses hooks, so a component that tests call in place, outside a render
 * (the controls strip, Notes, EndCaption), must not render one.
 */
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

/**
 * The one tooltip bubble, rendered once by the app. It's placed once its height is known
 * (tip-place.ts): measured after it renders, and moved before the browser paints it.
 */
export function TipLayer() {
  const t = shown.value;
  const ref = useRef<HTMLDivElement>(null);
  const dpr = devicePixelRatio.value;
  // A new screen starts without one, whatever the last screen left up.
  const screen = appScreen.value;
  useEffect(() => {
    shown.value = null;
  }, [screen]);
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
  return (
    <div ref={ref} id="tip-bubble" role="tooltip" class="tip-bubble ui">
      <strong class="tip-title">{tipWords(t.title)}</strong>
      <span>{tipWords(t.text)}</span>
    </div>
  );
}
