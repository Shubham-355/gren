import { discoveryQuestionsFor } from "@/lib/data/discovery";
import { findGlossaryEntry, glossary } from "@/lib/data/glossary";
import { FLOW_STEPS, nextStep, stepDone } from "@/lib/flow";
import { inr, pct, shortDate } from "@/lib/format";
import {
  hasSeededDocuments,
  pendingMismatches,
  refundStage,
  toTaxpayerInput,
  type AppState,
} from "@/lib/store/useAppStore";
import {
  breakEvenDeductions,
  compareRegimes,
  computeTax,
  oldRegimeAvailable,
  type DeductionInput,
  type TaxpayerInput,
} from "@/lib/tax/compute";
import { BELATED_DEADLINE, FILING_DEADLINE } from "@/lib/tax/constants";
import { refundStageMeaning, SECTION_ARGUMENTS } from "./context";
import { MODULES, type ToolCall } from "./tools";
import {
  extractAmount,
  incomeLabel,
  isAffirmation,
  isNegated,
  isQuestion,
  matchIncomeField,
  matchSection,
  normalise,
  score,
} from "./language";

/**
 * What Saathi does when the model is not there.
 *
 * Almost nothing this assistant does actually needs a language model. The tools
 * are the platform's own functions, the figures are already computed, and the
 * journey knows its own order. What the model contributes is understanding an
 * arbitrary sentence — so that is the only part worth rebuilding here, and for
 * the sentences people type at a tax return it is a tractable problem.
 *
 * It is not a smaller model. It is the same engine answering directly, which
 * on the arithmetic makes it *more* reliable than the model: when it says a
 * ₹50,000 NPS contribution would save you ₹15,600, it has run the return both
 * ways rather than estimated. It says where the answer came from — the
 * `offline` flag — because a rule-based reply wearing the model's name would
 * be the one dishonest thing in an app built on not doing that.
 */

export type LocalReply = {
  text: string;
  toolCalls: ToolCall[];
  /**
   * Whether the agent loop should come back for another round.
   *
   * Only the journey wants that — "just file it for me" is several steps and
   * each one is decided from the state the last one left behind. Everything
   * else is one shot, and looping on it re-reads the same sentence against
   * changed state: a confirmed "another ₹50,000 under 80C" ran eight times and
   * compounded to ₹4,00,000 before this existed.
   */
  continues?: boolean;
};

export type LocalContext = {
  /** the screen the user is on, for disambiguating a vague sentence */
  module?: string;
  /** the previous user message, so "yes, do it" means something */
  previousMessage?: string;
};

const answer = (text: string, toolCalls: ToolCall[] = []): LocalReply => ({
  text,
  toolCalls,
});

/** Everything an answer might need, computed once. */
function read(state: AppState) {
  const input = toTaxpayerInput(state);
  return {
    input,
    current: computeTax(input),
    comparison: compareRegimes(input),
    pending: pendingMismatches(state),
    documents: hasSeededDocuments(state),
    questions: discoveryQuestionsFor(
      state.profile.age,
      state.otherSources,
      hasSeededDocuments(state),
    ),
  };
}

/* ================================================================
   The what-if engine
   ================================================================ */

/**
 * The same return with one thing changed, and what that does to the bill.
 *
 * This is the part a language model cannot do honestly — it would estimate.
 * The engine is pure functions, so the counterfactual is just another call.
 */
function whatIf(
  state: AppState,
  change: (input: TaxpayerInput) => TaxpayerInput,
): { before: number; after: number; saving: number } {
  const input = toTaxpayerInput(state);
  const before = computeTax(input).totalTaxLiability;
  const after = computeTax(change(input)).totalTaxLiability;
  return { before, after, saving: before - after };
}

function describeSaving(
  label: string,
  result: { before: number; after: number; saving: number },
  regime: "new" | "old",
): string {
  if (result.saving === 0) {
    return `${label} would not change your tax at all${
      regime === "new"
        ? " — the new regime does not allow it. On the old regime it would."
        : "; you are already past the ceiling on that one."
    }`;
  }
  const direction = result.saving > 0 ? "take your tax from" : "raise your tax from";
  return `${label} would ${direction} ${inr(result.before)} to ${inr(
    result.after,
  )} — a difference of ${inr(Math.abs(result.saving))}.`;
}

/* ================================================================
   Intents
   ================================================================ */

type Intent = {
  id: string;
  phrases: string[];
  /** screens where this reading is more likely than it looks */
  favours?: string[];
  /**
   * `confirming` is true when the user answered a bare "yes" to whatever was
   * last said. Only the what-if handler cares: everywhere else, re-reading the
   * previous sentence is already the right behaviour.
   */
  run: (message: string, state: AppState, confirming: boolean) => LocalReply;
};

const INTENTS: Intent[] = [
  /* ---------------------------------------------------- the whole job */
  {
    id: "journey",
    phrases: [
      "file it for me",
      "just file it",
      "file my return",
      "file the return",
      "do it all",
      "do everything",
      "finish my return",
      "complete my return",
      "walk me through",
      "the whole thing",
      "take it from here",
    ],
    run: (_m, state) => driveJourney(state),
  },

  /* ------------------------------------------------- setting a figure */
  {
    id: "set-deduction",
    phrases: [
      "80c", "80d", "80e", "80g", "80u", "80tta", "80ttb", "80ddb", "80eeb",
      "80ccd", "epf", "ppf", "elss", "nps", "health insurance", "education loan",
      "donation", "life insurance", "provident fund", "electric vehicle",
    ],
    run: (message, state) => setDeduction(message, state),
  },
  {
    id: "set-income",
    phrases: [
      "my basic", "basic salary", "hra received", "rent paid", "i pay rent",
      "tds", "tax deducted", "fd interest", "fixed deposit", "savings interest",
      "dividend", "home loan interest", "special allowance", "employer nps",
    ],
    run: (message, state) => setIncome(message, state),
  },

  /* -------------------------------------------------------- what-ifs */
  {
    id: "what-if",
    phrases: [
      "what if", "how much would i save", "how much will i save", "if i invest",
      "if i put", "if i add", "would i save", "worth investing", "should i invest",
      "if i claim", "suppose i",
    ],
    run: (message, state, confirming) => answerWhatIf(message, state, confirming),
  },
  {
    id: "break-even",
    phrases: ["break even", "breakeven", "how much do i need", "worth switching"],
    run: (_m, state) => {
      const { comparison } = read(state);
      const shelter = breakEvenDeductions(toTaxpayerInput(state));
      if (!Number.isFinite(shelter)) {
        return answer(
          "At your income the old regime cannot catch up however much you shelter — the new regime wins outright.",
        );
      }
      return answer(
        `You need about ${inr(shelter)} of old-regime-only relief — HRA exemption plus Chapter VI-A — before the old regime beats the new one. Right now the old regime shelters ${inr(
          comparison.old.exemptAllowances + comparison.old.chapterVIA,
        )}.`,
        [{ name: "navigate_to", args: { module: "regime" } }],
      );
    },
  },

  /* ----------------------------------------------------- late filing */
  {
    id: "late",
    phrases: [
      "file late", "filing late", "miss the deadline", "after the deadline",
      "234a", "234f", "late fee", "belated", "what happens if i am late",
      "due date",
    ],
    run: (_m, state) => explainLateness(state),
  },

  /* --------------------------------------------------- reconciliation */
  {
    id: "reconcile-settle",
    phrases: [
      "settle the ais", "settle all", "settle the differences", "resolve the",
      "accept the ais", "sort the differences", "fix the differences",
      "clear the differences", "settle them",
    ],
    favours: ["reconciliation"],
    run: (_m, state) => settleMismatches(state),
  },
  {
    id: "reconcile-explain",
    phrases: ["ais", "26as", "tis", "mismatch", "difference", "reconcile"],
    favours: ["reconciliation"],
    run: (_m, state) => explainReconciliation(state),
  },

  /* ---------------------------------------------------------- regime */
  {
    id: "regime",
    phrases: [
      "regime", "old or new", "new or old", "which is cheaper", "switch me to",
      "115bac",
    ],
    favours: ["regime"],
    run: (message, state) => handleRegime(message, state),
  },

  /* ------------------------------------------------------ deductions */
  {
    id: "deductions",
    phrases: [
      "deduction questions", "answer my deductions", "claim my deductions",
      "what else can i claim", "what can i claim", "save tax", "reduce my tax",
    ],
    favours: ["deductions"],
    run: (_m, state) => askDeductions(state),
  },

  /* ----------------------------------------------------- the numbers */
  {
    id: "position",
    phrases: [
      "how much do i owe", "what do i owe", "my refund", "how much refund",
      "what is my tax", "my total tax", "how much tax", "am i getting a refund",
      "what do i get back", "payable",
    ],
    run: (_m, state) => answer(whereYouStand(state)),
  },
  {
    id: "working",
    phrases: [
      "show me the working", "how did you get", "break it down", "breakdown",
      "the arithmetic", "slab by slab", "how is that calculated",
      "where does that come from", "explain the number",
    ],
    run: (_m, state) => showWorking(state),
  },
  {
    id: "effective-rate",
    phrases: ["effective rate", "what percent", "what percentage", "average rate"],
    run: (_m, state) => {
      const { current } = read(state);
      return answer(
        `Your effective rate is ${pct(current.effectiveRate)} — ${inr(
          current.totalTaxLiability,
        )} of tax on ${inr(current.grossTotalIncome)} of gross total income. That is the whole bill over the whole income, not the rate of your top slab.`,
      );
    },
  },

  /* --------------------------------------------------------- process */
  {
    id: "whats-left",
    phrases: [
      "what next", "what is left", "whats left", "what still needs",
      "what do i need to do", "am i done", "how far",
    ],
    run: (_m, state) => answer(`${whatIsLeft(state)} ${whereYouStand(state)}`),
  },
  {
    id: "verify",
    phrases: [
      "e verify", "everify", "verification", "if i do not verify",
      "if i dont verify", "30 days",
    ],
    run: (_m, state) => {
      const stage = refundStage(state);
      return answer(
        state.filing.everified
          ? "Your return is verified — that is the step that makes a submitted return count, and it is done."
          : `A submitted return that is not e-verified within 30 days is treated as never filed. ${refundStageMeaning(stage)}`,
        state.filing.submitted && !state.filing.everified
          ? [{ name: "navigate_to", args: { module: "everify" } }]
          : [],
      );
    },
  },
  {
    id: "refund",
    phrases: ["refund", "when will i get", "money back"],
    favours: ["refund"],
    run: (_m, state) => {
      const { current } = read(state);
      const stage = refundStage(state);
      return answer(
        current.refundDue > 0
          ? `${inr(current.refundDue)} is due back to you. ${refundStageMeaning(stage)}`
          : `No refund is due on your figures as they stand. ${refundStageMeaning(stage)}`,
        [{ name: "check_refund_status", args: {} }],
      );
    },
  },
  {
    id: "payment",
    phrases: ["pay my tax", "self assessment", "pay the balance", "challan", "140a"],
    run: (_m, state) => {
      const { current } = read(state);
      if (current.taxPayable <= 0) {
        return answer(
          "There is nothing to pay — what has already been deducted covers the whole bill.",
        );
      }
      return answer(
        `${inr(current.taxPayable)} is outstanding${
          current.interest.total > 0
            ? `, of which ${inr(current.interest.total)} is interest and fee rather than tax`
            : ""
        }. Paying is the one thing I cannot do for you; the payment screen raises a card for your tap.`,
        [{ name: "navigate_to", args: { module: "payment" } }],
      );
    },
  },
  {
    id: "grievance",
    phrases: ["grievance", "complain", "complaint", "something is wrong", "raise a ticket"],
    run: () =>
      answer(
        "The grievance screen lists the topics, and each one routes to the desk that handles it with a tracking number.",
        [{ name: "navigate_to", args: { module: "grievance" } }],
      ),
  },
  {
    id: "notices",
    phrases: ["notice", "intimation", "143 1", "department sent"],
    run: () =>
      answer(
        "Every notice is rewritten in plain language first, with the formal text kept underneath.",
        [{ name: "navigate_to", args: { module: "notices" } }],
      ),
  },
  {
    id: "form16",
    phrases: ["form 16", "form16", "import my salary", "bring in my salary"],
    run: (_m, state) =>
      read(state).documents
        ? answer("Bringing your Form 16 into the return.", [
            { name: "import_form16", args: {} },
          ])
        : answer(
            "No Form 16 is filed against this PAN, so there is nothing to pull in. Tell me your basic salary and the tax your employer deducted and I will put them in.",
            [{ name: "navigate_to", args: { module: "salary" } }],
          ),
  },
  {
    id: "capability",
    phrases: [
      "what can you do", "what do you do", "help me", "who are you", "can you",
    ],
    run: (_m, state) => answer(capabilities(state)),
  },
];

/* ================================================================
   Entry point
   ================================================================ */

export function respondLocally(
  message: string,
  state: AppState,
  context: LocalContext = {},
): LocalReply {
  // "Yes, do it" only means whatever was being discussed a moment ago — and it
  // means *do* it, not say it again.
  const confirming = isAffirmation(message) && Boolean(context.previousMessage);
  const effective = confirming ? context.previousMessage! : message;

  const ranked = INTENTS.map((intent) => ({
    intent,
    weight:
      score(effective, intent.phrases) +
      (intent.favours?.includes(context.module ?? "") ? 6 : 0),
  }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (ranked.length > 0) {
    return ranked[0].intent.run(effective, state, confirming);
  }

  // Navigation is checked after the intents so "take me to the regime screen"
  // is read as a regime question first, which is nearly always what was meant.
  const destination = matchModule(effective);
  if (destination) {
    return answer(`Opening ${MODULES[destination].label.toLowerCase()}.`, [
      { name: "navigate_to", args: { module: destination } },
    ]);
  }

  const term = matchGlossary(effective);
  if (term) {
    const entry = findGlossaryEntry(term)!;
    return answer(`${entry.short} ${firstSentences(entry.long, 2)}`, [
      { name: "explain_term", args: { term } },
    ]);
  }

  return answer(
    `${isQuestion(effective) ? "I could not work that one out on my own." : "I did not follow that."} ${capabilities(state)}`,
  );
}

/* ================================================================
   Handlers
   ================================================================ */

function setDeduction(message: string, state: AppState): LocalReply {
  const section = matchSection(message);
  if (!section) return askDeductions(state);

  const amount = extractAmount(message);
  const negated = isNegated(message);

  // A question about a section is a question, not an instruction to set it.
  if (amount === null && !negated) {
    if (isQuestion(message)) {
      const entry = findGlossaryEntry(section.argument.replace(/_.*/, ""));
      return answer(
        entry
          ? `${entry.short} ${firstSentences(entry.long, 2)}`
          : `Tell me the amount and I will record it under ${section.argument}.`,
      );
    }
    return answer(
      `How much under ${section.argument}? Give me the figure and I will record it — the statutory ceiling is applied for you.`,
    );
  }

  const value = negated && amount === null ? 0 : (amount ?? 0);
  return answer(
    value === 0
      ? `Recording nothing under ${section.argument}, which is how a "no" gets saved.`
      : `Recording ${inr(value)} under ${section.argument}. Ceilings are applied for you, so the figure that lands may be lower.`,
    [
      {
        name: "add_deduction",
        args: { section: section.argument, amount: value },
      },
    ],
  );
}

function setIncome(message: string, state: AppState): LocalReply {
  const field = matchIncomeField(message);
  if (!field) return answer(whereYouStand(state));

  const amount = extractAmount(message);
  if (amount === null) {
    if (isQuestion(message)) return answer(whereYouStand(state));
    return answer(`What figure should I put against ${incomeLabel(field)}?`);
  }

  // "I pay 30,000 a month in rent" is an annual figure once multiplied.
  const monthly = /\b(a|per|every|each)\s*month|monthly|pm\b/.test(
    normalise(message),
  );
  const value = monthly ? amount * 12 : amount;

  return answer(
    `Setting ${incomeLabel(field)} to ${inr(value)}${
      monthly ? ` — twelve months at ${inr(amount)}` : ""
    }. Every figure downstream recomputes from it.`,
    [{ name: "set_income", args: { field, amount: value } }],
  );
}

function answerWhatIf(
  message: string,
  state: AppState,
  confirming = false,
): LocalReply {
  const amount = extractAmount(message);
  const section = matchSection(message);
  const field = matchIncomeField(message);
  const { current, comparison } = read(state);

  if (section && amount !== null) {
    const existing = state.deductions[section.field] as number;
    const result = whatIf(state, (input) => ({
      ...input,
      deductions: {
        ...input.deductions,
        [section.field]: existing + amount,
      } as DeductionInput,
    }));

    // add_deduction sets a section to a figure rather than adding to it, so a
    // confirmed "another ₹50,000" has to be sent as the new total.
    if (confirming) {
      return answer(
        `Recording it — ${inr(existing + amount)} under ${section.argument}, which takes your tax to ${inr(result.after)}.`,
        [
          {
            name: "add_deduction",
            args: { section: section.argument, amount: existing + amount },
          },
        ],
      );
    }

    return answer(
      `${describeSaving(
        `Another ${inr(amount)} under ${section.argument}`,
        result,
        state.regime,
      )} Nothing has been changed — say the word and I will record it.`,
    );
  }

  if (field && amount !== null) {
    const result = whatIf(state, (input) => withIncome(input, field, amount));

    if (confirming) {
      return answer(
        `Recording it — ${incomeLabel(field)} set to ${inr(amount)}, which takes your tax to ${inr(result.after)}.`,
        [{ name: "set_income", args: { field, amount } }],
      );
    }

    return answer(
      `${describeSaving(
        `Putting ${incomeLabel(field)} at ${inr(amount)}`,
        result,
        state.regime,
      )} Nothing has been changed yet.`,
    );
  }

  // No figure named — answer the question people actually mean by it.
  const other = state.regime === "new" ? comparison.old : comparison.new;
  return answer(
    `On the ${state.regime} regime your tax is ${inr(
      current.totalTaxLiability,
    )}; on the ${state.regime === "new" ? "old" : "new"} it would be ${inr(
      other.totalTaxLiability,
    )}. Name an amount and a section — "what if I put 50,000 into 80C" — and I will run your return both ways and tell you the exact difference.`,
  );
}

function withIncome(
  input: TaxpayerInput,
  field: string,
  amount: number,
): TaxpayerInput {
  switch (field) {
    case "rentPaidAnnual":
      return { ...input, hra: { ...input.hra, rentPaidAnnual: amount, claiming: true } };
    case "savingsInterest":
    case "fdInterest":
    case "dividend":
      return {
        ...input,
        otherSources: { ...input.otherSources, [field]: amount },
      };
    case "houseLoanInterest":
      return {
        ...input,
        houseProperty: { ...input.houseProperty, homeLoanInterest: amount, enabled: true },
      };
    default:
      return { ...input, salary: { ...input.salary, [field]: amount } };
  }
}

function handleRegime(message: string, state: AppState): LocalReply {
  const { comparison, current } = read(state);
  const other = state.regime === "new" ? comparison.old : comparison.new;

  if (!oldRegimeAvailable() && comparison.recommended === "old") {
    return answer(
      `The old regime would have been ${inr(comparison.saving)} cheaper, but ${shortDate(
        FILING_DEADLINE,
      )} has passed and under section 115BAC(6) it can only be chosen on a return filed by the due date. This return goes on the new regime.`,
    );
  }

  const asking = isQuestion(message) && !/switch|put me|move me|change/.test(normalise(message));

  if (comparison.recommended !== state.regime && comparison.saving > 0) {
    return asking
      ? answer(
          `The ${comparison.recommended} regime is cheaper for you by ${inr(
            comparison.saving,
          )} — ${inr(comparison.recommended === "old" ? comparison.old.totalTaxLiability : comparison.new.totalTaxLiability)} against ${inr(
            current.totalTaxLiability,
          )}. Say the word and I will switch you.`,
        )
      : answer(
          `Switching you to the ${comparison.recommended} regime — it is ${inr(
            comparison.saving,
          )} cheaper on your figures.`,
          [{ name: "switch_regime", args: { regime: comparison.recommended } }],
        );
  }

  return answer(
    `You are on the cheaper one already. The ${state.regime} regime costs ${inr(
      current.totalTaxLiability,
    )}; the other would cost ${inr(other.totalTaxLiability)}${
      state.regime === "new"
        ? " — the old regime only wins once your deductions are large enough."
        : "."
    }`,
    state.regimeChosenExplicitly ? [] : [{ name: "confirm_regime", args: {} }],
  );
}

function explainLateness(state: AppState): LocalReply {
  const { current } = read(state);
  const late = computeTax({
    ...toTaxpayerInput(state),
    filedOn: BELATED_DEADLINE,
  });
  const extra = late.interest.total - current.interest.total;

  return answer(
    `The due date is ${shortDate(FILING_DEADLINE)}. Filing after it costs three things: a flat fee under section 234F, 1% a month under 234A on anything unpaid, and the loss of the old regime entirely — a belated return under 139(4) is locked to the new one. On your figures, filing as late as ${shortDate(
      BELATED_DEADLINE,
    )} would add ${inr(Math.max(0, extra))} in interest and fee${
      current.interest.accruesPerMonth > 0
        ? `, and every month you wait right now adds ${inr(current.interest.accruesPerMonth)}`
        : ""
    }.`,
  );
}

function explainReconciliation(state: AppState): LocalReply {
  const { pending, documents, current } = read(state);

  if (!documents) {
    return answer(
      "No AIS, TIS or 26AS entries are held against this PAN, so there is nothing to check your return against.",
    );
  }
  if (pending.length === 0) {
    return answer(
      `Every entry is accounted for, and ${inr(current.tdsCredit)} of tax credit is being claimed against them.`,
    );
  }
  return answer(
    `${pending.length} ${pending.length === 1 ? "entry is" : "entries are"} still open: ${pending
      .map((e) => `${e.description.toLowerCase()} (${inr(e.aisAmount)} from ${e.source})`)
      .join("; ")}. Settling them moves both the income and the tax credit that came with it — leaving them open is the most reliable way to get an intimation three months from now.`,
    [{ name: "navigate_to", args: { module: "reconciliation" } }],
  );
}

function showWorking(state: AppState): LocalReply {
  const { current } = read(state);
  const slabs = current.slabBreakdown
    .filter((s) => s.tax > 0)
    .map((s) => `${pct(s.rate, 0)} on ${inr(s.to === null ? current.totalIncome - s.from : Math.min(s.to, current.totalIncome) - s.from)}`)
    .join(", ");

  const lines = [
    `Gross total income ${inr(current.grossTotalIncome)}, less ${inr(current.chapterVIA)} of deductions, gives a total income of ${inr(current.totalIncome)}.`,
    slabs ? `The slabs take ${slabs} — ${inr(Math.round(current.taxBeforeRebate))} before anything else.` : "No slab tax arises at that income.",
    current.rebate87A > 0 ? `Section 87A rebates ${inr(Math.round(current.rebate87A))} of it.` : "",
    current.marginalRelief > 0 ? `Marginal relief takes off a further ${inr(Math.round(current.marginalRelief))}, so crossing the rebate ceiling never costs more than the income that crossed it.` : "",
    current.surcharge > 0 ? `Surcharge adds ${inr(Math.round(current.surcharge))}.` : "",
    `Cess at 4% adds ${inr(Math.round(current.cess))}, for ${inr(current.totalTaxLiability)}.`,
    current.interest.total > 0 ? `Interest and fee add ${inr(current.interest.total)}.` : "",
    `Against ${inr(current.tdsCredit)} already deducted, that leaves ${current.refundDue > 0 ? `${inr(current.refundDue)} coming back` : `${inr(current.taxPayable)} to pay`}.`,
  ].filter(Boolean);

  return answer(lines.join("\n"), [{ name: "navigate_to", args: { module: "regime" } }]);
}

/* ================================================================
   The journey
   ================================================================ */

function driveJourney(state: AppState): LocalReply {
  return { ...journeyStep(state), continues: true };
}

function journeyStep(state: AppState): LocalReply {
  const step = nextStep(state);
  const { pending, documents } = read(state);

  switch (step.id) {
    case "income":
      return documents
        ? answer("Starting with your Form 16.", [
            { name: "import_form16", args: {} },
          ])
        : answer(
            "Nothing is filed against this PAN, so I need your figures before anything can be computed. What is your basic salary for the year?",
            [{ name: "navigate_to", args: { module: "salary" } }],
          );
    case "reconcile":
      return pending.length > 0
        ? settleMismatches(state)
        : answer("Nothing left to reconcile.");
    case "deductions":
      return askDeductions(state);
    case "regime":
      return handleRegime("switch me to the cheaper regime", state);
    case "review":
      return answer("Assembling the return for you to check.", [
        { name: "prepare_submission", args: {} },
      ]);
    default:
      return answer(
        "Everything I can do is done. Filing, verifying and paying are the one thing that stays with you — the card on screen is yours to tap.",
      );
  }
}

function settleMismatches(state: AppState): LocalReply {
  const pending = pendingMismatches(state);
  if (pending.length === 0) {
    return answer("There is nothing left open to settle.");
  }
  return answer(
    `Settling ${pending.length} ${pending.length === 1 ? "difference" : "differences"}. Anything reported against another PAN is flagged as theirs rather than accepted into your return.`,
    pending.map((entry) => ({
      name: "resolve_mismatch",
      args: {
        item_id: entry.id,
        resolution: entry.id.includes("kaveri") ? "belongs_to_other_pan" : "accept",
      },
    })),
  );
}

/**
 * Deductions are the one step this will not guess at.
 *
 * With documents on record there is a figure against the PAN for each question
 * and answering is arithmetic. Without them the answer is the taxpayer's to
 * give, and inventing one would put a number in a return nobody chose.
 */
function askDeductions(state: AppState): LocalReply {
  const { questions, documents } = read(state);
  const open = questions.filter((q) => !state.discoveryAnswered.includes(q.id));

  if (open.length === 0) {
    const { current } = read(state);
    return answer(
      `Every deduction question is answered. ${inr(current.chapterVIA)} of Chapter VI-A is in the return.`,
    );
  }

  if (!documents) {
    return answer(
      `${open.length} ${open.length === 1 ? "question" : "questions"} left, and they need your answers rather than mine. ${open[0].question} Tell me the amount, or say no and I will record the nil.`,
      [{ name: "navigate_to", args: { module: "deductions" } }],
    );
  }

  return answer(
    `Answering ${open.length} deduction ${open.length === 1 ? "question" : "questions"} from the figures on record against your PAN. Statutory ceilings are applied for you.`,
    open.map((q) => ({
      name: "add_deduction",
      args: {
        section: SECTION_ARGUMENTS[q.section] ?? q.sectionLabel,
        amount: q.suggested,
      },
    })),
  );
}

/* ================================================================
   Composers
   ================================================================ */

function whereYouStand(state: AppState): string {
  const { current } = read(state);
  if (current.refundDue > 0) {
    return `Tax of ${inr(current.totalTaxLiability)} against ${inr(
      current.tdsCredit,
    )} already deducted, so ${inr(current.refundDue)} comes back to you.`;
  }
  if (current.taxPayable > 0) {
    return `Tax of ${inr(current.totalTaxLiability)} against ${inr(
      current.tdsCredit,
    )} already deducted leaves ${inr(current.taxPayable)} to pay${
      current.interest.total > 0
        ? `, of which ${inr(current.interest.total)} is interest and fee rather than tax`
        : ""
    }.`;
  }
  return "Tax due and tax already paid are square — nothing to pay and nothing to come back.";
}

function whatIsLeft(state: AppState): string {
  const remaining = FLOW_STEPS.filter((s) => !stepDone(s.id, state));
  if (remaining.length === 0) return "Every step is done.";
  return `${remaining.length} ${remaining.length === 1 ? "step" : "steps"} left, starting with ${remaining[0].label.toLowerCase()}.`;
}

function capabilities(state: AppState): string {
  const next = nextStep(state);
  return `I can settle your AIS differences, record a deduction or an income figure from a sentence like "I put 1.5 lakh into 80C", compare the regimes on your real numbers, tell you what a change would save before you make it, and explain any term on screen. ${next ? `Next up is ${next.label.toLowerCase()}.` : ""}`;
}

const firstSentences = (text: string, count: number) =>
  `${text.split(". ").slice(0, count).join(". ").replace(/\.$/, "")}.`;

function matchModule(message: string): keyof typeof MODULES | null {
  const clean = normalise(message);
  let best: { key: keyof typeof MODULES; length: number } | null = null;
  for (const key of Object.keys(MODULES) as (keyof typeof MODULES)[]) {
    for (const needle of [key.replace("-", " "), MODULES[key].label.toLowerCase()]) {
      if (needle.length < 4 || !clean.includes(needle)) continue;
      if (!best || needle.length > best.length) best = { key, length: needle.length };
    }
  }
  return best?.key ?? null;
}

function matchGlossary(message: string): string | null {
  const clean = normalise(message);
  let best: { term: string; length: number } | null = null;
  for (const entry of glossary) {
    for (const name of [entry.term, ...(entry.aliases ?? [])]) {
      const needle = normalise(name);
      if (needle.length < 3 || !clean.includes(needle)) continue;
      if (!best || needle.length > best.length) {
        best = { term: entry.term, length: needle.length };
      }
    }
  }
  return best?.term ?? null;
}
