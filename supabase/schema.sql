-- NEON//DAY 3.0 · Supabase
-- Ejecuta todo este archivo en Supabase > SQL Editor.
-- Recomendado: habilitar Anonymous Sign-Ins en Authentication > Providers.

create extension if not exists pgcrypto;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 90),
  date date not null,
  time time null,
  category text not null default 'Personal',
  priority text not null default 'Media',
  repeat text not null default 'none',
  reminder text not null default 'none',
  description text not null default '',
  status text not null default 'Pendiente',
  parent uuid null references public.activities(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists activities_user_date_idx
  on public.activities(user_id, date, time);

alter table public.activities enable row level security;

drop policy if exists "activities_select_own" on public.activities;
drop policy if exists "activities_insert_own" on public.activities;
drop policy if exists "activities_update_own" on public.activities;
drop policy if exists "activities_delete_own" on public.activities;

create policy "activities_select_own"
on public.activities for select
to authenticated
using (auth.uid() = user_id);

create policy "activities_insert_own"
on public.activities for insert
to authenticated
with check (auth.uid() = user_id);

create policy "activities_update_own"
on public.activities for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "activities_delete_own"
on public.activities for delete
to authenticated
using (auth.uid() = user_id);
