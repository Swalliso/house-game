// The company's goods (M3a HUD): the reserve (bought pieces, placed free: D-163), the
// supplies (fixtures, installed for free), and the blueprint slots (always on). Hover shows an
// item in the inspect panel, with Sell for blueprints and supplies; on the build screen a
// click picks a reserve piece or a supply to place or install. A crew's starting cards and a
// household member's (M4b), and what the client brought and the standing stock (D-160), sit in
// extra slots after the reserve's own, tagged with where they came from ("Crew", "Twins",
// "Dale", "Stock"), and don't count against it; a member's pop in as they arrive, and the
// stock's as it tops up.
//
// M5a: a wood panel with a row per kind of good. Empty slots are recessed wells, and a row
// stays hidden until it matters: until the supply yard first opens, an empty row says nothing
// (inventory-rows.ts). A name too long for its slot ends in an ellipsis, and shows whole on
// hover and in the inspect panel.
//
// D-121: while building, it folds to its plank, with a count of what's waiting in the reserve
// and the supplies, so the hand's two rows fit beside it: on a window under 1100 px tall (a
// 1080p screen's included), or when the player folds it (the caret). A click on the plank
// opens it again. In the shop it's always open.
//
// D-157: the types struck this run, once there are some: a Struck row in the open panel and the
// shop, and folded, a count on the plank, named in its tip and the fold button's. A strike
// brings the panel in only with the next week's hand (inventory-rows.ts).

import { signal } from '@preact/signals';
import {
  CONTENT,
  inExtraSlot,
  rules,
  struckNames,
  struckText,
  type ReservePiece,
} from '../../rules/index.ts';
import { justArrived, justDelivered } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { Button, Icon, Panel, Well } from '../kit/kit.tsx';
import { BLUEPRINT_ICONS, supplyIcon } from '../sprites.ts';
import {
  inspected,
  reserveFit,
  run,
  selected,
  sell,
  struckAtDeal,
  suppliesFit,
  tool,
} from '../store.ts';
import { isSelected, selectCard } from './actions.ts';
import { extraSlotWords } from './household.ts';
import { foldCounts, foldedEmpty, inventoryRows, showsInventory } from './inventory-rows.ts';
import { Tip } from './Tip.tsx';
import './inventory.css';

const noFocus = (e: MouseEvent) => e.preventDefault();

/** The player's pick, folded or open (UI only); null follows the window's height. */
export const goodsFolded = signal<boolean | null>(null);
const shortQuery =
  typeof window === 'undefined' || !window.matchMedia
    ? null
    : window.matchMedia('(max-height: 1099px)');
const shortWindow = signal(shortQuery?.matches ?? false);
shortQuery?.addEventListener('change', (e) => (shortWindow.value = e.matches));

function FreePlayNote() {
  return (
    <p class="free-play" role="status">
      Weekend Crew is here: your next card doesn’t end the week.
    </p>
  );
}

/** Whether Your goods is folded to its plank (D-121): never in the shop. */
export function isFolded(shop: boolean): boolean {
  return !shop && (goodsFolded.value ?? shortWindow.value);
}

/**
 * The folded plank's counts: what's waiting to be used in the reserve and the supplies, and how
 * many types are struck this run (D-157), each named in its tip (inventory-rows.ts).
 */
function FoldCounts() {
  return (
    <span class="inv-fold-counts">
      {foldCounts(run.value).map(([icon, n, title]) => (
        <span key={icon} class="inv-fold-count" data-tip={title} role="img" aria-label={title}>
          <Icon name={icon} />
          {n}
        </span>
      ))}
    </span>
  );
}

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
  if (selected.value === null && tool.value === 'build') inspected.value = { kind, i };
}

/**
 * How a reserve card pops in (inventory.css' slot-arrive), or null: a member's cards after the
 * doorbell (FEEL.arrival), and the stock's or the client's at once as they land (FEEL.delivered;
 * D-160), only the cards that just came.
 */
function popOf(r: ReservePiece, i: number): { ms: number; delayMs: number; scale: number } | null {
  const member = justArrived.value;
  if (member && r.arrival === member.arrival) {
    const f = FEEL.arrival;
    return { ms: f.popMs, delayMs: f.landDelayMs, scale: f.popScale };
  }
  const came = justDelivered.value;
  if (came?.slots.includes(i)) {
    const f = FEEL.delivered;
    return { ms: f.popMs, delayMs: came.delayMs, scale: f.popScale };
  }
  return null;
}

/**
 * A reserve card's slot: its name, and an extra slot's tag ("Crew", "Twins", "Dale", "Stock")
 * with where it came from in its tip (household.ts extraSlotWords). A card that just came pops
 * in (popOf).
 */
function ReserveSlot({ r, i, building }: { r: ReservePiece; i: number; building: boolean }) {
  const s = run.value;
  const def = CONTENT.pieces[r.id];
  const fits = reserveFit.value[i] ?? true;
  const extra = extraSlotWords(s.setup.clientId, r);
  const pop = popOf(r, i);
  const whose = extra?.whose ?? '';
  const classes = [
    'inv-slot',
    'slot-piece',
    def.category,
    inExtraSlot(r) ? 'slot-extra' : '',
    pop ? 'just-arrived' : '',
    isSelected('reserve', i) ? 'selected' : '',
    building && !fits ? 'no-fit' : '',
  ];
  return (
    <button
      type="button"
      class={classes.filter(Boolean).join(' ')}
      style={
        pop
          ? {
              animationDuration: `${pop.ms}ms`,
              animationDelay: `${pop.delayMs}ms`,
              '--pop-scale': `${pop.scale}`,
            }
          : undefined
      }
      onMouseDown={noFocus}
      onMouseEnter={() => hover('reserve', i)}
      onClick={() => (building ? selectCard(i, 'reserve') : hover('reserve', i))}
      aria-pressed={isSelected('reserve', i)}
      data-tip={
        building
          ? fits
            ? `${def.name}${whose}: placing it doesn’t use your week`
            : `${def.name}${whose}: nowhere on the lot fits it right now`
          : `${def.name}${whose}`
      }
    >
      <span class="inv-name">{def.name}</span>
      {extra && <span class="inv-tag">{extra.tag}</span>}
    </button>
  );
}

function SellButton({ price, name, onSell }: { price: number; name: string; onSell: () => void }) {
  return (
    <Button
      size="sm"
      class="inv-sell"
      onMouseDown={noFocus}
      onClick={onSell}
      tip={`Sell ${name} for ${price} budget`}
    >
      Sell {price}
    </Button>
  );
}

export function Inventory({ shop = false }: { shop?: boolean }) {
  const s = run.value;
  const slots = rules.slots(s);
  const building = s.screen === 'build';
  // The reserve's own slots first, then the extra ones, which don't count against it (M4b).
  const indexed = s.reserve.map((r, i) => ({ r, i }));
  const own = indexed.filter(({ r }) => !inExtraSlot(r));
  const extra = indexed.filter(({ r }) => inExtraSlot(r));
  const rows = inventoryRows(s, shop, struckAtDeal.value);
  if (!showsInventory(rows)) return null;
  const folded = isFolded(shop);
  const struck = struckText(CONTENT, s.struck);
  const title = shop ? (
    'Your goods'
  ) : (
    <button
      type="button"
      class="inv-fold"
      onMouseDown={noFocus}
      onClick={() => (goodsFolded.value = !folded)}
      aria-expanded={!folded}
      data-tip={
        folded
          ? `Show your goods${struck ? ` (${struck})` : ''}`
          : 'Fold your goods away, so the hand has more room'
      }
    >
      <Icon name={folded ? 'caretRight' : 'caretDown'} />
      <span class="inv-fold-long">Your goods</span>
      <span class="inv-fold-short">Goods</span>
    </button>
  );
  if (folded) {
    // On a short window a folded panel with nothing to use goes, as the empty rows do; never
    // with something struck, whose count is on its plank (D-157).
    const empty = foldedEmpty(s, rows);
    return (
      <Panel
        class={`inventory is-folded ${empty ? 'is-empty' : ''}`}
        title={title}
        head={<FoldCounts />}
        label="Your company’s goods, folded"
      >
        {/* Weekend Crew's note stays in view: it's about this week's card. */}
        {rows.freePlay && <FreePlayNote />}
      </Panel>
    );
  }
  return (
    <Panel class={`inventory ${shop ? 'in-shop' : ''}`} title={title} label="Your company’s goods">
      {rows.reserve && (
        <div class={`inv-row reserve ${s.reserve.length === 0 ? 'is-empty' : ''}`}>
          <h3 class="inv-label">
            <Tip term="reserve">Reserve</Tip>
            <span class="inv-count">
              {own.length}/{slots.reserve}
            </span>
          </h3>
          <div class="inv-slots">
            {own.map(({ r, i }) => (
              <ReserveSlot key={`r-${i}-${r.id}`} r={r} i={i} building={building} />
            ))}
            <Empty n={slots.reserve - own.length} />
            {extra.map(({ r, i }) => (
              <ReserveSlot key={`r-${i}-${r.id}`} r={r} i={i} building={building} />
            ))}
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
                    data-tip={
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
                    data-tip={`${def.name}: always on`}
                  >
                    <Icon name={BLUEPRINT_ICONS[b.id]} class="inv-glyph" />
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
                data-tip={CONTENT.upgrades[id].name}
              >
                <span class="inv-name">{CONTENT.upgrades[id].name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {/* D-157: the types struck this run, in the order struck. */}
      {rows.struck && (
        <div class="inv-row struck">
          <h3 class="inv-label">
            <Tip term="strike">Struck</Tip>
          </h3>
          <p class="inv-struck">{struckNames(CONTENT, s.struck).join(', ')}</p>
        </div>
      )}
      {rows.freePlay && <FreePlayNote />}
    </Panel>
  );
}
