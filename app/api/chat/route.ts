import { NextResponse } from "next/server";

import { functionDeclarations } from "@/lib/copilot/tools";

/**
 * Server-side language-model bridge.
 *
 * The API key never leaves this file — the browser talks to /api/chat, and
 * only /api/chat talks to the model provider. The client sends the
 * conversation plus a structured snapshot of the current screen; we return the
 * model's text and any function calls for the client to apply against the
 * shared store.
 *
 * Two-phase turn:
 *   phase 1 (no functionResponses)  -> model may answer, or ask for tools
 *   phase 2 (functionResponses sent) -> model sees what the tools did and
 *                                       writes the final reply
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
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
  /** present on phase 2 only */
  pendingCalls?: { name: string; args: Record<string, unknown> }[];
  functionResponses?: FunctionResponsePayload[];
};

const SYSTEM_PROMPT = `You are TaxSaathi, the copilot built into an income tax e-filing platform for salaried taxpayers in India. You live in a side panel that is open on top of whatever screen the user is currently looking at.

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

function toGeminiContents(body: RequestBody) {
  const contents: Record<string, unknown>[] = [];

  for (const m of body.messages) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    });
  }

  // Phase 2: replay the model's function calls, then their results.
  if (body.pendingCalls?.length && body.functionResponses?.length) {
    contents.push({
      role: "model",
      parts: body.pendingCalls.map((c) => ({
        functionCall: { name: c.name, args: c.args },
      })),
    });
    contents.push({
      role: "user",
      parts: body.functionResponses.map((r) => ({
        functionResponse: { name: r.name, response: r.response },
      })),
    });
  }

  return contents;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "No messages supplied." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        text: "The copilot is not switched on in this deployment — no model API key is configured. Everything else on the platform works exactly as it does with me running; see the README for the one environment variable it needs.",
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
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 900,
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [],
  };

  let response: Response;
  try {
    response = await fetch(ENDPOINT(MODEL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "The copilot service could not be reached.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json(
      {
        error: `The copilot service returned ${response.status}.`,
        // Surfaced in the panel so a misconfigured key is obvious rather than
        // looking like the copilot is broken.
        detail: detail.slice(0, 600),
      },
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

  if (!text && toolCalls.length === 0) {
    const blocked = data.promptFeedback?.blockReason;
    return NextResponse.json({
      text: blocked
        ? `I could not answer that one (${blocked.toLowerCase()}). Try rephrasing, or ask me about your return.`
        : "I did not get a usable answer back that time. Try asking again.",
      toolCalls: [],
      configured: true,
    });
  }

  return NextResponse.json({ text, toolCalls, configured: true });
}
