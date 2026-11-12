// The company's record (D-139): what's kept from one run to the next, and how it's read back.

import { describe, expect, it } from 'vitest';
import {
  bestFor,
  bestScore,
  bestWith,
  emptyCompany,
  JOBS_KEEP,
  jobKey,
  parseCompany,
  PHOTOS_KEEP,
  PLOTS_KEEP,
  withFewerPictures,
  withJob,
  withPhoto,
  withPlot,
  type Company,
  type Job,
  type Plot,
} from './company.ts';

const PHOTO = 'data:image/png;base64,AAAA';
const PLOT: Plot = {
  src: 'data:image/png;base64,BBBB',
  x: 320,
  y: 192,
  w: 448,
  h: 336,
  lotW: 24,
  lotH: 24,
};

function job(over: Partial<Job> = {}): Job {
  return {
    seed: 'abc123',
    clientId: 'hendersons',
    crewId: 'generalContractor',
    won: true,
    score: 40000,
    verdict: 'Starter Home',
    milestones: 7,
    phases: 7,
    at: 1000,
    ...over,
  };
}

/** Files jobs in order, returning the record and the last one's standing. */
function file(jobs: readonly Job[], from: Company = emptyCompany()) {
  let company = from;
  let standing = null as ReturnType<typeof withJob>['standing'] | null;
  for (const j of jobs) ({ company, standing } = withJob(company, j));
  return { company, standing: standing! };
}

describe('filing a house', () => {
  it('a first house for a client is no "new best", and sets the best', () => {
    const { company, standing } = file([job()]);
    expect(standing).toEqual({ previous: null, newBest: false });
    expect(company.built).toBe(1);
    expect(company.won).toBe(1);
    expect(bestWith(company, 'hendersons', 'generalContractor')).toEqual({
      won: true,
      score: 40000,
      verdict: 'Starter Home',
    });
    expect(bestScore(company)).toBe(40000);
  });

  it('a higher score for the same client is a new best, with any crew', () => {
    const { company, standing } = file([
      job(),
      job({ seed: 'b', crewId: 'architect', score: 52000, verdict: 'Charmer' }),
    ]);
    expect(standing.newBest).toBe(true);
    expect(standing.previous?.score).toBe(40000);
    // Each crew keeps its own square; the client's best is the higher.
    expect(bestWith(company, 'hendersons', 'generalContractor')?.score).toBe(40000);
    expect(bestWith(company, 'hendersons', 'architect')?.score).toBe(52000);
    expect(bestFor(company, 'hendersons')?.verdict).toBe('Charmer');
    expect(bestFor(company, 'dale')).toBeNull();
  });

  it('a lower score leaves the best, and says what it is', () => {
    const { company, standing } = file([job(), job({ seed: 'b', score: 39000 })]);
    expect(standing).toMatchObject({ newBest: false, previous: { score: 40000 } });
    expect(bestFor(company, 'hendersons')?.score).toBe(40000);
    expect(company.jobs.map((j) => j.seed)).toEqual(['b', 'abc123']);
  });

  it('a win beats a loss with more Wow, and a loss never beats a win', () => {
    const lost = job({ won: false, score: 30000, verdict: 'Fixer-Upper', milestones: 6 });
    const a = file([lost, job({ seed: 'b', score: 29000 })]);
    expect(a.standing.newBest).toBe(true);
    expect(bestFor(a.company, 'hendersons')).toMatchObject({ won: true, score: 29000 });
    const b = file([job({ score: 29000 }), { ...lost, seed: 'b' }]);
    expect(b.standing.newBest).toBe(false);
    expect(bestFor(b.company, 'hendersons')).toMatchObject({ won: true, score: 29000 });
    // The company's best Wow counts wins only.
    expect(bestScore(file([lost]).company)).toBe(0);
  });

  it('the same lot, client and crew finished again replaces its entry and counts once', () => {
    const { company } = file([job({ photo: PHOTO }), job({ score: 45000, at: 2000 })]);
    expect(company.jobs).toHaveLength(1);
    expect(company.jobs[0]).toMatchObject({ score: 45000, at: 2000 });
    expect(company.built).toBe(1);
    expect(company.won).toBe(1);
    expect(bestFor(company, 'hendersons')?.score).toBe(45000);
  });

  it('keeps the newest jobs and only the newest photos, but every best and the counts', () => {
    const n = JOBS_KEEP + 5;
    const jobs = Array.from({ length: n }, (_, i) =>
      job({
        seed: `s${i}`,
        score: 1000 + i,
        photo: PHOTO,
        plot: PLOT,
        clientId: i === 0 ? 'dale' : 'barkers',
      }),
    );
    const { company } = file(jobs);
    expect(company.jobs).toHaveLength(JOBS_KEEP);
    expect(company.jobs[0]!.seed).toBe(`s${n - 1}`);
    expect(company.jobs.filter((j) => j.photo).length).toBe(PHOTOS_KEEP);
    expect(company.jobs.slice(0, PHOTOS_KEEP).every((j) => j.photo === PHOTO)).toBe(true);
    expect(company.jobs.filter((j) => j.plot).length).toBe(PLOTS_KEEP);
    expect(company.jobs.slice(0, PLOTS_KEEP).every((j) => j.plot === PLOT)).toBe(true);
    expect(company.built).toBe(n);
    // The first job has left the list; its best hasn't.
    expect(company.jobs.some((j) => j.clientId === 'dale')).toBe(false);
    expect(bestFor(company, 'dale')?.score).toBe(1000);
  });
});

describe('photos', () => {
  it('a photo goes on its job, if the job is still young enough to keep one', () => {
    const { company } = file([job(), job({ seed: 'b' })]);
    const next = withPhoto(company, jobKey(job()), PHOTO);
    expect(next.jobs.find((j) => j.seed === 'abc123')?.photo).toBe(PHOTO);
    expect(next.jobs.find((j) => j.seed === 'b')?.photo).toBeUndefined();
    // A job that's gone, or past the photos kept: the record is unchanged.
    expect(withPhoto(company, 'gone:x:y', PHOTO)).toBe(company);
    const many = file(Array.from({ length: PHOTOS_KEEP + 1 }, (_, i) => job({ seed: `s${i}` })));
    expect(withPhoto(many.company, jobKey(job({ seed: 's0' })), PHOTO)).toBe(many.company);
  });

  it('a plot goes on its job, only for the newest few', () => {
    const { company } = file([job(), job({ seed: 'b' })]);
    const next = withPlot(company, jobKey(job()), PLOT);
    expect(next.jobs.find((j) => j.seed === 'abc123')?.plot).toBe(PLOT);
    expect(next.jobs.find((j) => j.seed === 'b')?.plot).toBeUndefined();
    expect(withPlot(company, 'gone:x:y', PLOT)).toBe(company);
    const many = file(Array.from({ length: PLOTS_KEEP + 1 }, (_, i) => job({ seed: `s${i}` })));
    expect(withPlot(many.company, jobKey(job({ seed: 's0' })), PLOT)).toBe(many.company);
    expect(withPlot(many.company, jobKey(job({ seed: 's1' })), PLOT)).not.toBe(many.company);
  });

  it('a full browser gives up the plots first, oldest first, then the photos, then none', () => {
    const { company } = file([
      job({ photo: PHOTO, plot: PLOT }),
      job({ seed: 'b', photo: PHOTO, plot: PLOT }),
    ]);
    const steps: Company[] = [company];
    for (let next = withFewerPictures(company); next; next = withFewerPictures(next)) {
      steps.push(next);
    }
    // Newest first in the list: [b, abc123].
    expect(steps.map((c) => c.jobs.map((j) => [!!j.plot, !!j.photo]))).toEqual([
      [
        [true, true],
        [true, true],
      ],
      [
        [true, true],
        [false, true],
      ],
      [
        [false, true],
        [false, true],
      ],
      [
        [false, true],
        [false, false],
      ],
      [
        [false, false],
        [false, false],
      ],
    ]);
  });
});

describe('the stored record', () => {
  it('reads back what was stored', () => {
    const { company } = file([
      job({ photo: PHOTO, plot: PLOT }),
      job({ seed: 'b', won: false, score: 9 }),
    ]);
    expect(parseCompany(JSON.parse(JSON.stringify({ v: 1, ...company })))).toEqual(company);
  });

  it('is empty for anything that is not a record', () => {
    for (const raw of [null, undefined, 3, 'text', [], { jobs: 'none' }]) {
      expect(parseCompany(raw)).toEqual(emptyCompany());
    }
  });

  it('drops a bad job or best and keeps the rest; the counts never say less than the list', () => {
    const c = parseCompany({
      jobs: [
        job(),
        { ...job({ seed: 'b' }), score: -1 },
        { seed: 'c' },
        job({ photo: 'http://x' }),
        job({ seed: 'd', plot: { ...PLOT, src: 'data:image/jpeg;base64,CCCC' } }),
        job({ seed: 'e', plot: { ...PLOT, w: 0 } }),
        job({ seed: 'f', plot: { ...PLOT, x: -32 } }),
        job({ seed: 'g', plot: PLOT }),
      ],
      bests: { 'hendersons:architect': { won: true, score: 5, verdict: 'Charmer' }, bad: 1 },
      built: 1,
      won: 9,
    });
    // A bad picture is dropped; its job stays.
    expect(c.jobs.map((j) => j.seed)).toEqual(['abc123', 'abc123', 'd', 'e', 'f', 'g']);
    expect(c.jobs[1]!.photo).toBeUndefined();
    expect(c.jobs.map((j) => j.plot)).toEqual([...Array(5).fill(undefined), PLOT]);
    expect(Object.keys(c.bests)).toEqual(['hendersons:architect']);
    expect(c.built).toBe(6);
    expect(c.won).toBe(6);
  });
});
