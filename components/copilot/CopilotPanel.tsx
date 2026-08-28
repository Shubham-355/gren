"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { CopilotStar } from "@/components/shell/AppShell";
import { cx } from "@/components/ui";
import { buildScreenContext, summariseContext } from "@/lib/copilot/context";
import { respondLocally } from "@/lib/copilot/fallback";
import { FLOW_STEPS, stepDone } from "@/lib/flow";
import { inr } from "@/lib/format";
import type { ToolCall, ToolOutcome } from "@/lib/copilot/tools";
import { discoveryQuestions } from "@/lib/data/discovery";
import {
  pendingMismatches,
  toTaxpayerInput,
  useAppStore,
  type AppState,
  type CopilotMessage,
} from "@/lib/store/useAppStore";
import { compareRegimes } from "@/lib/tax/compute";
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

function moduleKeyOf(pathname: string): string {
  if (pathname === "/") return "landing";
  const segment = pathname.split("/").filter(Boolean);
  return segment[segment.length - 1] || "dashboard";
}

/**
 * What to offer, and when to offer nothing.
 *
 * These used to be a fixed list per screen, which meant they went stale the
 * moment anything was done — offering to settle three differences that were
 * already settled, or to file a return that was already filed. They are now
 * derived from where the return actually is, so a chip is never a dead end.
 */
function buildSuggestions(state: AppState, module: string): string[] {
  // While an irreversible step is waiting on a tap, the answer is on the card,
  // not in the chat. Offering conversation here would pull attention off it.
  if (state.pendingConfirmation) return [];

  const pending = pendingMismatches(state).length;
  const unanswered = discoveryQuestions.filter(
    (q) => !state.discoveryAnswered.includes(q.id),
  ).length;
  const comparison = compareRegimes(toTaxpayerInput(state));

  const out: string[] = [];

  // The next real move, phrased as the user would say it.
  if (!state.form16Imported) {
    out.push("Bring in my Form 16");
  } else if (pending > 0) {
    out.push(
      pending === 1
        ? "Settle the last AIS difference for me"
        : `Settle all ${pending} AIS differences for me`,
    );
  } else if (unanswered > 0) {
    out.push("Answer my deduction questions");
  } else if (
    comparison.recommended !== state.regime &&
    comparison.saving > 0
  ) {
    out.push(`Put me on the ${comparison.recommended} regime`);
  } else if (!state.filing.submitted) {
    out.push("Get my return ready to file");
  } else if (!state.filing.everified) {
    out.push("What happens if I do not verify?");
  } else {
    out.push("Where is my refund?");
  }

  // One question about this screen, when there is a good one.
  const perScreen: Record<string, string> = {
    dashboard: "What still needs doing before I can file?",
    reconciliation: "Why does the department care about these differences?",
    deductions: "What else could I still claim?",
    regime: "Show me the slab-by-slab working",
    salary: "Explain what the standard deduction does here",
    "other-sources": "Is my savings interest taxable if no tax was cut?",
    filing: "Walk me through what I am about to submit",
    refund: "How long should the refund take?",
    notices: "What does this notice actually want from me?",
    grievance: "My refund is late — raise a grievance about it",
    help: "What is the difference between AIS and 26AS?",
    history: "How did last year compare with this year?",
    profile: "Is my profile ready for filing?",
  };
  if (perScreen[module]) out.push(perScreen[module]);

  if (!state.filing.submitted && state.form16Imported) {
    out.push("Just file it for me");
  }

  return out;
}

export function CopilotPanel() {
  const router = useRouter();
  const pathname = usePathname();

  const open = useAppStore((s) => s.copilotOpen);
  const setOpen = useAppStore((s) => s.setCopilotOpen);
  const messages = useAppStore((s) => s.copilotMessages);
  const push = useAppStore((s) => s.pushCopilotMessage);
  const update = useAppStore((s) => s.updateCopilotMessage);
  const clear = useAppStore((s) => s.clearCopilot);
  const actionCount = useAppStore(
    (s) => s.actionLog.filter((a) => a.actor === "copilot" && !a.undone).length,
  );
  const suggestionSource = useAppStore(
    useShallow((s) => buildSuggestions(s, moduleKeyOf(pathname))),
  );

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const moduleKey = useMemo(() => moduleKeyOf(pathname), [pathname]);

  // Actions land on the last message rather than creating new ones, so the
  // message count alone is not enough to keep the view pinned to the bottom.
  const streamedSteps = messages[messages.length - 1]?.actions?.length ?? 0;

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [open, messages.length, streamedSteps, busy]);

  useEffect(() => {
    if (open && !busy) inputRef.current?.focus();
  }, [open, busy]);

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

      // A long run used to sit behind a spinner for half a minute. The reply
      // bubble is created up front and filled in as each round lands, so the
      // work is visible while it happens rather than only once it is over.
      const replyId = rid();
      push({
        id: replyId,
        role: "assistant",
        text: "",
        at: new Date().toISOString(),
        pending: true,
      });

      // What the offline responder needs to read a vague sentence: the screen
      // it was typed on, and the message before it so "yes, do it" resolves.
      const localContext = {
        module: moduleKeyOf(pathname),
        previousMessage: [...useAppStore.getState().copilotMessages]
          .reverse()
          .find((m) => m.role === "user" && m.text !== trimmed)?.text,
      };

      // Once the model is unreachable, stay local for the rest of the turn —
      // going back for every round would just collect the same rate limit.
      let offline = false;
      // The fallback works from live state, so an unchanged answer means it has
      // nothing further to add and the loop should stop rather than repeat.
      let lastLocalCalls = "";
      // Set when an offline round has said its piece and must not be repeated.
      let lastOffline = false;

      // The agent loop. Each pass the model either asks for tools or answers;
      // tools are run against the real store and the results fed back, so a
      // single instruction can walk several steps of the journey.
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const context = buildScreenContext(useAppStore.getState(), pathname);

        let response: ChatResponse;
        if (offline) {
          response = localTurn(trimmed, localContext);
        } else {
          response = await postChat({
            messages: history,
            context,
            contextSummary: summariseContext(context),
            toolRounds: rounds,
          });
          if (response.error) {
            // The model is out. The tools are not, and neither are the
            // figures — so carry on without it rather than handing back a
            // status code.
            offline = true;
            update(replyId, { offline: true });
            response = localTurn(trimmed, localContext);
          }
        }

        // Offline, only a journey step asks for another round. Anything else
        // re-reading the same sentence would act on it twice.
        if (offline) {
          const signature = JSON.stringify(response.toolCalls ?? []);
          const repeated = signature !== "[]" && signature === lastLocalCalls;
          lastLocalCalls = signature;
          if (repeated) break;
          if (!(response as { continues?: boolean }).continues) {
            lastOffline = true;
          }
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

        // Show what just happened before going back for the next round.
        update(replyId, { actions: [...actions] });

        if (lastOffline) break;
      }

      update(replyId, {
        text:
          reply?.text ||
          (actions.length
            ? actions.map((a) => a.summary).join(". ")
            : "I did not have anything useful to add there."),
        actions: actions.length ? actions : undefined,
        pending: false,
        offline,
      });
    } catch (error) {
      console.error("[saathi] turn failed:", error);
      push({
        id: rid(),
        role: "assistant",
        text: "I could not reach my service. Anything I had already done is listed above and can be undone.",
        at: new Date().toISOString(),
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  // Never offer something the user has already said in this conversation.
  const alreadyAsked = new Set(
    messages.filter((m) => m.role === "user").map((m) => m.text.toLowerCase()),
  );
  const suggestions = suggestionSource.filter(
    (text) => !alreadyAsked.has(text.toLowerCase()),
  );

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
            className="tap rounded-full p-1 text-ink-soft hover:text-ink"
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

        <JourneyStrip busy={busy} />

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
                {suggestions.slice(0, 3).map((s) => (
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


        </div>

        {messages.length > 0 && !busy && suggestions.length > 0 ? (
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

/**
 * Where the return has actually got to, inside the panel.
 *
 * "Just file it for me" is five or six tool calls across four modules, and
 * until now the only sign of progress was a list of sentences scrolling past.
 * This is the same `stepDone` the rail uses, so the strip and the page behind
 * it can never disagree — and because it is driven by store state rather than
 * by the transcript, a step the user completed themselves lights up too.
 */
function JourneyStrip({ busy }: { busy: boolean }) {
  const done = useAppStore(
    useShallow((s) => FLOW_STEPS.map((f) => stepDone(f.id, s))),
  );
  const completed = done.filter(Boolean).length;
  const next = FLOW_STEPS.find((_, i) => !done[i]);

  return (
    <div className="border-b border-petrol-edge bg-petrol-soft px-5 pb-3 pt-0.5">
      <div className="flex items-center gap-[3px]" aria-hidden>
        {FLOW_STEPS.map((step, i) => (
          <span
            key={step.id}
            className={cx(
              "h-[3px] flex-1 rounded-full transition-colors duration-300",
              done[i]
                ? "bg-[color:var(--petrol)]"
                : "bg-[color:var(--petrol-edge)]",
              busy && !done[i] && i === completed && "animate-pulse-dot",
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] text-[color:var(--petrol-400)]">
        {completed} of {FLOW_STEPS.length} done
        {next ? ` · next is ${next.label.toLowerCase()}` : " · ready to file"}
      </p>
    </div>
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

  // While a run is in flight the bubble is a live status line, not an empty box.
  if (message.pending && !message.text) {
    return (
      <div className="animate-rise space-y-2.5">
        <div
          className="flex max-w-[92%] items-center gap-2 rounded-[16px] rounded-bl-[4px] border border-petrol-edge bg-white px-3.5 py-3 text-[14px] text-[color:var(--petrol-text)]"
          role="status"
          aria-live="polite"
        >
          <span className="animate-pulse-dot">●</span>
          {message.actions?.length
            ? `Working — ${message.actions.length} ${message.actions.length === 1 ? "step" : "steps"} done so far`
            : "Reading your return"}
        </div>
        {message.actions?.length ? <ActionList message={message} /> : null}
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
        {/* Said, not hidden. The actions below are real and the figures are the
            platform's own, but this answer was assembled from rules rather than
            written — and letting it pass as the model would be the one
            dishonest thing in an app built on not doing that. */}
        {message.offline ? (
          <p className="mt-2.5 flex items-start gap-1.5 border-t border-petrol-edge pt-2 text-[11.5px] leading-snug text-[color:var(--petrol-400)]">
            <span aria-hidden>◍</span>
            <span>
              Answered from the platform&rsquo;s own rules — Saathi&rsquo;s
              service was unreachable just now. Anything done below is real and
              still reversible.
            </span>
          </p>
        ) : null}
      </div>

      {message.actions?.length ? <ActionList message={message} /> : null}
    </div>
  );
}

function ActionList({ message }: { message: CopilotMessage }) {
  const undoMany = useAppStore((s) => s.undoMany);

  // Only this reply's own actions. Counting every reversible thing in the
  // session put "Undo all 11" under a list of two, and tapping it really did
  // reverse the other nine.
  const ids = (message.actions ?? [])
    .map((a) => a.logId)
    .filter((id): id is string => Boolean(id));
  const reversible = useAppStore(
    useShallow((s) =>
      s.actionLog
        .filter((a) => ids.includes(a.id) && a.undo && !a.undone)
        .map((a) => a.id),
    ),
  );

  // What this turn actually did to the bill, netted across its own actions.
  // Each row already says what it changed; nobody should have to add them up.
  const netDelta = useAppStore(
    useShallow((s) =>
      s.actionLog
        .filter((a) => ids.includes(a.id) && !a.undone)
        .reduce((sum, a) => sum + (a.delta ?? 0), 0),
    ),
  );

  return (
    <div className="rounded-[14px] bg-petrol-50 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[color:var(--petrol-400)]">
          Actions taken
        </span>
        {reversible.length > 1 && !message.pending ? (
          <button
            onClick={() => undoMany(reversible)}
            className="text-[12px] font-semibold text-[color:var(--petrol)] underline underline-offset-2"
          >
            Undo these {reversible.length}
          </button>
        ) : null}
      </div>
      <ul className="mt-2 space-y-2">
        {message.actions?.map((a, i) => (
          <ActionRow key={i} action={a} />
        ))}
      </ul>
      {!message.pending && netDelta !== 0 ? (
        <div
          className={cx(
            "mt-2.5 flex items-baseline justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2",
            netDelta < 0 ? "bg-ok-50" : "bg-alert-50",
          )}
        >
          <span className="text-[12.5px] text-ink-soft">
            Tax due {netDelta < 0 ? "fell by" : "rose by"}
          </span>
          <span
            className={cx(
              "tnum text-[15px] font-semibold",
              netDelta < 0
                ? "text-[color:var(--ok)]"
                : "text-[color:var(--alert)]",
            )}
          >
            {inr(Math.abs(netDelta))}
          </span>
        </div>
      ) : null}

      {!message.pending ? (
        <p className="mt-2.5 text-[11.5px] leading-snug text-[color:var(--petrol-400)]">
          Estimated from what you have told me so far. Everything reversible is
          marked so.
        </p>
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

/**
 * Where on the platform each tool actually leaves its mark, so a line in the
 * transcript can be gone and looked at. Saathi saying it settled a difference
 * is worth more when the difference is one tap away.
 */
const TOOL_DESTINATION: Record<string, string> = {
  import_form16: "/income/salary",
  set_income: "/income",
  resolve_mismatch: "/reconciliation",
  add_deduction: "/deductions",
  switch_regime: "/regime",
  confirm_regime: "/regime",
  prepare_submission: "/filing",
  record_advance_tax: "/filing/payment",
  raise_grievance: "/grievance",
  check_refund_status: "/refund",
};

function ActionRow({
  action,
}: {
  action: NonNullable<CopilotMessage["actions"]>[number];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const setOpen = useAppStore((s) => s.setCopilotOpen);
  const entry = useAppStore((s) =>
    action.logId ? s.actionLog.find((a) => a.id === action.logId) : undefined,
  );
  const undoAction = useAppStore((s) => s.undoAction);

  // Only worth offering when it goes somewhere else, and only for something
  // that actually happened.
  const destination = action.ok ? TOOL_DESTINATION[action.tool] : undefined;
  const elsewhere =
    destination && destination !== pathname && !pathname.startsWith(`${destination}/`);

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
        {elsewhere && !entry?.undone ? (
          <button
            onClick={() => {
              router.push(destination);
              // On a phone the panel covers the screen it just sent you to.
              if (window.matchMedia("(max-width: 1023px)").matches) {
                setOpen(false);
              }
            }}
            className="tap mt-1 text-[12px] font-medium text-[color:var(--petrol)] underline underline-offset-2"
          >
            See it on the page
          </button>
        ) : null}
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
};

/**
 * One round of Saathi without the model behind it. Same shape as a reply from
 * the service, so the agent loop does not care which one it got.
 */
function localTurn(
  message: string,
  context: { module?: string; previousMessage?: string },
): ChatResponse & { continues?: boolean } {
  const local = respondLocally(message, useAppStore.getState(), context);
  return {
    text: local.text,
    toolCalls: local.toolCalls,
    continues: local.continues,
  };
}

async function postChat(body: unknown): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok) {
    // Only ever the sentence the route wrote. Anything the provider said is in
    // the server log; a status code in a chat bubble helps nobody.
    return {
      error:
        data.error ||
        "Saathi is unavailable at the moment. Nothing in your return is affected; try again shortly.",
    };
  }
  return data;
}
