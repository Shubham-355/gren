"use client";

import { cx } from "@/components/ui";
import { useAppStore } from "@/lib/store/useAppStore";
import { CopilotStar } from "./AppShell";

/**
 * Every state change surfaces here, so cause and effect is visible to someone
 * watching the screen rather than reading the chat. Copilot-authored changes
 * carry the copilot's petrol mark so it is never ambiguous who did what.
 */
export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  const tones = {
    info: "border-line bg-surface",
    success: "border-ok-100 bg-ok-50",
    warn: "border-warn-100 bg-warn-50",
    alert: "border-alert-100 bg-alert-50",
    copilot: "border-petrol-100 bg-petrol-50",
  } as const;

  return (
    <div
      className="pointer-events-none fixed bottom-[9.5rem] left-1/2 z-[60] flex w-[min(24rem,92vw)] -translate-x-1/2 flex-col gap-2 lg:bottom-24 lg:left-6 lg:translate-x-0"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "animate-rise pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius)] border px-4 py-3 shadow-[var(--shadow-lg)]",
            tones[t.tone],
          )}
        >
          {t.tone === "copilot" ? (
            <span className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-[color:var(--petrol)] text-white">
              <CopilotStar size={13} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-ink">{t.title}</div>
            {t.body ? (
              <div className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
                {t.body}
              </div>
            ) : null}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="-mr-1 shrink-0 rounded p-0.5 text-ink-faint hover:text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
