// D-181: a finished room's lamp coming on (FEEL.lightOn), as the board's lights layer animates
// it. Pure, so the tests can hold the flicker to the Flashing setting's promise: never more than
// three flashes a second, and none at all with it off.

import { FEEL } from './feel.ts';

export interface LightOn {
  readonly frames: Keyframe[];
  readonly ms: number;
  readonly easing: string;
}

/**
 * The light's keyframes as it comes on. With Flashing on, a switch's flicker: on at once, then
 * down to each of the dips and back up, evenly over `flickerMs`, each change a step (a lamp
 * doesn't fade between them). With it off, a fade in over `fadeMs`.
 */
export function lightOnFrames(flashing: boolean): LightOn {
  const f = FEEL.lightOn;
  if (!flashing) {
    return { frames: [{ opacity: 0 }, { opacity: 1 }], ms: f.fadeMs, easing: 'ease-out' };
  }
  const levels = [1, ...f.dips.flatMap((d) => [d, 1])];
  const frames: Keyframe[] = levels.map((opacity, i) => ({
    opacity,
    offset: i / levels.length,
    easing: 'step-end',
  }));
  frames.push({ opacity: 1, offset: 1 });
  return { frames, ms: f.flickerMs, easing: 'linear' };
}
