// Weather for a change order (S06, D-180): decoration only, never the rules and never a click.
// - Rain falls on the lot while Rainy season runs: two sheets of our own streaks, the far one
//   fainter and slower, each stepping a whole art px or two at a time down and to the left. It
//   keeps to the lot and out of the house's rooms (it doesn't rain indoors), over the tree tops
//   and the lot's life, under the highlights, the labels and the ghost. It fades in once the
//   change order's sheet has closed and out as the phase's milestone lands: the run as the top
//   bar shows it (the director's shownRun while an action plays) says when.
// - A puddle lies on each Patio the rain zeroes, as the rules' own breakdown line says, on the
//   paving where the fewest of the Patio's props stand, under them. Now and then a drop lands in
//   it. It's a layer over the piece's cells, not a filter on the piece (D-100), so the painters
//   the ghost, the cards, the photos and the street share never draw it.
// It's CSS animation, transform and opacity only, held still under a sheet over the board as the
// lot's life is (weather.css). With Reduce motion there's no rain, and the puddles lie still:
// they say which Patios the rain zeroed. Which order, which pieces and where: weather.ts.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { HouseState, Lot } from '../../rules/index.ts';
import { drawingPixels } from '../art/drawings.ts';
import { paintYardPiece, type AtlasPixels } from '../art/house-paint.ts';
import type { YardModel } from '../art/yard.ts';
import { shownRun, tallyView } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { settings } from '../settings.ts';
import { CELL } from '../sprites.ts';
import { currentTally, run } from '../store.ts';
import { isIndoor, occupancy, uidAt } from './geometry.ts';
import type { HouseModel } from './house-model.ts';
import { atlasPixels, drawingUrl } from './HouseLayers.tsx';
import {
  PUDDLE,
  puddleBeat,
  puddleSpot,
  rainClip,
  rainTile,
  SHEETS,
  weatherOf,
  zeroedBy,
  type SheetId,
  type Weather,
} from './weather.ts';
import './weather.css';

/** A puddle: the piece it lies on, and its top-left in lot art px. */
interface Puddle {
  readonly uid: number;
  readonly x: number;
  readonly y: number;
}

/** What the layer shows: the look, and the puddles. */
interface Shown {
  readonly look: Weather;
  readonly puddles: readonly Puddle[];
}

const NO_PUDDLES: readonly Puddle[] = [];

/**
 * A puddle on each of `uids` that's a yard piece (an indoor one gets none), where its props, as
 * the painters stand them (its ground left out), and the doors' mats leave the most paving.
 */
function puddlesOn(
  uids: readonly number[],
  yard: YardModel,
  model: HouseModel,
  atlas: AtlasPixels,
): Puddle[] {
  const size = drawingPixels(PUDDLE);
  const mats = model.exits.map((e) => e.mat);
  const out: Puddle[] = [];
  for (const uid of uids) {
    const l = yard.pieces.get(uid);
    if (!l) continue;
    const props = paintYardPiece({ ...l, ground: [] }, atlas);
    const covered = (x: number, y: number) => {
      const i = x - props.x;
      const j = y - props.y;
      if (i >= 0 && j >= 0 && i < props.w && j < props.h) {
        if (props.data[(j * props.w + i) * 4 + 3]! > 0) return true;
      }
      return mats.some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h);
    };
    const at = puddleSpot(l.cells, size, covered);
    if (at) out.push({ uid, ...at });
  }
  return out;
}

const tiles = new Map<string, string>();

/** A sheet's tile (weather.ts rainTile) as an image, made once. */
function tileUrl(id: SheetId, across: number, down: number): string {
  const key = `${id}:${across}x${down}`;
  let url = tiles.get(key);
  if (!url) {
    const t = rainTile(id, across, down);
    const c = document.createElement('canvas');
    c.width = t.w;
    c.height = t.h;
    const data = new Uint8ClampedArray(t.data);
    c.getContext('2d')!.putImageData(new ImageData(data, t.w, t.h), 0, 0);
    url = c.toDataURL();
    tiles.set(key, url);
  }
  return url;
}

/**
 * A sheet of streaks over the lot, its tile repeated, one tile taller and wider than the lot so
 * the lot stays covered as it steps a tile down and to the left, and round again.
 */
function Sheet({ id, lot, scale }: { id: SheetId; lot: Lot; scale: number }) {
  const { w, h, step } = SHEETS[id];
  const f = FEEL.weather.rain[id];
  const steps = w / step;
  const tw = w * scale;
  const th = h * scale;
  return (
    <div
      class={`rain-sheet rain-${id}`}
      style={{
        top: `${-th}px`,
        width: `${lot.width * CELL * scale + tw}px`,
        height: `${lot.height * CELL * scale + th}px`,
        backgroundImage: `url(${tileUrl(id, f.across, f.down)})`,
        backgroundSize: `${tw}px ${th}px`,
        animationDuration: `${steps * f.stepMs}ms`,
        animationTimingFunction: `steps(${steps})`,
        '--rain-x': `${-tw}px`,
        '--rain-y': `${th}px`,
      }}
    />
  );
}

/** The rain: the lot less the house's rooms, the far sheet under the near one. */
function Rain({ house, scale, leaving }: { house: HouseState; scale: number; leaving: boolean }) {
  const { lot } = house;
  const px = CELL * scale;
  const clip = useMemo(() => {
    const occ = occupancy(house);
    const dry = (x: number, y: number) => {
      const p = occ.byUid.get(uidAt(occ, x, y));
      return !!p && isIndoor(p.defId);
    };
    return rainClip(lot.width, lot.height, dry, px);
  }, [house, px]);
  const f = FEEL.weather.rain;
  return (
    <div
      class={`weather${leaving ? ' leaving' : ''}`}
      aria-hidden="true"
      style={{
        width: `${lot.width * px}px`,
        height: `${lot.height * px}px`,
        clipPath: clip,
        '--weather-in': `${f.inMs}ms`,
        '--weather-out': `${f.outMs}ms`,
      }}
    >
      {(['far', 'near'] as const).map((id) => (
        <Sheet key={id} id={id} lot={lot} scale={scale} />
      ))}
    </div>
  );
}

/** The puddles, each in its own beat of drops landing (a strip of frames stepping left). */
function Puddles({
  puddles,
  lot,
  scale,
  leaving,
}: {
  puddles: readonly Puddle[];
  lot: Lot;
  scale: number;
  leaving: boolean;
}) {
  const d = drawingPixels(PUDDLE);
  const url = drawingUrl(PUDDLE);
  const f = FEEL.weather.puddle;
  const strip = d.w * d.frames * scale;
  return (
    <div
      class={`puddles${leaving ? ' leaving' : ''}`}
      aria-hidden="true"
      style={{
        width: `${lot.width * CELL * scale}px`,
        height: `${lot.height * CELL * scale}px`,
        '--puddle-in': `${f.inMs}ms`,
        '--weather-out': `${FEEL.weather.rain.outMs}ms`,
      }}
    >
      {puddles.map((p) => (
        <div
          key={p.uid}
          class="puddle"
          style={{
            left: `${p.x * scale}px`,
            top: `${p.y * scale}px`,
            width: `${d.w * scale}px`,
            height: `${d.h * scale}px`,
          }}
        >
          <div
            class="puddle-frames"
            style={{
              width: `${strip}px`,
              height: `${d.h * scale}px`,
              backgroundImage: `url(${url})`,
              backgroundSize: `${strip}px ${d.h * scale}px`,
              animationDuration: `${d.frames * f.frameMs}ms`,
              animationTimingFunction: `steps(${d.frames})`,
              animationDelay: `${-puddleBeat(p.uid, d.frames) * f.frameMs}ms`,
              '--puddle-frames': `${-strip}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The lot's weather: on while the run as shown has a running order with a look (weather.ts
 * weatherOf), and for its fade once it stops, as it last was.
 */
function LotWeather({
  house,
  model,
  yard,
  scale,
}: {
  house: HouseState;
  model: HouseModel;
  yard: YardModel;
  scale: number;
}) {
  // The run as the top bar shows it: an order picked starts once its sheet's stamp has gone,
  // and one that ran through a phase stops as that phase's milestone lands.
  const playing = shownRun.value;
  const weather = weatherOf(playing ?? run.value);
  // The Patios it zeroes: as the tally playing scores them (a Patio just placed among them), or
  // as the house stands. Between an action's other beats the rules have moved on (past the
  // milestone, even), so they stay as they were until it has played.
  const held = useRef<readonly number[]>([]);
  const view = tallyView.value;
  const zeroed = !weather
    ? []
    : view
      ? zeroedBy(view.pieces, weather.order)
      : playing
        ? held.current
        : zeroedBy(currentTally.value.pieces, weather.order);
  held.current = zeroed;
  const key = zeroed.join(',');
  const [atlas, setAtlas] = useState<AtlasPixels | null>(null);
  useEffect(() => {
    let live = true;
    atlasPixels()
      .then((a) => live && setAtlas(a))
      .catch((e) => console.error(e));
    return () => {
      live = false;
    };
  }, []);
  const puddles = useMemo(
    () => (atlas && zeroed.length > 0 ? puddlesOn(zeroed, yard, model, atlas) : NO_PUDDLES),
    [key, yard, model, atlas],
  );
  const now: Shown | null = weather ? { look: weather.look, puddles } : null;
  const reduce = settings.value.reduceMotion;
  // Stopped: it fades out as it last was (gone at once with Reduce motion). The render it stops
  // in shows it so already, so it never blinks off before its fade.
  const last = useRef<Shown | null>(null);
  const [leaving, setLeaving] = useState<Shown | null>(null);
  const fading = now || reduce ? null : (leaving ?? last.current);
  if (now) last.current = now;
  useEffect(() => {
    if (weather) {
      setLeaving(null);
      return;
    }
    const was = last.current;
    last.current = null;
    if (!was || reduce) return;
    setLeaving(was);
    const t = window.setTimeout(() => setLeaving(null), FEEL.weather.rain.outMs);
    return () => window.clearTimeout(t);
  }, [weather?.look ?? null]);
  const shown = now ?? fading;
  if (!shown) return null;
  return (
    <>
      <Puddles puddles={shown.puddles} lot={house.lot} scale={scale} leaving={!now} />
      {shown.look === 'rain' && !reduce && <Rain house={house} scale={scale} leaving={!now} />}
    </>
  );
}

/**
 * A change order's weather on the lot: rain while Rainy season runs, and a puddle on each Patio it
 * zeroes. A new run, or one loaded, starts clear.
 */
export function WeatherLayer({
  run: setup,
  house,
  model,
  yard,
  scale,
}: {
  /** The run's setup: a new run never fades out the last one's rain. */
  run: object;
  house: HouseState;
  model: HouseModel;
  yard: YardModel;
  scale: number;
}) {
  const runs = useRef<{ run: object | null; n: number }>({ run: null, n: 0 });
  if (runs.current.run !== setup) runs.current = { run: setup, n: runs.current.n + 1 };
  return <LotWeather key={runs.current.n} house={house} model={model} yard={yard} scale={scale} />;
}
