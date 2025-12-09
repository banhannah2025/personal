import { NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";
import { isAdminFromMetadata } from "@/lib/roles";

type ChatRole = "user" | "assistant";

type AdminChatRequest = {
  prompt: string;
  history?: Array<{ role: ChatRole; content: string }>;
};

const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "OPENAI_API_KEY"
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

export async function POST(request: Request) {
  if (!openai) {
    return NextResponse.json({ error: "OpenAI API key missing" }, { status: 500 });
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  if (!user || !isAdminFromMetadata(user.publicMetadata, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: AdminChatRequest;
  try {
    body = (await request.json()) as AdminChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const sanitizedHistory = (body.history ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-8);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1-chat-latest",
      temperature: 0.3,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You are an admin-facing GPT-5 knowledge partner for CCPROS. Provide concise, accurate answers, suggest next steps, and note when additional data or human approval is required.",
        },
        ...sanitizedHistory,
        { role: "user", content: prompt },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({ error: "Model returned no reply" }, { status: 500 });
    }

    return NextResponse.json({ reply, model: completion.model, usage: completion.usage });
  } catch (error) {
    console.error("admin-chat error", error);
    return NextResponse.json({ error: "Unable to complete request" }, { status: 500 });
  }
}
