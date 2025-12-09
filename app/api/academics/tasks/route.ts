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
    .from("study_tasks")
    .select("id, label, due, priority, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("tasks GET", error);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
  return NextResponse.json({ tasks: data });
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
    label?: string;
    due?: string;
    priority?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const label = body.label?.trim();
  if (!label) {
    return NextResponse.json({ error: "Task label is required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdminClient
    .from("study_tasks")
    .insert({
      label,
      due: body.due?.trim() ?? "",
      priority: body.priority?.trim() ?? "Medium",
    })
    .select("id, label, due, priority, created_at")
    .single();
  if (error) {
    console.error("tasks POST", error);
    return NextResponse.json({ error: "Failed to add task" }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}
