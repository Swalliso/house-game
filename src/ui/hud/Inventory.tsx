// The company's goods (M3a HUD): the reserve (bought pieces, placed as a week's build), the
// supplies (fixtures, installed for free), and the blueprint slots (always on). Hover shows an
// item in the inspect panel, with Sell for blueprints and supplies; on the build screen a
// click picks a reserve piece or a supply to place or install. A crew's starting cards and a
// household member's (M4b) sit in extra slots after the reserve's own, tagged, and don't count
// against it; a member's pop in as they arrive.

import { CONTENT, rules, type ReservePiece } from '../../rules/index.ts';
import { justArrived } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { supplyGlyph } from '../sprites.ts';
import { inspected, reserveFit, run, selected, sell, suppliesFit, tool } from '../store.ts';
import { isSelected, selectCard } from './actions.ts';
import { arrivalOf, arrivalTag, midName } from './household.ts';
import { Tip } from './Tip.tsx';
import './hud-m3.css';
import './hud-m4.css';

const noFocus = (e: MouseEvent) => e.preventDefault();

function Empty({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: Math.max(0, n) }, (_, k) => (
        <span key={`empty-${k}`} class="slot empty" aria-label="Empty slot">
          ·
        </span>
      ))}
    </>
  );
}

function hover(kind: 'reserve' | 'supply' | 'blueprint' | 'upgrade', i: number): void {
  if (selected.value === null && tool.value !== 'demolish') inspected.value = { kind, i };
}

/** A card in an extra slot (M4b): the crew's, or a household member's. */
const isExtra = (r: ReservePiece) => !!r.crew || r.arrival !== undefined;

/** A reserve card's button: its name, and an extra slot's tag ("Crew", "Twins"). */
function ReserveSlot({ r, i, building }: { r: ReservePiece; i: number; building: boolean }) {
  const s = run.value;
  const def = CONTENT.pieces[r.id];
  const fits = reserveFit.value[i] ?? true;
  const member = r.arrival !== undefined ? arrivalOf(s.setup.clientId, r.arrival) : undefined;
  const tag = r.crew ? 'Crew' : member ? arrivalTag(member) : null;
  const pop = justArrived.value;
  const popping = !!pop && r.arrival === pop.arrival;
  const f = FEEL.arrival;
  const whose = member ? ` (with ${midName(member)})` : r.crew ? ' (your crew’s)' : '';
  return (
    <button
      type="button"
      class={`slot slot-piece ${def.category} ${popping ? 'just-arrived' : ''} ${isSelected('reserve', i) ? 'selected' : ''} ${building && !fits ? 'no-fit' : ''}`}
      style={
        popping
          ? {
              animationDuration: `${f.popMs}ms`,
              animationDelay: `${f.landDelayMs}ms`,
              '--pop-scale': `${f.popScale}`,
            }
          : undefined
      }
      onMouseDown={noFocus}
      onMouseEnter={() => hover('reserve', i)}
      onClick={() => (building ? selectCard(i, 'reserve') : hover('reserve', i))}
      aria-pressed={isSelected('reserve', i)}
      title={
        building
          ? fits
            ? `${def.name}${whose}: place it as this week’s build`
            : `${def.name}${whose}: nowhere on the lot fits it right now`
          : `${def.name}${whose}`
      }
    >
      {def.name}
      {tag && <span class="slot-tag">{tag}</span>}
    </button>
  );
}

export function Inventory({ shop = false }: { shop?: boolean }) {
  const s = run.value;
  const slots = rules.slots(s);
  const building = s.screen === 'build';
  // The reserve's own slots first, then the extra ones, which don't count against it (M4b).
  const indexed = s.reserve.map((r, i) => ({ r, i }));
  const own = indexed.filter(({ r }) => !isExtra(r));
  const extra = indexed.filter(({ r }) => isExtra(r));
  return (
    <section class={`inventory ${shop ? 'in-shop' : ''}`} aria-label="Your company’s goods">
      <div class="inv-row">
        <h3>
          <Tip term="reserve">Reserve</Tip>{' '}
          <span class="muted">
            {own.length}/{slots.reserve}
          </span>
        </h3>
        <div class="slots">
          {own.map(({ r, i }) => (
            <ReserveSlot key={`r-${i}-${r.id}`} r={r} i={i} building={building} />
          ))}
          <Empty n={slots.reserve - own.length} />
          {extra.map(({ r, i }) => (
            <ReserveSlot key={`r-${i}-${r.id}`} r={r} i={i} building={building} />
          ))}
        </div>
      </div>
      <div class="inv-row">
        <h3>
          <Tip term="supplies">Supplies</Tip>{' '}
          <span class="muted">
            {s.supplies.length}/{slots.supplies}
          </span>
        </h3>
        <div class="slots">
          {s.supplies.map((sup, i) => {
            const def = sup.kind === 'fixture' ? CONTENT.fixtures[sup.id] : CONTENT.tools[sup.id];
            const fits = suppliesFit.value[i] ?? true;
            const verb =
              sup.kind === 'fixture'
                ? 'install it for free (click a piece twice)'
                : 'use it for free';
            return (
              <span key={`s-${i}-${sup.id}`} class="slot-wrap">
                <button
                  type="button"
                  class={`slot slot-${sup.kind} rarity-${def.rarity} ${isSelected('supplies', i) ? 'selected' : ''} ${building && !fits ? 'no-fit' : ''}`}
                  onMouseDown={noFocus}
                  onMouseEnter={() => hover('supply', i)}
                  onClick={() => (building ? selectCard(i, 'supplies') : hover('supply', i))}
                  aria-pressed={isSelected('supplies', i)}
                  title={
                    building
                      ? fits
                        ? `${def.name}: ${verb}`
                        : `${def.name}: ${sup.kind === 'fixture' ? 'nothing on the lot can hold it yet' : 'it can’t be used now'}`
                      : def.name
                  }
                >
                  <span class="glyph" aria-hidden="true">
                    {supplyGlyph(sup)}
                  </span>
                  {def.name}
                </button>
                {shop && (
                  <button
                    type="button"
                    class="slot-sell"
                    onMouseDown={noFocus}
                    onClick={() => sell('supplies', i)}
                    title={`Sell ${def.name} for ${rules.sellPrice(s, 'supplies', i)} budget`}
                  >
                    Sell {rules.sellPrice(s, 'supplies', i)}
                  </button>
                )}
              </span>
            );
          })}
          <Empty n={slots.supplies - s.supplies.length} />
        </div>
      </div>
      <div class="inv-row">
        <h3>
          <Tip term="blueprints">Blueprints</Tip>{' '}
          <span class="muted">
            {s.blueprints.length}/{slots.blueprints}
          </span>
        </h3>
        <div class="slots">
          {s.blueprints.map((b, i) => {
            const def = CONTENT.blueprints[b.id];
            return (
              <span key={`b-${b.id}`} class="slot-wrap">
                <button
                  type="button"
                  class={`slot slot-blueprint rarity-${def.rarity}`}
                  onMouseDown={noFocus}
                  onMouseEnter={() => hover('blueprint', i)}
                  onClick={() => hover('blueprint', i)}
                  title={`${def.name}: always on`}
                >
                  {def.name}
                </button>
                {shop && (
                  <button
                    type="button"
                    class="slot-sell"
                    onMouseDown={noFocus}
                    onClick={() => sell('blueprints', i)}
                    title={`Sell ${def.name} for ${rules.sellPrice(s, 'blueprints', i)} budget`}
                  >
                    Sell {rules.sellPrice(s, 'blueprints', i)}
                  </button>
                )}
              </span>
            );
          })}
          <Empty n={slots.blueprints - s.blueprints.length} />
        </div>
      </div>
      {s.upgrades.length > 0 && (
        <div class="inv-row">
          <h3>Company</h3>
          <div class="slots">
            {s.upgrades.map((id) => (
              <span
                key={id}
                class="slot slot-upgrade"
                onMouseEnter={() => hover('upgrade', s.upgrades.indexOf(id))}
                title={CONTENT.upgrades[id].name}
              >
                {CONTENT.upgrades[id].name}
              </span>
            ))}
          </div>
        </div>
      )}
      {s.freePlay === 'ready' && (
        <p class="free-play" role="status">
          Weekend Crew is here: your next build doesn’t end the week.
        </p>
      )}
    </section>
  );
}
