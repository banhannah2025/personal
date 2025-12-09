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
    .from("research_sources")
    .select("id, title, type, link, reliability, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("sources GET", error);
    return NextResponse.json({ error: "Failed to load sources" }, { status: 500 });
  }
  return NextResponse.json({ sources: data });
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
    type?: string;
    link?: string;
    reliability?: "Key" | "Support" | "Review";
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
    .from("research_sources")
    .insert({
      title,
      type: body.type?.trim() ?? "Article",
      link: body.link?.trim() ?? "",
      reliability: body.reliability ?? "Support",
    })
    .select("id, title, type, link, reliability, created_at")
    .single();
  if (error) {
    console.error("sources POST", error);
    return NextResponse.json({ error: "Failed to save source" }, { status: 500 });
  }
  return NextResponse.json({ source: data });
}
