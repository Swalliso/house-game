import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { renderSound, SOUND_IDS } from './audio.ts';

/** Every .ts and .tsx file under a folder, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name);
    if (d.isDirectory()) return sources(path);
    return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [path] : [];
  });
}

/** Where a string literal with this text is used as a value (comments and types aside). */
function usesOf(text: string, files: readonly string[]): string[] {
  return files.flatMap((file) => {
    const code = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    const found: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) && node.text === text && !ts.isLiteralTypeNode(node.parent)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push(`${relative(process.cwd(), file)}:${line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  });
}

describe('the placeholder sounds', () => {
  it('each renders a short, finite sound under the peak', () => {
    for (const id of SOUND_IDS) {
      const samples = renderSound(id, 44100);
      expect(samples.length, id).toBeGreaterThan(0);
      expect(samples.length / 44100, id).toBeLessThan(2);
      let peak = 0;
      for (const v of samples) {
        expect(Number.isFinite(v), id).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, id).toBeGreaterThan(0.01);
      expect(peak, id).toBeLessThanOrEqual(0.95 + 1e-6);
    }
  });

  // §12, Sound and D-058: the ×Mult bell is "never used for anything else". The director
  // plays it as each ×Mult source lands, and nothing else names it.
  it('keeps the ×Mult bell for ×Mult', () => {
    const uses = usesOf('stamp', sources(join(process.cwd(), 'src/ui')));
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/director\.ts:\d+$/);
  });
});
