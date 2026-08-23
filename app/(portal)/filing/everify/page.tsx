"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DemoTag,
  EmptyState,
  PageHeader,
  Row,
  Term,
  cx,
} from "@/components/ui";
import { daysUntil, shortDate } from "@/lib/format";
import { useAppStore } from "@/lib/store/useAppStore";

const methods = [
  {
    id: "aadhaar-otp",
    label: "Aadhaar OTP",
    detail:
      "A code to the mobile number linked to your Aadhaar. Instant, and what almost everyone uses.",
    recommended: true,
  },
  {
    id: "net-banking",
    label: "Net banking",
    detail:
      "Sign in to your bank and follow the e-filing link. Useful when your Aadhaar mobile number is out of date.",
    recommended: false,
  },
  {
    id: "bank-evc",
    label: "Bank account EVC",
    detail:
      "A code generated against a pre-validated bank account. Needs the account validated first.",
    recommended: false,
  },
  {
    id: "itr-v",
    label: "Signed ITR-V by post",
    detail:
      "Print, sign in blue ink, post to CPC Bengaluru within 30 days. The slowest option and the easiest to get wrong.",
    recommended: false,
  },
];

export default function EVerifyPage() {
  const router = useRouter();
  const state = useAppStore();
  const [method, setMethod] = useState("aadhaar-otp");
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sent) return;
    otpRef.current?.focus();
    const t = window.setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(t);
  }, [sent]);

  if (!state.filing.submitted) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Filing · e-Verification"
          title="There is nothing to verify yet"
          intro="Verification is the step that makes a submitted return count. Submit first, then come back here — you get 30 days."
        />
        <EmptyState
          title="No return submitted"
          body="Once you submit, this screen will let you verify with a simulated Aadhaar OTP, and the refund tracker will start moving."
          action={
            <Link
              href="/filing"
              className="rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-5 py-2.5 text-[14px] font-medium text-white"
            >
              Go to filing
            </Link>
          }
        />
      </div>
    );
  }

  if (state.filing.everified) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Filing · e-Verification"
          title="Verified"
          intro="Your return is now a filed return in the full sense. Processing at the Centralised Processing Centre begins from here."
          aside={<Badge tone="ok">Done</Badge>}
        />
        <Card tone="ok">
          <div className="px-4 py-4">
            <Row
              label="Acknowledgement number"
              value={state.filing.acknowledgementNumber ?? "—"}
            />
            <Row
              label="Verified on"
              value={
                state.filing.everifiedAt
                  ? shortDate(state.filing.everifiedAt)
                  : "—"
              }
            />
            <Row label="Method" value="Aadhaar OTP (simulated)" />
          </div>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/refund"
            className="rounded-[var(--radius-sm)] bg-[color:var(--pine)] px-5 py-3 text-[14px] font-medium text-white"
          >
            Track your refund
          </Link>
          <Link
            href="/filing/confirmation"
            className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-5 py-3 text-[14px] font-medium"
          >
            Acknowledgement
          </Link>
        </div>
      </div>
    );
  }

  const deadline = state.filing.submittedAt
    ? new Date(
        new Date(state.filing.submittedAt).getTime() + 30 * 86_400_000,
      ).toISOString()
    : null;
  const daysLeft = deadline ? daysUntil(deadline) : 30;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Filing · e-Verification"
        title="Make it count"
        intro="A submitted return that is never verified is treated in law as though it was never filed — including the late fee. This is the most consequential thirty seconds of the whole process."
        aside={<Badge tone="alert">{daysLeft} days left</Badge>}
      />

      <Callout tone="alert" title="What happens if you do not">
        Thirty days from submission the return lapses. Not &ldquo;is
        delayed&rdquo; — lapses. You would have to file again, by then as a belated
        return, with the fee under section 234F, interest under 234A, no ability to
        carry losses forward, and the regime choice locked to the new regime.
      </Callout>

      <Card>
        <CardHeader
          title="How would you like to verify?"
          description="All four are real options in the actual system. This prototype simulates the first one."
        />
        <ul className="divide-y divide-[color:var(--line)]">
          {methods.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => {
                  setMethod(m.id);
                  setSent(false);
                  setError(null);
                }}
                className={cx(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                  method === m.id ? "bg-pine-50" : "hover:bg-sunk",
                )}
              >
                <span
                  className={cx(
                    "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                    method === m.id
                      ? "border-[color:var(--pine)] bg-[color:var(--pine)] ring-2 ring-inset ring-white"
                      : "border-line-strong",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-medium">{m.label}</span>
                    {m.recommended ? <Badge tone="ok">fastest</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">
                    {m.detail}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {method === "aadhaar-otp" ? (
        <Card>
          <CardHeader
            title="Aadhaar OTP"
            eyebrow="Simulated"
            action={<DemoTag label="no OTP is sent" />}
          />
          <div className="space-y-4 px-4 py-4">
            <Row
              label="OTP would go to"
              value={`${state.profile.mobile} — the number linked to Aadhaar ${state.profile.aadhaarMasked}`}
            />

            {!sent ? (
              <Button
                block
                size="lg"
                onClick={() => {
                  setSeconds(45);
                  setSent(true);
                }}
              >
                Send OTP
              </Button>
            ) : (
              <>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-ink-soft">
                      Enter the six-digit code
                    </span>
                    <span className="tnum text-[12px] text-ink-faint">
                      {seconds > 0 ? `valid for ${seconds}s` : "expired — resend"}
                    </span>
                  </div>
                  <input
                    ref={otpRef}
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="······"
                    className="mono w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-3 text-center text-[24px] tracking-[0.45em] focus:border-[color:var(--pine-400)]"
                  />
                  <p className="mt-1 text-[11.5px] text-ink-faint">
                    Any six digits will do — nothing was sent and nothing is checked
                    against a real Aadhaar record.
                  </p>
                </div>

                {error ? <Callout tone="alert">{error}</Callout> : null}

                <Button
                  block
                  size="lg"
                  onClick={() => {
                    if (otp.length !== 6) {
                      setError("Six digits, please.");
                      return;
                    }
                    state.everify();
                    router.push("/refund");
                  }}
                >
                  Verify return
                </Button>
              </>
            )}
          </div>
        </Card>
      ) : (
        <Card tone="sunk">
          <div className="px-4 py-5">
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              {methods.find((m) => m.id === method)?.detail}
            </p>
            <p className="mt-2 text-[12.5px] text-ink-faint">
              This prototype only simulates the Aadhaar OTP path. Select that option
              to complete verification in the demo.
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => setMethod("aadhaar-otp")}
            >
              Use Aadhaar OTP instead
            </Button>
          </div>
        </Card>
      )}

      <Callout tone="info">
        Once verified, the return goes into processing. You will get an{" "}
        <Term name="Intimation u/s 143(1)">intimation under section 143(1)</Term>{" "}
        when it completes, and the refund tracker on this platform will follow it
        stage by stage.
      </Callout>
    </div>
  );
}
