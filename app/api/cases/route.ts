import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { supabaseAdminClient } from "@/lib/supabase";

const MAX_CASES_PER_USER = 15;

type Party = {
  id: string;
  name: string;
  role: string;
  contact: string;
};

type NoteEntry = {
  id: string;
  type: "Note" | "Fact" | "Evidence";
  content: string;
  owner: string;
  createdAt: string;
};

type LawReference = {
  id: string;
  kind: string;
  citation: string;
  summary: string;
};

type Witness = {
  id: string;
  name: string;
  testimony: string;
  relevance: string;
};

type CaseRecordRow = {
  id: string;
  title: string | null;
  docket: string | null;
  jurisdiction: string | null;
  desired_outcome: string | null;
  parties: Party[] | null;
  witnesses: Witness[] | null;
  entries: NoteEntry[] | null;
  law_references: LawReference[] | null;
  created_at: string | null;
  updated_at: string | null;
};

type CasePayload = {
  id?: string;
  title?: string;
  docket?: string;
  jurisdiction?: string;
  desiredOutcome?: string;
  parties?: Party[];
  witnesses?: Witness[];
  entries?: NoteEntry[];
  lawReferences?: LawReference[];
};

async function requireUser() {
  const user = await currentUser();
  if (!user) {
    throw new Error("unauthorized");
  }
  return user;
}

function sanitizeArray<T>(input: unknown, fallback: T[]): T[] {
  return Array.isArray(input) ? (input as T[]) : fallback;
}

function mapRow(row: CaseRecordRow) {
  return {
    id: row.id,
    title: row.title ?? "Untitled case",
    docket: row.docket ?? "",
    jurisdiction: row.jurisdiction ?? "",
    desiredOutcome: row.desired_outcome ?? "",
    parties: sanitizeArray(row.parties, []),
    witnesses: sanitizeArray(row.witnesses, []),
    entries: sanitizeArray(row.entries, []),
    lawReferences: sanitizeArray(row.law_references, []),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    const { data, error } = await supabaseAdminClient
      .from("case_records")
      .select(
        "id, title, docket, jurisdiction, desired_outcome, parties, witnesses, entries, law_references, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(MAX_CASES_PER_USER);
    if (error) throw error;
    return NextResponse.json({ cases: (data ?? []).map(mapRow) });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("cases GET", error);
    return NextResponse.json({ error: "Failed to load cases" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    let payload: CasePayload;
    try {
      payload = (await request.json()) as CasePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const isUpdate = typeof payload.id === "string" && payload.id.length > 0;
    if (!isUpdate) {
      const { count, error: countError } = await supabaseAdminClient
        .from("case_records")
        .select("*", { head: true, count: "exact" })
        .eq("user_id", user.id);
      if (countError) throw countError;
      if ((count ?? 0) >= MAX_CASES_PER_USER) {
        return NextResponse.json(
          { error: `Case limit reached. Delete old cases before adding new ones (${MAX_CASES_PER_USER} max).` },
          { status: 400 }
        );
      }
    }

    const rowPayload = {
      user_id: user.id,
      title: payload.title?.trim() || "Untitled case",
      docket: payload.docket?.trim() ?? "",
      jurisdiction: payload.jurisdiction?.trim() ?? "",
      desired_outcome: payload.desiredOutcome?.trim() ?? "",
      parties: sanitizeArray(payload.parties, []),
      witnesses: sanitizeArray(payload.witnesses, []),
      entries: sanitizeArray(payload.entries, []),
      law_references: sanitizeArray(payload.lawReferences, []),
    };

    const query = isUpdate
      ? supabaseAdminClient
          .from("case_records")
          .update(rowPayload)
          .eq("id", payload.id)
          .eq("user_id", user.id)
          .select("id, title, docket, jurisdiction, desired_outcome, parties, witnesses, entries, law_references, created_at, updated_at")
          .single()
      : supabaseAdminClient
          .from("case_records")
          .insert(rowPayload)
          .select("id, title, docket, jurisdiction, desired_outcome, parties, witnesses, entries, law_references, created_at, updated_at")
          .single();

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ caseRecord: mapRow(data) });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("cases POST", error);
    return NextResponse.json({ error: "Failed to save case" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    let body: { id?: string };
    try {
      body = (await request.json()) as { id?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body.id) {
      return NextResponse.json({ error: "Case id is required" }, { status: 400 });
    }
    const { error } = await supabaseAdminClient
      .from("case_records")
      .delete()
      .eq("id", body.id)
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("cases DELETE", error);
    return NextResponse.json({ error: "Failed to delete case" }, { status: 500 });
  }
}
