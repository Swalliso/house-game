// The week's hand: three cards with generated text (D-038), the free actions (reroll,
// demolish), and the action bar (rotate, cancel, End week). A card with nowhere legal to go is
// hatched, with the reason. M5a draws it in the pixel style: each card shows its piece's
// picture, its kind and tags as icon chips, and End week is the view's one primary button.
// The picked card shows its shape as it's turned (R, or the Rotate button), and a card picked
// below the fold scrolls into view.

import { useEffect } from 'preact/hooks';
import {
  cardText,
  CONTENT,
  rules,
  fixtureText,
  type Card as CardData,
  type PieceDef,
  type Tag,
} from '../../rules/index.ts';
import {
  cardsFit,
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

/** A card's tags as chips, each with its icon (the icon set is named after the tags). */
export function TagChips({ tags }: { tags: readonly Tag[] }) {
  return (
    <>
      {tags.map((t) => (
        <Chip key={t} icon={t as IconName}>
          {t}
        </Chip>
      ))}
    </>
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
  const isSelected = isPicked('hand', i);
  const kind = kindOf(def);
  // A pack (D-106) doesn't turn, so it never shows a turn left from another card this week.
  const rot = isSelected && !def.pack ? rotation.value : 0;
  // A member's room (M4b, D-103): whose it is, before the card's notes. Only the ?debug panel
  // deals one to the hand; Inspect says it too, where a short window hides the note.
  const notes = text.member ? [text.member, ...text.notes] : text.notes;
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
      lines={text.effects}
      note={notes.length > 0 ? notes.join(' ') : undefined}
      chips={
        <>
          <Chip tone="wood">{KIND_LABEL[kind]}</Chip>
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
      lines={[text.fits, ...text.effects]}
      chips={
        <>
          <Chip tone="wood">Fixture</Chip>
          <Chip tone={def.rarity}>{RARITY_LABEL[def.rarity]}</Chip>
        </>
      }
      alert={fits ? undefined : 'Nothing to put it in'}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      aria-pressed={isSelected}
      data-card={i}
      tooltip={fits ? undefined : 'Nothing on the lot can hold it yet'}
    />
  );
}

/** Rerolls and demolitions: free actions, so the week goes on. */
function FreeActions() {
  const s = run.value;
  const can = rules.canReroll(s);
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
  const rerolls = s.rerollsLeft + s.bonusRerolls;
  return (
    <div class="free-actions" role="group" aria-label="Free actions: they don’t end the week">
      <Button
        size="sm"
        icon="reroll"
        class="free-action reroll"
        onMouseDown={noFocus}
        onClick={() => void reroll()}
        disabled={!can.ok}
        title={
          can.ok
            ? `Swap this hand for three new cards. It doesn’t end the week. ${s.rerollsLeft} left this milestone${s.bonusRerolls > 0 ? `, and ${s.bonusRerolls} kept` : ''}.`
            : (can.reason ?? 'You can’t reroll now.')
        }
      >
        <span class="free-action-word">Reroll</span>
        <span class="count" aria-label={`${rerolls} left`}>
          {rerolls}
        </span>
      </Button>
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
    </div>
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
    <Panel
      class="hand"
      title="Pick a card"
      label="This week's cards"
      head={
        s.freeRedrawUsed && (
          <span
            class="free-redraw"
            title="None of the first three cards fit anywhere, so this hand was drawn again for free."
          >
            Free redraw
          </span>
        )
      }
    >
      {/* The free actions sit above the cards, so they're in view whatever the hand's height;
          demolishing, the hint sits right under Stop. */}
      <FreeActions />
      {demolishing && (
        <p class="demolish-hint" role="status">
          <Icon name="hammer" />
          <span>Click a piece or boulder twice to demolish it · Esc to stop</span>
        </p>
      )}
      {s.hand.map((card, i) => (
        <CardView key={`${s.week}-${s.draws}-${i}`} card={card} i={i} />
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
