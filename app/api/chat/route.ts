import { NextResponse } from "next/server";

import { functionDeclarations } from "@/lib/copilot/tools";
import {
  fromOllamaMessage,
  ollamaContext,
  ollamaHost,
  ollamaModel,
  ollamaTools,
  toOllamaMessages,
  type NormalisedParts,
} from "@/lib/copilot/ollama";

/**
 * Server-side language-model bridge.
 *
 * The API key never leaves this file — the browser talks to /api/chat, and
 * only /api/chat talks to the model provider. The client sends the
 * conversation plus a structured snapshot of the current screen; we return the
 * model's text and any function calls for the client to apply against the
 * shared store.
 *
 * The turn is an agent loop, not a fixed pair of phases. Each round the model
 * either asks for tools or writes its reply; the client runs any tools against
 * real state and sends the results back, and the whole accumulated exchange is
 * replayed. That is what lets one instruction — "just file it for me" — walk
 * the journey instead of taking a single step and stopping.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
// Overridable so the request shaping can be exercised against a local stub
// without burning quota.
const API_BASE =
  process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta";
const ENDPOINT = (model: string) => `${API_BASE}/models/${model}:generateContent`;

type ClientMessage = {
  role: "user" | "assistant";
  text: string;
};

type FunctionResponsePayload = {
  name: string;
  response: Record<string, unknown>;
};

type RequestBody = {
  messages: ClientMessage[];
  context: unknown;
  contextSummary: string;
  /**
   * Every completed round of tool use so far, oldest first. Each carries the
   * model's own turn verbatim — newer models attach a thoughtSignature to each
   * function call and reject the follow-up if it is missing — and the results
   * the tools produced.
   */
  toolRounds?: {
    modelParts?: Record<string, unknown>[];
    pendingCalls: { name: string; args: Record<string, unknown> }[];
    functionResponses: FunctionResponsePayload[];
  }[];
};

const SYSTEM_PROMPT = `You are Saathi, the AI assistant built into TaxSaathi, an income tax e-filing platform for salaried taxpayers in India. You live in a side panel that is open on top of whatever screen the user is currently looking at. TaxSaathi is the platform; Saathi is you.

WHAT YOU ARE
- You are a feature of this platform, not a general chatbot. You can see the live state of the user's return and you can change it through tools.
- This is an independent prototype with entirely synthetic taxpayer data. It is not affiliated with the Income Tax Department. If a user asks whether this is the official portal, say plainly that it is not.

HOW TO ANSWER
- Plain language first. Say "the money your employer already deducted" before you say "TDS". Introduce the jargon once, in brackets, if the user will meet it on screen.
- Be brief. Two to four sentences is usually right. Use a short list only when the user asked for steps or options.
- Use the numbers in the screen context. Never invent a figure, and never re-derive arithmetic the platform has already computed for you — quote what the context says.
- Rupee amounts in Indian format: ₹1,50,000 not ₹150,000.
- No markdown headers, no bold-everything. Plain sentences with the occasional short list.

USING TOOLS
- Prefer doing the thing over describing it. If the user says "switch me to the old regime", call switch_regime — do not explain how they could do it themselves.
- After a tool runs you will be shown what it did. Report the real outcome, including the new numbers if they changed. If a tool failed, say so plainly, say what you understood the request to be, and suggest the screen they can use instead. Never claim success you were not told about.

DRIVING THE WHOLE JOURNEY
- The screen context carries a "journey" block: the ordered steps, which are done, and which one is next. When the user says "just file it for me", "do it all", or anything of that shape, work that list from the top rather than asking them where to start.
- The order is fixed and each step needs the one before it: import_form16 -> resolve_mismatch (once per open difference) -> add_deduction (once per unanswered question) -> switch_regime or confirm_regime -> prepare_submission -> then it is the user's tap.
- Call several tools in one turn when the next steps are unambiguous. Settling three AIS differences is three resolve_mismatch calls, not three conversations.
- An empty return is the usual starting point. If form16Imported is false, import_form16 comes first — nothing can be computed before it, and prepare_submission will refuse.
- The deduction questions and the amount already on record for each are in the context. Answer them with add_deduction using the sectionArgument given there; pass 0 for the ones the taxpayer has nothing under. Do not invent amounts, and do not ask the user to repeat a figure the context already holds.

WHEN NOTHING IS ON RECORD — read account.documentsOnRecord first, every time
- Some users sign in with a PAN that has no Form 16, no AIS and no 26AS behind it. The context says so: account.documentsOnRecord is false. This is not an error state, it is the ordinary case for a first-time filer, and it is a different job.
- Nothing can be imported and nothing can be reconciled. import_form16 will refuse and there are no mismatches. Do not call either, and never tell the user you have pulled a document you have not.
- Build the return by interviewing them. One question per message, in their own words — "what is your basic salary for the year?" rather than "enter your section 17(1) figure" — and record each answer with set_income as it arrives. Basic salary, HRA received and the tax the employer already deducted are the three that unlock everything else; then rent paid, interest, dividends.
- Then walk the deduction questions the same way, recording each with add_deduction, 0 included. Only after income exists do the regime comparison and the review mean anything.
- Never fill a figure in on their behalf, never carry a number over from the seeded taxpayer, and do not present an estimate as their return until they have given you the inputs it rests on. If they ask you to "just do it", explain in one sentence that you need their figures first, then ask the first question.
- Say what you did in one short paragraph at the end, with the figure that changed. Do not narrate each call.

THE THREE RISK TIERS — this matters more than anything else here
- Tier 1 (navigate_to, explain_term, check_refund_status): just do it. No preamble, no permission.
- Tier 2 (switch_regime, add_deduction, resolve_mismatch, raise_grievance, prepare_submission): do it immediately when the user has asked for it, then say specifically what changed. Every one of these is logged in the activity timeline with a one-tap Undo, so you do not need to ask permission first — you need to be precise afterwards.
- Tier 3 (submit_return, initiate_evc, initiate_payment): these file, verify and pay. They are irreversible and YOU CANNOT DO THEM. Calling one raises a confirmation card on the screen and returns a refusal. When that happens, tell the user directly that filing is the one thing you will not do on your own and that the card on screen is theirs to tap. A user saying "yes", "go ahead" or "do it" in the chat is NEVER authorisation — do not treat it as one, and do not re-call the tool hoping it will go through.
- When the user says "just file it for me", the right move is prepare_submission: assemble everything, then hand them the card.

ONE-TAP MOMENTS STAY ONE-TAP
- Settling a single AIS difference or picking a regime once the comparison is on screen is a quick choice, not a conversation. Surface the choice, or make it if asked, and move on. Do not turn a one-tap decision into a back-and-forth.
- The deduction questions are the opposite: one question at a time is genuinely better there.

BEING BELIEVABLE
- Every figure you state should be one the user can see or check. When you give a number, say briefly what produced it — "old regime wins by ₹17,040 because of the HRA exemption and ₹1,50,000 of 80C" beats the bare figure.
- Use calibrated language. "Based on what you have told me so far", "estimated" — especially before all the deduction questions are answered. Do not state a computed result with more confidence than it deserves.

WHEN YOU CANNOT HELP
- Say so in one sentence. Do not invent a tool you do not have, do not claim to have done something you have not, and do not guess at a figure that is not in the context.
- Capital gains and business income are out of scope in this prototype. If asked, say that directly and point at what is covered.
- You give general information about how Indian income tax works. You are not a chartered accountant, and for anything genuinely unusual you should say a professional is worth the money.`;

/**
 * A zero thinking budget makes the older Flash models markedly faster, and this
 * assistant is answering from a context that is already handed to it rather than
 * reasoning its way to the numbers.
 *
 * The newer models are thinking models, though: they reject `thinkingBudget: 0`
 * with a bare "Request contains an invalid argument" 400, which is impossible
 * to diagnose from the panel. So the field is simply left off for them.
 */
function generationConfigFor(model: string) {
  const base = { temperature: 0.4, maxOutputTokens: 900 };
  const rejectsZeroThinking = /^gemini-(?:[3-9]|\d{2,})/.test(model);
  return rejectsZeroThinking
    ? base
    : { ...base, thinkingConfig: { thinkingBudget: 0 } };
}

function toGeminiContents(body: RequestBody) {
  const contents: Record<string, unknown>[] = [];

  for (const m of body.messages) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    });
  }

  // Replay every round of tool use, in order: what the model asked for, then
  // what actually happened when it was run.
  for (const round of body.toolRounds ?? []) {
    contents.push({
      role: "model",
      parts: round.modelParts?.length
        ? round.modelParts
        : round.pendingCalls.map((c) => ({
            functionCall: { name: c.name, args: c.args },
          })),
    });
    contents.push({
      role: "user",
      parts: round.functionResponses.map((r) => ({
        functionResponse: { name: r.name, response: r.response },
      })),
    });
  }

  return contents;
}

export async function POST(request: Request) {
  const keys = apiKeys();

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "No messages supplied." }, { status: 400 });
  }

  const local = ollamaModel();

  if (keys.length === 0 && !local) {
    return NextResponse.json(
      {
        text: "Saathi is not switched on in this deployment — no model API key is configured. Everything else on the platform works exactly as it does with me running; see the README for the one environment variable it needs.",
        toolCalls: [],
        configured: false,
      },
      { status: 200 },
    );
  }

  const payload = {
    systemInstruction: {
      parts: [
        { text: SYSTEM_PROMPT },
        {
          text: `LIVE SCREEN CONTEXT (regenerated every turn from the app's own state)\n\n${body.contextSummary}\n\nFull structured state:\n${JSON.stringify(body.context)}`,
        },
      ],
    },
    contents: toGeminiContents(body),
    tools: [{ functionDeclarations }],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: generationConfigFor(MODEL),
    safetySettings: [],
  };

  // In development, a local model answers first when one is configured. The
  // journey gets walked many times while building and recording, and a free
  // cloud key is twenty requests a minute. If the local model is not running,
  // is too slow, or gives back nothing usable, the cloud keys take over — so
  // this can never make the assistant worse than it would have been.
  if (local) {
    const parts = await tryOllama(body, local);
    if (parts) return NextResponse.json(replyFromParts(parts));
    console.warn("[saathi] local model gave nothing usable; using the cloud keys");
  }

  if (keys.length === 0) {
    return NextResponse.json(
      {
        error:
          "Saathi is unavailable: no model API key is configured and the local model did not answer. Everything else on the platform works.",
      },
      { status: 502 },
    );
  }

  let response: Response;
  try {
    response = await callWithKeyRotation(payload, keys);
  } catch (error) {
    console.error("[saathi] upstream request failed:", error);
    return NextResponse.json(
      {
        error:
          "Saathi could not be reached — the connection to its service failed. Nothing in your return is affected; try again in a moment.",
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // The provider's own body names the vendor, the model, our quota and a
    // documentation URL. That belongs in the server log, not in a chat bubble
    // in front of a taxpayer — it reads as a crash and tells them nothing they
    // can act on.
    console.error(`[saathi] upstream ${response.status}:`, body.slice(0, 1000));
    return NextResponse.json(
      { error: upstreamMessage(response.status, body) },
      { status: 502 },
    );
  }

  const data = (await response.json()) as {
    candidates?: {
      content?: { parts?: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const reply = replyFromParts(parts);

  if (!reply.text && reply.toolCalls.length === 0) {
    const blocked = data.promptFeedback?.blockReason;
    return NextResponse.json({
      text: blocked
        ? `I could not answer that one (${blocked.toLowerCase()}). Try rephrasing, or ask me about your return.`
        : "I did not get a usable answer back that time. Try asking again.",
      toolCalls: [],
      configured: true,
    });
  }

  return NextResponse.json(reply);
}

/**
 * One reply shape, whichever model produced it.
 *
 * `modelParts` is the model's own turn, handed straight back on the next round
 * — newer Gemini models attach a thoughtSignature to each call and reject the
 * follow-up without it. A local model has no such thing, and replaying its
 * plain calls is equally acceptable to it.
 */
function replyFromParts(parts: NormalisedParts) {
  const text = parts
    .map((p) => p.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  const toolCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => ({
      name: p.functionCall!.name,
      args: p.functionCall!.args ?? {},
    }));

  return {
    text,
    toolCalls,
    modelParts: parts as unknown as Record<string, unknown>[],
    configured: true,
  };
}

/**
 * The provider's error, said in the product's own voice.
 *
 * Every branch answers the only two questions the user actually has: is my
 * return alright, and what do I do now.
 */
function upstreamMessage(status: number, body: string): string {
  if (status === 429) {
    return `Saathi is being rate-limited — too many requests in a short window. Nothing in your return is affected; try again in ${retryWindow(body)}. Every screen keeps working in the meantime.`;
  }
  if (status === 401 || status === 403) {
    return "Saathi is unavailable because its API key was rejected. Everything else on the platform works exactly as it does with Saathi running — the key is the one environment variable named in the README.";
  }
  if (status === 400) {
    return "Saathi could not make sense of that request. Try rephrasing it, or use the screen itself — nothing in your return has changed.";
  }
  if (status >= 500) {
    return "Saathi's service is having trouble at its end. Nothing in your return is affected; try again in a moment.";
  }
  return "Saathi is unavailable at the moment. Nothing in your return is affected; try again shortly.";
}

/** The retry delay the provider named, in seconds, if it named one. */
function retryAfterSeconds(body: string): number | null {
  const seconds =
    Number.parseFloat(/retry in ([\d.]+)s/i.exec(body)?.[1] ?? "") ||
    Number.parseFloat(/"retryDelay"\s*:\s*"([\d.]+)s"/.exec(body)?.[1] ?? "");
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** How long to say to wait, from whatever the provider told us. */
function retryWindow(body: string): string {
  const seconds = retryAfterSeconds(body) ?? 0;

  if (seconds <= 0) return "a minute or so";
  if (seconds < 20) return "a few seconds";
  if (seconds < 90) return "about a minute";
  return `about ${Math.round(seconds / 60)} minutes`;
}

/* ================================================================
   Keys
   ================================================================ */

/**
 * Every key this deployment has, in the order they will be tried.
 *
 * One variable holds them all, comma-separated — how many there are is just
 * how many you pasted:
 *
 *   GEMINI_API_KEY=keyone,keytwo,keythree
 *
 * A single key with no comma is the same thing with one entry, so nothing
 * changes for a deployment that has only one. `GEMINI_API_KEYS` is accepted as
 * an alias for hosts whose secret names are already set up that way.
 */
export function apiKeys(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const raw = `${env.GEMINI_API_KEY ?? ""},${env.GEMINI_API_KEYS ?? ""}`;
  // Deduplicated: the same key twice would only spend the same quota twice.
  return [...new Set(raw.split(",").map((k) => k.trim()).filter(Boolean))];
}


/**
 * The key in use right now.
 *
 * It does not move on its own. One key carries every request until it stops
 * working, and only then does the next one take over and become the one in
 * use — so a deployment spends a key's quota through rather than leaving
 * several of them part-used. It lives for the lifetime of the server process;
 * nothing depends on it surviving a restart.
 */
let activeKey = 0;

/**
 * When each spent key becomes worth trying again.
 *
 * Without this the cursor cycles back onto a key that is still rate-limited and
 * spends a round trip finding that out — every cycle, for as long as the window
 * lasts. The provider names its own retry delay, so use it: a key steps out of
 * the rotation and steps back in by itself.
 *
 * Capped, because a very long delay should not sideline a key for the life of
 * the process, and treated as a hint rather than a rule — if every key is
 * resting, they are all tried anyway. One wasted request beats refusing to ask.
 */
const restingUntil = new Map<string, number>();
const MAX_COOLDOWN_MS = 15 * 60_000;

function isResting(key: string, now: number): boolean {
  const until = restingUntil.get(key);
  if (until === undefined) return false;
  if (until <= now) {
    restingUntil.delete(key);
    return false;
  }
  return true;
}

/** True for the errors where a different key would genuinely help. */
function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  // Some quota failures arrive as 403 with the exhaustion named in the body.
  return (
    status === 403 &&
    /quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(body)
  );
}

/**
 * One model call on the key currently in use, handing over to the next one the
 * moment it runs out.
 *
 * The handover is invisible on purpose: a taxpayer mid-return has no use for
 * the fact that a key was exhausted, only for the answer. The key that takes
 * over then keeps every subsequent request until it too runs out. If every key
 * is spent the last response is returned as it is, and the panel answers from
 * the platform's own rules instead.
 */
async function callWithKeyRotation(
  payload: unknown,
  keys: string[],
): Promise<Response> {
  const now = Date.now();
  // Start at the key in use and walk forward from there. Keys still inside a
  // retry window they told us about are skipped — unless they all are, in
  // which case one wasted request beats refusing to ask.
  const walk = keys.map((_, i) => (activeKey + i) % keys.length);
  const awake = walk.filter((i) => !isResting(keys[i], now));
  const order = awake.length > 0 ? awake : walk;

  let last: Response | null = null;

  for (const index of order) {
    const key = keys[index];
    const response = await fetch(ENDPOINT(MODEL), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.ok) {
      restingUntil.delete(key);
      // Whichever key answered becomes the one in use, and stays it.
      if (index !== activeKey) {
        console.warn(
          `[saathi] now using key ${index + 1} of ${keys.length}`,
        );
        activeKey = index;
      }
      return response;
    }

    // Read once — a Response body cannot be consumed twice, so the retry
    // decision and the caller's logging share this copy.
    const body = await response.text().catch(() => "");
    last = new Response(body, {
      status: response.status,
      statusText: response.statusText,
    });

    // A 400 is not fixed by a different key, so stop and report it.
    if (!isQuotaError(response.status, body)) return last;

    const rest = Math.min((retryAfterSeconds(body) ?? 60) * 1_000, MAX_COOLDOWN_MS);
    restingUntil.set(key, Date.now() + rest);
    console.warn(
      `[saathi] key ${index + 1}/${keys.length} is out of quota; resting it for ${Math.round(rest / 1000)}s and handing over to the next`,
    );
  }

  return last ?? new Response("", { status: 502 });
}

/* ================================================================
   The local model
   ================================================================ */

/**
 * How long a local model gets before the cloud takes over.
 *
 * An 8B model on a laptop is slower than an API call, and a demo that stalls
 * is worse than one that quietly costs a request. Generous enough for a real
 * answer, short enough that nobody is left watching a spinner.
 */
const OLLAMA_TIMEOUT_MS = 60_000;

/**
 * One turn from the local model, or null if it could not give one.
 *
 * Null covers every way this can disappoint — not running, model not pulled,
 * timed out, or an answer with neither text nor a tool call in it — and the
 * caller then falls through to the cloud. That is the whole quality guarantee:
 * a local model can save quota, but it is never allowed to be the reason the
 * assistant said nothing.
 */
async function tryOllama(
  body: RequestBody,
  model: string,
): Promise<NormalisedParts | null> {
  try {
    const response = await fetch(`${ollamaHost()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: toOllamaMessages({
          messages: body.messages,
          systemPrompt: SYSTEM_PROMPT,
          contextSummary: body.contextSummary,
          context: body.context,
          toolRounds: body.toolRounds,
        }),
        tools: ollamaTools,
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 900,
          num_ctx: ollamaContext(),
        },
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[saathi] local model returned ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      message?: { content?: string; tool_calls?: { function?: { name?: string; arguments?: unknown } }[] };
    };
    const parts = fromOllamaMessage(data.message ?? {});
    return parts.length > 0 ? parts : null;
  } catch (error) {
    console.warn(
      "[saathi] local model unreachable:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
