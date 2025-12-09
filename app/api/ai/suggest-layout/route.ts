import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { openaiClient, DEFAULT_COMPLETION_MODEL } from "@/lib/aiClients";
import type { LayoutSuggestion, LayoutPattern } from "@/app/app/digital-canvas/types";

type AiContentChunk = { type: string; text?: string; json?: unknown };
type AiResponseBlock = { content?: AiContentChunk[] };
type AiResponsePayload = { output?: unknown };

const LAYOUT_LIBRARY: LayoutSuggestion[] = [
  {
    pattern: "hero",
    description: "Large hero at the top with supporting cards below for CTA-heavy designs.",
    steps: [
      "Make the first layer a full-width hero block",
      "Stack the remaining elements in three columns",
      "Keep rotations at zero for a polished poster look",
    ],
  },
  {
    pattern: "grid",
    description: "Uniform two-to-three column grid for checklists, testimonials, or info cards.",
    steps: [
      "Distribute everything evenly across the canvas",
      "Align copy blocks with neighboring cards",
      "Use color to separate rows instead of random placement",
    ],
  },
  {
    pattern: "collage",
    description: "Loose collage with light rotation for zines, moodboards, and playful prompts.",
    steps: [
      "Stagger each element horizontally",
      "Apply gentle rotation swings for energy",
      "Keep at least 60px of breathing room near the edges",
    ],
  },
];

const PATTERNS: LayoutPattern[] = ["hero", "grid", "collage"];
const LAYOUT_MODEL = process.env.DIGITAL_CANVAS_ASSISTANT_MODEL ?? DEFAULT_COMPLETION_MODEL;

function pickFallbackLayout(prompt: string): LayoutSuggestion {
  const hash = createHash("sha256").update(prompt).digest();
  const index = hash[0] % LAYOUT_LIBRARY.length;
  return LAYOUT_LIBRARY[index];
}

function ensureSuggestion(suggestion: Partial<LayoutSuggestion>, prompt: string): LayoutSuggestion {
  const fallback = pickFallbackLayout(prompt);
  if (!suggestion.pattern || !PATTERNS.includes(suggestion.pattern)) {
    return fallback;
  }
  if (!suggestion.description || !suggestion.steps || suggestion.steps.length === 0) {
    return fallback;
  }
  return {
    pattern: suggestion.pattern,
    description: suggestion.description,
    steps: suggestion.steps.slice(0, 4),
  };
}

function extractJson<T>(response: AiResponsePayload): T | null {
  const blocks = (response.output ?? []) as AiResponseBlock[];
  for (const block of blocks) {
    for (const item of block.content ?? []) {
      if (item.type === "output_json" && item.json) {
        return item.json as T;
      }
      if (item.type === "output_text" && item.text) {
        try {
          return JSON.parse(item.text) as T;
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: string };
  try {
    body = (await request.json()) as { prompt?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (!openaiClient) {
    return NextResponse.json({ layout: pickFallbackLayout(prompt) });
  }

  try {
    const completion = await openaiClient.responses.create({
      model: LAYOUT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You suggest layout patterns for posters. Choose only hero, grid, or collage. Respond ONLY with JSON {\\\"pattern\\\":\\\"hero|grid|collage\\\",\\\"description\\\":\\\"...\\\",\\\"steps\\\":[\\\"...\\\",\\\"...\\\",\\\"...\\\"]}. Steps must mention concrete adjustments like align, stack, rotate, crop.",
        },
        {
          role: "user",
          content: `Prompt: ${prompt}`,
        },
      ],
      max_output_tokens: 600,
    });

    const parsed = extractJson<LayoutSuggestion>(completion);
    const layout = ensureSuggestion(parsed ?? {}, prompt);
    return NextResponse.json({ layout });
  } catch (error) {
    console.error("suggest-layout", error);
    return NextResponse.json({ layout: pickFallbackLayout(prompt) });
  }
}
