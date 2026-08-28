import {
  ADVANCE_TAX_INSTALMENTS,
  AY_START,
  FILING_DEADLINE,
  INTEREST_RATE_PER_MONTH,
  LATE_FEE_234F,
} from "./constants";

/**
 * Interest and fee for paying late — sections 234A, 234B, 234C and 234F.
 *
 * These are the charges that turn a small shortfall into a bigger one, and the
 * ones a salaried taxpayer never sees coming: nobody deducted them, so nothing
 * on a Form 16 hints at them. Everything here is arithmetic on the same
 * computation the rest of the app uses — no figure is assumed.
 */

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
const clampMin0 = (n: number) => (n > 0 ? n : 0);

/**
 * Rule 119A: interest runs on the amount rounded down to a multiple of ₹100.
 * On a ₹6,340 shortfall the interest is charged on ₹6,300.
 */
export function roundedForInterest(amount: number): number {
  return Math.floor(clampMin0(amount) / 100) * 100;
}

/**
 * "A month or part of a month" — 1 April to 15 July is four months, not three
 * and a half. Whole months are counted first and any spare days add one more.
 */
export function monthsOrPart(from: Date, to: Date): number {
  if (to <= from) return 0;
  const whole =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  const extra = to.getDate() > from.getDate() ? 1 : 0;
  return Math.max(1, whole + extra);
}

export type InterestInput = {
  /** tax including surcharge and cess, before any credit */
  totalTaxLiability: number;
  /** total income, for the section 234F band */
  totalIncome: number;
  tdsCredit: number;
  advanceTaxPaid: number;
  selfAssessmentTaxPaid: number;
  /**
   * Cumulative advance tax actually paid by each of the four instalment dates.
   * When it is not known, the whole amount is treated as having arrived at the
   * last instalment — the worst case, and the one the UI says out loud.
   */
  advanceTaxSchedule?: number[];
  /** the date the return is, or would be, filed */
  filedOn: Date;
};

export type InterestLeg = {
  label: string;
  /** the amount interest is charged on, after Rule 119A rounding */
  on: number;
  months: number;
  amount: number;
  note?: string;
};

export type InterestCharge = {
  section: "234A" | "234B" | "234C" | "234F";
  title: string;
  amount: number;
  /** the sentence that explains the figure, including when it is nil */
  reason: string;
  legs: InterestLeg[];
};

export type InterestResult = {
  charges: InterestCharge[];
  total: number;
  /** true when the return is being filed after the due date */
  late: boolean;
  daysLate: number;
  /** true when instalment dates were assumed rather than recorded */
  scheduleAssumed: boolean;
  /** tax due on the returned income — the base for 234B and 234C */
  assessedTax: number;
};

/**
 * Section 234A — interest for filing after the due date, on whatever tax is
 * still unpaid at that point.
 */
function compute234A(
  input: InterestInput,
  deadline: Date,
  unpaid: number,
): InterestCharge {
  if (input.filedOn <= deadline) {
    return {
      section: "234A",
      title: "Interest for filing late",
      amount: 0,
      reason: "Nil — the return is being filed on or before the due date.",
      legs: [],
    };
  }
  const months = monthsOrPart(deadline, input.filedOn);
  const on = roundedForInterest(unpaid);
  const amount = Math.round(on * INTEREST_RATE_PER_MONTH * months);
  return {
    section: "234A",
    title: "Interest for filing late",
    amount,
    reason:
      on > 0
        ? `1% a month on the tax still unpaid, for ${months} month${
            months === 1 ? "" : "s"
          } past the due date.`
        : "Nil — nothing was left unpaid when the due date passed.",
    legs:
      on > 0
        ? [{ label: "Tax unpaid at the due date", on, months, amount }]
        : [],
  };
}

/**
 * Section 234B — interest where advance tax and TDS together covered less than
 * 90% of the year's tax, running from the first day of the assessment year.
 */
function compute234B(input: InterestInput, assessedTax: number): InterestCharge {
  const paid = num(input.advanceTaxPaid);
  if (assessedTax <= 0 || paid >= 0.9 * assessedTax) {
    return {
      section: "234B",
      title: "Interest for short-paying advance tax",
      amount: 0,
      reason:
        assessedTax <= 0
          ? "Nil — tax deducted at source already covers the whole bill."
          : "Nil — at least 90% of the bill was covered before the year ended.",
      legs: [],
    };
  }
  const months = monthsOrPart(new Date(AY_START), input.filedOn);
  const on = roundedForInterest(assessedTax - paid);
  const amount = Math.round(on * INTEREST_RATE_PER_MONTH * months);
  return {
    section: "234B",
    title: "Interest for short-paying advance tax",
    amount,
    reason: `More than a tenth of the bill was still open when the year ended, so 1% a month runs from 1 April ${new Date(
      AY_START,
    ).getFullYear()} until the day you file.`,
    legs: [
      { label: "Shortfall carried into the assessment year", on, months, amount },
    ],
  };
}

/**
 * Section 234C — interest for reaching each advance tax instalment date with
 * less paid than that date required, charged separately at all four.
 */
function compute234C(input: InterestInput, assessedTax: number): InterestCharge {
  if (assessedTax <= 0) {
    return {
      section: "234C",
      title: "Interest for paying instalments late",
      amount: 0,
      reason: "Nil — there was no advance tax to pay during the year.",
      legs: [],
    };
  }

  const schedule = input.advanceTaxSchedule;
  const last = ADVANCE_TAX_INSTALMENTS.length - 1;
  const legs: InterestLeg[] = [];

  ADVANCE_TAX_INSTALMENTS.forEach((instalment, i) => {
    const required = assessedTax * instalment.cumulative;
    const accepted = assessedTax * instalment.relaxed;
    // Without recorded dates, nothing is treated as having been paid until the
    // final instalment.
    const paidBy = schedule
      ? num(schedule[i])
      : i === last
        ? num(input.advanceTaxPaid)
        : 0;

    if (paidBy >= accepted) return;
    const on = roundedForInterest(required - paidBy);
    if (on <= 0) return;

    legs.push({
      label: `${instalment.label} — ${Math.round(
        instalment.cumulative * 100,
      )}% of the year's tax was due by then`,
      on,
      months: instalment.months,
      amount: Math.round(on * INTEREST_RATE_PER_MONTH * instalment.months),
      note:
        instalment.relaxed < instalment.cumulative
          ? `Paying ${Math.round(
              instalment.relaxed * 100,
            )}% by this date would have avoided it entirely`
          : undefined,
    });
  });

  const amount = legs.reduce((sum, leg) => sum + leg.amount, 0);
  return {
    section: "234C",
    title: "Interest for paying instalments late",
    amount,
    reason:
      amount > 0
        ? "Advance tax is due in four instalments across the year, and every date that went by underpaid carries its own interest."
        : "Nil — every instalment date was met.",
    legs,
  };
}

/** Section 234F — the flat fee for filing after the due date. */
function compute234F(input: InterestInput, deadline: Date): InterestCharge {
  if (input.filedOn <= deadline) {
    return {
      section: "234F",
      title: "Late filing fee",
      amount: 0,
      reason: "Nil — the return is being filed on or before the due date.",
      legs: [],
    };
  }
  const reduced = num(input.totalIncome) <= LATE_FEE_234F.reducedUpTo;
  return {
    section: "234F",
    title: "Late filing fee",
    amount: reduced ? LATE_FEE_234F.reduced : LATE_FEE_234F.standard,
    reason: reduced
      ? "A flat fee, reduced because total income is at or below ₹5,00,000."
      : "A flat fee for filing after the due date, whatever the tax position.",
    legs: [],
  };
}

export function computeInterest(input: InterestInput): InterestResult {
  const deadline = new Date(FILING_DEADLINE);
  const assessedTax = clampMin0(
    num(input.totalTaxLiability) - num(input.tdsCredit),
  );
  const unpaid = clampMin0(
    num(input.totalTaxLiability) -
      num(input.tdsCredit) -
      num(input.advanceTaxPaid) -
      num(input.selfAssessmentTaxPaid),
  );

  const charges = [
    compute234A(input, deadline, unpaid),
    compute234B(input, assessedTax),
    compute234C(input, assessedTax),
    compute234F(input, deadline),
  ];

  const msLate = input.filedOn.getTime() - deadline.getTime();

  return {
    charges,
    total: charges.reduce((sum, charge) => sum + charge.amount, 0),
    late: msLate > 0,
    daysLate: msLate > 0 ? Math.ceil(msLate / 86_400_000) : 0,
    scheduleAssumed: !input.advanceTaxSchedule && num(input.advanceTaxPaid) > 0,
    assessedTax,
  };
}
