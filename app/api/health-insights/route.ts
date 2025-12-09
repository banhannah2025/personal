import { NextResponse } from "next/server";
import OpenAI from "openai";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdminClient } from "@/lib/supabase";
import { embedQuery, retrieveChunks } from "@/lib/rag";

type HealthInsightRequest = {
  members: Array<{ name: string; age: string; healthNotes: string }>;
  budget: Array<{ category: string; monthly: number }>;
  medicalHistory: string;
  healthGoals: string;
  latestJournal?: {
    mood: string;
    energy: string;
    concerns: string;
    goalsImpact: string;
  };
};

type HealthInsightResponse = {
  summary: string;
  recommendations: Array<{ title: string; detail: string }>;
  citations: Array<{ source: string; title: string; excerpt: string }>;
};

const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "OPENAI_API_KEY"
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

function buildFallbackResponse(body: HealthInsightRequest): HealthInsightResponse {
  const memberCount = body.members?.length ?? 0;
  const budgetTotal = (body.budget ?? []).reduce((sum, line) => sum + (Number(line.monthly) || 0), 0);
  const latestMood = body.latestJournal?.mood ?? "Steady";
  const latestConcern = body.latestJournal?.concerns || body.medicalHistory || "general wellbeing";
  const summary = [
    `Household of ${memberCount || "unknown"} working on ${body.healthGoals || "overall health"}.`,
    `Approximate monthly budget: $${budgetTotal.toFixed(2)}.`,
    `Recent mood: ${latestMood}. Key focus: ${latestConcern}.`,
  ].join(" ");

  const recommendations = [
    {
      title: "Weekly routine",
      detail: `Plan a recurring shopping and prep cycle that respects the $${budgetTotal.toFixed(
        2
      )} monthly budget while prioritizing anti-inflammatory meals.`,
    },
    {
      title: "Mindful check-ins",
      detail: "Log mood + energy at least twice a week to help AI refine meal and recovery prompts.",
    },
    {
      title: "Budget alignment",
      detail:
        "Assign categories (produce, proteins, supplements) to each grocery outing so future AI recommendations stay grounded in real spending.",
    },
  ];

  return { summary, recommendations, citations: [] };
}

async function buildAcademicContext(body: HealthInsightRequest) {
  if (!supabaseAdminClient) {
    return {
      text: "Academic references unavailable.",
      citations: [] as HealthInsightResponse["citations"],
    };
  }
  try {
    const parts: string[] = [
      `Health goals: ${body.healthGoals || "N/A"}`,
      `Medical history: ${body.medicalHistory || "N/A"}`,
    ];
    if (body.members?.length) {
      parts.push(
        "Members:\n" +
          body.members
            .map((member) => `${member.name || "Unknown"} (${member.age || "?"}) - ${member.healthNotes || "No notes"}`)
            .join("\n")
      );
    }
    if (body.latestJournal) {
      parts.push(
        `Latest journal -> Mood: ${body.latestJournal.mood}; Energy: ${body.latestJournal.energy}; Concerns: ${body.latestJournal.concerns}; Goals impact: ${body.latestJournal.goalsImpact}`
      );
    }
    const query = parts.join("\n\n");
    const embedding = await embedQuery(query);
    const chunks = await retrieveChunks(supabaseAdminClient, embedding, {
      domain: "academic",
      matchCount: 6,
    });
    if (!chunks.length) {
      return {
        text: "No matching academic references.",
        citations: [],
      };
    }
    const citations = chunks.map((chunk, index) => ({
      source: `Source ${index + 1}`,
      title: chunk.document_title || "Untitled document",
      excerpt: chunk.content.slice(0, 400),
    }));
    const text = chunks
      .map(
        (chunk, index) =>
          `Source ${index + 1}: ${chunk.document_title || "Untitled"}\n${chunk.content.trim()}`
      )
      .join("\n\n");
    return { text, citations };
  } catch (error) {
    console.error("health-insights academic context", error);
    return {
      text: "Academic references unavailable due to retrieval error.",
      citations: [],
    };
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: HealthInsightRequest;
  try {
    body = (await request.json()) as HealthInsightRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fallback = buildFallbackResponse(body);
  const academicContext = await buildAcademicContext(body);

  if (!openai) {
    return NextResponse.json({ ...fallback, citations: academicContext.citations });
  }

  try {
    const completion = await openai.responses.create({
      model: "gpt-5.1-chat-latest",
      max_output_tokens: 600,
      text: { format: { type: "json_object" } },
      input: [
        {
          role: "system",
          content:
            "You are a collaborative health coach helping households align meals, budgets, and wellbeing. Respond with JSON: { summary: string, recommendations: [{ title: string, detail: string }] }.",
        },
        {
          role: "system",
          content: `Academic evidence you can reference:\n${academicContext.text}`,
        },
        {
          role: "user",
          content: JSON.stringify(body),
        },
      ],
    });

    type OutputText = { type: "output_text"; text: string };
    type OutputMessage = { type: "message"; content: OutputText[] };
    const firstOutput = completion.output?.[0] as OutputText | OutputMessage | undefined;
    const raw =
      firstOutput?.type === "message"
        ? firstOutput.content.find((part) => part.type === "output_text")
        : firstOutput;
    if (!raw) {
      return NextResponse.json(fallback);
    }

    if (raw.type === "output_text") {
      try {
        const parsed = JSON.parse(raw.text) as HealthInsightResponse;
        return NextResponse.json({ ...parsed, citations: academicContext.citations });
      } catch (error) {
        console.error("Failed to parse health insight", error, raw.text);
        return NextResponse.json({ ...fallback, citations: academicContext.citations });
      }
    }

    return NextResponse.json({ ...fallback, citations: academicContext.citations });
  } catch (error) {
    console.error("health-insights", error);
    return NextResponse.json({ ...fallback, citations: academicContext.citations });
  }
}
