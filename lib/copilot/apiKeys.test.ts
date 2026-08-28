import { describe, expect, test } from "bun:test";

import { apiKeys } from "@/app/api/chat/route";

/**
 * How a deployment's keys are read.
 *
 * One variable, comma-separated — the count is however many were pasted. The
 * rotation is only as predictable as this is: if the order changed between
 * restarts, one key would carry the load on some boots and none on others, and
 * a quota problem would look intermittent rather than reproducible.
 */
describe("reading the API keys", () => {
  test("finds nothing when nothing is set", () => {
    expect(apiKeys({})).toEqual([]);
  });

  test("a single key with no comma is one key", () => {
    expect(apiKeys({ GEMINI_API_KEY: "solo" })).toEqual(["solo"]);
  });

  test("counts however many were pasted, in the order given", () => {
    expect(apiKeys({ GEMINI_API_KEY: "keyone,keytwo,keythree" })).toEqual([
      "keyone",
      "keytwo",
      "keythree",
    ]);
  });

  test("tolerates the spaces people leave around commas", () => {
    expect(apiKeys({ GEMINI_API_KEY: " a , b ,c " })).toEqual(["a", "b", "c"]);
  });

  test("a trailing comma does not become an empty key", () => {
    expect(apiKeys({ GEMINI_API_KEY: "a,b,," })).toEqual(["a", "b"]);
  });

  test("the same key twice is only one key's worth of quota", () => {
    expect(apiKeys({ GEMINI_API_KEY: "same,other,same" })).toEqual([
      "same",
      "other",
    ]);
  });

  test("GEMINI_API_KEYS is accepted as an alias, after the main one", () => {
    expect(
      apiKeys({ GEMINI_API_KEY: "primary", GEMINI_API_KEYS: "extra_a,extra_b" }),
    ).toEqual(["primary", "extra_a", "extra_b"]);
  });

  test("the alias works on its own", () => {
    expect(apiKeys({ GEMINI_API_KEYS: "a,b" })).toEqual(["a", "b"]);
  });
});
