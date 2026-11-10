/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import { defineConfig, loadEnv } from 'vite';

// Every build is stamped with the git short SHA and a channel (implementation-plan.md §6).
// The channel comes from VITE_CHANNEL: CI sets `main` or `dev`; anything run locally is `local`.
const CHANNELS = ['main', 'dev', 'local'] as const;
type Channel = (typeof CHANNELS)[number];

function resolveChannel(value: string | undefined): Channel {
  const channel = value || 'local';
  if (!(CHANNELS as readonly string[]).includes(channel)) {
    throw new Error(`VITE_CHANNEL must be one of ${CHANNELS.join(', ')}; got "${channel}"`);
  }
  return channel as Channel;
}

/**
 * Where Pages serves the release (D-063; develop's builds are at dev/ under it). The link
 * preview's tags in index.html need absolute URLs, so they're filled in here (D-135); the
 * result line's links use the same address (src/ui/screens/result-line.ts PAGES_URL).
 */
const PAGES_URL = 'https://swalliso.github.io/house-game/';

function gitShortSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    console.warn('vite.config.ts: no git checkout, so the build is stamped "nogit"');
    return 'nogit';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const channel = resolveChannel(env.VITE_CHANNEL);
  const sha = gitShortSha();

  return {
    // Relative, so the same build works at Pages' root, at /dev/, and on itch.io (D-060).
    base: './',
    define: {
      __BUILD_SHA__: JSON.stringify(sha),
      __BUILD_CHANNEL__: JSON.stringify(channel),
    },
    plugins: [
      {
        name: 'share-base',
        transformIndexHtml: (html: string) =>
          html.replaceAll('%SHARE_BASE%', channel === 'dev' ? `${PAGES_URL}dev/` : PAGES_URL),
      },
    ],
    // Vite 8 compiles TS and JSX with Oxc (it replaced esbuild). Preact's automatic runtime:
    oxc: {
      jsx: { runtime: 'automatic', importSource: 'preact' },
    },
    server: {
      // The main checkout holds Claude's worktrees in .claude/worktrees/, so don't watch them.
      // Anchored to this checkout: chokidar matches absolute paths, and every worktree's own
      // path contains /.claude/, so a bare '**/.claude/**' would stop a worktree watching anything.
      watch: { ignored: [`${import.meta.dirname}/.claude/**`] },
    },
    test: {
      // Explicit roots, so tests in .claude/worktrees/ never run from the main checkout.
      include: ['src/**/*.test.{ts,tsx}', 'sim/**/*.test.ts', 'scripts/**/*.test.ts'],
    },
  };
});
