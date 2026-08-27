"use client";

import Link from "next/link";
import { useState } from "react";

import { FlowActionBar, PhoneStepHeader } from "@/components/shell/StepRail";
import {
  Badge,
  Button,
  Callout,
  Card,
  LinkButton,
  Term,
  Toggle,
  cx,
} from "@/components/ui";
import { InlineMoneyRow, MoneyField } from "@/components/ui/InlineMoney";
import { form16, rentDetails } from "@/lib/data/seed";
import { inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";
import type { SalaryInput } from "@/lib/tax/compute";

/**
 * Step 3 — Income review.
 *
 * Prefilled from Form 16, in plain language, every line editable in place.
 * Cards, not a form: nothing here is a label above an empty box.
 */

const salaryLines: {
  key: keyof SalaryInput;
  label: string;
  note?: React.ReactNode;
}[] = [
  { key: "basic", label: "Basic salary" },
  { key: "hra", label: "House rent allowance" },
  { key: "specialAllowance", label: "Special allowance" },
  { key: "lta", label: "Leave travel allowance" },
  { key: "otherAllowances", label: "Other allowances" },
  {
    key: "employerNps",
    label: "Employer’s NPS",
    note: (
      <>
        Counts in both regimes, under <Term name="80CCD(2)">80CCD(2)</Term>
      </>
    ),
  },
];

export default function SalaryPage() {
  const state = useAppStore();
  const { current, hra } = useTax();
  const [manual, setManual] = useState(false);

  if (!state.form16Imported && !manual) {
    return <ImportGate onManual={() => setManual(true)} />;
  }

  const grossSalary = salaryLines.reduce(
    (sum, l) => sum + (state.salary[l.key] as number),
    0,
  );

  return (
    <div>
      <PhoneStepHeader back={{ href: "/dashboard" }} />

      <div className="grid gap-9 lg:grid-cols-[1fr_20rem] lg:gap-10 [&>*]:min-w-0">
        <div>
          <h1 className="font-display text-[32px] leading-[1.1] tracking-[-0.01em] sm:text-[46px] sm:leading-[1.05]">
            Here is what your employer already told them
          </h1>
          <p className="mt-3.5 max-w-[44rem] text-[15px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[16px]">
            Straight from your Form 16. Change anything wrong and every figure
            moves with it.
          </p>

          <div className="mt-7 grid items-start gap-5 xl:grid-cols-2">
            {/* ------------------------- salary ------------------------- */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-sunk px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">Salary</div>
                  <div className="mono text-[11.5px] leading-snug text-ink-faint">
                    {form16.employer.name}
                    <br />
                    TAN {form16.employer.tan}
                  </div>
                </div>
                <Badge tone={state.form16Imported ? "ok" : "warn"}>
                  {state.form16Imported ? "Imported" : "Manual"}
                </Badge>
              </div>

              {salaryLines.map((l) => (
                <InlineMoneyRow
                  key={l.key}
                  label={l.label}
                  note={l.note}
                  value={state.salary[l.key] as number}
                  onValueChange={(v) => state.setSalaryField(l.key, v)}
                />
              ))}
              <InlineMoneyRow
                label="Professional tax"
                note="Deductible only under the old regime"
                value={state.salary.professionalTax}
                onValueChange={(v) => state.setSalaryField("professionalTax", v)}
              />
              <InlineMoneyRow label="Gross salary" value={grossSalary} readOnly emphasis />
            </Card>

            <div className="space-y-5">
              {/* ------------------------- HRA ------------------------- */}
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[15px] font-semibold">Rent you paid</div>
                  <Badge tone={state.regime === "old" ? "ok" : "plum"}>
                    {state.regime === "old" ? "In effect" : "Old regime only"}
                  </Badge>
                </div>

                <div className="mt-3">
                  <Toggle
                    checked={state.hra.claiming}
                    onChange={(v) => state.setHra({ claiming: v })}
                    label="I pay rent and want to claim HRA"
                    description="You need rent receipts, and your landlord’s PAN if annual rent crosses ₹1,00,000."
                  />
                </div>

                {state.hra.claiming ? (
                  <>
                    <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                      {inr(rentDetails.monthlyRent)} a month for{" "}
                      {rentDetails.monthsPaid} months in {rentDetails.city}.{" "}
                      {rentDetails.city} is not a metro for{" "}
                      <Term name="HRA">HRA</Term>, so the exemption is capped at
                      40% of basic rather than 50%.
                    </p>

                    <div className="mt-3.5 rounded-[var(--radius-sm)] bg-paper px-4 py-3.5">
                      {hra.legs.map((leg, i) => (
                        <div
                          key={leg.label}
                          className={cx(
                            "flex items-baseline justify-between gap-3 py-[3px] text-[13.5px]",
                            i === hra.winnerIndex
                              ? "font-semibold text-ink"
                              : "text-ink-soft",
                          )}
                        >
                          <span>{leg.label}</span>
                          <span className="tnum">{inr(leg.amount)}</span>
                        </div>
                      ))}
                      <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line pt-2 text-[14px] font-semibold">
                        <span>
                          {state.regime === "old" ? (
                            "Exempt — the smallest of the three"
                          ) : (
                            <>
                              Exempt right now
                              <span className="ml-1.5 font-normal text-ink-faint">
                                the new regime allows no HRA
                              </span>
                            </>
                          )}
                        </span>
                        <span className="tnum">
                          {inr(state.regime === "old" ? hra.exemption : 0)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center gap-4">
                      <span className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
                        <span>Rent for the year</span>
                        <MoneyField
                          value={state.hra.rentPaidAnnual}
                          onValueChange={(v) =>
                            state.setHra({ rentPaidAnnual: v })
                          }
                          label="Rent paid for the year"
                          size="sm"
                        />
                      </span>
                      <button
                        onClick={() => state.setHra({ metroCity: !state.hra.metroCity })}
                        className="tap text-[13px] font-medium text-[color:var(--plum)] underline underline-offset-2"
                      >
                        {state.hra.metroCity
                          ? "Treating this as a metro — change"
                          : "Not a metro — change"}
                      </button>
                    </div>
                  </>
                ) : null}
              </Card>

              {/* ------------------ other income declared ------------------ */}
              <Card className="p-5">
                <div className="text-[15px] font-semibold">
                  Other income you have declared
                </div>
                <div className="mt-3 space-y-1">
                  <MiniRow
                    label="Savings interest · Meridian Bank"
                    value={state.otherSources.savingsInterest}
                  />
                  <MiniRow
                    label="Fixed deposit interest"
                    value={state.otherSources.fdInterest}
                  />
                  <MiniRow
                    label="Dividend · Helios Industries"
                    value={state.otherSources.dividend}
                  />
                </div>
                <div className="mt-3">
                  <Callout tone="warn">
                    Your AIS lists more than this. The next step puts the
                    differences side by side.
                  </Callout>
                </div>
                <Link
                  href="/income/other-sources"
                  className="tap mt-3 inline-block border-b border-[color:var(--plum)] text-[13.5px] font-medium text-[color:var(--plum)]"
                >
                  Edit other sources
                </Link>
              </Card>
            </div>
          </div>
        </div>

        {/* --------------------------- live summary --------------------------- */}
        <div className="lg:sticky lg:top-[124px] lg:self-start">
          <Card className="p-5 sm:p-[22px]">
            <div className="eyebrow">Income from salary</div>
            <div className="tnum mt-2 font-display text-[42px] leading-none">
              {inr(current.incomeFromSalary)}
            </div>

            <div className="mt-4 space-y-0.5">
              <SummaryRow label="Gross salary" value={inr(current.grossSalary)} />
              <SummaryRow
                label={
                  <Term name="Standard deduction">Standard deduction</Term>
                }
                value={`− ${inr(current.standardDeduction)}`}
              />
              <SummaryRow
                label={
                  <>
                    HRA exemption{" "}
                    <span className="text-[12px] text-ink-faint">
                      ({state.regime} regime)
                    </span>
                  </>
                }
                value={
                  current.hraExemption > 0 ? `− ${inr(current.hraExemption)}` : "₹0"
                }
                muted={current.hraExemption === 0}
              />
              <SummaryRow
                label={
                  <>
                    Professional tax
                    {current.professionalTax === 0 && state.salary.professionalTax > 0 ? (
                      <span className="text-[12px] text-ink-faint"> (new regime)</span>
                    ) : null}
                  </>
                }
                value={
                  current.professionalTax > 0
                    ? `− ${inr(current.professionalTax)}`
                    : "₹0"
                }
                muted={current.professionalTax === 0}
              />
            </div>

            <p className="mt-3.5 border-t border-line pt-3.5 text-[13px] leading-relaxed text-ink-faint">
              {state.regime === "new"
                ? "On the new regime you get a bigger standard deduction but no HRA. The regime step compares both properly."
                : "On the old regime HRA is exempt but the standard deduction is smaller. The regime step compares both properly."}
            </p>
          </Card>

          <div className="mt-3.5 hidden lg:block">
            <LinkButton href="/reconciliation" block size="lg">
              This is correct — continue
            </LinkButton>
            <p className="mt-3 text-center text-[13.5px] text-ink-soft">
              or{" "}
              <Link
                href="/income"
                className="border-b border-[color:var(--plum)] text-[color:var(--plum)]"
              >
                add income from another source
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <FlowActionBar
          summary={{
            label: "Income from salary",
            value: inr(current.incomeFromSalary),
          }}
        >
          <LinkButton href="/reconciliation" block size="lg">
            This is correct — continue
          </LinkButton>
        </FlowActionBar>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function ImportGate({ onManual }: { onManual: () => void }) {
  const importForm16 = useAppStore((s) => s.importForm16);
  const gross =
    form16.salary.basic +
    form16.salary.hra +
    form16.salary.specialAllowance +
    form16.salary.lta +
    form16.salary.otherAllowances +
    form16.salary.employerNps;

  return (
    <div>
      <PhoneStepHeader back={{ href: "/dashboard" }} />
      <div className="mx-auto max-w-[38rem]">
        <h1 className="font-display text-[32px] leading-[1.1] tracking-[-0.01em] sm:text-[46px] sm:leading-[1.05]">
          Start with your Form 16
        </h1>
        <p className="mt-3.5 text-[15px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[16px]">
          Your employer already told the department all of this. Bring it in
          rather than retyping it.
        </p>

        <Card className="mt-7 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-sunk px-5 py-4">
            <div>
              <div className="text-[15px] font-semibold">
                {form16.employer.name}
              </div>
              <div className="mono mt-0.5 text-[11.5px] text-ink-faint">
                TAN {form16.employer.tan} · issued {shortDate(form16.issuedOn)}
              </div>
            </div>
            <Badge tone="ok">Ready</Badge>
          </div>
          <InlineMoneyRow label="Gross salary as per Part B" value={gross} readOnly />
          <InlineMoneyRow
            label="Tax already deducted"
            note="Matches the 192B entry in your 26AS"
            value={form16.tdsDeducted}
            readOnly
          />
          <div className="px-5 py-5">
            <Button block size="lg" onClick={() => importForm16()}>
              Import this Form 16
            </Button>
            <button
              onClick={onManual}
              className="mt-3 w-full text-[13.5px] text-ink-faint hover:text-ink-soft"
            >
              I would rather enter it myself
            </button>
          </div>
        </Card>

        <div className="mt-5">
          <Callout tone="info" title="What gets filled in" collapsible>
            Basic, HRA, allowances, your employer&rsquo;s NPS contribution,
            professional tax and the tax already deducted. Nothing about
            deductions you claim yourself — those come later, and you are not
            bound by whatever you declared to your employer during the year.
          </Callout>
        </div>
      </div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[14px]">
      <span className="text-ink-soft">{label}</span>
      <span className="tnum">{inr(value)}</span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: React.ReactNode;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-baseline justify-between gap-3 py-1.5 text-[14px]",
        muted ? "text-ink-faint" : "text-ink-soft",
      )}
    >
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
