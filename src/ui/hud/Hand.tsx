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
//
// D-157: Strike sits on the plank between Reroll and Demolish. In strike mode the cards are the
// targets: a card clicked twice (or its number pressed twice) is struck, its type gone for the
// run. The struck card holds its slot under a stamp, then the card from its row that took its
// place slides in (the director's beat, which any action ends at once).

import type { RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  DRAW_ROWS,
  handCardLines,
  rules,
  rowOf,
  setProgressText,
  setsOfPiece,
  setText,
  struckText,
  type Card as CardData,
  type DrawRow,
  type PieceId,
  type Tag,
} from '../../rules/index.ts';
import {
  cardsFit,
  cardsRenovate,
  inspected,
  reroll,
  rotation,
  run,
  movingUid,
  selected,
  selection,
  source,
  strikeArmed,
  strikeViews,
  tentative,
  tool,
} from '../store.ts';
import { rotate } from '../board/Board.tsx';
import { busy, strikeView, struckIn, struckSaid } from '../fx/director.ts';
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
  strikeFocus,
  toggleDemolish,
  toggleStrike,
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

/** A struck card held in its slot under the stamp (D-157): the stamp's words, and if it's going. */
interface Held {
  text: string;
  leaving: boolean;
}

/**
 * The new card in a slot whose struck card had the keyboard's focus takes it as it comes in
 * (D-157): at the beat's end, at once with no beat, or when a click ends the beat (actions.ts
 * strikeFocus). A held card's `held` is a new object each render, so its effect returns at once;
 * the new card mounts fresh (HandRow's key names the card), so its effect runs once.
 */
function useStrikeFocus(i: number, held: Held | undefined): void {
  useLayoutEffect(() => {
    if (held || strikeFocus.peek() !== i) return;
    strikeFocus.value = null;
    document.querySelector<HTMLElement>(`.hand [data-card="${i}"]`)?.focus({ preventScroll: true });
  }, [held]);
}

/** The strike's stamp on a card as it goes (D-157): the plate, and what it means for the run. */
function StrikeStamp({ text }: { text: string }) {
  return (
    <span class="strike-stamp" aria-hidden="true">
      <span class="strike-plate">
        <Icon name="cross" />
        Struck
      </span>
      <span class="strike-slip">{text}</span>
    </span>
  );
}

/**
 * A hand card's look in strike mode (D-157), or held under its stamp: its classes, whether it's
 * hatched, and what its alert and title say. Not in strike mode, the card's own.
 */
function strikeLook(i: number, held: Held | undefined, entering: boolean | undefined) {
  const striking = tool.value === 'strike' && !held;
  const view = striking ? strikeViews.value[i] : undefined;
  const fits = held ? true : (cardsFit.value[i] ?? true);
  const isSelected = !held && !striking && isPicked('hand', i);
  const armed = striking && strikeArmed.value === i;
  const blocked = striking ? !view?.ok : !fits;
  const cls = [
    'hand-card',
    armed ? 'strike-armed' : '',
    held ? 'is-struck' : '',
    held?.leaving ? 'strike-out' : '',
    entering ? 'strike-in' : '',
  ];
  return { striking, view, fits, isSelected, armed, blocked, cls };
}

/** The armed card's band (D-157): the second click strikes it. */
function StrikeBand() {
  return (
    <span class="strike-band" aria-hidden="true">
      Click again to strike
    </span>
  );
}

function CardView({
  card,
  i,
  held,
  entering,
}: {
  card: CardData;
  i: number;
  /** D-157: a struck card holding its slot under the stamp. */
  held?: Held;
  /** D-157: the new card in a struck slot, sliding in. */
  entering?: boolean;
}) {
  if (card.kind === 'fixture') {
    return <FixtureCardView card={card} i={i} held={held} entering={entering} />;
  }
  const def = CONTENT.pieces[card.id];
  const { striking, view, fits, isSelected, armed, blocked, cls } = strikeLook(i, held, entering);
  const renovates = cardsRenovate.value[i] ?? false;
  const kind = pieceKind(def);
  const type = CONTENT.pieces[def.countsAs ?? def.id].name;
  // A pack (D-106) doesn't turn, so it never shows a turn left from another card this week.
  const rot = isSelected && !def.pack ? rotation.value : 0;
  useStrikeFocus(i, held);
  // A compact card (D-121): the line that says what it pays. The rest, the notes, and a
  // member's room (M4b, D-103: whose it is) are in Inspect.
  return (
    <Card
      as="button"
      // Week 1's guide (D-149) points at the card to pick first.
      class={[...cls, !held && !striking && guideCard.value === i ? 'guide-now' : '']
        .filter(Boolean)
        .join(' ')}
      tone={kind}
      selected={isSelected}
      blocked={blocked}
      lead={<Keycap>{i + 1}</Keycap>}
      title={def.name}
      aside={<ShapeGlyph id={card.id} rot={rot} square />}
      art={<PieceArt id={card.id} />}
      lines={handCardLines(CONTENT, card)}
      chips={
        <>
          {renovates && !held && !striking && (
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
      alert={striking ? (view?.ok ? undefined : 'Can’t strike') : fits ? undefined : 'Nowhere fits'}
      onMouseDown={noFocus}
      // A held card's click ends the beat and picks the new card in its slot (actions.ts).
      onClick={() => selectCard(i)}
      onMouseEnter={
        held
          ? undefined
          : () => (striking || selected.value === null) && (inspected.value = { kind: 'card', i })
      }
      aria-pressed={striking ? armed : isSelected}
      aria-disabled={striking && !view?.ok ? true : undefined}
      data-card={i}
      tooltip={
        striking
          ? view?.ok
            ? view.text
            : view?.reason
          : fits
            ? undefined
            : 'There’s nowhere on the lot this fits right now'
      }
    >
      <SwapMark i={i} />
      {armed && <StrikeBand />}
      {held && <StrikeStamp text={held.text} />}
    </Card>
  );
}

/** A fixture card: it goes in a placed piece, as the week's turn (D-050). */
function FixtureCardView({
  card,
  i,
  held,
  entering,
}: {
  card: Extract<CardData, { kind: 'fixture' }>;
  i: number;
  held?: Held;
  entering?: boolean;
}) {
  const id = card.id;
  const def = CONTENT.fixtures[id];
  const { striking, view, fits, isSelected, armed, blocked, cls } = strikeLook(i, held, entering);
  useStrikeFocus(i, held);
  return (
    <Card
      as="button"
      class={cls.filter(Boolean).join(' ')}
      tone="fixture"
      rarity={def.rarity}
      selected={isSelected}
      blocked={blocked}
      lead={<Keycap>{i + 1}</Keycap>}
      title={def.name}
      lines={handCardLines(CONTENT, { kind: 'fixture', id })}
      chips={
        <>
          <Chip tone="wood">Fixture</Chip>
          <Chip tone={def.rarity}>{RARITY_LABEL[def.rarity]}</Chip>
        </>
      }
      alert={
        striking
          ? view?.ok
            ? undefined
            : 'Can’t strike'
          : fits
            ? undefined
            : 'Nothing to put it in'
      }
      onMouseDown={noFocus}
      onClick={() => selectCard(i)}
      onMouseEnter={
        held
          ? undefined
          : () => (striking || selected.value === null) && (inspected.value = { kind: 'card', i })
      }
      aria-pressed={striking ? armed : isSelected}
      aria-disabled={striking && !view?.ok ? true : undefined}
      data-card={i}
      tooltip={
        striking
          ? view?.ok
            ? view.text
            : view?.reason
          : fits
            ? undefined
            : 'Nothing on the lot can hold it yet'
      }
    >
      <SwapMark i={i} />
      {armed && <StrikeBand />}
      {held && <StrikeStamp text={held.text} />}
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
      <span class={`count ${rerolls >= 10 ? 'wide' : ''}`} aria-hidden="true">
        {rerolls}
      </span>
    </Button>
  );
}

/**
 * Strikes (D-157): a free action, so the week goes on. Click it (or S), then a hand card twice:
 * its type is never drawn again this run, and a card from its row takes its place. It sits on
 * the plank between Reroll and Demolish.
 */
function StrikeButton() {
  const s = run.value;
  const striking = tool.value === 'strike';
  const can = rules.canStrikeAny(s);
  const n = s.strikesLeft;
  const struck = struckText(CONTENT, s.struck);
  const after = struck ? ` ${struck}.` : '';
  return (
    <Button
      size="sm"
      icon="strike"
      variant={striking ? 'danger' : 'secondary'}
      class={`free-action strike ${striking ? 'active' : ''}`}
      onMouseDown={noFocus}
      onClick={toggleStrike}
      disabled={!can.ok && !striking}
      aria-pressed={striking}
      aria-label={`Strike a card, ${n} left`}
      title={
        striking
          ? 'Back to building (Esc)'
          : can.ok
            ? `Strike a card: no more of its type this run, and a new card takes its place. It doesn’t end the week. ${n} left (S).${after}`
            : `${can.reason ?? 'You can’t strike now.'}${after}`
      }
    >
      <span class="free-action-word">{striking ? 'Stop' : 'Strike'}</span>
      <span class={`count ${n >= 10 ? 'wide' : ''}`} aria-hidden="true">
        {n}
      </span>
    </Button>
  );
}

/** Demolitions: a free action, so the week goes on. It sits on the hand's plank. */
function DemolishButton() {
  const s = run.value;
  const demolishing = tool.value === 'demolish';
  const canDemolish = s.demolitionsLeft > 0;
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
      <span
        class={`count ${s.demolitionsLeft >= 10 ? 'wide' : ''}`}
        aria-label={`${s.demolitionsLeft} left`}
      >
        {s.demolitionsLeft}
      </span>
    </Button>
  );
}

/**
 * One row of the hand (D-121): its label, then its cards, numbered across rows. During a
 * strike's beat (D-157) a struck slot shows its old card under the stamp: a replacement always
 * comes from the same row, so the slot stays in place. Each card's key names it, so the old
 * card keeps its stamp and the new one mounts fresh and slides in.
 */
function HandRow({ row }: { row: DrawRow }) {
  const s = run.value;
  const beat = strikeView.value;
  const sliding = struckIn.value?.slots ?? [];
  const cards = s.hand.flatMap((card, i) => (rowOf(CONTENT, card) === row ? [{ card, i }] : []));
  return (
    <section class={`hand-row hand-row-${row}`} aria-label={`${ROW_LABEL[row]} cards`}>
      <div class="hand-row-head">
        <h3 class="hand-row-label">{ROW_LABEL[row]}</h3>
      </div>
      {cards.map(({ card, i }) => {
        // D-157: a struck card holds its slot under its stamp, then the new one slides in.
        const was = beat?.cards.find((c) => c.i === i)?.was;
        const shown = was ?? card;
        return (
          <CardView
            key={`${s.week}-${s.draws}-${i}-${shown.kind}:${shown.id}`}
            card={shown}
            i={i}
            held={was && beat ? { text: beat.text, leaving: beat.leaving } : undefined}
            entering={!was && sliding.includes(i)}
          />
        );
      })}
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
  const striking = tool.value === 'strike';
  // For screen readers: the armed card's scope and how to confirm it (D-157).
  const a = strikeArmed.value;
  const av = a === null ? undefined : strikeViews.value[a];
  const armedSaid =
    a !== null && av?.ok
      ? `${cardName(s.hand[a]!)}: ${av.text}. Click it again, or press ${a + 1}, to strike it.`
      : null;
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
      class={`hand ${striking ? 'striking' : ''}`}
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
          {shown.value.strike && <StrikeButton />}
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
      {striking && (
        <p class="strike-hint" role="status">
          <Icon name="strike" />
          <span>Click a card twice to strike it · Esc to stop</span>
        </p>
      )}
      {/* For screen readers: the armed card's scope and how to confirm, or what a strike did. */}
      <p class="strike-sr" role="status">
        {armedSaid ?? struckSaid.value}
      </p>
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
        {placing && tool.value === 'build' && (
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
        {placing && tool.value === 'build' && (
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
