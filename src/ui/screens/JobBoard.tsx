// The job board (implementation-plan.md §7 M4a and M4b; D-032, D-045): Start opens three
// contracts, each a client and a lot. A card shows who the client is, what they wish for, who
// moves in and when, their tastes, and a map of the lot with its traits (D-119: Creekside pays,
// so the lot can be a reason to take the job). Taking one opens the crew pick; hiring
// a crew starts the run. On a first visit, contract 0 is the Hendersons and the General
// Contractor is marked too, both "Recommended for your first job". The contracts come from the
// rules' jobBoard(), so the UI only renders them.
//
// In the pixel UI (D-110): a wood panel standing on the title's street (Title.tsx's
// TitleBackdrop), its cards the kit's paper Cards, rarity a band and a chip as in the shop. A
// card's middle scrolls and its button stays in view, so the board fits 1280×720 in the pixel
// font without the page scrolling. One lime button at most: the Recommended card's, on a first
// visit.

import './jobs.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  jobBoard,
  lotTraits,
  lotTraitText,
  modifierText,
  rules,
  specText,
  type ArrivalDef,
  type ClientDef,
  type Contract,
  type CrewDef,
  type CrewId,
  type Lot,
  type Modifier,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { FEEL } from '../fx/feel.ts';
import { anyModalOpen } from '../hud/actions.ts';
import { RARITY_LABEL } from '../hud/goods.tsx';
import { arrivalsOf, arrivalWeek, midName } from '../hud/household.ts';
import { PieceArt } from '../hud/PieceArt.tsx';
import { Tip } from '../hud/Tip.tsx';
import { SunChip } from '../hud/sun.tsx';
import { Button, Card, Chip, Icon, Keycap, Panel, type IconName } from '../kit/kit.tsx';
import { CREW_ICONS, LOT_TRAIT_ICONS } from '../sprites.ts';
import { appScreen, firstVisit, jobBoardSeed, takeContract } from '../store.ts';
import { LOT_COLORS, lotMapKind, lotMapSize, lotSummary } from './lot-map.ts';
import { TitleBackdrop } from './Title.tsx';

/** "the Hendersons", "Count Vladislav": the client mid-sentence. */
const fromName = (name: string) => name.replace(/^The\s/, 'the ');

export function JobBoard() {
  const seed = jobBoardSeed.value;
  const visit = useMemo(() => firstVisit(), [seed]);
  const contracts = useMemo(() => jobBoard(CONTENT, seed, { firstVisit: visit }), [seed, visit]);
  // Step 2 (D-045): the crew for the contract taken.
  const [taken, setTaken] = useState<Contract | null>(null);
  const list = useRef<HTMLOListElement>(null);

  // The first card's button takes focus as the board arrives and at each step, so Enter takes
  // it (the Recommended one, on a first visit). It's a screen, like the title, not a sheet: Tab
  // isn't held in it.
  useEffect(() => {
    list.current
      ?.querySelector<HTMLButtonElement>('.contract-take')
      ?.focus({ preventScroll: true });
  }, [seed, taken]);
  useEffect(() => setTaken(null), [seed]);

  const take = (c: Contract) => {
    audio.unlock();
    audio.play('select');
    setTaken(c);
  };
  const hire = (crewId: CrewId) => {
    if (!taken) return;
    audio.play('chime', { rate: 1.2 });
    takeContract(taken, crewId);
  };
  const back = () => (taken ? setTaken(null) : (appScreen.value = 'title'));
  const crews = Object.values(CONTENT.crews).filter((c) => c.tier === 'core');

  // 1–3 take a contract (or hire a crew); Esc goes back a step (unless a sheet is open: Esc
  // closes that first, in App's useModalKeys, which marks the key as handled).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || anyModalOpen()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A held key acts once. Enter's repeats would press the button each step focuses: held
      // from the title's Start, it would take contract 1 and hire a crew before either is read.
      if (e.repeat) {
        if (e.key === 'Enter') e.preventDefault();
        return;
      }
      const n = Number(e.key);
      const count = taken ? crews.length : contracts.length;
      if (Number.isInteger(n) && n >= 1 && n <= count) {
        e.preventDefault();
        if (taken) hire(crews[n - 1]!.id);
        else take(contracts[n - 1]!);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contracts, taken]);

  const client = taken ? CONTENT.clients[taken.clientId] : null;
  const count = client ? crews.length : contracts.length;
  return (
    <TitleBackdrop class="jobs-screen">
      <main
        class="jobs-stage"
        aria-labelledby="jobs-title"
        style={{ '--jobs-in': `${FEEL.jobs.inMs}ms` }}
      >
        <Panel
          class="jobs-panel"
          title={<span id="jobs-title">{client ? 'Pick your crew' : 'The job board'}</span>}
          head={<Chip tone="inset">{`Step ${client ? 2 : 1} of 2`}</Chip>}
          bodyClass="jobs-body"
        >
          <p class="jobs-lede">
            {client
              ? `For ${fromName(client.name)}. A crew changes what you draw and what pays, all run.`
              : 'Pick a client. Each job is one house, on one lot, for them.'}
          </p>
          <ol class="jobs-list" ref={list}>
            {client
              ? crews.map((crew, i) => (
                  <CrewCard
                    key={crew.id}
                    crew={crew}
                    index={i}
                    recommended={visit && crew.id === 'generalContractor'}
                    onHire={() => hire(crew.id)}
                  />
                ))
              : contracts.map((c, i) => (
                  <ContractCard key={c.seed} contract={c} index={i} onTake={() => take(c)} />
                ))}
          </ol>
          <footer class="jobs-foot">
            <Button
              onClick={back}
              title={client ? 'Back to the job board (Esc)' : 'Back to the title (Esc)'}
            >
              Back
            </Button>
            <p class="jobs-keys">
              <span class="jobs-key">
                {Array.from({ length: count }, (_, i) => (
                  <Keycap key={i}>{i + 1}</Keycap>
                ))}
                <span>{client ? 'hire a crew' : 'take a job'}</span>
              </span>
              <span class="jobs-key">
                <Keycap>Esc</Keycap>
                <span>go back</span>
              </span>
            </p>
          </footer>
        </Panel>
      </main>
    </TitleBackdrop>
  );
}

/** The gold tab on a card's top edge: the first visit's pick. */
function RecommendedTag() {
  return (
    <span class="contract-tag" title="Recommended for your first job">
      <Icon name="star" />
      Recommended
    </span>
  );
}

/** The card's stagger, as it's pinned up (FEEL.jobs). */
const beat = (index: number) => ({ '--beat': `${index * FEEL.jobs.staggerMs}ms` });

/** A crew (D-012, D-109): its icon, what it does all run, and the cards it starts with. */
function CrewCard(props: {
  crew: CrewDef;
  index: number;
  recommended: boolean;
  onHire: () => void;
}) {
  const { crew, index } = props;
  const starts = crew.startReserve ?? [];
  return (
    <li class="jobs-item">
      <Card
        as="article"
        class="contract crew"
        lead={<Keycap>{index + 1}</Keycap>}
        title={crew.name}
        art={<Icon name={CREW_ICONS[crew.id]} class="crew-icon" />}
        note={crew.blurb}
        style={beat(index)}
        aria-label={crew.name}
      >
        {props.recommended && <RecommendedTag />}
        <div class="contract-scroll">
          <section class="contract-section">
            <h3>All run</h3>
            <ul class="contract-tastes">
              {crew.modifiers.map((m, i) => (
                <TasteLine key={i} icon="up" label="Helps" text={modifierText(CONTENT, m)} />
              ))}
            </ul>
          </section>
          {starts.length > 0 && (
            <section class="contract-section">
              <h3>Starts with</h3>
              <ul class="crew-starts">
                {starts.map((id) => (
                  <li key={id}>
                    <span
                      class={`pcard-art ${CONTENT.pieces[id].category === 'indoor' ? '' : 'yard'}`}
                    >
                      <PieceArt id={id} />
                    </span>
                    <span>{CONTENT.pieces[id].name}</span>
                  </li>
                ))}
              </ul>
              <p class="contract-quiet">In your reserve from week 1.</p>
            </section>
          )}
        </div>
        <div class="contract-foot">
          <Button
            block
            variant={props.recommended ? 'primary' : 'secondary'}
            class="contract-take"
            onClick={props.onHire}
            aria-label={`Hire this crew: ${crew.name}`}
          >
            Hire this crew
          </Button>
        </div>
      </Card>
    </li>
  );
}

function ContractCard(props: { contract: Contract; index: number; onTake: () => void }) {
  const { contract, index } = props;
  const client = CONTENT.clients[contract.clientId];
  // The lot this contract's seed makes: the run's own lot, drawn small.
  const lot = useMemo(
    () =>
      rules.newRun({
        seed: contract.seed,
        clientId: contract.clientId,
        crewId: 'generalContractor',
        mode: 'standard',
      }).house.lot,
    [contract.seed, contract.clientId],
  );
  const household = client.specs.find((s) => s.id === 'roomForEveryone');
  const arrivals = arrivalsOf(contract.clientId);
  const wishes = client.specs.filter((s) => s.group === 'wishes');
  const houseRules = client.specs.filter((s) => s.group !== 'wishes');
  return (
    <li class="jobs-item">
      <Card
        as="article"
        class="contract"
        rarity={client.rarity}
        lead={<Keycap>{index + 1}</Keycap>}
        title={client.name}
        // The rarity as a plain chip: RarityTag's tip explains the shop's goods.
        aside={<Chip tone={client.rarity}>{RARITY_LABEL[client.rarity]}</Chip>}
        style={beat(index)}
        aria-label={client.name}
      >
        {contract.recommended && <RecommendedTag />}
        <div class="contract-scroll">
          <p class="contract-brief">{client.brief}</p>
          <div class="contract-top">
            <LotMap lot={lot} />
            <div class="contract-top-text">
              <section class="contract-section">
                <h3>Wishes</h3>
                <ul class="pcard-lines">
                  {wishes.map((w) => (
                    <li key={w.id}>
                      <Tip title={w.name} text={specText(CONTENT, w)}>
                        {w.name}
                      </Tip>
                    </li>
                  ))}
                </ul>
              </section>
              {(household || arrivals.length > 0) && (
                <section class="contract-section">
                  <h3>Household</h3>
                  {household && (
                    <p>
                      <Tip title={household.name} text={specText(CONTENT, household)}>
                        {bedroomsText(client)}
                      </Tip>
                    </p>
                  )}
                  {arrivals.length > 0 && <MovingIn arrivals={arrivals} />}
                </section>
              )}
            </div>
          </div>
          <LotTraits lot={lot} client={client} />
          {/* The map in words; its title and label say it too, so a short window drops it. */}
          <p class="contract-lot-note">{lotSummary(lot)}</p>
          <section class="contract-section">
            <h3>Tastes</h3>
            <Tastes client={client} />
          </section>
          <details class="contract-rules">
            <summary>
              <Icon name="caretRight" class="caret-closed" />
              <Icon name="caretDown" class="caret-open" />
              House rules ({houseRules.length})
            </summary>
            <ul class="pcard-lines">
              {houseRules.map((s) => (
                <li key={s.id}>
                  <Tip title={s.name} text={specText(CONTENT, s)}>
                    {s.name}
                  </Tip>
                </li>
              ))}
            </ul>
          </details>
        </div>
        <div class="contract-foot">
          <Button
            block
            variant={contract.recommended ? 'primary' : 'secondary'}
            class="contract-take"
            onClick={props.onTake}
            aria-label={`Take the job: ${client.name}`}
          >
            Take the job
          </Button>
        </div>
      </Card>
    </li>
  );
}

/**
 * Who moves in mid-run (M4b, D-103), and when: "Moving in: the twins at Framing (week 9),
 * Grandma at Drywall (week 17)". Each name's tip says what they bring.
 */
function MovingIn({ arrivals }: { arrivals: readonly ArrivalDef[] }) {
  return (
    <p class="contract-arrivals">
      <strong>Moving in:</strong>{' '}
      {arrivals.map((a, k) => (
        <span key={a.id}>
          {k > 0 ? ', ' : ''}
          <Tip title={a.name} text={a.text}>
            {midName(a)}
          </Tip>{' '}
          at {rules.phaseName(a.phase)} (week {arrivalWeek(a)})
        </span>
      ))}
      .
    </p>
  );
}

/**
 * The lot's sun (D-120) and traits (D-119), a chip each under the map, their tips the Sunny rule,
 * what a trait pays and what the lot is like. A trait that suits the client (Wooded, for the
 * Count) wears the up icon, as a taste they like does. A short window keeps them: Creekside's
 * +50% is worth seeing.
 */
function LotTraits({ lot, client }: { lot: Lot; client: ClientDef }) {
  const traits = lotTraits(CONTENT, lot);
  const who = fromName(client.name);
  return (
    <ul class="contract-traits" aria-label="The lot">
      <li>
        <SunChip sun={lot.sun} />
      </li>
      {traits.map((t) => {
        const suits = t.suits?.includes(client.id) ?? false;
        const text = lotTraitText(CONTENT, t) + (suits ? ` A good lot for ${who}.` : '');
        return (
          <li key={t.id}>
            <Tip title={t.name} text={text}>
              <Chip tone="wood" icon={LOT_TRAIT_ICONS[t.id]}>
                {t.name}
                {suits && <Icon name="up" label={`Suits ${who}`} />}
              </Chip>
            </Tip>
          </li>
        );
      })}
    </ul>
  );
}

/** "2–3 Bedrooms to start": the household's opening range (the full rule is in its tip). */
function bedroomsText(client: ClientDef): string {
  const [min, max] = client.household.bedrooms;
  return `${min === max ? min : `${min}–${max}`} Bedrooms to start`;
}

/** Whether a taste helps (a like, a bonus) or hurts (a dislike). */
function helps(mod: Modifier): boolean {
  if (mod.kind === 'earnNothing' || mod.kind === 'removeTag') return false;
  if ('pct' in mod && typeof mod.pct === 'number') return mod.pct >= 0;
  if ('add' in mod && typeof mod.add === 'number') return mod.add >= 0;
  return true;
}

/** A line with its mark: up for a like, down for a dislike, the die for what's drawn more. */
function TasteLine({
  icon,
  label,
  text,
  quiet = false,
}: {
  icon: IconName;
  label: string;
  text: string;
  quiet?: boolean;
}) {
  return (
    <li class={quiet ? 'quiet' : undefined}>
      <span class="taste-mark">
        <Icon name={icon} label={label} />
      </span>
      <span>{text}</span>
    </li>
  );
}

function Tastes({ client }: { client: ClientDef }) {
  return (
    <ul class="contract-tastes">
      {client.tastes.map((m, i) => {
        const good = helps(m);
        return (
          <TasteLine
            key={`t${i}`}
            icon={good ? 'up' : 'down'}
            label={good ? 'Likes' : 'Dislikes'}
            text={modifierText(CONTENT, m)}
          />
        );
      })}
      {/* The client's pool: what comes up more often in the draws. */}
      {client.pool.map((m, i) => (
        <TasteLine
          key={`p${i}`}
          icon="reroll"
          label="Draws"
          text={modifierText(CONTENT, m)}
          quiet
        />
      ))}
    </ul>
  );
}

/**
 * The lot, one canvas pixel per tile with the street a row below it (lot-map.ts), drawn at
 * --map-px per tile in an ink ring. Its summary in words is its title and its label.
 */
function LotMap({ lot }: { lot: Lot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = lotMapSize(lot);
  // Before the browser paints, so the map is never seen blank.
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = LOT_COLORS[lotMapKind(lot, x, y)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [lot]);
  const summary = lotSummary(lot);
  return (
    <span class="contract-map" title={summary}>
      <canvas
        ref={ref}
        width={w}
        height={h}
        style={{ '--lot-w': String(w), '--lot-h': String(h) }}
        role="img"
        aria-label={`The lot: ${summary}`}
      />
    </span>
  );
}
