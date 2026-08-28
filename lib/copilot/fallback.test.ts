import { describe, expect, test } from "bun:test";

import { respondLocally } from "./fallback";
import { form16 } from "@/lib/data/seed";
import { useAppStore, type AppState } from "@/lib/store/useAppStore";

/**
 * The offline copilot, answering without a model behind it.
 *
 * These are the sentences people actually type at a tax return. What matters
 * is not that it produces prose but that it reaches for the right tool with
 * the right argument — a misread amount here is a wrong figure in a return.
 */

/** A state with a salary in it, so the figures are worth quoting. */
function seeded(patch: Partial<AppState> = {}): AppState {
  const base = useAppStore.getState();
  return {
    ...base,
    loggedIn: true,
    accountKind: "demo",
    form16Imported: true,
    salary: {
      basic: form16.salary.basic,
      hra: form16.salary.hra,
      specialAllowance: form16.salary.specialAllowance,
      lta: form16.salary.lta,
      otherAllowances: form16.salary.otherAllowances,
      employerNps: form16.salary.employerNps,
      professionalTax: form16.professionalTax,
      tdsDeducted: form16.tdsDeducted,
    },
    ...patch,
  } as AppState;
}

const call = (reply: ReturnType<typeof respondLocally>, name: string) =>
  reply.toolCalls.find((c) => c.name === name);

describe("recording a deduction from a sentence", () => {
  test("reads the section and the amount together", () => {
    const reply = respondLocally("I put 1.5 lakh into 80C", seeded());
    const tool = call(reply, "add_deduction");
    expect(tool?.args.section).toBe("80C");
    expect(tool?.args.amount).toBe(150_000);
  });

  test("uses the argument name the tool takes, not the printed label", () => {
    const reply = respondLocally(
      "25000 for my parents health insurance",
      seeded(),
    );
    expect(call(reply, "add_deduction")?.args.section).toBe("80D_parents");
  });

  test("records a no as a nil rather than ignoring it", () => {
    const reply = respondLocally("I don't have an education loan", seeded());
    const tool = call(reply, "add_deduction");
    expect(tool?.args.section).toBe("80E");
    expect(tool?.args.amount).toBe(0);
  });

  test("asks for the figure rather than guessing one", () => {
    const reply = respondLocally("add my 80C", seeded());
    expect(reply.toolCalls.length).toBe(0);
    expect(reply.text).toContain("How much");
  });
});

describe("recording an income figure", () => {
  test("sets the field named", () => {
    const reply = respondLocally("my basic salary is 9.5 lakh", seeded());
    const tool = call(reply, "set_income");
    expect(tool?.args.field).toBe("basic");
    expect(tool?.args.amount).toBe(950_000);
  });

  test("annualises a monthly figure", () => {
    const reply = respondLocally("I pay rent of 30000 a month", seeded());
    const tool = call(reply, "set_income");
    expect(tool?.args.field).toBe("rentPaidAnnual");
    expect(tool?.args.amount).toBe(360_000);
  });
});

describe("what-if questions", () => {
  test("runs the return both ways and quotes a real difference", () => {
    const reply = respondLocally(
      "how much would I save if I put 50000 into 80C",
      seeded({ regime: "old" }),
    );
    // No tool call — a what-if changes nothing until asked.
    expect(reply.toolCalls.length).toBe(0);
    expect(reply.text).toMatch(/₹/);
    expect(reply.text).toContain("Nothing has been changed");
  });

  test("says plainly when the new regime would not allow it", () => {
    const reply = respondLocally(
      "what if I put 50000 into 80C",
      seeded({ regime: "new" }),
    );
    expect(reply.text).toContain("new regime does not allow it");
  });
});

describe("driving the journey", () => {
  test("settles every open difference in one turn", () => {
    const reply = respondLocally("just file it for me", seeded());
    expect(reply.toolCalls.length).toBeGreaterThan(1);
    expect(reply.toolCalls.every((c) => c.name === "resolve_mismatch")).toBe(true);
  });

  test("only the journey asks the loop for another round", () => {
    // The journey is several steps and each is decided from the last one's
    // result. Anything else run twice would act on the same sentence twice —
    // a confirmed deduction compounded to eight times its size before this.
    expect(respondLocally("just file it for me", seeded()).continues).toBe(true);

    for (const message of [
      "I put 1.5 lakh into 80C",
      "my basic salary is 9.5 lakh",
      "settle the AIS differences",
      "how much do I owe",
    ]) {
      expect(respondLocally(message, seeded()).continues).toBeUndefined();
    }
  });

  test("will not invent deduction amounts for a PAN with no documents", () => {
    const reply = respondLocally(
      "answer my deduction questions",
      seeded({ accountKind: "fresh" }),
    );
    expect(call(reply, "add_deduction")).toBeUndefined();
    expect(reply.text).toContain("need your answers");
  });
});

describe("answering from the live figures", () => {
  test("says where the return stands", () => {
    const reply = respondLocally("how much do I owe", seeded());
    expect(reply.text).toMatch(/₹/);
  });

  test("shows the arithmetic when asked for the working", () => {
    const reply = respondLocally("show me the working", seeded());
    expect(reply.text).toContain("Cess");
  });

  test("explains what filing late would cost", () => {
    const reply = respondLocally("what happens if I file late", seeded());
    expect(reply.text).toContain("234F");
    expect(reply.text).toContain("belated");
  });
});

describe("following the conversation", () => {
  test("a confirmed what-if performs the change rather than repeating itself", () => {
    const state = seeded({ regime: "old" });
    const reply = respondLocally("yes go ahead", state, {
      previousMessage: "how much would I save if I put 50000 into 80C",
    });
    const tool = call(reply, "add_deduction");
    expect(tool?.args.section).toBe("80C");
    // add_deduction sets rather than adds, so it must carry the new total.
    expect(tool?.args.amount).toBe((state.deductions.s80C as number) + 50_000);
    expect(reply.text).toContain("Recording it");
  });

  test("a bare yes acts on what was asked a moment ago", () => {
    const reply = respondLocally("yes, go ahead", seeded(), {
      previousMessage: "settle the AIS differences",
    });
    expect(call(reply, "resolve_mismatch")).toBeTruthy();
  });

  test("without that context it does not act on nothing", () => {
    const reply = respondLocally("yes, go ahead", seeded());
    expect(reply.toolCalls.length).toBe(0);
  });
});

describe("when it does not understand", () => {
  test("says so and offers what it can do, rather than acting", () => {
    const reply = respondLocally(
      "what is the capital of France",
      seeded(),
    );
    expect(reply.toolCalls.length).toBe(0);
    expect(reply.text).toContain("could not work that one out");
  });
});
