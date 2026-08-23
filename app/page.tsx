import Link from "next/link";

import { Disclaimer } from "@/components/shell/Disclaimer";
import { Wordmark } from "@/components/shell/AppShell";
import { ASSESSMENT_YEAR } from "@/lib/tax/constants";

const pillars = [
  {
    title: "It reads the room before it asks you anything",
    body: "Your Form 16, your AIS, your 26AS and last year's return are already on the screen when you arrive. The first question the platform asks you is the first one it genuinely cannot answer itself.",
  },
  {
    title: "Mismatches get explained, not just flagged",
    body: "A red triangle next to a number is not help. Every difference between what you declared and what your bank reported comes with a sentence saying what happened, what it costs you, and two buttons that resolve it.",
  },
  {
    title: "Every rupee is shown being worked out",
    body: "Slabs, standard deduction, HRA, 87A rebate, marginal relief, cess. Open any figure and you see the arithmetic that produced it, in the order the Act applies it.",
  },
  {
    title: "One copilot, on every screen, that can actually do things",
    body: "Not a chatbot bolted to a help page. It can see what you are looking at and it can change your return — switch regime, accept an AIS figure, add a deduction, raise a grievance — and it tells you each time it does.",
  },
];

const modules = [
  "Home dashboard",
  "Income sources",
  "AIS · TIS · 26AS",
  "Deductions",
  "Regime comparison",
  "Filing & review",
  "Payment",
  "e-Verification",
  "Filing history",
  "Refund tracker",
  "Notices & e-Proceedings",
  "Grievance redressal",
  "Help & jargon",
  "Profile & bank",
];

export default function LandingPage() {
  return (
    <div className="paper-grain flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Wordmark />
          <div className="flex items-center gap-3">
            <Link
              href="/help"
              className="hidden text-[13.5px] text-ink-soft hover:text-ink sm:block"
            >
              How it works
            </Link>
            <Link
              href="/login"
              className="rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-4 py-2 text-[13.5px] font-medium text-white hover:bg-[color:var(--pine-ink)]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ---------------- hero ---------------- */}
        <section className="mx-auto max-w-5xl px-5 pb-14 pt-12 sm:pt-20">
          <p className="eyebrow">
            Independent prototype · Assessment Year {ASSESSMENT_YEAR}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[34px] leading-[1.1] sm:text-[52px]">
            Filing your return should feel like being{" "}
            <span className="text-[color:var(--pine)]">guided</span>, not
            interrogated.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-soft sm:text-[17.5px]">
            Sarathi is a reimagining of the whole income tax e-filing experience for
            salaried taxpayers — every module, from the first login to the refund
            landing in your account — built around plain language and an AI copilot
            that can see your return and change it for you.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-6 py-3 text-[15px] font-medium text-white hover:bg-[color:var(--pine-ink)]"
            >
              Open the demo
            </Link>
            <Link
              href="/help#about"
              className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-6 py-3 text-[15px] font-medium text-ink hover:bg-sunk"
            >
              What is real and what is mocked
            </Link>
          </div>

          <p className="mt-4 text-[12.5px] text-ink-faint">
            No sign-up. One synthetic taxpayer, already loaded. Nothing you type
            here leaves your browser except the copilot messages.
          </p>
        </section>

        {/* ---------------- the problem ---------------- */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 sm:grid-cols-2 sm:py-16">
            <div>
              <div className="eyebrow">The problem</div>
              <h2 className="mt-2 font-display text-[24px] leading-tight sm:text-[28px]">
                The hard part was never the arithmetic.
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
                A salaried taxpayer with one job, one landlord and a savings account
                still has to work out which of two regimes costs less, why AIS shows
                interest they never noticed, whether 80TTA covers fixed deposits,
                what a 143(1) intimation is, and which of ITR-1 or ITR-2 applies to
                them. None of that is arithmetic. All of it is translation.
              </p>
            </div>
            <div className="space-y-3">
              {[
                ["Nine acronyms before you reach a number", "AIS. TIS. 26AS. TDS. 87A. 80CCD(2). ITR-V. EVC. 10-IEA."],
                ["Two portals for one complaint", "e-Nivaran and CPGRAMS, and no clear rule for which one your problem belongs to."],
                ["A regime choice with no working shown", "You are asked to pick, and told the outcome, but not why."],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-[var(--radius)] border border-line bg-paper px-4 py-3.5"
                >
                  <div className="text-[14px] font-semibold">{title}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                    {body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- pillars ---------------- */}
        <section className="mx-auto max-w-5xl px-5 py-14 sm:py-18">
          <div className="eyebrow">What is different here</div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {pillars.map((p, i) => (
              <div key={p.title} className="border-t border-line-strong pt-4">
                <div className="tnum mono text-[12px] text-[color:var(--clay)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-1.5 font-display text-[18px] leading-snug">
                  {p.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- copilot ---------------- */}
        <section className="border-y border-line bg-[color:var(--pine-ink)] text-white">
          <div className="mx-auto max-w-5xl px-5 py-14 sm:py-16">
            <div className="eyebrow text-white/55">The copilot</div>
            <h2 className="mt-2 max-w-2xl font-display text-[26px] leading-tight text-white sm:text-[32px]">
              It has hands, not just opinions.
            </h2>
            <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-white/75">
              The copilot is given a structured snapshot of the screen you are on
              every single turn — your live figures, your open mismatches, where you
              are in the flow. It answers from that, and when you ask it to do
              something it calls a tool that mutates the same state the interface
              reads from.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["navigate_to", "opens any module"],
                ["switch_regime", "changes your regime"],
                ["add_deduction", "records a section"],
                ["resolve_mismatch", "settles an AIS gap"],
                ["explain_term", "opens the glossary"],
                ["raise_grievance", "files a real ticket"],
                ["check_refund_status", "reads the tracker"],
              ].map(([tool, what]) => (
                <div
                  key={tool}
                  className="rounded-[var(--radius-sm)] border border-white/15 bg-white/5 px-3 py-2.5"
                >
                  <div className="mono text-[12px] text-white">{tool}</div>
                  <div className="mt-0.5 text-[12px] text-white/60">{what}</div>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-2xl text-[12.5px] leading-relaxed text-white/50">
              Wired to Gemini with function calling. The key stays server-side; the
              browser only ever talks to this app.
            </p>
          </div>
        </section>

        {/* ---------------- scope ---------------- */}
        <section className="mx-auto max-w-5xl px-5 py-14">
          <div className="eyebrow">Everything in the build</div>
          <h2 className="mt-2 font-display text-[24px] sm:text-[28px]">
            A platform, not a screen.
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {modules.map((m) => (
              <span
                key={m}
                className="rounded-[var(--radius-pill)] border border-line-strong bg-surface px-3 py-1.5 text-[13px] text-ink-soft"
              >
                {m}
              </span>
            ))}
          </div>
          <p className="mt-5 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">
            Capital gains and business income are deliberately out of scope and say
            so on their own screens. Everything else is navigable and does something
            real.
          </p>

          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-6 py-3 text-[15px] font-medium text-white hover:bg-[color:var(--pine-ink)]"
            >
              Open the demo
            </Link>
          </div>
        </section>
      </main>

      <Disclaimer inset />
    </div>
  );
}
