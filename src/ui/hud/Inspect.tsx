// The inspect panel: why a placement scores what it does, or what a piece or tile is.
// Readability is in the slice (§2): the exact number on placement, and every piece it changes.
// From M2 it also shows a piece's layout facts (tags, regions, view, links, fenced yards), its
// timers, unmet requirements, budget, and what the demolish tool would remove. From M4a, the
// checklist lines a play would turn on or off, and Renovations (D-102). From M4b, a running
// restriction a placement would break, whose a member's room is, where a granted tag comes from
// ("Dark · from Eternal night"), and the sets a demolition or a tool would break. The board's
// terms (regions, requirements, links, timers, Renovate) explain themselves on hover (D-077).

import type { ComponentChildren } from 'preact';
import {
  cardText,
  CONTENT,
  definite,
  fixtureText,
  glossary,
  rewardText,
  regionText,
  rules,
  SCORE_LABELS,
  sourceName,
  sunSideText,
  terrainAt,
  type BreakdownLine,
  type ChangeOrderId,
  type ModSource,
  type PieceId,
  type PieceInfo,
  type Region,
  type ReservePiece,
  type SetScore,
  type SunSide,
  type TagSource,
  type Term,
  type ToolId,
} from '../../rules/index.ts';
import { formatMult, formatNumber, signed } from '../format.ts';
import {
  activePlay,
  currentTally,
  demolishArmed,
  demolishPreview,
  heldPiece,
  inspected,
  preview,
  renovateUids,
  run,
  selected,
  movingUid,
  selection,
  sell,
  tentative,
  tool,
  toolPreview,
  useToolNow,
  type Inspected,
} from '../store.ts';
import { Button, Icon } from '../kit/kit.tsx';
import { BLUEPRINT_ICONS } from '../sprites.ts';
import type { IconName } from '../theme/art.ts';
import { BlueprintWorth, GoodBody, goodName, offerGood, type GoodRef } from './goods.tsx';
import { arrivalOf, midName } from './household.ts';
import { Tip } from './Tip.tsx';
import './inspect.css';

const GLOSSARY = glossary(CONTENT);

const REGION_CHIP: Record<Region, string> = {
  sunny: 'In the sun',
  frontYard: 'Front yard',
  backYard: 'Back yard',
  fencedYard: 'Fenced yard',
};

/** The regions with a glossary term (D-077). */
const REGION_TERM: Partial<Record<Region, Term>> = {
  sunny: 'sunny',
  frontYard: 'frontYard',
  backYard: 'backYard',
  fencedYard: 'fencedYard',
};

/**
 * `text` with its term's name (the glossary title, in any case) as a Tip: "In the [front
 * yard]". The whole text is the Tip if the name isn't in it.
 */
function withTerm(text: string, term: Term): ComponentChildren {
  const words = GLOSSARY[term].title.toLowerCase();
  const at = text.toLowerCase().indexOf(words);
  if (at < 0) return <Tip term={term}>{text}</Tip>;
  return (
    <>
      {text.slice(0, at)}
      <Tip term={term}>{text.slice(at, at + words.length)}</Tip>
      {text.slice(at + words.length)}
    </>
  );
}

/** A region's words, as a Tip where the glossary has the region. */
function regionWords(text: string, region: Region): ComponentChildren {
  const term = REGION_TERM[region];
  return term ? withTerm(text, term) : text;
}

/** A tag granted by a modifier (M4b): its fixture, a blueprint, or a change order's phase effect. */
const isGrant = (s: TagSource): s is ModSource =>
  s.kind !== 'card' && s.kind !== 'interior' && s.kind !== 'sunny';

/** Why a piece has a tag its card doesn't give it, for the chip's tip. */
function tagReason(s: TagSource, sun: SunSide): string | null {
  if (s.kind === 'card') return null;
  if (s.kind === 'interior') return 'Interior rooms are Dark';
  // D-120: a lit tile's open side is always the sun's.
  if (s.kind === 'sunny')
    return `Its ${sunSideText(sun)} wall faces the sun, with nothing in front`;
  return `From ${sourceName(CONTENT, s)}`;
}

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
      <span>
        <Tip term="requirement">Earns nothing</Tip>: it must be {why}
      </span>
    </p>
  );
}

function Timers({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <>
      <h3>
        <Tip term="timer">Timers</Tip>
      </h3>
      <ul class="timers">
        {lines.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * A placed piece's tags, from the rules' sources for each. One its card gives is plain. One the
 * layout gives (an interior room's Dark, a sunlit building's Sunny) is bold, with why on hover. One
 * a modifier grants says where it's from in its own words: "Dark · from Eternal night", "Sunny ·
 * from Skylight" (M4b).
 */
function TagChips({ info }: { info: PieceInfo }) {
  if (info.tags.length === 0) return null;
  return (
    <p class="chips" aria-label="Tags">
      {info.tags.map((t) => {
        const sources = info.tagSources[t] ?? [];
        const own = sources.some((s) => s.kind === 'card');
        const granted = own ? [] : sources.filter(isGrant);
        const why = own ? [] : sources.flatMap((s) => tagReason(s, run.value.house.lot.sun) ?? []);
        const special = t === 'Dark' || t === 'Sunny';
        const cls = ['chip', special ? `chip-${t.toLowerCase()}` : '', own ? '' : 'from-layout'];
        return (
          <span
            key={t}
            class={cls.filter(Boolean).join(' ')}
            title={why.length > 0 ? why.join(' · ') : undefined}
          >
            <Icon name={t as IconName} />
            {t}
            {granted.length > 0 && (
              <span class="chip-from">
                {' '}
                · from {granted.map((s) => sourceName(CONTENT, s)).join(', ')}
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
}

/**
 * The sets a play, a demolition, or a tool would complete (a star) or break (a cross, in
 * orange), with what each pays every week it holds.
 */
function SetChanges({ gained, lost }: { gained: readonly SetScore[]; lost: readonly SetScore[] }) {
  const { points: COMFORT, mult: CHARM } = SCORE_LABELS;
  return (
    <>
      {gained.map((set) => (
        <p key={set.key} class="set-note good">
          <Icon name="star" />
          <span>
            Completes {CONTENT.sets[set.set].name}: +{set.points} {COMFORT}, +{formatMult(set.mult)}{' '}
            {CHARM}
          </span>
        </p>
      ))}
      {lost.map((set) => (
        <p key={set.key} class="set-note bad">
          <Icon name="cross" />
          <span>
            Breaks: {CONTENT.sets[set.set].name} (−{set.points} {COMFORT}, −{formatMult(set.mult)}{' '}
            {CHARM})
          </span>
        </p>
      ))}
    </>
  );
}

/**
 * The regions a piece or a tile is in. A piece's sun is its Sunny tag (D-120), so only a tile of
 * open ground (`tile`) says whether it's in the sun or a Tree's or a building's shade.
 */
function RegionChips({
  regions,
  fenced,
  tile = false,
}: {
  regions: readonly Region[];
  fenced: number;
  tile?: boolean;
}) {
  const shown = regions.filter((r) => tile || r !== 'sunny');
  const shade = tile && !regions.includes('sunny');
  if (shown.length === 0 && !shade) return null;
  return (
    <p class="chips" aria-label="Where it is">
      {/* In the shade where "In the sun" would be: first. */}
      {shade && (
        <span class="chip region shade">
          <Tip term="sunny">In the shade</Tip>
        </span>
      )}
      {shown.map((r) => (
        <span key={r} class={`chip region ${r}`}>
          {regionWords(REGION_CHIP[r], r)}
          {r === 'fencedYard' && fenced > 0 ? ` · ${fenced} tiles` : ''}
        </span>
      ))}
    </p>
  );
}

/** A placed piece's place in the layout, as short plain lines. */
function LayoutFacts({ info }: { info: PieceInfo }) {
  const s = run.value;
  const facts: { key: string; body: ComponentChildren }[] = [];
  const fact = (key: string, body: ComponentChildren = key) => facts.push({ key, body });
  if (info.side === 'exterior') fact('Exterior room: it touches the outside');
  if (info.side === 'interior') fact('Interior room: no outside wall, so it’s Dark');
  for (const r of info.regions) {
    if (r === 'sunny') continue; // its Sunny tag says it (D-120)
    const text = capitalize(regionText(r));
    fact(text, regionWords(text, r));
  }
  if (info.view) fact('Has a view');
  if (info.linked.length > 0) {
    const names = info.linked.map((uid) => {
      const p = s.house.pieces.find((q) => q.uid === uid);
      return p ? CONTENT.pieces[p.defId].name : 'a room';
    });
    fact(
      `Linked by Hallway to ${names.join(', ')}`,
      <>
        <Tip term="link">Linked by Hallway</Tip> to {names.join(', ')}
      </>,
    );
  }
  if (info.fencedYardTiles > 0) {
    const text = `Fenced yard: ${info.fencedYardTiles} tiles`;
    fact(text, withTerm(text, 'fencedYard'));
  }
  if (facts.length === 0) return null;
  return (
    <>
      <h3>Layout</h3>
      <ul class="facts">
        {facts.map((f) => (
          <li key={f.key}>{f.body}</li>
        ))}
      </ul>
    </>
  );
}

/** Checklist lines' names (M4a), by their ids in the run's client's checklist. */
function specNames(ids: readonly string[]): string {
  const specs = CONTENT.clients[run.value.setup.clientId].specs;
  return ids.map((id) => specs.find((s) => s.id === id)?.name ?? id).join(', ');
}

/**
 * The checklist lines a play, a demolition, or a tool would turn on and off (M4a), with the
 * Charm each line held adds every week.
 */
function SpecChanges({ gained, lost }: { gained: readonly string[]; lost: readonly string[] }) {
  if (gained.length === 0 && lost.length === 0) return null;
  const bonus = formatMult(currentTally.value.specBonus);
  const each = (n: number) => `${bonus} ${SCORE_LABELS.mult}${n > 1 ? ' each' : ''}`;
  return (
    <>
      {gained.length > 0 && (
        <p class="spec-note good">
          <Icon name="up" />
          <span>
            Turns on: {specNames(gained)} (+{each(gained.length)})
          </span>
        </p>
      )}
      {lost.length > 0 && (
        <p class="spec-note bad">
          <Icon name="down" />
          <span>
            Turns off: {specNames(lost)} (−{each(lost.length)})
          </span>
        </p>
      )}
    </>
  );
}

/** A member's room (M4b, D-103): whose it is, that it counts as a Bedroom, and from when. */
function MemberNote({ id }: { id: PieceId }) {
  const member = cardText(CONTENT, CONTENT.pieces[id]).member;
  return member ? <p class="member-note">{member}</p> : null;
}

/** A card in the reserve's extra slots (M4b): a household member's or the crew's. */
function ExtraSlotNote({ r }: { r: ReservePiece }) {
  const member = r.arrival !== undefined ? arrivalOf(run.value.setup.clientId, r.arrival) : null;
  if (!member && !r.crew) return null;
  return (
    <p class="muted">
      {member ? `Came with ${midName(member)}` : 'Your crew’s, from the start'}: in an extra slot,
      so it doesn’t take one of your reserve’s.
    </p>
  );
}

/**
 * A running restriction the placement would break (M4b): the placement stays legal, but the
 * order pays nothing at its milestone.
 */
function BreaksNote({ id }: { id: ChangeOrderId }) {
  const def = CONTENT.changeOrders[id];
  const lost = def.kind === 'phase' ? '' : `: you’d lose its ${rewardText(CONTENT, def.reward)}`;
  return (
    <p class="warn" role="note">
      <Icon name="cross" />
      <span>
        Breaks {def.name}
        {lost}
      </span>
    </p>
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
      {p?.ok && <SetChanges gained={p.setsGained} lost={p.setsLost} />}
      {p?.ok && <SpecChanges gained={p.specsGained} lost={p.specsLost} />}
      {/* The name is the heading already, so a long one never runs the button off the panel
          (playtest 4: "Use Remodel Plans: Full House"). */}
      {!aimed && (
        <Button
          class="use-tool"
          disabled={!p?.ok}
          onClick={() => useToolNow({ t: 'useTool', i })}
          aria-label={`Use ${def.name} now`}
        >
          Use it now
        </Button>
      )}
    </>
  );
}

/**
 * What a Renovation adds (D-102): flat Comfort a level, before the room's percentages. Not a
 * weekly gain: the before → after beside it is the room's real change.
 */
const RENOVATE_GAIN = `+${CONTENT.balance.renovate.pointsPerLevel} ${SCORE_LABELS.points} a level, before percentages`;

/** A Renovation's level (D-102): a star a level. The words beside them say the level too. */
function RenovateStars({ level }: { level: number }) {
  return (
    <span class="renovate-stars" aria-hidden="true">
      {Array.from({ length: level }, (_, k) => (
        <Icon key={k} name="star" />
      ))}
    </span>
  );
}

/**
 * A room card whose type is at the checklist's limit can renovate a room of that type instead
 * (M4a, D-102): the board outlines those rooms while the card is picked. Not while a placement
 * waits for End week: the outlines are hidden then, and pointing doesn't renovate.
 */
function RenovateHint({ id }: { id: PieceId }) {
  if (renovateUids.value.length === 0 || tentative.value) return null;
  const def = CONTENT.pieces[id];
  const type = CONTENT.pieces[def.countsAs ?? def.id].name;
  return (
    <p class="muted">
      Or <Tip term="renovate">renovate</Tip> one in place, with nothing torn down: point at an
      outlined {type} ({RENOVATE_GAIN}).
    </p>
  );
}

function PlacingInfo() {
  const p = preview.value;
  const sel = selection.value;
  if (!sel) return null;
  if (sel.kind === 'tool') return <ToolInfo id={sel.id} i={sel.i} />;
  const name = sel.kind === 'piece' ? CONTENT.pieces[sel.id].name : CONTENT.fixtures[sel.id].name;
  const install = sel.kind === 'fixture';
  // A room card over a room its type is capped at: a Renovation (M4a, D-102).
  const play = activePlay.value;
  const renovate = play?.t === 'renovate';
  const room = renovate ? run.value.house.pieces.find((q) => q.uid === play.uid) : undefined;
  const roomName = room ? CONTENT.pieces[room.defId].name : 'room';
  const hint = sel.kind === 'piece' && !renovate ? <RenovateHint id={sel.id} /> : null;
  const fromLine = renovate
    ? sel.from === 'reserve'
      ? 'From your reserve: renovating is this week’s build.'
      : 'Renovating is this week’s build, instead of placing the card.'
    : sel.from === 'reserve'
      ? 'From your reserve: placing it is this week’s build.'
      : sel.from === 'supplies'
        ? 'From your supplies: installing it is free, so the week goes on.'
        : install
          ? 'From your hand: installing it is this week’s build.'
          : null;
  // A member's room (M4b): whose it is.
  const member = sel.kind === 'piece' && !renovate ? <MemberNote id={sel.id} /> : null;
  if (!p) {
    return (
      <>
        <h2>{name}</h2>
        {fromLine && <p class="muted">{fromLine}</p>}
        {member}
        <p class="muted">
          {install
            ? 'Point at a piece on the lot to see what it would do there.'
            : 'Point at the lot to see what it would earn.'}
        </p>
        {hint}
        {install && <GoodBody good={{ kind: 'fixture', id: sel.id }} />}
      </>
    );
  }
  if (!p.legal) {
    // The rules say why: not at the limit yet, the wrong room, or fully renovated.
    return (
      <>
        <h2>{renovate ? `Renovate ${definite(roomName)}?` : name}</h2>
        <p class="reason">
          <Icon name="cross" />
          <span>{p.reason}</span>
        </p>
        {hint}
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
  // An install's host, or the room a Renovation levels: what it earns, before and after.
  const hostLine = install || renovate ? p.lines.find((l) => l.isNew) : undefined;
  const earns = hostLine
    ? `${hostLine.before} → ${hostLine.after}`
    : `earns ${p.newPiece?.earned ?? 0}`;
  return (
    <>
      {install ? (
        <h2>
          {name} → {host ? CONTENT.pieces[host.defId].name : 'piece'}{' '}
          <span class="earns">{earns}</span>
        </h2>
      ) : renovate ? (
        <h2>
          Renovate {definite(roomName)} <span class="earns">{earns}</span>
        </h2>
      ) : (
        <h2>
          {name} <span class="earns">earns {p.newPiece?.earned ?? 0}</span>
        </h2>
      )}
      {fromLine && <p class="muted">{fromLine}</p>}
      {member}
      {p.breaks && <BreaksNote id={p.breaks} />}
      {p.renovates && (
        <p class="renovate-note">
          <RenovateStars level={p.renovates.level} />
          <span>
            <Tip term="renovate">Renovate</Tip>: {definite(roomName, 'this')} goes to level{' '}
            {p.renovates.level} ({RENOVATE_GAIN})
          </span>
        </p>
      )}
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
      <SetChanges gained={p.setsGained} lost={p.setsLost} />
      <SpecChanges gained={p.specsGained} lost={p.specsLost} />
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
      {hint}
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
      <h2>
        {good.kind === 'blueprint' && <Icon name={BLUEPRINT_ICONS[good.id]} class="good-glyph" />}
        {goodName(good)}
      </h2>
      <GoodBody good={good} where={!sellAs && good.kind !== 'piece'} />
      {/* D-141: what a blueprint you hold is adding, from the rules. */}
      {good.kind === 'blueprint' && sellAs && (
        <BlueprintWorth value={rules.blueprintValue(s, good.id)} where="panel" />
      )}
      {good.kind === 'blueprint' && sellAs && (
        <p class="muted">Bought in week {s.blueprints[sellAs.i]?.boughtWeek}.</p>
      )}
      {canSell && (
        <Button
          class="sell-button"
          icon="coin"
          onClick={() => sell(sellAs.from, sellAs.i)}
          title="Selling pays half its price, rounded down"
          aria-label={`Sell for ${price} budget`}
        >
          Sell for {price}
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
      <SetChanges gained={d.setsGained} lost={d.setsLost} />
      <SpecChanges gained={d.specsGained} lost={d.specsLost} />
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

/**
 * The week's Wow before and after the play being looked at, for Inspect's foot: a legal
 * placement, install or Renovation, a tool that can be used, or a legal demolition. Else null.
 */
export function playTotals(): { before: number; after: number } | null {
  if (tool.value === 'demolish') {
    const d = demolishPreview.value;
    return d?.legal ? { before: d.before.total, after: d.after.total } : null;
  }
  const sel = selection.value;
  if (selected.value === null || !sel) return null;
  if (sel.kind === 'tool') {
    const p = toolPreview.value;
    return p?.ok ? { before: p.before.total, after: p.after.total } : null;
  }
  const p = preview.value;
  return p?.legal ? { before: p.before.total, after: p.after.total } : null;
}

/** "This week: 120 → 145 Wow": Inspect's foot, under its scrolling body, so always in view. */
export function TotalLine({ before, after }: { before: number; after: number }) {
  return (
    <p class="total-line">
      This week: {formatNumber(before)} → <strong>{formatNumber(after)}</strong>{' '}
      {SCORE_LABELS.total}
    </p>
  );
}

/** A held piece's ✕ (store.ts heldPiece). Esc, a second click on it, or open ground do too. */
function LetGo() {
  return (
    <Button
      iconOnly
      size="sm"
      icon="close"
      class="let-go"
      onMouseDown={(e: MouseEvent) => e.preventDefault()}
      onClick={() => (heldPiece.value = null)}
      title="Let go (Esc, or click the piece again)"
      aria-label="Let go of this piece"
    />
  );
}

export function Inspect() {
  if (tool.value === 'demolish') {
    return (
      <InspectPanel foot={playTotals()}>
        <DemolishInfo />
      </InspectPanel>
    );
  }
  if (selected.value !== null) {
    return (
      <InspectPanel foot={playTotals()}>
        <PlacingInfo />
      </InspectPanel>
    );
  }
  // A piece clicked with nothing picked stays here while the pointer goes elsewhere (playtest
  // 4: a long note couldn't be scrolled), until it's let go (store.ts heldPiece).
  const held = heldPiece.value;
  const what: Inspected | null = held !== null ? { kind: 'piece', uid: held } : inspected.value;
  const s = run.value;
  const idle = (
    <>
      <h2>Inspect</h2>
      <p class="muted">
        Point at anything on the lot to see what it is and what it earns. Click a piece to hold it
        here.
      </p>
    </>
  );
  let body = idle;
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
            {held !== null && <LetGo />}
          </h2>
          {!!piece.level && (
            <p class="renovate-note">
              <RenovateStars level={piece.level} />
              <span>
                <Tip term="renovate">Renovated</Tip>: level {piece.level}
              </span>
            </p>
          )}
          {info ? <TagChips info={info} /> : <p class="muted">{def.tags.join(' · ')}</p>}
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
          {text.member && <p class="member-note">{text.member}</p>}
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
    const where = info && <RegionChips regions={info.regions} fenced={info.fencedYardTiles} tile />;
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
          {card.kind === 'piece' && <MemberNote id={card.id} />}
          <p class="muted">Click the card (or press {what.i + 1}), then point at the lot.</p>
        </>
      );
    }
  } else if (what?.kind === 'reserve') {
    const r = s.reserve[what.i];
    if (r) {
      body = (
        <>
          <ItemInfo good={{ kind: 'piece', id: r.id }} />
          <MemberNote id={r.id} />
          <ExtraSlotNote r={r} />
        </>
      );
    }
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
  return (
    <InspectPanel idle={body === idle} held={held !== null && body !== idle}>
      {body}
    </InspectPanel>
  );
}

/**
 * A wood panel whose first heading is its plank (inspect.css). With nothing to inspect it's
 * `is-idle`, so the left column gives its room to the checklist (app.css). A play's week total
 * is its foot, outside the body that scrolls (D-110's note: a short window cut it off).
 */
function InspectPanel({
  idle = false,
  held = false,
  foot = null,
  children,
}: {
  idle?: boolean;
  /** A piece held there by a click (store.ts heldPiece). */
  held?: boolean;
  foot?: { before: number; after: number } | null;
  children: ComponentChildren;
}) {
  const cls = ['inspect panel ui', idle && 'is-idle', held && 'is-held'];
  return (
    <section class={cls.filter(Boolean).join(' ')} aria-label="Inspect">
      <div class="panel-body">{children}</div>
      {foot && <TotalLine before={foot.before} after={foot.after} />}
    </section>
  );
}
