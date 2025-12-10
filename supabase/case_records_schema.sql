create table if not exists case_records (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'Untitled case',
  docket text not null default '',
  jurisdiction text not null default '',
  desired_outcome text not null default '',
  parties jsonb not null default '[]'::jsonb,
  witnesses jsonb not null default '[]'::jsonb,
  entries jsonb not null default '[]'::jsonb,
  law_references jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table case_records
  add column if not exists witnesses jsonb not null default '[]'::jsonb;

create index if not exists case_records_user_idx on case_records (user_id, updated_at desc);

create or replace function set_case_records_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_case_records_updated_at on case_records;

create trigger trg_case_records_updated_at
before update on case_records
for each row execute procedure set_case_records_updated_at();

alter table case_records enable row level security;

grant usage on schema public to authenticated, anon;
grant all on case_records to service_role;
grant select on case_records to anon;
grant select, insert, update, delete on case_records to authenticated;

drop policy if exists "Users can view their cases" on case_records;
create policy "Users can view their cases"
  on case_records
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "Users can insert their cases" on case_records;
create policy "Users can insert their cases"
  on case_records
  for insert
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can update their cases" on case_records;
create policy "Users can update their cases"
  on case_records
  for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete their cases" on case_records;
create policy "Users can delete their cases"
  on case_records
  for delete
  using (auth.uid()::text = user_id);
