import { describe, expect, test } from "bun:test";

import {
  computeInterest,
  monthsOrPart,
  roundedForInterest,
  type InterestInput,
} from "./interest";
import { LATE_FEE_234F } from "./constants";

/**
 * Sections 234A, 234B, 234C and 234F.
 *
 * The figures are worked out from the rule: 1% a month on an amount rounded
 * down to a multiple of ₹100, counted in whole-or-part months, with 234C
 * charged separately at each of the four instalment dates.
 */

const ON_TIME = new Date("2026-08-28"); // before the 15 September due date
const LATE = new Date("2026-12-20");

function input(patch: Partial<InterestInput> = {}): InterestInput {
  return {
    totalTaxLiability: 0,
    totalIncome: 1_000_000,
    tdsCredit: 0,
    advanceTaxPaid: 0,
    selfAssessmentTaxPaid: 0,
    filedOn: ON_TIME,
    ...patch,
  };
}

const charge = (r: ReturnType<typeof computeInterest>, section: string) =>
  r.charges.find((c) => c.section === section)!;

describe("Rule 119A rounding", () => {
  test("rounds the base down to a multiple of ₹100", () => {
    expect(roundedForInterest(6_340)).toBe(6_300);
    expect(roundedForInterest(6_300)).toBe(6_300);
    expect(roundedForInterest(99)).toBe(0);
  });

  test("never goes negative", () => {
    expect(roundedForInterest(-5_000)).toBe(0);
  });
});

describe("a month or part of a month", () => {
  test("spare days count as a whole month", () => {
    expect(monthsOrPart(new Date("2026-04-01"), new Date("2026-07-15"))).toBe(4);
  });

  test("an exact run of months does not round up", () => {
    expect(monthsOrPart(new Date("2026-04-01"), new Date("2026-07-01"))).toBe(3);
  });

  test("five days past a due date is one month", () => {
    expect(monthsOrPart(new Date("2026-09-15"), new Date("2026-09-20"))).toBe(1);
  });

  test("nothing accrues before the start", () => {
    expect(monthsOrPart(new Date("2026-09-15"), new Date("2026-09-15"))).toBe(0);
    expect(monthsOrPart(new Date("2026-09-15"), new Date("2026-08-01"))).toBe(0);
  });
});

describe("section 234A — filing late", () => {
  test("is nil on a return filed by the due date", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 200_000, tdsCredit: 50_000 }),
    );
    expect(charge(r, "234A").amount).toBe(0);
    expect(r.late).toBe(false);
  });

  test("charges 1% a month on the tax still unpaid", () => {
    const r = computeInterest(
      input({
        totalTaxLiability: 139_984,
        tdsCredit: 60_000,
        filedOn: LATE,
      }),
    );
    // Unpaid ₹79,984 → ₹79,900 after rounding, four months past 15 September.
    expect(charge(r, "234A").amount).toBe(3_196);
    expect(r.late).toBe(true);
  });

  test("is nil for a late filer who owes nothing", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 100_000, tdsCredit: 150_000, filedOn: LATE }),
    );
    expect(charge(r, "234A").amount).toBe(0);
  });
});

describe("section 234B — short-paying advance tax", () => {
  test("is nil when TDS already covers the bill", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 100_000, tdsCredit: 120_000 }),
    );
    expect(charge(r, "234B").amount).toBe(0);
  });

  test("is nil when at least 90% was covered", () => {
    const r = computeInterest(
      input({
        totalTaxLiability: 200_000,
        tdsCredit: 100_000,
        advanceTaxPaid: 90_000, // 90% of the ₹1,00,000 assessed tax
      }),
    );
    expect(charge(r, "234B").amount).toBe(0);
  });

  test("runs from 1 April at 1% a month on the shortfall", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 139_984, tdsCredit: 60_000 }),
    );
    // ₹79,900 × 1% × 5 months (April to August inclusive).
    expect(charge(r, "234B").amount).toBe(3_995);
  });

  test("grows the longer the return is left unfiled", () => {
    const at = (filedOn: Date) =>
      charge(
        computeInterest(
          input({ totalTaxLiability: 139_984, tdsCredit: 60_000, filedOn }),
        ),
        "234B",
      ).amount;

    expect(at(LATE)).toBeGreaterThan(at(ON_TIME));
  });
});

describe("section 234C — the instalment calendar", () => {
  test("charges each missed date separately when nothing was paid", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 139_984, tdsCredit: 60_000 }),
    );
    const c = charge(r, "234C");
    expect(c.legs.length).toBe(4);
    // 15% of ₹79,984 = ₹11,997 → ₹11,900 × 1% × 3 months
    expect(c.legs[0].amount).toBe(357);
    // 45% → ₹35,900 × 1% × 3
    expect(c.legs[1].amount).toBe(1_077);
    // 75% → ₹59,900 × 1% × 3
    expect(c.legs[2].amount).toBe(1_797);
    // 100% → ₹79,900 × 1% × 1
    expect(c.legs[3].amount).toBe(799);
    expect(c.amount).toBe(4_030);
  });

  test("is nil when every instalment was met", () => {
    const r = computeInterest(
      input({
        totalTaxLiability: 139_984,
        tdsCredit: 60_000,
        advanceTaxPaid: 79_984,
        advanceTaxSchedule: [12_000, 36_000, 60_000, 79_984],
      }),
    );
    expect(charge(r, "234C").amount).toBe(0);
  });

  test("paying it all in March still costs the three dates that were missed", () => {
    const r = computeInterest(
      input({
        totalTaxLiability: 139_984,
        tdsCredit: 60_000,
        advanceTaxPaid: 79_984,
        advanceTaxSchedule: [0, 0, 0, 79_984],
      }),
    );
    const c = charge(r, "234C");
    expect(c.legs.length).toBe(3);
    expect(c.amount).toBe(357 + 1_077 + 1_797);
  });

  test("the 12% and 36% provisos are accepted without interest", () => {
    const assessed = 100_000;
    const r = computeInterest(
      input({
        totalTaxLiability: assessed,
        tdsCredit: 0,
        advanceTaxPaid: 36_000,
        // Exactly 12% by 15 June and 36% by 15 September.
        advanceTaxSchedule: [12_000, 36_000, 36_000, 36_000],
      }),
    );
    const c = charge(r, "234C");
    // The first two dates are forgiven; December and March are not.
    expect(c.legs.length).toBe(2);
    expect(c.legs[0].label).toContain("15 December");
  });

  test("is nil when there was no advance tax to pay", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 100_000, tdsCredit: 100_000 }),
    );
    expect(charge(r, "234C").amount).toBe(0);
  });

  test("says so when the instalment dates were assumed rather than recorded", () => {
    const assumed = computeInterest(
      input({
        totalTaxLiability: 139_984,
        tdsCredit: 60_000,
        advanceTaxPaid: 20_000,
      }),
    );
    const recorded = computeInterest(
      input({
        totalTaxLiability: 139_984,
        tdsCredit: 60_000,
        advanceTaxPaid: 20_000,
        advanceTaxSchedule: [5_000, 10_000, 15_000, 20_000],
      }),
    );
    expect(assumed.scheduleAssumed).toBe(true);
    expect(recorded.scheduleAssumed).toBe(false);
  });
});

describe("section 234F — the late filing fee", () => {
  test("is nil on a return filed by the due date", () => {
    expect(charge(computeInterest(input()), "234F").amount).toBe(0);
  });

  test("is a flat fee that applies even to a refund", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 10_000, tdsCredit: 200_000, filedOn: LATE }),
    );
    expect(charge(r, "234F").amount).toBe(LATE_FEE_234F.standard);
  });

  test("is reduced at or below ₹5,00,000 of total income", () => {
    const small = computeInterest(
      input({ totalIncome: 500_000, filedOn: LATE }),
    );
    const large = computeInterest(
      input({ totalIncome: 500_001, filedOn: LATE }),
    );
    expect(charge(small, "234F").amount).toBe(LATE_FEE_234F.reduced);
    expect(charge(large, "234F").amount).toBe(LATE_FEE_234F.standard);
  });
});

describe("what waiting costs", () => {
  test("only 234B accrues while the return is still in time", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 139_984, tdsCredit: 60_000 }),
    );
    // 1% of ₹79,900, once.
    expect(r.accruesPerMonth).toBe(799);
  });

  test("234A joins it once the due date has gone", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 139_984, tdsCredit: 60_000, filedOn: LATE }),
    );
    expect(r.accruesPerMonth).toBe(1_598);
  });

  test("nothing accrues for someone owed a refund", () => {
    const r = computeInterest(
      input({ totalTaxLiability: 100_000, tdsCredit: 250_000 }),
    );
    expect(r.accruesPerMonth).toBe(0);
    expect(r.total).toBe(0);
  });
});
