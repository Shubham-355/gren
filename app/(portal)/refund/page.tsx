"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Badge,
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
import { refundStageMeaning } from "@/lib/copilot/context";
import { filingHistory } from "@/lib/data/seed";
import { inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { refundStage, useAppStore, type RefundStage } from "@/lib/store/useAppStore";

const stages: { id: RefundStage; label: string; plain: string }[] = [
  {
    id: "filed",
    label: "Filed",
    plain: "Your return has been submitted. Nothing moves until it is verified.",
  },
  {
    id: "verified",
    label: "Verified",
    plain:
      "You confirmed the return is yours. It has joined the processing queue at the Centralised Processing Centre.",
  },
  {
    id: "processed",
    label: "Processed",
    plain:
      "The department has checked your arithmetic against its own records and agreed a refund figure. An intimation under section 143(1) is issued at this point.",
  },
  {
    id: "issued",
    label: "Refund issued",
    plain:
      "The money has been released to the refund banker and sent to your nominated bank account. It usually appears within a few working days.",
  },
];

export default function RefundPage() {
  const state = useAppStore();
  const { current } = useTax();
  const [, force] = useState(0);

  // The simulated CPC clock advances with real time, so a reviewer watching
  // this page sees it move rather than sitting on one stage.
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, []);

  const stage = refundStage(state);
  const currentIndex = stages.findIndex((s) => s.id === stage);
  const account = state.profile.bankAccounts.find((b) => b.nominatedForRefund);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="After filing"
        title="Where your refund is"
        intro="Four stages, and at every one of them the real portal tells you a status code. This tells you what it means and what, if anything, you should do about it."
        aside={
          <Badge tone={stage === "issued" ? "ok" : stage === "not-filed" ? "neutral" : "info"}>
            {stage === "not-filed" ? "Not filed" : stages[currentIndex]?.label}
          </Badge>
        }
      />

      {stage === "not-filed" ? (
        <>
          <Card tone="accent">
            <div className="px-4 py-4">
              <Stat
                label="Refund you would be owed"
                value={inr(current.refundDue)}
                tone="plum"
                tag={<ComputedTag />}
                hint="on the figures currently in your return"
              />
              <p className="mt-3 max-w-prose text-[13.5px] leading-relaxed text-ink-soft">
                Nothing is in the pipeline until the return is filed. The refund
                clock starts at verification, not submission.
              </p>
              <Link
                href="/filing"
                className="mt-3 inline-flex rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-4 py-2.5 text-[14px] font-medium text-white"
              >
                Go and file
              </Link>
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card tone={stage === "issued" ? "ok" : "plain"}>
            <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
              <Stat
                label="Refund amount"
                value={inr(current.refundDue)}
                tone="ok"
                tag={<ComputedTag />}
              />
              <Stat
                label="Acknowledgement"
                value={
                  <span className="mono text-[14px]">
                    {state.filing.acknowledgementNumber}
                  </span>
                }
              />
              <Stat
                label="Going to"
                value={account ? account.bank : "Not nominated"}
                hint={account?.accountNumberMasked}
              />
              <Stat
                label="Verified on"
                value={
                  state.filing.everifiedAt
                    ? shortDate(state.filing.everifiedAt)
                    : "Not yet"
                }
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Progress"
              eyebrow="Plain language at every stage"
            />
            <ol className="px-4 py-4">
              {stages.map((s, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                return (
                  <li key={s.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cx(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                          done &&
                            "border-[color:var(--ok)] bg-[color:var(--ok)] text-white",
                          active &&
                            "border-[color:var(--plum)] bg-plum-50 text-[color:var(--plum-ink)]",
                          !done &&
                            !active &&
                            "border-line-strong bg-surface text-ink-faint",
                        )}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      {i < stages.length - 1 ? (
                        <span
                          className={cx(
                            "my-1 w-px flex-1",
                            done ? "bg-[color:var(--ok)]" : "bg-line-strong",
                          )}
                        />
                      ) : null}
                    </div>
                    <div className={cx("pb-5", i === stages.length - 1 && "pb-0")}>
                      <div className="flex items-center gap-2">
                        <span
                          className={cx(
                            "text-[14.5px] font-medium",
                            active
                              ? "text-ink"
                              : done
                                ? "text-ink-soft"
                                : "text-ink-faint",
                          )}
                        >
                          {s.label}
                        </span>
                        {active ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-[color:var(--plum)]">
                            <span className="animate-pulse-dot">●</span> now
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={cx(
                          "mt-0.5 max-w-prose text-[13px] leading-relaxed",
                          active ? "text-ink-soft" : "text-ink-faint",
                        )}
                      >
                        {s.plain}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Callout tone="info" title="What this stage means for you" collapsible>
            {refundStageMeaning(stage)}{" "}
            {stage === "filed"
              ? "Verify it and the queue starts."
              : stage === "issued"
                ? "If it has not landed in a week, that is worth a grievance."
                : "There is nothing useful you can do to speed this up, and a grievance at this stage will not help."}
          </Callout>
        </>
      )}

      {/* ---------------- how it is computed ---------------- */}
      <Card tone="sunk">
        <CardHeader
          title="Why the amount is what it is"
          eyebrow={<ComputedTag />}
        />
        <div className="px-4 py-3">
          <Row label="Total tax liability" value={current.totalTaxLiability} />
          <Row
            label={<Term name="TDS">Tax deducted at source</Term>}
            value={current.tdsCredit}
            negative
            indent
          />
          {current.selfAssessmentTax > 0 ? (
            <Row
              label="Self-assessment tax paid"
              value={current.selfAssessmentTax}
              negative
              indent
            />
          ) : null}
          <Row
            label={current.refundDue > 0 ? "Refund due" : "Nothing to refund"}
            value={current.refundDue}
            strong
            tone={current.refundDue > 0 ? "ok" : "muted"}
          />
        </div>
      </Card>

      {/* ---------------- past refunds ---------------- */}
      <Card>
        <CardHeader
          title="Past refunds"
          eyebrow="For reference"
          action={
            <Link
              href="/history"
              className="text-[13px] font-medium text-[color:var(--plum)]"
            >
              Full history
            </Link>
          }
        />
        <ul className="divide-y divide-[color:var(--line)]">
          {filingHistory.map((f) => (
            <li
              key={f.assessmentYear}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <div className="text-[13.5px] font-medium">
                  AY {f.assessmentYear}
                </div>
                <div className="text-[12px] text-ink-faint">
                  {f.refundCreditedOn
                    ? `Credited ${shortDate(f.refundCreditedOn)} · ${daysBetween(f.verifiedOn, f.refundCreditedOn)} days after verification`
                    : "No refund was due"}
                </div>
              </div>
              <span
                className={cx(
                  "tnum text-[14px] font-medium",
                  f.refundAmount > 0 ? "text-[color:var(--ok)]" : "text-ink-faint",
                )}
              >
                {f.refundAmount > 0 ? inr(f.refundAmount) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Callout tone="warn" title="If it stops moving" collapsible>
        The usual causes are an unvalidated bank account, a name mismatch between
        your PAN and your bank record, or an outstanding demand from an earlier
        year being adjusted against this refund under section 245. All three are
        visible from this platform — check your{" "}
        <Link href="/profile" className="font-medium underline underline-offset-2">
          bank account status
        </Link>{" "}
        first, then{" "}
        <Link href="/grievance" className="font-medium underline underline-offset-2">
          raise it
        </Link>
        .
      </Callout>
    </div>
  );
}

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000,
  );
}
