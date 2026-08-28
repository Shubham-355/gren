import { describe, expect, test } from "bun:test";

import {
  fromOllamaMessage,
  ollamaContext,
  ollamaHost,
  ollamaModel,
  ollamaTools,
  toOllamaMessages,
} from "./ollama";

/**
 * The local model: development only, opt-in, and never able to make the
 * assistant worse than it would have been.
 *
 * The production guard is the one that must not silently break — a local model
 * answering a deployed user would be a different product than the one that was
 * tested.
 */

describe("when the local model is used at all", () => {
  test("only in development, and only when one is named", () => {
    expect(ollamaModel({ NODE_ENV: "development", OLLAMA_MODEL: "llama3.2:3b" })).toBe(
      "llama3.2:3b",
    );
    expect(ollamaModel({ NODE_ENV: "development" })).toBe(null);
    expect(ollamaModel({ NODE_ENV: "development", OLLAMA_MODEL: "  " })).toBe(null);
  });

  test("never in production, however it is configured", () => {
    expect(
      ollamaModel({ NODE_ENV: "production", OLLAMA_MODEL: "llama3.2:3b" }),
    ).toBe(null);
  });

  test("defaults to the local Ollama, and tolerates a trailing slash", () => {
    expect(ollamaHost({})).toBe("http://127.0.0.1:11434");
    expect(ollamaHost({ OLLAMA_HOST: "http://box:11434/" })).toBe(
      "http://box:11434",
    );
  });
});

describe("the context window", () => {
  test("defaults to a window big enough for the prompt plus live state", () => {
    expect(ollamaContext({})).toBe(8192);
  });

  test("takes a configured value", () => {
    expect(ollamaContext({ OLLAMA_NUM_CTX: "16384" })).toBe(16384);
  });

  test("refuses one too small to hold the context it depends on", () => {
    // Below this the system prompt and screen state get silently truncated,
    // which degrades the answer without anything looking wrong.
    expect(ollamaContext({ OLLAMA_NUM_CTX: "512" })).toBe(8192);
    expect(ollamaContext({ OLLAMA_NUM_CTX: "nonsense" })).toBe(8192);
  });
});

describe("translating the tools", () => {
  test("lowercases the schema types Gemini writes in capitals", () => {
    const tool = ollamaTools.find((t) => t.function.name === "add_deduction")!;
    const parameters = tool.function.parameters as {
      type: string;
      properties: Record<string, { type: string }>;
    };
    expect(tool.type).toBe("function");
    expect(parameters.type).toBe("object");
    expect(parameters.properties.section.type).toBe("string");
    expect(parameters.properties.amount.type).toBe("number");
  });

  test("keeps every tool the cloud model is given", () => {
    expect(ollamaTools.length).toBeGreaterThan(10);
    expect(ollamaTools.every((t) => typeof t.function.description === "string")).toBe(
      true,
    );
  });
});

describe("translating the conversation", () => {
  test("puts the prompt and live state in a system turn", () => {
    const messages = toOllamaMessages({
      messages: [{ role: "user", text: "hello" }],
      systemPrompt: "PROMPT",
      contextSummary: "SUMMARY",
      context: { a: 1 },
      toolRounds: [],
    });
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("PROMPT");
    expect(messages[0].content).toContain("SUMMARY");
    expect(messages[1]).toEqual({ role: "user", content: "hello" });
  });

  test("replays a tool round as an assistant turn and a tool turn", () => {
    const messages = toOllamaMessages({
      messages: [{ role: "user", text: "settle it" }],
      systemPrompt: "P",
      contextSummary: "S",
      context: {},
      toolRounds: [
        {
          pendingCalls: [{ name: "resolve_mismatch", args: { item_id: "ais-fd" } }],
          functionResponses: [{ name: "resolve_mismatch", response: { ok: true } }],
        },
      ],
    });
    const assistant = messages.find((m) => m.role === "assistant")!;
    const tool = messages.find((m) => m.role === "tool")!;
    expect(assistant.tool_calls?.[0].function.name).toBe("resolve_mismatch");
    expect(tool.tool_name).toBe("resolve_mismatch");
    expect(tool.content).toContain("true");
  });
});

describe("reading the reply back", () => {
  test("takes plain text", () => {
    expect(fromOllamaMessage({ content: "Your refund is ₹85,880." })).toEqual([
      { text: "Your refund is ₹85,880." },
    ]);
  });

  test("takes a tool call with object arguments", () => {
    const parts = fromOllamaMessage({
      content: "",
      tool_calls: [
        { function: { name: "switch_regime", arguments: { regime: "old" } } },
      ],
    });
    expect(parts).toEqual([
      { functionCall: { name: "switch_regime", args: { regime: "old" } } },
    ]);
  });

  test("takes arguments that arrived as a JSON string instead", () => {
    // Smaller local models do this often enough to be worth handling.
    const parts = fromOllamaMessage({
      tool_calls: [
        { function: { name: "navigate_to", arguments: '{"module":"regime"}' } },
      ],
    });
    expect(parts[0].functionCall?.args).toEqual({ module: "regime" });
  });

  test("survives arguments that are not valid JSON at all", () => {
    const parts = fromOllamaMessage({
      tool_calls: [{ function: { name: "navigate_to", arguments: "{broken" } }],
    });
    expect(parts[0].functionCall?.args).toEqual({});
  });

  test("strips a reasoning model's thinking block out of the answer", () => {
    const parts = fromOllamaMessage({
      content: "<think>Let me work this out.</think>Your refund is ₹85,880.",
    });
    expect(parts).toEqual([{ text: "Your refund is ₹85,880." }]);
  });

  test("returns nothing when there is nothing usable, so the cloud takes over", () => {
    expect(fromOllamaMessage({})).toEqual([]);
    expect(fromOllamaMessage({ content: "   " })).toEqual([]);
    expect(fromOllamaMessage({ content: "<think>only thinking</think>" })).toEqual([]);
  });
});
