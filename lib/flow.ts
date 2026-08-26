import type { AppState } from "@/lib/store/useAppStore";
import { pendingMismatches } from "@/lib/store/useAppStore";

/**
 * The guided journey, as one list.
 *
 * The desktop rail shows all eight; the phone shows the seven that are their
 * own screen (submitting happens on the review screen, so it is not a step of
 * its own there). Every screen in the flow reads its position from here rather
 * than hardcoding "Step 3 of 7".
 */
export type FlowStepId =
  | "income"
  | "reconcile"
  | "deductions"
  | "regime"
  | "review"
  | "submit"
  | "verify"
  | "refund";

export type FlowStep = {
  id: FlowStepId;
  label: string;
  href: string;
  /** false for steps that are folded into another screen on a phone */
  onPhone: boolean;
  /** matches the pathname of the screen(s) that count as "you are here" */
  matches: string[];
};

export const FLOW_STEPS: FlowStep[] = [
  {
    id: "income",
    label: "Income",
    href: "/income/salary",
    onPhone: true,
    matches: ["/income"],
  },
  {
    id: "reconcile",
    label: "Reconcile",
    href: "/reconciliation",
    onPhone: true,
    matches: ["/reconciliation"],
  },
  {
    id: "deductions",
    label: "Deductions",
    href: "/deductions",
    onPhone: true,
    matches: ["/deductions"],
  },
  {
    id: "regime",
    label: "Regime",
    href: "/regime",
    onPhone: true,
    matches: ["/regime"],
  },
  {
    id: "review",
    label: "Review",
    href: "/filing",
    onPhone: true,
    matches: ["/filing"],
  },
  {
    id: "submit",
    label: "Submit",
    href: "/filing/confirmation",
    onPhone: false,
    matches: ["/filing/confirmation", "/filing/payment"],
  },
  {
    id: "verify",
    label: "Verify",
    href: "/filing/everify",
    onPhone: true,
    matches: ["/filing/everify"],
  },
  {
    id: "refund",
    label: "Refund",
    href: "/refund",
    onPhone: true,
    matches: ["/refund"],
  },
];

export const PHONE_STEPS = FLOW_STEPS.filter((s) => s.onPhone);

/** Which step a pathname belongs to, or null for the secondary modules. */
export function stepForPath(pathname: string): FlowStep | null {
  const hit = FLOW_STEPS.filter((s) =>
    s.matches.some((m) => pathname === m || pathname.startsWith(`${m}/`)),
  ).sort(
    (a, b) =>
      Math.max(...b.matches.map((m) => m.length)) -
      Math.max(...a.matches.map((m) => m.length)),
  )[0];
  return hit ?? null;
}

/**
 * A step is "done" when the thing it exists to settle has actually been
 * settled — not merely visited. This is what the rail's ticks mean.
 */
export function stepDone(id: FlowStepId, s: AppState): boolean {
  switch (id) {
    case "income":
      return s.form16Imported;
    case "reconcile":
      return s.form16Imported && pendingMismatches(s).length === 0;
    case "deductions":
      return s.discoveryAnswered.length > 0;
    case "regime":
      return s.regimeChosenExplicitly;
    case "review":
      return s.filing.reviewConfirmed || s.filing.submitted;
    case "submit":
      return s.filing.submitted;
    case "verify":
      return s.filing.everified;
    case "refund":
      return s.filing.everified;
  }
}

/** How far the phone progress bar is filled: the count of completed steps. */
export function phoneProgress(s: AppState): number {
  return PHONE_STEPS.filter((step) => stepDone(step.id, s)).length;
}

/**
 * The single next action the dashboard leads with. Order matters: it is the
 * first unfinished thing, not a menu.
 */
export function nextStep(s: AppState): FlowStep {
  return FLOW_STEPS.find((step) => !stepDone(step.id, s)) ?? FLOW_STEPS[7];
}
