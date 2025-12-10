create table if not exists research_tracks (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  question text default '',
  timeframe text default 'TBD',
  status text default 'Exploratory',
  created_at timestamptz not null default now()
);

create table if not exists research_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text default 'Article',
  link text default '',
  reliability text default 'Support',
  created_at timestamptz not null default now()
);

create table if not exists writing_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  focus text default '',
  status text default 'Notes',
  summary text default '',
  created_at timestamptz not null default now()
);

create table if not exists study_tasks (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  due text default '',
  priority text default 'Medium',
  created_at timestamptz not null default now()
);

create table if not exists ai_research_sources (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  title text not null,
  summary text default '',
  url text default '',
  insights text default '',
  storage_path text default '',
  created_at timestamptz not null default now()
);

alter table if exists ai_research_sources enable row level security;
drop policy if exists "Service role manages ai_research_sources" on ai_research_sources;
create policy "Service role manages ai_research_sources"
  on ai_research_sources
  for all
  to service_role
  using (true)
  with check (true);
