-- ==========================================================
-- Arreglo: "infinite recursion detected in policy for relation assignments".
-- La política de custom_programs consultaba assignments y la de assignments
-- consultaba custom_programs. Las dos comprobaciones pasan a funciones
-- security definer (no vuelven a evaluar RLS) y el ciclo desaparece.
-- Ejecutar una vez en Supabase > SQL Editor.
-- ==========================================================

create or replace function public.owns_program(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.custom_programs where id = p_id and coach_id = auth.uid());
$$;

create or replace function public.is_assigned_program(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assignments where program_id = p_id and athlete_id = auth.uid());
$$;

revoke all on function public.owns_program(uuid), public.is_assigned_program(uuid) from public, anon;
grant execute on function public.owns_program(uuid), public.is_assigned_program(uuid) to authenticated;

drop policy if exists "coach assigns" on public.assignments;
create policy "coach assigns" on public.assignments for all to authenticated
  using (coach_id = (select auth.uid()) and public.is_coach())
  with check (
    coach_id = (select auth.uid()) and public.is_coach()
    and exists (select 1 from public.coach_links l where l.coach_id = (select auth.uid()) and l.athlete_id = assignments.athlete_id)
    and public.owns_program(assignments.program_id)
  );

drop policy if exists "athlete reads assigned program" on public.custom_programs;
create policy "athlete reads assigned program" on public.custom_programs for select to authenticated
  using (public.is_assigned_program(custom_programs.id));
