// The sheets and the menu that open over the game (M5a), and which one Esc closes first.

import { signal } from '@preact/signals';

export const settingsOpen = signal(false);
/** The top bar's menu: Copy run code, the seed, How to play, Settings, and Quit to title. */
export const menuOpen = signal(false);
/** The How to play sheet, from the title screen, the top bar, or the menu. */
export const howToPlayOpen = signal(false);
/** Text to copy by hand, when the browser won't let us write the clipboard (some iframes). */
export const copyFallback = signal<{ title: string; text: string } | null>(null);
/** The end screen's photo shown larger (D-136), by its milestone's place in the strip. */
export const photoShown = signal<number | null>(null);
/** The company's portfolio (D-139), from the title screen. */
export const portfolioOpen = signal(false);

export function anyModalOpen(): boolean {
  return (
    settingsOpen.value ||
    howToPlayOpen.value ||
    menuOpen.value ||
    !!copyFallback.value ||
    photoShown.value !== null ||
    portfolioOpen.value
  );
}

/**
 * Esc closes the top one: the copy fallback over everything, then a photo, then Settings, How
 * to play or the portfolio (each opens over the menu or the title), then the menu.
 */
export function closeTopModal(): void {
  if (copyFallback.value) copyFallback.value = null;
  else if (photoShown.value !== null) photoShown.value = null;
  else if (settingsOpen.value || howToPlayOpen.value || portfolioOpen.value) {
    settingsOpen.value = false;
    howToPlayOpen.value = false;
    portfolioOpen.value = false;
  } else menuOpen.value = false;
}
