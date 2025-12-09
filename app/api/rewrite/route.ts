import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import OpenAI from "openai";
import { MAX_FILE_BYTES, resolveSafePath } from "@/lib/repoAccess";
import { DEFAULT_GPT51_MODEL, GPT51_MODELS, type Gpt51Model } from "@/lib/models";
import { getReasoningLevel, type ReasoningLevelId } from "@/lib/reasoning";
import { currentUser } from "@clerk/nextjs/server";
import { isAdminFromMetadata } from "@/lib/roles";

type RewriteRequest = {
  path: string;
  goal?: string;
  model?: Gpt51Model;
  reasoning?: ReasoningLevelId;
};

const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "OPENAI_API_KEY"
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    : null;

const CODING_STYLE =
  "Follow the repository conventions: use modern TypeScript with strict typing enabled, prefer functional React components, and build UI with Tailwind CSS v4 utility classes (no inline styles). Preserve existing Tailwind tokens and match naming conventions.";

export async function POST(request: Request) {
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  if (!user || !isAdminFromMetadata(user.publicMetadata, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!openai) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured" },
      { status: 500 }
    );
  }

  let body: RewriteRequest;
  try {
    body = (await request.json()) as RewriteRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.path) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  try {
    const resolved = resolveSafePath(body.path);
    const stat = await fs.stat(resolved.absolutePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Only files can be rewritten" }, { status: 400 });
    }
    if (stat.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File is too large for automated rewrites" },
        { status: 400 }
      );
    }
    const fileContents = await fs.readFile(resolved.absolutePath, "utf8");

    const goal =
      body.goal?.trim() ||
      "Improve readability and follow best practices without changing behavior.";
    const requestedModel = body.model;
    const model =
      requestedModel && GPT51_MODELS.includes(requestedModel)
        ? requestedModel
        : DEFAULT_GPT51_MODEL;
    const reasoningLevel = getReasoningLevel(body.reasoning);

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: reasoningLevel.maxOutputTokens,
      messages: [
        {
          role: "system",
          content: [
            "You are a meticulous code editor.",
            CODING_STYLE,
            `Reasoning preference: ${reasoningLevel.label} (${reasoningLevel.description}).`,
            "Produce the full updated file as a Markdown code block. Do not add commentary outside the block.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `File path: ${resolved.relativePath}`,
            `Goal: ${goal}`,
            "Existing file:",
            "```",
            fileContents,
            "```",
          ].join("\n"),
        },
      ],
    });

    const suggestion = completion.choices[0]?.message?.content?.trim();
    if (!suggestion) {
      return NextResponse.json({ error: "Model did not return any content" }, { status: 500 });
    }

    return NextResponse.json({
      path: resolved.relativePath,
      suggestion,
      model: completion.model,
      reasoning: reasoningLevel.id,
      usage: completion.usage,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to rewrite file" }, { status: 500 });
  }
}
