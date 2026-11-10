// A household member's arrival as a doorbell (D-103, D-126; playtest 4's ask): a card slides in
// at the board's right edge, by the reserve their cards land in, with a "Ding-dong!" plank that
// rocks as the bell rings, their room's picture, who's arrived and what they brought. The
// doorbell rings at the house's front door on the board too (the director). It reads nothing
// like a milestone's gold ribbon, at the top center. A click on it dismisses it.

import { arrivalCard } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { Icon } from '../kit/kit.tsx';
import { PieceArt } from './PieceArt.tsx';

export function ArrivalCard() {
  const c = arrivalCard.value;
  if (!c) return null;
  // Their own room leads (Grandma's Room, the Nursery), the first card they bring.
  const room = c.cards[0];
  return (
    <div class="arrival-place">
      <div
        class="arrival-card ui"
        key={c.id}
        role="status"
        style={{
          '--card-ms': `${FEEL.arrival.cardMs}ms`,
          '--card-in': `${FEEL.arrival.cardInMs}ms`,
        }}
        onClick={() => (arrivalCard.value = null)}
      >
        <span class="arrival-bell">
          <Icon name="House" /> Ding-dong!
        </span>
        {room && (
          <span class="arrival-art">
            <PieceArt id={room} />
          </span>
        )}
        <div class="arrival-words">
          <p class="arrival-title">{c.title}</p>
          <p class="arrival-detail">{c.detail}</p>
        </div>
      </div>
    </div>
  );
}
