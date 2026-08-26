/**
 * The copilot's tool surface.
 *
 * These declarations are sent to the language model as function declarations.
 * Everything here mutates (or reads) the same Zustand store the screens use —
 * there are no separate "assistant" copies of the data and no canned responses
 * keyed to phrases. If the model calls a tool, the app state genuinely changes
 * and the user sees it happen on the screen behind the panel.
 *
 * Risk tiers (§5.2):
 *   Tier 1 — silent and logged:      navigate_to, explain_term,
 *                                    check_refund_status
 *   Tier 2 — done, shown, undoable:  switch_regime, add_deduction,
 *                                    resolve_mismatch, raise_grievance,
 *                                    prepare_submission
 *   Tier 3 — needs an on-screen tap: submit_return, initiate_evc,
 *                                    initiate_payment
 *
 * The Tier 3 tools are declared so the model can reach for them, but they
 * refuse unless the user has tapped the confirmation card that
 * prepare_submission (or the equivalent screen button) raised. A typed "yes"
 * in the chat is never enough.
 */

export const MODULES = {
  dashboard: { href: "/dashboard", label: "Home dashboard" },
  profile: { href: "/profile", label: "Profile and pre-filing setup" },
  income: { href: "/income", label: "Income sources overview" },
  salary: { href: "/income/salary", label: "Salary and Form 16" },
  "house-property": { href: "/income/house-property", label: "House property" },
  "other-sources": { href: "/income/other-sources", label: "Other sources" },
  "capital-gains": { href: "/income/capital-gains", label: "Capital gains" },
  business: { href: "/income/business", label: "Business and profession" },
  reconciliation: { href: "/reconciliation", label: "AIS, TIS and 26AS" },
  deductions: { href: "/deductions", label: "Deductions workspace" },
  regime: { href: "/regime", label: "Regime comparison" },
  filing: { href: "/filing", label: "File your return" },
  payment: { href: "/filing/payment", label: "Pay self-assessment tax" },
  everify: { href: "/filing/everify", label: "e-Verify" },
  confirmation: { href: "/filing/confirmation", label: "Submission confirmation" },
  history: { href: "/history", label: "Filing history" },
  refund: { href: "/refund", label: "Refund tracker" },
  notices: { href: "/notices", label: "Notices and e-Proceedings" },
  grievance: { href: "/grievance", label: "Grievance redressal" },
  help: { href: "/help", label: "Help and glossary" },
} as const;

export type ModuleKey = keyof typeof MODULES;

export const DEDUCTION_SECTIONS = [
  "80C",
  "80CCD(1B)",
  "80D_self",
  "80D_parents",
  "80DDB",
  "80E",
  "80G",
  "80TTA",
  "80EEB",
  "80U",
] as const;

export type DeductionSectionKey = (typeof DEDUCTION_SECTIONS)[number];

export const MISMATCH_RESOLUTIONS = [
  "accept",
  "correct_amount",
  "belongs_to_other_pan",
  "duplicate",
  "disagree",
] as const;

export const GRIEVANCE_TOPICS = [
  "refund-delay",
  "ais-mismatch",
  "everify-failed",
  "demand-disagree",
  "profile-login",
  "other",
] as const;

/** Parameter schemas use the OpenAPI subset the model expects. */
export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "navigate_to",
    description:
      "Move the user to a different module of the platform. Use this whenever the answer lives on another screen, or when the user asks to be taken somewhere. The navigation happens immediately.",
    parameters: {
      type: "OBJECT",
      properties: {
        module: {
          type: "STRING",
          enum: Object.keys(MODULES),
          description: "Which module to open.",
        },
        reason: {
          type: "STRING",
          description:
            "One short clause explaining why, shown to the user in the confirmation toast.",
        },
      },
      required: ["module"],
    },
  },
  {
    name: "switch_regime",
    description:
      "Switch the taxpayer between the old and the new tax regime. Every computed figure across the platform recalculates. Only do this when the user asks for it or clearly agrees to it — do not switch just to illustrate a point, because it changes their actual return.",
    parameters: {
      type: "OBJECT",
      properties: {
        regime: {
          type: "STRING",
          enum: ["old", "new"],
          description: "The regime to switch to.",
        },
      },
      required: ["regime"],
    },
  },
  {
    name: "add_deduction",
    description:
      "Record a Chapter VI-A deduction amount for the taxpayer. This sets the section to the given amount (it does not add to what is already there). Statutory ceilings are applied by the app, so you may pass the full amount the user mentions.",
    parameters: {
      type: "OBJECT",
      properties: {
        section: {
          type: "STRING",
          enum: [...DEDUCTION_SECTIONS],
          description:
            "Which section. Use 80D_self for the taxpayer's own health cover and 80D_parents for their parents'.",
        },
        amount: {
          type: "NUMBER",
          description: "The amount in rupees.",
        },
      },
      required: ["section", "amount"],
    },
  },
  {
    name: "resolve_mismatch",
    description:
      "Settle one flagged difference between the AIS and what the taxpayer has declared. Accepting a figure genuinely adds that income to the return and claims the related TDS credit.",
    parameters: {
      type: "OBJECT",
      properties: {
        item_id: {
          type: "STRING",
          description:
            "The id of the AIS entry, for example ais-fd-interest or ais-dividend. The current mismatches are listed in the screen context you were given.",
        },
        resolution: {
          type: "STRING",
          enum: [...MISMATCH_RESOLUTIONS],
          description:
            "accept means the AIS figure is right and should go into the return. correct_amount means use a different figure. belongs_to_other_pan and duplicate send feedback to the reporting entity and keep the amount out of the return. disagree rejects the entry outright.",
        },
        amount: {
          type: "NUMBER",
          description: "Required only when resolution is correct_amount.",
        },
      },
      required: ["item_id", "resolution"],
    },
  },
  {
    name: "explain_term",
    description:
      "Pull up the platform's own plain-language explanation of a piece of tax jargon and open it on the Help page. Use it when the user asks what something means, so they get the canonical wording rather than your paraphrase.",
    parameters: {
      type: "OBJECT",
      properties: {
        term: {
          type: "STRING",
          description:
            "The term to explain, for example AIS, 87A, 80CCD(2), Form 10-IEA, marginal relief.",
        },
      },
      required: ["term"],
    },
  },
  {
    name: "raise_grievance",
    description:
      "Open a grievance on the taxpayer's behalf. This creates a real tracked ticket in the app. Confirm with the user before raising one unless they have plainly asked for it.",
    parameters: {
      type: "OBJECT",
      properties: {
        topic: {
          type: "STRING",
          enum: [...GRIEVANCE_TOPICS],
          description: "The grievance category.",
        },
        description: {
          type: "STRING",
          description:
            "What went wrong, in the taxpayer's own terms. Be specific — vague grievances take longer.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "check_refund_status",
    description:
      "Read the current stage of the refund pipeline and what it means. Use this rather than guessing from the screen context when the user asks about their refund.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "prepare_submission",
    description:
      "Assemble the whole return and put the final review card on the screen for the user to read and tap. Call this when the user says something like 'just file it for me'. It does NOT file anything — it is the step before that, and it is the only way to reach submit_return.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "submit_return",
    description:
      "File the return with the department. IRREVERSIBLE. This only works after the user has tapped Confirm on the card raised by prepare_submission; it will refuse otherwise, and no amount of the user saying 'yes' or 'go ahead' in the chat substitutes for that tap. Do not call it speculatively — call prepare_submission and let the user act.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "initiate_evc",
    description:
      "Start e-verification of a submitted return. IRREVERSIBLE, and gated the same way as submit_return: it raises the on-screen confirmation card, and only completes once the user has tapped it.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "initiate_payment",
    description:
      "Start payment of self-assessment tax still due. IRREVERSIBLE, and gated the same way as submit_return: it raises the on-screen confirmation card, and only completes once the user has tapped it.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
];

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type ToolOutcome = {
  name: string;
  ok: boolean;
  summary: string;
  /** returned to the model so it can speak accurately about what happened */
  result: Record<string, unknown>;
  /** the action-log entry this created, when it created one */
  logId?: string;
};

/** Every tool, with the tier it belongs to. Used by the transcript and docs. */
export const TOOL_TIERS: Record<string, 1 | 2 | 3> = {
  navigate_to: 1,
  explain_term: 1,
  check_refund_status: 1,
  switch_regime: 2,
  add_deduction: 2,
  resolve_mismatch: 2,
  raise_grievance: 2,
  prepare_submission: 2,
  submit_return: 3,
  initiate_evc: 3,
  initiate_payment: 3,
};
