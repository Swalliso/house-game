// The job board (implementation-plan.md §7 M4a and M4b; D-032, D-045): Start opens three
// contracts, each a client and a lot. Taking one opens the crew pick; hiring a crew starts the
// run. The contracts come from the rules' jobBoard(), so the UI only renders them.
//
// A first visit (D-149) has one job to take, the first job: the Hendersons, on the lot whose
// first hands teach in order, under a gold tab and in a gold ring. The other two contracts are
// on the board too, face down: who they're for, and "After your first job". Taking the first job
// starts it at once with the General Contractor; the crew pick comes with the second run, when
// there's a run behind the choice.
//
// A card leads with what differs between the clients on offer (D-142): who they are, their
// wishes, and a map of the lot with its sun and traits (D-119: Creekside pays, so the lot can be
// a reason to take the job). The household and the tastes are a line each, the whole of each in
// its tip (job-card.ts). The seven house rules are the same on every card, so the board names
// them once, in its lede; a rule a client has in numbers of their own sits with their wishes.
//
// In the pixel UI (D-110): a wood panel standing on the title's street (Title.tsx's
// TitleBackdrop), its cards the kit's paper Cards, rarity a band and a chip as in the shop. A
// card's middle scrolls and its button stays in view, so the board fits 1280×720 in the pixel
// font without the page scrolling. One lime button at most: the first job's, on a first visit.

import './jobs.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CONTENT,
  houseRulesText,
  jobBoard,
  lotTraits,
  lotTraitText,
  modifierText,
  rules,
  specText,
  type ClientDef,
  type Contract,
  type CrewDef,
  type CrewId,
  type Lot,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { FEEL } from '../fx/feel.ts';
import { anyModalOpen } from '../hud/actions.ts';
import { RARITY_LABEL } from '../hud/goods.tsx';
import { PieceArt } from '../hud/PieceArt.tsx';
import { Tip } from '../hud/Tip.tsx';
import { SunChip } from '../hud/sun.tsx';
import { Button, Card, Chip, Icon, Keycap, Panel, type IconName } from '../kit/kit.tsx';
import { CREW_ICONS, LOT_TRAIT_ICONS } from '../sprites.ts';
import { appScreen, firstVisit, jobBoardSeed, takeContract } from '../store.ts';
import {
  deliveryLine,
  deliveryTip,
  householdLine,
  householdTip,
  ownHouseRules,
  tasteCounts,
  tastesTip,
} from './job-card.ts';
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
  // it (the first job, on a first visit). It’s a screen, like the title, not a sheet: Tab
  // isn't held in it.
  useEffect(() => {
    list.current
      ?.querySelector<HTMLButtonElement>('.contract-take')
      ?.focus({ preventScroll: true });
  }, [seed, taken]);
  useEffect(() => setTaken(null), [seed]);

  const take = (c: Contract) => {
    audio.unlock();
    if (c.locked) {
      audio.play('illegal');
      return;
    }
    // The first job (D-149) starts at once, with the General Contractor.
    if (c.recommended) {
      audio.play('chime', { rate: 1.2 });
      takeContract(c);
      return;
    }
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
  // The contracts that can be taken, numbered for their keys: all of them, or on a first visit
  // the first job alone (D-149).
  const open = contracts.filter((c) => !c.locked);
  const firstJob = contracts.some((c) => c.locked);

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
      const count = taken ? crews.length : open.length;
      if (Number.isInteger(n) && n >= 1 && n <= count) {
        e.preventDefault();
        if (taken) hire(crews[n - 1]!.id);
        else take(open[n - 1]!);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contracts, taken]);

  const client = taken ? CONTENT.clients[taken.clientId] : null;
  const count = client ? crews.length : open.length;
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
          // A first visit has one step: the first job starts as it's taken.
          head={firstJob ? undefined : <Chip tone="inset">{`Step ${client ? 2 : 1} of 2`}</Chip>}
          bodyClass="jobs-body"
        >
          <p class="jobs-lede">
            {client ? (
              `For ${fromName(client.name)}. A crew changes what you draw and what pays, all run.`
            ) : firstJob ? (
              'Each job is one house, on one lot, for one client. Yours starts here.'
            ) : (
              <>
                Pick a client. Each job is one house, on one lot, for them. Every house also keeps{' '}
                <HouseRulesTip />.
              </>
            )}
          </p>
          <ol class="jobs-list" ref={list}>
            {client
              ? crews.map((crew, i) => (
                  <CrewCard key={crew.id} crew={crew} index={i} onHire={() => hire(crew.id)} />
                ))
              : contracts.map((c) =>
                  c.locked ? (
                    <LockedCard key={c.seed} contract={c} index={contracts.indexOf(c)} />
                  ) : (
                    <ContractCard
                      key={c.seed}
                      contract={c}
                      index={open.indexOf(c)}
                      onTake={() => take(c)}
                    />
                  ),
                )}
          </ol>
          <footer class="jobs-foot">
            <Button
              onClick={back}
              tip={client ? 'Back to the job board (Esc)' : 'Back to the title (Esc)'}
            >
              Back
            </Button>
            <p class="jobs-keys">
              <span class="jobs-key">
                {Array.from({ length: count }, (_, i) => (
                  <Keycap key={i}>{i + 1}</Keycap>
                ))}
                <span>{client ? 'hire a crew' : firstJob ? 'take the job' : 'take a job'}</span>
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

/** The gold tab on a card's top edge: the first visit's one job (D-149). */
function FirstJobTag() {
  return (
    <span class="contract-tag">
      <Icon name="star" />
      Your first job
    </span>
  );
}

/** The card's stagger, as it's pinned up (FEEL.jobs). */
const beat = (index: number) => ({ '--beat': `${index * FEEL.jobs.staggerMs}ms` });

/** A crew (D-012, D-109): its icon, what it does all run, and the cards it starts with. */
function CrewCard(props: { crew: CrewDef; index: number; onHire: () => void }) {
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
  const wishes = client.specs.filter((s) => s.group === 'wishes');
  // A house rule in this client's own numbers reads as one of their wishes (D-101).
  const asked = [...wishes, ...ownHouseRules(client)];
  return (
    <li class="jobs-item">
      <Card
        as="article"
        class={contract.recommended ? 'contract first-job' : 'contract'}
        rarity={client.rarity}
        lead={<Keycap>{index + 1}</Keycap>}
        title={client.name}
        // The rarity as a plain chip: RarityTag's tip explains the shop's goods.
        aside={<Chip tone={client.rarity}>{RARITY_LABEL[client.rarity]}</Chip>}
        style={beat(index)}
        aria-label={client.name}
      >
        {contract.recommended && <FirstJobTag />}
        <div class="contract-scroll">
          <p class="contract-brief">{client.brief}</p>
          <div class="contract-top">
            <LotMap lot={lot} />
            <section class="contract-section contract-top-text">
              <h3>Wishes</h3>
              <ul class="pcard-lines">
                {asked.map((w) => (
                  <li key={w.id}>
                    <Tip title={w.name} text={specText(CONTENT, w)}>
                      {w.name}
                    </Tip>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <LotTraits lot={lot} client={client} />
          <FinePrint client={client} />
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
 * A contract a first visit can't take yet (D-149): who it's for and what they're after, face
 * down, with nothing to read into and no button. The board shows there's more hiring; the first
 * job is the one to take.
 */
function LockedCard({ contract, index }: { contract: Contract; index: number }) {
  const client = CONTENT.clients[contract.clientId];
  return (
    <li class="jobs-item">
      <Card
        as="article"
        class="contract locked"
        title={client.name}
        style={beat(index)}
        aria-label={`${client.name}: after your first job`}
      >
        <p class="contract-brief">{client.brief}</p>
        <p class="contract-later">
          <Icon name="pending" />
          After your first job
        </p>
      </Card>
    </li>
  );
}

/**
 * The house rules, named once for the whole board (D-142): every client has the same seven
 * (D-101), so they're a term in the lede, not a list on each card. Its tip names them, in the
 * rules' words.
 */
function HouseRulesTip() {
  const text = houseRulesText(CONTENT);
  const count = text.split('\n').length - 1;
  return (
    <Tip title="The house rules" text={text}>
      the same {count} house rules
    </Tip>
  );
}

/**
 * A card's last lines (D-142): the household and the tastes, a line each, with the whole of each
 * in its tip (job-card.ts). Who moves in, and when, and what they bring; what the client brings
 * for a wish, if anything (D-160); what the client likes and dislikes, counted, and what their
 * jobs draw more of.
 */
function FinePrint({ client }: { client: ClientDef }) {
  const { likes, dislikes, draws } = tasteCounts(client);
  const tastes = likes + dislikes + draws > 0;
  const brings = deliveryLine(client);
  return (
    <ul class="contract-fine">
      <li>
        <span class="taste-mark">
          <Icon name="House" />
        </span>
        {/* The tip stays inline in its own box, so its dots run under each line it wraps to. */}
        <span>
          <Tip title="The household" text={householdTip(client)}>
            {householdLine(client)}
          </Tip>
        </span>
      </li>
      {brings && (
        <li>
          <span class="taste-mark">
            <Icon name="crate" />
          </span>
          <span>
            <Tip title="What they bring" text={deliveryTip(client)}>
              {brings}
            </Tip>
          </span>
        </li>
      )}
      {tastes && (
        <li>
          <span class="taste-mark">
            <span class="taste-dot" />
          </span>
          <span>
            <Tip title={`${client.name}: tastes`} text={tastesTip(client)}>
              <span class="taste-sum">
                Tastes
                {likes > 0 && (
                  <span class="taste-n">
                    <Icon name="up" label="Likes" />
                    {likes}
                  </span>
                )}
                {dislikes > 0 && (
                  <span class="taste-n">
                    <Icon name="down" label="Dislikes" />
                    {dislikes}
                  </span>
                )}
              </span>
            </Tip>
          </span>
        </li>
      )}
    </ul>
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

/**
 * The lot, one canvas pixel per tile with the street a row below it (lot-map.ts), drawn at
 * --map-px per tile in an ink ring. Its summary in words is its tip and its label.
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
    <span class="contract-map" data-tip={summary}>
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
