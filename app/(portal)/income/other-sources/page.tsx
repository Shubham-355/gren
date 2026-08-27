"use client";

import Link from "next/link";

import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ComputedTag,
  DemoTag,
  Field,
  MoneyInput,
  PageHeader,
  Row,
  Term,
} from "@/components/ui";
import { aisEntries } from "@/lib/data/seed";
import { inr } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { pendingMismatches, useAppStore } from "@/lib/store/useAppStore";
import { LIMITS } from "@/lib/tax/constants";

export default function OtherSourcesPage() {
  const state = useAppStore();
  const { current } = useTax();
  const pending = pendingMismatches(state).filter(
    (e) => e.category === "Interest" || e.category === "Dividend",
  );

  const aisTotal = aisEntries
    .filter((e) => e.category === "Interest" || e.category === "Dividend")
    .reduce((s, e) => s + e.aisAmount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Income · Other sources"
        title="Interest, dividends and everything else"
        intro="This is the head people forget, and the one the department checks hardest — because your bank has already told them the number."
        aside={
          <Badge tone={pending.length > 0 ? "warn" : "ok"}>
            {pending.length > 0
              ? `${pending.length} unreconciled`
              : "Matches AIS"}
          </Badge>
        }
      />

      {pending.length > 0 ? (
        <Callout
          tone="warn"
          title={`Your AIS shows ${inr(aisTotal)} under this head`}
        >
          You have declared {inr(current.incomeFromOtherSources)}. The difference
          is not necessarily a mistake — some of it may not be yours — but every
          entry needs a decision before you file.{" "}
          <Link
            href="/reconciliation"
            className="font-medium underline underline-offset-2"
          >
            Go and settle them
          </Link>
          .
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] [&>*]:min-w-0">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="What you earned"
              description="Enter the gross amount before any tax was deducted."
            />
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              <Field
                label="Savings account interest"
                hint={
                  state.regime === "old"
                    ? `The first ₹${LIMITS.s80TTA.toLocaleString("en-IN")} is deductible under 80TTA`
                    : "Fully taxable in the new regime — 80TTA does not apply"
                }
              >
                <MoneyInput
                  value={state.otherSources.savingsInterest}
                  onValueChange={(v) => state.setOtherSource("savingsInterest", v)}
                />
              </Field>

              <Field
                label="Fixed and recurring deposit interest"
                hint="Taxable in full. 80TTA never covers deposits, only savings accounts."
              >
                <MoneyInput
                  value={state.otherSources.fdInterest}
                  onValueChange={(v) => state.setOtherSource("fdInterest", v)}
                />
              </Field>

              <Field
                label="Dividends"
                hint="Taxable at your slab rate since 2020. Companies deduct 10% above ₹10,000."
              >
                <MoneyInput
                  value={state.otherSources.dividend}
                  onValueChange={(v) => state.setOtherSource("dividend", v)}
                />
              </Field>

              <Field
                label="Anything else"
                hint="Interest from a second bank, family pension, gifts above ₹50,000, interest on an income tax refund"
              >
                <MoneyInput
                  value={state.otherSources.other}
                  onValueChange={(v) => state.setOtherSource("other", v)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="What your banks reported"
              eyebrow="From your AIS"
              action={
                <Link
                  href="/reconciliation"
                  className="text-[13px] font-medium text-[color:var(--plum)]"
                >
                  Reconcile
                </Link>
              }
            />
            <ul className="divide-y divide-[color:var(--line)]">
              {aisEntries
                .filter(
                  (e) => e.category === "Interest" || e.category === "Dividend",
                )
                .map((entry) => {
                  const resolution = state.reconciliation[entry.id]?.resolution;
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium">
                          {entry.description}
                          <DemoTag />
                        </div>
                        <div className="text-[12px] text-ink-faint">
                          {entry.source}
                          {entry.tdsDeducted > 0
                            ? ` · ${inr(entry.tdsDeducted)} tax already deducted`
                            : " · no tax deducted"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tnum text-[13.5px] font-medium">
                          {inr(entry.aisAmount)}
                        </div>
                        <Badge
                          tone={
                            resolution === "pending"
                              ? "warn"
                              : resolution === "other-pan" ||
                                  resolution === "duplicate" ||
                                  resolution === "denied"
                                ? "neutral"
                                : "ok"
                          }
                        >
                          {resolutionLabel(resolution)}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </Card>

          <Callout tone="info" title="No tax deducted does not mean no tax due">
            Banks only deduct tax once deposit interest crosses ₹50,000 in a year
            (₹1,00,000 for senior citizens), and never on savings interest. The
            income is taxable either way — the deduction is just a collection
            mechanism, not the tax itself.
          </Callout>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card tone="sunk">
            <CardHeader
              title="Income from other sources"
              eyebrow={<ComputedTag />}
            />
            <div className="px-4 py-3">
              <Row
                label="Savings interest"
                value={state.otherSources.savingsInterest}
              />
              <Row label="Deposit interest" value={state.otherSources.fdInterest} />
              <Row label="Dividends" value={state.otherSources.dividend} />
              <Row label="Other" value={state.otherSources.other} />
              <Row
                label="Total"
                value={current.incomeFromOtherSources}
                strong
              />
            </div>
            {state.regime === "old" && state.deductions.s80TTA > 0 ? (
              <div className="border-t border-line px-4 py-3">
                <Row
                  label={<Term name="Section 80TTA">80TTA deduction</Term>}
                  value={Math.min(state.deductions.s80TTA, LIMITS.s80TTA)}
                  negative
                  tone="ok"
                  note="claimed on the deductions screen"
                />
              </div>
            ) : null}
            <div className="border-t border-line px-4 py-3">
              <Row
                label="Tax credit from this head"
                value={current.tdsCredit - state.salary.tdsDeducted}
                note="only counted for entries you have accepted"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function resolutionLabel(resolution: string | undefined): string {
  switch (resolution) {
    case "accepted":
      return "In your return";
    case "amount-corrected":
      return "Corrected";
    case "other-pan":
      return "Another PAN";
    case "duplicate":
      return "Duplicate";
    case "denied":
      return "Disagreed";
    default:
      return "Needs a decision";
  }
}
