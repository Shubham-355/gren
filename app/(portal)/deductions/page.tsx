"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PhoneStepHeader } from "@/components/shell/StepRail";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  ChoiceGroup,
  ComputedTag,
  Field,
  LinkButton,
  MoneyInput,
  Row,
  Term,
  Toggle,
  cx,
} from "@/components/ui";
import { discoveryQuestions, type DiscoveryQuestion } from "@/lib/data/discovery";
import { inr } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import {
  sectionLabel,
  toTaxpayerInput,
  useAppStore,
  type AppState,
} from "@/lib/store/useAppStore";
import { computeTax, type DeductionInput } from "@/lib/tax/compute";
import { LIMITS } from "@/lib/tax/constants";

/**
 * Step 5 — Deduction discovery.
 *
 * One question about your life at a time. This is the one place in the flow
 * where a genuinely conversational, one-question-at-a-time shape is the right
 * call (§5.5): people do not know which section their spending falls under,
 * but they do know what they spent money on.
 *
 * The running tax figure moves with every answer, and each option shows what
 * that answer would do before it is given.
 */

type Mode = "guided" | "sections";

export default function DeductionsPage() {
  const state = useAppStore();
  const [mode, setMode] = useState<Mode>("guided");

  return (
    <div>
      <PhoneStepHeader
        back={{ href: "/reconciliation" }}
        action={
          <span className="text-[13px] text-ink-faint">
            {state.discoveryAnswered.length} of {discoveryQuestions.length}
          </span>
        }
      />

      {mode === "guided" ? (
        <GuidedDiscovery onBrowse={() => setMode("sections")} />
      ) : (
        <SectionList onGuided={() => setMode("guided")} />
      )}
    </div>
  );
}

/* ================================================================
   Guided discovery — one question, one screen
   ================================================================ */

function GuidedDiscovery({ onBrowse }: { onBrowse: () => void }) {
  const state = useAppStore();
  const { current } = useTax();
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);

  const questions = useMemo(
    () =>
      discoveryQuestions.map((q) =>
        q.id === "savings-interest"
          ? { ...q, suggested: state.otherSources.savingsInterest }
          : q,
      ),
    [state.otherSources.savingsInterest],
  );

  const remaining = questions.filter(
    (q) => !state.discoveryAnswered.includes(q.id),
  );
  const answered = questions.filter((q) =>
    state.discoveryAnswered.includes(q.id),
  );
  const question = remaining[0];
  const index = questions.length - remaining.length + 1;

  const shelter = useMemo(() => shelterFigures(state), [state]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
      {/* --------------------------- the question --------------------------- */}
      <div>
        {question ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="eyebrow">
                Question {index} of {questions.length}
              </span>
              <span className="flex gap-1">
                {questions.map((q, i) => (
                  <span
                    key={q.id}
                    className={cx(
                      "h-[3px] w-[22px] rounded-full",
                      i < index - 1
                        ? "bg-[color:var(--plum)]"
                        : "bg-[color:var(--line)]",
                    )}
                  />
                ))}
              </span>
            </div>

            <QuestionBody
              key={question.id}
              question={question}
              regime={state.regime}
            />
          </>
        ) : (
          <div>
            <h1 className="font-display text-[32px] leading-[1.08] sm:text-[46px] sm:leading-[1.04]">
              That is every question answered
            </h1>
            <p className="mt-3.5 max-w-[38rem] text-[15px] leading-relaxed text-ink-soft sm:text-[16px]">
              Anything you said yes to is already in your tax. Change any of it
              from the sections view — nothing here is locked until you file.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/regime" size="lg">
                See what this does to your tax
              </LinkButton>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => useAppStore.setState({ discoveryAnswered: [] })}
              >
                Start the questions again
              </Button>
            </div>
          </div>
        )}

        <div className="mt-11 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-6">
          <span className="text-[13.5px] text-ink-faint">
            Rather not answer questions?
          </span>
          <button
            onClick={onBrowse}
            className="border-b border-[color:var(--plum)] text-[13.5px] font-medium text-[color:var(--plum)]"
          >
            Enter sections directly
          </button>
          <span className="text-[13.5px] text-ink-faint">·</span>
          <button
            onClick={() => setCopilotOpen(true)}
            className="border-b border-[color:var(--petrol)] text-[13.5px] font-medium text-[color:var(--petrol)]"
          >
            Tell Saathi in a sentence
          </button>
        </div>
      </div>

      {/* --------------------------- running total -------------------------- */}
      <div className="space-y-3.5 lg:sticky lg:top-[124px] lg:self-start">
        <Card tone="plum" className="p-6">
          <div className="text-[12.5px] text-white/[0.68]">
            Tax saved so far, if you file old regime
          </div>
          <div className="tnum mt-1.5 font-display text-[44px] leading-none text-white sm:text-[52px]">
            {inr(shelter.saved)}
          </div>
          <div className="mt-4 space-y-1 border-t border-white/[0.18] pt-4">
            <div className="flex items-baseline justify-between gap-3 text-[14px] text-white/[0.78]">
              <span>Tax with nothing claimed</span>
              <span className="tnum">{inr(shelter.withNothing)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-[14px] font-semibold text-white">
              <span>Tax as it stands now</span>
              <span className="tnum">{inr(shelter.withCurrent)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-[22px]">
          <div className="eyebrow">What you have said yes to</div>
          {answered.filter((q) => (state.deductions[q.section] as number) > 0)
            .length === 0 ? (
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
              Nothing yet. Each yes below will show what it took off your bill.
            </p>
          ) : (
            <div className="mt-4 space-y-3.5">
              {answered
                .filter((q) => (state.deductions[q.section] as number) > 0)
                .map((q, i) => (
                  <div
                    key={q.id}
                    className={cx(
                      "flex items-start justify-between gap-3",
                      i > 0 && "border-t border-[color:var(--surface-sunk)] pt-3.5",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-medium leading-snug">
                        {q.suggestedLabel}
                      </div>
                      <div className="text-[12.5px] text-ink-faint">
                        {q.sectionLabel}
                        {q.ceiling ? ` · capped at ${inr(q.ceiling)}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tnum text-[14.5px] font-medium">
                        {inr(state.deductions[q.section] as number)}
                      </div>
                      <div className="tnum text-[12.5px] font-semibold text-[color:var(--ok)]">
                        − {inr(sectionTaxEffect(state, q.section))} tax
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <p className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-faint">
            {remaining.length > 0
              ? `${remaining.length} ${remaining.length === 1 ? "question" : "questions"} left, and you can stop at any point — whatever you have answered is saved.`
              : "Every question answered. Chapter VI-A in effect right now: " +
                inr(current.chapterVIA) +
                "."}
          </p>
        </Card>

        {state.regime === "new" ? (
          <Callout tone="warn" title="You are on the new regime">
            These are recorded but do not reduce your tax while the new regime is
            selected. The{" "}
            <Link
              href="/regime"
              className="font-medium underline underline-offset-2"
            >
              regime step
            </Link>{" "}
            works out whether switching is worth it — on your entries so far, the
            old regime would shelter {inr(shelter.shelter)}.
          </Callout>
        ) : null}
      </div>
    </div>
  );
}

function QuestionBody({
  question,
  regime,
}: {
  question: DiscoveryQuestion;
  regime: "old" | "new";
}) {
  const state = useAppStore();
  const [answering, setAnswering] = useState(false);
  const [amount, setAmount] = useState(question.suggested);

  // Priced on the old regime, because that is the only regime these answers
  // buy anything in — and the running panel says so on its own label.
  const preview = useMemo(
    () => previewSaving(state, question.section, question.suggested),
    [state, question.section, question.suggested],
  );

  // The honest figure to show is what they actually paid; the honest thing to
  // say next to it is what the Act will actually allow.
  const capped =
    question.ceiling !== undefined && question.suggested > question.ceiling;

  function record(value: number) {
    state.setDeduction(question.section, value);
    state.markDiscoveryAnswered(question.id);
    setAnswering(false);
  }

  return (
    <div className="animate-rise">
      <h1 className="mt-4 max-w-[32rem] font-display text-[32px] leading-[1.1] tracking-[-0.015em] sm:text-[44px] sm:leading-[1.04] lg:text-[52px]">
        {question.question}
      </h1>
      <p className="mt-4 max-w-[38rem] text-[15px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[16.5px]">
        {question.why}
      </p>

      {answering ? (
        <div className="mt-7 max-w-[24rem] space-y-4">
          <Field
            label="How much for the whole year?"
            hint={
              question.ceiling
                ? `Anything above ${inr(question.ceiling)} is capped automatically — enter the real figure.`
                : "No ceiling on this one."
            }
          >
            <MoneyInput value={amount} onValueChange={setAmount} />
          </Field>
          <div className="flex gap-2.5">
            <Button size="lg" onClick={() => record(amount)}>
              Record {inr(amount)}
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setAnswering(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {question.suggested > 0 ? (
            <button
              onClick={() => record(question.suggested)}
              className="flex h-[56px] items-center justify-between gap-3.5 rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-[26px] text-[16.5px] font-medium text-white transition-colors hover:bg-[color:var(--plum-deep)] sm:justify-start"
            >
              <span>
                Yes — {inr(question.suggested)}
                {capped ? (
                  <span className="ml-2 text-[13.5px] font-normal text-white/[0.72]">
                    counts as {inr(question.ceiling!)}
                  </span>
                ) : null}
              </span>
              {preview > 0 ? (
                <span className="tnum text-[14px] text-white/[0.72]">
                  saves {inr(preview)}
                  {regime === "new" ? " on the old regime" : ""}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            onClick={() => {
              setAmount(question.suggested);
              setAnswering(true);
            }}
            className={cx(
              "flex h-[56px] items-center justify-center rounded-[var(--radius-sm)] px-6 text-[16.5px] font-medium transition-colors",
              question.suggested > 0
                ? "border border-line-strong bg-surface hover:bg-sunk"
                : "bg-[color:var(--plum)] text-white hover:bg-[color:var(--plum-deep)]",
            )}
          >
            {question.suggested > 0 ? "Yes, a different amount" : "Yes"}
          </button>
          <button
            onClick={() => {
              state.setDeduction(question.section, 0);
              state.markDiscoveryAnswered(question.id);
            }}
            className="flex h-[56px] items-center justify-center rounded-[var(--radius-sm)] border border-line-strong bg-surface px-6 text-[16.5px] font-medium text-ink-soft transition-colors hover:bg-sunk"
          >
            No
          </button>
        </div>
      )}

      {question.suggested > 0 && !answering ? (
        <p className="mt-4 max-w-[38rem] text-[13.5px] leading-relaxed text-ink-faint">
          {question.suggestedLabel} — already on record against your PAN.
          {question.followUp ? ` ${question.followUp}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/* ================================================================
   Direct section entry
   ================================================================ */

const sections: {
  key: keyof DeductionInput;
  ceiling?: number;
  blurb: string;
  term?: string;
}[] = [
  {
    key: "s80C",
    ceiling: LIMITS.s80C,
    term: "Section 80C",
    blurb: "EPF, PPF, ELSS, life insurance, tuition fees, home loan principal",
  },
  {
    key: "s80CCD1B",
    ceiling: LIMITS.s80CCD1B,
    blurb: "Your own NPS contribution, over and above the 80C ceiling",
  },
  {
    key: "s80D_self",
    ceiling: LIMITS.s80D_self,
    term: "Section 80D",
    blurb: "Health insurance for you, your spouse and your children",
  },
  {
    key: "s80D_parents",
    ceiling: LIMITS.s80D_parents_senior,
    blurb: "Health insurance for your parents — higher limit if they are 60 or over",
  },
  {
    key: "s80DDB",
    ceiling: LIMITS.s80DDB,
    blurb: "Treatment of specified diseases, with a prescription from a specialist",
  },
  { key: "s80E", blurb: "Interest on an education loan — no ceiling, eight years" },
  { key: "s80G", blurb: "Donations to registered funds and institutions" },
  {
    key: "s80TTA",
    ceiling: LIMITS.s80TTA,
    term: "Section 80TTA",
    blurb: "Savings bank interest only — not fixed deposits",
  },
  {
    key: "s80EEB",
    ceiling: LIMITS.s80EEB,
    blurb: "Interest on a loan for an electric vehicle",
  },
  {
    key: "s80U",
    ceiling: LIMITS.s80U_severe,
    blurb: "A flat deduction where the taxpayer has a certified disability",
  },
];

function SectionList({ onGuided }: { onGuided: () => void }) {
  const state = useAppStore();
  const { current } = useTax();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-[1.1] sm:text-[40px]">
            Every section, straight
          </h1>
          <p className="mt-2 max-w-[38rem] text-[15px] leading-relaxed text-ink-soft">
            Enter the real amount. Ceilings are applied for you, and shown when
            they bite.
          </p>
        </div>
        <ChoiceGroup
          value={"sections" as Mode}
          onChange={(m) => m === "guided" && onGuided()}
          options={[
            { value: "guided" as Mode, label: "Answer questions" },
            { value: "sections" as Mode, label: "Browse sections" },
          ]}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card>
            <div className="divide-y divide-[color:var(--line)]">
              {sections.map((s) => {
                const raw = state.deductions[s.key] as number;
                const capped = s.ceiling ? Math.min(raw, s.ceiling) : raw;
                const over = s.ceiling ? raw > s.ceiling : false;
                return (
                  <div key={s.key} className="px-4 py-3.5 sm:px-5">
                    <div className="grid gap-3 sm:grid-cols-[1fr_10rem] sm:items-start">
                      <div className="min-w-0">
                        <div className="text-[14.5px] font-medium">
                          {s.term ? (
                            <Term name={s.term}>{sectionLabel(s.key)}</Term>
                          ) : (
                            sectionLabel(s.key)
                          )}
                          {s.ceiling ? (
                            <span className="ml-1.5 text-[11.5px] font-normal text-ink-faint">
                              up to {inr(s.ceiling)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
                          {s.blurb}
                        </p>
                      </div>
                      <div>
                        <MoneyInput
                          value={raw}
                          onValueChange={(v) => state.setDeduction(s.key, v)}
                        />
                        {over ? (
                          <p className="mt-1 text-[11px] leading-snug text-[color:var(--warn)]">
                            Capped at {inr(capped)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-line px-4 py-3.5 sm:px-5">
              <Toggle
                checked={state.deductions.s80D_parents_senior}
                onChange={(v) => state.setDeduction("s80D_parents_senior", v)}
                label="At least one of my parents is 60 or older"
                description="Raises the 80D parents ceiling from ₹25,000 to ₹50,000."
              />
            </div>
          </Card>

          <Callout tone="info" title="Two deductions you never enter here">
            The standard deduction is applied automatically —{" "}
            {inr(current.standardDeduction)} this year. Your employer&rsquo;s NPS
            contribution under <Term name="80CCD(2)">80CCD(2)</Term> comes
            straight from your Form 16, because you did not pay it and cannot
            change it.
          </Callout>
        </div>

        <div className="space-y-3.5 lg:sticky lg:top-[124px] lg:self-start">
          <Card tone="sunk">
            <CardHeader
              title="In effect right now"
              eyebrow={
                <>
                  {state.regime} regime <ComputedTag />
                </>
              }
            />
            <div className="px-4 py-3">
              {current.chapterVIABreakdown.length === 0 ? (
                <p className="py-2 text-[13px] text-ink-soft">
                  Nothing claimed yet.
                </p>
              ) : (
                current.chapterVIABreakdown.map((b) => (
                  <Row key={b.label} label={b.label} value={b.amount} note={b.note} />
                ))
              )}
              <Row label="Chapter VI-A total" value={current.chapterVIA} strong />
            </div>
            <div className="border-t border-line px-4 py-3">
              <Row label="Gross total income" value={current.grossTotalIncome} />
              <Row label="Less deductions" value={current.chapterVIA} negative />
              <Row label="Taxable income" value={current.totalIncome} strong />
              <Row label="Tax on it" value={current.totalTaxLiability} tone="alert" />
            </div>
          </Card>

          <LinkButton href="/regime" block size="lg">
            Next — old versus new
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   The running numbers
   ================================================================ */

const ZERO_DEDUCTIONS: DeductionInput = {
  s80C: 0,
  s80CCD1B: 0,
  s80D_self: 0,
  s80D_parents: 0,
  s80D_parents_senior: false,
  s80DDB: 0,
  s80E: 0,
  s80G: 0,
  s80TTA: 0,
  s80EEB: 0,
  s80U: 0,
};

/**
 * "Tax saved so far" is measured against the same return with nothing claimed,
 * both computed on the old regime — because that is the regime these answers
 * actually buy you anything in. Saying so on the label is the honest version.
 */
function shelterFigures(state: AppState) {
  const input = { ...toTaxpayerInput(state), regime: "old" as const };
  // The baseline holds everything else — including HRA, which was settled on
  // the income screen — so this number only ever moves when an answer here
  // moves it. Starting it at anything other than zero would be a lie.
  const withNothing = computeTax({
    ...input,
    deductions: { ...ZERO_DEDUCTIONS },
  }).totalTaxLiability;
  const withCurrent = computeTax(input).totalTaxLiability;
  const full = computeTax(input);
  return {
    withNothing,
    withCurrent,
    saved: Math.max(0, withNothing - withCurrent),
    shelter: full.chapterVIA + full.hraExemption,
  };
}

/** What answering this question with the suggested figure would be worth. */
function previewSaving(
  state: AppState,
  section: keyof DeductionInput,
  suggested: number,
): number {
  if (suggested <= 0) return 0;
  const input = { ...toTaxpayerInput(state), regime: "old" as const };
  const before = computeTax(input).totalTaxLiability;
  const after = computeTax({
    ...input,
    deductions: { ...input.deductions, [section]: suggested },
  }).totalTaxLiability;
  return Math.max(0, before - after);
}

/** What one already-recorded section is currently worth, on its own. */
function sectionTaxEffect(
  state: AppState,
  section: keyof DeductionInput,
): number {
  const input = { ...toTaxpayerInput(state), regime: "old" as const };
  const with_ = computeTax(input).totalTaxLiability;
  const without = computeTax({
    ...input,
    deductions: { ...input.deductions, [section]: 0 },
  }).totalTaxLiability;
  return Math.max(0, without - with_);
}
