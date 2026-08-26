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
        error: "Saathi could not be reached.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json(
      {
        error: `Saathi's service returned ${response.status}.`,
        // Surfaced in the panel so a misconfigured key is obvious rather than
        // looking like Saathi is broken.
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
  // Handed straight back on the next turn, signatures and all.
  const modelParts = parts as unknown as Record<string, unknown>[];
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

  return NextResponse.json({ text, toolCalls, modelParts, configured: true });
}
