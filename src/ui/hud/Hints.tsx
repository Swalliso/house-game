// The controls strip along the bottom (M5a): the keys for what you're doing now, as keycaps,
// instead of every shortcut at once. How to play lists them all. On a short window it sits
// under the board only, so the side columns keep their height, and drops the hints marked
// .hint-extra.

import type { ComponentChildren } from 'preact';
import { busy } from '../fx/director.ts';
import { Keycap } from '../kit/kit.tsx';
import { run, selected, tentative, tool } from '../store.ts';
import { shopHidden } from './actions.ts';
import './hints.css';

function Hint({
  keys,
  extra = false,
  children,
}: {
  keys: readonly string[];
  /** Left out on a short window, where the strip has less room. */
  extra?: boolean;
  children: ComponentChildren;
}) {
  return (
    <span class={`hint ${extra ? 'hint-extra' : ''}`}>
      {keys.map((k) => (
        <Keycap key={k}>{k}</Keycap>
      ))}
      <span class="hint-text">{children}</span>
    </span>
  );
}

export function Hints() {
  const s = run.value;
  let hints: ComponentChildren;
  if (busy.value) {
    hints = (
      <>
        <Hint keys={['Space']}>hold to speed up</Hint>
        <Hint keys={['Click']}>skip to the result</Hint>
      </>
    );
  } else if (s.screen === 'shop') {
    // The sheet covers the lot, so F only means something once the shop is hidden.
    hints = shopHidden.value ? (
      <Hint keys={['F']}>fit the lot</Hint>
    ) : (
      // The sheet's own foot says where to sell, so a short window leaves these out.
      <>
        <span class="hint-text hint-extra">Hover anything to read it</span>
        <span class="hint-text hint-extra">Sell from your supplies and blueprints</span>
      </>
    );
  } else if (s.screen !== 'build') {
    hints = <Hint keys={['F']}>fit the lot</Hint>;
  } else if (tool.value === 'demolish') {
    hints = (
      <>
        <Hint keys={['Click']}>a piece twice to demolish it</Hint>
        <Hint keys={['D', 'Esc']}>stop</Hint>
      </>
    );
  } else if (selected.value !== null) {
    hints = (
      <>
        <Hint keys={['R']}>rotate</Hint>
        <Hint keys={['Click']} extra>
          {tentative.value ? 'move it' : 'place'}
        </Hint>
        <Hint keys={['Enter']}>end the week</Hint>
        <Hint keys={['Esc']}>{tentative.value ? 'pick it up' : 'put it back'}</Hint>
      </>
    );
  } else {
    hints = (
      <>
        <Hint keys={['1', '2', '3']}>pick a card</Hint>
        <Hint keys={['D']}>demolish</Hint>
        <Hint keys={['Scroll']} extra>
          zoom
        </Hint>
        <Hint keys={['F']}>fit</Hint>
        <Hint keys={['Enter']}>pass</Hint>
      </>
    );
  }
  return <footer class="hints ui">{hints}</footer>;
}
