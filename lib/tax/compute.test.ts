import { describe, expect, test } from "bun:test";

import {
  ageAwareLimits,
  breakEvenDeductions,
  compareRegimes,
  computeHouseProperty,
  computeHraExemption,
  computeSection80G,
  computeTax,
  flatDeduction80U,
  interestDeductionRule,
  oldRegimeAvailable,
  type DeductionInput,
  type TaxpayerInput,
} from "./compute";
import { FILING_DEADLINE, LIMITS } from "./constants";

/**
 * The tax engine, checked against the Act rather than against itself.
 *
 * Every expected figure here is worked out by hand from the rule it is testing
 * — slab widths, the least of three, a percentage of a ceiling — so a test
 * failing means the arithmetic moved, not that a snapshot went stale.
 *
 * `filedOn` is pinned on every input. Without it `computeTax` dates the
 * interest against today, and this suite would start failing on 16 September
 * 2026 for reasons that have nothing to do with the code.
 */
const FILED_ON = "2026-08-28";

const noDeductions: DeductionInput = {
  s80C: 0,
  s80CCD1B: 0,
  s80D_self: 0,
  s80D_parents: 0,
  s80D_parents_senior: false,
  s80DDB: 0,
  s80E: 0,
  s80G: 0,
  s80G_fullyDeductible: false,
  s80TTA: 0,
  s80EEB: 0,
  s80U: 0,
};

function taxpayer(patch: Partial<TaxpayerInput> = {}): TaxpayerInput {
  return {
    age: 33,
    regime: "new",
    salary: {
      basic: 0,
      hra: 0,
      specialAllowance: 0,
      lta: 0,
      otherAllowances: 0,
      employerNps: 0,
      professionalTax: 0,
      tdsDeducted: 0,
    },
    houseProperty: {
      enabled: false,
      type: "self-occupied",
      annualRentReceived: 0,
      municipalTaxesPaid: 0,
      homeLoanInterest: 0,
    },
    otherSources: { savingsInterest: 0, fdInterest: 0, dividend: 0, other: 0 },
    hra: { claiming: false, rentPaidAnnual: 0, metroCity: false },
    deductions: { ...noDeductions },
    advanceTaxPaid: 0,
    selfAssessmentTaxPaid: 0,
    tdsOnOtherIncome: 0,
    filedOn: FILED_ON,
    ...patch,
  };
}

/** A salary that lands on an exact total income after the standard deduction. */
function salaryFor(totalIncome: number, regime: "new" | "old") {
  const standard = regime === "new" ? 75_000 : 50_000;
  return { basic: totalIncome + standard };
}

describe("slabs", () => {
  test("new regime: ₹12,00,000 is 5% on the third bracket and 10% on the fourth", () => {
    const c = computeTax(
      taxpayer({
        regime: "new",
        salary: { ...taxpayer().salary, ...salaryFor(1_200_000, "new") },
      }),
    );
    expect(c.totalIncome).toBe(1_200_000);
    // 0 on the first ₹4L, 5% of ₹4L, 10% of ₹4L.
    expect(c.taxBeforeRebate).toBe(60_000);
  });

  test("old regime below 60: ₹10,00,000 is 5% then 20%", () => {
    const c = computeTax(
      taxpayer({
        regime: "old",
        salary: { ...taxpayer().salary, ...salaryFor(1_000_000, "old") },
      }),
    );
    // 5% of (5L − 2.5L) = 12,500; 20% of (10L − 5L) = 1,00,000.
    expect(c.taxBeforeRebate).toBe(112_500);
  });

  test("the exemption limit rises at 60 and again at 80", () => {
    const at = (age: number) =>
      computeTax(
        taxpayer({
          age,
          regime: "old",
          salary: { ...taxpayer().salary, ...salaryFor(500_000, "old") },
        }),
      ).taxBeforeRebate;

    expect(at(45)).toBe(12_500); // 5% of ₹2,50,000
    expect(at(64)).toBe(10_000); // 5% of ₹2,00,000
    expect(at(82)).toBe(0); // nothing until ₹5,00,000
  });
});

describe("section 87A", () => {
  test("wipes out the tax exactly at the new regime ceiling", () => {
    const c = computeTax(
      taxpayer({ salary: { ...taxpayer().salary, ...salaryFor(1_200_000, "new") } }),
    );
    expect(c.rebate87A).toBe(60_000);
    expect(c.totalTaxLiability).toBe(0);
  });

  test("marginal relief: ₹10,000 over the line never costs more than ₹10,000", () => {
    const c = computeTax(
      taxpayer({ salary: { ...taxpayer().salary, ...salaryFor(1_210_000, "new") } }),
    );
    // Slab tax is ₹61,500; relief trims it to the ₹10,000 of extra income.
    expect(c.taxBeforeRebate).toBe(61_500);
    expect(c.marginalRelief).toBe(51_500);
    expect(c.taxAfterRebate).toBe(10_000);
    expect(c.totalTaxLiability).toBe(10_400); // plus 4% cess
  });

  test("the old regime rebate stops at ₹5,00,000 and has no marginal relief", () => {
    const under = computeTax(
      taxpayer({
        regime: "old",
        salary: { ...taxpayer().salary, ...salaryFor(500_000, "old") },
      }),
    );
    const over = computeTax(
      taxpayer({
        regime: "old",
        salary: { ...taxpayer().salary, ...salaryFor(510_000, "old") },
      }),
    );
    expect(under.totalTaxLiability).toBe(0);
    expect(over.rebate87A).toBe(0);
    expect(over.marginalRelief).toBe(0);
  });
});

describe("HRA under section 10(13A)", () => {
  test("takes the least of the three legs", () => {
    const r = computeHraExemption({
      basic: 1_000_000,
      hraReceived: 500_000,
      rentPaidAnnual: 300_000,
      metroCity: false,
    });
    // 5,00,000 received · 3,00,000 − 1,00,000 = 2,00,000 · 40% of basic = 4,00,000
    expect(r.exemption).toBe(200_000);
    expect(r.winnerIndex).toBe(1);
  });

  test("the city leg is 50% in a metro and 40% outside one", () => {
    const legs = (metroCity: boolean) =>
      computeHraExemption({
        basic: 1_000_000,
        hraReceived: 900_000,
        rentPaidAnnual: 900_000,
        metroCity,
      }).exemption;

    expect(legs(true)).toBe(500_000);
    expect(legs(false)).toBe(400_000);
  });

  test("no rent paid means no exemption, however much HRA was received", () => {
    expect(
      computeHraExemption({
        basic: 1_000_000,
        hraReceived: 500_000,
        rentPaidAnnual: 0,
        metroCity: true,
      }).exemption,
    ).toBe(0);
  });
});

describe("house property", () => {
  test("self-occupied interest is capped at ₹2,00,000 under the old regime", () => {
    const r = computeHouseProperty(
      {
        enabled: true,
        type: "self-occupied",
        annualRentReceived: 0,
        municipalTaxesPaid: 0,
        homeLoanInterest: 300_000,
      },
      "old",
    );
    expect(r.income).toBe(-200_000);
  });

  test("and is not allowed at all under the new regime", () => {
    const r = computeHouseProperty(
      {
        enabled: true,
        type: "self-occupied",
        annualRentReceived: 0,
        municipalTaxesPaid: 0,
        homeLoanInterest: 300_000,
      },
      "new",
    );
    expect(r.income).toBe(0);
  });

  test("let-out: 30% of net annual value, then interest", () => {
    const r = computeHouseProperty(
      {
        enabled: true,
        type: "let-out",
        annualRentReceived: 600_000,
        municipalTaxesPaid: 20_000,
        homeLoanInterest: 200_000,
      },
      "old",
    );
    // NAV 5,80,000 − 30% (1,74,000) − 2,00,000 interest
    expect(r.income).toBe(206_000);
  });

  test("a let-out loss is capped at ₹2,00,000 old, and disallowed new", () => {
    const property = {
      enabled: true,
      type: "let-out" as const,
      annualRentReceived: 200_000,
      municipalTaxesPaid: 0,
      homeLoanInterest: 800_000,
    };
    // NAV 2,00,000 − 60,000 − 8,00,000 = −6,60,000
    const old = computeHouseProperty(property, "old");
    expect(old.rawIncome).toBe(-660_000);
    expect(old.income).toBe(-200_000);
    expect(old.setOffCapped).toBe(true);

    expect(computeHouseProperty(property, "new").income).toBe(0);
  });
});

describe("Chapter VI-A ceilings", () => {
  test("80C stops at ₹1,50,000", () => {
    const c = computeTax(
      taxpayer({
        regime: "old",
        salary: { ...taxpayer().salary, ...salaryFor(1_000_000, "old") },
        deductions: { ...noDeductions, s80C: 400_000 },
      }),
    );
    expect(c.chapterVIA).toBe(LIMITS.s80C);
  });

  test("80CCD(2) survives into the new regime at 14% of basic, 10% in the old", () => {
    const withNps = (regime: "new" | "old") =>
      computeTax(
        taxpayer({
          regime,
          salary: { ...taxpayer().salary, basic: 1_000_000, employerNps: 300_000 },
        }),
      ).chapterVIA;

    expect(withNps("new")).toBe(140_000);
    expect(withNps("old")).toBe(100_000);
  });

  test("Chapter VI-A can never take total income below zero", () => {
    const c = computeTax(
      taxpayer({
        regime: "old",
        salary: { ...taxpayer().salary, basic: 300_000 },
        deductions: { ...noDeductions, s80C: 150_000, s80E: 900_000 },
      }),
    );
    expect(c.totalIncome).toBe(0);
    expect(c.totalTaxLiability).toBe(0);
  });
});

describe("the ceilings that move with age", () => {
  test("80D for yourself doubles at 60", () => {
    expect(ageAwareLimits(59).s80D_self).toBe(LIMITS.s80D_self);
    expect(ageAwareLimits(60).s80D_self).toBe(LIMITS.s80D_self_senior);
  });

  test("80DDB rises from ₹40,000 to ₹1,00,000 at 60", () => {
    expect(ageAwareLimits(59).s80DDB).toBe(LIMITS.s80DDB);
    expect(ageAwareLimits(60).s80DDB).toBe(LIMITS.s80DDB_senior);
  });

  test("80TTA becomes 80TTB at 60, and starts covering deposits", () => {
    const interest = {
      savingsInterest: 9_000,
      fdInterest: 48_000,
      dividend: 0,
      other: 0,
    };
    const young = interestDeductionRule(33, interest);
    const senior = interestDeductionRule(64, interest);

    expect(young.section).toBe("80TTA");
    expect(young.ceiling).toBe(10_000);
    expect(young.eligibleInterest).toBe(9_000); // savings only

    expect(senior.section).toBe("80TTB");
    expect(senior.ceiling).toBe(50_000);
    expect(senior.eligibleInterest).toBe(57_000); // savings and deposits
  });

  test("neither can exceed the interest actually declared", () => {
    const c = computeTax(
      taxpayer({
        regime: "old",
        salary: { ...taxpayer().salary, basic: 1_000_000 },
        otherSources: {
          savingsInterest: 3_000,
          fdInterest: 0,
          dividend: 0,
          other: 0,
        },
        deductions: { ...noDeductions, s80TTA: 25_000 },
      }),
    );
    // Claimed ₹25,000, ceiling ₹10,000, but only ₹3,000 of savings interest
    // is in the return — so ₹3,000 is all that can come off it.
    expect(c.chapterVIA).toBe(3_000);
  });
});

describe("section 80G", () => {
  test("an ordinary institution is half, within 10% of adjusted income", () => {
    const r = computeSection80G(100_000, false, 750_000, 150_000);
    expect(r.adjustedGti).toBe(600_000);
    expect(r.qualifying).toBe(60_000); // the 10% ceiling bites
    expect(r.amount).toBe(30_000); // half of what qualifies
  });

  test("a donation inside the ceiling is still only half", () => {
    const r = computeSection80G(20_000, false, 750_000, 150_000);
    expect(r.qualifying).toBe(20_000);
    expect(r.amount).toBe(10_000);
  });

  test("a notified national fund is allowed in full, with no ceiling", () => {
    const r = computeSection80G(500_000, true, 750_000, 150_000);
    expect(r.amount).toBe(500_000);
  });

  test("the qualifying limit is measured after the other deductions", () => {
    const withOthers = computeSection80G(200_000, false, 1_000_000, 200_000);
    const withoutOthers = computeSection80G(200_000, false, 1_000_000, 0);
    // 10% of 8,00,000 against 10% of 10,00,000, halved either way.
    expect(withOthers.amount).toBe(40_000);
    expect(withoutOthers.amount).toBe(50_000);
  });
});

describe("section 80U", () => {
  test("is flat: one figure or the other, nothing in between", () => {
    expect(flatDeduction80U(0)).toBe(0);
    expect(flatDeduction80U(1)).toBe(LIMITS.s80U_normal);
    expect(flatDeduction80U(75_000)).toBe(LIMITS.s80U_normal);
    expect(flatDeduction80U(124_999)).toBe(LIMITS.s80U_normal);
    expect(flatDeduction80U(125_000)).toBe(LIMITS.s80U_severe);
    expect(flatDeduction80U(900_000)).toBe(LIMITS.s80U_severe);
  });
});

describe("surcharge, cess and rounding", () => {
  test("cess is 4% of tax plus surcharge", () => {
    const c = computeTax(
      taxpayer({ salary: { ...taxpayer().salary, ...salaryFor(1_210_000, "new") } }),
    );
    expect(c.cess).toBeCloseTo((c.taxAfterRebate + c.surcharge) * 0.04, 6);
  });

  test("total income is rounded to the nearest ₹10 under section 288A", () => {
    const c = computeTax(
      taxpayer({ salary: { ...taxpayer().salary, basic: 1_275_004 } }),
    );
    expect(c.totalIncome % 10).toBe(0);
  });

  test("surcharge does not start below ₹50,00,000", () => {
    const c = computeTax(
      taxpayer({ salary: { ...taxpayer().salary, ...salaryFor(4_900_000, "new") } }),
    );
    expect(c.surcharge).toBe(0);
  });

  test("crossing ₹50,00,000 by ₹20,000 never costs more than the ₹20,000", () => {
    const under = computeTax(
      taxpayer({ salary: { ...taxpayer().salary, ...salaryFor(5_000_000, "new") } }),
    );
    const over = computeTax(
      taxpayer({ salary: { ...taxpayer().salary, ...salaryFor(5_020_000, "new") } }),
    );
    expect(over.totalTaxLiability - under.totalTaxLiability).toBeLessThanOrEqual(
      20_000 * 1.04,
    );
  });

  test("the new regime caps surcharge at 25%", () => {
    const c = computeTax(
      taxpayer({ salary: { ...taxpayer().salary, ...salaryFor(60_000_000, "new") } }),
    );
    expect(c.surcharge / c.taxAfterRebate).toBeCloseTo(0.25, 4);
  });
});

describe("the regime comparison", () => {
  test("both sides are computed on the same income", () => {
    const input = taxpayer({
      salary: { ...taxpayer().salary, basic: 1_200_000, hra: 400_000 },
      hra: { claiming: true, rentPaidAnnual: 300_000, metroCity: false },
      deductions: { ...noDeductions, s80C: 150_000 },
    });
    const comparison = compareRegimes(input);
    expect(comparison.new.grossSalary).toBe(comparison.old.grossSalary);
    expect(comparison.recommended).toBe(
      comparison.old.totalTaxLiability < comparison.new.totalTaxLiability
        ? "old"
        : "new",
    );
    expect(comparison.saving).toBe(
      Math.abs(
        comparison.new.totalTaxLiability - comparison.old.totalTaxLiability,
      ),
    );
  });

  test("the break-even shelter really does break even", () => {
    const input = taxpayer({
      salary: { ...taxpayer().salary, basic: 1_800_000 },
    });
    const shelter = breakEvenDeductions(input);
    expect(Number.isFinite(shelter)).toBe(true);

    const withShelter = (amount: number) =>
      computeTax({ ...input, deductions: { ...noDeductions, s80E: amount } }, "old")
        .totalTaxLiability;
    const newTax = computeTax(input, "new").totalTaxLiability;

    // At the break-even the old regime has caught up; a little under, it has not.
    expect(withShelter(shelter)).toBeLessThanOrEqual(newTax);
    expect(withShelter(shelter - 20_000)).toBeGreaterThan(newTax);
  });
});

describe("section 115BAC(6)", () => {
  test("the old regime closes the day after the due date", () => {
    expect(oldRegimeAvailable(new Date(FILING_DEADLINE))).toBe(true);
    expect(oldRegimeAvailable(new Date("2026-09-14"))).toBe(true);
    expect(oldRegimeAvailable(new Date("2026-09-16"))).toBe(false);
  });
});

describe("what is payable", () => {
  test("credit beyond the bill is a refund, and a shortfall is payable", () => {
    const refund = computeTax(
      taxpayer({
        salary: { ...taxpayer().salary, basic: 1_500_000, tdsDeducted: 300_000 },
      }),
    );
    expect(refund.refundDue).toBeGreaterThan(0);
    expect(refund.taxPayable).toBe(0);

    const payable = computeTax(
      taxpayer({
        salary: { ...taxpayer().salary, basic: 1_500_000, tdsDeducted: 10_000 },
      }),
    );
    expect(payable.taxPayable).toBeGreaterThan(0);
    expect(payable.refundDue).toBe(0);
  });

  test("what is payable includes the interest, not just the tax", () => {
    const c = computeTax(
      taxpayer({
        salary: { ...taxpayer().salary, basic: 1_800_000, tdsDeducted: 60_000 },
      }),
    );
    expect(c.interest.total).toBeGreaterThan(0);
    expect(c.totalTaxAndInterest).toBe(c.totalTaxLiability + c.interest.total);
    expect(c.taxPayable).toBe(
      c.totalTaxAndInterest - c.tdsCredit - c.advanceTax - c.selfAssessmentTax,
    );
  });
});
