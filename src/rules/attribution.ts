// D-122 (score legibility, the jam slice): where a play's change to the week's Wow comes from.
//
// A week's Wow is Comfort × Charm × Sparkle (scoring.ts: Comfort is the pieces' earnings and the
// sets' Comfort; Charm is 1 plus the sets, the checklist lines held, and +Mult modifiers; then
// each ×Mult source). A play's change splits exactly into three kinds of part:
// - Comfort parts, each worth its Comfort × the old Charm and Sparkle;
// - Charm parts, each worth its Charm × the new Comfort and the old Sparkle;
// - one Sparkle part: the new Comfort and Charm × the change in Sparkle.
// They add up to the change before the total's rounding. Largest-remainder rounding then makes
// the whole parts add up to the preview's `delta` exactly, so the board can name a cause without
// ever disagreeing with the number beside it.
//
// The parts are coarse: the played piece (an install's host, a renovated room) as one part,
// each other piece that earns more or less as one, each set made or broken (its Comfort and
// Charm together), each checklist line turned on or off, each +Mult modifier that changes, and
// Sparkle. Whatever none of those explains (a held set whose level changed) is "other".

import type { Content, Tally, WowPart, WowPartKind } from './index.ts';

export interface RawPart {
  kind: WowPartKind;
  label: string;
  wow: number;
  uid?: number;
}

const KIND_ORDER: Record<WowPartKind, number> = {
  set: 0,
  spec: 1,
  sparkle: 2,
  charm: 3,
  piece: 4,
  neighbor: 5,
  other: 6,
};

/** The additive Charm, before any ×Mult source: the first source's `before`. */
function additive(t: Tally): number {
  return t.xMults[0]?.before ?? t.mult;
}

/**
 * The parts of a play's change to the week's Wow, biggest first. `focus` is the played piece's
 * uid (or the install's host, or the renovated room). Their `wow` adds up to
 * `after.total - before.total` exactly.
 */
export function wowParts(
  content: Content,
  before: Tally,
  after: Tally,
  focus: number,
  specName: (id: string) => string,
): WowPart[] {
  const P0 = before.points;
  const P1 = after.points;
  const M0 = before.mult;
  const M1 = after.mult;
  const A0 = additive(before);
  const A1 = additive(after);
  // Sparkle as a ratio. With no Charm at all there's nothing to multiply.
  const X0 = A0 > 0 ? M0 / A0 : 1;
  // Wow per Comfort, and per hundredth of Charm (hundredths: 100 is ×1).
  const perComfort = M0 / 100;
  const perCharm = (P1 * X0) / 100;
  const raw: RawPart[] = [];
  let comfortSeen = 0;
  let charmSeen = 0;
  const comfort = (d: number) => {
    comfortSeen += d;
    return d * perComfort;
  };
  const charm = (d: number) => {
    charmSeen += d;
    return d * perCharm;
  };

  // The pieces: the played one, then each other piece that earns more or less.
  const was = new Map(before.pieces.map((p) => [p.uid, p]));
  const seen = new Set<number>();
  for (const p of after.pieces) {
    seen.add(p.uid);
    const d = p.earned - (was.get(p.uid)?.earned ?? 0);
    const name = content.pieces[p.defId].name;
    if (p.uid === focus) {
      raw.push({ kind: 'piece', label: name, wow: comfort(d), uid: p.uid });
    } else if (d !== 0) {
      const label = `${name} earns ${d > 0 ? 'more' : 'less'}`;
      raw.push({ kind: 'neighbor', label, wow: comfort(d), uid: p.uid });
    }
  }
  for (const p of before.pieces) {
    if (seen.has(p.uid) || p.earned === 0) continue;
    const label = `${content.pieces[p.defId].name} earns less`;
    raw.push({ kind: 'neighbor', label, wow: comfort(-p.earned), uid: p.uid });
  }

  // Sets made and broken: Comfort and Charm in one part.
  const beforeKeys = new Set(before.sets.map((s) => s.key));
  const afterKeys = new Set(after.sets.map((s) => s.key));
  for (const s of after.sets) {
    if (beforeKeys.has(s.key)) continue;
    const name = content.sets[s.set].name;
    raw.push({ kind: 'set', label: name, wow: comfort(s.points) + charm(s.mult) });
  }
  for (const s of before.sets) {
    if (afterKeys.has(s.key)) continue;
    const label = `Breaks ${content.sets[s.set].name}`;
    raw.push({ kind: 'set', label, wow: comfort(-s.points) + charm(-s.mult) });
  }

  // Checklist lines turned on and off.
  const met = new Map(before.specs.map((sp) => [sp.id, sp.met]));
  for (const sp of after.specs) {
    const had = met.get(sp.id) ?? false;
    if (sp.met && !had) {
      raw.push({ kind: 'spec', label: specName(sp.id), wow: charm(after.specBonus) });
    } else if (!sp.met && had) {
      raw.push({ kind: 'spec', label: `${specName(sp.id)} off`, wow: charm(-before.specBonus) });
    }
  }

  // +Mult modifiers whose count changed (Mood Lighting's lit rooms, say).
  const terms = new Map<string, { label: string; d: number }>();
  for (const t of before.multTerms) {
    const key = JSON.stringify(t.source);
    terms.set(key, { label: t.label, d: (terms.get(key)?.d ?? 0) - t.add });
  }
  for (const t of after.multTerms) {
    const key = JSON.stringify(t.source);
    terms.set(key, { label: t.label, d: (terms.get(key)?.d ?? 0) + t.add });
  }
  for (const { label, d } of terms.values()) {
    if (d !== 0) raw.push({ kind: 'charm', label, wow: charm(d) });
  }

  // What the parts above don't explain, in Comfort and in Charm.
  const otherComfort = P1 - P0 - comfortSeen;
  const otherCharm = A1 - A0 - charmSeen;
  if (otherComfort !== 0 || otherCharm !== 0) {
    raw.push({
      kind: 'other',
      label: 'Other changes',
      wow: otherComfort * perComfort + otherCharm * perCharm,
    });
  }

  // Sparkle: the rest of the exact change.
  const sparkle = (P1 * M1 - P1 * A1 * X0) / 100;
  if (Math.abs(sparkle) > 1e-9) {
    const had = new Set(before.xMults.map((x) => x.label));
    const has = new Set(after.xMults.map((x) => x.label));
    const changed = [
      ...after.xMults.filter((x) => !had.has(x.label)).map((x) => x.label),
      ...before.xMults.filter((x) => !has.has(x.label)).map((x) => `${x.label} off`),
    ];
    raw.push({
      kind: 'sparkle',
      label: changed.length === 1 ? changed[0]! : 'Sparkle',
      wow: sparkle,
    });
  }

  return roundParts(raw, after.total - before.total);
}

/**
 * Whole parts that add up to `delta`: each part rounded down, then the shortfall handed out one
 * by one to the parts that lost the most to rounding (ties: the earlier part). The raw parts
 * add up to the change before the total's rounding, so the shortfall is between 0 and their
 * count; a change from the total's rounding alone becomes an "other" part. Parts that round to
 * 0 are dropped. Biggest first, by size.
 */
export function roundParts(raw: readonly RawPart[], delta: number): WowPart[] {
  const floors = raw.map((p) => Math.floor(p.wow + 1e-9));
  let short = delta - floors.reduce((n, f) => n + f, 0);
  const order = raw
    .map((p, i) => ({ i, frac: p.wow - floors[i]! }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const whole = [...floors];
  for (let k = 0; k < order.length && short > 0; k++, short--) whole[order[k]!.i]! += 1;
  const parts: WowPart[] = raw.map((p, i) => ({
    kind: p.kind,
    label: p.label,
    wow: whole[i]!,
    ...(p.uid !== undefined ? { uid: p.uid } : {}),
  }));
  // A shortfall the parts can't absorb (none, or a rounding of the total alone).
  if (short !== 0) parts.push({ kind: 'other', label: 'Other changes', wow: short });
  return parts
    .filter((p) => p.wow !== 0)
    .sort((a, b) => Math.abs(b.wow) - Math.abs(a.wow) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}
