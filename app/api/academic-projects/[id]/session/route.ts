import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdminClient } from "@/lib/supabase";

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("unauthorized");
  return user;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    const { data: project, error: projectError } = await supabaseAdminClient
      .from("academic_projects")
      .select("id, title, question, instructions, discipline, session_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.session_id) {
      return NextResponse.json({ error: "Session already linked for this project" }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabaseAdminClient
      .from("training_sessions")
      .insert({
        domain: "academic",
        title: project.title,
        objective: [project.question, project.instructions, project.discipline ? `Discipline: ${project.discipline}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        status: "draft",
      })
      .select("id, title, status, created_at")
      .single();
    if (sessionError || !session) {
      throw sessionError ?? new Error("Failed to create session");
    }

    const { error: updateError } = await supabaseAdminClient
      .from("academic_projects")
      .update({ session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ session });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("academic-projects session POST", error);
    return NextResponse.json({ error: "Failed to create training session" }, { status: 500 });
  }
}
