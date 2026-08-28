"use client";

import { useEffect } from "react";

import { stepForModule, type FlowStepId } from "@/lib/flow";
import { useAppStore } from "@/lib/store/useAppStore";

/** How long the pulse stays on a step after something changed it. */
const PULSE_MS = 1400;

/**
 * Which step just changed, so the rail can say so.
 *
 * The store has always recorded `lastTouchedModule` and `globals.css` has
 * always carried an `animate-settle` keyframe for exactly this, but nothing
 * read either — so when Saathi settled three AIS differences while you were
 * looking at the dashboard, the only sign was a toast that scrolled away.
 *
 * Now the step it touched lights up wherever you are. It clears itself, so a
 * pulse never becomes a permanent badge, and `prefers-reduced-motion` already
 * flattens the animation to nothing.
 */
export function useTouchedStep(): FlowStepId | null {
  const touchedModule = useAppStore((s) => s.lastTouchedModule);
  const touchModule = useAppStore((s) => s.touchModule);

  useEffect(() => {
    if (!touchedModule) return;
    const timer = window.setTimeout(() => touchModule(null), PULSE_MS);
    return () => window.clearTimeout(timer);
  }, [touchedModule, touchModule]);

  return stepForModule(touchedModule);
}
