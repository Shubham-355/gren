"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DemoTag,
  Field,
  PageHeader,
  Row,
  TextInput,
  cx,
} from "@/components/ui";
import { form16 } from "@/lib/data/seed";
import { useAppStore } from "@/lib/store/useAppStore";

export default function ProfilePage() {
  const state = useAppStore();
  const router = useRouter();

  const refundAccount = state.profile.bankAccounts.find(
    (b) => b.nominatedForRefund,
  );

  const readiness = [
    {
      label: "PAN linked to Aadhaar",
      ok: state.profile.panAadhaarLinked,
      detail: state.profile.panAadhaarLinked
        ? "Linked. Everything downstream works."
        : "Unlinked. Your PAN becomes inoperative — no refund, higher TDS, returns that will not process.",
    },
    {
      label: "A validated bank account for the refund",
      ok: Boolean(refundAccount?.validated),
      detail: refundAccount?.validated
        ? `${refundAccount.bank} ${refundAccount.accountNumberMasked} is validated and nominated.`
        : "A refund can only be credited to a pre-validated account whose name matches your PAN.",
    },
    {
      label: "Mobile number that receives the Aadhaar OTP",
      ok: Boolean(state.profile.mobile),
      detail:
        "e-Verification uses the number registered with Aadhaar, not the one on this profile. If they differ, verification fails.",
    },
    {
      label: "Form 16 on record",
      ok: state.form16Imported,
      detail: state.form16Imported
        ? `Imported from ${form16.employer.name}.`
        : "Not imported yet — most of your return can be filled from it.",
    },
  ];

  const ready = readiness.filter((r) => r.ok).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Your details"
        intro="Four things have to be right before a return will file cleanly and a refund will actually reach you. This page is about those four, not about collecting information for its own sake."
        aside={
          <Badge tone={ready === readiness.length ? "ok" : "warn"}>
            {ready} of {readiness.length} ready
          </Badge>
        }
      />

      {/* ---------------- readiness ---------------- */}
      <Card tone={ready === readiness.length ? "ok" : "accent"}>
        <CardHeader title="Pre-filing checklist" />
        <ul className="divide-y divide-[color:var(--line)]">
          {readiness.map((r) => (
            <li key={r.label} className="flex items-start gap-3 px-4 py-3">
              <span
                className={cx(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                  r.ok ? "bg-[color:var(--ok)]" : "bg-[color:var(--clay)]",
                )}
              >
                {r.ok ? "✓" : "!"}
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-medium">{r.label}</div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
                  {r.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---------------- personal ---------------- */}
        <Card>
          <CardHeader
            title="Personal information"
            eyebrow="From your PAN record"
            action={<DemoTag label="synthetic" />}
          />
          <div className="grid gap-4 px-4 py-4">
            <Field label="Full name">
              <TextInput
                value={state.profile.name}
                onChange={(e) => state.updateProfile({ name: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="PAN" hint="Cannot be changed here">
                <TextInput
                  value={state.profile.pan}
                  readOnly
                  className="mono bg-sunk tracking-wider text-ink-soft"
                />
              </Field>
              <Field label="Date of birth">
                <TextInput
                  type="date"
                  value={state.profile.dob}
                  onChange={(e) => {
                    const dob = e.target.value;
                    const age = dob
                      ? Math.floor(
                          (Date.now() - new Date(dob).getTime()) /
                            (365.25 * 86_400_000),
                        )
                      : state.profile.age;
                    state.updateProfile({ dob, age });
                  }}
                />
              </Field>
            </div>
            <Row
              label="Age used for slab purposes"
              value={`${state.profile.age} — ${state.profile.age >= 80 ? "super senior citizen" : state.profile.age >= 60 ? "senior citizen" : "below 60"}`}
              note="Under the old regime the exemption limit rises at 60 and again at 80. The new regime has one table for everyone."
            />
            <Row
              label="Residential status"
              value={state.profile.residentialStatus}
              note="Determines which return form you can use and whether foreign income is taxable here"
            />
          </div>
        </Card>

        {/* ---------------- contact ---------------- */}
        <Card>
          <CardHeader
            title="How they reach you"
            eyebrow="Notices, intimations and OTPs"
          />
          <div className="grid gap-4 px-4 py-4">
            <Field
              label="Mobile number"
              hint="Should be the number registered with Aadhaar, or e-Verification will fail"
            >
              <TextInput
                value={state.profile.mobile}
                onChange={(e) => state.updateProfile({ mobile: e.target.value })}
              />
            </Field>
            <Field label="Email address">
              <TextInput
                type="email"
                value={state.profile.email}
                onChange={(e) => state.updateProfile({ email: e.target.value })}
              />
            </Field>
            <Field label="Address">
              <TextInput
                value={`${state.profile.address.line1}, ${state.profile.address.line2}`}
                readOnly
                className="bg-sunk text-ink-soft"
              />
            </Field>
            <Row
              label="City"
              value={`${state.profile.address.city}, ${state.profile.address.state} ${state.profile.address.pincode}`}
              note="Also decides whether the 50% or 40% HRA leg applies to you"
            />
          </div>
        </Card>
      </div>

      {/* ---------------- PAN / Aadhaar ---------------- */}
      <Card tone={state.profile.panAadhaarLinked ? "ok" : "alert"}>
        <CardHeader
          title="PAN and Aadhaar"
          action={
            <Badge tone={state.profile.panAadhaarLinked ? "ok" : "alert"}>
              {state.profile.panAadhaarLinked ? "Linked" : "Not linked"}
            </Badge>
          }
        />
        <div className="px-4 py-4">
          <Row label="PAN" value={`${state.profile.pan} (synthetic)`} />
          <Row label="Aadhaar" value={state.profile.aadhaarMasked} />
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            Linking has been mandatory since 2023. An unlinked PAN is treated as
            inoperative: refunds stop, tax is deducted from your salary at a higher
            rate, and returns do not process. It is the single most consequential
            switch on this page.
          </p>
          {!state.profile.panAadhaarLinked ? (
            <Button
              className="mt-3"
              onClick={() => {
                state.updateProfile({ panAadhaarLinked: true });
                state.pushToast({
                  tone: "success",
                  title: "PAN and Aadhaar linked",
                  body: "Simulated. In reality this takes up to 30 days after payment of the ₹1,000 fee.",
                });
              }}
            >
              Link them (simulated)
            </Button>
          ) : null}
        </div>
      </Card>

      {/* ---------------- bank accounts ---------------- */}
      <Card>
        <CardHeader
          title="Bank accounts"
          eyebrow="Where a refund would go"
          description="A refund can only be credited to a validated account whose name matches your PAN."
          action={<DemoTag label="synthetic" />}
        />
        <ul className="divide-y divide-[color:var(--line)]">
          {state.profile.bankAccounts.map((account) => (
            <li key={account.id} className="flex items-start gap-3 px-4 py-3">
              <button
                onClick={() => state.setRefundAccount(account.id)}
                disabled={!account.validated}
                aria-label={`Nominate ${account.bank}`}
                className={cx(
                  "mt-1 h-4 w-4 shrink-0 rounded-full border-2 disabled:opacity-35",
                  account.nominatedForRefund
                    ? "border-[color:var(--plum)] bg-[color:var(--plum)] ring-2 ring-inset ring-white"
                    : "border-line-strong",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium">{account.bank}</span>
                  <Badge tone={account.validated ? "ok" : "warn"}>
                    {account.validated ? "Validated" : "Not validated"}
                  </Badge>
                  {account.nominatedForRefund ? (
                    <Badge tone="plum">For refund</Badge>
                  ) : null}
                </div>
                <div className="mono mt-0.5 text-[12px] text-ink-faint">
                  {account.accountNumberMasked} · {account.ifsc} · {account.type}
                </div>
                {!account.validated ? (
                  <p className="mt-1 text-[12px] leading-snug text-[color:var(--warn)]">
                    Validation checks the account name against your PAN. Until it
                    passes, this account cannot receive a refund.
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* ---------------- activity ---------------- */}
      <Card tone="sunk">
        <CardHeader
          title="Recent activity"
          eyebrow="Everything you and the copilot have done"
          description="Every state change on this platform is logged here, whoever made it."
        />
        {state.actionLog.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-ink-soft">
            Nothing yet. Actions appear here as you work through the platform.
          </p>
        ) : (
          <ul className="max-h-72 divide-y divide-[color:var(--line)] overflow-y-auto">
            {state.actionLog.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                <Badge tone={entry.actor === "copilot" ? "plum" : "neutral"}>
                  {entry.actor}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] leading-snug">{entry.summary}</div>
                  <div className="mono text-[11px] text-ink-faint">
                    {entry.tool} · {new Date(entry.at).toLocaleTimeString("en-IN")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Callout tone="warn" title="Reset the demo">
        This clears every figure, decision and grievance back to the seeded state —
        useful before a fresh walkthrough. Your sign-in survives.
      </Callout>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            state.resetDemo();
            state.pushToast({
              tone: "info",
              title: "Demo reset",
              body: "Back to the seeded synthetic taxpayer.",
            });
            router.push("/dashboard");
          }}
        >
          Reset demo data
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            state.logout();
            router.push("/");
          }}
        >
          Sign out
        </Button>
        <Link
          href="/help#about"
          className="inline-flex items-center px-3 py-2 text-[14px] font-medium text-ink-soft hover:text-ink"
        >
          What is real in this prototype?
        </Link>
      </div>
    </div>
  );
}
