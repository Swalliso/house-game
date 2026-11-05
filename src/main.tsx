import { render } from 'preact';
import { App } from './ui/App.tsx';
import './ui/app.css';

if (import.meta.env.DEV) {
  // Readable warnings and Preact DevTools support, in dev builds only.
  await import('preact/debug');
}

const root = document.getElementById('app');
if (!root) throw new Error('index.html is missing <div id="app">');
render(<App />, root);
