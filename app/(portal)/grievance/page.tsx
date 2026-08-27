"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Row,
  Stat,
  cx,
} from "@/components/ui";
import { grievanceTopics, type GrievanceTopicId } from "@/lib/data/seed";
import { shortDate } from "@/lib/format";
import { useAppStore } from "@/lib/store/useAppStore";

export default function GrievancePage() {
  const state = useAppStore();
  const [topic, setTopic] = useState<GrievanceTopicId | null>(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const meta = topic ? grievanceTopics.find((t) => t.id === topic) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="After filing"
        title="Something is wrong"
        intro="One place, one form. The real system splits this between e-Nivaran and CPGRAMS and expects you to know which of the two owns your problem — so this platform asks what went wrong and routes it itself."
        aside={
          state.grievances.length > 0 ? (
            <Badge tone="info">{state.grievances.length} raised</Badge>
          ) : null
        }
      />

      {/* ---------------- raise ---------------- */}
      <Card>
        <CardHeader
          title="What has gone wrong?"
          eyebrow="Step 1"
          description="Pick the closest match. Each one goes to a different desk."
        />
        <ul className="divide-y divide-[color:var(--line)]">
          {grievanceTopics.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => {
                  setTopic(t.id);
                  setSubmitted(null);
                }}
                className={cx(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                  topic === t.id ? "bg-plum-50" : "hover:bg-sunk",
                )}
              >
                <span
                  className={cx(
                    "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                    topic === t.id
                      ? "border-[color:var(--plum)] bg-[color:var(--plum)] ring-2 ring-inset ring-white"
                      : "border-line-strong",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{t.label}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-faint">
                    Goes to {t.routesTo} · usually {t.typicalDays} days
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {/* ---------------- before you raise ---------------- */}
      {meta ? (
        <>
          <Callout tone="warn" title="Before you raise this">
            {meta.beforeYouRaise}
          </Callout>

          <Card>
            <CardHeader
              title="Tell them what happened"
              eyebrow="Step 2"
              description="Specific grievances get resolved noticeably faster. Dates, amounts, reference numbers."
            />
            <div className="space-y-4 px-4 py-4">
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={placeholderFor(topic!)}
                className="w-full resize-none rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[14px] leading-relaxed placeholder:text-ink-faint focus:border-[color:var(--plum-400)]"
              />

              <div className="rounded-[var(--radius-sm)] border border-line bg-sunk px-3.5 py-3">
                <div className="eyebrow mb-1">Attached automatically</div>
                <Row label="PAN" value={`${state.profile.pan} (synthetic)`} />
                <Row
                  label="Assessment year"
                  value="2026-27"
                />
                <Row
                  label="Acknowledgement"
                  value={state.filing.acknowledgementNumber ?? "Return not yet filed"}
                />
                <Row label="Routed to" value={meta.routesTo} />
              </div>

              <Button
                block
                size="lg"
                onClick={() => {
                  const result = state.raiseGrievance(topic!, description);
                  if (result.ok) {
                    setSubmitted(result.detail ?? null);
                    setDescription("");
                    setTopic(null);
                  }
                }}
              >
                Raise grievance
              </Button>
              <p className="text-[11.5px] leading-snug text-ink-faint">
                Simulated. The ticket is created and tracked locally so you can see
                the flow; nothing reaches any authority.
              </p>
            </div>
          </Card>
        </>
      ) : null}

      {submitted ? (
        <Callout tone="ok" title={`Grievance ${submitted} raised`}>
          It is in the list below with a tracking number. You will normally get an
          acknowledgement immediately and a substantive reply within the window
          shown.
        </Callout>
      ) : null}

      {/* ---------------- track ---------------- */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[19px]">Your grievances</h2>
          {state.grievances.length > 0 ? (
            <Stat label="Open" value={state.grievances.length} />
          ) : null}
        </div>

        {state.grievances.length === 0 ? (
          <EmptyState
            title="Nothing raised yet"
            body="Which is the right number of grievances to have. If something does go wrong, this is where you would raise it and where you would watch it."
          />
        ) : (
          <div className="space-y-3">
            {state.grievances.map((g) => (
              <Card key={g.id}>
                <div className="px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="mono text-[13px] font-medium">{g.id}</span>
                        <Badge
                          tone={
                            g.status === "Resolved"
                              ? "ok"
                              : g.status === "Under review"
                                ? "info"
                                : "warn"
                          }
                        >
                          {g.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[14px] font-medium">
                        {g.topicLabel}
                      </div>
                      <div className="text-[12px] text-ink-faint">
                        Raised {shortDate(g.raisedOn)} · with {g.routesTo}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="eyebrow">Expected by</div>
                      <div className="text-[13px] font-medium">
                        {shortDate(
                          new Date(
                            new Date(g.raisedOn).getTime() +
                              g.expectedByDays * 86_400_000,
                          ).toISOString(),
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-2.5 rounded-[var(--radius-sm)] border border-line bg-sunk px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
                    {g.description}
                  </p>

                  <ol className="mt-3 space-y-1.5 border-t border-line pt-2.5">
                    {g.updates.map((u, i) => (
                      <li key={i} className="flex gap-2 text-[12.5px]">
                        <span className="text-ink-faint">
                          {shortDate(u.at)}
                        </span>
                        <span className="text-ink-soft">{u.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Callout tone="info" title="What a unified flow actually buys you" collapsible>
        Today, a refund delay goes to CPC through e-Nivaran, a rude officer goes to
        CPGRAMS, and a broken login goes to the helpdesk — and if you pick wrong,
        your grievance is closed with &ldquo;not related to this department&rdquo;
        after three weeks. Asking what went wrong instead of which portal you want
        removes an entire class of wasted time.{" "}
        <Link href="/help" className="font-medium underline underline-offset-2">
          More on how this works
        </Link>
        .
      </Callout>
    </div>
  );
}

function placeholderFor(topic: GrievanceTopicId): string {
  switch (topic) {
    case "refund-delay":
      return "My return for AY 2026-27 was verified on ... and the refund of ₹... has still not been credited. The account ending 4472 is validated and the status has said Processed since ...";
    case "ais-mismatch":
      return "My AIS shows interest of ₹... from ..., but the actual interest credited to my account was ₹... I have submitted feedback on the entry on ... and it has not been updated.";
    case "everify-failed":
      return "I am trying to e-verify with an Aadhaar OTP and no OTP arrives. My mobile number is ... and it is the number registered with Aadhaar.";
    case "demand-disagree":
      return "A demand of ₹... was raised under section 143(1) for AY ... The difference is because ... I have the following proof: ...";
    case "profile-login":
      return "I cannot sign in / my PAN shows as inoperative / my registered email is out of date. What I tried: ...";
    default:
      return "What you expected to happen, what happened instead, and when.";
  }
}
