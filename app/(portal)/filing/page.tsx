"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ComputedTag,
  DemoTag,
  PageHeader,
  ProgressTrack,
  Row,
  Stat,
  Term,
  Toggle,
  cx,
} from "@/components/ui";
import { form16 } from "@/lib/data/seed";
import { inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { pendingMismatches, useAppStore } from "@/lib/store/useAppStore";
import { recommendForm } from "@/lib/tax/formSelection";
import { ASSESSMENT_YEAR, FINANCIAL_YEAR } from "@/lib/tax/constants";

export default function FilingPage() {
  const router = useRouter();
  const state = useAppStore();
  const { current, comparison } = useTax();
  const recommendation = recommendForm(state, current);
  const pending = pendingMismatches(state);

  const [declaration, setDeclaration] = useState(false);
  const [showDisqualifiers, setShowDisqualifiers] = useState(false);

  const blockers = [
    pending.length > 0
      ? {
          id: "mismatch",
          text: `${pending.length} AIS difference${pending.length === 1 ? "" : "s"} still unresolved`,
          detail:
            "Filing with these open is the single most reliable way to get an intimation three months from now.",
          href: "/reconciliation",
          hard: false,
        }
      : null,
    current.taxPayable > 0
      ? {
          id: "payment",
          text: `${inr(current.taxPayable)} of self-assessment tax is unpaid`,
          detail:
            "The return cannot be submitted while tax is outstanding. It takes one step.",
          href: "/filing/payment",
          hard: true,
        }
      : null,
    state.regime !== comparison.recommended
      ? {
          id: "regime",
          text: `The ${comparison.recommended} regime would cost you ${inr(comparison.saving)} less`,
          detail:
            "Not a blocker, but this is the last comfortable moment to change your mind.",
          href: "/regime",
          hard: false,
        }
      : null,
  ].filter(Boolean) as {
    id: string;
    text: string;
    detail: string;
    href: string;
    hard: boolean;
  }[];

  const hardBlocked = blockers.some((b) => b.hard);

  if (state.filing.submitted) {
    return <AlreadySubmitted />;
  }

  function submit() {
    const ack = `SYN${Math.floor(100_000_000_000 + Math.random() * 899_999_999_999)}`;
    state.submitReturn(ack);
    router.push("/filing/confirmation");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Filing · AY ${ASSESSMENT_YEAR}`}
        title="Review and submit"
        intro="Everything below was assembled from what you entered and what the department already holds. Read it, change anything that is wrong, then submit."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-5">
          {/* -------- form selection -------- */}
          <Card>
            <CardHeader
              title="Which form applies to you"
              eyebrow="Step 1"
              action={<Badge tone="pine">{recommendation.form}</Badge>}
            />
            <div className="px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["ITR-1", "ITR-2"] as const).map((f) => {
                  const chosen =
                    (state.filing.formSelected ?? recommendation.form) === f;
                  const isRecommended = recommendation.form === f;
                  return (
                    <button
                      key={f}
                      onClick={() => state.selectForm(f)}
                      className={cx(
                        "rounded-[var(--radius-sm)] border px-3.5 py-3 text-left transition-colors",
                        chosen
                          ? "border-[color:var(--pine)] bg-pine-50"
                          : "border-line bg-surface hover:bg-sunk",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[16px] font-semibold">
                          {f}
                        </span>
                        {isRecommended ? (
                          <Badge tone="ok">recommended</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
                        {f === "ITR-1" ? (
                          <>
                            <Term name="ITR-1">Sahaj</Term> — resident individual,
                            salary, one house property, income up to ₹50 lakh
                          </>
                        ) : (
                          <>
                            <Term name="ITR-2">ITR-2</Term> — adds capital gains,
                            multiple properties, foreign assets, carried-forward
                            losses
                          </>
                        )}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-[var(--radius-sm)] border border-line bg-sunk px-3.5 py-3">
                <div className="eyebrow mb-1.5">
                  Why {recommendation.form} <ComputedTag />
                </div>
                <ul className="space-y-1">
                  {recommendation.reasons.map((r) => (
                    <li
                      key={r}
                      className="flex gap-2 text-[12.5px] leading-snug text-ink-soft"
                    >
                      <span className="text-[color:var(--ok)]">✓</span>
                      {r}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowDisqualifiers(!showDisqualifiers)}
                  className="mt-2 text-[12px] font-medium text-[color:var(--pine)] underline underline-offset-2"
                >
                  {showDisqualifiers ? "Hide" : "Show"} the eight rules that were
                  checked
                </button>
                {showDisqualifiers ? (
                  <ul className="mt-2 space-y-1.5 border-t border-line pt-2">
                    {recommendation.disqualifiers.map((d) => (
                      <li key={d.rule} className="text-[12px] leading-snug">
                        <span
                          className={cx(
                            "font-medium",
                            d.triggered
                              ? "text-[color:var(--alert)]"
                              : "text-ink-soft",
                          )}
                        >
                          {d.triggered ? "✕" : "○"} {d.rule}
                        </span>
                        <span className="block text-ink-faint">{d.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </Card>

          {/* -------- blockers -------- */}
          {blockers.length > 0 ? (
            <Card tone={hardBlocked ? "alert" : "plain"}>
              <CardHeader
                title="Before you submit"
                eyebrow="Step 2"
                action={
                  <Badge tone={hardBlocked ? "alert" : "warn"}>
                    {blockers.length} to look at
                  </Badge>
                }
              />
              <ul className="divide-y divide-[color:var(--line)]">
                {blockers.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={b.href}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-sunk"
                    >
                      <span
                        className={cx(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                          b.hard
                            ? "bg-[color:var(--alert)]"
                            : "bg-[color:var(--clay)]",
                        )}
                      >
                        !
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium">
                          {b.text}
                        </span>
                        <span className="block text-[12.5px] leading-snug text-ink-soft">
                          {b.detail}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-medium text-[color:var(--pine)]">
                        Fix
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Callout tone="ok" title="Nothing is blocking you">
              Your AIS is reconciled, you are on the cheaper regime, and there is no
              tax outstanding.
            </Callout>
          )}

          {/* -------- the return itself -------- */}
          <Card>
            <CardHeader
              title="What you are about to submit"
              eyebrow="Step 3 · prefilled, editable"
              description={`${state.filing.formSelected ?? recommendation.form} for AY ${ASSESSMENT_YEAR}, income earned in FY ${FINANCIAL_YEAR}`}
            />

            <div className="space-y-4 px-4 py-4">
              <ReviewBlock
                title="Personal information"
                href="/profile"
                rows={[
                  ["Name", state.profile.name],
                  ["PAN", `${state.profile.pan} (synthetic)`],
                  ["Aadhaar", state.profile.aadhaarMasked],
                  ["Residential status", state.profile.residentialStatus],
                  [
                    "Refund account",
                    state.profile.bankAccounts.find((b) => b.nominatedForRefund)
                      ? `${state.profile.bankAccounts.find((b) => b.nominatedForRefund)!.bank} ${state.profile.bankAccounts.find((b) => b.nominatedForRefund)!.accountNumberMasked}`
                      : "None nominated",
                  ],
                ]}
              />

              <div>
                <SectionLabel title="Income" href="/income" />
                <Row label="Gross salary" value={current.grossSalary} note={form16.employer.name} />
                <Row label="Exempt allowances" value={current.exemptAllowances} negative indent />
                <Row label="Standard deduction" value={current.standardDeduction} negative indent />
                <Row label="Professional tax" value={current.professionalTax} negative indent />
                <Row label="Income from salary" value={current.incomeFromSalary} />
                <Row
                  label="Income from house property"
                  value={current.incomeFromHouseProperty}
                  tone={current.incomeFromHouseProperty < 0 ? "alert" : undefined}
                />
                <Row
                  label="Income from other sources"
                  value={current.incomeFromOtherSources}
                />
                <Row label="Gross total income" value={current.grossTotalIncome} strong />
              </div>

              <div>
                <SectionLabel title="Deductions" href="/deductions" />
                {current.chapterVIABreakdown.length === 0 ? (
                  <p className="py-1.5 text-[13px] text-ink-faint">
                    None claimable under the {state.regime} regime.
                  </p>
                ) : (
                  current.chapterVIABreakdown.map((b) => (
                    <Row key={b.label} label={b.label} value={b.amount} negative indent />
                  ))
                )}
                <Row label="Total income" value={current.totalIncome} strong />
              </div>

              <div>
                <SectionLabel title="Tax computation" href="/regime" />
                <Row label="Tax on total income" value={Math.round(current.taxBeforeRebate)} />
                {current.rebate87A > 0 ? (
                  <Row label="Rebate u/s 87A" value={Math.round(current.rebate87A)} negative indent />
                ) : null}
                {current.surcharge > 0 ? (
                  <Row label="Surcharge" value={Math.round(current.surcharge)} indent />
                ) : null}
                <Row label="Cess at 4%" value={Math.round(current.cess)} indent />
                <Row label="Total tax liability" value={current.totalTaxLiability} strong />
                <Row label="Tax deducted at source" value={current.tdsCredit} negative />
                {current.selfAssessmentTax > 0 ? (
                  <Row label="Self-assessment tax paid" value={current.selfAssessmentTax} negative />
                ) : null}
                <Row
                  label={current.refundDue > 0 ? "Refund claimed" : "Balance payable"}
                  value={current.refundDue || current.taxPayable}
                  strong
                  tone={current.refundDue > 0 ? "ok" : "alert"}
                />
              </div>
            </div>
          </Card>

          {/* -------- declaration -------- */}
          <Card>
            <CardHeader title="Declaration" eyebrow="Step 4" />
            <div className="space-y-4 px-4 py-4">
              <Toggle
                checked={declaration}
                onChange={setDeclaration}
                label="I confirm the information above is true and complete"
                description="In a real return this is a statement under section 140, made in your capacity as the taxpayer, and a false one carries consequences under section 277. Here it confirms you have read the summary."
              />

              <Callout tone="warn" title="Simulated submission">
                Nothing is transmitted anywhere. This generates a synthetic
                acknowledgement number and moves your local demo state forward.
              </Callout>

              <Button
                block
                size="lg"
                disabled={!declaration || hardBlocked}
                onClick={submit}
              >
                {hardBlocked
                  ? "Pay the outstanding tax first"
                  : `Submit ${state.filing.formSelected ?? recommendation.form}`}
              </Button>
              {hardBlocked ? (
                <Link
                  href="/filing/payment"
                  className="block text-center text-[13px] font-medium text-[color:var(--pine)] underline underline-offset-2"
                >
                  Go to payment
                </Link>
              ) : null}
            </div>
          </Card>
        </div>

        {/* -------- sidebar -------- */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card tone="sunk">
            <CardHeader title="Where you are" />
            <div className="px-4 py-4">
              <ProgressTrack
                current={state.filing.submitted ? 3 : hardBlocked ? 1 : 2}
                steps={[
                  { id: "prepare", label: "Prepare" },
                  { id: "pay", label: "Pay anything due" },
                  { id: "submit", label: "Submit" },
                  { id: "verify", label: "e-Verify" },
                ]}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function SectionLabel({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-1 flex items-center justify-between border-b border-line pb-1">
      <span className="eyebrow">{title}</span>
      <Link
        href={href}
        className="text-[12px] font-medium text-[color:var(--pine)]"
      >
        Edit
      </Link>
    </div>
  );
}

function ReviewBlock({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: [string, string][];
}) {
  return (
    <div>
      <SectionLabel title={title} href={href} />
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 sm:block">
            <dt className="text-[12px] text-ink-faint">{k}</dt>
            <dd className="text-[13px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AlreadySubmitted() {
  const state = useAppStore();
  const { current } = useTax();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Filing"
        title="This return is already submitted"
        intro="You cannot submit it twice. If something was wrong, file a revised return under section 139(5) — allowed any number of times until the end of the assessment year."
        aside={
          <Badge tone={state.filing.everified ? "ok" : "warn"}>
            {state.filing.everified ? "Verified" : "Not verified"}
          </Badge>
        }
      />

      <Card tone={state.filing.everified ? "ok" : "alert"}>
        <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
          <Stat
            label="Acknowledgement"
            value={
              <span className="mono text-[15px]">
                {state.filing.acknowledgementNumber}
              </span>
            }
            tag={<DemoTag />}
          />
          <Stat
            label="Submitted"
            value={
              state.filing.submittedAt
                ? shortDate(state.filing.submittedAt)
                : "—"
            }
          />
          <Stat label="Form" value={state.filing.formSelected ?? "ITR-1"} />
          <Stat
            label={current.refundDue > 0 ? "Refund claimed" : "Tax paid"}
            value={inr(current.refundDue || current.totalTaxLiability)}
            tone={current.refundDue > 0 ? "ok" : "plain"}
          />
        </div>
      </Card>

      {!state.filing.everified ? (
        <Callout tone="alert" title="It does not count until you verify it">
          You have 30 days from submission. An unverified return is treated as
          though it was never filed at all — including the late fee that follows.
        </Callout>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!state.filing.everified ? (
          <Link
            href="/filing/everify"
            className="rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-5 py-3 text-[14px] font-medium text-white"
          >
            e-Verify now
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
          href="/filing/confirmation"
          className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-5 py-3 text-[14px] font-medium"
        >
          See the acknowledgement
        </Link>
      </div>
    </div>
  );
}
