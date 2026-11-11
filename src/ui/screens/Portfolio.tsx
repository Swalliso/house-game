// The company's portfolio (D-139), from the title screen once a house has been finished: what
// this browser has built (company.ts). First the best work with each client and crew, a grid
// whose empty squares are jobs not tried yet; then the houses, newest first, as polaroids like
// the end screen's (D-136), each with its client, verdict, Wow and crew.
//
// It only shows the record: nothing here is unlocked or spent, and no rule reads it (D-016).
// The photos are shown downscaled, smoothly, as the end screen's strip shows its own.

import { CONTENT, SCORE_LABELS } from '../../rules/index.ts';
import { bestScore, bestWith, company, jobKey, type Best, type Job } from '../company.ts';
import { formatNumber } from '../format.ts';
import { portfolioOpen } from '../hud/actions.ts';
import { Icon, Sheet } from '../kit/kit.tsx';
import './portfolio.css';

const WOW = SCORE_LABELS.total;

/** A client's or a crew's name, or its id if this build no longer has it. */
const clientName = (id: string) => CONTENT.clients[id as keyof typeof CONTENT.clients]?.name ?? id;
const crewName = (id: string) => CONTENT.crews[id as keyof typeof CONTENT.crews]?.name ?? id;

const count = (n: number, one: string, many: string) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`;

function BestCell({ best, label }: { best: Best | null; label: string }) {
  if (!best) {
    return (
      <td class="none" aria-label={`${label}: not built yet`} title="Not built yet">
        <Icon name="pending" />
      </td>
    );
  }
  return (
    <td class={best.won ? 'won' : 'lost'}>
      <span class="verdict">{best.won ? best.verdict : 'Client walked'}</span>
      <span class="score num">{formatNumber(best.score)}</span>
    </td>
  );
}

/** Each client's best with each crew: fifteen squares to fill in. */
function Bests() {
  const c = company.value;
  const clients = Object.values(CONTENT.clients);
  const crews = Object.values(CONTENT.crews);
  const done = clients.reduce(
    (n, cl) => n + crews.filter((cr) => bestWith(c, cl.id, cr.id)?.won).length,
    0,
  );
  return (
    <section class="portfolio-section">
      <h3 class="plank-tag" aria-label={`Best work: ${done} of ${clients.length * crews.length}`}>
        Best work
        <span class="plank-count">
          {done}/{clients.length * crews.length}
        </span>
      </h3>
      <table class="portfolio-bests">
        <thead>
          <tr>
            <td />
            {crews.map((cr) => (
              <th key={cr.id} scope="col">
                {cr.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map((cl) => (
            <tr key={cl.id}>
              <th scope="row">{cl.name}</th>
              {crews.map((cr) => (
                <BestCell
                  key={cr.id}
                  best={bestWith(c, cl.id, cr.id)}
                  label={`${cl.name}, ${cr.name}`}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function House({ job }: { job: Job }) {
  const client = clientName(job.clientId);
  return (
    <li class={`portfolio-house ${job.won ? 'won' : 'lost'}`}>
      <span class="portfolio-photo">
        {job.photo ? (
          <img src={job.photo} alt={`The house built for ${client}`} loading="lazy" />
        ) : (
          <Icon name="House" />
        )}
      </span>
      <span class="portfolio-caption">
        <span class="client">{client}</span>
        <span class="result">
          <Icon name={job.won ? 'check' : 'cross'} class="mark" />
          {job.won ? job.verdict : `Walked at ${job.milestones}/${job.phases}`}
        </span>
        <span class="score">
          <span class="num">{formatNumber(job.score)}</span> {WOW}
        </span>
        <span class="crew">{crewName(job.crewId)}</span>
      </span>
    </li>
  );
}

export function Portfolio() {
  if (!portfolioOpen.value) return null;
  const c = company.value;
  const best = bestScore(c);
  return (
    <Sheet title="Portfolio" class="portfolio" onClose={() => (portfolioOpen.value = false)}>
      <p class="portfolio-summary">
        {count(c.built, 'house', 'houses')} built · {count(c.won, 'job', 'jobs')} done
        {best > 0 && (
          <>
            {' '}
            · best <span class="num">{formatNumber(best)}</span> {WOW}
          </>
        )}
      </p>
      <Bests />
      <section class="portfolio-section">
        <h3 class="plank-tag">Houses</h3>
        {c.jobs.length === 0 ? (
          <p class="portfolio-note">Finish a house and its photo goes up here.</p>
        ) : (
          <ol class="portfolio-houses">
            {c.jobs.map((job) => (
              <House key={jobKey(job)} job={job} />
            ))}
          </ol>
        )}
        {c.built > c.jobs.length && (
          <p class="portfolio-note">
            The newest {c.jobs.length} of {formatNumber(c.built)}.
          </p>
        )}
      </section>
    </Sheet>
  );
}
