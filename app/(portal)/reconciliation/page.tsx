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
  MoneyInput,
  PageHeader,
  Row,
  Stat,
  Term,
  cx,
} from "@/components/ui";
import {
  aisEntries,
  buildTis,
  form26AS,
  totalTdsIn26AS,
  type AisEntry,
} from "@/lib/data/seed";
import { inr } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import {
  pendingMismatches,
  useAppStore,
  type MismatchResolution,
} from "@/lib/store/useAppStore";

type View = "reconcile" | "ais" | "tis" | "26as";

export default function ReconciliationPage() {
  const state = useAppStore();
  const { current } = useTax();
  const [view, setView] = useState<View>("reconcile");
  const pending = pendingMismatches(state);

  const declaredTotals = aisEntries.map((e) => ({
    id: e.id,
    aisAmount: e.aisAmount,
    declaredAmount:
      state.reconciliation[e.id]?.resolvedAmount ?? e.declaredAmount,
  }));
  const tis = buildTis(declaredTotals);

  const views: { id: View; label: string; count?: number }[] = [
    { id: "reconcile", label: "Reconcile", count: pending.length },
    { id: "ais", label: "AIS" },
    { id: "tis", label: "TIS" },
    { id: "26as", label: "26AS" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="The reconciliation"
        title="What they know, versus what you have said"
        intro="Three documents describe the same year from three angles. Rather than making you open them in three tabs and compare by eye, this puts every difference in one list with a decision attached."
        aside={
          <Badge tone={pending.length > 0 ? "warn" : "ok"}>
            {pending.length > 0
              ? `${pending.length} to settle`
              : "All settled"}
          </Badge>
        }
      />

      <Card tone={pending.length > 0 ? "alert" : "ok"}>
        <div className="grid grid-cols-2 gap-4 px-4 py-3.5 sm:grid-cols-4">
          <Stat
            label="Entries in AIS"
            value={aisEntries.length}
            tag={<DemoTag />}
          />
          <Stat
            label="Needing a decision"
            value={pending.length}
            tone={pending.length > 0 ? "alert" : "ok"}
          />
          <Stat
            label="Tax credit in 26AS"
            value={inr(totalTdsIn26AS)}
            tag={<DemoTag />}
          />
          <Stat
            label="Credit you are claiming"
            value={inr(current.tdsCredit)}
            tag={<ComputedTag />}
            tone={current.tdsCredit < totalTdsIn26AS ? "alert" : "ok"}
            hint={
              current.tdsCredit < totalTdsIn26AS
                ? `${inr(totalTdsIn26AS - current.tdsCredit)} left on the table`
                : "everything claimed"
            }
          />
        </div>
      </Card>

      {/* ---------------- view switcher ---------------- */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cx(
              "flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              view === v.id
                ? "border-[color:var(--pine)] bg-[color:var(--pine)] text-white"
                : "border-line-strong bg-surface text-ink-soft hover:bg-sunk",
            )}
          >
            {v.label}
            {v.count ? (
              <span
                className={cx(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  view === v.id
                    ? "bg-white/20 text-white"
                    : "bg-[color:var(--clay)] text-white",
                )}
              >
                {v.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "reconcile" ? <ReconcileView /> : null}
      {view === "ais" ? <AisView /> : null}
      {view === "tis" ? <TisView rows={tis} /> : null}
      {view === "26as" ? <Form26ASView /> : null}
    </div>
  );
}

/* ================================================================
   Reconcile — the actual product
   ================================================================ */

function ReconcileView() {
  const state = useAppStore();
  const pending = pendingMismatches(state);
  const settled = aisEntries.filter(
    (e) => state.reconciliation[e.id]?.resolution !== "pending",
  );

  return (
    <div className="space-y-5">
      {pending.length === 0 ? (
        <Callout tone="ok" title="Nothing left to argue about">
          Every entry the department holds against your PAN has been accepted,
          corrected, or sent back with feedback. This is the single best predictor
          of a return that processes without a query.
        </Callout>
      ) : (
        <Callout tone="warn" title="Why this matters more than it looks">
          The department&rsquo;s system compares your return against these figures
          automatically. Anything you leave out becomes an{" "}
          <Term name="Intimation u/s 143(1)">
            intimation under section 143(1)
          </Term>{" "}
          a few months later, usually with interest attached. Settling it now costs
          you two taps.
        </Callout>
      )}

      <div className="space-y-3">
        {pending.map((entry) => (
          <MismatchCard key={entry.id} entry={entry} />
        ))}
      </div>

      {settled.length > 0 ? (
        <Card tone="sunk">
          <CardHeader
            title="Already settled"
            eyebrow={`${settled.length} entries`}
          />
          <ul className="divide-y divide-[color:var(--line)]">
            {settled.map((entry) => {
              const r = state.reconciliation[entry.id];
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">
                      {entry.description}
                    </div>
                    <div className="truncate text-[11.5px] text-ink-faint">
                      {entry.source}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tnum text-[13px]">
                      {inr(r?.resolvedAmount ?? entry.aisAmount)}
                    </span>
                    <Badge tone={badgeToneFor(r?.resolution)}>
                      {resolutionLabel(r?.resolution)}
                    </Badge>
                    <button
                      onClick={() =>
                        state.resolveMismatch(entry.id, "pending" as MismatchResolution)
                      }
                      className="text-[11.5px] text-ink-faint underline underline-offset-2 hover:text-ink"
                    >
                      Undo
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function MismatchCard({ entry }: { entry: AisEntry }) {
  const resolveMismatch = useAppStore((s) => s.resolveMismatch);
  const [correcting, setCorrecting] = useState(false);
  const [amount, setAmount] = useState(entry.aisAmount);

  const gap = entry.aisAmount - entry.declaredAmount;

  return (
    <Card tone={entry.severity === "action" ? "alert" : "plain"}>
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={entry.severity === "action" ? "alert" : "warn"}>
                {entry.severity === "action" ? "Needs fixing" : "Worth checking"}
              </Badge>
              <span className="text-[11.5px] text-ink-faint">{entry.category}</span>
            </div>
            <h3 className="mt-1.5 text-[15.5px] font-semibold leading-snug">
              {entry.description}
            </h3>
            <p className="text-[12.5px] text-ink-faint">
              {entry.source}
              <DemoTag />
            </p>
          </div>
        </div>

        {/* the two numbers, side by side */}
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-sm)] border border-line bg-[color:var(--line)]">
          <div className="bg-surface px-3 py-2.5">
            <div className="eyebrow">They were told</div>
            <div className="tnum mt-0.5 font-display text-[19px] font-semibold">
              {inr(entry.aisAmount)}
            </div>
          </div>
          <div className="bg-surface px-3 py-2.5">
            <div className="eyebrow">You have declared</div>
            <div
              className={cx(
                "tnum mt-0.5 font-display text-[19px] font-semibold",
                gap !== 0 && "text-[color:var(--alert)]",
              )}
            >
              {inr(entry.declaredAmount)}
            </div>
          </div>
        </div>

        {gap !== 0 ? (
          <div className="mt-2 text-[12.5px] font-medium text-[color:var(--alert)]">
            {gap > 0
              ? `${inr(gap)} of income is missing from your return`
              : `${inr(-gap)} more declared than reported`}
            {entry.tdsDeducted > 0
              ? ` · ${inr(entry.tdsDeducted)} of tax credit you are not claiming`
              : ""}
          </div>
        ) : null}

        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
          {entry.plainLanguage}
        </p>

        {/* resolution options */}
        {correcting ? (
          <div className="mt-3 rounded-[var(--radius-sm)] border border-line bg-sunk p-3">
            <div className="mb-2 text-[12.5px] font-medium">
              What is the right figure?
            </div>
            <MoneyInput value={amount} onValueChange={setAmount} />
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  resolveMismatch(entry.id, "amount-corrected", "you", amount);
                  setCorrecting(false);
                }}
              >
                Use {inr(amount)}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCorrecting(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => resolveMismatch(entry.id, "accepted")}
            >
              {gap > 0
                ? `Add ${inr(entry.aisAmount)} to my return`
                : `Accept ${inr(entry.aisAmount)}`}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCorrecting(true)}
            >
              A different amount is right
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => resolveMismatch(entry.id, "other-pan")}
            >
              This is not mine
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => resolveMismatch(entry.id, "duplicate")}
            >
              Counted twice
            </Button>
          </div>
        )}

        <p className="mt-2.5 text-[11.5px] leading-snug text-ink-faint">
          Accepting adds the income to your return and claims the related tax
          credit. The other three send feedback to whoever reported it and keep the
          amount out of your income.
        </p>
      </div>
    </Card>
  );
}

/* ================================================================
   Raw document views
   ================================================================ */

function AisView() {
  const state = useAppStore();
  return (
    <Card>
      <CardHeader
        title="Annual Information Statement"
        eyebrow={<Term name="AIS">What is an AIS?</Term>}
        description="Every transaction reported against your PAN this year, by whoever reported it."
        action={<DemoTag label="synthetic" />}
      />
      <ul className="divide-y divide-[color:var(--line)]">
        {aisEntries.map((entry) => {
          const r = state.reconciliation[entry.id];
          return (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">
                    {entry.description}
                  </div>
                  <div className="text-[12px] text-ink-faint">
                    {entry.source} · PAN {entry.sourcePan}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tnum text-[14px] font-semibold">
                    {inr(entry.aisAmount)}
                  </div>
                  {entry.tdsDeducted > 0 ? (
                    <div className="tnum text-[11.5px] text-ink-faint">
                      {inr(entry.tdsDeducted)} deducted
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-1.5">
                <Badge tone={badgeToneFor(r?.resolution)}>
                  {resolutionLabel(r?.resolution)}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TisView({
  rows,
}: {
  rows: ReturnType<typeof buildTis>;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Taxpayer Information Summary"
          eyebrow={<Term name="TIS">What is a TIS?</Term>}
          description="The AIS collapsed to one line per head of income. The derived value is what flows into your prefilled return."
          action={<DemoTag label="synthetic" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-2 font-medium text-ink-faint">Head</th>
                <th className="px-4 py-2 text-right font-medium text-ink-faint">
                  Reported
                </th>
                <th className="px-4 py-2 text-right font-medium text-ink-faint">
                  Processed
                </th>
                <th className="px-4 py-2 text-right font-medium text-ink-faint">
                  Derived
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium">{row.head}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-soft">
                    {inr(row.reportedValue)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-soft">
                    {inr(row.processedValue)}
                  </td>
                  <td
                    className={cx(
                      "tnum px-4 py-2.5 text-right font-semibold",
                      row.feedbackApplied && "text-[color:var(--pine)]",
                    )}
                  >
                    {inr(row.derivedValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Callout tone="info" title="Why there are three columns">
        Reported is the raw sum of what third parties said. Processed is after the
        department removes duplicates — the same interest reported by both the bank
        and its head office, for instance. Derived is after your feedback is taken
        into account, and it is the only one of the three that ends up in your
        return. It moves as you settle entries on the reconcile tab.
      </Callout>
    </div>
  );
}

function Form26ASView() {
  const state = useAppStore();
  const { current } = useTax();
  const claimed = current.tdsCredit;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Form 26AS"
          eyebrow={<Term name="Form 26AS">What is 26AS?</Term>}
          description="Tax already deposited against your PAN. You can only claim credit for what appears here."
          action={<DemoTag label="synthetic" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-2 font-medium text-ink-faint">Section</th>
                <th className="px-4 py-2 font-medium text-ink-faint">Deductor</th>
                <th className="px-4 py-2 text-right font-medium text-ink-faint">
                  Amount paid
                </th>
                <th className="px-4 py-2 text-right font-medium text-ink-faint">
                  Tax deducted
                </th>
              </tr>
            </thead>
            <tbody>
              {form26AS.map((row) => (
                <tr key={row.id} className="border-b border-line">
                  <td className="mono px-4 py-2.5 text-[12px]">{row.section}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{row.deductor}</div>
                    <div className="mono text-[11px] text-ink-faint">
                      {row.deductorTan} · {row.quarter}
                    </div>
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-soft">
                    {inr(row.amountPaid)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold">
                    {inr(row.taxDeducted)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3">
          <Row label="Total credit available" value={totalTdsIn26AS} />
          <Row
            label="Credit you are currently claiming"
            value={claimed}
            tone={claimed < totalTdsIn26AS ? "alert" : "ok"}
            note={
              claimed < totalTdsIn26AS
                ? "Credit follows the income — accept an AIS entry and its tax credit comes with it"
                : undefined
            }
            strong
          />
        </div>
      </Card>

      {claimed < totalTdsIn26AS ? (
        <Callout tone="warn" title="You are leaving money behind">
          {inr(totalTdsIn26AS - claimed)} of tax has already been paid to the
          government in your name, and you are not claiming it. That happens
          because credit only travels with income you have actually offered to tax
          — settle the pending entries on the reconcile tab and it comes back.
        </Callout>
      ) : null}

      {state.filing.paymentDone ? (
        <Callout tone="ok" title="Self-assessment tax">
          Your challan {state.filing.paymentChallan} would appear in Part C of a
          real 26AS within three to four working days of payment.
        </Callout>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function resolutionLabel(resolution: string | undefined): string {
  switch (resolution) {
    case "accepted":
      return "Accepted";
    case "amount-corrected":
      return "Corrected";
    case "other-pan":
      return "Not mine";
    case "duplicate":
      return "Duplicate";
    case "denied":
      return "Disagreed";
    default:
      return "Pending";
  }
}

function badgeToneFor(
  resolution: string | undefined,
): "ok" | "warn" | "neutral" | "info" {
  switch (resolution) {
    case "accepted":
      return "ok";
    case "amount-corrected":
      return "info";
    case "pending":
    case undefined:
      return "warn";
    default:
      return "neutral";
  }
}
