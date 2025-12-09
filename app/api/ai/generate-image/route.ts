import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { openaiClient } from "@/lib/aiClients";

const DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
const DEFAULT_IMAGE_SIZE = (process.env.DIGITAL_CANVAS_IMAGE_SIZE ?? "1024x1024") as
  | "256x256"
  | "512x512"
  | "1024x1024"
  | "1024x1792"
  | "1792x1024"
  | "1536x1024"
  | "1024x1536"
  | "auto";

function buildPlaceholder(prompt: string) {
  const sanitized = encodeURIComponent(prompt.slice(0, 32) || "Digital Canvas");
  return `https://dummyimage.com/1024x1024/0f172a/ffffff.png&text=${sanitized}`;
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

  const placeholderUrl = buildPlaceholder(prompt);

  if (!openaiClient) {
    return NextResponse.json({ imageUrl: placeholderUrl, provider: "placeholder" });
  }

  try {
    const response = await openaiClient.images.generate({
      model: DEFAULT_IMAGE_MODEL,
      prompt,
      size: DEFAULT_IMAGE_SIZE,
      quality: "standard",
      response_format: "b64_json",
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ imageUrl: placeholderUrl, provider: "placeholder" });
    }
    const imageUrl = `data:image/png;base64,${b64}`;
    return NextResponse.json({ imageUrl, provider: DEFAULT_IMAGE_MODEL });
  } catch (error) {
    console.error("generate-image error", error);
    return NextResponse.json({ imageUrl: placeholderUrl, provider: "placeholder" });
  }
}
