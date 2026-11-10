// How to play: one short, scannable sheet, from the title screen or the game. The numbers
// (the hand's rows, rerolls, demolitions, overtime, the fenced yard's size) come from the rules, so
// the text keeps up with balance changes.
//
// M5a draws it as a wood sheet: each section under a plank tag, the formula as the score
// panel's own plaques, each set as a picture of its pieces, the free actions with their
// icons, and the keys as keycaps.
//
// M4 (D-110): the client and their checklist (the house rules, the tastes, the household's
// arrivals), the crews, packs, Renovate, and change orders, with their numbers from the
// content and the glossary, and their keys under Controls.

import './howto.css';
import { Fragment, type ComponentChildren } from 'preact';
import {
  CONTENT,
  glossary,
  lotTraitText,
  multNumber,
  rules,
  SCORE_LABELS,
  type PieceId,
  type SetDef,
} from '../../rules/index.ts';
import { howToPlayOpen } from '../hud/actions.ts';
import { PieceArt } from '../hud/PieceArt.tsx';
import { Button, Icon, Keycap, Plaque, Sheet, type IconName } from '../kit/kit.tsx';
import { CREW_ICONS } from '../sprites.ts';
import { run } from '../store.ts';

const GLOSSARY = glossary(CONTENT);

/** Rendered always; it shows itself while howToPlayOpen is set. */
export function HowToPlay() {
  return howToPlayOpen.value ? <HowToPlayDialog /> : null;
}

const close = () => (howToPlayOpen.value = false);

/** The sheet's text takes focus, so the arrow keys and Page Down scroll it (Sheet). */
function HowToPlayDialog() {
  const onKeyDown = (e: KeyboardEvent) => {
    // Keys typed in the sheet stay in the sheet: they never pick cards or end the week.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <Sheet
      title="How to play"
      class="howto"
      onClose={close}
      onKeyDown={onKeyDown}
      footer={
        <Button variant="primary" onClick={close}>
          Got it
        </Button>
      }
    >
      <HowToPlayText />
    </Sheet>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: IconName;
  children: ComponentChildren;
}) {
  return (
    <section class="howto-section">
      <h3 class="plank-tag">
        {icon && <Icon name={icon} />}
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * A set drawn from its own data: its members side by side, as they'd stand on the lot, with
 * its hub in the middle (a Bathroom between two Bedrooms).
 */
function SetPicture({ set }: { set: SetDef }) {
  const all = (Object.entries(set.members) as [PieceId, number][]).flatMap(([id, n]) =>
    Array.from({ length: n }, () => id),
  );
  const others = set.hub ? all.filter((id) => id !== set.hub) : all;
  const half = Math.ceil(others.length / 2);
  const row = set.hub ? [...others.slice(0, half), set.hub, ...others.slice(half)] : all;
  return (
    <figure class="howto-set">
      <div class="howto-set-pieces">
        {row.map((id, k) => (
          <PieceArt key={k} id={id} />
        ))}
      </div>
      <figcaption>{set.name}</figcaption>
    </figure>
  );
}

/** "the A or the B" from a list of names. */
function either(names: readonly string[]): string {
  const the = names.map((n) => `the ${n}`);
  if (the.length <= 1) return the[0] ?? '';
  return `${the.slice(0, -1).join(', ')} or ${the[the.length - 1]}`;
}

/** "A, B, and C" from a list of names, as the rules' text lists them. */
function all(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

const CONTROLS: readonly (readonly [keys: string, does: string])[] = [
  ['1–4', 'Pick a card'],
  ['R or right-click', 'Rotate'],
  ['Click', 'Place'],
  // M4: a pack's tiles (D-106).
  ['Click a tile again', 'Take it off a Fence or Driveway'],
  ['Enter', 'End week'],
  ['D', 'Demolish'],
  ['Mouse wheel', 'Zoom'],
  ['Drag', 'Pan'],
  ['F', 'Fit the lot'],
  // D-133: the Roof button's key, once the Roofing milestone has put the roof on.
  ['T', 'Roof on or off, after Roofing'],
  ['Hold Space', 'Speed up the tally'],
  ['Click', 'Skip the tally'],
  ['Esc', 'Cancel'],
  // Playtest 4: Inspect holds a clicked piece (D-113).
  ['Click a piece', 'Hold it in Inspect (click again to let go)'],
  // M4: a change order's sheet (D-109).
  ['Enter', 'Accept a change order'],
  ['Esc or D', 'Decline a change order'],
];

function HowToPlayText() {
  const s = run.value;
  const b = CONTENT.balance;
  const phases = b.phases;
  const rooms = rules.rule(s, 'roomsRow');
  const layout = rules.rule(s, 'layoutRow');
  const rerolls = rules.rule(s, 'rerollsPerPhase');
  const demolitions = rules.rule(s, 'demolitions');
  const overtime = rules.rule(s, 'overtime');
  const crew = CONTENT.crews[s.setup.crewId]?.name;
  const sets = either(Object.values(CONTENT.sets).map((set) => set.name));
  const L = SCORE_LABELS;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  // M4: the client's checklist, packs, change orders, and the crews.
  const houseRules = CONTENT.clients[s.setup.clientId].specs.filter(
    (spec) => spec.group !== 'wishes',
  ).length;
  const perLine = multNumber(rules.rule(s, 'specBonus'));
  const fenceTiles = CONTENT.pieces.fence.pack?.maxTiles;
  const drivewayTiles = CONTENT.pieces.driveway.pack?.maxTiles;
  const orderMilestones = all(
    b.changeOrderAfter.flatMap((k) => (phases[k - 1] ? [phases[k - 1]!.name] : [])),
  );
  const pays = Object.values(CONTENT.changeOrders).flatMap((o) =>
    o.kind !== 'phase' && o.reward.budget ? [o.reward.budget] : [],
  );
  const [payLow, payHigh] = [Math.min(...pays), Math.max(...pays)];
  const crews = Object.values(CONTENT.crews).filter((c) => c.tier === 'core');

  return (
    <>
      <Section title="The goal" icon="House">
        <p>
          Build one house for one client. The build has {phases.length} milestones of{' '}
          {b.weeksPerPhase} weeks each:
        </p>
        <ol class="howto-phases">
          {phases.map((p, i) => (
            <li key={p.name}>
              <span class="howto-phase">
                {i === phases.length - 1 && <Icon name="flag" />}
                {p.name}
              </span>
              {i < phases.length - 1 && (
                <span class="howto-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p>
          Each milestone has a <b>{L.total}</b> target. Reach it by the milestone's last week to
          move on.
        </p>
      </Section>

      <Section title="A week" icon="clock">
        <ul>
          <li>
            Pick 1 of {rooms + layout} cards, place it on the lot, then press <b>End week</b>.
          </li>
          <li>
            Your cards come in two rows: {rooms} <b>Rooms</b> cards, and {layout} <b>Layout</b>{' '}
            cards (hallways, the Garage, the yard, and outbuildings). A card with nowhere to go is
            swapped for another from its row, free.
          </li>
          {fenceTiles && drivewayTiles && (
            <li>
              <b>A Fence or a Driveway</b> is a pack: click out its tiles one by one, up to{' '}
              {fenceTiles} Fence tiles, or {drivewayTiles} Driveway tiles that reach the street or a
              Driveway. Click a tile again to take it off. It builds as one piece.
            </li>
          )}
          <li>Every piece you've built earns again every week, so early pieces keep paying.</li>
          <li>
            Nothing helps? <b>Pass</b>: press End week twice to place nothing.
          </li>
        </ul>
      </Section>

      <Section title="Scoring" icon="sparkle">
        <p class="howto-formula" aria-label={`${L.points} × ${L.mult} = ${L.total}`}>
          <Plaque tone="comfort" icon="comfort">
            {L.points}
          </Plaque>
          <span class="howto-op" aria-hidden="true">
            ×
          </span>
          <Plaque tone="charm" icon="charm">
            {L.mult}
          </Plaque>
          <span class="howto-op" aria-hidden="true">
            =
          </span>
          <Plaque class="howto-wow">{L.total}</Plaque>
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
          <li>
            Hover a piece or a tile to see what it earns, and why. Click a piece to hold it there
            while you read.
          </li>
        </ul>
        <div class="howto-sets">
          {Object.values(CONTENT.sets).map((set) => (
            <SetPicture key={set.id} set={set} />
          ))}
        </div>
      </Section>

      <Section title="Your client" icon="check">
        <ul>
          <li>
            Start opens the job board: pick 1 of {b.jobBoard.contracts} clients, each with a lot of
            their own, then your crew.
          </li>
          <li>
            <b>Their checklist</b> starts with {houseRules} house rules (the household, the shape,
            the yard), folded into one row that opens with a click, then their own wishes. Each line
            adds +{perLine} {L.mult} in every week it holds. Hover a line to see what it needs.
          </li>
          <li>
            <b>Their tastes:</b> <Icon name="up" label="Likes" /> pieces they like earn more,{' '}
            <Icon name="down" label="Dislikes" /> ones they dislike earn less, and{' '}
            <Icon name="reroll" label="Draws" /> some come up more often.
          </li>
          <li>
            <b>Their household grows:</b> the job board says who moves in, and when. At the start of
            that phase, their cards wait in your reserve. Their room counts as a Bedroom, and Room
            for everyone needs it from then on.
          </li>
        </ul>
      </Section>

      <Section title="Your crew" icon="weekendCrew">
        <p class="howto-note">
          Picked after the client. It changes what you draw and what pays, all run.
        </p>
        <dl class="howto-actions">
          {crews.map((c) => (
            <Fragment key={c.id}>
              <dt>
                <Icon name={CREW_ICONS[c.id]} />
                {c.name}
              </dt>
              <dd>{c.blurb}</dd>
            </Fragment>
          ))}
        </dl>
      </Section>

      <Section title="Renovate" icon="star">
        <ul>
          <li>{GLOSSARY.renovate.text}</li>
          <li>
            While you hold such a card, the rooms it can renovate are outlined: click one, then End
            week. Inspect shows each room's level.
          </li>
        </ul>
      </Section>

      <Section title="The lot" icon="Outdoor">
        <ul>
          <li>
            <b>Trees</b> are Quiet and give views.
          </li>
          <li>
            <b>The pond and the creek</b> give views.
          </li>
          <li>
            <b>A creek lot</b> is marked {CONTENT.lotTraits.creekside.name} on the job board.{' '}
            {lotTraitText(CONTENT, CONTENT.lotTraits.creekside)}
          </li>
          <li>
            <b>The street</b> is Loud.
          </li>
          <li>
            <b>The sun</b> shines from one edge of the lot, marked on the board. A room, a Hallway
            or an outbuilding is Sunny when a wall of it faces the sun with no Tree or other
            building in front. Light falls on a Sunny room's floor.
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

      <Section title="Free actions" icon="hammer">
        <p class="howto-note">These don't use up your week.</p>
        <dl class="howto-actions">
          <dt>
            <Icon name="reroll" />
            Reroll
          </dt>
          <dd>
            New cards for one row, Rooms or Layout: {rerolls} per milestone
            {crew ? ` with the ${crew}` : ''}, shared by both rows.
          </dd>
          <dt>
            <Icon name="hammer" />
            Demolish
          </dt>
          <dd>
            Clear a piece or a boulder, with no refund. {demolitions} per run. It never splits the
            house in two.
          </dd>
          <dt>
            <Icon name="flag" />
            Complete early
          </dt>
          <dd>
            Once you've met the target, finish the milestone now. The weeks left play out on their
            own (your house keeps earning), and you get a bonus.
          </dd>
          <dt>
            <Icon name="clock" />
            Auto-complete
          </dt>
          <dd>Turn it on and every milestone completes early as soon as its target is met.</dd>
        </dl>
      </Section>

      <Section title="Budget and the shop" icon="coin">
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

      {orderMilestones && pays.length > 0 && (
        <Section title="Change orders" icon="mail">
          <ul>
            <li>
              After the {orderMilestones} milestones, before the shop, the client changes their
              mind.
            </li>
            <li>
              <b>A request or a restriction</b> runs through the next phase: see it through for +
              {payLow === payHigh ? payLow : `${payLow}–${payHigh}`} budget. Declining costs
              nothing.
            </li>
            <li>
              <b>A phase effect</b> can't be declined: it changes what earns until the next
              milestone.
            </li>
          </ul>
        </Section>
      )}

      <Section title="Overtime" icon="warn">
        <p>
          Each run has {plural(overtime, 'overtime week')}. Miss a target and they're spent one at a
          time, each with its own hand, to catch up. If you're still short when they run out, the
          client walks and the run is over.
        </p>
      </Section>

      <Section title="Controls" icon="menu">
        <dl class="howto-keys">
          {CONTROLS.map(([keys, does]) => (
            <Fragment key={`${keys}-${does}`}>
              <dt>
                {keys.split(' or ').map((k, i) => (
                  <Fragment key={k}>
                    {i > 0 && <span class="howto-or"> or </span>}
                    <Keycap>{k}</Keycap>
                  </Fragment>
                ))}
              </dt>
              <dd>{does}</dd>
            </Fragment>
          ))}
        </dl>
      </Section>

      <Section title="Credits" icon="star">
        <ul>
          <li>
            Art by{' '}
            <a href="https://limezu.itch.io/" target="_blank" rel="noreferrer">
              LimeZu
            </a>
            , from Modern Interiors and Modern Exteriors, with our own drawings in its palette.
          </li>
          <li>Fonts: Public Pixel by GGBotNet and Pixel Operator by Jayvee Enaguas, both CC0.</li>
          <li>
            Music: “Morning” and “Clear Air” by Kevin MacLeod (
            <a href="https://incompetech.com/" target="_blank" rel="noreferrer">
              incompetech.com
            </a>
            ), “
            <a
              href="https://opengameart.org/content/sleepy-little-mouse"
              target="_blank"
              rel="noreferrer"
            >
              Sleepy Little Mouse
            </a>
            ” by Tsorthan Grove and “
            <a
              href="https://freemusicarchive.org/music/Ketsa/lofi-downtempo/folded/"
              target="_blank"
              rel="noreferrer"
            >
              Folded
            </a>
            ” by Ketsa, licensed under{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            ; “On the road, looking at your feet” by Monplaisir and “Comfort Games 5” by HoliznaCC0,
            both CC0. All trimmed, levelled and re-encoded.
          </li>
          <li>
            Sound effects: instruments from the{' '}
            <a href="https://github.com/sgossner/VCSL" target="_blank" rel="noreferrer">
              Versilian Community Sample Library
            </a>{' '}
            and foley by{' '}
            <a href="https://kenney.nl/" target="_blank" rel="noreferrer">
              Kenney
            </a>
            , both CC0, and a few made with ZzFX by Frank Force.
          </li>
        </ul>
      </Section>
    </>
  );
}
