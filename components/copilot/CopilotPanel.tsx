"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, cx } from "@/components/ui";
import { buildScreenContext, summariseContext } from "@/lib/copilot/context";
import type { ToolCall, ToolOutcome } from "@/lib/copilot/tools";
import { useAppStore, type CopilotMessage } from "@/lib/store/useAppStore";
import { applyTool } from "./applyTool";

const rid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Screen-aware openers, so the panel is never a blank box. */
function suggestionsFor(module: string, pendingCount: number): string[] {
  const base: Record<string, string[]> = {
    dashboard: [
      "What still needs doing before I can file?",
      "Am I on the right tax regime?",
    ],
    reconciliation: [
      "What is the fixed deposit mismatch and should I accept it?",
      "Resolve the dividend difference for me",
    ],
    deductions: [
      "What am I missing that I could still claim?",
      "Add ₹50,000 under 80CCD(1B)",
    ],
    regime: [
      "Why is this regime cheaper for me?",
      "Switch me to the old regime",
    ],
    salary: ["Explain what standard deduction does here"],
    "other-sources": ["Is my savings interest taxable if no tax was cut?"],
    filing: ["Walk me through what I am about to submit"],
    refund: ["Where is my refund?"],
    notices: ["What does this notice actually want from me?"],
    grievance: ["My refund is late — raise a grievance about it"],
    help: ["What is the difference between AIS and 26AS?"],
    history: ["How did last year compare with this year?"],
    profile: ["Is my profile ready for filing?"],
  };
  const list = base[module] ?? [
    "What should I do on this screen?",
    "Explain this page in plain language",
  ];
  if (pendingCount > 0 && module !== "reconciliation") {
    return [`I have ${pendingCount} unresolved mismatches — help`, ...list].slice(
      0,
      3,
    );
  }
  return list.slice(0, 3);
}

export function CopilotPanel() {
  const router = useRouter();
  const pathname = usePathname();

  const open = useAppStore((s) => s.copilotOpen);
  const setOpen = useAppStore((s) => s.setCopilotOpen);
  const messages = useAppStore((s) => s.copilotMessages);
  const push = useAppStore((s) => s.pushCopilotMessage);
  const clear = useAppStore((s) => s.clearCopilot);
  const pendingCount = useAppStore(
    (s) =>
      Object.values(s.reconciliation).filter((r) => r.resolution === "pending")
        .length,
  );

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const moduleKey = useMemo(() => {
    if (pathname === "/") return "landing";
    const segment = pathname.split("/").filter(Boolean);
    return segment[segment.length - 1] || "dashboard";
  }, [pathname]);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      inputRef.current?.focus();
    }
  }, [open, messages.length, busy]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setInput("");
    setBusy(true);

    const userMessage: CopilotMessage = {
      id: rid(),
      role: "user",
      text: trimmed,
      at: new Date().toISOString(),
    };
    push(userMessage);

    const history = [...useAppStore.getState().copilotMessages].map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const navigate = (href: string) => router.push(href);

    try {
      const context = buildScreenContext(useAppStore.getState(), pathname);
      const first = await postChat({
        messages: history,
        context,
        contextSummary: summariseContext(context),
      });

      if (first.error) {
        push({
          id: rid(),
          role: "assistant",
          text: first.error,
          at: new Date().toISOString(),
          error: true,
        });
        return;
      }

      const calls: ToolCall[] = first.toolCalls ?? [];

      if (calls.length === 0) {
        push({
          id: rid(),
          role: "assistant",
          text: first.text || "I did not have anything useful to add there.",
          at: new Date().toISOString(),
        });
        return;
      }

      // The model asked for tools. Run them against the real store, then hand
      // the results back so it can describe what actually happened.
      const outcomes: ToolOutcome[] = calls.map((call) =>
        applyTool(call, navigate),
      );

      const afterContext = buildScreenContext(useAppStore.getState(), pathname);
      const second = await postChat({
        messages: history,
        context: afterContext,
        contextSummary: summariseContext(afterContext),
        pendingCalls: calls,
        functionResponses: outcomes.map((o) => ({
          name: o.name,
          response: o.result,
        })),
      });

      const actions = outcomes.map((o) => ({
        tool: o.name,
        summary: o.summary,
        ok: o.ok,
      }));

      push({
        id: rid(),
        role: "assistant",
        text:
          second.text ||
          first.text ||
          outcomes.map((o) => o.summary).join(". ") ||
          "Done.",
        at: new Date().toISOString(),
        actions,
        error: Boolean(second.error),
      });
    } catch (error) {
      push({
        id: rid(),
        role: "assistant",
        text:
          error instanceof Error
            ? `Something went wrong reaching the copilot service: ${error.message}`
            : "Something went wrong reaching the copilot service.",
        at: new Date().toISOString(),
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  const suggestions = suggestionsFor(moduleKey, pendingCount);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-[color:var(--ink)]/25 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        aria-label="Sarathi copilot"
        aria-hidden={!open}
        className={cx(
          "fixed bottom-0 right-0 z-50 flex w-full flex-col border-line bg-surface transition-transform duration-200 ease-out",
          "h-[82vh] rounded-t-[var(--radius-lg)] border-t shadow-[var(--shadow-lg)]",
          "sm:h-[min(38rem,88vh)] sm:bottom-4 sm:right-4 sm:w-[24rem] sm:rounded-[var(--radius-lg)] sm:border",
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-[110%] opacity-0 sm:translate-y-4",
        )}
      >
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <CopilotMark />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[15px] font-semibold">Sarathi</span>
              <Badge tone="pine">copilot</Badge>
            </div>
            <p className="truncate text-[11.5px] text-ink-faint">
              Reading your live return · {moduleKey}
            </p>
          </div>
          {messages.length > 0 ? (
            <button
              onClick={clear}
              className="text-[12px] text-ink-faint hover:text-ink-soft"
            >
              Clear
            </button>
          ) : null}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close copilot"
            className="rounded-full p-1 text-ink-faint hover:bg-sunk hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div
          ref={scrollRef}
          className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="animate-rise">
              <p className="text-[13.5px] leading-relaxed text-ink-soft">
                I can see the screen you are on and the numbers in your return, and
                I can change them for you — switch regime, accept an AIS figure, add
                a deduction, raise a grievance. Ask in plain words.
              </p>
              <div className="mt-3 space-y-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="block w-full rounded-[var(--radius-sm)] border border-line bg-sunk px-3 py-2 text-left text-[13px] text-ink-soft transition-colors hover:border-pine-100 hover:bg-pine-50 hover:text-[color:var(--pine-ink)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {busy ? (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-faint">
              <span className="animate-pulse-dot">●</span> thinking, and checking
              your numbers
            </div>
          ) : null}
        </div>

        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask about your return, or tell me to change it"
              className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-2.5 text-[14px] placeholder:text-ink-faint focus:border-[color:var(--pine-400)]"
            />
            <Button
              type="submit"
              size="md"
              disabled={busy || !input.trim()}
              className="h-[42px] px-3"
              aria-label="Send"
            >
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 10h13M11 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-snug text-ink-faint">
            General guidance on a synthetic return, not professional tax advice.
          </p>
        </form>
      </aside>
    </>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[var(--radius)] rounded-br-sm bg-[color:var(--pine)] px-3 py-2 text-[13.5px] leading-relaxed text-white">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-2">
      <div
        className={cx(
          "max-w-[92%] rounded-[var(--radius)] rounded-bl-sm border px-3 py-2 text-[13.5px] leading-relaxed",
          message.error
            ? "border-[color:var(--alert)]/25 bg-alert-50 text-ink-soft"
            : "border-line bg-sunk text-ink",
        )}
      >
        {message.text.split("\n").map((line, i) =>
          line.trim() ? (
            <p key={i} className={i > 0 ? "mt-1.5" : undefined}>
              {line}
            </p>
          ) : null,
        )}
      </div>

      {message.actions?.length ? (
        <ul className="space-y-1">
          {message.actions.map((a, i) => (
            <li
              key={i}
              className={cx(
                "flex items-start gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-[11.5px]",
                a.ok
                  ? "border-pine-100 bg-pine-50 text-[color:var(--pine-ink)]"
                  : "border-[color:var(--alert)]/25 bg-alert-50 text-[color:var(--alert)]",
              )}
            >
              <span className="mt-px">{a.ok ? "✓" : "✕"}</span>
              <span>
                <span className="mono opacity-70">{a.tool}</span> — {a.summary}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CopilotMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--pine)] text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 3.5l2.1 4.9 5.4.5-4.1 3.5 1.2 5.2L12 14.9l-4.6 2.7 1.2-5.2-4.1-3.5 5.4-.5L12 3.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* ---------------------------------------------------------------- */

type ChatResponse = {
  text?: string;
  toolCalls?: ToolCall[];
  configured?: boolean;
  error?: string;
  detail?: string;
};

async function postChat(body: unknown): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok) {
    return {
      error: [data.error, data.detail].filter(Boolean).join(" ") ||
        `The copilot service returned ${res.status}.`,
    };
  }
  return data;
}
