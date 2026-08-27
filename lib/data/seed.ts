/**
 * SYNTHETIC DATA ONLY.
 *
 * Every identifier, name, amount and document reference in this file is
 * invented for a hackathon prototype. There is no real taxpayer here, no real
 * PAN, no real Aadhaar, no real bank account, no real employer. PAN follows
 * the shape of a valid PAN so validation logic can be exercised, but it is a
 * made-up sequence, not anyone's.
 *
 * Assessment Year 2026-27 (Financial Year 2025-26) throughout.
 */

import { ASSESSMENT_YEAR, FINANCIAL_YEAR } from "@/lib/tax/constants";

export const SYNTHETIC = "(demo data)" as const;

export type Taxpayer = {
  name: string;
  pan: string;
  aadhaarMasked: string;
  dob: string;
  age: number;
  email: string;
  mobile: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
  };
  residentialStatus: "Resident" | "Non-resident" | "Resident but not ordinarily resident";
  panAadhaarLinked: boolean;
  employmentType: "Private sector" | "Government" | "Pensioner";
};

export const taxpayer: Taxpayer = {
  name: "Ananya Verma",
  pan: "AAAPZ1234C",
  aadhaarMasked: "XXXX XXXX 9012",
  dob: "1993-06-14",
  age: 33,
  email: "ananya.verma@example.invalid",
  mobile: "+91 90000 07742",
  address: {
    line1: "Flat 402, Juniper Court",
    line2: "Hosur Main Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560068",
  },
  residentialStatus: "Resident",
  panAadhaarLinked: true,
  employmentType: "Private sector",
};

export type BankAccount = {
  id: string;
  bank: string;
  accountNumberMasked: string;
  ifsc: string;
  type: "Savings" | "Current";
  validated: boolean;
  nominatedForRefund: boolean;
};

export const bankAccounts: BankAccount[] = [
  {
    id: "bank-meridian",
    bank: "Meridian Bank",
    accountNumberMasked: "XXXXXXXX4472",
    ifsc: "MRDN0000123",
    type: "Savings",
    validated: true,
    nominatedForRefund: true,
  },
  {
    id: "bank-kaveri",
    bank: "Kaveri Co-operative Bank",
    accountNumberMasked: "XXXXXXXX8810",
    ifsc: "KVRC0000456",
    type: "Savings",
    validated: false,
    nominatedForRefund: false,
  },
];

/** ------------------------------------------------------------------
 *  Form 16 — Part A (TDS) and Part B (salary breakup)
 *  ------------------------------------------------------------------ */
export const form16 = {
  assessmentYear: ASSESSMENT_YEAR,
  financialYear: FINANCIAL_YEAR,
  employer: {
    name: "Vermillion Systems Private Limited",
    tan: "BLRV12345E",
    address: "Prestige Tech Cluster, Outer Ring Road, Bengaluru 560103",
  },
  certificateNumber: "SYN-F16-2026-004472",
  issuedOn: "2026-06-12",
  salary: {
    basic: 920_000,
    hra: 460_000,
    specialAllowance: 328_000,
    lta: 40_000,
    otherAllowances: 0,
    employerNps: 92_000,
  },
  professionalTax: 2_400,
  tdsDeducted: 245_000,
  /** Section 80C amounts the employer already had on record */
  employerRecognisedDeductions: {
    epfEmployeeShare: 110_400,
    lifeInsurance: 18_000,
  },
} as const;

export const grossSalaryFromForm16 =
  form16.salary.basic +
  form16.salary.hra +
  form16.salary.specialAllowance +
  form16.salary.lta +
  form16.salary.otherAllowances +
  form16.salary.employerNps;

/** ------------------------------------------------------------------
 *  Rent / HRA
 *  ------------------------------------------------------------------ */
export const rentDetails = {
  monthlyRent: 28_000,
  monthsPaid: 12,
  city: "Bengaluru",
  // For HRA the metro list is only Delhi, Mumbai, Kolkata and Chennai, so
  // Bengaluru takes the 40%-of-basic leg, not 50%.
  metroCity: false,
  landlordName: "R. Krishnamurthy",
  landlordPanRequired: true,
  landlordPan: "AAAPK1111Q",
  note:
    "Only Delhi, Mumbai, Kolkata and Chennai count as metros for HRA. Bengaluru is treated as non-metro, so the exemption uses 40% of basic salary rather than 50%.",
};

export const annualRentPaid = rentDetails.monthlyRent * rentDetails.monthsPaid;

/** ------------------------------------------------------------------
 *  House property — a let-out flat in another city
 *  ------------------------------------------------------------------ */
export const housePropertySeed = {
  enabled: true,
  type: "let-out" as const,
  address: "B-11, Amaltas Residency, Indore, Madhya Pradesh 452010",
  tenantName: "S. Deshpande",
  monthlyRent: 22_000,
  annualRentReceived: 264_000,
  municipalTaxesPaid: 6_000,
  homeLoanInterest: 245_000,
  homeLoanPrincipal: 96_000, // qualifies under 80C
  lender: "Northline Housing Finance",
};

/** ------------------------------------------------------------------
 *  AIS — Annual Information Statement
 *  This is where the deliberate mismatches live.
 *  ------------------------------------------------------------------ */
export type AisEntry = {
  id: string;
  category:
    | "Salary"
    | "Interest"
    | "Dividend"
    | "Rent received"
    | "SFT"
    | "TDS/TCS";
  description: string;
  source: string;
  sourcePan: string;
  aisAmount: number;
  tdsDeducted: number;
  /** plain-language explanation of the gap, shown in the reconciliation UI */
  plainLanguage: string;
  severity: "match" | "attention" | "action";
  /**
   * Reported to the department but not income — an SFT purchase trail, say.
   * There is no figure in the return for it to agree or disagree with, so it
   * is never something to settle and never counts as outstanding.
   */
  informational?: boolean;
};

export const aisEntries: AisEntry[] = [
  {
    id: "ais-salary",
    category: "Salary",
    description: "Salary received from employer",
    source: "Vermillion Systems Private Limited",
    sourcePan: "AABCV5678K",
    aisAmount: grossSalaryFromForm16,
    tdsDeducted: 245_000,
    plainLanguage:
      "Your employer has reported this salary to the department. Import your Form 16 on the salary screen and it lands in your return exactly as reported — until then the return has nothing under salary at all, which is the one gap the department notices immediately.",
    severity: "action",
  },
  {
    id: "ais-savings-interest",
    category: "Interest",
    description: "Interest on savings bank account",
    source: "Meridian Bank",
    sourcePan: "AAACM2233L",
    aisAmount: 14_850,
    tdsDeducted: 0,
    plainLanguage:
      "Savings account interest matches what you have declared. Remember it is taxable even though no TDS was cut — the 80TTA deduction covers the first ₹10,000 under the old regime.",
    severity: "match",
  },
  {
    id: "ais-fd-interest",
    category: "Interest",
    description: "Interest on fixed deposit",
    source: "Meridian Bank",
    sourcePan: "AAACM2233L",
    aisAmount: 42_300,
    tdsDeducted: 4_230,
    plainLanguage:
      "Your bank told the department you earned ₹42,300 of fixed deposit interest and already deducted ₹4,230 of TDS on it. You have not declared this anywhere in your return. If you leave it out, the department's system will flag the return automatically.",
    severity: "action",
  },
  {
    id: "ais-dividend",
    category: "Dividend",
    description: "Dividend from listed equity shares",
    source: "Helios Industries Limited",
    sourcePan: "AAACH7788M",
    aisAmount: 8_400,
    tdsDeducted: 840,
    plainLanguage:
      "AIS shows ₹8,400 of dividend but you have declared ₹6,000 — a gap of ₹2,400. The likely cause is a dividend credited late in March that you had not counted.",
    severity: "action",
  },
  {
    id: "ais-kaveri-interest",
    category: "Interest",
    description: "Interest on savings bank account",
    source: "Kaveri Co-operative Bank",
    sourcePan: "AAACK9911N",
    aisAmount: 9_200,
    tdsDeducted: 0,
    plainLanguage:
      "This is a joint account where you are the second holder. If the interest belongs to the first holder, you can submit feedback saying the information relates to another PAN instead of adding it to your income.",
    severity: "attention",
  },
  {
    id: "ais-sft-mf",
    category: "SFT",
    description: "Purchase of mutual fund units (SFT-018)",
    source: "Cobalt Asset Management",
    sourcePan: "AAACC4455P",
    aisAmount: 180_000,
    tdsDeducted: 0,
    plainLanguage:
      "This is an information-only entry. Buying mutual fund units is not income — it appears here so the department can see the money trail. ₹36,000 of this was an ELSS purchase, which is eligible for 80C.",
    severity: "match",
    informational: true,
  },
];

/** ------------------------------------------------------------------
 *  Form 26AS — TDS/TCS credits
 *  ------------------------------------------------------------------ */
export type Form26ASEntry = {
  id: string;
  section: string;
  deductor: string;
  deductorTan: string;
  amountPaid: number;
  taxDeducted: number;
  quarter: string;
  status: "Final" | "Provisional";
};

export const form26AS: Form26ASEntry[] = [
  {
    id: "26as-salary",
    section: "192B",
    deductor: "Vermillion Systems Private Limited",
    deductorTan: "BLRV12345E",
    amountPaid: grossSalaryFromForm16,
    taxDeducted: 245_000,
    quarter: "Q1-Q4",
    status: "Final",
  },
  {
    id: "26as-fd",
    section: "194A",
    deductor: "Meridian Bank",
    deductorTan: "BLRM55667C",
    amountPaid: 42_300,
    taxDeducted: 4_230,
    quarter: "Q3",
    status: "Final",
  },
  {
    id: "26as-dividend",
    section: "194",
    deductor: "Helios Industries Limited",
    deductorTan: "MUMH99887D",
    amountPaid: 8_400,
    taxDeducted: 840,
    quarter: "Q2",
    status: "Final",
  },
];

export const totalTdsIn26AS = form26AS.reduce((s, e) => s + e.taxDeducted, 0);

/** ------------------------------------------------------------------
 *  TIS — Taxpayer Information Summary (the derived, category-level view)
 *  ------------------------------------------------------------------ */
export type TisRow = {
  id: string;
  head: string;
  /** what the reporting entities said */
  reportedValue: number;
  /** after the department applies its own de-duplication rules */
  processedValue: number;
  /** what it becomes once your feedback is taken into account */
  derivedValue: number;
  feedbackApplied: boolean;
};

export function buildTis(
  entries: { id: string; aisAmount: number; declaredAmount: number }[],
): TisRow[] {
  const byHead: Record<string, { reported: number; derived: number }> = {};
  const headFor = (id: string) => {
    if (id.includes("salary")) return "Salary";
    if (id.includes("dividend")) return "Dividend";
    if (id.includes("sft")) return "Purchase of securities and units";
    return "Interest from deposits";
  };
  for (const e of entries) {
    const head = headFor(e.id);
    byHead[head] ??= { reported: 0, derived: 0 };
    byHead[head].reported += e.aisAmount;
    byHead[head].derived += e.declaredAmount;
  }
  return Object.entries(byHead).map(([head, v]) => ({
    id: `tis-${head.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    head,
    reportedValue: v.reported,
    processedValue: v.reported,
    derivedValue: v.derived,
    feedbackApplied: v.derived !== v.reported,
  }));
}

/** ------------------------------------------------------------------
 *  Deduction proofs the taxpayer has on hand
 *  ------------------------------------------------------------------ */
export const deductionEvidence = {
  epfEmployeeShare: 110_400,
  elss: 36_000,
  lifeInsurance: 18_000,
  homeLoanPrincipal: 96_000,
  childTuitionFees: 48_000,
  npsSelfContribution: 50_000,
  healthInsuranceSelf: 22_000,
  healthInsuranceParents: 38_000,
  parentsAreSeniorCitizens: true,
  preventiveHealthCheckup: 5_000,
  educationLoanInterest: 120_000,
  donations80G: 0,
  evLoanInterest: 0,
};

/** ------------------------------------------------------------------
 *  Prior filing history
 *  ------------------------------------------------------------------ */
export type FilingRecord = {
  assessmentYear: string;
  form: string;
  regime: "old" | "new";
  filedOn: string;
  verifiedOn: string | null;
  acknowledgementNumber: string;
  grossTotalIncome: number;
  totalTax: number;
  status:
    | "Filed"
    | "Verified"
    | "Processed"
    | "Refund issued"
    | "Demand raised";
  refundAmount: number;
  refundCreditedOn: string | null;
};

export const filingHistory: FilingRecord[] = [
  {
    assessmentYear: "2025-26",
    form: "ITR-1",
    regime: "new",
    filedOn: "2025-07-18",
    verifiedOn: "2025-07-18",
    acknowledgementNumber: "SYN417329640180725",
    grossTotalIncome: 1_642_000,
    totalTax: 148_720,
    status: "Refund issued",
    refundAmount: 12_340,
    refundCreditedOn: "2025-09-02",
  },
  {
    assessmentYear: "2024-25",
    form: "ITR-1",
    regime: "old",
    filedOn: "2024-07-26",
    verifiedOn: "2024-07-27",
    acknowledgementNumber: "SYN391184220260724",
    grossTotalIncome: 1_486_000,
    totalTax: 161_450,
    status: "Processed",
    refundAmount: 0,
    refundCreditedOn: null,
  },
];

/** ------------------------------------------------------------------
 *  Notices and e-Proceedings
 *  ------------------------------------------------------------------ */
export type Notice = {
  id: string;
  reference: string;
  section: string;
  title: string;
  assessmentYear: string;
  issuedOn: string;
  respondBy: string | null;
  requiresResponse: boolean;
  plainLanguage: string;
  detail: string;
  suggestedActions: string[];
  status: "Open" | "Responded" | "Closed";
};

export const notices: Notice[] = [
  {
    id: "notice-143-1",
    reference: "SYN/CPC/2025-26/143-1/0098431",
    section: "143(1)",
    title: "Intimation after processing of your AY 2025-26 return",
    assessmentYear: "2025-26",
    issuedOn: "2025-08-21",
    respondBy: null,
    requiresResponse: false,
    plainLanguage:
      "Good news — this one needs nothing from you. The department finished checking last year's return, agreed with your numbers, and confirmed a refund of ₹12,340, which was credited on 2 September 2025.",
    detail:
      "The return filed on 18 July 2025 has been processed under section 143(1). Income as computed by the taxpayer and as computed under section 143(1) are in agreement. Refund determined: ₹12,340. Mode: direct credit to the bank account ending 4472.",
    suggestedActions: ["Keep a copy with your records"],
    status: "Closed",
  },
  {
    id: "notice-ecampaign-interest",
    reference: "SYN/e-CAMP/2026-27/INT/0116702",
    section: "e-Campaign",
    title: "Interest income reported by your bank does not appear in your return",
    assessmentYear: "2026-27",
    issuedOn: "2026-08-05",
    respondBy: "2026-09-04",
    requiresResponse: true,
    plainLanguage:
      "Your bank told the department about ₹42,300 of fixed deposit interest for this year. The department has not yet seen a return from you that includes it. This is a nudge, not an accusation — if you add the interest before you file, the matter closes on its own.",
    detail:
      "Information received under section 285BA indicates interest income of ₹42,300 from Meridian Bank (TAN BLRM55667C) during FY 2025-26, on which ₹4,230 was deducted at source under section 194A. You are requested to confirm whether this information is correct and to ensure it is reflected in your return of income for AY 2026-27.",
    suggestedActions: [
      "Add the fixed deposit interest to Income from Other Sources",
      "Confirm the information is correct",
      "Disagree — the information does not belong to me",
    ],
    status: "Open",
  },
];

/** ------------------------------------------------------------------
 *  Grievance categories (unified e-Nivaran + CPGRAMS replacement)
 *  ------------------------------------------------------------------ */
export const grievanceTopics = [
  {
    id: "refund-delay",
    label: "My refund has not arrived",
    routesTo: "Centralised Processing Centre",
    typicalDays: 15,
    beforeYouRaise:
      "Refunds usually land 20-45 days after e-verification. Check your refund tracker first — if the status still says Processed, the money is in the payment queue and a grievance will not speed it up.",
  },
  {
    id: "ais-mismatch",
    label: "Something in my AIS or 26AS is wrong",
    routesTo: "Assessing Officer / Reporting entity",
    typicalDays: 30,
    beforeYouRaise:
      "Submitting feedback directly on the AIS entry is faster than a grievance, and it reaches the same people. Try the reconciliation screen first.",
  },
  {
    id: "everify-failed",
    label: "I cannot e-verify my return",
    routesTo: "e-Filing Helpdesk",
    typicalDays: 7,
    beforeYouRaise:
      "The most common cause is a mobile number that is not the one linked to your Aadhaar. You have 30 days from filing to verify, so there is usually time to sort this out.",
  },
  {
    id: "demand-disagree",
    label: "I disagree with a tax demand",
    routesTo: "Assessing Officer",
    typicalDays: 45,
    beforeYouRaise:
      "A demand raised under section 143(1) can often be resolved faster by responding to the intimation itself, in the Notices section, rather than by raising a grievance.",
  },
  {
    id: "profile-login",
    label: "Login, PAN or profile problem",
    routesTo: "e-Filing Helpdesk",
    typicalDays: 5,
    beforeYouRaise:
      "If PAN and Aadhaar are not linked, most other things stop working. Check the linkage status on your profile page first.",
  },
  {
    id: "other",
    label: "Something else",
    routesTo: "e-Filing Helpdesk",
    typicalDays: 21,
    beforeYouRaise:
      "Describe what you expected to happen and what happened instead. Specific grievances get resolved noticeably faster than general ones.",
  },
] as const;

export type GrievanceTopicId = (typeof grievanceTopics)[number]["id"];
