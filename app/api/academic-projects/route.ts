import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdminClient } from "@/lib/supabase";

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("unauthorized");
  return user;
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    const { data, error } = await supabaseAdminClient
      .from("academic_projects")
      .select("id, title, question, instructions, discipline, last_answer, session_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ projects: data ?? [] });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("academic-projects GET", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    let payload: {
      title?: string;
      question?: string;
      instructions?: string;
      discipline?: string;
      answer?: string;
    };
    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const title = payload.title?.trim();
    const question = payload.question?.trim();
    if (!title || !question) {
      return NextResponse.json({ error: "Title and question are required" }, { status: 400 });
    }
    const { data, error } = await supabaseAdminClient
      .from("academic_projects")
      .insert({
        user_id: user.id,
        title,
        question,
        instructions: payload.instructions?.trim() ?? "",
        discipline: payload.discipline?.trim() ?? "",
        last_answer: payload.answer ?? "",
      })
      .select("id, title, question, instructions, discipline, last_answer, session_id, created_at, updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ project: data });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("academic-projects POST", error);
    return NextResponse.json({ error: "Failed to save project" }, { status: 500 });
  }
}
