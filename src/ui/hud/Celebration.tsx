// M1's one celebration tier (§12, The celebration ladder): a big week, at 2× pace or more,
// bursts confetti and coins from the score panel. Reduce motion swaps the burst for a glow.

import { useEffect, useRef, useState } from 'preact/hooks';
import { celebration, played } from '../fx/director.ts';
import { settings } from '../settings.ts';

const COLORS = ['#e8b04a', '#e06c8c', '#5b8fd6', '#7fbf6a', '#f2e3b3'];

interface Bit {
  id: number;
  dx: number;
  dy: number;
  spin: number;
  delay: number;
  color: string;
  coin: boolean;
}

export function Celebration() {
  const c = celebration.value;
  const anchor = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ x: 0, y: 0 });
  const [bits, setBits] = useState<Bit[]>([]);
  useEffect(() => {
    if (!c || settings.value.reduceMotion || c.id <= played.celebration) {
      setBits([]);
      return;
    }
    played.celebration = c.id;
    const r = anchor.current?.getBoundingClientRect();
    if (r) setAt({ x: r.left, y: r.top });
    const n = 46;
    const next: Bit[] = Array.from({ length: n }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      const dist = 90 + Math.random() * 150;
      return {
        id: c.id * 100 + i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        spin: (Math.random() - 0.5) * 720,
        delay: Math.random() * 120,
        color: COLORS[i % COLORS.length]!,
        coin: i % 5 === 0,
      };
    });
    setBits(next);
    const t = setTimeout(() => setBits([]), 1800);
    return () => clearTimeout(t);
  }, [c?.id]);
  return (
    <div class="celebration-anchor" ref={anchor} aria-hidden="true">
      {bits.length > 0 && (
        <div class="celebration" style={{ left: `${at.x}px`, top: `${at.y}px` }}>
          {bits.map((b) => (
            <span
              key={b.id}
              class={b.coin ? 'coin' : 'confetti'}
              style={{
                '--dx': `${b.dx}px`,
                '--dy': `${b.dy}px`,
                '--spin': `${b.spin}deg`,
                animationDelay: `${b.delay}ms`,
                background: b.coin ? undefined : b.color,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
