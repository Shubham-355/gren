"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card, LinkButton, cx } from "@/components/ui";
import { FLOW_STEPS, nextStep, stepDone } from "@/lib/flow";
import { inr } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import {
  hasSeededDocuments,
  pendingMismatches,
  useAppStore,
  visibleNotices,
} from "@/lib/store/useAppStore";

/**
 * Step 2 — Home dashboard.
 *
 * It has to answer "what do I need to do right now" in under three seconds.
 * One headline figure, one next action, everything else demoted. Not a menu of
 * eighteen equal options.
 */
export default function DashboardPage() {
  const state = useAppStore();
  const { current, comparison } = useTax();
  const pending = pendingMismatches(state);
  const next = nextStep(state);

  const openNotice = visibleNotices(state).find(
    (n) => state.notices[n.id]?.status === "Open" && n.requiresResponse,
  );

  const hasDocuments = hasSeededDocuments(state);
  const action = useMemo(
    () =>
      nextActionCopy(
        next.id,
        pending.length,
        comparison.recommended,
        state.regime,
        hasDocuments,
      ),
    [next.id, pending.length, comparison.recommended, state.regime, hasDocuments],
  );

  const inRefund = current.refundDue > 0;

  return (
    <div className="space-y-7">
      {/* ------------------------------ headline ------------------------------ */}
      <section>
        <p className="eyebrow">
          {greeting()}, {state.profile.name.split(" ")[0]}
        </p>

        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-11">
          <div>
            <div className="text-[13.5px] font-medium text-ink-soft">
              {inRefund
                ? "Your refund, as it stands"
                : current.taxPayable > 0
                  ? "Still to pay, as it stands"
                  : "Your position, as it stands"}
            </div>
            <div
              className={cx(
                "tnum mt-1.5 font-display text-[56px] leading-none lg:text-[76px]",
                inRefund
                  ? "text-[color:var(--ok)]"
                  : current.taxPayable > 0
                    ? "text-[color:var(--alert)]"
                    : "text-ink",
              )}
            >
              {inr(inRefund ? current.refundDue : current.taxPayable)}
            </div>
          </div>

          <div className="flex gap-8 border-line pb-2.5 sm:flex-col sm:gap-3 sm:border-l sm:pl-8">
            <div>
              <div className="text-[12.5px] text-ink-faint">Total tax</div>
              <div className="tnum text-[19px] font-medium">
                {inr(current.totalTaxLiability)}
              </div>
            </div>
            <div>
              <div className="text-[12.5px] text-ink-faint">Already deducted</div>
              <div className="tnum text-[19px] font-medium">
                {inr(current.tdsCredit)}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3.5 max-w-[36rem] text-[14.5px] leading-relaxed text-ink-soft">
          {inRefund
            ? `Tax of ${inr(current.totalTaxLiability)} against ${inr(current.tdsCredit)} already deducted. The difference comes back to you.`
            : current.taxPayable > 0
              ? `Tax of ${inr(current.totalTaxLiability)} against ${inr(current.tdsCredit)} already deducted. The shortfall is self-assessment tax${
                  current.interest.total > 0
                    ? `, plus ${inr(current.interest.total)} of interest and fee for not having paid it during the year`
                    : ""
                }.`
              : "Tax due and tax already paid are square — nothing to pay, nothing to come back."}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-9 [&>*]:min-w-0">
        <div className="space-y-7">
          {/* ------------------------- the one next action ------------------- */}
          <Card tone="plum" className="p-6 lg:p-7">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white/60">
              Do this next
            </div>
            <div className="mt-2.5 flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[26px] leading-[1.15] text-white lg:text-[32px]">
                  {action.title}
                </h2>
                <p className="mt-2.5 max-w-[38rem] text-[14px] leading-relaxed text-white/[0.78] lg:text-[15px]">
                  {action.body}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2.5">
                <LinkButton
                  href={next.href}
                  variant="onPlum"
                  size="lg"
                  className="font-semibold"
                >
                  {action.cta}
                </LinkButton>
                <span className="text-center text-[13px] text-white/60">
                  {action.time}
                </span>
              </div>
            </div>
          </Card>

          {/* ------------------------- at a glance --------------------------- */}
          <div className="grid gap-3.5 sm:grid-cols-3">
            <GlanceCard
              label="Gross total income"
              value={inr(current.grossTotalIncome)}
              hint="Salary, house property and other sources"
            />
            <GlanceCard
              label="Deductions in effect"
              value={inr(current.chapterVIA + current.standardDeduction)}
              hint={
                state.regime === "new"
                  ? "Standard deduction and employer NPS"
                  : "Standard deduction and Chapter VI-A"
              }
            />
            <div className="rounded-[var(--radius)] border border-line bg-surface px-5 py-4">
              <div className="text-[12.5px] text-ink-faint">Regime</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                <span className="text-[22px] font-medium capitalize">
                  {state.regime}
                </span>
                {comparison.recommended === state.regime ? (
                  <span className="rounded-full bg-ok-50 px-2.5 py-1 text-[11.5px] font-semibold text-[color:var(--ok)]">
                    cheaper for you
                  </span>
                ) : (
                  <span className="rounded-full bg-warn-50 px-2.5 py-1 text-[11.5px] font-semibold text-[color:var(--warn)]">
                    {inr(comparison.saving)} more than the {comparison.recommended}
                  </span>
                )}
              </div>
              <div className="mt-2 text-[12.5px] text-ink-faint">
                {state.regimeChosenExplicitly
                  ? "You chose this one"
                  : "Recheck once your deductions are in"}
              </div>
            </div>
          </div>

          {/* ------------------------- secondary doors ----------------------- */}
          <Link
            href="/history"
            className="flex items-center justify-between rounded-[var(--radius)] px-1 py-2 text-ink-soft hover:text-ink lg:hidden"
          >
            <span className="text-[13.5px] font-medium">
              Filing history, notices, help
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        {/* --------------------------- right column ------------------------- */}
        <div className="space-y-3.5">
          <Card className="px-5 py-4">
            <div className="eyebrow">Still to do</div>
            {/* Rows, not lines of text. Each of these is a link into a step,
                and at the line height alone they were 22px of target with 14px
                of dead air between them. */}
            <ul className="mt-2.5 space-y-0.5">
              {FLOW_STEPS.filter((s) => s.id !== "submit").map((step) => {
                const done = stepDone(step.id, state);
                const isNext = step.id === next.id;
                const count =
                  step.id === "reconcile" && !done ? pending.length : 0;
                return (
                  <li key={step.id}>
                    <Link
                      href={step.href}
                      className="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-sunk"
                    >
                      <span
                        className={cx(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                          done && "bg-[color:var(--ok)] text-white",
                          !done && count > 0 && "bg-[color:var(--alert)] text-white",
                          !done && count === 0 && "border-[1.5px] border-line-strong",
                        )}
                      >
                        {done ? "✓" : count > 0 ? count : null}
                      </span>
                      <span
                        className={cx(
                          "text-[14px]",
                          done && "text-ink-faint line-through",
                          isNext && "font-medium text-ink",
                          !done && !isNext && "text-ink-soft",
                        )}
                      >
                        {stepLabel(step.id)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          {openNotice ? (
            <Card tone="warn" className="px-5 py-4">
              <div className="text-[14px] font-semibold text-[color:var(--warn)]">
                One notice is waiting
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                {openNotice.title}. Settling the differences above usually closes
                it on its own.
              </p>
              <Link
                href={`/notices/${openNotice.id}`}
                className="tap mt-2.5 inline-block border-b border-[color:var(--plum)] text-[13.5px] font-semibold text-[color:var(--plum)]"
              >
                Read the notice
              </Link>
            </Card>
          ) : null}

          <Card className="px-5 py-4">
            <div className="eyebrow">Refund tracker</div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
              {state.filing.everified
                ? "Verified and moving. Follow it stage by stage."
                : state.filing.submitted
                  ? "Submitted but not verified — nothing moves until it is."
                  : "Nothing moving yet — a refund only starts once you file and verify."}
            </p>
            {state.filing.submitted ? (
              <div className="mt-3">
                <LinkButton href="/refund" variant="secondary" size="sm">
                  Track it
                </LinkButton>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function GlanceCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface px-5 py-4">
      <div className="text-[12.5px] text-ink-faint">{label}</div>
      <div className="tnum mt-1.5 text-[22px] font-medium">{value}</div>
      <div className="mt-2 text-[12.5px] leading-snug text-ink-faint">{hint}</div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function stepLabel(id: string): string {
  const labels: Record<string, string> = {
    income: "Bring in your salary",
    reconcile: "Settle the AIS differences",
    deductions: "Claim your deductions",
    regime: "Confirm the regime",
    review: "Review and submit",
    verify: "e-Verify the return",
    refund: "Watch the refund land",
  };
  return labels[id] ?? id;
}

/**
 * The next action, written as a sentence about the user's situation rather
 * than as the name of a screen.
 */
function nextActionCopy(
  id: string,
  pending: number,
  recommended: string,
  regime: string,
  hasDocuments: boolean,
): { title: string; body: string; cta: string; time: string } {
  switch (id) {
    case "income":
      // Promising a Form 16 to a PAN that has none is the one thing this card
      // must not do — it is the first sentence of the product.
      return hasDocuments
        ? {
            title: "Your employer has already told them most of this",
            body: "Import the Form 16 and your salary, allowances and the tax already deducted fill themselves in. You only correct what looks wrong.",
            cta: "Bring in my salary",
            time: "about 1 minute",
          }
        : {
            title: "Nothing is on record, so let’s build it",
            body: "No Form 16 was filed against this PAN, so the return starts empty. Enter your salary and the tax already deducted — or ask Saathi and answer its questions instead. Every figure after this is computed from what you put in.",
            cta: "Enter my salary",
            time: "about 4 minutes",
          };
    case "reconcile":
      if (pending === 0)
        return {
          title: "There is nothing to check your return against",
          body: "No AIS or 26AS entries are on record for this PAN, so there is nothing to reconcile. On a real return this is the step that catches the interest and dividends you forgot.",
          cta: "See the reconciliation screen",
          time: "under a minute",
        };
      return {
        title:
          pending === 1
            ? "One thing your bank told them that your return does not say"
            : `${pending} things your bank told them that your return does not say`,
        body: "Each one gets a sentence explaining what happened and what it costs, and buttons that end it. Leaving them open is what turns into a 143(1) notice three months later.",
        cta: pending === 1 ? "Review the difference" : "Review the differences",
        time: "about 2 minutes",
      };
    case "deductions":
      return {
        title: "Now the part only you can answer",
        body: "A short run of questions about your life — provident fund, insurance, rent, loans — and the running tax figure moves with every answer. No section numbers to hunt for.",
        cta: "Answer the questions",
        time: "about 3 minutes",
      };
    case "regime":
      return {
        title:
          recommended === regime
            ? `The ${regime} regime is the cheaper one for you`
            : `The ${recommended} regime would cost you less`,
        body: "Both are computed on the same return, line by line, side by side. Confirm the one you want and the choice is locked into the filing.",
        cta: "See the comparison",
        time: "about 1 minute",
      };
    case "review":
      return {
        title: "Everything, once more, before it is filed",
        body: "The whole return on one screen, every section editable. Nothing is filed until you tap confirm on the card that follows.",
        cta: "Review my return",
        time: "about 2 minutes",
      };
    case "submit":
      return {
        title: "Your return is ready to file",
        body: "One card, one tap. Filing is irreversible, so it is the one step nothing else on this platform can do for you.",
        cta: "Go to review",
        time: "about 1 minute",
      };
    case "verify":
      return {
        title: "Submitted — but not yet filed, in the eyes of the law",
        body: "Until it is verified, the department treats the return as never filed. You have 30 days, and this takes about ten seconds.",
        cta: "e-Verify now",
        time: "about 10 seconds",
      };
    default:
      return {
        title: "Filed and verified. You are done for the year.",
        body: "Nothing else is needed from you unless the department asks. The tracker below follows the refund from here.",
        cta: "Track my refund",
        time: "no action needed",
      };
  }
}
