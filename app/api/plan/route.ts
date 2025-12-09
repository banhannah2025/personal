import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import OpenAI from "openai";
import { MAX_FILE_BYTES, resolveSafePath } from "@/lib/repoAccess";
import { DEFAULT_GPT51_MODEL, GPT51_MODELS, type Gpt51Model } from "@/lib/models";
import { getReasoningLevel, type ReasoningLevelId } from "@/lib/reasoning";
import { currentUser } from "@clerk/nextjs/server";
import { isAdminFromMetadata } from "@/lib/roles";

type PlanRequest = {
  instructions: string;
  files?: string[];
  model?: Gpt51Model;
  reasoning?: ReasoningLevelId;
};

type PlanSuggestion = {
  type: "edit" | "add";
  path: string;
  summary: string;
  code: string;
  location?: string;
};

type PlanResult = {
  overview: string;
  suggestions: PlanSuggestion[];
};

const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "OPENAI_API_KEY"
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

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

  let body: PlanRequest;
  try {
    body = (await request.json()) as PlanRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const instructions = body.instructions?.trim();
  if (!instructions) {
    return NextResponse.json({ error: "Instructions are required" }, { status: 400 });
  }

  const uniqueFiles = Array.from(new Set(body.files ?? []));
  if (uniqueFiles.length === 0) {
    return NextResponse.json(
      { error: "Select at least one file to provide context" },
      { status: 400 }
    );
  }

  try {
    const contexts: { path: string; content: string }[] = [];
    for (const relativePath of uniqueFiles) {
      const resolved = resolveSafePath(relativePath);
      const stat = await fs.stat(resolved.absolutePath);
      if (!stat.isFile()) {
        return NextResponse.json(
          { error: `Path ${relativePath} is not a readable file` },
          { status: 400 }
        );
      }
      if (stat.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File ${relativePath} exceeds the size limit` },
          { status: 400 }
        );
      }
      const content = await fs.readFile(resolved.absolutePath, "utf8");
      contexts.push({ path: resolved.relativePath, content });
    }

    const requestedModel = body.model;
    const model =
      requestedModel && GPT51_MODELS.includes(requestedModel)
        ? requestedModel
        : DEFAULT_GPT51_MODEL;
    const reasoningLevel = getReasoningLevel(body.reasoning);

    const fileContextPayload = contexts
      .map(
        (ctx) => [
          `File: ${ctx.path}`,
          "```",
          ctx.content,
          "```",
          "",
        ].join("\n")
      )
      .join("\n");

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_output_tokens: reasoningLevel.maxOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are an advanced AI code planner, similar to GitHub Copilot's Codex agent.",
            "Follow this repository's style: modern TypeScript, functional React components, Tailwind CSS v4 utilities only, no inline styles.",
            "When suggesting new files include the target directory path.",
            "Respond only with JSON matching the schema: { overview: string, suggestions: [{ type: 'edit' | 'add', path: string, summary: string, code: string, location?: string }] }.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Goal: ${instructions}`,
            `Reasoning: ${reasoningLevel.label} (${reasoningLevel.description})`,
            "Context files:",
            fileContextPayload,
            "Remember to propose edits for existing files and describe any new files or directories required.",
          ].join("\n\n"),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Model did not return any plan" },
        { status: 500 }
      );
    }

    let parsed: PlanResult;
    try {
      parsed = JSON.parse(content) as PlanResult;
    } catch (error) {
      console.error("Failed to parse plan JSON", error, content);
      return NextResponse.json(
        { error: "Model response was not valid JSON" },
        { status: 500 }
      );
    }

    if (
      !parsed ||
      typeof parsed.overview !== "string" ||
      !Array.isArray(parsed.suggestions)
    ) {
      return NextResponse.json(
        { error: "Model response missing expected fields" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      overview: parsed.overview,
      suggestions: parsed.suggestions,
      model: completion.model,
      usage: completion.usage,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to create plan" },
      { status: 500 }
    );
  }
}
