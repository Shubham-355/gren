"use client";

import Link from "next/link";

import { IconArrow } from "@/components/shell/Icons";
import {
  Badge,
  Callout,
  Card,
  ComputedTag,
  PageHeader,
  Term,
  cx,
} from "@/components/ui";
import { inr } from "@/lib/format";
import { useTax } from "@/lib/hooks/useTax";
import { useAppStore } from "@/lib/store/useAppStore";

export default function IncomeOverviewPage() {
  const state = useAppStore();
  const { current } = useTax();

  const heads = [
    {
      href: "/income/salary",
      title: "Salary",
      body: "Your Form 16, the allowances inside it, and the tax your employer already deducted.",
      amount: current.incomeFromSalary,
      status: state.form16Imported ? "done" : "todo",
      statusLabel: state.form16Imported ? "Imported" : "Not started",
      supported: true,
    },
    {
      href: "/income/house-property",
      title: "House property",
      body: "A house you own — whether you live in it or let it out changes the arithmetic completely.",
      amount: current.incomeFromHouseProperty,
      status: state.houseProperty.enabled ? "done" : "optional",
      statusLabel: state.houseProperty.enabled ? "Declared" : "Not declared",
      supported: true,
    },
    {
      href: "/income/other-sources",
      title: "Other sources",
      body: "Bank interest, fixed deposits, dividends. The head people most often forget.",
      amount: current.incomeFromOtherSources,
      status:
        current.incomeFromOtherSources > 0 ? "done" : ("optional" as const),
      statusLabel:
        current.incomeFromOtherSources > 0 ? "Declared" : "Nothing declared",
      supported: true,
    },
    {
      href: "/income/capital-gains",
      title: "Capital gains",
      body: "Shares, mutual funds, property sales.",
      amount: 0,
      status: "unsupported" as const,
      statusLabel: "Out of scope",
      supported: false,
    },
    {
      href: "/income/business",
      title: "Business or profession",
      body: "Freelancing, consulting, a shop, presumptive taxation under 44AD or 44ADA.",
      amount: 0,
      status: "unsupported" as const,
      statusLabel: "Out of scope",
      supported: false,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Step 1 of preparing your return"
        title="Where your money came from"
        intro={
          <>
            Indian income tax sorts everything you earned into five heads, and each
            head has its own rules before anything is added together. This
            prototype goes deep on the three a salaried taxpayer actually uses.
          </>
        }
      />

      <Card tone="accent">
        <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3.5">
          <div>
            <div className="eyebrow">
              <Term name="Gross Total Income">Gross total income</Term>
              <ComputedTag />
            </div>
            <div className="tnum mt-1 font-display text-[28px] font-semibold leading-none text-[color:var(--plum-ink)]">
              {inr(current.grossTotalIncome)}
            </div>
          </div>
          <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-soft">
            Salary {inr(current.incomeFromSalary)}
            {current.incomeFromHouseProperty !== 0 ? (
              <>
                {" · "}house property{" "}
                <span
                  className={
                    current.incomeFromHouseProperty < 0
                      ? "text-[color:var(--alert)]"
                      : undefined
                  }
                >
                  {inr(current.incomeFromHouseProperty)}
                </span>
              </>
            ) : null}
            {current.incomeFromOtherSources > 0
              ? ` · other sources ${inr(current.incomeFromOtherSources)}`
              : null}
          </p>
        </div>
      </Card>

      <div className="space-y-3">
        {heads.map((head) => (
          <Link
            key={head.href}
            href={head.href}
            className={cx(
              "flex items-start gap-3 rounded-[var(--radius)] border bg-surface px-4 py-3.5 transition-colors",
              head.supported
                ? "border-line hover:border-plum-100 hover:bg-plum-50/40"
                : "border-dashed border-line-strong opacity-75 hover:opacity-100",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15.5px] font-semibold">{head.title}</h2>
                <Badge
                  tone={
                    head.status === "done"
                      ? "ok"
                      : head.status === "unsupported"
                        ? "neutral"
                        : "warn"
                  }
                >
                  {head.statusLabel}
                </Badge>
              </div>
              <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-ink-soft">
                {head.body}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {head.supported ? (
                <span
                  className={cx(
                    "tnum text-[14px] font-medium",
                    head.amount < 0 && "text-[color:var(--alert)]",
                  )}
                >
                  {inr(head.amount)}
                </span>
              ) : null}
              <IconArrow width={16} height={16} className="text-ink-faint" />
            </div>
          </Link>
        ))}
      </div>

      <Callout tone="info" title="Why capital gains and business are left out">
        This is a six-day solo prototype, and it chose depth over breadth. The
        salaried ITR-1 and ITR-2 path is built properly end to end; capital gains
        and business income get an honest &ldquo;not built&rdquo; screen instead of
        a shallow imitation. Both screens explain what the real thing would need.
      </Callout>
    </div>
  );
}
