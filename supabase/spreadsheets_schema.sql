create table if not exists spreadsheets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'Untitled sheet',
  description text not null default '',
  cells jsonb not null default '{}'::jsonb,
  row_count integer not null default 20,
  column_count integer not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spreadsheets_user_idx on spreadsheets (user_id, updated_at desc);

create or replace function set_spreadsheets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_spreadsheets_updated_at on spreadsheets;

create trigger trg_spreadsheets_updated_at
before update on spreadsheets
for each row execute procedure set_spreadsheets_updated_at();

alter table spreadsheets enable row level security;

grant usage on schema public to authenticated, anon;
grant all on spreadsheets to service_role;
grant select on spreadsheets to anon;
grant select, insert, update, delete on spreadsheets to authenticated;

drop policy if exists "Users can view their spreadsheets" on spreadsheets;
create policy "Users can view their spreadsheets"
  on spreadsheets
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "Users can insert their spreadsheets" on spreadsheets;
create policy "Users can insert their spreadsheets"
  on spreadsheets
  for insert
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can update their spreadsheets" on spreadsheets;
create policy "Users can update their spreadsheets"
  on spreadsheets
  for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete their spreadsheets" on spreadsheets;
create policy "Users can delete their spreadsheets"
  on spreadsheets
  for delete
  using (auth.uid()::text = user_id);
