"use client";

import { cx } from "@/components/ui";
import { useAppStore } from "@/lib/store/useAppStore";

/**
 * Every state change the copilot makes surfaces here, so cause and effect is
 * visible to someone watching the screen rather than reading the chat.
 */
export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  const tones = {
    info: "border-line bg-surface",
    success: "border-[color:var(--ok)]/30 bg-ok-50",
    warn: "border-[color:var(--warn)]/30 bg-warn-50",
    alert: "border-[color:var(--alert)]/30 bg-alert-50",
    copilot: "border-pine-100 bg-pine-50",
  } as const;

  return (
    <div
      className="pointer-events-none fixed bottom-[9.5rem] left-1/2 z-[60] flex w-[min(24rem,92vw)] -translate-x-1/2 flex-col gap-2 lg:bottom-6 lg:left-6 lg:translate-x-0"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "animate-rise pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius)] border px-3.5 py-2.5 shadow-[var(--shadow-lg)]",
            tones[t.tone],
          )}
        >
          {t.tone === "copilot" ? (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--pine)] text-[10px] font-bold text-white">
              S
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink">{t.title}</div>
            {t.body ? (
              <div className="mt-0.5 text-[12px] leading-snug text-ink-soft">
                {t.body}
              </div>
            ) : null}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="-mr-1 shrink-0 rounded p-0.5 text-ink-faint hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
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
