// A piece's picture for the interface (M5a): the piece as the board builds it, drawn by the
// house's own painters (HouseLayers.tsx pieceArtPlan, as for the ghost): a room's floor,
// furniture and outline walls, or a yard piece's ground and props. Hand cards show it, and so do
// the shop's art slots and How to play's sets. It's drawn unrotated, so a card never changes
// size when the piece turns, at about 1 CSS px per art px on whole device pixels (pictureScale).
// The picked card's turn shows on its ShapeGlyph instead. A narrow hand card shows it as a
// thumbnail (D-121, hand.css), at the --thumb size it carries (thumbScale).

import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { CONTENT, shapeCells, type FixtureId, type PieceId, type Rot } from '../../rules/index.ts';
import { artSize, type ArtId } from '../art/drawings.ts';
import { isIndoor } from '../board/geometry.ts';
import { paintArt, paintPieceArt, pieceArtPlan } from '../board/HouseLayers.tsx';
import { Icon } from '../kit/kit.tsx';
import { FIXTURE_ICONS } from '../sprites.ts';
import { devicePixelRatio, pictureScale, thumbScale } from '../theme/pixel.ts';

export function PieceArt({ id, class: cls }: { id: PieceId; class?: string }) {
  const dpr = devicePixelRatio.value;
  const scale = pictureScale(dpr);
  const thumb = thumbScale(dpr);
  const plan = useMemo(() => pieceArtPlan(id, 0), [id]);
  const ref = useRef<HTMLCanvasElement>(null);
  // Before the browser paints, so the picture is never seen blank.
  useLayoutEffect(() => paintPieceArt(ref.current, plan), [plan]);
  const { frame } = plan;
  const size = {
    width: `${frame.w * scale}px`,
    height: `${frame.h * scale}px`,
    '--thumb-w': `${frame.w * thumb}px`,
    '--thumb-h': `${frame.h * thumb}px`,
  };
  return (
    <span
      class={`piece-art ${isIndoor(id) ? 'indoor' : 'yard'} ${cls ?? ''}`}
      style={size}
      aria-hidden="true"
    >
      <canvas ref={ref} width={frame.w} height={frame.h} />
    </span>
  );
}

/**
 * The art a fixture is drawn with on the board, where it has a sprite of its own (rooms.ts,
 * yard.ts): the Fireplace's stove, the Bunk Beds, the Kitchen Island, the Sprinkler, the Pergola.
 * The ones painted with their room (the Skylight's light, Blackout Curtains, Soundproofing, the
 * Bay Window, the Chandelier) and Garden Lights' pair of bollards show their icon instead.
 */
export const FIXTURE_ART: Partial<Record<FixtureId, ArtId>> = {
  fireplace: 'fireplace',
  bunkBeds: 'bunk-bed-0',
  kitchenIsland: 'kitchen-island',
  sprinkler: 'own-sprinkler',
  pergola: 'pergola',
};

/**
 * A fixture's picture for the shop's art slots: its art as the board draws it, at the pieces'
 * picture scale, or its icon drawn large.
 */
export function FixtureArt({ id }: { id: FixtureId }) {
  const art = FIXTURE_ART[id];
  if (!art) return <Icon name={FIXTURE_ICONS[id]} class="art-icon own" />;
  return <ArtPicture id={art} />;
}

/** One piece of the board's art, on whole device pixels at the pieces' picture scale. */
function ArtPicture({ id }: { id: ArtId }) {
  const scale = pictureScale(devicePixelRatio.value);
  const ref = useRef<HTMLCanvasElement>(null);
  // Before the browser paints, so the picture is never seen blank.
  useLayoutEffect(() => paintArt(ref.current, id), [id]);
  const { w, h } = artSize(id);
  const size = { width: `${w * scale}px`, height: `${h * scale}px` };
  return (
    <span class="piece-art fixture-art" style={size} aria-hidden="true">
      <canvas ref={ref} width={w} height={h} style={size} />
    </span>
  );
}

/**
 * The piece's shape as little squares, turned `rot` quarter turns: a short window's cards show
 * it in place of the picture, and the picked hand card shows it turning as you rotate. A
 * `square` glyph is centered in a box as long as the shape, so turning it never changes the
 * card's size. Squares are three UI pixels across with a pixel between them, smaller for a
 * long shape, so the box is never taller than a keycap (12 UI pixels).
 */
export function ShapeGlyph({
  id,
  rot = 0,
  square = false,
}: {
  id: PieceId;
  rot?: Rot;
  square?: boolean;
}) {
  const shape = CONTENT.pieces[id].shape;
  const cells = shapeCells(shape, rot);
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  const long = Math.max(w, h);
  const cols = square ? long : w;
  const rows = square ? long : h;
  const dx = Math.floor((cols - w) / 2);
  const dy = Math.floor((rows - h) / 2);
  const cell = long <= 3 ? 3 : 2;
  const gap = long <= 4 ? 1 : 0;
  return (
    <span
      class="shape-glyph"
      style={{
        '--cols': String(cols),
        '--rows': String(rows),
        '--cell': String(cell),
        '--gap': String(gap),
      }}
      aria-hidden="true"
    >
      {cells.map((c) => (
        <span key={`${c.x},${c.y}`} style={{ gridColumn: c.x + dx + 1, gridRow: c.y + dy + 1 }} />
      ))}
    </span>
  );
}
