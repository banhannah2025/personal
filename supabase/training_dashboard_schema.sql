-- Enable required extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Enum definitions
do $$
begin
  if not exists (select 1 from pg_type where typname = 'domain_type') then
    create type domain_type as enum ('legal', 'academic');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type document_status as enum (
      'pending_ingest',
      'ingested',
      'needs_review',
      'archived'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'training_status') then
    create type training_status as enum (
      'draft',
      'in_progress',
      'needs_input',
      'completed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'feedback_severity') then
    create type feedback_severity as enum ('info', 'minor', 'major', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'template_kind') then
    create type template_kind as enum ('analysis', 'drafting', 'validation', 'grading');
  end if;
end
$$;

-- Core domain metadata
create table if not exists domains (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into domains (slug, label, description)
values
  ('legal', 'Legal Lab', 'Legal research, analysis, and drafting workflows'),
  ('academic', 'Academic Lab', 'Multi-discipline academic reasoning and writing')
on conflict (slug) do nothing;

-- Corpus collections (groupings of sources)
create table if not exists corpus_collections (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  name text not null,
  description text default '',
  source_type text not null default 'reference',
  access_level text not null default 'public',
  default_chunk_size integer default 800,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Individual documents
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  corpus_id uuid references corpus_collections (id) on delete cascade,
  domain domain_type not null,
  title text not null,
  doc_type text default '',
  jurisdiction text default '',
  discipline text default '',
  source_url text default '',
  file_path text default '',
  checksum text default '',
  ingestion_status document_status not null default 'pending_ingest',
  token_count integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Chunked document store with embeddings
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  summary text default '',
  embedding vector(1536),
  token_count integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_embedding_idx
on document_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Prompt and template management
create table if not exists prompt_templates (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  template_kind template_kind not null,
  name text not null,
  description text default '',
  instructions text not null,
  metadata jsonb default '{}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint prompt_templates_domain_name_unique unique (domain, name)
);

create table if not exists draft_templates (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  title text not null,
  doc_type text not null,
  body_template text not null,
  structure jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint draft_templates_domain_title_unique unique (domain, title)
);

-- Training and reasoning sessions
create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  title text not null,
  objective text default '',
  status training_status not null default 'draft',
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists session_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions (id) on delete cascade,
  model_name text not null,
  prompt_template_id uuid references prompt_templates (id),
  input_payload jsonb default '{}'::jsonb,
  output_summary text default '',
  output_tokens integer default 0,
  success boolean not null default true,
  created_at timestamptz not null default now()
);

-- Document usage per session
create table if not exists session_documents (
  session_id uuid not null references training_sessions (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  relevance_score numeric default 0,
  note text default '',
  primary key (session_id, document_id)
);

-- Generated outputs (drafts, briefs, essays, etc.)
create table if not exists generated_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references training_sessions (id) on delete cascade,
  draft_template_id uuid references draft_templates (id),
  domain domain_type not null,
  title text not null,
  doc_type text not null,
  content text not null,
  status text not null default 'draft',
  validation_status text not null default 'unverified',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists source_citations (
  id uuid primary key default gen_random_uuid(),
  generated_document_id uuid not null references generated_documents (id) on delete cascade,
  chunk_id uuid references document_chunks (id),
  citation_label text not null,
  excerpt text default '',
  created_at timestamptz not null default now()
);

-- Feedback and expert corrections
create table if not exists feedback_entries (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  session_id uuid references training_sessions (id) on delete cascade,
  generated_document_id uuid references generated_documents (id) on delete cascade,
  issue_type text not null,
  severity feedback_severity not null default 'minor',
  notes text not null,
  correction text default '',
  source_refs text[] default '{}',
  created_by text default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  topic text not null,
  issue_summary text not null,
  reasoning text not null,
  application_guidance text default '',
  source_refs text[] default '{}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Validation framework
create table if not exists validation_rules (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  name text not null,
  description text default '',
  rule_config jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists validation_runs (
  id uuid primary key default gen_random_uuid(),
  generated_document_id uuid not null references generated_documents (id) on delete cascade,
  rule_id uuid not null references validation_rules (id) on delete cascade,
  status text not null default 'pending',
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Tracking ingestion & automation jobs
create table if not exists ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  corpus_id uuid references corpus_collections (id) on delete set null,
  job_type text not null,
  status text not null default 'pending',
  payload jsonb default '{}'::jsonb,
  error_message text default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists retraining_jobs (
  id uuid primary key default gen_random_uuid(),
  domain domain_type not null,
  source text not null,
  status text not null default 'queued',
  dataset_size integer default 0,
  initiated_by text default '',
  notes text default '',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Legal projects and knowledge workflows
create table if not exists legal_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  domain domain_type not null default 'legal',
  title text not null,
  question text not null,
  instructions text default '',
  last_answer text default '',
  session_id uuid references training_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists legal_projects_user_idx on legal_projects (user_id);

create table if not exists academic_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  domain domain_type not null default 'academic',
  title text not null,
  question text not null,
  instructions text default '',
  discipline text default '',
  last_answer text default '',
  session_id uuid references training_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academic_projects_user_idx on academic_projects (user_id);
