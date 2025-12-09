import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdminClient } from "@/lib/supabase";
import { embedQuery, retrieveChunks } from "@/lib/rag";
import { openaiClient, DEFAULT_COMPLETION_MODEL } from "@/lib/aiClients";

async function ensureAuth() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function formatContext(chunks: Awaited<ReturnType<typeof retrieveChunks>>) {
  if (!chunks.length) return "No retrieved sources.";
  return chunks
    .map((chunk, index) => {
      return `Source ${index + 1}: ${chunk.document_title || "Untitled"}\n${chunk.content}`;
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuth();
  if (unauthorized) {
    return unauthorized;
  }
  if (!supabaseAdminClient) {
    return NextResponse.json({ error: "Supabase client missing" }, { status: 500 });
  }
  if (!openaiClient) {
    return NextResponse.json({ error: "OpenAI client missing" }, { status: 500 });
  }

  let payload: {
    query?: string;
    instructions?: string;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = payload.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const embedding = await embedQuery(query);
    const chunks = await retrieveChunks(supabaseAdminClient, embedding, {
      domain: "legal",
      matchCount: 6,
    });
    const context = formatContext(chunks);
    const completion = await openaiClient.responses.create({
      model: DEFAULT_COMPLETION_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a legal research assistant. Answer with structured analysis (Issue, Rules, Application, Conclusion). Cite sources using [Source #]. If law is unclear, say so explicitly.",
        },
        payload.instructions
          ? {
              role: "system",
              content: `User instructions: ${payload.instructions}`,
            }
          : null,
        {
          role: "user",
          content: `Question: ${query}\n\nContext:\n${context}`,
        },
      ].filter(Boolean) as { role: "system" | "user"; content: string }[],
      max_output_tokens: 1500,
    });

    const content = completion.output?.[0]?.content?.[0];
    const answer =
      content && content.type === "output_text" ? content.text : JSON.stringify(completion.output);

    const citations = chunks.map((chunk, index) => ({
      source: `Source ${index + 1}`,
      document_id: chunk.document_id,
      title: chunk.document_title,
      excerpt: chunk.content.slice(0, 400),
    }));

    return NextResponse.json({
      answer,
      citations,
    });
  } catch (error) {
    console.error("legal-research POST", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Legal research failed" },
      { status: 500 }
    );
  }
}
