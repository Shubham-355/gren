"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ChoiceGroup,
  ComputedTag,
  Field,
  MoneyInput,
  PageHeader,
  Row,
  Stat,
  Term,
  Toggle,
  cx,
} from "@/components/ui";
import { discoveryQuestions } from "@/lib/data/discovery";
import { inr } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { sectionLabel, useAppStore } from "@/lib/store/useAppStore";
import type { DeductionInput } from "@/lib/tax/compute";
import { LIMITS } from "@/lib/tax/constants";

type Mode = "guided" | "sections";

export default function DeductionsPage() {
  const state = useAppStore();
  const { current, comparison } = useTax();
  const [mode, setMode] = useState<Mode>("guided");

  const oldRegimeValue = comparison.old.chapterVIA + comparison.old.exemptAllowances;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Step 2 of preparing your return"
        title="What you can take off your income"
        intro="Two ways in. Answer questions about your life and let the platform work out which section applies, or go straight to the sections if you already know them."
        aside={
          <Badge tone={state.regime === "old" ? "ok" : "warn"}>
            {state.regime === "old"
              ? "Old regime — these count"
              : "New regime — most do not count"}
          </Badge>
        }
      />

      {state.regime === "new" ? (
        <Callout
          tone="warn"
          title="You are on the new regime, where almost none of this applies"
        >
          Under the new regime the only deductions that survive are the standard
          deduction of ₹75,000 and your employer&rsquo;s NPS contribution under{" "}
          <Term name="Section 80CCD(2)">80CCD(2)</Term>. You can still fill this
          page in — the figures are saved, and the{" "}
          <Link href="/regime" className="font-medium underline underline-offset-2">
            regime comparison
          </Link>{" "}
          uses them to work out whether switching would be worth it. On your
          current entries the old regime would shelter{" "}
          <strong className="tnum">{inr(oldRegimeValue)}</strong>.
        </Callout>
      ) : null}

      <Card tone="accent">
        <div className="grid grid-cols-2 gap-4 px-4 py-3.5 sm:grid-cols-4">
          <Stat
            label="Deductions in effect"
            value={inr(current.chapterVIA)}
            tag={<ComputedTag />}
            tone="pine"
          />
          <Stat
            label="HRA exempt"
            value={inr(current.hraExemption)}
            hint={state.regime === "new" ? "not available here" : "section 10(13A)"}
          />
          <Stat
            label="Standard deduction"
            value={inr(current.standardDeduction)}
            hint="automatic, no proof needed"
          />
          <Stat
            label="Taxable income"
            value={inr(current.totalIncome)}
            hint={`down from ${inr(current.grossTotalIncome)}`}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <ChoiceGroup
          value={mode}
          onChange={setMode}
          options={[
            { value: "guided", label: "Answer questions" },
            { value: "sections", label: "Browse sections" },
          ]}
        />
        <span className="text-[12px] text-ink-faint">
          {state.discoveryAnswered.length} of {discoveryQuestions.length} answered
        </span>
      </div>

      {mode === "guided" ? <GuidedDiscovery /> : <SectionList />}
    </div>
  );
}

/* ================================================================
   Guided discovery
   ================================================================ */

function GuidedDiscovery() {
  const state = useAppStore();
  const { current } = useTax();

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
  const currentQuestion = remaining[0];

  if (!currentQuestion) {
    return (
      <div className="space-y-4">
        <Callout tone="ok" title="That is every question">
          You have been through all {questions.length}. Anything you said yes to is
          in the list below and is already reflected in your tax. You can change any
          of them from the sections view.
        </Callout>
        <AnsweredList questions={answered} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => useAppStore.setState({ discoveryAnswered: [] })}
          >
            Start the questions again
          </Button>
          <Link
            href="/regime"
            className="inline-flex items-center rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-[color:var(--pine-ink)]"
          >
            See what this does to your tax
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <QuestionCard
        key={currentQuestion.id}
        question={currentQuestion}
        index={questions.length - remaining.length + 1}
        total={questions.length}
      />
      {answered.length > 0 ? <AnsweredList questions={answered} /> : null}
      <Callout tone="pine">
        Prefer to just talk? Ask Sarathi something like &ldquo;I pay ₹22,000 a year
        for health insurance&rdquo; and it will record it under the right section
        for you. Current deductions in effect: {inr(current.chapterVIA)}.
      </Callout>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
}: {
  question: (typeof discoveryQuestions)[number];
  index: number;
  total: number;
}) {
  const state = useAppStore();
  const [answering, setAnswering] = useState(false);
  const [amount, setAmount] = useState(question.suggested);

  function record(value: number) {
    state.setDeduction(question.section, value);
    state.markDiscoveryAnswered(question.id);
    setAnswering(false);
  }

  return (
    <Card>
      <div className="px-4 py-4">
        <div className="eyebrow">
          Question {index} of {total} · {question.sectionLabel}
        </div>
        <h2 className="mt-1.5 font-display text-[19px] leading-snug">
          {question.question}
        </h2>
        <p className="mt-2 max-w-prose text-[13.5px] leading-relaxed text-ink-soft">
          {question.why}
        </p>

        {answering ? (
          <div className="mt-4 space-y-3">
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
            <div className="flex gap-2">
              <Button onClick={() => record(amount)}>Record {inr(amount)}</Button>
              <Button variant="secondary" onClick={() => setAnswering(false)}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {question.suggested > 0 ? (
              <Button onClick={() => record(question.suggested)}>
                Yes — {inr(question.suggested)}
              </Button>
            ) : null}
            <Button
              variant={question.suggested > 0 ? "secondary" : "primary"}
              onClick={() => {
                setAmount(question.suggested);
                setAnswering(true);
              }}
            >
              {question.suggested > 0 ? "Yes, a different amount" : "Yes"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                state.setDeduction(question.section, 0);
                state.markDiscoveryAnswered(question.id);
              }}
            >
              No
            </Button>
          </div>
        )}

        {question.suggested > 0 && !answering ? (
          <p className="mt-2 text-[11.5px] leading-snug text-ink-faint">
            {question.suggestedLabel} — taken from the documents already loaded
            against your PAN.
          </p>
        ) : null}

        {question.followUp ? (
          <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-ink-faint">
            {question.followUp}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function AnsweredList({
  questions,
}: {
  questions: (typeof discoveryQuestions)[number][];
}) {
  const state = useAppStore();
  return (
    <Card tone="sunk">
      <CardHeader title="Answered" eyebrow={`${questions.length} questions`} />
      <ul className="divide-y divide-[color:var(--line)]">
        {questions.map((q) => {
          const value = state.deductions[q.section] as number;
          return (
            <li
              key={q.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px]">{q.question}</div>
                <div className="text-[11.5px] text-ink-faint">
                  {q.sectionLabel}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cx(
                    "tnum text-[13px] font-medium",
                    value > 0 ? "text-ink" : "text-ink-faint",
                  )}
                >
                  {value > 0 ? inr(value) : "No"}
                </span>
                <button
                  onClick={() =>
                    useAppStore.setState((s) => ({
                      discoveryAnswered: s.discoveryAnswered.filter(
                        (id) => id !== q.id,
                      ),
                    }))
                  }
                  className="text-[11.5px] text-ink-faint underline underline-offset-2 hover:text-ink"
                >
                  Change
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
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

function SectionList() {
  const state = useAppStore();
  const { current } = useTax();

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Chapter VI-A"
            description="Enter the real amount. Ceilings are applied for you, and shown when they bite."
          />
          <div className="divide-y divide-[color:var(--line)]">
            {sections.map((s) => {
              const raw = state.deductions[s.key] as number;
              const capped = s.ceiling ? Math.min(raw, s.ceiling) : raw;
              const over = s.ceiling ? raw > s.ceiling : false;
              return (
                <div key={s.key} className="px-4 py-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_10rem] sm:items-start">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium">
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
          <div className="border-t border-line px-4 py-3">
            <Toggle
              checked={state.deductions.s80D_parents_senior}
              onChange={(v) => state.setDeduction("s80D_parents_senior", v)}
              label="At least one of my parents is 60 or older"
              description="Raises the 80D parents ceiling from ₹25,000 to ₹50,000."
            />
          </div>
        </Card>

        <Callout tone="info" title="Two deductions you never enter here">
          The standard deduction is applied automatically — {inr(current.standardDeduction)}{" "}
          this year. Your employer&rsquo;s NPS contribution under 80CCD(2) comes
          straight from your Form 16, because you did not pay it and cannot change
          it.
        </Callout>
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
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
                <Row
                  key={b.label}
                  label={b.label}
                  value={b.amount}
                  note={b.note}
                />
              ))
            )}
            <Row label="Chapter VI-A total" value={current.chapterVIA} strong />
          </div>
          <div className="border-t border-line px-4 py-3">
            <Row label="Gross total income" value={current.grossTotalIncome} />
            <Row label="Less deductions" value={current.chapterVIA} negative />
            <Row label="Taxable income" value={current.totalIncome} strong />
            <Row
              label="Tax on it"
              value={current.totalTaxLiability}
              tone="alert"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
