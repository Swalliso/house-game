// The particles' canvas (D-125): one canvas over the whole page, under the first-time hints and
// the modals, that draws particles.ts's bursts while any are in flight and sleeps otherwise.
// Everything lands on whole UI pixels (theme/pixel.ts), as the interface's own art does: a
// confetti bit is a 2×3 block of UI pixels, a coin or a star is its icon from theme/icons.ts.
// Colors are tokens.css's, read once from the page.

import { useEffect, useRef } from 'preact/hooks';
import { settings } from '../settings.ts';
import { UI_PALETTE } from '../theme/art.ts';
import { ICONS } from '../theme/icons.ts';
import { uiPixelDevice } from '../theme/pixel.ts';
import { alpha, clearParticles, connect, particles, step, type Particle } from './particles.ts';
import './fx.css';

const colors = new Map<string, string>();

/** A token's color, read from the page once. */
function color(token: string): string {
  let c = colors.get(token);
  if (c === undefined) {
    c = getComputedStyle(document.documentElement).getPropertyValue(token).trim() || 'white';
    colors.set(token, c);
  }
  return c;
}

const icons = new Map<string, HTMLCanvasElement>();

/** An icon as a canvas, one pixel per art pixel, made once. */
function icon(name: string): HTMLCanvasElement | null {
  let c = icons.get(name);
  if (c) return c;
  const grid = (ICONS as Record<string, string>)[name];
  if (!grid) return null;
  const rows = grid
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  c = document.createElement('canvas');
  c.width = rows[0]!.length;
  c.height = rows.length;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const hex = UI_PALETTE[ch];
      if (!hex) return;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  icons.set(name, c);
  return c;
}

function draw(ctx: CanvasRenderingContext2D, p: Particle, dpr: number, u: number): void {
  const a = alpha(p);
  if (a <= 0) return;
  // Whole UI pixels: the particle moves a UI pixel at a time, like the art.
  const snap = (v: number) => Math.round((v * dpr) / u) * u;
  const x = snap(p.x);
  const y = snap(p.y);
  ctx.globalAlpha = a;
  switch (p.shape) {
    case 'square': {
      const s = Math.max(1, p.size) * u;
      ctx.fillStyle = color(p.color);
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      break;
    }
    case 'confetti': {
      // A paper bit tumbling: its width turns with it, in whole UI pixels.
      const w = Math.max(1, Math.round(p.size * Math.abs(Math.cos(p.rot)))) * u;
      const h = Math.max(1, Math.round(p.size * 1.6)) * u;
      ctx.fillStyle = color(p.color);
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      break;
    }
    case 'spark': {
      // A plus that twinkles.
      ctx.globalAlpha = a * (0.55 + 0.45 * Math.abs(Math.sin(p.rot)));
      ctx.fillStyle = color(p.color);
      const arm = Math.max(1, p.size);
      ctx.fillRect(x - u / 2, y - u / 2 - arm * u, u, (arm * 2 + 1) * u);
      ctx.fillRect(x - u / 2 - arm * u, y - u / 2, (arm * 2 + 1) * u, u);
      break;
    }
    case 'puff': {
      // Dust: a block that grows as it fades.
      const s = Math.max(1, Math.round(p.size * (1 + p.age / p.life))) * u;
      ctx.globalAlpha = a * 0.75;
      ctx.fillStyle = color(p.color);
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      break;
    }
    case 'ring': {
      // One ring spreading out from where it started: vx is how fast it grows.
      const r = Math.round((u * 3 + (p.vx * p.age * dpr) / 1000) / u) * u;
      ctx.strokeStyle = color(p.color);
      ctx.lineWidth = u;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(u, r), 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'icon': {
      const img = icon(p.icon);
      if (!img) break;
      const w = img.width * u;
      const h = img.height * u;
      ctx.drawImage(img, x - Math.round(w / 2 / u) * u, y - Math.round(h / 2 / u) * u, w, h);
      break;
    }
  }
}

export function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    let last = 0;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(window.innerWidth * dpr);
      const h = Math.round(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    const tick = (now: number) => {
      // A hidden tab pauses frames: don't let the catch-up throw everything off the screen.
      const dt = Math.min(50, last ? now - last : 16);
      last = now;
      fit();
      const dpr = window.devicePixelRatio || 1;
      const u = uiPixelDevice(dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      const list = particles();
      let k = 0;
      for (const p of list) {
        if (!step(p, dt)) continue;
        draw(ctx, p, dpr, u);
        list[k++] = p;
      }
      list.length = k;
      ctx.globalAlpha = 1;
      if (k > 0) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        last = 0;
      }
    };
    const disconnect = connect(
      () => {
        if (!frame) frame = requestAnimationFrame(tick);
      },
      () => !settings.value.reduceMotion,
    );
    return () => {
      disconnect();
      cancelAnimationFrame(frame);
      clearParticles();
    };
  }, []);
  return <canvas ref={ref} class="particles" aria-hidden="true" />;
}
