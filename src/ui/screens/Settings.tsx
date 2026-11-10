// Settings (§12, Settings and accessibility, from M1): tally speed, Reduce motion, screen
// shake, volume, (M4) showing the first-time hints again (D-045), (M5a) the readable font, and
// (M5b) the music's own volume. Flashing comes with M5a's juice.
//
// M5a draws it as a wood sheet with the kit's pixel controls, grouped as the UI audit asked:
// the game, motion, sound, and the display.

import type { ComponentChildren } from 'preact';
import { FEEL } from '../fx/feel.ts';
import { settingsOpen } from '../hud/actions.ts';
import { resetHints, seenHints } from '../hud/FirstHints.tsx';
import { Button, Segmented, Sheet, Slider, Switch } from '../kit/kit.tsx';
import { settings, updateSettings } from '../settings.ts';
import './settings.css';

/**
 * Shows the first-time hints again. Its button goes disabled with nothing left to show, which
 * would drop the keyboard's place to the page, so focus moves on to the sheet's next control.
 */
function showHintsAgain(e: MouseEvent): void {
  const button = e.currentTarget as HTMLElement;
  if (document.activeElement === button) {
    const controls = [
      ...(button
        .closest('.sheet')
        ?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ) ?? []),
    ];
    controls[controls.indexOf(button) + 1]?.focus();
  }
  resetHints();
}

function Group({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="set-group">
      <h3 class="plank-tag set-title">{title}</h3>
      {children}
    </section>
  );
}

export function SettingsPanel() {
  if (!settingsOpen.value) return null;
  const s = settings.value;
  const close = () => (settingsOpen.value = false);
  return (
    <Sheet
      title="Settings"
      class="settings"
      onClose={close}
      footer={
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      }
    >
      <Group title="Game">
        <div class="set-row">
          <span class="set-label">Tally speed</span>
          <Segmented
            label="Tally speed"
            value={s.tallySpeed}
            onChange={(tallySpeed) => updateSettings({ tallySpeed })}
            options={FEEL.speeds.map((speed) => ({ value: speed, label: `${speed}×` }))}
          />
        </div>
        <p class="set-note">
          Hold Space or the right mouse button to speed up a tally; click to skip it.
        </p>
        <div class="set-row">
          <span class="set-label">First-time hints</span>
          <Button
            size="sm"
            disabled={seenHints.value.size === 0}
            onClick={showHintsAgain}
            title="Each first-time hint shows again when its moment comes"
          >
            Show them again
          </Button>
        </div>
      </Group>
      <Group title="Motion">
        <Switch
          class="set-switch"
          checked={s.reduceMotion}
          onChange={(reduceMotion) => updateSettings({ reduceMotion })}
        >
          Reduce motion
        </Switch>
        <p class="set-note">No wobble, shake, or confetti.</p>
        <Slider
          label="Screen shake"
          value={s.shake}
          onInput={(shake) => updateSettings({ shake })}
        />
      </Group>
      <Group title="Sound">
        <Slider
          label="Volume"
          value={s.masterVolume}
          onInput={(masterVolume) => updateSettings({ masterVolume })}
        />
        <Slider
          label="Music"
          value={s.musicVolume}
          onInput={(musicVolume) => updateSettings({ musicVolume })}
        />
        <Slider
          label="Sound effects"
          value={s.sfxVolume}
          onInput={(sfxVolume) => updateSettings({ sfxVolume })}
        />
      </Group>
      <Group title="Display">
        <div class="set-row">
          <span class="set-label">Text</span>
          <Segmented
            label="Text"
            value={s.readableFont ? 'readable' : 'pixel'}
            onChange={(v) => updateSettings({ readableFont: v === 'readable' })}
            options={[
              { value: 'pixel', label: 'Pixel font' },
              { value: 'readable', label: 'Readable font' },
            ]}
          />
        </div>
      </Group>
    </Sheet>
  );
}
