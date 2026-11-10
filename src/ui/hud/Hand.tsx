// The week's hand: cards with generated text (D-038), the free actions (reroll, demolish), and
// the action bar (rotate, cancel, End week). A card with nowhere legal to go is hatched, with
// the reason. M5a draws it in the pixel style: each card shows its piece's picture, its kind
// and tags as icon chips, and End week is the view's one primary button. The picked card shows
// its shape as it's turned (R, or the Rotate button), and a card picked below the fold scrolls
// into view.
//
// D-121: the hand is two rows, Rooms then Layout, each under its label with its own Reroll
// button (one count for both). A card the draw swapped in, because the one it replaced had no
// play, says so on a chip. Demolish sits on the plank. The cards are compact, so four or five
// fit beside Your goods: the name, the first effect line, and the chips beside a thumbnail of
// the piece (a fixture: where it goes, and its first effect). Inspect shows the whole text on
// hover.

import { useEffect } from 'preact/hooks';
import {
  cardText,
  CONTENT,
  DRAW_ROWS,
  rules,
  fixtureText,
  rowOf,
  type Card as CardData,
  type DrawRow,
  type PieceDef,
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
import { Button, Card, Chip, Icon, Keycap, Panel } from '../kit/kit.tsx';
import type { IconName } from '../theme/art.ts';
import {
  cancelPlacement,
  isSelected as isPicked,
  passArmed,
  requestEndWeek,
  selectCard,
} from './actions.ts';
import { PieceArt, ShapeGlyph } from './PieceArt.tsx';
import { RARITY_LABEL } from './goods.tsx';
import './hand.css';

/**
 * The game's own buttons don't take focus from a mouse click, so the keyboard shortcuts (Enter
 * to end the week) keep working after one. Tab still reaches them, and then Enter presses them.
 */
const noFocus = (e: MouseEvent) => e.preventDefault();

type Kind = 'room' | 'yard' | 'hall' | 'outbuilding';

function kindOf(def: PieceDef): Kind {
  if (def.connector) return 'hall';
  if (def.category === 'indoor') return 'room';
  if (def.category === 'yard') return 'yard';
  return 'outbuilding';
}

const KIND_LABEL: Record<Kind, string> = {
  room: 'Room',
  yard: 'Yard',
  hall: 'Hallway',
  outbuilding: 'Outbuilding',
};

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

const ROW_LABEL: Record<DrawRow, string> = { rooms: 'Rooms', layout: 'Layout' };

const cardName = (card: CardData): string =>
  card.kind === 'fixture' ? CONTENT.fixtures[card.id].name : CONTENT.pieces[card.id].name;

/** A card the week's draw swapped in (D-121): what it replaced, which had no play. */
function SwapChip({ i }: { i: number }) {
  const was = run.value.swapped.find((w) => w.i === i)?.was;
  if (!was) return null;
  return (
    <Chip
      tone="inset"
      icon="reroll"
      class="swap-chip"
      title={`The ${cardName(was)} had nowhere to go, so this card took its place, free.`}
    >
      Swapped in
    </Chip>
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
  const text = cardText(CONTENT, def);
  const fits = cardsFit.value[i] ?? true;
  const renovates = cardsRenovate.value[i] ?? false;
  const isSelected = isPicked('hand', i);
  const kind = kindOf(def);
  const type = CONTENT.pieces[def.countsAs ?? def.id].name;
  // A pack (D-106) doesn't turn, so it never shows a turn left from another card this week.
  const rot = isSelected && !def.pack ? rotation.value : 0;
  // A compact card (D-121): the first effect line. The rest, the notes, and a member's room
  // (M4b, D-103: whose it is) are in Inspect.
  return (
    <Card
      as="button"
      class="hand-card"
      tone={kind}
      selected={isSelected}
      blocked={!fits}
      lead={<Keycap>{i + 1}</Keycap>}
      title={def.name}
      aside={<ShapeGlyph id={card.id} rot={rot} square />}
      art={<PieceArt id={card.id} />}
      lines={text.effects.slice(0, 1)}
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
          <Chip tone="wood" class="kind-chip">
            {KIND_LABEL[kind]}
          </Chip>
          <TagChips tags={def.tags} />
          <SwapChip i={i} />
        </>
      }
      alert={fits ? undefined : 'Nowhere fits'}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      onMouseEnter={() => selected.value === null && (inspected.value = { kind: 'card', i })}
      aria-pressed={isSelected}
      data-card={i}
      tooltip={fits ? undefined : 'There’s nowhere on the lot this fits right now'}
    />
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
  const text = fixtureText(CONTENT, def);
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
      lines={[text.fits, ...text.effects.slice(0, 1)]}
      chips={
        <>
          <Chip tone="wood">Fixture</Chip>
          <Chip tone={def.rarity}>{RARITY_LABEL[def.rarity]}</Chip>
          <SwapChip i={i} />
        </>
      }
      alert={fits ? undefined : 'Nothing to put it in'}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      onMouseEnter={() => selected.value === null && (inspected.value = { kind: 'card', i })}
      aria-pressed={isSelected}
      data-card={i}
      tooltip={fits ? undefined : 'Nothing on the lot can hold it yet'}
    />
  );
}

/**
 * A row's reroll (D-121): new cards for that row only. A free action, so the week goes on.
 * Both rows draw on the milestone's one count, so each button shows all of it.
 */
function RerollButton({ row }: { row: DrawRow }) {
  const s = run.value;
  const can = rules.canReroll(s);
  const rerolls = s.rerollsLeft + s.bonusRerolls;
  const label = ROW_LABEL[row];
  return (
    <Button
      size="sm"
      icon="reroll"
      class="free-action reroll"
      onMouseDown={noFocus}
      onClick={() => void reroll(row)}
      disabled={!can.ok}
      aria-label={`Reroll the ${label} cards: ${rerolls} left`}
      title={
        can.ok
          ? `New ${label} cards; the other row stays. It doesn’t end the week. Both rows share ${s.rerollsLeft} left this milestone${s.bonusRerolls > 0 ? `, and ${s.bonusRerolls} kept` : ''}.`
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
            ? `Remove a piece or a boulder. No refund, and points already earned stay. ${s.demolitionsLeft} left this run.`
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

/** One row of the hand (D-121): its label and reroll, then its cards, numbered across rows. */
function HandRow({ row }: { row: DrawRow }) {
  const s = run.value;
  const cards = s.hand.flatMap((card, i) => (rowOf(CONTENT, card) === row ? [{ card, i }] : []));
  return (
    <section class={`hand-row hand-row-${row}`} aria-label={`${ROW_LABEL[row]} cards`}>
      <div class="hand-row-head">
        <h3 class="hand-row-label">{ROW_LABEL[row]}</h3>
        <RerollButton row={row} />
      </div>
      {cards.map(({ card, i }) => (
        <CardView key={`${s.week}-${s.draws}-${i}`} card={card} i={i} />
      ))}
    </section>
  );
}

/**
 * The picked hand card scrolls fully into view (above the sticky action bar: .right's
 * scroll-padding), so picking card 3 with its key on a short window shows it.
 */
function useCardInView(): void {
  const picked = source.value === 'hand' ? selected.value : null;
  useEffect(() => {
    if (picked === null) return;
    document
      .querySelector(`.hand [data-card="${picked}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [picked]);
}

export function Hand() {
  const s = run.value;
  useCardInView();
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
  // A pack (D-106) being clicked out: Cancel takes all its tiles off.
  const packing = pending?.t === 'place' && !!pending.shape;
  return (
    <Panel class="hand" title="Pick a card" label="This week's cards" head={<DemolishButton />}>
      {/* The free actions sit above their cards, so they're in view whatever the hand's
          height: Demolish on the plank (demolishing, the hint sits right under it), each row's
          Reroll on its label. */}
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
          window. One row: Rotate and Cancel are square buttons beside it. */}
      <div class="hand-actions">
        <Button
          iconOnly
          size="lg"
          icon="rotate"
          class="rotate"
          onMouseDown={noFocus}
          onClick={rotate}
          disabled={!placing || demolishing || !canTurn}
          title="Rotate (R or right-click)"
          aria-label="Rotate"
        />
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
          class={`end-week ${pending ? 'ready' : ''} ${armed ? 'confirm' : ''}`}
          onMouseDown={noFocus}
          onClick={requestEndWeek}
          title={endTitle}
        >
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
