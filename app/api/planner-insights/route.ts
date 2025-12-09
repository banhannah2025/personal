import { NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";

type PlannerInsightRequest = {
  notes: Array<{ title: string; content: string; tag: string }>;
  journals: Array<{ mood: string; reflection: string; createdAt: string }>;
  weeklyFocus: Array<{ day: string; focus: string }>;
};

type PlannerInsightResponse = {
  summary: string;
  prompts: Array<{ title: string; detail: string }>;
};

const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "OPENAI_API_KEY"
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

function buildPlannerFallback(body: PlannerInsightRequest): PlannerInsightResponse {
  const noteTitle = body.notes.at(-1)?.title ?? "Capture a note";
  const journalMood = body.journals[0]?.mood ?? "Untracked";
  const reflection = body.journals[0]?.reflection ?? "Add a reflection to unlock deeper insights.";
  const weeklyFocus = body.weeklyFocus.map((day) => `${day.day}: ${day.focus}`).join(", ");
  return {
    summary: `Latest note "${noteTitle}" combined with current mood "${journalMood}". Weekly focus: ${weeklyFocus}.`,
    prompts: [
      {
        title: "Morning alignment",
        detail: `Review the note "${noteTitle}" and translate it into a top priority for today's focus.`,
      },
      {
        title: "Journal follow-up",
        detail: `Reflect on: ${reflection}. Decide on one concrete action to reinforce the desired mood.`,
      },
      {
        title: "Planner sync",
        detail: "Schedule one calendar block that connects your latest note, journal insight, and weekly theme.",
      },
    ],
  };
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PlannerInsightRequest;
  try {
    body = (await request.json()) as PlannerInsightRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fallback = buildPlannerFallback(body);

  if (!openai) {
    return NextResponse.json(fallback);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1-chat-latest",
      max_completion_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a planning copilot. Given notes, journal entries, and weekly focus, respond with JSON { summary: string, prompts: [{ title: string, detail: string }] } to align the user and their AI assistant.",
        },
        {
          role: "user",
          content: JSON.stringify(body),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(fallback);
    }

    let parsed: PlannerInsightResponse;
    try {
      parsed = JSON.parse(raw) as PlannerInsightResponse;
    } catch (error) {
      console.error("planner-insights parse", error, raw);
      return NextResponse.json(fallback);
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("planner-insights error", error);
    return NextResponse.json(fallback);
  }
}
