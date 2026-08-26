"use client";

import { cx } from "@/components/ui";
import { inr } from "@/lib/format";
import { useAppStore, type ActionLogEntry } from "@/lib/store/useAppStore";

/**
 * The persistent action timeline (§5.3).
 *
 * Chat scrolls away; a workflow should not. Every change — yours, the
 * copilot's, or the system's — lands here with a timestamp, what it did to
 * your tax, a one-tap "Why?" into the arithmetic, and an "Undo" wherever the
 * action is reversible. This is what makes Tier 2's "visibly surfaced and
 * easily undoable" actually true rather than a claim in a chat bubble.
 */

const actorStyle = {
  you: { label: "You", dot: "bg-[color:var(--plum)]", text: "text-[color:var(--plum)]" },
  copilot: {
    label: "Copilot",
    dot: "bg-[color:var(--petrol)]",
    text: "text-[color:var(--petrol)]",
  },
  system: { label: "System", dot: "bg-line-strong", text: "text-ink-faint" },
} as const;

function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}

export function TimelineEntry({
  entry,
  compact,
}: {
  entry: ActionLogEntry;
  compact?: boolean;
}) {
  const undoAction = useAppStore((s) => s.undoAction);
  const openWhy = useAppStore((s) => s.openWhy);
  const setOpenWhy = useAppStore((s) => s.setOpenWhy);

  const actor = actorStyle[entry.actor] ?? actorStyle.system;
  const whyOpen = openWhy === entry.id;

  return (
    <li className="flex gap-3">
      <div className="flex w-[11px] shrink-0 flex-col items-center">
        <span
          className={cx(
            "mt-1.5 h-2.5 w-2.5 rounded-full",
            entry.undone ? "bg-line-strong" : actor.dot,
          )}
        />
        <span className="w-px flex-1 bg-[color:var(--line)]" />
      </div>

      <div className={cx("min-w-0 flex-1", compact ? "pb-4" : "pb-5")}>
        <div className="flex items-baseline gap-2">
          <span
            className={cx(
              "text-[11px] font-semibold uppercase tracking-[0.05em]",
              actor.text,
            )}
          >
            {actor.label}
          </span>
          <span className="tnum text-[11px] text-ink-faint">
            {clockTime(entry.at)}
          </span>
          {entry.undone ? (
            <span className="text-[11px] text-ink-faint">· undone</span>
          ) : null}
        </div>

        <div
          className={cx(
            "mt-1 text-[14px] leading-snug",
            entry.undone && "text-ink-faint line-through",
          )}
        >
          {entry.summary}
        </div>

        {entry.delta !== undefined && entry.delta !== 0 && !entry.undone ? (
          <div
            className={cx(
              "tnum mt-0.5 text-[12.5px] font-medium",
              entry.delta < 0
                ? "text-[color:var(--ok)]"
                : "text-[color:var(--alert)]",
            )}
          >
            {entry.delta < 0 ? "−" : "+"}
            {inr(Math.abs(entry.delta))} tax due
          </div>
        ) : null}

        {entry.undo || entry.why ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {entry.undo && !entry.undone ? (
              <button
                onClick={() => undoAction(entry.id)}
                className="border-b border-[color:var(--plum-line)] text-[12.5px] font-semibold text-[color:var(--plum)] hover:border-[color:var(--plum)]"
              >
                Undo
              </button>
            ) : null}
            {entry.why ? (
              <button
                onClick={() => setOpenWhy(whyOpen ? null : entry.id)}
                aria-expanded={whyOpen}
                className="border-b border-[color:var(--petrol-line)] text-[12.5px] font-semibold text-[color:var(--petrol)] hover:border-[color:var(--petrol)]"
              >
                {whyOpen ? "Hide the working" : "Why?"}
              </button>
            ) : null}
          </div>
        ) : null}

        {whyOpen && entry.why ? (
          <p className="animate-rise mt-2.5 rounded-[var(--radius-sm)] border border-petrol-100 bg-petrol-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
            {entry.why}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function TimelineList({
  limit,
  compact,
}: {
  limit?: number;
  compact?: boolean;
}) {
  const log = useAppStore((s) => s.actionLog);
  const entries = limit ? log.slice(0, limit) : log;

  if (entries.length === 0) {
    return (
      <p className="px-1 py-4 text-[13px] leading-relaxed text-ink-faint">
        Nothing has changed yet. Every edit you or the copilot makes appears
        here, with a way to undo it.
      </p>
    );
  }

  return (
    <ul className="[&>li:last-child>div:first-child>span:last-child]:hidden">
      {entries.map((e) => (
        <TimelineEntry key={e.id} entry={e} compact={compact} />
      ))}
    </ul>
  );
}

/** The always-visible desktop rail. */
export function TimelineRail() {
  const count = useAppStore((s) => s.actionLog.filter((a) => !a.undone).length);
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);

  return (
    <aside className="hidden w-[300px] shrink-0 2xl:flex 2xl:flex-col">
      <div className="sticky top-[124px] flex max-h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-[var(--radius)] border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="text-[14.5px] font-semibold">Activity</span>
          <span className="tnum ml-auto text-[12.5px] text-ink-faint">
            {count} {count === 1 ? "change" : "changes"}
          </span>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto px-4 py-4">
          <TimelineList compact />
        </div>

        <button
          onClick={() => setCopilotOpen(true)}
          className="border-t border-petrol-edge bg-petrol-soft px-4 py-3.5 text-left"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-[color:var(--petrol)] text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3.5l2.1 4.9 5.4.5-4.1 3.5 1.2 5.2L12 14.9l-4.6 2.7 1.2-5.2-4.1-3.5 5.4-.5z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-[13.5px] font-semibold text-[color:var(--petrol-ink)]">
              Open copilot
            </span>
          </span>
          <span className="mt-2 block text-[11.5px] leading-snug text-[color:var(--petrol-400)]">
            AI copilot — review anything it changes before you confirm.
          </span>
        </button>
      </div>
    </aside>
  );
}

/** The phone version: a bottom sheet raised from the header button. */
export function TimelineSheet() {
  const open = useAppStore((s) => s.timelineOpen);
  const setOpen = useAppStore((s) => s.setTimelineOpen);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 2xl:hidden" role="dialog" aria-label="Activity">
      <div
        className="absolute inset-0 bg-[color:var(--ink)]/30"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className="animate-rise absolute bottom-0 left-0 right-0 max-h-[84vh] overflow-y-auto rounded-t-[var(--radius-sheet)] border-t border-line bg-surface pb-8">
        <div className="sticky top-0 z-10 bg-surface pt-3">
          <div className="flex justify-center">
            <span className="h-1 w-9 rounded-full bg-line-strong" />
          </div>
          <div className="mt-3.5 flex items-baseline justify-between border-b border-line px-5 pb-3">
            <span className="font-display text-[23px]">Activity</span>
            <button
              onClick={() => setOpen(false)}
              className="text-[13px] text-ink-faint"
            >
              Close
            </button>
          </div>
        </div>
        <div className="px-5 pt-4">
          <TimelineList />
        </div>
      </div>
    </div>
  );
}
