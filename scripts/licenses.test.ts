// assets/licenses.json covers everything the game ships (CLAUDE.md: record every file in it):
// every file under assets/ and public/ (the link preview's image and the favicon, D-135, keyed
// by their path under public/), each npm package the build bundles, and the code we vendor or
// draw with (keyed by its path under src/). Every record points at something that exists, and says
// where it came from, who made it, and under what license. The LimeZu cuts' own records are
// checked against their manifests in cut-art.test.ts.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const assets = join(root, 'assets');
const publicDir = join(root, 'public');
const records = JSON.parse(readFileSync(join(assets, 'licenses.json'), 'utf8')) as Record<
  string,
  Record<string, unknown>
>;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

/** Every file under `dir`, as a path from `from` with forward slashes (dotfiles skipped). */
function files(dir: string, from = assets): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, from);
    return [relative(from, path).split('\\').join('/')];
  });
}

describe('assets/licenses.json', () => {
  it('records every file under assets/', () => {
    const missing = files(assets).filter((f) => f !== 'licenses.json' && !(f in records));
    expect(missing, 'record these in assets/licenses.json (a LimeZu cut: npm run art:cut)').toEqual(
      [],
    );
  });

  it('records every file under public/', () => {
    const missing = files(publicDir, root).filter((f) => !(f in records));
    expect(missing, 'record these in assets/licenses.json').toEqual([]);
  });

  it('records every npm package the build bundles', () => {
    for (const name of Object.keys(pkg.dependencies)) {
      expect(records, `no record for npm:${name}`).toHaveProperty([`npm:${name}`]);
    }
  });

  it('points every record at something that exists', () => {
    for (const key of Object.keys(records)) {
      if (key.startsWith('npm:')) {
        expect(pkg.dependencies, `${key} isn't a dependency`).toHaveProperty([key.slice(4)]);
        continue;
      }
      const fromRoot = key.startsWith('src/') || key.startsWith('public/');
      const path = fromRoot ? join(root, key) : join(assets, key);
      expect(existsSync(path), `${key} has a record but no file`).toBe(true);
    }
  });

  it('says where each thing came from, who made it, and its license', () => {
    for (const [key, record] of Object.entries(records)) {
      for (const field of ['source', 'author', 'license']) {
        const value = record[field];
        expect(typeof value === 'string' && value.length > 0, `${key}: ${field}`).toBe(true);
      }
    }
  });
});
