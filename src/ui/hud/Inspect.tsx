// The inspect panel: why a placement scores what it does, or what a piece or tile is.
// Readability is in the slice (§2): the exact number on placement, and every piece it changes.
// From M2 it also shows a piece's layout facts (tags, regions, view, links, fenced yards), its
// timers, unmet requirements, budget, and what the demolish tool would remove.

import {
  cardText,
  CONTENT,
  regionText,
  rules,
  SCORE_LABELS,
  terrainAt,
  type BreakdownLine,
  type PieceInfo,
  type Region,
  type Tag,
} from '../../rules/index.ts';
import { formatMult, formatNumber, signed } from '../format.ts';
import {
  currentTally,
  demolishArmed,
  demolishPreview,
  inspected,
  preview,
  run,
  selected,
  tool,
} from '../store.ts';
import './hud-m2.css';

const REGION_CHIP: Record<Region, string> = {
  sunny: 'Sunny side',
  frontYard: 'Front yard',
  backYard: 'Back yard',
  fencedYard: 'Fenced yard',
};

/** Tags the layout gives, rather than the card: worth pointing out. */
const LAYOUT_TAG_TITLE: Partial<Record<Tag, string>> = {
  Dark: 'Interior rooms are Dark',
  Sunny: 'On the sunny side',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Lines({
  lines,
  voided = false,
}: {
  lines: readonly BreakdownLine[];
  /** The piece's requirement is unmet, so none of these pay. */
  voided?: boolean;
}) {
  // An unmet requirement's line is shown as its own warning row.
  const shown = lines.filter((l) => l.op !== 'none');
  if (shown.length === 0) {
    if (voided) return null;
    return <p class="muted">Nothing yet: it needs the right neighbors.</p>;
  }
  return (
    <ul class={`lines ${voided ? 'voided' : ''}`}>
      {shown.map((l, i) => (
        <li key={i} class={l.value < 0 ? 'bad' : 'good'}>
          <span>{l.label}</span>
          <span class="value">
            {l.value < 0 ? '−' : '+'}
            {Math.abs(l.value)}
            {l.op === 'pct' ? '%' : l.op === 'budget' ? ' budget' : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Unmet({ why }: { why: string | undefined }) {
  if (why === undefined) return null;
  return (
    <p class="warn" role="note">
      <span aria-hidden="true">⚠ </span>Earns nothing: it must be {why}
    </p>
  );
}

function Timers({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <>
      <h3>Timers</h3>
      <ul class="timers">
        {lines.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </>
  );
}

function TagChips({ tags, own }: { tags: readonly Tag[]; own: readonly Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <p class="chips" aria-label="Tags">
      {tags.map((t) => {
        const fromLayout = !own.includes(t);
        const special = t === 'Dark' || t === 'Sunny';
        return (
          <span
            key={t}
            class={`chip ${special ? `chip-${t.toLowerCase()}` : ''} ${fromLayout ? 'from-layout' : ''}`}
            title={fromLayout ? LAYOUT_TAG_TITLE[t] : undefined}
          >
            {t}
          </span>
        );
      })}
    </p>
  );
}

function RegionChips({ regions, fenced }: { regions: readonly Region[]; fenced: number }) {
  if (regions.length === 0) return null;
  return (
    <p class="chips" aria-label="Where it is">
      {regions.map((r) => (
        <span key={r} class={`chip region ${r}`}>
          {REGION_CHIP[r]}
          {r === 'fencedYard' && fenced > 0 ? ` · ${fenced} tiles` : ''}
        </span>
      ))}
    </p>
  );
}

/** A placed piece's place in the layout, as short plain lines. */
function LayoutFacts({ info }: { info: PieceInfo }) {
  const s = run.value;
  const facts: string[] = [];
  if (info.side === 'exterior') facts.push('Exterior room: it touches the outside');
  if (info.side === 'interior') facts.push('Interior room: no outside wall, so it’s Dark');
  for (const r of info.regions) facts.push(capitalize(regionText(r)));
  if (info.view) facts.push('Has a view');
  if (info.linked.length > 0) {
    const names = info.linked.map((uid) => {
      const p = s.house.pieces.find((q) => q.uid === uid);
      return p ? CONTENT.pieces[p.defId].name : 'a room';
    });
    facts.push(`Linked by Hallway to ${names.join(', ')}`);
  }
  if (info.fencedYardTiles > 0) {
    facts.push(`Fenced yard: ${info.fencedYardTiles} tiles`);
  }
  if (facts.length === 0) return null;
  return (
    <>
      <h3>Layout</h3>
      <ul class="facts">
        {facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </>
  );
}

function BudgetChange({ before, after }: { before: number; after: number }) {
  if (before === after) return null;
  return (
    <p class={`budget-change ${after > before ? 'good' : 'bad'}`}>
      Budget this week: {formatNumber(before)} → <strong>{formatNumber(after)}</strong> (
      {signed(after - before)})
    </p>
  );
}

function PlacingInfo() {
  const p = preview.value;
  const s = run.value;
  const i = selected.value;
  const card = i === null ? undefined : s.hand[i];
  if (!card) return null;
  const def = CONTENT.pieces[card.id];
  if (!p) {
    return (
      <>
        <h2>{def.name}</h2>
        <p class="muted">Point at the lot to see what it would earn.</p>
      </>
    );
  }
  if (!p.legal) {
    return (
      <>
        <h2>{def.name}</h2>
        <p class="reason">
          <span aria-hidden="true">✕ </span>
          {p.reason}
        </p>
      </>
    );
  }
  const others = p.lines.filter((l) => !l.isNew);
  const unmet = p.newPiece?.unmet;
  return (
    <>
      <h2>
        {def.name} <span class="earns">earns {p.newPiece?.earned ?? 0}</span>
      </h2>
      <Unmet why={unmet} />
      <Lines lines={p.newPiece?.lines ?? []} voided={unmet !== undefined} />
      {others.length > 0 && (
        <>
          <h3>Changes nearby</h3>
          <ul class="lines">
            {others.map((l) => (
              <li key={l.uid} class={l.after < l.before ? 'bad' : 'good'}>
                <span>{CONTENT.pieces[l.defId].name}</span>
                <span class="value">
                  {l.before} → {l.after}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {p.setsGained.map((set) => (
        <p key={set.key} class="set-note good">
          ★ Completes {CONTENT.sets[set.set].name}: +{set.points} {SCORE_LABELS.points}, +
          {formatMult(set.mult)} {SCORE_LABELS.mult}
        </p>
      ))}
      {p.setsLost.map((set) => (
        <p key={set.key} class="set-note bad">
          ✕ Breaks {CONTENT.sets[set.set].name}
        </p>
      ))}
      {p.clearedTrees.length > 0 && (
        <p class="muted">
          Clears {p.clearedTrees.length} {p.clearedTrees.length === 1 ? 'Tree' : 'Trees'}.
        </p>
      )}
      <Timers lines={p.upcoming} />
      <BudgetChange before={p.budgetBefore} after={p.budgetAfter} />
      <p class="total-line">
        This week: {formatNumber(p.before.total)} → <strong>{formatNumber(p.after.total)}</strong>{' '}
        {SCORE_LABELS.total}
      </p>
    </>
  );
}

/** What the demolish tool would remove under the pointer, and what it would cost this week. */
function DemolishInfo() {
  const d = demolishPreview.value;
  const s = run.value;
  const left = `${s.demolitionsLeft} ${s.demolitionsLeft === 1 ? 'demolition' : 'demolitions'} left this run.`;
  if (!d) {
    return (
      <>
        <h2>Demolish</h2>
        <p class="muted">Point at a piece or a boulder. {left}</p>
      </>
    );
  }
  const t = d.target;
  const name = !t
    ? null
    : 'feature' in t
      ? CONTENT.features[t.feature].name
      : CONTENT.pieces[t.defId].name;
  if (!d.legal) {
    return (
      <>
        <h2>{name ? `Demolish ${name}?` : 'Demolish'}</h2>
        <p class="reason">
          <span aria-hidden="true">✕ </span>
          {d.reason ?? 'That can’t be demolished.'}
        </p>
      </>
    );
  }
  return (
    <>
      <h2>Demolish {name ?? 'this'}?</h2>
      <p class="muted">No refund. Points already earned stay. {left}</p>
      <p class="total-line">
        This week: {formatNumber(d.before.total)} → <strong>{formatNumber(d.after.total)}</strong>{' '}
        {SCORE_LABELS.total}
      </p>
      {demolishArmed.value && <p class="demolish-confirm">Click it again to demolish it.</p>}
    </>
  );
}

const FEATURE_TEXT: Record<string, string> = {
  tree: 'Quiet and Green, and a view. Each Tree tile counts as its own neighbor. Building here clears it.',
  pond: 'Water, and a view. It counts once as a neighbor, however much of it a piece touches. Nothing can be built on it.',
  creek:
    'Water, and a view. It counts once as a neighbor. Nothing can be built on it, except a Driveway.',
  boulder: 'Gives nothing, and blocks building. A demolition clears it.',
};

export function Inspect() {
  if (tool.value === 'demolish') {
    return (
      <section class="inspect">
        <DemolishInfo />
      </section>
    );
  }
  if (selected.value !== null) {
    return (
      <section class="inspect">
        <PlacingInfo />
      </section>
    );
  }
  const what = inspected.value;
  const s = run.value;
  let body = <p class="muted">Point at anything on the lot to see what it is and what it earns.</p>;
  if (what?.kind === 'piece') {
    const piece = s.house.pieces.find((p) => p.uid === what.uid);
    const score = currentTally.value.pieces.find((p) => p.uid === what.uid);
    if (piece && score) {
      const def = CONTENT.pieces[piece.defId];
      const text = cardText(CONTENT, def);
      const info = rules.describePiece(s, piece.uid);
      const timers = rules.pieceTimers(s, piece.uid);
      body = (
        <>
          <h2>
            {def.name} <span class="earns">earns {score.earned} a week</span>
          </h2>
          {info ? (
            <TagChips tags={info.tags} own={def.tags} />
          ) : (
            <p class="muted">{def.tags.join(' · ')}</p>
          )}
          <Unmet why={score.unmet} />
          <Lines lines={score.lines} voided={score.unmet !== undefined} />
          {score.pct !== 0 && score.points > 0 && score.unmet === undefined && (
            <p class="muted">
              {score.points} × {100 + score.pct}% = {score.earned}
            </p>
          )}
          {info && <LayoutFacts info={info} />}
          <Timers lines={timers} />
          <h3>Card</h3>
          <ul class="effects">
            {text.effects.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      );
    }
  } else if (what?.kind === 'tile') {
    const t = terrainAt(s.house.lot, what.x, what.y);
    const info = rules.describeTile(s, what.x, what.y);
    const where = info && <RegionChips regions={info.regions} fenced={info.fencedYardTiles} />;
    body = t ? (
      <>
        <h2>{CONTENT.features[t].name}</h2>
        <p>{FEATURE_TEXT[t]}</p>
        {where}
      </>
    ) : (
      <>
        <h2>Open ground</h2>
        {where}
        <p class="muted">Build anything here.</p>
      </>
    );
  } else if (what?.kind === 'street') {
    body = (
      <>
        <h2>The street</h2>
        <p>Loud. Any piece touching the bottom edge of the lot is next to it.</p>
      </>
    );
  } else if (what?.kind === 'card') {
    const card = s.hand[what.i];
    if (card) {
      body = (
        <>
          <h2>{CONTENT.pieces[card.id].name}</h2>
          <p class="muted">Click the card (or press {what.i + 1}), then point at the lot.</p>
        </>
      );
    }
  }
  return <section class="inspect">{body}</section>;
}
