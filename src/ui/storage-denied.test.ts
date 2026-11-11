// A browser that blocks site data (Chrome with cookies blocked, or the game in an itch.io frame
// in an Incognito window) throws on any read of window.localStorage, even `typeof localStorage`.
// The game still has to load and play: every record then lasts for the visit only. Before, the
// company's record read storage as its module loaded, outside a try, and the page stayed blank.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const denied = () => {
  throw new DOMException('Access is denied for this document.', 'SecurityError');
};

describe('storage the browser denies', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: denied });
    // Each module is loaded fresh, so what it reads as it loads is read through the getter.
    vi.resetModules();
  });
  afterEach(() => {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
    vi.resetModules();
  });

  it('throws on a bare typeof, as Chrome does', () => {
    expect(() => typeof localStorage).toThrow();
  });

  it('loads the company record empty, and keeps a filed house for the visit', async () => {
    const { company, fileJob } = await import('./company.ts');
    expect(company.value.built).toBe(0);
    fileJob({
      seed: 'abc123',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      won: true,
      score: 40000,
      verdict: 'Starter Home',
      milestones: 7,
      phases: 7,
      at: 1000,
    });
    expect(company.value.built).toBe(1);
  });

  it("keeps the tally's records for the visit", async () => {
    const { bestWeek, markTierSeen, recordWeek, tierSeen } = await import('./fx/ladder.ts');
    expect(bestWeek()).toBe(0);
    recordWeek(500);
    expect(bestWeek()).toBe(500);
    expect(tierSeen('great')).toBe(false);
    markTierSeen('great');
    expect(tierSeen('great')).toBe(true);
  });

  it('remembers a run that topped out for the visit', async () => {
    const { markToppedOut, toppedOutBefore } = await import('./fx/moments.ts');
    const setup = {
      seed: 'abc123',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    } as const;
    expect(toppedOutBefore(setup)).toBe(false);
    markToppedOut(setup);
    expect(toppedOutBefore(setup)).toBe(true);
  });

  it('loads the store, the settings and the first-week hints', async () => {
    // Each reads storage, some as the module loads: none may throw.
    const store = await import('./store.ts');
    expect(store.firstVisit()).toBe(true);
    const { settings, updateSettings } = await import('./settings.ts');
    expect(() => updateSettings({ shake: settings.value.shake })).not.toThrow();
    const { seenHints } = await import('./hud/FirstHints.tsx');
    expect(seenHints.value.size).toBe(0);
  });
});
