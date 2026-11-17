// D-181: the finished rooms' lights on the board (house-paint.ts paintLight): one canvas a room,
// over its box, in the overhang's layer after the tall items' tops (layers.ts), so a lamp's shade
// glows over the wall band it rises across. A standing lamp's light moves with the furniture when
// the room wobbles (piece-fx.ts); a hanging lamp's stays with the walls, as the Chandelier does.
//
// A room an action has just finished keeps its light off until the director's beat switches it
// on (lightsHeld, lightSwitched): it flickers on, or fades in with Flashing off (fx/light.ts). A
// loaded run shows it on, with no beat, and so does Reduce motion.

import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { paintLight, type AtlasPixels } from '../art/house-paint.ts';
import { roomLayout } from '../art/rooms.ts';
import { lightsHeld, lightSwitched, played } from '../fx/director.ts';
import { lightOnFrames } from '../fx/light.ts';
import { settings } from '../settings.ts';
import { paintPieceArt, type PieceArtPlan } from './HouseLayers.tsx';
import type { HouseModel, Rect } from './house-model.ts';
import { register } from './piece-fx.ts';
import './lights.css';

export function LightsLayer({ model, scale }: { model: HouseModel; scale: number }) {
  const rooms = [...model.rooms.values()].filter((r) => r.finished);
  if (rooms.length === 0) return null;
  return (
    <div class="lights">
      {rooms.map((r) => (
        <RoomLight key={r.uid} model={model} uid={r.uid} box={r.box} scale={scale} />
      ))}
    </div>
  );
}

function RoomLight({
  model,
  uid,
  box,
  scale,
}: {
  model: HouseModel;
  uid: number;
  box: Rect;
  scale: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const held = lightsHeld.value.has(uid);
  const on = lightSwitched.value?.uid === uid ? lightSwitched.value.id : 0;
  const stands = !!roomLayout(model, uid).lamp;
  const plan = useMemo<PieceArtPlan>(
    () => ({ frame: box, paint: (atlas: AtlasPixels) => paintLight(model, uid, atlas) }),
    [model, uid, box],
  );
  // Before the browser paints, so the light changes in the same frame as the room.
  useLayoutEffect(() => paintPieceArt(ref.current, plan), [plan]);
  useLayoutEffect(
    () => (stands && ref.current ? register(uid, 'light', ref.current) : undefined),
    [uid, stands],
  );
  // Its switch: once per id, so remounting the game screen doesn't play it again.
  useLayoutEffect(() => {
    if (!on || on <= played.light || !ref.current || settings.value.reduceMotion) return;
    played.light = on;
    const { frames, ms, easing } = lightOnFrames(settings.value.flashing);
    ref.current.animate(frames, { duration: ms, easing });
  }, [on]);
  return (
    <canvas
      ref={ref}
      class="room-light"
      width={box.w}
      height={box.h}
      style={{
        left: `${box.x * scale}px`,
        top: `${box.y * scale}px`,
        width: `${box.w * scale}px`,
        height: `${box.h * scale}px`,
        ...(held ? { opacity: 0 } : {}),
      }}
      aria-hidden="true"
    />
  );
}
