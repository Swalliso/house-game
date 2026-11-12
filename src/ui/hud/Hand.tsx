// The week's hand: cards with generated text (D-038), the free actions (reroll, demolish), and
// the action bar (rotate, cancel, End week). A card with nowhere legal to go is hatched, with
// the reason. M5a draws it in the pixel style: each card shows its piece's picture, its kind
// and tags as icon chips, and End week is the view's one primary button. The picked card shows
// its shape as it's turned (R, or the Rotate button), and a card picked below the fold scrolls
// into view.
//
// D-121: the hand is two rows, Rooms then Layout, each under its label. A card the draw
// swapped in, because the one it replaced had no play, says so on a chip. Reroll and Demolish
// sit on the plank; one reroll redraws both rows (D-132). The cards are compact, so four or five
// fit beside Your goods: the name, the line that says what it pays (handCardLines), and the
// chips beside a thumbnail of the piece (a fixture: where it goes, and what it does). Inspect
// shows the whole text on hover.

import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  DRAW_ROWS,
  handCardLines,
  rules,
  rowOf,
  setProgressText,
  setsOfPiece,
  setText,
  type Card as CardData,
  type DrawRow,
  type PieceId,
  type Tag,
} from '../../rules/index.ts';
import {
  cardsFit,
  cardsRenovate,
  demolishArmed,
  inspected,
  reroll,
  rotation,
  run,
  movingUid,
  selected,
  selection,
  source,
  tentative,
  tool,
} from '../store.ts';
import { rotate } from '../board/Board.tsx';
import { busy } from '../fx/director.ts';
import { stakesOf } from '../screens/week-stamp.ts';
import { settings } from '../settings.ts';
import { Button, Card, Chip, Icon, Keycap, Panel } from '../kit/kit.tsx';
import type { IconName } from '../theme/art.ts';
import {
  cancelPlacement,
  isSelected as isPicked,
  passArmed,
  requestEndWeek,
  selectCard,
} from './actions.ts';
import { guideCard, shown } from './first-job.ts';
import { PieceArt, ShapeGlyph } from './PieceArt.tsx';
import { PIECE_KIND_LABEL, pieceKind, RARITY_LABEL } from './goods.tsx';
import './hand.css';

/**
 * The game's own buttons don't take focus from a mouse click, so the keyboard shortcuts (Enter
 * to end the week) keep working after one. Tab still reaches them, and then Enter presses them.
 */
const noFocus = (e: MouseEvent) => e.preventDefault();

/**
 * A card's tags as chips, each with its icon (the icon set is named after the tags). A narrow
 * hand card shows just the icons (hand.css), so each chip names its tag in its title too.
 */
export function TagChips({ tags }: { tags: readonly Tag[] }) {
  return (
    <>
      {tags.map((t) => (
        <Chip key={t} icon={t as IconName} class="tag-chip" title={t}>
          <span class="chip-word">{t}</span>
        </Chip>
      ))}
    </>
  );
}

/**
 * D-122: the set a room card counts toward, named on the card, so a Closet says Suite before
 * it's placed. Static membership only: it never says where. It names the touching set with the
 * shortest name (a Bedroom's Suite, not its Jack-and-Jill), so it shares a line with the card's
 * tags at 1600×900, and how many more touching sets there are; Full House, which needs none to
 * touch, when it's the only one. No icon but D-153's check: Charm's tint says set. Its tip says
 * what each set needs and pays, Full House included.
 *
 * D-153: named, Full House says how far the house is: "Full House 5/9", the member types built
 * (the rules count them: setProgress), and a check in place of the count once the house holds
 * it. A card that would complete it reads 8/9 like any other. Where the count or the check would
 * cost the card a chip row, hand.css hides it, and the chip reads as before. The tip adds the
 * count in words.
 */
export function SetChip({ id }: { id: PieceId }) {
  const sets = setsOfPiece(CONTENT, id);
  if (sets.length === 0) return null;
  const s = run.value;
  const touching = sets.filter((set) => CONTENT.sets[set].connected);
  const pool = touching.length > 0 ? touching : sets;
  const shown = pool.reduce((a, b) =>
    CONTENT.sets[b].name.length < CONTENT.sets[a].name.length ? b : a,
  );
  const more = touching.length > 1 ? ` +${touching.length - 1}` : '';
  const p = rules.setProgress(s, shown);
  const tip = sets.map((set) => {
    const q = rules.setProgress(s, set);
    return q ? `${setText(CONTENT, set)} ${setProgressText(CONTENT, q)}` : setText(CONTENT, set);
  });
  return (
    <Chip tone="charm" icon={p?.held ? 'check' : undefined} class="set-chip" title={tip.join('\n')}>
      {CONTENT.sets[shown].name}
      {p && !p.held && <span class="set-count">{` ${p.have}/${p.need}`}</span>}
      {more}
    </Chip>
  );
}

const ROW_LABEL: Record<DrawRow, string> = { rooms: 'Rooms', layout: 'Layout' };

const cardName = (card: CardData): string =>
  card.kind === 'fixture' ? CONTENT.fixtures[card.id].name : CONTENT.pieces[card.id].name;

/**
 * A card the week's draw swapped in (D-121): what it replaced, which had no play. A badge on the
 * card's corner, the reroll icon with its words in its title and read out, so it takes no room:
 * as a chip it wrapped a narrow card's Renovate and tags onto a second line, and beside the name
 * it wrapped the name (the note over the lot names the cards swapped out in words).
 */
function SwapMark({ i }: { i: number }) {
  const was = run.value.swapped.find((w) => w.i === i)?.was;
  if (!was) return null;
  return (
    <span class="swap-mark">
      <Icon
        name="reroll"
        label={`Swapped in: the ${cardName(was)} had nowhere to go, so this card took its place, free.`}
      />
    </span>
  );
}

/** Back to building, leaving demolish mode. */
function stopDemolishing(): void {
  tool.value = 'build';
  demolishArmed.value = null;
}

function pickCard(i: number): void {
  if (tool.value === 'demolish') {
    stopDemolishing();
    // The card being placed stays picked: the click means "build", not "put it back".
    if (isPicked('hand', i)) return;
  }
  selectCard(i);
}

function CardView({ card, i }: { card: CardData; i: number }) {
  if (card.kind === 'fixture') return <FixtureCardView id={card.id} i={i} />;
  const def = CONTENT.pieces[card.id];
  const fits = cardsFit.value[i] ?? true;
  const renovates = cardsRenovate.value[i] ?? false;
  const isSelected = isPicked('hand', i);
  const kind = pieceKind(def);
  const type = CONTENT.pieces[def.countsAs ?? def.id].name;
  // A pack (D-106) doesn't turn, so it never shows a turn left from another card this week.
  const rot = isSelected && !def.pack ? rotation.value : 0;
  // A compact card (D-121): the line that says what it pays. The rest, the notes, and a
  // member's room (M4b, D-103: whose it is) are in Inspect.
  return (
    <Card
      as="button"
      // Week 1's guide (D-149) points at the card to pick first.
      class={guideCard.value === i ? 'hand-card guide-now' : 'hand-card'}
      tone={kind}
      selected={isSelected}
      blocked={!fits}
      lead={<Keycap>{i + 1}</Keycap>}
      title={def.name}
      aside={<ShapeGlyph id={card.id} rot={rot} square />}
      art={<PieceArt id={card.id} />}
      lines={handCardLines(CONTENT, card)}
      chips={
        <>
          {renovates && (
            <Chip
              tone="uncommon"
              icon="star"
              class="renovate-chip"
              title={`It can renovate a ${type} you have, in place: pick it, then point at an outlined room`}
            >
              Renovate
            </Chip>
          )}
          <SetChip id={card.id} />
          <Chip tone="wood" class="kind-chip">
            {PIECE_KIND_LABEL[kind]}
          </Chip>
          <TagChips tags={def.tags} />
        </>
      }
      alert={fits ? undefined : 'Nowhere fits'}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      onMouseEnter={() => selected.value === null && (inspected.value = { kind: 'card', i })}
      aria-pressed={isSelected}
      data-card={i}
      tooltip={fits ? undefined : 'There’s nowhere on the lot this fits right now'}
    >
      <SwapMark i={i} />
    </Card>
  );
}

/** A fixture card: it goes in a placed piece, as the week's turn (D-050). */
function FixtureCardView({
  id,
  i,
}: {
  id: Extract<CardData, { kind: 'fixture' }>['id'];
  i: number;
}) {
  const def = CONTENT.fixtures[id];
  const fits = cardsFit.value[i] ?? true;
  const isSelected = isPicked('hand', i);
  return (
    <Card
      as="button"
      class="hand-card"
      tone="fixture"
      rarity={def.rarity}
      selected={isSelected}
      blocked={!fits}
      lead={<Keycap>{i + 1}</Keycap>}
      title={def.name}
      lines={handCardLines(CONTENT, { kind: 'fixture', id })}
      chips={
        <>
          <Chip tone="wood">Fixture</Chip>
          <Chip tone={def.rarity}>{RARITY_LABEL[def.rarity]}</Chip>
        </>
      }
      alert={fits ? undefined : 'Nothing to put it in'}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      onMouseEnter={() => selected.value === null && (inspected.value = { kind: 'card', i })}
      aria-pressed={isSelected}
      data-card={i}
      tooltip={fits ? undefined : 'Nothing on the lot can hold it yet'}
    >
      <SwapMark i={i} />
    </Card>
  );
}

/**
 * The reroll: new cards for both rows (D-132). A free action, so the week goes on. It sits on
 * the hand's plank, before Demolish.
 */
function RerollButton() {
  const s = run.value;
  const can = rules.canReroll(s);
  const rerolls = s.rerollsLeft + s.bonusRerolls;
  return (
    <Button
      size="sm"
      icon="reroll"
      class="free-action reroll"
      onMouseDown={noFocus}
      onClick={() => void reroll()}
      disabled={!can.ok}
      aria-label={`Reroll: new cards for both rows, ${rerolls} left`}
      title={
        can.ok
          ? `New cards for both rows. It doesn’t end the week. ${s.rerollsLeft} left this milestone${s.bonusRerolls > 0 ? `, and ${s.bonusRerolls} kept` : ''}.`
          : (can.reason ?? 'You can’t reroll now.')
      }
    >
      <span class="free-action-word">Reroll</span>
      <span class="count" aria-hidden="true">
        {rerolls}
      </span>
    </Button>
  );
}

/** Demolitions: a free action, so the week goes on. It sits on the hand's plank. */
function DemolishButton() {
  const s = run.value;
  const demolishing = tool.value === 'demolish';
  const canDemolish = s.demolitionsLeft > 0;
  const toggleDemolish = () => {
    if (demolishing) {
      stopDemolishing();
      return;
    }
    if (!canDemolish) return;
    demolishArmed.value = null;
    // A card only being looked at goes back to the hand; a placement waiting for End week stays.
    if (!tentative.value) selected.value = null;
    tool.value = 'demolish';
  };
  return (
    <Button
      size="sm"
      icon="hammer"
      variant={demolishing ? 'danger' : 'secondary'}
      class={`free-action demolish ${demolishing ? 'active' : ''}`}
      onMouseDown={noFocus}
      onClick={toggleDemolish}
      disabled={!canDemolish && !demolishing}
      aria-pressed={demolishing}
      title={
        demolishing
          ? 'Back to building (Esc)'
          : canDemolish
            ? `Remove a piece, a boulder or the Old Shed. No refund, and points already earned stay. ${s.demolitionsLeft} left this run.`
            : 'No demolitions left this run'
      }
    >
      <span class="free-action-word">{demolishing ? 'Stop' : 'Demolish'}</span>
      <span class="count" aria-label={`${s.demolitionsLeft} left`}>
        {s.demolitionsLeft}
      </span>
    </Button>
  );
}

/** One row of the hand (D-121): its label, then its cards, numbered across rows. */
function HandRow({ row }: { row: DrawRow }) {
  const s = run.value;
  const cards = s.hand.flatMap((card, i) => (rowOf(CONTENT, card) === row ? [{ card, i }] : []));
  return (
    <section class={`hand-row hand-row-${row}`} aria-label={`${ROW_LABEL[row]} cards`}>
      <div class="hand-row-head">
        <h3 class="hand-row-label">{ROW_LABEL[row]}</h3>
      </div>
      {cards.map(({ card, i }) => (
        <CardView key={`${s.week}-${s.draws}-${i}`} card={card} i={i} />
      ))}
    </section>
  );
}

/** The right column, which scrolls: Your goods, then the hand. */
function handColumn(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.hand')?.closest<HTMLElement>('.right') ?? null;
}

/**
 * The picked hand card scrolls fully into view (above the sticky action bar: .right's
 * scroll-padding), so picking card 3 with its key on a short window shows it. When the pick
 * ends (put back, or the week ended), the column goes back to where it was before the pick:
 * left scrolled, it hid Your goods, the reserve and Reroll above it for the rest of the run.
 */
function useCardInView(): void {
  const picked = source.value === 'hand' ? selected.value : null;
  const before = useRef<number | null>(null);
  useEffect(() => {
    const column = handColumn();
    if (picked === null) {
      if (before.current !== null) column?.scrollTo({ top: before.current });
      before.current = null;
      return;
    }
    if (before.current === null && column) before.current = column.scrollTop;
    document
      .querySelector(`.hand [data-card="${picked}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [picked]);
}

/**
 * A new week (or a new run) starts with the column at its top, Your goods and Reroll in view,
 * however the last week left it: the "N more cards" tab, or a hand scrolled by hand.
 */
function useColumnTopEachWeek(): void {
  const s = run.value;
  const building = s.screen === 'build';
  useEffect(() => {
    // A run opened with a card already picked (a ?run= code's pending placement) keeps the
    // card in view that useCardInView just scrolled to. End week has dropped the pick by now.
    const picked = source.value === 'hand' && selected.value !== null;
    if (building && !picked) handColumn()?.scrollTo({ top: 0 });
  }, [s.week, s.setup.seed, building]);
}

/**
 * How many hand cards the sticky action bar hides, wholly or in part, as the column scrolls
 * under it: a short window, a fifth card, or Your goods open. The bar then says so, with a tab
 * that brings them up, so a card under it is never missed (D-121).
 */
function useCardsUnderBar(bar: RefObject<HTMLDivElement>, shown: boolean): number {
  const [under, setUnder] = useState(0);
  const measure = useRef<(() => void) | null>(null);
  useEffect(() => {
    const el = bar.current;
    const body = el?.parentElement;
    const column = el?.closest<HTMLElement>('.right');
    if (!shown || !el || !body || !column) return;
    const count = () => {
      const edge = el.getBoundingClientRect().top;
      let n = 0;
      for (const card of body.querySelectorAll<HTMLElement>('.hand-card')) {
        // With only its padding under the bar, the card still shows all it says.
        const { paddingBottom, borderBottomWidth } = getComputedStyle(card);
        const pad = parseFloat(paddingBottom) + parseFloat(borderBottomWidth);
        if (card.getBoundingClientRect().bottom - pad > edge + 1) n++;
      }
      setUnder(n);
    };
    measure.current = count;
    count();
    // The cards change size with the hand and the fonts, the column with the window, and Your
    // goods above the hand when it folds.
    const resized = new ResizeObserver(count);
    for (const box of [column, body, ...column.children]) resized.observe(box);
    column.addEventListener('scroll', count, { passive: true });
    return () => {
      measure.current = null;
      resized.disconnect();
      column.removeEventListener('scroll', count);
    };
  }, [shown]);
  // A new week's cards, or Your goods first showing above them, can move the cards without
  // resizing anything watched, so count again after every render (it only re-renders on a
  // change).
  useEffect(() => measure.current?.());
  return under;
}

/** The tab on the bar: scroll the column to its end, so the cards under the bar come up. */
function showCardsUnder(e: MouseEvent): void {
  const column = (e.currentTarget as HTMLElement).closest('.right');
  column?.scrollTo({
    top: column.scrollHeight,
    behavior: settings.value.reduceMotion ? 'auto' : 'smooth',
  });
}

export function Hand() {
  const s = run.value;
  useCardInView();
  useColumnTopEachWeek();
  const bar = useRef<HTMLDivElement>(null);
  const under = useCardsUnderBar(bar, s.screen === 'build');
  if (s.screen !== 'build') return null;
  const placing = selected.value !== null;
  const pending = tentative.value;
  const armed = passArmed.value;
  const demolishing = tool.value === 'demolish';
  // Only pieces turn: a fixture or a tool doesn't, except the Moving Truck's carried piece, and
  // nor does a pack (D-106), which is the tiles clicked out, or a card waiting to renovate a
  // room (D-102) (rotate() does nothing for them).
  const sel = selection.value;
  const canTurn =
    (sel?.kind === 'piece' && !CONTENT.pieces[sel.id].pack && pending?.t !== 'renovate') ||
    (sel?.kind === 'tool' && movingUid.value !== null);
  // The long label, and a short one for a narrow column (hand.css, whose container queries are
  // measured on these words). What End week will do, build or renovate, is in its title.
  const [endLabel, endShort] = pending
    ? ['End week', 'End week']
    : armed
      ? ['Pass? Press again', 'Again?']
      : ['Pass this week', 'Pass'];
  const endTitle =
    pending?.t === 'renovate'
      ? 'End the week and renovate the room (Enter)'
      : pending
        ? 'End the week and build it (Enter)'
        : undefined;
  // A milestone's last week, or an overtime week (D-154): the press that checks the target.
  // End week wears a "Last week" tag on its top edge, which stamps in as the week comes up (once
  // its tally is done) and again as a card is placed, the moment that press is next. Its title
  // says what the target still needs. Its words stay: with a card held it's narrowest, and
  // "End week" is all that fits at 1440 and 1728 px wide.
  const stakes = stakesOf(s);
  const tagged = stakes !== null && !busy.value;
  // A pack (D-106) being clicked out: Cancel takes all its tiles off.
  const packing = pending?.t === 'place' && !!pending.shape;
  return (
    <Panel
      class="hand"
      title={
        <>
          <span class="hand-title-long">Pick a card</span>
          <span class="hand-title-short">Cards</span>
        </>
      }
      label="This week's cards"
      // The first job brings the free actions in as they're needed (D-149, first-job.ts).
      head={
        <>
          {shown.value.reroll && <RerollButton />}
          {shown.value.demolish && <DemolishButton />}
        </>
      }
    >
      {/* The free actions sit on the plank, above the cards, so they're in view whatever the
          hand's height; demolishing, the hint sits right under them. */}
      {demolishing && (
        <p class="demolish-hint" role="status">
          <Icon name="hammer" />
          <span>Click a piece or boulder twice to demolish it · Esc to stop</span>
        </p>
      )}
      {DRAW_ROWS.map((row) => (
        <HandRow key={row} row={row} />
      ))}
      {/* The action bar sticks to the column's bottom, so End week stays in view on a short
          window. One row: Rotate and Cancel are square buttons beside it while a card is held.
          Cards under it get a tab on its edge. */}
      <div ref={bar} class={`hand-actions ${under > 0 ? 'has-more' : ''}`}>
        {under > 0 && (
          <Button
            size="sm"
            variant="wood"
            icon="caretDown"
            class="more-cards"
            onMouseDown={noFocus}
            onClick={showCardsUnder}
            title="Scroll down to the rest of this week’s cards"
          >
            {under === 1 ? '1 more card' : `${under} more cards`}
          </Button>
        )}
        {/* Rotate shows only while a card is held (D-148): standing beside Pass with nothing to
            turn, its round arrow read as the reroll. */}
        {placing && !demolishing && (
          <Button
            iconOnly
            size="lg"
            icon="rotate"
            class="rotate"
            onMouseDown={noFocus}
            onClick={rotate}
            disabled={!canTurn}
            title="Rotate (R or right-click)"
            aria-label="Rotate"
          />
        )}
        {placing && !demolishing && (
          <Button
            iconOnly
            size="lg"
            icon="close"
            class="cancel"
            onMouseDown={noFocus}
            onClick={cancelPlacement}
            title={
              packing ? 'Clear the tiles (Esc)' : pending ? 'Move it (Esc)' : 'Put it back (Esc)'
            }
            aria-label={packing ? 'Clear the tiles' : pending ? 'Move it' : 'Put it back'}
          />
        )}
        <Button
          size="lg"
          variant={pending ? 'primary' : armed ? 'armed' : 'secondary'}
          class={`end-week ${pending ? 'ready' : ''} ${armed ? 'confirm' : ''} ${tagged ? 'deciding' : ''}`}
          onMouseDown={noFocus}
          onClick={requestEndWeek}
          title={[stakes, endTitle].filter(Boolean).join(' ') || undefined}
        >
          {tagged && (
            // Keyed on the card placed, so placing one stamps it in again.
            <span class="end-week-tag" key={pending ? 'ready' : 'open'} aria-hidden="true">
              {s.overtimeWeek > 0 ? 'Overtime' : 'Last week'}
            </span>
          )}
          <span class="end-week-label">{endLabel}</span>
          <span class="end-week-short" aria-hidden="true">
            {endShort}
          </span>
          <Keycap>Enter</Keycap>
        </Button>
      </div>
    </Panel>
  );
}
