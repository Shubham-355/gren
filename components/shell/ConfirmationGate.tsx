"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";
import { useAppStore } from "@/lib/store/useAppStore";

/**
 * The Tier 3 gate (§5.2).
 *
 * Filing, e-verifying and paying are irreversible, so they leave the chat and
 * become a real card on the page, in the product's own plum — never Saathi's
 * petrol, and never a chat message with a button. Saathi can assemble
 * everything and raise this card; it cannot tap it.
 *
 * The acknowledgement is single-use. A second irreversible action raises its
 * own card and needs its own fresh tap, so the gesture stays tied to a read
 * rather than a reflex.
 */
/** What the confirm button says while the simulated round trip is running. */
const BUSY_LABEL = {
  submit: "Filing your return",
  everify: "Verifying",
  payment: "Paying",
} as const;

export function ConfirmationGate() {
  const router = useRouter();
  const pending = useAppStore((s) => s.pendingConfirmation);
  const dismiss = useAppStore((s) => s.dismissConfirmation);
  const submitReturn = useAppStore((s) => s.submitReturn);
  const everify = useAppStore((s) => s.everify);
  const payTax = useAppStore((s) => s.payTax);
  const [working, setWorking] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, dismiss]);

  if (!pending) return null;

  // This is the one tap in the app with a consequence behind it, and it used
  // to resolve in the same frame — you pressed "Submit my return" and an
  // acknowledgement number was simply already there. Nothing had visibly
  // happened, so nothing felt like it had. The work is still instant; the
  // wait is what makes it legible.
  function confirm() {
    if (!pending || working) return;
    const request = pending;
    setWorking(true);
    timer.current = window.setTimeout(() => {
      switch (request.kind) {
        case "submit": {
          const ack = `SYN${Date.now().toString().slice(-9)}${Math.floor(
            Math.random() * 900 + 100,
          )}`;
          submitReturn(ack);
          dismiss();
          router.push("/filing/confirmation");
          break;
        }
        case "everify":
          everify();
          dismiss();
          router.push("/filing/confirmation");
          break;
        case "payment":
          payTax(request.amount ?? 0);
          dismiss();
          break;
      }
      setWorking(false);
    }, 1900);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={pending.title}
    >
      <div
        className="absolute inset-0 bg-[color:var(--ink)]/45"
        onClick={dismiss}
        aria-hidden
      />

      <div className="animate-rise relative w-full max-w-[34rem] rounded-t-[var(--radius-sheet)] border-[1.5px] border-[color:var(--plum)] bg-raised p-6 shadow-[var(--shadow-lg)] sm:rounded-[var(--radius-lg)]">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[color:var(--plum)]">
          Your confirmation required
        </div>
        <h2 className="mt-2 font-display text-[26px] leading-[1.15] sm:text-[28px]">
          {pending.title}
        </h2>

        <dl className="mt-4 space-y-2">
          {pending.lines.map((line, i) => (
            <div
              key={line.label}
              className={
                i === pending.lines.length - 1
                  ? "flex items-baseline justify-between gap-4 border-t border-line pt-2.5 text-[14px] font-semibold"
                  : "flex items-baseline justify-between gap-4 text-[14px]"
              }
            >
              <dt className={i === pending.lines.length - 1 ? "" : "text-ink-soft"}>
                {line.label}
              </dt>
              <dd className="tnum">{line.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
          {pending.body}
        </p>

        {pending.requestedBy === "copilot" ? (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-petrol-100 bg-petrol-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-[color:var(--petrol-text)]">
            Saathi assembled this. It cannot complete the step itself —
            this one takes your tap, not a typed yes.
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
          <Button
            size="lg"
            onClick={confirm}
            pending={working}
            className="sm:flex-1"
          >
            {working ? BUSY_LABEL[pending.kind] : pending.confirmLabel}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={dismiss}
            disabled={working}
            className="sm:flex-1"
          >
            Not yet — let me look again
          </Button>
        </div>

        <p className="mt-3 text-center text-[11.5px] leading-snug text-ink-faint">
          Nothing is transmitted to any tax authority. This prototype simulates
          the step locally.
        </p>
      </div>
    </div>
  );
}
