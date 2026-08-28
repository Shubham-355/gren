"use client";

import { useMemo, useState } from "react";

import { FlowActionBar, PhoneStepHeader } from "@/components/shell/StepRail";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  LinkButton,
  MoneyInput,
  Row,
  Term,
  cx,
} from "@/components/ui";
import {
  buildTis,
  type AisEntry,
} from "@/lib/data/seed";
import { Expandable } from "@/components/ui/Expandable";
import { inr } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import {
  aisStatus,
  declaredFor,
  pendingMismatches,
  returnHasIncome,
  visible26AS,
  visibleAisEntries,
  visibleTdsIn26AS,
  toTaxpayerInput,
  useAppStore,
  type AppState,
  type MismatchResolution,
} from "@/lib/store/useAppStore";
import { computeTax } from "@/lib/tax/compute";

/**
 * Step 4 — Reconciliation.
 *
 * Every difference gets a sentence saying what happened and what it costs, and
 * one-tap resolutions. Settling a single difference is a quick choice, not a
 * conversation — so these stay buttons even when the copilot is the one being
 * asked to do it (§5.5).
 *
 * The happy path keeps its own visible "everything matches" state rather than
 * quietly rendering an empty list.
 */

type View = "reconcile" | "ais" | "tis" | "26as";

export default function ReconciliationPage() {
  const state = useAppStore();
  const { current } = useTax();
  const [view, setView] = useState<View>("reconcile");
  const pending = pendingMismatches(state);

  const entries = visibleAisEntries(state);
  const totalTdsIn26AS = visibleTdsIn26AS(state);

  const declaredTotals = entries.map((e) => ({
    id: e.id,
    aisAmount: e.aisAmount,
    declaredAmount: declaredFor(state, e.id),
  }));
  const tis = buildTis(declaredTotals);

  /** What the return would look like if every open entry were accepted. */
  const projected = useMemo(() => projectSettleAll(state), [state]);

  // Three different things, and only the middle one is a decision you made.
  const agreeing = entries.filter((e) => aisStatus(state, e) === "agrees");
  const settled = entries.filter((e) => aisStatus(state, e) === "settled");
  const informational = entries.filter(
    (e) => aisStatus(state, e) === "informational",
  );
  const accountedFor = [...agreeing, ...settled, ...informational];

  /* ---------------------- the raw reference documents ------------------- */
  if (view !== "reconcile") {
    return (
      <div>
        <PhoneStepHeader back={{ href: "/income/salary" }} />
        <button
          onClick={() => setView("reconcile")}
          className="mb-5 flex items-center gap-1.5 text-[13.5px] font-medium text-[color:var(--plum)]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to the differences
        </button>

        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {(["ais", "tis", "26as"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cx(
                "shrink-0 rounded-[var(--radius-pill)] border px-4 py-2 text-[13px] font-medium transition-colors",
                view === v
                  ? "border-[color:var(--plum)] bg-[color:var(--plum)] text-white"
                  : "border-line-strong bg-surface text-ink-soft hover:bg-sunk",
              )}
            >
              {v === "26as" ? "26AS" : v.toUpperCase()}
            </button>
          ))}
        </div>

        {view === "ais" ? <AisView /> : null}
        {view === "tis" ? <TisView rows={tis} /> : null}
        {view === "26as" ? <Form26ASView /> : null}
      </div>
    );
  }

  /* -------------------------- everything matches ------------------------ */
  if (pending.length === 0) {
    return (
      <div>
        <PhoneStepHeader back={{ href: "/income/salary" }} />

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-9 [&>*]:min-w-0">
          <div className="space-y-4">
            <Card tone="ok" className="p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--ok)] text-white">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5 10 17l9-10" />
                </svg>
              </span>
              <h1 className="mt-3.5 font-display text-[32px] leading-[1.1] sm:text-[38px]">
                {entries.length === 0
                  ? "There is nothing to reconcile"
                  : "Everything matches"}
              </h1>
              <p className="mt-2.5 max-w-[36rem] text-[14.5px] leading-relaxed text-ink-soft">
                {entries.length === 0 ? (
                  <>
                    No AIS, TIS or 26AS entries are held against this PAN, so
                    there is nothing to check your return against. On a return
                    with documents behind it, this is the step that catches the
                    interest and dividends you had forgotten — and the one whose
                    loose ends turn into a notice three months later.
                  </>
                ) : (
                  <>
                    All {entries.length} entries the department holds against
                    your PAN are now accounted for. This is the single best
                    predictor of a return that processes without a query.
                  </>
                )}
              </p>
              {entries.length === 0 ? <LoadSampleDocuments /> : null}
            </Card>

            <Card className="overflow-hidden">
              {accountedFor.map((entry) => {
                const r = state.reconciliation[entry.id];
                const status = aisStatus(state, entry);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 border-b border-[color:var(--surface-sunk)] px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">
                        {entry.description}
                      </div>
                      <div className="truncate text-[12px] text-ink-faint">
                        {entry.source}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tnum text-[14px] font-medium">
                        {inr(declaredFor(state, entry.id))}
                      </div>
                      {status === "settled" ? (
                        <button
                          onClick={() =>
                            state.resolveMismatch(
                              entry.id,
                              "pending" as MismatchResolution,
                            )
                          }
                          className={cx(
                            "text-[11.5px] font-semibold",
                            outcomeTone(r?.resolution),
                          )}
                          title="Reopen this entry"
                        >
                          {outcomeLabel(r?.resolution, declaredFor(state, entry.id), entry.aisAmount)}
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-ink-faint">
                          {status === "informational"
                            ? "Not income"
                            : "Agrees with your return"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card className={cx("p-4", entries.length === 0 && "hidden")}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] text-ink-soft">
                  Tax credit now claimed
                </span>
                <span className="tnum text-[17px] font-semibold text-[color:var(--ok)]">
                  {inr(current.tdsCredit)}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
                {current.tdsCredit >= totalTdsIn26AS
                  ? "All of it. Credit follows the income, so accepting the entries brought their tax credit back with them."
                  : `${inr(totalTdsIn26AS - current.tdsCredit)} of the credit in your 26AS is not being claimed, because the income it belongs to is not in your return.`}
              </p>
            </Card>

            <Button variant="secondary" size="lg" onClick={() => setView("ais")}>
              See the raw AIS, TIS and 26AS
            </Button>
          </div>

          <div className="space-y-3.5">
            <Card className="p-5">
              <div className="eyebrow">Where this leaves you</div>
              <div
                className={cx(
                  "tnum mt-2.5 font-display text-[40px] leading-none",
                  current.refundDue > 0
                    ? "text-[color:var(--ok)]"
                    : "text-[color:var(--alert)]",
                )}
              >
                {inr(current.refundDue > 0 ? current.refundDue : current.taxPayable)}
              </div>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                {current.refundDue > 0
                  ? "Refundable, on the figures as they stand. Deductions come next and can only improve it."
                  : "Still payable on the figures as they stand. Deductions come next."}
              </p>
            </Card>
          </div>
        </div>

        <FlowActionBar>
          <LinkButton href="/deductions" block size="lg">
            Next — your deductions
          </LinkButton>
        </FlowActionBar>
      </div>
    );
  }

  /* ------------------------ differences to settle ----------------------- */
  const missingIncome = pending.reduce(
    (sum, e) => sum + Math.max(0, e.aisAmount - declaredFor(state, e.id)),
    0,
  );
  const unclaimedCredit = pending.reduce((sum, e) => sum + e.tdsDeducted, 0);
  const nowFigure = current.refundDue > 0 ? current.refundDue : current.taxPayable;
  const thenFigure =
    projected.refundDue > 0 ? projected.refundDue : projected.taxPayable;

  return (
    <div>
      <PhoneStepHeader back={{ href: "/income/salary" }} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-9 [&>*]:min-w-0">
        <div>
          <h1 className="font-display text-[32px] leading-[1.1] tracking-[-0.01em] sm:text-[44px] sm:leading-[1.05]">
            {pending.length === 1
              ? "One difference to settle"
              : `${numberWord(pending.length)} differences to settle`}
          </h1>
          <p className="mt-3 max-w-[42rem] text-[15px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[16px]">
            Banks, employers and companies report what they paid you. Each
            difference below has what happened, what it costs, and the buttons
            that end it.
          </p>

          <div className="mt-6 space-y-4">
            {pending.map((entry) => (
              <MismatchCard key={entry.id} entry={entry} />
            ))}
          </div>

          {settled.length > 0 ? (
            <Card tone="sunk" className="mt-5">
              <CardHeader
                title="Settled by you"
                eyebrow={`${settled.length} ${settled.length === 1 ? "entry" : "entries"}`}
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
                        <div className="truncate text-[13.5px] font-medium">
                          {entry.description}
                        </div>
                        <div className="truncate text-[11.5px] text-ink-faint">
                          {entry.source}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="tnum text-[13px]">
                          {inr(r?.resolvedAmount ?? entry.aisAmount)}
                        </span>
                        <Badge tone={badgeToneFor(r?.resolution)}>
                          {resolutionLabel(r?.resolution)}
                        </Badge>
                        <button
                          onClick={() =>
                            state.resolveMismatch(
                              entry.id,
                              "pending" as MismatchResolution,
                            )
                          }
                          className="tap text-[11.5px] text-ink-faint underline underline-offset-2 hover:text-ink"
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

          {/* Entries that agree with the return, and the SFT trail that is not
              income at all. Neither carries an Undo: you never decided them,
              so there is nothing of yours to take back. */}
          {agreeing.length + informational.length > 0 ? (
            <Card tone="sunk" className="mt-3.5">
              <CardHeader
                title="Nothing to do"
                eyebrow={`${agreeing.length + informational.length} ${
                  agreeing.length + informational.length === 1
                    ? "entry"
                    : "entries"
                }`}
              />
              <ul className="divide-y divide-[color:var(--line)]">
                {[...agreeing, ...informational].map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium">
                        {entry.description}
                      </div>
                      <div className="truncate text-[11.5px] text-ink-faint">
                        {entry.source}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="tnum text-[13px]">
                        {inr(entry.aisAmount)}
                      </span>
                      <Badge tone="neutral">
                        {entry.informational ? "Not income" : "Agrees"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* --------------------------- projection --------------------------- */}
        <div className="space-y-3.5">
          <Card className="p-5 sm:p-[22px]">
            <div className="eyebrow">
              If you settle {settleAllWord(pending.length)}
            </div>
            <div className="mt-3.5 flex items-baseline gap-2.5">
              <span className="tnum text-[15px] text-ink-faint line-through">
                {inr(nowFigure)}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-ink-faint"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
            <div
              className={cx(
                "tnum font-display text-[44px] leading-none",
                projected.refundDue > 0
                  ? "text-[color:var(--ok)]"
                  : "text-[color:var(--alert)]",
              )}
            >
              {inr(thenFigure)}
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
              {missingIncome > 0
                ? `${inr(missingIncome)} of real income joins the return, which is why the figure moves. The ${inr(unclaimedCredit)} of tax credit that comes with it is why it does not move further.`
                : "Accepting these entries brings their tax credit into your return."}
            </p>

            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-baseline justify-between gap-3 py-1 text-[13.5px] text-ink-soft">
                <span>Credit in your 26AS</span>
                <span className="tnum">{inr(totalTdsIn26AS)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-1 text-[13.5px]">
                <span className="text-[color:var(--alert)]">Claiming today</span>
                <span className="tnum font-semibold text-[color:var(--alert)]">
                  {inr(current.tdsCredit)}
                </span>
              </div>
            </div>
          </Card>

          <details className="group rounded-[var(--radius)] border border-alert-100 bg-alert-50 p-5">
            <summary className="tap cursor-pointer list-none text-[14px] font-semibold text-[color:var(--alert)]">
              Why not just skip it
              <span className="ml-1.5 font-normal text-ink-faint group-open:hidden">
                — read
              </span>
            </summary>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
              The department compares your return against these figures
              automatically. Anything left out comes back as an{" "}
              <Term name="Intimation u/s 143(1)">intimation under 143(1)</Term> a
              few months later, with interest attached.
            </p>
          </details>

          <Button
            variant="secondary"
            size="lg"
            block
            onClick={() => setView("ais")}
          >
            See the raw AIS, TIS and 26AS
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   One difference
   ================================================================ */

function MismatchCard({ entry }: { entry: AisEntry }) {
  const resolveMismatch = useAppStore((s) => s.resolveMismatch);
  const declared = useAppStore((s) => declaredFor(s, entry.id));
  const [correcting, setCorrecting] = useState(false);
  const [amount, setAmount] = useState(entry.aisAmount);

  const gap = entry.aisAmount - declared;
  const isAction = entry.severity === "action";

  return (
    <Card className="p-5 sm:px-[22px]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone={isAction ? "alert" : "warn"}>
              {declared === 0 && isAction
                ? "Missing from your return"
                : gap > 0 && isAction
                  ? `${inr(gap)} short`
                  : "Worth checking"}
            </Badge>
            <span className="text-[12.5px] text-ink-faint">
              {entry.source} · {entry.category.toLowerCase()}
            </span>
          </div>

          <h2 className="mt-2.5 text-[18px] font-semibold leading-snug lg:text-[19px]">
            {headlineFor(entry)}
          </h2>
          <Expandable
            text={entry.plainLanguage}
            className="mt-2 max-w-[36rem] text-[14.5px] leading-relaxed text-ink-soft"
          />
        </div>

        {/* Side by side on a phone, stacked in the narrow column on desktop.
            Two figures that exist to be compared should be readable in one
            glance, and stacked they were a scroll apart on a small screen. */}
        <div className="grid w-full shrink-0 grid-cols-2 gap-x-4 rounded-[var(--radius-sm)] bg-paper px-4 py-3.5 lg:w-[220px] lg:grid-cols-1 lg:gap-x-0">
          <div className="min-w-0">
            <div className="text-[12px] text-ink-faint">They were told</div>
            <div className="tnum font-display text-[26px] leading-tight sm:text-[28px]">
              {inr(entry.aisAmount)}
            </div>
          </div>
          <div className="min-w-0 border-l border-line pl-4 lg:mt-2.5 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-2.5">
            <div className="text-[12px] text-ink-faint">You declared</div>
            <div
              className={cx(
                "tnum font-display text-[26px] leading-tight sm:text-[28px]",
                gap !== 0 && isAction
                  ? "text-[color:var(--alert)]"
                  : "text-ink-faint",
              )}
            >
              {inr(declared)}
            </div>
          </div>
        </div>
      </div>

      {correcting ? (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-line bg-paper p-4">
          <div className="mb-2 text-[13px] font-medium">
            What is the right figure?
          </div>
          <MoneyInput value={amount} onValueChange={setAmount} />
          <div className="mt-3 flex gap-2.5">
            <Button
              onClick={() => {
                resolveMismatch(entry.id, "amount-corrected", "you", amount);
                setCorrecting(false);
              }}
            >
              Use {inr(amount)}
            </Button>
            <Button variant="secondary" onClick={() => setCorrecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        // Full width on a phone: buttons sized to their own labels stack
        // ragged and give a smaller target than the thumb wants.
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <Button
            className="w-full sm:w-auto"
            onClick={() => resolveMismatch(entry.id, "accepted")}
          >
            {acceptLabel(entry, gap, declared)}
          </Button>
          {isAction ? (
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => setCorrecting(true)}
            >
              A different amount is right
            </Button>
          ) : null}
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => resolveMismatch(entry.id, "other-pan")}
          >
            {isAction ? "Not mine" : "It belongs to the first holder"}
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- */

/**
 * The projection on the right: what the return would say if every open entry
 * were accepted at the reported figure. Computed by the same engine as
 * everything else, on a copy of the state — nothing is written.
 */
function projectSettleAll(state: AppState) {
  const input = toTaxpayerInput(state);
  const otherSources = { ...input.otherSources };
  let extraTds = 0;

  const fieldFor: Record<string, keyof typeof otherSources | undefined> = {
    "ais-savings-interest": "savingsInterest",
    "ais-fd-interest": "fdInterest",
    "ais-dividend": "dividend",
    "ais-kaveri-interest": "other",
  };

  for (const entry of visibleAisEntries(state)) {
    // Only entries still asking for a decision. An entry that already agrees
    // with the return, or that is not income at all, has nothing to add.
    if (aisStatus(state, entry) !== "open") continue;
    const field = fieldFor[entry.id];
    if (field) otherSources[field] = entry.aisAmount;
    extraTds += entry.tdsDeducted;
  }

  return computeTax({
    ...input,
    otherSources,
    tdsOnOtherIncome: input.tdsOnOtherIncome + extraTds,
  });
}

function numberWord(n: number): string {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  return words[n] ?? String(n);
}

/** "it", "both", "all three" — the phrasing English actually uses. */
function settleAllWord(n: number): string {
  if (n === 1) return "it";
  if (n === 2) return "both";
  return `all ${numberWord(n).toLowerCase()}`;
}

/** A sentence about what happened, not a restatement of the category. */
function headlineFor(entry: AisEntry): string {
  const headlines: Record<string, string> = {
    "ais-fd-interest": "Interest your bank has already taxed you on",
    "ais-dividend": "A dividend credited late in the year",
    "ais-kaveri-interest": "Interest on an account you are second holder of",
    "ais-savings-interest": "Savings interest your bank reported",
    "ais-salary": "Salary your employer reported",
    "ais-sft-mf": "A mutual fund purchase they were told about",
  };
  return headlines[entry.id] ?? entry.description;
}

function acceptLabel(entry: AisEntry, gap: number, declared: number): string {
  if (entry.severity === "attention") {
    return `It is my income — add ${inr(entry.aisAmount)}`;
  }
  if (declared === 0 && entry.tdsDeducted > 0) {
    return `Add ${inr(entry.aisAmount)} and claim the ${inr(entry.tdsDeducted)}`;
  }
  if (gap > 0) return `Use ${inr(entry.aisAmount)}`;
  return `Accept ${inr(entry.aisAmount)}`;
}

function outcomeLabel(
  resolution: string | undefined,
  declared: number,
  aisAmount: number,
): string {
  switch (resolution) {
    case "accepted":
      if (declared === 0) return "added";
      return declared === aisAmount ? "matched" : "corrected";
    case "amount-corrected":
      return "corrected";
    case "other-pan":
      return "first holder’s";
    case "duplicate":
      return "duplicate";
    case "denied":
      return "disagreed";
    default:
      // Only ever called for an entry the taxpayer actually resolved, so
      // there is no pending case left to name here.
      return "settled";
  }
}

function outcomeTone(resolution: string | undefined): string {
  switch (resolution) {
    case "accepted":
    case "amount-corrected":
      return "text-[color:var(--ok)]";
    default:
      return "text-ink-soft";
  }
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
      />
      <ul className="divide-y divide-[color:var(--line)]">
        {visibleAisEntries(state).map((entry) => {
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
                      row.feedbackApplied && "text-[color:var(--plum)]",
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

      <Callout tone="info" title="Why there are three columns" collapsible>
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
  const totalTdsIn26AS = visibleTdsIn26AS(state);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Form 26AS"
          eyebrow={<Term name="Form 26AS">What is 26AS?</Term>}
          description="Tax already deposited against your PAN. You can only claim credit for what appears here."
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
              {visible26AS(state).map((row) => (
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

/**
 * The way back to the worked example, offered where its absence is felt.
 *
 * Two taps, not one: it replaces whatever is in the return, and a button that
 * quietly discards your work is not a button. Only shown on the seeded PAN,
 * because that is the only one the sample documents belong to.
 */
function LoadSampleDocuments() {
  const canLoad = useAppStore((s) => s.canLoadSampleDocuments());
  const load = useAppStore((s) => s.loadSampleDocuments);
  const hasEntries = useAppStore(returnHasIncome);
  const [confirming, setConfirming] = useState(false);

  if (!canLoad) return null;

  return (
    <div className="mt-5 border-t border-[color:var(--line)] pt-4">
      {confirming ? (
        <div className="animate-rise">
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            This replaces the return with the sample taxpayer&rsquo;s — a Form
            16 of ₹18,40,000 and an AIS with three differences to settle.
            Anything you have entered goes with it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Button size="lg" onClick={load}>
              Load the sample return
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setConfirming(false)}
            >
              Keep what I have
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            Want to see what this screen does when there is something to settle?
          </p>
          <button
            onClick={() => (hasEntries ? setConfirming(true) : load())}
            className="tap mt-2 border-b border-[color:var(--plum)] text-[13.5px] font-medium text-[color:var(--plum)]"
          >
            Load the sample documents
          </button>
        </>
      )}
    </div>
  );
}
