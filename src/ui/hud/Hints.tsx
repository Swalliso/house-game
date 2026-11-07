// First-time hints (D-045, M4b): a short card the first time each idea comes up, dismissed
// with "Got it" and remembered in this browser (UI only, never game state). One shows at a
// time, never during a tally or under a banner (an arrival's). The numbers come from the
// rules' glossary, so they follow the content.

import { signal } from '@preact/signals';
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

interface Hint {
  title: string;
  text: string;
  /** Where the card sits: beside the panel it talks about. */
  at: 'left' | 'center' | 'right';
}

const HINTS: Record<HintId, Hint> = {
  firstWeek: {
    title: 'Your first week',
    text:
      `Pick a card (1–3), click the lot to place it, then End week. Each piece earns ` +
      `${L.points} from what it touches, and ${L.mult} multiplies it into ${L.total}. ` +
      `Reach each milestone’s target before its weeks run out. Hover anything to read it.`,
    at: 'right',
  },
  checklist: { title: G.checklist.title, text: G.checklist.text, at: 'left' },
  early: { title: G.early.title, text: G.early.text, at: 'center' },
  shop: {
    title: 'The shop',
    text:
      `Spend your budget on goods for the house: blueprints bend the rules all run, pieces ` +
      `wait in your reserve, fixtures upgrade a piece you’ve built, and tools are one-offs. ` +
      `${G.budget.text}`,
    at: 'center',
  },
  fixture: { title: G.fixture.title, text: G.fixture.text, at: 'right' },
  // M4b: the screen and the arrival's cards say what they are; these say why they matter.
  changeOrder: {
    title: 'Change orders',
    text:
      'The client has changed their mind. A request or a restriction is yours to accept or ' +
      'decline, and pays if you see it through the next milestone; declining costs nothing. ' +
      'A change to the weather or the season just happens, for the next milestone only.',
    at: 'center',
  },
  arrival: {
    title: 'Someone’s moving in',
    text:
      'The household grows on the schedule shown on the job board. Their room is waiting in ' +
      'your reserve, and Room for everyone needs it from now on: build it when you can.',
    at: 'right',
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

export function Hints() {
  const id = current(seenHints.value);
  if (!id) return null;
  const hint = HINTS[id];
  return (
    <aside class={`first-hint at-${hint.at}`} role="note" aria-label={`Hint: ${hint.title}`}>
      <h2>{hint.title}</h2>
      <p>{hint.text}</p>
      {/* It never takes focus, so the game's keys keep working while it's up. */}
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => dismissHint(id)}>
        Got it
      </button>
    </aside>
  );
}
