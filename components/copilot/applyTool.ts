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
  buildEverifyConfirmation,
  buildPaymentConfirmation,
  buildSubmissionConfirmation,
} from "@/lib/confirmations";
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
 *
 * Arguments are validated before anything is written (§5.6): a bad section
 * name, an unknown module or an out-of-range amount comes back as a structured
 * error the model can act on, not a partially applied change or a thrown
 * exception. The wrapper also attaches the id of whatever timeline entry the
 * call produced, which is what puts an "Undo" next to it in the transcript.
 */
export function applyTool(
  call: ToolCall,
  navigate: (href: string) => void,
): ToolOutcome {
  const topBefore = useAppStore.getState().actionLog[0]?.id;
  let outcome: ToolOutcome;
  try {
    outcome = runTool(call, navigate);
  } catch (error) {
    // A tool must never surface a raw exception to the model.
    return {
      name: call.name,
      ok: false,
      summary: `${call.name} failed before it could change anything.`,
      result: {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected failure inside the tool.",
        suggestion:
          "Tell the user plainly that this did not work and point them at the relevant screen.",
      },
    };
  }
  const topAfter = useAppStore.getState().actionLog[0];
  return topAfter && topAfter.id !== topBefore
    ? { ...outcome, logId: topAfter.id }
    : outcome;
}

function runTool(
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
      const raw = numArg(call.args.amount);
      if (!Number.isFinite(raw) || raw < 0 || raw > 50_000_000) {
        return {
          name: call.name,
          ok: false,
          summary: `₹${raw} is not a usable amount for ${str(call.args.section)}.`,
          result: {
            ok: false,
            error:
              "amount must be a non-negative number of rupees below ₹5,00,00,000.",
            suggestion: "Ask the user what the figure actually is.",
          },
        };
      }
      const amount = Math.round(raw);

      // Idempotent: setting a section to what it already holds is a no-op, so
      // the same call twice never double-counts.
      if (store.deductions[sectionKey] === amount) {
        return {
          name: call.name,
          ok: true,
          summary: `${str(call.args.section)} was already recorded at ₹${inrPlain(amount)}`,
          result: {
            ok: true,
            noChange: true,
            section: str(call.args.section),
            amountEntered: amount,
          },
        };
      }

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
      // Idempotent within a session: the same topic raised twice in five
      // minutes returns the existing ticket rather than opening a second one.
      const topicId = str(call.args.topic);
      const recent = store.grievances.find(
        (g) =>
          g.topic === topicId &&
          Date.now() - new Date(g.raisedOn).getTime() < 5 * 60_000,
      );
      if (recent) {
        return {
          name: call.name,
          ok: true,
          summary: `Grievance ${recent.id} is already open for this`,
          result: {
            ok: true,
            noChange: true,
            grievanceId: recent.id,
            status: recent.status,
            note: "An identical grievance was raised moments ago; a second one would only slow it down.",
          },
        };
      }

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

    /* ------------------- Tier 2: assemble, do not file ---------- */
    case "prepare_submission": {
      const state = useAppStore.getState();
      const computation = computeTax(toTaxpayerInput(state));
      const pending = Object.values(state.reconciliation).filter(
        (r) => r.resolution === "pending",
      ).length;

      if (!state.form16Imported) {
        return {
          name: call.name,
          ok: false,
          summary: "There is no income in the return yet.",
          result: {
            ok: false,
            error: "Form 16 has not been imported, so the return is empty.",
            suggestion:
              "Take the user to the salary screen and import the Form 16 first.",
          },
        };
      }

      const confirmation = buildSubmissionConfirmation(state, "copilot");
      store.requestConfirmation(confirmation);
      navigate("/filing");
      const summary = "Assembled the return and put the confirmation card on screen";
      store.logAction({ actor: "copilot", tool: "prepare_submission", summary });
      store.pushToast({
        tone: "copilot",
        title: "Return assembled",
        body: "Filing needs your tap — the card is on screen.",
      });
      return {
        name: call.name,
        ok: true,
        summary,
        result: {
          ok: true,
          awaitingUserTap: true,
          form: state.filing.formSelected ?? "ITR-1",
          regime: state.regime,
          totalIncome: computation.totalIncome,
          totalTax: computation.totalTaxLiability,
          refundDue: computation.refundDue,
          taxPayable: computation.taxPayable,
          unresolvedMismatches: pending,
          note:
            pending > 0
              ? `${pending} AIS difference(s) are still unresolved — say so before the user taps confirm.`
              : "Everything reconciles.",
          youMustTellTheUser:
            "You cannot file this yourself. Say plainly that the card on screen is theirs to tap.",
        },
      };
    }

    /* ------------------- Tier 3: gated on a real tap ------------ */
    case "submit_return":
      return tierThree(call, navigate, {
        kind: "submit",
        build: (st) => buildSubmissionConfirmation(st, "copilot"),
        alreadyDone: (st) => st.filing.submitted,
        alreadyMessage: "The return has already been submitted.",
        run: (st) => {
          const ack = `SYN${Date.now().toString().slice(-9)}${Math.floor(
            Math.random() * 900 + 100,
          )}`;
          st.submitReturn(ack);
          return { acknowledgementNumber: ack };
        },
        landing: "/filing/confirmation",
        doneSummary: "Filed the return",
      });

    case "initiate_evc":
      return tierThree(call, navigate, {
        kind: "everify",
        build: (st) => buildEverifyConfirmation(st, "copilot"),
        alreadyDone: (st) => st.filing.everified,
        alreadyMessage: "The return is already e-verified.",
        blockedUnless: (st) => st.filing.submitted,
        blockedMessage:
          "Nothing has been submitted yet, so there is nothing to verify.",
        run: (st) => {
          st.everify();
          return {};
        },
        landing: "/filing/confirmation",
        doneSummary: "e-Verified the return",
      });

    case "initiate_payment":
      return tierThree(call, navigate, {
        kind: "payment",
        build: (st) => buildPaymentConfirmation(st, "copilot"),
        alreadyDone: (st) => st.filing.paymentDone,
        alreadyMessage: "Self-assessment tax has already been paid.",
        blockedUnless: (st) =>
          computeTax(toTaxpayerInput(st)).taxPayable > 0,
        blockedMessage:
          "No self-assessment tax is payable — this return is in refund.",
        run: (st) => {
          const due = computeTax(toTaxpayerInput(st)).taxPayable;
          st.payTax(due);
          return { amountPaid: due };
        },
        landing: "/filing/payment",
        doneSummary: "Recorded the self-assessment tax payment",
      });

    /* ---------------------------------------------------------- */
    default:
      return {
        name: call.name,
        ok: false,
        summary: `I do not have a tool called "${call.name}".`,
        result: {
          ok: false,
          error: "Unknown tool.",
          suggestion: "Answer from the screen context instead of calling a tool.",
        },
      };
  }
}

/* ================================================================
   The Tier 3 gate
   ================================================================ */

type TierThreeSpec = {
  kind: "submit" | "everify" | "payment";
  build: (
    st: ReturnType<typeof useAppStore.getState>,
  ) => Parameters<ReturnType<typeof useAppStore.getState>["requestConfirmation"]>[0];
  alreadyDone: (st: ReturnType<typeof useAppStore.getState>) => boolean;
  alreadyMessage: string;
  blockedUnless?: (st: ReturnType<typeof useAppStore.getState>) => boolean;
  blockedMessage?: string;
  run: (st: ReturnType<typeof useAppStore.getState>) => Record<string, unknown>;
  landing: string;
  doneSummary: string;
};

/**
 * The three irreversible actions share one shape: they check the state makes
 * sense, and then either complete (because the user has already tapped the
 * card for exactly this action) or raise the card and stop.
 *
 * The acknowledgement is single-use — it is cleared here — so a second
 * irreversible action needs its own fresh tap. That is what stops a "go ahead"
 * three messages ago from filing a return.
 */
function tierThree(
  call: ToolCall,
  navigate: (href: string) => void,
  spec: TierThreeSpec,
): ToolOutcome {
  const store = useAppStore.getState();

  if (spec.alreadyDone(store)) {
    return {
      name: call.name,
      ok: true,
      summary: spec.alreadyMessage,
      result: { ok: true, noChange: true, note: spec.alreadyMessage },
    };
  }

  if (spec.blockedUnless && !spec.blockedUnless(store)) {
    return {
      name: call.name,
      ok: false,
      summary: spec.blockedMessage ?? "That step is not available yet.",
      result: {
        ok: false,
        error: spec.blockedMessage ?? "Preconditions not met.",
        suggestion: "Explain what has to happen first.",
      },
    };
  }

  const pending = store.pendingConfirmation;
  const authorised =
    pending?.kind === spec.kind && pending.acknowledged === true;

  if (!authorised) {
    store.requestConfirmation(spec.build(store));
    navigate(spec.landing);
    store.pushToast({
      tone: "copilot",
      title: "Your confirmation is needed",
      body: "This one is irreversible, so it stops for your tap.",
    });
    return {
      name: call.name,
      ok: false,
      summary: "Put the confirmation card on screen — this needs the user's tap",
      result: {
        ok: false,
        blocked: "awaiting_user_confirmation",
        error:
          "This action is irreversible and cannot be triggered from the chat. The confirmation card is now on screen.",
        suggestion:
          "Tell the user plainly that you cannot do this one yourself and that the card on screen is theirs to tap. Do not claim it is done.",
      },
    };
  }

  const extra = spec.run(store);
  store.dismissConfirmation();
  navigate(spec.landing);
  return {
    name: call.name,
    ok: true,
    summary: spec.doneSummary,
    result: { ok: true, ...extra },
  };
}
