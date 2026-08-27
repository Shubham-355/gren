"use client";

import { useState, type ReactNode } from "react";

import { cx } from "@/components/ui";
import { parseAmount } from "@/lib/format";

/**
 * One money control, used everywhere a rupee figure can be typed.
 *
 * The ₹ lives inside the field on the left and the figure is right-aligned
 * against it — the way every money input anyone has met behaves, rather than a
 * currency sign floating beside a box. The border stays quiet at rest so a card
 * of these reads as a set of amounts rather than a form, and only asserts
 * itself under the cursor.
 */
export function MoneyField({
  value,
  onValueChange,
  label,
  max,
  size = "md",
  className,
}: {
  value: number;
  onValueChange: (n: number) => void;
  /** for screen readers, where the visible label is the row beside it */
  label?: string;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  // Grouped even while being edited. Dropping to raw digits on focus made the
  // field being edited look unlike every other row on the card.
  const display = focused
    ? draft
    : value
      ? value.toLocaleString("en-IN")
      : "0";

  const box = {
    sm: "w-[8rem] py-1.5 text-[14px]",
    md: "w-[9.5rem] py-1.5 text-[15px]",
    lg: "w-[9.5rem] py-2 text-[17px]",
  }[size];

  return (
    <span
      className={cx(
        "flex shrink-0 items-center gap-1.5 rounded-[10px] border px-3 transition-colors",
        box,
        focused
          ? "border-[color:var(--plum)] bg-surface shadow-[0_0_0_3px_var(--plum-50)]"
          : "border-line-strong bg-surface hover:border-[color:var(--plum-line)]",
        className,
      )}
    >
      <span className="shrink-0 leading-none text-ink-faint">₹</span>
      <input
        inputMode="numeric"
        aria-label={label}
        value={display}
        onFocus={(e) => {
          setDraft(value ? value.toLocaleString("en-IN") : "");
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const n = parseAmount(e.target.value);
          const next = max !== undefined ? Math.min(n, max) : n;
          setDraft(
            e.target.value.trim() === "" ? "" : next.toLocaleString("en-IN"),
          );
          onValueChange(next);
        }}
        className={cx(
          "tnum w-full min-w-0 border-0 bg-transparent p-0 text-right font-medium text-ink focus:outline-none",
          size === "lg" && "font-semibold",
        )}
      />
    </span>
  );
}

/**
 * A row in a card that reads as a statement line and is editable in place. The
 * redesign's income screen is cards with editable lines, not a column of form
 * fields with labels stacked above them.
 */
export function InlineMoneyRow({
  label,
  note,
  value,
  onValueChange,
  readOnly,
  max,
  emphasis,
}: {
  label: ReactNode;
  note?: ReactNode;
  value: number;
  onValueChange?: (n: number) => void;
  readOnly?: boolean;
  max?: number;
  emphasis?: boolean;
}) {
  const editable = !readOnly && Boolean(onValueChange);

  return (
    <div
      className={cx(
        "flex items-center justify-between gap-4 px-4 py-3 sm:px-5",
        emphasis ? "bg-paper" : "border-b border-[color:var(--surface-sunk)]",
      )}
    >
      <div className="min-w-0">
        <div
          className={cx(
            "text-[14px] leading-snug",
            emphasis ? "font-semibold text-ink" : "text-ink-soft",
          )}
        >
          {label}
        </div>
        {note ? (
          <div className="mt-0.5 text-[12px] leading-snug text-ink-faint">
            {note}
          </div>
        ) : null}
      </div>

      {editable ? (
        <MoneyField
          value={value}
          onValueChange={onValueChange!}
          label={typeof label === "string" ? label : undefined}
          max={max}
          size={emphasis ? "lg" : "md"}
        />
      ) : (
        <span
          className={cx(
            // Same right edge as the fields above, so the column of amounts
            // stays one line rather than stepping in and out.
            "tnum w-[9.5rem] shrink-0 pr-3 text-right",
            emphasis ? "text-[17px] font-semibold" : "text-[15px] font-medium",
          )}
        >
          ₹{value.toLocaleString("en-IN")}
        </span>
      )}
    </div>
  );
}
