"use client";

import Link from "next/link";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  PageHeader,
} from "@/components/ui";
import { useAppStore } from "@/lib/store/useAppStore";

/**
 * An honest "not built" screen. It is navigable, explains the boundary, and
 * says what does exist — never a dead link and never lorem ipsum.
 */
export function OutOfScope({
  eyebrow,
  title,
  lede,
  whatItWouldNeed,
  whatIsThere,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  whatItWouldNeed: string[];
  whatIsThere: { label: string; detail: string }[];
}) {
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        intro={lede}
        aside={<Badge tone="neutral">Out of scope</Badge>}
      />

      <Callout tone="warn" title="Being straight about it">
        This screen is deliberately empty of functionality rather than filled with
        a convincing-looking shell. If you file a real return with income of this
        kind, this prototype cannot help you with it.
      </Callout>

      <Card>
        <CardHeader
          title="What building it properly would take"
          eyebrow="Scope note"
        />
        <ul className="space-y-2.5 px-4 py-4">
          {whatItWouldNeed.map((item) => (
            <li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[color:var(--clay)]" />
              <span className="text-ink-soft">{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card tone="accent">
        <CardHeader title="What does exist around it" eyebrow="Already working" />
        <ul className="divide-y divide-[color:var(--line)]">
          {whatIsThere.map((item) => (
            <li key={item.label} className="px-4 py-3">
              <div className="text-[13.5px] font-semibold text-[color:var(--pine-ink)]">
                {item.label}
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/income"
          className="rounded-[var(--radius-sm)] border border-line-strong bg-surface px-4 py-2.5 text-[14px] font-medium hover:bg-sunk"
        >
          Back to income sources
        </Link>
        <Button variant="ghost" onClick={() => setCopilotOpen(true)}>
          Ask Sarathi what is covered
        </Button>
      </div>
    </div>
  );
}
