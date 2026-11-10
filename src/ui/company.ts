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
// This file is the data and the storage, with no DOM beyond localStorage, so it tests in Node.
// screens/record-run.ts files a run when it ends and paints its photo.

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

/** How many houses the portfolio shows, and how many of the newest keep their photo. */
export const JOBS_KEEP = 36;
export const PHOTOS_KEEP = 24;

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
 * entry (and not counted twice), the bests raised, and the oldest photos and jobs let go.
 */
export function withJob(c: Company, job: Job): { company: Company; standing: Standing } {
  const previous = bestFor(c, job.clientId);
  const result: Best = { won: job.won, score: job.score, verdict: job.verdict };
  const key = jobKey(job);
  const again = c.jobs.some((j) => jobKey(j) === key);
  const jobs = [job, ...c.jobs.filter((j) => jobKey(j) !== key)]
    .slice(0, JOBS_KEEP)
    .map((j, i) => (i < PHOTOS_KEEP || j.photo === undefined ? j : withoutPhoto(j)));
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

function withoutPhoto(j: Job): Job {
  const { photo: _photo, ...rest } = j;
  return rest;
}

/** The record with a job's photo set, if the job is still listed and young enough to keep one. */
export function withPhoto(c: Company, key: string, photo: string): Company {
  const at = c.jobs.findIndex((j) => jobKey(j) === key);
  if (at < 0 || at >= PHOTOS_KEEP) return c;
  return { ...c, jobs: c.jobs.map((j, i) => (i === at ? { ...j, photo } : j)) };
}

/** The record with its oldest photo dropped: what's tried when the browser's storage is full. */
export function withFewerPhotos(c: Company): Company | null {
  for (let i = c.jobs.length - 1; i >= 0; i--) {
    if (c.jobs[i]!.photo !== undefined) {
      return { ...c, jobs: c.jobs.map((j, k) => (k === i ? withoutPhoto(j) : j)) };
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

function parseJob(v: unknown): Job | null {
  const best = parseBest(v);
  if (!best) return null;
  const j = v as Record<string, unknown>;
  if (!isText(j.seed) || !isText(j.clientId) || !isText(j.crewId)) return null;
  if (!isCount(j.milestones) || !isCount(j.phases) || !isCount(j.at)) return null;
  const photo = isText(j.photo) && j.photo.startsWith('data:image/') ? j.photo : undefined;
  return {
    seed: j.seed,
    clientId: j.clientId,
    crewId: j.crewId,
    ...best,
    milestones: j.milestones,
    phases: j.phases,
    at: j.at,
    ...(photo ? { photo } : {}),
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
  if (typeof localStorage === 'undefined') return emptyCompany();
  try {
    return parseCompany(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return emptyCompany();
  }
}

/** Writes the record, letting the oldest photos go while the browser says it's full. */
function store(c: Company): Company {
  if (typeof localStorage === 'undefined') return c;
  let next: Company | null = c;
  while (next) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, ...next }));
      return next;
    } catch {
      // Full (photos are the bulk of it), or blocked: try with one photo fewer.
      next = withFewerPhotos(next);
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
