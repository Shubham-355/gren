"use client";

import { aisEntries, notices as seededNotices } from "@/lib/data/seed";
import { inrPlain } from "@/lib/format";
import {
  pendingMismatches,
  refundStage,
  toTaxpayerInput,
  type AppState,
} from "@/lib/store/useAppStore";
import { compareRegimes, computeTax } from "@/lib/tax/compute";
import {
  ASSESSMENT_YEAR,
  FILING_DEADLINE,
  FINANCIAL_YEAR,
} from "@/lib/tax/constants";
import { MODULES, type ModuleKey } from "./tools";

/**
 * A structured snapshot of what the user is actually looking at, handed to the
 * model on every turn. This is what stops the copilot from being generic: it
 * knows the live numbers, the open mismatches, and where in the flow the user
 * currently is.
 */
export type ScreenContext = ReturnType<typeof buildScreenContext>;

export function moduleFromPath(pathname: string): ModuleKey | "landing" | "auth" {
  if (pathname === "/") return "landing";
  if (pathname.startsWith("/login") || pathname.startsWith("/register"))
    return "auth";
  const entries = Object.entries(MODULES) as [ModuleKey, { href: string }][];
  const match = entries
    .filter(([, m]) => pathname === m.href || pathname.startsWith(`${m.href}/`))
    .sort((a, b) => b[1].href.length - a[1].href.length)[0];
  return match ? match[0] : "dashboard";
}

export function buildScreenContext(state: AppState, pathname: string) {
  const input = toTaxpayerInput(state);
  const current = computeTax(input);
  const comparison = compareRegimes(input);
  const pending = pendingMismatches(state);
  const stage = refundStage(state);

  const openNotices = seededNotices.filter(
    (n) => state.notices[n.id]?.status === "Open" && n.requiresResponse,
  );

  return {
    disclaimer:
      "Independent hackathon prototype. All taxpayer data is synthetic. Not affiliated with the Income Tax Department.",
    assessmentYear: ASSESSMENT_YEAR,
    financialYear: FINANCIAL_YEAR,
    filingDeadline: FILING_DEADLINE,
    today: new Date().toISOString().slice(0, 10),

    currentScreen: {
      path: pathname,
      module: moduleFromPath(pathname),
    },

    taxpayer: {
      name: state.profile.name,
      age: state.profile.age,
      pan: `${state.profile.pan} (synthetic)`,
      residentialStatus: state.profile.residentialStatus,
      panAadhaarLinked: state.profile.panAadhaarLinked,
      refundAccount:
        state.profile.bankAccounts.find((b) => b.nominatedForRefund)?.bank ??
        "none nominated",
    },

    income: {
      form16Imported: state.form16Imported,
      grossSalary: current.grossSalary,
      salaryBreakup: state.salary,
      housePropertyDeclared: state.houseProperty.enabled,
      housePropertyIncome: current.incomeFromHouseProperty,
      otherSources: state.otherSources,
      grossTotalIncome: current.grossTotalIncome,
    },

    regime: {
      selected: state.regime,
      chosenExplicitly: state.regimeChosenExplicitly,
      recommended: comparison.recommended,
      taxUnderNew: comparison.new.totalTaxLiability,
      taxUnderOld: comparison.old.totalTaxLiability,
      savingFromRecommended: comparison.saving,
    },

    deductions: {
      claimedTotal: current.chapterVIA,
      breakdown: current.chapterVIABreakdown.map((b) => ({
        label: b.label,
        amount: b.amount,
      })),
      rawEntries: state.deductions,
      hraExemption: current.hraExemption,
      noteIfNewRegime:
        state.regime === "new"
          ? "Only 80CCD(2) and the standard deduction apply under the new regime; other sections are recorded but have no effect until the regime is switched."
          : undefined,
    },

    computation: {
      totalIncome: current.totalIncome,
      taxBeforeRebate: Math.round(current.taxBeforeRebate),
      rebate87A: Math.round(current.rebate87A),
      marginalRelief: Math.round(current.marginalRelief),
      surcharge: Math.round(current.surcharge),
      cess: Math.round(current.cess),
      totalTaxLiability: current.totalTaxLiability,
      tdsCredit: current.tdsCredit,
      selfAssessmentTaxPaid: current.selfAssessmentTax,
      refundDue: current.refundDue,
      taxPayable: current.taxPayable,
    },

    reconciliation: {
      totalEntries: aisEntries.length,
      pendingCount: pending.length,
      pendingItems: pending.map((e) => ({
        id: e.id,
        description: e.description,
        source: e.source,
        aisAmount: e.aisAmount,
        declaredAmount: e.declaredAmount,
        tdsDeducted: e.tdsDeducted,
        gap: e.aisAmount - e.declaredAmount,
        whyItMatters: e.plainLanguage,
      })),
      resolved: Object.values(state.reconciliation)
        .filter((r) => r.resolution !== "pending")
        .map((r) => ({ id: r.id, resolution: r.resolution })),
    },

    filing: {
      formSelected: state.filing.formSelected,
      reviewConfirmed: state.filing.reviewConfirmed,
      submitted: state.filing.submitted,
      acknowledgementNumber: state.filing.acknowledgementNumber,
      everified: state.filing.everified,
      selfAssessmentTaxPaid: state.filing.paymentDone,
    },

    refund: {
      stage,
      stageMeaning: refundStageMeaning(stage),
      amount: current.refundDue,
    },

    notices: {
      openRequiringResponse: openNotices.map((n) => ({
        id: n.id,
        title: n.title,
        section: n.section,
        respondBy: n.respondBy,
      })),
    },

    grievances: state.grievances.map((g) => ({
      id: g.id,
      topic: g.topicLabel,
      status: g.status,
      raisedOn: g.raisedOn.slice(0, 10),
    })),

    recentActions: state.actionLog.slice(0, 6).map((a) => ({
      by: a.actor,
      what: a.summary,
    })),
  };
}

export function refundStageMeaning(stage: string): string {
  switch (stage) {
    case "not-filed":
      return "The return has not been submitted yet, so there is no refund in the pipeline.";
    case "filed":
      return "The return is submitted but not yet e-verified. Nothing moves until it is verified — there is a 30-day window.";
    case "verified":
      return "Verified and queued at the Centralised Processing Centre. Processing usually takes two to five weeks.";
    case "processed":
      return "Processed and the refund has been determined. The amount is now with the refund banker for payout.";
    case "issued":
      return "The refund has been released to the nominated bank account. Credit typically appears within a few working days.";
    default:
      return "Status unknown.";
  }
}

/**
 * A compact human-readable rendering of the same snapshot. The model follows
 * numbers more reliably when they are labelled prose rather than raw JSON, so
 * both go into the prompt.
 */
export function summariseContext(ctx: ScreenContext): string {
  const lines: string[] = [];
  lines.push(
    `The user is on "${ctx.currentScreen.module}" (${ctx.currentScreen.path}).`,
  );
  lines.push(
    `Assessment Year ${ctx.assessmentYear} (FY ${ctx.financialYear}); due date ${ctx.filingDeadline}; today is ${ctx.today}.`,
  );
  lines.push(
    `Regime selected: ${ctx.regime.selected}. Tax under new: ₹${inrPlain(ctx.regime.taxUnderNew)}. Under old: ₹${inrPlain(ctx.regime.taxUnderOld)}. Cheaper: ${ctx.regime.recommended}, by ₹${inrPlain(ctx.regime.savingFromRecommended)}.`,
  );
  lines.push(
    `Gross total income ₹${inrPlain(ctx.income.grossTotalIncome)}; total income after deductions ₹${inrPlain(ctx.computation.totalIncome)}; total tax ₹${inrPlain(ctx.computation.totalTaxLiability)}; TDS credit ₹${inrPlain(ctx.computation.tdsCredit)}.`,
  );
  lines.push(
    ctx.computation.refundDue > 0
      ? `A refund of ₹${inrPlain(ctx.computation.refundDue)} is due.`
      : ctx.computation.taxPayable > 0
        ? `₹${inrPlain(ctx.computation.taxPayable)} of self-assessment tax is still payable.`
        : `Tax paid and tax due are square — nothing to pay, nothing to refund.`,
  );
  if (ctx.reconciliation.pendingCount > 0) {
    lines.push(
      `${ctx.reconciliation.pendingCount} unresolved AIS mismatch(es): ${ctx.reconciliation.pendingItems
        .map(
          (p) =>
            `${p.id} — ${p.description} from ${p.source}, AIS says ₹${inrPlain(p.aisAmount)} vs ₹${inrPlain(p.declaredAmount)} declared`,
        )
        .join("; ")}.`,
    );
  } else {
    lines.push("All AIS entries have been reconciled.");
  }
  lines.push(
    `Filing: form ${ctx.filing.formSelected ?? "not chosen"}, submitted ${ctx.filing.submitted ? "yes" : "no"}, e-verified ${ctx.filing.everified ? "yes" : "no"}. Refund stage: ${ctx.refund.stage}.`,
  );
  if (ctx.notices.openRequiringResponse.length > 0) {
    lines.push(
      `Open notices needing a response: ${ctx.notices.openRequiringResponse.map((n) => `${n.section} — ${n.title} (by ${n.respondBy})`).join("; ")}.`,
    );
  }
  if (ctx.grievances.length > 0) {
    lines.push(
      `Grievances raised: ${ctx.grievances.map((g) => `${g.id} (${g.status})`).join(", ")}.`,
    );
  }
  return lines.join("\n");
}
