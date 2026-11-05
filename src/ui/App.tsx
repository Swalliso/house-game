import { BUILD_LABEL } from './build-info.ts';

// M0 placeholder. M1 replaces this with the title screen and the vertical slice.
export function App() {
  return (
    <>
      <main class="placeholder">
        <h1>Open House</h1>
        <p class="tagline">It's a house.</p>
        <p class="note">A roguelite house builder, under construction.</p>
      </main>
      <BuildLabel />
    </>
  );
}

function BuildLabel() {
  return (
    <div class="build-label" title="Build: channel · git commit">
      {BUILD_LABEL}
    </div>
  );
}
