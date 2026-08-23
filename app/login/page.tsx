"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Wordmark } from "@/components/shell/AppShell";
import { Disclaimer } from "@/components/shell/Disclaimer";
import {
  Badge,
  Button,
  Callout,
  ChoiceGroup,
  Field,
  TextInput,
  cx,
} from "@/components/ui";
import { taxpayer } from "@/lib/data/seed";
import { useHydratedStore } from "@/lib/store/hydration";
import { useAppStore } from "@/lib/store/useAppStore";

type Step = "identify" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydratedStore();
  const login = useAppStore((s) => s.login);
  const loggedIn = useAppStore((s) => s.loggedIn);

  const [method, setMethod] = useState<"pan" | "aadhaar">("pan");
  const [identifier, setIdentifier] = useState(taxpayer.pan);
  const [step, setStep] = useState<Step>("identify");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hydrated && loggedIn) router.replace("/dashboard");
  }, [hydrated, loggedIn, router]);

  useEffect(() => {
    if (step !== "otp") return;
    otpRef.current?.focus();
    const timer = window.setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [step]);

  const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  const aadhaarPattern = /^[0-9]{12}$/;

  function requestOtp() {
    const value = identifier.trim().toUpperCase().replace(/\s/g, "");
    if (method === "pan" && !panPattern.test(value)) {
      setError(
        "A PAN is five letters, four digits and one letter — like ABCDE1234F.",
      );
      return;
    }
    if (method === "aadhaar" && !aadhaarPattern.test(value)) {
      setError("An Aadhaar number is twelve digits.");
      return;
    }
    setError(null);
    setSeconds(30);
    setStep("otp");
  }

  function verify() {
    if (otp.replace(/\s/g, "").length !== 6) {
      setError("The OTP is six digits. Any six will do here — this is simulated.");
      return;
    }
    setError(null);
    login(method);
    router.push("/dashboard");
  }

  return (
    <div className="paper-grain flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/">
            <Wordmark />
          </Link>
          <Badge tone="clay">Prototype — synthetic login</Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <h1 className="font-display text-[28px] leading-tight">
          {step === "identify" ? "Sign in to file" : "Check your phone"}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          {step === "identify"
            ? "Use the PAN already loaded, or type any well-formed one. No account is created and nothing is sent anywhere."
            : `We would normally text a six-digit code to the number linked to your Aadhaar. Here, any six digits work.`}
        </p>

        <div className="mt-6 rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
          {step === "identify" ? (
            <div className="space-y-4">
              <ChoiceGroup
                value={method}
                onChange={(m) => {
                  setMethod(m);
                  setIdentifier(m === "pan" ? taxpayer.pan : "999999999999");
                  setError(null);
                }}
                options={[
                  { value: "pan", label: "PAN" },
                  { value: "aadhaar", label: "Aadhaar" },
                ]}
              />

              <Field
                label={method === "pan" ? "PAN" : "Aadhaar number"}
                hint={
                  method === "pan"
                    ? "ABCDE1234F is the documentation placeholder PAN, and the one this demo is built around."
                    : "Twelve digits. This demo accepts any twelve — no real Aadhaar is validated, stored or transmitted."
                }
              >
                <TextInput
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
                  autoComplete="off"
                  spellCheck={false}
                  className="mono tracking-wider"
                  maxLength={method === "pan" ? 10 : 12}
                />
              </Field>

              {error ? <Callout tone="alert">{error}</Callout> : null}

              <Button block size="lg" onClick={requestOtp}>
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Field
                label="Six-digit OTP"
                hint="Simulated. No message was sent to any real number."
                suffix={
                  <span className="tnum text-[12px] text-ink-faint">
                    {seconds > 0 ? `resend in ${seconds}s` : "resend available"}
                  </span>
                }
              >
                <input
                  ref={otpRef}
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") verify();
                  }}
                  className={cx(
                    "mono w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-3 text-center text-[24px] tracking-[0.45em] text-ink",
                    "focus:border-[color:var(--pine-400)]",
                  )}
                  placeholder="······"
                />
              </Field>

              {error ? <Callout tone="alert">{error}</Callout> : null}

              <Button block size="lg" onClick={verify}>
                Verify and sign in
              </Button>
              <button
                onClick={() => {
                  setStep("identify");
                  setOtp("");
                  setError(null);
                }}
                className="w-full text-[13px] text-ink-faint hover:text-ink-soft"
              >
                Use a different {method === "pan" ? "PAN" : "Aadhaar"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-5">
          <Callout tone="warn" title="This is not the real portal">
            Do not enter a genuine PAN, Aadhaar number or OTP anywhere in this
            prototype. There is nothing here that needs them, and no real
            authentication is happening.
          </Callout>
        </div>

        <p className="mt-5 text-center text-[13px] text-ink-soft">
          First time here?{" "}
          <Link
            href="/register"
            className="font-medium text-[color:var(--pine)] underline underline-offset-2"
          >
            Register a new taxpayer
          </Link>
        </p>
      </main>

      <Disclaimer inset />
    </div>
  );
}
