import { deductionEvidence } from "./seed";
import type { DeductionInput, OtherSourcesInput } from "@/lib/tax/compute";
import { interestDeductionRule } from "@/lib/tax/compute";
import { LIMITS } from "@/lib/tax/constants";

/**
 * The guided-discovery script for the deductions workspace.
 *
 * The premise: most people do not know which section their spending falls
 * under, but they do know what they spent money on. So the platform asks about
 * life, not about the Act, and maps the answer to a section itself.
 */
export type DiscoveryQuestion = {
  id: string;
  question: string;
  why: string;
  section: keyof DeductionInput;
  sectionLabel: string;
  /** the amount this taxpayer would answer with, offered as a shortcut */
  suggested: number;
  suggestedLabel: string;
  ceiling?: number;
  followUp?: string;
  /**
   * A yes/no asked alongside the amount, where the answer changes what the
   * amount is actually worth. Two of these exist in the Act and neither could
   * be reached from the guided flow before: whether your parents are seniors,
   * which doubles the 80D ceiling, and whether a donation went to a notified
   * national fund, which is the difference between all of it and half of it.
   */
  toggle?: {
    section: keyof DeductionInput;
    label: string;
    description: string;
  };
  /** only asked when the taxpayer is on, or considering, the old regime */
  oldRegimeOnly: boolean;
};

export const discoveryQuestions: DiscoveryQuestion[] = [
  {
    id: "epf",
    question: "Does money come out of your salary every month for provident fund?",
    why: "Your own share of EPF is a deduction you already made without noticing. For most salaried people it is the single largest thing in 80C, and many leave it unclaimed because it never felt like an investment.",
    section: "s80C",
    sectionLabel: "80C",
    suggested:
      deductionEvidence.epfEmployeeShare +
      deductionEvidence.elss +
      deductionEvidence.lifeInsurance +
      deductionEvidence.homeLoanPrincipal,
    suggestedLabel:
      "EPF, ELSS, life insurance premium and home loan principal, added together",
    ceiling: 150_000,
    followUp:
      "Life insurance premiums, ELSS mutual funds, your children's tuition fees, PPF and the principal part of a home loan all go in the same ₹1,50,000 bucket.",
    oldRegimeOnly: true,
  },
  {
    id: "nps",
    question: "Do you put your own money into the National Pension System?",
    why: "NPS has a second, separate deduction of up to ₹50,000 that sits on top of the ₹1,50,000 limit. It is the only easy way to get past that ceiling.",
    section: "s80CCD1B",
    sectionLabel: "80CCD(1B)",
    suggested: deductionEvidence.npsSelfContribution,
    suggestedLabel: "Your own NPS contribution for the year",
    ceiling: 50_000,
    followUp:
      "Your employer's contribution is a different section — 80CCD(2) — and it is already counted for you. This one is only what you paid in yourself.",
    oldRegimeOnly: true,
  },
  {
    id: "health-self",
    question: "Do you pay for health insurance for yourself or your family?",
    why: "Health cover for you, your spouse and your children is deductible up to ₹25,000. Preventive health check-ups count within that, and they are the one thing here you can pay for in cash.",
    section: "s80D_self",
    sectionLabel: "80D",
    suggested: deductionEvidence.healthInsuranceSelf,
    suggestedLabel: "Premium for your own family cover",
    ceiling: 25_000,
    oldRegimeOnly: true,
  },
  {
    id: "health-parents",
    question: "Do you pay for your parents' health insurance?",
    why: "This is a separate limit from your own cover — another ₹25,000, or ₹50,000 if either parent is 60 or older. It does not matter whether they live with you or are dependent on you.",
    section: "s80D_parents",
    sectionLabel: "80D (parents)",
    suggested: deductionEvidence.healthInsuranceParents,
    suggestedLabel: "Premium for your parents' cover",
    ceiling: 50_000,
    followUp:
      "If your parents are senior citizens and have no insurance at all, medical expenses you paid for them can be claimed instead, up to the same ₹50,000.",
    toggle: {
      section: "s80D_parents_senior",
      label: "At least one of my parents is 60 or older",
      description: "Raises the ceiling on this answer from ₹25,000 to ₹50,000.",
    },
    oldRegimeOnly: true,
  },
  {
    id: "savings-interest",
    question: "Do you have a savings bank account?",
    why: "The first ₹10,000 of savings account interest is deductible. Nearly everyone qualifies and nearly nobody claims it, because the interest is small enough to forget.",
    section: "s80TTA",
    sectionLabel: "80TTA",
    suggested: 0, // filled from the taxpayer's actual declared interest
    suggestedLabel: "The savings interest you have declared",
    ceiling: 10_000,
    followUp:
      "Fixed deposit interest does not count here. If you are 60 or older, section 80TTB replaces this with a more generous ₹50,000 that does include deposits.",
    oldRegimeOnly: true,
  },
  {
    id: "education-loan",
    question: "Are you repaying an education loan, for yourself or your children?",
    why: "The interest portion has no ceiling at all — whatever you paid, you deduct. It runs for eight years from when repayment starts.",
    section: "s80E",
    sectionLabel: "80E",
    suggested: deductionEvidence.educationLoanInterest,
    suggestedLabel: "Interest paid this year",
    oldRegimeOnly: true,
  },
  {
    id: "donations",
    question: "Did you donate to a charity or a relief fund this year?",
    why: "This is the section people most often overestimate. A donation to an ordinary registered institution is not deducted in full — it is half of what you gave, and only of the part that falls within 10% of your income after every other deduction. The notified national funds are the exception, and are allowed in full.",
    section: "s80G",
    sectionLabel: "80G",
    suggested: deductionEvidence.donations80G,
    suggestedLabel: "Eligible donations",
    followUp: `Anything above ₹${LIMITS.s80G_cashCeiling.toLocaleString(
      "en-IN",
    )} has to have been paid other than in cash to count at all.`,
    toggle: {
      section: "s80G_fullyDeductible",
      label: "This went to a notified national fund",
      description:
        "The PM National Relief Fund, the National Defence Fund and the like — deductible in full, with no ceiling. An ordinary registered trust is not one of these.",
    },
    oldRegimeOnly: true,
  },
  {
    id: "ev-loan",
    question: "Do you have a loan on an electric vehicle?",
    why: "Interest on a loan taken to buy an electric vehicle is deductible up to ₹1,50,000 under section 80EEB, for loans sanctioned up to March 2023.",
    section: "s80EEB",
    sectionLabel: "80EEB",
    suggested: deductionEvidence.evLoanInterest,
    suggestedLabel: "Interest paid this year",
    ceiling: 150_000,
    oldRegimeOnly: true,
  },
];

/**
 * The script, adjusted for who is answering it.
 *
 * Two things are not knowable when the questions are written down: how much
 * interest this taxpayer actually declared — the deduction cannot exceed it —
 * and whether they are 60 or over, which replaces 80TTA with the far more
 * generous 80TTB. Both are settled here so every screen and the copilot ask
 * the same question.
 */
export function discoveryQuestionsFor(
  age: number,
  otherSources: OtherSourcesInput,
  /**
   * false when nothing is filed against this PAN. Every `suggested` figure in
   * the script belongs to the seeded taxpayer — offering "Yes — ₹1,50,000" to
   * someone whose 80C the platform knows nothing about is the same fabrication
   * as importing a Form 16 that is not theirs.
   */
  hasDocuments = true,
): DiscoveryQuestion[] {
  const rule = interestDeductionRule(age, otherSources);
  return discoveryQuestions.map((q) => {
    if (q.id !== "savings-interest") {
      return hasDocuments
        ? q
        : { ...q, suggested: 0, suggestedLabel: "Nothing on record for this PAN" };
    }
    const senior = rule.section === "80TTB";
    return {
      ...q,
      question: senior
        ? "Do you earn interest on savings accounts or fixed deposits?"
        : q.question,
      why: senior
        ? `From 60, section 80TTB replaces 80TTA: up to ₹${rule.ceiling.toLocaleString(
            "en-IN",
          )} of interest, and unlike 80TTA it covers fixed deposits as well as savings accounts. It is the single largest thing most retired people are entitled to and do not claim.`
        : q.why,
      sectionLabel: rule.section,
      suggested: Math.min(rule.eligibleInterest, rule.ceiling),
      suggestedLabel: senior
        ? "The savings and deposit interest you have declared"
        : "The savings interest you have declared",
      ceiling: rule.ceiling,
      followUp: senior
        ? "The deduction comes off the interest you actually declared, so it can never be more than what is in your return."
        : q.followUp,
    };
  });
}
