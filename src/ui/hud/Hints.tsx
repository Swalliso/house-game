// First-time hints (D-045, M4b): a short card the first time each idea comes up, dismissed
// with "Got it" and remembered in this browser (UI only, never game state). One shows at a
// time, never during a tally or under a banner (an arrival's). The numbers come from the
// rules' glossary, so they follow the content.
//
// Each card has a spot where it covers neither what it talks about nor the controls it needs:
// never the lot, which a hint over the board would hide pieces of and block pointing at, nor
// the shop's or a change order's sheet. The checklist's own hint sits beside the checklist,
// over the lot's edge, and takes the pointer only over its own card.

import { signal } from '@preact/signals';
import { useLayoutEffect, useState } from 'preact/hooks';
import { CONTENT, glossary, SCORE_LABELS } from '../../rules/index.ts';
import { BUILD_CHANNEL } from '../build-info.ts';
import { banner, busy } from '../fx/director.ts';
import { appScreen, earlyOffer, run } from '../store.ts';
import './hints.css';

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

/**
 * Where a card sits (measured from the panels, so it follows the layout at any size):
 * - besideChecklist: right of the left column, level with the checklist.
 * - overChecklist: over the checklist, in the left column (in week 1, before the checklist's
 *   own hint, so the score panel the first week's hint names stays in view).
 * - overScore: over the score panel, at the top of the left column.
 * - underGoods: in the right column, under the company's goods: the shop leaves that empty,
 *   and a change order's sheet sets the hand there aside.
 */
type Spot = 'besideChecklist' | 'overChecklist' | 'overScore' | 'underGoods';

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

/** A card's box, in viewport px. */
interface Place {
  spot: Spot;
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

/** The gap between a card and the panel it sits by, and the most a card beside one is wide. */
const GAP = 8;
const BESIDE_WIDTH = 300;

/** The panels a card can sit over or by; any of them changing size moves it. */
const ANCHORS = [
  '.game > .left',
  '.game > .right',
  '.left > .score-panel',
  '.left > .checklist',
  '.right > .inventory',
];

function measure(spot: Spot): Place | null {
  const rect = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
  const left = rect('.game > .left');
  const right = rect('.game > .right');
  if (!left || !right) return null;
  // Above the controls strip, and never off the bottom of the window.
  const floor = (rect('.game > .hints')?.top ?? window.innerHeight) - GAP;
  const box = (top: number, x: number, width: number): Place => ({
    spot,
    left: Math.round(x),
    top: Math.round(top),
    width: Math.round(width),
    maxHeight: Math.round(Math.max(120, floor - top)),
  });
  switch (spot) {
    case 'besideChecklist': {
      const c = rect('.left > .checklist') ?? left;
      return box(
        c.top,
        left.right + GAP,
        Math.min(BESIDE_WIDTH, window.innerWidth - left.right - 2 * GAP),
      );
    }
    case 'overChecklist': {
      const c = rect('.left > .checklist') ?? left;
      return box(c.top, c.left, c.width);
    }
    case 'overScore': {
      const p = rect('.left > .score-panel') ?? left;
      return box(p.top, p.left, p.width);
    }
    case 'underGoods': {
      const inv = rect('.right > .inventory');
      const x = inv?.left ?? right.left + GAP;
      return box((inv?.bottom ?? right.top) + GAP, x, inv?.width ?? right.width - 2 * GAP);
    }
  }
}

const samePlace = (a: Place | null, b: Place | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.spot === b.spot &&
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.maxHeight === b.maxHeight);

/** Where the card for `spot` goes, kept up to date as the panels it sits by change size. */
function usePlace(spot: Spot | null): Place | null {
  const [place, setPlace] = useState<Place | null>(null);
  const screen = run.value.screen;
  useLayoutEffect(() => {
    if (!spot) return;
    const update = () => {
      const next = measure(spot);
      setPlace((old) => (samePlace(old, next) ? old : next));
    };
    update();
    const ro = new ResizeObserver(update);
    for (const sel of ANCHORS) {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    }
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
    // The right column's panels change with the screen (the shop's goods, the hand).
  }, [spot, screen]);
  return place && place.spot === spot ? place : null;
}

export function Hints() {
  const id = current(seenHints.value);
  const hint = id ? HINTS[id] : null;
  const place = usePlace(hint?.spot ?? null);
  if (!id || !hint) return null;
  return (
    <aside
      class={`first-hint at-${hint.spot}`}
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
      <h2>{hint.title}</h2>
      <p>{hint.text}</p>
      {/* It never takes focus, so the game's keys keep working while it's up. */}
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => dismissHint(id)}>
        Got it
      </button>
    </aside>
  );
}
