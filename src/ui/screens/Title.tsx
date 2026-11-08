// The title screen (implementation-plan.md §7, M2): the name, a one-line pitch, and Continue,
// Start, How to play, and Settings, over a little street drawn from the sprite atlas.
//
// M5a: it's the first thing a friend opening a shared link sees, so it's a scene. A banded
// pixel sky with our own sun and clouds; LimeZu's villas and trees on a lawn behind the street
// (Modern Exteriors cuts, art/limezu/ui.json); a car driving by (parked with Reduce motion);
// and the menu as an "Open House" real-estate sign on a post, its buttons hanging below it
// like the sign's riders. Everything in the scene is drawn at the street's whole-pixel scale.
//
// M4: Start opens the job board (D-032, D-045), which stands on the same scene (TitleBackdrop).

import './title.css';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { rules, SCORE_LABELS } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { blobTile, E, S, SE, SUB, SUBTILE, SW, W } from '../board/autotile.ts';
import { streetScale } from '../board/geometry.ts';
import { drawSprite } from '../board/terrain/atlas.ts';
import { grassSprite } from '../board/terrain/grass.ts';
import {
  paintStreet,
  pavingTile,
  streetRows,
  type StreetRow,
  type StreetTile,
} from '../board/terrain/street.ts';
import { FEEL } from '../fx/feel.ts';
import { formatNumber } from '../format.ts';
import { howToPlayOpen, settingsOpen } from '../hud/actions.ts';
import { Button } from '../kit/kit.tsx';
import { settings } from '../settings.ts';
import { atlasImage, CELL, spritePos, spriteStyle, type SpriteId } from '../sprites.ts';
import { SCENERY_SIZES, type SceneryName } from '../theme/art.ts';
import { canContinue, continueRun, openJobBoard, run } from '../store.ts';

/** What the save holds, for the Continue button: "Framing, week 10 · 1,240 Wow". */
function savedRunLine(): string {
  const s = run.value;
  return `${rules.phaseName(s.phase)}, week ${s.week} · ${formatNumber(s.score)} ${SCORE_LABELS.total}`;
}

export function Title() {
  const saved = canContinue.value;
  const menu = useRef<HTMLElement>(null);

  // The primary button (the first rider) takes focus, so Enter starts (or continues) right away.
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('.title-main')?.focus({ preventScroll: true });
  }, [saved]);

  const onContinue = () => {
    audio.unlock();
    continueRun();
  };
  const onStart = () => {
    audio.unlock();
    if (saved && !window.confirm('Start a new run? The run in progress will be lost.')) return;
    openJobBoard();
  };

  return (
    <TitleBackdrop>
      <main class="title-stage">
        <div class="sign">
          <span class="sign-post" aria-hidden="true" />
          <span class="sign-arm" aria-hidden="true" />
          <div class="sign-board">
            <h1 class="title-name">Open House</h1>
            <p class="title-pitch">Build one house for one client, one piece a week.</p>
          </div>
          <nav class="sign-riders" aria-label="Main menu" ref={menu}>
            {saved && (
              <div class="rider">
                <Button variant="primary" size="lg" class="title-main" onClick={onContinue}>
                  <span class="title-main-text">
                    Continue
                    <span class="title-detail">{savedRunLine()}</span>
                  </span>
                </Button>
              </div>
            )}
            <div class="rider">
              <Button
                variant={saved ? 'wood' : 'primary'}
                size="lg"
                class={saved ? 'title-new' : 'title-main'}
                onClick={onStart}
              >
                {saved ? 'New run' : 'Start'}
              </Button>
            </div>
            <div class="rider rider-pair">
              <Button variant="wood" icon="help" onClick={() => (howToPlayOpen.value = true)}>
                How to play
              </Button>
              <Button variant="wood" icon="gear" onClick={() => (settingsOpen.value = true)}>
                Settings
              </Button>
            </div>
          </nav>
        </div>
      </main>
      <footer class="title-footer">
        <span class="title-credit">
          A game jam entry · theme: It's a house · art by{' '}
          <a href="https://limezu.itch.io/" target="_blank" rel="noreferrer">
            LimeZu
          </a>
        </span>
      </footer>
    </TitleBackdrop>
  );
}

/**
 * The title's scene, with what stands on it: the sky, the lawn and its houses, and the street
 * with its car, at the street's whole-pixel scale (--scene, --horizon and --plant). The job
 * board stands on it too (M4, JobBoard.tsx), so Start leads to the same street.
 */
export function TitleBackdrop({
  class: cls,
  children,
}: {
  class?: string;
  children?: ComponentChildren;
}) {
  const { w, h, dpr } = useViewport();
  const scale = streetScale(h, dpr);
  return (
    <div
      class={`title-screen ui ${cls ?? ''}`}
      style={{
        '--scene': `${scale}px`,
        '--horizon': `${(STREET_H + LAWN_ROWS * CELL) * scale}px`,
        '--plant': `${(STREET_H + PLANT) * scale}px`,
      }}
    >
      <Sky />
      <Scene w={w} scale={scale} />
      {children}
    </div>
  );
}

function useViewport(): { w: number; h: number; dpr: number } {
  const read = () => ({
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const onResize = () => setSize(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

// ---------------------------------------------------------------------------------------
// The sky: flat bands (title.css) with our own sun and clouds, at the scene's pixel size.

function SkyPiece({ name, class: cls }: { name: SceneryName; class: string }) {
  const { w, h } = SCENERY_SIZES[name];
  return (
    <span
      class={`sky-piece ${cls}`}
      style={{ '--w': String(w), '--h': String(h), '--art': `var(--art-scene-${name})` }}
    />
  );
}

function Sky() {
  return (
    <div class="title-sky" aria-hidden="true">
      <SkyPiece name="sun" class="sky-sun" />
      <SkyPiece name="cloud" class="sky-cloud-a" />
      <SkyPiece name="cloudSmall" class="sky-cloud-b" />
      <SkyPiece name="cloudSmall" class="sky-cloud-c" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// The scene along the bottom, one canvas like the board's terrain (so its tiles show no seams
// at 125% or 150% display scaling): a lawn behind the street with the houses and trees on it,
// then the front lawn with its shrubs and planters, and the street. The lawn and the street are
// the lot's own (board/terrain): its grass strewn with tufts and flowers by tile hash, and its
// sidewalk, curb, road and dashed line, so the first screen and the board look like one place.

/**
 * The street below the front lawn, in 16 px rows: the board's (the sidewalk and its curb, the
 * road with its dashed line, the far curb), then a row of far sidewalk the credit stands on.
 */
const PAVING: readonly StreetRow[] = [...streetRows(), 'sidewalk'];
/** The front lawn and the street, in art px. */
const STREET_H = CELL + PAVING.length * SUBTILE;
/** The lawn behind the street, where the houses stand. */
const LAWN_ROWS = 3;
/** How far into that lawn the sign's post is planted, in art px. */
const PLANT = 40;
/** Room above the lawn for the houses' roofs, in art px. */
const ROOFS = 128;

/** Something standing on the scene: at a fraction of the window's width, `y` art px in. */
interface Prop {
  readonly id: SpriteId;
  readonly at: number;
  readonly y: number;
}

/**
 * What stands on the back lawn, left to right, at a fraction of the window's width (so the
 * sign in the middle stays clear at any size): `y` is how far in front of the horizon its base
 * stands. Drawn back to front.
 */
const BACK: readonly Prop[] = [
  { id: 'title-tree', at: 0.03, y: 14 },
  { id: 'title-tree', at: 0.255, y: 10 },
  { id: 'title-tree', at: 0.39, y: 16 },
  { id: 'title-tree', at: 0.5, y: 10 },
  { id: 'title-tree', at: 0.745, y: 12 },
  { id: 'title-tree', at: 0.97, y: 16 },
  { id: 'title-villa', at: 0.14, y: LAWN_ROWS * CELL },
  { id: 'title-villa-blue', at: 0.86, y: LAWN_ROWS * CELL },
  { id: 'title-oak', at: 0.62, y: 84 },
];

/** The front lawn's shrubs and planters, clear of the villas' steps: `y` from the row's top. */
const FRONT: readonly Prop[] = [
  { id: 'planter-0', at: 0.06, y: 24 },
  { id: 'planter-3', at: 0.21, y: 24 },
  { id: 'title-shrub', at: 0.33, y: 27 },
  { id: 'title-shrub', at: 0.45, y: 26 },
  { id: 'title-shrub', at: 0.56, y: 27 },
  { id: 'title-shrub', at: 0.68, y: 26 },
  { id: 'planter-3', at: 0.775, y: 24 },
  { id: 'planter-0', at: 0.94, y: 24 },
];

function drawScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cols: number,
  viewW: number,
): void {
  const put = (id: SpriteId, x: number, y: number) => {
    const p = spritePos(id);
    ctx.drawImage(img, p.x, p.y, p.w, p.h, Math.round(x), Math.round(y), p.w, p.h);
  };
  /** A prop, standing on its base at `y`. */
  const stand = (prop: Prop, y: number) => {
    const p = spritePos(prop.id);
    put(prop.id, prop.at * viewW - p.w / 2, y + prop.y - p.h);
  };
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const horizon = ROOFS;
  // The front lawn's top, and the sidewalk's, in 16 px rows.
  const street = horizon + LAWN_ROWS * CELL;
  const top = (street + CELL) / SUBTILE;
  const wide = cols * SUB;
  // The lawns: the lot's shaded grass, with its tufts and flowers.
  for (let i = 0; i < cols; i++) {
    for (let r = 0; r <= LAWN_ROWS; r++) put('grass-0', i * CELL, horizon + r * CELL);
  }
  for (let sy = 0; sy < (LAWN_ROWS + 1) * SUB; sy++) {
    for (let sx = 0; sx < wide; sx++) {
      const id = grassSprite(sx, sy, false);
      if (id) drawSprite(ctx, img, id, sx * SUBTILE, horizon + sy * SUBTILE);
    }
  }
  // The street, and the front lawn's grass hanging over the sidewalk's edge, as on the board.
  const tiles: StreetTile[] = [];
  PAVING.forEach((kind, j) => {
    for (let sx = 0; sx < wide; sx++) tiles.push(pavingTile(kind, sx, top + j));
  });
  const blades = blobTile('godot', E | SE | S | SW | W);
  for (let sx = 0; sx < wide; sx++) tiles.push({ id: 'woods-edge', ...blades, sx, sy: top });
  paintStreet(ctx, img, tiles);
  for (const prop of BACK) stand(prop, horizon);
  for (const prop of FRONT) stand(prop, street);
}

function Scene({ w, scale }: { w: number; scale: number }) {
  const px = CELL * scale;
  const cols = Math.ceil(w / px) + 1;
  const viewW = w / scale;
  const height = ROOFS + LAWN_ROWS * CELL + STREET_H;
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let live = true;
    atlasImage()
      .then((loaded) => {
        if (live) setImg(loaded);
      })
      .catch((e) => console.error(e));
    return () => {
      live = false;
    };
  }, []);
  // A new size resizes the canvas, which clears it: redraw before the browser paints, so a
  // window resize never shows an empty street.
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (img && ctx) drawScene(ctx, img, cols, viewW);
  }, [img, cols, viewW]);
  return (
    <div class="title-scene" aria-hidden="true">
      <canvas
        ref={ref}
        width={cols * CELL}
        height={height}
        style={{ width: `${cols * px}px`, height: `${height * scale}px` }}
      />
      <Car viewW={viewW} scale={scale} />
    </div>
  );
}

/**
 * A car driving along the street, left to right, then a pause off screen. It moves in whole art
 * pixels (steps), like everything else in the scene. With Reduce motion it's parked.
 */
function Car({ viewW, scale }: { viewW: number; scale: number }) {
  const car = spritePos('title-car');
  const still = settings.value.reduceMotion;
  const f = FEEL.title;
  // Across the window and on past it for the pause, then back to the start, off screen left.
  const distance =
    Math.ceil(viewW) + 2 * car.w + Math.round((f.carPxPerSecond * f.carPauseMs) / 1000);
  return (
    <span
      class={`title-car ${still ? 'parked' : ''}`}
      style={{
        ...spriteStyle('title-car', scale),
        width: `${car.w * scale}px`,
        height: `${car.h * scale}px`,
        left: `${(still ? Math.round(viewW * 0.62) : -car.w) * scale}px`,
        '--drive': `${distance * scale}px`,
        '--drive-steps': String(distance),
        '--drive-ms': `${Math.round((distance / f.carPxPerSecond) * 1000)}ms`,
      }}
    />
  );
}
