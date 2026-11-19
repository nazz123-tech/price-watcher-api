create table lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table lists enable row level security;

alter table watch_items
  add column list_id uuid references lists(id) on delete set null;

create index watch_items_list_id_idx on watch_items (list_id);
