"use client";

import Link from "next/link";

import { IconArrow } from "@/components/shell/Icons";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ComputedTag,
  DemoTag,
  LinkButton,
  Stat,
  Term,
  cx,
} from "@/components/ui";
import { notices as seededNotices } from "@/lib/data/seed";
import { daysUntil, inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import {
  pendingMismatches,
  refundStage,
  useAppStore,
} from "@/lib/store/useAppStore";
import {
  ASSESSMENT_YEAR,
  BELATED_DEADLINE,
  FILING_DEADLINE,
  FINANCIAL_YEAR,
} from "@/lib/tax/constants";

export default function DashboardPage() {
  const state = useAppStore();
  const { current, comparison } = useTax();
  const pending = pendingMismatches(state);
  const stage = refundStage(state);
  const daysLeft = daysUntil(FILING_DEADLINE);

  const openNotices = seededNotices.filter(
    (n) => state.notices[n.id]?.status === "Open" && n.requiresResponse,
  );

  const tasks = buildTaskList({
    form16Imported: state.form16Imported,
    pendingCount: pending.length,
    regimeChosen: state.regimeChosenExplicitly,
    recommended: comparison.recommended,
    selected: state.regime,
    saving: comparison.saving,
    formSelected: Boolean(state.filing.formSelected),
    submitted: state.filing.submitted,
    everified: state.filing.everified,
    taxPayable: current.taxPayable,
    openNotices: openNotices.length,
  });

  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-5">
      {/* -------------------- greeting + status -------------------- */}
      <div>
        <div className="eyebrow">
          Assessment Year {ASSESSMENT_YEAR} · income earned in FY{" "}
          {FINANCIAL_YEAR}
        </div>
        <h1 className="mt-1 font-display text-[27px] leading-tight sm:text-[32px]">
          {greeting()}, {state.profile.name.split(" ")[0]}.
        </h1>
        <p className="mt-1.5 max-w-prose text-[14.5px] leading-relaxed text-ink-soft">
          {headline(state.filing.submitted, state.filing.everified, done, tasks.length)}
        </p>
      </div>

      {/* -------------------- the one number that matters -------------------- */}
      <Card tone={current.refundDue > 0 ? "ok" : current.taxPayable > 0 ? "alert" : "accent"}>
        <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-4">
          <div>
            <div className="eyebrow">
              {current.refundDue > 0
                ? "Refund you are owed"
                : current.taxPayable > 0
                  ? "Still to pay"
                  : "Balance"}
              <ComputedTag />
            </div>
            <div
              className={cx(
                "tnum mt-1 font-display text-[38px] font-semibold leading-none sm:text-[44px]",
                current.refundDue > 0
                  ? "text-[color:var(--ok)]"
                  : current.taxPayable > 0
                    ? "text-[color:var(--alert)]"
                    : "text-[color:var(--pine)]",
              )}
            >
              {inr(current.refundDue || current.taxPayable || 0)}
            </div>
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-soft">
              {current.refundDue > 0
                ? `Your total tax works out to ${inr(current.totalTaxLiability)}, and ${inr(current.tdsCredit + current.selfAssessmentTax)} has already been paid on your behalf. The difference comes back to you.`
                : current.taxPayable > 0
                  ? `Your total tax is ${inr(current.totalTaxLiability)} but only ${inr(current.tdsCredit + current.selfAssessmentTax)} has been paid so far.`
                  : "What you owe and what has been paid are square."}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Badge tone={state.regime === comparison.recommended ? "ok" : "warn"}>
              {state.regime} regime
              {state.regime === comparison.recommended
                ? " · cheaper for you"
                : ` · ${inr(comparison.saving)} more than the other`}
            </Badge>
            <LinkButton href="/regime" size="sm" variant="secondary">
              See the working
            </LinkButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-line px-4 py-3.5 sm:grid-cols-4">
          <Stat
            label="Gross total income"
            value={inr(current.grossTotalIncome)}
            tag={<ComputedTag />}
          />
          <Stat
            label="Deductions claimed"
            value={inr(current.chapterVIA + current.exemptAllowances + current.standardDeduction)}
            hint="including standard deduction"
          />
          <Stat label="Total tax" value={inr(current.totalTaxLiability)} />
          <Stat
            label="Already paid"
            value={inr(current.tdsCredit + current.selfAssessmentTax)}
            hint={<>as <Term name="TDS">TDS</Term> and tax paid</>}
          />
        </div>
      </Card>

      {/* -------------------- deadline -------------------- */}
      {!state.filing.submitted ? (
        <Callout
          tone={daysLeft <= 15 ? "alert" : daysLeft <= 45 ? "warn" : "info"}
          title={
            daysLeft > 0
              ? `${daysLeft} days left to file`
              : "The due date has passed"
          }
        >
          {daysLeft > 0 ? (
            <>
              The due date for a salaried return this year is{" "}
              {shortDate(FILING_DEADLINE)}. Miss it and you can still file a
              belated return until {shortDate(BELATED_DEADLINE)}, but it costs a
              late fee under section 234F — ₹1,000 if your income is under ₹5
              lakh, ₹5,000 above that — plus interest at 1% a month on unpaid
              tax, and you lose the right to carry any losses forward.
            </>
          ) : (
            <>
              You can still file a belated return until{" "}
              {shortDate(BELATED_DEADLINE)}, with a late fee under section 234F
              and interest under 234A on anything unpaid.
            </>
          )}
        </Callout>
      ) : null}

      {/* -------------------- action items -------------------- */}
      <Card>
        <CardHeader
          eyebrow={`${done} of ${tasks.length} done`}
          title="What needs you"
          description="In the order it makes sense to do it."
        />
        <ul className="divide-y divide-[color:var(--line)]">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={task.href}
                className={cx(
                  "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sunk",
                  task.done && "opacity-55",
                )}
              >
                <span
                  className={cx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                    task.done
                      ? "border-[color:var(--ok)] bg-[color:var(--ok)] text-white"
                      : task.urgent
                        ? "border-[color:var(--clay)] bg-clay-50 text-[color:var(--clay-ink)]"
                        : "border-line-strong text-ink-faint",
                  )}
                >
                  {task.done ? "✓" : task.urgent ? "!" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      "block text-[14px] font-medium",
                      task.done ? "text-ink-soft line-through" : "text-ink",
                    )}
                  >
                    {task.label}
                  </span>
                  <span className="block text-[12.5px] leading-snug text-ink-faint">
                    {task.detail}
                  </span>
                </span>
                <IconArrow width={16} height={16} className="shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {/* -------------------- notices + refund -------------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Notices"
            eyebrow="From the department"
            action={
              <Link
                href="/notices"
                className="text-[13px] font-medium text-[color:var(--pine)]"
              >
                All {seededNotices.length}
              </Link>
            }
          />
          <div className="divide-y divide-[color:var(--line)]">
            {seededNotices.slice(0, 2).map((n) => {
              const s = state.notices[n.id];
              return (
                <Link
                  key={n.id}
                  href={`/notices/${n.id}`}
                  className="block px-4 py-3 hover:bg-sunk"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        s?.status === "Open" && n.requiresResponse
                          ? "warn"
                          : s?.status === "Responded"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {n.section}
                    </Badge>
                    <span className="text-[11.5px] text-ink-faint">
                      {shortDate(n.issuedOn)}
                    </span>
                    <DemoTag />
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium leading-snug">
                    {n.title}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">
                    {n.plainLanguage}
                  </p>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Refund"
            eyebrow="Where your money is"
            action={
              <Link
                href="/refund"
                className="text-[13px] font-medium text-[color:var(--pine)]"
              >
                Track
              </Link>
            }
          />
          <div className="px-4 py-4">
            {stage === "not-filed" ? (
              <p className="text-[13.5px] leading-relaxed text-ink-soft">
                Nothing in the pipeline yet — a refund only starts moving once you
                file and e-verify. Based on your current figures you would be owed{" "}
                <strong className="tnum text-ink">
                  {inr(current.refundDue)}
                </strong>
                .
              </p>
            ) : (
              <>
                <Stat
                  label="Refund determined"
                  value={inr(current.refundDue)}
                  tone="ok"
                  hint={`Stage: ${stage}`}
                />
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
                  Going to{" "}
                  {state.profile.bankAccounts.find((b) => b.nominatedForRefund)
                    ?.bank ?? "no account nominated"}{" "}
                  <DemoTag />
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* -------------------- quick links -------------------- */}
      <Card tone="sunk">
        <CardHeader
          title="Everything else"
          description="Every module of the platform, one tap away."
        />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-[var(--radius)] bg-[color:var(--line)] sm:grid-cols-3">
          {[
            ["/income", "Income sources"],
            ["/reconciliation", "AIS · TIS · 26AS"],
            ["/deductions", "Deductions"],
            ["/regime", "Regime & tax"],
            ["/filing", "File return"],
            ["/filing/everify", "e-Verify"],
            ["/history", "Filing history"],
            ["/refund", "Refund tracker"],
            ["/notices", "Notices"],
            ["/grievance", "Something is wrong"],
            ["/profile", "Profile & bank"],
            ["/help", "Help & jargon"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="bg-surface px-3.5 py-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-pine-50 hover:text-[color:var(--pine-ink)]"
            >
              {label}
            </Link>
          ))}
        </div>
      </Card>

      <CopilotNudge />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function CopilotNudge() {
  const setOpen = useAppStore((s) => s.setCopilotOpen);
  return (
    <button
      onClick={() => setOpen(true)}
      className="w-full rounded-[var(--radius)] border border-dashed border-pine-100 bg-pine-50 px-4 py-3.5 text-left transition-colors hover:border-[color:var(--pine-400)]"
    >
      <div className="text-[13.5px] font-semibold text-[color:var(--pine-ink)]">
        Not sure where to start?
      </div>
      <div className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
        Ask Sarathi &ldquo;what still needs doing before I can file?&rdquo; — it can
        see everything on this page and will take you to whatever is next.
      </div>
    </button>
  );
}

type Task = {
  id: string;
  label: string;
  detail: string;
  href: string;
  done: boolean;
  urgent?: boolean;
};

function buildTaskList(o: {
  form16Imported: boolean;
  pendingCount: number;
  regimeChosen: boolean;
  recommended: "old" | "new";
  selected: "old" | "new";
  saving: number;
  formSelected: boolean;
  submitted: boolean;
  everified: boolean;
  taxPayable: number;
  openNotices: number;
}): Task[] {
  const tasks: Task[] = [
    {
      id: "form16",
      label: "Bring in your salary details",
      detail: o.form16Imported
        ? "Form 16 imported from Vermillion Systems"
        : "One tap imports your Form 16 — salary, allowances and tax already deducted",
      href: "/income/salary",
      done: o.form16Imported,
    },
    {
      id: "reconcile",
      label:
        o.pendingCount > 0
          ? `Sort out ${o.pendingCount} difference${o.pendingCount === 1 ? "" : "s"} against your AIS`
          : "Your return matches what the department already knows",
      detail:
        o.pendingCount > 0
          ? "Income your bank reported that is not in your return yet. Leaving it triggers an automatic notice."
          : "Every AIS entry has been accepted, corrected or sent back with feedback",
      href: "/reconciliation",
      done: o.pendingCount === 0,
      urgent: o.pendingCount > 0,
    },
    {
      id: "deductions",
      label: "Claim what you are entitled to",
      detail:
        "Walk the guided questions, or fill sections directly if you already know them",
      href: "/deductions",
      done: o.regimeChosen,
    },
    {
      id: "regime",
      label:
        o.selected === o.recommended
          ? `You are on the ${o.selected} regime, which is the cheaper one`
          : `The ${o.recommended} regime would save you ${inr(o.saving)}`,
      detail:
        o.selected === o.recommended
          ? "Both regimes computed on your actual numbers"
          : "Switch on the regime screen, or ask the copilot to do it",
      href: "/regime",
      done: o.selected === o.recommended,
      urgent: o.selected !== o.recommended,
    },
  ];

  if (o.taxPayable > 0) {
    tasks.push({
      id: "pay",
      label: `Pay ${inr(o.taxPayable)} of self-assessment tax`,
      detail: "Has to be paid before the return can be submitted",
      href: "/filing/payment",
      done: false,
      urgent: true,
    });
  }

  tasks.push(
    {
      id: "file",
      label: o.submitted ? "Return submitted" : "Review and submit your return",
      detail: o.submitted
        ? "Acknowledgement generated"
        : o.formSelected
          ? "Form chosen — review the prefill and submit"
          : "We will recommend the right form based on what you have entered",
      href: "/filing",
      done: o.submitted,
    },
    {
      id: "verify",
      label: o.everified ? "Return e-verified" : "e-Verify your return",
      detail: o.everified
        ? "Processing has started"
        : "An unverified return is treated as never filed. You get 30 days.",
      href: "/filing/everify",
      done: o.everified,
      urgent: o.submitted && !o.everified,
    },
  );

  if (o.openNotices > 0) {
    tasks.push({
      id: "notices",
      label: `Respond to ${o.openNotices} notice${o.openNotices === 1 ? "" : "s"}`,
      detail: "The department has asked you something and is waiting",
      href: "/notices",
      done: false,
      urgent: true,
    });
  }

  return tasks;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function headline(
  submitted: boolean,
  everified: boolean,
  done: number,
  total: number,
): string {
  if (submitted && everified)
    return "Your return is filed and verified. From here it is the department's move — track the refund below.";
  if (submitted)
    return "Your return is submitted but not verified yet. Until it is verified it does not count as filed.";
  if (done === 0)
    return "Nothing is filled in yet. Start by bringing in your salary details — it takes one tap and fills most of the return.";
  return `${done} of ${total} steps done. Here is what is left.`;
}
