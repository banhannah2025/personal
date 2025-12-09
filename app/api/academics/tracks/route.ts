import { NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";

async function ensureAuth() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
  }
  const { data, error } = await supabaseAdminClient
    .from("research_tracks")
    .select("id, topic, question, timeframe, status, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("tracks GET", error);
    return NextResponse.json({ error: "Failed to load research tracks" }, { status: 500 });
  }
  return NextResponse.json({ tracks: data });
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
  }
  let body: {
    topic?: string;
    question?: string;
    timeframe?: string;
    status?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdminClient
    .from("research_tracks")
    .insert({
      topic,
      question: body.question?.trim() ?? "",
      timeframe: body.timeframe?.trim() ?? "TBD",
      status: body.status?.trim() || "Exploratory",
    })
    .select("id, topic, question, timeframe, status, created_at")
    .single();
  if (error) {
    console.error("tracks POST", error);
    return NextResponse.json({ error: "Failed to create research track" }, { status: 500 });
  }
  return NextResponse.json({ track: data });
}
