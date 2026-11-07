// The client's checklist (M4a, D-097): the client's tastes, then the house rules under "The
// household", "The shape", and "The yard", then the client's own wishes. Each line held adds
// Charm. While a card is pointed at a spot, lines the play would turn on or off are marked;
// while a tally plays, each line lights up as the tally reaches it (director.ts). The rules
// work out every line and its progress: the UI never scores anything itself. M4b adds who's
// still to move in, under the household, and the change orders running, as their own group,
// where the ones a milestone just resolved stay, marked with how they went, until the next
// phase's first week is played.

import { computed } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import {
  changeOrderText,
  CONTENT,
  modifierText,
  rewardText,
  rules,
  SCORE_LABELS,
  type ChangeOrderRecord,
  type ChangeOrderResult,
  type ChangeOrderView,
  type ChecklistLine,
  type Modifier,
  type Play,
  type ProgressPart,
  type RunState,
  type SpecGroup,
} from '../../rules/index.ts';
import { checkFlashes, shownRun, tallyView, type CheckFlash } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatMult } from '../format.ts';
import { settings } from '../settings.ts';
import { activePlay, currentTally, preview, run } from '../store.ts';
import { arrivalWeek, isPlural, overtimeUsed, upcomingArrivals } from './household.ts';
import { Tip } from './Tip.tsx';
import './checklist.css';

const GROUP_NAMES: Readonly<Record<Exclude<SpecGroup, 'wishes'>, string>> = {
  household: 'The household',
  shape: 'The shape',
  yard: 'The yard',
};

/** "The Hendersons’ wishes", "Dale’s wishes". */
function wishesTitle(name: string): string {
  return `${name}${name.endsWith('s') ? '’' : '’s'} wishes`;
}

/**
 * The run the checklist judges. While an action plays back, the rules have moved on: it's the
 * house on the board in the week being shown (its phase, so a household's stage holds until
 * the milestone lands). Otherwise the run as it stands.
 */
const judged = computed<RunState>(() => {
  const shown = shownRun.value;
  const s = run.value;
  return shown && shown !== s ? { ...shown, house: s.house } : s;
});
/** Whether a tally is playing: its checklist shows, not a preview. */
const tallying = computed(() => tallyView.value !== null);
/** The play being looked at, if it's legal: the lines it would turn on or off are marked. */
const looking = computed<Play>(() =>
  !tallying.value && preview.value?.legal ? activePlay.value : null,
);
/** Cached, so a tally's beats re-render the rows without asking the rules again. */
const lines = computed(() => rules.checklist(judged.value, looking.value ?? undefined));
/** M4b: the change orders running, as the run on show has them (a ✕ lands with its beat). */
const orders = computed(() => rules.activeChangeOrders(judged.value));
/**
 * M4b: the change orders the last milestone resolved, with how each went (each turns with its
 * beat). They stay until the next phase's first week is played, so a skipped beat, or the
 * shop's sheet over the board, never hides a result; the end screen keeps the last milestone's.
 */
const resolvedOrders = computed<readonly ChangeOrderRecord[]>(() => {
  const s = judged.value;
  const phase =
    s.screen === 'won' ? s.phase : s.slot === 1 && s.overtimeWeek === 0 ? s.phase - 1 : -1;
  return s.changeOrders.filter((r) => r.result !== undefined && r.phase === phase);
});

/**
 * A line's progress parts. A part that doesn't hold yet has a ✕, so it's never told by its
 * color alone. The change order's sheet uses it too.
 */
export function ProgressParts({ parts }: { parts: readonly ProgressPart[] }) {
  return (
    <>
      {parts.map((p, k) => (
        <span key={k} class={p.ok ? 'ok' : 'miss'}>
          {k > 0 ? ' · ' : ''}
          {!p.ok && <span aria-hidden="true">✕ </span>}
          {p.text}
        </span>
      ))}
    </>
  );
}

// A row's tint as it flashes: the preview's colors for a line turning on and off (checklist.css).
const GAINED_TINT = 'rgb(253 238 242)';
const GAINED_CLEAR = 'rgb(253 238 242 / 0)';
const LOST_TINT = 'rgb(253 241 228)';
const LOST_CLEAR = 'rgb(253 241 228 / 0)';

/**
 * A row's flash as the tally reaches it (FEEL.checklist): a line held glows and its Charm
 * pops; a line turned on pops too; a line turned off shakes. With Reduce motion, only the tint.
 */
function playFlash(f: CheckFlash, row: HTMLElement | null, charm: HTMLElement | null): void {
  if (!row) return;
  const c = FEEL.checklist;
  const lost = f.kind === 'lost';
  const [tint, clear] = lost ? [LOST_TINT, LOST_CLEAR] : [GAINED_TINT, GAINED_CLEAR];
  row.animate(
    [
      { backgroundColor: clear },
      { backgroundColor: tint, offset: 0.2 },
      { backgroundColor: clear },
    ],
    { duration: f.ms, easing: 'ease-out' },
  );
  if (settings.value.reduceMotion) return;
  const move = { duration: f.ms * c.moveShare, easing: 'ease-out' };
  const pop = (scale: number) => [
    { transform: 'scale(1)' },
    { transform: `scale(${scale})`, offset: 0.3 },
    { transform: 'scale(1)' },
  ];
  if (f.kind === 'met') row.animate(pop(c.popScale), move);
  if (lost) {
    const s = c.shakePx;
    row.animate(
      [0, -s, s, -s, Math.round(s / 2), 0].map((x) => ({ transform: `translateX(${x}px)` })),
      move,
    );
  } else {
    charm?.animate(pop(c.charmScale), move);
  }
}

function Line({
  line,
  bonus,
  change,
  flash,
  pending,
}: {
  line: ChecklistLine;
  bonus: number;
  /** What the play being looked at would do to it. */
  change: 'gained' | 'lost' | null;
  /** Its flash, while the tally lights it. */
  flash: CheckFlash | undefined;
  /** Held, but the tally hasn't reached it yet: its Charm hasn't landed this week. */
  pending: boolean;
}) {
  const row = useRef<HTMLLIElement>(null);
  const charm = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (flash) playFlash(flash, row.current, charm.current);
  }, [flash?.id]);
  const showProgress = !line.met || change !== null;
  const turnedOn = change === 'gained' || flash?.kind === 'met';
  const turnedOff = change === 'lost' || flash?.kind === 'lost';
  const mark = turnedOn ? '★' : turnedOff ? '✕' : line.met ? '✓' : '·';
  const cls = ['check-line', line.met ? 'met' : 'unmet', change, flash && `flash-${flash.kind}`];
  return (
    <li ref={row} class={cls.filter(Boolean).join(' ')}>
      <span class="check-mark" aria-hidden="true">
        {mark}
      </span>
      <span class="check-name">
        <Tip title={line.name} text={line.text}>
          {line.name}
        </Tip>
      </span>
      <span
        ref={charm}
        class={`charm ${pending ? 'pending' : ''}`}
        title={`+${formatMult(bonus)} ${SCORE_LABELS.mult} while it holds`}
      >
        {line.met ? `+${formatMult(bonus)}` : ''}
      </span>
      {showProgress && line.progress.length > 0 && (
        <span class="check-progress">
          <ProgressParts parts={line.progress} />
        </span>
      )}
      {change && <span class="check-change">{change === 'gained' ? 'turns on' : 'turns off'}</span>}
    </li>
  );
}

/** A taste's mark: a like or a bonus (▲, blue), or a dislike (▼, orange). */
function tasteTone(m: Modifier): 'like' | 'dislike' | 'plain' {
  switch (m.kind) {
    case 'earnNothing':
      return 'dislike';
    case 'earn':
    case 'perCountOver':
    case 'budget':
    case 'setBonus':
    case 'bestPiece':
      return m.pct < 0 ? 'dislike' : 'like';
    case 'mult':
      return m.add < 0 ? 'dislike' : 'like';
    case 'rule': {
      const n = m.add || m.pct || 0;
      // Dearer shop goods are the bad kind of more.
      return (m.key === 'shopPricePct' ? -n : n) < 0 ? 'dislike' : 'like';
    }
    default:
      return 'plain';
  }
}

const TASTE_MARK = { like: '▲', dislike: '▼', plain: '·' } as const;
const TASTE_WORD = { like: 'Likes', dislike: 'Dislikes', plain: 'Taste' } as const;

/** The client's likes and dislikes: what they change, every week. */
function Tastes({ tastes }: { tastes: readonly Modifier[] }) {
  if (tastes.length === 0) return null;
  return (
    <ul class="tastes" aria-label="What the client likes and dislikes">
      {tastes.map((m, k) => {
        const tone = tasteTone(m);
        const text = modifierText(CONTENT, m);
        return (
          <li key={k} class={`taste ${tone}`} aria-label={`${TASTE_WORD[tone]}: ${text}`}>
            <span class="taste-mark" aria-hidden="true">
              {TASTE_MARK[tone]}
            </span>
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

interface Row {
  line: ChecklistLine;
  change: 'gained' | 'lost' | null;
  flash: CheckFlash | undefined;
  pending: boolean;
}

/**
 * Who's still to move in (M4b, D-099), under the household's lines until they arrive: "Grandma
 * arrives at Drywall, week 17". Room for everyone's line already shows what they'll need.
 */
function ArrivalLines({ s }: { s: RunState }) {
  const coming = upcomingArrivals(s);
  if (coming.length === 0) return null;
  const overtime = overtimeUsed(s);
  return (
    <>
      {coming.map((a) => (
        <li key={a.id} class="check-arrival">
          <span class="check-mark" aria-hidden="true">
            →
          </span>
          <span class="check-name">
            <Tip title={a.name} text={a.text}>
              {a.name}
            </Tip>{' '}
            {isPlural(a) ? 'arrive' : 'arrives'} at {rules.phaseName(a.phase)}, week{' '}
            {arrivalWeek(a, overtime)}
          </span>
        </li>
      ))}
    </>
  );
}

const ORDERS_TIP =
  'The client changed their mind after a milestone. A request or a restriction you accepted ' +
  'pays when its milestone is met, if you see it through; a phase effect just runs until then. ' +
  'How each one went stays here until the next phase’s first week is played.';

/** "the Framing milestone": where a change order resolves. */
const milestoneOf = (phase: number) => `the ${rules.phaseName(phase)} milestone`;

/**
 * A change order running (M4b): a request with its progress (✓ once it would count as met), a
 * restriction kept so far or broken (or about to be, by the placement being looked at), or a
 * phase effect until its milestone, with what it pays.
 */
function OrderLine({ order, s, breaks }: { order: ChangeOrderView; s: RunState; breaks: boolean }) {
  const brokenBy =
    order.brokenBy !== undefined ? s.house.pieces.find((q) => q.uid === order.brokenBy) : undefined;
  const broken = order.brokenBy !== undefined;
  let mark = '•';
  let tone = 'phase';
  let status: ComponentChildren = `Until ${milestoneOf(order.phase)}`;
  if (order.kind === 'request') {
    mark = order.met ? '✓' : '·';
    tone = order.met ? 'met' : 'unmet';
    status = (
      <>
        {order.progress && <ProgressParts parts={order.progress} />} · by {milestoneOf(order.phase)}
      </>
    );
  } else if (order.kind === 'restriction') {
    if (broken) {
      mark = '✕';
      tone = 'lost';
      status = brokenBy
        ? `Broken by the ${CONTENT.pieces[brokenBy.defId].name}: it pays nothing`
        : 'Broken: it pays nothing';
    } else if (breaks) {
      mark = '✕';
      tone = 'lost';
      status = 'This placement would break it';
    } else {
      mark = '✓';
      tone = 'met';
      status = `Kept so far · to ${milestoneOf(order.phase)}`;
    }
  }
  const pays = order.reward ? rewardText(CONTENT, order.reward) : null;
  const tip = `${order.text} ${order.terms.join('. ')}.`;
  return (
    <li class={`check-line order ${tone}`}>
      <span class="check-mark" aria-hidden="true">
        {mark}
      </span>
      <span class="check-name">
        <Tip title={order.name} text={tip}>
          {order.name}
        </Tip>
      </span>
      <span class="order-pays">{pays && (broken ? <s>{pays}</s> : pays)}</span>
      <span class="check-progress">{status}</span>
    </li>
  );
}

const RESULT_WORD: Readonly<Record<ChangeOrderResult, string>> = {
  met: 'Met',
  kept: 'Kept',
  missed: 'Missed',
  broken: 'Broken',
  ended: 'Over',
};

/**
 * A change order its milestone resolved (M4b): ✓ met or kept, with what it paid; ✕ missed or
 * broken, its reward struck out; or a phase effect over. The result is a word and a mark, never
 * color alone.
 */
function ResolvedLine({ record }: { record: ChangeOrderRecord }) {
  const def = CONTENT.changeOrders[record.id];
  const result = record.result!;
  const paid = result === 'met' || result === 'kept';
  const tone = paid ? 'met' : result === 'ended' ? 'phase' : 'lost';
  const mark = paid ? '✓' : result === 'ended' ? '•' : '✕';
  const reward = record.reward ?? (def.kind === 'phase' ? undefined : def.reward);
  const pays = reward ? rewardText(CONTENT, reward) : null;
  const at = milestoneOf(record.phase);
  const tip = `${def.text} ${changeOrderText(CONTENT, def).join('. ')}.`;
  return (
    <li class={`check-line order resolved ${tone}`}>
      <span class="check-mark" aria-hidden="true">
        {mark}
      </span>
      <span class="check-name">
        <Tip title={def.name} text={tip}>
          {def.name}
        </Tip>
      </span>
      <span class="order-pays">{pays && (paid ? pays : <s>{pays}</s>)}</span>
      <span class="check-progress">
        <strong class="order-result">{RESULT_WORD[result]}</strong>
        {paid ? `: paid at ${at}` : result === 'ended' ? ` at ${at}` : `: nothing paid at ${at}`}
      </span>
    </li>
  );
}

export function Checklist() {
  const view = tallyView.value;
  const base = judged.value;
  const all = lines.value;
  if (all.length === 0) return null;
  const client = CONTENT.clients[base.setup.clientId];
  // The week being tallied pays its own bonus (an Inspector's Visit raises it for that week).
  const bonus = view?.specBonus || currentTally.value.specBonus || rules.rule(base, 'specBonus');
  const p = tallying.value ? null : preview.value;
  const gained = new Set(p?.legal ? p.specsGained : []);
  const lost = new Set(p?.legal ? p.specsLost : []);
  const flashes = checkFlashes.value;
  const rows: Row[] = all.map((l, k) => {
    // While a tally plays, a line is as the tally shows it: last week's until its beat lands.
    const met = view ? (view.specs.find((s) => s.id === l.id)?.met ?? l.met) : l.met;
    return {
      line: met === l.met ? l : { ...l, met },
      change: gained.has(l.id) ? 'gained' : lost.has(l.id) ? 'lost' : null,
      flash: flashes.find((f) => f.index === k),
      pending: !!view && met && k > view.specAt,
    };
  });
  const held = rows.filter((r) => r.line.met).length;
  const list = (group: SpecGroup) =>
    rows
      .filter((r) => r.line.group === group)
      .map((r) => <Line key={r.line.id} {...r} bonus={bonus} />);
  const wishes = list('wishes');
  const running = orders.value;
  const done = resolvedOrders.value;
  // A placement being looked at that would break a restriction (it stays legal).
  const breaks = p?.legal ? p.breaks : undefined;
  return (
    <section class="checklist" aria-label="The client's checklist">
      <h2>
        {client.name}
        <span class="check-count">
          {held} of {all.length}
        </span>
      </h2>
      <Tastes tastes={client.tastes} />
      <h3>
        <Tip term="checklist">House rules</Tip>
      </h3>
      {(['household', 'shape', 'yard'] as const).map((g) => {
        const ls = list(g);
        return (
          ls.length > 0 && (
            <div key={g} class="check-group">
              <h4>{GROUP_NAMES[g]}</h4>
              <ul>
                {ls}
                {g === 'household' && <ArrivalLines s={base} />}
              </ul>
            </div>
          )
        );
      })}
      {wishes.length > 0 && (
        <div class="check-group">
          <h3>{wishesTitle(client.name)}</h3>
          <ul>{wishes}</ul>
        </div>
      )}
      {(running.length > 0 || done.length > 0) && (
        <div class="check-group change-orders">
          <h3>
            <Tip title="Change orders" text={ORDERS_TIP}>
              Change orders
            </Tip>
          </h3>
          <ul>
            {/* In the order answered: the ones resolved, then the ones running. A milestone's
                resolve in that order too, so each row keeps its place as it turns. The ?debug
                panel can force the same order twice. */}
            {done.map((r, k) => (
              <ResolvedLine key={`done-${r.id}-${k}`} record={r} />
            ))}
            {running.map((o, k) => (
              <OrderLine key={`${o.id}-${k}`} order={o} s={base} breaks={breaks === o.id} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
