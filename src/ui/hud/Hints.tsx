// The controls strip along the bottom (M5a): the keys for what you're doing now, as keycaps,
// instead of every shortcut at once. How to play lists them all. On a short window it sits
// under the board only, so the side columns keep their height, and drops the hints marked
// .hint-extra. M4's keys are here too: the change orders' sheet (1 or 2 picks one, D-144), a
// pack's tiles (D-106), and a Renovation (D-102). A tool or a fixture from the supplies gets its
// own keys: it's a free action, so the strip never offers Enter for it. Strike mode (D-157) has
// its own too: a card's click or number key, pressed twice.
//
// No hooks, here or in what it renders: hints.test.tsx calls Hints() in place.

import type { ComponentChildren } from 'preact';
import { CONTENT, rules } from '../../rules/index.ts';
import { isFit } from '../board/camera.ts';
import { busy } from '../fx/director.ts';
import { Keycap } from '../kit/kit.tsx';
import {
  extendUids,
  movingUid,
  renovateUids,
  run,
  selected,
  selection,
  tentative,
  tool,
} from '../store.ts';
import { pickKeys, shopHidden } from './actions.ts';
import { shown } from './first-job.ts';
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

/**
 * F toggles Fit (camera.ts): it shows the whole lot, and pressed again goes back to the zoom
 * from before, in the Fit button's words. `short` is for the build screen's full strip, which
 * has to stay one line: "zoom back" just fits it at 1280×720, so on a smaller window
 * (hints.css) it says "fit" with Fit on too, as it did before, and never wraps the strip
 * (which would move the board on every card picked).
 */
function FitHint({ short = false }: { short?: boolean }) {
  const fit = isFit.value;
  if (short) {
    return (
      <Hint keys={['F']}>
        {fit ? (
          <>
            <span class="fit-long">zoom back</span>
            <span class="fit-short">fit</span>
          </>
        ) : (
          'fit'
        )}
      </Hint>
    );
  }
  return <Hint keys={['F']}>{fit ? 'back to your zoom' : 'fit the lot'}</Hint>;
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
  } else if (s.screen === 'changeOrder') {
    // The change orders' sheet (M4b, D-144) takes only its own keys: F does nothing there. 1
    // and 2 pick an order; one offered alone takes Enter.
    const keys = pickKeys(rules.changeOrderOffer(s)?.options.length ?? 2);
    hints =
      keys.length > 1 ? (
        <Hint keys={[...keys]}>pick one</Hint>
      ) : (
        <Hint keys={[...keys]}>accept</Hint>
      );
  } else if (s.screen === 'shop') {
    // The sheet covers the lot, so F only means something once the shop is hidden.
    hints = shopHidden.value ? (
      <FitHint />
    ) : (
      // The sheet's own foot says where to sell, so a short window leaves these out.
      <>
        <span class="hint-text hint-extra">Hover anything to read it</span>
        <span class="hint-text hint-extra">Sell from your supplies and blueprints</span>
      </>
    );
  } else if (s.screen !== 'build') {
    // The end screen.
    hints = <FitHint />;
  } else if (tool.value === 'strike') {
    // A card clicked twice, or its number pressed twice, is struck (D-157).
    const cards = Math.min(9, s.hand.length);
    hints = (
      <>
        <Hint keys={['Click', cards > 1 ? `1–${cards}` : '1']}>a card twice to strike it</Hint>
        <Hint keys={['S', 'Esc']}>stop</Hint>
      </>
    );
  } else if (tool.value === 'demolish') {
    hints = (
      <>
        <Hint keys={['Click']}>a piece twice to demolish it</Hint>
        <Hint keys={['D', 'Esc']}>stop</Hint>
      </>
    );
  } else if (selected.value !== null) {
    const sel = selection.value;
    const pending = tentative.value;
    if (sel?.kind === 'tool' || (sel?.kind === 'fixture' && sel.from === 'supplies')) {
      // From the supplies, a tool or a fixture is free and the week goes on: nothing waits for
      // End week, so there's no Enter here (it would pass the week). The Copy Machine and a
      // fixture take two clicks on a piece; the Moving Truck picks a piece up, then takes two
      // clicks on its new spot, and R turns the piece it carries. Any other tool is used from
      // its panel (Inspect's "Use it now"), so only Esc is left.
      const use = sel.kind === 'tool' ? CONTENT.tools[sel.id].use.kind : null;
      const carrying = use === 'move' && movingUid.value !== null;
      const click =
        sel.kind === 'fixture'
          ? 'a piece twice to install it'
          : use === 'copy'
            ? 'a piece twice to copy it'
            : use === 'move'
              ? carrying
                ? 'its new spot twice'
                : 'the piece to move'
              : null;
      hints = (
        <>
          {carrying && <Hint keys={['R']}>rotate</Hint>}
          {click && <Hint keys={['Click']}>{click}</Hint>}
          <Hint keys={['Esc']}>put it back</Hint>
        </>
      );
    } else {
      // A pack (D-106) is clicked out a tile at a time, so it never turns, and nor does a room
      // waiting to be renovated (D-102), or a fixture from the hand, which goes into a piece.
      const pack = sel?.kind === 'piece' && !!CONTENT.pieces[sel.id].pack;
      const turns =
        sel?.kind === 'piece' && !pack && pending?.t !== 'renovate' && pending?.t !== 'extend';
      const click = pack
        ? pending
          ? 'add or take off a tile'
          : 'the first tile'
        : pending
          ? 'move it'
          : sel?.kind === 'fixture'
            ? 'a piece to install it'
            : extendUids.value.length > 0
              ? 'place, or extend an outlined room'
              : renovateUids.value.length > 0
                ? 'place, or renovate an outlined room'
                : 'place';
      hints = (
        <>
          {turns && <Hint keys={['R']}>rotate</Hint>}
          <Hint keys={['Click']} extra>
            {click}
          </Hint>
          {/* With the card only held, Enter passes the week, as the button beside it says. */}
          <Hint keys={['Enter']}>
            {!pending
              ? 'pass'
              : pending.t === 'renovate'
                ? 'renovate it'
                : pending.t === 'extend'
                  ? 'extend it'
                  : 'end the week'}
          </Hint>
          <Hint keys={['Esc']}>
            {pack && pending ? 'clear the tiles' : pending ? 'pick it up' : 'put it back'}
          </Hint>
        </>
      );
    }
  } else {
    // The hand's cards are numbered across its rows (D-121), keys 1–9: one keycap for all of
    // them, as narrow as the old "1 2 3".
    const cards = Math.min(9, s.hand.length);
    hints = (
      <>
        {cards > 0 && <Hint keys={[cards > 1 ? `1–${cards}` : '1']}>pick a card</Hint>}
        {/* The first job's first milestone has no Demolish yet (D-149). */}
        {shown.value.demolish && <Hint keys={['D']}>demolish</Hint>}
        {/* Extra: a hint that isn't wraps the strip (hints.css). The first job brings it in at
            Foundation's second week (D-157). */}
        {shown.value.strike && (
          <Hint keys={['S']} extra>
            strike
          </Hint>
        )}
        <Hint keys={['Scroll']} extra>
          zoom
        </Hint>
        <FitHint short />
        <Hint keys={['Enter']}>pass</Hint>
      </>
    );
  }
  return <footer class="hints ui">{hints}</footer>;
}
