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
    .from("writing_drafts")
    .select("id, title, focus, status, summary, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("drafts GET", error);
    return NextResponse.json({ error: "Failed to load drafts" }, { status: 500 });
  }
  return NextResponse.json({ drafts: data });
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
    title?: string;
    focus?: string;
    status?: string;
    summary?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdminClient
    .from("writing_drafts")
    .insert({
      title,
      focus: body.focus?.trim() ?? "",
      status: body.status?.trim() ?? "Notes",
      summary: body.summary?.trim() ?? "",
    })
    .select("id, title, focus, status, summary, created_at")
    .single();
  if (error) {
    console.error("drafts POST", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
  return NextResponse.json({ draft: data });
}
