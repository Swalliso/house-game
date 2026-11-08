// The client's checklist (M4a, D-101): the client's tastes, then the house rules under "The
// household", "The shape", and "The yard", then the client's own wishes. Each line held adds
// Charm. While a card is pointed at a spot, lines the play would turn on or off are marked;
// while a tally plays, each line lights up as the tally reaches it (director.ts). The rules
// work out every line and its progress: the UI never scores anything itself. M4b adds who's
// still to move in, under the household, and the change orders running, as their own group,
// where the ones a milestone just resolved stay, marked with how they went, until the next
// phase's first week is played.
//
// It has to share the left column with the score panel and Inspect at 1280×720, so it keeps
// short: a house-rules group whose lines all hold folds into one row ("The household ✓ 4 of
// 4"), which a click opens. It opens by itself while a line in it flips, under a preview or on
// a tally's beat, and its held lines' beats light the folded row. The wishes, the change
// orders, and any line that doesn't hold always show. When the column is short the checklist
// scrolls on its own, and the row a beat or a preview is about is scrolled into view.

import { computed, signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import {
  changeOrderText,
  CONTENT,
  modifierText,
  rewardText,
  rules,
  SCORE_LABELS,
  type ChangeOrderId,
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
import { activePlay, currentTally, preview, run, selected, tool } from '../store.ts';
import { arrivalWeek, isPlural, overtimeUsed, upcomingArrivals } from './household.ts';
import { Tip } from './Tip.tsx';
import './checklist.css';

type RuleGroup = Exclude<SpecGroup, 'wishes'>;

const GROUP_NAMES: Readonly<Record<RuleGroup, string>> = {
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

/** House-rules groups whose lines all hold that the player opened by hand (UI only). */
const opened = signal<ReadonlySet<RuleGroup>>(new Set());

function toggleGroup(g: RuleGroup): void {
  const next = new Set(opened.value);
  if (!next.delete(g)) next.add(g);
  opened.value = next;
}

/**
 * A change order's terms as the sheet and the checklist list them. A phase effect's are what
 * it changes: when it runs is said beside them ("Until the Framing milestone"), so the rules'
 * "for the next phase" never reads as the phase after the one the top bar shows.
 */
export function orderTerms(id: ChangeOrderId, terms: readonly string[]): readonly string[] {
  const def = CONTENT.changeOrders[id];
  return def.kind === 'phase' ? def.modifiers.map((m) => modifierText(CONTENT, m)) : terms;
}

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

/**
 * Scrolls the checklist (only it, never the column or the page) so `el` is in view below its
 * sticky header. Nothing moves if it's already in view.
 */
function reveal(box: HTMLElement, el: Element): boolean {
  if (box.scrollHeight <= box.clientHeight) return false;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const head = box.querySelector(':scope > h2')?.getBoundingClientRect().height ?? 0;
  const top = b.top + head + 4;
  const bottom = b.bottom - 6;
  const dy =
    r.top < top ? r.top - top : r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : 0;
  if (dy === 0) return false;
  box.scrollBy({ top: dy, behavior: scrollBehavior() });
  return true;
}

const scrollBehavior = (): ScrollBehavior => (settings.value.reduceMotion ? 'auto' : 'smooth');

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
    <li ref={row} class={cls.filter(Boolean).join(' ')} data-row={line.id}>
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
      {/* What the play does to it comes first, under its name: a short checklist box shows that
          before the progress. */}
      {change && <span class="check-change">{change === 'gained' ? 'turns on' : 'turns off'}</span>}
      {showProgress && line.progress.length > 0 && (
        <span class="check-progress">
          <ProgressParts parts={line.progress} />
        </span>
      )}
    </li>
  );
}

const noFocus = (e: MouseEvent) => e.preventDefault();

/**
 * A house-rules group whose lines all hold: one row, "▸ The household ✓ 4 of 4 +1", that opens
 * the group on a click (and folds it again, ▾, once open). While it's folded, its lines' beats
 * in a tally light this row instead.
 */
function FoldRow({
  group,
  rows,
  folded,
  bonus,
  pending,
}: {
  group: RuleGroup;
  rows: readonly Row[];
  folded: boolean;
  bonus: number;
  /** In a tally, a line of it the tally hasn't reached yet: its Charm hasn't landed. */
  pending: boolean;
}) {
  const row = useRef<HTMLButtonElement>(null);
  const charm = useRef<HTMLSpanElement>(null);
  // The newest beat on any of its lines, while it's folded.
  const flash = folded
    ? rows.reduce<CheckFlash | undefined>(
        (a, r) => (r.flash && (!a || r.flash.id > a.id) ? r.flash : a),
        undefined,
      )
    : undefined;
  useEffect(() => {
    if (flash) playFlash(flash, row.current, charm.current);
  }, [flash?.id]);
  const n = rows.length;
  const name = GROUP_NAMES[group];
  return (
    <button
      ref={row}
      type="button"
      class={`check-fold ${folded ? 'folded' : 'open'}`}
      data-fold={group}
      aria-expanded={!folded}
      onMouseDown={noFocus}
      onClick={() => toggleGroup(group)}
      title={folded ? `${name}: all ${n} hold. Click to show them.` : 'Click to fold them away'}
    >
      <span class="fold-mark" aria-hidden="true">
        {folded ? '▸' : '▾'}
      </span>
      <span class="fold-name">{name}</span>
      <span class="fold-count">
        <span aria-hidden="true">✓ </span>
        {n} of {n}
      </span>
      <span ref={charm} class={`charm ${pending ? 'pending' : ''}`}>
        {folded ? `+${formatMult(n * bonus)}` : ''}
      </span>
    </button>
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

/** The client's likes and dislikes: what they change, every week. They run on as one paragraph. */
function Tastes({ tastes }: { tastes: readonly Modifier[] }) {
  if (tastes.length === 0) return null;
  return (
    <ul class="tastes" aria-label="What the client likes and dislikes">
      {tastes.map((m, k) => {
        const tone = tasteTone(m);
        const text = modifierText(CONTENT, m);
        // Where a line breaks: never between the mark and the first word, nor inside the last
        // two ("earn +50%"), so each taste reads as one.
        const [first = '', ...more] = text.split(' ');
        const rest = more.length > 0 ? ` ${more.join(' ').replace(/ (?=\S+$)/, '\u00a0')}` : '';
        return (
          <li key={k} class={`taste ${tone}`} aria-label={`${TASTE_WORD[tone]}: ${text}`}>
            <span class="taste-lead">
              <span class="taste-mark" aria-hidden="true">
                {TASTE_MARK[tone]}
              </span>
              {first}
            </span>
            {rest}
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
 * Who's still to move in (M4b, D-103), under the household's lines until they arrive: "Grandma
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
  const tip = `${order.text} ${orderTerms(order.id, order.terms).join('. ')}.`;
  return (
    <li class={`check-line order ${tone}`} data-order={order.id}>
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
  const tip = `${def.text} ${orderTerms(def.id, changeOrderText(CONTENT, def)).join('. ')}.`;
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
  const box = useRef<HTMLElement>(null);
  /** Groups a tally's flip opened: they stay open until it ends, so nothing folds mid-count. */
  const tallyOpen = useRef(new Set<RuleGroup>());
  const view = tallyView.value;
  const base = judged.value;
  const all = lines.value;
  const client = CONTENT.clients[base.setup.clientId];
  const crew = CONTENT.crews[base.setup.crewId];
  const allRun = crew.modifiers.map((m) => modifierText(CONTENT, m)).join(' · ');
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
  if (!view) tallyOpen.current.clear();
  for (const f of flashes) {
    const g = rows[f.index]?.line.group;
    if (f.kind !== 'held' && g && g !== 'wishes') tallyOpen.current.add(g);
  }
  const groupRows = (g: SpecGroup) => rows.filter((r) => r.line.group === g);
  /** A group folds when all its lines hold, unless the player opened it or a line in it flips. */
  const isFolded = (g: RuleGroup): boolean => {
    const rs = groupRows(g);
    if (rs.length === 0 || !rs.every((r) => r.line.met) || opened.value.has(g)) return false;
    if (tallyOpen.current.has(g)) return false;
    return !rs.some((r) => r.change !== null || (r.flash && r.flash.kind !== 'held'));
  };
  const held = rows.filter((r) => r.line.met).length;
  const running = orders.value;
  const done = resolvedOrders.value;
  // A placement being looked at that would break a restriction (it stays legal).
  const breaks = p?.legal ? p.breaks : undefined;

  // What to bring into view when the checklist scrolls: the row the tally just lit (or its
  // folded group's row), else the first row the play being looked at flips, else the order it
  // would break.
  const newest = flashes.reduce<CheckFlash | undefined>(
    (a, f) => (!a || f.id > a.id ? f : a),
    undefined,
  );
  let target: string | null = null;
  let targetKey: string | null = null;
  const lit = newest && rows[newest.index];
  if (lit) {
    const g = lit.line.group;
    target = g !== 'wishes' && isFolded(g) ? `[data-fold="${g}"]` : `[data-row="${lit.line.id}"]`;
    targetKey = `flash-${newest.id}`;
  } else if (p?.legal) {
    const flipped = rows.find((r) => r.change !== null);
    target = flipped
      ? `[data-row="${flipped.line.id}"]`
      : breaks
        ? `[data-order="${breaks}"]`
        : null;
    targetKey = target;
  }
  const targetRef = useRef(target);
  targetRef.current = target;
  // Where the player had it scrolled before the checklist first scrolled itself, while a play
  // is looked at or a tally plays: it goes back there once that's over.
  const before = useRef<number | null>(null);
  const show = () => {
    const el = targetRef.current && box.current?.querySelector(targetRef.current);
    if (!el || !box.current) return;
    const top = box.current.scrollTop;
    if (reveal(box.current, el) && before.current === null) before.current = top;
  };
  // After the frame's other panels have rendered: Inspect growing for the same play shrinks
  // the checklist. And again whenever the checklist's box changes size while there's a target.
  useEffect(show, [targetKey]);
  const busyWithIt = !!view || selected.value !== null || tool.value === 'demolish';
  useEffect(() => {
    if (busyWithIt || before.current === null) return;
    box.current?.scrollTo({ top: before.current, behavior: scrollBehavior() });
    before.current = null;
  }, [busyWithIt]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(show);
    ro.observe(el);
    return () => ro.disconnect();
  }, [all.length === 0]);

  if (all.length === 0) return null;
  const lineList = (rs: readonly Row[]) =>
    rs.map((r) => <Line key={r.line.id} {...r} bonus={bonus} />);
  const wishes = groupRows('wishes');
  return (
    <section ref={box} class="checklist" aria-label="The client's checklist">
      <h2>
        <Tip title={client.name} text={client.brief}>
          {client.name}
        </Tip>
        <span class="check-count">
          {held} of {all.length}
        </span>
      </h2>
      {/* Who's building it, and what the crew does all run (M4's top bar line, which M5a's top
          bar has no room for). */}
      <p class="check-crew">
        Your crew:{' '}
        <Tip title={`${crew.name}: your crew`} text={`${crew.blurb} All run: ${allRun}.`}>
          {crew.name}
        </Tip>
      </p>
      <Tastes tastes={client.tastes} />
      <h3>
        <Tip term="checklist">House rules</Tip>
      </h3>
      {(['household', 'shape', 'yard'] as const).map((g) => {
        const rs = groupRows(g);
        if (rs.length === 0) return null;
        const allHeld = rs.every((r) => r.line.met);
        const folded = isFolded(g);
        return (
          <div key={g} class={`check-group ${folded ? 'folded' : ''}`}>
            {allHeld ? (
              <FoldRow
                group={g}
                rows={rs}
                folded={folded}
                bonus={bonus}
                pending={rs.some((r) => r.pending)}
              />
            ) : (
              <h4>{GROUP_NAMES[g]}</h4>
            )}
            <ul>
              {!folded && lineList(rs)}
              {g === 'household' && <ArrivalLines s={base} />}
            </ul>
          </div>
        );
      })}
      {wishes.length > 0 && (
        <div class="check-group">
          <h3>{wishesTitle(client.name)}</h3>
          <ul>{lineList(wishes)}</ul>
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
