// The budget, counting coin by coin when it changes (§12, Shop and crates): a coin sound for
// each one earned, faster for big amounts, and one jump above FEEL.budget.jumpAbove. Spending
// counts down quickly and quietly. Reduce motion and the instant tally show it at once.

import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio.ts';
import { instantTally } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { formatNumber } from '../format.ts';
import { settings } from '../settings.ts';

export function BudgetCount({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const [bump, setBump] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    const diff = value - from;
    const n = Math.abs(diff);
    const f = FEEL.budget;
    setBump(diff > 0 ? 'up' : 'down');
    const settle = () => {
      shownRef.current = value;
      setShown(value);
      setTimeout(() => setBump(null), 250);
    };
    if (settings.value.reduceMotion || instantTally.value || n > f.jumpAbove) {
      if (diff > 0) audio.play('coin', { rate: 1.1 });
      settle();
      return;
    }
    const step =
      diff < 0
        ? f.fasterMs
        : n > f.fasterAbove
          ? f.fasterMs
          : n > f.fastAbove
            ? f.fastMs
            : f.coinMs;
    let k = 0;
    const timer = setInterval(() => {
      k++;
      const cur = from + Math.sign(diff) * k;
      shownRef.current = cur;
      setShown(cur);
      if (diff > 0) audio.play('coin', { rate: 1 + Math.min(k, 12) * 0.05 });
      if (k >= n) {
        clearInterval(timer);
        settle();
      }
    }, step);
    return () => {
      clearInterval(timer);
      shownRef.current = value;
    };
  }, [value]);
  return (
    <strong class={`budget-count ${bump ?? ''}`} aria-label={`${value} budget`}>
      {formatNumber(shown)}
    </strong>
  );
}
