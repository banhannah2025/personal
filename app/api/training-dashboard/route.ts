import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdminClient } from "@/lib/supabase";

type DomainType = "legal" | "academic";

const DOCUMENT_STATUSES = ["pending_ingest", "ingested", "needs_review", "archived"] as const;
const SESSION_STATUSES = ["draft", "in_progress", "needs_input", "completed"] as const;

async function ensureAuth() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function parseDomain(request: Request): DomainType {
  const url = new URL(request.url);
  const value = url.searchParams.get("domain");
  return value === "academic" ? "academic" : "legal";
}

async function countRows(
  table: string,
  filters: Record<string, string | number | boolean>
): Promise<number> {
  if (!supabaseAdminClient) {
    throw new Error("Supabase client unavailable");
  }
  let query = supabaseAdminClient.from(table).select("id", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key as never, value as never);
  }
  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function GET(request: Request) {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
  }

  const domain = parseDomain(request);

  try {
    const [
      corporaResponse,
      latestSessions,
      recentOutputs,
      feedbackEntries,
      ingestionJobs,
      retrainingJobs,
      promptTemplates,
    ] = await Promise.all([
      supabaseAdminClient
        .from("corpus_collections")
        .select("id, name, description, source_type, access_level, metadata")
        .eq("domain", domain)
        .order("name", { ascending: true }),
      supabaseAdminClient
        .from("training_sessions")
        .select("id, title, status, objective, scheduled_for, started_at, completed_at, created_at")
        .eq("domain", domain)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdminClient
        .from("generated_documents")
        .select("id, title, doc_type, status, validation_status, created_at")
        .eq("domain", domain)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdminClient
        .from("feedback_entries")
        .select("id, issue_type, severity, notes, created_at")
        .eq("domain", domain)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdminClient
        .from("ingestion_jobs")
        .select("id, job_type, status, created_at, completed_at, error_message")
        .eq("domain", domain)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdminClient
        .from("retraining_jobs")
        .select("id, source, status, dataset_size, created_at, completed_at, notes")
        .eq("domain", domain)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdminClient
        .from("prompt_templates")
        .select("id, name, description, template_kind, domain, instructions")
        .eq("domain", domain)
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    if (
      corporaResponse.error ||
      latestSessions.error ||
      recentOutputs.error ||
      feedbackEntries.error ||
      ingestionJobs.error ||
      retrainingJobs.error ||
      promptTemplates.error
    ) {
      const errors = [
        corporaResponse.error,
        latestSessions.error,
        recentOutputs.error,
        feedbackEntries.error,
        ingestionJobs.error,
        retrainingJobs.error,
        promptTemplates.error,
      ].filter(Boolean);
      errors.forEach((err) => console.error("training-dashboard GET", err));
      return NextResponse.json({ error: "Failed to load training dashboard data" }, { status: 500 });
    }

    const documentTotal = await countRows("documents", { domain });
    const documentStatuses = Object.fromEntries(
      await Promise.all(
        DOCUMENT_STATUSES.map(async (status) => [status, await countRows("documents", { domain, ingestion_status: status })])
      )
    );

    const sessionTotal = await countRows("training_sessions", { domain });
    const sessionStatuses = Object.fromEntries(
      await Promise.all(
        SESSION_STATUSES.map(async (status) => [
          status,
          await countRows("training_sessions", { domain, status }),
        ])
      )
    );

    const corporaWithCounts = await Promise.all(
      (corporaResponse.data ?? []).map(async (corpus) => {
        const documentCount = await countRows("documents", { domain, corpus_id: corpus.id });
        return {
          ...corpus,
          document_count: documentCount,
        };
      })
    );

    return NextResponse.json({
      domain,
      corpora: corporaWithCounts,
      documentStats: {
        total: documentTotal,
        statuses: documentStatuses,
      },
      sessionStats: {
        total: sessionTotal,
        statuses: sessionStatuses,
      },
      latestSessions: latestSessions.data ?? [],
      generatedDocuments: recentOutputs.data ?? [],
      feedbackEntries: feedbackEntries.data ?? [],
      ingestionJobs: ingestionJobs.data ?? [],
      retrainingJobs: retrainingJobs.data ?? [],
      promptTemplates: promptTemplates.data ?? [],
    });
  } catch (error) {
    console.error("training-dashboard GET", error);
    return NextResponse.json({ error: "Training dashboard query failed" }, { status: 500 });
  }
}
