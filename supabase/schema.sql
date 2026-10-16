-- Fishbloom Studio database. Run once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run: it only creates what is missing.
--
-- Security model: only the site owner (listed in app_owner) can write anything.
-- Visitors can read only what is marked public: to-dos / learning items with is_public = true,
-- and notes with status = 'published'. Private items never leave the database.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- owner
create table if not exists public.app_owner (
  owner_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.app_owner enable row level security;   -- no policies: not readable through the API

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_owner where owner_id = auth.uid());
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- learning list
create table if not exists public.learning (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'repo' check (kind in ('repo', 'link')),
  repo        text check (repo is null or repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),   -- owner/name
  url         text,
  title       text not null,
  description text,
  stars       integer,
  language    text,
  importance  smallint not null default 2 check (importance between 1 and 3),           -- 1 = most important
  status      text not null default 'to_learn' check (status in ('to_learn', 'learning', 'learned')),
  notes       text not null default '',
  tags        text[] not null default '{}',
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- to-dos
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  notes       text not null default '',
  priority    smallint not null default 2 check (priority between 1 and 3),             -- 1 = most important
  status      text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  due         date,
  started_at  timestamptz,
  done_at     timestamptz,
  is_public   boolean not null default false,                                            -- private unless shown on the site
  learning_id uuid references public.learning (id) on delete set null,
  project     text,                                                                      -- slug of a project on the site
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- notes / blog posts
create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default '',
  slug         text unique check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary      text not null default '',
  body         text not null default '',                                                -- Markdown
  tags         text[] not null default '{}',
  lang         text not null default 'zh' check (lang in ('en', 'ja', 'zh')),
  status       text not null default 'private' check (status in ('private', 'published')),
  published_at timestamptz,
  learning_ids uuid[] not null default '{}',
  todo_ids     uuid[] not null default '{}',
  projects     text[] not null default '{}',                                             -- project slugs
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint published_needs_slug check (status = 'private' or (slug is not null and title <> ''))
);

do $$ declare t text; begin
  foreach t in array array['learning', 'todos', 'notes'] loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- row level security
drop policy if exists "read public or own" on public.learning;
drop policy if exists "owner writes" on public.learning;
create policy "read public or own" on public.learning for select using (is_public or public.is_owner());
create policy "owner writes" on public.learning for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "read public or own" on public.todos;
drop policy if exists "owner writes" on public.todos;
create policy "read public or own" on public.todos for select using (is_public or public.is_owner());
create policy "owner writes" on public.todos for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists "read published or own" on public.notes;
drop policy if exists "owner writes" on public.notes;
create policy "read published or own" on public.notes for select using (status = 'published' or public.is_owner());
create policy "owner writes" on public.notes for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------- images (pasted into notes)
insert into storage.buckets (id, name, public)
values ('studio', 'studio', true)
on conflict (id) do nothing;

drop policy if exists "owner uploads" on storage.objects;
drop policy if exists "owner updates" on storage.objects;
drop policy if exists "owner deletes" on storage.objects;
create policy "owner uploads" on storage.objects for insert with check (bucket_id = 'studio' and public.is_owner());
create policy "owner updates" on storage.objects for update using (bucket_id = 'studio' and public.is_owner());
create policy "owner deletes" on storage.objects for delete using (bucket_id = 'studio' and public.is_owner());
