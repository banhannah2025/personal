create table if not exists word_documents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'Untitled document',
  author text not null default '',
  content text not null default '',
  font_value text not null default 'Inter',
  page_border_style text not null default 'none',
  border_sides jsonb not null default '{"top": true, "right": true, "bottom": true, "left": true}',
  line_numbering boolean not null default false,
  margin_top numeric(5,2) not null default 1.0,
  margin_right numeric(5,2) not null default 1.0,
  margin_bottom numeric(5,2) not null default 1.0,
  margin_left numeric(5,2) not null default 1.0,
  show_rulers boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table word_documents
  add column if not exists margin_top numeric(5,2) not null default 1.0,
  add column if not exists margin_right numeric(5,2) not null default 1.0,
  add column if not exists margin_bottom numeric(5,2) not null default 1.0,
  add column if not exists margin_left numeric(5,2) not null default 1.0,
  add column if not exists show_rulers boolean not null default true;

create index if not exists word_documents_user_idx on word_documents (user_id, updated_at desc);

create or replace function set_word_documents_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_word_documents_updated_at on word_documents;

create trigger trg_word_documents_updated_at
before update on word_documents
for each row execute procedure set_word_documents_updated_at();

alter table word_documents enable row level security;

grant usage on schema public to authenticated, anon;
grant all on word_documents to service_role;
grant select on word_documents to anon;
grant select, insert, update, delete on word_documents to authenticated;

drop policy if exists "Users can view their documents" on word_documents;
create policy "Users can view their documents"
  on word_documents
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "Users can insert their documents" on word_documents;
create policy "Users can insert their documents"
  on word_documents
  for insert
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can update their documents" on word_documents;
create policy "Users can update their documents"
  on word_documents
  for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete their documents" on word_documents;
create policy "Users can delete their documents"
  on word_documents
  for delete
  using (auth.uid()::text = user_id);
