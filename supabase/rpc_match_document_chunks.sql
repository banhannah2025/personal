-- Helper RPC for semantic search over document_chunks using pgvector.
-- Run after training_dashboard_schema.sql so the tables/types exist.

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  domain_filter domain_type default null,
  corpus_filter uuid default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_type text,
  corpus_id uuid,
  score double precision,
  content text,
  metadata jsonb
)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  return query
  select
    dc.id as chunk_id,
    dc.document_id,
    d.title,
    d.doc_type,
    d.corpus_id,
    1 - (dc.embedding <#> query_embedding) as score,
    dc.content,
    dc.metadata
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where
    (domain_filter is null or d.domain = domain_filter)
    and (corpus_filter is null or d.corpus_id = corpus_filter)
  order by dc.embedding <#> query_embedding
  limit match_count;
end;
$$;
