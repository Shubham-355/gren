"use client";

import { Callout, Row, Term, cx } from "@/components/ui";
import { inr, shortDate } from "@/lib/format";
import { FILING_DEADLINE } from "@/lib/tax/constants";
import type { InterestResult } from "@/lib/tax/interest";

/**
 * Sections 234A, 234B, 234C and 234F, shown the way the arithmetic actually
 * runs: what each charge is on, for how many months, and why the nil ones are
 * nil.
 *
 * The nil charges earn their place. "Interest for filing late: nil, because
 * you are filing on time" is the sentence that tells someone the deadline is
 * not decorative — and it is the same line that will carry a number if they
 * come back in December.
 */
export function InterestBreakdown({
  interest,
  showNil = true,
}: {
  interest: InterestResult;
  /** false on screens where only the charges that bite are worth the room */
  showNil?: boolean;
}) {
  const charges = showNil
    ? interest.charges
    : interest.charges.filter((c) => c.amount > 0);

  if (charges.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {charges.map((charge) => (
        <div
          key={charge.section}
          className={cx(
            "rounded-[var(--radius-sm)] border px-3.5 py-3",
            charge.amount > 0
              ? "border-alert-100 bg-alert-50"
              : "border-line bg-sunk",
          )}
        >
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[13.5px] font-medium text-ink">
                {charge.title}
              </span>{" "}
              <span className="mono text-[11.5px]">
                <Term name={`Section ${charge.section}`}>{charge.section}</Term>
              </span>
            </div>
            <div
              className={cx(
                "tnum shrink-0 text-[14px] font-semibold",
                charge.amount > 0
                  ? "text-[color:var(--alert)]"
                  : "text-ink-faint",
              )}
            >
              {charge.amount > 0 ? inr(charge.amount) : "Nil"}
            </div>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
            {charge.reason}
          </p>
          {charge.legs.length > 0 ? (
            <div className="mt-2 border-t border-line pt-1">
              {charge.legs.map((leg) => (
                <Row
                  key={leg.label}
                  label={leg.label}
                  value={leg.amount}
                  note={
                    <>
                      1% a month on {inr(leg.on)} for {leg.months} month
                      {leg.months === 1 ? "" : "s"}
                      {leg.note ? ` · ${leg.note}` : ""}
                    </>
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ))}

      {interest.scheduleAssumed ? (
        <Callout tone="warn" title="One assumption in the 234C figure" collapsible>
          You have told the platform how much advance tax you paid, but not when.
          Interest under section 234C depends on the dates, so the figure above
          assumes the whole amount arrived at the last instalment — the worst
          case. Record the instalments on the payment screen and it recomputes
          against what you actually did.
        </Callout>
      ) : null}

      {!interest.late ? (
        <p className="text-[12px] leading-relaxed text-ink-faint">
          Filing by {shortDate(FILING_DEADLINE)} keeps sections 234A and 234F at
          nil. They start the day after.
        </p>
      ) : null}
    </div>
  );
}
