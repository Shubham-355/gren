"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ComputedTag,
  DemoTag,
  EmptyState,
  Field,
  MoneyInput,
  PageHeader,
  Row,
  Term,
  Toggle,
  cx,
} from "@/components/ui";
import { form16, rentDetails } from "@/lib/data/seed";
import { inr, shortDate } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";
import type { SalaryInput } from "@/lib/tax/compute";

const fields: {
  key: keyof SalaryInput;
  label: string;
  hint?: string;
}[] = [
  { key: "basic", label: "Basic salary", hint: "Most other limits are a percentage of this" },
  { key: "hra", label: "House rent allowance" },
  { key: "specialAllowance", label: "Special allowance" },
  { key: "lta", label: "Leave travel allowance" },
  { key: "otherAllowances", label: "Other allowances" },
  {
    key: "employerNps",
    label: "Employer contribution to NPS",
    hint: "Deductible under 80CCD(2) in both regimes — the only big one that survives the new regime",
  },
];

export default function SalaryPage() {
  const state = useAppStore();
  const { current, hra } = useTax();
  const [manual, setManual] = useState(false);

  if (!state.form16Imported && !manual) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Income · Salary"
          title="Start with your Form 16"
          intro="Your employer already told the department everything on this page. Rather than making you retype it, bring it in and correct anything that looks wrong."
        />

        <Card>
          <CardHeader
            title="Form 16 available for import"
            eyebrow="Found against your PAN"
            action={<Badge tone="ok">Ready</Badge>}
          />
          <div className="space-y-3 px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Employer" value={form16.employer.name} demo />
              <KeyValue label="TAN" value={form16.employer.tan} demo mono />
              <KeyValue
                label="Certificate number"
                value={form16.certificateNumber}
                demo
                mono
              />
              <KeyValue
                label="Issued"
                value={shortDate(form16.issuedOn)}
                demo
              />
            </div>
            <div className="rounded-[var(--radius-sm)] border border-line bg-sunk px-3.5 py-3">
              <Row
                label="Gross salary as per Part B"
                value={
                  form16.salary.basic +
                  form16.salary.hra +
                  form16.salary.specialAllowance +
                  form16.salary.lta +
                  form16.salary.employerNps
                }
              />
              <Row label="Tax already deducted" value={form16.tdsDeducted} />
            </div>
            <Button block size="lg" onClick={() => state.importForm16()}>
              Import this Form 16
            </Button>
            <button
              onClick={() => setManual(true)}
              className="w-full text-[13px] text-ink-faint hover:text-ink-soft"
            >
              I would rather enter it myself
            </button>
          </div>
        </Card>

        <Callout tone="info" title="What gets filled in">
          Basic, HRA, allowances, your employer&rsquo;s NPS contribution,
          professional tax and the tax already deducted. Nothing about deductions
          you claim yourself — those come later, and you are not bound by whatever
          you declared to your employer during the year.
        </Callout>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Income · Salary"
        title="Salary"
        intro="Everything here came from your Form 16 and can be edited. The figures on the right update as you type, everywhere on the platform."
        aside={
          state.form16Imported ? (
            <Badge tone="ok">Form 16 imported</Badge>
          ) : (
            <Badge tone="warn">Entered manually</Badge>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Salary breakup"
              eyebrow={state.form16Imported ? "From Form 16 Part B" : "Manual entry"}
              description={state.form16Imported ? form16.employer.name : undefined}
            />
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              {fields.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <MoneyInput
                    value={state.salary[f.key] as number}
                    onValueChange={(v) => state.setSalaryField(f.key, v)}
                  />
                </Field>
              ))}
              <Field
                label="Professional tax"
                hint="Deductible only under the old regime"
              >
                <MoneyInput
                  value={state.salary.professionalTax}
                  onValueChange={(v) => state.setSalaryField("professionalTax", v)}
                />
              </Field>
              <Field
                label="Tax deducted by employer"
                hint="Should match the 192B entry in your Form 26AS"
              >
                <MoneyInput
                  value={state.salary.tdsDeducted}
                  onValueChange={(v) => state.setSalaryField("tdsDeducted", v)}
                />
              </Field>
            </div>
          </Card>

          {/* ------------------- HRA ------------------- */}
          <Card>
            <CardHeader
              title={<>House rent allowance</>}
              eyebrow="Exemption under section 10(13A)"
              action={
                <Badge tone={state.regime === "old" ? "ok" : "neutral"}>
                  {state.regime === "old" ? "In effect" : "Old regime only"}
                </Badge>
              }
            />
            <div className="space-y-4 px-4 py-4">
              <Toggle
                checked={state.hra.claiming}
                onChange={(v) => state.setHra({ claiming: v })}
                label="I pay rent and want to claim HRA"
                description="You need rent receipts, and your landlord's PAN if annual rent crosses ₹1,00,000."
              />

              {state.hra.claiming ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Rent paid for the year"
                      hint={`${rentDetails.monthlyRent.toLocaleString("en-IN")} a month × ${rentDetails.monthsPaid} months`}
                    >
                      <MoneyInput
                        value={state.hra.rentPaidAnnual}
                        onValueChange={(v) => state.setHra({ rentPaidAnnual: v })}
                      />
                    </Field>
                    <div className="pt-6">
                      <Toggle
                        checked={state.hra.metroCity}
                        onChange={(v) => state.setHra({ metroCity: v })}
                        label="I live in a metro"
                        description="Only Delhi, Mumbai, Kolkata and Chennai count. Bengaluru, Pune and Hyderabad do not."
                      />
                    </div>
                  </div>

                  <div className="rounded-[var(--radius-sm)] border border-line bg-sunk px-3.5 py-3">
                    <div className="eyebrow mb-1">
                      The exemption is the smallest of these three
                      <ComputedTag />
                    </div>
                    {hra.legs.map((leg, i) => (
                      <div
                        key={leg.label}
                        className={cx(
                          "flex items-baseline justify-between gap-3 py-1.5 text-[13px]",
                          i === hra.winnerIndex
                            ? "font-semibold text-[color:var(--pine-ink)]"
                            : "text-ink-soft",
                        )}
                      >
                        <span>
                          {i === hra.winnerIndex ? "→ " : ""}
                          {leg.label}
                        </span>
                        <span className="tnum">{inr(leg.amount)}</span>
                      </div>
                    ))}
                    <Row
                      label="HRA exempt from tax"
                      value={
                        state.regime === "old" ? hra.exemption : 0
                      }
                      strong
                      tone={state.regime === "old" ? "ok" : "muted"}
                      note={
                        state.regime === "new"
                          ? "Set to zero because you are on the new regime, where HRA is not exempt"
                          : undefined
                      }
                    />
                  </div>

                  <Callout tone="info">{rentDetails.note}</Callout>
                </>
              ) : null}
            </div>
          </Card>
        </div>

        {/* ------------------- live summary ------------------- */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card tone="sunk">
            <CardHeader
              title="Income from salary"
              eyebrow={`${state.regime} regime`}
            />
            <div className="px-4 py-3">
              <Row label="Gross salary" value={current.grossSalary} />
              <Row
                label="HRA exempt"
                value={current.hraExemption}
                negative
                indent
                note={
                  state.regime === "new" ? "not available in the new regime" : undefined
                }
              />
              <Row
                label={<Term name="Standard deduction">Standard deduction</Term>}
                value={current.standardDeduction}
                negative
                indent
                note={state.regime === "new" ? "₹75,000 in the new regime" : "₹50,000 in the old regime"}
              />
              <Row
                label="Professional tax"
                value={current.professionalTax}
                negative
                indent
              />
              <Row
                label="Income from salary"
                value={current.incomeFromSalary}
                strong
              />
            </div>
            <div className="border-t border-line px-4 py-3">
              <Row
                label="Tax already deducted"
                value={state.salary.tdsDeducted}
                note="claimed as credit against your final bill"
              />
            </div>
          </Card>
        </div>
      </div>

      {!state.form16Imported ? (
        <EmptyState
          title="Still want the Form 16?"
          body="You can import the synthetic Form 16 at any point — it will overwrite what you have typed."
          action={<Button onClick={() => state.importForm16()}>Import Form 16</Button>}
        />
      ) : null}
    </div>
  );
}

function KeyValue({
  label,
  value,
  demo,
  mono,
}: {
  label: string;
  value: string;
  demo?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={cx("mt-0.5 text-[13.5px] text-ink", mono && "mono text-[12.5px]")}>
        {value}
        {demo ? <DemoTag /> : null}
      </div>
    </div>
  );
}
