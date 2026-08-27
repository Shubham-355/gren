"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import { TermProvider, cx } from "@/components/ui";
import { daysUntil } from "@/lib/format";
import { useHydratedStore } from "@/lib/store/hydration";
import { pendingMismatches, useAppStore } from "@/lib/store/useAppStore";
import {
  ASSESSMENT_YEAR,
  FILING_DEADLINE,
  FINANCIAL_YEAR,
} from "@/lib/tax/constants";
import { TimelineRail, TimelineSheet } from "./ActionTimeline";
import { ConfirmationGate } from "./ConfirmationGate";
import { Disclaimer } from "./Disclaimer";
import { FiledNotice } from "./FiledNotice";
import { IconCompare, IconFile, IconHome, IconMore } from "./Icons";
import { COPILOT_INSET, SHELL_CONTAINER } from "./layout";
import { StepRail } from "./StepRail";
import { Toasts } from "./Toasts";
import { navGroups } from "./nav";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydratedStore();

  const [moreOpen, setMoreOpen] = useState(false);
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);
  const copilotOpen = useAppStore((s) => s.copilotOpen);
  const setTimelineOpen = useAppStore((s) => s.setTimelineOpen);
  const loggedIn = useAppStore((s) => s.loggedIn);
  const name = useAppStore((s) => s.profile.name);
  const pendingCount = useAppStore((s) => pendingMismatches(s).length);
  const changeCount = useAppStore(
    (s) => s.actionLog.filter((a) => !a.undone).length,
  );
  const submitted = useAppStore((s) => s.filing.submitted);
  const everified = useAppStore((s) => s.filing.everified);

  // Anyone landing deep in the app without a session gets sent to sign-in,
  // but only after persistence has had a chance to restore one.
  useEffect(() => {
    if (hydrated && !loggedIn) router.replace("/login");
  }, [hydrated, loggedIn, router]);

  // Ctrl/Cmd+K from anywhere. Ignored while typing, so it never steals a
  // keystroke from a rupee field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable;
      if (typing) return;
      e.preventDefault();
      setCopilotOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCopilotOpen]);

  const daysLeft = daysUntil(FILING_DEADLINE);

  return (
    <TermProvider>
      <div
        className={cx(
          "flex min-h-dvh flex-col bg-paper transition-[padding] duration-200",
          copilotOpen && COPILOT_INSET,
        )}
      >
        {/* ------------------------------- header ------------------------------ */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className={cx(SHELL_CONTAINER, "flex items-center gap-3.5 py-3")}>
            <Link href="/dashboard" aria-label="TaxSaathi home">
              <Wordmark />
            </Link>
            <span className="ml-3 hidden text-[13.5px] text-ink-faint lg:inline">
              AY {ASSESSMENT_YEAR} · income earned in FY {FINANCIAL_YEAR}
            </span>

            <div className="ml-auto flex items-center gap-2.5 lg:gap-3.5">
              <StatusPill
                submitted={submitted}
                everified={everified}
                daysLeft={daysLeft}
              />

              <button
                onClick={() => setTimelineOpen(true)}
                className={cx(
                  "hidden items-center gap-1.5 text-[13.5px] font-medium text-ink-soft hover:text-ink sm:flex",
                  copilotOpen ? "min-[2100px]:hidden" : "min-[1700px]:hidden",
                )}
              >
                Activity
                {changeCount > 0 ? (
                  <span className="tnum rounded-full bg-sunk px-1.5 text-[11px] font-semibold text-ink-faint">
                    {changeCount}
                  </span>
                ) : null}
              </button>

              <button
                onClick={() => setMoreOpen(true)}
                className="hidden text-[13.5px] font-medium text-ink-soft hover:text-ink lg:block"
              >
                Everything else
              </button>

              <Link
                href="/profile"
                className="tap flex h-[34px] w-[34px] items-center justify-center rounded-full bg-plum-50 text-[12.5px] font-semibold text-[color:var(--plum)]"
                aria-label="Profile"
                title={name}
              >
                {initials(name)}
              </Link>
            </div>
          </div>
        </header>

        <StepRail />

        {/* ------------------------------- body -------------------------------- */}
        <div className={cx(SHELL_CONTAINER, "flex flex-1 gap-8 pb-32 pt-7 lg:pb-12")}>
          <main className="min-w-0 flex-1">
            {hydrated ? (
              <>
                <FiledNotice />
                {children}
              </>
            ) : (
              <ShellSkeleton />
            )}
          </main>
          <TimelineRail squeezed={copilotOpen} />
        </div>

        <Disclaimer />

        {/* --------- persistent copilot entry point, every screen --------- */}
        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          aria-label="Open Saathi, the AI assistant"
          className={cx(
            "fixed bottom-[5.5rem] right-4 z-40 flex items-center gap-2.5 rounded-[var(--radius-pill)] bg-[color:var(--petrol)] py-3 pl-4 pr-5 text-white shadow-[0_10px_24px_-10px_rgba(15,95,114,0.7)] transition-all hover:bg-[color:var(--petrol-ink)]",
            "lg:bottom-11 lg:right-0 lg:rounded-r-none lg:rounded-l-[var(--radius-sm)] lg:shadow-[-8px_8px_24px_-12px_rgba(15,95,114,0.6)]",
            // At 2xl the timeline rail carries its own "Open copilot" footer,
            // so a floating button on the same edge would just collide with it.
            // Above this the rail carries its own "Open copilot" footer, so a
            // floating button on the same edge would only collide with it.
            "min-[1700px]:hidden",
            copilotOpen && "pointer-events-none opacity-0",
          )}
        >
          <CopilotStar size={20} />
          <span className="text-[14.5px] font-medium">Ask</span>
          <span className="mono hidden rounded bg-white/15 px-1.5 py-0.5 text-[11px] text-white/70 lg:inline">
            ⌘K
          </span>
        </button>

        <CopilotPanel />
        <ConfirmationGate />
        <TimelineSheet />
        <Toasts />

        {/* --------- mobile bottom navigation --------- */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-surface lg:hidden">
          <div className="mx-auto flex max-w-lg">
            <TabLink
              href="/dashboard"
              label="Home"
              icon={<IconHome width={22} height={22} />}
              pathname={pathname}
            />
            <TabLink
              href="/filing"
              label="Return"
              icon={<IconFile width={22} height={22} />}
              pathname={pathname}
            />
            <TabLink
              href="/reconciliation"
              label="Reconcile"
              icon={<IconCompare width={22} height={22} />}
              pathname={pathname}
              badge={pendingCount}
            />
            <button
              onClick={() => setTimelineOpen(true)}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-ink-faint"
            >
              <IconActivity width={22} height={22} />
              Activity
            </button>
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-ink-faint"
            >
              <IconMore width={22} height={22} />
              More
            </button>
          </div>
        </nav>

        {moreOpen ? (
          <MoreSheet onClose={() => setMoreOpen(false)} pathname={pathname} />
        ) : null}
      </div>
    </TermProvider>
  );
}

/* ---------------------------------------------------------------- */

function StatusPill({
  submitted,
  everified,
  daysLeft,
}: {
  submitted: boolean;
  everified: boolean;
  daysLeft: number;
}) {
  const base =
    "flex items-center gap-2 rounded-[var(--radius-pill)] px-3 py-1.5 text-[12.5px] font-semibold";

  if (everified) {
    return (
      <span className={cx(base, "bg-ok-50 text-[color:var(--ok)]")}>
        Filed and verified
      </span>
    );
  }
  if (submitted) {
    return (
      <span className={cx(base, "bg-alert-50 text-[color:var(--alert)]")}>
        Not verified yet · 30 days
      </span>
    );
  }
  if (daysLeft <= 0) {
    return (
      <span className={cx(base, "bg-alert-50 text-[color:var(--alert)]")}>
        Due date passed
      </span>
    );
  }
  return (
    <span className={cx(base, "bg-warn-50 text-[color:var(--warn)]")}>
      {daysLeft} days<span className="hidden sm:inline"> to the due date</span>
    </span>
  );
}

function TabLink({
  href,
  label,
  icon,
  pathname,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  pathname: string;
  badge?: number;
}) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cx(
        "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
        active ? "text-[color:var(--plum)]" : "text-ink-faint",
      )}
    >
      {icon}
      {label}
      {badge > 0 ? (
        <span className="tnum absolute right-[24%] top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[color:var(--alert)] px-1 text-[10px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function MoreSheet({
  onClose,
  pathname,
}: {
  onClose: () => void;
  pathname: string;
}) {
  const logout = useAppStore((s) => s.logout);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Everything else">
      <div
        className="absolute inset-0 bg-[color:var(--ink)]/35"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-rise absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-[var(--radius-sheet)] border-t border-line bg-surface pb-8 lg:left-auto lg:top-0 lg:max-h-none lg:w-[22rem] lg:rounded-none lg:border-l lg:pb-6">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <span className="font-display text-[22px]">Everything else</span>
          <button onClick={onClose} className="text-[13px] text-ink-faint">
            Close
          </button>
        </div>
        <div className="space-y-5 px-5 pt-5">
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="eyebrow mb-2">{group.title}</div>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cx(
                        "block rounded-[var(--radius-sm)] border px-3.5 py-2.5 transition-colors",
                        pathname === item.href
                          ? "border-plum-100 bg-plum-50"
                          : "border-line bg-surface hover:bg-sunk",
                      )}
                    >
                      <span className="block text-[14px] font-medium text-ink">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-faint">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex gap-2.5 border-t border-line pt-5">
            <button
              onClick={() => {
                resetDemo();
                onClose();
                router.push("/dashboard");
              }}
              className="flex-1 rounded-[var(--radius-sm)] border border-line-strong px-3 py-2.5 text-[13px] text-ink-soft hover:bg-sunk"
            >
              Reset demo data
            </button>
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="flex-1 rounded-[var(--radius-sm)] border border-line-strong px-3 py-2.5 text-[13px] text-ink-soft hover:bg-sunk"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Wordmark({
  light = false,
  size = "md",
}: {
  light?: boolean;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-8 w-8 text-[20px]" : "h-[30px] w-[30px] text-[19px]";
  const word = size === "lg" ? "text-[23px]" : "text-[21px]";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cx(
          "flex items-center justify-center rounded-[9px] font-display",
          box,
          light
            ? "bg-white/16 text-white"
            : "bg-[color:var(--plum)] text-white",
        )}
      >
        T
      </span>
      <span
        className={cx(
          "font-display tracking-[-0.01em]",
          word,
          light ? "text-white" : "text-ink",
        )}
      >
        TaxSaathi
      </span>
    </span>
  );
}

/** The copilot's mark. Petrol, always — it is never the product's own icon. */
export function CopilotStar({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3.5l2.1 4.9 5.4.5-4.1 3.5 1.2 5.2L12 14.9l-4.6 2.7 1.2-5.2-4.1-3.5 5.4-.5z" />
    </svg>
  );
}

function IconActivity(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M4 12h3l2.5-6 4 12 2.5-6h4" />
    </svg>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-9 w-1/2 animate-pulse rounded bg-sunk" />
      <div className="h-32 animate-pulse rounded-[var(--radius)] bg-sunk" />
      <div className="h-44 animate-pulse rounded-[var(--radius)] bg-sunk" />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
