import type { AppState } from "@/lib/store/useAppStore";
import type { TaxComputation } from "./compute";

export type FormRecommendation = {
  form: "ITR-1" | "ITR-2";
  /** why this form, in the taxpayer's terms */
  reasons: string[];
  /** what would have pushed them up to the next form */
  disqualifiers: { rule: string; triggered: boolean; detail: string }[];
};

/**
 * ITR-1 (Sahaj) eligibility, applied as real rules against the live state
 * rather than as a fixed answer.
 */
export function recommendForm(
  state: AppState,
  computation: TaxComputation,
): FormRecommendation {
  const disqualifiers = [
    {
      rule: "Total income above ₹50 lakh",
      triggered: computation.totalIncome > 5_000_000,
      detail:
        "ITR-1 stops at ₹50 lakh of total income. Above that the return has to carry an asset and liability schedule.",
    },
    {
      rule: "More than one house property",
      triggered: false,
      detail:
        "You have declared at most one property, which ITR-1 allows. A second one moves you to ITR-2.",
    },
    {
      rule: "A loss to carry forward",
      triggered: computation.incomeFromHouseProperty < -200_000,
      detail:
        "A house property loss up to ₹2,00,000 can be set off within ITR-1. Anything beyond that has to be carried forward, which ITR-1 cannot do.",
    },
    {
      rule: "Capital gains",
      triggered: false,
      detail:
        "From AY 2025-26 ITR-1 tolerates long-term gains under section 112A up to ₹1.25 lakh. Anything else needs ITR-2.",
    },
    {
      rule: "Business or professional income",
      triggered: false,
      detail: "That would need ITR-3 or ITR-4, neither of which is built here.",
    },
    {
      rule: "Foreign income, foreign assets, or non-resident status",
      triggered: state.profile.residentialStatus !== "Resident",
      detail:
        "ITR-1 is for ordinarily resident individuals only. Foreign assets trigger schedule FA in ITR-2.",
    },
    {
      rule: "Director in a company, or unlisted shares held",
      triggered: false,
      detail: "Both require the disclosures that only ITR-2 carries.",
    },
    {
      rule: "Agricultural income above ₹5,000",
      triggered: false,
      detail: "Small agricultural income is fine in ITR-1; larger amounts are not.",
    },
  ];

  const blocked = disqualifiers.filter((d) => d.triggered);
  const form: "ITR-1" | "ITR-2" = blocked.length > 0 ? "ITR-2" : "ITR-1";

  const reasons =
    form === "ITR-1"
      ? [
          "You are a resident individual with salary income",
          state.houseProperty.enabled
            ? "One house property, which ITR-1 allows"
            : "No house property to report",
          "Interest and dividend income, which belong under other sources",
          `Total income of ${Math.round(computation.totalIncome).toLocaleString("en-IN")}, within the ₹50 lakh ceiling`,
        ]
      : blocked.map((b) => b.rule);

  return { form, reasons, disqualifiers };
}
