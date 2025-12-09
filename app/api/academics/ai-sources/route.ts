import { NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";

const BUCKET = "academics-assets";

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
    .from("ai_research_sources")
    .select("id, query, title, summary, url, insights, storage_path, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("ai-sources GET", error);
    return NextResponse.json({ error: "Failed to load AI sources" }, { status: 500 });
  }

  const sources = await Promise.all(
    data.map(async (entry) => {
      if (!entry.storage_path) {
        return { ...entry, downloadUrl: null };
      }
      const { data: signed, error: signedError } = await supabaseAdminClient.storage
        .from(BUCKET)
        .createSignedUrl(entry.storage_path, 60 * 60); // 1 hour
      if (signedError) {
        console.error("ai-sources signed url", signedError);
        return { ...entry, downloadUrl: null };
      }
      return { ...entry, downloadUrl: signed.signedUrl };
    })
  );

  return NextResponse.json({ aiSources: sources });
}
