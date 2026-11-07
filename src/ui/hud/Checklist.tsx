// The client's checklist (M4a, D-097): the client's tastes, then the house rules under "The
// household", "The shape", and "The yard", then the client's own wishes. Each line held adds
// Charm. While a card is pointed at a spot, lines the play would turn on or off are marked;
// while a tally plays, each line lights up as the tally reaches it (director.ts). The rules
// work out every line and its progress: the UI never scores anything itself.

import { computed } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import {
  CONTENT,
  modifierText,
  rules,
  SCORE_LABELS,
  type ChecklistLine,
  type Modifier,
  type Play,
  type RunState,
  type SpecGroup,
} from '../../rules/index.ts';
import { checkFlashes, shownRun, tallyView, type CheckFlash } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatMult } from '../format.ts';
import { settings } from '../settings.ts';
import { activePlay, currentTally, preview, run } from '../store.ts';
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
          {/* A part that doesn't hold yet has a ✕, so it's never told by its color alone. */}
          {line.progress.map((p, k) => (
            <span key={k} class={p.ok ? 'ok' : 'miss'}>
              {k > 0 ? ' · ' : ''}
              {!p.ok && <span aria-hidden="true">✕ </span>}
              {p.text}
            </span>
          ))}
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
              <ul>{ls}</ul>
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
    </section>
  );
}
