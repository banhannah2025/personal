import { NextResponse } from "next/server";

import { groqClient, DEFAULT_GROQ_MODEL } from "@/lib/aiClients";

type AiMode = "grammar" | "rewrite";

type AiRequestBody = {
  mode?: AiMode;
  text?: string;
  context?: string;
};

function buildSystemPrompt(mode: AiMode) {
  if (mode === "grammar") {
    return [
      "You are a professional editor who corrects grammar, spelling, and clarity without changing the writer's intent.",
      "Return concise JSON with this shape: {\"replacement\": \"...\", \"notes\": [\"...\"]}.",
      "The replacement should be the corrected text and the notes array may include short bullet explanations.",
    ].join(" ");
  }
  return [
    "You are an expert writing coach who rewrites text to be clearer and more effective without changing factual meaning.",
    "Offer a polished rewrite and up to three short notes on structure, tone, or flow.",
    "Return JSON with this shape: {\"replacement\": \"...\", \"notes\": [\"...\"]}.",
  ].join(" ");
}

function parseAiResponse(raw: string | null | undefined) {
  const fallback = {
    replacement: raw?.trim() ?? "",
    notes: [] as string[],
  };
  if (!raw) {
    return fallback;
  }
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { replacement?: string; notes?: string[] };
    return {
      replacement: parsed.replacement?.trim() ?? fallback.replacement,
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 5) : [],
    };
  } catch {
    return fallback;
  }
}

const MAX_TEXT_LENGTH = 4000;

export async function POST(request: Request) {
  if (!groqClient) {
    return NextResponse.json({ error: "Groq client is not configured" }, { status: 500 });
  }

  let body: AiRequestBody;
  try {
    body = (await request.json()) as AiRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode ?? "grammar";
  if (mode !== "grammar" && mode !== "rewrite") {
    return NextResponse.json({ error: "Invalid AI mode" }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Selected text is too long for AI processing" }, { status: 400 });
  }

  const messages = [
    {
      role: "system" as const,
      content: buildSystemPrompt(mode),
    },
    {
      role: "user" as const,
      content: [
        body.context ? `Context:\n${body.context}` : null,
        "Text to improve:",
        text,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  try {
    const completion = await groqClient.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      temperature: mode === "grammar" ? 0.1 : 0.4,
      max_tokens: 800,
      messages,
    });
    const content = completion.choices[0]?.message?.content;
    const parsed = parseAiResponse(content);
    if (!parsed.replacement) {
      return NextResponse.json({ error: "AI response was empty" }, { status: 500 });
    }
    return NextResponse.json({ replacement: parsed.replacement, notes: parsed.notes ?? [] });
  } catch (error) {
    console.error("word-ai error", error);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
