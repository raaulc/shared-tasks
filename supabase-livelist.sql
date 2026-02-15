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

-- 6) Add tables to realtime (required for live updates without refresh)
-- REPLICA IDENTITY FULL ensures DELETE events include full row so household_id filter works
alter table tasks replica identity full;
alter table categories replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
    alter publication supabase_realtime add table tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories') then
    alter publication supabase_realtime add table categories;
  end if;
end $$;

-- 7) Add member colors (stored per profile, any household member can update)
alter table profiles add column if not exists color text default null;

-- 8) Multi-workspace: household_members junction table
create table if not exists household_members (
  profile_id uuid not null references profiles(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  primary key (profile_id, household_id)
);

-- Migrate existing profiles.household_id into household_members
insert into household_members (profile_id, household_id)
select id, household_id from profiles where household_id is not null
on conflict (profile_id, household_id) do nothing;

-- RLS: users can read household_members for their own profile
alter table household_members enable row level security;

drop policy if exists "Users can read own memberships" on household_members;
create policy "Users can read own memberships"
on household_members for select
to authenticated
using (auth.uid() = profile_id);

drop policy if exists "Users can insert own memberships" on household_members;
create policy "Users can insert own memberships"
on household_members for insert
to authenticated
with check (auth.uid() = profile_id);

drop policy if exists "Household members can delete memberships" on household_members;
create policy "Household members can delete memberships"
on household_members for delete
to authenticated
using (
  auth.uid() = profile_id
  or exists (
    select 1 from profiles p where p.id = auth.uid() and p.household_id = household_members.household_id
  )
);
