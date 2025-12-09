import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { supabaseAdminClient } from "@/lib/supabase";

const MAX_SHEETS_PER_USER = 5;
const MAX_ROWS = 200;
const MAX_COLUMNS = 50;
const MAX_CELL_COUNT = MAX_ROWS * MAX_COLUMNS;

type CellFormat = "text" | "number" | "currency" | "percent";
type CellAlign = "left" | "center" | "right";

export type CellData = {
  value: string;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  align?: CellAlign;
  format?: CellFormat;
};

type SpreadsheetRow = {
  id: string;
  title: string | null;
  description: string | null;
  cells: Record<string, CellData> | null;
  row_count: number | null;
  column_count: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type SaveSheetPayload = {
  id?: string;
  title?: string;
  description?: string;
  cells?: Record<string, CellData>;
  rowCount?: number;
  columnCount?: number;
};

async function requireUser() {
  const user = await currentUser();
  if (!user) {
    throw new Error("unauthorized");
  }
  return user;
}

function sanitizeColor(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  if (value.length > 32) return fallback;
  return value;
}

function sanitizeAlign(value: unknown): CellAlign {
  if (value === "center" || value === "right") return value;
  return "left";
}

function sanitizeFormat(value: unknown): CellFormat {
  if (value === "number" || value === "currency" || value === "percent") {
    return value;
  }
  return "text";
}

function sanitizeCells(input: unknown): Record<string, CellData> {
  if (!input || typeof input !== "object") return {};
  const entries = Object.entries(input as Record<string, CellData>).slice(0, MAX_CELL_COUNT);
  return entries.reduce<Record<string, CellData>>((acc, [key, cell]) => {
    if (!key.startsWith("r")) return acc;
    if (!cell || typeof cell !== "object") return acc;
    const value = typeof cell.value === "string" || typeof cell.value === "number" ? String(cell.value).slice(0, 400) : "";
    acc[key] = {
      value,
      bold: Boolean(cell.bold),
      italic: Boolean(cell.italic),
      textColor: sanitizeColor(cell.textColor, "#0f172a"),
      backgroundColor: sanitizeColor(cell.backgroundColor, "#ffffff"),
      align: sanitizeAlign(cell.align),
      format: sanitizeFormat(cell.format),
    };
    return acc;
  }, {});
}

function clampCount(value: unknown, fallback: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.round(numeric)));
}

function mapRow(row: SpreadsheetRow) {
  return {
    id: row.id,
    title: row.title ?? "Untitled sheet",
    description: row.description ?? "",
    cells: sanitizeCells(row.cells ?? {}),
    rowCount: clampCount(row.row_count ?? 20, 20, MAX_ROWS),
    columnCount: clampCount(row.column_count ?? 8, 8, MAX_COLUMNS),
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
      .from("spreadsheets")
      .select("id, title, description, cells, row_count, column_count, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(MAX_SHEETS_PER_USER);
    if (error) throw error;
    return NextResponse.json({ sheets: (data ?? []).map(mapRow) });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("spreadsheets GET", error);
    return NextResponse.json({ error: "Failed to load spreadsheets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    let body: SaveSheetPayload;
    try {
      body = (await request.json()) as SaveSheetPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const isUpdate = typeof body.id === "string" && body.id.length > 0;
    if (!isUpdate) {
      const { count, error: countError } = await supabaseAdminClient
        .from("spreadsheets")
        .select("*", { head: true, count: "exact" })
        .eq("user_id", user.id);
      if (countError) throw countError;
      if ((count ?? 0) >= MAX_SHEETS_PER_USER) {
        return NextResponse.json(
          { error: `You can only store ${MAX_SHEETS_PER_USER} spreadsheets. Delete one to save another.` },
          { status: 400 }
        );
      }
    }

    const title = body.title?.trim() || "Untitled sheet";
    const description = body.description?.trim() ?? "";
    const rowCount = clampCount(body.rowCount ?? 20, 20, MAX_ROWS);
    const columnCount = clampCount(body.columnCount ?? 8, 8, MAX_COLUMNS);
    const cells = sanitizeCells(body.cells ?? {});

    const payload = {
      user_id: user.id,
      title,
      description,
      row_count: rowCount,
      column_count: columnCount,
      cells,
    };

    const query = isUpdate
      ? supabaseAdminClient
          .from("spreadsheets")
          .update(payload)
          .eq("id", body.id)
          .eq("user_id", user.id)
          .select("id, title, description, cells, row_count, column_count, created_at, updated_at")
          .single()
      : supabaseAdminClient
          .from("spreadsheets")
          .insert(payload)
          .select("id, title, description, cells, row_count, column_count, created_at, updated_at")
          .single();

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ sheet: mapRow(data) });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("spreadsheets POST", error);
    return NextResponse.json({ error: "Failed to save spreadsheet" }, { status: 500 });
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
      return NextResponse.json({ error: "Sheet id is required" }, { status: 400 });
    }
    const { error } = await supabaseAdminClient.from("spreadsheets").delete().eq("id", body.id).eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("spreadsheets DELETE", error);
    return NextResponse.json({ error: "Failed to delete spreadsheet" }, { status: 500 });
  }
}
