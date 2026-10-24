-- Rutinas propias de cada persona (creadas, copiadas o importadas desde una planilla).
-- Ejecutar una vez en Supabase > SQL Editor.
-- Cada persona ve y cambia solo las suyas; su entrenador (si comparte datos con él) puede verlas.

create table if not exists public.user_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(data::text) < 500000)
);
create index if not exists user_programs_user_idx on public.user_programs(user_id);
alter table public.user_programs enable row level security;

drop policy if exists "own programs" on public.user_programs;
create policy "own programs" on public.user_programs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Como mucho 30 rutinas por persona
create or replace function public.user_programs_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- upsert de una rutina que ya existe: es una edición, no cuenta
  if exists (select 1 from public.user_programs where id = new.id) then return new; end if;
  if (select count(*) from public.user_programs where user_id = new.user_id) >= 30 then
    raise exception 'Has llegado al máximo de 30 rutinas propias. Elimina alguna para guardar otra.';
  end if;
  return new;
end $$;
drop trigger if exists user_programs_limit on public.user_programs;
create trigger user_programs_limit before insert on public.user_programs
  for each row execute function public.user_programs_limit();

drop policy if exists "coach reads athlete programs" on public.user_programs;
create policy "coach reads athlete programs" on public.user_programs for select to authenticated
  using (exists (select 1 from public.coach_links l where l.athlete_id = user_programs.user_id and l.coach_id = (select auth.uid())));
