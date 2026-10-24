-- Importar rutinas con IA (fotos, PDF o texto): registro de uso para el límite mensual.
-- Ejecutar una vez en Supabase > SQL Editor (después de 2026-10-24_user_programs.sql).
-- Solo la Edge Function "import-routine" (con la clave service_role) reserva y libera usos;
-- cada persona puede leer los suyos para ver cuántos le quedan.

create table if not exists public.ai_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_imports_user_idx on public.ai_imports(user_id, created_at);
alter table public.ai_imports enable row level security;

drop policy if exists "read own ai imports" on public.ai_imports;
create policy "read own ai imports" on public.ai_imports for select to authenticated
  using (user_id = (select auth.uid()));

-- Reserva un uso si quedan en el mes (UTC). Devuelve el id de la reserva o null si se llegó al límite.
-- El candado por usuario evita que dos pedidos a la vez se salten el límite.
create or replace function public.claim_ai_import(p_user uuid, p_limit int) returns uuid
language plpgsql security definer set search_path = public as $$
declare used int; new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai_import:' || p_user::text));
  select count(*) into used from public.ai_imports
    where user_id = p_user and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  if used >= p_limit then return null; end if;
  insert into public.ai_imports(user_id) values (p_user) returning id into new_id;
  return new_id;
end $$;

-- Si la lectura falla, el uso no cuenta.
create or replace function public.release_ai_import(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.ai_imports where id = p_id;
$$;

revoke all on function public.claim_ai_import(uuid, int), public.release_ai_import(uuid) from public, anon, authenticated;
grant execute on function public.claim_ai_import(uuid, int), public.release_ai_import(uuid) to service_role;
