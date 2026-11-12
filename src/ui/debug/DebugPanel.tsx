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
  type ArrivalId,
  type ChangeOrderId,
  type Good,
  type PieceId,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { BUILD_CHANNEL } from '../build-info.ts';
import { music } from '../audio/music.ts';
import { instantTally } from '../fx/director.ts';
import { copyRunCode, showToast } from '../hud/actions.ts';
import { resetHints } from '../hud/seen-hints.ts';
import { upcomingArrivals } from '../hud/household.ts';
import { KIND_LABEL } from '../screens/ChangeOrderScreen.tsx';
import {
  appScreen,
  debugAction,
  debugEnabled,
  forgetFirstVisit,
  inProgress,
  notice,
  run,
  startRun,
} from '../store.ts';
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
/** Every good the panel can give (M3), as `<kind>:<id>` with a label. */
const GOODS: { value: string; label: string; group: string }[] = [
  ...Object.values(CONTENT.blueprints).map((d) => ({
    value: `blueprint:${d.id}`,
    label: `${d.name} (${d.rarity})`,
    group: 'Blueprints',
  })),
  ...Object.values(CONTENT.fixtures).map((d) => ({
    value: `fixture:${d.id}`,
    label: `${d.name} (${d.rarity})`,
    group: 'Fixtures → supplies',
  })),
  ...Object.values(CONTENT.fixtures).map((d) => ({
    value: `fixtureCard:${d.id}`,
    label: d.name,
    group: 'Fixtures → hand',
  })),
  ...Object.values(CONTENT.pieces)
    .filter((d) => d.drawWeight === 0)
    .map((d) => ({ value: `piece:${d.id}`, label: d.name, group: 'Special pieces → reserve' })),
  ...Object.values(CONTENT.tools).map((d) => ({
    value: `tool:${d.id}`,
    label: `${d.name} (${d.rarity})`,
    group: 'Tools → supplies',
  })),
  ...Object.values(CONTENT.upgrades).map((d) => ({
    value: `upgrade:${d.id}`,
    label: d.name,
    group: 'Company upgrades',
  })),
];
const goodId = signal(GOODS[0]!.value);

function goodOf(value: string): Good {
  const [kind, id] = value.split(':') as [Good['kind'], string];
  return { kind, id } as Good;
}

/** M4b: every change order, generic ones first, then each client's, for "Force". */
const ORDERS = Object.values(CONTENT.changeOrders);
const ORDER_GROUPS: { label: string; ids: ChangeOrderId[] }[] = [
  {
    label: 'Generic',
    ids: ORDERS.filter((o) => o.scope === 'generic').map((o) => o.id),
  },
  ...Object.values(CONTENT.clients).map((c) => ({
    label: c.name,
    ids: ORDERS.filter((o) => o.scope === c.id).map((o) => o.id),
  })),
].filter((g) => g.ids.length > 0);
const orderId = signal<ChangeOrderId>(ORDERS[0]!.id);
/** D-144: the order offered beside it, to pick one of the two; '' offers it alone. */
const otherId = signal<ChangeOrderId | ''>('');
/** The household member to force in; the first still to come when it's not one of them. */
const arrivalId = signal<ArrivalId | null>(null);

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
  // It stops at the start of milestone n: in the shop before it, if there is one. The change
  // orders on the way (M4b) are answered as the sim's greedy picks (sim/policies/orders.ts),
  // and the bot goes on to the shop after it.
  const arrived = (q: RunState) =>
    q.phase === goal &&
    q.screen !== 'changeOrder' &&
    (q.screen === 'shop' || (q.slot === 1 && q.overtimeWeek === 0));
  while (inProgress(s) && !arrived(s)) {
    if (actions.length > MAX_BOT_ACTIONS) throw new Error('The bot got stuck.');
    // Keyed like sim/simulate.ts, a change order's answer included, so this plays the same
    // house as the sim on this seed.
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
    } else if (!inProgress(state)) {
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
    ['strikes', s.strikesLeft],
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
  const going = live || s.screen === 'shop';
  const groups = [...new Set(GOODS.map((g) => g.group))];
  const isOpen = open.value;
  const toggle = () => {
    open.value = !open.value;
    writePrefs();
  };
  const shortfall = rules.target(s) - s.score;
  const missForced = s.forcedMiss === s.phase;
  const busyBuilding = building.value !== null;
  // M4b: the change orders that could come up now, and who's still to move in.
  const eligible = new Set(live ? rules.eligibleChangeOrders(s) : []);
  const coming = upcomingArrivals(s);
  const arrival = coming.find((a) => a.id === arrivalId.value) ?? coming[0];

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
                disabled={!going}
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
            <span class="debug-label">Shop</span>
            <button
              type="button"
              disabled={!live}
              onClick={() => debugAction({ t: 'debug', op: 'forceShop' })}
              title="Open the shop that follows this milestone, now; leaving comes back to this week"
            >
              Force the shop
            </button>
          </div>

          <div class="debug-row">
            <label class="debug-label" for="debug-order">
              Change order
            </label>
            <select
              id="debug-order"
              value={orderId.value}
              title="Every change order; ✓ marks the ones that could be offered now"
              onChange={(e) =>
                (orderId.value = (e.target as HTMLSelectElement).value as ChangeOrderId)
              }
            >
              {ORDER_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.ids.map((id) => (
                    <option key={id} value={id}>
                      {CONTENT.changeOrders[id].name} ·{' '}
                      {KIND_LABEL[CONTENT.changeOrders[id].kind].toLowerCase()}
                      {eligible.has(id) ? ' ✓' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              disabled={!live || otherId.value === orderId.value}
              onClick={() =>
                debugAction({
                  t: 'debug',
                  op: 'forceChangeOrder',
                  id: orderId.value,
                  ...(otherId.value ? { other: otherId.value } : {}),
                })
              }
              title="Offer it now, as if a milestone had just been met: the pick runs through this phase, and picking comes back to this week"
            >
              Force
            </button>
          </div>

          <div class="debug-row">
            <label class="debug-label" for="debug-order-other">
              Against
            </label>
            <select
              id="debug-order-other"
              value={otherId.value}
              title="The order offered beside it, to pick one of the two (D-144)"
              onChange={(e) =>
                (otherId.value = (e.target as HTMLSelectElement).value as ChangeOrderId | '')
              }
            >
              <option value="">Nothing: offer it alone</option>
              {ORDER_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.ids.map((id) => (
                    <option key={id} value={id} disabled={id === orderId.value}>
                      {CONTENT.changeOrders[id].name} ·{' '}
                      {KIND_LABEL[CONTENT.changeOrders[id].kind].toLowerCase()}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div class="debug-row">
            <label class="debug-label" for="debug-arrival">
              Arrival
            </label>
            {coming.length > 0 ? (
              <>
                <select
                  id="debug-arrival"
                  value={arrival?.id}
                  onChange={(e) =>
                    (arrivalId.value = (e.target as HTMLSelectElement).value as ArrivalId)
                  }
                >
                  {coming.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (at {rules.phaseName(a.phase)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!live || !arrival}
                  onClick={() =>
                    arrival && debugAction({ t: 'debug', op: 'forceArrival', id: arrival.id })
                  }
                  title="They move in now: their cards go into the reserve’s extra slots"
                >
                  Force
                </button>
              </>
            ) : (
              <span class="muted">Everyone’s moved in.</span>
            )}
          </div>

          <div class="debug-row">
            <label class="debug-label" for="debug-good">
              Good
            </label>
            <select
              id="debug-good"
              value={goodId.value}
              onChange={(e) => (goodId.value = (e.target as HTMLSelectElement).value)}
            >
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {GOODS.filter((x) => x.group === g).map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              disabled={!going}
              onClick={() =>
                debugAction({ t: 'debug', op: 'giveGood', good: goodOf(goodId.value) })
              }
              title="Where buying it would put it"
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
            <button
              type="button"
              onClick={() => music.next()}
              title="M5b: skip to the next track in the shuffle"
            >
              Next track
            </button>
            <button
              type="button"
              onClick={() => {
                forgetFirstVisit();
                resetHints();
                showToast('First visit again: press Start on the title');
              }}
              title="D-149: forget this browser's first job and its hints, so Start opens the first job again"
            >
              First visit again
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
