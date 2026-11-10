// The celebration ladder's pieces on the score panel and the screen (§12, D-124). The director
// plays each tier's sounds and bursts (particles.ts); this draws what stays a moment:
// - The pile, from Combolands: from a Good week up, the week's best pieces fly off the board into
//   a stack beside the score panel, more for a bigger tier, a little tower for a Huge week. Each
//   is the piece's own picture (PieceArt). It fades once it has stood a moment.
// - The wash: a Great or Huge week warms the whole screen for a moment, and a Huge week opens
//   with one soft white flash (none with Flashing off, D-125).
// Reduce motion keeps the wash's tint and drops the pile's flight.

import { useEffect, useRef, useState } from 'preact/hooks';
import { celebration, played, wash, type PileBlock } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import type { Tier } from '../fx/ladder.ts';
import { settings } from '../settings.ts';
import { PieceArt } from './PieceArt.tsx';

/** A block's size in the stack, and how much each one overlaps the one under it. */
const BLOCK = 30;
const RISE = 22;

interface Shown {
  id: number;
  tier: Tier;
  /** Where the stack stands, in viewport px: its bottom middle. */
  base: { x: number; y: number };
  blocks: readonly PileBlock[];
}

/** The pile, anchored beside the score panel's Wow. */
export function Celebration() {
  const c = celebration.value;
  const anchor = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  useEffect(() => {
    if (!c || c.id <= played.celebration || c.pile.length === 0) return;
    played.celebration = c.id;
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    setShown({ id: c.id, tier: c.tier, base: { x: r.left, y: r.top }, blocks: c.pile });
    const p = FEEL.pile;
    const ms = p.flyMs + p.staggerMs * c.pile.length + p.holdMs + p.fadeMs;
    const t = setTimeout(() => setShown((s) => (s?.id === c.id ? null : s)), ms);
    return () => clearTimeout(t);
  }, [c?.id]);
  const still = settings.value.reduceMotion;
  const p = FEEL.pile;
  return (
    <div class="celebration-anchor" ref={anchor} aria-hidden="true">
      {shown && (
        <div
          class={`pile tier-${shown.tier}`}
          key={shown.id}
          style={{
            left: `${shown.base.x}px`,
            top: `${shown.base.y}px`,
            '--pile-fade-at': `${p.flyMs + p.staggerMs * shown.blocks.length + p.holdMs}ms`,
            '--pile-fade': `${p.fadeMs}ms`,
          }}
        >
          {shown.blocks.map((b, k) => {
            // Stacked from the bottom, each a little off the one under it, as a pile is.
            const to = { x: (k % 2 ? 1 : -1) * ((k * 3) % 7), y: -k * RISE };
            const from = b.at
              ? { x: b.at.x - shown.base.x, y: b.at.y - shown.base.y }
              : { x: -160, y: 40 };
            return (
              <span
                key={b.uid}
                class="pile-block"
                style={{
                  '--to-x': `${to.x - BLOCK / 2}px`,
                  '--to-y': `${to.y - BLOCK}px`,
                  '--from-x': `${(still ? to.x : from.x) - BLOCK / 2}px`,
                  '--from-y': `${(still ? to.y : from.y) - BLOCK}px`,
                  '--tilt': `${(k % 3) - 1}deg`,
                  animationDelay: `${k * p.staggerMs}ms`,
                  animationDuration: `${p.flyMs}ms`,
                  zIndex: k,
                }}
              >
                <PieceArt id={b.defId} class="pile-art" />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A Great or Huge week's wash over the screen (and a Huge week's flash), played once. */
export function TierWash() {
  const w = wash.value;
  const [shown, setShown] = useState<{ id: number; tier: Tier } | null>(null);
  useEffect(() => {
    if (!w || w.id <= played.wash) return;
    played.wash = w.id;
    setShown(w);
    const t = setTimeout(() => setShown((s) => (s?.id === w.id ? null : s)), FEEL.ladder.warmMs);
    return () => clearTimeout(t);
  }, [w?.id]);
  if (!shown) return null;
  return (
    <div
      class={`tier-wash tier-${shown.tier}`}
      key={shown.id}
      style={{ '--wash-ms': `${FEEL.ladder.warmMs}ms`, '--flash-ms': `${FEEL.ladder.flashMs}ms` }}
      aria-hidden="true"
    />
  );
}
