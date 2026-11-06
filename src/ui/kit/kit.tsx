// The interface's primitives (M5a): Panel, Card, Button, Chip, Plaque (the Counter), Icon,
// Keycap, and Well. Their look is in kit.css; every screen builds from these, so the pixel style, the
// readable-font switch, and the states stay the same everywhere.

import type { ComponentChildren, JSX } from 'preact';
import { ICON_SIZES, type IconName } from '../theme/art.ts';

export type { IconName };

/** An icon from theme/icons.ts, one art px per UI pixel. Decorative unless it has a label. */
export function Icon({
  name,
  label,
  class: cls,
}: {
  name: IconName;
  /** Read out by screen readers, and shown on hover. Omit for a decorative icon. */
  label?: string;
  class?: string;
}) {
  const { w, h } = ICON_SIZES[name];
  return (
    <span
      class={`icon ${cls ?? ''}`}
      style={{ '--w': String(w), '--h': String(h), '--icon': `var(--art-icon-${name})` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      title={label}
    />
  );
}

/** A wood-framed panel with a plank header and a paper body. */
export function Panel({
  title,
  head,
  class: cls,
  bodyClass,
  label,
  children,
}: {
  /** The plank's title. */
  title?: ComponentChildren;
  /** More on the plank, after the title: a count, a button. */
  head?: ComponentChildren;
  class?: string;
  bodyClass?: string;
  /** The region's name for screen readers, when the title isn't enough. */
  label?: string;
  children?: ComponentChildren;
}) {
  return (
    <section class={`panel ui ${cls ?? ''}`} aria-label={label}>
      {(title !== undefined || head !== undefined) && (
        <header class="panel-head">
          {title !== undefined && <h2 class="panel-title">{title}</h2>}
          {head}
        </header>
      )}
      <div class={`panel-body ${bodyClass ?? ''}`}>{children}</div>
    </section>
  );
}

export type CardTone = 'plain' | 'room' | 'yard' | 'hall' | 'outbuilding' | 'fixture';
export type CardRarity = 'common' | 'uncommon' | 'rare';

type CardProps = Omit<JSX.HTMLAttributes<HTMLElement>, 'title' | 'as'> & {
  /** A button for a card you pick (the hand), an article for one with buttons inside (a shop offer). */
  as?: 'button' | 'article' | 'div';
  title: ComponentChildren;
  /** Before the title: a keycap, an icon. */
  lead?: ComponentChildren;
  /** After the title, at the head's end: a price, a small shape. */
  aside?: ComponentChildren;
  /** The art slot: a piece's picture, a sprite. */
  art?: ComponentChildren;
  /** The effect lines, each with a bullet. */
  lines?: readonly string[];
  /** A quieter line under them. */
  note?: ComponentChildren;
  /** The chips row: the kind, the tags, the rarity. */
  chips?: ComponentChildren;
  /** A warning at the foot, in the bad color with a cross: "Nowhere fits". */
  alert?: ComponentChildren;
  tone?: CardTone;
  rarity?: CardRarity;
  selected?: boolean;
  /** Hatched: it can't be used now. */
  blocked?: boolean;
  /** Shown on hover (the element's title attribute; `title` is the card's heading). */
  tooltip?: string;
  class?: string;
};

/**
 * A paper card: the title, an art slot, effect lines, chips, and a band inside its ring for its
 * kind or rarity. Picked, it lifts three UI pixels with an ink band; blocked, it's hatched. A
 * card that's a button lifts one UI pixel on hover. Hand cards use it; so can the shop's offers
 * and a crate's options.
 */
export function Card({
  as = 'article',
  title,
  lead,
  aside,
  art,
  lines,
  note,
  chips,
  alert,
  tone = 'plain',
  rarity,
  selected = false,
  blocked = false,
  tooltip,
  class: cls,
  children,
  ...rest
}: CardProps) {
  const Tag = as as 'article';
  const classes = [
    'pcard',
    as === 'button' ? 'pcard-action' : '',
    tone === 'plain' ? '' : `tone-${tone}`,
    rarity ? `rarity-${rarity}` : '',
    selected ? 'is-selected' : '',
    blocked ? 'is-blocked' : '',
    cls ?? '',
  ];
  return (
    <Tag
      class={classes.filter(Boolean).join(' ')}
      title={tooltip}
      {...(as === 'button' ? { type: 'button' } : {})}
      {...rest}
    >
      <span class="pcard-head">
        {lead}
        <span class="pcard-title">{title}</span>
        {aside}
      </span>
      {art !== undefined && <span class="pcard-art">{art}</span>}
      {lines && lines.length > 0 && (
        <ul class="pcard-lines">
          {lines.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {note !== undefined && <span class="pcard-note">{note}</span>}
      {chips !== undefined && <span class="pcard-chips">{chips}</span>}
      {children}
      {alert !== undefined && (
        <span class="pcard-alert">
          <Icon name="cross" />
          {alert}
        </span>
      )}
    </Tag>
  );
}

export type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'armed' | 'wood';

type ButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'icon' | 'size'> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  /** A square button with just an icon: give it a label. */
  iconOnly?: boolean;
  icon?: IconName;
  block?: boolean;
  class?: string;
};

/**
 * A button: secondary (paper) by default, one primary (lime) per view, danger for demolish,
 * armed for a press that waits for a second one. Hover lifts it, a press sinks it.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  icon,
  block = false,
  class: cls,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant === 'secondary' ? '' : `btn-${variant}`,
    size === 'md' ? '' : `btn-${size}`,
    iconOnly ? 'btn-icon' : '',
    block ? 'btn-block' : '',
    cls ?? '',
  ];
  return (
    <button type={type} class={classes.filter(Boolean).join(' ')} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export type ChipTone = 'plain' | 'wood' | 'inset' | 'common' | 'uncommon' | 'rare';

/** A small label: a tag, a kind, a rarity, a count. */
export function Chip({
  icon,
  tone = 'plain',
  class: cls,
  title,
  children,
}: {
  icon?: IconName;
  tone?: ChipTone;
  class?: string;
  title?: string;
  children?: ComponentChildren;
}) {
  return (
    <span class={`chip ${tone === 'plain' ? '' : `chip-${tone}`} ${cls ?? ''}`} title={title}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export type PlaqueTone = 'plain' | 'comfort' | 'charm' | 'sparkle' | 'wood';

/** A number on a tinted plate, in the display font's even-width digits: the Counter. */
export function Plaque({
  tone = 'plain',
  icon,
  class: cls,
  children,
  label,
}: {
  tone?: PlaqueTone;
  icon?: IconName;
  class?: string;
  children?: ComponentChildren;
  label?: string;
}) {
  return (
    <span
      class={`plaque ${tone === 'plain' ? '' : `plaque-${tone}`} ${cls ?? ''}`}
      aria-label={label}
    >
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

/** A key on the keyboard: 1, R, Enter. */
export function Keycap({ children }: { children: ComponentChildren }) {
  return <kbd class="keycap">{children}</kbd>;
}

/** An empty slot, recessed. */
export function Well({ class: cls, label }: { class?: string; label?: string }) {
  return <span class={`well ${cls ?? ''}`} role={label ? 'img' : undefined} aria-label={label} />;
}
