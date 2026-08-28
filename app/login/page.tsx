"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
 * afterwards: the next thing you see is the dashboard.
 *
 * The one exception is the seeded PAN, which is asked which of two products it
 * wants — the tour, with a Form 16 and an AIS already on record, or the same
 * platform with nothing filed against the PAN and a return that has to be
 * built by answering for it. Defaulting to the tour silently made the second
 * one unreachable, and the second one is the one that shows the work.
 */

type Stage = "identify" | "otp" | "choose";

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
  const [verifying, setVerifying] = useState(false);
  const verifyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (verifyTimer.current !== null) window.clearTimeout(verifyTimer.current);
    },
    [],
  );

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

  // The check is simulated, but a sign-in that lands on the dashboard in
  // zero milliseconds reads as a form that skipped a step rather than a fast
  // one — you never see the code you typed get accepted. Two seconds of an
  // honest "Verifying" is what the real gesture costs, and it is long enough
  // to be believed.
  function verify(code = otp) {
    if (verifying) return;
    if (code.replace(/\D/g, "").length !== 6) {
      setError("The OTP is six digits. Any six will do — this is simulated.");
      return;
    }
    setError(null);
    setVerifying(true);
    verifyTimer.current = window.setTimeout(() => {
      setVerifying(false);
      // Only the seeded identifier has anything to prefill, so only it gets
      // asked. Anything else has no documents either way.
      if (matchesSeed) {
        setStage("choose");
        return;
      }
      login(method, identifier, "fresh");
      router.push("/dashboard");
    }, 2000);
  }

  function enter(kind: "demo" | "fresh") {
    login(method, identifier, kind);
    router.push("/dashboard");
  }

  const maskedMobile = `••${taxpayer.mobile.slice(-4)}`;

  const typed = identifier.trim().toUpperCase().replace(/\s/g, "");
  const matchesSeed =
    method === "pan"
      ? typed === taxpayer.pan
      : typed === taxpayer.aadhaarMasked.replace(/\s/g, "");

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
              : stage === "otp"
                ? "Six digits, then you’re in"
                : "Two ways to see this"}
          </h1>
          <p className="mt-4 max-w-[28rem] text-[16px] leading-relaxed text-ink-soft [text-wrap:pretty] sm:text-[17px]">
            {stage === "identify"
              ? "It identifies the return. Nothing is filled in for you and nothing gets filed until you review the whole thing and tap submit."
              : stage === "otp"
                ? `We would normally text a code to the mobile ending ${maskedMobile}. This is a prototype — enter any six digits.`
                : "Nothing is prefilled unless you ask for it. Build the return yourself, the way a first-time filer would — or, since this is the one PAN with documents behind it, take the prefilled tour instead. The platform is identical either way."}
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
          <div
            className={cx(
              "flex gap-1.5 rounded-[11px] bg-sunk p-1",
              // The method is settled by the time the fork is offered; leaving
              // the tabs live invites a tap that would silently reset it.
              stage === "choose" && "hidden",
            )}
          >
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
                disabled={verifying}
                className={cx(
                  "flex-1 rounded-[8px] py-2.5 text-[14px] transition-colors disabled:opacity-45",
                  method === m
                    ? "bg-surface font-semibold shadow-[0_1px_2px_rgba(28,24,27,.08)]"
                    : "text-ink-soft",
                )}
              >
                {m === "pan" ? "PAN" : "Aadhaar"}
              </button>
            ))}
          </div>

          {stage === "choose" ? (
            <div className="space-y-3">
              <PathChoice
                title="Start from nothing"
                badge="Default"
                body="Nothing is filled in for you. Your name, PAN and bank account are on record; the return itself is yours to build — enter your salary and answer for your deductions, or tell Saathi to walk you through it. Every figure is computed from what you say."
                onSelect={() => enter("fresh")}
                primary
              />
              <PathChoice
                title="Prefilled — take the tour"
                badge="Fastest"
                body={`A Form 16 from ${form16.employer.name}, an AIS with three real differences to settle, past returns and an open notice. Nothing to type, but nothing of yours either.`}
                onSelect={() => enter("demo")}
              />
              <button
                onClick={() => {
                  setStage("identify");
                  setOtp("");
                }}
                className="tap block pt-1 text-[13px] font-medium text-[color:var(--plum)]"
              >
                Use a different PAN instead
              </button>
            </div>
          ) : (
          <>
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
              disabled={verifying}
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
                  disabled={verifying}
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
                  disabled={verifying}
                  className="tap text-[13px] font-medium text-[color:var(--plum)] disabled:opacity-45"
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
              <Button
                block
                size="lg"
                pending={verifying}
                onClick={() => verify()}
              >
                {verifying ? "Verifying" : "Verify & continue"}
              </Button>
            )}
          </div>

          {/* What the demo PAN has behind it, if the tour is chosen. Only the
              seeded identifier has any of this, so it is only shown for it. */}
          {matchesSeed ? (
            <div className="mt-5 space-y-2.5 border-t border-line pt-5">
              <FetchRow done label={`Form 16 · ${form16.employer.name.split(" ").slice(0, 2).join(" ")}`} />
              <FetchRow done label="26AS · 3 TDS credit entries" />
              <FetchRow
                done={stage === "otp"}
                label={stage === "otp" ? "AIS & TIS · 6 entries" : "AIS & TIS — fetching"}
              />
              <p className="text-[11.5px] leading-snug text-ink-faint">
                Available on this PAN if you choose the prefilled tour. Nothing
                is brought in otherwise.
              </p>
            </div>
          ) : null}
          </>
          )}
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

/**
 * One of the two ways in. Big enough to be a decision rather than a setting —
 * this is the fork between watching the platform and using it.
 */
function PathChoice({
  title,
  badge,
  body,
  onSelect,
  primary,
}: {
  title: string;
  badge: string;
  body: string;
  onSelect: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cx(
        "block w-full rounded-[var(--radius-sm)] border p-4 text-left transition-colors sm:p-[18px]",
        primary
          ? "border-[color:var(--plum)] bg-plum-50 hover:bg-[color:var(--plum-50-hover,var(--plum-50))]"
          : "border-line-strong bg-surface hover:bg-sunk",
      )}
    >
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-display text-[19px] leading-tight">{title}</span>
        <span
          className={cx(
            "rounded-[var(--radius-pill)] px-2 py-[2px] text-[11px] font-semibold",
            primary
              ? "bg-[color:var(--plum)] text-white"
              : "bg-sunk text-ink-soft",
          )}
        >
          {badge}
        </span>
      </span>
      <span className="mt-1.5 block text-[13.5px] leading-relaxed text-ink-soft">
        {body}
      </span>
    </button>
  );
}
