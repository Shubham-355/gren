"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  aisEntries,
  bankAccounts,
  deductionEvidence,
  filingHistory,
  form16,
  grievanceTopics,
  grossSalaryFromForm16,
  housePropertySeed,
  notices as seededNotices,
  rentDetails,
  taxpayer,
  type AisEntry,
  type BankAccount,
  type FilingRecord,
  type GrievanceTopicId,
  type Notice,
} from "@/lib/data/seed";
import { computeTax } from "@/lib/tax/compute";
import { ADVANCE_TAX_INSTALMENTS } from "@/lib/tax/constants";
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
  /** still working — more actions may still land on this message */
  pending?: boolean;
  /** actions the model actually performed on this turn */
  actions?: {
    tool: string;
    summary: string;
    ok: boolean;
    /** the action-log entry this produced, so the bubble can offer Undo */
    logId?: string;
  }[];
  error?: boolean;
};

/**
 * How to put a Tier 2 action back. Every entry that carries one gets a visible
 * one-tap "Undo" in the timeline and in the copilot transcript.
 */
/**
 * Every income figure the copilot is allowed to move, under one name each.
 * Flat on purpose: the model picks a field, not a path through three nested
 * objects, and the store is the only thing that needs to know where it lives.
 */
export const INCOME_FIELDS = {
  basic: { head: "salary", label: "basic salary" },
  hra: { head: "salary", label: "house rent allowance" },
  specialAllowance: { head: "salary", label: "special allowance" },
  lta: { head: "salary", label: "leave travel allowance" },
  otherAllowances: { head: "salary", label: "other allowances" },
  employerNps: { head: "salary", label: "employer's NPS contribution" },
  professionalTax: { head: "salary", label: "professional tax" },
  tdsDeducted: { head: "salary", label: "tax deducted by the employer" },
  savingsInterest: { head: "other", label: "savings bank interest" },
  fdInterest: { head: "other", label: "fixed deposit interest" },
  dividend: { head: "other", label: "dividend income" },
  otherIncome: { head: "other", label: "other income" },
  rentPaidAnnual: { head: "hra", label: "rent paid for the year" },
  houseRentReceived: { head: "house", label: "rent received on the let-out property" },
  houseMunicipalTaxes: { head: "house", label: "municipal taxes paid" },
  houseLoanInterest: { head: "house", label: "home loan interest" },
} as const;

export type IncomeField = keyof typeof INCOME_FIELDS;

export type UndoPayload =
  | { kind: "regime"; previous: Regime; previouslyExplicit: boolean }
  | { kind: "deduction"; section: keyof DeductionInput; previous: number }
  | {
      kind: "mismatch";
      itemId: string;
      previous: MismatchResolution;
      previousAmount: number | null;
      /**
       * What the return itself held for this entry before the resolution.
       * Undo used to fall back to the seed's `declaredAmount` here, which put
       * back a number the taxpayer may never have entered.
       */
      previousDeclared: number;
    }
  | { kind: "income"; field: IncomeField; previous: number }
  | {
      kind: "form16";
      previousSalary: SalaryInput;
      previouslyImported: boolean;
    };

export type ActionLogEntry = {
  id: string;
  at: string;
  actor: "you" | "copilot" | "system";
  tool: string;
  summary: string;
  /** the effect on tax due, in rupees, signed: negative means tax fell */
  delta?: number;
  /** the arithmetic behind it, for the one-tap "Why?" */
  why?: string;
  undo?: UndoPayload;
  undone?: boolean;
};

/**
 * Tier 3 (§5.2): filing, e-verifying and paying never happen from a chat
 * message. They raise this, which renders as an unmissable card in the
 * product's own colours that the user has to tap.
 */
export type ConfirmationKind = "submit" | "everify" | "payment";

export type PendingConfirmation = {
  kind: ConfirmationKind;
  createdAt: string;
  title: string;
  body: string;
  lines: { label: string; value: string }[];
  confirmLabel: string;
  /** for the payment gate: how much is about to be paid */
  amount?: number;
  requestedBy: "you" | "copilot";
  /** set only by a direct tap on the card; consumed by the acting tool */
  acknowledged: boolean;
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
  /** "demo" for the seeded taxpayer, "fresh" for any other PAN. */
  accountKind: "demo" | "fresh";

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
  /**
   * What was paid at each of the four advance tax instalment dates, in order.
   * The total is `advanceTaxPaid`; the split is what section 234C is actually
   * charged on, and without it the app has to assume the worst.
   */
  advanceTaxInstalments: number[];
  selfAssessmentTaxPaid: number;

  // --- post filing ---
  notices: Record<string, NoticeState>;
  grievances: Grievance[];

  // --- copilot / feedback surfaces ---
  copilotOpen: boolean;
  copilotMessages: CopilotMessage[];
  actionLog: ActionLogEntry[];
  /** the Tier 3 gate, when one is open */
  pendingConfirmation: PendingConfirmation | null;
  /** the activity timeline sheet, on a phone */
  timelineOpen: boolean;
  /** an action log id whose "why" panel is open */
  openWhy: string | null;
  toasts: Toast[];
  /** set by the copilot navigate_to tool; the shell consumes and clears it */
  pendingNavigation: string | null;
  /** module the copilot most recently touched, for a highlight pulse */
  lastTouchedModule: string | null;

  // ================= actions =================
  login: (method: "pan" | "aadhaar", identifier?: string) => void;
  logout: () => void;
  resetDemo: () => void;

  updateProfile: (patch: Partial<ProfileState>) => void;
  setRefundAccount: (bankId: string) => void;

  importForm16: (actor?: ActionLogEntry["actor"]) => void;
  setIncomeField: (
    field: IncomeField,
    value: number,
    actor?: ActionLogEntry["actor"],
  ) => void;
  setSalaryField: (field: keyof SalaryInput, value: number) => void;
  /** used by undo, so reversing a change is not itself logged as a change */
  setIncomeFieldSilently: (field: IncomeField, value: number) => void;
  setHouseProperty: (patch: Partial<AppState["houseProperty"]>) => void;
  setOtherSource: (field: keyof OtherSourcesInput, value: number) => void;
  setHra: (patch: Partial<HraInput>) => void;

  setRegime: (regime: Regime, actor?: ActionLogEntry["actor"]) => void;
  /** locks in the regime already selected, without changing anything */
  confirmRegime: (actor?: ActionLogEntry["actor"]) => void;
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
  /** records one advance tax instalment, and keeps the total in step */
  setAdvanceTaxInstalment: (index: number, amount: number) => void;
  submitReturn: (ack: string) => void;
  everify: () => void;

  respondToNotice: (noticeId: string, response: string) => void;
  raiseGrievance: (
    topic: GrievanceTopicId,
    description: string,
    actor?: ActionLogEntry["actor"],
  ) => ToolResult;

  setCopilotOpen: (open: boolean) => void;
  setTimelineOpen: (open: boolean) => void;
  setOpenWhy: (id: string | null) => void;
  pushCopilotMessage: (message: CopilotMessage) => void;
  /** used to stream a long agent run into the transcript as it happens */
  updateCopilotMessage: (id: string, patch: Partial<CopilotMessage>) => void;
  clearCopilot: () => void;
  logAction: (entry: Omit<ActionLogEntry, "id" | "at">) => void;
  undoAction: (id: string, options?: { quiet?: boolean }) => ToolResult;
  undoAllBy: (actor: ActionLogEntry["actor"]) => ToolResult;
  /** reverse a specific set of entries — used to undo one reply's worth */
  undoMany: (ids: string[]) => ToolResult;

  requestConfirmation: (
    confirmation: Omit<PendingConfirmation, "createdAt" | "acknowledged">,
  ) => void;
  acknowledgeConfirmation: () => void;
  dismissConfirmation: () => void;
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
 * A new return declares nothing.
 *
 * What gets handed to you is the identity layer — name, PAN, Aadhaar, address,
 * bank accounts — so nobody has to type personal details to see the product,
 * and the documents the department already holds. Every figure that is
 * actually a claim you are making starts at zero, because the work of a
 * return is deciding what goes in it. Prefilling that left the whole flow
 * looking finished before it began.
 */
const initialOtherSources: OtherSourcesInput = {
  savingsInterest: 0,
  fdInterest: 0,
  dividend: 0,
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

/**
 * Nothing arrives already settled.
 *
 * These used to open with the three "match" entries marked accepted, stamped
 * with a resolved-at time and carrying an Undo button — for a decision the
 * taxpayer had never made. One of them claimed agreement on a salary figure
 * that is not in the return at all until Form 16 is imported.
 *
 * An entry that agrees with your return is not a decision, it is an
 * observation, and `aisStatus` works it out live. What lands here is only what
 * you actually chose.
 */
const initialReconciliation: Record<string, ReconciliationItem> =
  Object.fromEntries(
    aisEntries.map((e) => [
      e.id,
      {
        id: e.id,
        resolution: "pending" as MismatchResolution,
        resolvedAmount: null,
        resolvedAt: null,
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

  /**
   * Whose return this is.
   *
   * "demo" is the seeded taxpayer you get by signing in with the PAN the login
   * screen prefills. Any other PAN is a "fresh" account: the documents the
   * department would hold still arrive, but the seeded persona's filing
   * history and notices do not, because they are not this taxpayer's.
   */
  accountKind: "demo" as "demo" | "fresh",

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
  // Owning a property is a fact only the taxpayer can state, so the switch
  // starts off. The seeded figures are still there behind it, offered on the
  // house property screen the moment it is turned on.
  houseProperty: {
    enabled: false,
    type: housePropertySeed.type,
    annualRentReceived: 0,
    municipalTaxesPaid: 0,
    homeLoanInterest: 0,
    address: "",
    tenantName: "",
  },
  otherSources: initialOtherSources,
  // Same for rent: claiming HRA is a claim, and it needs a rent figure the
  // taxpayer supplies. The metro flag follows the address we do know.
  hra: {
    claiming: false,
    rentPaidAnnual: 0,
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
  advanceTaxInstalments: [0, 0, 0, 0],
  selfAssessmentTaxPaid: 0,

  notices: initialNotices,
  grievances: [] as Grievance[],

  copilotOpen: false,
  copilotMessages: [] as CopilotMessage[],
  actionLog: [] as ActionLogEntry[],
  pendingConfirmation: null as PendingConfirmation | null,
  timelineOpen: false,
  openWhy: null as string | null,
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
      login: (method, identifier) => {
        const typed = (identifier ?? "").trim().toUpperCase().replace(/\s/g, "");
        const isDemo =
          typed.length === 0 ||
          (method === "pan"
            ? typed === taxpayer.pan
            : typed === taxpayer.aadhaarMasked.replace(/\s/g, ""));

        set((s) => ({
          loggedIn: true,
          loginMethod: method,
          accountKind: isDemo ? "demo" : "fresh",
          profile:
            isDemo || method !== "pan"
              ? s.profile
              : { ...s.profile, pan: typed },
          // A fresh PAN has no past returns and no open notices against it.
          notices: isDemo ? s.notices : {},
        }));

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
      importForm16: (actor = "you") => {
        const previousSalary = get().salary;
        const previouslyImported = get().form16Imported;
        const before = taxNow(get());
        set({ salary: seedSalary, form16Imported: true });
        const after = taxNow(get());
        get().logAction({
          actor,
          tool: "import_form16",
          summary: `Imported Form 16 from ${form16.employer.name}`,
          delta: after - before,
          why: `Form 16 carries a gross salary of ₹${grossSalaryFromForm16.toLocaleString("en-IN")} and ₹${form16.tdsDeducted.toLocaleString("en-IN")} of tax your employer already deducted. Both are now in the return, which is why the figures moved.`,
          undo: { kind: "form16", previousSalary, previouslyImported },
        });
        get().pushToast({
          tone: "success",
          title: "Form 16 imported",
          body: "Salary, allowances and TDS have been filled in for you.",
        });
      },

      /**
       * The one write path for an income figure that someone should be able to
       * see and reverse afterwards. The screens keep using the silent setters
       * below, because logging every keystroke would bury the timeline; a
       * change the user did not make themselves is the one that has to be
       * auditable.
       */
      setIncomeField: (field, value, actor = "copilot") => {
        const meta = INCOME_FIELDS[field];
        const previous = readIncomeField(get(), field);
        const before = taxNow(get());

        switch (meta.head) {
          case "salary":
            get().setSalaryField(field as keyof SalaryInput, value);
            break;
          case "other":
            get().setOtherSource(
              field === "otherIncome" ? "other" : (field as keyof OtherSourcesInput),
              value,
            );
            break;
          case "hra":
            get().setHra({ rentPaidAnnual: value });
            break;
          case "house":
            get().setHouseProperty(
              field === "houseRentReceived"
                ? { annualRentReceived: value }
                : field === "houseMunicipalTaxes"
                  ? { municipalTaxesPaid: value }
                  : { homeLoanInterest: value },
            );
            break;
        }

        const after = taxNow(get());
        get().logAction({
          actor,
          tool: "set_income",
          summary: `Set ${meta.label} to ₹${value.toLocaleString("en-IN")}`,
          delta: after - before,
          why: `${meta.label.charAt(0).toUpperCase()}${meta.label.slice(1)} went from ₹${previous.toLocaleString("en-IN")} to ₹${value.toLocaleString("en-IN")}, which took the tax from ₹${before.toLocaleString("en-IN")} to ₹${after.toLocaleString("en-IN")}.`,
          undo: { kind: "income", field, previous },
        });
        get().touchModule("income");
      },

      setIncomeFieldSilently: (field, value) => {
        const meta = INCOME_FIELDS[field];
        if (meta.head === "salary") {
          set((s) => ({ salary: { ...s.salary, [field]: value } }));
        } else if (meta.head === "other") {
          const key = field === "otherIncome" ? "other" : field;
          set((s) => ({ otherSources: { ...s.otherSources, [key]: value } }));
        } else if (meta.head === "hra") {
          set((s) => ({ hra: { ...s.hra, rentPaidAnnual: value } }));
        } else {
          set((s) => ({
            houseProperty: {
              ...s.houseProperty,
              ...(field === "houseRentReceived"
                ? { annualRentReceived: value }
                : field === "houseMunicipalTaxes"
                  ? { municipalTaxesPaid: value }
                  : { homeLoanInterest: value }),
            },
          }));
        }
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
        const previous = get().regime;
        if (previous === regime) return;
        const previouslyExplicit = get().regimeChosenExplicitly;
        const before = taxNow(get());
        set({ regime, regimeChosenExplicitly: true });
        const after = taxNow(get());
        get().logAction({
          actor,
          tool: "switch_regime",
          summary: `Switched to the ${regime} tax regime`,
          delta: after - before,
          why: `Tax under the ${previous} regime was ₹${before.toLocaleString("en-IN")}; under the ${regime} regime it is ₹${after.toLocaleString("en-IN")}. Both are computed on the same return.`,
          undo: { kind: "regime", previous, previouslyExplicit },
        });
        get().pushToast({
          tone: actor === "copilot" ? "copilot" : "success",
          title: `Now using the ${regime} regime`,
          body: "Every figure on the platform has been recalculated.",
        });
        get().touchModule("regime");
      },

      confirmRegime: (actor = "you") => {
        if (get().regimeChosenExplicitly) return;
        set({ regimeChosenExplicitly: true });
        get().logAction({
          actor,
          tool: "confirm_regime",
          summary: `Confirmed the ${get().regime} regime for this return`,
          why: `Nothing changed — this only records that the ${get().regime} regime is a deliberate choice rather than the default.`,
        });
      },

      setDeduction: (section, value, actor = "you") => {
        const previousRaw = get().deductions[section];
        const before = taxNow(get());
        set((s) => ({
          deductions: { ...s.deductions, [section]: value } as DeductionInput,
        }));
        if (typeof value === "number") {
          const after = taxNow(get());
          get().logAction({
            actor,
            tool: "add_deduction",
            summary: `Set ${sectionLabel(section, get().profile.age)} to ₹${value.toLocaleString("en-IN")}`,
            delta: after - before,
            why:
              get().regime === "new"
                ? `Recorded, but the new regime does not allow ${sectionLabel(section, get().profile.age)}, so your tax has not moved. It would apply the moment you switch to the old regime.`
                : `₹${value.toLocaleString("en-IN")} under ${sectionLabel(section, get().profile.age)} took your tax from ₹${before.toLocaleString("en-IN")} to ₹${after.toLocaleString("en-IN")} — statutory ceilings already applied.`,
            undo: {
              kind: "deduction",
              section,
              previous: typeof previousRaw === "number" ? previousRaw : 0,
            },
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

        const before = get().reconciliation[itemId];
        const declaredBefore = declaredFor(get(), itemId);
        const rawDeclaredBefore = AIS_DECLARED[itemId]?.(get()) ?? 0;
        const taxBefore = taxNow(get());
        const accepted =
          resolution === "accepted" || resolution === "amount-corrected";

        const amount =
          resolution === "accepted"
            ? entry.aisAmount
            : resolution === "amount-corrected"
              ? (correctedAmount ?? entry.aisAmount)
              : resolution === "other-pan" || resolution === "duplicate"
                ? 0
                : declaredBefore;

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
        const field = OTHER_SOURCE_FIELD[itemId];
        if (field) {
          if (accepted) {
            get().setOtherSource(field, amount);
          } else {
            // Undo, or feedback sent to the reporting entity. Either way the
            // head goes back to whatever the return itself holds.
            get().setOtherSource(field, rawDeclaredBefore);
          }
        }

        const summary = resolutionSummary(entry, resolution, amount);
        const taxAfter = taxNow(get());
        get().logAction({
          actor,
          tool: "resolve_mismatch",
          summary,
          delta: taxAfter - taxBefore,
          why: `${entry.source} reported ₹${entry.aisAmount.toLocaleString("en-IN")}; you had declared ₹${declaredBefore.toLocaleString("en-IN")}. ${
            accepted
              ? `Taking their figure adds ₹${amount.toLocaleString("en-IN")} to your income and claims the ₹${entry.tdsDeducted.toLocaleString("en-IN")} of tax already deducted on it.`
              : "The amount stays out of your return, and the feedback goes back to the reporting entity."
          }`,
          undo: before
            ? {
                kind: "mismatch",
                itemId,
                previous: before.resolution,
                previousAmount: before.resolvedAmount,
                previousDeclared: rawDeclaredBefore,
              }
            : undefined,
        });
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

      setAdvanceTaxInstalment: (index, amount) => {
        const before = taxAndInterestNow(get());
        const previous = advanceTaxInstalments(get());
        const next = previous.map((v, i) => (i === index ? amount : v));
        set({
          advanceTaxInstalments: next,
          advanceTaxPaid: next.reduce((sum, v) => sum + v, 0),
        });
        const after = taxAndInterestNow(get());
        get().logAction({
          actor: "you",
          tool: "record_advance_tax",
          summary: `Recorded ₹${amount.toLocaleString("en-IN")} of advance tax paid by ${ADVANCE_TAX_INSTALMENTS[index]?.label ?? "an instalment date"}`,
          delta: after - before,
          why: "Advance tax is credited against your bill, and the date it was paid on is what section 234C interest is worked out from.",
        });
      },

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
        if (get().filing.submitted) return;
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

      setTimelineOpen: (timelineOpen) => set({ timelineOpen }),

      setOpenWhy: (openWhy) => set({ openWhy }),

      /**
       * Tier 2 reversal. Puts the specific field back to what it was and marks
       * the timeline entry undone rather than deleting it — the record of what
       * happened is part of the point.
       */
      undoAction: (id, options) => {
        const entry = get().actionLog.find((a) => a.id === id);
        if (!entry?.undo) {
          return { ok: false, summary: "There is nothing to undo there." };
        }
        if (entry.undone) {
          return { ok: false, summary: "That has already been undone." };
        }
        const u = entry.undo;

        switch (u.kind) {
          case "regime":
            set({ regime: u.previous, regimeChosenExplicitly: u.previouslyExplicit });
            break;
          case "deduction":
            set((s) => ({
              deductions: {
                ...s.deductions,
                [u.section]: u.previous,
              } as DeductionInput,
            }));
            break;
          case "income":
            get().setIncomeFieldSilently(u.field, u.previous);
            break;
          case "form16":
            set({
              salary: u.previousSalary,
              form16Imported: u.previouslyImported,
            });
            break;
          case "mismatch": {
            const seedEntry = aisEntries.find((e) => e.id === u.itemId);
            set((s) => ({
              reconciliation: {
                ...s.reconciliation,
                [u.itemId]: {
                  id: u.itemId,
                  resolution: u.previous,
                  resolvedAmount: u.previousAmount,
                  resolvedAt: u.previous === "pending" ? null : nowIso(),
                },
              },
            }));
            const field = OTHER_SOURCE_FIELD[u.itemId];
            if (field && seedEntry) {
              const restore =
                u.previous === "accepted" || u.previous === "amount-corrected"
                  ? (u.previousAmount ?? seedEntry.aisAmount)
                  : u.previousDeclared;
              set((s) => ({
                otherSources: { ...s.otherSources, [field]: restore },
              }));
            }
            break;
          }
        }

        set((s) => ({
          actionLog: s.actionLog.map((a) =>
            a.id === id ? { ...a, undone: true } : a,
          ),
        }));
        const summary = `Undone — ${entry.summary.charAt(0).toLowerCase()}${entry.summary.slice(1)}`;
        if (!options?.quiet) {
          get().pushToast({ tone: "info", title: "Undone", body: entry.summary });
        }
        return { ok: true, summary };
      },

      /**
       * After a long agent run, undoing twelve things one at a time is not a
       * real way out. This reverses everything that actor still has standing,
       * newest first so each undo restores the value the one before it saw.
       */
      undoAllBy: (actor) => {
        const reversible = get().actionLog.filter(
          (a) => a.actor === actor && a.undo && !a.undone,
        );
        if (reversible.length === 0) {
          return { ok: false, summary: "There is nothing left to undo." };
        }
        for (const entry of reversible) get().undoAction(entry.id, { quiet: true });
        const summary = `Undid ${reversible.length} ${reversible.length === 1 ? "change" : "changes"}`;
        get().pushToast({
          tone: "info",
          title: summary,
          body: "Your return is back where it was.",
        });
        return { ok: true, summary };
      },

      /**
       * Undo exactly the entries named, newest first. This is what sits under a
       * single reply in the transcript: undoing "these two" must mean those
       * two, not everything the assistant has ever done in the session.
       */
      undoMany: (ids) => {
        const log = get().actionLog;
        const targets = log.filter(
          (a) => ids.includes(a.id) && a.undo && !a.undone,
        );
        if (targets.length === 0) {
          return { ok: false, summary: "There is nothing left to undo there." };
        }
        for (const entry of targets) get().undoAction(entry.id, { quiet: true });
        const summary = `Undid ${targets.length} ${targets.length === 1 ? "change" : "changes"}`;
        get().pushToast({ tone: "info", title: summary });
        return { ok: true, summary };
      },

      requestConfirmation: (confirmation) =>
        set({
          pendingConfirmation: {
            ...confirmation,
            createdAt: nowIso(),
            acknowledged: false,
          },
        }),

      /**
       * Only ever called from a direct tap on the confirmation card. The
       * acknowledgement is single-use: the acting tool clears it, so a second
       * Tier 3 action needs its own fresh tap.
       */
      acknowledgeConfirmation: () =>
        set((s) =>
          s.pendingConfirmation
            ? {
                pendingConfirmation: {
                  ...s.pendingConfirmation,
                  acknowledged: true,
                },
              }
            : {},
        ),

      dismissConfirmation: () => set({ pendingConfirmation: null }),

      pushCopilotMessage: (message) =>
        set((s) => ({ copilotMessages: [...s.copilotMessages, message] })),

      updateCopilotMessage: (id, patch) =>
        set((s) => ({
          copilotMessages: s.copilotMessages.map((m) =>
            m.id === id ? { ...m, ...patch } : m,
          ),
        })),

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
        // An agent run can fire a dozen of these in a few seconds. Keeping only
        // the newest few stops the screen filling with cards nobody reads —
        // the full record is in the timeline either way.
        set((s) => ({
          toasts: [...s.toasts, { ...toast, id }].slice(-3),
        }));
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
      // Renamed with the redesign: the persisted shape gained the action
      // timeline's undo payloads and the Tier 3 confirmation, and the seeded
      // identity changed. A stale v1 session would show the old PAN.
      // Bumped from v2: sessions saved before this carry a reconciliation
      // map with entries already marked accepted, which is exactly the
      // fabricated state this version stopped creating. Restoring one would
      // keep showing "settled" for decisions nobody made, so they start over.
      name: "taxsaathi-session-v3",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // Rehydration is kicked off manually from a client effect so that the
      // first client render matches what the server sent.
      skipHydration: true,
      // Only durable state is persisted. Toasts, the pending-navigation
      // request and the highlight pulse are per-render concerns.
      partialize: (s) => ({
        loggedIn: s.loggedIn,
        loginMethod: s.loginMethod,
        accountKind: s.accountKind,
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
        advanceTaxInstalments: s.advanceTaxInstalments,
        selfAssessmentTaxPaid: s.selfAssessmentTaxPaid,
        notices: s.notices,
        grievances: s.grievances,
        copilotMessages: s.copilotMessages,
        actionLog: s.actionLog,
        pendingConfirmation: s.pendingConfirmation,
      }),
    },
  ),
);

/** ------------------------------------------------------------------
 *  Derived selectors — used by the UI and by the copilot context builder
 *  ------------------------------------------------------------------ */

/**
 * Total tax as things currently stand. Used to record what each logged action
 * actually did to the bottom line, so the timeline can say "−₹17,040" rather
 * than just naming the action.
 */
/** Current value of any field the copilot is allowed to move. */
export function readIncomeField(s: AppState, field: IncomeField): number {
  switch (INCOME_FIELDS[field].head) {
    case "salary":
      return s.salary[field as keyof SalaryInput];
    case "other":
      return s.otherSources[
        field === "otherIncome" ? "other" : (field as keyof OtherSourcesInput)
      ];
    case "hra":
      return s.hra.rentPaidAnnual;
    default:
      return field === "houseRentReceived"
        ? s.houseProperty.annualRentReceived
        : field === "houseMunicipalTaxes"
          ? s.houseProperty.municipalTaxesPaid
          : s.houseProperty.homeLoanInterest;
  }
}

function taxNow(s: AppState): number {
  return computeTax(toTaxpayerInput(s)).totalTaxLiability;
}

/**
 * Tax plus the interest and fee on top of it. Recording an advance tax
 * instalment cannot move the tax itself by a rupee — what it moves is the 234C
 * interest, so that is what its timeline entry has to be measured against.
 */
function taxAndInterestNow(s: AppState): number {
  return computeTax(toTaxpayerInput(s)).totalTaxAndInterest;
}

/**
 * The name of a section, as it applies to this taxpayer. Only one entry moves:
 * from 60, the savings-interest field is 80TTB rather than 80TTA, and calling
 * it 80TTA in the timeline would be telling them the wrong section.
 */
export function sectionLabel(
  section: keyof DeductionInput,
  age?: number,
): string {
  if (section === "s80TTA" && age !== undefined && age >= 60) return "80TTB";
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

/**
 * The four instalments, tolerating a persisted state written before the field
 * existed.
 */
export function advanceTaxInstalments(s: AppState): number[] {
  const stored = s.advanceTaxInstalments;
  return ADVANCE_TAX_INSTALMENTS.map((_, i) =>
    typeof stored?.[i] === "number" ? stored[i] : 0,
  );
}

/**
 * The same four as a running total, which is the shape section 234C compares
 * against. Returns undefined when nothing has been recorded, so the interest
 * calculation knows it is assuming rather than reading.
 */
export function advanceTaxCumulative(s: AppState): number[] | undefined {
  const paid = advanceTaxInstalments(s);
  if (!paid.some((n) => n > 0)) return undefined;
  let running = 0;
  return paid.map((n) => (running += n));
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
    advanceTaxSchedule: advanceTaxCumulative(s),
    selfAssessmentTaxPaid: s.selfAssessmentTaxPaid,
    tdsOnOtherIncome: tdsOnOtherIncome(s),
    // Interest runs to the day you file, so a submitted return freezes it and
    // an unsubmitted one keeps accruing against today.
    filedOn: s.filing.submittedAt ?? undefined,
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

/**
 * What the return currently says for a given AIS entry, read live off the
 * store rather than off the seed.
 *
 * The seed carries a `declaredAmount` per entry, which was a snapshot of one
 * moment and stopped being true the instant anyone typed a figure — most
 * visibly for salary, which the seed claimed you had declared while the return
 * held nothing until Form 16 was imported.
 */
const AIS_DECLARED: Record<string, ((s: AppState) => number) | undefined> = {
  "ais-salary": (s) =>
    s.salary.basic +
    s.salary.hra +
    s.salary.specialAllowance +
    s.salary.lta +
    s.salary.otherAllowances +
    s.salary.employerNps,
  "ais-savings-interest": (s) => s.otherSources.savingsInterest,
  "ais-fd-interest": (s) => s.otherSources.fdInterest,
  "ais-dividend": (s) => s.otherSources.dividend,
  "ais-kaveri-interest": (s) => s.otherSources.other,
};

export function declaredFor(s: AppState, entryId: string): number {
  const resolved = s.reconciliation[entryId];
  if (resolved && resolved.resolution !== "pending") {
    return resolved.resolvedAmount ?? 0;
  }
  return AIS_DECLARED[entryId]?.(s) ?? 0;
}

export type AisStatus = "informational" | "agrees" | "settled" | "open";

/**
 * Four states, not two. An entry you decided is "settled"; one that happens to
 * match your return is "agrees" and needs no decision at all; an SFT purchase
 * trail is "informational" and never will.
 */
export function aisStatus(s: AppState, entry: AisEntry): AisStatus {
  if (entry.informational) return "informational";
  if ((s.reconciliation[entry.id]?.resolution ?? "pending") !== "pending") {
    return "settled";
  }
  return declaredFor(s, entry.id) === entry.aisAmount ? "agrees" : "open";
}

/** Only the entries genuinely asking the taxpayer for a decision. */
export function pendingMismatches(s: AppState): AisEntry[] {
  return aisEntries.filter((e) => aisStatus(s, e) === "open");
}

/**
 * The seeded persona's past returns and departmental notices. They belong to
 * that taxpayer, not to whatever PAN was typed at sign-in, so a fresh account
 * sees neither — the documents it does get (Form 16, AIS, 26AS) are the ones a
 * real portal would fetch for any PAN.
 */
export function visibleFilingHistory(s: AppState): FilingRecord[] {
  return s.accountKind === "fresh" ? [] : filingHistory;
}

export function visibleNotices(s: AppState): Notice[] {
  return s.accountKind === "fresh" ? [] : seededNotices;
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
