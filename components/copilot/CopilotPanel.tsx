"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CopilotStar } from "@/components/shell/AppShell";
import { cx } from "@/components/ui";
import { buildScreenContext, summariseContext } from "@/lib/copilot/context";
import type { ToolCall, ToolOutcome } from "@/lib/copilot/tools";
import { useAppStore, type CopilotMessage } from "@/lib/store/useAppStore";
import { applyTool } from "./applyTool";

const rid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * How many rounds of tool use one instruction may take before we stop and hand
 * back whatever has been done. "Just file it for me" on an empty return is
 * import, three mismatches, eight deduction answers, a regime and a
 * prepare_submission — comfortably inside this, while still bounding what a
 * confused model can spend.
 */
const MAX_TOOL_ROUNDS = 8;

/** Screen-aware openers, so the panel is never a blank box. */
function suggestionsFor(module: string, pendingCount: number): string[] {
  const base: Record<string, string[]> = {
    dashboard: [
      "What still needs doing before I can file?",
      "Just file it for me",
    ],
    reconciliation: [
      "What is the fixed deposit difference and should I accept it?",
      "Settle all three for me",
    ],
    deductions: [
      "What else could I still claim?",
      "Add ₹50,000 under 80CCD(1B)",
    ],
    regime: [
      "Show me the slab-by-slab working",
      "Which regime is cheaper? Just put me on it",
    ],
    salary: ["Explain what the standard deduction does here"],
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
    return [
      `I have ${pendingCount} unresolved differences — help`,
      ...list,
    ].slice(0, 3);
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
  const actionCount = useAppStore(
    (s) => s.actionLog.filter((a) => a.actor === "copilot" && !a.undone).length,
  );
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

    push({
      id: rid(),
      role: "user",
      text: trimmed,
      at: new Date().toISOString(),
    });

    const history = [...useAppStore.getState().copilotMessages].map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const navigate = (href: string) => router.push(href);

    try {
      const rounds: ToolRound[] = [];
      const actions: NonNullable<CopilotMessage["actions"]> = [];
      let reply: ChatResponse | null = null;

      // The agent loop. Each pass the model either asks for tools or answers;
      // tools are run against the real store and the results fed back, so a
      // single instruction can walk several steps of the journey.
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const context = buildScreenContext(useAppStore.getState(), pathname);
        const response = await postChat({
          messages: history,
          context,
          contextSummary: summariseContext(context),
          toolRounds: rounds,
        });

        if (response.error) {
          push({
            id: rid(),
            role: "assistant",
            text: response.error,
            at: new Date().toISOString(),
            actions: actions.length ? actions : undefined,
            error: true,
          });
          return;
        }

        reply = response;
        const calls: ToolCall[] = response.toolCalls ?? [];
        if (calls.length === 0) break;

        const outcomes: ToolOutcome[] = calls.map((call) =>
          applyTool(call, navigate),
        );
        actions.push(
          ...outcomes.map((o) => ({
            tool: o.name,
            summary: o.summary,
            ok: o.ok,
            logId: o.logId,
          })),
        );
        rounds.push({
          modelParts: response.modelParts,
          pendingCalls: calls,
          functionResponses: outcomes.map((o) => ({
            name: o.name,
            response: o.result,
          })),
        });
      }

      push({
        id: rid(),
        role: "assistant",
        text:
          reply?.text ||
          (actions.length
            ? actions.map((a) => a.summary).join(". ")
            : "I did not have anything useful to add there."),
        at: new Date().toISOString(),
        actions: actions.length ? actions : undefined,
      });
    } catch (error) {
      push({
        id: rid(),
        role: "assistant",
        text:
          error instanceof Error
            ? `I could not reach my service: ${error.message}. Nothing in your return was changed — the screens still work on their own.`
            : "I could not reach my service. Nothing in your return was changed.",
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
          className="fixed inset-0 z-40 bg-[color:var(--ink)]/25 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        aria-label="Saathi, the AI assistant"
        aria-hidden={!open}
        className={cx(
          "fixed bottom-0 right-0 z-50 flex w-full flex-col bg-surface transition-transform duration-200 ease-out",
          "h-[85dvh] rounded-t-[var(--radius-sheet)] border-t-[3px] border-[color:var(--petrol)] shadow-[var(--shadow-lg)]",
          "lg:top-0 lg:h-dvh lg:w-[26rem] lg:rounded-none lg:border-l-[3px] lg:border-t-0 lg:shadow-[var(--shadow-copilot)]",
          open
            ? "translate-y-0 opacity-100 lg:translate-x-0"
            : "pointer-events-none translate-y-[110%] opacity-0 lg:translate-x-full lg:translate-y-0 lg:opacity-100",
        )}
      >
        {/* ------------------------------ header ------------------------------ */}
        <header className="flex items-center gap-3 border-b border-petrol-100 bg-petrol-50 px-5 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[color:var(--petrol)] text-white">
            <CopilotStar size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-[color:var(--petrol)]">
              Saathi
            </div>
            <p className="truncate text-[12px] text-ink-soft">
              Reading your live return · {moduleKey}
            </p>
          </div>
          {actionCount > 0 ? (
            <span className="hidden text-[12.5px] text-[color:var(--petrol-400)] sm:block">
              {actionCount} {actionCount === 1 ? "action" : "actions"}
            </span>
          ) : null}
          {messages.length > 0 ? (
            <button
              onClick={clear}
              className="text-[12.5px] text-ink-faint hover:text-ink-soft"
            >
              Clear
            </button>
          ) : null}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close copilot"
            className="rounded-full p-1 text-ink-soft hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* the persistent "this is an AI" label required by §5.4 */}
        <p className="border-b border-petrol-edge bg-petrol-soft px-5 py-2.5 text-[12px] text-[color:var(--petrol-400)]">
          Saathi is an AI — review anything it changes before you confirm.
        </p>

        <div
          ref={scrollRef}
          className="thin-scroll flex-1 space-y-3.5 overflow-y-auto px-5 py-5"
        >
          {messages.length === 0 ? (
            <div className="animate-rise">
              <p className="text-[14px] leading-relaxed text-ink-soft">
                I can see the screen you are on and the numbers in your return,
                and I can change them — switch regime, settle an AIS difference,
                add a deduction, raise a grievance. Filing, verifying and paying
                stay with you.
              </p>
              <div className="mt-4 space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="block w-full rounded-[var(--radius-sm)] border border-line bg-paper px-3.5 py-2.5 text-left text-[13.5px] text-ink-soft transition-colors hover:border-petrol-100 hover:bg-petrol-50 hover:text-[color:var(--petrol-text)]"
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

        {messages.length > 0 && !busy ? (
          <div className="space-y-2 border-t border-line px-5 pt-3">
            {suggestions.slice(0, 2).map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="block w-full rounded-[var(--radius-sm)] border border-line bg-paper px-3.5 py-2.5 text-left text-[13.5px] text-ink-soft hover:bg-sunk"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="border-t border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-end gap-2.5">
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
              placeholder="Ask, or tell me to change something"
              className="max-h-28 min-h-[46px] flex-1 resize-none rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3.5 py-3 text-[14px] placeholder:text-ink-faint focus:border-[color:var(--petrol)]"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--petrol)] text-white transition-colors hover:bg-[color:var(--petrol-ink)] disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 10h13M11 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            Actions are logged and reversible. Filing, e-verifying and paying
            always stop for your tap. General guidance, not tax advice.
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
        <div className="max-w-[84%] rounded-[16px] rounded-br-[4px] bg-[color:var(--plum)] px-3.5 py-2.5 text-[14px] leading-relaxed text-white">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-2.5">
      <div
        className={cx(
          "max-w-[92%] rounded-[16px] rounded-bl-[4px] border px-3.5 py-3 text-[14px] leading-relaxed",
          message.error
            ? "border-alert-100 bg-alert-50 text-ink-soft"
            : "border-petrol-edge bg-white text-[color:var(--petrol-text)]",
        )}
      >
        {message.text.split("\n").map((line, i) =>
          line.trim() ? (
            <p key={i} className={i > 0 ? "mt-2" : undefined}>
              {renderEmphasis(line)}
            </p>
          ) : null,
        )}
      </div>

      {message.actions?.length ? (
        <div className="rounded-[14px] bg-petrol-50 px-3.5 py-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[color:var(--petrol-400)]">
            Actions taken
          </div>
          <ul className="mt-2 space-y-2">
            {message.actions.map((a, i) => (
              <ActionRow key={i} action={a} />
            ))}
          </ul>
          <p className="mt-2.5 text-[11.5px] leading-snug text-[color:var(--petrol-400)]">
            Estimated from what you have told me so far. Everything reversible
            is marked so.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Models reach for **bold** even when asked not to, and a stray pair of
 * asterisks around a rupee figure reads as a bug. Render the emphasis rather
 * than printing the markup — and nothing else, because nothing else belongs in
 * a chat bubble this size.
 */
function renderEmphasis(line: string) {
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      ),
    );
}

function ActionRow({
  action,
}: {
  action: NonNullable<CopilotMessage["actions"]>[number];
}) {
  const entry = useAppStore((s) =>
    action.logId ? s.actionLog.find((a) => a.id === action.logId) : undefined,
  );
  const undoAction = useAppStore((s) => s.undoAction);

  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cx(
          "mt-px shrink-0 text-[13px] font-bold",
          action.ok
            ? "text-[color:var(--petrol)]"
            : "text-[color:var(--alert)]",
        )}
      >
        {action.ok ? "✓" : "✕"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mono block text-[11px] text-[color:var(--petrol-400)]">
          {action.tool}
        </span>
        <span
          className={cx(
            "mt-0.5 block text-[13.5px] leading-snug",
            entry?.undone
              ? "text-ink-faint line-through"
              : "text-[color:var(--petrol-ink)]",
          )}
        >
          {action.summary}
        </span>
      </span>
      {entry?.undo && !entry.undone ? (
        <button
          onClick={() => undoAction(entry.id)}
          className="shrink-0 text-[12.5px] font-semibold text-[color:var(--petrol)] underline underline-offset-2"
        >
          Undo
        </button>
      ) : null}
    </li>
  );
}

/* ---------------------------------------------------------------- */

type ToolRound = {
  modelParts?: Record<string, unknown>[];
  pendingCalls: ToolCall[];
  functionResponses: { name: string; response: Record<string, unknown> }[];
};

type ChatResponse = {
  text?: string;
  toolCalls?: ToolCall[];
  /** the model's own turn, handed straight back on the second phase */
  modelParts?: Record<string, unknown>[];
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
      error:
        [data.error, data.detail].filter(Boolean).join(" ") ||
        `Saathi's service returned ${res.status}.`,
    };
  }
  return data;
}
