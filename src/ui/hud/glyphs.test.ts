// The pixel fonts lack ★ ✕ ▲ ▼ ⚠ ▸ ▾ ✦ ↻ and 💡 (theme/fonts.css), so the HUD draws them as icons
// (theme/icons.ts): any left in its text would fall back to the system font inside pixel text,
// without an error (D-098, D-110). Comments may still name them. The board's labels and the
// director's popups keep theirs (M5a's choice), and they live outside src/ui/hud.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HUD = import.meta.dirname;
const MISSING = /[★✕▲▼⚠▸▾✦↻]|\u{1F4A1}/u;

/** The source with its comments blanked (block, JSX and line comments), lines kept in place. */
function withoutComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`])\/\/.*$/gm, (m, lead) => `${lead}${blank(m.slice(lead.length))}`);
}

describe("the HUD's text", () => {
  it('draws the symbols the pixel fonts lack as icons, never as text', () => {
    const files = readdirSync(HUD).filter(
      (f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f),
    );
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.flatMap((f) =>
      withoutComments(readFileSync(join(HUD, f), 'utf8'))
        .split('\n')
        .flatMap((line, i) => (MISSING.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it('finds one when it is there', () => {
    // The check itself: a mark in code is caught, the same mark in a comment isn't.
    expect(MISSING.test(withoutComments("const mark = '★';"))).toBe(true);
    expect(MISSING.test(withoutComments('// a ★ for a line turned on'))).toBe(false);
    expect(MISSING.test(withoutComments('{/* ▸ folds */}'))).toBe(false);
  });
});
