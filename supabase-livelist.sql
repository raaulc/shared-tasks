-- =========================
-- LIVELIST: Categories for shared task lists
-- Run this in Supabase SQL Editor
-- =========================

-- 1) Create categories table
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now()
);

-- 2) Add category_id to tasks
alter table tasks
add column if not exists category_id uuid references categories(id) on delete cascade;

-- 3) Enable RLS on categories
alter table categories enable row level security;

-- 4) Category policies (household-based, same pattern as tasks)
drop policy if exists "Household-based category access" on categories;

create policy "Household-based category access"
on categories for all
to authenticated
using (
  household_id = public.current_household_id()
)
with check (
  household_id = public.current_household_id()
);

-- 5) Update tasks policy to allow category_id filter (no change needed - policy uses household_id)
-- Tasks with null category_id remain visible; new tasks should have category_id

-- 6) Add categories to realtime
alter publication supabase_realtime add table categories;

-- 7) Add member colors (stored per profile, any household member can update)
alter table profiles add column if not exists color text default null;
