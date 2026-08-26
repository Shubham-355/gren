"use client";

import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ChoiceGroup,
  ComputedTag,
  DemoTag,
  Field,
  MoneyInput,
  PageHeader,
  Row,
  Term,
  TextInput,
  Toggle,
} from "@/components/ui";
import { housePropertySeed } from "@/lib/data/seed";
import { inr } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";
import { LIMITS } from "@/lib/tax/constants";

export default function HousePropertyPage() {
  const state = useAppStore();
  const { houseProperty, current } = useTax();
  const hp = state.houseProperty;
  const letOut = hp.type === "let-out";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Income · House property"
        title="A house you own"
        intro="Whether you live in it or rent it out changes everything. A let-out property is taxed on the rent but allows the full loan interest; a self-occupied one has no income but caps the interest at ₹2,00,000 — and only under the old regime."
        aside={
          <Badge tone={hp.enabled ? "ok" : "neutral"}>
            {hp.enabled ? "Declared" : "Not declared"}
          </Badge>
        }
      />

      <Card>
        <div className="px-4 py-4">
          <Toggle
            checked={hp.enabled}
            onChange={(v) => state.setHouseProperty({ enabled: v })}
            label="I own a house property"
            description="Include it even if it makes a loss — especially if it makes a loss, since that loss can reduce the tax on your salary."
          />
        </div>
      </Card>

      {hp.enabled ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-5">
            <Card>
              <CardHeader title="The property" eyebrow="Details" />
              <div className="space-y-4 px-4 py-4">
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">
                    How is it used?
                  </span>
                  <ChoiceGroup
                    value={hp.type}
                    onChange={(v) =>
                      state.setHouseProperty({
                        type: v as "self-occupied" | "let-out",
                      })
                    }
                    options={[
                      { value: "self-occupied", label: "I live in it" },
                      { value: "let-out", label: "It is rented out" },
                    ]}
                  />
                </div>

                <Field label="Address">
                  <TextInput
                    value={hp.address}
                    onChange={(e) =>
                      state.setHouseProperty({ address: e.target.value })
                    }
                  />
                </Field>

                {letOut ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Rent received for the year"
                      hint={`${housePropertySeed.monthlyRent.toLocaleString("en-IN")} a month`}
                    >
                      <MoneyInput
                        value={hp.annualRentReceived}
                        onValueChange={(v) =>
                          state.setHouseProperty({ annualRentReceived: v })
                        }
                      />
                    </Field>
                    <Field
                      label="Municipal taxes you paid"
                      hint="Only what you actually paid during the year, not what was billed"
                    >
                      <MoneyInput
                        value={hp.municipalTaxesPaid}
                        onValueChange={(v) =>
                          state.setHouseProperty({ municipalTaxesPaid: v })
                        }
                      />
                    </Field>
                    <Field label="Tenant name">
                      <TextInput
                        value={hp.tenantName}
                        onChange={(e) =>
                          state.setHouseProperty({ tenantName: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                ) : null}

                <Field
                  label="Interest paid on the housing loan"
                  hint={
                    letOut
                      ? "No ceiling for a let-out property — claim the whole year's interest"
                      : `Capped at ${inr(LIMITS.homeLoanInterestSelfOccupied)} for a self-occupied house`
                  }
                >
                  <MoneyInput
                    value={hp.homeLoanInterest}
                    onValueChange={(v) =>
                      state.setHouseProperty({ homeLoanInterest: v })
                    }
                  />
                </Field>

                {!letOut ? (
                  <Callout tone="warn" title="Careful if you also claim HRA">
                    Claiming HRA on a rented home and self-occupied interest on a
                    house in the same city invites questions. It is allowed when the
                    facts support it — your own house is genuinely too far to live
                    in, or it is let out — but be ready to explain it.
                  </Callout>
                ) : null}

                <Callout tone="plum" title="The principal is claimed elsewhere">
                  Only interest belongs on this page. The principal portion of your
                  EMI —{" "}
                  <span className="tnum">
                    {inr(housePropertySeed.homeLoanPrincipal)}
                  </span>{" "}
                  <DemoTag /> — is a{" "}
                  <Term name="Section 80C">80C</Term> deduction and lives on the
                  deductions screen.
                </Callout>
              </div>
            </Card>
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card tone="sunk">
              <CardHeader
                title="How it is computed"
                eyebrow={
                  <>
                    Sections 22 to 24 <ComputedTag />
                  </>
                }
              />
              <div className="px-4 py-3">
                {houseProperty.steps.map((step) => (
                  <Row
                    key={step.label}
                    label={step.label}
                    value={step.amount}
                    negative={step.negative}
                    note={step.note}
                    indent={step.negative}
                  />
                ))}
                <Row
                  label={
                    houseProperty.income < 0
                      ? "Loss from house property"
                      : "Income from house property"
                  }
                  value={Math.abs(houseProperty.income)}
                  strong
                  tone={houseProperty.income < 0 ? "alert" : undefined}
                />
              </div>

              {houseProperty.income < 0 ? (
                <div className="border-t border-line px-4 py-3">
                  <Callout tone="ok" title="A loss here is worth money">
                    This loss is set off against your salary, so it reduces the
                    income you are taxed on by{" "}
                    <span className="tnum font-medium">
                      {inr(Math.abs(houseProperty.income))}
                    </span>
                    .{" "}
                    <Term name="Set-off and carry forward">
                      Set-off is capped at ₹2,00,000 a year
                    </Term>
                    {houseProperty.setOffCapped
                      ? `, and you have hit that cap — ${inr(Math.abs(houseProperty.rawIncome) - Math.abs(houseProperty.income))} carries forward to next year.`
                      : "."}
                  </Callout>
                </div>
              ) : null}

              {state.regime === "new" && hp.type === "self-occupied" ? (
                <div className="border-t border-line px-4 py-3">
                  <Callout tone="warn">
                    Under the new regime, interest on a self-occupied house is not
                    deductible at all. Switching to the old regime is the only way
                    to use it.
                  </Callout>
                </div>
              ) : null}

              <div className="border-t border-line px-4 py-3">
                <Row
                  label="Gross total income, all heads"
                  value={current.grossTotalIncome}
                  strong
                />
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <Callout tone="info" title="Nothing to declare here?">
          If you do not own property, skip this. If you own one but live in it and
          have no home loan, there is still nothing to declare — a self-occupied
          house with no loan produces no income and no deduction.
        </Callout>
      )}
    </div>
  );
}
