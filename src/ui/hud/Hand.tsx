// The week's hand: three cards with generated text (D-038), a rotate button, and End week.
// A card with nowhere legal to go is greyed out with the reason.

import {
  cardText,
  CONTENT,
  rotateCells,
  parseShape,
  type Card as CardData,
  type Rot,
} from '../../rules/index.ts';
import { cardsFit, inspected, rotation, run, selected, tentative } from '../store.ts';
import { rotate } from '../board/Board.tsx';
import { cancelPlacement, passArmed, requestEndWeek, selectCard } from './actions.ts';

/**
 * The game's own buttons don't take focus from a mouse click, so the keyboard shortcuts (Enter
 * to end the week) keep working after one. Tab still reaches them, and then Enter presses them.
 */
const noFocus = (e: MouseEvent) => e.preventDefault();

function ShapeMini({ id, rot }: { id: CardData['id']; rot: Rot }) {
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

function CardView({ card, i }: { card: CardData; i: number }) {
  const def = CONTENT.pieces[card.id];
  const text = cardText(CONTENT, def);
  const fits = cardsFit.value[i] ?? true;
  const isSelected = selected.value === i;
  const rot = isSelected ? rotation.value : 0;
  return (
    <button
      type="button"
      class={`card ${def.category} ${isSelected ? 'selected' : ''} ${fits ? '' : 'no-fit'}`}
      onMouseDown={noFocus}
      onClick={() => selectCard(i)}
      onMouseEnter={() => selected.value === null && (inspected.value = { kind: 'card', i })}
      aria-pressed={isSelected}
      title={fits ? undefined : 'There’s nowhere on the lot this fits right now'}
    >
      <div class="card-head">
        <span class="key">{i + 1}</span>
        <span class="card-name">{def.name}</span>
        <span class="card-kind">{def.category === 'indoor' ? 'Room' : 'Yard'}</span>
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

export function Hand() {
  const s = run.value;
  if (s.screen !== 'build') return null;
  const placing = selected.value !== null;
  const pending = tentative.value;
  const armed = passArmed.value;
  return (
    <section class="hand" aria-label="This week's cards">
      <h2>Pick one to build</h2>
      {s.hand.map((card, i) => (
        <CardView key={`${s.week}-${i}`} card={card} i={i} />
      ))}
      <div class="hand-buttons">
        <button
          type="button"
          class="rotate"
          onMouseDown={noFocus}
          onClick={rotate}
          disabled={!placing}
          title="Rotate (R or right-click)"
        >
          ⟳ Rotate
        </button>
        {placing && (
          <button type="button" onMouseDown={noFocus} onClick={cancelPlacement} title="Esc">
            {pending ? 'Move it' : 'Cancel'}
          </button>
        )}
      </div>
      <button
        type="button"
        class={`end-week ${pending ? 'ready' : ''} ${armed ? 'confirm' : ''}`}
        onMouseDown={noFocus}
        onClick={requestEndWeek}
      >
        {pending ? 'End week · build it' : armed ? 'Pass? Press again' : 'Pass this week'}
        <span class="key-hint">Enter</span>
      </button>
    </section>
  );
}
