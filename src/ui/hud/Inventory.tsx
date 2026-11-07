// The company's goods (M3a HUD): the reserve (bought pieces, placed as a week's build), the
// supplies (fixtures, installed for free), and the blueprint slots (always on). Hover shows an
// item in the inspect panel, with Sell for blueprints and supplies; on the build screen a
// click picks a reserve piece or a supply to place or install.
//
// M5a: a wood panel with a row per kind of good. Empty slots are recessed wells, and a row
// stays hidden until it matters: until the supply yard first opens, an empty row says nothing
// (inventory-rows.ts). A name too long for its slot ends in an ellipsis, and shows whole on
// hover and in the inspect panel.

import { CONTENT, rules } from '../../rules/index.ts';
import { Button, Icon, Panel, Well } from '../kit/kit.tsx';
import { supplyIcon } from '../sprites.ts';
import { inspected, reserveFit, run, selected, sell, suppliesFit, tool } from '../store.ts';
import { isSelected, selectCard } from './actions.ts';
import { inventoryRows, showsInventory } from './inventory-rows.ts';
import { Tip } from './Tip.tsx';
import './inventory.css';

const noFocus = (e: MouseEvent) => e.preventDefault();

function Empty({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: Math.max(0, n) }, (_, k) => (
        <Well key={`empty-${k}`} class="inv-empty" label="Empty slot" />
      ))}
    </>
  );
}

function hover(kind: 'reserve' | 'supply' | 'blueprint' | 'upgrade', i: number): void {
  if (selected.value === null && tool.value !== 'demolish') inspected.value = { kind, i };
}

function SellButton({ price, name, onSell }: { price: number; name: string; onSell: () => void }) {
  return (
    <Button
      size="sm"
      class="inv-sell"
      onMouseDown={noFocus}
      onClick={onSell}
      title={`Sell ${name} for ${price} budget`}
    >
      Sell {price}
    </Button>
  );
}

export function Inventory({ shop = false }: { shop?: boolean }) {
  const s = run.value;
  const slots = rules.slots(s);
  const building = s.screen === 'build';
  const reserveUsed = s.reserve.filter((r) => !r.crew).length;
  const rows = inventoryRows(s, shop);
  if (!showsInventory(rows)) return null;
  return (
    <Panel
      class={`inventory ${shop ? 'in-shop' : ''}`}
      title="Your goods"
      label="Your company’s goods"
    >
      {rows.reserve && (
        <div class={`inv-row reserve ${s.reserve.length === 0 ? 'is-empty' : ''}`}>
          <h3 class="inv-label">
            <Tip term="reserve">Reserve</Tip>
            <span class="inv-count">
              {reserveUsed}/{slots.reserve}
            </span>
          </h3>
          <div class="inv-slots">
            {s.reserve.map((r, i) => {
              const def = CONTENT.pieces[r.id];
              const fits = reserveFit.value[i] ?? true;
              return (
                <button
                  key={`r-${i}-${r.id}`}
                  type="button"
                  class={`inv-slot slot-piece ${def.category} ${isSelected('reserve', i) ? 'selected' : ''} ${building && !fits ? 'no-fit' : ''}`}
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
                  <span class="inv-name">
                    {def.name}
                    {r.crew && <span class="inv-note"> (crew)</span>}
                  </span>
                </button>
              );
            })}
            <Empty n={slots.reserve - reserveUsed} />
          </div>
        </div>
      )}
      {rows.supplies && (
        <div class={`inv-row supplies ${s.supplies.length === 0 ? 'is-empty' : ''}`}>
          <h3 class="inv-label">
            <Tip term="supplies">Supplies</Tip>
            <span class="inv-count">
              {s.supplies.length}/{slots.supplies}
            </span>
          </h3>
          <div class="inv-slots">
            {s.supplies.map((sup, i) => {
              const def = sup.kind === 'fixture' ? CONTENT.fixtures[sup.id] : CONTENT.tools[sup.id];
              const fits = suppliesFit.value[i] ?? true;
              const verb =
                sup.kind === 'fixture'
                  ? 'install it for free (click a piece twice)'
                  : 'use it for free';
              return (
                <span key={`s-${i}-${sup.id}`} class="inv-item">
                  <button
                    type="button"
                    class={`inv-slot slot-${sup.kind} rarity-${def.rarity} ${isSelected('supplies', i) ? 'selected' : ''} ${building && !fits ? 'no-fit' : ''}`}
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
                    <Icon name={supplyIcon(sup)} class="inv-glyph" />
                    <span class="inv-name">{def.name}</span>
                  </button>
                  {shop && (
                    <SellButton
                      price={rules.sellPrice(s, 'supplies', i)}
                      name={def.name}
                      onSell={() => sell('supplies', i)}
                    />
                  )}
                </span>
              );
            })}
            <Empty n={slots.supplies - s.supplies.length} />
          </div>
        </div>
      )}
      {rows.blueprints && (
        <div class={`inv-row blueprints ${s.blueprints.length === 0 ? 'is-empty' : ''}`}>
          <h3 class="inv-label">
            <Tip term="blueprints">Blueprints</Tip>
            <span class="inv-count">
              {s.blueprints.length}/{slots.blueprints}
            </span>
          </h3>
          <div class="inv-slots">
            {s.blueprints.map((b, i) => {
              const def = CONTENT.blueprints[b.id];
              return (
                <span key={`b-${b.id}`} class="inv-item">
                  <button
                    type="button"
                    class={`inv-slot slot-blueprint rarity-${def.rarity}`}
                    onMouseDown={noFocus}
                    onMouseEnter={() => hover('blueprint', i)}
                    onClick={() => hover('blueprint', i)}
                    title={`${def.name}: always on`}
                  >
                    <span class="inv-name">{def.name}</span>
                  </button>
                  {shop && (
                    <SellButton
                      price={rules.sellPrice(s, 'blueprints', i)}
                      name={def.name}
                      onSell={() => sell('blueprints', i)}
                    />
                  )}
                </span>
              );
            })}
            <Empty n={slots.blueprints - s.blueprints.length} />
          </div>
        </div>
      )}
      {rows.upgrades && (
        <div class="inv-row">
          <h3 class="inv-label">Company</h3>
          <div class="inv-slots">
            {s.upgrades.map((id, i) => (
              <span
                key={id}
                class="inv-slot slot-upgrade"
                onMouseEnter={() => hover('upgrade', i)}
                title={CONTENT.upgrades[id].name}
              >
                <span class="inv-name">{CONTENT.upgrades[id].name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {rows.freePlay && (
        <p class="free-play" role="status">
          Weekend Crew is here: your next build doesn’t end the week.
        </p>
      )}
    </Panel>
  );
}
