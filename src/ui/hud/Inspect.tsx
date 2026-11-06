// The inspect panel: why a placement scores what it does, or what a piece or tile is.
// Readability is in the slice (§2): the exact number on placement, and every piece it changes.
// From M2 it also shows a piece's layout facts (tags, regions, view, links, fenced yards), its
// timers, unmet requirements, budget, and what the demolish tool would remove.

import type { ComponentChildren } from 'preact';
import {
  cardText,
  CONTENT,
  fixtureText,
  rewardText,
  regionText,
  rules,
  SCORE_LABELS,
  terrainAt,
  type BreakdownLine,
  type PieceInfo,
  type Region,
  type Tag,
  type ToolId,
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
  movingUid,
  selection,
  sell,
  tool,
  toolPreview,
  useToolNow,
} from '../store.ts';
import { Button, Icon } from '../kit/kit.tsx';
import type { IconName } from '../theme/art.ts';
import { GoodBody, goodName, offerGood, type GoodRef } from './goods.tsx';
import './inspect.css';

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
      <Icon name="warn" />
      <span>Earns nothing: it must be {why}</span>
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
            <Icon name={t as IconName} />
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

/** A selected tool: what it does, what using it would do this week, and Use (or how to aim it). */
function ToolInfo({ id, i }: { id: ToolId; i: number }) {
  const def = CONTENT.tools[id];
  const use = def.use.kind;
  const p = toolPreview.value;
  const aimed = use === 'copy' || use === 'move';
  const how =
    use === 'copy'
      ? 'Click a piece twice to copy it into your reserve.'
      : use === 'move'
        ? movingUid.value === null
          ? 'Click the piece to move.'
          : 'Click its new spot twice. R or right-click turns it.'
        : null;
  return (
    <>
      <h2>{def.name}</h2>
      <GoodBody good={{ kind: 'tool', id }} />
      <p class="muted">From your supplies: free, and the week goes on. It’s used up.</p>
      {how && <p class="muted">{how}</p>}
      {p && !p.ok && (
        <p class="reason">
          <Icon name="cross" />
          <span>{p.reason}</span>
        </p>
      )}
      {p?.ok && (
        <p class="total-line">
          This week: {formatNumber(p.before.total)} → <strong>{formatNumber(p.after.total)}</strong>{' '}
          {SCORE_LABELS.total}
        </p>
      )}
      {!aimed && (
        <Button class="use-tool" disabled={!p?.ok} onClick={() => useToolNow({ t: 'useTool', i })}>
          Use {def.name}
        </Button>
      )}
    </>
  );
}

function PlacingInfo() {
  const p = preview.value;
  const sel = selection.value;
  if (!sel) return null;
  if (sel.kind === 'tool') return <ToolInfo id={sel.id} i={sel.i} />;
  const name = sel.kind === 'piece' ? CONTENT.pieces[sel.id].name : CONTENT.fixtures[sel.id].name;
  const install = sel.kind === 'fixture';
  const fromLine =
    sel.from === 'reserve'
      ? 'From your reserve: placing it is this week’s build.'
      : sel.from === 'supplies'
        ? 'From your supplies: installing it is free, so the week goes on.'
        : install
          ? 'From your hand: installing it is this week’s build.'
          : null;
  if (!p) {
    return (
      <>
        <h2>{name}</h2>
        {fromLine && <p class="muted">{fromLine}</p>}
        <p class="muted">
          {install
            ? 'Point at a piece on the lot to see what it would do there.'
            : 'Point at the lot to see what it would earn.'}
        </p>
        {install && <GoodBody good={{ kind: 'fixture', id: sel.id }} />}
      </>
    );
  }
  if (!p.legal) {
    return (
      <>
        <h2>{name}</h2>
        <p class="reason">
          <Icon name="cross" />
          <span>{p.reason}</span>
        </p>
        {install && <GoodBody good={{ kind: 'fixture', id: sel.id }} />}
      </>
    );
  }
  const others = p.lines.filter((l) => !l.isNew);
  const unmet = p.newPiece?.unmet;
  const host =
    install && p.host !== undefined
      ? run.value.house.pieces.find((q) => q.uid === p.host)
      : undefined;
  const hostLine = install ? p.lines.find((l) => l.isNew) : undefined;
  return (
    <>
      {install ? (
        <h2>
          {name} → {host ? CONTENT.pieces[host.defId].name : 'piece'}{' '}
          <span class="earns">
            {hostLine
              ? `${hostLine.before} → ${hostLine.after}`
              : `earns ${p.newPiece?.earned ?? 0}`}
          </span>
        </h2>
      ) : (
        <h2>
          {name} <span class="earns">earns {p.newPiece?.earned ?? 0}</span>
        </h2>
      )}
      {fromLine && <p class="muted">{fromLine}</p>}
      {p.replaces && (
        <p class="warn" role="note">
          Replaces its {CONTENT.fixtures[p.replaces].name}, which is lost.
        </p>
      )}
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
          <Icon name="star" />
          <span>
            Completes {CONTENT.sets[set.set].name}: +{set.points} {SCORE_LABELS.points}, +
            {formatMult(set.mult)} {SCORE_LABELS.mult}
          </span>
        </p>
      ))}
      {p.setsLost.map((set) => (
        <p key={set.key} class="set-note bad">
          <Icon name="cross" />
          <span>Breaks {CONTENT.sets[set.set].name}</span>
        </p>
      ))}
      {p.xMults.map((x) => (
        <p key={`${x.source.kind}:${x.label}`} class="set-note sparkle">
          <Icon name="sparkle" />
          <span>
            {SCORE_LABELS.xMult}: {x.label} ×{formatMult(x.times)} {SCORE_LABELS.mult}
          </span>
        </p>
      ))}
      {p.finds.map((f) => (
        <p key={`${f.x},${f.y}`} class="set-note find">
          <Icon name="star" />
          <span>
            Digs up the {CONTENT.features[f.feature].name}: {rewardText(CONTENT, f.reward)}
          </span>
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

/** A blueprint, supply, reserve piece, or shop offer: what it does, and Sell where it can be sold. */
function ItemInfo({
  good,
  sellAs,
}: {
  good: GoodRef;
  sellAs?: { from: 'blueprints' | 'supplies'; i: number };
}) {
  const s = run.value;
  const price = sellAs ? rules.sellPrice(s, sellAs.from, sellAs.i) : 0;
  const canSell = sellAs && (s.screen === 'build' || s.screen === 'shop');
  return (
    <>
      <h2>{goodName(good)}</h2>
      <GoodBody good={good} where={!sellAs && good.kind !== 'piece'} />
      {good.kind === 'blueprint' && sellAs && (
        <p class="muted">Bought in week {s.blueprints[sellAs.i]?.boughtWeek}.</p>
      )}
      {canSell && (
        <Button
          class="sell-button"
          icon="coin"
          onClick={() => sell(sellAs.from, sellAs.i)}
          title="Selling pays half its price, rounded down"
        >
          Sell for {price} budget
        </Button>
      )}
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
          <Icon name="cross" />
          <span>{d.reason ?? 'That can’t be demolished.'}</span>
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
  oldShed:
    'An old shed in the way. It blocks building until it’s demolished, and there’s a random tool inside.',
  timeCapsule:
    'Something buried here. It doesn’t block building: the first piece built over it digs it up for +3 budget.',
};

export function Inspect() {
  if (tool.value === 'demolish') {
    return (
      <InspectPanel>
        <DemolishInfo />
      </InspectPanel>
    );
  }
  if (selected.value !== null) {
    return (
      <InspectPanel>
        <PlacingInfo />
      </InspectPanel>
    );
  }
  const what = inspected.value;
  const s = run.value;
  let body = (
    <>
      <h2>Inspect</h2>
      <p class="muted">Point at anything on the lot to see what it is and what it earns.</p>
    </>
  );
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
          {piece.fixture && (
            <>
              <h3>Fixture: {CONTENT.fixtures[piece.fixture.id].name}</h3>
              <ul class="effects">
                {fixtureText(CONTENT, CONTENT.fixtures[piece.fixture.id]).effects.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
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
      // The card's whole text, too: on a short window the hand's cards are cut down.
      const good: GoodRef =
        card.kind === 'piece' ? { kind: 'piece', id: card.id } : { kind: 'fixture', id: card.id };
      body = (
        <>
          <h2>{goodName(good)}</h2>
          <GoodBody good={good} />
          <p class="muted">Click the card (or press {what.i + 1}), then point at the lot.</p>
        </>
      );
    }
  } else if (what?.kind === 'reserve') {
    const r = s.reserve[what.i];
    if (r) body = <ItemInfo good={{ kind: 'piece', id: r.id }} />;
  } else if (what?.kind === 'supply') {
    const sup = s.supplies[what.i];
    if (sup)
      body = (
        <ItemInfo
          good={
            sup.kind === 'fixture' ? { kind: 'fixture', id: sup.id } : { kind: 'tool', id: sup.id }
          }
          sellAs={{ from: 'supplies', i: what.i }}
        />
      );
  } else if (what?.kind === 'upgrade') {
    const u = s.upgrades[what.i];
    if (u) body = <ItemInfo good={{ kind: 'upgrade', id: u }} />;
  } else if (what?.kind === 'blueprint') {
    const b = s.blueprints[what.i];
    if (b)
      body = (
        <ItemInfo
          good={{ kind: 'blueprint', id: b.id }}
          sellAs={{ from: 'blueprints', i: what.i }}
        />
      );
  } else if (what?.kind === 'offer') {
    const o = s.offers?.shop?.offers[what.i];
    const g = o && offerGood(o);
    if (g) body = <ItemInfo good={g} />;
  }
  return <InspectPanel>{body}</InspectPanel>;
}

/** A wood panel whose first heading is its plank (inspect.css). */
function InspectPanel({ children }: { children: ComponentChildren }) {
  return (
    <section class="inspect panel ui" aria-label="Inspect">
      <div class="panel-body">{children}</div>
    </section>
  );
}
