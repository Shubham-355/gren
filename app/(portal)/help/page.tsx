"use client";

import { useMemo, useState } from "react";

import {
  Badge,
  Callout,
  Card,
  CardHeader,
  PageHeader,
  Row,
  TextInput,
  cx,
  slug,
} from "@/components/ui";
import { glossary, type GlossaryEntry } from "@/lib/data/glossary";
import { useAppStore } from "@/lib/store/useAppStore";
import { ASSESSMENT_YEAR, FINANCIAL_YEAR } from "@/lib/tax/constants";

const categories: GlossaryEntry["category"][] = [
  "Documents",
  "Sections",
  "Money",
  "Process",
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GlossaryEntry["category"] | "all">(
    "all",
  );
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return glossary
      .filter((e) => category === "all" || e.category === category)
      .filter(
        (e) =>
          !q ||
          e.term.toLowerCase().includes(q) ||
          e.aliases?.some((a) => a.toLowerCase().includes(q)) ||
          e.short.toLowerCase().includes(q) ||
          e.long.toLowerCase().includes(q),
      );
  }, [query, category]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Help"
        title="Every piece of jargon on this platform, explained"
        intro="Tax vocabulary is not hard, it is just unfamiliar and nobody ever defines it. Anything underlined with dots anywhere on this platform links back here."
      />

      <div className="space-y-3">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — try 87A, AIS, marginal relief, ITR-V"
          type="search"
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
          >
            All {glossary.length}
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </FilterChip>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <Callout tone="info" title="Nothing matched">
          The glossary has {glossary.length} entries and does not cover everything.
          Ask TaxSaathi instead — it will explain in plain language and tell you when
          it is out of its depth.
        </Callout>
      ) : null}

      <div className="space-y-3">
        {results.map((entry) => (
          <Card key={entry.term} as="article">
            <div id={slug(entry.term)} className="scroll-mt-20 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[18px] leading-snug">
                  {entry.term}
                </h2>
                <Badge tone="neutral">{entry.category}</Badge>
                {entry.aliases?.map((a) => (
                  <span key={a} className="text-[11.5px] text-ink-faint">
                    also {a}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-ink">
                {entry.short}
              </p>
              <p className="mt-2 max-w-prose text-[13.5px] leading-relaxed text-ink-soft">
                {entry.long}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* ---------------- about the prototype ---------------- */}
      <div id="about" className="scroll-mt-20 pt-4">
        <PageHeader
          eyebrow="Honesty"
          title="What is real here and what is simulated"
          intro="A prototype that hides its seams is not much use to anyone evaluating it. This is the whole boundary."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card tone="ok">
          <CardHeader title="Genuinely real" eyebrow="Actual working software" />
          <ul className="space-y-2.5 px-4 py-4">
            {[
              "Every tax figure. Slabs, standard deduction, HRA under 10(13A), house property under 22-24, Chapter VI-A ceilings, the 87A rebate with marginal relief, surcharge and cess are implemented as functions in lib/tax and computed live. Change any input anywhere and every number on the platform moves.",
              "The old-versus-new comparison, computed twice on the same inputs rather than looked up.",
              "The break-even deduction figure, solved numerically against your actual income.",
              "ITR-1 eligibility, checked against eight real disqualifying conditions.",
              "State management. One store, shared by every screen and by the copilot, persisted to your browser.",
              "The copilot's tool calls. When it says it switched your regime, it switched your regime — the same function the button calls.",
            ].map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed">
                <span className="mt-1 shrink-0 text-[color:var(--ok)]">✓</span>
                <span className="text-ink-soft">{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card tone="alert">
          <CardHeader title="Simulated" eyebrow="Looks real, is not" />
          <ul className="space-y-2.5 px-4 py-4">
            {[
              "The taxpayer. Ananya Verma does not exist. The PAN is a made-up sequence, AAAPZ1234C, the employer and banks are invented, and no real person's data is anywhere in this app.",
              "Login and OTP. No authentication happens. Any six digits work, and no message is sent to any number.",
              "Form 16, AIS, TIS and 26AS. Written by hand as seed data, including one deliberate mismatch, to give the reconciliation module something real to chew on.",
              "Submission. No return is transmitted to any authority. The acknowledgement number is generated locally.",
              "Payment. No gateway is contacted and no payment detail is collected.",
              "The refund tracker's timing, which advances on a short simulated clock rather than a real CPC feed.",
              "Persistence. There is no database. State lives in your browser's localStorage and clearing site data resets everything.",
            ].map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed">
                <span className="mt-1 shrink-0 text-[color:var(--alert)]">○</span>
                <span className="text-ink-soft">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Assumptions worth stating" eyebrow="Scope" />
        <div className="px-4 py-3">
          <Row
            label="Assessment year"
            value={ASSESSMENT_YEAR}
            note={`Income earned in FY ${FINANCIAL_YEAR}. Slabs and limits are the Finance Act 2025 position for that year.`}
          />
          <Row
            label="Taxpayer type"
            value="Resident individual, salaried"
            note="Old-regime slabs shift at 60 and 80 and the code handles it, but the seeded persona is below 60."
          />
          <Row
            label="Out of scope"
            value="Capital gains, business income"
            note="Both have their own screens saying so, rather than a shallow imitation."
          />
          <Row
            label="Copilot model"
            value="A language model with function calling"
            note="The API key is held server-side in a Next.js route handler and never reaches the browser."
          />
        </div>
      </Card>

      <Callout tone="plum" title="Still stuck?">
        The copilot can go deeper on any of these, and it knows what is on your
        screen while it does.{" "}
        <button
          onClick={() => setCopilotOpen(true)}
          className="font-medium underline underline-offset-2"
        >
          Open TaxSaathi
        </button>
        .
      </Callout>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-[var(--radius-pill)] border px-3 py-1 text-[12.5px] font-medium transition-colors",
        active
          ? "border-[color:var(--plum)] bg-[color:var(--plum)] text-white"
          : "border-line-strong bg-surface text-ink-soft hover:bg-sunk",
      )}
    >
      {children}
    </button>
  );
}
