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
// short: a house-rules group whose lines all hold folds into one row ("The household 4/4"),
// which a click opens. It opens by itself while a line in it flips, under a preview or on a
// tally's beat, and its held lines' beats light the folded row. The wishes, the change orders,
// and any line that doesn't hold always show; on a short window the client's tastes fold into
// one row too. Its body scrolls on its own (app.css), and the row a beat or a preview is about
// is scrolled into view.
//
// In the pixel UI (D-110) it's a wood panel: the client's name on the plank, their brief on
// hover, and the lines held in a chip beside it; the crew's chip first in the body. Its marks
// are icons, since the pixel fonts lack ★ ✕ ▲ ▼ ▸ ▾: a check for a line that holds, an empty
// ring for one that doesn't yet, a star for one turned on, a cross for one turned off (or an
// order broken or missed), a clock for a phase effect, the house for who's moving in, and
// carets on the rows that fold.

import { computed, signal } from '@preact/signals';
import type { ComponentChildren, RefObject } from 'preact';
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
  type CrewDef,
  type CrewId,
  type Modifier,
  type Play,
  type ProgressPart,
  type Reward,
  type RunState,
  type SpecGroup,
} from '../../rules/index.ts';
import { checkFlashes, shownRun, tallyView, type CheckFlash } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatMult } from '../format.ts';
import { Chip, Icon, Panel, type IconName } from '../kit/kit.tsx';
import { settings } from '../settings.ts';
import { CREW_ICONS } from '../sprites.ts';
import { activePlay, currentTally, preview, run, selected, tool } from '../store.ts';
import { devicePixelRatio, uiPixel } from '../theme/pixel.ts';
import { arrivalWeek, isPlural, overtimeUsed, upcomingArrivals } from './household.ts';
import { Tip } from './Tip.tsx';
import './checklist.css';

type RuleGroup = Exclude<SpecGroup, 'wishes'>;
/** A row that folds: a house-rules group, or the client's tastes on a short window. */
type Fold = RuleGroup | 'tastes';

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
/** M4b: the change orders running, as the run on show has them (a cross lands with its beat). */
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
 * Rows the player opened by hand (UI only): a house-rules group whose lines all hold, or the
 * tastes, which fold on a short window (checklist.css).
 */
const opened = signal<ReadonlySet<Fold>>(new Set());

function toggleFold(f: Fold): void {
  const next = new Set(opened.value);
  if (!next.delete(f)) next.add(f);
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
 * A line's progress parts. A part that doesn't hold yet has a cross, so it's never told by its
 * color alone. The change order's sheet uses it too.
 */
export function ProgressParts({ parts }: { parts: readonly ProgressPart[] }) {
  return (
    <>
      {parts.map((p, k) => (
        <span key={k} class={p.ok ? 'ok' : 'miss'}>
          {k > 0 ? ' · ' : ''}
          {!p.ok && <Icon name="cross" class="miss-mark" />}
          {p.text}
        </span>
      ))}
    </>
  );
}

/** A token's color, as the page has it (tokens.css), for an animation's keyframes. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * A row's flash as the tally reaches it (FEEL.checklist): a line held glows and its Charm
 * pops; a line turned on pops too; a line turned off shakes, in UI pixels. With Reduce motion,
 * only the tint. The tints are the preview's, from the tokens: Charm's for a line that holds or
 * turns on, the warning's for one turned off.
 */
function playFlash(f: CheckFlash, row: HTMLElement | null, charm: HTMLElement | null): void {
  if (!row) return;
  const c = FEEL.checklist;
  const lost = f.kind === 'lost';
  const tint = token(lost ? '--bad-tint' : '--charm-tint');
  row.animate(
    [
      { backgroundColor: 'transparent' },
      { backgroundColor: tint, offset: 0.2 },
      { backgroundColor: 'transparent' },
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
    // Whole UI pixels, so the row's pixel text lands on whole device pixels at every step.
    const px = uiPixel(devicePixelRatio.value);
    const s = c.shakePx;
    row.animate(
      [0, -s, s, -s, Math.round(s / 2), 0].map((x) => ({ transform: `translateX(${x * px}px)` })),
      move,
    );
  } else {
    charm?.animate(pop(c.charmScale), move);
  }
}

/**
 * Scrolls the checklist's body (only it, never the column or the page) so `els` are in view:
 * all of them where they fit, else the first. The plank isn't in the scroller, so nothing
 * covers its top. Nothing moves if they're in view.
 */
function reveal(box: HTMLElement, els: readonly Element[]): boolean {
  if (els.length === 0 || box.scrollHeight <= box.clientHeight) return false;
  const b = box.getBoundingClientRect();
  const margin = 2 * uiPixel(devicePixelRatio.value);
  const top = b.top + margin;
  const bottom = b.bottom - margin;
  const rs = els.map((e) => e.getBoundingClientRect());
  const all = {
    top: Math.min(...rs.map((q) => q.top)),
    bottom: Math.max(...rs.map((q) => q.bottom)),
  };
  const r = all.bottom - all.top <= bottom - top ? all : rs[0]!;
  const dy =
    r.top < top ? r.top - top : r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : 0;
  if (dy === 0) return false;
  box.scrollBy({ top: dy, behavior: scrollBehavior() });
  return true;
}

const scrollBehavior = (): ScrollBehavior => (settings.value.reduceMotion ? 'auto' : 'smooth');

/** A row's mark: an icon in the marks column, centered on the row's first line. */
function Mark({ icon }: { icon: IconName | null }) {
  return (
    <span class="check-mark" aria-hidden="true">
      {icon ? <Icon name={icon} /> : <span class="check-dot" />}
    </span>
  );
}

/**
 * What a line held adds to Charm: "+0.25" where the column has room (1500 px wide and up), and
 * Charm's icon below that, with the number on hover (checklist.css). Empty for a line that
 * doesn't hold.
 */
function CharmAdds({
  value,
  pending,
  spanRef,
  lasts = 'while it holds',
}: {
  /** In hundredths, or null for a line that doesn't hold. */
  value: number | null;
  /** In a tally, held but not reached yet: its Charm hasn't landed this week. */
  pending: boolean;
  spanRef?: RefObject<HTMLSpanElement>;
  /** How long it adds that, for its title: "while it holds". */
  lasts?: string;
}) {
  const words = value === null ? undefined : `+${formatMult(value)} ${SCORE_LABELS.mult} ${lasts}`;
  return (
    <span ref={spanRef} class={`charm ${pending ? 'pending' : ''}`} title={words}>
      {value !== null && (
        <>
          <span class="charm-value">+{formatMult(value)}</span>
          <Icon name="charm" class="charm-icon" />
        </>
      )}
    </span>
  );
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
  const mark = turnedOn ? 'star' : turnedOff ? 'cross' : line.met ? 'check' : 'pending';
  const cls = ['check-line', line.met ? 'met' : 'unmet', change, flash && `flash-${flash.kind}`];
  return (
    <li ref={row} class={cls.filter(Boolean).join(' ')} data-row={line.id}>
      <Mark icon={mark} />
      <span class="check-name">
        <Tip title={line.name} text={line.text}>
          {line.name}
        </Tip>
      </span>
      <CharmAdds value={line.met ? bonus : null} pending={pending} spanRef={charm} />
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

/**
 * The game's own buttons don't take focus from a mouse click, so the keyboard shortcuts keep
 * working after one. Tab still reaches them.
 */
const noFocus = (e: MouseEvent) => e.preventDefault();

/** A row that folds what's under it away: a caret, then what it says. */
function FoldButton({
  fold,
  folded,
  title,
  buttonRef,
  flash,
  children,
}: {
  fold: Fold;
  folded: boolean;
  title: string;
  buttonRef?: RefObject<HTMLButtonElement>;
  /** The beat lighting it in a tally, if one is. */
  flash?: CheckFlash['kind'];
  children: ComponentChildren;
}) {
  const cls = [
    'check-fold',
    folded ? 'folded' : 'open',
    fold === 'tastes' && 'taste-fold',
    flash && `flash-${flash}`,
  ];
  return (
    <button
      ref={buttonRef}
      type="button"
      class={cls.filter(Boolean).join(' ')}
      data-fold={fold}
      aria-expanded={!folded}
      onMouseDown={noFocus}
      onClick={() => toggleFold(fold)}
      title={title}
    >
      <Mark icon={folded ? 'caretRight' : 'caretDown'} />
      {children}
    </button>
  );
}

/**
 * A house-rules group whose lines all hold: one row, "The household 4/4" with a check and its
 * Charm, that opens the group on a click (and folds it again once open). While it's folded, its
 * lines' beats in a tally light this row instead.
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
    <FoldButton
      fold={group}
      folded={folded}
      buttonRef={row}
      flash={flash?.kind}
      title={folded ? `${name}: all ${n} hold. Click to show them.` : 'Click to fold them away'}
    >
      <span class="fold-name">{name}</span>
      <span class="fold-count">
        {n}/{n}
        <Icon name="check" />
      </span>
      <CharmAdds
        value={folded ? n * bonus : null}
        pending={pending}
        spanRef={charm}
        lasts="while they hold"
      />
    </FoldButton>
  );
}

/** A taste's mark: a like or a bonus (up, blue), or a dislike (down, orange). */
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

const TASTE_ICON = { like: 'up', dislike: 'down', plain: null } as const;
const TASTE_WORD = { like: 'Likes', dislike: 'Dislikes', plain: 'Taste' } as const;

/**
 * The client's likes and dislikes: what they change, every week, a row each. On a short window
 * they fold into one row, "Likes and dislikes (3)", which a click opens (checklist.css).
 */
function Tastes({ tastes }: { tastes: readonly Modifier[] }) {
  if (tastes.length === 0) return null;
  const open = opened.value.has('tastes');
  return (
    <div class={`check-group check-tastes ${open ? 'open' : ''}`}>
      <FoldButton
        fold="tastes"
        folded={!open}
        title={open ? 'Click to fold them away' : 'What the client likes and dislikes'}
      >
        <span class="fold-name">Likes and dislikes ({tastes.length})</span>
      </FoldButton>
      <ul class="tastes" aria-label="What the client likes and dislikes">
        {tastes.map((m, k) => {
          const tone = tasteTone(m);
          const text = modifierText(CONTENT, m);
          return (
            <li key={k} class={`taste ${tone}`} aria-label={`${TASTE_WORD[tone]}: ${text}`}>
              <Mark icon={TASTE_ICON[tone]} />
              {/* Never broken inside its last two words ("earn +50%"), so each reads as one. */}
              <span class="check-name">{text.replace(/ (?=\S+$)/, ' ')}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The crew building the house (M4's top bar line, which M5a's top bar has no room for): its
 * icon and name on a wood chip, and what it does all run on hover.
 */
function CrewChip({ id, crew }: { id: CrewId; crew: CrewDef }) {
  const allRun = crew.modifiers.map((m) => modifierText(CONTENT, m)).join(' · ');
  return (
    <p class="check-crew">
      <Tip title={`${crew.name}: your crew`} text={`${crew.blurb} All run: ${allRun}.`}>
        <Chip tone="wood" icon={CREW_ICONS[id]}>
          {crew.name}
        </Chip>
      </Tip>
    </p>
  );
}

export interface Row {
  line: ChecklistLine;
  change: 'gained' | 'lost' | null;
  flash: CheckFlash | undefined;
  pending: boolean;
}

/** The line above `row` in its group, or else the one below it (a flipped row's neighbor). */
function besideRow(rows: readonly Row[], row: Row): Row | undefined {
  const group = rows.filter((r) => r.line.group === row.line.group);
  const k = group.indexOf(row);
  return group[k - 1] ?? group[k + 1];
}

/**
 * What a legal play being looked at brings into view, as selectors, the one that must show
 * first: the first row it flips, with a line beside it where both fit, else the change order it
 * would break (D-110). Null for a play that flips nothing and breaks nothing: it leaves the
 * checklist where it is, so the client's tastes stay in view where they were ("Lawns earn +50%"
 * while placing a Lawn).
 */
export function playTarget(rows: readonly Row[], breaks: string | undefined): string[] | null {
  const flipped = rows.find((r) => r.change !== null);
  if (flipped) {
    return [flipped, besideRow(rows, flipped)].flatMap((r) =>
      r ? [`[data-row="${r.line.id}"]`] : [],
    );
  }
  return breaks ? [`[data-order="${breaks}"]`] : null;
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
          <Mark icon="House" />
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
 * What a change order pays, coin first as everywhere (D-098): "●+4", struck through in the bad
 * color once it's lost (kit.css .price-full). Every order pays budget today; anything else
 * reads in the rules' words.
 */
function Pays({ reward, lost }: { reward: Reward | undefined; lost: boolean }) {
  if (!reward) return null;
  const words = rewardText(CONTENT, reward);
  const onlyBudget =
    !!reward.budget &&
    !reward.score &&
    !reward.rerolls &&
    !reward.demolitions &&
    !reward.overtime &&
    !reward.tool;
  if (!onlyBudget) return lost ? <s>{words}</s> : <>{words}</>;
  return (
    <span class="price order-price" title={lost ? `${words}: lost` : `Pays ${words}`}>
      <Icon name="coin" />
      {lost ? (
        <s class="price-full num">+{reward.budget}</s>
      ) : (
        <span class="price-now num">+{reward.budget}</span>
      )}
    </span>
  );
}

/**
 * A change order running (M4b): a request with its progress (a check once it would count as
 * met), a restriction kept so far or broken (or about to be, by the placement being looked at),
 * or a phase effect until its milestone, with what it pays.
 */
function OrderLine({ order, s, breaks }: { order: ChangeOrderView; s: RunState; breaks: boolean }) {
  const brokenBy =
    order.brokenBy !== undefined ? s.house.pieces.find((q) => q.uid === order.brokenBy) : undefined;
  const broken = order.brokenBy !== undefined;
  let mark: IconName = 'clock';
  let tone = 'phase';
  let status: ComponentChildren = `Until ${milestoneOf(order.phase)}`;
  if (order.kind === 'request') {
    mark = order.met ? 'check' : 'pending';
    tone = order.met ? 'met' : 'unmet';
    status = (
      <>
        {order.progress && <ProgressParts parts={order.progress} />} · by {milestoneOf(order.phase)}
      </>
    );
  } else if (order.kind === 'restriction') {
    if (broken) {
      mark = 'cross';
      tone = 'lost';
      status = brokenBy
        ? `Broken by the ${CONTENT.pieces[brokenBy.defId].name}: it pays nothing`
        : 'Broken: it pays nothing';
    } else if (breaks) {
      mark = 'cross';
      tone = 'lost breaking';
      status = 'This placement would break it';
    } else {
      mark = 'check';
      tone = 'met';
      status = `Kept so far · to ${milestoneOf(order.phase)}`;
    }
  }
  const tip = `${order.text} ${orderTerms(order.id, order.terms).join('. ')}.`;
  return (
    <li class={`check-line order ${tone}`} data-order={order.id}>
      <Mark icon={mark} />
      <span class="check-name">
        <Tip title={order.name} text={tip}>
          {order.name}
        </Tip>
      </span>
      <span class="order-pays">
        <Pays reward={order.reward} lost={broken} />
      </span>
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
 * A change order its milestone resolved (M4b): a check, met or kept, with what it paid; a
 * cross, missed or broken, its reward struck out; or a phase effect over. The result is a word
 * and a mark, never color alone.
 */
function ResolvedLine({ record }: { record: ChangeOrderRecord }) {
  const def = CONTENT.changeOrders[record.id];
  const result = record.result!;
  const paid = result === 'met' || result === 'kept';
  const tone = paid ? 'met' : result === 'ended' ? 'phase' : 'lost';
  const mark: IconName = paid ? 'check' : result === 'ended' ? 'clock' : 'cross';
  const reward = record.reward ?? (def.kind === 'phase' ? undefined : def.reward);
  const at = milestoneOf(record.phase);
  const tip = `${def.text} ${orderTerms(def.id, changeOrderText(CONTENT, def)).join('. ')}.`;
  return (
    <li class={`check-line order resolved ${tone}`}>
      <Mark icon={mark} />
      <span class="check-name">
        <Tip title={def.name} text={tip}>
          {def.name}
        </Tip>
      </span>
      <span class="order-pays">
        <Pays reward={reward} lost={!paid} />
      </span>
      <span class="check-progress">
        <strong class="order-result">{RESULT_WORD[result]}</strong>
        {paid ? `: paid at ${at}` : result === 'ended' ? ` at ${at}` : `: nothing paid at ${at}`}
      </span>
    </li>
  );
}

export function Checklist() {
  const box = useRef<HTMLDivElement>(null);
  /** Groups a tally's flip opened: they stay open until it ends, so nothing folds mid-count. */
  const tallyOpen = useRef(new Set<RuleGroup>());
  const view = tallyView.value;
  const base = judged.value;
  const all = lines.value;
  const client = CONTENT.clients[base.setup.clientId];
  const crewId = base.setup.crewId;
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
  // folded group's row), else what the play being looked at flips or breaks (playTarget; a play
  // that does neither leaves it where it is). Selectors, the one that must show first.
  const newest = flashes.reduce<CheckFlash | undefined>(
    (a, f) => (!a || f.id > a.id ? f : a),
    undefined,
  );
  let target: string[] | null = null;
  let targetKey: string | null = null;
  const lit = newest && rows[newest.index];
  if (lit) {
    const g = lit.line.group;
    target = [g !== 'wishes' && isFolded(g) ? `[data-fold="${g}"]` : `[data-row="${lit.line.id}"]`];
    targetKey = `flash-${newest.id}`;
  } else if (p?.legal) {
    target = playTarget(rows, breaks);
    targetKey = target && target.join(' ');
  }
  const targetRef = useRef(target);
  targetRef.current = target;
  // Where the player had it scrolled before the checklist first scrolled itself, while a play
  // is looked at or a tally plays: it goes back there once that's over.
  const before = useRef<number | null>(null);
  const show = () => {
    const sels = targetRef.current;
    const scroller = box.current;
    if (!sels || !scroller) return;
    const els = sels.flatMap((s) => scroller.querySelector(s) ?? []);
    const top = scroller.scrollTop;
    if (reveal(scroller, els) && before.current === null) before.current = top;
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
    <Panel
      class="checklist"
      label="The client's checklist"
      title={
        <Tip title={client.name} text={client.brief}>
          {client.name}
        </Tip>
      }
      head={
        <Chip
          tone="inset"
          icon="check"
          class="check-count"
          title={`${held} of ${all.length} lines hold`}
        >
          {held}/{all.length}
        </Chip>
      }
      bodyClass="check-body"
    >
      <div ref={box} class="check-scroll">
        <CrewChip id={crewId} crew={CONTENT.crews[crewId]} />
        <Tastes tastes={client.tastes} />
        <h3 class="plank-tag">
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
                <h4 class="check-group-name">{GROUP_NAMES[g]}</h4>
              )}
              <ul>
                {!folded && lineList(rs)}
                {g === 'household' && <ArrivalLines s={base} />}
              </ul>
            </div>
          );
        })}
        {wishes.length > 0 && (
          <>
            <h3 class="plank-tag">{wishesTitle(client.name)}</h3>
            <ul class="check-group">{lineList(wishes)}</ul>
          </>
        )}
        {(running.length > 0 || done.length > 0) && (
          <>
            <h3 class="plank-tag">
              <Tip title="Change orders" text={ORDERS_TIP}>
                Change orders
              </Tip>
            </h3>
            {/* In the order answered: the ones resolved, then the ones running. A milestone's
                resolve in that order too, so each row keeps its place as it turns. The ?debug
                panel can force the same order twice. */}
            <ul class="check-group change-orders">
              {done.map((r, k) => (
                <ResolvedLine key={`done-${r.id}-${k}`} record={r} />
              ))}
              {running.map((o, k) => (
                <OrderLine key={`${o.id}-${k}`} order={o} s={base} breaks={breaks === o.id} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}
