import { functionDeclarations } from "./tools";

/**
 * Talking to a model running on this machine, through Ollama.
 *
 * The point is quota: a demo — or a demo *recording* — walks the whole journey
 * several times, and a free cloud key is twenty requests a minute. A local
 * model costs nothing to run and nothing to run again.
 *
 * The rest of the route speaks Gemini, so everything here is translation in
 * both directions: the tool schemas out, the reply back. Nothing downstream
 * knows which model answered.
 *
 * Development only, and opt-in. It is never reached in a production build.
 */

const DEFAULT_HOST = "http://127.0.0.1:11434";

/** The local model to use, if one is configured and we are not in production. */
export function ollamaModel(
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.NODE_ENV === "production") return null;
  const model = (env.OLLAMA_MODEL ?? "").trim();
  return model.length > 0 ? model : null;
}

/**
 * The context window to give the local model.
 *
 * This is the memory lever: on an 8B model, dropping from 8192 to 2048 takes
 * the requirement from 2.4 GiB to 1.6 GiB. It is also a quality lever in the
 * other direction — the system prompt plus the live screen state is a few
 * thousand tokens on its own, and a window too small to hold them silently
 * truncates the context the answer depends on. 8192 fits both comfortably.
 */
export const ollamaContext = (
  env: Record<string, string | undefined> = process.env,
): number => {
  const configured = Number.parseInt(env.OLLAMA_NUM_CTX ?? "", 10);
  return Number.isFinite(configured) && configured >= 2048 ? configured : 8192;
};

export const ollamaHost = (
  env: Record<string, string | undefined> = process.env,
) => (env.OLLAMA_HOST ?? DEFAULT_HOST).replace(/\/$/, "");

/**
 * Gemini writes its JSON-Schema types in capitals; every other implementation
 * uses lower case, and Ollama passes the schema to the model's own grammar
 * without normalising it first.
 */
function lowercaseTypes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(lowercaseTypes);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key,
        key === "type" && typeof v === "string" ? v.toLowerCase() : lowercaseTypes(v),
      ]),
    );
  }
  return value;
}

export const ollamaTools = functionDeclarations.map((declaration) => ({
  type: "function",
  function: {
    name: declaration.name,
    description: declaration.description,
    parameters: lowercaseTypes(declaration.parameters),
  },
}));

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[];
  tool_name?: string;
};

/**
 * The same conversation the cloud model would have been given.
 *
 * Tool rounds are replayed as an assistant turn carrying the calls and a `tool`
 * turn carrying each result, which is the shape Ollama expects — Gemini nests
 * both inside `parts` instead.
 */
export function toOllamaMessages(body: {
  messages: { role: "user" | "assistant"; text: string }[];
  systemPrompt: string;
  contextSummary: string;
  context: unknown;
  toolRounds?: {
    pendingCalls: { name: string; args: Record<string, unknown> }[];
    functionResponses: { name: string; response: Record<string, unknown> }[];
  }[];
}): OllamaMessage[] {
  const messages: OllamaMessage[] = [
    {
      role: "system",
      content: `${body.systemPrompt}\n\nLIVE SCREEN CONTEXT (regenerated every turn from the app's own state)\n\n${body.contextSummary}\n\nFull structured state:\n${JSON.stringify(body.context)}`,
    },
  ];

  for (const m of body.messages) {
    messages.push({ role: m.role, content: m.text });
  }

  for (const round of body.toolRounds ?? []) {
    messages.push({
      role: "assistant",
      content: "",
      tool_calls: round.pendingCalls.map((c) => ({
        function: { name: c.name, arguments: c.args },
      })),
    });
    for (const result of round.functionResponses) {
      messages.push({
        role: "tool",
        tool_name: result.name,
        content: JSON.stringify(result.response),
      });
    }
  }

  return messages;
}

/** The Gemini-shaped parts array the rest of the route already knows how to read. */
export type NormalisedParts = {
  text?: string;
  // `args` is optional so a Gemini part, where it may be absent, is the same
  // type as a normalised local one. The reader defaults it.
  functionCall?: { name: string; args?: Record<string, unknown> };
}[];

/**
 * Ollama's reply, in the shape the route expects.
 *
 * A local model sometimes returns a tool call with its arguments as a JSON
 * string rather than an object, and a reasoning model wraps its answer in a
 * <think> block. Both are cleaned up here rather than left for the caller.
 */
export function fromOllamaMessage(message: {
  content?: string;
  tool_calls?: { function?: { name?: string; arguments?: unknown } }[];
}): NormalisedParts {
  const parts: NormalisedParts = [];

  const text = (message.content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  if (text) parts.push({ text });

  for (const call of message.tool_calls ?? []) {
    const name = call.function?.name;
    if (!name) continue;
    const raw = call.function?.arguments;
    let args: Record<string, unknown> = {};
    if (typeof raw === "string") {
      try {
        args = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        args = {};
      }
    } else if (raw && typeof raw === "object") {
      args = raw as Record<string, unknown>;
    }
    parts.push({ functionCall: { name, args } });
  }

  return parts;
}
