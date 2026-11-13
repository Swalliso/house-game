// The top bar says where the run is once (D-167): the plaque is the milestone and its week, and
// which milestone of the seven and the run's week are its tip. The forecast's number is the
// meter's tip. The Auto-complete switch shows beside Complete early while that's offered, and
// all the while it's on, so it can be turned off.

import { describe, expect, it } from 'vitest';
import { SCORE_LABELS } from '../../rules/index.ts';
import { autoSwitchShown, forecastTip, plaqueTip } from './TopBar.tsx';

describe('the top bar (D-167)', () => {
  it("puts the milestone's count and the run's week in the plaque's tip", () => {
    expect(plaqueTip(3, 7, 14, 28)).toBe("Milestone 4 of 7 · week 14 of the run's 28");
  });

  it("puts the forecast's number in the meter's tip, before what it is", () => {
    expect(forecastTip('5,853', 'A rough guide.')).toBe(
      `Forecast ~5,853 ${SCORE_LABELS.total}. A rough guide.`,
    );
  });

  it('shows the Auto switch with Complete early, and while it is on', () => {
    const base = { on: false, offered: false, over: false, early: true };
    // Most of a run: nothing offered, the switch off.
    expect(autoSwitchShown(base)).toBe(false);
    // Beside Complete early, when that's offered.
    expect(autoSwitchShown({ ...base, offered: true })).toBe(true);
    // Switched on, it stays, so it can be switched off.
    expect(autoSwitchShown({ ...base, on: true })).toBe(true);
    // Never once the run is over, nor before the first job brings Complete early in.
    expect(autoSwitchShown({ ...base, on: true, offered: true, over: true })).toBe(false);
    expect(autoSwitchShown({ ...base, on: true, offered: true, early: false })).toBe(false);
  });
});
