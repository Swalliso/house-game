// The company's record (D-139): every house this browser has finished, won or lost, and the best
// result with each client and crew. It's the first thing that carries from one run to the next:
// the end screen says when a house beats the company's best for its client, and the title's
// Portfolio shows the houses and the bests (screens/Portfolio.tsx).
//
// It unlocks nothing and changes no rule (D-016: no power from run to run), so the rules never
// read it. It's kept beside the save, by channel, but not by build: a house is stored as its
// result and a painted photo, never as a run code, because a run code stops replaying when the
// content changes and the record should outlive updates.
//
// The newest few houses also keep a plot (D-156): the house alone, dimmed, at art resolution, so
// it can stand on the street beside later lots (board/NeighborsLayer.tsx).
//
// This file is the data and the storage, with no DOM beyond localStorage, so it tests in Node.
// screens/record-run.ts files a run when it ends and paints its photo and its plot.

import { signal } from '@preact/signals';
import { BUILD_CHANNEL } from './build-info.ts';

/** A finished house. Ids are kept as text: a later build may no longer have the client or crew. */
export interface Job {
  seed: string;
  clientId: string;
  crewId: string;
  won: boolean;
  score: number;
  verdict: string;
  /** Milestones met, of `phases`. */
  milestones: number;
  phases: number;
  /** When it was finished, in ms since 1970. */
  at: number;
  /** The finished house, as an image data URL: only the newest PHOTOS_KEEP jobs keep theirs. */
  photo?: string;
  /** The house on the street beside later lots: only the newest PLOTS_KEEP jobs keep theirs. */
  plot?: Plot;
}

/**
 * A finished house as it stands on the street beside later lots (D-156): the house alone, with
 * no ground under it, dimmed as the garden around the lot is, as a PNG at art resolution; and
 * where that picture lay on its own board, so it stands at the row it was built on.
 */
export interface Plot {
  /** The picture, as a PNG data URL. */
  src: string;
  /** Its top-left on its own board, and its size, in art px. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Its lot's size in cells: the street runs along the row below the lot. */
  lotW: number;
  lotH: number;
}

/** The best result with a client and a crew: the highest score, a win over any loss. */
export interface Best {
  won: boolean;
  score: number;
  verdict: string;
}

export interface Company {
  /** Newest first, at most JOBS_KEEP. */
  jobs: readonly Job[];
  /** By `clientId:crewId`. These outlive the jobs they came from. */
  bests: Readonly<Record<string, Best>>;
  /** Every house finished, and how many of them were won: counts, not the list's length. */
  built: number;
  won: number;
}

/**
 * How many houses the portfolio shows, how many of the newest keep their photo, and how many of
 * those keep their plot too: a plot is about twice a photo's size (D-156).
 */
export const JOBS_KEEP = 36;
export const PHOTOS_KEEP = 24;
export const PLOTS_KEEP = 6;

export const emptyCompany = (): Company => ({ jobs: [], bests: {}, built: 0, won: 0 });

/** One run, however often it's finished again: its lot, client and crew. */
export function jobKey(j: Pick<Job, 'seed' | 'clientId' | 'crewId'>): string {
  return `${j.seed}:${j.clientId}:${j.crewId}`;
}

const pairKey = (clientId: string, crewId: string) => `${clientId}:${crewId}`;

/** Whether `a` is a better result than `b`: a win over a loss, then the higher score. */
function better(a: Best, b: Best | null | undefined): boolean {
  if (!b) return true;
  if (a.won !== b.won) return a.won;
  return a.score > b.score;
}

/** The best result with a client and crew, or null before the first. */
export function bestWith(c: Company, clientId: string, crewId: string): Best | null {
  return c.bests[pairKey(clientId, crewId)] ?? null;
}

/** The best result for a client with any crew, or null before the first. */
export function bestFor(c: Company, clientId: string): Best | null {
  let best: Best | null = null;
  for (const [key, b] of Object.entries(c.bests)) {
    if (key.startsWith(`${clientId}:`) && better(b, best)) best = b;
  }
  return best;
}

/** The company's highest score in a won run, or 0. */
export function bestScore(c: Company): number {
  return Math.max(0, ...Object.values(c.bests).map((b) => (b.won ? b.score : 0)));
}

/** How a house stands against the company's record as it was before the house was filed. */
export interface Standing {
  /** The best for this client before this house; null if it's their first. */
  previous: Best | null;
  /** Whether this house beat it (a first house isn't a "new best"). */
  newBest: boolean;
}

/**
 * The record with a house filed: newest first, the same run filed again replacing its earlier
 * entry (and not counted twice), the bests raised, and the oldest plots, photos and jobs let go.
 */
export function withJob(c: Company, job: Job): { company: Company; standing: Standing } {
  const previous = bestFor(c, job.clientId);
  const result: Best = { won: job.won, score: job.score, verdict: job.verdict };
  const key = jobKey(job);
  const again = c.jobs.some((j) => jobKey(j) === key);
  const jobs = [job, ...c.jobs.filter((j) => jobKey(j) !== key)]
    .slice(0, JOBS_KEEP)
    .map((j, i) => (i < PLOTS_KEEP ? j : without(j, i < PHOTOS_KEEP ? ['plot'] : PICTURES)));
  const pair = pairKey(job.clientId, job.crewId);
  const bests = better(result, c.bests[pair]) ? { ...c.bests, [pair]: result } : c.bests;
  return {
    company: {
      jobs,
      bests,
      built: c.built + (again ? 0 : 1),
      won: c.won + (job.won && !again ? 1 : 0),
    },
    standing: { previous, newBest: previous !== null && better(result, previous) },
  };
}

/** A job's pictures, the bulk of the record: the plots go first when the browser is full. */
const PICTURES = ['plot', 'photo'] as const;
type Picture = (typeof PICTURES)[number];

/** A job without the given pictures (the same job if it has none of them). */
function without(j: Job, pictures: readonly Picture[]): Job {
  if (pictures.every((p) => j[p] === undefined)) return j;
  const rest = { ...j };
  for (const p of pictures) delete rest[p];
  return rest;
}

/** The record with a job's picture set, if the job is still listed and young enough to keep it. */
function withPicture(c: Company, key: string, keep: number, set: Partial<Job>): Company {
  const at = c.jobs.findIndex((j) => jobKey(j) === key);
  if (at < 0 || at >= keep) return c;
  return { ...c, jobs: c.jobs.map((j, i) => (i === at ? { ...j, ...set } : j)) };
}

/** The record with a job's photo set, if the job is still listed and young enough to keep one. */
export function withPhoto(c: Company, key: string, photo: string): Company {
  return withPicture(c, key, PHOTOS_KEEP, { photo });
}

/** The record with a job's plot set, if the job is still listed and young enough to keep one. */
export function withPlot(c: Company, key: string, plot: Plot): Company {
  return withPicture(c, key, PLOTS_KEEP, { plot });
}

/**
 * The record with its oldest plot dropped, or once none is left its oldest photo: what's tried
 * when the browser's storage is full. Null when there's no picture left to give up.
 */
export function withFewerPictures(c: Company): Company | null {
  for (const p of PICTURES) {
    for (let i = c.jobs.length - 1; i >= 0; i--) {
      if (c.jobs[i]![p] !== undefined) {
        return { ...c, jobs: c.jobs.map((j, k) => (k === i ? without(j, [p]) : j)) };
      }
    }
  }
  return null;
}

// ---- Stored form: only what reads as a record is kept, so a bad entry never breaks the rest ----

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

function parseBest(v: unknown): Best | null {
  if (!v || typeof v !== 'object') return null;
  const b = v as Record<string, unknown>;
  if (typeof b.won !== 'boolean' || !isCount(b.score) || !isText(b.verdict)) return null;
  return { won: b.won, score: b.score, verdict: b.verdict };
}

/** A stored plot, or undefined if it doesn't read as one. */
function parsePlot(v: unknown): Plot | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  if (!isText(p.src) || !p.src.startsWith('data:image/png')) return undefined;
  const { x, y, w, h, lotW, lotH } = p;
  if (!isCount(x) || !isCount(y) || !isCount(w) || !isCount(h)) return undefined;
  if (!isCount(lotW) || !isCount(lotH) || w === 0 || h === 0 || lotW === 0 || lotH === 0) {
    return undefined;
  }
  return { src: p.src, x, y, w, h, lotW, lotH };
}

function parseJob(v: unknown): Job | null {
  const best = parseBest(v);
  if (!best) return null;
  const j = v as Record<string, unknown>;
  if (!isText(j.seed) || !isText(j.clientId) || !isText(j.crewId)) return null;
  if (!isCount(j.milestones) || !isCount(j.phases) || !isCount(j.at)) return null;
  const photo = isText(j.photo) && j.photo.startsWith('data:image/') ? j.photo : undefined;
  const plot = parsePlot(j.plot);
  return {
    seed: j.seed,
    clientId: j.clientId,
    crewId: j.crewId,
    ...best,
    milestones: j.milestones,
    phases: j.phases,
    at: j.at,
    ...(photo ? { photo } : {}),
    ...(plot ? { plot } : {}),
  };
}

/** A stored record, read back: anything that isn't one is an empty company. */
export function parseCompany(raw: unknown): Company {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyCompany();
  const r = raw as Record<string, unknown>;
  const jobs = (Array.isArray(r.jobs) ? r.jobs : [])
    .map(parseJob)
    .filter((j): j is Job => j !== null)
    .slice(0, JOBS_KEEP);
  const bests: Record<string, Best> = {};
  if (r.bests && typeof r.bests === 'object' && !Array.isArray(r.bests)) {
    for (const [key, v] of Object.entries(r.bests)) {
      const b = parseBest(v);
      if (b && key.includes(':')) bests[key] = b;
    }
  }
  // The counts never say less than the list shows.
  const built = Math.max(isCount(r.built) ? r.built : 0, jobs.length);
  const wins = jobs.filter((j) => j.won).length;
  const won = Math.min(built, Math.max(isCount(r.won) ? r.won : 0, wins));
  return { jobs, bests, built, won };
}

// ---- The browser's copy ----

const KEY = `openhouse:${BUILD_CHANNEL}:company`;

function load(): Company {
  // Everything that touches localStorage sits in the try: outside a browser (a test) it isn't
  // there, and a browser that blocks site data throws on the first read of it.
  try {
    return parseCompany(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return emptyCompany();
  }
}

/** Writes the record, letting the oldest plots, then photos, go while the browser says it's full. */
function store(c: Company): Company {
  let next: Company | null = c;
  while (next) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, ...next }));
      return next;
    } catch {
      // Full (the pictures are the bulk of it), blocked, or not there at all (a test): try with
      // one picture fewer.
      next = withFewerPictures(next);
    }
  }
  // Blocked storage: the record lasts for this visit.
  return c;
}

export const company = signal<Company>(load());

/** How the run that just ended stands against the record, by its job key, for the end screen. */
export const lastStanding = signal<{ key: string; standing: Standing } | null>(null);

/** Files a finished house, and says how it stands against the record before it. */
export function fileJob(job: Job): Standing {
  const { company: next, standing } = withJob(company.value, job);
  company.value = store(next);
  lastStanding.value = { key: jobKey(job), standing };
  return standing;
}

/** Sets a filed house's photo, once it's painted. */
export function fileJobPhoto(key: string, photo: string): void {
  const next = withPhoto(company.value, key, photo);
  if (next !== company.value) company.value = store(next);
}

/** Sets a filed house's plot, once it's painted. */
export function fileJobPlot(key: string, plot: Plot): void {
  const next = withPlot(company.value, key, plot);
  if (next !== company.value) company.value = store(next);
}
