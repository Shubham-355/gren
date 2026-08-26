import Link from "next/link";

import { Wordmark } from "@/components/shell/AppShell";
import { Disclaimer } from "@/components/shell/Disclaimer";
import { daysUntil } from "@/lib/format";
import { ASSESSMENT_YEAR, FILING_DEADLINE } from "@/lib/tax/constants";

/**
 * Step 0 — Landing.
 *
 * One value line, one door. No feature grid, no module list: everything this
 * platform can do is discovered by walking through it, not by reading a
 * marketing page about it.
 */

const promises = [
  {
    title: "One number that answers “what do I owe”",
    body: "Not a dashboard of eighteen tiles. The figure, and the one thing to do next.",
  },
  {
    title: "Differences explained, not just flagged",
    body: "What happened, what it costs, and two buttons that settle it.",
  },
  {
    title: "The regime decision, made once, with the working",
    body: "Two columns, aligned rows, one recommendation sentence.",
  },
];

const bullets = [
  { text: "Both regimes computed on your actual numbers, side by side", copilot: false },
  {
    text: "Every AIS difference explained in a sentence, resolved in one tap",
    copilot: false,
  },
  {
    text: "A copilot that can change your return, not just talk about it",
    copilot: true,
  },
];

export default function LandingPage() {
  const daysLeft = daysUntil(FILING_DEADLINE);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 lg:px-12 lg:py-[22px]">
        <Wordmark size="lg" />
        <div className="flex items-center gap-6">
          <Link
            href="/help"
            className="hidden text-[14px] text-ink-soft hover:text-ink sm:block"
          >
            How it works
          </Link>
          <Link
            href="/help#about"
            className="hidden text-[14px] text-ink-soft hover:text-ink lg:block"
          >
            What&rsquo;s real, what&rsquo;s mocked
          </Link>
          <Link
            href="/login"
            className="flex h-[42px] items-center rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-[22px] text-[14.5px] font-medium text-white hover:bg-[color:var(--plum-deep)]"
          >
            Start
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 lg:px-12">
        <div className="grid items-start gap-14 pt-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pt-[70px]">
          <div>
            <p className="eyebrow">
              Assessment Year {ASSESSMENT_YEAR}
              {daysLeft > 0 ? ` · ${daysLeft} days to the due date` : null}
            </p>
            <h1 className="mt-4 font-display text-[42px] leading-[1.04] tracking-[-0.02em] sm:text-[58px] lg:text-[72px]">
              Your return is mostly written already.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[16px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[18px]">
              We read your Form 16, your AIS and your 26AS first, then ask you
              only what they cannot tell us. Nine steps, plain language, every
              rupee shown being worked out.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5">
              <Link
                href="/login"
                className="flex h-[54px] items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--plum)] px-[30px] text-[16px] font-medium text-white hover:bg-[color:var(--plum-deep)]"
              >
                Start · about 9 minutes
              </Link>
              <Link
                href="/login"
                className="flex h-[54px] items-center justify-center rounded-[var(--radius-sm)] border border-line-strong bg-surface px-[26px] text-[16px] font-medium hover:bg-sunk"
              >
                I have filed here before
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-ink-faint">
              No account is created. Nothing you type leaves your browser except
              copilot messages.
            </p>

            <ul className="mt-8 space-y-3 lg:hidden">
              {bullets.map((b) => (
                <li key={b.text} className="flex items-start gap-3">
                  <span
                    className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: b.copilot
                        ? "var(--petrol)"
                        : "var(--plum)",
                    }}
                  />
                  <span className="text-[14px] leading-relaxed text-ink-soft">
                    {b.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------------- what you get ---------------- */}
          <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-7 shadow-[var(--shadow-sm)]">
            <div className="eyebrow">What you get on the other side</div>
            <div className="mt-5 space-y-5">
              {promises.map((p, i) => (
                <div key={p.title} className="flex items-start gap-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-plum-50 text-[13px] font-semibold text-[color:var(--plum)]">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold">{p.title}</div>
                    <div className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                      {p.body}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-3.5 border-t border-line pt-5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-petrol-50 text-[color:var(--petrol)]">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3.5l2.1 4.9 5.4.5-4.1 3.5 1.2 5.2L12 14.9l-4.6 2.7 1.2-5.2-4.1-3.5 5.4-.5z" />
                  </svg>
                </span>
                <div>
                  <div className="text-[15px] font-semibold text-[color:var(--petrol)]">
                    A copilot with hands
                  </div>
                  <div className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                    Ask it to switch your regime and the screen behind it
                    changes. Filing, verifying and paying still stop for your
                    tap.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
