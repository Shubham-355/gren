"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { cx } from "@/components/ui";
import {
  FLOW_STEPS,
  PHONE_STEPS,
  stepDone,
  stepForPath,
  type FlowStep,
} from "@/lib/flow";
import { useAppStore } from "@/lib/store/useAppStore";
import { SHELL_CONTAINER } from "./layout";
import { useTouchedStep } from "./useTouchedStep";

/**
 * The lightweight persistent step indicator (§4). Desktop gets the full
 * eight-stop rail under the header; a phone gets a bar of segments and a
 * "Step 3 of 7 · Deductions" line, because eight labels do not fit and a
 * heavy numbered wizard is not what this is.
 */
export function StepRail() {
  const pathname = usePathname();
  // useShallow: the selector builds a fresh array each call, so identity
  // comparison would re-render forever.
  const done = useAppStore(
    useShallow((s) => FLOW_STEPS.map((f) => stepDone(f.id, s))),
  );
  const here = stepForPath(pathname);
  const touched = useTouchedStep();

  // Secondary modules (notices, help, grievance) are a deliberately entered
  // mode, not a step — the rail stays but nothing is marked current.
  return (
    <div className="scroll-x hidden border-b border-line bg-surface lg:block">
      <div className={cx(SHELL_CONTAINER, "flex items-center gap-6 py-3 2xl:gap-9")}>
        {FLOW_STEPS.map((step, i) => (
          <StepPip
            key={step.id}
            step={step}
            done={done[i]}
            current={here?.id === step.id}
            touched={touched === step.id}
          />
        ))}
      </div>
    </div>
  );
}

function StepPip({
  step,
  done,
  current,
  touched,
}: {
  step: FlowStep;
  done: boolean;
  current: boolean;
  /** something just changed this step — pulse it, wherever the user is */
  touched: boolean;
}) {
  const lit = done || current;
  return (
    <Link
      href={step.href}
      aria-current={current ? "step" : undefined}
      className={cx(
        "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[12.5px] transition-colors",
        lit
          ? "font-semibold text-[color:var(--plum)]"
          : "text-ink-faint hover:text-ink-soft",
        touched && "animate-settle",
      )}
    >
      <span
        className={cx(
          "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px]",
          done && "bg-[color:var(--plum)] text-white",
          !done && current && "border-2 border-[color:var(--plum)]",
          !done && !current && "border border-line-strong",
        )}
      >
        {done ? "✓" : null}
        {!done && current ? (
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--plum)]" />
        ) : null}
      </span>
      {step.label}
    </Link>
  );
}

/**
 * The phone version: a segment bar plus the step name. Rendered by flow
 * screens themselves, above their heading, so the reference screens do not
 * get one.
 */
export function PhoneStepHeader({
  back,
  action,
}: {
  back?: { href: string; label?: string };
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const here = stepForPath(pathname);
  const done = useAppStore(
    useShallow((s) => PHONE_STEPS.map((f) => stepDone(f.id, s))),
  );
  const touched = useTouchedStep();

  if (!here) return null;
  const index = PHONE_STEPS.findIndex((s) => s.id === here.id);
  if (index < 0) return null;

  return (
    <div className="mb-5 lg:hidden">
      <div className="flex items-center gap-3">
        {back ? (
          <Link
            href={back.href}
            aria-label={back.label ?? "Back"}
            className="tap -ml-1 shrink-0 p-1 text-ink"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
        ) : null}
        <span className="text-[15px] font-semibold">
          Step {index + 1} of {PHONE_STEPS.length} · {here.label}
        </span>
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      <div className="mt-3 flex items-center gap-[5px]">
        {PHONE_STEPS.map((s, i) => (
          <span
            key={s.id}
            className={cx(
              "h-1 flex-1 rounded-full transition-colors",
              done[i] || i <= index
                ? "bg-[color:var(--plum)]"
                : "bg-[color:var(--line)]",
              touched === s.id && "animate-touched",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The sticky action bar every flow screen ends with. On a phone it is docked
 * to the bottom above the tab bar; on desktop it sits inline.
 */
export function FlowActionBar({
  summary,
  children,
  note,
}: {
  summary?: { label: string; value: string };
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-[68px] z-20 -mx-4 mt-8 border-t border-line bg-surface px-4 pb-4 pt-3.5 lg:static lg:bottom-auto lg:mx-0 lg:rounded-[var(--radius)] lg:border lg:px-5 lg:py-4 lg:shadow-[var(--shadow-sm)]">
      {summary ? (
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[13px] text-ink-faint">{summary.label}</span>
          <span className="tnum text-[15px] font-semibold">{summary.value}</span>
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {children}
      </div>
      {note ? (
        <p className="mt-2.5 text-center text-[12px] leading-snug text-ink-faint sm:text-left">
          {note}
        </p>
      ) : null}
    </div>
  );
}
