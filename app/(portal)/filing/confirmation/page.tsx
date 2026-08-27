"use client";

import Link from "next/link";
import { useState } from "react";

import { CopilotStar } from "@/components/shell/AppShell";
import {
  Button,
  Callout,
  Card,
  DemoTag,
  EmptyState,
  LinkButton,
  Term,
  cx,
} from "@/components/ui";
import { inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";
import { ASSESSMENT_YEAR, FINANCIAL_YEAR } from "@/lib/tax/constants";

/**
 * Step 9 — Confirmation.
 *
 * The finish line, not another form. Refund figure, acknowledgement, and a
 * dated timeline that runs straight into the refund tracker.
 */
export default function ConfirmationPage() {
  const state = useAppStore();
  const { current } = useTax();
  const [downloaded, setDownloaded] = useState(false);

  if (!state.filing.submitted) {
    return (
      <EmptyState
        title="No acknowledgement yet"
        body="This page holds your ITR-V and the summary of what was filed. It fills in the moment you submit."
        action={<LinkButton href="/filing">Go to review and submit</LinkButton>}
      />
    );
  }

  const refundAccount = state.profile.bankAccounts.find(
    (b) => b.nominatedForRefund,
  );
  const accountLabel = refundAccount
    ? `${refundAccount.bank} ···· ${refundAccount.accountNumberMasked.slice(-4)}`
    : "no account nominated";
  const verified = state.filing.everified;
  const inRefund = current.refundDue > 0;

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
    <div className="-mx-4 -mt-7 lg:-mx-6">
      {/* ------------------------------- hero ------------------------------- */}
      <div className="bg-[color:var(--plum)] px-5 pb-14 pt-8 text-white lg:px-10 lg:pb-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end lg:gap-12">
            <div className="min-w-0">
              <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white/[0.16]">
                <svg
                  width="25"
                  height="25"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5 10 17l9-10" />
                </svg>
              </span>
              <h1 className="mt-5 max-w-[26rem] font-display text-[38px] leading-[1.04] tracking-[-0.015em] text-white sm:text-[48px] lg:text-[56px] lg:leading-[1.02]">
                {verified
                  ? "Filed and verified. You are done for the year."
                  : "Filed. One step left before it counts."}
              </h1>
              <p className="mt-4 max-w-[30rem] text-[15px] leading-relaxed text-white/[0.72] sm:text-[16px]">
                {verified
                  ? "Nothing else is needed from you unless the department asks. We will tell you the moment anything moves."
                  : "An unverified return is treated in law as never filed. You have 30 days, and verifying takes about ten seconds."}
              </p>
            </div>

            <div className="shrink-0 lg:text-right">
              <div className="text-[13.5px] text-white/[0.68]">
                {inRefund
                  ? verified
                    ? "Refund on its way to you"
                    : "Refund you have claimed"
                  : "Tax paid on this return"}
              </div>
              <div className="tnum mt-1 font-display text-[56px] leading-[0.95] text-white lg:text-[88px]">
                {inr(inRefund ? current.refundDue : current.totalTaxLiability)}
              </div>
              {inRefund ? (
                <div className="mt-2.5 text-[14px] text-white/[0.72]">
                  To {accountLabel} · nominated for refund
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------ the rest ----------------------------- */}
      <div className="px-5 py-8 lg:px-10">
        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[1fr_1fr_320px] [&>*]:min-w-0">
          {/* ------------------------ what happens next ------------------- */}
          <Card className="p-5 sm:p-[22px]">
            <div className="eyebrow">What happens next</div>
            <ol className="mt-[18px]">
              <TimelineStep
                state="done"
                title={verified ? "Submitted and verified" : "Submitted"}
                body={
                  state.filing.submittedAt
                    ? `${shortDate(state.filing.submittedAt)}${
                        verified && state.filing.everifiedAt
                          ? `, verified ${shortDate(state.filing.everifiedAt)}`
                          : ""
                      }`
                    : "Today"
                }
              />
              <TimelineStep
                state={verified ? "current" : "blocked"}
                title={verified ? "Processing at the CPC" : "e-Verification"}
                body={
                  verified ? (
                    <>
                      Usually 15 to 25 days. An{" "}
                      <Term name="Intimation u/s 143(1)">
                        intimation under 143(1)
                      </Term>{" "}
                      arrives when it finishes.
                    </>
                  ) : (
                    "Nothing moves until you verify. This is the one thing still waiting on you."
                  )
                }
              />
              <TimelineStep
                state="future"
                last
                title={inRefund ? "Refund credited" : "Assessment closed"}
                body={
                  inRefund
                    ? `Typically 20 to 45 days after verification, direct to ${accountLabel}`
                    : "Once processed, the year is closed unless the department raises a query."
                }
              />
            </ol>
          </Card>

          {/* --------------------------- what was filed -------------------- */}
          <Card className="p-5 sm:p-[22px]">
            <div className="eyebrow">What was filed</div>
            <div className="mt-4 space-y-1">
              <FiledLine
                label="Gross total income"
                value={inr(current.grossTotalIncome)}
              />
              <FiledLine
                label="Deductions claimed"
                value={`− ${inr(current.chapterVIA)}`}
              />
              <FiledLine label="Taxable income" value={inr(current.totalIncome)} />
              <FiledLine
                label="Total tax"
                value={inr(current.totalTaxLiability)}
              />
              <FiledLine
                label="Already paid"
                value={`− ${inr(current.tdsCredit + current.selfAssessmentTax)}`}
              />
              <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2.5 text-[15px] font-semibold">
                <span>{inRefund ? "Refund due" : "Balance"}</span>
                <span
                  className={cx(
                    "tnum",
                    inRefund && "text-[color:var(--ok)]",
                  )}
                >
                  {inr(inRefund ? current.refundDue : current.taxPayable)}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="text-ink-soft">Acknowledgement</span>
                <span className="mono">
                  {state.filing.acknowledgementNumber}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="text-ink-soft">
                  {state.filing.formSelected ?? "ITR-1"} · {state.regime} regime ·
                  AY {ASSESSMENT_YEAR}
                </span>
                <DemoTag label="synthetic" />
              </div>
            </div>
          </Card>

          {/* ------------------------------ actions ------------------------ */}
          <div className="space-y-3">
            {verified ? (
              <LinkButton href="/refund" block size="lg">
                Track my refund
              </LinkButton>
            ) : (
              <LinkButton href="/filing/everify" block size="lg">
                e-Verify now
              </LinkButton>
            )}
            <Button
              variant="secondary"
              size="lg"
              block
              onClick={downloadAcknowledgement}
            >
              {downloaded ? "Download ITR-V again" : "Download ITR-V"}
            </Button>

            {!verified ? (
              <Callout tone="alert" title="It lapses in 30 days">
                An unverified return has to be filed all over again — as a
                belated return, locked to the new regime, with a fee under
                section 234F.
              </Callout>
            ) : null}

            <Card tone="copilot" className="p-4 sm:px-[18px] sm:py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-[color:var(--petrol)] text-white">
                  <CopilotStar size={14} />
                </span>
                <span className="text-[14px] font-semibold text-[color:var(--petrol)]">
                  Ask me anything later
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                &ldquo;Where is my refund?&rdquo; and &ldquo;what does this notice
                mean?&rdquo; both work all year, not just at filing time.
              </p>
            </Card>

            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              Nothing was transmitted to any tax authority. The acknowledgement is
              generated locally by a prototype, and the ITR-V is a plain-text file
              marked synthetic on every line — it deliberately does not imitate a
              government PDF.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/history"
                className="text-[13.5px] font-medium text-[color:var(--plum)] underline underline-offset-2"
              >
                Filing history
              </Link>
              <Link
                href="/dashboard"
                className="text-[13.5px] font-medium text-[color:var(--plum)] underline underline-offset-2"
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function TimelineStep({
  state,
  title,
  body,
  last,
}: {
  state: "done" | "current" | "blocked" | "future";
  title: string;
  body: React.ReactNode;
  last?: boolean;
}) {
  const dot =
    state === "done"
      ? "bg-[color:var(--ok)] text-white"
      : state === "blocked"
        ? "border-2 border-[color:var(--alert)] bg-surface"
        : state === "current"
          ? "border-2 border-[color:var(--plum)] bg-surface"
          : "border-2 border-line-strong bg-surface";

  return (
    <li className="flex gap-3.5">
      <div className="flex flex-col items-center">
        <span
          className={cx(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]",
            dot,
          )}
        >
          {state === "done" ? "✓" : null}
        </span>
        {!last ? (
          <span
            className={cx(
              "w-0.5 flex-1",
              state === "done"
                ? "bg-[color:var(--ok)]"
                : "bg-[color:var(--line)]",
            )}
          />
        ) : null}
      </div>
      <div className={last ? "" : "pb-5"}>
        <div className="text-[14.5px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[13px] leading-relaxed text-ink-faint">
          {body}
        </div>
      </div>
    </li>
  );
}

function FiledLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px] text-[14px] text-ink-soft">
      <span>{label}</span>
      <span className="tnum">{value}</span>
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
    "  Generated by TaxSaathi, an independent hackathon prototype.",
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
