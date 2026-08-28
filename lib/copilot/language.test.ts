import { describe, expect, test } from "bun:test";

import {
  extractAmount,
  extractAmounts,
  isAffirmation,
  isNegated,
  isQuestion,
  matchIncomeField,
  matchSection,
  normalise,
  score,
} from "./language";

/**
 * Reading a typed sentence.
 *
 * Every one of these is a guess about what somebody meant, and a wrong guess
 * writes a number into a tax return — "1.5 lakh" read as ₹1.50 is not a small
 * error. So the awkward cases are the ones worth pinning down.
 */

describe("reading an amount", () => {
  test("takes plain rupees with separators", () => {
    expect(extractAmount("₹1,50,000")).toBe(150_000);
    expect(extractAmount("I paid 42300")).toBe(42_300);
  });

  test("understands lakh, crore and k, spelled or abbreviated", () => {
    expect(extractAmount("1.5 lakh")).toBe(150_000);
    expect(extractAmount("2.4L")).toBe(240_000);
    expect(extractAmount("50k")).toBe(50_000);
    expect(extractAmount("50 thousand")).toBe(50_000);
    expect(extractAmount("2 crore")).toBe(20_000_000);
    expect(extractAmount("1.25 cr")).toBe(12_500_000);
  });

  test("does not read a section number as money", () => {
    expect(extractAmount("put it under 80C")).toBe(null);
    expect(extractAmount("section 24 interest")).toBe(null);
    expect(extractAmount("80ccd1b")).toBe(null);
  });

  test("does not invent money from a bare small number", () => {
    // "I have 2 children" is not two rupees.
    expect(extractAmount("I have 2 children")).toBe(null);
  });

  test("finds each amount in order when a sentence names several", () => {
    expect(extractAmounts("1.5 lakh into 80C and 25000 into 80D")).toEqual([
      150_000, 25_000,
    ]);
  });

  test("reads an amount alongside a section without confusing the two", () => {
    expect(extractAmount("I put 1.5 lakh into 80C")).toBe(150_000);
  });
});

describe("reading a section", () => {
  test("matches the section number", () => {
    expect(matchSection("80C please")?.argument).toBe("80C");
    expect(matchSection("claim 80ddb")?.argument).toBe("80DDB");
  });

  test("matches what people call it instead", () => {
    expect(matchSection("my EPF contribution")?.argument).toBe("80C");
    expect(matchSection("I have health insurance")?.argument).toBe("80D_self");
    expect(matchSection("education loan interest")?.argument).toBe("80E");
    expect(matchSection("I donated to charity")?.argument).toBe("80G");
  });

  test("prefers the more specific reading", () => {
    // "parents health insurance" must not be read as plain 80D.
    expect(matchSection("parents health insurance")?.argument).toBe(
      "80D_parents",
    );
    // 80CCD(1B) contains "80c" as a substring; length wins.
    expect(matchSection("80ccd1b")?.argument).toBe("80CCD(1B)");
  });

  test("finds nothing when no section is named", () => {
    expect(matchSection("how much do I owe")).toBe(null);
  });
});

describe("reading an income figure", () => {
  test("matches the field people name", () => {
    expect(matchIncomeField("my basic salary is 9 lakh")).toBe("basic");
    expect(matchIncomeField("I pay rent of 30000")).toBe("rentPaidAnnual");
    expect(matchIncomeField("fd interest was 42300")).toBe("fdInterest");
    expect(matchIncomeField("my employer deducted 2.4 lakh")).toBe("tdsDeducted");
  });

  test("does not confuse rent paid with rent received", () => {
    expect(matchIncomeField("rent received on the flat")).toBe(
      "houseRentReceived",
    );
    expect(matchIncomeField("the rent I pay is 25000")).toBe("rentPaidAnnual");
  });
});

describe("the shape of a sentence", () => {
  test("spots a nil answer", () => {
    expect(isNegated("I don't have an education loan")).toBe(true);
    expect(isNegated("no home loan")).toBe(true);
    expect(isNegated("I have a home loan")).toBe(false);
  });

  test("spots a bare yes, however people combine the words", () => {
    expect(isAffirmation("yes")).toBe(true);
    expect(isAffirmation("go ahead")).toBe(true);
    expect(isAffirmation("do it")).toBe(true);
    expect(isAffirmation("yes, go ahead")).toBe(true);
    expect(isAffirmation("sure do that")).toBe(true);
    expect(isAffirmation("ok please continue")).toBe(true);
  });

  test("but not a sentence that merely starts with one", () => {
    expect(isAffirmation("yes I have 80C of 1.5 lakh")).toBe(false);
    expect(isAffirmation("do it for 80C")).toBe(false);
    expect(isAffirmation("no")).toBe(false);
  });

  test("spots a question with or without the mark", () => {
    expect(isQuestion("how much do I owe")).toBe(true);
    expect(isQuestion("what is 80C?")).toBe(true);
    expect(isQuestion("settle my AIS differences")).toBe(false);
  });

  test("scores longer phrases higher, so the specific reading wins", () => {
    const sentence = "settle the ais differences for me";
    expect(score(sentence, ["settle the ais"])).toBeGreaterThan(
      score(sentence, ["ais"]),
    );
  });

  test("normalises the punctuation people actually type", () => {
    expect(normalise("₹1,50,000 — under 80C!")).toBe("150000 under 80c");
  });
});
