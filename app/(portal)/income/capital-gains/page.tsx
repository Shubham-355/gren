"use client";

import { OutOfScope } from "@/components/OutOfScope";

export default function CapitalGainsPage() {
  return (
    <OutOfScope
      eyebrow="Income · Capital gains"
      title="Capital gains is not built in this prototype"
      lede="Shares, mutual funds, gold, property. It is the single largest chunk of scope in an e-filing platform, and building it badly would have been worse than not building it."
      whatItWouldNeed={[
        "Trade-level import from the broker and registrar statements the AIS already carries, then matching every sale to its purchase lot",
        "Grandfathering under section 112A for equity bought before 31 January 2018 — the fair market value on that date, not the actual cost",
        "Short term versus long term for six different asset classes, each with its own holding period and rate",
        "Indexation where it still survives, and the 2024 rate change for property",
        "Set-off and carry-forward rules that differ between short-term and long-term losses",
      ]}
      whatIsThere={[
        {
          label: "The AIS entries exist",
          detail:
            "Your reconciliation screen already lists the mutual fund purchase reported under SFT-018, so the plumbing for securities information is real.",
        },
        {
          label: "Form selection knows about it",
          detail:
            "The filing module recommends ITR-2 rather than ITR-1 the moment capital gains would be involved, and explains why.",
        },
      ]}
    />
  );
}
