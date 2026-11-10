// The controls strip along the bottom (M5a): the keys for what you're doing now, as keycaps,
// instead of every shortcut at once. How to play lists them all. On a short window it sits
// under the board only, so the side columns keep their height, and drops the hints marked
// .hint-extra. M4's keys are here too: a change order's sheet (Enter accepts, Esc or D
// declines one that can be declined), a pack's tiles (D-106), and a Renovation (D-102).
//
// No hooks, here or in what it renders: hints.test.tsx calls Hints() in place.

import type { ComponentChildren } from 'preact';
import { CONTENT, rules } from '../../rules/index.ts';
import { isFit } from '../board/camera.ts';
import { busy } from '../fx/director.ts';
import { roofed } from '../fx/moments.ts';
import { Keycap } from '../kit/kit.tsx';
import {
  movingUid,
  renovateUids,
  roofOn,
  run,
  selected,
  selection,
  tentative,
  tool,
} from '../store.ts';
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

/**
 * T puts the roof on and takes it off once the Roofing milestone is met (D-133). On the build
 * screen's full strip it takes Scroll's place, in a word no wider ("roof"), so the strip never
 * outgrows its one line; elsewhere it says what it does now.
 */
function RoofHint({ short = false }: { short?: boolean }) {
  if (short) {
    return (
      <Hint keys={['T']} extra>
        roof
      </Hint>
    );
  }
  return <Hint keys={['T']}>{roofOn.value ? 'look inside' : 'put the roof on'}</Hint>;
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
    // A change order's sheet (M4b) takes only its own keys: F does nothing there. A phase
    // effect can't be declined, so Esc and D do nothing on one either.
    hints =
      (rules.changeOrderOffer(s)?.declinable ?? true) ? (
        <>
          <Hint keys={['Enter']}>accept</Hint>
          <Hint keys={['Esc', 'D']}>decline: it costs nothing</Hint>
        </>
      ) : (
        <Hint keys={['Enter']}>got it</Hint>
      );
  } else if (s.screen === 'shop') {
    // The sheet covers the lot, so F and T only mean something once the shop is hidden.
    hints = shopHidden.value ? (
      <>
        <FitHint />
        {roofed(s) && <RoofHint />}
      </>
    ) : (
      // The sheet's own foot says where to sell, so a short window leaves these out.
      <>
        <span class="hint-text hint-extra">Hover anything to read it</span>
        <span class="hint-text hint-extra">Sell from your supplies and blueprints</span>
      </>
    );
  } else if (s.screen !== 'build') {
    // The end screen: it opens with the roof on, and T looks inside (D-133).
    hints = (
      <>
        <FitHint />
        {roofed(s) && <RoofHint />}
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
    // A pack (D-106) is clicked out a tile at a time, so it never turns, and nor does a room
    // waiting to be renovated (D-102); the Moving Truck turns the piece it carries (as the
    // Rotate button does: Hand.tsx).
    const pack = sel?.kind === 'piece' && !!CONTENT.pieces[sel.id].pack;
    const turns =
      (sel?.kind === 'piece' && !pack && pending?.t !== 'renovate') ||
      (sel?.kind === 'tool' && movingUid.value !== null);
    const click = pack
      ? pending
        ? 'add or take off a tile'
        : 'the first tile'
      : pending
        ? 'move it'
        : renovateUids.value.length > 0
          ? 'place, or renovate an outlined room'
          : 'place';
    hints = (
      <>
        {turns && <Hint keys={['R']}>rotate</Hint>}
        <Hint keys={['Click']} extra>
          {click}
        </Hint>
        <Hint keys={['Enter']}>{pending?.t === 'renovate' ? 'renovate it' : 'end the week'}</Hint>
        <Hint keys={['Esc']}>
          {pack && pending ? 'clear the tiles' : pending ? 'pick it up' : 'put it back'}
        </Hint>
      </>
    );
  } else {
    // The hand's cards are numbered across its rows (D-121), keys 1–9: one keycap for all of
    // them, as narrow as the old "1 2 3".
    const cards = Math.min(9, s.hand.length);
    hints = (
      <>
        {cards > 0 && <Hint keys={[cards > 1 ? `1–${cards}` : '1']}>pick a card</Hint>}
        <Hint keys={['D']}>demolish</Hint>
        {roofed(s) ? (
          <RoofHint short />
        ) : (
          <Hint keys={['Scroll']} extra>
            zoom
          </Hint>
        )}
        <FitHint short />
        <Hint keys={['Enter']}>pass</Hint>
      </>
    );
  }
  return <footer class="hints ui">{hints}</footer>;
}
