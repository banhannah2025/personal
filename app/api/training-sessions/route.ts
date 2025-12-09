import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdminClient } from "@/lib/supabase";

async function ensureAuth() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
  }
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain") === "academic" ? "academic" : "legal";
  const { data, error } = await supabaseAdminClient
    .from("training_sessions")
    .select("id, domain, title, objective, status, scheduled_for, created_at")
    .eq("domain", domain)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("training-sessions GET", error);
    return NextResponse.json({ error: "Failed to load training sessions" }, { status: 500 });
  }
  return NextResponse.json({ sessions: data });
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
  }
  let payload: {
    domain?: "legal" | "academic";
    title?: string;
    objective?: string;
    scheduled_for?: string | null;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const domain = payload.domain === "academic" ? "academic" : "legal";
  const title = payload.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdminClient
    .from("training_sessions")
    .insert({
      domain,
      title,
      objective: payload.objective?.trim() ?? "",
      status: "draft",
      scheduled_for: payload.scheduled_for ?? null,
    })
    .select("id, domain, title, objective, status, scheduled_for, created_at")
    .single();
  if (error) {
    console.error("training-sessions POST", error);
    return NextResponse.json({ error: "Failed to create training session" }, { status: 500 });
  }
  return NextResponse.json({ session: data });
}
