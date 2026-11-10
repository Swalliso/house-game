// The sun's chip (D-120): the side of the lot the sun shines from, with the Sunny rule on hover.
// Under the contract's map on the job board, and beside the crew on the checklist, so the sun's
// side is in view wherever the camera is.

import { CONTENT, glossary, sunSideText, type SunSide } from '../../rules/index.ts';
import { Chip } from '../kit/kit.tsx';
import { Tip } from './Tip.tsx';

const SUNNY = glossary(CONTENT).sunny;

/** "Sun at the back", "Sun on the left": where a lot's sun shines from. */
export function sunLabel(sun: SunSide): string {
  const side = sunSideText(sun);
  return sun === 'left' || sun === 'right' ? `Sun on the ${side}` : `Sun at the ${side}`;
}

/** The sun's chip: its icon, its side unless `iconOnly`, and the Sunny rule on hover. */
export function SunChip({ sun, iconOnly = false }: { sun: SunSide; iconOnly?: boolean }) {
  const label = sunLabel(sun);
  return (
    <Tip title={label} text={`${SUNNY.text} Here it shines from the ${sunSideText(sun)}.`}>
      <Chip tone="wood" icon="Sunny">
        {iconOnly ? <span class="check-sr">{label}</span> : label}
      </Chip>
    </Tip>
  );
}
