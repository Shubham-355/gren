import type { DeductionInput } from "@/lib/tax/compute";
import { INCOME_FIELDS, type IncomeField } from "@/lib/store/useAppStore";

/**
 * The reading half of the offline copilot: turning a typed sentence into the
 * things this platform can act on — an amount, a section, an income field, an
 * intent.
 *
 * Kept apart from the answering half so it can be tested on its own, which
 * matters more here than anywhere else in the app: every one of these is a
 * guess about what somebody meant, and a wrong guess writes a number into a
 * tax return.
 */

/** Lower case, punctuation flattened, single-spaced. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[₹,]/g, "")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================================================================
   Amounts
   ================================================================ */

const MULTIPLIERS: { words: string[]; factor: number }[] = [
  { words: ["crore", "cr", "crores"], factor: 10_000_000 },
  { words: ["lakh", "lakhs", "lac", "lacs", "l"], factor: 100_000 },
  { words: ["thousand", "k"], factor: 1_000 },
];

/**
 * Every rupee figure in a sentence, in the order they appear.
 *
 * People write money here the way they say it — "1.5 lakh", "₹50,000", "50k",
 * "2.4L" — and a deduction entered as 1.5 instead of 1,50,000 is not a small
 * mistake. A bare number under 1,000 with no unit is dropped rather than
 * guessed at: "80C" is a section, not eighty rupees.
 */
export function extractAmounts(text: string): number[] {
  const clean = normalise(text);
  const amounts: number[] = [];
  // A number, then optionally a unit — either attached ("50k", "2.4l") or the
  // next word ("1.5 lakh").
  const pattern = /(\d+(?:\.\d+)?)\s*([a-z]+)?/g;

  for (const match of clean.matchAll(pattern)) {
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) continue;
    const unit = match[2] ?? "";

    // A section number is not an amount: "80c", "80 ccd", "section 24". Anchor
    // both ends — matched as a prefix, this swallowed "2 crore", whose unit
    // begins with the same letter as section 80C.
    if (/^(c|ccd|ccd1b|d|dd|ddb|e|eeb|g|gg|tta|ttb|u)$/.test(unit)) continue;
    const before = clean.slice(0, match.index).trim().split(" ").pop() ?? "";
    if (before === "section" || before === "u" || before === "us") continue;

    const multiplier = MULTIPLIERS.find((m) => m.words.includes(unit));
    if (multiplier) {
      amounts.push(Math.round(value * multiplier.factor));
      continue;
    }
    // No unit: only believable as money if it is already a money-sized number.
    if (value >= 1_000) amounts.push(Math.round(value));
  }

  return amounts;
}

/** The single amount a sentence is about, if it names exactly one. */
export function extractAmount(text: string): number | null {
  const amounts = extractAmounts(text);
  return amounts.length > 0 ? amounts[0] : null;
}

/* ================================================================
   Sections
   ================================================================ */

/** Section names as the add_deduction tool takes them. */
const SECTIONS: { argument: string; field: keyof DeductionInput; needles: string[] }[] = [
  { argument: "80CCD(1B)", field: "s80CCD1B", needles: ["80ccd 1b", "80ccd1b", "80 ccd 1b", "nps"] },
  { argument: "80D_parents", field: "s80D_parents", needles: ["80d parents", "parents health", "parents insurance", "parents medical"] },
  { argument: "80D_self", field: "s80D_self", needles: ["80d", "health insurance", "medical insurance", "mediclaim"] },
  { argument: "80DDB", field: "s80DDB", needles: ["80ddb", "specified disease", "medical treatment"] },
  { argument: "80EEB", field: "s80EEB", needles: ["80eeb", "electric vehicle", "ev loan"] },
  { argument: "80E", field: "s80E", needles: ["80e", "education loan", "student loan"] },
  { argument: "80G", field: "s80G", needles: ["80g", "donation", "donated", "charity"] },
  { argument: "80TTB", field: "s80TTA", needles: ["80ttb"] },
  { argument: "80TTA", field: "s80TTA", needles: ["80tta", "savings interest deduction"] },
  { argument: "80U", field: "s80U", needles: ["80u", "disability"] },
  { argument: "80C", field: "s80C", needles: ["80c", "epf", "ppf", "elss", "life insurance", "tuition fee", "provident fund"] },
];

export type SectionMatch = { argument: string; field: keyof DeductionInput };

/** The Chapter VI-A section a sentence is about, if it names one. */
export function matchSection(text: string): SectionMatch | null {
  const clean = normalise(text);
  let best: { entry: (typeof SECTIONS)[number]; length: number } | null = null;

  for (const entry of SECTIONS) {
    for (const needle of entry.needles) {
      if (!clean.includes(needle)) continue;
      if (!best || needle.length > best.length) {
        best = { entry, length: needle.length };
      }
    }
  }
  if (!best) return null;

  // "parents health insurance" contains "health insurance", which is longer
  // than "parents health" and would otherwise win — putting the premium under
  // the taxpayer's own ceiling instead of their parents' larger one. Whose
  // cover it is decides the section, so it settles the tie.
  if (best.entry.field === "s80D_self" && /parent/.test(clean)) {
    const parents = SECTIONS.find((e) => e.argument === "80D_parents")!;
    return { argument: parents.argument, field: parents.field };
  }

  return { argument: best.entry.argument, field: best.entry.field };
}

/* ================================================================
   Income fields
   ================================================================ */

const INCOME_NEEDLES: Partial<Record<IncomeField, string[]>> = {
  basic: ["basic salary", "basic pay", "my basic"],
  hra: ["hra received", "house rent allowance", "hra component", "hra is"],
  specialAllowance: ["special allowance"],
  lta: ["lta", "leave travel"],
  employerNps: ["employer nps", "employer contribution", "company nps"],
  professionalTax: ["professional tax"],
  tdsDeducted: ["tds", "tax deducted", "deducted by my employer", "employer deducted"],
  savingsInterest: ["savings interest", "savings account interest", "savings bank interest"],
  fdInterest: ["fd interest", "fixed deposit", "deposit interest", "recurring deposit"],
  dividend: ["dividend"],
  rentPaidAnnual: ["rent paid", "i pay rent", "pay in rent", "monthly rent", "rent i pay"],
  houseLoanInterest: ["home loan interest", "housing loan interest", "loan interest"],
  houseRentReceived: ["rent received", "rental income"],
};

/** The income figure a sentence is about, if it names one. */
export function matchIncomeField(text: string): IncomeField | null {
  const clean = normalise(text);
  let best: { field: IncomeField; length: number } | null = null;

  for (const [field, needles] of Object.entries(INCOME_NEEDLES) as [
    IncomeField,
    string[],
  ][]) {
    for (const needle of needles) {
      if (!clean.includes(needle)) continue;
      if (!best || needle.length > best.length) {
        best = { field, length: needle.length };
      }
    }
  }
  return best?.field ?? null;
}

export const incomeLabel = (field: IncomeField) => INCOME_FIELDS[field].label;

/* ================================================================
   Shape of the sentence
   ================================================================ */

/** "I don't have a home loan", "no education loan" — a nil answer, not a gap. */
export function isNegated(text: string): boolean {
  const clean = normalise(text);
  return /\b(no|not|dont|don t|doesnt|does not|never|nothing|none|havent|have not|nil)\b/.test(
    clean,
  );
}

/**
 * A bare "yes, do it" — meaningless on its own, so it is read against whatever
 * was being discussed a moment ago.
 *
 * Matched by vocabulary rather than by a list of exact phrases, because people
 * combine these freely: "yes go ahead", "sure, do that", "ok please continue".
 * A sentence is only an affirmation if every word in it is one, so "do it for
 * 80C" stays an instruction with its own content.
 */
const AFFIRMATIVE = new Set([
  "yes", "yep", "yeah", "yup", "ya", "ok", "okay", "k", "sure", "please",
  "do", "it", "that", "go", "ahead", "carry", "on", "continue", "proceed",
  "fine", "alright", "right", "correct", "confirm", "confirmed", "them", "all",
]);

export function isAffirmation(text: string): boolean {
  const words = normalise(text).split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  return words.every((w) => AFFIRMATIVE.has(w));
}

/** A question, rather than an instruction to change something. */
export function isQuestion(text: string): boolean {
  const clean = normalise(text);
  return (
    text.trim().endsWith("?") ||
    /^(what|why|how|when|which|who|where|is|are|do|does|can|should|could|would|will)\b/.test(
      clean,
    )
  );
}

/**
 * How strongly a sentence matches a set of phrases.
 *
 * Longer phrases score higher, so "settle the ais differences" beats a stray
 * "ais" and the panel picks the intent the sentence is really about rather
 * than whichever one happened to be checked first.
 */
export function score(text: string, phrases: string[]): number {
  const clean = normalise(text);
  let total = 0;
  for (const phrase of phrases) {
    if (clean.includes(phrase)) total += phrase.length;
  }
  return total;
}
