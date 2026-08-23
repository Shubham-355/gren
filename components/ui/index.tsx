"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useId,
  useState,
  type ButtonHTMLAttributes,
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
  tone = "plain",
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  tone?: "plain" | "sunk" | "accent" | "alert" | "ok";
  as?: "section" | "div" | "article" | "li";
}) {
  const tones = {
    plain: "bg-surface border-line",
    sunk: "bg-sunk border-line",
    accent: "bg-pine-50 border-pine-100",
    alert: "bg-alert-50 border-[color:var(--alert)]/25",
    ok: "bg-ok-50 border-[color:var(--ok)]/25",
  } as const;
  return (
    <As
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
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
        <h2 className="text-[17px] leading-snug">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] text-ink-soft">{description}</p>
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
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";

const buttonVariants = {
  primary:
    "bg-[color:var(--pine)] text-white hover:bg-[color:var(--pine-ink)] shadow-[var(--shadow-sm)]",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-sunk",
  ghost: "text-[color:var(--pine)] hover:bg-pine-50",
  danger: "bg-[color:var(--alert)] text-white hover:brightness-90",
  clay: "bg-[color:var(--clay)] text-white hover:bg-[color:var(--clay-ink)]",
} as const;

const buttonSizes = {
  sm: "text-[13px] px-3 py-1.5",
  md: "text-[14px] px-4 py-2.5",
  lg: "text-[15px] px-5 py-3",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        block && "w-full",
        className,
      )}
    />
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
  tone?: "neutral" | "ok" | "warn" | "alert" | "info" | "pine" | "clay";
  className?: string;
}) {
  const tones = {
    neutral: "bg-sunk text-ink-soft border-line-strong",
    ok: "bg-ok-50 text-[color:var(--ok)] border-[color:var(--ok)]/25",
    warn: "bg-warn-50 text-[color:var(--warn)] border-[color:var(--warn)]/25",
    alert: "bg-alert-50 text-[color:var(--alert)] border-[color:var(--alert)]/25",
    info: "bg-info-50 text-[color:var(--info)] border-[color:var(--info)]/25",
    pine: "bg-pine-50 text-[color:var(--pine-ink)] border-pine-100",
    clay: "bg-clay-50 text-[color:var(--clay-ink)] border-[color:var(--clay)]/25",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11px] font-medium leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The honesty marker required on every seeded or simulated figure. */
export function DemoTag({ label = "demo data" }: { label?: string }) {
  return (
    <span
      className="ml-1.5 inline-flex select-none items-center rounded-[var(--radius-pill)] border border-dashed border-[color:var(--clay)]/40 bg-clay-50 px-1.5 py-px align-middle text-[10px] font-medium uppercase tracking-wide text-[color:var(--clay-ink)]"
      title="This figure is synthetic seed data, not a real record."
    >
      {label}
    </span>
  );
}

/** For numbers this app computed itself, as opposed to numbers it was handed. */
export function ComputedTag() {
  return (
    <span
      className="ml-1.5 inline-flex select-none items-center rounded-[var(--radius-pill)] border border-pine-100 bg-pine-50 px-1.5 py-px align-middle text-[10px] font-medium uppercase tracking-wide text-[color:var(--pine-ink)]"
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
  tone?: "plain" | "ok" | "alert" | "pine";
  tag?: ReactNode;
}) {
  const valueTone = {
    plain: "text-ink",
    ok: "text-[color:var(--ok)]",
    alert: "text-[color:var(--alert)]",
    pine: "text-[color:var(--pine)]",
  } as const;
  return (
    <div className="min-w-0">
      <div className="eyebrow flex items-center">
        <span className="truncate">{label}</span>
        {tag}
      </div>
      <div
        className={cx(
          "tnum mt-1 font-display text-[22px] font-semibold leading-tight",
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
  "w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-[color:var(--pine-400)]";

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
          checked ? "bg-[color:var(--pine)]" : "bg-line-strong",
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
            size === "sm" ? "px-3 py-1 text-[12.5px]" : "px-4 py-1.5 text-[13.5px]",
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
        className="cursor-help border-b border-dotted border-[color:var(--pine-400)] text-inherit decoration-dotted underline-offset-2 hover:border-solid"
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
              className="text-[12px] font-medium text-[color:var(--pine)] underline underline-offset-2"
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
    <header className="mb-5">
      {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-[26px] leading-tight sm:text-[30px]">
          {title}
        </h1>
        {aside}
      </div>
      {intro ? (
        <p className="mt-2 max-w-prose text-[14.5px] leading-relaxed text-ink-soft">
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
  tone?: "info" | "warn" | "alert" | "ok" | "pine";
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    info: "bg-info-50 border-[color:var(--info)]/20 text-[color:var(--info)]",
    warn: "bg-warn-50 border-[color:var(--warn)]/25 text-[color:var(--warn)]",
    alert: "bg-alert-50 border-[color:var(--alert)]/25 text-[color:var(--alert)]",
    ok: "bg-ok-50 border-[color:var(--ok)]/25 text-[color:var(--ok)]",
    pine: "bg-pine-50 border-pine-100 text-[color:var(--pine-ink)]",
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
                    "border-[color:var(--pine)] bg-pine-50 text-[color:var(--pine-ink)]",
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
