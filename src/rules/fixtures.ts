// Fixtures (D-050; implementation-plan.md §4, Layout rules): a fixture is installed in a placed
// piece that matches its `fits` selector, checked when it's installed. Each piece holds one;
// installing another replaces it (the preview shows what's lost). Its modifiers apply to its
// host only, from the tally of the week it's installed, and it goes when its host is
// demolished, with no refund. It never changes the host's shape, category, or connectivity.
// A piece that becomes a lot feature (the Sapling, which becomes a Tree) can't hold one,
// since the fixture would go with it (D-095).

import type { Content, FeatureId, FixtureId, HouseState, PieceDef } from './index.ts';
import { pieceDef, type Layout } from './layout.ts';
import { matchesPiece } from './selectors.ts';
import { selectorText } from './text.ts';

export type InstallCheck =
  { legal: true; replaces?: FixtureId } | { legal: false; reason: string; replaces?: FixtureId };

export function checkInstall(
  content: Content,
  layout: Layout,
  fixture: FixtureId,
  uid: number,
): InstallCheck {
  const def = content.fixtures[fixture];
  const piece = Number.isInteger(uid) ? layout.byUid.get(uid) : undefined;
  if (!def) return { legal: false, reason: 'That isn’t a fixture.' };
  if (!piece) return { legal: false, reason: 'Pick a piece on the lot to put it in.' };
  const replaces = piece.fixture?.id;
  if (replaces === fixture) {
    return {
      legal: false,
      reason: `It already has ${def.name.endsWith('s') ? 'its' : 'a'} ${def.name}.`,
      replaces,
    };
  }
  if (!matchesPiece(content, layout, def.fits, uid)) {
    const host = pieceDef(content, piece).name;
    // "Bunk Beds go", "A Fireplace goes".
    const plural = def.name.endsWith('s');
    const subject = plural ? def.name : `${/^[AEIOU]/i.test(def.name) ? 'An' : 'A'} ${def.name}`;
    const an = /^[AEIOU]/i.test(host) ? 'an' : 'a';
    return {
      legal: false,
      reason: `${subject} ${plural ? 'go' : 'goes'} in ${fitsText(content, fixture)}, not ${an} ${host}.`,
      replaces,
    };
  }
  // A host that becomes a lot feature would take the fixture with it (D-095). Checked after
  // `fits`, so a fixture that doesn't fit anyway says where it goes.
  const hostDef = pieceDef(content, piece);
  const feature = becomesFeature(hostDef);
  if (feature) {
    // "A Sapling becomes a Tree".
    const host = `${/^[AEIOU]/i.test(hostDef.name) ? 'An' : 'A'} ${hostDef.name}`;
    const into = content.features[feature].name;
    const an = /^[AEIOU]/i.test(into) ? 'an' : 'a';
    return {
      legal: false,
      reason: `${host} becomes ${an} ${into}, so it can’t hold a fixture.`,
      replaces,
    };
  }
  return replaces ? { legal: true, replaces } : { legal: true };
}

/** The lot feature a piece turns into (the Sapling's Tree), if it has such a transform. */
function becomesFeature(def: PieceDef): FeatureId | undefined {
  for (const e of def.effects) {
    if (e.kind === 'transform' && 'feature' in e.into) return e.into.feature;
  }
  return undefined;
}

/** "any room", "a Kitchen", "an exterior room". */
export function fitsText(content: Content, fixture: FixtureId): string {
  const def = content.fixtures[fixture];
  const sel = def.fits;
  if (sel !== 'all' && 'property' in sel && sel.property === 'room') return 'any room';
  if (sel !== 'all' && 'property' in sel && sel.property === 'yard') return 'any yard piece';
  const text = selectorText(content, sel, 'one');
  return /^[AEIOU]/i.test(text) ? `an ${text}` : `a ${text}`;
}

/** The pieces a fixture could go in now, by uid, in placement order. */
export function installHosts(content: Content, layout: Layout, fixture: FixtureId): number[] {
  return layout.house.pieces
    .filter((p) => checkInstall(content, layout, fixture, p.uid).legal)
    .map((p) => p.uid);
}

/** The house with the fixture in the piece (already checked legal), replacing any other. */
export function withFixture(
  house: HouseState,
  uid: number,
  fixture: FixtureId,
  week: number,
): HouseState {
  return {
    ...house,
    pieces: house.pieces.map((p) => (p.uid === uid ? { ...p, fixture: { id: fixture, week } } : p)),
  };
}
