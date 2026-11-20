// The interface's look (M5a): the tokens, the pixel fonts, the primitives' styles, the UI
// pixel, and the frames and icons. Imported first by main.tsx, so every stylesheet after it
// can use the tokens, and the primitives come before the components that adjust them.

import './tokens.css';
import './fonts.css';
import '../kit/kit.css';
import { FEEL } from '../fx/feel.ts';
import { applyArt } from './art.ts';
import { applyUiPixel } from './pixel.ts';

applyUiPixel();
applyArt();

// The chrome's own motion (hover lifts, presses, sheets), from feel.ts like every timing.
const style = document.documentElement.style;
for (const [name, ms] of Object.entries(FEEL.chrome)) style.setProperty(`--dur-${name}`, `${ms}ms`);
style.setProperty('--dur-shop-pop', `${FEEL.shop.popMs}ms`);
style.setProperty('--dur-shop-turn', `${FEEL.shop.turnMs}ms`);
style.setProperty('--dur-shop-shimmer', `${FEEL.shop.shimmerMs}ms`);
style.setProperty('--dur-last-week-tag', `${FEEL.lastWeekTagMs}ms`);
// D-157: the strike's stamp, the struck card going, and the new one coming in (hand.css).
style.setProperty('--dur-strike-stamp', `${FEEL.strike.stampInMs}ms`);
style.setProperty('--dur-strike-out', `${FEEL.strike.outMs}ms`);
style.setProperty('--dur-strike-in', `${FEEL.strike.inMs}ms`);
style.setProperty('--strike-thump', String(FEEL.strike.thumpScale));
style.setProperty('--strike-drop', String(FEEL.strike.dropPx));
style.setProperty('--strike-tilt', `${FEEL.strike.tiltDeg}deg`);
style.setProperty('--strike-from', String(FEEL.strike.fromPx));
// D-186: the pushpin stabbing in, and a hand dealt around a kept card (hand.css).
style.setProperty('--dur-pin-stick', `${FEEL.pin.stickMs}ms`);
style.setProperty('--pin-stick-from', String(FEEL.pin.stickPx));
style.setProperty('--dur-deal', `${FEEL.pin.dealMs}ms`);
style.setProperty('--dur-deal-stagger', `${FEEL.pin.staggerMs}ms`);
style.setProperty('--deal-from', String(FEEL.pin.dealFromPx));
style.setProperty('--dur-kept-in', `${FEEL.pin.keptInMs}ms`);
