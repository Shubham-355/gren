"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppStore } from "@/lib/store/useAppStore";

/**
 * Once a return is submitted, the preparation screens are still reachable —
 * you can look at what you filed — but editing them no longer changes the
 * return that is with the department. Saying so once, at the top, is more
 * honest than letting someone edit figures that have stopped mattering.
 */
const EDITABLE_STEPS = [
  "/income",
  "/reconciliation",
  "/deductions",
  "/regime",
];

export function FiledNotice() {
  const pathname = usePathname();
  const submitted = useAppStore((s) => s.filing.submitted);
  const ack = useAppStore((s) => s.filing.acknowledgementNumber);

  if (!submitted) return null;
  if (!EDITABLE_STEPS.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return null;

  return (
    <div className="mb-6 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[var(--radius)] border border-warn-100 bg-warn-50 px-4 py-3.5">
      <span className="text-[14px] font-semibold text-[color:var(--warn)]">
        This return is already filed
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-soft">
        Acknowledgement {ack}. You can still look at everything, but changing a
        figure here will not change what the department holds — that needs a
        revised return under section 139(5).
      </span>
      <Link
        href="/filing/confirmation"
        className="shrink-0 text-[13.5px] font-semibold text-[color:var(--plum)] underline underline-offset-2"
      >
        See what was filed
      </Link>
    </div>
  );
}
