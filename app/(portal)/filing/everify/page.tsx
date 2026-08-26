"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PhoneStepHeader } from "@/components/shell/StepRail";
import { Button, Callout, Card, EmptyState, LinkButton } from "@/components/ui";
import { OtpInput } from "@/components/ui/OtpInput";
import { buildEverifyConfirmation } from "@/lib/confirmations";
import { daysUntil, shortDate } from "@/lib/format";
import { useAppStore } from "@/lib/store/useAppStore";

/**
 * Step 8 — e-Verify.
 *
 * One screen, one action, and the consequence of not doing it stated once —
 * not shouted three times. Verifying is Tier 3, so the button raises the
 * confirmation card rather than verifying on the spot.
 */

const otherMethods = [
  {
    id: "net-banking",
    label: "Net banking",
    detail:
      "Sign in to your bank and follow the e-filing link. Useful when your Aadhaar mobile number is out of date.",
  },
  {
    id: "bank-evc",
    label: "Bank account EVC",
    detail:
      "A code generated against a pre-validated bank account. Needs the account validated first.",
  },
  {
    id: "itr-v",
    label: "Signed ITR-V by post",
    detail:
      "Print, sign in blue ink, post to CPC Bengaluru within 30 days. The slowest option and the easiest to get wrong.",
  },
];

export default function EVerifyPage() {
  const state = useAppStore();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(38);
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  if (!state.filing.submitted) {
    return (
      <div>
        <PhoneStepHeader back={{ href: "/filing" }} />
        <EmptyState
          title="There is nothing to verify yet"
          body="e-Verification is what makes a submitted return count. Submit the return first and this screen becomes the next thing to do."
          action={<LinkButton href="/filing">Go to review and submit</LinkButton>}
        />
      </div>
    );
  }

  if (state.filing.everified) {
    return (
      <div>
        <PhoneStepHeader back={{ href: "/filing/confirmation" }} />
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
            Already verified
          </h1>
          <p className="mt-2.5 max-w-[34rem] text-[14.5px] leading-relaxed text-ink-soft">
            Verified on{" "}
            {state.filing.everifiedAt
              ? shortDate(state.filing.everifiedAt)
              : "today"}
            . The return counts, and processing has started.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href="/refund">Track the refund</LinkButton>
            <LinkButton href="/filing/confirmation" variant="secondary">
              See the acknowledgement
            </LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  // 30 days from submission, which is the real window under section 139(9).
  const daysSinceSubmission = state.filing.submittedAt
    ? -daysUntil(state.filing.submittedAt)
    : 0;
  const daysLeft = Math.max(0, 30 - daysSinceSubmission);

  function verify(code = otp) {
    if (code.replace(/\D/g, "").length !== 6) {
      setError("The code is six digits. Any six will do — this is simulated.");
      return;
    }
    setError(null);
    state.requestConfirmation(
      buildEverifyConfirmation(useAppStore.getState(), "you"),
    );
  }

  return (
    <div>
      <PhoneStepHeader back={{ href: "/filing/confirmation" }} />

      <div className="mx-auto max-w-[46rem]">
        <h1 className="font-display text-[36px] leading-[1.06] tracking-[-0.015em] sm:text-[52px] sm:leading-[1.02]">
          One tap and the return counts
        </h1>
        <p className="mt-4 max-w-[36rem] text-[16px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[17px]">
          Your {state.filing.formSelected ?? "ITR-1"} is submitted. Until it is
          verified the law treats it as never filed — including the late fee. You
          have {daysLeft} days; this takes about ten seconds.
        </p>

        <Card className="mt-8 p-6 sm:px-[30px] sm:py-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--surface-sunk)] pb-[18px]">
            <div>
              <div className="text-[12.5px] text-ink-faint">
                Acknowledgement number
              </div>
              <div className="mono mt-1 text-[16px]">
                {state.filing.acknowledgementNumber}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[12.5px] text-ink-faint">Submitted</div>
              <div className="mt-1 text-[15px] font-medium">
                {state.filing.submittedAt
                  ? shortDate(state.filing.submittedAt)
                  : "today"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-7 pt-[22px] lg:flex-row lg:items-end lg:gap-8">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">Aadhaar OTP</div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                A six-digit code goes to{" "}
                <strong className="font-semibold text-ink">
                  {state.profile.mobile}
                </strong>
                , the number linked to your Aadhaar ending{" "}
                {state.profile.aadhaarMasked.slice(-4)}. Simulated here — any six
                digits work.
              </p>
              <div className="mt-[18px] max-w-[340px]">
                <OtpInput value={otp} onChange={setOtp} size="lg" />
              </div>
              {error ? (
                <p className="mt-2.5 text-[13px] text-[color:var(--alert)]">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col gap-2.5">
              <Button size="lg" onClick={() => verify()} className="px-[34px]">
                Verify my return
              </Button>
              <span className="tnum text-center text-[13px] text-ink-faint">
                {seconds > 0 ? `resend in ${seconds}s` : "resend available"}
              </span>
            </div>
          </div>
        </Card>

        <Card className="mt-5 px-5 py-4">
          <button
            onClick={() => setShowOthers(!showOthers)}
            aria-expanded={showOthers}
            className="flex w-full items-center justify-between gap-5 text-left"
          >
            <span className="text-[14.5px] text-ink-soft">
              Aadhaar mobile out of date? Net banking, a pre-validated bank
              account, or a signed ITR-V by post all work.
            </span>
            <span className="shrink-0 border-b border-[color:var(--plum)] text-[14px] font-medium text-[color:var(--plum)]">
              {showOthers ? "Hide" : "Other ways to verify"}
            </span>
          </button>

          {showOthers ? (
            <ul className="animate-rise mt-4 space-y-3 border-t border-line pt-4">
              {otherMethods.map((m) => (
                <li key={m.id}>
                  <div className="text-[14px] font-medium">{m.label}</div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
                    {m.detail}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <div className="mt-5">
          <Callout tone="warn" title="If you do nothing">
            An unverified return is treated as though it was never filed at all.
            After 30 days you would have to file again, as a belated return —
            locked to the new regime, with a fee under{" "}
            <Link
              href="/help#section-234f"
              className="underline underline-offset-2"
            >
              section 234F
            </Link>
            .
          </Callout>
        </div>
      </div>
    </div>
  );
}
