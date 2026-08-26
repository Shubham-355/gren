"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DemoTag,
  PageHeader,
  Row,
  cx,
} from "@/components/ui";
import type { Notice } from "@/lib/data/seed";
import { daysUntil, shortDate } from "@/lib/format";
import { useAppStore } from "@/lib/store/useAppStore";

export function NoticeDetail({ notice }: { notice: Notice }) {
  const state = useAppStore();
  const noticeState = state.notices[notice.id];
  const status = noticeState?.status ?? notice.status;

  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [showFormal, setShowFormal] = useState(false);

  const days = notice.respondBy ? daysUntil(notice.respondBy) : null;
  const canRespond = notice.requiresResponse && status === "Open";

  return (
    <div className="space-y-5">
      <Link
        href="/notices"
        className="inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink"
      >
        ← All notices
      </Link>

      <PageHeader
        eyebrow={`${notice.section} · AY ${notice.assessmentYear}`}
        title={notice.title}
        aside={
          <Badge
            tone={
              status === "Responded"
                ? "info"
                : status === "Closed"
                  ? "neutral"
                  : "warn"
            }
          >
            {status}
          </Badge>
        }
      />

      {/* ---------- plain language first ---------- */}
      <Card tone={notice.requiresResponse ? "accent" : "ok"}>
        <div className="px-4 py-4">
          <div className="eyebrow">In plain language</div>
          <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-ink">
            {notice.plainLanguage}
          </p>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 sm:grid-cols-4">
          <Meta label="Reference" value={notice.reference} mono demo />
          <Meta label="Issued" value={shortDate(notice.issuedOn)} />
          <Meta
            label="Respond by"
            value={notice.respondBy ? shortDate(notice.respondBy) : "Not required"}
            tone={days !== null && days <= 7 ? "alert" : undefined}
          />
          <Meta label="Assessment year" value={notice.assessmentYear} />
        </div>
      </Card>

      {days !== null && canRespond ? (
        <Callout
          tone={days <= 7 ? "alert" : days <= 21 ? "warn" : "info"}
          title={
            days > 0
              ? `${days} days to respond`
              : "The window to respond has closed"
          }
        >
          {days > 0
            ? "Responding on time keeps this at the nudge stage. Ignoring an e-Campaign message is what turns it into a formal notice and, eventually, a reassessment under section 148."
            : "You can still respond. A late response is better than none, and the department generally accepts one where the underlying position is correct."}
        </Callout>
      ) : null}

      {/* ---------- formal text ---------- */}
      <Card>
        <CardHeader
          title="The notice as issued"
          eyebrow="Formal text"
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFormal(!showFormal)}
            >
              {showFormal ? "Hide" : "Show"}
            </Button>
          }
        />
        {showFormal ? (
          <div className="px-4 py-4">
            <p className="whitespace-pre-line rounded-[var(--radius-sm)] border border-line bg-sunk p-3.5 text-[13px] leading-relaxed text-ink-soft">
              {notice.detail}
            </p>
            <p className="mt-2 text-[11.5px] text-ink-faint">
              Synthetic text written for this prototype in the register a real
              notice uses. It is not a copy of any actual departmental
              communication. <DemoTag />
            </p>
          </div>
        ) : null}
      </Card>

      {/* ---------- respond ---------- */}
      {canRespond ? (
        <Card>
          <CardHeader
            title="How do you want to respond?"
            description="Pick the one that matches your situation. The wording is generated for you."
          />
          <div className="space-y-4 px-4 py-4">
            <ul className="space-y-2">
              {notice.suggestedActions.map((action) => (
                <li key={action}>
                  <button
                    onClick={() => setSelected(action)}
                    className={cx(
                      "flex w-full items-start gap-3 rounded-[var(--radius-sm)] border px-3.5 py-3 text-left transition-colors",
                      selected === action
                        ? "border-[color:var(--plum)] bg-plum-50"
                        : "border-line bg-surface hover:bg-sunk",
                    )}
                  >
                    <span
                      className={cx(
                        "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                        selected === action
                          ? "border-[color:var(--plum)] bg-[color:var(--plum)] ring-2 ring-inset ring-white"
                          : "border-line-strong",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">
                        {action}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">
                        {consequenceOf(action)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">
                Anything to add? <span className="text-ink-faint">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="For example: the fixed deposit is a joint account and the interest is declared by the first holder."
                className="w-full resize-none rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-[color:var(--plum-400)]"
              />
            </div>

            <Button
              block
              size="lg"
              disabled={!selected}
              onClick={() =>
                state.respondToNotice(
                  notice.id,
                  [selected, detail.trim()].filter(Boolean).join(" — "),
                )
              }
            >
              Submit response
            </Button>
            <p className="text-[11.5px] leading-snug text-ink-faint">
              Simulated. Nothing is sent to any authority; the response is stored in
              this browser so you can see the notice change state.
            </p>
          </div>
        </Card>
      ) : null}

      {noticeState?.response ? (
        <Card tone="ok">
          <CardHeader
            title="Your response"
            eyebrow={
              noticeState.respondedOn
                ? `Submitted ${shortDate(noticeState.respondedOn)}`
                : undefined
            }
          />
          <div className="px-4 py-3.5">
            <p className="text-[13.5px] leading-relaxed text-ink">
              {noticeState.response}
            </p>
            <div className="mt-3 border-t border-line pt-2.5">
              <Row
                label="What happens next"
                value="Acknowledged within 30 days"
                note="A real response is logged against the e-Proceedings tab and either closed or followed up by the assessing officer."
              />
            </div>
          </div>
        </Card>
      ) : null}

      {!notice.requiresResponse ? (
        <Callout tone="ok" title="Nothing is required from you">
          Keep this with your records for the year. If you ever disagree with an
          intimation like this one, the route is a rectification request under
          section 154, not a grievance.
        </Callout>
      ) : null}

      {notice.id === "notice-ecampaign-interest" ? (
        <Callout tone="plum" title="This one connects to something you can fix now">
          The interest in this notice is the same entry sitting unresolved in your{" "}
          <Link
            href="/reconciliation"
            className="font-medium underline underline-offset-2"
          >
            AIS reconciliation
          </Link>
          . Accept it there and the underlying problem goes away, whatever you say
          in the response.
        </Callout>
      ) : null}
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  demo,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  demo?: boolean;
  tone?: "alert";
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div
        className={cx(
          "mt-0.5 text-[13px]",
          mono && "mono text-[11.5px]",
          tone === "alert" && "font-medium text-[color:var(--alert)]",
        )}
      >
        {value}
        {demo ? <DemoTag /> : null}
      </div>
    </div>
  );
}

function consequenceOf(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("add"))
    return "The income goes into your return, the related tax credit comes with it, and the department's records and yours agree.";
  if (a.includes("confirm"))
    return "You agree the information is accurate. You still have to reflect it in the return itself.";
  if (a.includes("disagree") || a.includes("does not belong"))
    return "Feedback goes back to whoever reported it. They have to confirm or correct it, which takes time but leaves your return unchanged.";
  if (a.includes("keep"))
    return "Filed with your records. No submission is made.";
  return "Recorded against this notice.";
}
