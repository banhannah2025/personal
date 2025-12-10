create table if not exists slide_decks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'Untitled slideshow',
  description text not null default '',
  slides jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists slide_decks_user_idx on slide_decks (user_id, updated_at desc);

create or replace function set_slide_decks_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_slide_decks_updated_at on slide_decks;

create trigger trg_slide_decks_updated_at
before update on slide_decks
for each row execute procedure set_slide_decks_updated_at();

alter table slide_decks enable row level security;

grant usage on schema public to authenticated, anon;
grant all on slide_decks to service_role;
grant select on slide_decks to anon;
grant select, insert, update, delete on slide_decks to authenticated;

drop policy if exists "Users can view their slide decks" on slide_decks;
create policy "Users can view their slide decks"
  on slide_decks
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "Users can insert their slide decks" on slide_decks;
create policy "Users can insert their slide decks"
  on slide_decks
  for insert
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can update their slide decks" on slide_decks;
create policy "Users can update their slide decks"
  on slide_decks
  for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "Users can delete their slide decks" on slide_decks;
create policy "Users can delete their slide decks"
  on slide_decks
  for delete
  using (auth.uid()::text = user_id);
