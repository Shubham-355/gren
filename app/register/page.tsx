"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Wordmark } from "@/components/shell/AppShell";
import { Disclaimer } from "@/components/shell/Disclaimer";
import {
  Badge,
  Button,
  Callout,
  Field,
  ProgressTrack,
  TextInput,
  Toggle,
} from "@/components/ui";
import { useAppStore } from "@/lib/store/useAppStore";

const steps = [
  {
    id: "identity",
    label: "Who you are",
    description: "PAN, name and date of birth, exactly as they appear on the card",
  },
  {
    id: "contact",
    label: "How we reach you",
    description: "A mobile number and email that only you can access",
  },
  {
    id: "link",
    label: "Link Aadhaar",
    description: "Mandatory since 2023. Most things stop working without it",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const pushToast = useAppStore((s) => s.pushToast);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    pan: "",
    name: "",
    dob: "",
    mobile: "",
    email: "",
    linkAadhaar: true,
  });
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  function next() {
    if (step === 0) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.trim().toUpperCase())) {
        setError("PAN should look like AAAPZ1234C — five letters, four digits, one letter.");
        return;
      }
      if (form.name.trim().length < 3) {
        setError("Enter the name as printed on your PAN card.");
        return;
      }
      if (!form.dob) {
        setError("Date of birth is needed — it decides which slab table applies to you.");
        return;
      }
    }
    if (step === 1) {
      if (!/^[0-9]{10}$/.test(form.mobile.replace(/\D/g, "").slice(-10))) {
        setError("A ten-digit Indian mobile number, please.");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(form.email)) {
        setError("That email address does not look complete.");
        return;
      }
    }
    setError(null);
    if (step < 2) {
      setStep(step + 1);
      return;
    }

    const age = form.dob
      ? Math.max(
          18,
          Math.floor(
            (Date.now() - new Date(form.dob).getTime()) / (365.25 * 86_400_000),
          ),
        )
      : 30;

    updateProfile({
      name: form.name.trim(),
      pan: form.pan.trim().toUpperCase(),
      dob: form.dob,
      age,
      email: form.email.trim(),
      mobile: form.mobile.trim(),
      panAadhaarLinked: form.linkAadhaar,
    });
    login("pan");
    pushToast({
      tone: "success",
      title: "Registered",
      body: "Your profile is set up. The synthetic Form 16 and AIS are waiting for you.",
    });
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/">
            <Wordmark />
          </Link>
          <Badge tone="clay">Prototype — nothing is stored remotely</Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10">
        <h1 className="font-display text-[28px] leading-tight">
          Register as a new taxpayer
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          Three steps, asking for what it needs when it needs it.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-[10rem_1fr]">
          <ProgressTrack steps={steps} current={step} />

          <div className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            {step === 0 ? (
              <div className="space-y-4">
                <Field
                  label="PAN"
                  hint="This becomes your user ID. It is never shown in full to anyone else."
                >
                  <TextInput
                    value={form.pan}
                    maxLength={10}
                    onChange={(e) => set({ pan: e.target.value.toUpperCase() })}
                    placeholder="AAAPZ1234C"
                    className="mono tracking-wider"
                  />
                </Field>
                <Field label="Full name, as printed on the PAN card">
                  <TextInput
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Ananya Verma"
                  />
                </Field>
                <Field
                  label="Date of birth"
                  hint="Age decides your slab table — the exemption limit is higher at 60 and higher again at 80."
                >
                  <TextInput
                    type="date"
                    value={form.dob}
                    onChange={(e) => set({ dob: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <Field
                  label="Mobile number"
                  hint="Use the number linked to your Aadhaar. Almost every e-verification failure traces back to this being a different number."
                >
                  <TextInput
                    inputMode="tel"
                    value={form.mobile}
                    onChange={(e) => set({ mobile: e.target.value })}
                    placeholder="90000 00000"
                  />
                </Field>
                <Field
                  label="Email address"
                  hint="Intimations, refund notifications and notices all arrive here."
                >
                  <TextInput
                    type="email"
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </Field>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <Toggle
                  checked={form.linkAadhaar}
                  onChange={(v) => set({ linkAadhaar: v })}
                  label="Link my Aadhaar to this PAN"
                  description="Linking is mandatory. An unlinked PAN becomes inoperative, which means no refund, TDS at a higher rate, and returns that will not process."
                />
                <Callout tone="plum" title="What happens after this" collapsible>
                  We will pull the synthetic Form 16, AIS and 26AS for Assessment
                  Year 2026-27 into your account, work out both regimes on your real
                  numbers, and show you what needs your attention. You can change
                  anything afterwards.
                </Callout>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4">
                <Callout tone="alert">{error}</Callout>
              </div>
            ) : null}

            <div className="mt-5 flex gap-2">
              {step > 0 ? (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : null}
              <Button block onClick={next}>
                {step === 2 ? "Create account" : "Continue"}
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-ink-soft">
          Already set up?{" "}
          <Link
            href="/login"
            className="font-medium text-[color:var(--plum)] underline underline-offset-2"
          >
            Sign in instead
          </Link>
        </p>
      </main>

      <Disclaimer inset />
    </div>
  );
}
