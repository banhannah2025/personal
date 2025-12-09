import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { supabaseAdminClient } from "@/lib/supabase";

const MAX_DOCS_PER_USER = 5;
const BORDER_SIDES: Array<keyof BorderSides> = ["top", "right", "bottom", "left"];

type PageBorderStyle = "none" | "single" | "single-bold" | "dotted" | "dashed" | "double";

type BorderSides = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

type Margins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type WordDocumentRow = {
  id: string;
  title: string | null;
  author: string | null;
  content: string | null;
  font_value: string | null;
  page_border_style: PageBorderStyle | null;
  border_sides: Record<string, unknown> | null;
  line_numbering: boolean | null;
  margin_top: number | null;
  margin_right: number | null;
  margin_bottom: number | null;
  margin_left: number | null;
  show_rulers: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

async function requireUser() {
  const user = await currentUser();
  if (!user) {
    throw new Error("unauthorized");
  }
  return user;
}

function normalizeBorderSides(input: unknown): BorderSides {
  const fallback: BorderSides = { top: true, right: true, bottom: true, left: true };
  if (!input || typeof input !== "object") {
    return fallback;
  }
  const candidate = input as Record<string, unknown>;
  const result: BorderSides = { ...fallback };
  BORDER_SIDES.forEach((side) => {
    if (typeof candidate[side] === "boolean") {
      result[side] = candidate[side] as boolean;
    }
  });
  if (!Object.values(result).some(Boolean)) {
    return fallback;
  }
  return result;
}

function clampMarginValue(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(240, Math.max(0, Math.round(numeric)));
}

function normalizeMargins(input: unknown): Margins {
  const fallback: Margins = { top: 64, right: 64, bottom: 64, left: 64 };
  if (!input || typeof input !== "object") {
    return fallback;
  }
  const source = input as Record<string, unknown>;
  return {
    top: clampMarginValue(source.top, fallback.top),
    right: clampMarginValue(source.right, fallback.right),
    bottom: clampMarginValue(source.bottom, fallback.bottom),
    left: clampMarginValue(source.left, fallback.left),
  };
}

function mapDocumentRow(row: WordDocumentRow) {
  return {
    id: row.id as string,
    title: row.title ?? "Untitled document",
    author: row.author ?? "",
    content: row.content ?? "",
    fontValue: row.font_value ?? "Inter",
    pageBorderStyle: (row.page_border_style ?? "none") as PageBorderStyle,
    borderSides: normalizeBorderSides(row.border_sides),
    lineNumbering: Boolean(row.line_numbering),
    margins: normalizeMargins({
      top: row.margin_top,
      right: row.margin_right,
      bottom: row.margin_bottom,
      left: row.margin_left,
    }),
    showRulers: row.show_rulers ?? true,
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
      .from("word_documents")
      .select(
        "id, title, author, content, font_value, page_border_style, border_sides, line_numbering, margin_top, margin_right, margin_bottom, margin_left, show_rulers, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(MAX_DOCS_PER_USER);
    if (error) throw error;
    return NextResponse.json({ documents: (data ?? []).map(mapDocumentRow) });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("word-documents GET", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    let body: {
      id?: string;
      title?: string;
      author?: string;
      content?: string;
      fontValue?: string;
      pageBorderStyle?: PageBorderStyle;
      borderSides?: BorderSides;
      lineNumbering?: boolean;
      margins?: Margins;
      showRulers?: boolean;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const isUpdate = typeof body.id === "string" && body.id.length > 0;
    const title = body.title?.trim() || "Untitled document";
    const author = body.author?.trim() ?? "";
    const content = body.content ?? "";
    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    const fontValue = body.fontValue?.trim() || "Inter";
    const pageBorderStyle: PageBorderStyle = body.pageBorderStyle ?? "none";
    const borderSides = normalizeBorderSides(body.borderSides);
    const lineNumbering = Boolean(body.lineNumbering);
    const margins = normalizeMargins(body.margins);
    const showRulers = body.showRulers ?? true;

    if (!isUpdate) {
      const { count, error: countError } = await supabaseAdminClient
        .from("word_documents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (countError) throw countError;
      if ((count ?? 0) >= MAX_DOCS_PER_USER) {
        return NextResponse.json(
          { error: `Document limit reached. Delete one before saving another (${MAX_DOCS_PER_USER} max).` },
          { status: 400 }
        );
      }
    }

    const payload = {
      title,
      author,
      content,
      font_value: fontValue,
      page_border_style: pageBorderStyle,
      border_sides: borderSides,
      line_numbering: lineNumbering,
      margin_top: margins.top,
      margin_right: margins.right,
      margin_bottom: margins.bottom,
      margin_left: margins.left,
      show_rulers: showRulers,
    };
    const insertPayload = { ...payload, user_id: user.id };

    const query = isUpdate
      ? supabaseAdminClient
          .from("word_documents")
          .update(payload)
          .eq("id", body.id)
          .eq("user_id", user.id)
          .select(
            "id, title, author, content, font_value, page_border_style, border_sides, line_numbering, margin_top, margin_right, margin_bottom, margin_left, show_rulers, created_at, updated_at"
          )
          .single()
      : supabaseAdminClient
          .from("word_documents")
          .insert(insertPayload)
          .select(
            "id, title, author, content, font_value, page_border_style, border_sides, line_numbering, margin_top, margin_right, margin_bottom, margin_left, show_rulers, created_at, updated_at"
          )
          .single();

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ document: mapDocumentRow(data) });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("word-documents POST", error);
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
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
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body.id) {
      return NextResponse.json({ error: "Document id is required" }, { status: 400 });
    }
    const { error } = await supabaseAdminClient
      .from("word_documents")
      .delete()
      .eq("id", body.id)
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("word-documents DELETE", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
