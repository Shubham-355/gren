"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { findGlossaryEntry } from "@/lib/data/glossary";
import { inr, parseAmount } from "@/lib/format";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ================================================================
   Card
   ================================================================ */

export function Card({
  children,
  className,
  style,
  tone = "plain",
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  tone?:
    | "plain"
    | "sunk"
    | "accent"
    | "alert"
    | "ok"
    | "warn"
    | "copilot"
    | "plum"
    | "money";
  as?: "section" | "div" | "article" | "li";
}) {
  const tones = {
    plain: "bg-surface border-line",
    sunk: "bg-sunk border-line",
    accent: "bg-plum-50 border-plum-100",
    alert: "bg-alert-50 border-alert-100",
    ok: "bg-ok-50 border-ok-100",
    warn: "bg-warn-50 border-warn-100",
    copilot: "bg-petrol-50 border-petrol-100",
    /* payoff surfaces: solid plum for the product, solid green for money */
    plum: "bg-[color:var(--plum)] border-transparent text-white",
    money: "bg-[color:var(--ok)] border-transparent text-white",
  } as const;
  return (
    <As
      style={style}
      className={cx(
        "rounded-[var(--radius)] border shadow-[var(--shadow-sm)]",
        tones[tone],
        className,
      )}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  eyebrow,
  action,
  description,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <h2 className="text-[20px] leading-[1.15]">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ================================================================
   Button
   ================================================================ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "clay";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  /** Working, not unavailable — keeps its colour and shows a spinner. */
  pending?: boolean;
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition-colors disabled:cursor-not-allowed";

const buttonVariants = {
  primary:
    "bg-[color:var(--plum)] text-white hover:bg-[color:var(--plum-deep)] shadow-[var(--shadow-sm)]",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-sunk",
  ghost: "text-[color:var(--plum)] hover:bg-plum-50",
  danger: "bg-[color:var(--alert)] text-white hover:brightness-90",
  clay: "bg-[color:var(--clay)] text-white hover:bg-[color:var(--clay-ink)]",
  /* the copilot's own colour — the product never uses it for its own actions */
  copilot:
    "bg-[color:var(--petrol)] text-white hover:bg-[color:var(--petrol-ink)] shadow-[var(--shadow-sm)]",
  onPlum: "bg-white text-[color:var(--plum)] hover:bg-plum-50",
} as const;

const buttonSizes = {
  // 34px is the size this button is drawn at; `tap` is what a thumb actually
  // gets to hit. See the touch-target rule in globals.css.
  sm: "tap text-[13px] h-[34px] px-3.5",
  md: "text-[14.5px] h-[44px] px-5",
  lg: "text-[16px] h-[52px] px-6",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  block,
  pending,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cx(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        block && "w-full",
        // A button that is working is not a button that is unavailable, so it
        // keeps its full colour while it waits. Dimming it to 45% reads as
        // "you cannot do this", which is the opposite of what is happening.
        pending ? "cursor-wait" : "disabled:opacity-45",
        className,
      )}
    >
      {pending ? <Spinner size={size === "lg" ? 18 : 16} /> : null}
      {children}
    </button>
  );
}

/**
 * Shown only where a wait is real. The OTP check is simulated, but it is the
 * one gesture in this app that stands in for a round trip, and it has to look
 * like one.
 *
 * Under prefers-reduced-motion the spin is flattened to nothing by the global
 * rule, so every caller pairs this with a word — "Verifying" — that carries
 * the same message without moving.
 */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 animate-spin"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2.75"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  block,
  className,
  children,
}: {
  href: string;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        block && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ================================================================
   Badge / pill
   ================================================================ */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "alert" | "info" | "plum" | "clay";
  className?: string;
}) {
  const tones = {
    neutral: "bg-sunk text-ink-soft border-line-strong",
    ok: "bg-ok-50 text-[color:var(--ok)] border-ok-100",
    warn: "bg-warn-50 text-[color:var(--warn)] border-warn-100",
    alert: "bg-alert-50 text-[color:var(--alert)] border-alert-100",
    info: "bg-petrol-50 text-[color:var(--petrol)] border-petrol-100",
    plum: "bg-plum-50 text-[color:var(--plum)] border-plum-100",
    clay: "bg-clay-50 text-[color:var(--clay-ink)] border-warn-100",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[11.5px] font-semibold leading-4",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The honesty marker required on every seeded or simulated figure. */
/** For numbers this app computed itself, as opposed to numbers it was handed. */
export function ComputedTag() {
  return (
    <span
      className="ml-1.5 inline-flex select-none items-center rounded-[var(--radius-pill)] border border-plum-100 bg-plum-50 px-1.5 py-px align-middle text-[10px] font-medium uppercase tracking-wide text-[color:var(--plum)]"
      title="Calculated live by this app from the rules in lib/tax."
    >
      computed
    </span>
  );
}

/* ================================================================
   Stat
   ================================================================ */

export function Stat({
  label,
  value,
  hint,
  tone = "plain",
  tag,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "plain" | "ok" | "alert" | "plum";
  tag?: ReactNode;
}) {
  const valueTone = {
    plain: "text-ink",
    ok: "text-[color:var(--ok)]",
    alert: "text-[color:var(--alert)]",
    plum: "text-[color:var(--plum)]",
  } as const;
  return (
    <div className="min-w-0">
      {/* Wrap, do not truncate. In a two-column grid on a phone these labels
          became "REFUND …" and "ACKNOWLE…", which is worse than two lines. */}
      <div className="eyebrow flex flex-wrap items-start gap-x-1.5">
        <span className="leading-snug">{label}</span>
        {tag}
      </div>
      <div
        className={cx(
          "tnum mt-1.5 font-display text-[26px] leading-none",
          valueTone[tone],
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[12px] text-ink-faint">{hint}</div> : null}
    </div>
  );
}

/* ================================================================
   Rows for computation tables
   ================================================================ */

export function Row({
  label,
  value,
  note,
  strong,
  negative,
  tone,
  indent,
}: {
  label: ReactNode;
  value: number | string;
  note?: ReactNode;
  strong?: boolean;
  negative?: boolean;
  tone?: "ok" | "alert" | "muted";
  indent?: boolean;
}) {
  const toneClass =
    tone === "ok"
      ? "text-[color:var(--ok)]"
      : tone === "alert"
        ? "text-[color:var(--alert)]"
        : tone === "muted"
          ? "text-ink-faint"
          : "";
  return (
    <div
      className={cx(
        "flex items-baseline justify-between gap-4 py-2",
        indent && "pl-4",
        strong && "border-t border-line-strong pt-2.5",
      )}
    >
      <div className="min-w-0">
        <div
          className={cx(
            "text-[13.5px] leading-snug",
            strong ? "font-semibold text-ink" : "text-ink-soft",
            toneClass,
          )}
        >
          {label}
        </div>
        {note ? (
          <div className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">
            {note}
          </div>
        ) : null}
      </div>
      <div
        className={cx(
          "tnum shrink-0 text-[14px]",
          strong ? "font-display text-[16px] font-semibold" : "font-medium",
          toneClass,
        )}
      >
        {typeof value === "number"
          ? `${negative && value !== 0 ? "− " : ""}${inr(Math.abs(value))}`
          : value}
      </div>
    </div>
  );
}

/* ================================================================
   Fields
   ================================================================ */

export function Field({
  label,
  hint,
  children,
  suffix,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  suffix?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-[13px] font-medium text-ink-soft">
        <span>{label}</span>
        {suffix}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[11.5px] leading-snug text-ink-faint">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-[color:var(--plum)]";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

/** A rupee input that keeps the store numeric and the display readable. */
export function MoneyInput({
  value,
  onValueChange,
  disabled,
  max,
  placeholder,
  id,
}: {
  value: number;
  onValueChange: (n: number) => void;
  disabled?: boolean;
  max?: number;
  placeholder?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  const display = focused
    ? draft
    : value
      ? value.toLocaleString("en-IN")
      : "";

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-faint">
        ₹
      </span>
      <input
        id={id}
        inputMode="numeric"
        disabled={disabled}
        placeholder={placeholder ?? "0"}
        value={display}
        onFocus={() => {
          setDraft(value ? String(value) : "");
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseAmount(e.target.value);
          onValueChange(max !== undefined ? Math.min(n, max) : n);
        }}
        className={cx(inputClass, "tnum pl-7 disabled:bg-sunk disabled:text-ink-faint")}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-[var(--radius-sm)] p-1 text-left"
    >
      <span
        className={cx(
          "mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-[var(--radius-pill)] p-0.5 transition-colors",
          checked ? "bg-[color:var(--plum)]" : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-[var(--radius-pill)] border border-line-strong bg-sunk p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            "rounded-[var(--radius-pill)] font-medium transition-colors",
            // Padded out for a thumb below lg. Segments touch each other, so
            // this one cannot use the `tap` overlay — it would sit over its
            // neighbour and swallow the tap meant for it.
            size === "sm"
              ? "px-3 py-2 text-[12.5px] lg:py-1"
              : "px-4 py-2.5 text-[13.5px] lg:py-1.5",
            value === o.value
              ? "bg-surface text-ink shadow-[var(--shadow-sm)]"
              : "text-ink-faint hover:text-ink-soft",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ================================================================
   Inline jargon explainer
   ================================================================ */

const TermPopoverContext = createContext<{
  openTerm: string | null;
  setOpenTerm: (t: string | null) => void;
} | null>(null);

export function TermProvider({ children }: { children: ReactNode }) {
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  return (
    <TermPopoverContext.Provider value={{ openTerm, setOpenTerm }}>
      {children}
    </TermPopoverContext.Provider>
  );
}

/**
 * Any piece of jargon that has to appear on screen is wrapped in this, so a
 * one-line explanation is always one tap away.
 */
export function Term({
  children,
  name,
}: {
  children?: ReactNode;
  name: string;
}) {
  const ctx = useContext(TermPopoverContext);
  const id = useId();
  const entry = findGlossaryEntry(name);
  const open = ctx?.openTerm === id;

  if (!entry) return <>{children ?? name}</>;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => ctx?.setOpenTerm(open ? null : id)}
        className="cursor-help border-b border-dotted border-[color:var(--plum)] text-[color:var(--plum)] decoration-dotted underline-offset-2 hover:border-solid"
        aria-expanded={open}
      >
        {children ?? entry.term}
      </button>
      {open ? (
        <span
          role="dialog"
          className="animate-rise absolute left-0 top-full z-40 mt-1.5 block w-[min(19rem,78vw)] rounded-[var(--radius-sm)] border border-line-strong bg-surface p-3 text-left shadow-[var(--shadow-lg)]"
        >
          <span className="block font-display text-[14px] font-semibold text-ink">
            {entry.term}
          </span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-soft">
            {entry.short}
          </span>
          <span className="mt-2 flex items-center justify-between gap-2">
            <Link
              href={`/help#${slug(entry.term)}`}
              className="text-[12px] font-medium text-[color:var(--plum)] underline underline-offset-2"
              onClick={() => ctx?.setOpenTerm(null)}
            >
              Read more
            </Link>
            <button
              type="button"
              onClick={() => ctx?.setOpenTerm(null)}
              className="text-[12px] text-ink-faint"
            >
              Close
            </button>
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ================================================================
   Misc layout helpers
   ================================================================ */

export function PageHeader({
  title,
  intro,
  eyebrow,
  aside,
}: {
  title: ReactNode;
  intro?: ReactNode;
  eyebrow?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-[32px] leading-[1.08] tracking-[-0.01em] sm:text-[44px]">
          {title}
        </h1>
        {aside}
      </div>
      {intro ? (
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[16px]">
          {intro}
        </p>
      ) : null}
    </header>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "warn" | "alert" | "ok" | "plum";
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    info: "bg-petrol-50 border-petrol-100 text-[color:var(--petrol)]",
    warn: "bg-warn-50 border-warn-100 text-[color:var(--warn)]",
    alert: "bg-alert-50 border-alert-100 text-[color:var(--alert)]",
    ok: "bg-ok-50 border-ok-100 text-[color:var(--ok)]",
    plum: "bg-plum-50 border-plum-100 text-[color:var(--plum)]",
  } as const;
  return (
    <div
      className={cx(
        "rounded-[var(--radius-sm)] border px-3.5 py-3 text-[13px] leading-relaxed",
        tones[tone],
      )}
    >
      {title ? (
        <div className="mb-1 flex items-center gap-1.5 font-semibold">
          {icon}
          {title}
        </div>
      ) : null}
      <div className="text-ink-soft">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: ReactNode;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-line-strong bg-sunk/50 px-5 py-8 text-center">
      <h3 className="font-display text-[16px]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-soft">
        {body}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ProgressTrack({
  steps,
  current,
}: {
  steps: { id: string; label: string; description?: string }[];
  current: number;
}) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                  done && "border-[color:var(--ok)] bg-[color:var(--ok)] text-white",
                  active &&
                    "border-[color:var(--plum)] bg-plum-50 text-[color:var(--plum-ink)]",
                  !done && !active && "border-line-strong bg-surface text-ink-faint",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={cx(
                    "my-1 w-px flex-1",
                    done ? "bg-[color:var(--ok)]" : "bg-line-strong",
                  )}
                />
              ) : null}
            </div>
            <div className={cx("pb-5", i === steps.length - 1 && "pb-0")}>
              <div
                className={cx(
                  "text-[14px] font-medium",
                  active ? "text-ink" : done ? "text-ink-soft" : "text-ink-faint",
                )}
              >
                {step.label}
              </div>
              {step.description ? (
                <p className="mt-0.5 max-w-prose text-[12.5px] leading-relaxed text-ink-faint">
                  {step.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
