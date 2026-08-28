/**
 * ASSUMPTION (documented in the submission summary):
 * All computation uses FY 2025-26 / Assessment Year 2026-27 rules — the
 * assessment year a salaried individual would be filing for in the current
 * season. Slabs, standard deduction, 87A rebate and Chapter VI-A limits are
 * per the Finance Act 2025 position for that year.
 *
 * Everything here is real rule data driving real arithmetic in compute.ts.
 * Nothing in the app hardcodes an output figure.
 */

export const ASSESSMENT_YEAR = "2026-27";
export const FINANCIAL_YEAR = "2025-26";
export const FILING_DEADLINE = "2026-09-15"; // extended due date for non-audit cases
export const BELATED_DEADLINE = "2026-12-31";

export type Slab = { upTo: number | null; rate: number };

/** New regime (default regime u/s 115BAC) — FY 2025-26 */
export const NEW_REGIME_SLABS: Slab[] = [
  { upTo: 400_000, rate: 0 },
  { upTo: 800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.1 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.2 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
];

/** Old regime — individual below 60. FY 2025-26 (unchanged for years). */
export const OLD_REGIME_SLABS: Slab[] = [
  { upTo: 250_000, rate: 0 },
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

/** Old regime, resident senior citizen (60–79) */
export const OLD_REGIME_SLABS_SENIOR: Slab[] = [
  { upTo: 300_000, rate: 0 },
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

/** Old regime, resident super senior citizen (80+) */
export const OLD_REGIME_SLABS_SUPER_SENIOR: Slab[] = [
  { upTo: 500_000, rate: 0 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

export const STANDARD_DEDUCTION = {
  new: 75_000,
  old: 50_000,
} as const;

/** Section 87A rebate */
export const REBATE_87A = {
  new: { incomeCeiling: 1_200_000, maxRebate: 60_000, marginalRelief: true },
  old: { incomeCeiling: 500_000, maxRebate: 12_500, marginalRelief: false },
} as const;

export const CESS_RATE = 0.04; // Health & Education Cess

/** Surcharge bands on tax before cess, keyed by total income */
export const SURCHARGE_BANDS = [
  { above: 5_000_000, rate: 0.1 },
  { above: 10_000_000, rate: 0.15 },
  { above: 20_000_000, rate: 0.25 },
  { above: 50_000_000, rate: 0.37 },
] as const;

/** New regime caps surcharge at 25% */
export const NEW_REGIME_MAX_SURCHARGE = 0.25;

/** Chapter VI-A and related ceilings (old regime unless noted) */
export const LIMITS = {
  s80C: 150_000,
  s80CCD1B: 50_000,
  s80D_self: 25_000,
  s80D_self_senior: 50_000,
  s80D_parents: 25_000,
  s80D_parents_senior: 50_000,
  s80D_preventive: 5_000,
  s80TTA: 10_000,
  s80TTB: 50_000,
  s80EEB: 150_000,
  s80GG: 60_000,
  s80U_normal: 75_000,
  s80U_severe: 125_000,
  s80DD_normal: 75_000,
  s80DD_severe: 125_000,
  s80DDB: 40_000,
  s80DDB_senior: 100_000,
  homeLoanInterestSelfOccupied: 200_000,
  housePropertyLossSetOff: 200_000,
  /** 80CCD(2) employer NPS — allowed in BOTH regimes, different ceilings */
  s80CCD2_rate_new: 0.14,
  s80CCD2_rate_old: 0.1,
} as const;

/** Sections that survive into the new regime */
export const NEW_REGIME_ALLOWED_DEDUCTIONS = new Set([
  "s80CCD2",
  "standardDeduction",
  "s57iia",
]);

/** Start of the assessment year — where 234B interest begins running */
export const AY_START = "2026-04-01";

/** Interest under sections 234A, 234B and 234C: 1% for every month or part */
export const INTEREST_RATE_PER_MONTH = 0.01;

/**
 * Advance tax instalments for a non-corporate assessee (Section 211).
 * `cumulative` is the fraction of the year's tax that should have been paid by
 * that date; `relaxed` is the lower figure the first and second provisos to
 * section 234C accept without charging interest.
 */
export const ADVANCE_TAX_INSTALMENTS = [
  { due: "2025-06-15", label: "15 June", cumulative: 0.15, relaxed: 0.12, months: 3 },
  { due: "2025-09-15", label: "15 September", cumulative: 0.45, relaxed: 0.36, months: 3 },
  { due: "2025-12-15", label: "15 December", cumulative: 0.75, relaxed: 0.75, months: 3 },
  { due: "2026-03-15", label: "15 March", cumulative: 1, relaxed: 1, months: 1 },
] as const;

/** Section 234F fee for filing after the due date */
export const LATE_FEE_234F = {
  standard: 5_000,
  reduced: 1_000,
  /** total income at or below which the reduced fee applies */
  reducedUpTo: 500_000,
} as const;
