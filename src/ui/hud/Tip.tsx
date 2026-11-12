// Tooltips (D-077, D-086), the game's one kind since D-077's 2026-11-12 note: every tip is this
// one paper note, never the browser's title tooltip (tips.test.tsx). A term's tip explains it: a
// glossary term (built from the content's numbers), or a line's own text, such as a checklist
// rule's card text, under a dotted underline (Tip). A control's tip says what it does or why it
// can't now: a button's, a chip's, a card's, a board badge's, an icon's label. An element asks
// for one with data-tip, its words, and for a note with a heading, data-tip-title; the kit's
// Button, Chip, Card and Switch take a `tip` for it, and an Icon's label is its tip.
//
// One listener on the document shows the note (TipLayer), so no component needs a hook for a
// tip, and the note lives in one fixed layer, so a scrolling panel never clips it. A control's
// tip shows once the pointer has rested on it (FEEL.tip); a term's at once, as does any tip just
// after another, and keyboard focus. A press, a key, a wheel or a scroll takes it away, and it
// stays away from that element until the pointer leaves it; none shows while a button is held,
// so never in a drag or a pan. It goes with its element, and with the screen. The note takes no
// pointer events and never takes focus.
//
// M5a draws the note in paper with a pixel tail pointing at its term. It's placed on whole device
// pixels (no translate(-50%)), so its pixel text stays crisp, over its term or under it,
// whichever has room for it, and kept inside the window (tip-place.ts). A tip with no heading is
// the compact note, as wide as its words up to the full note's width. Each of a tip's lines starts
// a new line in the note, and a compact note with several (a set chip's sets, one a line) is a
// list, so it may grow half as wide again: a hand card's three sets read 430 px tall in it at
// 1280×720, not 670.

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { CONTENT, glossary, type Term } from '../../rules/index.ts';
import { FEEL } from '../fx/feel.ts';
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
  /** The element whose tip it is. */
  el: HTMLElement;
  /** Shown by keyboard focus: the pointer moving off doesn't take it away, a blur does. */
  focus: boolean;
  /** The note's heading; a tip without one is the compact note. */
  title?: string;
  text: string;
  /** The element's middle, and its top and bottom edges, in viewport px (tip-place.ts). */
  x: number;
  top: number;
  bottom: number;
}

const shown = signal<Shown | null>(null);

/**
 * The element whose tip a node is in: the nearest with one. An icon's label yields to a term
 * around it (the budget's coin), and to its own element's tip (the arrivals' House), which say
 * more than the icon's name; a badge inside a card keeps its own (a swapped-in card's die).
 */
function tipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  let el = node.closest<HTMLElement>('[data-tip]');
  if (el?.classList.contains('icon')) {
    const around = el.parentElement?.closest<HTMLElement>('[data-tip]');
    if (around && (around === el.parentElement || around.classList.contains('tip'))) el = around;
  }
  return el?.dataset.tip ? el : null;
}

/** A control's tip waiting out FEEL.tip.delayMs. */
let waiting: { el: HTMLElement; timer: ReturnType<typeof setTimeout> } | null = null;
/** Pressed, or its tip taken away by a key or a scroll: none on it till the pointer leaves it. */
let quiet: HTMLElement | null = null;
/** When the pointer last moved off a tip that was up, for FEEL.tip.warmMs. */
let leftAt = -Infinity;
/** The last key was Tab: the focus it moves shows its tip (a script's focus after Esc doesn't). */
let tabbed = false;

function stopWaiting(): void {
  if (waiting) clearTimeout(waiting.timer);
  waiting = null;
}

function show(el: HTMLElement, focus: boolean): void {
  stopWaiting();
  const text = el.dataset.tip;
  const r = el.getBoundingClientRect();
  // Gone, or not drawn: nothing to point at.
  if (!text || !el.isConnected || (r.width === 0 && r.height === 0)) return;
  const title = el.dataset.tipTitle || undefined;
  shown.value = { el, focus, title, text, x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
}

function hide(): void {
  stopWaiting();
  shown.value = null;
}

/** The pointer onto an element: its tip, at once or after the delay, in place of the last. */
function onOver(e: PointerEvent): void {
  if (e.pointerType === 'touch') return;
  const el = tipTarget(e.target);
  const now = shown.value;
  if (el && (el === now?.el || el === waiting?.el)) return;
  stopWaiting();
  // Off every tip (a focused one stays), onto one just pressed, or with a button held: a drag
  // or a pan shows none.
  if (!el || el === quiet || e.buttons !== 0) {
    if (now && !now.focus) hide();
    return;
  }
  const warm = (now !== null && !now.focus) || performance.now() - leftAt < FEEL.tip.warmMs;
  if (warm || el.classList.contains('tip')) {
    show(el, false);
    return;
  }
  const timer = setTimeout(() => {
    waiting = null;
    if (el.matches(':hover')) show(el, false);
  }, FEEL.tip.delayMs);
  waiting = { el, timer };
}

/** The pointer off an element: its tip goes, unless the pointer is still inside it. */
function onOut(e: PointerEvent): void {
  if (e.pointerType === 'touch') return;
  const to = e.relatedTarget instanceof Node ? e.relatedTarget : null;
  const inside = (el: HTMLElement) => to !== null && el.contains(to);
  if (quiet && !inside(quiet)) quiet = null;
  if (waiting && !inside(waiting.el)) stopWaiting();
  const now = shown.value;
  if (now && !now.focus && !inside(now.el)) {
    hide();
    leftAt = performance.now();
  }
}

/** A press anywhere: the tip goes, and the pressed element's stays away till the pointer leaves. */
function onDown(e: PointerEvent): void {
  tabbed = false;
  quiet = tipTarget(e.target);
  hide();
  leftAt = -Infinity;
}

/** A key, a wheel or a scroll: the tip goes, and stays away from its element till the pointer leaves. */
function settle(): void {
  const now = shown.value;
  if (!now && !waiting) return;
  quiet = now && !now.focus ? now.el : (waiting?.el ?? quiet);
  hide();
  leftAt = -Infinity;
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
  tabbed = e.key === 'Tab';
  settle();
}

/**
 * Focus from Tab shows the focused element's tip (or the one it's in: a switch's box is in its
 * label) at once, until focus leaves it. A click on a term shows its tip too, as hovering it
 * does; on anything else, a click's focus shows none.
 */
function onFocusIn(e: FocusEvent): void {
  const el = tipTarget(e.target);
  if (!el) return;
  const keyboard = tabbed && (e.target as Element).matches(':focus-visible');
  if (keyboard || (el === e.target && el.classList.contains('tip'))) show(el, keyboard);
}

function onFocusOut(e: FocusEvent): void {
  const now = shown.value;
  const to = e.relatedTarget instanceof Node ? e.relatedTarget : null;
  if (now?.focus && !(to && now.el.contains(to))) hide();
}

/** The listeners on the document, while the layer is up (passive: they never cancel anything). */
function listen(): () => void {
  const on = [
    ['pointerover', onOver],
    ['pointerout', onOut],
    ['pointerdown', onDown],
    ['keydown', onKey],
    ['wheel', settle],
    ['scroll', settle],
    ['focusin', onFocusIn],
    ['focusout', onFocusOut],
  ] as const;
  const opts = { capture: true, passive: true };
  for (const [type, fn] of on) document.addEventListener(type, fn as EventListener, opts);
  window.addEventListener('blur', hide);
  return () => {
    for (const [type, fn] of on) document.removeEventListener(type, fn as EventListener, opts);
    window.removeEventListener('blur', hide);
  };
}

/** A glossary term's tip, or one with its own title and text (a checklist line's rule). */
type TipProps =
  | { term: Term; title?: never; text?: never; children: ComponentChildren }
  | { term?: never; title: string; text: string; children: ComponentChildren };

/**
 * A term with a tip: dotted-underlined, and reached by Tab. It has no hooks (the layer's
 * listener shows its note), so a component that tests call in place may render one.
 */
export function Tip(props: TipProps) {
  const title = props.term ? GLOSSARY[props.term].title : props.title!;
  const text = props.term ? GLOSSARY[props.term].text : props.text!;
  return (
    <span
      class="tip"
      tabIndex={0}
      aria-describedby="tip-bubble"
      data-tip={text}
      data-tip-title={title}
    >
      {props.children}
    </span>
  );
}

/**
 * The one tooltip note, rendered once by the app, with the listener that shows it. It's placed
 * once its size is known (tip-place.ts): measured after it renders, and moved before the
 * browser paints it.
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
  useEffect(listen, []);
  // The note goes with its element: a key that changes the panel under the pointer, or a card
  // dealt away, removes it, and a removed element never hears the pointer leave.
  useEffect(() => {
    if (!t) return;
    let frame = requestAnimationFrame(function check() {
      if (t.el.isConnected) frame = requestAnimationFrame(check);
      else if (shown.value === t) hide();
    });
    return () => cancelAnimationFrame(frame);
  }, [t]);
  // Screen readers hear the note as the element's description while it's up (a term names it
  // itself).
  useEffect(() => {
    const el = t?.el;
    if (!el || el.hasAttribute('aria-describedby')) return;
    el.setAttribute('aria-describedby', 'tip-bubble');
    return () => el.removeAttribute('aria-describedby');
  }, [t?.el]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!t || !el) return;
    const view = { w: window.innerWidth, h: window.innerHeight };
    // A compact note is as wide as its words, rounded up to whole device pixels so its right
    // edge stays crisp.
    el.style.width = '';
    const w = t.title ? undefined : Math.ceil(el.getBoundingClientRect().width * dpr - 1e-3) / dpr;
    if (w !== undefined) el.style.width = `${w}px`;
    const h = el.getBoundingClientRect().height;
    const at = placeTip(t, view, uiPixel(dpr), dpr, h, w);
    el.classList.toggle('below', at.below);
    el.style.left = `${at.left}px`;
    el.style.top = at.top !== undefined ? `${at.top}px` : '';
    el.style.bottom = at.bottom !== undefined ? `${at.bottom}px` : '';
    el.style.setProperty('--tail-x', `${at.tail}px`);
  });
  if (!t) return null;
  return (
    <div
      ref={ref}
      id="tip-bubble"
      role="tooltip"
      class={`tip-bubble ui ${t.title ? '' : 'compact'} ${!t.title && t.text.includes('\n') ? 'wide' : ''}`}
    >
      {t.title && <strong class="tip-title">{tipWords(t.title)}</strong>}
      <span class="tip-text">
        {t.text.split('\n').map((line, k) => (
          <span key={k} class="tip-line">
            {tipWords(line)}
          </span>
        ))}
      </span>
    </div>
  );
}
