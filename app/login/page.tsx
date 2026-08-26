"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/shell/AppShell";
import { Disclaimer } from "@/components/shell/Disclaimer";
import { Button, Callout, cx } from "@/components/ui";
import { OtpInput } from "@/components/ui/OtpInput";
import { form16, taxpayer } from "@/lib/data/seed";
import { useHydratedStore } from "@/lib/store/hydration";
import { useAppStore } from "@/lib/store/useAppStore";
import { ASSESSMENT_YEAR } from "@/lib/tax/constants";

/**
 * Step 1 — Login.
 *
 * PAN, then a mocked OTP. There is deliberately no welcome interstitial
 * afterwards: the next thing you see is the dashboard with your data already
 * in it.
 */

type Stage = "identify" | "otp";

const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const aadhaarPattern = /^[0-9]{12}$/;

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydratedStore();
  const login = useAppStore((s) => s.login);
  const loggedIn = useAppStore((s) => s.loggedIn);

  const [method, setMethod] = useState<"pan" | "aadhaar">("pan");
  const [identifier, setIdentifier] = useState(taxpayer.pan);
  const [stage, setStage] = useState<Stage>("identify");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (hydrated && loggedIn) router.replace("/dashboard");
  }, [hydrated, loggedIn, router]);

  useEffect(() => {
    if (stage !== "otp") return;
    const timer = window.setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [stage]);

  function requestOtp() {
    const value = identifier.trim().toUpperCase().replace(/\s/g, "");
    if (method === "pan" && !panPattern.test(value)) {
      setError(
        "A PAN is five letters, four digits and one letter — like AAAPZ1234C.",
      );
      return;
    }
    if (method === "aadhaar" && !aadhaarPattern.test(value)) {
      setError("An Aadhaar number is twelve digits.");
      return;
    }
    setError(null);
    setSeconds(24);
    setStage("otp");
  }

  function verify(code = otp) {
    if (code.replace(/\D/g, "").length !== 6) {
      setError("The OTP is six digits. Any six will do — this is simulated.");
      return;
    }
    setError(null);
    login(method);
    router.push("/dashboard");
  }

  const maskedMobile = `••${taxpayer.mobile.slice(-4)}`;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="mx-auto w-full max-w-6xl px-5 py-5 lg:px-12 lg:py-[22px]">
        <Link href="/" aria-label="TaxSaathi home">
          <Wordmark size="lg" />
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-12 px-5 pb-14 pt-4 lg:grid-cols-2 lg:gap-[72px] lg:px-12 lg:pt-14">
        {/* ------------------------------ prose ------------------------------ */}
        <div>
          <p className="eyebrow">Assessment Year {ASSESSMENT_YEAR}</p>
          <h1 className="mt-4 font-display text-[36px] leading-[1.04] tracking-[-0.018em] sm:text-[48px] lg:text-[56px]">
            {stage === "identify"
              ? "Let’s start with your PAN"
              : "Six digits, then you’re in"}
          </h1>
          <p className="mt-4 max-w-[28rem] text-[16px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[17px]">
            {stage === "identify"
              ? "It is how we pull your Form 16, AIS and 26AS. Nothing gets filed until you review the whole return and tap submit."
              : `We would normally text a code to the mobile ending ${maskedMobile}. This is a prototype — enter any six digits.`}
          </p>

          <div className="mt-9 hidden max-w-[26rem] space-y-[18px] lg:block">
            <Reassurance
              title="Every login gets its own copy"
              body="Two people demoing at once never touch the same data."
            />
            <Reassurance
              title="Nothing real is accepted"
              body="No genuine PAN, Aadhaar or OTP is validated or stored, ever."
            />
          </div>
        </div>

        {/* ------------------------------ card ------------------------------- */}
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-sm)] sm:px-8 sm:py-[34px]">
          <div className="flex gap-1.5 rounded-[11px] bg-sunk p-1">
            {(["pan", "aadhaar"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMethod(m);
                  setIdentifier(m === "pan" ? taxpayer.pan : "999999999999");
                  setStage("identify");
                  setError(null);
                }}
                aria-pressed={method === m}
                className={cx(
                  "flex-1 rounded-[8px] py-2.5 text-[14px] transition-colors",
                  method === m
                    ? "bg-surface font-semibold shadow-[0_1px_2px_rgba(28,24,27,.08)]"
                    : "text-ink-soft",
                )}
              >
                {m === "pan" ? "PAN" : "Aadhaar"}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <label
              htmlFor="identifier"
              className="block text-[12.5px] font-semibold uppercase tracking-[0.05em] text-ink-faint"
            >
              {method === "pan" ? "PAN" : "Aadhaar number"}
            </label>
            <input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && stage === "identify") requestOtp();
              }}
              autoComplete="off"
              spellCheck={false}
              maxLength={method === "pan" ? 10 : 12}
              className="mono mt-2.5 h-[56px] w-full rounded-[var(--radius-sm)] border-[1.5px] border-[color:var(--plum)] bg-surface px-[18px] text-[19px] tracking-[0.14em] text-ink focus:outline-none"
            />
            <p className="mt-2.5 text-[12.5px] text-ink-faint">
              {method === "pan"
                ? "Demo PAN, synthetic format. Any five-letter, four-digit, one-letter value works here."
                : "Twelve digits. This demo accepts any twelve — no real Aadhaar is validated, stored or transmitted."}
            </p>
          </div>

          {stage === "otp" ? (
            <div className="mt-6">
              <span className="block text-[12.5px] font-semibold uppercase tracking-[0.05em] text-ink-faint">
                One-time password
              </span>
              <div className="mt-2.5">
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={verify}
                  autoFocus
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="tnum text-[13px] text-ink-faint">
                  Sent to {maskedMobile} ·{" "}
                  {seconds > 0 ? `resend in 0:${String(seconds).padStart(2, "0")}` : "resend available"}
                </span>
                <button
                  onClick={() => {
                    setStage("identify");
                    setOtp("");
                    setError(null);
                  }}
                  className="text-[13px] font-medium text-[color:var(--plum)]"
                >
                  Change
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4">
              <Callout tone="alert">{error}</Callout>
            </div>
          ) : null}

          <div className="mt-6">
            {stage === "identify" ? (
              <Button block size="lg" onClick={requestOtp}>
                Send OTP
              </Button>
            ) : (
              <Button block size="lg" onClick={() => verify()}>
                Verify &amp; continue
              </Button>
            )}
          </div>

          {/* what is already waiting on the other side */}
          <div className="mt-5 space-y-2.5 border-t border-line pt-5">
            <FetchRow done label={`Form 16 · ${form16.employer.name.split(" ").slice(0, 2).join(" ")}`} />
            <FetchRow done label="26AS · 3 TDS credit entries" />
            <FetchRow
              done={stage === "otp"}
              label={stage === "otp" ? "AIS & TIS · 6 entries" : "AIS & TIS — fetching"}
            />
          </div>
        </div>
      </main>

      <div className="mx-auto w-full max-w-5xl px-5 pb-8 lg:px-12">
        <p className="text-center text-[13px] text-ink-soft lg:text-left">
          First time here?{" "}
          <Link
            href="/register"
            className="font-medium text-[color:var(--plum)] underline underline-offset-2"
          >
            Register a new taxpayer
          </Link>
        </p>
      </div>

      <Disclaimer inset />
    </div>
  );
}

function Reassurance({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[color:var(--plum)]" />
      <div>
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[14px] leading-relaxed text-ink-soft">
          {body}
        </div>
      </div>
    </div>
  );
}

function FetchRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cx(
          "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full text-[10px] text-white",
          done ? "bg-[color:var(--ok)]" : "border-2 border-line-strong",
        )}
      >
        {done ? "✓" : null}
      </span>
      <span
        className={cx("text-[13.5px]", done ? "text-ink-strong" : "text-ink-faint")}
      >
        {label}
      </span>
    </div>
  );
}
