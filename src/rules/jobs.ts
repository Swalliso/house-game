// The job board (implementation-plan.md §7 M4a, §6; D-032, D-045): a few contracts to choose
// from at the start of a run, each a client and a lot. It sits outside apply() and the run
// code: the chosen contract's seed becomes the run's seed, and its client the run's client, so
// a run never depends on the board that offered it.
//
// - Contract i draws from its own stream, `jobs/<i>` of the board's seed.
// - Clients are drawn by rarity (Appendix A · M4a: Common 65, Uncommon 27, Rare 8; D-026), then
//   evenly among the clients of that rarity, and never twice on one board. No Rare is
//   guaranteed.
// - On a first visit, contract 0 is the first job (D-149): the first client (the Hendersons) on
//   the first job's own lot (`firstSeed`), and the only contract that can be taken. The others
//   are dealt as ever and marked locked, so the board shows who else is hiring.

import type { ClientId, Content, Rarity } from './index.ts';
import { stream } from './rng.ts';

export interface Contract {
  clientId: ClientId;
  /** The run seed if this contract is taken: it decides the lot. */
  seed: string;
  /** Contract 0 on a first visit: the first job. */
  recommended: boolean;
  /** On a first visit, every contract but the first job: it can't be taken yet (D-149). */
  locked: boolean;
}

/** The same alphabet as the UI's seeds: no 0/o, 1/l/i. */
const SEED_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function jobBoard(
  content: Content,
  boardSeed: string,
  opts: { firstVisit: boolean },
): Contract[] {
  const jb = content.balance.jobBoard;
  const clients = Object.values(content.clients).filter((c) => c.tier === 'core');
  const used = new Set<ClientId>();
  const out: Contract[] = [];
  for (let i = 0; i < jb.contracts && used.size < clients.length; i++) {
    const rng = stream(boardSeed, `jobs/${i}`);
    let seed = '';
    for (let k = 0; k < 6; k++) seed += SEED_ALPHABET[rng.int(SEED_ALPHABET.length)];
    const recommended = i === 0 && opts.firstVisit && !!content.clients[jb.firstClient];
    let clientId: ClientId;
    if (recommended) {
      clientId = jb.firstClient;
      // The first job's own lot, in place of the one its stream drew.
      seed = jb.firstSeed || seed;
    } else {
      const left = clients.filter((c) => !used.has(c.id));
      // Each rarity's weight is shared among the clients of that rarity still on offer.
      const byRarity = new Map<Rarity, number>();
      for (const c of left) byRarity.set(c.rarity, (byRarity.get(c.rarity) ?? 0) + 1);
      // Integers (in thousandths of a rarity's weight), so every machine draws the same.
      const weights = left.map((c) =>
        Math.floor((jb.rarity[c.rarity] * 1000) / byRarity.get(c.rarity)!),
      );
      let r = rng.int(
        Math.max(
          1,
          weights.reduce((a, b) => a + b, 0),
        ),
      );
      let k = 0;
      while (k < left.length - 1 && r >= weights[k]!) {
        r -= weights[k]!;
        k++;
      }
      clientId = left[k]!.id;
    }
    used.add(clientId);
    out.push({ clientId, seed, recommended, locked: !recommended && !!out[0]?.recommended });
  }
  return out;
}
