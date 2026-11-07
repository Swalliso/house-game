// The job board (implementation-plan.md §7 M4a and M4b; D-032, D-045): Start opens three
// contracts, each a client and a lot. A card shows who the client is, what they wish for, their
// tastes, and a schematic of the lot. Taking one opens the crew pick; hiring a crew starts the
// run. On a first visit, contract 0 is the Hendersons and the General Contractor is marked too,
// both "Recommended for your first job". The contracts come from the rules' jobBoard(), so the
// UI only renders them.

import './jobs.css';
import type { Ref } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  isSunny,
  jobBoard,
  modifierText,
  rules,
  specText,
  terrainAt,
  type ClientDef,
  type Contract,
  type CrewDef,
  type CrewId,
  type Lot,
  type Modifier,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { copyFallback, howToPlayOpen, settingsOpen } from '../hud/actions.ts';
import { RarityTag } from '../hud/goods.tsx';
import { Tip } from '../hud/Tip.tsx';
import { appScreen, firstVisit, jobBoardSeed, takeContract } from '../store.ts';
import { Street } from './Title.tsx';

export function JobBoard() {
  const seed = jobBoardSeed.value;
  const visit = useMemo(() => firstVisit(), [seed]);
  const contracts = useMemo(() => jobBoard(CONTENT, seed, { firstVisit: visit }), [seed, visit]);
  // Step 2 (D-045): the crew for the contract taken.
  const [taken, setTaken] = useState<Contract | null>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus({ preventScroll: true });
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
  // closes that first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen.value || howToPlayOpen.value || copyFallback.value) return;
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
  return (
    <div class="title-screen jobs-screen">
      <div class="title-sky">
        <main class="jobs-board" aria-labelledby="jobs-title">
          {client ? (
            <>
              <header class="jobs-header">
                <h1 id="jobs-title">Pick your crew</h1>
                <p>For {client.name}. A crew changes what you draw and what pays, all run.</p>
              </header>
              <ol class="jobs-list crews">
                {crews.map((crew, i) => (
                  <CrewCard
                    key={crew.id}
                    crew={crew}
                    index={i}
                    recommended={visit && crew.id === 'generalContractor'}
                    buttonRef={i === 0 ? first : undefined}
                    onHire={() => hire(crew.id)}
                  />
                ))}
              </ol>
            </>
          ) : (
            <>
              <header class="jobs-header">
                <h1 id="jobs-title">The job board</h1>
                <p>Pick a client. Each job is one house, on one lot, for them.</p>
              </header>
              <ol class="jobs-list">
                {contracts.map((c, i) => (
                  <ContractCard
                    key={c.seed}
                    contract={c}
                    index={i}
                    buttonRef={i === 0 ? first : undefined}
                    onTake={() => take(c)}
                  />
                ))}
              </ol>
            </>
          )}
          <footer class="jobs-footer">
            <button type="button" onClick={back}>
              Back
            </button>
            <span class="jobs-keys">
              {taken ? '1–3 to hire a crew' : '1–3 to take a job'} · Esc to go back
            </span>
          </footer>
        </main>
      </div>
      <Street />
    </div>
  );
}

/** A crew (D-012): its name, what it does, and the cards it starts with. */
function CrewCard(props: {
  crew: CrewDef;
  index: number;
  recommended: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onHire: () => void;
}) {
  const { crew, index } = props;
  const starts = (crew.startReserve ?? []).map((id) => CONTENT.pieces[id].name);
  return (
    <li
      class={`contract crew${props.recommended ? ' recommended' : ''}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {props.recommended && <div class="contract-ribbon">Recommended for your first job</div>}
      <header class="contract-head">
        <h2>{crew.name}</h2>
      </header>
      <p class="contract-brief">{crew.blurb}</p>
      <section class="contract-section">
        <h3>All run</h3>
        <ul class="contract-tastes">
          {crew.modifiers.map((m, i) => (
            <li key={i} class="good">
              <span class="mark" aria-hidden="true">
                ▲
              </span>
              {modifierText(CONTENT, m)}
            </li>
          ))}
        </ul>
      </section>
      {starts.length > 0 && (
        <section class="contract-section">
          <h3>Starts with</h3>
          <p>{starts.join(' and ')}, waiting in your reserve.</p>
        </section>
      )}
      <footer class="contract-foot">
        <button
          type="button"
          class="primary contract-take"
          ref={props.buttonRef}
          onClick={props.onHire}
          aria-label={`Hire this crew: ${crew.name}`}
        >
          Hire this crew
        </button>
        <kbd aria-hidden="true">{index + 1}</kbd>
      </footer>
    </li>
  );
}

function ContractCard(props: {
  contract: Contract;
  index: number;
  buttonRef?: Ref<HTMLButtonElement>;
  onTake: () => void;
}) {
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
  const wishes = client.specs.filter((s) => s.group === 'wishes');
  const houseRules = client.specs.filter((s) => s.group !== 'wishes');
  return (
    <li
      class={`contract rarity-${client.rarity}${contract.recommended ? ' recommended' : ''}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {contract.recommended && <div class="contract-ribbon">Recommended for your first job</div>}
      <header class="contract-head">
        <h2>{client.name}</h2>
        <RarityTag rarity={client.rarity} />
      </header>
      <p class="contract-brief">{client.brief}</p>
      <div class="contract-top">
        <LotThumb lot={lot} />
        <div class="contract-top-text">
          <section class="contract-section">
            <h3>Wishes</h3>
            <ul>
              {wishes.map((w) => (
                <li key={w.id}>
                  <Tip title={w.name} text={specText(CONTENT, w)}>
                    {w.name}
                  </Tip>
                </li>
              ))}
            </ul>
          </section>
          {household && (
            <section class="contract-section">
              <h3>Household</h3>
              <p>{specText(CONTENT, household)}</p>
            </section>
          )}
        </div>
      </div>
      <section class="contract-section">
        <h3>Tastes</h3>
        <Tastes client={client} />
      </section>
      <details class="contract-rules">
        <summary>And the house rules ({houseRules.length})</summary>
        <ul>
          {houseRules.map((s) => (
            <li key={s.id}>
              <Tip title={s.name} text={specText(CONTENT, s)}>
                {s.name}
              </Tip>
            </li>
          ))}
        </ul>
      </details>
      <footer class="contract-foot">
        <button
          type="button"
          class="primary contract-take"
          ref={props.buttonRef}
          onClick={props.onTake}
          aria-label={`Take the job: ${client.name}`}
        >
          Take the job
        </button>
        <kbd aria-hidden="true">{index + 1}</kbd>
      </footer>
    </li>
  );
}

/** Whether a taste helps (a like, a bonus) or hurts (a dislike). */
function helps(mod: Modifier): boolean {
  if (mod.kind === 'earnNothing' || mod.kind === 'removeTag') return false;
  if ('pct' in mod && typeof mod.pct === 'number') return mod.pct >= 0;
  if ('add' in mod && typeof mod.add === 'number') return mod.add >= 0;
  return true;
}

function Tastes({ client }: { client: ClientDef }) {
  const lines = [
    ...client.tastes.map((m) => ({ text: modifierText(CONTENT, m), good: helps(m), pool: false })),
    ...client.pool.map((m) => ({ text: modifierText(CONTENT, m), good: true, pool: true })),
  ];
  return (
    <ul class="contract-tastes">
      {lines.map((l, i) => (
        <li key={i} class={l.pool ? 'pool' : l.good ? 'good' : 'bad'}>
          <span class="mark" aria-hidden="true">
            {l.pool ? '↻' : l.good ? '▲' : '▼'}
          </span>
          {l.text}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------
// The lot, one canvas pixel per tile (the street a row below it), shown at a whole-number
// scale with crisp pixels.

const LOT_COLORS: Record<string, string> = {
  ground: '#9fc56e',
  sunny: '#c4d870',
  tree: '#4c7a38',
  pond: '#5f9fd6',
  creek: '#76b3e0',
  boulder: '#958f86',
  oldShed: '#8a5a3b',
  timeCapsule: '#c9a35f',
  street: '#6f6c72',
};

function LotThumb({ lot }: { lot: Lot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    for (let y = 0; y < lot.height; y++) {
      for (let x = 0; x < lot.width; x++) {
        const t = terrainAt(lot, x, y);
        ctx.fillStyle = LOT_COLORS[t ?? (isSunny(lot, x, y) ? 'sunny' : 'ground')]!;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = LOT_COLORS.street!;
    ctx.fillRect(0, lot.height, lot.width, 1);
  }, [lot]);
  const scale = Math.max(2, Math.floor(100 / lot.width));
  return (
    <figure class="contract-lot">
      <canvas
        ref={ref}
        width={lot.width}
        height={lot.height + 1}
        style={{ width: `${lot.width * scale}px`, height: `${(lot.height + 1) * scale}px` }}
        role="img"
        aria-label={lotSummary(lot)}
      />
      <figcaption>{lotSummary(lot)}</figcaption>
    </figure>
  );
}

/** "A pond, a creek, woods, and 2 boulders · sunny on the right". */
function lotSummary(lot: Lot): string {
  const count = (id: string) => lot.terrain.filter((t) => t === id).length;
  const parts: string[] = [];
  if (count('pond') > 0) parts.push('a pond');
  if (count('creek') > 0) parts.push('a creek');
  const trees = count('tree');
  if (trees >= 12) parts.push('woods');
  else if (trees > 0) parts.push(trees === 1 ? 'a tree' : `${trees} trees`);
  const boulders = count('boulder');
  if (boulders > 0) parts.push(boulders === 1 ? 'a boulder' : `${boulders} boulders`);
  if (count('oldShed') > 0) parts.push('an old shed');
  const list =
    parts.length === 0
      ? 'Open ground'
      : parts.length === 1
        ? parts[0]!
        : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
  const side = lot.sunnySide === 'top' ? 'at the back' : `on the ${lot.sunnySide}`;
  return `${list[0]!.toUpperCase()}${list.slice(1)} · sunny ${side}`;
}
