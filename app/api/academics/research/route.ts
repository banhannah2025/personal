import { NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { supabaseAdminClient } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";

const BUCKET = "academics-assets";

type ResearchRequest = {
  query: string;
};

type ParsedSource = {
  title: string;
  url: string;
  summary: string;
  insights?: string;
};

const openai =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "OPENAI_API_KEY"
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

function buildFallbackSources(query: string): ParsedSource[] {
  return [
    {
      title: `${query} literature overview`,
      url: "https://example.edu/library",
      summary: `Key academic surveys covering ${query}. Use university library databases (JSTOR, IEEE Xplore, PubMed) for peer-reviewed material.`,
      insights: "Focus on meta-analyses and systematic reviews published within the last five years.",
    },
    {
      title: `Open data repositories for ${query}`,
      url: "https://data.gov/",
      summary: "Government and NGO datasets suitable for replication studies or benchmarking.",
      insights: "Cross-check data provenance and cite the issuing agency in your methodology.",
    },
  ];
}

async function ensureAuth() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
  }

  let body: ResearchRequest;
  try {
    body = (await request.json()) as ResearchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  let sources: ParsedSource[] = [];

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1-chat-latest",
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an academic research assistant. Given a query, return JSON { sources: [{ title: string, url: string, summary: string, insights?: string }] } with peer-reviewed or academically credible leads. Include DOIs or archive links when relevant.",
          },
          {
            role: "user",
            content: query,
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw) as { sources?: ParsedSource[] };
        if (parsed.sources?.length) {
          sources = parsed.sources;
        }
      }
    } catch (error) {
      console.error("academics research openai", error);
    }
  }

  if (sources.length === 0) {
    sources = buildFallbackSources(query);
  }

  const inserted: Array<{
    id: string;
    query: string;
    title: string;
    summary: string;
    url: string;
    insights: string;
    storage_path: string;
    created_at: string;
    downloadUrl: string | null;
  }> = [];

  for (const source of sources) {
    const storagePath = `ai-research/${randomUUID()}.txt`;
    const content = [
      `Query: ${query}`,
      `Title: ${source.title}`,
      `URL: ${source.url}`,
      `Summary: ${source.summary}`,
      `Insights: ${source.insights ?? ""}`,
    ].join("\n\n");
    const { error: uploadError } = await supabaseAdminClient.storage
      .from(BUCKET)
      .upload(storagePath, content, {
        contentType: "text/plain",
        upsert: true,
      });
    if (uploadError) {
      console.error("academics research upload", uploadError);
    }
    const { data, error } = await supabaseAdminClient
      .from("ai_research_sources")
      .insert({
        query,
        title: source.title,
        summary: source.summary,
        url: source.url,
        insights: source.insights ?? "",
        storage_path: storagePath,
      })
      .select("id, query, title, summary, url, insights, storage_path, created_at")
      .single();
    if (error || !data) {
      console.error("academics research insert", error);
      continue;
    }
    let downloadUrl: string | null = null;
    if (data.storage_path) {
      const { data: signed } = await supabaseAdminClient.storage
        .from(BUCKET)
        .createSignedUrl(data.storage_path, 60 * 60);
      downloadUrl = signed?.signedUrl ?? null;
    }
    inserted.push({
      ...data,
      downloadUrl,
    });
  }

  return NextResponse.json({ sources: inserted });
}
