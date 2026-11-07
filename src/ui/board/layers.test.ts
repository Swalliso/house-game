import { describe, expect, it } from 'vitest';
import { LAYER, layerVars } from './layers.ts';

describe('the board layers', () => {
  it('stack in the documented order, each on its own z-index', () => {
    const order = Object.values(LAYER);
    expect(new Set(order).size).toBe(order.length);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(LAYER.items).toBeLessThan(LAYER.walls);
    expect(LAYER.walls).toBeLessThan(LAYER.overhang);
    expect(LAYER.roof).toBeLessThan(LAYER.canopy);
    expect(LAYER.labels).toBeLessThan(LAYER.ghost);
    expect(LAYER.ghost).toBeLessThan(LAYER.popups);
  });

  it('give CSS a --z variable for every layer', () => {
    const vars = layerVars();
    expect(Object.keys(vars)).toHaveLength(Object.keys(LAYER).length);
    expect(vars['--z-ghost-text']).toBe(String(LAYER.ghostText));
    expect(vars['--z-yard-tint']).toBe(String(LAYER.yardTint));
    expect(vars['--z-popups']).toBe(String(LAYER.popups));
  });
});
