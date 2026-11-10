import { afterEach, describe, expect, it } from 'vitest';
import { FEEL } from './feel.ts';
import {
  alpha,
  burst,
  clearParticles,
  connect,
  particles,
  spawn,
  step,
  type BurstName,
  type BurstSpec,
} from './particles.ts';

const presets = FEEL.particles.bursts as unknown as Record<BurstName, BurstSpec>;
/** A fixed randomness, so a burst's numbers are known. */
const half = () => 0.5;

describe('the burst presets (feel.ts)', () => {
  it('are each well formed', () => {
    for (const [name, p] of Object.entries(presets)) {
      expect(p.count, name).toBeGreaterThan(0);
      expect(p.speed[0], name).toBeLessThanOrEqual(p.speed[1]);
      expect(p.life[0], name).toBeGreaterThan(0);
      expect(p.life[0], name).toBeLessThanOrEqual(p.life[1]);
      expect(p.size[0], name).toBeGreaterThanOrEqual(1);
      // Icons bring their own colors; everything else names tokens.
      if (p.shape === 'icon') expect(p.icon, name).toBeTruthy();
      else {
        expect(p.colors.length, name).toBeGreaterThan(0);
        for (const c of p.colors) expect(c, name).toMatch(/^--[a-z0-9-]+$/);
      }
      // Restraint (§12, Kao 2020): no burst lasts more than about two seconds.
      expect(p.life[1] + (p.overMs ?? 0), name).toBeLessThanOrEqual(2700);
    }
  });
});

describe('spawn and step', () => {
  it("spawns a preset's count at the point, scaled by a moment", () => {
    const at = { x: 100, y: 200 };
    expect(spawn(presets.confetti, at, {}, half)).toHaveLength(presets.confetti.count);
    expect(spawn(presets.confetti, at, { scale: 2 }, half)).toHaveLength(
      presets.confetti.count * 2,
    );
    expect(spawn(presets.confetti, at, { count: 3 }, half)).toHaveLength(3);
    for (const p of spawn(presets.stars, at, {}, half)) {
      expect(p.x).toBe(100);
      expect(p.y).toBe(200);
    }
  });

  it("spreads a fountain's particles over its time, and a delay holds them all back", () => {
    const list = spawn(presets.confetti, { x: 0, y: 0 }, { delayMs: 100 }, half);
    expect(list[0]!.age).toBe(-100);
    expect(list[list.length - 1]!.age).toBeCloseTo(-(100 + (presets.confetti.overMs ?? 0)));
    // Waiting particles don't move, and can't be seen.
    const p = list[list.length - 1]!;
    expect(step(p, 50)).toBe(true);
    expect(p.x).toBe(0);
    expect(alpha(p)).toBe(0);
  });

  it('moves under gravity and drag, and ends after its life', () => {
    const [p] = spawn(presets.coins, { x: 0, y: 0 }, { count: 1, angle: -90, spread: 0 }, half);
    const vy = p!.vy;
    expect(vy).toBeLessThan(0);
    step(p!, 100);
    expect(p!.y).toBeLessThan(0);
    // Gravity pulls it back down over time.
    expect(p!.vy).toBeGreaterThan(vy);
    expect(alpha(p!)).toBe(1);
    let alive = true;
    for (let t = 0; t < 5000 && alive; t += 16) alive = step(p!, 16);
    expect(alive).toBe(false);
  });

  it('keeps a ring where it started', () => {
    const [r] = spawn(presets.ring, { x: 5, y: 7 }, {}, half);
    step(r!, 200);
    expect([r!.x, r!.y]).toEqual([5, 7]);
  });
});

describe('burst', () => {
  afterEach(() => clearParticles());

  it('plays nothing while bursts aren’t allowed (Reduce motion)', () => {
    const off = connect(
      () => {},
      () => false,
    );
    burst('confetti', { x: 0, y: 0 });
    expect(particles()).toHaveLength(0);
    off();
  });

  it('wakes the renderer, and keeps to the cap', () => {
    let woken = 0;
    const off = connect(
      () => woken++,
      () => true,
    );
    burst('stars', { x: 0, y: 0 });
    expect(woken).toBe(1);
    expect(particles()).toHaveLength(presets.stars.count);
    for (let i = 0; i < 100; i++) burst('confetti', { x: 0, y: 0 }, { scale: 3 });
    expect(particles().length).toBe(FEEL.particles.max);
    off();
  });

  it('ignores a point that isn’t on the screen', () => {
    burst('stars', { x: Number.NaN, y: 0 });
    expect(particles()).toHaveLength(0);
  });
});
