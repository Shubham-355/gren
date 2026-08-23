"use client";

import { findGlossaryEntry, glossary } from "@/lib/data/glossary";
import { inrPlain } from "@/lib/format";
import { refundStageMeaning } from "@/lib/copilot/context";
import {
  MODULES,
  type ModuleKey,
  type ToolCall,
  type ToolOutcome,
} from "@/lib/copilot/tools";
import {
  refundStage,
  toTaxpayerInput,
  useAppStore,
  type MismatchResolution,
} from "@/lib/store/useAppStore";
import type { DeductionInput } from "@/lib/tax/compute";
import { computeTax } from "@/lib/tax/compute";
import { slug } from "@/components/ui";

const SECTION_MAP: Record<string, keyof DeductionInput> = {
  "80C": "s80C",
  "80CCD(1B)": "s80CCD1B",
  "80D_self": "s80D_self",
  "80D_parents": "s80D_parents",
  "80DDB": "s80DDB",
  "80E": "s80E",
  "80G": "s80G",
  "80TTA": "s80TTA",
  "80EEB": "s80EEB",
  "80U": "s80U",
};

const RESOLUTION_MAP: Record<string, MismatchResolution> = {
  accept: "accepted",
  correct_amount: "amount-corrected",
  belongs_to_other_pan: "other-pan",
  duplicate: "duplicate",
  disagree: "denied",
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const numArg = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string"
      ? Number.parseFloat(v.replace(/[^0-9.]/g, "")) || 0
      : 0;

/**
 * Applies one model-issued tool call to the same store the screens use, and
 * returns a result the model can be told about on the next turn.
 */
export function applyTool(
  call: ToolCall,
  navigate: (href: string) => void,
): ToolOutcome {
  const store = useAppStore.getState();

  switch (call.name) {
    /* ---------------------------------------------------------- */
    case "navigate_to": {
      const key = str(call.args.module) as ModuleKey;
      const target = MODULES[key];
      if (!target) {
        return {
          name: call.name,
          ok: false,
          summary: `There is no module called "${key}".`,
          result: {
            ok: false,
            error: `Unknown module. Valid modules: ${Object.keys(MODULES).join(", ")}`,
          },
        };
      }
      navigate(target.href);
      store.touchModule(key);
      const summary = `Opened ${target.label}`;
      store.logAction({ actor: "copilot", tool: "navigate_to", summary });
      store.pushToast({
        tone: "copilot",
        title: summary,
        body: str(call.args.reason) || undefined,
      });
      return {
        name: call.name,
        ok: true,
        summary,
        result: { ok: true, opened: target.label, path: target.href },
      };
    }

    /* ---------------------------------------------------------- */
    case "switch_regime": {
      const regime = str(call.args.regime) === "old" ? "old" : "new";
      const before = computeTax(toTaxpayerInput(store)).totalTaxLiability;
      if (store.regime === regime) {
        return {
          name: call.name,
          ok: true,
          summary: `Already on the ${regime} regime`,
          result: {
            ok: true,
            noChange: true,
            regime,
            totalTaxLiability: before,
          },
        };
      }
      store.setRegime(regime, "copilot");
      const after = computeTax(toTaxpayerInput(useAppStore.getState()));
      return {
        name: call.name,
        ok: true,
        summary: `Switched to the ${regime} regime`,
        result: {
          ok: true,
          regime,
          previousTotalTax: before,
          newTotalTax: after.totalTaxLiability,
          difference: before - after.totalTaxLiability,
          refundDue: after.refundDue,
          taxPayable: after.taxPayable,
        },
      };
    }

    /* ---------------------------------------------------------- */
    case "add_deduction": {
      const sectionKey = SECTION_MAP[str(call.args.section)];
      if (!sectionKey) {
        return {
          name: call.name,
          ok: false,
          summary: `"${str(call.args.section)}" is not a section this platform tracks.`,
          result: {
            ok: false,
            error: `Unknown section. Valid: ${Object.keys(SECTION_MAP).join(", ")}`,
          },
        };
      }
      const amount = Math.max(0, Math.round(numArg(call.args.amount)));
      store.setDeduction(sectionKey, amount, "copilot");

      const after = computeTax(toTaxpayerInput(useAppStore.getState()));
      const applied = after.chapterVIABreakdown.find((b) =>
        b.label.startsWith(str(call.args.section).split("_")[0]),
      );
      const summary = `Recorded ₹${inrPlain(amount)} under ${str(call.args.section)}`;
      store.pushToast({
        tone: "copilot",
        title: summary,
        body:
          store.regime === "new"
            ? "Saved, but it has no effect while you are on the new regime."
            : `Total tax is now ₹${inrPlain(after.totalTaxLiability)}.`,
      });
      return {
        name: call.name,
        ok: true,
        summary,
        result: {
          ok: true,
          section: str(call.args.section),
          amountEntered: amount,
          amountAllowedAfterCeiling: applied?.amount ?? null,
          regime: store.regime,
          hasEffectInThisRegime: store.regime === "old",
          newTotalTax: after.totalTaxLiability,
          newRefundDue: after.refundDue,
          newTaxPayable: after.taxPayable,
        },
      };
    }

    /* ---------------------------------------------------------- */
    case "resolve_mismatch": {
      const resolution = RESOLUTION_MAP[str(call.args.resolution)];
      if (!resolution) {
        return {
          name: call.name,
          ok: false,
          summary: `"${str(call.args.resolution)}" is not a resolution option.`,
          result: {
            ok: false,
            error: `Valid resolutions: ${Object.keys(RESOLUTION_MAP).join(", ")}`,
          },
        };
      }
      const outcome = store.resolveMismatch(
        str(call.args.item_id),
        resolution,
        "copilot",
        call.args.amount !== undefined ? numArg(call.args.amount) : undefined,
      );
      if (!outcome.ok) {
        return {
          name: call.name,
          ok: false,
          summary: outcome.summary,
          result: { ok: false, error: outcome.summary },
        };
      }
      const after = computeTax(toTaxpayerInput(useAppStore.getState()));
      return {
        name: call.name,
        ok: true,
        summary: outcome.summary,
        result: {
          ok: true,
          what: outcome.summary,
          newGrossTotalIncome: after.grossTotalIncome,
          newTotalTax: after.totalTaxLiability,
          newTdsCredit: after.tdsCredit,
          newRefundDue: after.refundDue,
          newTaxPayable: after.taxPayable,
          remainingMismatches: Object.values(
            useAppStore.getState().reconciliation,
          ).filter((r) => r.resolution === "pending").length,
        },
      };
    }

    /* ---------------------------------------------------------- */
    case "explain_term": {
      const term = str(call.args.term);
      const entry = findGlossaryEntry(term);
      if (!entry) {
        return {
          name: call.name,
          ok: false,
          summary: `No glossary entry for "${term}".`,
          result: {
            ok: false,
            error: `Not in the glossary. Available terms: ${glossary.map((g) => g.term).join(", ")}. Explain it yourself in plain language instead.`,
          },
        };
      }
      navigate(`/help#${slug(entry.term)}`);
      const summary = `Opened the explanation of ${entry.term}`;
      store.logAction({ actor: "copilot", tool: "explain_term", summary });
      store.pushToast({ tone: "copilot", title: summary });
      return {
        name: call.name,
        ok: true,
        summary,
        result: {
          ok: true,
          term: entry.term,
          plainLanguage: entry.short,
          detail: entry.long,
        },
      };
    }

    /* ---------------------------------------------------------- */
    case "raise_grievance": {
      const outcome = store.raiseGrievance(
        str(call.args.topic) as Parameters<typeof store.raiseGrievance>[0],
        str(call.args.description),
        "copilot",
      );
      if (!outcome.ok) {
        return {
          name: call.name,
          ok: false,
          summary: outcome.summary,
          result: { ok: false, error: outcome.summary },
        };
      }
      navigate("/grievance");
      return {
        name: call.name,
        ok: true,
        summary: outcome.summary,
        result: {
          ok: true,
          grievanceId: outcome.detail,
          what: outcome.summary,
        },
      };
    }

    /* ---------------------------------------------------------- */
    case "check_refund_status": {
      const state = useAppStore.getState();
      const stage = refundStage(state);
      const computation = computeTax(toTaxpayerInput(state));
      const summary = `Checked the refund tracker — stage: ${stage}`;
      store.logAction({ actor: "copilot", tool: "check_refund_status", summary });
      return {
        name: call.name,
        ok: true,
        summary,
        result: {
          ok: true,
          stage,
          meaning: refundStageMeaning(stage),
          refundDue: computation.refundDue,
          taxStillPayable: computation.taxPayable,
          submitted: state.filing.submitted,
          everified: state.filing.everified,
          acknowledgementNumber: state.filing.acknowledgementNumber,
          nominatedAccount:
            state.profile.bankAccounts.find((b) => b.nominatedForRefund)?.bank ??
            null,
          note: "Stage timings in this prototype are simulated, not a real CPC feed.",
        },
      };
    }

    /* ---------------------------------------------------------- */
    default:
      return {
        name: call.name,
        ok: false,
        summary: `I do not have a tool called "${call.name}".`,
        result: { ok: false, error: "Unknown tool." },
      };
  }
}
