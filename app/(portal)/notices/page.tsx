"use client";

import Link from "next/link";

import {
  Badge,
  Callout,
  Card,
  DemoTag,
  PageHeader,
  Stat,
  Term,
  cx,
} from "@/components/ui";
import { notices } from "@/lib/data/seed";
import { daysUntil, shortDate } from "@/lib/format";
import { useAppStore } from "@/lib/store/useAppStore";

export default function NoticesPage() {
  const state = useAppStore();

  const open = notices.filter(
    (n) => state.notices[n.id]?.status === "Open" && n.requiresResponse,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="After filing"
        title="What the department has sent you"
        intro="A letter from the tax department is frightening mostly because of how it is written. Every notice here is rewritten in plain language first, with the formal text kept underneath for when you need it."
        aside={
          <Badge tone={open.length > 0 ? "warn" : "ok"}>
            {open.length > 0 ? `${open.length} needs a reply` : "Nothing pending"}
          </Badge>
        }
      />

      <Card tone={open.length > 0 ? "alert" : "ok"}>
        <div className="grid grid-cols-3 gap-4 px-4 py-3.5">
          <Stat label="Total" value={notices.length} tag={<DemoTag />} />
          <Stat
            label="Need a reply"
            value={open.length}
            tone={open.length > 0 ? "alert" : "ok"}
          />
          <Stat
            label="Responded"
            value={
              Object.values(state.notices).filter(
                (n) => n.status === "Responded",
              ).length
            }
          />
        </div>
      </Card>

      <div className="space-y-3">
        {notices.map((notice) => {
          const s = state.notices[notice.id];
          const days = notice.respondBy ? daysUntil(notice.respondBy) : null;
          const needsReply = s?.status === "Open" && notice.requiresResponse;

          return (
            <Link key={notice.id} href={`/notices/${notice.id}`} className="block">
              <Card
                tone={needsReply ? "alert" : "plain"}
                className="transition-colors hover:border-plum-100"
              >
                <div className="px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={needsReply ? "warn" : s?.status === "Responded" ? "info" : "neutral"}>
                      {notice.section}
                    </Badge>
                    <Badge
                      tone={
                        s?.status === "Responded"
                          ? "info"
                          : s?.status === "Closed"
                            ? "neutral"
                            : "warn"
                      }
                    >
                      {s?.status ?? notice.status}
                    </Badge>
                    <span className="text-[11.5px] text-ink-faint">
                      AY {notice.assessmentYear} · issued {shortDate(notice.issuedOn)}
                    </span>
                    <DemoTag />
                  </div>

                  <h2 className="mt-1.5 text-[15.5px] font-semibold leading-snug">
                    {notice.title}
                  </h2>

                  <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-ink-soft">
                    {notice.plainLanguage}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    {days !== null ? (
                      <span
                        className={cx(
                          "text-[12px] font-medium",
                          days <= 7
                            ? "text-[color:var(--alert)]"
                            : days <= 21
                              ? "text-[color:var(--warn)]"
                              : "text-ink-faint",
                        )}
                      >
                        {days > 0
                          ? `Respond within ${days} days`
                          : "The response window has closed"}
                      </span>
                    ) : (
                      <span className="text-[12px] text-ink-faint">
                        No response needed
                      </span>
                    )}
                    <span className="mono text-[11px] text-ink-faint">
                      {notice.reference}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Callout tone="info" title="Most notices are not what people fear">
        The overwhelming majority are automated: an{" "}
        <Term name="Intimation u/s 143(1)">intimation under 143(1)</Term> confirming
        the arithmetic, or an e-Campaign nudge saying a figure the department holds
        is missing from your return. Neither is an audit. Both are resolved by
        replying, and both get much worse if you ignore them.
      </Callout>
    </div>
  );
}
