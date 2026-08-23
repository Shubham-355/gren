"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  aisEntries,
  annualRentPaid,
  bankAccounts,
  deductionEvidence,
  form16,
  grievanceTopics,
  housePropertySeed,
  notices as seededNotices,
  rentDetails,
  taxpayer,
  type AisEntry,
  type BankAccount,
  type GrievanceTopicId,
  type Notice,
} from "@/lib/data/seed";
import type {
  DeductionInput,
  HousePropertyInput,
  HraInput,
  OtherSourcesInput,
  Regime,
  SalaryInput,
  TaxpayerInput,
} from "@/lib/tax/compute";

/** ------------------------------------------------------------------
 *  Shapes
 *  ------------------------------------------------------------------ */

export type MismatchResolution =
  | "pending"
  | "accepted"
  | "amount-corrected"
  | "other-pan"
  | "duplicate"
  | "denied";

export type ReconciliationItem = {
  id: string;
  resolution: MismatchResolution;
  /** the value the taxpayer settled on, once resolved */
  resolvedAmount: number | null;
  resolvedAt: string | null;
};

export type Grievance = {
  id: string;
  topic: GrievanceTopicId;
  topicLabel: string;
  description: string;
  raisedOn: string;
  routesTo: string;
  expectedByDays: number;
  status: "Submitted" | "Under review" | "Resolved";
  updates: { at: string; text: string }[];
};

export type NoticeState = {
  id: string;
  status: Notice["status"];
  response: string | null;
  respondedOn: string | null;
};

export type FilingState = {
  formSelected: "ITR-1" | "ITR-2" | null;
  reviewConfirmed: boolean;
  paymentDone: boolean;
  paymentChallan: string | null;
  submitted: boolean;
  submittedAt: string | null;
  acknowledgementNumber: string | null;
  everified: boolean;
  everifiedAt: string | null;
};

export type RefundStage = "not-filed" | "filed" | "verified" | "processed" | "issued";

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  /** actions the model actually performed on this turn */
  actions?: { tool: string; summary: string; ok: boolean }[];
  error?: boolean;
};

export type ActionLogEntry = {
  id: string;
  at: string;
  actor: "you" | "copilot";
  tool: string;
  summary: string;
};

export type Toast = {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "success" | "warn" | "alert" | "copilot";
};

export type ProfileState = {
  name: string;
  pan: string;
  aadhaarMasked: string;
  dob: string;
  age: number;
  email: string;
  mobile: string;
  address: typeof taxpayer.address;
  residentialStatus: string;
  panAadhaarLinked: boolean;
  bankAccounts: BankAccount[];
};

type ToolResult = { ok: boolean; summary: string; detail?: string };

export type AppState = {
  hydrated: boolean;

  // --- session ---
  loggedIn: boolean;
  loginMethod: "pan" | "aadhaar" | null;

  // --- profile ---
  profile: ProfileState;

  // --- income ---
  salary: SalaryInput;
  form16Imported: boolean;
  houseProperty: HousePropertyInput & { address: string; tenantName: string };
  otherSources: OtherSourcesInput;
  hra: HraInput;

  // --- deductions ---
  regime: Regime;
  regimeChosenExplicitly: boolean;
  deductions: DeductionInput;
  /** ids of the guided-discovery questions already answered */
  discoveryAnswered: string[];

  // --- reconciliation ---
  reconciliation: Record<string, ReconciliationItem>;

  // --- filing ---
  filing: FilingState;
  advanceTaxPaid: number;
  selfAssessmentTaxPaid: number;

  // --- post filing ---
  notices: Record<string, NoticeState>;
  grievances: Grievance[];

  // --- copilot / feedback surfaces ---
  copilotOpen: boolean;
  copilotMessages: CopilotMessage[];
  actionLog: ActionLogEntry[];
  toasts: Toast[];
  /** set by the copilot navigate_to tool; the shell consumes and clears it */
  pendingNavigation: string | null;
  /** module the copilot most recently touched, for a highlight pulse */
  lastTouchedModule: string | null;

  // ================= actions =================
  login: (method: "pan" | "aadhaar") => void;
  logout: () => void;
  resetDemo: () => void;

  updateProfile: (patch: Partial<ProfileState>) => void;
  setRefundAccount: (bankId: string) => void;

  importForm16: () => void;
  setSalaryField: (field: keyof SalaryInput, value: number) => void;
  setHouseProperty: (patch: Partial<AppState["houseProperty"]>) => void;
  setOtherSource: (field: keyof OtherSourcesInput, value: number) => void;
  setHra: (patch: Partial<HraInput>) => void;

  setRegime: (regime: Regime, actor?: ActionLogEntry["actor"]) => void;
  setDeduction: (
    section: keyof DeductionInput,
    value: number | boolean,
    actor?: ActionLogEntry["actor"],
  ) => void;
  markDiscoveryAnswered: (id: string) => void;

  resolveMismatch: (
    itemId: string,
    resolution: MismatchResolution,
    actor?: ActionLogEntry["actor"],
    correctedAmount?: number,
  ) => ToolResult;

  selectForm: (form: "ITR-1" | "ITR-2") => void;
  confirmReview: () => void;
  payTax: (amount: number) => void;
  submitReturn: (ack: string) => void;
  everify: () => void;

  respondToNotice: (noticeId: string, response: string) => void;
  raiseGrievance: (
    topic: GrievanceTopicId,
    description: string,
    actor?: ActionLogEntry["actor"],
  ) => ToolResult;

  setCopilotOpen: (open: boolean) => void;
  pushCopilotMessage: (message: CopilotMessage) => void;
  clearCopilot: () => void;
  logAction: (entry: Omit<ActionLogEntry, "id" | "at">) => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  requestNavigation: (href: string | null) => void;
  touchModule: (module: string | null) => void;
};

/** ------------------------------------------------------------------
 *  Initial state, built from the synthetic seed
 *  ------------------------------------------------------------------ */

const nowIso = () => new Date().toISOString();
const rid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Which "other sources" field each AIS entry writes through to when the
 * taxpayer settles it. Every entry gets its own field so two decisions can
 * never overwrite each other.
 */
const OTHER_SOURCE_FIELD: Record<string, keyof OtherSourcesInput | undefined> = {
  "ais-savings-interest": "savingsInterest",
  "ais-fd-interest": "fdInterest",
  "ais-dividend": "dividend",
  "ais-kaveri-interest": "other",
};

/**
 * The user starts having declared nothing beyond salary and the interest they
 * remembered. The gaps against AIS are what the reconciliation module exists
 * to surface.
 */
const initialOtherSources: OtherSourcesInput = {
  savingsInterest: 14_850,
  fdInterest: 0,
  dividend: 6_000,
  other: 0,
};

const emptySalary: SalaryInput = {
  basic: 0,
  hra: 0,
  specialAllowance: 0,
  lta: 0,
  otherAllowances: 0,
  employerNps: 0,
  professionalTax: 0,
  tdsDeducted: 0,
};

const seedSalary: SalaryInput = {
  basic: form16.salary.basic,
  hra: form16.salary.hra,
  specialAllowance: form16.salary.specialAllowance,
  lta: form16.salary.lta,
  otherAllowances: form16.salary.otherAllowances,
  employerNps: form16.salary.employerNps,
  professionalTax: form16.professionalTax,
  tdsDeducted: form16.tdsDeducted,
};

const initialDeductions: DeductionInput = {
  s80C: 0,
  s80CCD1B: 0,
  s80D_self: 0,
  s80D_parents: 0,
  s80D_parents_senior: deductionEvidence.parentsAreSeniorCitizens,
  s80DDB: 0,
  s80E: 0,
  s80G: 0,
  s80TTA: 0,
  s80EEB: 0,
  s80U: 0,
};

const initialReconciliation: Record<string, ReconciliationItem> =
  Object.fromEntries(
    aisEntries.map((e) => [
      e.id,
      {
        id: e.id,
        resolution: (e.severity === "match"
          ? "accepted"
          : "pending") as MismatchResolution,
        resolvedAmount: e.severity === "match" ? e.aisAmount : null,
        resolvedAt: e.severity === "match" ? nowIso() : null,
      },
    ]),
  );

const initialNotices: Record<string, NoticeState> = Object.fromEntries(
  seededNotices.map((n) => [
    n.id,
    { id: n.id, status: n.status, response: null, respondedOn: null },
  ]),
);

const initialState = {
  hydrated: false,
  loggedIn: false,
  loginMethod: null,

  profile: {
    name: taxpayer.name,
    pan: taxpayer.pan,
    aadhaarMasked: taxpayer.aadhaarMasked,
    dob: taxpayer.dob,
    age: taxpayer.age,
    email: taxpayer.email,
    mobile: taxpayer.mobile,
    address: taxpayer.address,
    residentialStatus: taxpayer.residentialStatus,
    panAadhaarLinked: taxpayer.panAadhaarLinked,
    bankAccounts,
  } as ProfileState,

  salary: emptySalary,
  form16Imported: false,
  houseProperty: {
    // The persona owns a let-out flat, so it starts declared. Turning it off
    // on the house property screen is a real, supported choice.
    enabled: housePropertySeed.enabled,
    type: housePropertySeed.type,
    annualRentReceived: housePropertySeed.annualRentReceived,
    municipalTaxesPaid: housePropertySeed.municipalTaxesPaid,
    homeLoanInterest: housePropertySeed.homeLoanInterest,
    address: housePropertySeed.address,
    tenantName: housePropertySeed.tenantName,
  },
  otherSources: initialOtherSources,
  hra: {
    claiming: true,
    rentPaidAnnual: annualRentPaid,
    metroCity: rentDetails.metroCity,
  } as HraInput,

  regime: "new" as Regime,
  regimeChosenExplicitly: false,
  deductions: initialDeductions,
  discoveryAnswered: [] as string[],

  reconciliation: initialReconciliation,

  filing: {
    formSelected: null,
    reviewConfirmed: false,
    paymentDone: false,
    paymentChallan: null,
    submitted: false,
    submittedAt: null,
    acknowledgementNumber: null,
    everified: false,
    everifiedAt: null,
  } as FilingState,
  advanceTaxPaid: 0,
  selfAssessmentTaxPaid: 0,

  notices: initialNotices,
  grievances: [] as Grievance[],

  copilotOpen: false,
  copilotMessages: [] as CopilotMessage[],
  actionLog: [] as ActionLogEntry[],
  toasts: [] as Toast[],
  pendingNavigation: null as string | null,
  lastTouchedModule: null as string | null,
};

/** ------------------------------------------------------------------
 *  Store
 *  ------------------------------------------------------------------ */

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ---------------- session ----------------
      login: (method) => {
        set({ loggedIn: true, loginMethod: method });
        get().logAction({
          actor: "you",
          tool: "login",
          summary: `Signed in with ${method === "pan" ? "PAN" : "Aadhaar"}`,
        });
      },

      logout: () => set({ loggedIn: false, loginMethod: null, copilotOpen: false }),

      resetDemo: () =>
        set({
          ...initialState,
          hydrated: true,
          loggedIn: get().loggedIn,
          loginMethod: get().loginMethod,
        }),

      // ---------------- profile ----------------
      updateProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),

      setRefundAccount: (bankId) => {
        set((s) => ({
          profile: {
            ...s.profile,
            bankAccounts: s.profile.bankAccounts.map((b) => ({
              ...b,
              nominatedForRefund: b.id === bankId,
            })),
          },
        }));
        const bank = get().profile.bankAccounts.find((b) => b.id === bankId);
        get().pushToast({
          tone: "success",
          title: "Refund account updated",
          body: bank ? `${bank.bank} ${bank.accountNumberMasked}` : undefined,
        });
      },

      // ---------------- income ----------------
      importForm16: () => {
        set({ salary: seedSalary, form16Imported: true });
        get().logAction({
          actor: "you",
          tool: "import_form16",
          summary: `Imported Form 16 from ${form16.employer.name}`,
        });
        get().pushToast({
          tone: "success",
          title: "Form 16 imported",
          body: "Salary, allowances and TDS have been filled in for you.",
        });
      },

      setSalaryField: (field, value) =>
        set((s) => ({ salary: { ...s.salary, [field]: value } })),

      setHouseProperty: (patch) =>
        set((s) => ({ houseProperty: { ...s.houseProperty, ...patch } })),

      setOtherSource: (field, value) =>
        set((s) => ({ otherSources: { ...s.otherSources, [field]: value } })),

      setHra: (patch) => set((s) => ({ hra: { ...s.hra, ...patch } })),

      // ---------------- regime & deductions ----------------
      setRegime: (regime, actor = "you") => {
        if (get().regime === regime) return;
        set({ regime, regimeChosenExplicitly: true });
        get().logAction({
          actor,
          tool: "switch_regime",
          summary: `Switched to the ${regime} tax regime`,
        });
        get().pushToast({
          tone: actor === "copilot" ? "copilot" : "success",
          title: `Now using the ${regime} regime`,
          body: "Every figure on the platform has been recalculated.",
        });
        get().touchModule("regime");
      },

      setDeduction: (section, value, actor = "you") => {
        set((s) => ({
          deductions: { ...s.deductions, [section]: value } as DeductionInput,
        }));
        if (typeof value === "number") {
          get().logAction({
            actor,
            tool: "add_deduction",
            summary: `Set ${sectionLabel(section)} to ₹${value.toLocaleString("en-IN")}`,
          });
        }
        get().touchModule("deductions");
      },

      markDiscoveryAnswered: (id) =>
        set((s) => ({
          discoveryAnswered: s.discoveryAnswered.includes(id)
            ? s.discoveryAnswered
            : [...s.discoveryAnswered, id],
        })),

      // ---------------- reconciliation ----------------
      resolveMismatch: (itemId, resolution, actor = "you", correctedAmount) => {
        const entry = aisEntries.find((e) => e.id === itemId);
        if (!entry) {
          return {
            ok: false,
            summary: `There is no reconciliation item called "${itemId}".`,
          };
        }

        const amount =
          resolution === "accepted"
            ? entry.aisAmount
            : resolution === "amount-corrected"
              ? (correctedAmount ?? entry.aisAmount)
              : resolution === "other-pan" || resolution === "duplicate"
                ? 0
                : entry.declaredAmount;

        set((s) => ({
          reconciliation: {
            ...s.reconciliation,
            [itemId]: {
              id: itemId,
              resolution,
              resolvedAmount: amount,
              resolvedAt: nowIso(),
            },
          },
        }));

        // Reconciliation is only meaningful if a decision actually moves money
        // in or out of the return, so each resolution writes through to the
        // income heads the screens read from.
        const accepted =
          resolution === "accepted" || resolution === "amount-corrected";
        const field = OTHER_SOURCE_FIELD[itemId];
        if (field) {
          if (accepted) {
            get().setOtherSource(field, amount);
          } else if (resolution === "pending") {
            // Undo — put the head back to what the taxpayer had said.
            get().setOtherSource(field, entry.declaredAmount);
          } else {
            // Feedback sent to the reporting entity; nothing enters the return.
            get().setOtherSource(field, entry.declaredAmount);
          }
        }

        const summary = resolutionSummary(entry, resolution, amount);
        get().logAction({ actor, tool: "resolve_mismatch", summary });
        get().pushToast({
          tone:
            actor === "copilot"
              ? "copilot"
              : resolution === "pending"
                ? "info"
                : "success",
          title: resolution === "pending" ? "Reopened" : "Mismatch resolved",
          body: summary,
        });
        get().touchModule("reconciliation");
        return { ok: true, summary };
      },

      // ---------------- filing ----------------
      selectForm: (formSelected) => {
        set((s) => ({ filing: { ...s.filing, formSelected } }));
        get().logAction({
          actor: "you",
          tool: "select_form",
          summary: `Selected ${formSelected}`,
        });
      },

      confirmReview: () =>
        set((s) => ({ filing: { ...s.filing, reviewConfirmed: true } })),

      payTax: (amount) => {
        const challan = `SYN-CHLN-${Date.now().toString().slice(-8)}`;
        set((s) => ({
          filing: { ...s.filing, paymentDone: true, paymentChallan: challan },
          selfAssessmentTaxPaid: s.selfAssessmentTaxPaid + amount,
        }));
        get().logAction({
          actor: "you",
          tool: "pay_tax",
          summary: `Paid ₹${amount.toLocaleString("en-IN")} of self-assessment tax (simulated)`,
        });
        get().pushToast({
          tone: "success",
          title: "Payment recorded",
          body: `Challan ${challan} — simulated, no money moved.`,
        });
      },

      submitReturn: (ack) => {
        set((s) => ({
          filing: {
            ...s.filing,
            submitted: true,
            submittedAt: nowIso(),
            acknowledgementNumber: ack,
          },
        }));
        get().logAction({
          actor: "you",
          tool: "submit_return",
          summary: `Submitted the return — acknowledgement ${ack}`,
        });
      },

      everify: () => {
        set((s) => ({
          filing: { ...s.filing, everified: true, everifiedAt: nowIso() },
        }));
        get().logAction({
          actor: "you",
          tool: "everify",
          summary: "e-Verified the return with a simulated Aadhaar OTP",
        });
        get().pushToast({
          tone: "success",
          title: "Return verified",
          body: "Processing has started. You can track the refund from here.",
        });
      },

      // ---------------- post filing ----------------
      respondToNotice: (noticeId, response) => {
        set((s) => ({
          notices: {
            ...s.notices,
            [noticeId]: {
              id: noticeId,
              status: "Responded",
              response,
              respondedOn: nowIso(),
            },
          },
        }));
        get().logAction({
          actor: "you",
          tool: "respond_notice",
          summary: `Responded to notice ${noticeId}`,
        });
        get().pushToast({
          tone: "success",
          title: "Response submitted",
          body: "The department will confirm within 30 days.",
        });
        get().touchModule("notices");
      },

      raiseGrievance: (topic, description, actor = "you") => {
        const meta = grievanceTopics.find((t) => t.id === topic);
        if (!meta) {
          return {
            ok: false,
            summary: `"${topic}" is not one of the grievance categories.`,
          };
        }
        const grievance: Grievance = {
          id: `GRV-${Date.now().toString().slice(-7)}`,
          topic,
          topicLabel: meta.label,
          description:
            description.trim() ||
            "No further detail provided at the time of raising.",
          raisedOn: nowIso(),
          routesTo: meta.routesTo,
          expectedByDays: meta.typicalDays,
          status: "Submitted",
          updates: [
            {
              at: nowIso(),
              text: `Received and routed to ${meta.routesTo}.`,
            },
          ],
        };
        set((s) => ({ grievances: [grievance, ...s.grievances] }));
        const summary = `Raised grievance ${grievance.id} — ${meta.label}`;
        get().logAction({ actor, tool: "raise_grievance", summary });
        get().pushToast({
          tone: actor === "copilot" ? "copilot" : "success",
          title: `Grievance ${grievance.id} raised`,
          body: `Routed to ${meta.routesTo}. Expect an update in about ${meta.typicalDays} days.`,
        });
        get().touchModule("grievance");
        return { ok: true, summary, detail: grievance.id };
      },

      // ---------------- copilot surfaces ----------------
      setCopilotOpen: (copilotOpen) => set({ copilotOpen }),

      pushCopilotMessage: (message) =>
        set((s) => ({ copilotMessages: [...s.copilotMessages, message] })),

      clearCopilot: () => set({ copilotMessages: [] }),

      logAction: (entry) =>
        set((s) => ({
          actionLog: [
            { ...entry, id: rid(), at: nowIso() },
            ...s.actionLog,
          ].slice(0, 60),
        })),

      pushToast: (toast) => {
        const id = rid();
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
        if (typeof window !== "undefined") {
          window.setTimeout(() => get().dismissToast(id), 5200);
        }
      },

      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      requestNavigation: (pendingNavigation) => set({ pendingNavigation }),

      touchModule: (lastTouchedModule) => set({ lastTouchedModule }),
    }),
    {
      name: "sarathi-session-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydration is kicked off manually from a client effect so that the
      // first client render matches what the server sent.
      skipHydration: true,
      // Only durable state is persisted. Toasts, the pending-navigation
      // request and the highlight pulse are per-render concerns.
      partialize: (s) => ({
        loggedIn: s.loggedIn,
        loginMethod: s.loginMethod,
        profile: s.profile,
        salary: s.salary,
        form16Imported: s.form16Imported,
        houseProperty: s.houseProperty,
        otherSources: s.otherSources,
        hra: s.hra,
        regime: s.regime,
        regimeChosenExplicitly: s.regimeChosenExplicitly,
        deductions: s.deductions,
        discoveryAnswered: s.discoveryAnswered,
        reconciliation: s.reconciliation,
        filing: s.filing,
        advanceTaxPaid: s.advanceTaxPaid,
        selfAssessmentTaxPaid: s.selfAssessmentTaxPaid,
        notices: s.notices,
        grievances: s.grievances,
        copilotMessages: s.copilotMessages,
        actionLog: s.actionLog,
      }),
    },
  ),
);

/** ------------------------------------------------------------------
 *  Derived selectors — used by the UI and by the copilot context builder
 *  ------------------------------------------------------------------ */

export function sectionLabel(section: keyof DeductionInput): string {
  const labels: Record<keyof DeductionInput, string> = {
    s80C: "80C",
    s80CCD1B: "80CCD(1B)",
    s80D_self: "80D (self and family)",
    s80D_parents: "80D (parents)",
    s80D_parents_senior: "80D senior parents flag",
    s80DDB: "80DDB",
    s80E: "80E",
    s80G: "80G",
    s80TTA: "80TTA",
    s80EEB: "80EEB",
    s80U: "80U",
  };
  return labels[section] ?? section;
}

function resolutionSummary(
  entry: AisEntry,
  resolution: MismatchResolution,
  amount: number,
): string {
  const money = `₹${amount.toLocaleString("en-IN")}`;
  switch (resolution) {
    case "accepted":
      return `Accepted ${money} of ${entry.description.toLowerCase()} from ${entry.source} and added it to your return`;
    case "amount-corrected":
      return `Corrected ${entry.description.toLowerCase()} from ${entry.source} to ${money}`;
    case "other-pan":
      return `Flagged ${entry.description.toLowerCase()} from ${entry.source} as belonging to another PAN`;
    case "duplicate":
      return `Flagged ${entry.description.toLowerCase()} from ${entry.source} as a duplicate entry`;
    case "denied":
      return `Disagreed with ${entry.description.toLowerCase()} reported by ${entry.source}`;
    default:
      return `Left ${entry.description.toLowerCase()} unresolved`;
  }
}

export function toTaxpayerInput(s: AppState): TaxpayerInput {
  return {
    age: s.profile.age,
    regime: s.regime,
    salary: s.salary,
    houseProperty: {
      enabled: s.houseProperty.enabled,
      type: s.houseProperty.type,
      annualRentReceived: s.houseProperty.annualRentReceived,
      municipalTaxesPaid: s.houseProperty.municipalTaxesPaid,
      homeLoanInterest: s.houseProperty.homeLoanInterest,
    },
    otherSources: s.otherSources,
    hra: s.hra,
    deductions: s.deductions,
    advanceTaxPaid: s.advanceTaxPaid,
    selfAssessmentTaxPaid: s.selfAssessmentTaxPaid,
    tdsOnOtherIncome: tdsOnOtherIncome(s),
  };
}

/**
 * TDS credit on non-salary income is only claimable for income actually
 * offered to tax, so it follows the reconciliation decisions.
 */
export function tdsOnOtherIncome(s: AppState): number {
  return aisEntries.reduce((sum, entry) => {
    if (entry.category === "Salary") return sum;
    const state = s.reconciliation[entry.id];
    if (!state) return sum;
    const claimable =
      state.resolution === "accepted" || state.resolution === "amount-corrected";
    return claimable ? sum + entry.tdsDeducted : sum;
  }, 0);
}

export function pendingMismatches(s: AppState): AisEntry[] {
  return aisEntries.filter(
    (e) => s.reconciliation[e.id]?.resolution === "pending",
  );
}

export function refundStage(s: AppState): RefundStage {
  if (!s.filing.submitted) return "not-filed";
  if (!s.filing.everified) return "filed";
  // Once verified, the prototype advances the simulated CPC clock by elapsed
  // time so the tracker is not frozen on one stage during a demo.
  const verifiedAt = s.filing.everifiedAt
    ? new Date(s.filing.everifiedAt).getTime()
    : Date.now();
  const minutes = (Date.now() - verifiedAt) / 60_000;
  if (minutes > 2) return "issued";
  if (minutes > 1) return "processed";
  return "verified";
}
