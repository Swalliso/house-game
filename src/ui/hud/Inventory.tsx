// The company's goods (M3a HUD): the reserve (bought pieces, placed as a week's build), the
// supplies (fixtures, installed for free), and the blueprint slots (always on). Hover shows an
// item in the inspect panel, with Sell for blueprints and supplies; on the build screen a
// click picks a reserve piece or a supply to place or install.

import { CONTENT, rules } from '../../rules/index.ts';
import { FIXTURE_GLYPHS } from '../sprites.ts';
import { inspected, reserveFit, run, selected, sell, suppliesFit, tool } from '../store.ts';
import { isSelected, selectCard } from './actions.ts';
import { Tip } from './Tip.tsx';
import './hud-m3.css';

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

function hover(kind: 'reserve' | 'supply' | 'blueprint', i: number): void {
  if (selected.value === null && tool.value !== 'demolish') inspected.value = { kind, i };
}

export function Inventory({ shop = false }: { shop?: boolean }) {
  const s = run.value;
  const slots = rules.slots(s);
  const building = s.screen === 'build';
  const reserveUsed = s.reserve.filter((r) => !r.crew).length;
  return (
    <section class={`inventory ${shop ? 'in-shop' : ''}`} aria-label="Your company’s goods">
      <div class="inv-row">
        <h3>
          <Tip term="reserve">Reserve</Tip>{' '}
          <span class="muted">
            {reserveUsed}/{slots.reserve}
          </span>
        </h3>
        <div class="slots">
          {s.reserve.map((r, i) => {
            const def = CONTENT.pieces[r.id];
            const fits = reserveFit.value[i] ?? true;
            return (
              <button
                key={`r-${i}-${r.id}`}
                type="button"
                class={`slot slot-piece ${def.category} ${isSelected('reserve', i) ? 'selected' : ''} ${building && !fits ? 'no-fit' : ''}`}
                onMouseDown={noFocus}
                onMouseEnter={() => hover('reserve', i)}
                onClick={() => (building ? selectCard(i, 'reserve') : hover('reserve', i))}
                aria-pressed={isSelected('reserve', i)}
                title={
                  building
                    ? fits
                      ? `${def.name}: place it as this week’s build`
                      : `${def.name}: nowhere on the lot fits it right now`
                    : def.name
                }
              >
                {def.name}
                {r.crew && <span class="muted"> (crew)</span>}
              </button>
            );
          })}
          <Empty n={slots.reserve - reserveUsed} />
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
            const def = CONTENT.fixtures[sup.id];
            const fits = suppliesFit.value[i] ?? true;
            return (
              <span key={`s-${i}-${sup.id}`} class="slot-wrap">
                <button
                  type="button"
                  class={`slot slot-fixture rarity-${def.rarity} ${isSelected('supplies', i) ? 'selected' : ''} ${building && !fits ? 'no-fit' : ''}`}
                  onMouseDown={noFocus}
                  onMouseEnter={() => hover('supply', i)}
                  onClick={() => (building ? selectCard(i, 'supplies') : hover('supply', i))}
                  aria-pressed={isSelected('supplies', i)}
                  title={
                    building
                      ? fits
                        ? `${def.name}: install it for free (click a piece twice)`
                        : `${def.name}: nothing on the lot can hold it yet`
                      : def.name
                  }
                >
                  <span class="glyph" aria-hidden="true">
                    {FIXTURE_GLYPHS[sup.id]}
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
    </section>
  );
}
