// First-time hints (D-045, M4b): a short card the first time each idea comes up, dismissed
// with "Got it" and remembered in this browser (UI only, never game state). One shows at a
// time, never during a tally or under a banner (an arrival's). The numbers come from the
// rules' glossary, so they follow the content. (The controls strip under the board is M5a's
// Hints.tsx; these were M4's Hints until the two branches met.)
//
// Each card has a spot where it covers neither what it talks about nor the controls it needs:
// never the lot, which a hint over the board would hide pieces of and block pointing at, nor
// the shop's or a change order's sheet. The checklist's own hint sits beside the checklist,
// over the lot's edge, and takes the pointer only over its own card. first-hint-place.ts works
// out the box from the panels measured here.
//
// In the pixel UI (D-110) a card is a paper note: a plank with the help icon and the title, the
// text in a body that scrolls if the card is short, and a small "Got it" that never takes focus,
// so the game's keys keep working while it's up.

import { signal } from '@preact/signals';
import type { RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CONTENT, glossary, SCORE_LABELS } from '../../rules/index.ts';
import { BUILD_CHANNEL } from '../build-info.ts';
import { banner, busy } from '../fx/director.ts';
import { Button, Icon } from '../kit/kit.tsx';
import { appScreen, earlyOffer, run } from '../store.ts';
import { devicePixelRatio, uiPixel } from '../theme/pixel.ts';
import { placeFirstHint, type HintPlace, type HintSpot } from './first-hint-place.ts';
import './first-hints.css';

export type HintId =
  'firstWeek' | 'checklist' | 'early' | 'shop' | 'fixture' | 'changeOrder' | 'arrival';

const KEY = `openhouse:${BUILD_CHANNEL}:hints`;

function load(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** The hints already dismissed in this browser. */
export const seenHints = signal<ReadonlySet<string>>(load());

export function dismissHint(id: HintId): void {
  const next = new Set(seenHints.value);
  next.add(id);
  seenHints.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // A private window: the hint comes back next visit, which is harmless.
  }
}

/** Shows every hint again (Settings). */
export function resetHints(): void {
  seenHints.value = new Set();
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

const G = glossary(CONTENT);
const L = SCORE_LABELS;

/** Where a card sits: first-hint-place.ts says where each spot is. */
type Spot = HintSpot;

interface Hint {
  title: string;
  text: string;
  spot: Spot;
}

const HINTS: Record<HintId, Hint> = {
  firstWeek: {
    title: 'Your first week',
    text:
      `Pick a card (1–3), click the lot to place it, then End week. Each piece earns ` +
      `${L.points} from what it touches, and ${L.mult} multiplies it into ${L.total}. ` +
      `Reach each milestone’s target before its weeks run out. Hover anything to read it.`,
    spot: 'overChecklist',
  },
  checklist: { title: G.checklist.title, text: G.checklist.text, spot: 'besideChecklist' },
  early: { title: G.early.title, text: G.early.text, spot: 'overScore' },
  shop: {
    title: 'The shop',
    text:
      `Spend your budget on goods for the house: blueprints bend the rules all run, pieces ` +
      `wait in your reserve, fixtures upgrade a piece you’ve built, and tools are one-offs. ` +
      `${G.budget.text}`,
    spot: 'underGoods',
  },
  fixture: { title: G.fixture.title, text: G.fixture.text, spot: 'overScore' },
  // M4b: the screen and the arrival's cards say what they are; these say why they matter.
  changeOrder: {
    title: 'Change orders',
    text:
      'The client has changed their mind. A request or a restriction is yours to accept or ' +
      'decline, and pays if you see it through the next milestone; declining costs nothing. ' +
      'A change to the weather or the season just happens, and lasts this phase only.',
    spot: 'underGoods',
  },
  arrival: {
    title: 'Someone’s moving in',
    text:
      'The household grows on the schedule shown on the job board. Their room is waiting in ' +
      'your reserve, and Room for everyone needs it from now on: build it when you can.',
    spot: 'overScore',
  },
};

/** Which hint (if any) the run calls for now, first unseen in this order. */
function current(seen: ReadonlySet<string>): HintId | null {
  if (appScreen.value !== 'game' || busy.value || banner.value) return null;
  const s = run.value;
  const building = s.screen === 'build';
  const fixtureInSight =
    s.hand.some((c) => c.kind === 'fixture') || s.supplies.some((x) => x.kind === 'fixture');
  const due: [HintId, boolean][] = [
    ['shop', s.screen === 'shop'],
    ['firstWeek', building && s.week === 1],
    ['checklist', building && s.week >= 2],
    ['early', building && earlyOffer.value.ok],
    ['fixture', building && fixtureInSight],
    // M4b: the sheet is up (it waits for the milestone's beats), and a member's cards are in
    // the reserve.
    ['changeOrder', s.screen === 'changeOrder'],
    ['arrival', building && s.reserve.some((r) => r.arrival !== undefined)],
  ];
  for (const [id, now] of due) if (now && !seen.has(id)) return id;
  return null;
}

/** The panels a card can sit over or by; any of them changing size moves it. */
const ANCHORS = [
  '.game > .left',
  '.game > .right',
  '.left > .score-panel',
  '.left .checklist',
  '.right > .inventory',
];

/**
 * A card's own height at the width it has now: its plank, all its text (unscrolled) and its
 * foot, inside its ring.
 */
function cardHeight(card: HTMLElement): number | undefined {
  const head = card.querySelector<HTMLElement>('.first-hint-head');
  const body = card.querySelector<HTMLElement>('.first-hint-body');
  const foot = card.querySelector<HTMLElement>('.first-hint-foot');
  if (!head || !body || !foot) return undefined;
  const ring = card.offsetHeight - card.clientHeight;
  return head.offsetHeight + body.scrollHeight + foot.offsetHeight + ring;
}

/**
 * The panels' boxes as laid out now, and where the card for `spot` goes by them. With the card
 * itself, it's measured at the width it'll have, so a card too tall for its room can rise.
 */
function measure(spot: Spot, dpr: number, card: HTMLElement | null): HintPlace | null {
  // A panel that isn't laid out (display: none, as the strip is on a short window with nothing
  // to show) counts as missing, not as a box at the window's top left.
  const rect = (sel: string) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? r : undefined;
  };
  const left = rect('.game > .left');
  const right = rect('.game > .right');
  if (!left || !right) return null;
  const anchors = {
    left,
    right,
    score: rect('.left > .score-panel'),
    checklist: rect('.left .checklist'),
    inventory: rect('.right > .inventory'),
    strip: rect('.game > .hints'),
  };
  const view = { w: window.innerWidth, h: window.innerHeight };
  const px = uiPixel(dpr);
  const first = placeFirstHint(spot, anchors, view, px, dpr);
  if (!card) return first;
  card.style.width = `${first.width}px`;
  return placeFirstHint(spot, anchors, view, px, dpr, cardHeight(card));
}

const samePlace = (a: HintPlace | null, b: HintPlace | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.spot === b.spot &&
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.maxHeight === b.maxHeight);

/**
 * Where the card for hint `id` goes, at its `spot`, kept up to date as the panels it sits by
 * change size.
 */
function usePlace(
  id: HintId | null,
  spot: Spot | null,
  card: RefObject<HTMLElement>,
): HintPlace | null {
  const [place, setPlace] = useState<HintPlace | null>(null);
  const screen = run.value.screen;
  const dpr = devicePixelRatio.value;
  useLayoutEffect(() => {
    if (!spot) return;
    const update = () => {
      const next = measure(spot, dpr, card.current);
      setPlace((old) => (samePlace(old, next) ? old : next));
    };
    update();
    const ro = new ResizeObserver(update);
    // Not the card itself: measuring sets its width, which would loop the observer. Its text
    // changes with the hint, and its size with the panels' (the font, the window).
    for (const sel of ANCHORS) {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    }
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
    // The right column's panels change with the screen (the shop's goods, the hand), the card
    // with the hint, and the device pixel with the screen the window is on.
  }, [id, spot, screen, dpr]);
  return place && place.spot === spot ? place : null;
}

/** A click on "Got it" doesn't take focus from the game, so its keys keep working. */
const noFocus = (e: MouseEvent) => e.preventDefault();

export function FirstHints() {
  const id = current(seenHints.value);
  const hint = id ? HINTS[id] : null;
  const card = useRef<HTMLElement>(null);
  const place = usePlace(id, hint?.spot ?? null, card);
  if (!id || !hint) return null;
  return (
    <aside
      ref={card}
      class={`first-hint ui at-${hint.spot}`}
      role="note"
      aria-label={`Hint: ${hint.title}`}
      // Until it's measured it waits out of sight, so it never shows over the wrong panel.
      style={
        place
          ? {
              left: `${place.left}px`,
              top: `${place.top}px`,
              width: `${place.width}px`,
              maxHeight: `${place.maxHeight}px`,
            }
          : { visibility: 'hidden' }
      }
    >
      <header class="first-hint-head">
        <Icon name="help" />
        <h2>{hint.title}</h2>
      </header>
      <div class="first-hint-body">
        <p>{hint.text}</p>
      </div>
      <div class="first-hint-foot">
        <Button size="sm" onMouseDown={noFocus} onClick={() => dismissHint(id)}>
          Got it
        </Button>
      </div>
    </aside>
  );
}
