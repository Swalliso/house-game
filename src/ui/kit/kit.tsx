// The interface's primitives (M5a): Panel, Card, Button, Chip, Plaque (the Counter), Icon,
// Keycap, Well, and for the sheets and Settings: Sheet, Switch, Slider, Segmented, and Price.
// Their look is in kit.css; every screen builds from these, so the pixel style, the
// readable-font switch, and the states stay the same everywhere. useDialogFocus keeps the
// keyboard inside a sheet or the menu while it's open.

import type { ComponentChildren, JSX, RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
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

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** The controls Tab reaches inside an element, in order (hidden ones left out). */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
  );
}

/** The open dialogs, oldest first: only the newest keeps the keyboard. */
const openDialogs: HTMLElement[] = [];

/**
 * Keeps the keyboard in a dialog (a sheet, the menu) while it's open: it takes focus when it
 * opens (an element marked data-autofocus, or `first`, or its first control), Tab and Shift+Tab
 * cycle inside it, and focus goes back where it was when it closes. Only the newest open dialog
 * holds the keyboard, so Settings opened from the menu keeps it until it closes.
 */
export function useDialogFocus(
  dialog: RefObject<HTMLElement>,
  first?: () => HTMLElement | null | undefined,
): void {
  useEffect(() => {
    const root = dialog.current;
    if (!root) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialogs.push(root);
    const start =
      root.querySelector<HTMLElement>('[data-autofocus]') ??
      first?.() ??
      focusables(root)[0] ??
      root;
    start.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || openDialogs[openDialogs.length - 1] !== root) return;
      const items = focusables(root);
      const head = items[0];
      const tail = items[items.length - 1];
      const at = document.activeElement as HTMLElement | null;
      const inside = !!at && root.contains(at);
      if (!head || !tail) {
        e.preventDefault();
        return;
      }
      // Off the list (the sheet's text, or outside the dialog): Shift+Tab goes to the last
      // control; Tab from outside goes to the first, and from the text to the next one in order.
      if (e.shiftKey && (!inside || at === head || !items.includes(at))) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && (!inside || at === tail)) {
        e.preventDefault();
        head.focus();
      }
    };
    // Capture, so it runs before anything else, and wherever focus happens to be.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const k = openDialogs.indexOf(root);
      if (k >= 0) openDialogs.splice(k, 1);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
}

/**
 * A scrim's click handlers: a press that starts on the scrim and ends there closes the dialog,
 * so a drag that starts inside it (selecting text) and ends outside it doesn't.
 */
export function useScrimClose(onClose: () => void): {
  onPointerDown: (e: PointerEvent) => void;
  onClick: (e: MouseEvent) => void;
} {
  const downOnScrim = useRef(false);
  return {
    onPointerDown: (e) => (downOnScrim.current = e.target === e.currentTarget),
    onClick: (e) => {
      if (e.target === e.currentTarget && downOnScrim.current) onClose();
    },
  };
}

/**
 * A sheet over the page (Settings, How to play, a copy fallback): a wood panel on a scrim, with
 * a close button on its plank. A press that starts on the scrim and ends there closes it, so a
 * drag out of the sheet doesn't. It holds the keyboard while it's open (useDialogFocus): its
 * text takes focus, so the arrow keys scroll it, unless a control is marked data-autofocus.
 * App.tsx closes the top sheet on Esc.
 */
export function Sheet({
  title,
  onClose,
  class: cls,
  label,
  head,
  footer,
  onKeyDown,
  children,
}: {
  title: ComponentChildren;
  onClose: () => void;
  class?: string;
  /** The dialog's name for screen readers, when the title isn't plain text. */
  label?: string;
  /** More on the plank, before the close button. */
  head?: ComponentChildren;
  /** A row under the body that never scrolls away: the sheet's buttons. */
  footer?: ComponentChildren;
  onKeyDown?: (e: KeyboardEvent) => void;
  children?: ComponentChildren;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, () => body.current);
  return (
    <div class="sheet-scrim" {...useScrimClose(onClose)}>
      <div
        ref={dialog}
        class={`sheet ${cls ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        onKeyDown={onKeyDown}
      >
        <Panel
          title={title}
          head={
            <>
              {head}
              <Button
                size="sm"
                iconOnly
                icon="close"
                class="sheet-close"
                onClick={onClose}
                aria-label="Close"
                title="Close (Esc)"
              />
            </>
          }
          bodyClass="sheet-body"
        >
          <div class="sheet-scroll" ref={body} tabIndex={-1}>
            {children}
          </div>
          {footer !== undefined && <div class="sheet-footer">{footer}</div>}
        </Panel>
      </div>
    </div>
  );
}

/** An on/off switch: a real checkbox, drawn as a pixel switch. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  class: cls,
  title,
  onMouseDown,
  children,
}: {
  checked: boolean;
  /** The new value; return false to put the switch back (the change was refused). */
  onChange: (on: boolean) => boolean | void;
  disabled?: boolean;
  class?: string;
  title?: string;
  onMouseDown?: (e: MouseEvent) => void;
  /** The switch's label, after it. */
  children?: ComponentChildren;
}) {
  return (
    <label
      class={`switch ${checked ? 'on' : ''} ${disabled ? 'disabled' : ''} ${cls ?? ''}`}
      title={title}
      onMouseDown={onMouseDown}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          const box = e.currentTarget;
          if (onChange(box.checked) === false) box.checked = checked;
        }}
      />
      <span class="switch-track" aria-hidden="true">
        <span class="switch-knob" />
      </span>
      {children !== undefined && <span class="switch-text">{children}</span>}
    </label>
  );
}

/** A slider from 0 to 100: a dark trough filled with wood up to a paper knob. */
export function Slider({
  label,
  value,
  onInput,
  min = 0,
  max = 100,
  step = 5,
}: {
  label: ComponentChildren;
  value: number;
  onInput: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const fill = ((value - min) / Math.max(1, max - min)) * 100;
  return (
    <label class="slider">
      <span class="slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${fill}%` }}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
      />
      <span class="slider-value num" aria-hidden="true">
        {value}
      </span>
    </label>
  );
}

/** A row of choices, one of them pressed in: the tally's speed, the font. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: ComponentChildren; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  /** The group's name for screen readers. */
  label: string;
}) {
  return (
    <div class="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          class={`seg ${o.value === value ? 'on' : ''}`}
          aria-pressed={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A price: the coin and the number, with the full price struck through on a sale. */
export function Price({
  price,
  full,
  short = false,
  class: cls,
}: {
  price: number;
  /** The price before a sale, struck through when it's higher. */
  full?: number;
  /** Too dear right now: the number in the bad color (with its reason elsewhere). */
  short?: boolean;
  class?: string;
}) {
  return (
    <span class={`price ${short ? 'short' : ''} ${cls ?? ''}`}>
      <Icon name="coin" />
      {full !== undefined && full > price && <s class="price-full num">{full}</s>}
      <span class="price-now num">{price}</span>
    </span>
  );
}
