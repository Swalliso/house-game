import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// src/rules and src/content stay pure (CLAUDE.md, implementation-plan.md §3): no Math.random,
// no Date, no browser globals, and imports only from inside these two folders, so no Preact,
// no src/ui, no Node built-ins, and no packages. tsconfig.rules.json catches the DOM as well.
// This reads the syntax tree, so comments and strings ("Date Night", "bay window") are fine.
const PURE_ROOTS = ['src/rules', 'src/content'].map((dir) => resolve(dir));
const BANNED_GLOBALS = new Set([
  'Date',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'globalThis',
  'performance',
]);

const isInsidePureRoots = (path: string) =>
  PURE_ROOTS.some((root) => path === root || path.startsWith(root + sep));

function findImpurities(file: string, code: string): string[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const report = (node: ts.Node, what: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push(`${relative(process.cwd(), file)}:${line + 1}: ${what}`);
  };
  const isPropertyName = (node: ts.Identifier) => {
    const parent = node.parent;
    return (
      (ts.isPropertyAccessExpression(parent) ||
        ts.isPropertyAssignment(parent) ||
        ts.isPropertySignature(parent)) &&
      parent.name === node
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.getText(source) === 'Math' &&
      node.name.text === 'random'
    ) {
      report(node, 'Math.random (use a keyed stream from rules/rng.ts)');
    } else if (ts.isIdentifier(node) && BANNED_GLOBALS.has(node.text) && !isPropertyName(node)) {
      report(node, node.text);
    } else if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      const target = resolve(dirname(file), specifier);
      if (!specifier.startsWith('.') || !isInsidePureRoots(target)) {
        report(node, `import from "${specifier}"`);
      }
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === 'require')
    ) {
      report(node, 'dynamic import or require');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function pureSourceFiles(): string[] {
  return PURE_ROOTS.filter((root) => existsSync(root)).flatMap((root) =>
    readdirSync(root, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .filter((entry) => !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name)),
  );
}

describe('purity of src/rules and src/content', () => {
  it('has no clock, randomness, browser globals, or outside imports', () => {
    const files = pureSourceFiles();
    expect(files.length).toBeGreaterThan(0);
    const impurities = files.flatMap((file) => findImpurities(file, readFileSync(file, 'utf8')));
    expect(impurities).toEqual([]);
  });

  it('type-checks against no DOM, Node, or Vite types (tsconfig.rules.json)', () => {
    // Anything that references the DOM lib (Preact's JSX types did) silently brings back
    // `document` and `window`, so check what the rules program actually loads.
    const config = ts.getParsedCommandLineOfConfigFile(
      'tsconfig.rules.json',
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        },
      },
    );
    if (!config) throw new Error('could not read tsconfig.rules.json');
    const program = ts.createProgram(config.fileNames, config.options);
    const loaded = program.getSourceFiles().map((file) => relative(process.cwd(), file.fileName));
    const leaks = loaded.filter((file) =>
      /lib\.dom|lib\.webworker|@types[\\/]node|vite[\\/]client|preact/.test(file),
    );
    expect(leaks).toEqual([]);
  });

  it('catches each kind of impurity', () => {
    const file = resolve('src/rules/example.ts');
    const bad = [
      'const roll = Math.random();',
      'const now = Date.now();',
      'const when = new Date();',
      'let stamp: Date;',
      'window.alert("hi");',
      'document.title = "x";',
      'localStorage.setItem("k", "v");',
      'const g = globalThis;',
      'const lot = { document };',
      "import { h } from 'preact';",
      "import { App } from '../ui/App.tsx';",
      "import { readFileSync } from 'node:fs';",
      "export { run } from '../../sim/cli.ts';",
      "const lazy = import('./lazy.ts');",
    ];
    for (const line of bad) expect(findImpurities(file, line), line).toHaveLength(1);
  });

  it('allows pure code that only mentions those words', () => {
    const file = resolve('src/content/example.ts');
    const fine = [
      '// Date, window, and document in a comment; Math.random() too',
      "export const piece = { name: 'Date Night', text: 'a bay window', window: 2 };",
      'type Lot = { document: string };',
      'const n = lot.window + Math.floor(3.5);',
      "import { balance } from './balance.ts';",
      "import type { RunState } from '../rules/index.ts';",
    ];
    for (const line of fine) expect(findImpurities(file, line), line).toEqual([]);
  });
});
