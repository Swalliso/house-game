// The budget, counting coin by coin when it changes (§12, Shop and crates): a coin sound for
// each one earned, faster for big amounts, and one jump above FEEL.budget.jumpAbove, shown as
// a single "+N". Spending counts down quickly and quietly. Reduce motion and the instant tally
// show it at once, a gain with its "+N". The top bar and the shop's header both count, so the
// header's is `quiet`: the coins aren't doubled.

import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/audio.ts';
import { instantTally } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { budgetStepMs } from '../fx/juice.ts';
import { formatNumber } from '../format.ts';
import { settings } from '../settings.ts';
import './budget.css';

let jumps = 0;

export function BudgetCount({ value, quiet = false }: { value: number; quiet?: boolean }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const [bump, setBump] = useState<'up' | 'down' | null>(null);
  const [jump, setJump] = useState<{ id: number; n: number } | null>(null);
  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    const diff = value - from;
    const n = Math.abs(diff);
    setBump(diff > 0 ? 'up' : 'down');
    const settle = () => {
      shownRef.current = value;
      setShown(value);
      setTimeout(() => setBump(null), FEEL.budget.bumpMs);
    };
    const step = budgetStepMs(diff, settings.value.reduceMotion || instantTally.value);
    if (step === null) {
      if (diff > 0) {
        if (!quiet) audio.play('coin', { rate: 1.1 });
        setJump({ id: ++jumps, n });
      }
      settle();
      return;
    }
    let k = 0;
    const timer = setInterval(() => {
      k++;
      const cur = from + Math.sign(diff) * k;
      shownRef.current = cur;
      setShown(cur);
      if (diff > 0 && !quiet) audio.play('coin', { rate: 1 + Math.min(k, 12) * 0.05 });
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
  // A jump's "+N" shows for a moment, then goes.
  useEffect(() => {
    if (!jump) return;
    const t = setTimeout(() => setJump(null), FEEL.budget.jumpMs);
    return () => clearTimeout(t);
  }, [jump?.id]);
  return (
    <span class="budget-wrap">
      <strong class={`budget-count ${bump ?? ''}`} aria-label={`${value} budget`}>
        {formatNumber(shown)}
      </strong>
      {jump && (
        <span
          key={jump.id}
          class="budget-jump"
          aria-hidden="true"
          style={{ animationDuration: `${FEEL.budget.jumpMs}ms` }}
        >
          +{formatNumber(jump.n)}
        </span>
      )}
    </span>
  );
}
