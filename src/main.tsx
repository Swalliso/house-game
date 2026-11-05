import { render } from 'preact';
import { App } from './ui/App.tsx';
import './ui/fx/director.ts';
import { crash, loadInitialRun } from './ui/store.ts';
import './ui/app.css';

if (import.meta.env.DEV) {
  // Readable warnings and Preact DevTools support, in dev builds only.
  await import('preact/debug');
}

// A ?run= code, the saved run, or a fresh one. Loading never blocks or crashes (§6).
try {
  loadInitialRun();
} catch (e) {
  console.error(e);
  crash.value = { message: e instanceof Error ? e.message : String(e) };
}

window.addEventListener('error', (e) => console.error('Uncaught:', e.error ?? e.message));

const root = document.getElementById('app');
if (!root) throw new Error('index.html is missing <div id="app">');
render(<App />, root);
