// The week's hand: three cards with generated text (D-038), a rotate button, the free actions
// (reroll, demolish), and End week. A card with nowhere legal to go is greyed out with the reason.

import {
  cardText,
  CONTENT,
  rotateCells,
  parseShape,
  rules,
  fixtureText,
  type Card as CardData,
  type PieceDef,
  type PieceId,
  type Rot,
} from '../../rules/index.ts';
import {
  cardsFit,
  demolishArmed,
  inspected,
  reroll,
  rotation,
  run,
  selected,
  tentative,
  tool,
} from '../store.ts';
import { rotate } from '../board/Board.tsx';
import {
  cancelPlacement,
  isSelected as isPicked,
  passArmed,
  requestEndWeek,
  selectCard,
} from './actions.ts';
import './hud-m2.css';

/**
 * The game's own buttons don't take focus from a mouse click, so the keyboard shortcuts (Enter
 * to end the week) keep working after one. Tab still reaches them, and then Enter presses them.
 */
const noFocus = (e: MouseEvent) => e.preventDefault();

function kindLabel(def: PieceDef): string {
  if (def.connector) return 'Hallway';
  if (def.category === 'indoor') return 'Room';
  if (def.category === 'yard') return 'Yard';
  return 'Outbuilding';
}

function ShapeMini({ id, rot }: { id: PieceId; rot: Rot }) {
  const def = CONTENT.pieces[id];
  const cells = rotateCells(parseShape(def.shape), rot);
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  return (
    <div
      class="shape-mini"
      style={{ gridTemplateColumns: `repeat(${w}, 12px)`, gridTemplateRows: `repeat(${h}, 12px)` }}
      aria-hidden="true"
    >
      {cells.map((c) => (
        <span
          key={`${c.x},${c.y}`}
          class={`mini-cell ${id}`}
          style={{ gridColumn: c.x + 1, gridRow: c.y + 1 }}
        />
      ))}
    </div>
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
  const rot = isSelected ? rotation.value : 0;
  return (
    <button
      type="button"
      class={`card ${def.category} ${isSelected ? 'selected' : ''} ${fits ? '' : 'no-fit'}`}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      onMouseEnter={() => selected.value === null && (inspected.value = { kind: 'card', i })}
      aria-pressed={isSelected}
      title={fits ? undefined : 'There’s nowhere on the lot this fits right now'}
    >
      <div class="card-head">
        <span class="key">{i + 1}</span>
        <span class="card-name">{def.name}</span>
        <span class="card-kind">{kindLabel(def)}</span>
      </div>
      <div class="card-body">
        <ShapeMini id={card.id} rot={rot} />
        <ul class="effects">
          {text.effects.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <div class="card-foot">
        <span class="tags">{def.tags.join(' · ')}</span>
        {text.notes.length > 0 && <span class="notes">{text.notes.join(' ')}</span>}
      </div>
      {!fits && <div class="no-fit-reason">Nowhere fits</div>}
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
      class={`card fixture rarity-${def.rarity} ${isSelected ? 'selected' : ''} ${fits ? '' : 'no-fit'}`}
      onMouseDown={noFocus}
      onClick={() => pickCard(i)}
      aria-pressed={isSelected}
      title={fits ? undefined : 'Nothing on the lot can hold it yet'}
    >
      <div class="card-head">
        <span class="key">{i + 1}</span>
        <span class="card-name">{def.name}</span>
        <span class="card-kind">Fixture</span>
      </div>
      <div class="card-body">
        <ul class="effects">
          <li>{text.fits}</li>
          {text.effects.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      {!fits && <div class="no-fit-reason">Nothing to put it in</div>}
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
  return (
    <div class="free-actions" role="group" aria-label="Free actions: they don’t end the week">
      <button
        type="button"
        class="free-action reroll"
        onMouseDown={noFocus}
        onClick={() => void reroll()}
        disabled={!can.ok}
        title={
          can.ok
            ? 'Swap this hand for three new cards. It doesn’t end the week.'
            : (can.reason ?? 'You can’t reroll now.')
        }
      >
        <span class="free-action-name">⟲ Reroll</span>
        <span class="free-action-count">({s.rerollsLeft} left this milestone)</span>
      </button>
      <button
        type="button"
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
        <span class="free-action-name">{demolishing ? 'Stop demolishing' : 'Demolish'}</span>
        <span class="free-action-count">({s.demolitionsLeft} left)</span>
      </button>
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
  const endLabel = pending ? 'End week · build it' : armed ? 'Pass? Press again' : 'Pass this week';
  return (
    <section class="hand" aria-label="This week's cards">
      <h2>Pick one to build</h2>
      {s.freeRedrawUsed && (
        <p
          class="free-redraw"
          title="None of the first three cards fit anywhere, so this hand was drawn again for free."
        >
          Free redraw used
        </p>
      )}
      {s.hand.map((card, i) => (
        <CardView key={`${s.week}-${s.draws}-${i}`} card={card} i={i} />
      ))}
      <FreeActions />
      <div class="hand-buttons">
        <button
          type="button"
          class="rotate"
          onMouseDown={noFocus}
          onClick={rotate}
          disabled={!placing || demolishing}
          title="Rotate (R or right-click)"
        >
          ⟳ Rotate
        </button>
        {placing && !demolishing && (
          <button type="button" onMouseDown={noFocus} onClick={cancelPlacement} title="Esc">
            {pending ? 'Move it' : 'Cancel'}
          </button>
        )}
      </div>
      {demolishing && (
        <p class="demolish-hint" role="status">
          Click a piece or boulder to demolish it · Esc to cancel
        </p>
      )}
      <button
        type="button"
        class={`end-week ${pending ? 'ready' : ''} ${armed ? 'confirm' : ''} ${demolishing ? 'compact' : ''}`}
        onMouseDown={noFocus}
        onClick={requestEndWeek}
      >
        {endLabel}
        <span class="key-hint">Enter</span>
      </button>
    </section>
  );
}
