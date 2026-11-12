// First-time hints (D-045, M4b): a short card the first time each idea comes up, dismissed
// with "Got it" and remembered in this browser (UI only, never game state). One shows at a
// time, never during a tally or under a banner (an arrival's). Each keeps to HINT_WORDS words
// (D-142): one idea for the moment it applies, and the tips carry the rest. The ones that state
// a rule come from the rules' hintText, so their numbers follow the content. (The controls
// strip under the board is M5a's Hints.tsx; these were M4's Hints until the two branches met.)
//
// The opening (D-149): the first three weeks' hints walk a new player through a first house.
// Week 1's is three plays, pick, place, End week, each lit as it comes up. Where the hand holds
// the opening's card (first-job.ts), the hint names it: the Bedroom, then the Bathroom touching
// it, then the Closet that makes the three a Suite. A hint of the opening goes with its week,
// "Got it" or not, so the next run never repeats it.
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

import { effect } from '@preact/signals';
import type { RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CONTENT, hintText, SCORE_LABELS, type RunState } from '../../rules/index.ts';
import { arrivalCard, banner, busy } from '../fx/director.ts';
import { Button, Icon } from '../kit/kit.tsx';
import { appScreen, cardsRenovate, earlyOffer, run } from '../store.ts';
import { devicePixelRatio, uiPixel } from '../theme/pixel.ts';
import { placeFirstHint, type HintPlace, type HintSpot } from './first-hint-place.ts';
import {
  guideStep,
  OPENING_WEEKS,
  openingCard,
  shown,
  type GuideStep,
  type Shown,
} from './first-job.ts';
import { markHintSeen, resetHints, seenHints } from './seen-hints.ts';
import './first-hints.css';

export { resetHints, seenHints };

export type HintId =
  | 'firstWeek'
  | 'score'
  | 'sets'
  | 'checklist'
  | 'early'
  | 'shop'
  | 'fixture'
  | 'changeOrder'
  | 'arrival'
  | 'renovate'
  | 'strike'
  | 'stock';

export function dismissHint(id: HintId): void {
  markHintSeen(id);
}

const T = hintText(CONTENT);
const L = SCORE_LABELS;

/** Where a card sits: first-hint-place.ts says where each spot is. */
type Spot = HintSpot;

interface Hint {
  title: string;
  text: string;
  /** Week 1's plays, in order: the one that comes next is lit, and the ones done are ticked. */
  steps?: readonly [string, string, string];
  spot: Spot;
}

/** The opening's pieces and its set, by the content's names. */
const { bedroom, bathroom, closet } = CONTENT.pieces;
const suite = CONTENT.sets.suite;

/** Every hint, each within HINT_WORDS words (first-hints.test.ts holds them to it). */
export const HINTS: Readonly<Record<HintId, Hint>> = {
  firstWeek: {
    title: 'Your first week',
    text: `Build one piece a week to reach the ${L.total} target up top.`,
    steps: ['Pick a card.', 'Click the lot to place it.', 'End the week.'],
    spot: 'overChecklist',
  },
  // Week 2, once a week has been tallied: what the first week's hint used to say up front.
  score: { title: `${L.points} and ${L.mult}`, text: T.score, spot: 'overChecklist' },
  // Week 3 of the opening (D-149), and only there: with a Bedroom and a Bathroom built and the
  // Closet in hand, wherever it goes it touches one of them, and the three are the set.
  sets: {
    title: 'Your first set',
    text:
      `Build the ${closet.name} touching the ${bedroom.name} or the ${bathroom.name}: the three ` +
      `make a ${suite.name}. A set raises ${L.mult}, and ${L.mult} multiplies ${L.points} into ` +
      `${L.total}.`,
    spot: 'overChecklist',
  },
  checklist: { title: 'The checklist', text: T.checklist, spot: 'besideChecklist' },
  early: { title: 'Complete early', text: T.early, spot: 'overScore' },
  // The shelves' own tags say what each kind of good is, and the fixture's hint comes with the
  // first fixture.
  shop: { title: 'The shop', text: T.shop, spot: 'underGoods' },
  fixture: { title: 'Fixtures', text: T.fixture, spot: 'overScore' },
  // M4b: the screen and the arrival's cards say what they are; these say why they matter.
  // "This phase" is the sheet's chip for a phase effect (ChangeOrderScreen.tsx KIND_LABEL).
  changeOrder: {
    title: 'Change orders',
    text:
      'The client changed their mind: pick one. A request or restriction pays if you see it ' +
      'through; a “This phase” card changes what earns.',
    spot: 'underGoods',
  },
  // Playtest 4: nothing said a spare card of a room type could renovate, so it went unused.
  renovate: { title: 'Renovate', text: T.renovate, spot: 'overScore' },
  // It names the folded plank the room waits in (D-148): nothing else on the build screen says
  // "reserve".
  arrival: {
    title: 'Someone’s moving in',
    text:
      'Their room is waiting in your reserve: open Your goods, top right. Room for everyone ' +
      'needs it from now on.',
    spot: 'overScore',
  },
  // D-157: in the left column, as Early, Fixtures and Renovate are; in the hand it would cost a
  // card's row at 1280×720 in the pixel font.
  strike: { title: 'Strike a card', text: T.strike, spot: 'overScore' },
  // D-160: the standing stock's first top-up, in the left column as the arrival's is. It names
  // the folded plank the cards wait in.
  stock: { title: 'Always in stock', text: T.stock, spot: 'overScore' },
};

/**
 * The opening's hints where they name their card (D-149): the hand holds it and the house has
 * what it builds on (first-job.ts openingCard). Within HINT_WORDS like the rest.
 */
export const OPENING_HINTS: Readonly<Record<'firstWeek' | 'score', Hint>> = {
  firstWeek: {
    ...HINTS.firstWeek,
    steps: [`Pick the ${bedroom.name}.`, 'Click the lot to place it.', 'End the week.'],
  },
  score: {
    title: 'Side by side',
    text:
      `Your ${bedroom.name} earns ${L.points} every week. Pieces also earn from what they ` +
      `touch: build the ${bathroom.name} touching the ${bedroom.name}.`,
    spot: 'overChecklist',
  },
};

/** The opening's hints, and the week each belongs to: it goes with its week (D-149). */
const OPENING_WEEK: Readonly<Partial<Record<HintId, number>>> = { firstWeek: 1, score: 2, sets: 3 };

/** The hint as the run on show words it: the opening's names its card when the hand holds it. */
export function hintFor(id: HintId, s: RunState): Hint {
  const card = openingCard(s)?.id;
  if (id === 'firstWeek' && card === bedroom.id) return OPENING_HINTS.firstWeek;
  if (id === 'score' && card === bathroom.id) return OPENING_HINTS.score;
  return HINTS[id];
}

/**
 * Strike's hint (D-157): once Strike is on screen with a strike to use, after the opening's
 * weeks (a run that isn't the first job shows Strike from week 1; the opening's hints come first).
 */
export function strikeHintDue(s: RunState, on: Shown, seen: ReadonlySet<string>): boolean {
  return (
    s.screen === 'build' &&
    on.strike &&
    s.strikesLeft > 0 &&
    (s.week > OPENING_WEEKS || seen.has('checklist'))
  );
}

/** Which hint (if any) the run calls for now, first unseen in this order. */
function current(seen: ReadonlySet<string>): HintId | null {
  if (appScreen.value !== 'game' || busy.value || banner.value || arrivalCard.value) return null;
  const s = run.value;
  const building = s.screen === 'build';
  const fixtureInSight =
    s.hand.some((c) => c.kind === 'fixture') || s.supplies.some((x) => x.kind === 'fixture');
  // The first job (D-149) brings its checklist and Complete early in later, and their hints
  // with them.
  const on = shown.value;
  const due: [HintId, boolean][] = [
    ['shop', s.screen === 'shop'],
    ['firstWeek', building && s.week === 1],
    // A hint a week (D-142): how a week scores once one has been tallied, then the checklist.
    ['score', building && s.week === 2],
    // The opening's third week, when its Closet would make the Suite.
    ['sets', building && s.week === 3 && openingCard(s)?.id === closet.id],
    ['checklist', building && s.week >= 3 && on.checklist],
    ['early', building && earlyOffer.value.ok && on.early],
    ['fixture', building && fixtureInSight],
    // M4b: the sheet is up (it waits for the milestone's beats), and a member's cards are in
    // the reserve.
    ['changeOrder', s.screen === 'changeOrder'],
    ['arrival', building && s.reserve.some((r) => r.arrival !== undefined)],
    ['renovate', building && cardsRenovate.value.some(Boolean)],
    // D-157: last, so the opening's and the checklist's come first.
    ['strike', strikeHintDue(s, on, seen)],
    // D-160: the standing stock, once it's in the reserve (a first job's comes after Strike's).
    ['stock', building && s.reserve.some((r) => r.stock)],
  ];
  for (const [id, now] of due) if (now && !seen.has(id)) return id;
  return null;
}

/**
 * A hint of the opening goes with its week (D-149): once it has been on screen and the run has
 * moved on, it's seen, so the next run's first weeks don't walk through it again. One that was
 * never shown (a run loaded past it) stays for the run that needs it.
 */
const shownOnce = new Set<HintId>();
effect(() => {
  if (appScreen.value !== 'game') return;
  const week = run.value.week;
  for (const id of shownOnce) {
    const its = OPENING_WEEK[id];
    if (its !== undefined && week > its) markHintSeen(id);
  }
});

const STEPS: readonly GuideStep[] = ['pick', 'place', 'end'];

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
  const height = cardHeight(card);
  const place = placeFirstHint(spot, anchors, view, px, dpr, height);
  // The opening's second and third weeks (D-149): the card stands where the checklist will be,
  // and Inspect, at the column's foot, keeps to the room under it (app.css).
  const shares = spot === 'overChecklist' && !anchors.checklist && !!anchors.score;
  setHintRoom(shares && height !== undefined ? Math.min(height, place.maxHeight) : null);
  return place;
}

/** The height a card takes of the room it shares with Inspect, for app.css; null gives it back. */
function setHintRoom(height: number | null): void {
  const root = document.documentElement.style;
  if (height === null) root.removeProperty('--first-hint-room');
  else root.setProperty('--first-hint-room', `${Math.ceil(height)}px`);
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
      setHintRoom(null);
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
  const hint = id ? hintFor(id, run.value) : null;
  const card = useRef<HTMLElement>(null);
  const place = usePlace(id, hint?.spot ?? null, card);
  if (!id || !hint) return null;
  shownOnce.add(id);
  // Week 1's plays (D-149): which one comes next, from what's picked and placed.
  const at = hint.steps ? STEPS.indexOf(guideStep.value ?? 'pick') : -1;
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
        {hint.steps && (
          <ol class="first-hint-steps">
            {hint.steps.map((step, k) => (
              <li
                key={k}
                class={k < at ? 'done' : k === at ? 'now' : undefined}
                aria-current={k === at ? 'step' : undefined}
              >
                <span class="first-hint-step-mark" aria-hidden="true">
                  {k < at ? <Icon name="check" /> : k + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div class="first-hint-foot">
        <Button size="sm" onMouseDown={noFocus} onClick={() => dismissHint(id)}>
          Got it
        </Button>
      </div>
    </aside>
  );
}
