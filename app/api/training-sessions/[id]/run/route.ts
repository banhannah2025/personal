import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { runTrainingPipeline } from "@/lib/trainingPipeline";
import { supabaseAdminClient } from "@/lib/supabase";

async function ensureAuth() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }
  const { id } = await context.params;
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
  }
  let payload: {
    promptTemplateId?: string;
    query?: string;
    additionalFacts?: string;
    reasoningLevel?: number;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload.promptTemplateId) {
    return NextResponse.json({ error: "promptTemplateId is required" }, { status: 400 });
  }
  if (!payload.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabaseAdminClient
    .from("training_sessions")
    .select("id, domain")
    .eq("id", id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Training session not found" }, { status: 404 });
  }

  try {
    const result = await runTrainingPipeline({
      sessionId: session.id,
      domain: session.domain,
      promptTemplateId: payload.promptTemplateId,
      query: payload.query,
      additionalFacts: payload.additionalFacts,
      reasoningLevel: payload.reasoningLevel,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("training-sessions run", error);
    await supabaseAdminClient
      .from("training_sessions")
      .update({ status: "needs_input" })
      .eq("id", session.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Training run failed" },
      { status: 500 }
    );
  }
}
