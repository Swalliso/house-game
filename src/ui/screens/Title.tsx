// The title screen (implementation-plan.md §7, M2): the name, a one-line pitch, and Continue,
// Start, How to play, and Settings, over a little street drawn from the sprite atlas.

import './title.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { rules, SCORE_LABELS } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { streetScale } from '../board/geometry.ts';
import { formatNumber } from '../format.ts';
import { howToPlayOpen, settingsOpen } from '../hud/actions.ts';
import { atlasImage, CELL, spritePos, type SpriteId } from '../sprites.ts';
import { canContinue, continueRun, newRun, run } from '../store.ts';

/** What the save holds, for the Continue button: "Framing, week 10 · 1,240 Wow". */
function savedRunLine(): string {
  const s = run.value;
  return `${rules.phaseName(s.phase)}, week ${s.week} · ${formatNumber(s.score)} ${SCORE_LABELS.total}`;
}

export function Title() {
  const saved = canContinue.value;
  const primary = useRef<HTMLButtonElement>(null);

  // The primary button takes focus, so Enter starts (or continues) right away.
  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [saved]);

  const onContinue = () => {
    audio.unlock();
    continueRun();
  };
  const onStart = () => {
    audio.unlock();
    if (saved && !window.confirm('Start a new run? The run in progress will be lost.')) return;
    newRun();
  };

  return (
    <div class="title-screen">
      <div class="title-sky">
        <div class="title-sun" aria-hidden="true" />
        <HouseSilhouette />
        <main class="title-card">
          <div class="title-roof" aria-hidden="true" />
          <h1 class="title-name">Open House</h1>
          <p class="title-pitch">Build one house for one client, one piece a week.</p>
          <nav class="title-buttons" aria-label="Main menu">
            {saved && (
              <button type="button" class="primary title-main" ref={primary} onClick={onContinue}>
                Continue
                <span class="title-detail">{savedRunLine()}</span>
              </button>
            )}
            <button
              type="button"
              class={saved ? 'title-main' : 'primary title-main'}
              ref={saved ? undefined : primary}
              onClick={onStart}
            >
              {saved ? 'New run' : 'Start'}
            </button>
            <div class="title-row">
              <button type="button" onClick={() => (howToPlayOpen.value = true)}>
                How to play
              </button>
              <button type="button" onClick={() => (settingsOpen.value = true)}>
                Settings
              </button>
            </div>
          </nav>
        </main>
      </div>
      <Street />
      <footer class="title-footer">A game jam entry · theme: It's a house · art by LimeZu</footer>
    </div>
  );
}

function HouseSilhouette() {
  return (
    <div class="title-house" aria-hidden="true">
      <div class="title-house-chimney" />
      <div class="title-house-roof" />
      <div class="title-house-walls">
        <div class="title-house-window" />
        <div class="title-house-door" />
        <div class="title-house-window" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// The street along the bottom: a strip of lawn with trees and a fence, the sidewalk, the
// street, and the far sidewalk. Each tile is one CELL-sized sprite, drawn into one canvas as
// the board's terrain is: at 125% or 150% display scaling a tile is a fractional number of CSS
// px, and tiles as separate elements show hairline seams between them.

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

const GRASS: readonly SpriteId[] = ['grass-0', 'grass-1', 'grass-2'];

/** The lawn row's tile at column i: a fixed pattern, so the street looks the same every time. */
function lawnTile(i: number): { floor: SpriteId; top?: SpriteId } {
  const k = i % 13;
  if (k >= 8 && k <= 10) return { floor: 'fence' };
  const floor = GRASS[(i * 7) % GRASS.length]!;
  if (k === 2 || k === 5) return { floor, top: 'tree' };
  if (k === 0 || k === 12) return { floor, top: 'flowers' };
  return { floor };
}

/** The street's 4 rows of `cols` tiles, in art px: one CELL per tile. */
function drawStreet(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cols: number): void {
  const put = (id: SpriteId, x: number, y: number) => {
    const p = spritePos(id);
    ctx.drawImage(img, p.x, p.y, p.w, p.h, x * CELL, y * CELL, p.w, p.h);
  };
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < cols; i++) {
    const t = lawnTile(i);
    put(t.floor, i, 0);
    if (t.top) put(t.top, i, 0);
    put('sidewalk', i, 1);
    put('street', i, 2);
    put('sidewalk', i, 3);
  }
}

function Street() {
  const { w, h, dpr } = useViewport();
  const scale = streetScale(h, dpr);
  const px = CELL * scale;
  const cols = Math.ceil(w / px) + 1;
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
  // A new column count resizes the canvas, which clears it: redraw before the browser paints,
  // so a window resize never shows an empty street.
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (img && ctx) drawStreet(ctx, img, cols);
  }, [img, cols]);
  return (
    <div class="title-street" aria-hidden="true">
      <canvas
        ref={ref}
        width={cols * CELL}
        height={4 * CELL}
        style={{ width: `${cols * px}px`, height: `${4 * px}px` }}
      />
    </div>
  );
}
