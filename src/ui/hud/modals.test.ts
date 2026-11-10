// The sheets over the game (M5a): Esc closes the top one first.

import { afterEach, describe, expect, it } from 'vitest';
import {
  anyModalOpen,
  closeTopModal,
  copyFallback,
  howToPlayOpen,
  menuOpen,
  settingsOpen,
} from './modals.ts';

afterEach(() => {
  settingsOpen.value = false;
  menuOpen.value = false;
  howToPlayOpen.value = false;
  copyFallback.value = null;
});

describe('Esc over the sheets', () => {
  it('closes the copy fallback first, then Settings, then the menu under them', () => {
    menuOpen.value = true;
    settingsOpen.value = true;
    copyFallback.value = { title: 'Run code', text: 'OH1.x' };
    closeTopModal();
    expect(copyFallback.value).toBeNull();
    expect(settingsOpen.value).toBe(true);
    closeTopModal();
    expect(settingsOpen.value).toBe(false);
    expect(menuOpen.value).toBe(true);
    closeTopModal();
    expect(menuOpen.value).toBe(false);
    expect(anyModalOpen()).toBe(false);
  });

  it('closes How to play opened from the menu before the menu', () => {
    menuOpen.value = true;
    howToPlayOpen.value = true;
    closeTopModal();
    expect(howToPlayOpen.value).toBe(false);
    expect(menuOpen.value).toBe(true);
  });

  it('knows when nothing is open', () => {
    expect(anyModalOpen()).toBe(false);
    closeTopModal();
    expect(anyModalOpen()).toBe(false);
    howToPlayOpen.value = true;
    expect(anyModalOpen()).toBe(true);
  });
});
