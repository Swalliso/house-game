// The ?debug panel (implementation-plan.md §7, M2 · Debug tools): the run's numbers and a few
// cheats for play-testing. Every cheat is a rules action, so the run code still replays, and
// any of them marks the run as a debug run. Without ?debug it renders nothing.

import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import {
  CONTENT,
  rules,
  SCORE_LABELS,
  stream,
  type Action,
  type PieceId,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { BUILD_CHANNEL } from '../build-info.ts';
import { instantTally } from '../fx/director.ts';
import { copyRunCode, showToast } from '../hud/actions.ts';
import { appScreen, debugAction, debugEnabled, notice, run, startRun } from '../store.ts';
import './debug.css';

const PHASES = CONTENT.balance.phases;
const WEEKS_PER_PHASE = CONTENT.balance.weeksPerPhase;
/** The bot yields to the browser this often (in weeks), so the page stays responsive. */
const YIELD_WEEKS = 2;
/** A runaway guard for the bot loop: a full run is well under this many actions. */
const MAX_BOT_ACTIONS = 2000;

// ---------------------------------------------------------------------------------------
// Panel state. Whether it's open and the instant tally survive a reload.

const PREFS_KEY = `openhouse:${BUILD_CHANNEL}:debugPanel`;

function readPrefs(): { open: boolean; instant: boolean } {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      const p = saved as { open?: unknown; instant?: unknown };
      return { open: p.open !== false, instant: p.instant === true };
    }
  } catch {
    // Best effort.
  }
  return { open: true, instant: false };
}

function writePrefs(): void {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ open: open.value, instant: instantTally.value }),
    );
  } catch {
    // Best effort.
  }
}

const prefs = debugEnabled ? readPrefs() : { open: true, instant: false };
const open = signal(prefs.open);
if (prefs.instant) instantTally.value = true;

/** The milestone to jump to (1-based). */
const jumpTo = signal(2);
/** The card to give. */
const PIECES = Object.values(CONTENT.pieces).sort((a, b) => a.name.localeCompare(b.name));
const giveId = signal<PieceId>(PIECES[0]!.id);
/** Set while the bot builds a house: what to show on the Go button. */
const building = signal<string | null>(null);

// ---------------------------------------------------------------------------------------
// Jump to milestone N: the greedy bot plays a fresh run of this seed up to the start of
// milestone N's phase, topping the score up when it would miss a target.

const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

async function botRunTo(
  setup: RunSetup,
  n: number,
  onWeek: (week: number) => void,
): Promise<{ actions: Action[]; state: RunState }> {
  const { greedy } = await import('../../../sim/policies/greedy.ts');
  const goal = n - 1;
  let s = rules.newRun(setup);
  const actions: Action[] = [];
  const push = (action: Action) => {
    s = rules.apply(s, action).state;
    actions.push(action);
  };
  let step = 0;
  let lastWeek = s.week;
  while (s.screen === 'build' && !(s.phase === goal && s.slot === 1 && s.overtimeWeek === 0)) {
    if (actions.length > MAX_BOT_ACTIONS) throw new Error('The bot got stuck.');
    // Keyed like sim/simulate.ts, so this plays the same house as the sim on this seed.
    const rng = stream(setup.seed, `bot/${greedy.name}/${s.week}/${s.draws}/${step++}`);
    const action = greedy.act(rules, s, rng);
    const endsPhase =
      (action.t === 'place' || action.t === 'pass') &&
      s.slot === WEEKS_PER_PHASE &&
      s.overtimeWeek === 0;
    if (endsPhase) {
      // Make sure the phase's last regular week meets the target, so the bot never needs
      // overtime or loses on the way.
      const total = rules.scoreOnly(s, action.t === 'place' ? action : null);
      const shortfall = rules.target(s) - (s.score + total);
      if (shortfall > 0) push({ t: 'debug', op: 'addScore', amount: shortfall });
    }
    push(action);
    if (s.week !== lastWeek) {
      lastWeek = s.week;
      if (s.week % YIELD_WEEKS === 0) {
        onWeek(s.week);
        await tick();
      }
    }
  }
  return { actions, state: s };
}

async function jump(n: number): Promise<void> {
  if (building.value) return;
  const setup = run.value.setup;
  building.value = 'Building…';
  try {
    await tick();
    const { actions, state } = await botRunTo(
      setup,
      n,
      (week) => (building.value = `Building… wk ${week}`),
    );
    const { failedAt, error } = startRun(setup, actions);
    appScreen.value = 'game';
    if (failedAt !== undefined) {
      notice.value = {
        text: `The bot’s run stopped replaying at action ${failedAt + 1}: ${error}`,
      };
    } else if (state.screen !== 'build') {
      notice.value = { text: `The bot’s run ended before milestone ${n}.` };
    } else {
      showToast(`Milestone ${n}: ${PHASES[n - 1]?.name ?? ''}`);
    }
  } catch (e) {
    console.error(e);
    notice.value = { text: `Couldn’t jump: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    building.value = null;
  }
}

// ---------------------------------------------------------------------------------------
// The panel.

/** Keys typed into the panel's own controls stay there, so they don't place or end weeks. */
function keepKeys(e: JSX.TargetedKeyboardEvent<HTMLElement>): void {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'SELECT' || t.tagName === 'INPUT')) e.stopPropagation();
}

function Info({ s }: { s: RunState }) {
  const target = rules.target(s);
  const items: [string, string | number][] = [
    ['seed', s.setup.seed],
    ['phase', `${s.phase + 1}/${PHASES.length}`],
    ['slot', s.slot],
    ['ot', s.overtimeWeek],
    ['week', s.week],
    [SCORE_LABELS.total, `${s.score}/${target}`],
    ['budget', s.budget],
    ['rerolls', s.rerollsLeft],
    ['demos', s.demolitionsLeft],
    ['overtime', s.overtimeLeft],
    ['auto', s.autoComplete ? 'on' : 'off'],
    ['debug', s.debug ? 'yes' : 'no'],
  ];
  if (s.forcedMiss === s.phase) items.push(['miss', 'forced']);
  if (s.screen !== 'build') items.push(['run', s.screen]);
  return (
    <p class="debug-info">
      {items.map(([k, v]) => (
        <span key={k}>
          <b>{k}</b> {v}
        </span>
      ))}
    </p>
  );
}

export function DebugPanel() {
  if (!debugEnabled) return null;
  const s = run.value;
  const live = s.screen === 'build';
  const isOpen = open.value;
  const toggle = () => {
    open.value = !open.value;
    writePrefs();
  };
  const shortfall = rules.target(s) - s.score;
  const missForced = s.forcedMiss === s.phase;
  const busyBuilding = building.value !== null;

  return (
    <aside
      class={isOpen ? 'debug-panel open' : 'debug-panel'}
      aria-label="Debug"
      onKeyDown={keepKeys}
    >
      <button
        type="button"
        class="debug-head"
        aria-expanded={isOpen}
        onClick={toggle}
        title={isOpen ? 'Hide the debug panel' : 'Show the debug panel'}
      >
        Debug <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div class="debug-body">
          <Info s={s} />

          <div class="debug-row">
            <label class="debug-label" for="debug-jump">
              Jump to milestone
            </label>
            <select
              id="debug-jump"
              value={jumpTo.value}
              disabled={busyBuilding}
              onChange={(e) => (jumpTo.value = Number((e.target as HTMLSelectElement).value))}
            >
              {PHASES.map((p, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} · {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busyBuilding}
              onClick={() => void jump(jumpTo.value)}
              title="A fresh run of this seed, built by the greedy bot"
            >
              {building.value ?? 'Go'}
            </button>
          </div>

          <div class="debug-row">
            <span class="debug-label">Milestone</span>
            <button
              type="button"
              disabled={!live || shortfall <= 0}
              onClick={() => debugAction({ t: 'debug', op: 'addScore', amount: shortfall })}
              title={shortfall > 0 ? `+${shortfall} ${SCORE_LABELS.total}` : 'The target is met.'}
            >
              Meet target
            </button>
            <button
              type="button"
              disabled={!live || missForced || s.overtimeWeek > 0}
              onClick={() => debugAction({ t: 'debug', op: 'forceMiss' })}
              title={
                s.overtimeWeek > 0
                  ? 'Not in an overtime week.'
                  : 'This phase’s end counts as a miss: overtime, or the loss.'
              }
            >
              {missForced ? 'Miss forced' : 'Force a miss'}
            </button>
          </div>

          <div class="debug-row">
            <span class="debug-label">Budget</span>
            {[5, 20].map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={!live}
                onClick={() => debugAction({ t: 'debug', op: 'addBudget', amount })}
              >
                +{amount}
              </button>
            ))}
          </div>

          <div class="debug-row">
            <label class="debug-label" for="debug-card">
              Give
            </label>
            <select
              id="debug-card"
              value={giveId.value}
              onChange={(e) => (giveId.value = (e.target as HTMLSelectElement).value as PieceId)}
            >
              {PIECES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!live}
              onClick={() => debugAction({ t: 'debug', op: 'giveCard', id: giveId.value })}
            >
              Give
            </button>
          </div>

          <div class="debug-row">
            <label class="debug-check">
              <input
                type="checkbox"
                checked={instantTally.value}
                onChange={(e) => {
                  instantTally.value = (e.target as HTMLInputElement).checked;
                  writePrefs();
                }}
              />
              Instant tally
            </label>
            <button type="button" onClick={() => void copyRunCode()}>
              Copy run code
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
