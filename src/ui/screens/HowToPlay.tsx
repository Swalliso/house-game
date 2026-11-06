// How to play: one short, scannable sheet, from the title screen or the game. The numbers
// (hand size, rerolls, demolitions, overtime, the fenced yard's size) come from the rules, so
// the text keeps up with balance changes.

import './title.css';
import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { CONTENT, rules, SCORE_LABELS } from '../../rules/index.ts';
import { howToPlayOpen } from '../hud/actions.ts';
import { run } from '../store.ts';

/** Rendered always; it shows itself while howToPlayOpen is set. */
export function HowToPlay() {
  return howToPlayOpen.value ? <HowToPlayDialog /> : null;
}

const close = () => (howToPlayOpen.value = false);

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function HowToPlayDialog() {
  const dialog = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  /** Whether the press began on the backdrop, so a drag out of the sheet doesn't close it. */
  const downOnBackdrop = useRef(false);

  // Focus the text, so the arrow keys and Page Down scroll it, and give focus back on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    body.current?.focus({ preventScroll: true });
    return () => {
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    // Keys typed in the sheet stay in the sheet: they never pick cards or end the week.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // Keep Tab inside the sheet.
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (
        e.shiftKey &&
        (document.activeElement === first || !items.includes(document.activeElement as HTMLElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      class="modal-backdrop"
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) close();
      }}
    >
      <div
        ref={dialog}
        class="modal howto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        onKeyDown={onKeyDown}
      >
        <header class="howto-head">
          <h2 id="howto-title">How to play</h2>
          <button
            type="button"
            class="howto-x"
            onClick={close}
            aria-label="Close"
            title="Close (Esc)"
          >
            ✕
          </button>
        </header>
        <div class="howto-body" ref={body} tabIndex={-1}>
          <HowToPlayText />
        </div>
        <div class="modal-buttons">
          <button type="button" class="primary" onClick={close}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="howto-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** "the A or the B" from a list of names. */
function either(names: readonly string[]): string {
  const the = names.map((n) => `the ${n}`);
  if (the.length <= 1) return the[0] ?? '';
  return `${the.slice(0, -1).join(', ')} or ${the[the.length - 1]}`;
}

const CONTROLS: readonly (readonly [keys: string, does: string])[] = [
  ['1–3', 'Pick a card'],
  ['R or right-click', 'Rotate'],
  ['Click', 'Place'],
  ['Enter', 'End week'],
  ['D', 'Demolish'],
  ['Mouse wheel', 'Zoom'],
  ['Drag', 'Pan'],
  ['F', 'Fit the lot'],
  ['Hold Space', 'Speed up the tally'],
  ['Click', 'Skip the tally'],
  ['Esc', 'Cancel'],
];

function HowToPlayText() {
  const s = run.value;
  const b = CONTENT.balance;
  const phases = b.phases;
  const hand = rules.rule(s, 'handSize');
  const rerolls = rules.rule(s, 'rerollsPerPhase');
  const demolitions = rules.rule(s, 'demolitions');
  const overtime = rules.rule(s, 'overtime');
  const crew = CONTENT.crews[s.setup.crewId]?.name;
  const sets = either(Object.values(CONTENT.sets).map((set) => set.name));
  const L = SCORE_LABELS;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <>
      <Section title="The goal">
        <p>
          Build one house for one client. The build has {phases.length} milestones of{' '}
          {b.weeksPerPhase} weeks each:
        </p>
        <ol class="howto-phases">
          {phases.map((p) => (
            <li key={p.name}>{p.name}</li>
          ))}
        </ol>
        <p>
          Each milestone has a <span class="howto-wow">{L.total}</span> target. Reach it by the
          milestone's last week to move on.
        </p>
      </Section>

      <Section title="A week">
        <ul>
          <li>
            Pick 1 of {hand} cards, place it on the lot, then press <b>End week</b>.
          </li>
          <li>Every piece you've built earns again every week, so early pieces keep paying.</li>
          <li>
            Nothing helps? <b>Pass</b>: press End week twice to place nothing.
          </li>
        </ul>
      </Section>

      <Section title="Scoring">
        <p class="howto-formula">
          <span class="howto-comfort">{L.points}</span> × <span class="howto-charm">{L.mult}</span>{' '}
          = <span class="howto-wow">{L.total}</span>
        </p>
        <ul>
          <li>
            Each week your pieces' {L.points} is multiplied by {L.mult} and added to your {L.total}.
          </li>
          <li>Pieces earn (or lose) {L.points} from what they touch.</li>
          {sets && (
            <li>
              Sets, like {sets}, add {L.points} and {L.mult}.
            </li>
          )}
          <li>Hover a piece or a tile to see what it earns, and why.</li>
        </ul>
      </Section>

      <Section title="The lot">
        <ul>
          <li>
            <b>Trees</b> are Quiet and give views.
          </li>
          <li>
            <b>The pond and the creek</b> give views.
          </li>
          <li>
            <b>The street</b> is Loud.
          </li>
          <li>
            <b>The sunny side</b> is the brighter strip along one edge.
          </li>
          <li>
            <b>The front yard</b> is between the house and the street. The rest of the yard is the
            back yard.
          </li>
          <li>
            <b>A fenced yard</b> is an area closed in by Fences, the house, and the lot's edges. It
            must border a Fence and the house, have {b.fencedYardMin} or more tiles, and not touch
            the street. A house near a side or back edge needs fewer Fences.
          </li>
        </ul>
      </Section>

      <Section title="Free actions">
        <p class="muted">These don't use up your week.</p>
        <dl class="howto-actions">
          <dt>Reroll</dt>
          <dd>
            Swap your hand for new cards. {rerolls} per milestone
            {crew ? ` with the ${crew}` : ''}.
          </dd>
          <dt>Demolish</dt>
          <dd>
            Clear a piece or a boulder, with no refund. {demolitions} per run. It never splits the
            house in two.
          </dd>
          <dt>Complete early</dt>
          <dd>
            Once you've met the target, finish the milestone now. The weeks left play out on their
            own (your house keeps earning), and you get a bonus.
          </dd>
          <dt>Auto-complete</dt>
          <dd>Turn it on and every milestone completes early as soon as its target is met.</dd>
        </dl>
      </Section>

      <Section title="Budget and the shop">
        <ul>
          <li>
            You earn budget at each milestone ({b.milestoneBudget}), for each week saved by
            completing early, from economy pieces, and by selling goods back for half.
          </li>
          <li>
            After every milestone but the last, the shop opens. <b>Blueprints</b> bend the rules for
            the whole run. <b>Pieces</b> wait in your reserve; placing one is a week's build.{' '}
            <b>Fixtures</b> wait in your supplies and install for free.
          </li>
          <li>
            One good is on sale each visit. Refreshing costs a little more each time. Leave without
            buying and you get +{b.shop.skipReward} for saving up.
          </li>
          <li>
            <b>Fixtures</b> also turn up in your hand from the second milestone: installing one from
            the hand is your week's build. Each piece holds one; a new one replaces it.
          </li>
          <li>
            <b>Strike a card</b> (a shop service) and that card type never comes up again this run.
          </li>
        </ul>
      </Section>

      <Section title="Overtime">
        <p>
          Each run has {plural(overtime, 'overtime week')}. Miss a target and they're spent one at a
          time, each with its own hand, to catch up. If you're still short when they run out, the
          client walks and the run is over.
        </p>
      </Section>

      <Section title="Controls">
        <dl class="howto-keys">
          {CONTROLS.map(([keys, does]) => (
            <Fragment key={`${keys}-${does}`}>
              <dt>
                {keys.split(' or ').map((k, i) => (
                  <Fragment key={k}>
                    {i > 0 && ' or '}
                    <kbd>{k}</kbd>
                  </Fragment>
                ))}
              </dt>
              <dd>{does}</dd>
            </Fragment>
          ))}
        </dl>
      </Section>

      <Section title="Credits">
        <ul>
          <li>
            Art by{' '}
            <a href="https://limezu.itch.io/" target="_blank" rel="noreferrer">
              LimeZu
            </a>
            , from Modern Interiors and Modern Exteriors, with placeholders drawn for Open House.
          </li>
          <li>Sound effects made with ZzFX by Frank Force.</li>
        </ul>
      </Section>
    </>
  );
}
