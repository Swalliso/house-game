// Finding, fetching, and decoding the game's audio files (M5b; §12 Music: "OGG with an M4A
// fallback, loaded after the title screen"). Vite hashes every file under assets/audio/ into
// the build; this maps a cut's id (its path there, without the extension) to its URLs. Bytes
// can be fetched before the AudioContext exists (after the title screen is up) and decoded
// once it does (the first click).

export type Format = 'ogg' | 'm4a';

const PREFIX = '../../../assets/audio/';
const URLS = import.meta.glob('../../../assets/audio/**/*.{ogg,m4a}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The URL of a cut in a format, if the build has it. */
export function fileUrl(id: string, format: Format): string | undefined {
  return URLS[`${PREFIX}${id}.${format}`];
}

/** Every cut the build has in both formats. */
export function audioIds(): string[] {
  const ids = new Set<string>();
  for (const path of Object.keys(URLS)) {
    const id = path.slice(PREFIX.length).replace(/\.(ogg|m4a)$/, '');
    if (fileUrl(id, 'ogg') && fileUrl(id, 'm4a')) ids.add(id);
  }
  return [...ids].sort();
}

let chosen: Format | null = null;

/** Ogg Vorbis where the browser plays it, M4A (AAC) otherwise: Safari before 18.4. */
export function preferredFormat(): Format {
  if (chosen) return chosen;
  try {
    const probe = document.createElement('audio');
    chosen = probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
  } catch {
    chosen = 'm4a';
  }
  return chosen;
}

/** After an Ogg file fails to decode, everything after it loads as M4A. */
function fallBack(): void {
  chosen = 'm4a';
}

const bytes = new Map<string, Promise<ArrayBuffer>>();

/** Starts fetching a cut's bytes (once), in the preferred format. */
export function prefetch(id: string): Promise<ArrayBuffer> {
  const format = preferredFormat();
  const key = `${id}.${format}`;
  let pending = bytes.get(key);
  if (!pending) {
    const url = fileUrl(id, format);
    pending = url
      ? fetch(url).then((r) => {
          if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
          return r.arrayBuffer();
        })
      : Promise.reject(new Error(`no audio file for ${id}`));
    pending.catch(() => bytes.delete(key));
    bytes.set(key, pending);
  }
  return pending;
}

function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // Old Safari only has the callback form; new browsers return a promise too.
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
    p?.then(resolve, reject);
  });
}

/**
 * Fetches (if it hasn't already) and decodes a cut. Its bytes are let go once decoded, since
 * decoding takes them over. An Ogg file that won't decode is tried again as M4A.
 */
export async function loadBuffer(ctx: BaseAudioContext, id: string): Promise<AudioBuffer> {
  const format = preferredFormat();
  const data = await prefetch(id);
  bytes.delete(`${id}.${format}`);
  try {
    return await decode(ctx, data);
  } catch (error) {
    if (format !== 'ogg' || !fileUrl(id, 'm4a')) throw error;
    fallBack();
    const again = await prefetch(id);
    bytes.delete(`${id}.m4a`);
    return decode(ctx, again);
  }
}
