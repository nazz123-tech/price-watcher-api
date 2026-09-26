-- Lists: group groceries, e.g. "Breakfast", "Dinner", "Snacks".
-- Run once in the Supabase SQL editor (after the tables from CLAUDE.md section 4).

create table lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)                -- no two lists with the same name per user
);

-- Only the backend (service key) may touch this table, like the others.
alter table lists enable row level security;

-- Each grocery can be in one list (or none).
-- Deleting a list keeps its groceries; they just lose their list.
alter table watch_items
  add column list_id uuid references lists(id) on delete set null;

create index watch_items_list_id_idx on watch_items (list_id);
