import type { SupabaseClient } from "@supabase/supabase-js";
import { openaiClient, DEFAULT_EMBEDDING_MODEL } from "@/lib/aiClients";

export type RetrievalOptions = {
  domain: "legal" | "academic";
  matchCount?: number;
  corpusId?: string | null;
};

export type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_type: string;
  corpus_id: string | null;
  score: number;
  content: string;
  metadata: Record<string, unknown> | null;
};

export async function embedQuery(query: string) {
  if (!openaiClient) {
    throw new Error("OpenAI client is not configured.");
  }
  const result = await openaiClient.embeddings.create({
    model: DEFAULT_EMBEDDING_MODEL,
    input: query,
  });
  return result.data[0]?.embedding ?? [];
}

export async function retrieveChunks(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_count: options.matchCount ?? 8,
    domain_filter: options.domain,
    corpus_filter: options.corpusId ?? null,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as RetrievedChunk[];
}
