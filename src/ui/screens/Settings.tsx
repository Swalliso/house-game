// Settings (§12, Settings and accessibility, from M1): tally speed, Reduce motion, screen
// shake, volume, and (M5a) the readable font. Flashing and the music slider come with M5.

import { FEEL } from '../fx/feel.ts';
import { settingsOpen } from '../hud/actions.ts';
import { settings, updateSettings } from '../settings.ts';

function Slider({
  label,
  value,
  onInput,
}: {
  label: string;
  value: number;
  onInput: (v: number) => void;
}) {
  return (
    <label class="slider">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
      />
      <span class="value">{value}</span>
    </label>
  );
}

export function SettingsPanel() {
  if (!settingsOpen.value) return null;
  const s = settings.value;
  const close = () => (settingsOpen.value = false);
  return (
    <div class="modal-backdrop" onClick={close}>
      <div
        class="modal settings"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Settings</h2>
        <fieldset>
          <legend>Tally speed</legend>
          <div class="segmented">
            {FEEL.speeds.map((speed) => (
              <button
                key={speed}
                type="button"
                class={s.tallySpeed === speed ? 'on' : ''}
                aria-pressed={s.tallySpeed === speed}
                onClick={() => updateSettings({ tallySpeed: speed })}
              >
                {speed}×
              </button>
            ))}
          </div>
          <p class="muted">
            Hold Space or the right mouse button to speed up a tally; click to skip it.
          </p>
        </fieldset>
        <label class="toggle">
          <input
            type="checkbox"
            checked={s.reduceMotion}
            onChange={(e) =>
              updateSettings({ reduceMotion: (e.target as HTMLInputElement).checked })
            }
          />
          <span>Reduce motion</span>
          <span class="muted"> (no wobble, shake, or confetti)</span>
        </label>
        <fieldset>
          <legend>Text</legend>
          <div class="segmented" role="group" aria-label="Text">
            <button
              type="button"
              class={s.readableFont ? '' : 'on'}
              aria-pressed={!s.readableFont}
              onClick={() => updateSettings({ readableFont: false })}
            >
              Pixel font
            </button>
            <button
              type="button"
              class={s.readableFont ? 'on' : ''}
              aria-pressed={s.readableFont}
              onClick={() => updateSettings({ readableFont: true })}
            >
              Readable font
            </button>
          </div>
        </fieldset>
        <Slider
          label="Screen shake"
          value={s.shake}
          onInput={(shake) => updateSettings({ shake })}
        />
        <Slider
          label="Volume"
          value={s.masterVolume}
          onInput={(masterVolume) => updateSettings({ masterVolume })}
        />
        <Slider
          label="Sound effects"
          value={s.sfxVolume}
          onInput={(sfxVolume) => updateSettings({ sfxVolume })}
        />
        <div class="modal-buttons">
          <button type="button" class="primary" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
