"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DemoTag,
  EmptyState,
  PageHeader,
  Row,
  Stat,
} from "@/components/ui";
import { inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";
import { ASSESSMENT_YEAR, FINANCIAL_YEAR } from "@/lib/tax/constants";

export default function ConfirmationPage() {
  const state = useAppStore();
  const { current } = useTax();
  const [downloaded, setDownloaded] = useState(false);

  if (!state.filing.submitted) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Filing · Confirmation"
          title="No acknowledgement yet"
          intro="This page holds your ITR-V and the summary of what was filed. It fills in the moment you submit."
        />
        <EmptyState
          title="Nothing submitted"
          body="Complete the review and submit your return, and the acknowledgement will appear here."
          action={
            <Link
              href="/filing"
              className="rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-5 py-2.5 text-[14px] font-medium text-white"
            >
              Go to filing
            </Link>
          }
        />
      </div>
    );
  }

  function downloadAcknowledgement() {
    const text = buildItrV({
      name: state.profile.name,
      pan: state.profile.pan,
      ack: state.filing.acknowledgementNumber ?? "",
      form: state.filing.formSelected ?? "ITR-1",
      submittedAt: state.filing.submittedAt ?? new Date().toISOString(),
      everified: state.filing.everified,
      regime: state.regime,
      grossTotalIncome: current.grossTotalIncome,
      totalIncome: current.totalIncome,
      totalTax: current.totalTaxLiability,
      tds: current.tdsCredit,
      refund: current.refundDue,
      payable: current.taxPayable,
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ITR-V-${state.filing.acknowledgementNumber}-SYNTHETIC.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    state.pushToast({
      tone: "success",
      title: "Acknowledgement downloaded",
      body: "A plain-text ITR-V, clearly marked synthetic.",
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius)] border border-[color:var(--ok)]/25 bg-ok-50 px-5 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--ok)] text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5 10 17l9-10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="mt-3 font-display text-[24px] leading-tight sm:text-[28px]">
          {state.filing.formSelected ?? "ITR-1"} submitted for AY{" "}
          {ASSESSMENT_YEAR}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-soft">
          {state.filing.everified
            ? "Submitted and verified. From here it is the department's move."
            : "Submitted — but not verified yet. It does not legally count as filed until you verify, and you have 30 days."}
        </p>
        <div className="mono mt-3 inline-block rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-1.5 text-[14px]">
          {state.filing.acknowledgementNumber}
        </div>
        <div className="mt-1">
          <DemoTag label="synthetic acknowledgement" />
        </div>
      </div>

      {!state.filing.everified ? (
        <Callout tone="alert" title="One step left">
          Verify within 30 days or the return lapses entirely.{" "}
          <Link
            href="/filing/everify"
            className="font-medium underline underline-offset-2"
          >
            e-Verify now
          </Link>
          .
        </Callout>
      ) : null}

      <PageHeader eyebrow="Summary" title="What was filed" />

      <Card>
        <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
          <Stat
            label="Filed on"
            value={
              state.filing.submittedAt
                ? shortDate(state.filing.submittedAt)
                : "—"
            }
          />
          <Stat label="Regime" value={state.regime} />
          <Stat label="Financial year" value={FINANCIAL_YEAR} />
          <Stat
            label={current.refundDue > 0 ? "Refund claimed" : "Tax paid"}
            value={inr(current.refundDue || current.totalTaxLiability)}
            tone={current.refundDue > 0 ? "ok" : "plain"}
          />
        </div>
        <div className="border-t border-line px-4 py-4">
          <Row label="Gross total income" value={current.grossTotalIncome} />
          <Row label="Deductions under Chapter VI-A" value={current.chapterVIA} negative indent />
          <Row label="Total income" value={current.totalIncome} />
          <Row label="Total tax liability" value={current.totalTaxLiability} />
          <Row label="Tax deducted at source" value={current.tdsCredit} negative indent />
          {current.selfAssessmentTax > 0 ? (
            <Row
              label="Self-assessment tax paid"
              value={current.selfAssessmentTax}
              negative
              indent
            />
          ) : null}
          <Row
            label={current.refundDue > 0 ? "Refund due" : "Balance"}
            value={current.refundDue || current.taxPayable}
            strong
            tone={current.refundDue > 0 ? "ok" : undefined}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Your acknowledgement"
          eyebrow="ITR-V"
          description="Keep a copy. It is what you produce if anything about this year is ever questioned."
        />
        <div className="space-y-3 px-4 py-4">
          <Button onClick={downloadAcknowledgement} variant="secondary">
            {downloaded ? "Download again" : "Download ITR-V (text)"}
          </Button>
          <p className="text-[12px] leading-relaxed text-ink-faint">
            The real portal issues a password-protected PDF. This prototype
            generates a plain-text file instead — it carries the same information,
            is marked synthetic on every line, and does not pretend to be a
            government document.
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {!state.filing.everified ? (
          <Link
            href="/filing/everify"
            className="rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-5 py-3 text-[14px] font-medium text-white"
          >
            e-Verify
          </Link>
        ) : (
          <Link
            href="/refund"
            className="rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-5 py-3 text-[14px] font-medium text-white"
          >
            Track the refund
          </Link>
        )}
        <Link
          href="/history"
          className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-5 py-3 text-[14px] font-medium"
        >
          Filing history
        </Link>
        <Link
          href="/dashboard"
          className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-5 py-3 text-[14px] font-medium"
        >
          Back to home
        </Link>
      </div>

      <Badge tone="clay">
        Nothing was transmitted to any tax authority. This is a prototype.
      </Badge>
    </div>
  );
}

function buildItrV(d: {
  name: string;
  pan: string;
  ack: string;
  form: string;
  submittedAt: string;
  everified: boolean;
  regime: string;
  grossTotalIncome: number;
  totalIncome: number;
  totalTax: number;
  tds: number;
  refund: number;
  payable: number;
}): string {
  const line = "=".repeat(64);
  const money = (n: number) => n.toLocaleString("en-IN").padStart(16);
  return [
    line,
    "  SYNTHETIC ITR-V / ACKNOWLEDGEMENT — NOT A GOVERNMENT DOCUMENT",
    "  Generated by Sarathi, an independent hackathon prototype.",
    "  Not affiliated with the Income Tax Department of India.",
    "  Every figure and identifier below is invented test data.",
    line,
    "",
    `  Assessment Year          ${ASSESSMENT_YEAR}`,
    `  Financial Year           ${FINANCIAL_YEAR}`,
    `  Form                     ${d.form}`,
    `  Name                     ${d.name}`,
    `  PAN                      ${d.pan}  (SYNTHETIC)`,
    `  Acknowledgement number   ${d.ack}  (SYNTHETIC)`,
    `  Submitted on             ${new Date(d.submittedAt).toLocaleString("en-IN")}`,
    `  Verification status      ${d.everified ? "e-Verified" : "NOT VERIFIED — lapses 30 days after submission"}`,
    `  Regime                   ${d.regime}`,
    "",
    line,
    "  COMPUTATION OF TOTAL INCOME AND TAX",
    line,
    `  Gross total income                  ${money(d.grossTotalIncome)}`,
    `  Total income                        ${money(d.totalIncome)}`,
    `  Total tax liability                 ${money(d.totalTax)}`,
    `  Tax deducted at source              ${money(d.tds)}`,
    d.refund > 0
      ? `  REFUND DUE                          ${money(d.refund)}`
      : `  BALANCE PAYABLE                     ${money(d.payable)}`,
    "",
    line,
    "  This file was produced by a demonstration application for a",
    "  hackathon. It has no legal standing, was never filed with any",
    "  authority, and must not be presented as a tax record.",
    line,
    "",
  ].join("\n");
}
