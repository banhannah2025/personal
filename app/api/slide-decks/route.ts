import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { supabaseAdminClient } from "@/lib/supabase";

const MAX_DECKS_PER_USER = 5;

type Slide = {
  id: string;
  title: string;
  body: string;
  notes: string;
  background: string;
};

type SlideDeckRow = {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  slides: Slide[] | null;
  created_at: string | null;
  updated_at: string | null;
};

type SaveDeckPayload = {
  id?: string;
  title?: string;
  description?: string;
  slides?: Slide[];
};

async function requireUser() {
  const user = await currentUser();
  if (!user) {
    throw new Error("unauthorized");
  }
  return user;
}

function sanitizeSlides(input: Slide[] | undefined | null): Slide[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.slice(0, 30).map((slide, index) => ({
    id: slide?.id || `slide-${index}`,
    title: (slide?.title ?? "").slice(0, 200),
    body: (slide?.body ?? "").slice(0, 4000),
    notes: (slide?.notes ?? "").slice(0, 2000),
    background: slide?.background || "#ffffff",
  }));
}

function mapRow(row: SlideDeckRow) {
  return {
    id: row.id,
    title: row.title ?? "Untitled slideshow",
    description: row.description ?? "",
    slides: sanitizeSlides(row.slides ?? []),
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
      .from("slide_decks")
      .select("id, title, description, slides, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(MAX_DECKS_PER_USER);
    if (error) {
      throw error;
    }
    return NextResponse.json({ decks: (data ?? []).map(mapRow) });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("slide-decks GET", error);
    return NextResponse.json({ error: "Failed to load slide decks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!supabaseAdminClient) {
      return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
    }
    let body: SaveDeckPayload;
    try {
      body = (await request.json()) as SaveDeckPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const isUpdate = typeof body.id === "string" && body.id.length > 0;
    if (!isUpdate) {
      const { count, error: countError } = await supabaseAdminClient
        .from("slide_decks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (countError) throw countError;
      if ((count ?? 0) >= MAX_DECKS_PER_USER) {
        return NextResponse.json(
          { error: `You can only store ${MAX_DECKS_PER_USER} slideshows. Delete one to create another.` },
          { status: 400 }
        );
      }
    }
    const title = body.title?.trim() || "Untitled slideshow";
    const description = body.description?.trim() ?? "";
    const slides = sanitizeSlides(body.slides);

    const payload = {
      user_id: user.id,
      title,
      description,
      slides,
    };

    const query = isUpdate
      ? supabaseAdminClient
          .from("slide_decks")
          .update(payload)
          .eq("id", body.id)
          .eq("user_id", user.id)
          .select("id, title, description, slides, created_at, updated_at")
          .single()
      : supabaseAdminClient
          .from("slide_decks")
          .insert(payload)
          .select("id, title, description, slides, created_at, updated_at")
          .single();
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ deck: mapRow(data) });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("slide-decks POST", error);
    return NextResponse.json({ error: "Failed to save slide deck" }, { status: 500 });
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
      return NextResponse.json({ error: "Deck id is required" }, { status: 400 });
    }
    const { error } = await supabaseAdminClient
      .from("slide_decks")
      .delete()
      .eq("id", body.id)
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("slide-decks DELETE", error);
    return NextResponse.json({ error: "Failed to delete slide deck" }, { status: 500 });
  }
}
