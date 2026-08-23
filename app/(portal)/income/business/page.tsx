"use client";

import { OutOfScope } from "@/components/OutOfScope";

export default function BusinessIncomePage() {
  return (
    <OutOfScope
      eyebrow="Income · Business and profession"
      title="Business and professional income is not built here"
      lede="Freelancing, consulting, a shop, a clinic. The moment there is business income the return stops being a salaried return, and almost every rule on this platform changes shape."
      whatItWouldNeed={[
        "A profit and loss account and balance sheet, or the presumptive route under section 44AD (businesses) or 44ADA (professionals)",
        "Form 10-IEA to opt out of the new regime, filed before the due date — and the one-time-only rule about switching back",
        "Advance tax in four instalments, with interest under sections 234B and 234C when they are missed",
        "GST turnover reconciliation, and a tax audit under section 44AB once the thresholds are crossed",
        "ITR-3 or ITR-4 rather than ITR-1, with depreciation schedules and partner or director disclosures",
      ]}
      whatIsThere={[
        {
          label: "The regime engine already knows the difference",
          detail:
            "The comparison screen explains that a salaried person can switch regimes freely every year, while someone with business income needs Form 10-IEA and gets one lifetime switch back.",
        },
        {
          label: "The glossary covers the vocabulary",
          detail:
            "Form 10-IEA, advance tax and self-assessment tax all have plain-language entries in Help, and the copilot can pull them up for you.",
        },
      ]}
    />
  );
}
