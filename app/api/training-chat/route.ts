import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { openaiClient } from "@/lib/aiClients";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function ensureAuth() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

const SYSTEM_PROMPT = `You are CodexLab Coach, a dual legal + academic training assistant.
- Keep conversations concise, cite sources only if user provides them.
- When you have concrete suggestions for the dashboard forms, output them as JSON at the end of your response using this format:
\`\`\`json
{ "form_updates": { "session": { "title": "", "objective": "" }, "run": { "query": "", "additionalFacts": "" } } }
\`\`\`
- Fill only the fields you are confident about; omit others or leave empty strings. Always respond with natural language guidance before the JSON block.`;

export async function POST(request: Request) {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }

  if (!openaiClient) {
    return NextResponse.json({ error: "OpenAI client unavailable" }, { status: 500 });
  }

  let body: {
    domain?: "legal" | "academic";
    instructions?: string;
    messages?: ChatMessage[];
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const domain = body.domain === "academic" ? "academic" : "legal";
  const instructions = (body.instructions ?? "").trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];

  const conversation: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `You are currently assisting with the ${domain.toUpperCase()} lab.` },
  ];

  if (instructions) {
    conversation.push({
      role: "system",
      content: `User custom instructions: ${instructions}`,
    });
  }

  conversation.push(...messages);

  try {
    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_TRAINING_MODEL ?? "gpt-5.1",
      messages: conversation,
      temperature: 0.4,
    });

    const content = completion.choices[0]?.message?.content ?? "I couldn't produce a reply.";
    return NextResponse.json({
      reply: content,
      usage: completion.usage,
    });
  } catch (error) {
    console.error("training-chat POST", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat request failed" },
      { status: 500 }
    );
  }
}
