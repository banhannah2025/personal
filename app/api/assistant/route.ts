import { NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { getWorkspaceSnapshot } from "@/lib/workspaceSnapshot";
import { getReasoningLevel, type ReasoningLevelId } from "@/lib/reasoning";
import { DEFAULT_GPT51_MODEL, GPT51_MODELS, type Gpt51Model } from "@/lib/models";
import { appendMemory, readMemory } from "@/lib/memoryStore";
import { currentUser } from "@clerk/nextjs/server";
import { isAdminFromMetadata } from "@/lib/roles";

type AssistantRequest = {
  prompt: string;
  model?: Gpt51Model;
  reasoning?: ReasoningLevelId;
};

type FileAction =
  | "edit"
  | "add"
  | "delete";

type AssistantResponse = {
  overview: string;
  file_operations: Array<{
    action: FileAction;
    path: string;
    summary: string;
    code?: string;
    location?: string;
  }>;
  additional_notes?: string;
};

const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "OPENAI_API_KEY"
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

async function ensureAdmin() {
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  if (!user || !isAdminFromMetadata(user.publicMetadata, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const unauthorized = await ensureAdmin();
  if (unauthorized) {
    return unauthorized;
  }
  const memory = await readMemory();
  return NextResponse.json({ history: memory });
}

export async function POST(request: Request) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) {
    return unauthorized;
  }
  if (!openai) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured" },
      { status: 500 }
    );
  }

  let body: AssistantRequest;
  try {
    body = (await request.json()) as AssistantRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    const snapshot = await getWorkspaceSnapshot();

    const requestedModel = body.model;
    const model =
      requestedModel && GPT51_MODELS.includes(requestedModel)
        ? requestedModel
        : DEFAULT_GPT51_MODEL;
    const reasoning = getReasoningLevel(body.reasoning);

    const contextText = buildContextText(snapshot);

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: reasoning.maxOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are Codex, an AI pair programmer with full read access to the provided workspace snapshot.",
            "Follow this repository's style: TypeScript, functional React components, Tailwind CSS v4 utilities, and no inline styles unless absolutely necessary.",
            "Given the user's instruction, determine which files to edit or create. Return your plan as JSON with this schema:",
            "{ overview: string, file_operations: [{ action: 'edit' | 'add' | 'delete', path: string, summary: string, code?: string, location?: string }], additional_notes?: string }.",
            "Never invent directories outside the repo roots, and always include a short code sample for each operation when possible.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `User prompt: ${prompt}`,
            `Reasoning preference: ${reasoning.label} (${reasoning.description}).`,
            "Workspace snapshot:",
            contextText,
          ].join("\n\n"),
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return NextResponse.json(
        { error: "Model did not return a response" },
        { status: 500 }
      );
    }

    let parsed: AssistantResponse;
    try {
      parsed = JSON.parse(rawContent) as AssistantResponse;
    } catch (error) {
      console.error("Failed to parse assistant response", error, rawContent);
      return NextResponse.json(
        { error: "Model response was not valid JSON" },
        { status: 500 }
      );
    }

    await appendMemory({
      id: randomUUID(),
      prompt,
      response: parsed,
      model: completion.model,
      reasoning: reasoning.id,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      plan: parsed,
      model: completion.model,
      usage: completion.usage,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to process request" }, { status: 500 });
  }
}

function buildContextText(snapshot: Awaited<ReturnType<typeof getWorkspaceSnapshot>>) {
  const blocks: string[] = [];
  const limitedFiles = snapshot.files.slice(0, 30);
  for (const file of limitedFiles) {
    blocks.push(
      [
        `Path: ${file.path}`,
        `Size: ${file.size} bytes, Updated: ${new Date(file.mtimeMs).toISOString()}`,
        "Preview:",
        "```",
        file.preview,
        "```",
      ].join("\n")
    );
  }
  if (snapshot.files.length > limitedFiles.length) {
    blocks.push(
      `...and ${snapshot.files.length - limitedFiles.length} more files not shown due to context limits.`
    );
  }
  return blocks.join("\n\n");
}
