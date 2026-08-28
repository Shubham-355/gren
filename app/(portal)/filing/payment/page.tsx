"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ChoiceGroup,
  ComputedTag,
  MoneyInput,
  PageHeader,
  Row,
  Stat,
  Term,
} from "@/components/ui";
import { InterestBreakdown } from "@/components/ui/InterestBreakdown";
import { inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { buildPaymentConfirmation } from "@/lib/confirmations";
import { advanceTaxInstalments, useAppStore } from "@/lib/store/useAppStore";
import { ADVANCE_TAX_INSTALMENTS, ASSESSMENT_YEAR } from "@/lib/tax/constants";

type Method = "netbanking" | "upi" | "card";

export default function PaymentPage() {
  const state = useAppStore();
  const { current } = useTax();
  const [method, setMethod] = useState<Method>("upi");

  const due = current.taxPayable;
  // Naming the sections keeps the line honest: this part of the bill is not tax.
  const interestSections = current.interest.charges
    .filter((charge) => charge.amount > 0)
    .map((charge) => charge.section)
    .join(", ");

  if (state.filing.paymentDone) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Filing · Payment"
          title="Payment recorded"
          intro="In a real payment this challan would appear in Part C of your Form 26AS within three to four working days, and the credit would attach to your PAN automatically."
          aside={<Badge tone="ok">Paid</Badge>}
        />
        <Card tone="ok">
          <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-3">
            <Stat
              label="Challan number"
              value={
                <span className="mono text-[15px]">
                  {state.filing.paymentChallan}
                </span>
              }
            />
            <Stat
              label="Amount"
              value={inr(state.selfAssessmentTaxPaid)}
              tone="ok"
            />
            <Stat label="Assessment year" value={ASSESSMENT_YEAR} />
          </div>
        </Card>
        <Callout tone="warn" title="Nothing actually moved">
          No payment gateway was contacted, no card or UPI detail was collected,
          and no money left any account. This is a simulated challan so the rest of
          the filing flow can proceed.
        </Callout>
        <Link
          href="/filing"
          className="inline-flex rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-5 py-3 text-[14px] font-medium text-white"
        >
          Back to filing
        </Link>
      </div>
    );
  }

  if (due <= 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Filing · Payment"
          title="Nothing to pay"
          intro="Your employer and your bank between them have already deducted more than your total bill, so there is no self-assessment tax due."
          aside={<Badge tone="ok">Nil</Badge>}
        />
        <Card tone="ok">
          <div className="px-4 py-4">
            <Row label="Total tax liability" value={current.totalTaxLiability} />
            <Row label="Tax already deducted" value={current.tdsCredit} negative />
            {current.selfAssessmentTax > 0 ? (
              <Row
                label="Self-assessment tax already paid"
                value={current.selfAssessmentTax}
                negative
              />
            ) : null}
            <Row
              label={current.refundDue > 0 ? "Refund due to you" : "Balance"}
              value={current.refundDue}
              strong
              tone="ok"
            />
          </div>
        </Card>
        <Callout tone="info" title="When would this screen have something on it?" collapsible>
          Self-assessment tax under section 140A appears when the tax on your total
          income exceeds everything already deducted — usually because of interest
          or dividend income that nobody withheld enough on. With a shortfall come
          sections 234B and 234C, which charge 1% a month for not having paid it
          as advance tax during the year.
        </Callout>
        <AdvanceTaxCard />
        <div className="flex gap-2">
          <Link
            href="/filing"
            className="rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-5 py-3 text-[14px] font-medium text-white"
          >
            Continue to filing
          </Link>
          <Link
            href="/reconciliation"
            className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-5 py-3 text-[14px] font-medium"
          >
            Reconciliation
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Filing · Payment"
        title={<>Pay {inr(due)} of self-assessment tax</>}
        intro="This is the gap between what you owe and what has already been deducted on your behalf. It has to be cleared before the return can be submitted."
        aside={<Badge tone="alert">Due</Badge>}
      />

      <Card tone="alert">
        <div className="px-4 py-4">
          <div className="eyebrow">
            How the amount was arrived at <ComputedTag />
          </div>
          <div className="mt-1">
            <Row label="Total tax liability" value={current.totalTaxLiability} />
            <Row
              label="Tax deducted at source"
              value={current.tdsCredit}
              negative
              indent
            />
            {current.advanceTax > 0 ? (
              <Row label="Advance tax paid" value={current.advanceTax} negative indent />
            ) : null}
            {current.interest.total > 0 ? (
              <Row
                label="Interest and fee for paying late"
                value={current.interest.total}
                note={interestSections}
                indent
              />
            ) : null}
            <Row
              label={<Term name="Self-assessment tax">Self-assessment tax payable</Term>}
              value={due}
              strong
              tone="alert"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="How would you like to pay?"
          eyebrow="Simulated · no gateway is contacted"
        />
        <div className="space-y-4 px-4 py-4">
          <ChoiceGroup
            value={method}
            onChange={setMethod}
            options={[
              { value: "upi", label: "UPI" },
              { value: "netbanking", label: "Net banking" },
              { value: "card", label: "Debit card" },
            ]}
          />

          <div className="rounded-[var(--radius-sm)] border border-dashed border-line-strong bg-sunk px-4 py-5 text-center">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              {method === "upi"
                ? "A real flow would show a QR code and a collect request here."
                : method === "netbanking"
                  ? "A real flow would hand you off to your bank's payment page here."
                  : "A real flow would open a card entry form here."}
            </p>
            <p className="mt-1.5 text-[12px] text-ink-faint">
              This prototype collects no payment detail of any kind, by design.
            </p>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-3">
            <div className="eyebrow mb-1">Challan 280 details</div>
            <Row label="Assessment year" value={ASSESSMENT_YEAR} />
            <Row label="Type of payment" value="(300) Self-assessment tax" />
            <Row label="PAN" value={`${state.profile.pan} (synthetic)`} />
            <Row label="Amount" value={due} strong />
          </div>

          {/* Paying is Tier 3 (§5.2): the button raises the confirmation card
              rather than moving money on its own. */}
          <Button
            block
            size="lg"
            onClick={() =>
              state.requestConfirmation(
                buildPaymentConfirmation(useAppStore.getState(), "you"),
              )
            }
          >
            Pay {inr(due)} (simulated)
          </Button>
        </div>
      </Card>

      <AdvanceTaxCard />

      <Card>
        <CardHeader
          title="Interest and fee, worked out"
          eyebrow={
            current.interest.total > 0
              ? `${inr(current.interest.total)} of the amount above is not tax`
              : "None of the amount above is interest"
          }
        />
        <div className="px-4 py-4">
          <InterestBreakdown interest={current.interest} />
          <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
            Nobody withholds these for you and no Form 16 mentions them, which is
            why a shortfall found in September costs more than the shortfall
            itself. Paying by {shortDate("2026-03-15")} inside the year is what
            stops 234B and 234C running at all.
          </p>
        </div>
      </Card>
    </div>
  );
}

/**
 * Advance tax, as four dated instalments rather than one number.
 *
 * Section 234C does not ask how much you paid, it asks when — 15% by 15 June,
 * 45% by 15 September, and so on, with its own three months of interest at
 * each date that came up short. With only a total to go on the app has to
 * assume the worst and charge for all four. This is where that assumption
 * gets replaced by what actually happened.
 */
function AdvanceTaxCard() {
  const state = useAppStore();
  const { current } = useTax();
  const paid = advanceTaxInstalments(state);
  const base = current.interest.assessedTax;
  const total = paid.reduce((sum, n) => sum + n, 0);

  const rows = ADVANCE_TAX_INSTALMENTS.map((instalment, i) => {
    const cumulativePaid = paid
      .slice(0, i + 1)
      .reduce((sum, n) => sum + n, 0);
    return {
      instalment,
      index: i,
      required: Math.round(base * instalment.cumulative),
      cumulativePaid,
      met: base <= 0 || cumulativePaid >= Math.round(base * instalment.relaxed),
    };
  });

  return (
    <Card>
      <CardHeader
        title="Did you pay advance tax during the year?"
        eyebrow="Optional · changes the 234C figure"
        description="Leave these at zero if you did not. Recording the dates is what lets the interest be worked out from what you did rather than from the worst case."
      />
      <div className="space-y-3 px-4 py-4">
        {rows.map((row) => (
          <div
            key={row.instalment.due}
            className="grid gap-2.5 sm:grid-cols-[1fr_10rem] sm:items-center"
          >
            <div className="min-w-0">
              <div className="text-[14px] font-medium">
                By {row.instalment.label}
                <span className="ml-1.5 text-[11.5px] font-normal text-ink-faint">
                  {Math.round(row.instalment.cumulative * 100)}% cumulative
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
                {base <= 0
                  ? "Nothing was due at this date — TDS covered the bill."
                  : row.met
                    ? `Met — ${inr(row.cumulativePaid)} against ${inr(row.required)} due by then.`
                    : `Short by ${inr(Math.max(0, row.required - row.cumulativePaid))} of the ${inr(row.required)} due by then.`}
              </p>
            </div>
            <MoneyInput
              value={paid[row.index]}
              onValueChange={(v) => state.setAdvanceTaxInstalment(row.index, v)}
            />
          </div>
        ))}
        <div className="border-t border-line pt-1">
          <Row label="Advance tax recorded" value={total} strong />
        </div>
      </div>
    </Card>
  );
}
