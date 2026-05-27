create extension if not exists pgcrypto;

create table if not exists public.feedback_notes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  message text not null default '' check (char_length(message) <= 1200),
  page_path text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.feedback_notes enable row level security;

drop policy if exists "Anyone can send feedback" on public.feedback_notes;
create policy "Anyone can send feedback"
on public.feedback_notes
for insert
to anon
with check (
  char_length(name) between 1 and 80
  and char_length(message) <= 1200
);

-- Public select policy eklemeyin. Böylece site ziyaretçileri gelen notları okuyamaz.
-- Notları Supabase Dashboard > Table Editor > feedback_notes ekranından görüntüleyin.
