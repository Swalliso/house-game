// The week's hand: three cards with generated text (D-038), the free actions (reroll,
// demolish), and the action bar (rotate, cancel, End week). A card with nowhere legal to go is
// hatched, with the reason. M5a draws it in the pixel style: each card shows its piece's
// picture, its kind and tags as icon chips, and End week is the view's one primary button.

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
  run,
  movingUid,
  selected,
  selection,
  tentative,
  tool,
} from '../store.ts';
import { rotate } from '../board/Board.tsx';
import { Button, Chip, Icon, Keycap, Panel } from '../kit/kit.tsx';
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

function NoFit({ text }: { text: string }) {
  return (
    <span class="hand-card-nofit">
      <Icon name="cross" />
      {text}
    </span>
  );
}

function CardView({ card, i }: { card: CardData; i: number }) {
  if (card.kind === 'fixture') return <FixtureCardView id={card.id} i={i} />;
  const def = CONTENT.pieces[card.id];
  const text = cardText(CONTENT, def);
  const fits = cardsFit.value[i] ?? true;
  const isSelected = isPicked('hand', i);
  const kind = kindOf(def);
  return (
    <button
      type="button"
      class={`hand-card pcard kind-${kind} ${isSelected ? 'selected' : ''} ${fits ? '' : 'no-fit'}`}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      onMouseEnter={() => selected.value === null && (inspected.value = { kind: 'card', i })}
      aria-pressed={isSelected}
      title={fits ? undefined : 'There’s nowhere on the lot this fits right now'}
    >
      <span class="hand-card-head">
        <Keycap>{i + 1}</Keycap>
        <span class="hand-card-name">{def.name}</span>
        <ShapeGlyph id={card.id} />
      </span>
      <span class="hand-card-art">
        <PieceArt id={card.id} />
      </span>
      <ul class="hand-card-effects">
        {text.effects.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {text.notes.length > 0 && <span class="hand-card-notes">{text.notes.join(' ')}</span>}
      <span class="hand-card-tags">
        <Chip tone="wood">{KIND_LABEL[kind]}</Chip>
        <TagChips tags={def.tags} />
      </span>
      {!fits && <NoFit text="Nowhere fits" />}
    </button>
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
    <button
      type="button"
      class={`hand-card pcard kind-fixture rarity-${def.rarity} ${isSelected ? 'selected' : ''} ${fits ? '' : 'no-fit'}`}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      aria-pressed={isSelected}
      title={fits ? undefined : 'Nothing on the lot can hold it yet'}
    >
      <span class="hand-card-head">
        <Keycap>{i + 1}</Keycap>
        <span class="hand-card-name">{def.name}</span>
      </span>
      <ul class="hand-card-effects">
        <li>{text.fits}</li>
        {text.effects.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <span class="hand-card-tags">
        <Chip tone="wood">Fixture</Chip>
        <Chip tone={def.rarity}>{RARITY_LABEL[def.rarity]}</Chip>
      </span>
      {!fits && <NoFit text="Nothing to put it in" />}
    </button>
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
        Reroll
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
        {demolishing ? 'Stop' : 'Demolish'}
        <span class="count" aria-label={`${s.demolitionsLeft} left`}>
          {s.demolitionsLeft}
        </span>
      </Button>
    </div>
  );
}

export function Hand() {
  const s = run.value;
  if (s.screen !== 'build') return null;
  const placing = selected.value !== null;
  const pending = tentative.value;
  const armed = passArmed.value;
  const demolishing = tool.value === 'demolish';
  // Only pieces turn: a fixture or a tool doesn't, except the Moving Truck's carried piece.
  const sel = selection.value;
  const canTurn = sel?.kind === 'piece' || (sel?.kind === 'tool' && movingUid.value !== null);
  // The long label, and a short one for a narrow column (hand.css).
  const [endLabel, endShort] = pending
    ? ['End week', 'End week']
    : armed
      ? ['Pass? Press again', 'Again?']
      : ['Pass this week', 'Pass'];
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
      {/* The free actions sit above the cards, so they're in view whatever the hand's height. */}
      <FreeActions />
      {s.hand.map((card, i) => (
        <CardView key={`${s.week}-${s.draws}-${i}`} card={card} i={i} />
      ))}
      {/* The action bar sticks to the column's bottom, so End week stays in view on a short
          window. One row: Rotate and Cancel are square buttons beside it; demolishing, the
          hint takes their place. */}
      <div class="hand-actions">
        {demolishing ? (
          <p class="demolish-hint" role="status">
            <Icon name="hammer" />
            <span>Click twice to demolish</span>
          </p>
        ) : (
          <Button
            iconOnly
            size="lg"
            icon="rotate"
            class="rotate"
            onMouseDown={noFocus}
            onClick={rotate}
            disabled={!placing || !canTurn}
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
            title={pending ? 'Move it (Esc)' : 'Put it back (Esc)'}
            aria-label={pending ? 'Move it' : 'Put it back'}
          />
        )}
        <Button
          size="lg"
          variant={pending ? 'primary' : armed ? 'armed' : 'secondary'}
          class={`end-week ${pending ? 'ready' : ''} ${armed ? 'confirm' : ''}`}
          onMouseDown={noFocus}
          onClick={requestEndWeek}
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
