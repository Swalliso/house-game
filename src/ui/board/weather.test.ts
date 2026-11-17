// Weather for a change order (D-180): which order has which look and for how long, which pieces
// get a puddle (the rules' own line says which the rain zeroed) and where it lies, the rain's
// tiles and its outline over the lot, and that all of it holds still under a sheet over the board.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  rules,
  type Cell,
  type ChangeOrderId,
  type RunState,
  type TimedEffect,
} from '../../rules/index.ts';
import { emptyRows, houseFrom } from '../../rules/testing.ts';
import { drawingPixels } from '../art/drawings.ts';
import { FEEL } from '../fx/feel.ts';
import { CELL } from '../sprites.ts';
import {
  ORDER_WEATHER,
  PUDDLE,
  puddleBeat,
  puddleSpot,
  rainClip,
  rainStreaks,
  rainTile,
  SHEETS,
  weatherOf,
  zeroedBy,
  type SheetId,
} from './weather.ts';

const SETUP = {
  seed: 'rain-check',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
} as const;

/** A change order's phase effect, as the rules add it when it's picked. */
function phaseEffect(id: ChangeOrderId, phase = 0): TimedEffect {
  const def = CONTENT.changeOrders[id];
  return { source: id, until: { phase }, modifiers: def.kind === 'phase' ? def.modifiers : [] };
}

describe('which change order has a look', () => {
  it('rains for Rainy season, and no other order has a look yet', () => {
    for (const id of Object.keys(CONTENT.changeOrders) as ChangeOrderId[]) {
      expect(ORDER_WEATHER[id], id).toBe(id === 'rainySeason' ? 'rain' : undefined);
    }
  });

  it('rains while its effect runs, and not for another order’s or a tool’s week', () => {
    const at = (timedEffects: readonly TimedEffect[], screen: RunState['screen'] = 'build') =>
      weatherOf({ screen, timedEffects });
    expect(at([phaseEffect('rainySeason')])).toEqual({ look: 'rain', order: 'rainySeason' });
    expect(at([phaseEffect('heatWave'), phaseEffect('rainySeason')])?.look).toBe('rain');
    expect(at([phaseEffect('heatWave')])).toBeNull();
    expect(at([])).toBeNull();
    // A tool's effect lasts one week's tally, whatever its source says.
    expect(at([{ source: 'rainySeason', until: { week: 3 }, modifiers: [] }])).toBeNull();
    // In the shop between milestones it's still on (under the shop's sheet).
    expect(at([phaseEffect('rainySeason')], 'shop')?.look).toBe('rain');
  });

  it('stops once the run is over, won or lost, though a lost run keeps its effects', () => {
    expect(weatherOf({ screen: 'lost', timedEffects: [phaseEffect('rainySeason')] })).toBeNull();
    expect(weatherOf({ screen: 'won', timedEffects: [phaseEffect('rainySeason')] })).toBeNull();
  });

  it('starts when the order is picked and stops when its phase’s milestone is met', () => {
    let s = rules.newRun(SETUP);
    const act = (a: Parameters<typeof rules.apply>[1]) => (s = rules.apply(s, a).state);
    act({ t: 'debug', op: 'forceChangeOrder', id: 'rainySeason' });
    expect(weatherOf(s)).toBeNull();
    act({ t: 'answerChangeOrder', i: 0 });
    expect(weatherOf(s)?.look).toBe('rain');
    act({ t: 'debug', op: 'addScore', amount: rules.target(s) });
    const phase = s.phase;
    while (s.phase === phase && s.screen === 'build') {
      expect(weatherOf(s)?.look).toBe('rain');
      act({ t: 'pass' });
    }
    expect(s.milestones.at(-1)?.result).not.toBe('failed');
    expect(weatherOf(s)).toBeNull();
  });
});

describe('the puddles', () => {
  // A Bedroom with a Patio against its south wall, and a Patio off on its own.
  const house = houseFrom(CONTENT, emptyRows(12, 12), [
    ['bedroom', 2, 2],
    ['patio', 2, 4],
    ['patio', 8, 8],
  ]);
  const [, beside, alone] = house.pieces;
  const tallied = (timedEffects: readonly TimedEffect[]) =>
    rules.currentTally({ ...rules.newRun(SETUP), house, timedEffects }).pieces;

  it('go on the Patios the rain zeroes, by the rules’ own line for it', () => {
    expect(zeroedBy(tallied([phaseEffect('rainySeason')]), 'rainySeason')).toEqual([beside!.uid]);
  });

  it('skip a Patio that earns nothing for another reason, and every Patio in dry weather', () => {
    // The lone Patio touches no room: it earns nothing anyway, and its line says why.
    const pieces = tallied([phaseEffect('rainySeason')]);
    expect(pieces.find((p) => p.uid === alone!.uid)!.unmet).toBeDefined();
    expect(zeroedBy(tallied([]), 'rainySeason')).toEqual([]);
    expect(zeroedBy(tallied([phaseEffect('heatWave')]), 'heatWave')).toEqual([]);
  });

  const size = drawingPixels(PUDDLE);
  const patio: Cell[] = [
    { x: 4, y: 6 },
    { x: 5, y: 6 },
    { x: 4, y: 7 },
    { x: 5, y: 7 },
  ];
  const [left, top] = [4 * CELL, 6 * CELL];
  /** Every pixel of a puddle at `at` and its clear margin. */
  const under = (at: { x: number; y: number }) =>
    Array.from({ length: (size.w + 2) * (size.h + 2) }, (_, k) => ({
      x: at.x - 1 + (k % (size.w + 2)),
      y: at.y - 1 + Math.floor(k / (size.w + 2)),
    }));

  it('lie on the paving where nothing stands, inside the Patio', () => {
    // The seats and the parasol along the front, as a Patio with a door at its back has them,
    // or along the back, as one with a door at its front does.
    const front = (x: number, y: number) => y >= top + 30 && y < top + 62;
    const back = (x: number, y: number) => y >= top - 8 && y < top + 24;
    for (const covered of [front, back]) {
      const at = puddleSpot(patio, size, covered)!;
      for (const p of under(at)) expect(covered(p.x, p.y), `${p.x},${p.y}`).toBe(false);
      expect(at.x).toBeGreaterThanOrEqual(left + 2);
      expect(at.y).toBeGreaterThanOrEqual(top + 2);
      expect(at.x + size.w).toBeLessThanOrEqual(left + 2 * CELL - 2);
      expect(at.y + size.h).toBeLessThanOrEqual(top + 2 * CELL - 2);
    }
  });

  it('lie in the middle of a bare Patio, and on the least covered spot of a crowded one', () => {
    const bare = puddleSpot(patio, size, () => false)!;
    expect(Math.abs(bare.x + size.w / 2 - (left + CELL))).toBeLessThanOrEqual(1);
    expect(Math.abs(bare.y + size.h / 2 - (top + CELL))).toBeLessThanOrEqual(1);
    // Covered everywhere but a strip down its left side: the puddle takes the strip.
    const crowded = puddleSpot(patio, size, (x) => x >= left + 26)!;
    expect(crowded.x).toBe(left + 2);
    expect(puddleSpot(patio, size, () => true)).not.toBeNull();
    expect(puddleSpot([], size, () => false)).toBeNull();
  });

  it('keep to an L-shaped piece’s own cells', () => {
    const ell: Cell[] = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    // Nothing stands anywhere: the middle of its box is off the piece, so it goes elsewhere.
    const at = puddleSpot(ell, size, () => false)!;
    const cells = new Set(ell.map((c) => `${c.x},${c.y}`));
    for (const p of under(at)) {
      expect(cells.has(`${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`)).toBe(true);
    }
  });

  it('each ripple on a beat of their own, the same every time', () => {
    const { frames } = drawingPixels(PUDDLE);
    const beats = Array.from({ length: 12 }, (_, uid) => puddleBeat(uid + 1, frames));
    for (const b of beats) expect(b >= 0 && b < frames).toBe(true);
    expect(new Set(beats).size).toBeGreaterThan(3);
    expect(puddleBeat(7, frames)).toBe(puddleBeat(7, frames));
  });
});

describe('the rain', () => {
  const sheets = Object.keys(SHEETS) as SheetId[];

  it('comes round to where it began: a tile a step at a time, along its streaks', () => {
    for (const id of sheets) {
      const { w, h, step, sprite } = SHEETS[id];
      expect(h).toBe(3 * w);
      expect(w % step).toBe(0);
      // The streak falls three rows for each column it moves left, as the sheet does.
      const d = drawingPixels(sprite);
      expect(d.h).toBe(3 * d.w);
    }
  });

  it('spreads its streaks over each tile, inside it, the same every time', () => {
    for (const id of sheets) {
      const { across, down } = FEEL.weather.rain[id];
      const { w, h, sprite } = SHEETS[id];
      const d = drawingPixels(sprite);
      const streaks = rainStreaks(id, across, down);
      expect(streaks).toEqual(rainStreaks(id, across, down));
      expect(streaks).toHaveLength(across * down);
      const parts = new Set<string>();
      for (const s of streaks) {
        expect(s.x >= 0 && s.y >= 0 && s.x + d.w <= w && s.y + d.h <= h).toBe(true);
        parts.add(`${Math.floor(s.x / (w / across))},${Math.floor(s.y / (h / down))}`);
      }
      // One in each part of the tile's grid.
      expect(parts.size).toBe(across * down);
    }
  });

  it('paints its tile with the streaks and nothing else', () => {
    for (const id of sheets) {
      const { across, down } = FEEL.weather.rain[id];
      const d = drawingPixels(SHEETS[id].sprite);
      const opaque = (data: Uint8ClampedArray) =>
        data.filter((_, i) => i % 4 === 3 && data[i]! > 0);
      const t = rainTile(id, across, down);
      expect(t.data).toHaveLength(SHEETS[id].w * SHEETS[id].h * 4);
      expect(opaque(t.data).length).toBe(across * down * opaque(d.data).length);
    }
  });

  it('keeps to the lot and out of the house’s rooms', () => {
    // A 4 × 3 lot with rooms on (1, 0) to (2, 0) and (2, 1).
    const dry = (x: number, y: number) => (y === 0 && (x === 1 || x === 2)) || (y === 1 && x === 2);
    expect(rainClip(4, 3, dry, 32)).toBe(
      "path(evenodd, 'M0 0H128V96H0ZM32 0H96V32H32ZM64 32H96V64H64Z')",
    );
    expect(rainClip(2, 2, () => false, 16)).toBe("path(evenodd, 'M0 0H32V32H0Z')");
  });
});

describe('holding still', () => {
  const css = readFileSync(join(import.meta.dirname, 'weather.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );

  /** The stylesheet's top-level rules, its @keyframes left out. */
  function rulesOf(text: string): { selectors: string[]; body: string }[] {
    const out: { selectors: string[]; body: string }[] = [];
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const prelude = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      for (; j < text.length && depth > 0; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
      }
      if (!prelude.startsWith('@')) {
        out.push({ selectors: prelude.split(',').map((s) => s.trim()), body: text.slice(open, j) });
      }
      i = j;
    }
    return out;
  }

  /** The first class of a selector's last compound: the element it styles. */
  const subject = (selector: string) => /\.([\w-]+)[^\s>]*$/.exec(selector)?.[1];

  it('pauses every animation in the weather under a sheet over the board', () => {
    const all = rulesOf(css);
    const animated = all
      .filter((r) => /animation(-name)?\s*:/.test(r.body) && !/animation:\s*none/.test(r.body))
      .flatMap((r) => r.selectors.map(subject));
    const paused = all
      .filter((r) => /animation-play-state:\s*paused/.test(r.body))
      .flatMap((r) => r.selectors.filter((s) => s.startsWith('.board.covered')).map(subject));
    expect(animated).toEqual(expect.arrayContaining(['weather', 'rain-sheet', 'puddle']));
    for (const name of animated) expect(paused, name).toContain(name);
  });

  it('holds a puddle still, in its first frame, with Reduce motion', () => {
    const still = rulesOf(css)
      .filter((r) => /animation:\s*none/.test(r.body))
      .flatMap((r) => r.selectors.filter((s) => s.startsWith('.reduce-motion')).map(subject));
    expect(still).toEqual(expect.arrayContaining(['puddle', 'puddle-frames']));
  });
});
