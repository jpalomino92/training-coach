-- ==========================================================
-- Aviso push al terminar el descanso.
-- - push_subscriptions: una fila por dispositivo suscrito, con la alarma
--   pendiente (alarm_at) que la app apunta al empezar cada descanso.
-- - Cada 5 s, pg_cron mira si hay alarmas vencidas y, solo entonces,
--   llama a la Edge Function "rest-push", que las envía.
-- Después de ejecutar esto, guarda en Vault la URL de la función y la
-- clave anon (ver README › "Aviso al terminar el descanso").
-- ==========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  alarm_at timestamptz,
  alarm_title text not null default '',
  alarm_body text not null default '',
  created_at timestamptz not null default now(),
  constraint push_endpoint_len check (char_length(endpoint) <= 1000),
  constraint push_title_len check (char_length(alarm_title) <= 120),
  constraint push_body_len check (char_length(alarm_body) <= 200)
);
create index if not exists push_subscriptions_alarm on public.push_subscriptions (alarm_at) where alarm_at is not null;

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: own" on public.push_subscriptions;
create policy "push: own" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Alta o renovación de la suscripción de este dispositivo. Si el mismo
-- teléfono la tenía otra cuenta (cerró sesión y entró otra persona), pasa a esta.
create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, alarm_at = null;
end $$;
revoke all on function public.register_push(text, text, text) from public, anon;
grant execute on function public.register_push(text, text, text) to authenticated;

-- Alarmas vencidas: se marcan como enviadas y se devuelven (las de hace más de
-- 2 minutos ya no se envían: el aviso llegaría tarde). Solo la usa la Edge Function.
create or replace function public.take_due_rest_alarms()
returns table (endpoint text, p256dh text, auth text, title text, body text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select s.endpoint as ep, s.alarm_at as was from public.push_subscriptions s
    where s.alarm_at <= now() for update skip locked
  ), taken as (
    update public.push_subscriptions s set alarm_at = null from due
    where s.endpoint = due.ep
    returning s.endpoint, s.p256dh, s.auth, s.alarm_title, s.alarm_body, due.was
  )
  select t.endpoint, t.p256dh, t.auth, t.alarm_title, t.alarm_body from taken t
  where t.was > now() - interval '2 minutes';
end $$;
revoke all on function public.take_due_rest_alarms() from public, anon, authenticated;
grant execute on function public.take_due_rest_alarms() to service_role;

-- Llama a la Edge Function solo si hay alguna alarma vencida
create or replace function public.fire_rest_alarms()
returns void language plpgsql security definer set search_path = public as $$
declare
  fn_url text;
  fn_key text;
begin
  if not exists (select 1 from public.push_subscriptions where alarm_at <= now()) then return; end if;
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'rest_push_url';
  select decrypted_secret into fn_key from vault.decrypted_secrets where name = 'rest_push_key';
  if fn_url is null then return; end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(fn_key, '')),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end $$;
revoke all on function public.fire_rest_alarms() from public, anon, authenticated;

select cron.schedule('rest-push', '5 seconds', 'select public.fire_rest_alarms()');
