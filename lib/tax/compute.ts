import {
  CESS_RATE,
  FILING_DEADLINE,
  LIMITS,
  NEW_REGIME_MAX_SURCHARGE,
  NEW_REGIME_SLABS,
  OLD_REGIME_SLABS,
  OLD_REGIME_SLABS_SENIOR,
  OLD_REGIME_SLABS_SUPER_SENIOR,
  REBATE_87A,
  STANDARD_DEDUCTION,
  SURCHARGE_BANDS,
  type Slab,
} from "./constants";
import { computeInterest, type InterestResult } from "./interest";

export type Regime = "new" | "old";

export type SalaryInput = {
  basic: number;
  hra: number;
  specialAllowance: number;
  lta: number;
  otherAllowances: number;
  /** Employer contribution to NPS — deductible u/s 80CCD(2) in both regimes */
  employerNps: number;
  professionalTax: number;
  tdsDeducted: number;
};

export type HousePropertyInput = {
  enabled: boolean;
  type: "self-occupied" | "let-out";
  annualRentReceived: number;
  municipalTaxesPaid: number;
  homeLoanInterest: number;
};

export type OtherSourcesInput = {
  savingsInterest: number;
  fdInterest: number;
  dividend: number;
  other: number;
};

export type HraInput = {
  claiming: boolean;
  rentPaidAnnual: number;
  metroCity: boolean;
};

/** Old-regime Chapter VI-A inputs, as the user enters them (pre-cap) */
export type DeductionInput = {
  s80C: number;
  s80CCD1B: number;
  s80D_self: number;
  s80D_parents: number;
  s80D_parents_senior: boolean;
  s80DDB: number;
  s80E: number;
  s80G: number;
  /**
   * true for the notified national funds — PM National Relief Fund, National
   * Defence Fund and the like — which are deductible in full with no ceiling.
   * false, the default, is an ordinary registered institution: half the
   * donation, and only up to a tenth of adjusted gross total income.
   */
  s80G_fullyDeductible: boolean;
  s80TTA: number;
  s80EEB: number;
  s80U: number;
};

export type TaxpayerInput = {
  age: number;
  regime: Regime;
  salary: SalaryInput;
  houseProperty: HousePropertyInput;
  otherSources: OtherSourcesInput;
  hra: HraInput;
  deductions: DeductionInput;
  advanceTaxPaid: number;
  selfAssessmentTaxPaid: number;
  tdsOnOtherIncome: number;
  /**
   * Cumulative advance tax paid by each of the four instalment dates, when the
   * taxpayer has recorded them. Left out, section 234C assumes the worst.
   */
  advanceTaxSchedule?: number[];
  /** ISO date the return was filed; today, for a return not yet submitted */
  filedOn?: string;
};

export type LineItem = {
  label: string;
  amount: number;
  note?: string;
  /** true when the line is a subtraction from income */
  negative?: boolean;
};

export type TaxComputation = {
  regime: Regime;
  grossSalary: number;
  /** exempt allowances (HRA etc.) — old regime only */
  exemptAllowances: number;
  hraExemption: number;
  standardDeduction: number;
  professionalTax: number;
  incomeFromSalary: number;
  incomeFromHouseProperty: number;
  incomeFromOtherSources: number;
  grossTotalIncome: number;
  chapterVIA: number;
  chapterVIABreakdown: LineItem[];
  totalIncome: number;
  taxBeforeRebate: number;
  slabBreakdown: { from: number; to: number | null; rate: number; tax: number }[];
  rebate87A: number;
  marginalRelief: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalTaxLiability: number;
  /** interest and fee under sections 234A, 234B, 234C and 234F */
  interest: InterestResult;
  /** what the return actually asks for: tax plus that interest and fee */
  totalTaxAndInterest: number;
  tdsCredit: number;
  advanceTax: number;
  selfAssessmentTax: number;
  /** positive => payable, negative => refund due */
  balance: number;
  refundDue: number;
  taxPayable: number;
  effectiveRate: number;
};

const r0 = (n: number) => Math.round(n);
const clampMin0 = (n: number) => (n > 0 ? n : 0);
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
const inr = (n: number) => n.toLocaleString("en-IN");

/**
 * Whether the old regime can still be chosen.
 *
 * Under section 115BAC(6) a salaried taxpayer opts out of the default new
 * regime by saying so *on a return filed by the due date*. Miss it, and the
 * belated return under 139(4) is locked to the new regime however much the old
 * one would have saved. The regime screen has always said this in prose; this
 * is the function that makes it true.
 */
export function oldRegimeAvailable(asOf: Date = new Date()): boolean {
  return asOf <= new Date(FILING_DEADLINE);
}

/** ------------------------------------------------------------------
 *  Slab arithmetic
 *  ------------------------------------------------------------------ */
export function slabsFor(regime: Regime, age: number): Slab[] {
  if (regime === "new") return NEW_REGIME_SLABS;
  if (age >= 80) return OLD_REGIME_SLABS_SUPER_SENIOR;
  if (age >= 60) return OLD_REGIME_SLABS_SENIOR;
  return OLD_REGIME_SLABS;
}

export function applySlabs(taxableIncome: number, slabs: Slab[]) {
  let remaining = clampMin0(taxableIncome);
  let previousCeiling = 0;
  let tax = 0;
  const breakdown: TaxComputation["slabBreakdown"] = [];

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const width =
      slab.upTo === null ? remaining : Math.max(0, slab.upTo - previousCeiling);
    const chunk = Math.min(remaining, width);
    const slabTax = chunk * slab.rate;
    if (chunk > 0) {
      breakdown.push({
        from: previousCeiling,
        to: slab.upTo,
        rate: slab.rate,
        tax: slabTax,
      });
    }
    tax += slabTax;
    remaining -= chunk;
    previousCeiling = slab.upTo ?? previousCeiling;
  }

  return { tax, breakdown };
}

/** ------------------------------------------------------------------
 *  HRA exemption u/s 10(13A) — least of the three
 *  ------------------------------------------------------------------ */
export function computeHraExemption(input: {
  basic: number;
  hraReceived: number;
  rentPaidAnnual: number;
  metroCity: boolean;
}) {
  const basic = num(input.basic);
  const hraReceived = num(input.hraReceived);
  const rent = num(input.rentPaidAnnual);

  const actualHra = hraReceived;
  const rentOverTenPercent = clampMin0(rent - 0.1 * basic);
  const cityLimit = (input.metroCity ? 0.5 : 0.4) * basic;

  const exemption = Math.max(0, Math.min(actualHra, rentOverTenPercent, cityLimit));

  return {
    exemption,
    legs: [
      { label: "HRA actually received", amount: actualHra },
      { label: "Rent paid minus 10% of basic salary", amount: rentOverTenPercent },
      {
        label: `${input.metroCity ? "50" : "40"}% of basic salary (${
          input.metroCity ? "metro city" : "non-metro city"
        })`,
        amount: cityLimit,
      },
    ],
    winnerIndex: [actualHra, rentOverTenPercent, cityLimit].indexOf(exemption),
  };
}

/** ------------------------------------------------------------------
 *  House property income (Sections 22-24)
 *  ------------------------------------------------------------------ */
export function computeHouseProperty(hp: HousePropertyInput, regime: Regime) {
  if (!hp.enabled) {
    return { income: 0, steps: [] as LineItem[], setOffCapped: false, rawIncome: 0 };
  }

  const steps: LineItem[] = [];

  if (hp.type === "self-occupied") {
    // Annual value of a self-occupied house is nil; only the loan interest is
    // allowed, and only under the old regime.
    const interest = Math.min(
      num(hp.homeLoanInterest),
      LIMITS.homeLoanInterestSelfOccupied,
    );
    const allowed = regime === "old" ? interest : 0;
    steps.push({ label: "Annual value (self-occupied)", amount: 0 });
    steps.push({
      label: "Interest on housing loan u/s 24(b)",
      amount: allowed,
      negative: true,
      note:
        regime === "new"
          ? "Not allowed for a self-occupied house under the new regime"
          : num(hp.homeLoanInterest) > LIMITS.homeLoanInterestSelfOccupied
            ? `Capped at ₹2,00,000 — you entered ₹${inr(num(hp.homeLoanInterest))}`
            : undefined,
    });
    // `-allowed` is negative zero when nothing is allowed, which is not equal
    // to 0 under Object.is and reads as "-₹0" to anything that formats it.
    const raw = allowed > 0 ? -allowed : 0;
    const income = Math.max(raw, -LIMITS.housePropertyLossSetOff);
    return { income, steps, setOffCapped: raw < income, rawIncome: raw };
  }

  const gav = num(hp.annualRentReceived);
  const municipal = num(hp.municipalTaxesPaid);
  const nav = clampMin0(gav - municipal);
  const standard = nav * 0.3;
  const interest = num(hp.homeLoanInterest);

  steps.push({ label: "Gross annual value (rent received)", amount: gav });
  steps.push({ label: "Municipal taxes paid", amount: municipal, negative: true });
  steps.push({ label: "Net annual value", amount: nav });
  steps.push({
    label: "Standard deduction u/s 24(a) — 30% of net annual value",
    amount: standard,
    negative: true,
  });
  steps.push({
    label: "Interest on housing loan u/s 24(b)",
    amount: interest,
    negative: true,
  });

  const raw = nav - standard - interest;

  // Under the new regime a loss under this head cannot be set off against any
  // other head, and cannot be carried forward either — the interest is still
  // allowed against the rent, but a negative result simply stops at zero.
  if (regime === "new") {
    if (raw < 0) {
      steps.push({
        label: "Loss disallowed under the new regime",
        amount: -raw,
        note: "A house property loss cannot be set off against salary, or carried forward, under section 115BAC",
      });
    }
    return { income: Math.max(0, raw), steps, setOffCapped: false, rawIncome: raw };
  }

  // Old regime: a loss can be set off against other heads up to ₹2,00,000 a
  // year; the balance is carried forward for up to eight years.
  const income = raw < 0 ? Math.max(raw, -LIMITS.housePropertyLossSetOff) : raw;

  return { income, steps, setOffCapped: raw < income, rawIncome: raw };
}

/** ------------------------------------------------------------------
 *  Chapter VI-A
 *  ------------------------------------------------------------------ */
/**
 * The three Chapter VI-A ceilings that move with the taxpayer's own age.
 * Turning 60 is not a footnote here: it doubles the health-insurance ceiling,
 * more than doubles the one for specified treatment, and replaces 80TTA with
 * a 80TTB five times its size that also covers deposits.
 */
export function ageAwareLimits(age: number) {
  const senior = age >= 60;
  return {
    senior,
    s80D_self: senior ? LIMITS.s80D_self_senior : LIMITS.s80D_self,
    s80DDB: senior ? LIMITS.s80DDB_senior : LIMITS.s80DDB,
  };
}

export type InterestDeductionRule = {
  section: "80TTA" | "80TTB";
  ceiling: number;
  /** the interest income this deduction may be set against */
  eligibleInterest: number;
  /** a plain noun phrase for that income, for use mid-sentence */
  covers: string;
  /** the interest that pointedly does not count, where some does not */
  excludes?: string;
};

/**
 * 80TTA or 80TTB, and how much interest there is to claim it against.
 *
 * Both are deductions *of* interest income, not allowances on top of it — you
 * cannot deduct ₹10,000 of savings interest you never declared. The app used
 * to allow exactly that.
 */
export function interestDeductionRule(
  age: number,
  otherSources: OtherSourcesInput,
): InterestDeductionRule {
  const savings = num(otherSources.savingsInterest);
  if (age >= 60) {
    return {
      section: "80TTB",
      ceiling: LIMITS.s80TTB,
      eligibleInterest: savings + num(otherSources.fdInterest),
      covers: "savings and fixed deposit interest",
    };
  }
  return {
    section: "80TTA",
    ceiling: LIMITS.s80TTA,
    eligibleInterest: savings,
    covers: "savings account interest",
    excludes: "fixed deposits do not count, only savings accounts",
  };
}

export function computeChapterVIA(
  d: DeductionInput,
  regime: Regime,
  context: {
    employerNps: number;
    basicSalary: number;
    age: number;
    otherSources: OtherSourcesInput;
    /** needed for the 80G qualifying limit, which is a share of income */
    grossTotalIncome: number;
  },
): { total: number; breakdown: LineItem[] } {
  const { employerNps, basicSalary, age } = context;
  const limits = ageAwareLimits(age);
  const breakdown: LineItem[] = [];

  // 80CCD(2) — employer NPS. Allowed in BOTH regimes; the ceiling differs.
  const npsRate =
    regime === "new" ? LIMITS.s80CCD2_rate_new : LIMITS.s80CCD2_rate_old;
  const npsCap = npsRate * num(basicSalary);
  const nps2 = Math.min(num(employerNps), npsCap);
  if (nps2 > 0) {
    breakdown.push({
      label: "80CCD(2) — employer NPS contribution",
      amount: nps2,
      note: `Capped at ${npsRate * 100}% of basic salary in the ${regime} regime`,
    });
  }

  if (regime === "new") {
    return { total: nps2, breakdown };
  }

  const c80 = Math.min(num(d.s80C), LIMITS.s80C);
  if (c80 > 0)
    breakdown.push({
      label: "80C — EPF, ELSS, life insurance, tuition fees",
      amount: c80,
      note:
        num(d.s80C) > LIMITS.s80C
          ? `You entered ₹${inr(num(d.s80C))}; the ceiling is ₹1,50,000`
          : undefined,
    });

  const ccd1b = Math.min(num(d.s80CCD1B), LIMITS.s80CCD1B);
  if (ccd1b > 0)
    breakdown.push({
      label: "80CCD(1B) — your own NPS contribution",
      amount: ccd1b,
    });

  const dSelf = Math.min(num(d.s80D_self), limits.s80D_self);
  const parentCap = d.s80D_parents_senior
    ? LIMITS.s80D_parents_senior
    : LIMITS.s80D_parents;
  const dParents = Math.min(num(d.s80D_parents), parentCap);
  if (dSelf + dParents > 0)
    breakdown.push({
      label: "80D — health insurance premium",
      amount: dSelf + dParents,
      note: `Self and family up to ₹${inr(limits.s80D_self)}${
        limits.senior ? " (you are a senior citizen)" : ""
      }, parents up to ₹${inr(parentCap)}${
        d.s80D_parents_senior ? " (senior citizen parents)" : ""
      }`,
    });

  const ddb = Math.min(num(d.s80DDB), limits.s80DDB);
  if (ddb > 0)
    breakdown.push({
      label: "80DDB — specified medical treatment",
      amount: ddb,
      note: limits.senior
        ? `Ceiling ₹${inr(limits.s80DDB)} for a senior citizen`
        : undefined,
    });

  const e80 = num(d.s80E);
  if (e80 > 0)
    breakdown.push({
      label: "80E — interest on education loan",
      amount: e80,
      note: "No monetary ceiling; available for 8 assessment years",
    });

  const interestRule = interestDeductionRule(age, context.otherSources);
  const claimedInterest = num(d.s80TTA);
  const tta = Math.min(
    claimedInterest,
    interestRule.ceiling,
    interestRule.eligibleInterest,
  );
  if (tta > 0 || claimedInterest > 0)
    breakdown.push({
      label: `${interestRule.section} — ${
        interestRule.section === "80TTB"
          ? "interest on deposits, senior citizen"
          : "savings bank interest"
      }`,
      amount: tta,
      // Two things can bind, and saying which one did is the whole point of
      // the note: a ceiling you could plan around, or interest you never
      // declared.
      note:
        tta < claimedInterest && interestRule.eligibleInterest <= interestRule.ceiling
          ? `Limited to the ₹${inr(interestRule.eligibleInterest)} of ${interestRule.covers} actually declared in your return`
          : tta < claimedInterest
            ? `Capped at the ₹${inr(interestRule.ceiling)} ceiling — you entered ₹${inr(claimedInterest)}`
            : `Ceiling ₹${inr(interestRule.ceiling)}, covering ${interestRule.covers}${
                interestRule.excludes ? ` — ${interestRule.excludes}` : ""
              }`,
    });

  const eeb = Math.min(num(d.s80EEB), LIMITS.s80EEB);
  if (eeb > 0)
    breakdown.push({ label: "80EEB — electric vehicle loan interest", amount: eeb });

  // 80U is a flat deduction, not a reimbursement of what the disability cost:
  // ₹75,000 on a certified disability and ₹1,25,000 where it is certified
  // severe. Reading it as a free-text amount and capping at the higher figure
  // let anyone with an ordinary certificate claim the severe one.
  const u80 = flatDeduction80U(num(d.s80U));
  if (u80 > 0)
    breakdown.push({
      label: "80U — taxpayer with a disability",
      amount: u80,
      note:
        u80 === LIMITS.s80U_severe
          ? "Flat ₹1,25,000 for a certified severe disability"
          : "Flat ₹75,000; ₹1,25,000 only where the disability is certified severe",
    });

  // 80G comes last because its own ceiling is a share of income measured
  // *after* every other Chapter VI-A deduction has come off.
  const g80 = computeSection80G(
    num(d.s80G),
    d.s80G_fullyDeductible,
    context.grossTotalIncome,
    breakdown.reduce((sum, item) => sum + item.amount, 0),
  );
  if (g80.line) breakdown.push(g80.line);

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
  return { total, breakdown };
}

/** The band a stored 80U figure belongs to. Nothing in between is a claim. */
export function flatDeduction80U(stored: number): number {
  if (stored >= LIMITS.s80U_severe) return LIMITS.s80U_severe;
  if (stored > 0) return LIMITS.s80U_normal;
  return 0;
}

/**
 * Section 80G, which almost nobody gets right by eye.
 *
 * A donation to an ordinary registered institution is not a deduction of what
 * you gave. It is half of what you gave, and only of the part that falls within
 * 10% of your adjusted gross total income — adjusted meaning after every other
 * Chapter VI-A deduction. Give ₹1,00,000 on a ₹6,00,000 adjusted income and the
 * deduction is ₹30,000, not ₹1,00,000.
 *
 * The notified national funds are the exception: 100%, no qualifying limit.
 *
 * ASSUMPTION: the two rarer categories — 50% without a qualifying limit, and
 * 100% subject to one — are not modelled. Every fund here is treated as one of
 * the two common cases, and the UI says which one it is using.
 */
export function computeSection80G(
  donated: number,
  fullyDeductible: boolean,
  grossTotalIncome: number,
  otherChapterVIA: number,
): { amount: number; qualifying: number; adjustedGti: number; line?: LineItem } {
  const amountGiven = clampMin0(num(donated));
  const adjustedGti = clampMin0(num(grossTotalIncome) - clampMin0(otherChapterVIA));

  if (amountGiven <= 0) return { amount: 0, qualifying: 0, adjustedGti };

  if (fullyDeductible) {
    return {
      amount: amountGiven,
      qualifying: amountGiven,
      adjustedGti,
      line: {
        label: "80G — donations to a notified national fund",
        amount: amountGiven,
        note: "Deductible in full, with no qualifying limit",
      },
    };
  }

  const cap = adjustedGti * LIMITS.s80G_qualifyingShareOfIncome;
  const qualifying = Math.min(amountGiven, cap);
  const amount = Math.round(qualifying * LIMITS.s80G_rate_ordinary);

  return {
    amount,
    qualifying,
    adjustedGti,
    line: {
      label: "80G — donations to a registered institution",
      amount,
      note:
        qualifying < amountGiven
          ? `Half of ₹${inr(Math.round(qualifying))} — the part of your ₹${inr(amountGiven)} that falls within 10% of adjusted gross total income`
          : `Half of the ₹${inr(amountGiven)} you gave; the rest of the section is a matter of which fund it was`,
    },
  };
}

/** ------------------------------------------------------------------
 *  Section 87A rebate, including marginal relief under the new regime
 *  ------------------------------------------------------------------ */
export function computeRebate87A(
  totalIncome: number,
  taxBeforeRebate: number,
  regime: Regime,
  slabs: Slab[],
) {
  const rule = REBATE_87A[regime];

  if (totalIncome <= rule.incomeCeiling) {
    return {
      rebate: Math.min(taxBeforeRebate, rule.maxRebate),
      marginalRelief: 0,
    };
  }

  if (!rule.marginalRelief) return { rebate: 0, marginalRelief: 0 };

  // Marginal relief: the tax cannot exceed the income earned above the rebate
  // ceiling. Someone at ₹12,10,000 should not pay more tax than the ₹10,000
  // by which they crossed the line.
  const excessIncome = totalIncome - rule.incomeCeiling;
  const taxAtCeiling = applySlabs(rule.incomeCeiling, slabs).tax;
  const rebateAtCeiling = Math.min(taxAtCeiling, rule.maxRebate);
  const notionalTax = taxAtCeiling - rebateAtCeiling + excessIncome;

  if (taxBeforeRebate > notionalTax) {
    return { rebate: 0, marginalRelief: taxBeforeRebate - notionalTax };
  }

  return { rebate: 0, marginalRelief: 0 };
}

function surchargeRateFor(totalIncome: number, regime: Regime): number {
  let rate = 0;
  for (const band of SURCHARGE_BANDS) {
    if (totalIncome > band.above) rate = band.rate;
  }
  if (regime === "new") rate = Math.min(rate, NEW_REGIME_MAX_SURCHARGE);
  return rate;
}

/**
 * Surcharge, with marginal relief at each threshold. Crossing ₹50,00,000 by
 * ₹10,000 must never cost more than that ₹10,000, so the surcharge is trimmed
 * back until that holds.
 */
function computeSurcharge(
  totalIncome: number,
  tax: number,
  regime: Regime,
  slabs: Slab[],
): number {
  const rate = surchargeRateFor(totalIncome, regime);
  if (rate === 0) return 0;

  let threshold = 0;
  for (const band of SURCHARGE_BANDS) {
    if (totalIncome > band.above) threshold = band.above;
  }

  const surcharge = tax * rate;

  // Tax plus surcharge at the threshold itself, for comparison.
  const taxAtThreshold = applySlabs(threshold, slabs).tax;
  const surchargeAtThreshold =
    taxAtThreshold * surchargeRateFor(threshold, regime);
  const ceiling =
    taxAtThreshold + surchargeAtThreshold + (totalIncome - threshold);

  if (tax + surcharge > ceiling) {
    return Math.max(0, ceiling - tax);
  }
  return surcharge;
}

/** ------------------------------------------------------------------
 *  The whole computation
 *  ------------------------------------------------------------------ */
export function computeTax(
  input: TaxpayerInput,
  regimeOverride?: Regime,
): TaxComputation {
  const regime = regimeOverride ?? input.regime;
  const s = input.salary;

  const grossSalary =
    num(s.basic) +
    num(s.hra) +
    num(s.specialAllowance) +
    num(s.lta) +
    num(s.otherAllowances) +
    num(s.employerNps);

  // --- Exempt allowances (old regime only) ---
  const hraResult = computeHraExemption({
    basic: num(s.basic),
    hraReceived: num(s.hra),
    rentPaidAnnual: num(input.hra.rentPaidAnnual),
    metroCity: input.hra.metroCity,
  });
  const hraExemption =
    regime === "old" && input.hra.claiming ? hraResult.exemption : 0;
  const exemptAllowances = hraExemption;

  const standardDeduction = Math.min(
    STANDARD_DEDUCTION[regime],
    clampMin0(grossSalary - exemptAllowances),
  );
  const professionalTax = regime === "old" ? num(s.professionalTax) : 0;

  const incomeFromSalary = clampMin0(
    grossSalary - exemptAllowances - standardDeduction - professionalTax,
  );

  // --- House property ---
  const hp = computeHouseProperty(input.houseProperty, regime);
  const incomeFromHouseProperty = hp.income;

  // --- Other sources ---
  const o = input.otherSources;
  const incomeFromOtherSources =
    num(o.savingsInterest) + num(o.fdInterest) + num(o.dividend) + num(o.other);

  const grossTotalIncome =
    incomeFromSalary + incomeFromHouseProperty + incomeFromOtherSources;

  // --- Chapter VI-A ---
  const via = computeChapterVIA(input.deductions, regime, {
    employerNps: num(s.employerNps),
    basicSalary: num(s.basic),
    age: input.age,
    otherSources: input.otherSources,
    grossTotalIncome,
  });
  // Chapter VI-A can never take income below zero.
  const chapterVIA = Math.min(via.total, clampMin0(grossTotalIncome));

  const totalIncomeRaw = clampMin0(grossTotalIncome - chapterVIA);
  // Total income is rounded off to the nearest ₹10 (Section 288A).
  const totalIncome = Math.round(totalIncomeRaw / 10) * 10;

  // --- Tax on total income ---
  const slabs = slabsFor(regime, input.age);
  const { tax: taxBeforeRebate, breakdown: slabBreakdown } = applySlabs(
    totalIncome,
    slabs,
  );

  const { rebate: rebate87A, marginalRelief } = computeRebate87A(
    totalIncome,
    taxBeforeRebate,
    regime,
    slabs,
  );

  const taxAfterRebate = clampMin0(taxBeforeRebate - rebate87A - marginalRelief);
  const surcharge = computeSurcharge(totalIncome, taxAfterRebate, regime, slabs);
  const cess = (taxAfterRebate + surcharge) * CESS_RATE;
  const totalTaxLiability = r0(taxAfterRebate + surcharge + cess);

  const tdsCredit = num(s.tdsDeducted) + num(input.tdsOnOtherIncome);
  const advanceTax = num(input.advanceTaxPaid);
  const selfAssessmentTax = num(input.selfAssessmentTaxPaid);

  // Interest and the late-filing fee sit on top of the tax itself, exactly as
  // they do in Part B-TTI of the return, and are part of what is payable.
  const interest = computeInterest({
    totalTaxLiability,
    totalIncome,
    tdsCredit,
    advanceTaxPaid: advanceTax,
    selfAssessmentTaxPaid: selfAssessmentTax,
    advanceTaxSchedule: input.advanceTaxSchedule,
    filedOn: input.filedOn ? new Date(input.filedOn) : new Date(),
  });
  const totalTaxAndInterest = totalTaxLiability + interest.total;

  const balance =
    totalTaxAndInterest - tdsCredit - advanceTax - selfAssessmentTax;

  return {
    regime,
    grossSalary,
    exemptAllowances,
    hraExemption,
    standardDeduction,
    professionalTax,
    incomeFromSalary,
    incomeFromHouseProperty,
    incomeFromOtherSources,
    grossTotalIncome,
    chapterVIA,
    chapterVIABreakdown: via.breakdown,
    totalIncome,
    taxBeforeRebate,
    slabBreakdown,
    rebate87A,
    marginalRelief,
    taxAfterRebate,
    surcharge,
    cess,
    totalTaxLiability,
    interest,
    totalTaxAndInterest,
    tdsCredit,
    advanceTax,
    selfAssessmentTax,
    balance,
    // Balances under ₹10 are ignored on both sides, as in practice.
    refundDue: balance < -10 ? r0(-balance) : 0,
    taxPayable: balance > 10 ? r0(balance) : 0,
    effectiveRate: grossTotalIncome > 0 ? totalTaxLiability / grossTotalIncome : 0,
  };
}

export type RegimeComparison = {
  new: TaxComputation;
  old: TaxComputation;
  recommended: Regime;
  saving: number;
  /** What the old regime is sheltering that the new regime is not */
  oldOnlyBenefit: number;
};

export function compareRegimes(input: TaxpayerInput): RegimeComparison {
  const newR = computeTax(input, "new");
  const oldR = computeTax(input, "old");
  const recommended: Regime =
    oldR.totalTaxLiability < newR.totalTaxLiability ? "old" : "new";
  return {
    new: newR,
    old: oldR,
    recommended,
    saving: Math.abs(newR.totalTaxLiability - oldR.totalTaxLiability),
    oldOnlyBenefit:
      oldR.exemptAllowances +
      oldR.chapterVIA +
      oldR.professionalTax -
      newR.chapterVIA,
  };
}

/**
 * The break-even shelter: how much old-regime-only relief — HRA exemption plus
 * Chapter VI-A deductions — a taxpayer needs before the old regime beats the
 * new one at the same income.
 *
 * Both sides are computed on the same income. The probe strips every
 * old-regime-only shelter and then adds back a single uncapped deduction, so
 * the answer is a clean rupee figure rather than an artefact of which sections
 * happened to be filled in. 80CCD(2) is left alone because it applies in both
 * regimes and is therefore not part of the trade-off.
 */
export function breakEvenDeductions(input: TaxpayerInput): number {
  // The new regime ignores HRA and Chapter VI-A (other than 80CCD(2)), so its
  // tax is the same with or without the probe's changes.
  const newTax = computeTax(input, "new").totalTaxLiability;

  const withShelter = (amount: number): TaxpayerInput => ({
    ...input,
    hra: { ...input.hra, claiming: false },
    deductions: {
      ...input.deductions,
      s80C: 0,
      s80CCD1B: 0,
      s80D_self: 0,
      s80D_parents: 0,
      s80DDB: 0,
      // 80E carries no ceiling, which makes it the right lever for a search.
      s80E: amount,
      s80G: 0,
      s80G_fullyDeductible: false,
      s80TTA: 0,
      s80EEB: 0,
      s80U: 0,
    },
  });

  const ceiling = Math.max(0, computeTax(withShelter(0), "old").grossTotalIncome);
  if (computeTax(withShelter(ceiling), "old").totalTaxLiability > newTax) {
    // Even wiping out the entire income does not get there — no break-even.
    return Number.POSITIVE_INFINITY;
  }

  let lo = 0;
  let hi = ceiling;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    if (computeTax(withShelter(mid), "old").totalTaxLiability > newTax) lo = mid;
    else hi = mid;
  }
  return Math.round(hi / 100) * 100;
}
