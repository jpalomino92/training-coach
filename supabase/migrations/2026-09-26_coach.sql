-- ==========================================================
-- Entrenador y alumnos: rutinas propias, invitaciones y asignaciones.
-- Ejecutar una vez en Supabase > SQL Editor (después de schema.sql).
--
-- Seguridad:
--  * Nadie puede hacerse entrenador desde la app: la fila de `coaches`
--    solo se crea desde el SQL Editor (ver el final del archivo).
--  * Un alumno se une a un entrenador solo con un código de invitación
--    válido (función redeem_invite), dando su consentimiento.
--  * El entrenador lee los entrenamientos, series, peso corporal y perfil
--    de sus alumnos SOLO mientras exista el vínculo. No lee sus notas.
--  * El alumno puede romper el vínculo cuando quiera.
-- ==========================================================

-- ---------- Entrenadores ----------
create table if not exists public.coaches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);
alter table public.coaches enable row level security;
drop policy if exists "read own coach row" on public.coaches;
create policy "read own coach row" on public.coaches for select to authenticated
  using (user_id = (select auth.uid()));
-- Sin políticas de escritura: solo el SQL Editor (service role) crea entrenadores.

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where user_id = auth.uid());
$$;

-- ---------- Rutinas propias del entrenador ----------
create table if not exists public.custom_programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(data::text) < 500000)
);
create index if not exists custom_programs_coach_idx on public.custom_programs(coach_id);
alter table public.custom_programs enable row level security;

-- ---------- Vínculo entrenador ↔ alumno (un entrenador por alumno) ----------
create table if not exists public.coach_links (
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null unique references auth.users(id) on delete cascade,
  coach_name text not null default '',
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (coach_id, athlete_id),
  check (coach_id <> athlete_id)
);
alter table public.coach_links enable row level security;
drop policy if exists "see own links" on public.coach_links;
create policy "see own links" on public.coach_links for select to authenticated
  using (athlete_id = (select auth.uid()) or coach_id = (select auth.uid()));
drop policy if exists "leave link" on public.coach_links;
create policy "leave link" on public.coach_links for delete to authenticated
  using (athlete_id = (select auth.uid()) or coach_id = (select auth.uid()));
-- Sin política de insert: el vínculo solo se crea con redeem_invite().

-- ---------- Invitaciones ----------
create table if not exists public.coach_invites (
  code text primary key check (code ~ '^[A-Z0-9]{8}$'),
  coach_id uuid not null references auth.users(id) on delete cascade,
  coach_name text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
alter table public.coach_invites enable row level security;
drop policy if exists "coach manages invites" on public.coach_invites;
create policy "coach manages invites" on public.coach_invites for all to authenticated
  using (coach_id = (select auth.uid()) and public.is_coach())
  with check (coach_id = (select auth.uid()) and public.is_coach());
-- Los alumnos no leen invitaciones (no se pueden enumerar códigos).

-- Comprobaciones cruzadas en funciones security definer: evitan que las políticas
-- de custom_programs y assignments se llamen entre sí (recursión infinita).
create or replace function public.owns_program(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.custom_programs where id = p_id and coach_id = auth.uid());
$$;

-- ---------- Rutina asignada a cada alumno ----------
create table if not exists public.assignments (
  athlete_id uuid primary key references auth.users(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.custom_programs(id) on delete cascade,
  assigned_at timestamptz not null default now()
);
alter table public.assignments enable row level security;
create or replace function public.is_assigned_program(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assignments where program_id = p_id and athlete_id = auth.uid());
$$;
revoke all on function public.owns_program(uuid), public.is_assigned_program(uuid) from public, anon;
grant execute on function public.owns_program(uuid), public.is_assigned_program(uuid) to authenticated;
drop policy if exists "see own assignment" on public.assignments;
create policy "see own assignment" on public.assignments for select to authenticated
  using (athlete_id = (select auth.uid()) or coach_id = (select auth.uid()));
drop policy if exists "coach assigns" on public.assignments;
create policy "coach assigns" on public.assignments for all to authenticated
  using (coach_id = (select auth.uid()) and public.is_coach())
  with check (
    coach_id = (select auth.uid()) and public.is_coach()
    and exists (select 1 from public.coach_links l where l.coach_id = (select auth.uid()) and l.athlete_id = assignments.athlete_id)
    and public.owns_program(assignments.program_id)
  );
drop policy if exists "athlete drops assignment" on public.assignments;
create policy "athlete drops assignment" on public.assignments for delete to authenticated
  using (athlete_id = (select auth.uid()));

-- Políticas de custom_programs (después de crear assignments)
drop policy if exists "coach owns programs" on public.custom_programs;
create policy "coach owns programs" on public.custom_programs for all to authenticated
  using (coach_id = (select auth.uid()) and public.is_coach())
  with check (coach_id = (select auth.uid()) and public.is_coach());
drop policy if exists "athlete reads assigned program" on public.custom_programs;
create policy "athlete reads assigned program" on public.custom_programs for select to authenticated
  using (public.is_assigned_program(custom_programs.id));

-- ---------- Unirse con un código ----------
create or replace function public.redeem_invite(p_code text) returns table (joined_coach_id uuid, joined_coach_name text)
language plpgsql security definer set search_path = public as $$
declare inv public.coach_invites;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para unirte a un entrenador.'; end if;
  select * into inv from public.coach_invites i where i.code = upper(trim(p_code)) for update;
  if not found or inv.expires_at < now() or inv.used_by is not null then
    raise exception 'El código no es válido o ha caducado.';
  end if;
  if inv.coach_id = auth.uid() then raise exception 'No puedes usar tu propio código.'; end if;
  -- Un entrenador por alumno: el vínculo anterior (y su asignación) se sustituyen
  delete from public.assignments a where a.athlete_id = auth.uid();
  delete from public.coach_links l where l.athlete_id = auth.uid();
  insert into public.coach_links (coach_id, athlete_id, coach_name, consent_at)
    values (inv.coach_id, auth.uid(), inv.coach_name, now());
  update public.coach_invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return query select inv.coach_id, inv.coach_name;
end $$;
revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- Al dejar al entrenador también se quita la rutina asignada
create or replace function public.leave_coach() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.assignments where athlete_id = auth.uid();
  delete from public.coach_links where athlete_id = auth.uid();
end $$;
revoke all on function public.leave_coach() from public, anon;
grant execute on function public.leave_coach() to authenticated;

-- ---------- El entrenador lee los datos de sus alumnos (solo lectura) ----------
drop policy if exists "coach reads athlete profile" on public.profiles;
create policy "coach reads athlete profile" on public.profiles for select to authenticated
  using (exists (select 1 from public.coach_links l where l.coach_id = (select auth.uid()) and l.athlete_id = profiles.user_id));
drop policy if exists "coach reads athlete workouts" on public.workouts;
create policy "coach reads athlete workouts" on public.workouts for select to authenticated
  using (exists (select 1 from public.coach_links l where l.coach_id = (select auth.uid()) and l.athlete_id = workouts.user_id));
drop policy if exists "coach reads athlete sets" on public.workout_sets;
create policy "coach reads athlete sets" on public.workout_sets for select to authenticated
  using (exists (select 1 from public.coach_links l where l.coach_id = (select auth.uid()) and l.athlete_id = workout_sets.user_id));
drop policy if exists "coach reads athlete body weights" on public.body_weights;
create policy "coach reads athlete body weights" on public.body_weights for select to authenticated
  using (exists (select 1 from public.coach_links l where l.coach_id = (select auth.uid()) and l.athlete_id = body_weights.user_id));
-- exercise_notes queda privado: el entrenador no lo lee.

revoke all on public.coaches, public.custom_programs, public.coach_links, public.coach_invites, public.assignments from anon;

-- ---------- Hacerte entrenador (ejecutar aparte, con tu email) ----------
-- insert into public.coaches (user_id, display_name)
--   select id, 'Tu nombre' from auth.users where email = 'tu-email@dominio.com'
--   on conflict (user_id) do update set display_name = excluded.display_name;
