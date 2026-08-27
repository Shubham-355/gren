"use client";

import Link from "next/link";

import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ComputedTag,
  PageHeader,
  Row,
  Stat,
  cx,
} from "@/components/ui";
import { filingHistory, type FilingRecord } from "@/lib/data/seed";
import { inr, pct, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";
import { ASSESSMENT_YEAR } from "@/lib/tax/constants";

export default function HistoryPage() {
  const state = useAppStore();
  const { current } = useTax();

  const thisYear: FilingRecord | null = state.filing.submitted
    ? {
        assessmentYear: ASSESSMENT_YEAR,
        form: state.filing.formSelected ?? "ITR-1",
        regime: state.regime,
        filedOn: state.filing.submittedAt ?? new Date().toISOString(),
        verifiedOn: state.filing.everifiedAt,
        acknowledgementNumber: state.filing.acknowledgementNumber ?? "",
        grossTotalIncome: current.grossTotalIncome,
        totalTax: current.totalTaxLiability,
        status: state.filing.everified ? "Verified" : "Filed",
        refundAmount: current.refundDue,
        refundCreditedOn: null,
      }
    : null;

  const all = thisYear ? [thisYear, ...filingHistory] : filingHistory;
  const previous = filingHistory[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="After filing"
        title="Everything you have filed"
        intro="Three years side by side, so a change in your tax is something you can see rather than something you have to remember."
      />

      {/* --------- year on year --------- */}
      <Card tone="accent">
        <CardHeader
          title="This year against last"
          eyebrow={<ComputedTag />}
        />
        <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
          <Stat
            label={`Income, AY ${ASSESSMENT_YEAR}`}
            value={inr(current.grossTotalIncome)}
            hint={changeLabel(current.grossTotalIncome, previous.grossTotalIncome)}
          />
          <Stat
            label={`Income, AY ${previous.assessmentYear}`}
            value={inr(previous.grossTotalIncome)}
          />
          <Stat
            label="Tax this year"
            value={inr(current.totalTaxLiability)}
            hint={changeLabel(current.totalTaxLiability, previous.totalTax)}
          />
          <Stat
            label="Effective rate"
            value={pct(current.effectiveRate)}
            hint={`was ${pct(previous.totalTax / previous.grossTotalIncome)}`}
          />
        </div>
        <div className="border-t border-line px-4 py-3">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            {narrate(
              current.grossTotalIncome,
              previous.grossTotalIncome,
              current.totalTaxLiability,
              previous.totalTax,
              state.regime,
              previous.regime,
            )}
          </p>
        </div>
      </Card>

      {/* --------- the list --------- */}
      <div className="space-y-3">
        {all.map((record) => (
          <Card key={record.assessmentYear}>
            <div className="px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-[18px]">
                      AY {record.assessmentYear}
                    </h2>
                    <Badge tone={statusTone(record.status)}>{record.status}</Badge>
                    <Badge tone="neutral">{record.form}</Badge>
                    <Badge tone="neutral">{record.regime} regime</Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-faint">
                    Filed {shortDate(record.filedOn)}
                    {record.verifiedOn
                      ? ` · verified ${shortDate(record.verifiedOn)}`
                      : " · not verified"}
                  </p>
                  <p className="mono mt-0.5 text-[11.5px] text-ink-faint">
                    {record.acknowledgementNumber}
                  </p>
                </div>
                <div className="text-right">
                  <div className="eyebrow">
                    {record.refundAmount > 0 ? "Refund" : "Tax paid"}
                  </div>
                  <div
                    className={cx(
                      "tnum font-display text-[20px] font-semibold",
                      record.refundAmount > 0
                        ? "text-[color:var(--ok)]"
                        : "text-ink",
                    )}
                  >
                    {inr(record.refundAmount || record.totalTax)}
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t border-line pt-2">
                <Row
                  label="Gross total income"
                  value={record.grossTotalIncome}
                />
                <Row label="Total tax" value={record.totalTax} />
                {record.refundCreditedOn ? (
                  <Row
                    label="Refund credited"
                    value={record.refundAmount}
                    tone="ok"
                    note={shortDate(record.refundCreditedOn)}
                  />
                ) : null}
              </div>

              {record.assessmentYear === ASSESSMENT_YEAR ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/filing/confirmation"
                    className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[12.5px] font-medium lg:py-1.5"
                  >
                    Acknowledgement
                  </Link>
                  {!state.filing.everified ? (
                    <Link
                      href="/filing/everify"
                      className="rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-3 py-1.5 text-[12.5px] font-medium text-white"
                    >
                      e-Verify
                    </Link>
                  ) : (
                    <Link
                      href="/refund"
                      className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[12.5px] font-medium lg:py-1.5"
                    >
                      Refund status
                    </Link>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/notices"
                    className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[12.5px] font-medium lg:py-1.5"
                  >
                    Notices for this year
                  </Link>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {!state.filing.submitted ? (
        <Callout tone="info" title={`AY ${ASSESSMENT_YEAR} is not here yet`}>
          Your current return will appear at the top of this list the moment you
          submit it.{" "}
          <Link href="/filing" className="font-medium underline underline-offset-2">
            Go and file
          </Link>
          .
        </Callout>
      ) : null}

      <Callout tone="warn" title="How long to keep all this">
        The department can reopen an assessment up to three years after the end of
        the assessment year, and up to ten where the escaped income is above ₹50
        lakh. Keep your Form 16, your investment proofs and your rent receipts for
        at least six years — not because it is likely, but because reconstructing
        them later is miserable.
      </Callout>
    </div>
  );
}

function statusTone(
  status: FilingRecord["status"],
): "ok" | "info" | "warn" | "alert" | "neutral" {
  switch (status) {
    case "Refund issued":
      return "ok";
    case "Processed":
    case "Verified":
      return "info";
    case "Filed":
      return "warn";
    case "Demand raised":
      return "alert";
    default:
      return "neutral";
  }
}

function changeLabel(now: number, before: number): string {
  const diff = now - before;
  if (before === 0) return "";
  const percentage = (diff / before) * 100;
  if (Math.abs(percentage) < 0.5) return "about the same";
  return `${diff > 0 ? "up" : "down"} ${Math.abs(percentage).toFixed(0)}%`;
}

function narrate(
  incomeNow: number,
  incomeBefore: number,
  taxNow: number,
  taxBefore: number,
  regimeNow: string,
  regimeBefore: string,
): string {
  const incomeUp = incomeNow - incomeBefore;
  const taxUp = taxNow - taxBefore;
  const parts: string[] = [];

  parts.push(
    incomeUp >= 0
      ? `Your income is ${inr(Math.abs(incomeUp))} higher than last year.`
      : `Your income is ${inr(Math.abs(incomeUp))} lower than last year.`,
  );

  if (taxUp > 0 && incomeUp > 0) {
    parts.push(
      `Tax is up ${inr(taxUp)}, which is ${((taxUp / incomeUp) * 100).toFixed(0)}% of the extra income — that figure is your real marginal rate, and it is the number worth watching.`,
    );
  } else if (taxUp < 0) {
    parts.push(
      `Tax is down ${inr(Math.abs(taxUp))} despite that, which usually means deductions or a regime change did the work.`,
    );
  }

  if (regimeNow !== regimeBefore) {
    parts.push(
      `You were on the ${regimeBefore} regime last year and are on the ${regimeNow} regime now. Salaried taxpayers can switch every year, so this is allowed and worth re-checking annually.`,
    );
  }

  return parts.join(" ");
}
