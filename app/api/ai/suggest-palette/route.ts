import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { openaiClient, DEFAULT_COMPLETION_MODEL } from "@/lib/aiClients";

type PaletteResponse = { colors: string[]; description: string };
type AiContentChunk = { type: string; text?: string; json?: unknown };
type AiResponseBlock = { content?: AiContentChunk[] };
type AiResponsePayload = { output?: unknown };

const FALLBACK_MESSAGE = "Palette suggested offline. Use AI again for richer context.";
const PALETTE_MODEL = process.env.DIGITAL_CANVAS_ASSISTANT_MODEL ?? DEFAULT_COMPLETION_MODEL;

function buildFallbackPalette(prompt: string): PaletteResponse {
  const hash = createHash("sha256").update(prompt).digest();
  const colors: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const start = i * 3;
    const slice = hash.subarray(start, start + 3);
    const hex = Array.from(slice)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 6);
    colors.push(`#${hex}`);
  }
  return {
    colors,
    description: `Palette inspired by "${prompt}". ${FALLBACK_MESSAGE}`,
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
    return NextResponse.json(buildFallbackPalette(prompt));
  }

  try {
    const completion = await openaiClient.responses.create({
      model: PALETTE_MODEL,
      input: [
        {
          role: "system",
          content:
            "You create color palettes for posters. Respond ONLY with JSON: {\"colors\":[\"#RRGGBB\"...],\"description\":\"...\"}. Provide 5 high-contrast colors.",
        },
        {
          role: "user",
          content: `Prompt: ${prompt}`,
        },
      ],
      max_output_tokens: 400,
    });

    const parsed = extractJson<PaletteResponse>(completion);
    if (!parsed || !Array.isArray(parsed.colors) || parsed.colors.length === 0) {
      return NextResponse.json(buildFallbackPalette(prompt));
    }

    const sanitizedColors = parsed.colors
      .map((color) => (typeof color === "string" ? color.trim().toUpperCase() : null))
      .filter((color): color is string => Boolean(color && color.startsWith("#")));

    if (!sanitizedColors.length) {
      return NextResponse.json(buildFallbackPalette(prompt));
    }

    return NextResponse.json({
      colors: sanitizedColors.slice(0, 6),
      description: parsed.description || `Palette inspired by "${prompt}"`,
    });
  } catch (error) {
    console.error("suggest-palette", error);
    return NextResponse.json(buildFallbackPalette(prompt));
  }
}
