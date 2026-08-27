"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FlowActionBar, PhoneStepHeader } from "@/components/shell/StepRail";
import {
  Button,
  Card,
  LinkButton,
  Row,
  Term,
  cx,
} from "@/components/ui";
import { daysUntil, inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";
import type { Regime, TaxComputation } from "@/lib/tax/compute";
import { BELATED_DEADLINE, FILING_DEADLINE } from "@/lib/tax/constants";

/**
 * Step 6 — Regime comparison.
 *
 * Two columns, aligned rows, one visually winning column. Not two cards the
 * user has to mentally diff, and not a recommendation without its arithmetic.
 */
export default function RegimePage() {
  const router = useRouter();
  const state = useAppStore();
  const { comparison, current, breakEven } = useTax();
  const [showWorking, setShowWorking] = useState<Regime | null>(null);

  const recommended = comparison.recommended;
  const onRecommended = state.regime === recommended;
  const other: Regime = state.regime === "old" ? "new" : "old";
  const daysLeft = daysUntil(FILING_DEADLINE);

  // Keeping a regime is a real decision, so it is recorded as one — even
  // though nothing about the numbers changes.
  function keepCurrent() {
    state.confirmRegime();
    router.push("/filing");
  }

  const shelter =
    comparison.old.exemptAllowances +
    comparison.old.chapterVIA +
    comparison.old.professionalTax;

  return (
    <div>
      <PhoneStepHeader back={{ href: "/deductions" }} />

      <h1 className="max-w-[26rem] font-display text-[32px] leading-[1.08] tracking-[-0.01em] sm:text-[44px] sm:leading-[1.05]">
        {comparison.saving === 0
          ? "Both regimes cost you the same"
          : `The ${recommended} regime costs you ${inr(comparison.saving)} less`}
      </h1>
      <p className="mt-3 max-w-[32rem] text-[15px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[15.5px]">
        {explainRecommendation(recommended, shelter, breakEven, comparison.saving)}{" "}
        Both columns are computed on the same return.
      </p>

      {/* --------------------------- the comparison --------------------------- */}
      <Card className="mt-6 overflow-hidden">
        <div className="grid grid-cols-[1.35fr_1fr_1fr] sm:grid-cols-[1.5fr_1fr_1fr]">
          <HeadCell />
          <HeadCell
            title="New regime"
            sub="Wider slabs, ₹75,000 standard deduction"
            winner={recommended === "new"}
            chosen={state.regime === "new"}
          />
          <HeadCell
            title="Old regime"
            sub="Narrower slabs, the full deduction menu"
            winner={recommended === "old"}
            chosen={state.regime === "old"}
          />

          <CompareRow
            label="Gross salary"
            newValue={inr(comparison.new.grossSalary)}
            oldValue={inr(comparison.old.grossSalary)}
            winner={recommended}
          />
          <CompareRow
            label="HRA exemption"
            newValue={
              comparison.new.hraExemption > 0
                ? `− ${inr(comparison.new.hraExemption)}`
                : "not allowed"
            }
            oldValue={
              comparison.old.hraExemption > 0
                ? `− ${inr(comparison.old.hraExemption)}`
                : "nothing claimed"
            }
            winner={recommended}
            mutedNew={comparison.new.hraExemption === 0}
          />
          <CompareRow
            label="Standard deduction"
            newValue={`− ${inr(comparison.new.standardDeduction)}`}
            oldValue={`− ${inr(comparison.old.standardDeduction)}`}
            winner={recommended}
          />
          {state.houseProperty.enabled ? (
            <CompareRow
              label="House property"
              sub="let-out flat, loan interest"
              newValue={
                comparison.new.incomeFromHouseProperty === 0 &&
                comparison.old.incomeFromHouseProperty < 0
                  ? "loss disallowed"
                  : inr(comparison.new.incomeFromHouseProperty)
              }
              oldValue={
                comparison.old.incomeFromHouseProperty < 0
                  ? `− ${inr(-comparison.old.incomeFromHouseProperty)}`
                  : inr(comparison.old.incomeFromHouseProperty)
              }
              winner={recommended}
              mutedNew={
                comparison.new.incomeFromHouseProperty === 0 &&
                comparison.old.incomeFromHouseProperty < 0
              }
            />
          ) : null}
          <CompareRow
            label="Interest and dividend"
            newValue={inr(comparison.new.incomeFromOtherSources)}
            oldValue={inr(comparison.old.incomeFromOtherSources)}
            winner={recommended}
          />
          <CompareRow
            label="Deductions claimed"
            sub="Chapter VI-A"
            newValue={`− ${inr(comparison.new.chapterVIA)}`}
            oldValue={`− ${inr(comparison.old.chapterVIA)}`}
            winner={recommended}
          />

          <CompareRow
            label="Taxable income"
            newValue={inr(comparison.new.totalIncome)}
            oldValue={inr(comparison.old.totalIncome)}
            winner={recommended}
            strong
          />

          <CompareRow
            label="Tax on the slabs"
            newValue={inr(Math.round(comparison.new.taxAfterRebate))}
            oldValue={inr(Math.round(comparison.old.taxAfterRebate))}
            winner={recommended}
          />
          {comparison.new.surcharge > 0 || comparison.old.surcharge > 0 ? (
            <CompareRow
              label="Surcharge"
              newValue={inr(Math.round(comparison.new.surcharge))}
              oldValue={inr(Math.round(comparison.old.surcharge))}
              winner={recommended}
            />
          ) : null}
          <CompareRow
            label="Health and education cess, 4%"
            newValue={inr(Math.round(comparison.new.cess))}
            oldValue={inr(Math.round(comparison.old.cess))}
            winner={recommended}
          />

          <TotalRow
            newValue={comparison.new.totalTaxLiability}
            oldValue={comparison.old.totalTaxLiability}
            winner={recommended}
          />

          <CompareRow
            label={
              comparison.new.refundDue > 0 || comparison.old.refundDue > 0
                ? "Refund"
                : "Balance payable"
            }
            sub={`after the ${inr(current.tdsCredit)} already paid`}
            newValue={inr(
              comparison.new.refundDue > 0
                ? comparison.new.refundDue
                : comparison.new.taxPayable,
            )}
            oldValue={inr(
              comparison.old.refundDue > 0
                ? comparison.old.refundDue
                : comparison.old.taxPayable,
            )}
            winner={recommended}
            last
            emphasiseWinner
          />
        </div>
      </Card>

      {/* --------------------------- the decision --------------------------- */}
      <div className="mt-5 hidden flex-wrap items-center gap-4 lg:flex">
        {onRecommended ? (
          <Button size="lg" onClick={keepCurrent}>
            Keep the {state.regime} regime and continue
          </Button>
        ) : (
          <Button size="lg" onClick={() => state.setRegime(recommended)}>
            Switch to the {recommended} regime
          </Button>
        )}
        <span className="text-[14px] text-ink-soft">
          or{" "}
          {onRecommended ? (
            <button
              onClick={() => state.setRegime(other)}
              className="border-b border-[color:var(--plum)] text-[color:var(--plum)]"
            >
              use the {other} regime instead
            </button>
          ) : (
            <button
              onClick={keepCurrent}
              className="border-b border-[color:var(--plum)] text-[color:var(--plum)]"
            >
              stay on the {state.regime} regime and pay the extra{" "}
              {inr(comparison.saving)}
            </button>
          )}
        </span>
      </div>

      {/* ------------------------ deadline consequence ---------------------- */}
      <Card tone="warn" className="mt-5 px-5 py-4">
        <div className="text-[14px] font-semibold text-[color:var(--warn)]">
          This choice has a deadline attached
        </div>
        <p className="mt-1.5 max-w-[52rem] text-[13.5px] leading-relaxed text-ink-soft">
          File by {shortDate(FILING_DEADLINE)}
          {daysLeft > 0 ? ` — ${daysLeft} days away — ` : " "}
          and the regime is yours to pick. A belated return, allowed until{" "}
          {shortDate(BELATED_DEADLINE)}, is locked to the new regime, which for
          you would cost {inr(comparison.saving)} on top of the late fee under{" "}
          <Term name="Section 234F">section 234F</Term>.
        </p>
      </Card>

      {/* --------------------------- the working ---------------------------- */}
      <div className="mt-5">
        <button
          onClick={() =>
            setShowWorking(showWorking ? null : (state.regime as Regime))
          }
          aria-expanded={Boolean(showWorking)}
          className="tap border-b border-[color:var(--plum)] text-[13.5px] font-medium text-[color:var(--plum)]"
        >
          {showWorking
            ? "Hide the slab-by-slab working"
            : "See the slab-by-slab working"}
        </button>

        {showWorking ? (
          <div className="animate-rise mt-4">
            <div className="mb-3 flex gap-1.5">
              {(["new", "old"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setShowWorking(r)}
                  className={cx(
                    "rounded-[var(--radius-pill)] border px-4 py-1.5 text-[13px] font-medium capitalize",
                    showWorking === r
                      ? "border-[color:var(--plum)] bg-[color:var(--plum)] text-white"
                      : "border-line-strong bg-surface text-ink-soft",
                  )}
                >
                  {r} regime
                </button>
              ))}
            </div>
            <Card>
              <Working computation={comparison[showWorking]} />
            </Card>
          </div>
        ) : null}
      </div>

      <div className="lg:hidden">
        <FlowActionBar
          note={
            onRecommended
              ? undefined
              : `Staying on the ${state.regime} regime costs ${inr(comparison.saving)} more.`
          }
        >
          {onRecommended ? (
            <Button block size="lg" onClick={keepCurrent}>
              Keep the {state.regime} regime
            </Button>
          ) : (
            <Button
              block
              size="lg"
              onClick={() => state.setRegime(recommended)}
            >
              Use the {recommended} regime
            </Button>
          )}
          <LinkButton href="/filing" variant="secondary" size="lg" block>
            Continue to review
          </LinkButton>
        </FlowActionBar>
      </div>
    </div>
  );
}

/* ================================================================
   The aligned table
   ================================================================ */

function HeadCell({
  title,
  sub,
  winner,
  chosen,
}: {
  title?: string;
  sub?: string;
  winner?: boolean;
  chosen?: boolean;
}) {
  if (!title) {
    return <div className="border-b border-line px-3 py-3.5 sm:px-5 sm:py-4" />;
  }
  return (
    <div
      className={cx(
        "border-b px-3 py-3.5 sm:px-5 sm:py-4",
        winner
          ? "border-ok-100 bg-ok-50"
          : "border-line border-l border-l-[color:var(--surface-sunk)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13.5px] font-semibold sm:text-[15px]">{title}</span>
        {winner ? (
          <span className="rounded-full bg-[color:var(--ok)] px-2 py-[2px] text-[10.5px] font-semibold text-white sm:px-2.5 sm:py-[3px] sm:text-[11px]">
            cheaper{chosen ? " · chosen" : ""}
          </span>
        ) : chosen ? (
          <span className="rounded-full bg-plum-50 px-2 py-[2px] text-[10.5px] font-semibold text-[color:var(--plum)] sm:px-2.5 sm:py-[3px] sm:text-[11px]">
            chosen
          </span>
        ) : null}
      </div>
      {sub ? (
        <div className="mt-0.5 hidden text-[12.5px] text-ink-faint sm:block">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function CompareRow({
  label,
  sub,
  newValue,
  oldValue,
  winner,
  strong,
  last,
  mutedNew,
  emphasiseWinner,
}: {
  label: string;
  sub?: string;
  newValue: string;
  oldValue: string;
  winner: Regime;
  strong?: boolean;
  last?: boolean;
  mutedNew?: boolean;
  emphasiseWinner?: boolean;
}) {
  const cell =
    "tnum px-2.5 text-right text-[12.5px] sm:px-5 sm:text-[14px] " +
    (last ? "pb-[18px] pt-3" : "py-3");
  const labelCell =
    "px-3 text-[12.5px] sm:px-5 sm:text-[14px] " +
    (last ? "pb-[18px] pt-3" : "py-3");

  return (
    <>
      <div
        className={cx(
          labelCell,
          strong
            ? "border-y border-line font-semibold text-ink"
            : "text-ink-soft",
        )}
      >
        {label}
        {sub ? (
          <span className="ml-1.5 hidden text-[12.5px] text-ink-faint sm:inline">
            {sub}
          </span>
        ) : null}
      </div>
      <div
        className={cx(
          cell,
          "border-l border-[color:var(--surface-sunk)]",
          strong && "border-y border-y-line font-semibold",
          mutedNew && "text-ink-faint",
          winner === "new" && "bg-ok-tint",
        )}
      >
        {newValue}
      </div>
      <div
        className={cx(
          cell,
          "border-l border-ok-100",
          strong && "border-y border-y-ok-100 font-semibold",
          winner === "old" ? "bg-ok-tint" : "bg-transparent",
          emphasiseWinner && winner === "old" && "font-semibold text-[color:var(--ok)]",
        )}
      >
        {oldValue}
      </div>
    </>
  );
}

function TotalRow({
  newValue,
  oldValue,
  winner,
}: {
  newValue: number;
  oldValue: number;
  winner: Regime;
}) {
  return (
    <>
      <div className="border-t border-line px-3 py-4 text-[13.5px] font-semibold sm:px-5 sm:text-[15px]">
        Total tax
      </div>
      <div
        className={cx(
          "border-l border-t border-line px-2.5 py-4 text-right sm:px-5",
          winner === "new" && "bg-ok-50",
        )}
      >
        <span
          className={cx(
            "tnum font-display text-[19px] sm:text-[30px]",
            winner === "new" && "text-[color:var(--ok)]",
          )}
        >
          {inr(newValue)}
        </span>
      </div>
      <div
        className={cx(
          "border-l border-t px-2.5 py-4 text-right sm:px-5",
          winner === "old" ? "border-ok-100 bg-ok-50" : "border-line",
        )}
      >
        <span
          className={cx(
            "tnum font-display text-[19px] sm:text-[30px]",
            winner === "old" && "text-[color:var(--ok)]",
          )}
        >
          {inr(oldValue)}
        </span>
      </div>
    </>
  );
}

/* ================================================================
   The arithmetic, in the order the Act applies it
   ================================================================ */

function Working({ computation: c }: { computation: TaxComputation }) {
  return (
    <div className="space-y-4 px-4 py-4">
      <section>
        <div className="eyebrow mb-1">1 · Income from salary</div>
        <Row label="Gross salary" value={c.grossSalary} />
        <Row label="HRA exempt u/s 10(13A)" value={c.exemptAllowances} negative indent />
        <Row label="Standard deduction" value={c.standardDeduction} negative indent />
        <Row label="Professional tax" value={c.professionalTax} negative indent />
        <Row label="Income from salary" value={c.incomeFromSalary} strong />
      </section>

      <section>
        <div className="eyebrow mb-1">2 · Other heads</div>
        <Row
          label="Income from house property"
          value={c.incomeFromHouseProperty}
          tone={c.incomeFromHouseProperty < 0 ? "alert" : undefined}
          note={
            c.incomeFromHouseProperty < 0
              ? "a loss, set off against salary"
              : undefined
          }
        />
        <Row label="Income from other sources" value={c.incomeFromOtherSources} />
        <Row label="Gross total income" value={c.grossTotalIncome} strong />
      </section>

      <section>
        <div className="eyebrow mb-1">3 · Chapter VI-A deductions</div>
        {c.chapterVIABreakdown.length === 0 ? (
          <p className="py-1.5 text-[13px] text-ink-faint">
            Nothing claimable in this regime.
          </p>
        ) : (
          c.chapterVIABreakdown.map((b) => (
            <Row
              key={b.label}
              label={b.label}
              value={b.amount}
              note={b.note}
              negative
              indent
            />
          ))
        )}
        <Row
          label="Total income (rounded to the nearest ₹10)"
          value={c.totalIncome}
          strong
        />
      </section>

      <section>
        <div className="eyebrow mb-1">4 · Tax on total income</div>
        {c.slabBreakdown.map((s) => (
          <Row
            key={`${s.from}-${s.rate}`}
            label={`${inr(s.from)} to ${s.to === null ? "above" : inr(s.to)} at ${Math.round(s.rate * 100)}%`}
            value={Math.round(s.tax)}
            indent
          />
        ))}
        <Row label="Tax before rebate" value={Math.round(c.taxBeforeRebate)} strong />
        {c.rebate87A > 0 ? (
          <Row
            label={<Term name="Section 87A">Rebate u/s 87A</Term>}
            value={Math.round(c.rebate87A)}
            negative
            indent
            tone="ok"
            note="income is within the rebate threshold"
          />
        ) : null}
        {c.marginalRelief > 0 ? (
          <Row
            label={<Term name="Marginal relief">Marginal relief</Term>}
            value={Math.round(c.marginalRelief)}
            negative
            indent
            tone="ok"
            note="caps the tax at the income earned above the rebate threshold"
          />
        ) : null}
        {c.surcharge > 0 ? (
          <Row label="Surcharge" value={Math.round(c.surcharge)} indent />
        ) : null}
        <Row
          label="Health and education cess at 4%"
          value={Math.round(c.cess)}
          indent
        />
        <Row label="Total tax liability" value={c.totalTaxLiability} strong />
      </section>

      <section>
        <div className="eyebrow mb-1">5 · Tax already paid</div>
        <Row label="Tax deducted at source" value={c.tdsCredit} negative />
        {c.advanceTax > 0 ? (
          <Row label="Advance tax" value={c.advanceTax} negative />
        ) : null}
        {c.selfAssessmentTax > 0 ? (
          <Row label="Self-assessment tax" value={c.selfAssessmentTax} negative />
        ) : null}
        <Row
          label={c.refundDue > 0 ? "Refund due to you" : "Balance payable"}
          value={c.refundDue || c.taxPayable}
          strong
          tone={c.refundDue > 0 ? "ok" : "alert"}
        />
      </section>
    </div>
  );
}

function explainRecommendation(
  recommended: Regime,
  sheltered: number,
  breakEven: number,
  saving: number,
): string {
  if (saving === 0) {
    return "On the figures you have entered, the two regimes land on the same number.";
  }
  if (recommended === "old") {
    return `You are sheltering ${inr(sheltered)} of HRA and deductions that only exist under the old regime — past the ${Number.isFinite(breakEven) ? inr(breakEven) : "break-even"} crossover for your income.`;
  }
  if (!Number.isFinite(breakEven)) {
    return `The new regime wins here whatever you claim — at your income there is no amount of old-regime shelter that would close the gap.`;
  }
  return `You would need around ${inr(breakEven)} of old-regime shelter before the two crossed over, and you are at ${inr(sheltered)}.`;
}
