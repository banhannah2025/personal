import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { openaiClient, DEFAULT_COMPLETION_MODEL } from "@/lib/aiClients";
import type { CanvasElement } from "@/app/app/digital-canvas/types";

type CanvasElementSnapshot = {
  id: CanvasElement["id"];
  type: CanvasElement["type"];
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  borderRadius?: number;
  fontFamily?: string;
  align?: "left" | "center" | "right";
};

type AiEditResponse = {
  edits?: Array<{ id: string; updates: Partial<CanvasElementSnapshot> }>;
  notes?: string;
};

const MODEL = process.env.DIGITAL_CANVAS_ASSISTANT_MODEL ?? DEFAULT_COMPLETION_MODEL;
const ALLOWED_FIELDS = new Set([
  "x",
  "y",
  "width",
  "height",
  "fill",
  "text",
  "fontSize",
  "rotation",
  "opacity",
  "borderRadius",
  "fontFamily",
  "align",
]);

function serializeElements(elements: CanvasElement[]): CanvasElementSnapshot[] {
  return elements.slice(0, 30).map((element) => ({
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    rotation: element.rotation,
    opacity: element.opacity,
    width: "width" in element ? element.width : undefined,
    height: "height" in element ? element.height : undefined,
    fill: "fill" in element ? element.fill : undefined,
    text: element.type === "text" ? element.text : undefined,
    fontSize: element.type === "text" ? element.fontSize : undefined,
    borderRadius: element.type === "rect" ? element.borderRadius : undefined,
    fontFamily: element.type === "text" ? element.fontFamily : undefined,
    align: element.type === "text" ? element.align : undefined,
  }));
}

function fallbackResponse(message: string) {
  return NextResponse.json({ edits: [], notes: message });
}

type AiContentChunk = { type: string; text?: string; json?: unknown };
type AiResponseBlock = { content?: AiContentChunk[] };
type AiResponsePayload = { output?: unknown };

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

function sanitizeEdits(edits: AiEditResponse["edits"]): Array<{ id: string; updates: Partial<CanvasElement> }> {
  if (!Array.isArray(edits)) {
    return [];
  }
  const sanitized: Array<{ id: string; updates: Partial<CanvasElement> }> = [];
  for (const edit of edits.slice(0, 20)) {
    if (!edit || typeof edit.id !== "string" || !edit.updates) continue;
    const filteredEntries = Object.entries(edit.updates).filter(([key, value]) => {
      if (!ALLOWED_FIELDS.has(key)) return false;
      if (typeof value === "number" || typeof value === "string") {
        return true;
      }
      return false;
    });
    if (!filteredEntries.length) continue;
    sanitized.push({ id: edit.id, updates: Object.fromEntries(filteredEntries) });
  }
  return sanitized;
}

const SYSTEM_PROMPT = `You are the Digital Canvas layout assistant. Given the current canvas layers and a user instruction, respond ONLY with JSON matching this schema:
{
  "edits": [{ "id": "element-id", "updates": { "x": number, "y": number, "width": number, "height": number, "fill": "#HEX", "text": "new copy", "fontSize": number, "rotation": number, "opacity": number, "borderRadius": number, "fontFamily": "Inter", "align": "left|center|right" } }],
  "notes": "Short summary of what changed"
}
Only return fields you want to override. Do not invent element ids. Prefer subtle adjustments over drastic moves.`;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: string; elements?: CanvasElement[] };
  try {
    body = (await request.json()) as { prompt?: string; elements?: CanvasElement[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (!openaiClient) {
    return fallbackResponse("AI edit is offline. Try manual adjustments.");
  }

  const elements = Array.isArray(body.elements) ? (body.elements as CanvasElement[]) : [];
  const serialized = serializeElements(elements);

  try {
    const completion = await openaiClient.responses.create({
      model: MODEL,
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Current layers:\n${JSON.stringify(serialized, null, 2)}\n\nInstruction: ${prompt}`,
        },
      ],
      max_output_tokens: 800,
    });

    const parsed = extractJson<AiEditResponse>(completion) ?? { edits: [], notes: "No changes" };
    const edits = sanitizeEdits(parsed.edits);
    return NextResponse.json({
      edits,
      notes: parsed.notes ?? (edits.length ? "Applied AI adjustments." : "No changes suggested."),
    });
  } catch (error) {
    console.error("canvas-edit", error);
    return fallbackResponse("AI edit failed. Try again.");
  }
}
