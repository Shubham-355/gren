"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ComputedTag,
  PageHeader,
  Row,
  Stat,
  Term,
  cx,
} from "@/components/ui";
import { daysUntil, inr, pct, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";
import type { Regime, TaxComputation } from "@/lib/tax/compute";
import {
  BELATED_DEADLINE,
  FILING_DEADLINE,
  STANDARD_DEDUCTION,
} from "@/lib/tax/constants";

export default function RegimePage() {
  const state = useAppStore();
  const { comparison, current, breakEven } = useTax();
  const [showWorking, setShowWorking] = useState(false);

  const recommended = comparison.recommended;
  const onRecommended = state.regime === recommended;
  const daysLeft = daysUntil(FILING_DEADLINE);

  const claimedOldRegimeShelter =
    comparison.old.exemptAllowances +
    comparison.old.chapterVIA +
    comparison.old.professionalTax;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Step 3 of preparing your return"
        title="Old regime or new"
        intro="Both are computed on the numbers you have actually entered — not on an average, not on an assumption. Change anything anywhere on the platform and these two figures move."
        aside={<Badge tone="pine">{state.regime} selected</Badge>}
      />

      {/* ---------------- the recommendation ---------------- */}
      <Card tone={onRecommended ? "ok" : "accent"}>
        <div className="px-4 py-4">
          <div className="eyebrow">The recommendation</div>
          <h2 className="mt-1 font-display text-[22px] leading-snug sm:text-[26px]">
            {onRecommended ? (
              <>
                Stay on the {recommended} regime — it saves you{" "}
                <span className="text-[color:var(--ok)]">
                  {inr(comparison.saving)}
                </span>
                .
              </>
            ) : (
              <>
                Switch to the {recommended} regime and pay{" "}
                <span className="text-[color:var(--pine)]">
                  {inr(comparison.saving)}
                </span>{" "}
                less.
              </>
            )}
          </h2>
          <p className="mt-2 max-w-prose text-[13.5px] leading-relaxed text-ink-soft">
            {explainRecommendation(
              recommended,
              claimedOldRegimeShelter,
              breakEven,
              comparison.saving,
            )}
          </p>

          {!onRecommended ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => state.setRegime(recommended)}>
                Switch to the {recommended} regime
              </Button>
              <Button
                variant="secondary"
                onClick={() => state.setRegime(state.regime)}
              >
                Keep the {state.regime} regime
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      {/* ---------------- side by side ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <RegimeCard
          regime="new"
          computation={comparison.new}
          selected={state.regime === "new"}
          recommended={recommended === "new"}
          onSelect={() => state.setRegime("new")}
        />
        <RegimeCard
          regime="old"
          computation={comparison.old}
          selected={state.regime === "old"}
          recommended={recommended === "old"}
          onSelect={() => state.setRegime("old")}
        />
      </div>

      {/* ---------------- deadline consequence ---------------- */}
      <Callout
        tone={daysLeft <= 30 ? "alert" : "warn"}
        title="The regime choice has a deadline attached to it"
      >
        You can pick either regime freely — but only while you are filing on time.
        File by {shortDate(FILING_DEADLINE)}
        {daysLeft > 0 ? ` (${daysLeft} days away)` : " (already passed)"} and the
        choice is yours. Miss it and a belated return, allowed until{" "}
        {shortDate(BELATED_DEADLINE)}, is locked to the new regime — you lose the
        option entirely, along with a late fee under section 234F, interest under
        234A on anything unpaid, and the right to carry losses forward.
        {recommended === "old" && comparison.saving > 0 ? (
          <>
            {" "}
            For you specifically that would cost{" "}
            <strong className="tnum">{inr(comparison.saving)}</strong> on top of
            the fee, because the old regime is currently the cheaper one.
          </>
        ) : null}
      </Callout>

      {/* ---------------- working ---------------- */}
      <Card>
        <CardHeader
          title="The arithmetic, line by line"
          eyebrow={
            <>
              {state.regime} regime <ComputedTag />
            </>
          }
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowWorking(!showWorking)}
            >
              {showWorking ? "Hide" : "Show"}
            </Button>
          }
        />
        {showWorking ? <Working computation={current} /> : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card tone="sunk">
          <CardHeader title="What the old regime is sheltering" eyebrow="For you" />
          <div className="px-4 py-3">
            <Row
              label="HRA exemption"
              value={comparison.old.exemptAllowances}
              note="section 10(13A)"
            />
            <Row label="Chapter VI-A deductions" value={comparison.old.chapterVIA} />
            <Row
              label="Professional tax"
              value={comparison.old.professionalTax}
            />
            <Row
              label="Standard deduction"
              value={STANDARD_DEDUCTION.old}
              note={`versus ${inr(STANDARD_DEDUCTION.new)} in the new regime`}
            />
            <Row
              label="Total sheltered"
              value={claimedOldRegimeShelter + STANDARD_DEDUCTION.old}
              strong
            />
          </div>
        </Card>

        <Card tone="sunk">
          <CardHeader title="The break-even" eyebrow="How much you would need" />
          <div className="px-4 py-4">
            <Stat
              label="Old-regime shelter needed for it to win"
              value={
                Number.isFinite(breakEven) ? inr(breakEven) : "Not reachable"
              }
              tag={<ComputedTag />}
              hint={
                Number.isFinite(breakEven)
                  ? "HRA exemption plus Chapter VI-A, at your income"
                  : "no amount of deductions would flip it at this income"
              }
            />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              This is solved numerically against your actual income, not looked
              up from a table: the same income is run through both regimes while a
              single uncapped deduction is searched for the crossover. Below that
              figure the new regime&rsquo;s wider slabs and larger standard
              deduction win; above it, the old regime does. Your employer&rsquo;s
              NPS contribution is left out of it, because 80CCD(2) applies either
              way and so is not part of the trade-off.
            </p>
            <Link
              href="/deductions"
              className="mt-3 inline-block text-[13px] font-medium text-[color:var(--pine)] underline underline-offset-2"
            >
              Go and see what else you could claim
            </Link>
          </div>
        </Card>
      </div>

      <Callout tone="info" title="One thing this prototype assumes">
        Slabs, the standard deduction, the section 87A rebate and every ceiling
        here are the Finance Act 2025 position for FY 2025-26, assessed in AY
        2026-27. A salaried person with no business income can switch regimes every
        single year; anyone with business income needs{" "}
        <Term name="Form 10-IEA">Form 10-IEA</Term> and gets one switch back in
        their lifetime.
      </Callout>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function RegimeCard({
  regime,
  computation,
  selected,
  recommended,
  onSelect,
}: {
  regime: Regime;
  computation: TaxComputation;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={cx(
        "transition-shadow",
        selected && "ring-2 ring-[color:var(--pine)] ring-offset-2 ring-offset-[color:var(--paper)]",
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="font-display text-[17px] capitalize">{regime} regime</h3>
            {recommended ? <Badge tone="ok">cheaper</Badge> : null}
          </div>
          <p className="text-[11.5px] text-ink-faint">
            {regime === "new"
              ? "Wider slabs, ₹75,000 standard deduction, almost no other deductions"
              : "Narrower slabs, ₹50,000 standard deduction, the full deduction menu"}
          </p>
        </div>
        {selected ? <Badge tone="pine">selected</Badge> : null}
      </div>

      <div className="px-4 py-3.5">
        <div className="eyebrow">Total tax</div>
        <div
          className={cx(
            "tnum mt-0.5 font-display text-[30px] font-semibold leading-none",
            recommended ? "text-[color:var(--ok)]" : "text-ink",
          )}
        >
          {inr(computation.totalTaxLiability)}
        </div>
        <div className="mt-1 text-[12px] text-ink-faint">
          {pct(computation.effectiveRate)} of your gross total income
        </div>

        <div className="mt-3 space-y-0">
          <Row label="Taxable income" value={computation.totalIncome} />
          <Row label="Tax on slabs" value={Math.round(computation.taxBeforeRebate)} />
          {computation.rebate87A > 0 ? (
            <Row
              label="Rebate u/s 87A"
              value={Math.round(computation.rebate87A)}
              negative
              tone="ok"
            />
          ) : null}
          {computation.marginalRelief > 0 ? (
            <Row
              label="Marginal relief"
              value={Math.round(computation.marginalRelief)}
              negative
              tone="ok"
            />
          ) : null}
          {computation.surcharge > 0 ? (
            <Row label="Surcharge" value={Math.round(computation.surcharge)} />
          ) : null}
          <Row label="Cess at 4%" value={Math.round(computation.cess)} />
          <Row
            label={computation.refundDue > 0 ? "Refund due" : "Still to pay"}
            value={computation.refundDue || computation.taxPayable}
            strong
            tone={computation.refundDue > 0 ? "ok" : "alert"}
          />
        </div>
      </div>

      {!selected ? (
        <div className="border-t border-line px-4 py-3">
          <Button block variant="secondary" size="sm" onClick={onSelect}>
            Use the {regime} regime
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

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
            <Row key={b.label} label={b.label} value={b.amount} note={b.note} negative indent />
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
            label="Rebate u/s 87A"
            value={Math.round(c.rebate87A)}
            negative
            indent
            tone="ok"
            note="income is within the rebate threshold"
          />
        ) : null}
        {c.marginalRelief > 0 ? (
          <Row
            label="Marginal relief"
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
  if (recommended === "old") {
    return `You are claiming ${inr(sheltered)} of exemptions and deductions that only exist under the old regime. That is past the ${Number.isFinite(breakEven) ? inr(breakEven) : "break-even"} crossover for your income, so the old regime's narrower slabs still work out cheaper — by ${inr(saving)}.`;
  }
  if (!Number.isFinite(breakEven)) {
    return `The new regime wins here whatever you claim — at your income there is no amount of old-regime deduction that would close the gap of ${inr(saving)}.`;
  }
  return `The new regime's wider slabs and larger standard deduction beat what you are currently claiming. You would need around ${inr(breakEven)} of old-regime shelter before the two crossed over, and you are at ${inr(sheltered)}. The gap is ${inr(saving)}.`;
}
