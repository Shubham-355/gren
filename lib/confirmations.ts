import { inr } from "@/lib/format";
import {
  toTaxpayerInput,
  type AppState,
  type PendingConfirmation,
} from "@/lib/store/useAppStore";
import { computeTax } from "@/lib/tax/compute";
import { recommendForm } from "@/lib/tax/formSelection";

/**
 * One builder per Tier 3 action, so the card the copilot raises and the card
 * the "Submit my return" button raises are literally the same card. There is
 * no chat-only version of an irreversible step.
 */

export function buildSubmissionConfirmation(
  s: AppState,
  requestedBy: "you" | "copilot",
): Omit<PendingConfirmation, "createdAt" | "acknowledged"> {
  const c = computeTax(toTaxpayerInput(s));
  const form = s.filing.formSelected ?? recommendForm(s, c).form;

  const lines = [
    { label: "Total income", value: inr(c.totalIncome) },
    {
      label: `Deductions · ${s.regime} regime`,
      value: inr(c.chapterVIA + c.standardDeduction),
    },
    { label: "Tax on total income", value: inr(c.totalTaxLiability) },
    { label: "Already paid", value: inr(c.tdsCredit + c.selfAssessmentTax) },
    c.refundDue > 0
      ? { label: "Refund claimed", value: inr(c.refundDue) }
      : { label: "Tax payable", value: inr(c.taxPayable) },
  ];

  return {
    kind: "submit",
    title: `Ready to file your ${form}`,
    body: `Submitting files this return with the department under PAN ${s.profile.pan}. You can revise it later, but you cannot un-file it.`,
    lines,
    confirmLabel: "Confirm & submit",
    requestedBy,
  };
}

export function buildEverifyConfirmation(
  s: AppState,
  requestedBy: "you" | "copilot",
): Omit<PendingConfirmation, "createdAt" | "acknowledged"> {
  return {
    kind: "everify",
    title: "e-Verify this return",
    body: "Until it is verified, the law treats a submitted return as never filed. Verifying is final — it is the moment the return counts.",
    lines: [
      {
        label: "Acknowledgement",
        value: s.filing.acknowledgementNumber ?? "—",
      },
      { label: "Method", value: "Aadhaar OTP (simulated)" },
      {
        label: "Aadhaar ending",
        value: s.profile.aadhaarMasked.slice(-4),
      },
    ],
    confirmLabel: "Verify my return",
    requestedBy,
  };
}

export function buildPaymentConfirmation(
  s: AppState,
  requestedBy: "you" | "copilot",
): Omit<PendingConfirmation, "createdAt" | "acknowledged"> {
  const c = computeTax(toTaxpayerInput(s));
  return {
    kind: "payment",
    title: "Pay your self-assessment tax",
    body: "This records a payment against your return. No gateway is contacted and no payment detail is collected — the challan is generated locally.",
    lines: [
      { label: "Tax on total income", value: inr(c.totalTaxLiability) },
      { label: "Already paid", value: inr(c.tdsCredit) },
      { label: "Amount to pay", value: inr(c.taxPayable) },
    ],
    amount: c.taxPayable,
    confirmLabel: `Pay ${inr(c.taxPayable)}`,
    requestedBy,
  };
}
