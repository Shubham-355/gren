"use client";

import Link from "next/link";
import { useState } from "react";

import { FlowActionBar, PhoneStepHeader } from "@/components/shell/StepRail";
import {
  Badge,
  Button,
  Callout,
  Card,
  ComputedTag,
  DemoTag,
  PageHeader,
  Stat,
  Term,
  cx,
} from "@/components/ui";
import { buildSubmissionConfirmation } from "@/lib/confirmations";
import { inr, inrSigned, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { pendingMismatches, useAppStore } from "@/lib/store/useAppStore";
import { ASSESSMENT_YEAR } from "@/lib/tax/constants";
import { recommendForm } from "@/lib/tax/formSelection";

/**
 * Step 7 — Review and submit.
 *
 * The last screen before it is legally filed. One figure, the whole return in
 * collapsed sections, and a plain statement of what submitting means.
 *
 * The submit button does not submit. It raises the Tier 3 confirmation card
 * (§5.2) — the same card the copilot's prepare_submission raises — because
 * filing is irreversible and deserves a deliberate, unmissable tap.
 */
export default function FilingPage() {
  const state = useAppStore();
  const { current, comparison } = useTax();
  const recommendation = recommendForm(state, current);
  const pending = pendingMismatches(state);

  const [declaration, setDeclaration] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDisqualifiers, setShowDisqualifiers] = useState(false);

  const copilotEdits = state.actionLog.filter(
    (a) => a.actor === "copilot" && !a.undone && a.undo,
  ).length;

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
    state.regime !== comparison.recommended && comparison.saving > 0
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
  const form = state.filing.formSelected ?? recommendation.form;

  if (state.filing.submitted) {
    return <AlreadySubmitted />;
  }

  function openConfirmation() {
    state.confirmReview();
    state.requestConfirmation(
      buildSubmissionConfirmation(useAppStore.getState(), "you"),
    );
  }

  const refundAccount = state.profile.bankAccounts.find(
    (b) => b.nominatedForRefund,
  );

  return (
    <div>
      <PhoneStepHeader back={{ href: "/regime" }} />

      <div className="grid gap-7 lg:grid-cols-[1fr_360px] lg:gap-9">
        <div>
          <h1 className="font-display text-[34px] leading-[1.08] tracking-[-0.015em] sm:text-[52px] sm:leading-[1.04]">
            Everything, once more
          </h1>
          <p className="mt-3.5 max-w-[34rem] text-[15px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[16.5px]">
            Nothing is filed yet. Open any section to change it — the refund
            figure moves with you.
          </p>

          {/* ------------------------ blockers ------------------------ */}
          {blockers.length > 0 ? (
            <Card
              tone={hardBlocked ? "alert" : "warn"}
              className="mt-6 overflow-hidden"
            >
              <div className="border-b border-inherit px-5 py-3">
                <span className="text-[14px] font-semibold">
                  {hardBlocked
                    ? "One thing has to happen first"
                    : "Worth a look before you file"}
                </span>
              </div>
              <ul>
                {blockers.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={b.href}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-black/[0.03]"
                    >
                      <span
                        className={cx(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                          b.hard
                            ? "bg-[color:var(--alert)]"
                            : "bg-[color:var(--warn)]",
                        )}
                      >
                        !
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium">
                          {b.text}
                        </span>
                        <span className="block text-[12.5px] leading-snug text-ink-soft">
                          {b.detail}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12.5px] font-semibold text-[color:var(--plum)]">
                        Fix
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* ------------------------ the return ------------------------ */}
          <Card className="mt-6 overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--surface-sunk)] px-5 py-4">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Personal &amp; PAN</div>
                <div className="mt-1 text-[13.5px] text-ink-faint">
                  {state.profile.name} · PAN {state.profile.pan}
                  <DemoTag label="synthetic" /> · AY {ASSESSMENT_YEAR} ·{" "}
                  <button
                    onClick={() => setShowForm(!showForm)}
                    className="font-medium text-[color:var(--plum)] underline underline-offset-2"
                  >
                    {form}
                  </button>
                </div>
              </div>
              <Link
                href="/profile"
                className="shrink-0 text-[13.5px] font-medium text-[color:var(--plum)]"
              >
                Edit
              </Link>
            </div>

            {showForm ? (
              <div className="animate-rise border-b border-[color:var(--surface-sunk)] bg-paper px-5 py-4">
                <div className="eyebrow mb-2">
                  Why {recommendation.form} <ComputedTag />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["ITR-1", "ITR-2"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => state.selectForm(f)}
                      className={cx(
                        "rounded-[var(--radius-sm)] border px-4 py-3 text-left transition-colors",
                        form === f
                          ? "border-[color:var(--plum)] bg-plum-50"
                          : "border-line bg-surface hover:bg-sunk",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-display text-[17px]">{f}</span>
                        {recommendation.form === f ? (
                          <Badge tone="ok">recommended</Badge>
                        ) : null}
                      </span>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
                        {f === "ITR-1" ? (
                          <>
                            <Term name="ITR-1">Sahaj</Term> — resident
                            individual, salary, one house property, income up to
                            ₹50 lakh
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
                  ))}
                </div>
                <ul className="mt-3 space-y-1">
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
                  className="mt-2.5 text-[12.5px] font-medium text-[color:var(--plum)] underline underline-offset-2"
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
            ) : null}

            <ReviewSection title="Income" href="/income/salary">
              <MiniLine
                label={`Salary, after ${state.regime === "old" ? "HRA and " : ""}standard deduction`}
                value={inr(current.incomeFromSalary)}
              />
              {state.houseProperty.enabled ? (
                <MiniLine
                  label="House property"
                  value={inrSigned(current.incomeFromHouseProperty)}
                />
              ) : null}
              <MiniLine
                label="Interest and dividend"
                value={inr(current.incomeFromOtherSources)}
              />
              <MiniLine
                label="Gross total income"
                value={inr(current.grossTotalIncome)}
                strong
              />
            </ReviewSection>

            <ReviewSection
              title={
                <>
                  Deductions{" "}
                  <span className="font-normal text-ink-faint">
                    · {state.regime} regime
                  </span>
                </>
              }
              href="/deductions"
            >
              {current.chapterVIABreakdown.length === 0 ? (
                <p className="py-1 text-[13.5px] text-ink-faint">
                  None claimable under the {state.regime} regime.
                </p>
              ) : (
                current.chapterVIABreakdown.map((b) => (
                  <MiniLine key={b.label} label={b.label} value={inr(b.amount)} />
                ))
              )}
              <MiniLine
                label="Total income"
                value={inr(current.totalIncome)}
                strong
              />
            </ReviewSection>

            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--surface-sunk)] px-5 py-4">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Taxes already paid</div>
                <div className="tnum mt-1 text-[13.5px] text-ink-faint">
                  {inr(current.tdsCredit)} TDS
                  {current.selfAssessmentTax > 0
                    ? ` · ${inr(current.selfAssessmentTax)} self-assessment`
                    : ""}
                </div>
              </div>
              {pending.length === 0 ? (
                <span className="shrink-0 text-[13px] font-semibold text-[color:var(--ok)]">
                  ✓ Reconciled
                </span>
              ) : (
                <Link
                  href="/reconciliation"
                  className="shrink-0 text-[13px] font-semibold text-[color:var(--alert)]"
                >
                  {pending.length} open
                </Link>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Refund account</div>
                <div className="mt-1 truncate text-[13.5px] text-ink-faint">
                  {refundAccount
                    ? `${refundAccount.bank} ···· ${refundAccount.accountNumberMasked.slice(-4)} · ${refundAccount.validated ? "pre-validated" : "not validated"} · IFSC ${refundAccount.ifsc}`
                    : "None nominated"}
                </div>
              </div>
              <Link
                href="/profile"
                className="shrink-0 text-[13.5px] font-medium text-[color:var(--plum)]"
              >
                Change
              </Link>
            </div>
          </Card>
        </div>

        {/* --------------------------- right column --------------------------- */}
        <div className="space-y-3.5 lg:sticky lg:top-[124px] lg:self-start">
          <Card
            tone={current.refundDue > 0 ? "money" : "plum"}
            className="p-6 sm:px-6 sm:py-[26px]"
          >
            <div className="text-[13px] text-white/80">
              {current.refundDue > 0 ? "Refund due to you" : "Tax still payable"}
            </div>
            <div className="tnum mt-1 font-display text-[52px] leading-none text-white sm:text-[64px]">
              {inr(current.refundDue > 0 ? current.refundDue : current.taxPayable)}
            </div>
            <div className="mt-4 space-y-2.5 border-t border-white/[0.22] pt-4 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <span className="text-white/[0.82]">Tax on total income</span>
                <span className="tnum text-white">
                  {inr(current.totalTaxLiability)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-white/[0.82]">Already paid</span>
                <span className="tnum text-white">
                  {inr(current.tdsCredit + current.selfAssessmentTax)}
                </span>
              </div>
              {comparison.saving > 0 &&
              state.regime === comparison.recommended ? (
                <div className="flex justify-between gap-3">
                  <span className="text-white/[0.82]">
                    Saved by the {state.regime} regime
                  </span>
                  <span className="tnum text-white">{inr(comparison.saving)}</span>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="p-5 sm:px-[22px] sm:py-5">
            <div className="text-[15px] font-semibold">What submitting does</div>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              It files your {form} with the department and locks this draft. You
              can still revise it later under{" "}
              <Term name="Section 139(5)">section 139(5)</Term>, and you will
              still need to e-verify within 30 days for the filing to count.
            </p>

            <button
              onClick={() => setDeclaration(!declaration)}
              aria-pressed={declaration}
              className="mt-4 flex w-full items-start gap-3 rounded-[var(--radius-sm)] bg-plum-50 px-3.5 py-3.5 text-left"
            >
              <span
                className={cx(
                  "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-[color:var(--plum)] text-[11px] text-white",
                  declaration && "bg-[color:var(--plum)]",
                )}
              >
                {declaration ? "✓" : null}
              </span>
              <span className="text-[13.5px] leading-relaxed text-ink-strong">
                I confirm the information above is correct and complete to the
                best of my knowledge.
              </span>
            </button>

            <div className="mt-4">
              <Button
                block
                size="lg"
                disabled={!declaration || hardBlocked}
                onClick={openConfirmation}
              >
                {hardBlocked ? "Pay the outstanding tax first" : "Submit my return"}
              </Button>
            </div>
            {hardBlocked ? (
              <Link
                href="/filing/payment"
                className="mt-3 block text-center text-[13px] font-medium text-[color:var(--plum)] underline underline-offset-2"
              >
                Go to payment
              </Link>
            ) : (
              <p className="mt-3 text-center text-[12px] text-ink-faint">
                One more tap on the review card after this. Nothing is
                transmitted to any tax authority.
              </p>
            )}
          </Card>

          {copilotEdits > 0 ? (
            <Card tone="copilot" className="flex gap-3 p-4">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--petrol)"
                strokeWidth="1.7"
                strokeLinejoin="round"
                className="mt-0.5 shrink-0"
              >
                <path d="M12 3.5l2.1 4.9 5.4.5-4.1 3.5 1.2 5.2L12 14.9l-4.6 2.7 1.2-5.2-4.1-3.5 5.4-.5z" />
              </svg>
              <p className="text-[13.5px] leading-relaxed text-[color:var(--petrol-text)]">
                Saathi made {copilotEdits}{" "}
                {copilotEdits === 1 ? "change" : "changes"} to this return. Every
                one is listed in the activity timeline, and every one can still
                be undone.
              </p>
            </Card>
          ) : null}

          {blockers.length === 0 ? (
            <Callout tone="ok" title="Nothing is blocking you">
              Your AIS is reconciled, you are on the cheaper regime, and there is
              no tax outstanding.
            </Callout>
          ) : null}
        </div>
      </div>

      <div className="lg:hidden">
        <FlowActionBar
          note="You will still need to e-verify within 30 days."
        >
          <Button
            block
            size="lg"
            disabled={!declaration || hardBlocked}
            onClick={openConfirmation}
          >
            {hardBlocked ? "Pay the outstanding tax first" : "Submit my return"}
          </Button>
        </FlowActionBar>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function ReviewSection({
  title,
  href,
  children,
}: {
  title: React.ReactNode;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[color:var(--surface-sunk)] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px] font-semibold">{title}</div>
        <Link
          href={href}
          className="shrink-0 text-[13.5px] font-medium text-[color:var(--plum)]"
        >
          Edit
        </Link>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function MiniLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-baseline justify-between gap-3 text-[14px]",
        strong && "border-t border-[color:var(--surface-sunk)] pt-2 font-semibold",
      )}
    >
      <span className={strong ? "" : "text-ink-soft"}>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- */

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
            className="rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-5 py-3 text-[14px] font-medium text-white"
          >
            e-Verify now
          </Link>
        ) : (
          <Link
            href="/refund"
            className="rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-5 py-3 text-[14px] font-medium text-white"
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
