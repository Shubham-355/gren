"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { CopilotMark, CopilotPanel } from "@/components/copilot/CopilotPanel";
import { Badge, TermProvider, cx } from "@/components/ui";
import { daysUntil } from "@/lib/format";
import { useHydratedStore } from "@/lib/store/hydration";
import { pendingMismatches, useAppStore } from "@/lib/store/useAppStore";
import { ASSESSMENT_YEAR, FILING_DEADLINE } from "@/lib/tax/constants";
import { Disclaimer } from "./Disclaimer";
import {
  IconCompare,
  IconFile,
  IconHome,
  IconMore,
  IconWallet,
} from "./Icons";
import { Toasts } from "./Toasts";
import { bottomNav, navGroups } from "./nav";

const bottomIcons = {
  home: IconHome,
  wallet: IconWallet,
  compare: IconCompare,
  file: IconFile,
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydratedStore();

  const [moreOpen, setMoreOpen] = useState(false);
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);
  const copilotOpen = useAppStore((s) => s.copilotOpen);
  const loggedIn = useAppStore((s) => s.loggedIn);
  const name = useAppStore((s) => s.profile.name);
  const pendingCount = useAppStore((s) => pendingMismatches(s).length);

  // Anyone landing deep in the app without a session gets sent to sign-in,
  // but only after persistence has had a chance to restore one.
  useEffect(() => {
    if (hydrated && !loggedIn) router.replace("/login");
  }, [hydrated, loggedIn, router]);

  const daysLeft = daysUntil(FILING_DEADLINE);

  return (
    <TermProvider>
      <div className="paper-grain flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-[color:var(--paper)]/92 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Wordmark />
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <Badge tone="neutral" className="hidden sm:inline-flex">
                AY {ASSESSMENT_YEAR}
              </Badge>
              {daysLeft > 0 ? (
                <Badge tone={daysLeft <= 30 ? "warn" : "neutral"}>
                  {daysLeft} days to file
                </Badge>
              ) : (
                <Badge tone="alert">Due date passed</Badge>
              )}
              <Link
                href="/profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--pine)] text-[12px] font-semibold text-white"
                aria-label="Profile"
                title={name}
              >
                {initials(name)}
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 pb-28 pt-5 lg:pb-10">
          <SideNav pathname={pathname} pendingCount={pendingCount} />

          <main className="min-w-0 flex-1">
            {hydrated ? children : <ShellSkeleton />}
          </main>
        </div>

        <Disclaimer />

        {/* --------- persistent copilot entry point, every screen --------- */}
        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          aria-label="Open Sarathi copilot"
          className={cx(
            "fixed bottom-[5.5rem] right-4 z-40 flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--pine)] py-2.5 pl-2.5 pr-4 text-white shadow-[var(--shadow-lg)] transition-all hover:bg-[color:var(--pine-ink)] lg:bottom-6",
            copilotOpen && "opacity-0 pointer-events-none",
          )}
        >
          <CopilotMark size={26} />
          <span className="text-[13.5px] font-medium">Ask Sarathi</span>
        </button>

        <CopilotPanel />
        <Toasts />

        {/* --------- mobile bottom navigation --------- */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-surface/97 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg">
            {bottomNav.map((item) => {
              const Icon = bottomIcons[item.icon];
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = item.href === "/reconciliation" ? pendingCount : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium",
                    active ? "text-[color:var(--pine)]" : "text-ink-faint",
                  )}
                >
                  <Icon width={21} height={21} />
                  {item.label}
                  {badge > 0 ? (
                    <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--clay)] px-1 text-[9px] font-semibold text-white">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium text-ink-faint"
            >
              <IconMore width={21} height={21} />
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

function SideNav({
  pathname,
  pendingCount,
}: {
  pathname: string;
  pendingCount: number;
}) {
  return (
    <nav className="hidden w-56 shrink-0 lg:block">
      <div className="sticky top-20 space-y-5">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="eyebrow mb-1.5 px-2">{group.title}</div>
            <ul className="space-y-px">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/filing" && pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cx(
                        "flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13.5px] transition-colors",
                        active
                          ? "bg-pine-50 font-medium text-[color:var(--pine-ink)]"
                          : "text-ink-soft hover:bg-sunk hover:text-ink",
                      )}
                    >
                      <span>{item.label}</span>
                      {item.href === "/reconciliation" && pendingCount > 0 ? (
                        <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[color:var(--clay)] px-1 text-[10px] font-semibold text-white">
                          {pendingCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
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
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog">
      <div
        className="absolute inset-0 bg-[color:var(--ink)]/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-rise absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-[var(--radius-lg)] border-t border-line bg-surface pb-6">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <span className="font-display text-[16px] font-semibold">
            Everything else
          </span>
          <button onClick={onClose} className="text-[13px] text-ink-faint">
            Close
          </button>
        </div>
        <div className="space-y-4 px-4 pt-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="eyebrow mb-1.5">{group.title}</div>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cx(
                        "block rounded-[var(--radius-sm)] border px-3 py-2",
                        pathname === item.href
                          ? "border-pine-100 bg-pine-50"
                          : "border-line bg-surface",
                      )}
                    >
                      <span className="block text-[14px] font-medium text-ink">
                        {item.label}
                      </span>
                      <span className="block text-[12px] leading-snug text-ink-faint">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex gap-2 border-t border-line pt-4">
            <button
              onClick={() => {
                resetDemo();
                onClose();
                router.push("/dashboard");
              }}
              className="flex-1 rounded-[var(--radius-sm)] border border-line-strong px-3 py-2 text-[13px] text-ink-soft"
            >
              Reset demo data
            </button>
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="flex-1 rounded-[var(--radius-sm)] border border-line-strong px-3 py-2 text-[13px] text-ink-soft"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={cx(
          "flex h-7 w-7 items-center justify-center rounded-[9px] font-display text-[15px] font-bold",
          light
            ? "bg-white text-[color:var(--pine-ink)]"
            : "bg-[color:var(--pine)] text-white",
        )}
      >
        S
      </span>
      <span
        className={cx(
          "font-display text-[18px] font-semibold tracking-tight",
          light ? "text-white" : "text-ink",
        )}
      >
        Sarathi
      </span>
    </span>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-8 w-1/2 animate-pulse rounded bg-sunk" />
      <div className="h-28 animate-pulse rounded-[var(--radius)] bg-sunk" />
      <div className="h-40 animate-pulse rounded-[var(--radius)] bg-sunk" />
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
