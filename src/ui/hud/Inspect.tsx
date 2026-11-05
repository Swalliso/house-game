// The inspect panel: why a placement scores what it does, or what a piece or tile is.
// Readability is in the slice (§2): the exact number on placement, and every piece it changes.

import { cardText, CONTENT, isSunny, terrainAt, type BreakdownLine } from '../../rules/index.ts';
import { formatMult, formatNumber } from '../format.ts';
import { currentTally, inspected, preview, run, selected } from '../store.ts';

function Lines({ lines }: { lines: readonly BreakdownLine[] }) {
  if (lines.length === 0) return <p class="muted">Nothing yet: it needs the right neighbors.</p>;
  return (
    <ul class="lines">
      {lines.map((l, i) => (
        <li key={i} class={l.value < 0 ? 'bad' : 'good'}>
          <span>{l.label}</span>
          <span class="value">
            {l.value < 0 ? '−' : '+'}
            {Math.abs(l.value)}
            {l.op === 'pct' ? '%' : ''}
          </span>
        </li>
      ))}
    </ul>
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
  return (
    <>
      <h2>
        {def.name} <span class="earns">earns {p.newPiece?.earned ?? 0}</span>
      </h2>
      <Lines lines={p.newPiece?.lines ?? []} />
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
          ★ Completes {CONTENT.sets[set.set].name}: +{set.points} Comfort, +{formatMult(set.mult)}{' '}
          Charm
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
      <p class="total-line">
        This week: {formatNumber(p.before.total)} → <strong>{formatNumber(p.after.total)}</strong>{' '}
        Wow
      </p>
    </>
  );
}

const FEATURE_TEXT: Record<string, string> = {
  tree: 'Quiet and Green, and a view. Each Tree tile counts as its own neighbor. Building here clears it.',
  pond: 'Water, and a view. It counts once as a neighbor, however much of it a piece touches. Nothing can be built on it.',
  creek: 'Water, and a view. It counts once as a neighbor. Nothing can be built on it.',
  boulder: 'Gives nothing, and blocks building.',
};

export function Inspect() {
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
      body = (
        <>
          <h2>
            {def.name} <span class="earns">earns {score.earned} a week</span>
          </h2>
          <p class="muted">{def.tags.join(' · ')}</p>
          <Lines lines={score.lines} />
          {score.pct !== 0 && score.points > 0 && (
            <p class="muted">
              {score.points} × {100 + score.pct}% = {score.earned}
            </p>
          )}
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
    const sunny = isSunny(s.house.lot, what.x, what.y);
    body = t ? (
      <>
        <h2>{CONTENT.features[t].name}</h2>
        <p>{FEATURE_TEXT[t]}</p>
      </>
    ) : (
      <>
        <h2>Open ground{sunny ? ' · sunny side' : ''}</h2>
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
