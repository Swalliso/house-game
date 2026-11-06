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
