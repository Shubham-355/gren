"use client";

import { useState, type ReactNode } from "react";

import { cx } from "@/components/ui";
import { parseAmount } from "@/lib/format";

/**
 * A row in a card that reads as a statement line until you touch it, and is an
 * input the moment you do. The redesign's income screen is cards with editable
 * lines, not a column of form fields with labels above them.
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
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  const display = focused ? draft : value ? value.toLocaleString("en-IN") : "0";
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
        <span className="flex shrink-0 items-center">
          <span className="text-[15px] text-ink-faint">₹</span>
          <input
            inputMode="numeric"
            aria-label={typeof label === "string" ? label : undefined}
            value={display}
            onFocus={() => {
              setDraft(value ? String(value) : "");
              setFocused(true);
            }}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = parseAmount(e.target.value);
              onValueChange?.(max !== undefined ? Math.min(n, max) : n);
            }}
            size={Math.max(display.length, 4)}
            className={cx(
              "tnum rounded-[8px] border border-transparent bg-transparent px-1.5 py-1 text-right text-[15px] font-medium text-ink",
              "hover:border-line-strong focus:border-[color:var(--plum)] focus:bg-surface focus:outline-none",
              emphasis && "text-[17px] font-semibold",
            )}
          />
        </span>
      ) : (
        <span
          className={cx(
            "tnum shrink-0 px-1.5 text-[15px] font-medium",
            emphasis && "text-[17px] font-semibold",
          )}
        >
          ₹{value.toLocaleString("en-IN")}
        </span>
      )}
    </div>
  );
}
