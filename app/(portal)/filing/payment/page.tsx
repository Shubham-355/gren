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
  PageHeader,
  Row,
  Stat,
  Term,
} from "@/components/ui";
import { inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { buildPaymentConfirmation } from "@/lib/confirmations";
import { useAppStore } from "@/lib/store/useAppStore";
import { ASSESSMENT_YEAR } from "@/lib/tax/constants";

type Method = "netbanking" | "upi" | "card";

export default function PaymentPage() {
  const state = useAppStore();
  const { current } = useTax();
  const [method, setMethod] = useState<Method>("upi");

  const due = current.taxPayable;

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
        <Callout tone="info" title="When would this screen have something on it?">
          Self-assessment tax under section 140A appears when the tax on your total
          income exceeds everything already deducted — usually because of interest
          or dividend income that nobody withheld enough on. Accepting a large AIS
          entry on the reconciliation screen is the fastest way to see this page
          come alive.
        </Callout>
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

      <Callout tone="info" title="Interest on top, if it applies">
        Where a large shortfall should have been paid as advance tax during the
        year, sections 234B and 234C add interest at 1% a month. On{" "}
        {inr(due)} that would be modest, but on a bigger gap it stops being modest
        quickly. Paying before {shortDate("2026-03-15")} in the year itself is the
        way to avoid it.
      </Callout>
    </div>
  );
}
